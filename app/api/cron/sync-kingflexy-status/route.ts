import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkOrderStatus } from '@/lib/kingflexy-service'
import { areCronJobsEnabled, cronDisabledResponse } from '@/lib/cron-control'

// Rules:
//   KingFlexy → completed  : update order to completed
//   KingFlexy → failed/refund : update order to failed (admin does manual refund)
//   KingFlexy → processing : do nothing
//   Order already completed or pending : skip (only process orders in processing state)

// This cron polls the supplier once PER ORDER, serially. Without a duration cap the
// platform kills the function mid-loop and every order after that point is silently
// skipped — so give it room, then stop ourselves just short of the kill with a clean
// response. Combined with oldest-first ordering, the next run resumes where we left off.
export const maxDuration = 60
const RUN_BUDGET_MS = 50_000

export async function GET(request: NextRequest) {
    if (!areCronJobsEnabled()) return cronDisabledResponse()

    const startedAt = Date.now()
    const outOfTime = () => Date.now() - startedAt > RUN_BUDGET_MS

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
            // Oldest first: without an explicit order Postgres returns an arbitrary
            // (but stable) page, so anything past the limit is NEVER checked and the
            // backlog starves itself. Oldest-first guarantees stuck orders drain.
            .order('created_at', { ascending: true })
            .limit(50)

        if (shopError) {
            errors.push(`shop_orders query failed: ${shopError.message}`)
        } else {
            for (const order of shopOrders || []) {
                if (outOfTime()) {
                    errors.push('shop_orders: run budget exhausted — remaining orders deferred to next run')
                    break
                }
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
            // Oldest first: without an explicit order Postgres returns an arbitrary
            // (but stable) page, so anything past the limit is NEVER checked and the
            // backlog starves itself. Oldest-first guarantees stuck orders drain.
            .order('created_at', { ascending: true })
            .limit(50)

        if (mainError) {
            errors.push(`orders query failed: ${mainError.message}`)
        } else {
            for (const order of mainOrders || []) {
                if (outOfTime()) {
                    errors.push('orders: run budget exhausted — remaining orders deferred to next run')
                    break
                }
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
