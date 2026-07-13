import { sanitizeForLog } from '@/lib/safe-log'

// Eazy Data Fulfillment Service — mirrors lib/kingflexy-service.ts architecture
// API Docs: https://www.ghdata.xyz/api/agent/v1

const EAZYDATA_API_KEY = process.env.EAZYDATA_API_KEY || ''
const EAZYDATA_API_URL = 'https://www.ghdata.xyz/api/agent/v1'

// ─── Circuit Breaker ───────────────────────────────────────────────────────────
let circuitState: 'closed' | 'open' | 'half-open' = 'closed'
let failureCount = 0
let lastFailureTime: number | null = null
const FAILURE_THRESHOLD = 5
const RECOVERY_TIMEOUT = 60000 // 1 minute

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface FulfillmentResponse {
    success: boolean
    reference?: string
    transactionId?: string
    error?: string
    apiResponse?: any
    isRateLimited?: boolean
    // True when the supplier rejected the request because THIS order was already
    // submitted (idempotency-key collision). Not a fresh failure — the order
    // already lives at the supplier, so callers should stop retrying it as pending.
    alreadySubmitted?: boolean
}

interface StatusResponse {
    success: boolean
    status: 'pending' | 'processing' | 'completed' | 'failed'
    message?: string
    data?: any
}

// ─── Circuit Breaker Helpers ──────────────────────────────────────────────────
function checkCircuit(): boolean {
    if (circuitState === 'closed') return true
    if (circuitState === 'open') {
        const now = Date.now()
        if (lastFailureTime && now - lastFailureTime > RECOVERY_TIMEOUT) {
            circuitState = 'half-open'
            return true
        }
        return false
    }
    return true // half-open allows one attempt
}

function recordSuccess() {
    failureCount = 0
    circuitState = 'closed'
}

function recordFailure() {
    failureCount++
    lastFailureTime = Date.now()
    if (failureCount >= FAILURE_THRESHOLD) {
        circuitState = 'open'
        console.log('[EazyData] Circuit breaker OPENED')
    }
}

// ─── Network Name Resolver ────────────────────────────────────────────────────
/**
 * Eazy Data API accepts: "MTN", "Telecel", "AT"
 * Our internal names: "MTN", "Telecel", "AT-iShare", "AT-BigTime"
 */
function resolveNetwork(network: string): string {
    const n = network.toUpperCase()
    if (n.startsWith('AT')) return 'AT'
    if (n === 'TELECEL') return 'Telecel'
    return 'MTN'
}

// ─── Main Fulfillment Function ─────────────────────────────────────────────────
/**
 * Fulfill a data order via Eazy Data API.
 * Uses POST /order with package_name (e.g. "1" for 1GB) + network + phone_number.
 * Phone must be 0XXXXXXXXX format.
 */
