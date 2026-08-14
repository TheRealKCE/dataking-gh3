/**
 * Referral bonus reads, and the admin reconcile wrapper.
 *
 * The bonus MATH lives entirely in SQL (pay_referral_bonus, see
 * supabase/migrations/20260813_referral_bonuses.sql). Nothing in this file
 * computes money — it reads what SQL already decided. Keeping the arithmetic in
 * one place is what makes the "exactly once, never more than half the margin"
 * guarantee auditable.
 */

import { buildReferralUrl } from './referrals'

export interface ReferralSummary {
    code: string | null
    shareUrl: string | null
    referredCount: number
    activeCount: number
    /** Net of any refund clawbacks. */
    totalEarned: number
    bonusCount: number
    /** False when an admin has paused the programme; existing balances are untouched. */
    enabled: boolean
    /** Advertised rate. Shown to users as "up to X%" — the margin cap can reduce it. */
    percentOfSale: number
}

export interface ReferredUser {
    id: string
    /** "Kwame A." — never the email or phone. */
    name: string
    joinedAt: string
    status: string
    /** Orders of theirs that actually paid you a bonus. */
    earningOrders: number
    earned: number
}

export interface BonusRow {
    id: string
    createdAt: string
    orderReference: string
    amount: number
    reversed: boolean
    reversedAmount: number | null
}

function displayNameOf(firstName?: string | null, lastName?: string | null): string {
    const first = String(firstName || '').trim()
    const last = String(lastName || '').trim()
    if (!first && !last) return 'An Arhms user'
    const initial = last ? ` ${last[0].toUpperCase()}.` : ''
    return `${first}${initial}`.trim()
}

async function readSetting(db: any, key: string, fallback: string): Promise<string> {
    try {
        const { data } = await db.from('admin_settings').select('value').eq('key', key).maybeSingle()
        if (!data) return fallback
        const v = (data as any).value
        return typeof v === 'string' ? v : String(v ?? fallback)
    } catch {
        return fallback
    }
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/**
 * Net earnings for a referrer.
 *
 * Summed in TS rather than SQL: PostgREST aggregate support is version-dependent
 * and a per-user bonus count stays small for the foreseeable life of the
 * programme. If it ever stops being small, this is the thing to move into an RPC.
 */
function netEarned(rows: Array<{ bonus_amount: any; reversed_amount: any }>): number {
    const total = rows.reduce((sum, r) => sum + num(r.bonus_amount) - num(r.reversed_amount), 0)
    return Math.round(total * 100) / 100
}

/** @param db A service-role client — both referral tables are RLS-closed to clients. */
export async function getReferralSummary(db: any, userId: string, origin?: string | null): Promise<ReferralSummary> {
    const [{ data: me }, enabledRaw, percentRaw] = await Promise.all([
        db.from('users').select('referral_code').eq('id', userId).maybeSingle(),
        readSetting(db, 'referral_bonus_enabled', 'false'),
        readSetting(db, 'referral_bonus_percent_of_sale', '5'),
    ])

    const code = (me as any)?.referral_code || null

    const [{ data: refs }, { data: bonuses }] = await Promise.all([
        db.from('referrals').select('id, status').eq('referrer_id', userId),
        db.from('referral_bonuses').select('bonus_amount, reversed_amount').eq('referrer_id', userId),
    ])

    const refRows = (refs as any[]) || []
    const bonusRows = (bonuses as any[]) || []

    return {
        code,
        shareUrl: code ? buildReferralUrl(code, origin) : null,
        referredCount: refRows.length,
        activeCount: refRows.filter((r) => r.status === 'active').length,
        totalEarned: netEarned(bonusRows),
        bonusCount: bonusRows.length,
        enabled: enabledRaw === 'true',
        percentOfSale: num(percentRaw),
    }
}

/**
 * The people this user referred, with what each has actually earned them.
 *
 * Two queries, not N+1: bonuses are fetched once for the whole referrer and
 * grouped in memory by referred_user_id.
 */
export async function listReferredUsers(db: any, userId: string, limit = 100): Promise<ReferredUser[]> {
    const { data: refs } = await db
        .from('referrals')
        .select('referred_user_id, status, claimed_at, users!referrals_referred_user_id_fkey(first_name, last_name)')
        .eq('referrer_id', userId)
        .order('claimed_at', { ascending: false })
        .limit(limit)

    const rows = (refs as any[]) || []
    if (rows.length === 0) return []

    const { data: bonuses } = await db
        .from('referral_bonuses')
        .select('referred_user_id, bonus_amount, reversed_amount')
        .eq('referrer_id', userId)

    const byUser = new Map<string, Array<{ bonus_amount: any; reversed_amount: any }>>()
    for (const b of ((bonuses as any[]) || [])) {
        const list = byUser.get(b.referred_user_id) || []
        list.push(b)
        byUser.set(b.referred_user_id, list)
    }

    return rows.map((r) => {
        const theirs = byUser.get(r.referred_user_id) || []
        return {
            id: r.referred_user_id,
            name: displayNameOf(r.users?.first_name, r.users?.last_name),
            joinedAt: r.claimed_at,
            status: r.status,
            earningOrders: theirs.length,
            earned: netEarned(theirs),
        }
    })
}

/**
 * Bonus history.
 *
 * Deliberately omits platform_margin, rate_percent and uncapped_bonus — those are
 * internal cost figures and must not reach the user-facing page.
 */
export async function listBonusHistory(
    db: any,
    userId: string,
    limit = 20,
    offset = 0
): Promise<BonusRow[]> {
    const { data } = await db
        .from('referral_bonuses')
        .select('id, created_at, order_reference, bonus_amount, reversed_at, reversed_amount')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    return ((data as any[]) || []).map((b) => ({
        id: b.id,
        createdAt: b.created_at,
        orderReference: b.order_reference,
        amount: num(b.bonus_amount),
        reversed: !!b.reversed_at,
        reversedAmount: b.reversed_amount === null ? null : num(b.reversed_amount),
    }))
}

/**
 * Safety net for anything the payout trigger's EXCEPTION handler swallowed.
 *
 * @param db MUST be a service-role client — the RPC hard-requires a service_role JWT.
 */
export async function reconcileReferralBonuses(
    db: any,
    limit = 500
): Promise<{ examined: number; credited: number }> {
    const { data, error } = await db.rpc('reconcile_referral_bonuses', { p_limit: limit })
    if (error) {
        console.error('[ReferralBonus] reconcile failed:', error)
        throw new Error(error.message || 'Reconcile failed')
    }
    return {
        examined: num((data as any)?.examined),
        credited: num((data as any)?.credited),
    }
}

/**
 * How often the margin cap engages, as a share of all bonuses paid.
 *
 * This is the number that tells admin whether the advertised rate is honest: if
 * the cap fires on most orders, users are being promised a rate the system
 * routinely does not pay, and the fix is to LOWER the advertised rate — not to
 * widen the cap, which is what keeps the platform net-positive.
 */
export async function getCapEngagementStats(
    db: any
): Promise<{ total: number; capped: number; cappedPct: number }> {
    const { data } = await db.from('referral_bonuses').select('bonus_amount, uncapped_bonus')
    const rows = (data as any[]) || []
    const capped = rows.filter((r) => num(r.bonus_amount) < num(r.uncapped_bonus)).length
    return {
        total: rows.length,
        capped,
        cappedPct: rows.length ? Math.round((capped / rows.length) * 1000) / 10 : 0,
    }
}
