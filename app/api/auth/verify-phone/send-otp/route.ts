import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { sendSMS } from '@/lib/sms-service'

let redis: Redis | null = null
try {
    redis = Redis.fromEnv()
} catch {
    console.error('[SendOTP] Redis init failed')
}

const otpSendLimiter = redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '15 m'), prefix: 'otp_send' })
    : null

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: dbUser } = await adminClient
            .from('users')
            .select('phone_number, phone_verified')
            .eq('id', authUser.id)
            .single()

        if (!dbUser?.phone_number || dbUser.phone_number === '') {
            return NextResponse.json({ error: 'No phone number on file. Please complete your profile first.' }, { status: 400 })
        }

        if (dbUser.phone_verified) {
            return NextResponse.json({ error: 'Phone number is already verified.' }, { status: 400 })
        }

        const phoneNumber = dbUser.phone_number

        if (otpSendLimiter) {
            const { success, reset } = await otpSendLimiter.limit(`phone:${phoneNumber}`)
            if (!success) {
                const retryAfter = Math.ceil((reset - Date.now()) / 1000)
                return NextResponse.json(
                    { error: 'Too many OTP requests. Please wait 15 minutes before trying again.' },
                    { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
                )
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString()

        if (redis) {
            await redis.set(`otp:${authUser.id}`, otp, { ex: 300 })
        }

        const smsResult = await sendSMS({
            recipient: phoneNumber,
            message: `Your ARHMS verification code is: ${otp}\n\nValid for 5 minutes. Do not share this code.\n\nARHMSGh`,
        })

        if (!smsResult.success) {
            console.error('[SendOTP] SMS delivery failed:', smsResult.error)
            return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'OTP sent successfully' })
    } catch (e) {
        console.error('[SendOTP] Error:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
