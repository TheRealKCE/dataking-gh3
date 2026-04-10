import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fulfillOrder } from '@/lib/fulfillment-service'
import { syncShopOrderStatus } from '@/lib/shop-service'

// Create a service role client to bypass RLS for administrative fulfillment
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function POST(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify admin role
        const { data: user } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (!user || (user.role !== 'admin' && user.role !== 'sub-admin')) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
        }

        const body = await request.json()
        const { orderIds } = body

        // Fetch settings to check if global auto-fulfillment and networks are enabled
        const { data: settingsData } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings'])

        const settingsMap = (settingsData || []).reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        // Parse both networks and codecraft_networks from fulfillment_settings
        const dbFulfillmentSettings = typeof settingsMap.fulfillment_settings === 'string'
            ? JSON.parse(settingsMap.fulfillment_settings)
            : settingsMap.fulfillment_settings || {}
        const networkSettings = dbFulfillmentSettings.networks || {}
        const codecraftNetworkSettings = dbFulfillmentSettings.codecraft_networks || {}

        // Construct query to find pending orders
        let query = supabaseAdmin
            .from('orders')
            .select('id, network, phone_number, size, status, user_id, price, shop_order_id, reference_code')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })

        // If orderIds were provided, filter by those exact IDs
        if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
            query = query.in('id', orderIds)
        }

        const { data: pendingOrders, error: fetchError } = await query

        if (fetchError) {
            throw fetchError
        }

        if (!pendingOrders || pendingOrders.length === 0) {
            return NextResponse.json({ success: true, count: 0, fulfilled: 0, skipped: 0, failed: 0, message: 'No pending orders found to fulfill' })
        }

        let fulfilled = 0
        let skipped = 0
        let failed = 0

        const { sendAdminNewOrderAlert } = await import('@/lib/email-service')
        const { fulfillOrder: ccFulfillOrder } = await import('@/lib/codecraft-service')

        // Process each pending order safely
        for (const order of pendingOrders) {
            const isDataKazinaEnabled = networkSettings[order.network] === true
            const isCodeCraftEnabled = codecraftNetworkSettings[order.network] === true

            // Neither supplier enabled → skip
            if (!isDataKazinaEnabled && !isCodeCraftEnabled) {
                console.log(`[ManualRefulfill] Skipping order ${order.id}: No active supplier for network ${order.network}.`)
                skipped++
                continue
            }

            // Both enabled → conflict guard, skip
            if (isDataKazinaEnabled && isCodeCraftEnabled) {
                console.error(`[ManualRefulfill] CONFLICT: Both suppliers active for ${order.network} on order ${order.id}. Skipping.`)
                await sendAdminNewOrderAlert({
                    referenceCode: order.reference_code || order.id,
                    phoneNumber: order.phone_number,
                    network: order.network,
                    size: order.size,
                    price: order.price,
                    customerName: 'Shop Guest',
                    customerEmail: 'N/A',
                    source: 'shop_storefront',
                    shopName: 'Admin Refulfill',
                    reason: `⚠️ FULFILLMENT_CONFLICT: Both DataKazina and CodeCraft active for ${order.network}. Order ${order.id} skipped. Fix in admin panel.`
                }).catch(e => console.error('[ManualRefulfill] Alert error:', e))
                skipped++
                continue
            }

            // Determine which supplier will handle this order
            const supplierLabel = isCodeCraftEnabled ? 'codecraft' : 'datakazina'

            // ATOMIC LOCK: Try to update this specific order from 'pending' to 'processing'
            // If another process/request already took it, this will return 0 rows
            const { data: updatedOrder, error: lockError } = await supabaseAdmin
                .from('orders')
                .update({ status: 'processing' })
                .eq('id', order.id)
                .eq('status', 'pending') // MUST still be pending
                .select()
                .single()

            if (lockError || !updatedOrder) {
                // The order was no longer pending, someone else grabbed it or it was canceled
                console.log(`[ManualRefulfill] Order ${order.id} lock failed (already processing/completed). Skipping.`)
                skipped++
                continue
            }

            // --- WE HAVE THE LOCK. NOW FULFILL ---
            console.log(`[ManualRefulfill] Locked order ${order.id}. Beginning fulfillment via ${supplierLabel}.`)

            // Stamp fulfilled_by on shop_orders before calling supplier
            if (order.shop_order_id) {
                await supabaseAdmin
                    .from('shop_orders')
                    .update({ fulfilled_by: supplierLabel })
                    .eq('id', order.shop_order_id)
            }

            const result = isCodeCraftEnabled
                ? await ccFulfillOrder(order.network, order.phone_number, order.size, order.id)
                : await fulfillOrder(order.network, order.phone_number, order.size, order.id)

            if (result.success) {
                console.log(`[ManualRefulfill] SUCCESS for order ${order.id} via ${supplierLabel}. Reference: ${result.reference || result.transactionId}`)

                // Track success
                await supabaseAdmin.from('mtn_fulfillment_tracking').insert({
                    order_id: order.id,
                    status: 'success',
                    api_response: { ...result.apiResponse, note: `Manual Admin Refill Success via ${supplierLabel}` }
                })

                // Update shop_orders to processing + stamp codecraft_reference_id if CodeCraft
                if (order.shop_order_id) {
                    const shopOrderUpdate: Record<string, any> = {
                        status: 'processing',
                        updated_at: new Date().toISOString(),
                    }
                    if (isCodeCraftEnabled && result.transactionId) {
                        shopOrderUpdate.codecraft_reference_id = result.transactionId
                    }
                    await supabaseAdmin
                        .from('shop_orders')
                        .update(shopOrderUpdate)
                        .eq('id', order.shop_order_id)
                }

                // Sync status to the healing wrapper so shop owners see the transition to processing
                await syncShopOrderStatus(order.id, 'processing').catch(err =>
                    console.error(`[ManualRefulfill] syncShopOrderStatus failed for ${order.id}:`, err)
                )

                fulfilled++
            } else {
                console.error(`[ManualRefulfill] FAILED for order ${order.id} via ${supplierLabel}: ${result.error}`)

                // Track failure
                await supabaseAdmin.from('mtn_fulfillment_tracking').insert({
                    order_id: order.id,
                    status: 'failed',
                    api_response: { ...result.apiResponse, note: `Manual Admin Refill Failed via ${supplierLabel}`, error: result.error }
                })

                // Revert status to pending so it can be attempted again
                await supabaseAdmin.from('orders')
                    .update({ status: 'pending' })
                    .eq('id', order.id)

                // Revert shop_orders too
                if (order.shop_order_id) {
                    await supabaseAdmin
                        .from('shop_orders')
                        .update({ status: 'pending' })
                        .eq('id', order.shop_order_id)
                }

                // Sync the reversion back to pending
                await syncShopOrderStatus(order.id, 'pending').catch(err =>
                    console.error(`[ManualRefulfill] syncShopOrderStatus revert failed for ${order.id}:`, err)
                )

                // Fire admin alert with failure reason
                await sendAdminNewOrderAlert({
                    referenceCode: order.reference_code || order.id,
                    phoneNumber: order.phone_number,
                    network: order.network,
                    size: order.size,
                    price: order.price,
                    customerName: 'Shop Guest',
                    customerEmail: 'N/A',
                    source: 'shop_storefront',
                    shopName: 'Admin Refulfill',
                    reason: `Manual refulfill (${supplierLabel}) failed: ${result.error || 'Unknown error'}. Order reverted to pending.`
                }).catch(e => console.error('[ManualRefulfill] Alert error:', e))

                failed++
            }
        }

        return NextResponse.json({
            success: true,
            count: pendingOrders.length,
            fulfilled,
            skipped,
            failed
        })
    } catch (error: any) {
        console.error('[ManualRefulfill] Route Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
