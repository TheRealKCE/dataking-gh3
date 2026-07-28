import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { verifyPaymentOtp } from '@/lib/payment-otp'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// 10 verify attempts per user+number per 15 min (per-code cap also enforced in the lib).
const otpVerifyLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '15 m'),
    prefix: 'rl:pay-otp-verify',
})

/**
 * POST /api/payments/otp/verify   Body: { phone, code }
 *
 * Confirms the OTP for a non-registered number. On success the number is marked
 * verified (short TTL) so /api/payments/initialize will accept it for a Hubtel prompt.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createRouteClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const userId = authUser.id

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

        try {
            const { success } = await otpVerifyLimit.limit(`${userId}:${String(phone).replace(/\D/g, '')}`)
            if (!success) {
                return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 })
            }
        } catch (e) {
            console.error('[PayOtpVerify] rate-limit error, continuing:', e)
        }

        const result = await verifyPaymentOtp(userId, phone, code)
        if (!result.ok) {
            return NextResponse.json({ error: result.error || 'Verification failed.' }, { status: 400 })
        }

        return NextResponse.json({ success: true, message: 'Number verified. You can now pay from it.' })
    } catch (e) {
        console.error('[PayOtpVerify] error:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
