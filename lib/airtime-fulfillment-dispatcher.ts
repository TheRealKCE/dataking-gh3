/**
 * Decides whether an airtime order can be delivered automatically, and delivers it.
 *
 * Mirrors lib/order-fulfillment-dispatcher.ts (the data-bundle equivalent) but with
 * one difference that shapes everything here: airtime cannot be recalled. A data
 * bundle sent twice is an annoyance; airtime sent twice is money gone. So:
 *
 *   • the leg row is INSERTED BEFORE the provider is called, and the unique
 *     (order_id, leg_index) constraint is what makes a second invocation a no-op;
 *   • there is no retry loop anywhere in this path;
 *   • a failure leaves the order 'pending' for an admin rather than guessing.
 *
 * Hubtel caps one top-up at GHS 100, so an order above that is delivered as several
 * legs and is only complete when every one of them is.
 */
import { createServerClient } from '@/lib/supabase'
import { sendPushToAdmins } from '@/lib/web-push'
import { logInitiate } from '@/lib/hubtel-payment-log'
import { finalizeAirtimeOrder } from '@/lib/airtime-order-completion'
import {
    topUpAirtime,
    splitAirtimeAmount,
    HUBTEL_AIRTIME_MIN_PER_REQUEST,
    HUBTEL_AIRTIME_SERVICE_IDS,
} from '@/lib/hubtel-airtime-service'

const NETWORK_SETTING_KEY: Record<string, string> = {
    MTN: 'airtime_auto_mtn',
    Telecel: 'airtime_auto_telecel',
    AT: 'airtime_auto_at',
}

/** Hubtel allows 36 chars; this keeps us inside it for both GHD- and SHOP- codes. */
export function buildLegReference(referenceCode: string, legIndex: number): string {
    return `AIR-${String(referenceCode || '').slice(-24)}-${legIndex}`
}

/**
 * Leaves the order pending, records why, and puts it in front of an admin.
 * Never throws — a failed alert must not mask the fulfilment failure itself.
 */
async function haltForAdmin(
    supabase: any,
    order: any,
    note: string,
    deliveredSoFar: number
): Promise<void> {
    const fullNote = deliveredSoFar > 0
        ? `${note} GHS ${deliveredSoFar.toFixed(2)} of GHS ${Number(order.airtime_amount).toFixed(2)} was already delivered — send the remainder manually.`
        : note

    console.error(`[AirtimeDispatch] Order ${order.reference_code} halted: ${fullNote}`)

    try {
        await supabase
            .from('airtime_orders')
            .update({ fulfillment_note: fullNote, updated_at: new Date().toISOString() })
            .eq('id', order.id)
    } catch (e) {
        console.error('[AirtimeDispatch] Could not write fulfillment_note:', e)
    }

    await sendPushToAdmins({
        title: '⚠️ Airtime auto-fulfil failed',
        body: `${order.network} GHS ${Number(order.airtime_amount).toFixed(2)} → ${order.beneficiary_phone}. ${fullNote}`,
        url: '/admin/airtime',
    }).catch(() => {})
}

export interface AirtimeDispatchResult {
    /** True only when every leg was accepted by Hubtel. */
    dispatched: boolean
    /** Why it was not dispatched — for the caller's logs, not the customer. */
    reason?: string
}

/**
 * Attempts automatic delivery of one airtime order.
 *
 * Never throws. Callers that fire it from `waitUntil` can ignore the result; the
 * storefront reads `dispatched` to decide whether an admin still needs the
 * "fulfil this by hand" email.
 */
