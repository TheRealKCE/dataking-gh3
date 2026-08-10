/**
 * PaySwitch (TheTeller) Payment Service
 *
 * Direct Mobile Money collections via TheTeller API.
 * Docs: POST /v1.1/transaction/process — processing_code "000200" is MoMo debit.
 *
 * Uses:
 *   PAYSWITCH_MERCHANT_ID  — merchant id from the PaySwitch dashboard
 *   PAYSWITCH_API_USER     — API username (Basic auth user)
 *   PAYSWITCH_API_KEY      — API key (Basic auth password)
 *   PAYSWITCH_BASE_URL     — https://prod.theteller.net (default) | https://test.theteller.net
 *   FIXIE_URL              — shared static proxy, if PaySwitch whitelists our IP
 *
 * Auth: Basic base64(PAYSWITCH_API_USER:PAYSWITCH_API_KEY)
 *
 * NOTE ON REFERENCES: TheTeller's transaction_id is 12 NUMERIC digits. Our internal
 * references are prefix-routed strings (WAL-/DATA-/SHOP-/BOOST-/RC-/agent_upgrade_)
 * and cannot be reshaped without breaking every webhook router. So a PaySwitch
 * payment carries both: the internal `reference` stays authoritative, and the
 * numeric transaction_id is stored alongside it in wallet_payments.provider_reference.
 */
import { getDispatcher, isUsingStaticProxy } from '@/lib/http-dispatcher'
import { randomInt } from 'crypto'

const DEFAULT_BASE_URL = 'https://prod.theteller.net'

