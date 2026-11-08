import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { applyKuntaniiStatus } from '@/lib/kuntanii-reconcile'
import { overallStatus, uuidFromExternalId } from '@/lib/kuntanii-service'
import { verifyKuntaniiSignature, describeHeader } from '@/lib/kuntanii-signature'

// Kuntanii status webhook.
// The callback URL is set on the API key in Kuntanii's API management screen:
//   https://arhmsgh.com/api/webhooks/kuntanii   — apex, never www.
// The signing secret (kt_whsec_…) is shown ONCE when the key is created; store it
// as KUNTANII_WEBHOOK_SECRET.
//
// Body: { event: "order.processing" | …, createdAt, data: { externalOrderId,
//   intakeStatus, orders: [{ orderReference, status, queuePosition, notReceivedStatus }] } }
// `externalOrderId` is the key WE sent (orders.id / shop_orders.id, maybe "-rN"),
// which is also what is stored in kuntanii_reference.
//
// Signature: header X-Kuntanii-Signature, HMAC-SHA256 of the raw body. Kuntanii's
// docs don't show the exact encoding, so `sha256=<hex>`, bare hex, base64 and the
// Stripe-style `t=…,v1=…` (over "<t>.<body>") are all accepted. The first real
// delivery's header SHAPE (never its value) is logged to settle it.
//
// app/api/cron/sync-kuntanii-status is the safety net for anything missed.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findOrder(supabase: any, externalOrderId: string | null) {
    const select = 'id, status, shop_order_id'

    if (externalOrderId) {
        const { data, error } = await supabase.from('orders').select(select).eq('kuntanii_reference', externalOrderId).limit(2)
        if (error) throw new Error(`reference lookup failed: ${error.message}`)
        if (data?.length === 1) return data[0]
        if (data?.length > 1) {
            console.error(`[KuntaniiWebhook] ${data.length} orders share reference ${externalOrderId} — refusing to guess`)
            return null
        }
    }

    // The reference stamp may not have landed (function died after the call). Fall
    // back to the uuid inside the key: orders.id, then orders.shop_order_id.
    const uuid = uuidFromExternalId(externalOrderId)
    if (!uuid || !UUID_RE.test(uuid)) return null

    for (const column of ['id', 'shop_order_id']) {
        const { data, error } = await supabase.from('orders').select(select).eq(column, uuid).limit(2)
        if (error) throw new Error(`${column} lookup failed: ${error.message}`)
        if (data?.length === 1) return data[0]
        if (data?.length > 1) {
            console.error(`[KuntaniiWebhook] ${data.length} orders match ${column}=${uuid} — refusing to guess`)
            return null
        }
    }
    return null
}

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.KUNTANII_WEBHOOK_SECRET
        if (!secret) {
            console.error('[KuntaniiWebhook] No KUNTANII_WEBHOOK_SECRET configured')
            return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 })
        }

        const rawBody = await request.text()
        const signature = request.headers.get('x-kuntanii-signature')

        if (!verifyKuntaniiSignature(rawBody, signature, secret)) {
            console.error(`[KuntaniiWebhook] Invalid signature (header: ${describeHeader(signature)})`)
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        let payload: any
        try {
            payload = JSON.parse(rawBody)
        } catch {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        const event = String(payload?.event || request.headers.get('x-kuntanii-event') || '')
        const data = payload?.data ?? {}
        const externalOrderId = data?.externalOrderId == null ? null : String(data.externalOrderId)
        console.log(`[KuntaniiWebhook] event=${event} ext=${externalOrderId} sig=${describeHeader(signature)} keys=[${Object.keys(data || {}).join(',')}]`)

        // Dispute events reuse the order payload, but a report being reviewed is not
        // a delivery outcome. Logged, never applied.
        if (event.startsWith('order.not_received')) {
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        const overall = overallStatus(data)
        if (!overall || !externalOrderId) {
            console.warn('[KuntaniiWebhook] Payload carried no status or no externalOrderId')
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        const supabase = createServerClient()
        const order = await findOrder(supabase, externalOrderId)
        if (!order) {
            console.warn(`[KuntaniiWebhook] No order found for ${externalOrderId}`)
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }
        if (order.status !== 'processing') {
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        const res = await applyKuntaniiStatus(supabase, { orderId: order.id, shopOrderId: order.shop_order_id || null }, overall)
        if (res.error) {
            console.error(`[KuntaniiWebhook] ${res.error}`)
            // 500 so Kuntanii can retry if it does; the sync cron also catches it.
            return NextResponse.json({ error: 'update failed' }, { status: 500 })
        }
        return NextResponse.json({ success: true, updated: res.updated ? 1 : 0 }, { status: 200 })
    } catch (error: any) {
        console.error('[KuntaniiWebhook] Unhandled exception:', error)
        return NextResponse.json({ error: 'internal error' }, { status: 500 })
    }
}
