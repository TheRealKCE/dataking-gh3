import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendOrderSuccessEmail, sendAdminNewOrderAlert } from '@/lib/email-service'
import { sendOrderSuccessSMS, sendAdminAgentOrderAlert } from '@/lib/sms-service'

// === SECURITY: In-memory rate limiter ===
const purchaseRateMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 10_000 // 10 seconds
const RATE_LIMIT_MAX = 3 // max 3 purchases per window

function isRateLimited(userId: string): boolean {
    const now = Date.now()
    const timestamps = purchaseRateMap.get(userId) || []
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    if (recent.length >= RATE_LIMIT_MAX) return true
    recent.push(now)
    purchaseRateMap.set(userId, recent)
    // Cleanup old entries every 100 users to prevent memory leak
    if (purchaseRateMap.size > 1000) {
        for (const [key, val] of purchaseRateMap) {
            if (val.every(t => now - t > RATE_LIMIT_WINDOW_MS)) purchaseRateMap.delete(key)
        }
    }
    return false
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
            console.error('Order API: Unauthorized - Session error or missing user:', sessionError?.message)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = session.user
        const userId = user.id

        // === SECURITY: Rate limit purchases ===
        if (isRateLimited(userId)) {
            return NextResponse.json({ error: 'Too many requests. Please wait a few seconds.' }, { status: 429 })
        }

        let body;
        try {
            body = await request.json()
        } catch (e) {
            console.error('Order API: Failed to parse request body')
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { packageId, phoneNumber } = body

        // ✅ VALIDATE PHONE NUMBER FORMAT
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
        }

        // Ghana phone format: 0XXXXXXXXX (10 digits) or 233XXXXXXXXX (12 digits)
        const cleanPhone = phoneNumber.replace(/\s+/g, '') // Remove spaces
        const ghanaPhoneRegex = /^(0\d{9}|233\d{9})$/

        if (!ghanaPhoneRegex.test(cleanPhone)) {
            return NextResponse.json({
                error: 'Invalid phone number format. Use Ghana format: 0XXXXXXXXX or 233XXXXXXXXX'
            }, { status: 400 })
        }

        // Service role client for privileged operations
        const supabase = createServerClient()

        // Get package details
        const { data: pkg, error: pkgError } = await supabase
            .from('data_packages')
            .select('*')
            .eq('id', packageId)
            .eq('is_available', true)
            .single()

        if (pkgError || !pkg) {
            return NextResponse.json({ error: 'Package not found' }, { status: 404 })
        }

        // Check if phone is blacklisted
        const { data: blacklisted } = await supabase
            .from('phone_blacklist')
            .select('id')
            .eq('phone_number', phoneNumber)
            .single()

        if (blacklisted) {
            return NextResponse.json({ error: 'This phone number is not allowed' }, { status: 400 })
        }

        // Get user role for price calculation
        const { data: userRoleData } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single()

        const isAgent = (userRoleData as any)?.role === 'agent'

        // Determine price to charge
        // If agent and agent_price is set (greater than 0), use agent_price.
        // Otherwise use standard price.
        const priceToCharge = (isAgent && (pkg as any).agent_price > 0)
            ? (pkg as any).agent_price
            : (pkg as any).price

        // === SECURITY: Atomic wallet deduction (prevents double-spend) ===
        // This single RPC call checks balance >= amount AND deducts in one atomic operation.
        // If 5 requests arrive simultaneously, only the ones where balance is sufficient succeed.
        const { data: deductResult, error: deductError } = await (supabase as any)
            .rpc('deduct_wallet_balance', {
                p_user_id: userId,
                p_amount: priceToCharge,
            })

        if (deductError) {
            if (deductError.message?.includes('INSUFFICIENT_BALANCE')) {
                return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
            }
            console.error('Wallet deduction error:', deductError)
            return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
        }

        const walletRow = deductResult?.[0] || deductResult
        const walletId = walletRow?.wallet_id
        const newBalance = walletRow?.new_balance

        if (!walletId) {
            return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
        }

        const referenceCode = generateReferenceCode()

        // Create order AFTER successful deduction (no money lost if order insert fails)
        const { data: order, error: orderError } = await (supabase
            .from('orders') as any)
            .insert({
                user_id: userId,
                phone_number: phoneNumber,
                network: (pkg as any).network,
                size: (pkg as any).size,
                price: priceToCharge,
                cost_price: (pkg as any).cost_price || 0,
                status: 'pending',
                payment_status: 'paid',
                reference_code: referenceCode,
                fulfillment_method: 'auto',
            })
            .select()
            .single()

        if (orderError) {
            console.error('Order creation error:', orderError)
            // Refund the deducted amount since order failed
            await (supabase.from('wallets') as any)
                .update({
                    balance: (newBalance ?? 0) + priceToCharge,
                    total_spent: (walletRow?.new_total_spent ?? 0) - priceToCharge,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', walletId)
            return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
        }

        // Create wallet transaction
        await (supabase.from('wallet_transactions') as any).insert({
            wallet_id: walletId,
            user_id: userId,
            type: 'debit',
            amount: priceToCharge,
            description: `Data purchase: ${(pkg as any).size} for ${phoneNumber}`,
            reference: referenceCode,
            source: 'purchase',
            status: 'completed',
        })

        // Update customer purchases
        await updateCustomerPurchases(supabase, userId!, phoneNumber, priceToCharge)

        // Create notification
        await (supabase.from('notifications') as any).insert({
            user_id: userId,
            title: 'Order Placed',
            message: `Your order for ${(pkg as any).size} to ${phoneNumber} has been placed and is being processed.`,
            type: 'order_update',
            action_url: `/dashboard/my-orders`,
        })

        // Send order confirmation email to user and admin alert (async, non-blocking)
        try {
            // Get user details for email and SMS
            const { data: userData } = await supabase
                .from('users')
                .select('email, first_name, last_name, phone_number, role')
                .eq('id', userId)
                .single()

            if (userData) {
                const userEmail = (userData as any).email
                const firstName = (userData as any).first_name || 'Customer'
                const lastName = (userData as any).last_name || ''
                const userRole = (userData as any).role

                // Send order success email to user (skip for admin/sub-admin)
                const isAdminUser = userRole === 'admin' || userRole === 'sub-admin'
                if (!isAdminUser) {
                    sendOrderSuccessEmail(
                        userEmail,
                        firstName,
                        {
                            referenceCode,
                            phoneNumber,
                            network: (pkg as any).network,
                            size: (pkg as any).size,
                            price: priceToCharge
                        }
                    ).catch((err: Error) => console.error('[Order] User email error:', err))
                }

                // Send order success SMS to account holder
                const accountHolderPhone = (userData as any).phone_number
                if (accountHolderPhone) {
                    sendOrderSuccessSMS(
                        accountHolderPhone,
                        {
                            network: (pkg as any).network,
                            size: (pkg as any).size,
                            price: priceToCharge,
                            recipientNumber: phoneNumber,
                            currentBalance: newBalance
                        }
                    ).catch((err: Error) => console.error('[Order] SMS error:', err))
                }

                // ISSUE 3: REMOVED UNCONDITIONAL ADMIN EMAIL ALERT HERE.
                // It is now handled inside triggerFulfillment (only sent if NOT unfulfilled).

                // Check if user is agent for SMS alert 
                if (isAgent) {
                    sendAdminAgentOrderAlert()
                        .catch((err: Error) => console.error('[Order] Agent Admin SMS alert error:', err))
                }
            }
        } catch (emailError) {
            console.error('[Order] Failed to send email notification:', emailError)
        }

        // Trigger auto-fulfillment (async) - Awaited to ensure Vercel execution
        try {
            const { data: userData } = await supabase
                .from('users')
                .select('email, first_name, last_name')
                .eq('id', userId)
                .single()

            const traveler = userData as any;
            await triggerFulfillment((order as any).id, (pkg as any).network, {
                email: traveler?.email || 'Unknown',
                name: `${traveler?.first_name || ''} ${traveler?.last_name || ''}`.trim() || 'Customer'
            })
        } catch (fulfillmentError) {
            console.error('[Purchase API] Fulfillment trigger error:', fulfillmentError)
        }

        return NextResponse.json({
            success: true,
            order: {
                id: (order as any).id,
                reference_code: referenceCode,
                status: 'pending',
            },
        })
    } catch (error) {
        console.error('Purchase error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

async function updateCustomerPurchases(
    supabase: any,
    userId: string,
    phoneNumber: string,
    amount: number
) {
    const { data: existing } = await supabase
        .from('customer_purchases')
        .select('*')
        .eq('user_id', userId)
        .eq('customer_phone', phoneNumber)
        .single()

    if (existing) {
        await supabase
            .from('customer_purchases')
            .update({
                total_purchases: existing.total_purchases + 1,
                total_spent: existing.total_spent + amount,
                last_purchase_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
    } else {
        await supabase.from('customer_purchases').insert({
            user_id: userId,
            customer_phone: phoneNumber,
            total_purchases: 1,
            total_spent: amount,
            first_purchase_at: new Date().toISOString(),
            last_purchase_at: new Date().toISOString(),
        })
    }
}

async function triggerFulfillment(orderId: string, network: string, user: { email: string, name: string }) {
    try {
        const { fulfillOrder } = await import('@/lib/fulfillment-service')
        const { sendAdminNewOrderAlert } = await import('@/lib/email-service')
        const supabase = createServerClient()

        // 1. Get fulfillment settings from database
        const { data: settingsData } = await supabase
            .from('admin_settings')
            .select('key, value')
            .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings'])

        const settingsMap = (settingsData || []).reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // 2. Get order details
        const { data: order } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (!order) {
            console.error(`[Fulfillment] Order ${orderId} not found`)
            return
        }

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

        // Check global toggle
        if (settingsMap.auto_fulfillment_enabled === 'false') {
            console.log(`[Fulfillment] Auto-fulfillment globally disabled via database settings`)
            sendAdminNewOrderAlert({ ...alertDetails, reason: 'Global auto-fulfillment is disabled' })
            return
        }

        // Check network-specific toggle (if exists)
        let fulfillmentSettings = { networks: {} as Record<string, boolean> }
        try {
            if (settingsMap.fulfillment_settings) {
                fulfillmentSettings = typeof settingsMap.fulfillment_settings === 'string'
                    ? JSON.parse(settingsMap.fulfillment_settings)
                    : settingsMap.fulfillment_settings
            }
        } catch (e) {
            console.error('[Fulfillment] Failed to parse fulfillment_settings:', e)
        }

        const isNetworkEnabled = fulfillmentSettings.networks[network] !== false // Default to true if not specified
        if (!isNetworkEnabled) {
            console.log(`[Fulfillment] Auto-fulfillment disabled for ${network} via database settings`)
            sendAdminNewOrderAlert({ ...alertDetails, reason: `Auto-fulfillment is disabled for network: ${network}` })
            return
        }

        // ✅ IDEMPOTENCY CHECK: Prevent duplicate fulfillment
        const { data: existingTracking } = await supabase
            .from('mtn_fulfillment_tracking')
            .select('status')
            .eq('order_id', orderId)
            .single()

        if (existingTracking) {
            console.log(`[Fulfillment] Order ${orderId} already in tracking with status: ${(existingTracking as any).status}, skipping duplicate fulfillment`)
            return
        }

        console.log(`[Fulfillment] Processing ${network} order ${orderId}`)

        // 3. Call Service API
        const result = await fulfillOrder(
            network,
            (order as any).phone_number,
            (order as any).size,
            orderId
        )

        if (result.success) {
            console.log(`[Fulfillment] Order ${orderId} (${network}) submitted successfully`)

            // Create tracking record
            await (supabase.from('mtn_fulfillment_tracking') as any).insert({
                order_id: orderId,
                status: 'processing',
                api_response: result.apiResponse || { reference: result.reference, network },
            })

            // Update order status to processing
            await (supabase.from('orders') as any)
                .update({
                    status: 'processing',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orderId)

            // NO ALERT SENT ON SUCCESS
        } else if (result.isRateLimited) {
            console.warn(`[Fulfillment] Order ${orderId} (${network}) rate limited. Moving to queue.`)

            // Create tracking record for queue
            await (supabase.from('mtn_fulfillment_tracking') as any).insert({
                order_id: orderId,
                status: 'queued',
                api_response: { error: 'Rate Limit (429)', network },
            })

            // Update order status to queued
            await (supabase.from('orders') as any)
                .update({
                    status: 'queued',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orderId)
        } else {
            console.error(`[Fulfillment] Order ${orderId} (${network}) failed:`, result.error)

            sendAdminNewOrderAlert({ ...alertDetails, reason: `Auto-fulfillment API error: ${result.error || 'Unknown error'}` })

            // Create tracking record with error
            await (supabase.from('mtn_fulfillment_tracking') as any).insert({
                order_id: orderId,
                status: 'failed',
                api_response: { error: result.error, network, ...result.apiResponse },
            })
        }
    } catch (error) {
        console.error(`[Fulfillment] Error processing order ${orderId}:`, error)
    }
}
