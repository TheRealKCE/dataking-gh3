import { sanitizeForLog } from '@/lib/safe-log'

// KingFlexyGH Fulfillment Service — mirrors lib/codecraft-service.ts architecture

const KINGFLEXY_API_KEY = process.env.KINGFLEXY_API_KEY || ''
const KINGFLEXY_API_URL = process.env.KINGFLEXY_API_URL || 'https://kingflexygh.com/api/v1'

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
        console.log('[KingFlexy] Circuit breaker OPENED')
    }
}

// ─── Main Fulfillment Function ─────────────────────────────────────────────────
/**
 * Fulfill a data order via KingFlexyGH API.
 * KingFlexy accepts network names as-is: MTN, Telecel, AT-iShare, AT-BigTime.
 * Phone must be 0XXXXXXXXX format.
 */
export async function fulfillOrder(
    network: string,
    phoneNumber: string,
    dataSize: string,
    orderId: string
): Promise<FulfillmentResponse> {

    if (!checkCircuit()) {
        console.warn(`[KingFlexy] Circuit breaker is OPEN. Order ${orderId} kept pending.`)
        return { success: false, error: 'Service temporarily unavailable (circuit open)' }
    }

    if (!KINGFLEXY_API_KEY) {
        return { success: false, error: 'KingFlexy API key not configured' }
    }

    try {
        // ── Extract numeric GB volume from size string ──────────────────────
        const sizeMatch = dataSize.match(/[\d.]+/)
        if (!sizeMatch) {
            return { success: false, error: `Invalid data size format: ${dataSize}` }
        }

        const gigVolume = Number(sizeMatch[0])
        if (isNaN(gigVolume) || gigVolume <= 0) {
            return { success: false, error: `Invalid GB volume parsed from: ${dataSize}` }
        }

        // ── Phone Normalization ─────────────────────────────────────────────
        let normalizedPhone = phoneNumber
        if (normalizedPhone.startsWith('233')) normalizedPhone = '0' + normalizedPhone.slice(3)
        else if (!normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone

        const requestBody = {
            network,                     // KingFlexy accepts exact network strings
            volume_gb: gigVolume,
            recipient: normalizedPhone,
            reference: orderId,          // Use orderId as idempotency reference
        }

        console.log(`[KingFlexy] Order ${orderId} | ${network} | ${gigVolume}GB | recipient: ${normalizedPhone}`)
        console.log(`[KingFlexy] Request payload:`, sanitizeForLog(requestBody))

        // ── HTTP Fetch with 3-retry logic ───────────────────────────────────
        let response: Response | null = null
        let attempt = 0
        const maxAttempts = 3
        let lastError: Error | null = null

        while (attempt < maxAttempts) {
            attempt++
            try {
                response = await fetch(`${KINGFLEXY_API_URL}/data/purchase`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': KINGFLEXY_API_KEY,
                    },
                    body: JSON.stringify(requestBody),
                })

                if (response.status === 429) {
                    console.warn(`[KingFlexy] Rate limited (HTTP 429). Order ${orderId} kept pending.`)
                    return { success: false, error: 'Supplier Rate Limited (429)', isRateLimited: true }
                }

                break

            } catch (err: any) {
                lastError = err
                console.error(`[KingFlexy] Fetch error on attempt ${attempt}:`, err.message)
                if (attempt < maxAttempts) {
                    const delay = 2000 * attempt
                    console.log(`[KingFlexy] Retrying in ${delay}ms...`)
                    await new Promise(res => setTimeout(res, delay))
                }
            }
        }

        if (!response) {
            recordFailure()
            return { success: false, error: lastError?.message || 'Persistent network error connecting to KingFlexy' }
        }

        // ── Parse JSON ─────────────────────────────────────────────────────
        const rawText = await response.text()
        let data: any
        try {
            data = JSON.parse(rawText)
        } catch (e) {
            console.error(`[KingFlexy] Non-JSON response (HTTP ${response.status}):`, rawText.slice(0, 300))
            recordFailure()
            return { success: false, error: `Supplier returned unexpected response format (HTTP ${response.status})` }
        }

        console.log(`[KingFlexy] API response:`, { status: response.status, success: data?.success })

        // ── KingFlexy success: { success: true, data: { order_id, reference, status, ... } }
        if (response.ok && data?.success === true && data?.data?.order_id) {
            recordSuccess()
            return {
                success: true,
                reference: data.data.order_id,
                transactionId: data.data.order_id,
                apiResponse: sanitizeForLog(data),
            }
        }

        // ── 409 = duplicate reference (idempotent — order already placed) ──
        if (response.status === 409) {
            console.warn(`[KingFlexy] Order ${orderId}: duplicate reference (409) — treating as success`)
            recordSuccess()
            return {
                success: true,
                reference: orderId,
                transactionId: orderId,
                apiResponse: sanitizeForLog(data),
            }
        }

        const errMsg = data?.error?.message || data?.message || 'Unknown error'
        console.warn(`[KingFlexy] Order ${orderId} not fulfilled: ${errMsg}. Kept pending.`)
        
        if (response.status >= 500) {
            recordFailure()
        }
        return {
            success: false,
            error: errMsg,
            apiResponse: sanitizeForLog(data),
        }

    } catch (error: any) {
        recordFailure()
        console.error(`[KingFlexy] Exception during fulfillOrder for ${orderId}:`, error.message)
        return { success: false, error: error.message || 'Unexpected exception' }
    }
}

