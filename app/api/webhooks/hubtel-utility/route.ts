import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { logCallback } from '@/lib/hubtel-payment-log'
import { finalizeUtilityOrder } from '@/lib/utility-order-completion'
import { sendPushToAdmins } from '@/lib/web-push'
import { UTILITY_SERVICES, isUtilityService } from '@/lib/hubtel-utility-service'

/**
 * Hubtel Commission Services (utility bills) callback.
 *
 * A DEDICATED route, for the same reason /api/webhooks/hubtel-airtime is one: the
 * Receive Money handler looks every reference up in `wallet_payments` and drops
 * anything it cannot find, which is every outbound bill payment. The payload shape
 * differs too.
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
            console.error('[HubtelUtilityWebhook] Failed to parse JSON body:', body.slice(0, 500))
            return NextResponse.json({ received: true })
        }

        console.log('[HubtelUtilityWebhook] Received callback:', JSON.stringify(event))

        const clientReference: string | undefined = event?.Data?.ClientReference ?? event?.ClientReference
        const responseCode: string = String(event?.ResponseCode ?? '')
        const isSuccess = responseCode === '0000'

        // Logged before anything can return early, so a refused payment still leaves
        // a trace in /admin/hubtel-payments — the failure is the interesting case.
        await logCallback({
            clientReference: clientReference || '',
            responseCode,
            message: event?.Message ?? event?.Data?.Description ?? null,
            amount: event?.Data?.Amount != null ? Number(event.Data.Amount) : undefined,
            transactionId: event?.Data?.TransactionId ?? undefined,
            raw: event,
        })

        if (!clientReference) {
            console.error('[HubtelUtilityWebhook] Callback carried no ClientReference.')
            return NextResponse.json({ received: true })
        }

        const { data: order } = await supabase
            .from('utility_orders')
            .select('*')
            .eq('client_reference', clientReference)
            .maybeSingle()

        if (!order) {
            console.error('[HubtelUtilityWebhook] No order matches reference:', clientReference)
            return NextResponse.json({ received: true })
        }

        // Idempotent, but asymmetrically so — the same rule the airtime callback uses.
        //
        // 'completed' is terminal: the bill is paid and a redelivered callback must
        // not run the completion a second time.
        //
        // 'failed' and 'refunded' are NOT terminal against a SUCCESS callback, because
        // our status came from the synchronous POST response and an unrecognised
        // acceptance code can mark an order failed while Hubtel goes on to settle it.
        // Hubtel is the authority on whether value moved.
        if (order.status === 'completed') {
            console.log(`[HubtelUtilityWebhook] ${clientReference} is already 'completed' — ignoring duplicate.`)
            return NextResponse.json({ received: true })
        }
        if ((order.status === 'failed' || order.status === 'refunded') && !isSuccess) {
            console.log(`[HubtelUtilityWebhook] ${clientReference} is already '${order.status}' — ignoring duplicate.`)
            return NextResponse.json({ received: true })
        }

        const wasRefunded = order.payment_status === 'refunded'
        if ((order.status === 'failed' || order.status === 'refunded') && isSuccess) {
            console.warn(
                `[HubtelUtilityWebhook] ${clientReference} was recorded '${order.status}' but Hubtel reports settlement ` +
                `(code ${responseCode}) — correcting to 'completed'. The synchronous response was misread.`
            )
        }

        await supabase
            .from('utility_orders')
            .update({
                transaction_id: event?.Data?.TransactionId ?? order.transaction_id,
                external_transaction_id: event?.Data?.ExternalTransactionId ?? order.external_transaction_id,
                commission: event?.Data?.Meta?.Commission != null
                    ? Number(event.Data.Meta.Commission)
                    : order.commission,
                response_code: responseCode || order.response_code,
                provider_response: event,
                updated_at: new Date().toISOString(),
            })
            .eq('id', order.id)

        const label = isUtilityService(order.service) ? UTILITY_SERVICES[order.service].label : order.service
        const description: string | null = event?.Data?.Description ?? event?.Message ?? null

        if (isSuccess) {
            await finalizeUtilityOrder({
                orderId: order.id,
                status: 'completed',
                // Only worth a note when we are contradicting ourselves; a plain
                // success needs no explanation on the order.
                note: wasRefunded
                    ? 'Hubtel settled this AFTER we had already refunded the customer — the bill was paid from our own funds. Recover the amount from the customer or reverse the refund.'
                    : null,
                existingOrder: order,
            })

            if (wasRefunded) {
                // We are now out of pocket by the full amount. This cannot sit in a log.
                await sendPushToAdmins({
                    title: '🚨 Utility bill settled after a refund',
                    body: `${order.reference_code}: ${label} GHS ${Number(order.bill_amount).toFixed(2)} → ${order.account_number} was refunded, then Hubtel paid it. Reconcile manually.`,
                    url: '/admin/utilities',
                }).catch(() => {})
            }

            console.log(`[HubtelUtilityWebhook] ${order.reference_code} completed.`)
            return NextResponse.json({ received: true })
        }

        // ── Failure ──────────────────────────────────────────────────────────
        // A failure callback is Hubtel telling us the bill was NOT paid, so unlike a
        // timeout this is safe to refund automatically.
        const note = `Hubtel could not pay the ${label} bill${description ? `: ${description}` : ` (code ${responseCode || 'none'})`}.`

        await finalizeUtilityOrder({
            orderId: order.id,
            status: 'failed',
            note,
            refund: true,
            existingOrder: order,
        })

        await sendPushToAdmins({
            title: '⚠️ Utility bill payment failed',
            body: `${order.reference_code} · ${label} → ${order.account_number}. ${note}`,
            url: '/admin/utilities',
        }).catch(() => {})

        console.error(`[HubtelUtilityWebhook] ${order.reference_code}: ${note}`)
        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('[HubtelUtilityWebhook] Processing error:', error)
        // Still 200 — see the note at the top of this file.
        return NextResponse.json({ received: true })
    }
}
