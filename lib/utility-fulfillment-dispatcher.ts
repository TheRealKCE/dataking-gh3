/**
 * Decides whether a utility bill order can be paid automatically, and pays it.
 *
 * Mirrors lib/airtime-fulfillment-dispatcher.ts. The difference is the shape of the
 * work, not the caution: airtime above GHS 100 is split into legs and a separate
 * table's UNIQUE (order_id, leg_index) is what makes a second invocation a no-op.
 * A utility payment is one request, so the same guarantee comes from a conditional
 * UPDATE that claims `dispatch_claimed_at` before anything is sent. Whoever loses
 * that race sends nothing.
 *
 * Everything else carries over unchanged, and for the same reason — the money
 * cannot be recalled:
 *
 *   • no retry loop anywhere in this path;
 *   • an outright rejection refunds the customer, because we know the bill was
 *     never paid;
 *   • anything ambiguous is left for an admin rather than guessed at.
 */
import { createServerClient } from '@/lib/supabase'
import { sendPushToAdmins } from '@/lib/web-push'
import { logInitiate } from '@/lib/hubtel-payment-log'
import { finalizeUtilityOrder } from '@/lib/utility-order-completion'
import {
    payUtilityBill,
    UTILITY_SERVICES,
    isUtilityService,
} from '@/lib/hubtel-utility-service'

/**
 * Hubtel allows 36 characters. reference_code is `UTIL-GHD-<ts>-<hex>`, so taking
 * its tail keeps us comfortably inside that while staying unique per order.
 */
export function buildUtilityClientReference(referenceCode: string): string {
    return `UTLB-${String(referenceCode || '').slice(-28)}`
}

/**
 * Leaves the order failed, records why, refunds when we know the bill went unpaid,
 * and puts it in front of an admin. Never throws — a failed alert must not mask the
 * fulfilment failure itself.
 */
async function haltForAdmin(
    order: any,
    note: string,
    opts: { refund: boolean }
): Promise<void> {
    const label = isUtilityService(order.service) ? UTILITY_SERVICES[order.service].label : order.service
    console.error(`[UtilityDispatch] Order ${order.reference_code} halted: ${note}`)

    await finalizeUtilityOrder({
        orderId: order.id,
        status: 'failed',
        note,
        refund: opts.refund,
        existingOrder: order,
    }).catch(e => console.error('[UtilityDispatch] finalize failed:', e))

    await sendPushToAdmins({
        title: '⚠️ Utility bill auto-payment failed',
        body: `${label} GHS ${Number(order.bill_amount).toFixed(2)} → ${order.account_number}. ${note}`,
        url: '/admin/utilities',
    }).catch(() => {})
}

export interface UtilityDispatchResult {
    dispatched: boolean
    /** Why it was not dispatched — for the caller's logs, not the customer. */
    reason?: string
}

/**
 * Attempts automatic payment of one utility bill order.
 *
 * Never throws. Callers that fire it from `waitUntil` can ignore the result.
 */
