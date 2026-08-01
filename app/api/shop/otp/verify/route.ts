import { NextRequest, NextResponse } from 'next/server'
import { verifyGuestPaymentOtp } from '@/lib/guest-payment-otp'
import { markNumberTrusted } from '@/lib/trusted-payment-numbers'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// 10 verify attempts per number per 15 min (per-code cap also enforced in the lib).
const shopOtpVerifyLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '15 m'),
    prefix: 'rl:shop-otp-verify',
})

/**
 * POST /api/shop/otp/verify   Body: { phone, code }
 *
 * Guest-storefront twin of /api/payments/otp/verify. On success the number is
 * trusted permanently — this is the single verification the customer will ever do,
 * and it carries over to the logged-in dashboard too.
 */
export async function POST(request: NextRequest) {
    try {
        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { phone, code } = body || {}
        if (!phone || !code) {
            return NextResponse.json({ error: 'Phone and code are required.' }, { status: 400 })
        }

        // Fails CLOSED: this is a brute-force surface on a 6-digit code.
        try {
            const { success } = await shopOtpVerifyLimit.limit(String(phone).replace(/\D/g, ''))
            if (!success) {
                return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 })
            }
        } catch (e) {
            console.error('[ShopOtpVerify] rate-limit unreachable, denying:', e)
            return NextResponse.json(
                { error: 'Verification is temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            )
        }

        const result = await verifyGuestPaymentOtp(phone, code)
        if (!result.ok) {
            return NextResponse.json({ error: result.error || 'Verification failed.' }, { status: 400 })
        }

        // Trust this number permanently. No verifiedBy — there is no account here.
        await markNumberTrusted(phone, null)

        return NextResponse.json({
            success: true,
            message: 'Number verified. You won\'t need a code for this number again.',
        })
    } catch (e) {
        console.error('[ShopOtpVerify] error:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
