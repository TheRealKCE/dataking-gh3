/**
 * Hubtel Payment (Collection) Service
 *
 * Handles Direct Mobile Money prompt collections and status checking via the Hubtel API.
 * API Docs: https://developers.hubtel.com/docs/business/api_documentation/payment_apis/direct_receive_money
 *
 * Uses:
 *   HUBTEL_CLIENT_ID          — API ID (username) from Hubtel dashboard
 *   HUBTEL_CLIENT_SECRET      — API Key (password) from Hubtel dashboard
 *   HUBTEL_COLLECTION_ACCOUNT_NUMBER — Your Hubtel merchant collection account number
 *   HUBTEL_FEE_PERCENT        — Transaction fee percentage (default: 1.8)
 *   FIXIE_URL                 — Static proxy URL from usefixie.com (recommended).
 *                               Format: http://user:pass@criterium.usefixie.com:80
 *                               Get your URL + static IP at: https://usefixie.com
 *                               Whitelist the static IP in Hubtel Merchant Portal.
 *
 * Auth: Basic Auth (base64(CLIENT_ID:CLIENT_SECRET))
 */
import { ProxyAgent, Agent } from 'undici'

const HUBTEL_RECEIVE_BASE_URL = 'https://rmp.hubtel.com/merchantaccount/merchants'
const HUBTEL_STATUS_BASE_URL = 'https://api-txnstatus.hubtel.com/transactions'

/**
 * Returns an undici dispatcher that routes all Hubtel API traffic through
 * a static proxy IP (required because Hubtel mandates IP whitelisting and
 * Vercel uses dynamic/rotating IPs).
 *
 * Priority: FIXIE_URL → QUOTAGUARDSTATIC_URL → no proxy (will fail on Vercel)
 */
export function getDispatcher(): ProxyAgent | Agent {
    const proxyUrl = process.env.FIXIE_URL || process.env.QUOTAGUARDSTATIC_URL
    if (proxyUrl) {
        console.log('[HubtelPayment] Routing through static proxy:', proxyUrl.split('@')[1] ?? 'proxy')
        return new ProxyAgent(proxyUrl)
    }
    console.warn('[HubtelPayment] No static proxy configured (FIXIE_URL). Hubtel will likely return 403 on Vercel.')
    return new Agent()
}

/** Maps the internal network label to Hubtel's channel name */
export const HUBTEL_CHANNEL_MAP: Record<string, string> = {
    'MTN': 'mtn-gh',
    'Telecel': 'vodafone-gh',
    'AT': 'tigo-gh',
}

/** Default transaction fee percentage charged to the payer */
export const HUBTEL_FEE_PERCENT = parseFloat(process.env.HUBTEL_FEE_PERCENT || '1.8')

export interface HubtelInitiateParams {
    /** Amount in GHS (e.g. 10.00) */
    amount: number
    /** Phone in international format, e.g. "233249111411" */
    payerPhone: string
    /** Hubtel channel name e.g. "mtn-gh" */
    channel: string
    /** Unique client reference (max 36 chars, alphanumeric preferred) */
    clientReference: string
    /** Optional payer name */
    customerName?: string
    /** Optional payer email */
    customerEmail?: string
    /** Description shown to customer */
    description?: string
}

export interface HubtelInitiateResult {
    success: boolean
    transactionId?: string
    status?: string
    error?: string
}

export interface HubtelStatusResult {
    success: boolean
    /** 'Paid' | 'Unpaid' | 'Refunded' | null */
    status: string | null
    transactionId?: string
    error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeader(): string {
    const clientId = process.env.HUBTEL_CLIENT_ID
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        throw new Error('[HubtelPayment] HUBTEL_CLIENT_ID or HUBTEL_CLIENT_SECRET is not configured.')
    }

    const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    return `Basic ${encoded}`
}

function getCollectionAccount(): string {
    const account = process.env.HUBTEL_COLLECTION_ACCOUNT_NUMBER
    if (!account) {
        throw new Error('[HubtelPayment] HUBTEL_COLLECTION_ACCOUNT_NUMBER is not configured.')
    }
    return account
}

/**
 * Normalizes a Ghanaian phone number to Hubtel's required international format:
 * a bare "233XXXXXXXXX" (12 digits, NO leading "+"), per the Direct Receive Money spec
 * (e.g. "233249111411"). Accepts local "0XXXXXXXXX" and "+233XXXXXXXXX" inputs.
 */
export function toHubtelMsisdn(phone: string): string {
    let digits = (phone || '').replace(/\D/g, '')
    if (digits.startsWith('0')) {
        digits = '233' + digits.slice(1)
    } else if (digits.startsWith('233')) {
        // already international
    } else if (digits.length === 9) {
        // bare subscriber number without leading 0, e.g. "249111411"
        digits = '233' + digits
    }
    return digits
}

// ─── Initiate Payment ─────────────────────────────────────────────────────────

