/**
 * Payment Phone OTP — Hubtel Direct Receive Money security (Option 2)
 *
 * Hubtel requires one of two safeguards against unsolicited prompts:
 *   Option 1 — only registered users pay, and cannot edit their number.
 *   Option 2 — OTP-confirm a number before initiating payment.
 *
 * This module implements Option 2. A logged-in user who wants to pay from a
 * number that is NOT their registered profile number must first prove control
 * of it via a one-time SMS code. Only then will the Hubtel prompt be sent.
 *
 * Flow:
 *   1. createPaymentOtp(userId, phone)  → 6-digit code in Redis (5 min TTL); caller SMSes it.
 *   2. verifyPaymentOtp(userId, phone, code) → on match, burns the code and sets a
 *      short-lived "verified" marker (15 min TTL) keyed to userId+msisdn.
 *   3. isPaymentPhoneVerified(userId, phone) → payments/initialize checks this before
 *      sending a non-registered number to Hubtel.
 *   4. consumePaymentPhoneVerification(...) → single-use, prevents replay.
 *
 * Storage: Upstash Redis (already used app-wide). Codes are never logged or returned.
 */
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const OTP_TTL_SECONDS = 5 * 60          // code valid for 5 minutes
const VERIFIED_TTL_SECONDS = 15 * 60    // verified marker valid for 15 minutes
const MAX_ATTEMPTS = 5                   // wrong-code attempts before the code is burned

/** Normalizes a Ghana phone to bare 233XXXXXXXXX (12 digits), or null if invalid. */
export function normalizeMsisdn(phone: string): string | null {
    let p = (phone || '').replace(/\D/g, '')
    if (p.startsWith('0') && p.length === 10) p = '233' + p.slice(1)
    if (p.length === 9) p = '233' + p
    if (!p.startsWith('233') || p.length !== 12) return null
    return p
}

const codeKey = (u: string, m: string) => `pay:otp:${u}:${m}`
const attemptsKey = (u: string, m: string) => `pay:otp:attempts:${u}:${m}`
const verifiedKey = (u: string, m: string) => `pay:otp:verified:${u}:${m}`

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
    await redis.set(codeKey(userId, msisdn), code, { ex: OTP_TTL_SECONDS })
    await redis.del(attemptsKey(userId, msisdn))
    return { ok: true, msisdn, code }
}

export interface VerifyOtpResult {
    ok: boolean
    error?: string
}

/** Verifies a code; on success burns it and marks the number verified. */
export async function verifyPaymentOtp(userId: string, phone: string, code: string): Promise<VerifyOtpResult> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return { ok: false, error: 'Invalid phone number.' }
    if (!/^\d{6}$/.test(String(code || ''))) return { ok: false, error: 'Enter the 6-digit code.' }

    const stored = await redis.get<string>(codeKey(userId, msisdn))
    if (!stored) return { ok: false, error: 'Code expired. Please request a new one.' }

    const attempts = await redis.incr(attemptsKey(userId, msisdn))
    if (attempts === 1) await redis.expire(attemptsKey(userId, msisdn), OTP_TTL_SECONDS)
    if (attempts > MAX_ATTEMPTS) {
        await redis.del(codeKey(userId, msisdn))
        return { ok: false, error: 'Too many attempts. Please request a new code.' }
    }

    if (String(stored) !== String(code)) {
        return { ok: false, error: 'Incorrect code. Please try again.' }
    }

    await redis.del(codeKey(userId, msisdn))
    await redis.del(attemptsKey(userId, msisdn))
    await redis.set(verifiedKey(userId, msisdn), '1', { ex: VERIFIED_TTL_SECONDS })
    return { ok: true }
}

/** True if (userId, phone) currently holds a verified marker. */
export async function isPaymentPhoneVerified(userId: string, phone: string): Promise<boolean> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return false
    return (await redis.get(verifiedKey(userId, msisdn))) != null
}

/** Consumes the verified marker after a payment is initiated (single-use). */
export async function consumePaymentPhoneVerification(userId: string, phone: string): Promise<void> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return
    await redis.del(verifiedKey(userId, msisdn))
}
