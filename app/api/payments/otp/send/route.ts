import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { createPaymentOtp, normalizeMsisdn } from '@/lib/payment-otp'
import { sendSMS } from '@/lib/sms-service'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// 3 sends per user+number per 15 min.
const otpSendLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(3, '15 m'),
    prefix: 'rl:pay-otp-send',
})

/**
 * POST /api/payments/otp/send   Body: { phone }
 *
 * Hubtel Option 2: sends a 6-digit code so a logged-in user can confirm a number
 * that is not their registered one, before any payment prompt is initiated.
 * The registered number needs no OTP (covered by Option 1).
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

        const msisdn = normalizeMsisdn(body?.phone || '')
        if (!msisdn) {
            return NextResponse.json({ error: 'Enter a valid Ghana phone number.' }, { status: 400 })
        }

        // Registered number → no OTP needed (Option 1 already covers it).
        const admin = createServerClient()
        const { data: profile } = await (admin.from('users') as any)
            .select('phone_number')
            .eq('id', userId)
            .single()
        const registered = normalizeMsisdn((profile as any)?.phone_number || '')
        if (registered && registered === msisdn) {
            return NextResponse.json({
                success: true,
                alreadyRegistered: true,
                message: 'This is your registered number — no verification needed.',
            })
        }

        try {
            const { success } = await otpSendLimit.limit(`${userId}:${msisdn}`)
            if (!success) {
                return NextResponse.json(
                    { error: 'Too many code requests. Please wait a few minutes and try again.' },
                    { status: 429 }
                )
            }
        } catch (e) {
            console.error('[PayOtpSend] rate-limit error, continuing:', e)
        }

        const otp = await createPaymentOtp(userId, msisdn)
        if (!otp.ok || !otp.code) {
            return NextResponse.json({ error: otp.error || 'Could not generate a code.' }, { status: 400 })
        }

        const sms = await sendSMS({
            recipient: msisdn,
            message: `Your ARHMS payment verification code is ${otp.code}. It expires in 5 minutes. Do not share it with anyone.`,
        })

        if (!sms.success) {
            console.error('[PayOtpSend] SMS failed:', sms.error)
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
        console.error('[PayOtpSend] error:', e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
