/**
 * Pays an API partner their share of a completed order.
 *
 * This is the only place commission money is created, so it hangs off the two
 * functions that are already the single choke point for order state —
 * finalizeAirtimeOrder and finalizeUtilityOrder. Those are reached by the dispatcher,
 * by the Hubtel callback and by an admin pressing a button in /admin, which means all
 * three paths earn identically without any of them knowing this file exists.
 *
 * The hard part is paying exactly once. Those three callers can race: a callback can
 * land while the reconciliation cron is mid-sweep over the same order. So the ROW is
 * the mutex, not a flag read off the snapshot we were handed — see claim() below. It
 * is the same latch utility_orders.payment_status uses for refunds, for the same
 * reason.
 */
import { createServerClient } from '@/lib/supabase'

type Supabase = ReturnType<typeof createServerClient>

export type CommissionSource = 'airtime' | 'utility'

const TABLE: Record<CommissionSource, string> = {
    airtime: 'airtime_orders',
    utility: 'utility_orders',
}

/** Cap sentinel: pay the raw percentage and ignore what the provider reported. */
const CAP_DISABLED = 999

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * What Hubtel actually paid us on this order, or NaN when that is not known.
 *
 * The two tables keep it in different places. utility_orders.commission is a column
 * on the order, because one bill payment is one request. Airtime has no such column:
 * Hubtel caps a single top-up at GHS 100, so a larger order is split across
 * airtime_fulfillment_legs and each leg is paid its own commission. Reading
 * `order.commission` for airtime — as the obvious implementation does — finds
 * undefined, skips the cap, and quietly pays the uncapped percentage.
 */
async function providerCommissionFor(
    supabase: any,
    source: CommissionSource,
    order: any
): Promise<number> {
    if (source === 'utility') return Number(order.commission)

    const { data: legs } = await supabase
        .from('airtime_fulfillment_legs')
        .select('commission, status')
        .eq('order_id', order.id)

    const rows = (legs as any[]) || []
    // Only legs that actually landed earn anything.
    const paid = rows.filter(l => l.status === 'success' && l.commission != null)
    if (paid.length === 0) return NaN

    return paid.reduce((sum, l) => sum + Number(l.commission || 0), 0)
}

export interface CreditCommissionParams {
    source: CommissionSource
    orderId: string
    supabase?: Supabase
}

/**
 * Never throws and never returns a failure the caller must handle: an order that
 * settled correctly must not be reported as failed because a commission credit hit a
 * problem. Anything that goes wrong is logged and left for a retry — the latch is
 * unwound so the next attempt can claim it.
 */
export async function creditCommissionForOrder(params: CreditCommissionParams): Promise<void> {
    const { source, orderId } = params
    const supabase = (params.supabase || createServerClient()) as any

    try {
        if (!orderId) return

        // Re-read rather than accept a caller's snapshot. finalizeUtilityOrder and
        // finalizeAirtimeOrder are both routinely handed an `existingOrder` captured
        // BEFORE the provider's commission figure was written — the Hubtel callback
        // updates the row and then passes the pre-update copy. Clamping against that
        // stale copy would read commission as null on every first callback and skip
        // the cap entirely.
        const { data: order } = await supabase
            .from(TABLE[source])
            .select('*')
            .eq('id', orderId)
            .maybeSingle()

        if (!order?.id || !order?.user_id) return

        // Only orders placed through a COMMISSION key earn. A dashboard order, a
        // storefront order, or one placed with a standard data key pays nobody.
        if (!order.api_key_id) return
        if (order.commission_credited_at) return

        const { data: keyRow } = await supabase
            .from('api_keys')
            .select('kind')
            .eq('id', order.api_key_id)
            .maybeSingle()

        if (!keyRow || keyRow.kind !== 'commission') return

        // ── Work out the share ────────────────────────────────────────────────
        const serviceKey = source === 'airtime' ? 'airtime' : String(order.service || '')
        const { data: settingsRows } = await supabase
            .from('admin_settings')
            .select('key, value')
            .in('key', [
                'commission_share_pct',
                `commission_share_pct_${serviceKey}`,
                'commission_share_cap_pct',
            ])

        const settings: Record<string, string> = {}
        for (const row of ((settingsRows as any[]) || [])) settings[row.key] = row.value

        const pct = parseFloat(
            settings[`commission_share_pct_${serviceKey}`] ?? settings['commission_share_pct'] ?? '0'
        )
        if (!Number.isFinite(pct) || pct <= 0) return

        // Percentage of the BILL, not of what the provider paid us — predictable for
        // the partner, which is the whole point of this model.
        const base = Number(source === 'airtime' ? order.airtime_amount : order.bill_amount)
        if (!Number.isFinite(base) || base <= 0) return

        let share = round2(base * (pct / 100))

        // Then clamp to what the provider actually paid, so a low-commission service
        // cannot pay out more than it earned. Skipped when the provider reported
        // nothing: an unknown commission is not evidence of a zero one, and refusing
        // to pay on a missing field would silently strand a partner's earnings.
        const cap = parseFloat(settings['commission_share_cap_pct'] ?? '100')
        const providerCommission = await providerCommissionFor(supabase, source, order)

        if (Number.isFinite(cap) && cap !== CAP_DISABLED && Number.isFinite(providerCommission) && providerCommission > 0) {
            const ceiling = round2(providerCommission * (cap / 100))
            if (ceiling < share) share = ceiling
        }

        if (share <= 0) return

        // ── Claim, then credit ────────────────────────────────────────────────
        const table = TABLE[source]
        const { data: claim } = await supabase
            .from(table)
            .update({ commission_credited_at: new Date().toISOString() })
            .eq('id', order.id)
            .is('commission_credited_at', null)
            .select('id')
            .maybeSingle()

        // No row back means another caller already paid this order.
        if (!claim) return

        const { error: creditError } = await supabase.rpc('credit_commission_wallet_balance', {
            p_user_id: order.user_id,
            p_amount: share,
        })

        if (creditError) {
            // No money moved, so the claim has to go back or the order reads as paid
            // while the partner is still owed.
            console.error('[Commission] CRITICAL: credit failed for', order.reference_code, creditError)
            await supabase
                .from(table)
                .update({ commission_credited_at: null })
                .eq('id', order.id)
                .then(() => {}, () => {})
            return
        }

        // ── Ledger row ────────────────────────────────────────────────────────
        // Worth having, but it must never take down a credit that succeeded.
        try {
            const { data: wallet } = await supabase
                .from('commission_wallets')
                .select('id')
                .eq('owner_id', order.user_id)
                .maybeSingle()

            if (wallet?.id) {
                const label = source === 'airtime'
                    ? `${order.network} airtime GHS ${Number(order.airtime_amount).toFixed(2)}`
                    : `${order.service} bill GHS ${Number(order.bill_amount).toFixed(2)}`

                await supabase.from('commission_transactions').insert({
                    wallet_id:   wallet.id,
                    user_id:     order.user_id,
                    source,
                    order_id:    order.id,
                    amount:      share,
                    description: `Commission on ${label}`,
                    reference:   order.reference_code ?? null,
                })
            }
        } catch (e) {
            console.error('[Commission] Ledger row failed (non-fatal):', e)
        }
    } catch (e) {
        console.error('[Commission] Unexpected error:', e)
    }
}
