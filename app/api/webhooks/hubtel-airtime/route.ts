import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { logCallback } from '@/lib/hubtel-payment-log'
import { finalizeAirtimeOrder } from '@/lib/airtime-order-completion'
import { sendPushToAdmins } from '@/lib/web-push'

/**
 * Hubtel Commission Services (airtime) callback.
 *
 * A DEDICATED route rather than a branch inside /api/webhooks/hubtel. That handler
 * is for Receive Money — it looks every reference up in `wallet_payments` and drops
 * anything it cannot find, which is every airtime top-up. The payload shape differs
 * too, so sharing the route would mean two unrelated parsers in one function.
 *
 * The unit here is a LEG, not an order. An order over GHS 100 was split into several
 * top-ups, so this fires once per leg and the order only completes when the last one
 * lands. See lib/airtime-fulfillment-dispatcher.ts.
 *
 * Always answers 200. A non-2xx makes Hubtel redeliver, and there is nothing a
 * redelivery can fix for a reference we do not recognise.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createServerClient() as any
        const body = await request.text()

        let event: any
        try {
            event = JSON.parse(body)
        } catch {
            console.error('[HubtelAirtimeWebhook] Failed to parse JSON body:', body.slice(0, 500))
            return NextResponse.json({ received: true })
        }

        console.log('[HubtelAirtimeWebhook] Received callback:', JSON.stringify(event))

        const clientReference: string | undefined =
            event?.Data?.ClientReference ?? event?.ClientReference
        const responseCode: string = String(event?.ResponseCode ?? '')
        const isSuccess = responseCode === '0000'

        // Logged before anything can return early, so a rejected top-up still leaves
        // a trace in /admin/hubtel-payments — the failure is the interesting case.
        await logCallback({
            clientReference: clientReference || '',
            responseCode,
            message: event?.Message ?? null,
            amount: event?.Data?.Amount != null ? Number(event.Data.Amount) : undefined,
            transactionId: event?.Data?.TransactionId ?? undefined,
            raw: event,
        })

        if (!clientReference) {
            console.error('[HubtelAirtimeWebhook] Callback carried no ClientReference.')
            return NextResponse.json({ received: true })
        }

        // ── Find the leg ─────────────────────────────────────────────────────
        const { data: leg } = await supabase
            .from('airtime_fulfillment_legs')
            .select('*')
            .eq('client_reference', clientReference)
            .maybeSingle()

        if (!leg) {
            console.error('[HubtelAirtimeWebhook] No leg matches reference:', clientReference)
            return NextResponse.json({ received: true })
        }

        // Idempotent: a redelivered callback for a leg already resolved changes nothing.
        if (leg.status === 'success' || leg.status === 'failed') {
            console.log(`[HubtelAirtimeWebhook] Leg ${clientReference} is already '${leg.status}' — ignoring duplicate.`)
            return NextResponse.json({ received: true })
        }

        await supabase
            .from('airtime_fulfillment_legs')
            .update({
                status: isSuccess ? 'success' : 'failed',
                transaction_id: event?.Data?.TransactionId ?? leg.transaction_id,
                commission: event?.Data?.Meta?.Commission != null
                    ? Number(event.Data.Meta.Commission)
                    : leg.commission,
                response_code: responseCode || leg.response_code,
                message: event?.Message ?? leg.message,
                raw: event,
                updated_at: new Date().toISOString(),
            })
            .eq('id', leg.id)

        // ── Re-evaluate the parent order ─────────────────────────────────────
        const { data: order } = await supabase
            .from('airtime_orders')
            .select('*')
            .eq('id', leg.order_id)
            .single()

        if (!order) {
            console.error('[HubtelAirtimeWebhook] Leg has no parent order:', leg.order_id)
            return NextResponse.json({ received: true })
        }

        const { data: allLegs } = await supabase
            .from('airtime_fulfillment_legs')
            .select('leg_index, amount, status')
            .eq('order_id', leg.order_id)
            .order('leg_index', { ascending: true })

        const legs = allLegs || []
        const failed = legs.filter((l: any) => l.status === 'failed')
        const succeeded = legs.filter((l: any) => l.status === 'success')

        if (failed.length > 0) {
            // Partial delivery. The customer has some of their airtime and we cannot
            // take it back, so the order returns to the admin queue with the exact
            // shortfall spelled out rather than being marked failed wholesale.
            const deliveredAmount = succeeded.reduce((sum: number, l: any) => sum + Number(l.amount), 0)
            const outstanding = Number((Number(order.airtime_amount) - deliveredAmount).toFixed(2))
            const note =
                `Hubtel failed leg ${failed.map((l: any) => l.leg_index).join(', ')} of ${legs.length}` +
                (event?.Message ? ` (${event.Message}).` : '.') +
                ` GHS ${deliveredAmount.toFixed(2)} delivered, GHS ${outstanding.toFixed(2)} outstanding — send the remainder manually.`

            console.error(`[HubtelAirtimeWebhook] ${order.reference_code}: ${note}`)

            await supabase
                .from('airtime_orders')
                .update({
                    status: 'pending',
                    fulfillment_note: note,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', order.id)

            await sendPushToAdmins({
                title: '⚠️ Airtime top-up failed',
                body: `${order.network} → ${order.beneficiary_phone}. ${note}`,
                url: '/admin/airtime',
            }).catch(() => {})

            return NextResponse.json({ received: true })
        }

        if (succeeded.length === legs.length && legs.length > 0) {
            await finalizeAirtimeOrder({
                orderId: order.id,
                status: 'completed',
                existingOrder: order,
            })
            console.log(`[HubtelAirtimeWebhook] ${order.reference_code} completed (${legs.length} leg(s)).`)
            return NextResponse.json({ received: true })
        }

        // Legs still outstanding — a later callback finishes the order.
        console.log(
            `[HubtelAirtimeWebhook] ${order.reference_code}: ${succeeded.length}/${legs.length} legs delivered, waiting.`
        )
        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('[HubtelAirtimeWebhook] Processing error:', error)
        // Still 200 — see the note at the top of this file.
        return NextResponse.json({ received: true })
    }
}
