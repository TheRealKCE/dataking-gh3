import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchRecentItemStatuses, AGENTPORTAL_SCAN_DAYS } from '@/lib/agentportal-service'
import { syncShopOrderStatus } from '@/lib/shop-service'
import { areCronJobsEnabled, cronDisabledResponse } from '@/lib/cron-control'

// Fallback reconciliation for Agent Portal orders (driven by cron-job.org, every 5 min).
// Primary status delivery is the signed webhook (app/api/webhooks/agentportal).
// This cron catches any order a missed/failed webhook left stuck in 'processing'.
//   AgentPortal → completed  : update order to completed
//   AgentPortal → failed     : update order to failed (admin does manual refund)
//   AgentPortal → processing : do nothing
//
// Efficiency: we collect the processing orders FIRST, then fetch the supplier's item
// statuses ONCE for exactly those references (fetchRecentItemStatuses) and look each
// order up in the returned map — so the number of Agent Portal API calls is bounded per
// run regardless of order volume, and a run with nothing outstanding makes none at all.
// `reference` is the Arhms order id we sent at fulfillment time (agentportal_reference);
// storefront orders send the shop_order id, which is stamped on both tables.

// The batch fetch walks every supplier order group for the scanned dates, so this run
// can span many supplier calls. Give it room rather than being killed mid-scan.
export const maxDuration = 60

export async function GET(request: NextRequest) {
    if (!areCronJobsEnabled()) return cronDisabledResponse()

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Only consider orders the scan can actually see. Agent Portal is queried by
    // calendar date, so an order older than the scan window can never be resolved here —
    // and with an oldest-first query those unresolvable rows would otherwise sit at the
    // head of the page forever and starve the ones we could have resolved. Anything that
    // ages out of this window needs the admin's manual review, not another cron pass.
    const scanStart = new Date()
    scanStart.setUTCDate(scanStart.getUTCDate() - (AGENTPORTAL_SCAN_DAYS - 1))
    scanStart.setUTCHours(0, 0, 0, 0)
    const scanCutoff = scanStart.toISOString()

    let totalChecked = 0
    let totalUpdated = 0
    let totalFailed = 0
    const errors: string[] = []

    // Oldest first on both queries: without an explicit order Postgres returns an
    // arbitrary (but stable) page, so anything past the limit is NEVER checked and the
    // backlog starves itself. Oldest-first guarantees stuck orders drain.
    const [shopResult, mainResult] = await Promise.all([
        (supabase.from('shop_orders') as any)
            .select('id, agentportal_reference, status, created_at')
            .eq('fulfilled_by', 'agentportal')
            .eq('status', 'processing')
            .not('agentportal_reference', 'is', null)
            .gte('created_at', scanCutoff)
            .order('created_at', { ascending: true })
            .limit(200),
        (supabase.from('orders') as any)
            .select('id, agentportal_reference, status, shop_order_id, created_at')
            .eq('fulfillment_method', 'agentportal')
            .eq('status', 'processing')
            .not('agentportal_reference', 'is', null)
            .gte('created_at', scanCutoff)
            .order('created_at', { ascending: true })
            .limit(200),
    ])

    const { data: shopOrders, error: shopError } = shopResult
    const { data: mainOrders, error: mainError } = mainResult
    if (shopError) errors.push(`shop_orders query failed: ${shopError.message}`)
    if (mainError) errors.push(`orders query failed: ${mainError.message}`)

    // Nothing outstanding — don't touch the supplier at all.
    const pending = [...(shopOrders || []), ...(mainOrders || [])]
    if (pending.length === 0) {
        return NextResponse.json({ success: true, checked: 0, updated: 0, failed: 0, errors })
    }

    // Telling the scan exactly which references we're waiting on (and how far back they
    // go) lets it stop as soon as they're all resolved instead of walking every group of
    // the last 3 days — the routine run then costs a couple of supplier calls.
    const wantedRefs = new Set(pending.map(o => String(o.agentportal_reference)))
    const since = new Date(Math.min(...pending.map(o => new Date(o.created_at).getTime())))

    // ── Fetch all recent Agent Portal item statuses ONCE ──────────────────────
    const { success: fetchOk, statuses, error: fetchErr, scannedGroups, partial } =
        await fetchRecentItemStatuses({
            wantedRefs,
            since,
            // Leave room inside maxDuration for the DB writes that follow.
            budgetMs: 45_000,
        })
    if (!fetchOk) {
        // Couldn't reach the supplier — bail rather than treat an empty map as "all pending".
        return NextResponse.json({
            success: false,
            checked: 0,
            updated: 0,
            failed: 0,
            errors: [...errors, fetchErr || 'Could not fetch Agent Portal statuses'],
        })
    }

    // ── Part A: shop_orders ───────────────────────────────────────────────────
    try {
        for (const order of shopOrders || []) {
            const newStatus = statuses.get(String(order.agentportal_reference))
            if (newStatus !== 'completed' && newStatus !== 'failed') continue // not terminal yet
            totalChecked++

            const { error: updateError } = await (supabase
                .from('shop_orders') as any)
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', order.id)
                .eq('status', 'processing') // idempotent — never re-flip a settled order
            if (updateError) {
                errors.push(`shop_orders update failed for ${order.id}: ${updateError.message}`)
                totalFailed++
            } else {
                console.log(`[AgentPortalCron] shop_orders ${order.id}: processing → ${newStatus}${newStatus === 'failed' ? ' (manual refund required)' : ''}`)
                totalUpdated++
            }
        }
    } catch (partAErr: any) {
        errors.push(`Part A failed: ${partAErr.message}`)
    }

    // ── Part B: orders ────────────────────────────────────────────────────────
    try {
        for (const order of mainOrders || []) {
            const newStatus = statuses.get(String(order.agentportal_reference))
            if (newStatus !== 'completed' && newStatus !== 'failed') continue // not terminal yet
            totalChecked++

            const { error: updateError } = await (supabase
                .from('orders') as any)
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', order.id)
                .eq('status', 'processing')
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
    } catch (partBErr: any) {
        errors.push(`Part B failed: ${partBErr.message}`)
    }

    return NextResponse.json({
        success: true,
        pending: pending.length,
        scannedGroups,
        // true when the scan ran out of time before covering every group — the next run
        // picks up where this one left off.
        partial: partial === true,
        checked: totalChecked,
        updated: totalUpdated,
        failed: totalFailed,
        errors,
    })
}

// Cron schedulers vary in which HTTP method they send (GET/POST/PUT/…), and the
// method actually sent doesn't always match the UI. Accept them all — the handler
// is auth-gated by the Bearer CRON_SECRET regardless of method, so this is safe.
export const POST = GET
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
