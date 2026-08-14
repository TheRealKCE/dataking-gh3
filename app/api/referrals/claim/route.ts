import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { claimReferral, REFERRAL_COOKIE } from '@/lib/referrals'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let claimRateLimit: Ratelimit | null = null
try {
  claimRateLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:ref-claim',
  })
} catch (e) {
  console.error('[ReferralClaim] Redis init failed:', e)
}

/**
 * POST /api/referrals/claim
 *
 * Attributes the authenticated user to a referrer. Body: { code? } — falls back
 * to the arhms_ref cookie that middleware stashed on link click.
 *
 * Idempotent (referrals.referred_user_id is UNIQUE), so all four signup paths
 * can call it without coordinating: the email/password page, the OAuth callback,
 * the dashboard mount effect, and a manual code entry.
 *
 * Clears the cookie on any settled outcome so a stale code cannot follow the
 * user around for 30 days.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createRouteHandlerClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      if (claimRateLimit) {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const { success } = await claimRateLimit.limit(`claim:${ip}`)
        if (!success) {
          return NextResponse.json(
            { error: 'Too many attempts. Try again later.' },
            { status: 429 }
          )
        }
      }
    } catch (rlErr) {
      console.warn('[ReferralClaim] Rate limit check failed:', rlErr)
    }

    let bodyCode: string | null = null
    try {
      const body = await request.json()
      bodyCode = body?.code ? String(body.code) : null
    } catch {
      // No body is fine — the cookie is the normal path.
    }

    const cookieCode = request.cookies.get(REFERRAL_COOKIE)?.value || null
    const code = bodyCode || cookieCode

    if (!code) {
      return NextResponse.json({ success: false, reason: 'no_code' })
    }

    const supabase: any = createServerClient()
    const result = await claimReferral({
      db: supabase,
      userId: user.id,
      code,
      source: bodyCode ? 'manual' : 'link',
      ip: request.headers.get('x-forwarded-for'),
    })

    const response = NextResponse.json({
      success: result.ok,
      alreadyClaimed: !!result.alreadyClaimed,
      flagged: !!result.flagged,
      reason: result.reason || null,
      referrerName: result.referrerName || null,
    })

    // Settled either way — a code that was rejected should not be retried
    // forever. Only a transient insert failure keeps the cookie.
    if (result.ok || result.reason !== 'insert_failed') {
      response.cookies.set(REFERRAL_COOKIE, '', { path: '/', maxAge: 0 })
    }

    return response
  } catch (err: any) {
    console.error('[ReferralClaim] Critical error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
