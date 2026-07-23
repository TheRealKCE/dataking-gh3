/**
 * Payment Phone OTP — Hubtel Direct Receive Money security (Option 2)
 *
 * A logged-in user who wants to pay from a number that is NOT their registered
 * profile number must first prove control of it via a one-time SMS code. Only
 * then is the Hubtel prompt sent.
 *
 * Storage: Supabase table `public.payment_otps` (see migrations/20260723_payment_otps.sql).
 * We deliberately DON'T use Redis here — the Upstash instance is quota-capped and
 * this flow must stay available. Expiry is enforced by comparing timestamps.
 *
 * Public API is unchanged from the previous Redis implementation, so the routes
 * that call it need no edits.
 */
import { createServerClient } from '@/lib/supabase'

const OTP_TTL_MS = 5 * 60 * 1000          // code valid for 5 minutes
const VERIFIED_TTL_MS = 15 * 60 * 1000    // verified marker valid for 15 minutes
const MAX_ATTEMPTS = 5                      // wrong-code attempts before the code is burned

/** Normalizes a Ghana phone to bare 233XXXXXXXXX (12 digits), or null if invalid. */
export function normalizeMsisdn(phone: string): string | null {
    let p = (phone || '').replace(/\D/g, '')
    if (p.startsWith('0') && p.length === 10) p = '233' + p.slice(1)
    if (p.length === 9) p = '233' + p
    if (!p.startsWith('233') || p.length !== 12) return null
    return p
}

function generateCode(): string {
    return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')
}

export interface SendOtpResult {
    ok: boolean
    msisdn?: string
    /** Returned to the caller so it can SMS the code. Never sent to the client. */
    code?: string
    error?: string
}

/** Generates + stores an OTP for (userId, phone), replacing any previous code. */
export async function createPaymentOtp(userId: string, phone: string): Promise<SendOtpResult> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return { ok: false, error: 'Invalid phone number.' }

    const code = generateCode()
    const now = Date.now()

    try {
        const db = createServerClient() as any
        const { error } = await db
            .from('payment_otps')
            .upsert({
                user_id: userId,
                msisdn,
                code,
                attempts: 0,
                verified: false,
                expires_at: new Date(now + OTP_TTL_MS).toISOString(),
                verified_until: null,
                updated_at: new Date(now).toISOString(),
            }, { onConflict: 'user_id,msisdn' })

        if (error) {
            console.error('[PaymentOtp] Failed to store OTP:', error.message)
            return { ok: false, error: 'Verification is temporarily unavailable. Please try again shortly.' }
        }
    } catch (e) {
        console.error('[PaymentOtp] DB unavailable while storing OTP:', e)
        return { ok: false, error: 'Verification is temporarily unavailable. Please try again shortly.' }
    }

    return { ok: true, msisdn, code }
}

export interface VerifyOtpResult {
    ok: boolean
    error?: string
}

/** Verifies a code; on success marks the number verified for a short window. */
export async function verifyPaymentOtp(userId: string, phone: string, code: string): Promise<VerifyOtpResult> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return { ok: false, error: 'Invalid phone number.' }
    if (!/^\d{6}$/.test(String(code || ''))) return { ok: false, error: 'Enter the 6-digit code.' }

    try {
        const db = createServerClient() as any
        const { data: row } = await db
            .from('payment_otps')
            .select('code, attempts, expires_at')
            .eq('user_id', userId)
            .eq('msisdn', msisdn)
            .maybeSingle()

        if (!row) return { ok: false, error: 'Code expired. Please request a new one.' }
        if (new Date(row.expires_at).getTime() < Date.now()) {
            return { ok: false, error: 'Code expired. Please request a new one.' }
        }

        const attempts = (row.attempts ?? 0) + 1
        if (attempts > MAX_ATTEMPTS) {
            await db.from('payment_otps').delete().eq('user_id', userId).eq('msisdn', msisdn)
            return { ok: false, error: 'Too many attempts. Please request a new code.' }
        }

        if (String(row.code) !== String(code)) {
            await db.from('payment_otps')
                .update({ attempts, updated_at: new Date().toISOString() })
                .eq('user_id', userId).eq('msisdn', msisdn)
            return { ok: false, error: 'Incorrect code. Please try again.' }
        }

        // Success — mark verified, clear the code so it can't be reused.
        await db.from('payment_otps')
            .update({
                verified: true,
                code: '000000',
                attempts: 0,
                verified_until: new Date(Date.now() + VERIFIED_TTL_MS).toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId).eq('msisdn', msisdn)

        return { ok: true }
    } catch (e) {
        console.error('[PaymentOtp] DB unavailable during verification:', e)
        return { ok: false, error: 'Verification is temporarily unavailable. Please try again shortly.' }
    }
}

/** True if (userId, phone) holds a live verified marker. Fails CLOSED (deny) on error. */
export async function isPaymentPhoneVerified(userId: string, phone: string): Promise<boolean> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return false
    try {
        const db = createServerClient() as any
        const { data: row } = await db
            .from('payment_otps')
            .select('verified, verified_until')
            .eq('user_id', userId)
            .eq('msisdn', msisdn)
            .maybeSingle()

        if (!row || !row.verified || !row.verified_until) return false
        return new Date(row.verified_until).getTime() >= Date.now()
    } catch (e) {
        console.error('[PaymentOtp] DB unavailable checking verification (denying):', e)
        return false
    }
}

/** Consumes the verified marker after a payment is initiated (single-use). */
export async function consumePaymentPhoneVerification(userId: string, phone: string): Promise<void> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return
    try {
        const db = createServerClient() as any
        await db.from('payment_otps').delete().eq('user_id', userId).eq('msisdn', msisdn)
    } catch (e) {
        console.error('[PaymentOtp] DB unavailable consuming verification:', e)
    }
}