/**
 * Sends a Direct Mobile Money payment prompt to the customer's phone.
 * ResponseCode '0001' = pending (prompt sent successfully).
 */
export async function initiatePayment(params: HubtelInitiateParams): Promise<HubtelInitiateResult> {
    try {
        const account = getCollectionAccount()
        const authHeader = getAuthHeader()
        const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/hubtel`

        const payload = {
            CustomerName: params.customerName || '',
            CustomerMsisdn: toHubtelMsisdn(params.payerPhone),
            CustomerEmail: params.customerEmail || '',
            Channel: params.channel,
            Amount: parseFloat(params.amount.toFixed(2)),
            PrimaryCallbackUrl: callbackUrl,
            Description: params.description || 'ARHMS Payment',
            ClientReference: params.clientReference,
        }

        console.log('[HubtelPayment] Initiating payment:', {
            account,
            channel: params.channel,
            amount: payload.Amount,
            ref: params.clientReference,
        })

        const response = await fetch(
            `${HUBTEL_RECEIVE_BASE_URL}/${account}/receive/mobilemoney`,
            {
                method: 'POST',
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache',
                },
                body: JSON.stringify(payload),
                // @ts-ignore — undici dispatcher for static IP routing
                dispatcher: getDispatcher(),
            }
        )

        const responseText = await response.text()
        let data: any
        try {
            data = JSON.parse(responseText)
        } catch (parseError) {
            console.error('[HubtelPayment] Failed to parse Hubtel response. Status:', response.status)
            console.error('[HubtelPayment] Raw response:', responseText.substring(0, 500))
            return {
                success: false,
                error: `Hubtel API Error (HTTP ${response.status}). The server returned an invalid response. This often happens if your IP is not whitelisted in the Hubtel dashboard.`,
            }
        }

        console.log('[HubtelPayment] Raw API response:', JSON.stringify(data))

        // 0001 = accepted, callback will confirm final state
        // 0000 = immediately successful (rare for mobile money)
        if (data.ResponseCode === '0001' || data.ResponseCode === '0000') {
            return {
                success: true,
                transactionId: data.Data?.TransactionId,
                status: data.ResponseCode,
            }
        }

        // Any other code is a failure
        return {
            success: false,
            error: data.Message || `Hubtel error (HTTP ${response.status})`,
        }
    } catch (err: any) {
        console.error('[HubtelPayment] initiatePayment error:', err.message)
        return {
            success: false,
            error: err.message || 'Network error during Hubtel payment initiation',
        }
    }
}

// ─── Status Check ─────────────────────────────────────────────────────────────

/**
 * Checks the final status of a Hubtel transaction.
 * Should only be called if a callback was not received within 5 minutes.
 * Returns status: 'Paid' | 'Unpaid' | 'Refunded' | null
 */
export async function checkPaymentStatus(clientReference: string): Promise<HubtelStatusResult> {
    try {
        const account = getCollectionAccount()
        const authHeader = getAuthHeader()

        const url = `${HUBTEL_STATUS_BASE_URL}/${account}/status?clientReference=${encodeURIComponent(clientReference)}`

        console.log('[HubtelPayment] Checking payment status for ref:', clientReference)

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: authHeader,
                Accept: 'application/json',
            },
            // @ts-ignore — undici dispatcher for static IP routing
            dispatcher: getDispatcher(),
        })

        const responseText = await response.text()
        let data: any
        try {
            data = JSON.parse(responseText)
        } catch (parseError) {
            console.error('[HubtelPayment] checkPaymentStatus failed to parse Hubtel response. Status:', response.status)
            console.error('[HubtelPayment] Raw response:', responseText.substring(0, 500))
            return {
                success: false,
                status: null,
                error: `Hubtel API Error (HTTP ${response.status}). The server returned an invalid response.`,
            }
        }

        console.log('[HubtelPayment] Status check response:', JSON.stringify(data))

        if (!response.ok || data.responseCode !== '0000') {
            return {
                success: false,
                status: null,
                error: data.message || `Hubtel status check error (HTTP ${response.status})`,
            }
        }

        return {
            success: true,
            status: data.data?.status ?? null,     // 'Paid' | 'Unpaid' | 'Refunded'
            transactionId: data.data?.transactionId ?? undefined,
        }
    } catch (err: any) {
        console.error('[HubtelPayment] checkPaymentStatus error:', err.message)
        return { success: false, status: null, error: err.message }
    }
}

/**
 * Calculates the Hubtel fee and total amount for a given base amount.
 */
export function calculateHubtelFee(baseAmount: number, feePercent: number = HUBTEL_FEE_PERCENT): { fee: number; total: number } {
    const fee = parseFloat((baseAmount * (feePercent / 100)).toFixed(2))
    const total = parseFloat((baseAmount + fee).toFixed(2))
    return { fee, total }
}
