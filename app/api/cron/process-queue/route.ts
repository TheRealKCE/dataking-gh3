import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fulfillOrder } from '@/lib/fulfillment-service'
import { sendAdminNewOrderAlert } from '@/lib/email-service'

export const maxDuration = 60; // 1 minute max for Vercel Hobby/Pro
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    // Optional cron secret check to securely execute background jobs
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const supabase = createServerClient()
    const db = supabase as any

    try {
        // Fetch all queued orders, starting with oldest
        const { data: queuedOrders, error: fetchError } = await db
            .from('orders')
            .select(`
                id, 
                shop_order_id, 
                network, 
                phone_number, 
                size, 
                price,
                reference_code,
                users ( email, first_name, last_name ),
                mtn_fulfillment_tracking ( retry_count )
            `)
            .eq('status', 'queued')
            .order('created_at', { ascending: true })

        if (fetchError || !queuedOrders) {
            console.error('[Queue Processor] Error fetching queued orders:', fetchError)
            return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
        }

        if (queuedOrders.length === 0) {
            return NextResponse.json({ success: true, message: 'Queue is empty' })
        }

        console.log(`[Queue Processor] Found ${queuedOrders.length} queued orders. Processing batch...`)

        let processedCount = 0;

        for (const order of queuedOrders) {
            // Process max 8 orders per minute to avoid Vercel timeout (8 * 5s = 40s)
            if (processedCount >= 8) {
                console.log(`[Queue Processor] Reached batch limit (8). Saving rest for next minute.`);
                break;
            }

            console.log(`[Queue Processor] Processing order ${order.id}...`)

            // Wait 5 seconds between each processing to drip-feed the API, bypassing 429 locks
            if (processedCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 5000))
            }

            const targetOrderRef = order.shop_order_id || order.id
            const result = await fulfillOrder(
                order.network,
                order.phone_number,
                order.size,
                targetOrderRef
            )

            if (result.success) {
                // Success: Update strictly to 'processing' so Admin can control completion
                console.log(`[Queue Processor] Order ${order.id} fulfilled successfully. Marking as processing.`)

                await db.from('orders').update({
                    status: 'processing',
                    updated_at: new Date().toISOString()
                }).eq('id', order.id)

                if (order.shop_order_id) {
                    await db.from('shop_orders').update({
                        status: 'processing',
                        updated_at: new Date().toISOString()
                    }).eq('id', order.shop_order_id)
                }

                // Append tracking
                await db.from('mtn_fulfillment_tracking').update({
                    status: 'processing',
                    api_response: result.apiResponse || { note: 'Background Queue Fulfillment Success' }
                }).eq('order_id', order.id)

            } else if (result.isRateLimited) {
                // Tracking array fetch
                const trackingRecords = order.mtn_fulfillment_tracking || [];
                const trackingRecord = Array.isArray(trackingRecords) ? trackingRecords[0] : trackingRecords;
                const currentRetries = trackingRecord?.retry_count || 0;

                if (currentRetries >= 2) {
                    console.error(`[Queue Processor] Order ${order.id} hit max 429 retries. Failing to manual queue.`);
                    // Max retries reached. Mark as pending and alert admin.
                    await db.from('orders').update({
                        status: 'pending',
                        updated_at: new Date().toISOString()
                    }).eq('id', order.id)

                    if (order.shop_order_id) {
                        await db.from('shop_orders').update({
                            status: 'pending',
                            updated_at: new Date().toISOString()
                        }).eq('id', order.shop_order_id)
                    }

                    await db.from('mtn_fulfillment_tracking').update({
                        status: 'failed',
                        api_response: { error: 'Max Rate Limit Retries Exceeded', note: 'Background Queue Fulfillment Failed' }
                    }).eq('order_id', order.id)

                    // Send admin manual intervention email
                    const userObj = order.users || (order.users as any)?.[0] || {}
                    await sendAdminNewOrderAlert({
                        referenceCode: order.reference_code,
                        phoneNumber: order.phone_number,
                        network: order.network,
                        size: order.size,
                        price: order.price,
                        customerName: `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || 'Customer',
                        customerEmail: userObj.email || 'N/A',
                        source: order.shop_order_id ? 'shop_storefront' : 'main_site',
                        reason: `Max 429 Rate Limit Retries Exceeded (2)`
                    }).catch(e => console.error('[Queue Processor] Admin email error:', e))

                    // Break to avoid hitting limit further this minute
                    break;
                } else {
                    console.warn(`[Queue Processor] Hit 429 on order ${order.id}. Incrementing retry count to ${currentRetries + 1} and aborting batch.`);
                    // Increment retry count but keep it queued. Stop processor for this minute.
                    await db.from('mtn_fulfillment_tracking').update({
                        retry_count: currentRetries + 1,
                        api_response: { error: 'Rate Limit (429)', note: `Queue attempt ${currentRetries + 1}` }
                    }).eq('order_id', order.id)

                    break;
                }
            } else {
                // Hard failure: Update strictly to 'pending' to trigger manual flow
                console.error(`[Queue Processor] Hard failure on order ${order.id}:`, result.error)

                await db.from('orders').update({
                    status: 'pending',
                    updated_at: new Date().toISOString()
                }).eq('id', order.id)

                if (order.shop_order_id) {
                    await db.from('shop_orders').update({
                        status: 'pending',
                        updated_at: new Date().toISOString()
                    }).eq('id', order.shop_order_id)
                }

                await db.from('mtn_fulfillment_tracking').update({
                    status: 'failed',
                    api_response: { error: result.error, note: 'Background Queue Fulfillment Failed' }
                }).eq('order_id', order.id)

                // Send admin manual intervention email
                const userObj = order.users || (order.users as any)?.[0] || {}
                await sendAdminNewOrderAlert({
                    referenceCode: order.reference_code,
                    phoneNumber: order.phone_number,
                    network: order.network,
                    size: order.size,
                    price: order.price,
                    customerName: `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || 'Customer',
                    customerEmail: userObj.email || 'N/A',
                    source: order.shop_order_id ? 'shop_storefront' : 'main_site',
                    reason: `Queue Auto-fulfillment API error: ${result.error || 'Unknown error'}`
                }).catch(e => console.error('[Queue Processor] Admin email error:', e))
            }

            processedCount++;
        }

        return NextResponse.json({ success: true, processed: processedCount, totalQueuedRemaining: queuedOrders.length - processedCount })
    } catch (err: any) {
        console.error('[Queue Processor] CRITICAL ERROR:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
