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
 *
 * Auth: Basic Auth (base64(CLIENT_ID:CLIENT_SECRET))
 */

const HUBTEL_RECEIVE_BASE_URL = 'https://rmp.hubtel.com/merchantaccount/merchants'
const HUBTEL_STATUS_BASE_URL = 'https://api-txnstatus.hubtel.com/transactions'

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
            CustomerMsisdn: params.payerPhone,
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
            }
        )

        const data = await response.json()
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
        })

        const data = await response.json()
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
