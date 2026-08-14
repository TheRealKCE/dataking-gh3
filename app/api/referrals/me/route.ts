import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import {
  getReferralSummary,
  listReferredUsers,
  listBonusHistory,
} from '@/lib/referral-bonus'

/**
 * GET /api/referrals/me?limit=20&offset=0
 *
 * Everything /dashboard/refer renders: the user's code and share link, their
 * referred-user list, and a page of bonus history.
 *
 * Reads via the service-role client because referrals and referral_bonuses are
 * RLS-closed to clients (they hold money, so no client SELECT policy exists and
 * nobody can enumerate who referred whom). Scoping every query to the
 * authenticated user's id is therefore this route's responsibility.
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createRouteHandlerClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const offset = Math.max(parseInt(request.nextUrl.searchParams.get('offset') || '0', 10) || 0, 0)

    const supabase: any = createServerClient()

    const [summary, referred, bonuses] = await Promise.all([
      getReferralSummary(supabase, user.id, request.nextUrl.origin),
      listReferredUsers(supabase, user.id),
      listBonusHistory(supabase, user.id, limit, offset),
    ])

    return NextResponse.json({
      success: true,
      summary,
      referred,
      bonuses,
      hasMore: bonuses.length === limit,
    })
  } catch (err: any) {
    console.error('[ReferralsMe] Critical error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
