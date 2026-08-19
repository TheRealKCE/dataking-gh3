import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { resolveReferralCode } from '@/lib/referrals'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let resolveRateLimit: Ratelimit | null = null
try {
  resolveRateLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    prefix: 'rl:ref-resolve',
  })
} catch (e) {
  console.error('[ReferralResolve] Redis init failed:', e)
}

/**
 * GET /api/referrals/resolve?code=KWAME7F2Q
 *
 * Public: the signup page calls it before an account exists, to render
 * "Referred by Kwame A.".
 *
 * Returns a first name plus last initial and NOTHING else — never the email,
 * phone or user id. Rate-limited so the endpoint cannot be used to enumerate
 * codes and harvest names. Fails open on Redis errors, matching the other
 * limiters in this app.
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.json({ success: true, valid: false })
    }

    try {
      if (resolveRateLimit) {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const { success } = await resolveRateLimit.limit(`resolve:${ip}`)
        if (!success) {
          return NextResponse.json(
            { error: 'Too many attempts. Try again shortly.' },
            { status: 429 }
          )
        }
      }
    } catch (rlErr) {
      console.warn('[ReferralResolve] Rate limit check failed:', rlErr)
    }

    const supabase: any = createServerClient()
    const resolved = await resolveReferralCode(supabase, code)

    // referrerId is intentionally not returned.
    return NextResponse.json({
      success: true,
      valid: resolved.valid,
      referrerName: resolved.valid ? resolved.displayName : null,
    })
  } catch (err: any) {
    console.error('[ReferralResolve] Critical error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
