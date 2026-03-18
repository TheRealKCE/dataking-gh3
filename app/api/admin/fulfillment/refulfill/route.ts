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
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify admin role
        const { data: user } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
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

        // Global check (if disabled entirely, not even manual should work unless intended otherwise;
        // but typically manual bypasses global auto, so we'll just check network-specific)
        const dbFulfillmentSettings = typeof settingsMap.fulfillment_settings === 'string'
            ? JSON.parse(settingsMap.fulfillment_settings)
            : settingsMap.fulfillment_settings || { networks: {} }
        const networkSettings = dbFulfillmentSettings.networks || {}

        // Construct query to find pending orders
        let query = supabaseAdmin
            .from('orders')
            .select('id, network, phone_number, size, status, user_id, price')
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

        // Process each pending order safely
        for (const order of pendingOrders) {
            // Check network settings: if the network is explicitly disabled in admin_settings, skip it
            if (networkSettings[order.network] === false) {
                console.log(`[ManualRefulfill] Skipping order ${order.id}: Network ${order.network} is disabled in settings.`)
                skipped++
                continue
            }

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
            console.log(`[ManualRefulfill] Locked order ${order.id}. Beginning fulfillment via DataKazina.`)

            const result = await fulfillOrder(
                order.network,
                order.phone_number,
                order.size,
                order.id
            )

            if (result.success) {
                console.log(`[ManualRefulfill] SUCCESS for order ${order.id}. Reference: ${result.reference}`)
                
                // Track success (keep status as processing as per refinement)
                await supabaseAdmin.from('mtn_fulfillment_tracking').insert({
                    order_id: order.id,
                    status: 'success', // Tracking record is success
                    api_response: { ...result.apiResponse, note: 'Manual Admin Refill Success' }
                })

                // Sync status to the healing wrapper so shop owners see the transition to processing
                await syncShopOrderStatus(order.id, 'processing').catch(err => 
                    console.error(`[ManualRefulfill] syncShopOrderStatus failed for ${order.id}:`, err)
                )

                // Note: We DO NOT update the order status to completed here!
                // As per user refinement, success leaves it processing.
                fulfilled++
            } else {
                console.error(`[ManualRefulfill] FAILED for order ${order.id}: ${result.error}`)
                
                // Track failure
                await supabaseAdmin.from('mtn_fulfillment_tracking').insert({
                    order_id: order.id,
                    status: 'failed',
                    api_response: { ...result.apiResponse, note: 'Manual Admin Refill Failed', error: result.error }
                })

                // Revert status to pending so it can be attempted again!
                await supabaseAdmin.from('orders')
                    .update({ status: 'pending' })
                    .eq('id', order.id)

                // Sync the reversion back to pending
                await syncShopOrderStatus(order.id, 'pending').catch(err => 
                    console.error(`[ManualRefulfill] syncShopOrderStatus revert failed for ${order.id}:`, err)
                )

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
