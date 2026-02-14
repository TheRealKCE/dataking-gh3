import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendOrderSuccessEmail, sendAdminNewOrderAlert } from '@/lib/email-service'
import { sendOrderSuccessSMS, sendAdminAgentOrderAlert } from '@/lib/sms-service'

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

        let body;
        try {
            body = await request.json()
        } catch (e) {
            console.error('Order API: Failed to parse request body')
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { packageId, phoneNumber } = body

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

        // Get user's wallet
        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (walletError || !wallet) {
            return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
        }

        // Check balance
        if ((wallet as any).balance < priceToCharge) {
            return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
        }

        const referenceCode = generateReferenceCode()

        // Create order
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
            return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
        }

        // Debit wallet
        const newBalance = (wallet as any).balance - priceToCharge
        const { error: debitError } = await (supabase
            .from('wallets') as any)
            .update({
                balance: newBalance,
                total_spent: ((wallet as any).total_spent || 0) + priceToCharge,
                updated_at: new Date().toISOString(),
            })
            .eq('id', (wallet as any).id)

        if (debitError) {
            console.error('Wallet debit error:', debitError)
            // Rollback order
            await (supabase.from('orders') as any).delete().eq('id', (order as any).id)
            return NextResponse.json({ error: 'Failed to debit wallet' }, { status: 500 })
        }

        // Create wallet transaction
        await (supabase.from('wallet_transactions') as any).insert({
            wallet_id: (wallet as any).id,
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

                // Send new order alert to admin
                // Check if user is agent for SMS alert
                // We already checked userRoleData earlier
                if (isAgent) {
                    sendAdminAgentOrderAlert()
                        .catch((err: Error) => console.error('[Order] Agent Admin SMS alert error:', err))
                }

                // Send new order alert to admin
                sendAdminNewOrderAlert({
                    referenceCode,
                    phoneNumber,
                    network: (pkg as any).network,
                    size: (pkg as any).size,
                    price: priceToCharge,
                    customerName: `${firstName} ${lastName}`.trim(),
                    customerEmail: userEmail
                }).catch((err: Error) => console.error('[Order] Admin email error:', err))
            }
        } catch (emailError) {
            console.error('[Order] Failed to send email notification:', emailError)
        }

        // Trigger auto-fulfillment (async)
        triggerFulfillment((order as any).id, (pkg as any).network)

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

async function triggerFulfillment(orderId: string, network: string) {
    try {
        const { fulfillOrder } = await import('@/lib/fulfillment-service')
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

        // Check global toggle
        if (settingsMap.auto_fulfillment_enabled === 'false') {
            console.log(`[Fulfillment] Auto-fulfillment globally disabled via database settings`)
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
            return
        }

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
            // We'll keep using mtn_fulfillment_tracking for now or handle per network if needed
            // For now, let's assume all go into this table or we should have a generic one
            // The schema has mtn_fulfillment_tracking specifically.
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
        } else {
            console.error(`[Fulfillment] Order ${orderId} (${network}) failed:`, result.error)

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
