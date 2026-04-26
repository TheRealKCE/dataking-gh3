import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const otpRateLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(3, '10 m'), // 3 requests per 10 minutes
    prefix: 'rl:delete-otp',
})

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser || !authUser.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { success: rateLimitOk } = await otpRateLimit.limit(authUser.id)
        if (!rateLimitOk) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
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
