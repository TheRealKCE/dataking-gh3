import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { syncShopOrderStatus } from '@/lib/shop-service'
import { normaliseSupplierStatus } from '@/lib/order-status-display'
import crypto from 'crypto'

// DataKazina status webhook.
//
// This is the ONLY status channel for Dakazina orders. Their status endpoint
// (POST {base}/fetch-single-transaction) returns 404 "route could not be found",
// so unlike every sibling supplier there is NO reconciliation cron behind this —
// an event we drop is a completion nobody ever recovers. That single fact drives
// the two places this route deviates from the others, both marked below.
//
// Auth: their dashboard has a URL box and no header or secret field, so the secret
// has to ride in the query string:
//   https://arhmsgh.com/api/webhooks/dakazina?secret=<DAKAZINA_WEBHOOK_SECRET>
// Apex host, never www — www 307s to the apex and the redirect strips credentials.
// Headers are still accepted first in case they ever add a field for them.
//
// Payload (their dashboard's example):
//   { id, type, status, previous_status, order_code, reference,
//     amount, user_id, occurred_at, test, metadata }
// Note there is no incoming_api_ref — the ref WE send at fulfillment is not echoed
// back — so matching goes through order_code/reference. See fulfillment-service.

function timingSafeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    // Length check first: timingSafeEqual throws on mismatched lengths.
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

function isAuthorized(request: NextRequest, secret: string): boolean {
    const bearer = request.headers.get('authorization')
    if (bearer?.startsWith('Bearer ') && timingSafeEquals(bearer.slice(7), secret)) return true

    const headerSecret = request.headers.get('x-dakazina-webhook-secret')
    if (headerSecret && timingSafeEquals(headerSecret, secret)) return true

    const querySecret = request.nextUrl.searchParams.get('secret')
    if (querySecret && timingSafeEquals(querySecret, secret)) return true

    return false
}

function mapDakazinaStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    const s = normaliseSupplierStatus(status)
    const COMPLETED = ['completed', 'complete', 'delivered', 'success', 'successful', 'credited', 'fulfilled']
    const FAILED = ['failed', 'failure', 'cancelled', 'canceled', 'refund', 'refunded', 'rejected', 'reversed', 'declined']
    const IN_FLIGHT = ['processing', 'pending', 'queued', 'in progress', 'verifying', 'on hold', 'onhold', 'awaiting verification', 'pending verification', 'under review']
    if (COMPLETED.includes(s)) return 'completed'
    if (FAILED.includes(s)) return 'failed'
    if (IN_FLIGHT.includes(s)) return 'processing'
    return 'pending'
}

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.DAKAZINA_WEBHOOK_SECRET
        if (!secret) {
            console.error('[DakazinaWebhook] DAKAZINA_WEBHOOK_SECRET is not configured')
            // 503, not 401 — our misconfiguration, not a forged request.
            return NextResponse.json({ success: false, error: 'Webhook unavailable' }, { status: 503 })
        }

        if (!isAuthorized(request, secret)) {
            console.error('[DakazinaWebhook] Unauthorized delivery')
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        let payload: any
        try {
            payload = await request.json()
        } catch (err) {
            console.error('[DakazinaWebhook] Failed to parse payload:', err)
            return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
        }

        const { type, status, order_code, reference } = payload || {}

        if (type === 'test_event' || payload?.test === true) {
            console.log('[DakazinaWebhook] Test event received — acknowledged, no order touched')
            return NextResponse.json({ success: true, message: 'Test event received' }, { status: 200 })
        }

        // Their real events have never been observed, so log the shape of the first
        // ones: which identifiers actually arrive is the open question this answers.
        console.log(
            `[DakazinaWebhook] event status='${status}' order_code='${order_code ?? ''}' reference='${reference ?? ''}'`
        )

        const newStatus = mapDakazinaStatus(String(status ?? ''))
        const isTerminal = newStatus === 'completed' || newStatus === 'failed'

        // Both identifiers are tried: we stamp order_code when they return one and fall
        // back to reference, and which of the two they send is not yet confirmed.
        const candidates = [order_code, reference]
            .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
            .map(v => String(v))

        if (candidates.length === 0) {
            console.warn('[DakazinaWebhook] Event carried no order_code or reference — cannot match')
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        const supabase = createServerClient()

        // Direct and storefront orders both stamp the supplier id on
        // orders.dakazina_reference, so this one lookup covers each.
        const { data: matches, error: lookupError } = await (supabase
            .from('orders') as any)
            .select('id, status, shop_order_id')
            .in('dakazina_reference', candidates)
            .limit(2)

        if (lookupError) {
            console.error(`[DakazinaWebhook] Lookup failed for [${candidates.join(', ')}]: ${lookupError.message}`)
            // DEVIATION 1 (no fallback cron): 5xx so they retry. A sibling supplier
            // would return 2xx here and let its cron reconcile; we have no cron.
            return NextResponse.json({ success: false, error: 'Lookup failed' }, { status: 500 })
        }

        if (!matches || matches.length === 0) {
            console.warn(`[DakazinaWebhook] No order matches [${candidates.join(', ')}]`)
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        // Refuse to guess. Two rows sharing a reference means the stamp is not unique,
        // and completing an arbitrary one of them would be worse than completing none.
        if (matches.length > 1) {
            console.error(`[DakazinaWebhook] AMBIGUOUS: [${candidates.join(', ')}] matches multiple orders — refusing`)
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        const order = matches[0]

        // Idempotent: only advance orders still in processing.
        if (order.status !== 'processing') {
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        // Raw supplier label, display only. Its own statement, error ignored on
        // purpose: against a DB without the supplier_status migration PostgREST
        // rejects the whole statement, and a cosmetic label must never take order
        // completion down with it.
        const supplierLabel = normaliseSupplierStatus(String(status ?? '')) || null
        await (supabase.from('orders') as any)
            .update({ supplier_status: isTerminal ? null : supplierLabel })
            .eq('id', order.id)

        if (order.shop_order_id) {
            await (supabase.from('shop_orders') as any)
                .update({ supplier_status: isTerminal ? null : supplierLabel })
                .eq('id', order.shop_order_id)
        }

        // PROCESSING is one of the two triggers ticked in their dashboard, and the
        // order is already 'processing' — the label above is all there is to record.
        if (!isTerminal) {
            console.log(`[DakazinaWebhook] order ${order.id}: supplier says "${status}" → ${newStatus} (no change)`)
            return NextResponse.json({ success: true, updated: 0 }, { status: 200 })
        }

        const { error: updErr } = await (supabase.from('orders') as any)
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', order.id)
            // Second idempotency guard, at row level: two overlapping deliveries
            // cannot both count this order.
            .eq('status', 'processing')

        if (updErr) {
            console.error(`[DakazinaWebhook] orders update failed for ${order.id}: ${updErr.message}`)
            // DEVIATION 1 again — make them retry rather than lose the completion.
            return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
        }

        if (order.shop_order_id) {
            await (supabase.from('shop_orders') as any)
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', order.shop_order_id)
                .eq('status', 'processing')
        }

        await syncShopOrderStatus(order.id, newStatus).catch(err =>
            console.error(`[DakazinaWebhook] syncShopOrderStatus failed for ${order.id}:`, err)
        )

        console.log(`[DakazinaWebhook] order ${order.id}: processing → ${newStatus}${newStatus === 'failed' ? ' (manual refund required)' : ''}`)

        return NextResponse.json({ success: true, updated: 1 }, { status: 200 })

    } catch (error: any) {
        console.error('[DakazinaWebhook] Unhandled exception:', error)
        // DEVIATION 2 (no fallback cron): siblings swallow this as 2xx because their
        // cron will re-check. Nothing re-checks Dakazina, so ask for the retry.
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
    }
}
