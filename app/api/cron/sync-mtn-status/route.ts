import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkMTNOrderStatus } from '@/lib/mtn-fulfillment'
import { createNotification, orderUpdateNotification } from '@/lib/notification-service'

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = createServerClient()

        // Only check orders from last 2 hours 5 minutes (125 minutes)
        // This gives cron 2 chances to check before timing out (hourly schedule)
        const timeoutMinutes = 125
        const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()

        // Fetch orders that are pending or processing
        const { data: orders } = await supabase
            .from('orders')
            .select(`
        *,
        mtn_fulfillment_tracking(*)
      `)
            .in('status', ['pending', 'processing'])
            .eq('network', 'MTN')
            .gte('created_at', cutoffTime)  // Only recent orders
            .limit(50)

        if (!orders || orders.length === 0) {
            return NextResponse.json({ success: true, processed: 0, updated: 0, failed: 0 })
        }

        let updated = 0
        let failed = 0

        for (const order of orders) {
            try {
                const tracking = (order as any).mtn_fulfillment_tracking?.[0]
                if (!tracking?.api_response?.transaction_id) continue

                const statusResult = await checkMTNOrderStatus(tracking.api_response.transaction_id)

                if (statusResult.success) {
                    const newStatus = statusResult.status

                    if (newStatus !== (order as any).status) {
                        // Update order status
                        await (supabase
                            .from('orders') as any)
                            .update({
                                status: newStatus,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', (order as any).id)

                        // Update tracking
                        await (supabase
                            .from('mtn_fulfillment_tracking') as any)
                            .update({
                                status: newStatus,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', (tracking as any).id)

                        // Create notification
                        const notifData = orderUpdateNotification((order as any).reference_code, newStatus)
                        await createNotification({
                            userId: (order as any).user_id,
                            ...notifData,
                        })

                        // Note: Failed orders are not automatically refunded
                        // Admin will manually review and refund via admin panel

                        updated++
                    }
                }
            } catch (orderError) {
                console.error(`Error processing order ${(order as any).id}:`, orderError)
                failed++
            }
        }

        return NextResponse.json({
            success: true,
            processed: orders?.length || 0,
            updated,
            failed,
        })
    } catch (error) {
        console.error('Cron sync-mtn-status error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
