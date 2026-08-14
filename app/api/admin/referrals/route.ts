import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { reconcileReferralBonuses, getCapEngagementStats } from '@/lib/referral-bonus'

/**
 * Admin referral management.
 *
 *   GET   — list referrals (+ cap-engagement stats and month-to-date payout)
 *   PATCH — flip a referral's status between active / flagged / blocked
 *   POST  — { action: 'reconcile' } to sweep up unpaid-but-owed bonuses
 *
 * Reads allow admin and sub-admin; mutations require admin, because both of them
 * move or unblock real money.
 */
async function requireAdmin(request: NextRequest, mutating: boolean) {
  const supabaseAuth = await createRouteHandlerClient()
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase: any = createServerClient()
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = (me as any)?.role

  const allowed = mutating ? ['admin'] : ['admin', 'sub-admin']
  if (!role || !allowed.includes(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, supabase }
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireAdmin(request, false)
    if ('error' in gate) return gate.error
    const { supabase } = gate

    const status = request.nextUrl.searchParams.get('status')
    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '100', 10) || 100, 1), 500)

    let query = supabase
      .from('referrals')
      .select(`
        id, code_used, status, flag_reason, source, claimed_at, reviewed_at,
        referrer_id, referred_user_id,
        referrer:users!referrals_referrer_id_fkey(first_name, last_name, email),
        referred:users!referrals_referred_user_id_fkey(first_name, last_name, email)
      `)
      .order('claimed_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)

    const { data: referrals, error } = await query
    if (error) {
      console.error('[AdminReferrals GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 })
    }

    // Lifetime paid per referral, plus month-to-date total.
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [{ data: bonuses }, capStats] = await Promise.all([
      supabase
        .from('referral_bonuses')
        .select('referral_id, bonus_amount, reversed_amount, created_at'),
      getCapEngagementStats(supabase),
    ])

    const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    const paidByReferral = new Map<string, number>()
    let monthToDate = 0

    for (const b of ((bonuses as any[]) || [])) {
      const net = num(b.bonus_amount) - num(b.reversed_amount)
      paidByReferral.set(b.referral_id, (paidByReferral.get(b.referral_id) || 0) + net)
      if (new Date(b.created_at) >= monthStart) monthToDate += net
    }

    const rows = ((referrals as any[]) || []).map((r) => ({
      id: r.id,
      codeUsed: r.code_used,
      status: r.status,
      flagReason: r.flag_reason,
      source: r.source,
      claimedAt: r.claimed_at,
      reviewedAt: r.reviewed_at,
      referrer: {
        id: r.referrer_id,
        name: `${r.referrer?.first_name || ''} ${r.referrer?.last_name || ''}`.trim() || '(unnamed)',
        email: r.referrer?.email || null,
      },
      referred: {
        id: r.referred_user_id,
        name: `${r.referred?.first_name || ''} ${r.referred?.last_name || ''}`.trim() || '(unnamed)',
        email: r.referred?.email || null,
      },
      lifetimePaid: Math.round((paidByReferral.get(r.id) || 0) * 100) / 100,
    }))

    return NextResponse.json({
      success: true,
      referrals: rows,
      stats: {
        monthToDate: Math.round(monthToDate * 100) / 100,
        // If cappedPct is high the advertised rate is dishonest and should be
        // LOWERED — widening the cap is what breaks the net-positive invariant.
        ...capStats,
      },
    })
  } catch (err: any) {
    console.error('[AdminReferrals GET] Critical error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireAdmin(request, true)
    if ('error' in gate) return gate.error
    const { user, supabase } = gate

    const body = await request.json()
    const id = String(body?.id || '')
    const status = String(body?.status || '')

    if (!id || !['active', 'flagged', 'blocked'].includes(status)) {
      return NextResponse.json({ error: 'Invalid id or status' }, { status: 400 })
    }

    const { error } = await supabase
      .from('referrals')
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('[AdminReferrals PATCH] Error:', error)
      return NextResponse.json({ error: 'Failed to update referral' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[AdminReferrals PATCH] Critical error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdmin(request, true)
    if ('error' in gate) return gate.error
    const { supabase } = gate

    const body = await request.json().catch(() => ({}))
    if (body?.action !== 'reconcile') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const result = await reconcileReferralBonuses(supabase, 500)
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error('[AdminReferrals POST] Critical error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
