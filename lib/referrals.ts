/**
 * Referral attribution — resolving a code, and claiming it for a new user.
 *
 * Attribution is deliberately a separate, explicit step rather than something
 * `handle_new_user()` does. Three reasons:
 *
 *   1. Google OAuth metadata carries no `ref` field at all, so a trigger-based
 *      capture would cover only half the signups.
 *   2. Two competing versions of handle_new_user() exist (supabase/triggers.sql
 *      and 20260531_add_phone_verified_google_auth.sql) and nobody knows which is
 *      live — editing one risks a silent no-op.
 *   3. Email/password signup can return NO session (the "Check Your Email"
 *      branch), so attribution has to be able to happen later than row creation.
 *
 * The claim is idempotent — referrals.referred_user_id is UNIQUE — so every
 * signup path can call it without coordinating, and calling it five times is
 * harmless.
 *
 * Money never flows through here. Bonuses are computed and credited entirely in
 * SQL by pay_referral_bonus(); see supabase/migrations/20260813_referral_bonuses.sql.
 */

import { createHash } from 'crypto'

/** Cookie the middleware stashes `?ref=` into so it survives OAuth and guards. */
export const REFERRAL_COOKIE = 'arhms_ref'

/** Codes are minted as <letters><unambiguous tail>; keep validation loose but bounded. */
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{5,24}$/

export interface ResolvedReferrer {
    valid: boolean
    referrerId?: string
    /** "Kwame A." — first name plus last initial. Never the email or phone. */
    displayName?: string
}

export interface ClaimResult {
    ok: boolean
    /** True when this user already had a referral row; not an error. */
    alreadyClaimed?: boolean
    /** Attributed but earning nothing until an admin clears it. */
    flagged?: boolean
    reason?: string
    referrerName?: string
}

/** Public-safe display name: first name + last initial. */
function displayNameOf(firstName?: string | null, lastName?: string | null): string {
    const first = String(firstName || '').trim()
    const last = String(lastName || '').trim()
    if (!first && !last) return 'an Arhms user'
    const initial = last ? ` ${last[0].toUpperCase()}.` : ''
    return `${first}${initial}`.trim()
}

/**
 * Fold the aliases that let one person hold two "different" addresses:
 * strip anything after `+`, and for Gmail strip dots from the local part.
 * `Kwa.me+2@Gmail.com` and `kwame@gmail.com` normalize to the same string.
 */
function normalizeEmail(address?: string | null): string {
    const raw = String(address || '').trim().toLowerCase()
    const at = raw.lastIndexOf('@')
    if (at < 1) return raw
    let local = raw.slice(0, at)
    const domain = raw.slice(at + 1)
    local = local.split('+')[0]
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
        local = local.replace(/\./g, '')
    }
    return `${local}@${domain}`
}

/**
 * Hash the claim IP so collusion clusters are detectable without ever storing a
 * raw IP. Salted from the environment; falls back to the service-role key as key
 * material (server-only, always present) so the hash is never unsalted.
 */
function hashIp(ip?: string | null): string | null {
    const clean = String(ip || '').split(',')[0].trim()
    if (!clean || clean === 'unknown') return null
    const salt =
        process.env.REFERRAL_IP_SALT ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        'arhms-referral-dev-salt'
    return createHash('sha256').update(`${salt}:${clean}`).digest('hex')
}

/** Reads a string setting out of the JSONB admin_settings table. */
async function readSetting(db: any, key: string, fallback: string): Promise<string> {
    try {
        const { data } = await db.from('admin_settings').select('value').eq('key', key).maybeSingle()
        if (!data) return fallback
        const v = (data as any).value
        // value is JSONB; every consumer in this app compares it as a string.
        return typeof v === 'string' ? v : String(v ?? fallback)
    } catch {
        return fallback
    }
}

/**
 * Builds the shareable link.
 *
 * Uses the three-level fallback established in app/api/shop/invites/route.ts so
 * the link is never rendered as "undefined/r/...".
 */
export function buildReferralUrl(code: string, origin?: string | null): string {
    const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        origin ||
        ''
    return `${String(base).replace(/\/$/, '')}/r/${code}`
}

/**
 * Looks up a referral code.
 *
 * @param db A service-role client — users.referral_code is not client-readable.
 */
export async function resolveReferralCode(db: any, code?: string | null): Promise<ResolvedReferrer> {
    const clean = String(code || '').trim().toUpperCase()
    if (!clean || !REFERRAL_CODE_PATTERN.test(clean)) return { valid: false }

    const { data, error } = await db
        .from('users')
        .select('id, first_name, last_name, status')
        .eq('referral_code', clean)
        .maybeSingle()

    if (error || !data) return { valid: false }
    // A suspended referrer's code stops working rather than silently earning.
    if ((data as any).status && (data as any).status !== 'active') return { valid: false }

    return {
        valid: true,
        referrerId: (data as any).id,
        displayName: displayNameOf((data as any).first_name, (data as any).last_name),
    }
}

