import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
// import { isRateLimited, checkFraudSignals, logSuspiciousActivity } from '@/lib/security'

interface BulkOrderItem {
    packageId: string
    phoneNumber: string
    packagePrice: number
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        // === SECURITY: Rate limit purchases ===
        // if (isRateLimited(userId, 'bulk')) {
        //     return NextResponse.json({ error: 'Too many requests. Please wait a few seconds.' }, { status: 429 })
        // }

        let body: { orders: BulkOrderItem[] }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { orders } = body

        if (!Array.isArray(orders) || orders.length === 0) {
            return NextResponse.json({ error: 'No orders provided' }, { status: 400 })
        }

        if (orders.length > 500) {
            return NextResponse.json({ error: 'Maximum 500 orders per batch' }, { status: 400 })
        }

        const supabase = createServerClient()

        // === 1. Get user role ===
        const { data: userRoleData } = await supabase
            .from('users')
            .select('role, email, first_name, last_name')
            .eq('id', userId)
            .single()

        const isAgent = (userRoleData as any)?.role === 'agent'
        const isAdminUser = (userRoleData as any)?.role === 'admin' || (userRoleData as any)?.role === 'sub-admin'

        if (!isAgent && !isAdminUser) {
            return NextResponse.json({ error: 'Bulk orders are only available to agents and admins' }, { status: 403 })
        }

        // === 2. Validate all orders server-side ===
        const packageIds = [...new Set(orders.map(o => o.packageId))]
        const { data: packages, error: pkgsError } = await supabase
            .from('data_packages')
            .select('*')
            .in('id', packageIds)
            .eq('is_available', true)

        if (pkgsError || !packages) {
            return NextResponse.json({ error: 'Failed to load packages' }, { status: 500 })
        }

        const pkgMap = new Map(packages.map((p: any) => [p.id, p]))

        // Validate each order and compute authoritative prices
        const validatedOrders = orders.map((order) => {
            const pkg = pkgMap.get(order.packageId)
            if (!pkg) return { ...order, error: 'Package not found' }

            const authoritativePrice = (isAgent && (pkg as any).agent_price > 0)
                ? (pkg as any).agent_price
                : (pkg as any).price

            return {
                ...order,
                packagePrice: authoritativePrice,
                network: (pkg as any).network,
                size: (pkg as any).size,
                costPrice: (pkg as any).cost_price || 0,
            }
        })

        const invalidOrders = validatedOrders.filter((o: any) => o.error)
        if (invalidOrders.length > 0) {
            return NextResponse.json({ error: `Some packages are invalid: ${invalidOrders.map((o: any) => o.error).join(', ')}` }, { status: 400 })
        }

        // === 3. Calculate total and deduct atomically ===
        const totalCost = validatedOrders.reduce((sum, o: any) => sum + o.packagePrice, 0)

        // === SECURITY: Fraud Check for Admin/Agent ===
        // Using an empty/generic phone or picking the first one, but primarily flagging the agent
        // const isFraud = await checkFraudSignals(userId, 'bulk_admin', supabase)
        // if (isFraud) {
        //     await logSuspiciousActivity(userId, 'bulk_purchase', 'fraud detected', supabase)
        //     return NextResponse.json({ error: 'Bulk action blocked due to suspicious activity' }, { status: 403 })
        // }

        const { data: deductResult, error: deductError } = await (supabase as any)
            .rpc('deduct_wallet_balance', {
                p_user_id: userId,
                p_amount: totalCost,
            })

        if (deductError) {
            if (deductError.message?.includes('INSUFFICIENT_BALANCE')) {
                return NextResponse.json({ error: 'Insufficient balance for all orders' }, { status: 400 })
            }
            console.error('Bulk wallet deduction error:', deductError)
            return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
        }

        const walletRow = deductResult?.[0] || deductResult
        const walletId = walletRow?.wallet_id
        const newBalance = walletRow?.new_balance

        if (!walletId) {
            return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
        }

        // === 4. Insert all orders in one batch ===
        const referenceCodes = validatedOrders.map(() => generateReferenceCode())

        const orderInserts = validatedOrders.map((order: any, i) => ({
            user_id: userId,
            phone_number: order.phoneNumber,
            network: order.network,
            size: order.size,
            price: order.packagePrice,
            cost_price: order.costPrice,
            status: 'pending',
            payment_status: 'paid',
            reference_code: referenceCodes[i],
            fulfillment_method: 'auto',
        }))

        const { data: createdOrders, error: ordersError } = await (supabase.from('orders') as any)
            .insert(orderInserts)
            .select('id, reference_code, network, size, phone_number')

