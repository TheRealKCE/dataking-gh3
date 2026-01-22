import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkRegularOrderStatus, checkBigTimeOrderStatus } from '@/lib/at-ishare-service'
import { createNotification, orderUpdateNotification } from '@/lib/notification-service'

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    try {
        // Get pending/processing orders for Telecel, AT-iShare, AT-BigTime
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*, fulfillment_logs(*)')
            .in('network', ['Telecel', 'AT-iShare', 'AT-BigTime'])
            .in('status', ['pending', 'processing'])
            .not('codecraft_reference', 'is', null)
            .limit(50)

        if (error) throw error

        let updated = 0
        let failed = 0

        for (const order of orders || []) {
            try {
                if (!order.codecraft_reference) continue

                // Check status based on network type
                const statusResult = order.network === 'AT-BigTime'
                    ? await checkBigTimeOrderStatus(order.codecraft_reference)
                    : await checkRegularOrderStatus(order.codecraft_reference)

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

                        // Update fulfillment log
                        await supabase
                            .from('fulfillment_logs')
                            .update({
                                status: newStatus,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('order_id', order.id)

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
        console.error('Cron sync-codecraft-status error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