/**
 * Attributes `userId` to the owner of `code`.
 *
 * Abuse signals set status='flagged' — attributed, earning nothing, visible to
 * an admin — rather than a hard error an abuser can iterate against. Only the
 * genuinely impossible cases (self-referral, unknown code) are refused outright.
 */
export async function claimReferral(args: {
    db: any
    userId: string
    code?: string | null
    source?: 'link' | 'manual' | 'oauth'
    ip?: string | null
}): Promise<ClaimResult> {
    const { db, userId, code, ip } = args
    const source = args.source || 'link'

    if (!userId) return { ok: false, reason: 'not_authenticated' }

    const clean = String(code || '').trim().toUpperCase()
    if (!clean) return { ok: false, reason: 'no_code' }

    // Already attributed? referred_user_id is UNIQUE, so this is the idempotent path.
    const { data: existing } = await db
        .from('referrals')
        .select('id, referrer_id, status')
        .eq('referred_user_id', userId)
        .maybeSingle()
    if (existing) {
        return { ok: true, alreadyClaimed: true, flagged: (existing as any).status !== 'active' }
    }

    const resolved = await resolveReferralCode(db, clean)
    if (!resolved.valid || !resolved.referrerId) {
        return { ok: false, reason: 'invalid_code' }
    }

    // Self-referral. Also enforced by the referrals_no_self CHECK.
    if (resolved.referrerId === userId) {
        return { ok: false, reason: 'self_referral' }
    }

    const { data: me } = await db
        .from('users')
        .select('email, phone_number, status')
        .eq('id', userId)
        .maybeSingle()

    if (!me) return { ok: false, reason: 'user_not_found' }
    if ((me as any).status && (me as any).status !== 'active') {
        return { ok: false, reason: 'account_not_active' }
    }

    let flagReason: string | null = null

    // --- Email aliasing: one human holding two "different" addresses. ---
    const { data: referrer } = await db
        .from('users')
        .select('email')
        .eq('id', resolved.referrerId)
        .maybeSingle()
    if (referrer && normalizeEmail((referrer as any).email) === normalizeEmail((me as any).email)) {
        flagReason = 'email_alias_match'
    }

    // --- Blacklisted phone: the same table that already gates purchases. ---
    if (!flagReason && (me as any).phone_number) {
        try {
            const { data: blocked } = await db
                .from('phone_blacklist')
                .select('id')
                .eq('phone_number', (me as any).phone_number)
                .maybeSingle()
            if (blocked) flagReason = 'phone_blacklisted'
        } catch {
            // Absent or unreadable blacklist must not block attribution.
        }
    }

    const ipHash = hashIp(ip)

    // --- IP collusion: farming accounts from one handset. ---
    if (!flagReason && ipHash) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { count } = await db
            .from('referrals')
            .select('id', { count: 'exact', head: true })
            .eq('claim_ip_hash', ipHash)
            .gte('claimed_at', since)
        if ((count || 0) >= 3) flagReason = 'ip_cluster'

        if (!flagReason) {
            const { data: referrerClaim } = await db
                .from('referrals')
                .select('claim_ip_hash')
                .eq('referred_user_id', resolved.referrerId)
                .maybeSingle()
            if (referrerClaim && (referrerClaim as any).claim_ip_hash === ipHash) {
                flagReason = 'ip_match_referrer'
            }
        }
    }

    // --- Volume: caps SIGNUPS per referrer, never bonuses. ---
    if (!flagReason) {
        const maxPerDay = parseInt(await readSetting(db, 'referral_max_claims_per_day', '25'), 10)
        if (Number.isFinite(maxPerDay) && maxPerDay > 0) {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            const { count } = await db
                .from('referrals')
                .select('id', { count: 'exact', head: true })
                .eq('referrer_id', resolved.referrerId)
                .gte('claimed_at', since)
            if ((count || 0) >= maxPerDay) flagReason = 'referrer_daily_cap'
        }
    }

    const { error: insertError } = await db.from('referrals').insert({
        referrer_id: resolved.referrerId,
        referred_user_id: userId,
        code_used: clean,
        status: flagReason ? 'flagged' : 'active',
        flag_reason: flagReason,
        source,
        claim_ip_hash: ipHash,
    })

    if (insertError) {
        // Unique violation: another request won the race. Idempotent, not an error.
        const msg = String((insertError as any).message || '').toLowerCase()
        if (msg.includes('duplicate') || msg.includes('unique')) {
            return { ok: true, alreadyClaimed: true }
        }
        console.error('[Referrals] claim insert failed:', insertError)
        return { ok: false, reason: 'insert_failed' }
    }

    if (flagReason) {
        // Best-effort only: security_events has a call site but no CREATE TABLE
        // anywhere in the repo, so nothing may depend on this write.
        try {
            await db.from('security_events').insert({
                event_type: 'referral_flagged',
                severity: 'warning',
                details: { referrer_id: resolved.referrerId, referred_user_id: userId, reason: flagReason },
            })
        } catch {
            /* ignore */
        }
    }

    return {
        ok: true,
        flagged: !!flagReason,
        reason: flagReason || undefined,
        referrerName: resolved.displayName,
    }
}
