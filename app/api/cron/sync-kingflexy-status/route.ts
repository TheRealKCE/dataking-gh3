import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkOrderStatus } from '@/lib/kingflexy-service'
import { areCronJobsEnabled, cronDisabledResponse } from '@/lib/cron-control'

// Rules:
//   KingFlexy → completed  : update order to completed
//   KingFlexy → failed/refund : update order to failed (admin does manual refund)
//   KingFlexy → processing : do nothing
//   Order already completed or pending : skip (only process orders in processing state)

export async function GET(request: NextRequest) {
    if (!areCronJobsEnabled()) return cronDisabledResponse()

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    let totalChecked = 0
    let totalUpdated = 0
    let totalFailed = 0
    const errors: string[] = []

    // ── Part A: shop_orders ───────────────────────────────────────────────────
    try {
        const { data: shopOrders, error: shopError } = await (supabase
            .from('shop_orders') as any)
            .select('id, kingflexy_reference, status')
            .eq('fulfilled_by', 'kingflexy')
            .eq('status', 'processing')      // only orders currently in processing
            .not('kingflexy_reference', 'is', null)
            .limit(50)

        if (shopError) {
            errors.push(`shop_orders query failed: ${shopError.message}`)
        } else {
            for (const order of shopOrders || []) {
                // Extra safety: skip if somehow already completed or pending
                if (order.status === 'completed' || order.status === 'pending') continue

                totalChecked++
                try {
                    const statusResult = await checkOrderStatus(order.kingflexy_reference)
                    if (!statusResult.success) continue

                    const newStatus = statusResult.status

                    if (newStatus === 'completed') {
                        // KingFlexy delivered — mark completed
                        const { error: updateError } = await (supabase
                            .from('shop_orders') as any)
                            .update({ status: 'completed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`shop_orders update failed for ${order.id}: ${updateError.message}`)
                            totalFailed++
                        } else {
                            console.log(`[KingFlexyCron] shop_orders ${order.id}: processing → completed`)
                            totalUpdated++
                        }
                    } else if (newStatus === 'failed') {
                        // KingFlexy failed/refunded — mark failed, admin handles manual refund
                        const { error: updateError } = await (supabase
                            .from('shop_orders') as any)
                            .update({ status: 'failed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`shop_orders update failed for ${order.id}: ${updateError.message}`)
                            totalFailed++
                        } else {
                            console.log(`[KingFlexyCron] shop_orders ${order.id}: processing → failed (manual refund required)`)
                            totalUpdated++
                        }
                    }
                    // newStatus === 'processing' or 'pending' → do nothing
                } catch (orderErr: any) {
                    errors.push(`shop_orders exception for ${order.id}: ${orderErr.message}`)
                    totalFailed++
                }
            }
        }
    } catch (partAErr: any) {
        errors.push(`Part A failed: ${partAErr.message}`)
    }

    // ── Part B: orders ────────────────────────────────────────────────────────
    try {
        const { data: mainOrders, error: mainError } = await (supabase
            .from('orders') as any)
            .select('id, kingflexy_reference, status')
            .eq('fulfillment_method', 'kingflexy')
            .eq('status', 'processing')
            .not('kingflexy_reference', 'is', null)
            .limit(50)

        if (mainError) {
            errors.push(`orders query failed: ${mainError.message}`)
        } else {
            for (const order of mainOrders || []) {
                if (order.status === 'completed' || order.status === 'pending') continue

                totalChecked++
                try {
                    const statusResult = await checkOrderStatus(order.kingflexy_reference)
                    if (!statusResult.success) continue

                    const newStatus = statusResult.status

                    if (newStatus === 'completed') {
                        const { error: updateError } = await (supabase
                            .from('orders') as any)
                            .update({ status: 'completed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`orders update failed for ${order.id}: ${updateError.message}`)
                            totalFailed++
                        } else {
                            console.log(`[KingFlexyCron] orders ${order.id}: processing → completed`)
                            totalUpdated++
                        }
                    } else if (newStatus === 'failed') {
                        const { error: updateError } = await (supabase
                            .from('orders') as any)
                            .update({ status: 'failed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`orders update failed for ${order.id}: ${updateError.message}`)
                            totalFailed++
                        } else {
                            console.log(`[KingFlexyCron] orders ${order.id}: processing → failed (manual refund required)`)
                            totalUpdated++
                        }
                    }
                } catch (orderErr: any) {
                    errors.push(`orders exception for ${order.id}: ${orderErr.message}`)
                    totalFailed++
                }
            }
        }
    } catch (partBErr: any) {
        errors.push(`Part B failed: ${partBErr.message}`)
    }

    return NextResponse.json({
        success: true,
        checked: totalChecked,
        updated: totalUpdated,
        failed: totalFailed,
        errors,
    })
}
