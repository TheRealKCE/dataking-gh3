import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { syncShopOrderStatus } from '@/lib/shop-service'
import { fetchOrderItems, mapItemsToOutcomes } from '@/lib/agentportal-service'
import crypto from 'crypto'

// Agent Portal GH completion webhook.
// Docs: POST <our-url> with header `X-Webhook-Signature: sha256=<hex>` where the
// signature is an HMAC-SHA256 of the RAW request body keyed with our webhook secret.
// Payload (event: "order.completed") carries an `items[]` array echoing the same rows
// as the items feed — the row carrying the `reference` we sent at /api/queue/add is the
// 'uploaded' row, and the delivery outcome lives on a separate row sharing its
// `batch_id`. mapItemsToOutcomes() does that join (see lib/agentportal-service.ts) and
// also handles the single-row form where the reference row is itself terminal.

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
    if (!header) return false
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const a = Buffer.from(expected)
    const b = Buffer.from(header)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.AGENTPORTAL_WEBHOOK_SECRET
        if (!secret) {
            console.error('[AgentPortalWebhook] AGENTPORTAL_WEBHOOK_SECRET is not configured')
            return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 })
        }

        // Read the RAW body first — signature is computed over the exact bytes.
        const rawBody = await request.text()
        const signature = request.headers.get('x-webhook-signature')

        if (!verifySignature(rawBody, signature, secret)) {
            console.error('[AgentPortalWebhook] Invalid webhook signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        let payload: any
        try {
            payload = JSON.parse(rawBody)
        } catch (e) {
            console.error('[AgentPortalWebhook] Failed to parse payload')
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        if (payload?.event !== 'order.completed') {
            console.log(`[AgentPortalWebhook] Ignored event '${payload?.event}'`)
            return NextResponse.json({ success: true }, { status: 200 })
        }

        let items: any[] = Array.isArray(payload?.items) ? payload.items : []
        // Re-read the group whenever the payload was truncated (>500 items) OR when the
        // rows we were sent carry no terminal outcome — a payload of nothing but
        // 'uploaded' rows tells us which orders were in the batch but not how they went.
        const needsFullList = payload?.items_truncated
            || (items.length > 0 && mapItemsToOutcomes(items).size === 0)
        if (needsFullList && payload?.order_id) {
            const full = await fetchOrderItems(payload.order_id)
            if (full.length > 0) items = full
        }

        if (items.length === 0) {
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        const supabase = createServerClient()
        let updated = 0

        // One webhook covers a whole batch, which can hold many of our orders — resolve
        // each reference to its OWN outcome rather than the batch's.
        const outcomes = mapItemsToOutcomes(items)

        for (const [reference, newStatus] of outcomes) {
            // Match back by the reference we submitted. Direct orders send orders.id;
            // storefront orders send the shop_order id — both are stamped on
            // orders.agentportal_reference, so that column matches either.
            const { data: order } = await (supabase
                .from('orders') as any)
                .select('id, status, shop_order_id, fulfillment_method')
                .eq('agentportal_reference', reference)
                .maybeSingle()

            if (!order) {
                console.warn(`[AgentPortalWebhook] No order found for reference ${reference}`)
                continue
            }

            // Only advance orders currently in processing (idempotent — skip already-terminal).
            if (order.status !== 'processing') {
                continue
            }

            const { error: updErr } = await (supabase.from('orders') as any)
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', order.id)
                .eq('status', 'processing')

            if (updErr) {
                console.error(`[AgentPortalWebhook] orders update failed for ${order.id}: ${updErr.message}`)
                continue
            }

            if (order.shop_order_id) {
                await (supabase.from('shop_orders') as any)
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', order.shop_order_id)
                    .eq('status', 'processing')
            }

            await syncShopOrderStatus(order.id, newStatus).catch(err =>
                console.error(`[AgentPortalWebhook] syncShopOrderStatus failed for ${order.id}:`, err)
            )

            console.log(`[AgentPortalWebhook] order ${order.id}: processing → ${newStatus}${newStatus === 'failed' ? ' (manual refund required)' : ''}`)
            updated++
        }

        return NextResponse.json({ success: true, updated }, { status: 200 })

    } catch (error: any) {
        console.error('[AgentPortalWebhook] Unhandled exception:', error)
        // Return 2xx so the supplier doesn't hammer retries on our internal error;
        // the fallback cron will reconcile anything we missed.
        return NextResponse.json({ success: true }, { status: 200 })
    }
}
