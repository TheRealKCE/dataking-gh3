import { createServerClient } from '@/lib/supabase'
import { syncShopOrderStatus } from '@/lib/shop-service'
import { checkOrderStatus } from '@/lib/kuntanii-service'

// Kuntanii reconciliation — the safety net behind app/api/webhooks/kuntanii.
// Shared by app/api/cron/sync-kuntanii-status and the admin "Sync" button
// (app/api/admin/fulfillment/sync-kuntanii).
//
// Unlike BundlePortal, Kuntanii has a per-order status endpoint keyed by the
// externalOrderId we sent, which is stored in kuntanii_reference. Orders whose
// stamp never landed are looked up by the id they were placed under instead
// (shop_orders.id for storefront orders, orders.id otherwise).
//
// Rules (Kuntanii label → ours, see mapKuntaniiStatus):
//   processed            → completed
//   cancelled            → failed (admin refunds by hand, same as every supplier)
//   pending / processing → no change, re-check next run
// Every write is guarded by .eq('status','processing'), so a run racing the
// webhook (or another run) is a no-op.

type Mapped = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * Apply one Kuntanii status to an order (orders row and/or its shop_orders row).
 * Returns true when a terminal status was written. Used by the webhook too.
 */
export async function applyKuntaniiStatus(
    supabase: any,
    target: { orderId: string | null; shopOrderId: string | null },
    overall: { status: Mapped; raw: string }
): Promise<{ updated: boolean; error?: string }> {
    const isTerminal = overall.status === 'completed' || overall.status === 'failed'
    const label = isTerminal ? null : (overall.raw.trim().toLowerCase() || null)

    // Raw label for display only — its own statement, errors ignored.
    if (target.orderId) await supabase.from('orders').update({ supplier_status: label }).eq('id', target.orderId).eq('status', 'processing')
    if (target.shopOrderId) await supabase.from('shop_orders').update({ supplier_status: label }).eq('id', target.shopOrderId).eq('status', 'processing')

    if (!isTerminal) return { updated: false }

    const now = new Date().toISOString()
    let updated = false

    if (target.orderId) {
        const { data, error } = await supabase.from('orders')
            .update({ status: overall.status, updated_at: now })
            .eq('id', target.orderId)
            .eq('status', 'processing')
            .select('id')
        if (error) return { updated: false, error: `orders update failed for ${target.orderId}: ${error.message}` }
        updated = (data?.length ?? 0) > 0
    }

    if (target.shopOrderId) {
        const { data, error } = await supabase.from('shop_orders')
            .update({ status: overall.status, updated_at: now })
            .eq('id', target.shopOrderId)
            .eq('status', 'processing')
            .select('id')
        if (error) return { updated, error: `shop_orders update failed for ${target.shopOrderId}: ${error.message}` }
        updated = updated || (data?.length ?? 0) > 0
    }

    if (updated && target.orderId) {
        await syncShopOrderStatus(target.orderId, overall.status).catch(err =>
            console.error(`[Kuntanii] syncShopOrderStatus failed for ${target.orderId}:`, err))
    }
    if (updated) {
        console.log(`[Kuntanii] order ${target.orderId || target.shopOrderId}: processing → ${overall.status}${overall.status === 'failed' ? ' (manual refund required)' : ''}`)
    }
    return { updated }
}

export interface KuntaniiReconcileResult {
    success: true
    checked: number
    updated: number
    failed: number
    notFound: number
    /** Our order ids Kuntanii has no record of. Not an error (no push) — shown on the Sync button. */
    unknownOrderIds: string[]
    supplierLabels: Record<string, number>
    errors: string[]
}

const BATCH = 40
const CONCURRENCY = 5