export async function triggerAirtimeFulfillment(orderId: string): Promise<AirtimeDispatchResult> {
    const supabase = createServerClient() as any

    try {
        const { data: order, error } = await supabase
            .from('airtime_orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (error || !order) {
            console.error('[AirtimeDispatch] Order not found:', orderId, error?.message)
            return { dispatched: false, reason: 'order not found' }
        }

        // ── Eligibility ──────────────────────────────────────────────────────
        if (order.status !== 'pending') {
            console.log(`[AirtimeDispatch] Order ${order.reference_code} is '${order.status}', not pending — skipping.`)
            return { dispatched: false, reason: `order is ${order.status}` }
        }

        // Mashup is an MTN data/voice bundle bought through the airtime form, not
        // airtime. Commission Services cannot deliver it, so it stays manual.
        if (order.type === 'mashup') {
            console.log(`[AirtimeDispatch] Order ${order.reference_code} is a mashup — manual fulfilment only.`)
            return { dispatched: false, reason: 'mashup is manual-only' }
        }

        if (!HUBTEL_AIRTIME_SERVICE_IDS[order.network]) {
            console.log(`[AirtimeDispatch] No Hubtel service ID for network '${order.network}' — leaving manual.`)
            return { dispatched: false, reason: `unsupported network ${order.network}` }
        }

        // ── Admin toggles ────────────────────────────────────────────────────
        const networkKey = NETWORK_SETTING_KEY[order.network]
        const { data: settingRows } = await supabase
            .from('admin_settings')
            .select('key, value')
            .in('key', ['airtime_auto_fulfillment_enabled', networkKey])

        const settings: Record<string, string> = {}
        for (const row of (settingRows || [])) settings[row.key] = row.value

        if (settings['airtime_auto_fulfillment_enabled'] !== 'true') {
            console.log('[AirtimeDispatch] Auto-fulfilment is disabled — order left for an admin.')
            return { dispatched: false, reason: 'auto-fulfilment disabled' }
        }
        if (settings[networkKey] !== 'true') {
            console.log(`[AirtimeDispatch] Auto-fulfilment is off for ${order.network} — order left for an admin.`)
            return { dispatched: false, reason: `auto-fulfilment off for ${order.network}` }
        }

        // ── Split ────────────────────────────────────────────────────────────
        const total = Number(order.airtime_amount)
        const legs = splitAirtimeAmount(total)

        if (legs.length === 0 || legs[0] < HUBTEL_AIRTIME_MIN_PER_REQUEST) {
            await haltForAdmin(
                supabase,
                order,
                `Amount GHS ${total.toFixed(2)} is below Hubtel's GHS ${HUBTEL_AIRTIME_MIN_PER_REQUEST.toFixed(2)} minimum.`,
                0
            )
            return { dispatched: false, reason: 'below provider minimum' }
        }

        await supabase
            .from('airtime_orders')
            .update({
                provider: 'hubtel',
                provider_reference: buildLegReference(order.reference_code, 1),
                auto_fulfillment_attempted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)

        console.log(
            `[AirtimeDispatch] ${order.reference_code} | ${order.network} | GHS ${total.toFixed(2)} → ` +
            `${order.beneficiary_phone} | ${legs.length} leg(s): ${legs.join(' + ')}`
        )

        // ── Dispatch each leg ────────────────────────────────────────────────
        let delivered = 0
        let allImmediate = true

        for (let i = 0; i < legs.length; i++) {
            const legIndex = i + 1
            const amount = legs[i]
            const clientReference = buildLegReference(order.reference_code, legIndex)

            // Claim the leg first. If this insert fails on the unique constraint the
            // leg has already been dispatched by another invocation, and sending it
            // again would double-credit the beneficiary.
            const { data: leg, error: claimError } = await supabase
                .from('airtime_fulfillment_legs')
                .insert({
                    order_id: orderId,
                    leg_index: legIndex,
                    client_reference: clientReference,
                    amount,
                    status: 'submitting',
                })
                .select()
                .single()

            if (claimError || !leg) {
                // 23505 = unique violation.
                if (claimError?.code === '23505') {
                    console.log(`[AirtimeDispatch] Leg ${legIndex} of ${order.reference_code} already claimed — stopping.`)
                    return { dispatched: false, reason: 'legs already claimed' }
                }
                await haltForAdmin(supabase, order, `Could not record leg ${legIndex}: ${claimError?.message || 'unknown error'}.`, delivered)
                return { dispatched: false, reason: 'could not record leg' }
            }

            const result = await topUpAirtime({
                network: order.network,
                phone: order.beneficiary_phone,
                amount,
                clientReference,
            })

            await supabase
                .from('airtime_fulfillment_legs')
                .update({
                    status: result.success ? (result.pending ? 'pending' : 'success') : 'failed',
                    transaction_id: result.transactionId ?? null,
                    commission: result.commission ?? null,
                    response_code: result.responseCode ?? null,
                    message: result.message ?? result.error ?? null,
                    raw: result.raw ?? null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', leg.id)

            // Airtime shows up in /admin/hubtel-payments alongside collections, so an
            // admin has one place to answer "what did Hubtel do for this customer?".
            await logInitiate({
                clientReference,
                status: result.success ? (result.pending ? 'pending' : 'success') : 'failed',
                amount,
                payerMsisdn: order.beneficiary_phone,
                transactionId: result.transactionId ?? null,
                responseCode: result.responseCode ?? null,
                message: result.message ?? result.error ?? null,
                userId: order.user_id ?? null,
                raw: result.raw,
            })

            if (!result.success) {
                await haltForAdmin(
                    supabase,
                    order,
                    `Hubtel rejected leg ${legIndex} of ${legs.length}: ${result.error || 'unknown error'}.`,
                    delivered
                )
                return { dispatched: false, reason: result.error || 'provider rejected leg' }
            }

            delivered = Number((delivered + amount).toFixed(2))
            if (result.pending) allImmediate = false
        }

        // '0000' on every leg means Hubtel delivered synchronously and no callback is
        // coming, so nothing else would ever close the order out.
        await finalizeAirtimeOrder({
            orderId,
            status: allImmediate ? 'completed' : 'processing',
            existingOrder: order,
        })

        console.log(
            `[AirtimeDispatch] ${order.reference_code} dispatched — ` +
            (allImmediate ? 'completed immediately.' : 'awaiting Hubtel callback.')
        )
        return { dispatched: true }
    } catch (err: any) {
        // A crash here must never surface to the customer: their money is already
        // handled and the order simply stays pending for an admin.
        console.error('[AirtimeDispatch] Unexpected error for order', orderId, err)
        return { dispatched: false, reason: String(err?.message || err) }
    }
}
