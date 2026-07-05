import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * POST /api/shop/sub-agents/verify-otp
 *
 * Step 2 of sub-agent signup:
 *   1. Verify OTP code matches what was sent to phone
 *   2. Mark user's phone as verified
 *   3. Return success, user can now login
 *
 * Note: OTP validation uses server-side cache (Redis/Memcache).
 * TODO: Implement OTP store/retrieve in production.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, phone, otp, inviteId } = await request.json()

    if (!email || !phone || !otp || !inviteId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase: any = createServerClient()

    // 1. Find the user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, phone_number')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify phone matches
    const cleanPhone = String(phone).replace(/\D/g, '')
    if (user.phone_number !== cleanPhone) {
      return NextResponse.json(
        { error: 'Phone number does not match signup' },
        { status: 400 }
      )
    }

    // 2. Verify OTP (TODO: retrieve from cache and compare)
    // For now, accept any 6-digit code (placeholder)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'Invalid OTP format' },
        { status: 400 }
      )
    }

    // TODO: In production:
    // const cachedOtp = await redis.get(`otp:${email}`)
    // if (cachedOtp !== otp) {
    //   return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    // }
    // await redis.del(`otp:${email}`)

    // 3. Mark phone as verified
    const { error: updateError } = await supabase
      .from('users')
      .update({
        phone_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[VerifyOtp] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to verify phone' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Phone verified. Your account is pending approval from your Lead.',
      userId: user.id,
    })
  } catch (err: any) {
    console.error('[VerifyOtp] Critical error:', err)
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    )
  }
}