export async function reconcileKuntaniiOrders(opts: { runBudgetMs?: number } = {}): Promise<KuntaniiReconcileResult> {
    const startedAt = Date.now()
    const runBudgetMs = opts.runBudgetMs ?? 50_000
    const supabase = createServerClient() as any
    const errors: string[] = []
    const labels: Record<string, number> = {}
    let checked = 0, updated = 0, failed = 0, notFound = 0
    const unknownOrderIds: string[] = []

    // ── Backlog, oldest first ─────────────────────────────────────────────────
    // If migration 20261108000000 hasn't run, kuntanii_reference doesn't exist and
    // selecting it fails the whole query. Fall back to the columns that always exist;
    // the order id is still a valid lookup key (it is the externalOrderId we sent).
    const selectWithFallback = async (table: 'orders' | 'shop_orders', cols: string, base: string, filter: (q: any) => any) => {
        let res = await filter(supabase.from(table).select(cols)).order('created_at', { ascending: true }).limit(BATCH)
        if (res.error && /kuntanii_reference/i.test(res.error.message || '')) {
            res = await filter(supabase.from(table).select(base)).order('created_at', { ascending: true }).limit(BATCH)
        }
        return res
    }
    const [{ data: mainRows, error: mainErr }, { data: shopRows, error: shopErr }, { data: attemptRows }] = await Promise.all([
        selectWithFallback('orders', 'id, shop_order_id, kuntanii_reference, created_at', 'id, shop_order_id, created_at',
            q => q.eq('fulfillment_method', 'kuntanii').eq('status', 'processing')),
        selectWithFallback('shop_orders', 'id, kuntanii_reference, created_at', 'id, created_at',
            q => q.eq('fulfilled_by', 'kuntanii').eq('status', 'processing')),
        // Orders Kuntanii accepted whose fulfillment_method stamp was shed (e.g. the
        // CHECK constraint didn't allow 'kuntanii' yet). supplier_attempts survives
        // that, so it is the only trace. Recent orders only; errors (column missing)
        // are ignored — this is a best-effort extra pass.
        supabase.from('orders')
            .select('id, shop_order_id, created_at, supplier_attempts')
            .eq('status', 'processing')
            .gte('created_at', new Date(Date.now() - 3 * 24 * 3600_000).toISOString())
            .contains('supplier_attempts', [{ supplier: 'kuntanii' }])
            .order('created_at', { ascending: true }).limit(BATCH),
    ])
    if (mainErr) errors.push(`orders query failed: ${mainErr.message}`)
    if (shopErr) errors.push(`shop_orders query failed: ${shopErr.message}`)

    // Keep only orders whose LAST supplier call was a Kuntanii acceptance — if a
    // later supplier took over, that supplier owns the order.
    const unstampedRows = (attemptRows || []).filter((o: any) => {
        const attempts: any[] = Array.isArray(o.supplier_attempts) ? o.supplier_attempts : []
        const last = attempts[attempts.length - 1]
        return last?.supplier === 'kuntanii' && (last.outcome === 'success' || last.outcome === 'already_submitted')
    })

    // One entry per real order: a storefront order is a shop_orders row AND an orders row.
    type Item = { orderId: string | null; shopOrderId: string | null; keys: string[]; createdAt: string }
    const items = new Map<string, Item>()
    for (const o of [...(mainRows || []), ...unstampedRows]) {
        const key = String(o.shop_order_id || o.id)
        items.set(key, {
            orderId: o.id, shopOrderId: o.shop_order_id || null, createdAt: o.created_at,
            keys: [o.kuntanii_reference, o.shop_order_id, o.id].filter(Boolean).map(String),
        })
    }
    for (const s of shopRows || []) {
        const existing = items.get(String(s.id))
        if (existing) {
            if (s.kuntanii_reference && !existing.keys.includes(s.kuntanii_reference)) existing.keys.unshift(String(s.kuntanii_reference))
            continue
        }
        items.set(String(s.id), {
            orderId: null, shopOrderId: s.id, createdAt: s.created_at,
            keys: [s.kuntanii_reference, s.id].filter(Boolean).map(String),
        })
    }
    // A storefront row found only via shop_orders still has an orders twin; look it up.
    const orphanShopIds = [...items.values()].filter(i => !i.orderId && i.shopOrderId).map(i => i.shopOrderId!)
    if (orphanShopIds.length > 0) {
        const { data } = await supabase.from('orders').select('id, shop_order_id').in('shop_order_id', orphanShopIds)
        for (const row of data || []) {
            const item = items.get(String(row.shop_order_id))
            if (item && !item.orderId) item.orderId = row.id
        }
    }

    const queue = [...items.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

    const worker = async () => {
        while (queue.length > 0) {
            if (Date.now() - startedAt > runBudgetMs) {
                errors.push(`run budget exhausted — ${queue.length} order(s) deferred to next run`)
                queue.length = 0
                return
            }
            const item = queue.shift()!
            let hit: Awaited<ReturnType<typeof checkOrderStatus>> | null = null
            let lastErr: string | undefined
            for (const key of [...new Set(item.keys)]) {
                const st = await checkOrderStatus(key)
                if (st.success) { hit = st; break }
                if (!st.notFound) { lastErr = st.message; break } // a real error — don't try other keys blind
            }
            if (!hit) {
                if (lastErr) errors.push(`status check failed for ${item.orderId || item.shopOrderId}: ${lastErr}`)
                else { notFound++; unknownOrderIds.push(String(item.orderId || item.shopOrderId)) }
                continue
            }
            checked++
            const res = await applyKuntaniiStatus(supabase, item, { status: hit.status, raw: hit.message || '' })
            if (res.error) { errors.push(res.error); failed++ }
            else if (res.updated) updated++
            else {
                const l = (hit.message || '(empty)').trim().toLowerCase()
                labels[l] = (labels[l] || 0) + 1
            }
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    // Unknown-at-Kuntanii orders are NOT pushed to errors: the cron pushes every
    // error to admins' phones every 10 minutes, and these don't change run to run.
    return { success: true, checked, updated, failed, notFound, unknownOrderIds, supplierLabels: labels, errors }
}
