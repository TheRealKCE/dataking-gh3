/**
 * Guest Payment Phone OTP — storefront twin of lib/payment-otp.ts.
 *
 * Storefront customers have no account, and `payment_otps` is keyed on a NOT NULL
 * user_id FK, so they cannot live there. Rather than widen that live table, guests
 * get their own — same 5-minute code, same 15-minute verified marker, same
 * fail-closed behaviour, keyed on the number alone.
 *
 * As on the account side, a successful verification writes permanent trust via
 * lib/trusted-payment-numbers.ts, so a returning customer never reaches this module
 * again.
 *
 * Storage: Supabase table `public.guest_payment_otps`
 * (see migrations/20260801_trusted_payment_numbers.sql). Service-role only.
 */
import { createServerClient } from '@/lib/supabase'
import { normalizeMsisdn, type SendOtpResult, type VerifyOtpResult } from '@/lib/payment-otp'

const OTP_TTL_MS = 5 * 60 * 1000          // code valid for 5 minutes
const VERIFIED_TTL_MS = 15 * 60 * 1000    // verified marker valid for 15 minutes
const MAX_ATTEMPTS = 5                     // wrong-code attempts before the code is burned

function generateCode(): string {
    return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')
}

/** Generates + stores a guest OTP for a number, replacing any previous code. */
export async function createGuestPaymentOtp(phone: string): Promise<SendOtpResult> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return { ok: false, error: 'Invalid phone number.' }

    const code = generateCode()
    const now = Date.now()

    try {
        const db = createServerClient() as any
        const { error } = await db
            .from('guest_payment_otps')
            .upsert({
                msisdn,
                code,
                attempts: 0,
                verified: false,
                expires_at: new Date(now + OTP_TTL_MS).toISOString(),
                verified_until: null,
                updated_at: new Date(now).toISOString(),
            }, { onConflict: 'msisdn' })

        if (error) {
            console.error('[GuestOtp] Failed to store OTP:', error.message)
            return { ok: false, error: 'Verification is temporarily unavailable. Please try again shortly.' }
        }
    } catch (e) {
        console.error('[GuestOtp] DB unavailable while storing OTP:', e)
        return { ok: false, error: 'Verification is temporarily unavailable. Please try again shortly.' }
    }

    return { ok: true, msisdn, code }
}

/** Verifies a guest code; on success marks the number verified for a short window. */
export async function verifyGuestPaymentOtp(phone: string, code: string): Promise<VerifyOtpResult> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return { ok: false, error: 'Invalid phone number.' }
    if (!/^\d{6}$/.test(String(code || ''))) return { ok: false, error: 'Enter the 6-digit code.' }

    try {
        const db = createServerClient() as any
        const { data: row } = await db
            .from('guest_payment_otps')
            .select('code, attempts, expires_at')
            .eq('msisdn', msisdn)
            .maybeSingle()

        if (!row) return { ok: false, error: 'Code expired. Please request a new one.' }
        if (new Date(row.expires_at).getTime() < Date.now()) {
            return { ok: false, error: 'Code expired. Please request a new one.' }
        }

        const attempts = (row.attempts ?? 0) + 1
        if (attempts > MAX_ATTEMPTS) {
            await db.from('guest_payment_otps').delete().eq('msisdn', msisdn)
            return { ok: false, error: 'Too many attempts. Please request a new code.' }
        }

        if (String(row.code) !== String(code)) {
            await db.from('guest_payment_otps')
                .update({ attempts, updated_at: new Date().toISOString() })
                .eq('msisdn', msisdn)
            return { ok: false, error: 'Incorrect code. Please try again.' }
        }

        // Success — mark verified, clear the code so it can't be reused.
        await db.from('guest_payment_otps')
            .update({
                verified: true,
                code: '000000',
                attempts: 0,
                verified_until: new Date(Date.now() + VERIFIED_TTL_MS).toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('msisdn', msisdn)

        return { ok: true }
    } catch (e) {
        console.error('[GuestOtp] DB unavailable during verification:', e)
        return { ok: false, error: 'Verification is temporarily unavailable. Please try again shortly.' }
    }
}

/** True if this number holds a live guest verified marker. Fails CLOSED on error. */
export async function isGuestPhoneVerified(phone: string): Promise<boolean> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return false
    try {
        const db = createServerClient() as any
        const { data: row } = await db
            .from('guest_payment_otps')
            .select('verified, verified_until')
            .eq('msisdn', msisdn)
            .maybeSingle()

        if (!row || !row.verified || !row.verified_until) return false
        return new Date(row.verified_until).getTime() >= Date.now()
    } catch (e) {
        console.error('[GuestOtp] DB unavailable checking verification (denying):', e)
        return false
    }
}

/** Consumes the short-lived guest marker once a payment has been initiated. */
export async function consumeGuestPhoneVerification(phone: string): Promise<void> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return
    try {
        const db = createServerClient() as any
        await db.from('guest_payment_otps').delete().eq('msisdn', msisdn)
    } catch (e) {
        console.error('[GuestOtp] DB unavailable consuming verification:', e)
    }
}
