import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkRegularOrderStatus, checkBigTimeOrderStatus } from '@/lib/at-ishare-service'
import { syncShopOrderStatus } from '@/lib/shop-service'
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
            .select('*, mtn_fulfillment_tracking(*)')
            .in('network', ['Telecel', 'AT-iShare', 'AT-BigTime'])
            .in('status', ['pending', 'processing'])
            .not('codecraft_reference', 'is', null)
            .limit(50)

        if (error) throw error

        let updated = 0
        let failed = 0

        for (const order of orders || []) {
            try {
                if (!(order as any).codecraft_reference) continue

                // Check status based on network type
                const statusResult = (order as any).network === 'AT-BigTime'
                    ? await checkBigTimeOrderStatus((order as any).codecraft_reference)
                    : await checkRegularOrderStatus((order as any).codecraft_reference)

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

                        // Sync shop order status
                        await syncShopOrderStatus((order as any).id, newStatus).catch(err => 
                            console.error(`[CronSync] syncShopOrderStatus failed for ${(order as any).id}:`, err)
                        )

                        // Update fulfillment tracking
                        await (supabase
                            .from('mtn_fulfillment_tracking') as any)
                            .update({
                                status: newStatus,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('order_id', (order as any).id)

                        // Create notification
                        const notifData = orderUpdateNotification((order as any).reference_code, newStatus)
                        await createNotification({
                            userId: (order as any).user_id,
                            ...notifData,
                        })

                        // If failed, refund wallet
                        if (newStatus === 'failed') {
                            const { data: wallet } = await supabase
                                .from('wallets')
                                .select('*')
                                .eq('user_id', (order as any).user_id)
                                .single()

                            if (wallet) {
                                await (supabase
                                    .from('wallets') as any)
                                    .update({
                                        balance: (wallet as any).balance + (order as any).price,
                                        total_spent: (wallet as any).total_spent - (order as any).price,
                                        updated_at: new Date().toISOString(),
                                    })
                                    .eq('id', (wallet as any).id)

                                await (supabase.from('wallet_transactions') as any).insert({
                                    wallet_id: (wallet as any).id,
                                    user_id: (order as any).user_id,
                                    type: 'credit',
                                    amount: (order as any).price,
                                    description: `Refund for failed order ${(order as any).reference_code}`,
                                    reference: (order as any).reference_code,
                                    source: 'refund',
                                    status: 'completed',
                                })

                                await (supabase
                                    .from('orders') as any)
                                    .update({ payment_status: 'refunded' })
                                    .eq('id', (order as any).id)
                            }
                        }

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
        console.error('Cron sync-codecraft-status error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
