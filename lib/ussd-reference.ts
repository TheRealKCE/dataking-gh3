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
/**
 * Upstash over its REST API with plain fetch, rather than the @upstash/redis SDK
 * every other module here uses.
 *
 * The SDK resolves to its Node build inside the edge bundle and reaches for
 * process.version, which the Edge Runtime does not provide. The build only warns
 * - @supabase/supabase-js trips the same check on this very route and has run in
 * production for months - but this is the one write standing between a customer
 * being charged and their order being findable. Precedent is not the same as
 * certainty, and the whole client we need is two calls.
 *
 * Same two env vars the SDK reads, so nothing else about the setup changes.
 */
function restEndpoint(): { url: string; token: string } {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) {
        throw new Error('Missing env var(s): UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN')
    }
    return { url: url.replace(/\/+$/, ''), token }
}

async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    const { url, token } = restEndpoint()
    const res = await fetch(`${url}/set/${encodeURIComponent(key)}?EX=${ttlSeconds}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: value,
        signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) {
        throw new Error(`Upstash SET failed: HTTP ${res.status}`)
    }
}

async function redisGet(key: string): Promise<string | null> {
    const { url, token } = restEndpoint()
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`Upstash GET failed: HTTP ${res.status}`)
    const json: any = await res.json()
    return json?.result ?? null
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
    await redisSet(mapKey(reference), JSON.stringify(snapshot), REF_MAP_TTL_SECONDS)
}

/** Reads the mirror back. Returns null when the key has expired or was never written. */
export async function getUssdOrder(reference: string): Promise<UssdOrderSnapshot | null> {
    try {
        const raw = await redisGet(mapKey(reference))
        if (!raw) return null
        // The REST API hands back exactly the string we stored, so this is always a
        // parse. Guarded anyway: a truncated or hand-edited value must return null
        // and let the caller refuse, not throw halfway through settling a payment.
        const parsed = JSON.parse(raw)
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
