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

    // ── Backlog, oldest first ─────────────────────────────────────────────────
    const [{ data: mainRows, error: mainErr }, { data: shopRows, error: shopErr }] = await Promise.all([
        supabase.from('orders')
            .select('id, shop_order_id, kuntanii_reference, created_at')
            .eq('fulfillment_method', 'kuntanii').eq('status', 'processing')
            .order('created_at', { ascending: true }).limit(BATCH),
        supabase.from('shop_orders')
            .select('id, kuntanii_reference, created_at')
            .eq('fulfilled_by', 'kuntanii').eq('status', 'processing')
            .order('created_at', { ascending: true }).limit(BATCH),
    ])
    if (mainErr) errors.push(`orders query failed: ${mainErr.message}`)
    if (shopErr) errors.push(`shop_orders query failed: ${shopErr.message}`)

    // One entry per real order: a storefront order is a shop_orders row AND an orders row.
    type Item = { orderId: string | null; shopOrderId: string | null; keys: string[]; createdAt: string }
    const items = new Map<string, Item>()
    for (const o of mainRows || []) {
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
                else notFound++
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

    if (notFound > 0) {
        errors.unshift(`${notFound} Kuntanii order(s) are unknown at Kuntanii — check them on the Kuntanii dashboard`)
    }

    return { success: true, checked, updated, failed, notFound, supplierLabels: labels, errors }
}
