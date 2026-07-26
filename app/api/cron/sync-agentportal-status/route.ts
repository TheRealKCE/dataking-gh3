import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchRecentItemStatuses } from '@/lib/agentportal-service'
import { syncShopOrderStatus } from '@/lib/shop-service'
import { areCronJobsEnabled, cronDisabledResponse } from '@/lib/cron-control'

// Fallback reconciliation for Agent Portal orders (driven by cron-job.org, every 5 min).
// Primary status delivery is the signed webhook (app/api/webhooks/agentportal).
// This cron catches any order a missed/failed webhook left stuck in 'processing'.
//   AgentPortal → completed  : update order to completed
//   AgentPortal → failed     : update order to failed (admin does manual refund)
//   AgentPortal → processing : do nothing
//
// Efficiency: we fetch every recent item's status ONCE (fetchRecentItemStatuses) and
// build a reference→status map, then look up each processing order locally — so the
// number of Agent Portal API calls is bounded per run regardless of order volume.
// `reference` is the Arhms order id we sent at fulfillment time (agentportal_reference).

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

    // ── Fetch all recent Agent Portal item statuses ONCE ──────────────────────
    const { success: fetchOk, statuses, error: fetchErr } = await fetchRecentItemStatuses()
    if (!fetchOk) {
        // Couldn't reach the supplier — bail rather than treat an empty map as "all pending".
        return NextResponse.json({
            success: false,
            checked: 0,
            updated: 0,
            failed: 0,
            errors: [fetchErr || 'Could not fetch Agent Portal statuses'],
        })
    }

    // ── Part A: shop_orders ───────────────────────────────────────────────────
    try {
        const { data: shopOrders, error: shopError } = await (supabase
            .from('shop_orders') as any)
            .select('id, agentportal_reference, status')
            .eq('fulfilled_by', 'agentportal')
            .eq('status', 'processing')
            .not('agentportal_reference', 'is', null)
            .limit(200)

        if (shopError) {
            errors.push(`shop_orders query failed: ${shopError.message}`)
        } else {
            for (const order of shopOrders || []) {
                if (order.status === 'completed' || order.status === 'pending') continue

                const newStatus = statuses.get(String(order.agentportal_reference))
                if (newStatus !== 'completed' && newStatus !== 'failed') continue // not terminal yet
                totalChecked++

                const { error: updateError } = await (supabase
                    .from('shop_orders') as any)
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', order.id)
                if (updateError) {
                    errors.push(`shop_orders update failed for ${order.id}: ${updateError.message}`)
                    totalFailed++
                } else {
                    console.log(`[AgentPortalCron] shop_orders ${order.id}: processing → ${newStatus}${newStatus === 'failed' ? ' (manual refund required)' : ''}`)
                    totalUpdated++
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
            .select('id, agentportal_reference, status, shop_order_id')
            .eq('fulfillment_method', 'agentportal')
            .eq('status', 'processing')
            .not('agentportal_reference', 'is', null)
            .limit(200)

        if (mainError) {
            errors.push(`orders query failed: ${mainError.message}`)
        } else {
            for (const order of mainOrders || []) {
                if (order.status === 'completed' || order.status === 'pending') continue

                const newStatus = statuses.get(String(order.agentportal_reference))
                if (newStatus !== 'completed' && newStatus !== 'failed') continue // not terminal yet
                totalChecked++

                const { error: updateError } = await (supabase
                    .from('orders') as any)
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', order.id)
                if (updateError) {
                    errors.push(`orders update failed for ${order.id}: ${updateError.message}`)
                    totalFailed++
                    continue
                }

                console.log(`[AgentPortalCron] orders ${order.id}: processing → ${newStatus}${newStatus === 'failed' ? ' (manual refund required)' : ''}`)
                totalUpdated++

                // Keep the shop view in sync for linked storefront orders (mirrors the webhook).
                if (order.shop_order_id) {
                    await syncShopOrderStatus(order.id, newStatus).catch(err =>
                        console.error(`[AgentPortalCron] syncShopOrderStatus failed for ${order.id}:`, err)
                    )
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

// Some cron schedulers (e.g. cron-job.org) send POST instead of GET. Accept both —
// the handler is auth-gated by the Bearer CRON_SECRET regardless of method.
export const POST = GET
