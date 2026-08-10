/**
 * Maps between our internal payment reference and TheTeller's numeric transaction_id.
 *
 * TheTeller's transaction_id is 12 numeric digits. Our references are prefix-routed
 * strings (WAL-/DATA-/SHOP-/BOOST-/RC-/agent_upgrade_/dealer_sub_) and that prefix
 * IS the routing contract in every webhook and processor — so the two identifiers
 * coexist and this module is the only place that translates between them.
 *
 * Two storage backends, because the flows differ:
 *   • wallet_payments.provider_reference — wallet, data, boosts, upgrades, subs.
 *     Unique-indexed, so it also guarantees the id is never reused.
 *   • Redis `payswitch:ref:{transactionId}` — storefront (SHOP-) and RC- vouchers,
 *     which keep their metadata in Redis and never create a wallet_payments row.
 */
import { Redis } from '@upstash/redis'
import { generatePayswitchTransactionId } from '@/lib/payswitch-payment-service'

const redis = Redis.fromEnv()

/** Matches the 24h TTL the shop flow already uses for `shop:meta:{ref}`. */
const REF_MAP_TTL_SECONDS = 86400

function mapKey(transactionId: string): string {
    return `payswitch:ref:${transactionId}`
}

/** Postgres unique_violation — the partial unique index on provider_reference fired. */
const PG_UNIQUE_VIOLATION = '23505'

/**
 * Generates a transaction id and claims it on an existing wallet_payments row.
 *
 * The claim is the write itself: the unique index rejects a collision, so a
 * retry generates a fresh id rather than two payments sharing one gateway id
 * (which would let one callback settle the wrong payment).
 *
 * An id already on the row is reused. Retries (the `existingRef` path in the init
 * routes) must not mint a second id — the first prompt may still be sitting on the
 * customer's handset, and its callback has to stay resolvable.
 */
export async function assignPayswitchTransactionId(
    supabaseAdmin: any,
    /** Identify the row by primary key or by our internal reference — routes have one or the other. */
    match: { id?: string; reference?: string },
    attempts = 3
): Promise<{ transactionId: string | null; error?: string }> {
    const column = match.id ? 'id' : 'reference'
    const value = match.id ?? match.reference
    if (!value) return { transactionId: null, error: 'No payment identifier supplied' }

    const { data: existing } = await supabaseAdmin
        .from('wallet_payments')
        .select('provider_reference')
        .eq(column, value)
        .maybeSingle()

    const already = (existing as any)?.provider_reference
    if (already) return { transactionId: String(already) }

    for (let i = 0; i < attempts; i++) {
        const transactionId = generatePayswitchTransactionId()
        const { error } = await supabaseAdmin
            .from('wallet_payments')
            .update({ provider_reference: transactionId })
            .eq(column, value)

        if (!error) return { transactionId }

        if (error.code !== PG_UNIQUE_VIOLATION) {
            console.error('[PayswitchRef] Failed to store transaction id:', error.message)
            return { transactionId: null, error: error.message }
        }
        console.warn('[PayswitchRef] transaction_id collision, retrying:', transactionId)
    }
    return { transactionId: null, error: 'Could not allocate a unique PaySwitch transaction id' }
}

/**
 * Records the mapping for flows with no wallet_payments row (SHOP-, RC-).
 * Must be written BEFORE the prompt goes out — a fast approval can otherwise
 * beat the write and arrive at a callback that cannot resolve its reference.
 */
export async function mapPayswitchTransaction(transactionId: string, internalReference: string): Promise<void> {
    await redis.set(mapKey(transactionId), internalReference, { ex: REF_MAP_TTL_SECONDS })
}

/**
 * Resolves a callback's transaction_id back to the internal reference.
 * DB first (the common case and the durable one), Redis as the fallback.
 */
export async function resolvePayswitchReference(
    supabase: any,
    transactionId: string
): Promise<string | null> {
    const { data } = await supabase
        .from('wallet_payments')
        .select('reference')
        .eq('provider_reference', transactionId)
        .maybeSingle()

    if ((data as any)?.reference) return (data as any).reference

    const mapped = await redis.get<string>(mapKey(transactionId))
    return mapped ? String(mapped) : null
}
