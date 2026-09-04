/**
 * Orchestration around a Paystack MoMo charge — the part every checkout route needs
 * and none of them should own a copy of.
 *
 * Ten routes have to do the same six things before and after the charge: map the
 * network, refuse when the gateway is unconfigured, check the per-number prompt
 * ceiling, charge, record the prompt only once Paystack accepted it, and write the
 * audit row. Pasted ten times that is sixty lines of duplication in which a single
 * divergence is a payment nothing recovers, because the sweeps are scoped by what
 * the row says collected it.
 *
 * SEPARATE FROM lib/paystack-momo-service.ts ON PURPOSE. This module imports the
 * prompt limiter and the payment log, which reach Redis and (transitively) undici.
 * app/api/hubtel/interact/route.ts runs on the edge runtime and imports the service
 * directly; pulling any of this into that module would break the edge build and take
 * the USSD channel down. The service is the HTTP client, this is the Node-only layer
 * on top, and the dial-in route uses only the former.
 */

import {
    chargeMobileMoney,
    submitOtp,
    verifyTransaction,
    paystackMomoProviderFor,
    getPaystackConfigError,
    WEB_CHARGE_TIMEOUT_MS,
    type PaystackChargeOutcome,
    type PaystackChargeResult,
} from '@/lib/paystack-momo-service'
import {
    checkPaystackMomoPromptLimit,
    recordPaystackMomoPrompt,
} from '@/lib/hubtel-prompt-limit'
import { logInitiate } from '@/lib/hubtel-payment-log'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

/** Matches the Redis TTL the storefront metadata already uses. */
const PENDING_MARKER_TTL_SECONDS = 86_400

export interface MomoChargeInput {
    reference: string
    /**
     * GROSS GHS the customer is charged. Never pesewas.
     *
     * app/api/shop/initialize holds its total in pesewas while every other route
     * holds cedis, so that one caller divides by 100 before calling in. Getting it
     * wrong charges a hundred times the price and reads like a gateway bug.
     */
    amountGhs: number
    payerPhone: string
    /** Any spelling a picker emits: 'MTN' | 'Telecel' | 'AT' | 'AirtelTigo'. */
    network: string
    email?: string | null
    /**
     * Machine-shaped only — ids, slugs, phones. No display text.
     *
     * Everything here is echoed back by the webhook, and the settle paths read their
     * real metadata from the database or Redis, so there is nothing to gain by
     * shipping a shop name through a payment field and something to lose.
     */
    metadata?: Record<string, unknown>
    userId?: string | null
}

export interface MomoChargeResult {
    /** false => surface `body` at `httpStatus` and stop. */
    ok: boolean
    outcome: PaystackChargeOutcome
    /**
     * Whether the caller may mark its pending row failed.
     *
     * False on a duplicate reference and on a network throw, because both mean a
     * charge may already exist. A row stamped 'failed' can never be settled again —
     * the webhook and every processor only act on the pending -> completed
     * transition — so a wrong 'failed' here is money taken for nothing delivered.
     */
    safeToMarkFailed: boolean
    httpStatus: number
    body: Record<string, unknown>
}

function shapeSuccess(charge: PaystackChargeResult): MomoChargeResult {
    const otpRequired = charge.outcome === 'otp'
    return {
        ok: true,
        outcome: charge.outcome,
        safeToMarkFailed: false,
        httpStatus: 200,
        body: {
            success: true,
            gateway: 'paystack_momo',
            otpRequired,
            reference: charge.reference,
            message:
                charge.displayText
                ?? (otpRequired
                    ? 'Enter the one-time code sent to your phone.'
                    : 'Payment prompt sent to your phone. Please approve to continue.'),
        },
    }
}

function shapeFailure(
    charge: PaystackChargeResult,
    fallbackMessage: string
): MomoChargeResult {
    return {
        ok: false,
        outcome: 'failed',
        // A refusal Paystack actually articulated (`raw` present) is a real decline.
        // A thrown fetch (`raw === null`) never reached a verdict.
        safeToMarkFailed: charge.raw !== null,
        httpStatus: 502,
        body: { error: charge.message || fallbackMessage },
    }
}

/**
 * Starts a charge and shapes the response every route returns.
 *
 * The body deliberately matches Moolre's contract — `{ success, otpRequired,
 * reference, message }` — so the client surfaces that already branch on
 * `data.otpRequired` need no new code path.
 */