// ─── Order Status Check ────────────────────────────────────────────────────────
/**
 * Check the status of an existing KingFlexy order.
 * GET /api/v1/orders/{reference}
 */
export async function checkOrderStatus(reference: string): Promise<StatusResponse> {

    if (!checkCircuit()) return { success: false, status: 'pending', message: 'Service unavailable (circuit open)' }
    if (!KINGFLEXY_API_KEY) return { success: false, status: 'pending', message: 'API key not configured' }

    try {
        const response = await fetch(`${KINGFLEXY_API_URL}/orders/${encodeURIComponent(reference)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': KINGFLEXY_API_KEY,
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

        if (response.ok && data?.success === true && data?.data?.status) {
            recordSuccess()
            const mapped = mapKingFlexyStatus(data.data.status)
            return { success: true, status: mapped, message: data.data.status, data: data.data }
        }

        if (response.status >= 500) {
            recordFailure()
        }
        return { success: false, status: 'pending', message: data?.error?.message || 'Failed to check status' }

    } catch (error) {
        recordFailure()
        return { success: false, status: 'pending', message: 'Connection error during status check' }
    }
}

// KingFlexy statuses — refund treated as failed for manual admin handling
function mapKingFlexyStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    const s = (status || '').toLowerCase()
    if (s === 'completed') return 'completed'
    if (s === 'failed' || s === 'refund' || s === 'refunded' || s === 'reversed') return 'failed'
    if (s === 'processing') return 'processing'
    return 'pending'
}

// ─── Balance Fetch ─────────────────────────────────────────────────────────────
/**
 * Fetch live KingFlexy wallet balance.
 * GET /api/v1/wallet/balance
 * Response: { success: true, data: { balance: 124.50, currency: "GHS", ... } }
 */
export async function fetchSupplierBalance(): Promise<{
    success: boolean
    balance?: number
    currency?: string
    error?: string
}> {
    try {
        const response = await fetch(`${KINGFLEXY_API_URL}/wallet/balance`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': KINGFLEXY_API_KEY,
            },
        })

        const rawText = await response.text()
        let data: any
        try {
            data = JSON.parse(rawText)
        } catch (e) {
            console.error('[KingFlexy Balance] Non-JSON response (HTTP', response.status, '):', rawText.slice(0, 300))
            return { success: false, error: `Unexpected response format (HTTP ${response.status})` }
        }

        console.log('[KingFlexy Balance] API response received', { status: response.status, ok: response.ok })

        if (response.ok && data?.success === true) {
            const balance = parseFloat(data.data?.balance ?? 0) || 0
            const currency = data.data?.currency || 'GHS'
            return { success: true, balance, currency }
        }

        return { success: false, error: data?.error?.message || 'Failed to fetch balance' }

    } catch (error: any) {
        console.error('[KingFlexy Balance] Error:', error)
        return { success: false, error: error.message }
    }
}
