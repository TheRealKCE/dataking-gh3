/**
 * Keeps a USSD order resolvable from its Paystack reference.
 *
 * Under the old Hubtel AddToCart flow this module had no reason to exist: Hubtel
 * carried the order itself and handed it back to /api/hubtel/fulfill keyed by
 * SessionId. Now that we collect the money, the webhook arrives knowing only a
 * reference, and it has to find its way back to a `hubtel_sessions` row.
 *
 * Two problems that row cannot solve alone:
 *
 *   1. It is written by `waitUntil` on the edge, off the critical path, because the
 *      confirm screen cannot afford a blocking Postgres write AND a Paystack call
 *      inside Hubtel's ~10s window. A fast approval can beat that write.
 *   2. Nothing guarantees it still exists. Sessions are deleted on timeout, on the
 *      back-out path, and after a previous fulfilment.
 *
 * So the order is mirrored into Redis, keyed by reference, before the charge goes
 * out — the same shape as `payswitch:ref:{id}` and `shop:meta:{ref}`, both of which
 * exist for the same reason. Redis is the recovery path; Postgres stays the record.
 *
 * Note there is deliberately NO wallet_payments row here. That table requires
 * user_id and wallet_id NOT NULL, and a USSD caller has neither — they never signed
 * up. hubtel_payment_logs carries the audit trail instead.
 */
import { Redis } from '@upstash/redis'

/**
 * Lazily constructed, unlike the eager client in lib/payswitch-reference.ts.
 *
 * This module is imported by app/api/hubtel/interact/route.ts, which runs on the
 * edge. Redis.fromEnv() throws when the Upstash vars are unset, and at module
 * scope that throw happens at import time - taking down every USSD session,
 * including the one that only wanted to read the master switch and hang up
 * politely. Deferring it means a misconfiguration breaks payment and nothing else.
 */
let redisClient: Redis | null = null
function getRedis(): Redis {
    if (!redisClient) redisClient = Redis.fromEnv()
    return redisClient
}

/** Matches the TTL the shop and PaySwitch reference maps already use. */
const REF_MAP_TTL_SECONDS = 86400

function mapKey(reference: string): string {
    return `ussd:ref:${reference}`
}

export interface UssdOrderSnapshot {
    sessionId: string
    /** The dialler's MSISDN — the payer, and the SMS fallback recipient. */
    mobile: string
    orderType: 'data' | 'rc'
    /** Gross GHS charged. The webhook trusts Paystack's figure over this one. */
    amount: number
    /** The trimmed session payload, enough to rebuild the row a fulfiller reads. */
    data: Record<string, unknown>
}

/**
 * Mirrors the order under its reference.
 *
 * MUST complete before the charge request goes out. A customer who approves
 * instantly can have their webhook land in under two seconds, and a webhook that
 * cannot resolve its reference has nothing to deliver.
 */
export async function putUssdOrder(reference: string, snapshot: UssdOrderSnapshot): Promise<void> {
    await getRedis().set(mapKey(reference), JSON.stringify(snapshot), { ex: REF_MAP_TTL_SECONDS })
}

/** Reads the mirror back. Returns null when the key has expired or was never written. */
export async function getUssdOrder(reference: string): Promise<UssdOrderSnapshot | null> {
    try {
        const raw = await getRedis().get<string | UssdOrderSnapshot>(mapKey(reference))
        if (!raw) return null
        // Upstash deserialises JSON payloads for us on some client versions and
        // hands back the raw string on others. Accept both.
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        return parsed?.sessionId ? (parsed as UssdOrderSnapshot) : null
    } catch (err) {
        console.error('[UssdRef] Could not read order mirror:', err)
        return null
    }
}

/**
 * Guarantees `hubtel_sessions` holds a row the existing fulfillers can read.
 *
 * fulfillUSSDRCBySession and fulfillUSSDDataBySession both start by selecting the
 * session and give up if it is missing. Rehydrating here means neither of them
 * needs to change, and neither needs to learn where the money came from.
 *
 * Returns the session id to fulfil against, or null when the order cannot be
 * recovered at all — at which point the caller must NOT report success.
 */
export async function ensureUssdSession(
    supabaseAdmin: any,
    reference: string
): Promise<{ sessionId: string; orderType: 'data' | 'rc' } | null> {
    const snapshot = await getUssdOrder(reference)

    // Whatever the mirror says, prefer a live row: it may have been updated after
    // the mirror was written.
    const sessionId = snapshot?.sessionId
    if (!sessionId) {
        console.error('[UssdRef] No mirror for reference, cannot resolve order:', reference)
        return null
    }

    const { data: existing } = await supabaseAdmin
        .from('hubtel_sessions')
        .select('session_id, data')
        .eq('session_id', sessionId)
        .maybeSingle()

    if (existing?.session_id) {
        const liveType = (existing as any)?.data?.orderType
        return { sessionId, orderType: liveType === 'data' ? 'data' : snapshot.orderType }
    }

    // Row is gone (or has not landed yet). Rebuild it from the mirror so the
    // fulfiller finds what it expects.
    console.warn('[UssdRef] Session row missing, rehydrating from mirror:', sessionId)
    const { error } = await supabaseAdmin.from('hubtel_sessions').upsert({
        session_id: sessionId,
        mobile: snapshot.mobile || '',
        current_step: 'awaiting_payment',
        data: snapshot.data,
        updated_at: new Date().toISOString(),
    })

    if (error) {
        console.error('[UssdRef] Rehydration failed:', error.message)
        return null
    }

    return { sessionId, orderType: snapshot.orderType }
}

/**
 * Builds the reference a USSD charge is booked under.
 *
 * The `USSD-` prefix is the routing contract: the Paystack webhook, the
 * reconciliation cron and flowFromReference() all switch on it. It must not collide
 * with the existing prefixes (SHOP-, RC-, DATA-, ...) — note that `USSD-RC-` does
 * NOT match `startsWith('RC-')`, which is what keeps voucher routing intact.
 */
export function buildUssdReference(orderType: 'data' | 'rc'): string {
    const kind = orderType === 'data' ? 'DATA' : 'RC'
    const stamp = Date.now().toString(36).toUpperCase()
    // crypto.randomUUID is available on the edge runtime; the slice keeps the
    // reference comfortably inside Paystack's length limit.
    const nonce = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
    return `USSD-${kind}-${stamp}-${nonce}`
}
