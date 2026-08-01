/**
 * Trusted Payment Numbers — Hubtel "verify once" trust store.
 *
 * A number is confirmed by SMS code exactly ONCE (see lib/payment-otp.ts). The
 * moment that code checks out we write a row here, and every later Hubtel payment
 * from that number skips verification entirely — dashboard or guest storefront,
 * any device, any account.
 *
 * Trust attaches to the NUMBER alone. There is no per-account or per-device key,
 * which is what lets a customer verified in the shop pay from the dashboard without
 * a second code. The trade-off is that anyone typing a trusted number reaches the
 * Hubtel prompt without a code, so the per-number prompt rate limit in the payment
 * routes is load-bearing, not decorative.
 *
 * Storage: Supabase table `public.trusted_payment_numbers`
 * (see migrations/20260801_trusted_payment_numbers.sql). Service-role only.
 */
import { createServerClient } from '@/lib/supabase'
import { normalizeMsisdn } from '@/lib/payment-otp'

/**
 * True if this number has been verified and not revoked.
 *
 * Fails CLOSED on any error, exactly like isPaymentPhoneVerified — if we cannot
 * confirm trust, the customer is asked for a code. Never the other way round: a
 * DB blip must not turn into a free pass for sending payment prompts.
 */
export async function isTrustedPaymentNumber(phone: string): Promise<boolean> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return false

    try {
        const db = createServerClient() as any
        const { data: row, error } = await db
            .from('trusted_payment_numbers')
            .select('revoked_at')
            .eq('msisdn', msisdn)
            .maybeSingle()

        if (error) {
            console.error('[TrustedNumbers] Lookup failed (denying):', error.message)
            return false
        }
        if (!row) return false
        return !row.revoked_at
    } catch (e) {
        console.error('[TrustedNumbers] DB unavailable checking trust (denying):', e)
        return false
    }
}

/**
 * Marks a number trusted forever. Called the instant an OTP is accepted.
 *
 * Idempotent: re-verifying an already-trusted number leaves verified_at and the
 * usage counters alone. Re-verifying a REVOKED number clears the revocation —
 * proving control of the SIM again is exactly how a revoked number earns its way
 * back.
 *
 * Returns false if the row could not be written; the caller should treat that as
 * "verification succeeded but trust was not persisted" and let the customer pay
 * now, since they just proved ownership. They will simply be asked again next time.
 */
export async function markNumberTrusted(phone: string, verifiedBy?: string | null): Promise<boolean> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return false

    try {
        const db = createServerClient() as any
        const { data: existing } = await db
            .from('trusted_payment_numbers')
            .select('msisdn, revoked_at')
            .eq('msisdn', msisdn)
            .maybeSingle()

        if (existing) {
            // Already known. Only act if it was revoked — otherwise leave history intact.
            if (existing.revoked_at) {
                const { error } = await db
                    .from('trusted_payment_numbers')
                    .update({ revoked_at: null, verified_at: new Date().toISOString() })
                    .eq('msisdn', msisdn)
                if (error) {
                    console.error('[TrustedNumbers] Failed to un-revoke:', error.message)
                    return false
                }
            }
            return true
        }

        const { error } = await db
            .from('trusted_payment_numbers')
            .insert({
                msisdn,
                verified_by: verifiedBy || null,
                verified_at: new Date().toISOString(),
            })

        if (error) {
            // A concurrent verify of the same number races us to the insert. The
            // unique PK makes that safe — the number is trusted either way.
            if (String(error.code) === '23505') return true
            console.error('[TrustedNumbers] Failed to record trust:', error.message)
            return false
        }
        return true
    } catch (e) {
        console.error('[TrustedNumbers] DB unavailable recording trust:', e)
        return false
    }
}

/**
 * Bumps usage stats after a confirmed payment. Statistics only — this never grants
 * or withholds trust, so a failure here is inconsequential and only logged.
 */
export async function recordTrustedUsage(phone: string): Promise<void> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return

    try {
        const db = createServerClient() as any
        const { data: row } = await db
            .from('trusted_payment_numbers')
            .select('payment_count')
            .eq('msisdn', msisdn)
            .maybeSingle()

        if (!row) return

        await db
            .from('trusted_payment_numbers')
            .update({
                payment_count: (row.payment_count ?? 0) + 1,
                last_used_at: new Date().toISOString(),
            })
            .eq('msisdn', msisdn)
    } catch (e) {
        console.error('[TrustedNumbers] Could not record usage (non-fatal):', e)
    }
}

/**
 * Revokes trust. Because trust never expires on its own, this is the only remedy
 * if a number is abused — the next payment from it will require a fresh code.
 */
export async function revokeTrustedNumber(phone: string): Promise<boolean> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return false

    try {
        const db = createServerClient() as any
        const { error } = await db
            .from('trusted_payment_numbers')
            .update({ revoked_at: new Date().toISOString() })
            .eq('msisdn', msisdn)

        if (error) {
            console.error('[TrustedNumbers] Failed to revoke:', error.message)
            return false
        }
        return true
    } catch (e) {
        console.error('[TrustedNumbers] DB unavailable revoking:', e)
        return false
    }
}