export async function startPaystackMomoCharge(
    input: MomoChargeInput
): Promise<MomoChargeResult> {
    const provider = paystackMomoProviderFor(input.network)
    if (!provider) {
        return {
            ok: false,
            outcome: 'failed',
            safeToMarkFailed: true,
            httpStatus: 400,
            body: { error: 'Unsupported payment network' },
        }
    }

    const configError = getPaystackConfigError()
    if (configError) {
        console.error('[PaystackMomo] refusing to charge:', configError)
        return {
            ok: false,
            outcome: 'failed',
            safeToMarkFailed: true,
            httpStatus: 503,
            body: { error: 'Mobile money payments are temporarily unavailable. Please try again shortly.' },
        }
    }

    const limit = await checkPaystackMomoPromptLimit(input.payerPhone)
    if (!limit.allowed) {
        return {
            ok: false,
            outcome: 'failed',
            safeToMarkFailed: true,
            httpStatus: 429,
            body: { error: limit.error || 'Too many payment prompts have been sent to this number recently.' },
        }
    }

    const charge = await chargeMobileMoney({
        reference: input.reference,
        amountGhs: input.amountGhs,
        payerMsisdn: input.payerPhone,
        provider,
        email: input.email || undefined,
        metadata: input.metadata,
        timeoutMs: WEB_CHARGE_TIMEOUT_MS,
    })

    // Only once Paystack has accepted it. A prompt that never left does not count
    // against a customer who will have to try again.
    if (charge.outcome !== 'failed') {
        await recordPaystackMomoPrompt(input.payerPhone)
    }

    await logInitiate({
        clientReference: input.reference,
        status: charge.outcome === 'failed' ? 'failed' : 'pending',
        amount: input.amountGhs,
        channel: provider,
        payerMsisdn: input.payerPhone,
        message: charge.message,
        responseCode: charge.rawStatus,
        userId: input.userId ?? null,
        raw: charge.raw,
    })

    if (charge.outcome === 'failed') {
        return shapeFailure(charge, 'The charge was declined. Please try again.')
    }
    return shapeSuccess(charge)
}

/** Finishes a charge that answered `send_otp`. Never mints a new charge. */
export async function submitPaystackMomoOtp(params: {
    reference: string
    otp: string
}): Promise<MomoChargeResult> {
    const result = await submitOtp({
        reference: params.reference,
        otp: params.otp,
        timeoutMs: WEB_CHARGE_TIMEOUT_MS,
    })

    if (result.outcome === 'failed') {
        // An OTP rejection is not a dead payment — the customer can retype the code
        // against the same charge, so the row must stay pending.
        return {
            ...shapeFailure(result, 'That code was not accepted. Please check it and try again.'),
            safeToMarkFailed: false,
            httpStatus: 400,
        }
    }
    return shapeSuccess(result)
}

/**
 * Decides what to do with a reference that already exists.
 *
 * Paystack refuses a second charge on the same reference, so a retry can never just
 * re-send. Ask the gateway what happened to the first attempt instead: 'paid' means
 * settle, 'pending' means keep waiting, and only an outright failure justifies
 * minting a new reference.
 */
export async function resolveExistingCharge(reference: string): Promise<MomoChargeResult> {
    const verified = await verifyTransaction(reference)

    if (verified.outcome === 'failed') {
        return {
            ok: false,
            outcome: 'failed',
            safeToMarkFailed: true,
            httpStatus: 502,
            body: { error: verified.message || 'That payment did not go through. Please start a new one.' },
        }
    }

    return {
        ok: true,
        outcome: verified.outcome === 'paid' ? 'paid' : 'pending',
        safeToMarkFailed: false,
        httpStatus: 200,
        body: {
            success: true,
            gateway: 'paystack_momo',
            otpRequired: false,
            reference,
            message:
                verified.outcome === 'paid'
                    ? 'Payment received.'
                    : 'Still waiting for you to approve the prompt on your phone.',
        },
    }
}

/**
 * Confirms a reference belongs to this user and is still awaiting payment.
 *
 * Without it the OTP endpoints would submit codes against a stranger's charge — the
 * references are guessable, and burning someone else's attempts is enough to break
 * their checkout.
 */
export async function assertOwnPendingPayment(
    db: any,
    reference: string,
    userId: string
): Promise<boolean> {
    if (!reference || !userId) return false
    const { data } = await db
        .from('wallet_payments')
        .select('id')
        .eq('reference', reference)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle()
    return !!data
}

/**
 * Marks a guest reference as an outstanding Paystack MoMo charge.
 *
 * The four storefront flows write no wallet_payments row, so there is no provider
 * column for the reconciliation sweep to filter on. This marker is that filter: it
 * is written before the charge, deleted by whichever of the webhook, the browser
 * poll or the sweep settles it, and — because only this rail writes it — it cannot
 * pick up a payment that belongs to another gateway even if an admin switches the
 * setting mid-flight.
 */
export async function markPaystackMomoPending(
    reference: string,
    info: { kind: 'shop' | 'rc' | 'rc_shop' | 'afa'; slug?: string }
): Promise<void> {
    try {
        await redis.set(
            `paystack_momo:pending:${reference}`,
            JSON.stringify({ ...info, at: Date.now() }),
            { ex: PENDING_MARKER_TTL_SECONDS }
        )
    } catch (e) {
        // Non-fatal: the charge still happens and the webhook still settles it. What
        // is lost is the safety net, so it is worth a loud log rather than silence.
        console.error('[PaystackMomo] could not write pending marker:', reference, e)
    }
}

export async function clearPaystackMomoPending(reference: string): Promise<void> {
    try {
        await redis.del(`paystack_momo:pending:${reference}`)
    } catch (e) {
        console.error('[PaystackMomo] could not clear pending marker:', reference, e)
    }
}