function getBaseUrl(): string {
    return (process.env.PAYSWITCH_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

/** MoMo debit. Distinct from 404000, which is a transfer OUT to a wallet. */
const PROCESSING_CODE_DEBIT = '000200'

/**
 * Maps our internal network label to TheTeller's `r-switch` code.
 * Keys must match MOOLRE_PAYMENT_CHANNEL_MAP / HUBTEL_CHANNEL_MAP exactly —
 * the init routes look the network up in whichever map the active provider uses.
 *
 * AirtelTigo: TheTeller documents both "ATL" (Airtel) and "TGO" (Tigo) from before
 * the merger. PAYSWITCH_AT_SWITCH lets us flip without a redeploy if "ATL" turns
 * out to be the wrong one for our merchant account — see the plan's go-live note.
 */
export const PAYSWITCH_CHANNEL_MAP: Record<string, string> = {
    'MTN': 'MTN',
    'Telecel': 'VDF',
    'AT': process.env.PAYSWITCH_AT_SWITCH || 'ATL',
}

export interface PayswitchInitiateParams {
    /** Amount in GHS (e.g. 10.00) */
    amount: number
    /** Payer phone, any local/international format */
    payerPhone: string
    /** Internal network label: 'MTN' | 'Telecel' | 'AT' */
    network: string
    /** 12-digit numeric id from generatePayswitchTransactionId() */
    transactionId: string
    /** Narration shown to the customer */
    description?: string
}

/** Normalised outcome shared by initiate and status, so they can never disagree. */
export type PayswitchOutcome = 'paid' | 'pending' | 'failed'

export interface PayswitchInitiateResult {
    success: boolean
    outcome?: PayswitchOutcome
    /** TheTeller response code, e.g. "000" */
    code?: string
    status?: string
    error?: string
    raw?: unknown
}

export interface PayswitchStatusResult {
    success: boolean
    outcome: PayswitchOutcome | null
    code?: string
    status?: string
    /** Amount in GHS as reported by PaySwitch, when present */
    amount?: number
    error?: string
    raw?: unknown
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMerchantId(): string {
    const id = process.env.PAYSWITCH_MERCHANT_ID
    if (!id) throw new Error('[PayswitchPayment] PAYSWITCH_MERCHANT_ID is not configured.')
    return id
}

/** Basic auth header for the PaySwitch API. */
export function getPayswitchAuthHeader(): string {
    const user = process.env.PAYSWITCH_API_USER
    const key = process.env.PAYSWITCH_API_KEY
    if (!user || !key) {
        throw new Error('[PayswitchPayment] PAYSWITCH_API_USER or PAYSWITCH_API_KEY is not configured.')
    }
    return `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}`
}

/**
 * Shared request headers.
 *
 * `Merchant-Id` is NOT in TheTeller's published request-header list, but the status
 * endpoint rejects the call without it:
 *   {"status":"failed","code":999,"reason":"Header: Merchant-Id is not set"}
 * Confirmed against the sandbox. Without this header every status check fails,
 * which would take out the webhook re-query, the client poll and the
 * reconciliation cron all at once — i.e. nothing would ever settle.
 */
function getHeaders(): Record<string, string> {
    return {
        Authorization: getPayswitchAuthHeader(),
        'Merchant-Id': getMerchantId(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
    }
}

/**
 * Normalises a Ghanaian number to the bare "233XXXXXXXXX" that
 * `subscriber_number` expects (10-12 digits, no "+").
 * Mirrors toHubtelMsisdn — kept separate so a change for one gateway's quirks
 * cannot silently alter the other's live traffic.
 */
export function toPayswitchMsisdn(phone: string): string {
    let digits = (phone || '').replace(/\D/g, '')
    if (digits.startsWith('0')) {
        digits = '233' + digits.slice(1)
    } else if (digits.startsWith('233')) {
        // already international
    } else if (digits.length === 9) {
        digits = '233' + digits
    }
    return digits
}

/**
 * TheTeller wants the amount as PESEWAS, zero-padded to exactly 12 characters:
 * GHS 2.00 -> "000000000200".
 *
 * This is the THIRD amount convention in this codebase and the easiest one to
 * "simplify" into a bug. For reference:
 *   Hubtel / Moolre  -> GHS decimal number   (2.00)
 *   Paystack         -> pesewas integer      (200)
 *   PaySwitch        -> pesewas, 12-char zero-padded STRING ("000000000200")
 * Sending a decimal here would charge 100x too little and still look "approved".
 */
export function formatPayswitchAmount(amountGhs: number): string {
    const pesewas = Math.round(amountGhs * 100)
    if (!Number.isFinite(pesewas) || pesewas <= 0) {
        throw new Error(`[PayswitchPayment] Invalid amount: ${amountGhs}`)
    }
    const s = String(pesewas)
    if (s.length > 12) {
        throw new Error(`[PayswitchPayment] Amount exceeds the 12-digit field: ${amountGhs}`)
    }
    return s.padStart(12, '0')
}

/** Inverse of formatPayswitchAmount, for reading amounts back off a callback. */
export function parsePayswitchAmount(raw: unknown): number | null {
    const digits = String(raw ?? '').trim()
    if (!/^\d+$/.test(digits)) return null
    return parseInt(digits, 10) / 100
}

/**
 * Generates a 12-digit numeric transaction_id.
 *
 * Layout: 6 digits of epoch MILLISECONDS (mod 10^6) + 6 random digits. Two ids
 * collide only if they were minted in the same millisecond AND drew the same
 * 1-in-10^6 suffix.
 *
 * Both halves are load-bearing, and the split was measured rather than guessed —
 * 10,000 ids generated in a tight loop:
 *   epoch-seconds(6) + random(6)      →   46 collisions  (one shared second)
 *   epoch-ms(9)      + random(3)      → 1267 collisions  (suffix too small)
 *   epoch-ms(6)      + random(6)      →   ~2 collisions  (this one)
 *
 * The millisecond field wraps every ~16.7 minutes, so ids are only locally
 * time-ordered in the PaySwitch dashboard. That is a fair trade for the entropy,
 * and the actual uniqueness guarantee is the partial unique index on
 * wallet_payments.provider_reference — assignPayswitchTransactionId retries on
 * conflict rather than trusting this function on its own.
 */
export function generatePayswitchTransactionId(): string {
    const timePart = String(Date.now() % 1_000_000).padStart(6, '0')
    const randomPart = String(randomInt(0, 1_000_000)).padStart(6, '0')
    return timePart + randomPart
}

/**
 * Reduces free text to plain ASCII before it goes to PaySwitch.
 *
 * Learned on Hubtel: a gateway that echoes our text back in its response body
 * breaks the response framing on any multi-byte character, and undici aborts with
 * `TypeError: terminated` — AFTER the customer has already been charged. `desc`
 * is the only free-text field we send here and it can contain a customer-supplied
 * shop name, so it gets stripped at the boundary regardless.
 */
export function toPayswitchSafeText(value: string, fallback = ''): string {
    const ascii = (value || '')
        .replace(/[‐-―−]/g, '-')
        .replace(/[‘’‛]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/…/g, '...')
        .normalize('NFKD')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    return ascii || fallback
}

/**
 * Turns a thrown fetch error into something a customer can act on.
 * undici throws a bare `TypeError: fetch failed` for every connection-level
 * problem; the real cause is on err.cause.
 */
export function describePayswitchNetworkFailure(err: any, context: string): string {
    const cause = err?.cause
    const code = cause?.code || err?.code
    const usingProxy = isUsingStaticProxy()
    const text = `${err?.message || ''} ${cause?.message || ''}`

    console.error(`[PayswitchPayment] ${context} failed to reach PaySwitch:`, {
        message: err?.message,
        code,
        cause: cause?.message,
        usingProxy,
    })

    if (/407|proxy auth|Proxy response/i.test(text) || (usingProxy && /cancelled/i.test(text))) {
        console.error(
            '[PayswitchPayment] ACTION REQUIRED: the static proxy rejected our credentials (HTTP 407). ' +
            'Refresh FIXIE_URL from the provider dashboard and confirm its static IP is whitelisted with PaySwitch.'
        )
        return 'Mobile money payments are temporarily unavailable. Please try another payment method or contact support.'
    }

    if (err?.name === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_HEADERS_TIMEOUT') {
        return 'PaySwitch did not respond in time. Please try again in a moment.'
    }

    return 'Could not reach the payment provider. Please try again shortly.'
}

// ─── Status mapping ──────────────────────────────────────────────────────────

/** Approved. */
const CODE_APPROVED = '000'

/**
 * Codes that mean "the customer still has a prompt on their handset".
 *
 * MTN in particular does not settle inside the initiate call. Treating any of
 * these as a failure would mark a live payment failed while the customer is
 * still entering their PIN, so they are enumerated explicitly and everything
 * unknown falls to `failed` (safe: we never credit on `failed`, we just stop
 * waiting — and the reconciliation cron re-checks anyway).
 *
 * ⚠️ Confirm this set against sandbox transactions before go-live; TheTeller's
 * published sample only documents the approved case.
 */
const PENDING_CODES = new Set(['111', '100', '101', '200', '090', '0P1'])

export function mapPayswitchStatus(data: any): PayswitchOutcome {
    // `code` comes back as a JSON NUMBER on failures (999) and a quoted string
    // ("000") on success, so it is always stringified before comparison.
    const code = String(data?.code ?? data?.Code ?? '').trim()
    const status = String(data?.status ?? data?.Status ?? '').trim().toLowerCase()
    const reason = String(data?.reason ?? data?.message ?? '').trim().toLowerCase()

    if (code === CODE_APPROVED || status === 'approved' || status === 'successful' || status === 'success') {
        return 'paid'
    }

    // "Transaction not found" is PENDING, not failed.
    //
    // Verified against the sandbox: an unknown transaction id returns
    // {"status":"failed","code":999,"reason":"Transaction not found"} — the same
    // generic 999 as a genuine decline. There is a window right after initiate
    // where PaySwitch has not registered the transaction yet, and the browser poll
    // starts within seconds. Mapping this to 'failed' would mark a payment dead
    // while the customer still has the prompt in their hand.
    //
    // The cost of the other reading is bounded: a transaction that truly never
    // existed just stays pending until the status-check cap stops the polling.
    // Wrongly failing a live payment has no such ceiling.
    if (reason.includes('not found')) {
        return 'pending'
    }

    if (PENDING_CODES.has(code) || status === 'pending' || status === 'processing' || status === 'ongoing') {
        return 'pending'
    }
    return 'failed'
}

// ─── Initiate ────────────────────────────────────────────────────────────────

/**
 * Sends a Direct Mobile Money debit prompt to the customer's phone.
 * Returns outcome 'pending' for the normal case (prompt delivered, awaiting PIN).
 */
export async function initiatePayment(params: PayswitchInitiateParams): Promise<PayswitchInitiateResult> {
    let payloadForLog: Record<string, unknown> | null = null

    try {
        const rSwitch = PAYSWITCH_CHANNEL_MAP[params.network]
        if (!rSwitch) {
            return { success: false, error: `Unsupported network for PaySwitch: ${params.network}` }
        }
        if (!/^\d{12}$/.test(params.transactionId)) {
            return { success: false, error: 'Invalid PaySwitch transaction id (must be 12 digits)' }
        }

        const subscriber = toPayswitchMsisdn(params.payerPhone)
        if (subscriber.length < 10 || subscriber.length > 12) {
            return { success: false, error: 'Enter a valid Mobile Money number' }
        }

        const payload = {
            merchant_id: getMerchantId(),
            transaction_id: params.transactionId,
            amount: formatPayswitchAmount(params.amount),
            processing_code: PROCESSING_CODE_DEBIT,
            'r-switch': rSwitch,
            desc: toPayswitchSafeText(params.description || '', 'ARHMS Payment'),
            subscriber_number: subscriber,
        }
        payloadForLog = payload

        console.log('[PayswitchPayment] Initiating payment:', {
            txId: params.transactionId,
            switch: rSwitch,
            amount: payload.amount,
        })

        const response = await fetch(`${getBaseUrl()}/v1.1/transaction/process`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
            // Without this a dead proxy hangs the checkout until the platform
            // kills the function, and the customer just watches a spinner.
            signal: AbortSignal.timeout(20_000),
            // @ts-ignore — undici dispatcher for static IP routing
            dispatcher: getDispatcher(),
        })

        const responseText = await response.text()
        let data: any
        try {
            data = JSON.parse(responseText)
        } catch {
            console.error('[PayswitchPayment] Unparseable response. HTTP:', response.status, '|', responseText.substring(0, 500))
            return {
                success: false,
                error: `PaySwitch returned an invalid response (HTTP ${response.status}). If this persists, confirm our IP is whitelisted in the PaySwitch dashboard.`,
            }
        }

        console.log('[PayswitchPayment] Raw API response:', JSON.stringify(data))

        const outcome = mapPayswitchStatus(data)
        const code = String(data?.code ?? '')

        if (outcome === 'failed') {
            return {
                success: false,
                outcome,
                code,
                status: data?.status,
                error: data?.reason || data?.message || `PaySwitch declined the request (code ${code || response.status}).`,
                raw: data,
            }
        }

        return { success: true, outcome, code, status: data?.status, raw: data }
    } catch (err: any) {
        console.error('[PayswitchPayment] initiatePayment error:', err?.message, '| payload:', JSON.stringify(payloadForLog))
        return { success: false, error: describePayswitchNetworkFailure(err, 'initiatePayment') }
    }
}

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * Server-to-server status check for a transaction id.
 *
 * This is the ONLY trustworthy source of truth for a PaySwitch payment: the
 * callback carries no signature, so the webhook re-queries here before crediting.
 */
export async function checkPaymentStatus(transactionId: string): Promise<PayswitchStatusResult> {
    try {
        if (!/^\d{12}$/.test(transactionId || '')) {
            return { success: false, outcome: null, error: 'Invalid PaySwitch transaction id' }
        }

        const response = await fetch(`${getBaseUrl()}/v1.1/users/transactions/${transactionId}/status`, {
            method: 'GET',
            headers: getHeaders(),
            signal: AbortSignal.timeout(20_000),
            // @ts-ignore — undici dispatcher for static IP routing
            dispatcher: getDispatcher(),
        })

        const responseText = await response.text()
        let data: any
        try {
            data = JSON.parse(responseText)
        } catch {
            console.error('[PayswitchPayment] Unparseable status response. HTTP:', response.status, '|', responseText.substring(0, 500))
            return { success: false, outcome: null, error: `PaySwitch status check returned HTTP ${response.status}` }
        }

        console.log('[PayswitchPayment] Status response for', transactionId, ':', JSON.stringify(data))

        return {
            success: true,
            outcome: mapPayswitchStatus(data),
            code: String(data?.code ?? ''),
            status: data?.status,
            amount: parsePayswitchAmount(data?.amount) ?? undefined,
            raw: data,
        }
    } catch (err: any) {
        console.error('[PayswitchPayment] checkPaymentStatus error:', err?.message)
        return { success: false, outcome: null, error: describePayswitchNetworkFailure(err, 'checkPaymentStatus') }
    }
}