        if (ordersError) {
            console.error('Bulk order insert error:', ordersError)
            // Refund the full amount since order creation failed
            await (supabase.from('wallets') as any)
                .update({
                    balance: (newBalance ?? 0) + totalCost,
                    total_spent: (walletRow?.new_total_spent ?? 0) - totalCost,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', walletId)
            return NextResponse.json({ error: 'Failed to create orders' }, { status: 500 })
        }

        // === 5. Insert all wallet transactions in one batch ===
        const txInserts = validatedOrders.map((order: any, i) => ({
            wallet_id: walletId,
            user_id: userId,
            type: 'debit',
            amount: order.packagePrice,
            description: `Bulk data purchase: ${order.size} for ${order.phoneNumber}`,
            reference: referenceCodes[i],
            source: 'purchase',
            status: 'completed',
        }))

        await (supabase.from('wallet_transactions') as any).insert(txInserts)

        // === 6. Insert a single summary notification ===
        await (supabase.from('notifications') as any).insert({
            user_id: userId,
            title: 'Bulk Order Placed',
            message: `${validatedOrders.length} orders have been placed successfully. Total: GHS ${totalCost.toFixed(2)}`,
            type: 'order_update',
            action_url: `/dashboard/my-orders`,
        })

        // === 7. Trigger fulfillment concurrently for all orders ===
        if (createdOrders && createdOrders.length > 0) {
            const userName = `${(userRoleData as any)?.first_name || ''} ${(userRoleData as any)?.last_name || ''}`.trim() || 'Customer'
            const userEmail = (userRoleData as any)?.email || 'Unknown'

            // Fire and forget — do not await fulfillment so response is fast
            Promise.allSettled(
                (createdOrders as any[]).map((order) =>
                    triggerFulfillment(order.id, order.network, { email: userEmail, name: userName })
                )
            ).catch((err) => console.error('[BulkPurchase] Fulfillment error:', err))
        }

        return NextResponse.json({
            success: true,
            ordersPlaced: validatedOrders.length,
            totalCost,
            newBalance,
        })

    } catch (error) {
        console.error('Bulk purchase error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

async function triggerFulfillment(orderId: string, network: string, user: { email: string, name: string }) {
    try {
        const { fulfillOrder } = await import('@/lib/fulfillment-service')
        const { sendAdminNewOrderAlert } = await import('@/lib/email-service')
        const supabase = createServerClient()

        const { data: settingsData } = await supabase
            .from('admin_settings')
            .select('key, value')
            .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings'])

        const settingsMap = (settingsData || []).reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()
        if (!order) return

        const alertDetails = {
            referenceCode: (order as any).reference_code,
            phoneNumber: (order as any).phone_number,
            network: (order as any).network,
            size: (order as any).size,
            price: (order as any).price,
            customerName: user.name,
            customerEmail: user.email,
            source: 'main_site' as const,
            reason: ''
        }

        if (settingsMap.auto_fulfillment_enabled === 'false') {
            sendAdminNewOrderAlert({ ...alertDetails, reason: 'Global auto-fulfillment is disabled' })
            return
        }

        let fulfillmentSettings = { networks: {} as Record<string, boolean> }
        try {
            if (settingsMap.fulfillment_settings) {
                fulfillmentSettings = typeof settingsMap.fulfillment_settings === 'string'
                    ? JSON.parse(settingsMap.fulfillment_settings)
                    : settingsMap.fulfillment_settings
            }
        } catch { /* ignore */ }

        if (fulfillmentSettings.networks[network] === false) {
            sendAdminNewOrderAlert({ ...alertDetails, reason: `Auto-fulfillment is disabled for network: ${network}` })
            return
        }

        const { data: existingTracking } = await supabase
            .from('mtn_fulfillment_tracking').select('status').eq('order_id', orderId).single()
        if (existingTracking) return

        const result = await fulfillOrder(network, (order as any).phone_number, (order as any).size, orderId)

        if (result.success) {
            await (supabase.from('mtn_fulfillment_tracking') as any).insert({
                order_id: orderId,
                status: 'processing',
                api_response: result.apiResponse || { reference: result.reference, network },
            })
            await (supabase.from('orders') as any)
                .update({ status: 'processing', updated_at: new Date().toISOString() })
                .eq('id', orderId)
        } else {
            sendAdminNewOrderAlert({ ...alertDetails, reason: `Auto-fulfillment API error: ${result.error || 'Unknown error'}` })
            await (supabase.from('mtn_fulfillment_tracking') as any).insert({
                order_id: orderId,
                status: 'failed',
                api_response: { error: result.error, network, ...result.apiResponse },
            })
        }
    } catch (error) {
        console.error(`[BulkFulfillment] Error processing order ${orderId}:`, error)
    }
}
