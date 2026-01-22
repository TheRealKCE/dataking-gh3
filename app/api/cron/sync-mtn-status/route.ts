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

    const supabase = createServerClient()

    try {
        // Get pending/processing MTN orders
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*, mtn_fulfillment_tracking(*)')
            .eq('network', 'MTN')
            .in('status', ['pending', 'processing'])
            .limit(50)

        if (error) throw error

        let updated = 0
        let failed = 0

        for (const order of orders || []) {
            try {
                // Get tracking record
                const tracking = order.mtn_fulfillment_tracking?.[0]
                if (!tracking?.api_response?.reference) continue

                const statusResult = await checkMTNOrderStatus(tracking.api_response.reference)

                if (statusResult.success) {
                    const newStatus = statusResult.status

                    if (newStatus !== order.status) {
                        // Update order status
                        await supabase
                            .from('orders')
                            .update({
                                status: newStatus,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', order.id)

                        // Update tracking
                        await supabase
                            .from('mtn_fulfillment_tracking')
                            .update({
                                status: newStatus,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', tracking.id)

                        // Create notification
                        const notifData = orderUpdateNotification(order.reference_code, newStatus)
                        await createNotification({
                            userId: order.user_id,
                            ...notifData,
                        })

                        // If failed, refund wallet
                        if (newStatus === 'failed') {
                            const { data: wallet } = await supabase
                                .from('wallets')
                                .select('*')
                                .eq('user_id', order.user_id)
                                .single()

                            if (wallet) {
                                await supabase
                                    .from('wallets')
                                    .update({
                                        balance: wallet.balance + order.price,
                                        total_spent: wallet.total_spent - order.price,
                                        updated_at: new Date().toISOString(),
                                    })
                                    .eq('id', wallet.id)

                                // Create refund transaction
                                await supabase.from('wallet_transactions').insert({
                                    wallet_id: wallet.id,
                                    user_id: order.user_id,
                                    type: 'credit',
                                    amount: order.price,
                                    description: `Refund for failed order ${order.reference_code}`,
                                    reference: order.reference_code,
                                    source: 'refund',
                                    status: 'completed',
                                })

                                // Update order payment status
                                await supabase
                                    .from('orders')
                                    .update({ payment_status: 'refunded' })
                                    .eq('id', order.id)
                            }
                        }

                        updated++
                    }
                }
            } catch (orderError) {
                console.error(`Error processing order ${order.id}:`, orderError)
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