export async function fulfillOrder(
    network: string,
    phoneNumber: string,
    dataSize: string,
    orderId: string
): Promise<FulfillmentResponse> {

    if (!checkCircuit()) {
        console.warn(`[EazyData] Circuit breaker is OPEN. Order ${orderId} kept pending.`)
        return { success: false, error: 'Service temporarily unavailable (circuit open)' }
    }

    if (!EAZYDATA_API_KEY) {
        return { success: false, error: 'EazyData API key not configured' }
    }

    try {
        // ── Extract numeric GB volume from size string ──────────────────────
        // e.g. "1GB" → "1", "1.5GB" → "1.5", "500MB" → we pass as-is but they use GB
        const sizeMatch = dataSize.match(/[\d.]+/)
        if (!sizeMatch) {
            return { success: false, error: `Invalid data size format: ${dataSize}` }
        }

        const gigVolume = Number(sizeMatch[0])
        if (isNaN(gigVolume) || gigVolume <= 0) {
            return { success: false, error: `Invalid GB volume parsed from: ${dataSize}` }
        }

        // ── Phone Normalization → 0XXXXXXXXX ───────────────────────────────
        let normalizedPhone = phoneNumber.replace(/\s+/g, '').replace(/-/g, '')
        if (normalizedPhone.startsWith('233')) normalizedPhone = '0' + normalizedPhone.slice(3)
        else if (!normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone

        const eazydataNetwork = resolveNetwork(network)

        const requestBody = {
            package_name: String(gigVolume),   // e.g. "1" for 1GB — matches Eazy Data package names
            network: eazydataNetwork,
            phone_number: normalizedPhone,
        }

        console.log(`[EazyData] Order ${orderId} | ${eazydataNetwork} | ${gigVolume}GB | recipient: ${normalizedPhone}`)
        console.log(`[EazyData] Request payload:`, sanitizeForLog(requestBody))

        // ── HTTP Fetch with 3-retry logic ───────────────────────────────────
        let response: Response | null = null
        let attempt = 0
        const maxAttempts = 3
        let lastError: Error | null = null

        while (attempt < maxAttempts) {
            attempt++
            try {
                response = await fetch(`${EAZYDATA_API_URL}/order`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-API-Key': EAZYDATA_API_KEY,
                        'Idempotency-Key': orderId, // prevent duplicate orders on retry
                    },
                    body: JSON.stringify(requestBody),
                })

                if (response.status === 429) {
                    console.warn(`[EazyData] Rate limited (HTTP 429). Order ${orderId} kept pending.`)
                    return { success: false, error: 'Supplier Rate Limited (429)', isRateLimited: true }
                }

                break

            } catch (err: any) {
                lastError = err
                console.error(`[EazyData] Fetch error on attempt ${attempt}:`, err.message)
                if (attempt < maxAttempts) {
                    const delay = 2000 * attempt
                    console.log(`[EazyData] Retrying in ${delay}ms...`)
                    await new Promise(res => setTimeout(res, delay))
                }
            }
        }

        if (!response) {
            recordFailure()
            return { success: false, error: lastError?.message || 'Persistent network error connecting to EazyData' }
        }

        // ── Parse JSON ─────────────────────────────────────────────────────
        const rawText = await response.text()
        let data: any
        try {
            data = JSON.parse(rawText)
        } catch (e) {
            console.error(`[EazyData] Non-JSON response (HTTP ${response.status}):`, rawText.slice(0, 300))
            recordFailure()
            return { success: false, error: `Supplier returned unexpected response format (HTTP ${response.status})` }
        }

        console.log(`[EazyData] API response:`, { status: response.status, success: data?.success })

        // ── Success: { success: true, order_id: "uuid", short_id: "ORD-XXXXXX", ... }
        if (response.ok && data?.success === true && data?.order_id) {
            recordSuccess()
            return {
                success: true,
                reference: data.order_id,
                transactionId: data.order_id,
                apiResponse: sanitizeForLog(data),
            }
        }

        // ── Error codes from API ───────────────────────────────────────────
        const errMsg = data?.error || 'Unknown error'
        const errCode = data?.code || ''

        // The supplier stores an idempotency row keyed by our order id. A
        // duplicate-key error on that constraint means THIS order was already
        // submitted to EazyData on a prior attempt (we most likely mis-recorded
        // the first response as a failure). Re-sending with the same key can never
        // succeed, and re-sending with a new key would risk double-charging — the
        // order already exists at the supplier. Signal the caller to stop retrying
        // it as pending and move it to processing instead. Don't trip the circuit
        // breaker: the supplier is up, this is an expected replay collision.
        if (/idempotenc/i.test(errMsg)) {
            console.warn(`[EazyData] Order ${orderId} already submitted (idempotency collision) — signalling processing, not a retry.`)
            return {
                success: false,
                alreadySubmitted: true,
                error: 'Order already submitted to EazyData (idempotency collision)',
                apiResponse: sanitizeForLog(data),
            }
        }

        if (errCode === 'package_out_of_stock') {
            console.warn(`[EazyData] Order ${orderId}: package out of stock — kept pending.`)
        } else if (errCode === 'insufficient_balance') {
            console.error(`[EazyData] Order ${orderId}: Insufficient balance! Top up the EazyData wallet.`)
        } else if (errCode === 'authentication_error') {
            console.error(`[EazyData] Order ${orderId}: Authentication error — check EAZYDATA_API_KEY.`)
        }

        console.warn(`[EazyData] Order ${orderId} not fulfilled: ${errMsg} (${errCode}). Kept pending.`)
        recordFailure()
        return {
            success: false,
            error: `${errMsg} (${errCode})`,
            apiResponse: sanitizeForLog(data),
        }

    } catch (error: any) {
        recordFailure()
        console.error(`[EazyData] Exception during fulfillOrder for ${orderId}:`, error.message)
        return { success: false, error: error.message || 'Unexpected exception' }
    }
}

