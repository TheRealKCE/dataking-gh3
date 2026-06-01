import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { sendSMS } from '@/lib/sms-service'
import { z } from 'zod'

let redis: Redis | null = null
try {
    redis = Redis.fromEnv()
} catch {
    console.error('[SendOTP] Redis init failed')
}

const otpSendLimiter = redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '15 m'), prefix: 'otp_send' })
    : null

const bodySchema = z.object({
    phone_number: z.string().min(9).max(15).optional(),
})

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore
        })

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse optional phone_number from request body
        let submittedPhone: string | undefined
        try {
            const raw = await request.json()
            const parsed = bodySchema.safeParse(raw)
            if (parsed.success) submittedPhone = parsed.data.phone_number?.trim()
        } catch {
            // No body or invalid JSON — that's fine, phone_number is optional
        }

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // If a new phone number was submitted, save it first
        if (submittedPhone) {
            // Check phone uniqueness
            const { data: existing } = await adminClient
                .from('users')
                .select('id')
                .eq('phone_number', submittedPhone)
                .neq('id', authUser.id)
                .maybeSingle()

            if (existing) {
                return NextResponse.json({ error: 'This phone number is already registered to another account.' }, { status: 409 })
            }

            // Try to update first
            const { error: updateErr, data: updatedData } = await (adminClient.from('users') as any)
                .update({ phone_number: submittedPhone })
                .eq('id', authUser.id)
                .select('id')

            // If no rows were updated (user doesn't exist in public.users), we must insert them
            if (!updateErr && (!updatedData || updatedData.length === 0)) {
                console.warn('[SendOTP] User missing from public.users, inserting now...')
                const { error: insertErr } = await (adminClient.from('users') as any)
                    .insert({
                        id: authUser.id,
                        email: authUser.email,
                        phone_number: submittedPhone,
                        phone_verified: false,
                        role: 'customer',
                        status: 'active'
                    })
                if (insertErr) console.error('[SendOTP] User insert error:', insertErr)
            } else if (updateErr) {
                console.error('[SendOTP] Phone save error:', updateErr)
            }
        }

        // Fetch phone number — try combined query first, fall back if phone_verified column missing
        let phoneNumber: string | null = null
        let alreadyVerified = false

        const { data: dbUser, error: dbErr } = await adminClient
            .from('users')
            .select('phone_number, phone_verified')
            .eq('id', authUser.id)
            .single()

        if (dbErr) {
            // phone_verified column may not exist yet — fetch phone_number only
            console.warn('[SendOTP] Combined query failed, falling back:', dbErr.message)
            const { data: phoneOnly } = await adminClient
                .from('users')
                .select('phone_number')
                .eq('id', authUser.id)
                .single()
            phoneNumber = phoneOnly?.phone_number ?? null
        } else {
            phoneNumber = dbUser?.phone_number ?? null
            alreadyVerified = dbUser?.phone_verified === true
        }

        console.log('[SendOTP] phoneNumber:', phoneNumber, 'alreadyVerified:', alreadyVerified)

        if (!phoneNumber || phoneNumber === '') {
            return NextResponse.json({ error: 'No phone number on file. Please enter your phone number first.' }, { status: 400 })
        }

        if (alreadyVerified) {
            return NextResponse.json({ error: 'Phone number is already verified.' }, { status: 400 })
        }

        // Check if we should bypass OTP for Google OAuth users
        if (authUser.app_metadata?.provider === 'google') {
            const { data: adminSetting } = await adminClient
                .from('admin_settings')
                .select('value')
                .eq('key', 'skip_google_oauth_otp')
                .single()

            if (adminSetting?.value === 'true') {
                console.log('[SendOTP] Bypassing OTP for Google user')
                const { error: bypassErr } = await (adminClient.from('users') as any)
                    .update({ phone_verified: true })
                    .eq('id', authUser.id)
                
                if (bypassErr) {
                    console.error('[SendOTP] Error marking phone verified during bypass:', bypassErr)
                }
                
                return NextResponse.json({ success: true, otpBypassed: true })
            }
        }

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
