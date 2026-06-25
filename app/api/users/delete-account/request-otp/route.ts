import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazy-init so a missing env var or exhausted Redis limit does not crash the module
let otpRateLimit: Ratelimit | null = null
try {
    otpRateLimit = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(3, '10 m'), // 3 requests per 10 minutes
        prefix: 'rl:delete-otp',
    })
} catch (e) {
    console.error('[DeleteOTP] Redis init failed — rate limit disabled:', e)
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser || !authUser.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fail-open: if Redis is exhausted, allow the request rather than blocking
        try {
            if (otpRateLimit) {
                const { success: rateLimitOk } = await otpRateLimit.limit(authUser.id)
                if (!rateLimitOk) {
                    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
                }
            }
        } catch (rlErr) {
            console.error('[DeleteOTP] Rate limit check failed (Redis exhausted?), proceeding:', rlErr)
        }

        const { error } = await supabase.auth.signInWithOtp({ email: authUser.email })

        if (error) {
            console.error('OTP request error:', error)
            return NextResponse.json({ error: 'Failed to send confirmation code' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Confirmation code sent to your email' })
    } catch (error) {
        console.error('Delete account OTP error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
