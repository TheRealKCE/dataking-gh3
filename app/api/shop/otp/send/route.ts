import { NextRequest, NextResponse } from 'next/server'
import { normalizeMsisdn } from '@/lib/payment-otp'
import { createGuestPaymentOtp } from '@/lib/guest-payment-otp'
import { isTrustedPaymentNumber } from '@/lib/trusted-payment-numbers'
import { sendSMS } from '@/lib/sms-service'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// 3 sends per number per 15 min. Guests have no account, so the number is the key.
const shopOtpSendLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(3, '15 m'),
    prefix: 'rl:shop-otp-send',
})

/**
 * POST /api/shop/otp/send   Body: { phone }
 *
 * Guest-storefront twin of /api/payments/otp/send, for customers with no account.
 * Sends a 6-digit code the FIRST time a number is used to pay; once verified, the
 * number is trusted permanently and this route short-circuits without an SMS.
 */
export async function POST(request: NextRequest) {
    try {
        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const msisdn = normalizeMsisdn(body?.phone || '')
        if (!msisdn) {
            return NextResponse.json({ error: 'Enter a valid Ghana phone number.' }, { status: 400 })
        }

        // Already verified once → never ask again, and don't burn an SMS.
        if (await isTrustedPaymentNumber(msisdn)) {
            return NextResponse.json({
                success: true,
                alreadyVerified: true,
                message: 'This number is already verified — no code needed.',
            })
        }

        // Fails CLOSED: this route sends an SMS to a number the caller chose, so an
        // unreachable limiter must not become an open relay.
        try {
            const { success } = await shopOtpSendLimit.limit(msisdn)
            if (!success) {
                return NextResponse.json(
                    { error: 'Too many code requests. Please wait a few minutes and try again.' },
                    { status: 429 }
                )
            }
        } catch (e) {
            console.error('[ShopOtpSend] rate-limit unreachable, denying:', e)
            return NextResponse.json(
                { error: 'Verification is temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            )
        }

        const otp = await createGuestPaymentOtp(msisdn)
        if (!otp.ok || !otp.code) {
            return NextResponse.json({ error: otp.error || 'Could not generate a code.' }, { status: 400 })
        }

        const sms = await sendSMS({
            recipient: msisdn,
            message: `Your ARHMS payment verification code is ${otp.code}. It expires in 5 minutes. Do not share it with anyone.`,
        })

        if (!sms.success) {
            console.error('[ShopOtpSend] SMS failed:', sms.error)
            return NextResponse.json(
                { error: 'Could not send the code. Please check the number and try again.' },
                { status: 502 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'A 6-digit code was sent to that number.',
        })
    } catch (e) {
        console.error('[ShopOtpSend] error:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
