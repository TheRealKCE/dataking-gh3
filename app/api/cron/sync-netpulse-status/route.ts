import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkOrderStatus } from '@/lib/netpulse-service'
import { areCronJobsEnabled, cronDisabledResponse } from '@/lib/cron-control'

// NetPulse has no webhook — polling GET /api/v1/order-status/{reference} is the
// ONLY way an order reaches a terminal state. Mirrors sync-eazydata-status.
//
// Rules:
//   NetPulse → completed  : update order to completed
//   NetPulse → failed     : update order to failed (admin does manual refund)
//   NetPulse → processing : do nothing
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
            .select('id, netpulse_reference, status')
            .eq('fulfilled_by', 'netpulse')
            .eq('status', 'processing')      // only orders currently in processing
            .not('netpulse_reference', 'is', null)
            .limit(50)

        if (shopError) {
            errors.push(`shop_orders query failed: ${shopError.message}`)
        } else {
            for (const order of shopOrders || []) {
                // Extra safety: skip if somehow already completed or pending
                if (order.status === 'completed' || order.status === 'pending') continue

                totalChecked++
                try {
                    const statusResult = await checkOrderStatus(order.netpulse_reference)
                    if (!statusResult.success) continue

                    const newStatus = statusResult.status

                    if (newStatus === 'completed') {
                        const { error: updateError } = await (supabase
                            .from('shop_orders') as any)
                            .update({ status: 'completed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`shop_orders update failed for ${order.id}: ${updateError.message}`)
                            totalFailed++
                        } else {
                            console.log(`[NetPulseCron] shop_orders ${order.id}: processing → completed`)
                            totalUpdated++
                        }
                    } else if (newStatus === 'failed') {
                        // NetPulse failed — mark failed, admin handles manual refund
                        const { error: updateError } = await (supabase
                            .from('shop_orders') as any)
                            .update({ status: 'failed', updated_at: new Date().toISOString() })
                            .eq('id', order.id)
                        if (updateError) {
                            errors.push(`shop_orders update failed for ${order.id}: ${updateError.message}`)
                            totalFailed++
                        } else {
                            console.log(`[NetPulseCron] shop_orders ${order.id}: processing → failed (manual refund required)`)
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
            .select('id, netpulse_reference, status')
            .eq('fulfillment_method', 'netpulse')
            .eq('status', 'processing')
            .not('netpulse_reference', 'is', null)
            .limit(50)

        if (mainError) {
            errors.push(`orders query failed: ${mainError.message}`)
        } else {
            for (const order of mainOrders || []) {
                if (order.status === 'completed' || order.status === 'pending') continue

                totalChecked++
                try {
                    const statusResult = await checkOrderStatus(order.netpulse_reference)
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
                            console.log(`[NetPulseCron] orders ${order.id}: processing → completed`)
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
                            console.log(`[NetPulseCron] orders ${order.id}: processing → failed (manual refund required)`)
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