// ─── Order Status Check ────────────────────────────────────────────────────────
/**
 * Check the status of an existing Eazy Data order.
 * GET /orders?id={orderId}
 * Response: { success: true, orders: [{ id, status, ... }] }
 */
export async function checkOrderStatus(orderId: string): Promise<StatusResponse> {

    if (!checkCircuit()) return { success: false, status: 'pending', message: 'Service unavailable (circuit open)' }
    if (!EAZYDATA_API_KEY) return { success: false, status: 'pending', message: 'API key not configured' }

    try {
        const url = `${EAZYDATA_API_URL}/orders?id=${encodeURIComponent(orderId)}`
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-API-Key': EAZYDATA_API_KEY,
            },
        })

        const rawText = await response.text()
        let data: any
        try {
            data = JSON.parse(rawText)
        } catch (e) {
            recordFailure()
            return { success: false, status: 'pending', message: `Unexpected response format (HTTP ${response.status})` }
        }

        if (response.ok && data?.success === true && Array.isArray(data?.orders) && data.orders.length > 0) {
            recordSuccess()
            const order = data.orders[0]
            const mapped = mapEazyDataStatus(order.status)
            return { success: true, status: mapped, message: order.status, data: order }
        }

        recordFailure()
        return { success: false, status: 'pending', message: data?.error || 'Failed to check status' }

    } catch (error) {
        recordFailure()
        return { success: false, status: 'pending', message: 'Connection error during status check' }
    }
}

// Eazy Data statuses
function mapEazyDataStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    const s = (status || '').toLowerCase()
    if (s === 'completed') return 'completed'
    if (s === 'failed' || s === 'cancelled' || s === 'reversed') return 'failed'
    if (s === 'processing') return 'processing'
    return 'pending'
}

// ─── Balance Fetch ─────────────────────────────────────────────────────────────
/**
 * Fetch live Eazy Data wallet balance.
 * GET /balance
 * Response: { success: true, balance: 11.95, tier: "agent_tier_1", name: "..." }
 */
export async function fetchSupplierBalance(): Promise<{
    success: boolean
    balance?: number
    currency?: string
    error?: string
}> {
    try {
        const response = await fetch(`${EAZYDATA_API_URL}/balance`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-API-Key': EAZYDATA_API_KEY,
            },
        })

        const rawText = await response.text()
        let data: any
        try {
            data = JSON.parse(rawText)
        } catch (e) {
            console.error('[EazyData Balance] Non-JSON response (HTTP', response.status, '):', rawText.slice(0, 300))
            return { success: false, error: `Unexpected response format (HTTP ${response.status})` }
        }

        console.log('[EazyData Balance] API response received', { status: response.status, ok: response.ok })

        if (response.ok && data?.success === true) {
            const balance = parseFloat(data.balance ?? 0) || 0
            return { success: true, balance, currency: 'GHS' }
        }

        return { success: false, error: data?.error || 'Failed to fetch balance' }

    } catch (error: any) {
        console.error('[EazyData Balance] Error:', error)
        return { success: false, error: error.message }
    }
}
