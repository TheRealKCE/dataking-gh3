import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { syncShopOrderStatus } from '@/lib/shop-service'
import { mapBundlePortalStatus } from '@/lib/bundleportal-service'
import crypto from 'crypto'

// BundlePortal completion webhook.
// Registered once with { action: "set_webhook", webhook_url:
// "https://arhmsgh.com/api/webhooks/bundleportal" } — apex, never www. The
// webhook_secret it returns is shown ONCE; store it as BUNDLEPORTAL_WEBHOOK_SECRET.
//
// Docs: header `X-BundlePortal-Signature: sha256=<hex>`, an HMAC-SHA256 of the RAW
// body keyed with that secret. Body:
//   { event: "order.completed" | "order.failed" | "order.cancelled" | "order.refunded",
//     order_id, reference, status, network, bundle, recipient, amount,
//     failure_reason, settled_at }
// `order_id` is the id WE sent — orders.id, or shop_orders.id on the storefront
// path — and `reference` is theirs, stamped on orders.bundleportal_reference.
//
// Deliveries have a 5s timeout and are NEVER retried, so a non-2xx buys nothing.
// app/api/cron/sync-bundleportal-status is the safety net for anything missed.
// Deliberately NOT gated on CRON_JOBS_ENABLED.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
    if (!header) return false
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const a = Buffer.from(expected)
    const b = Buffer.from(header.trim())
    // Length check first: timingSafeEqual throws on mismatched lengths.
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * Find our order for this event. Three keys, most specific first:
 *   1. orders.bundleportal_reference = their reference
 *   2. orders.id = the order_id we sent (dispatcher / refulfill / API paths)
 *   3. orders.shop_order_id = the order_id we sent (storefront path)
 * Each lookup refuses an ambiguous hit rather than guessing.
 */
async function findOrder(supabase: any, reference: string | null, orderId: string | null) {
    const select = 'id, status, shop_order_id'

    if (reference) {
        const { data, error } = await supabase.from('orders').select(select).eq('bundleportal_reference', reference).limit(2)
        if (error) throw new Error(`reference lookup failed: ${error.message}`)
        if (data?.length === 1) return data[0]
        if (data?.length > 1) {
            console.error(`[BundlePortalWebhook] ${data.length} orders share reference ${reference} — refusing to guess`)
            return null
        }
    }

    // Both remaining lookups compare against uuid columns; a non-uuid value would
    // make Postgres reject the query outright.
    if (!orderId || !UUID_RE.test(orderId)) return null

    for (const column of ['id', 'shop_order_id']) {
        const { data, error } = await supabase.from('orders').select(select).eq(column, orderId).limit(2)
        if (error) throw new Error(`${column} lookup failed: ${error.message}`)
        if (data?.length === 1) return data[0]
        if (data?.length > 1) {
            console.error(`[BundlePortalWebhook] ${data.length} orders match ${column}=${orderId} — refusing to guess`)
            return null
        }
    }
    return null
}

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.BUNDLEPORTAL_WEBHOOK_SECRET
        if (!secret) {
            console.error('[BundlePortalWebhook] No BUNDLEPORTAL_WEBHOOK_SECRET configured')
            // 503, not 401 — this is our misconfiguration, not a forged request.
            return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 })
        }

        // Read the RAW body first — signature is computed over the exact bytes.
        const rawBody = await request.text()
        const signature = request.headers.get('x-bundleportal-signature')

        if (!verifySignature(rawBody, signature, secret)) {
            console.error('[BundlePortalWebhook] Invalid webhook signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        let payload: any
        try {
            payload = JSON.parse(rawBody)
        } catch (e) {
            console.error('[BundlePortalWebhook] Failed to parse payload')
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        // The documented shape has never been seen live yet. Log the keys (no
        // values — they include the recipient's number) so the first real delivery
        // settles what the docs don't.
        console.log(`[BundlePortalWebhook] event=${payload?.event} status=${payload?.status} keys=[${Object.keys(payload || {}).join(',')}]`)

        const rawStatus = payload?.status ?? String(payload?.event || '').replace(/^order\./, '')
        const orderId = payload?.order_id === undefined || payload?.order_id === null ? null : String(payload.order_id)
        const reference = payload?.reference === undefined || payload?.reference === null ? null : String(payload.reference)

        if (!rawStatus || (!orderId && !reference)) {
            console.warn('[BundlePortalWebhook] Payload carried no status or no order id/reference')
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        const newStatus = mapBundlePortalStatus(String(rawStatus))
        const isTerminal = newStatus === 'completed' || newStatus === 'failed'

        const supabase = createServerClient()
        const order = await findOrder(supabase, reference, orderId)

        if (!order) {
            console.warn(`[BundlePortalWebhook] No order found for order_id ${orderId} / reference ${reference}`)
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        // Only advance orders currently in processing (idempotent — skip already-terminal).
        if (order.status !== 'processing') {
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        // Raw supplier label, for display only (see lib/order-status-display).
        // Written in its OWN statement and its error deliberately ignored: losing a
        // cosmetic label is acceptable; losing completions is not.
        const supplierLabel = String(rawStatus).trim().toLowerCase() || null
        await (supabase.from('orders') as any)
            .update({ supplier_status: isTerminal ? null : supplierLabel })
            .eq('id', order.id)

        if (order.shop_order_id) {
            await (supabase.from('shop_orders') as any)
                .update({ supplier_status: isTerminal ? null : supplierLabel })
                .eq('id', order.shop_order_id)
        }

        if (!isTerminal) {
            console.log(`[BundlePortalWebhook] order ${order.id}: supplier says "${rawStatus}" → ${newStatus} (no change)`)
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        const { error: updErr } = await (supabase.from('orders') as any)
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', order.id)
            // Row-level idempotency: two overlapping deliveries (or the webhook and
            // the reconciler) cannot both count this order.
            .eq('status', 'processing')

        if (updErr) {
            console.error(`[BundlePortalWebhook] orders update failed for ${order.id}: ${updErr.message}`)
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        if (order.shop_order_id) {
            await (supabase.from('shop_orders') as any)
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', order.shop_order_id)
                .eq('status', 'processing')
        }

        await syncShopOrderStatus(order.id, newStatus).catch(err =>
            console.error(`[BundlePortalWebhook] syncShopOrderStatus failed for ${order.id}:`, err)
        )

        const reason = newStatus === 'failed' && payload?.failure_reason ? ` — ${String(payload.failure_reason).slice(0, 200)}` : ''
        console.log(`[BundlePortalWebhook] order ${order.id}: processing → ${newStatus}${newStatus === 'failed' ? ' (manual refund required)' : ''}${reason}`)

        return NextResponse.json({ success: true, updated: 1 }, { status: 200 })

    } catch (error: any) {
        console.error('[BundlePortalWebhook] Unhandled exception:', error)
        // They never retry, so the status code changes nothing for them; the
        // reconciliation cron will pick this order up.
        return NextResponse.json({ success: true }, { status: 200 })
    }
}