export async function triggerUtilityFulfillment(orderId: string): Promise<UtilityDispatchResult> {
    const supabase = createServerClient() as any

    try {
        const { data: order, error } = await supabase
            .from('utility_orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (error || !order) {
            console.error('[UtilityDispatch] Order not found:', orderId, error?.message)
            return { dispatched: false, reason: 'order not found' }
        }

        // ── Eligibility ──────────────────────────────────────────────────────
        if (order.status !== 'pending') {
            console.log(`[UtilityDispatch] Order ${order.reference_code} is '${order.status}', not pending — skipping.`)
            return { dispatched: false, reason: `order is ${order.status}` }
        }

        if (!isUtilityService(order.service)) {
            console.log(`[UtilityDispatch] Unknown service '${order.service}' — leaving manual.`)
            return { dispatched: false, reason: `unsupported service ${order.service}` }
        }

        const def = UTILITY_SERVICES[order.service]

        // ── Admin toggles ────────────────────────────────────────────────────
        const serviceKey = `utility_auto_${order.service}`
        const { data: settingRows } = await supabase
            .from('admin_settings')
            .select('key, value')
            .in('key', ['utility_auto_fulfillment_enabled', serviceKey])

        const settings: Record<string, string> = {}
        for (const row of (settingRows || [])) settings[row.key] = row.value

        if (settings['utility_auto_fulfillment_enabled'] !== 'true') {
            console.log('[UtilityDispatch] Auto-payment is disabled — order left for an admin.')
            return { dispatched: false, reason: 'auto-fulfilment disabled' }
        }
        if (settings[serviceKey] !== 'true') {
            console.log(`[UtilityDispatch] Auto-payment is off for ${def.label} — order left for an admin.`)
            return { dispatched: false, reason: `auto-fulfilment off for ${order.service}` }
        }

        // ── Claim ────────────────────────────────────────────────────────────
        // The whole idempotency story. Nothing above this line has spent anything,
        // and nothing below runs twice for one order: a concurrent invocation
        // (double submit, webhook plus cron, a retried serverless function) finds
        // dispatch_claimed_at already set and gets no row back.
        const clientReference = order.client_reference || buildUtilityClientReference(order.reference_code)

        const { data: claimed } = await supabase
            .from('utility_orders')
            .update({
                dispatch_claimed_at: new Date().toISOString(),
                provider: 'hubtel',
                client_reference: clientReference,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
            .eq('status', 'pending')
            .is('dispatch_claimed_at', null)
            .select()
            .maybeSingle()

        if (!claimed) {
            console.log(`[UtilityDispatch] Order ${order.reference_code} already claimed — not sending again.`)
            return { dispatched: false, reason: 'already claimed' }
        }

        console.log(
            `[UtilityDispatch] ${order.reference_code} | ${def.label} | GHS ${Number(order.bill_amount).toFixed(2)} → ` +
            `${order.account_number} (dest ${order.destination})`
        )

        // ── Pay ──────────────────────────────────────────────────────────────
        const result = await payUtilityBill({
            service: order.service,
            destination: order.destination,
            amount: Number(order.bill_amount),
            clientReference,
            meterNumber: def.kind === 'tv' ? null : order.account_number,
            email: order.customer_email,
            sessionId: order.session_id,
        })

        await supabase
            .from('utility_orders')
            .update({
                transaction_id: result.transactionId ?? null,
                commission: result.commission ?? null,
                response_code: result.responseCode ?? null,
                provider_response: (result.raw ?? null) as any,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)

        // Utilities show up in /admin/hubtel-payments alongside collections and
        // airtime, so an admin has one place to answer "what did Hubtel do here?".
        await logInitiate({
            clientReference,
            status: result.success ? (result.pending ? 'pending' : 'success') : 'failed',
            amount: Number(order.bill_amount),
            payerMsisdn: order.customer_phone ?? null,
            customerName: order.account_name ?? null,
            transactionId: result.transactionId ?? null,
            responseCode: result.responseCode ?? null,
            message: result.message ?? result.error ?? null,
            userId: order.user_id ?? null,
            raw: result.raw,
        })

        if (!result.success) {
            // A synchronous rejection means Hubtel never took the payment on, so the
            // customer's money is still ours to give back. The one exception is a
            // transport failure: the request may have landed even though we never saw
            // the answer, so that stays unrefunded for a human to check in the portal.
            const knownUnpaid = !!result.responseCode
            await haltForAdmin(
                { ...order, status: 'pending' },
                `Hubtel rejected the ${def.label} payment: ${result.error || 'unknown error'}.` +
                (knownUnpaid ? '' : ' The request may or may not have reached the provider — confirm in the Hubtel portal BEFORE refunding or re-sending.'),
                { refund: knownUnpaid }
            )
            return { dispatched: false, reason: result.error || 'provider rejected payment' }
        }

        // '0000' means Hubtel settled synchronously and no callback is coming, so
        // nothing else would ever close the order out.
        await finalizeUtilityOrder({
            orderId,
            status: result.pending ? 'processing' : 'completed',
            existingOrder: { ...order, status: 'pending' },
        })

        console.log(
            `[UtilityDispatch] ${order.reference_code} dispatched — ` +
            (result.pending ? 'awaiting Hubtel callback.' : 'settled immediately.')
        )
        return { dispatched: true }
    } catch (err: any) {
        // A crash here must never surface to the customer: their money is already
        // handled and the order simply stays for an admin.
        console.error('[UtilityDispatch] Unexpected error for order', orderId, err)
        return { dispatched: false, reason: String(err?.message || err) }
    }
}
