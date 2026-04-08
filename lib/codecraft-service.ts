import { createServerClient } from '@/lib/supabase'

// Universal Fulfillment Service with CodeCraft API Integration

const CODECRAFT_API_KEY = process.env.CODECRAFT_API_KEY || ''
const CODECRAFT_API_BASE_URL = process.env.CODECRAFT_API_BASE_URL || 'https://api.codecraftnetwork.com/api'

// Circuit breaker state
let circuitState: 'closed' | 'open' | 'half-open' = 'closed'
let failureCount = 0
let lastFailureTime: number | null = null
const FAILURE_THRESHOLD = 5
const RECOVERY_TIMEOUT = 60000 // 1 minute

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

// CodeCraft internal network mapping names
const NETWORK_IDS: Record<string, string> = {
    'MTN': 'MTN',
    'Telecel': 'TELECEL',
    'AT-iShare': 'AT',
    'AT-BigTime': 'AT',
}

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
    return true
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
        console.log('[CodeCraft] Circuit breaker opened')
    }
}

/**
 * Main fulfillment function for any network using CodeCraft
 */
export async function fulfillOrder(
    network: string,
    phoneNumber: string,
    dataSize: string,
    orderId: string
): Promise<FulfillmentResponse> {
    if (!checkCircuit()) return { success: false, error: 'Service temporarily unavailable' }
    if (!CODECRAFT_API_KEY) return { success: false, error: 'API key not configured' }

    try {
        const networkId = NETWORK_IDS[network]

        if (!networkId) {
            console.log(`[CodeCraft] Skip: Unsupported network ${network}`)
            return { success: false, error: `Unsupported network: ${network}` }
        }

        // Extract volume value to send as the actual "gig"
        const sizeMatch = dataSize.match(/[\d.]+/)
        const volumeValue = sizeMatch ? sizeMatch[0] : null

        if (!volumeValue || isNaN(Number(volumeValue))) {
            console.log(`[CodeCraft] Skip: Could not extract numeric volume from "${dataSize}"`)
            return { success: false, error: `Invalid data size format: ${dataSize}. Number expected.` }
        }

        const volumeNumber = Number(volumeValue)

        console.log(`[CodeCraft] Fulfillment Start: Order ${orderId} | Network: ${network} (${networkId}) | Volume: ${volumeNumber}`)

        // Normalize phone number
        let normalizedPhone = phoneNumber
        if (normalizedPhone.startsWith('233')) normalizedPhone = '0' + normalizedPhone.slice(3)
        else if (!normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone

        const requestBody = {
            recipient_number: normalizedPhone,
            gig: volumeNumber.toString(),
            network: networkId,
            // incoming_api_ref: orderId // Add if CodeCraft supports external refs, otherwise we parse from response
        }

        console.log(`[CodeCraft] Request payload:`, JSON.stringify(requestBody))

        let response: Response | null = null;
        let attempt = 0;
        const maxAttempts = 3;
        let lastError: Error | null = null;
        
        // Determine correct endpoint based on network setup
        const endpoint = network === 'AT-BigTime' || (network === 'MTN' && volumeNumber >= 12) 
            ? `${CODECRAFT_API_BASE_URL}/special.php` 
            : `${CODECRAFT_API_BASE_URL}/initiate.php`

        while (attempt < maxAttempts) {
            attempt++;
            try {
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'x-api-key': CODECRAFT_API_KEY,
                    },
                    body: JSON.stringify(requestBody),
                });

                if (response.status === 429) {
                    console.warn(`[CodeCraft Fulfillment] Rate limited (HTTP 429). Queueing order...`);
                    return { success: false, error: 'Supplier Rate Limited (429)', isRateLimited: true };
                }

                break;

            } catch (err: any) {
                lastError = err;
                console.error(`[CodeCraft Fulfillment] Network/Fetch error on attempt ${attempt}:`, err.message);

                if (attempt < maxAttempts) {
                    const delay = 2000 * attempt;
                    console.log(`[CodeCraft Fulfillment] Retrying in ${delay}ms...`);
                    await new Promise(res => setTimeout(res, delay));
                }
            }
        }

        if (!response) {
            console.error(`[CodeCraft Fulfillment] All ${maxAttempts} fetch attempts failed.`);
            recordFailure();
            return { success: false, error: lastError?.message || 'Persistent network error connecting to supplier' };
        }

        const data = await response.json()
        console.log(`[CodeCraft] Full API response (HTTP ${response.status}):`, JSON.stringify(data))

        // Ensure we catch false positives
        const isFalsePositive = data.status !== 200 || 
            (data.message && data.message.toLowerCase().includes('low') || 
             data.message.toLowerCase().includes('failed') || 
             data.message.toLowerCase().includes('error'))

        if (response.ok && data.status === 200 && !isFalsePositive) {
            recordSuccess()
            return {
                success: true,
                reference: data.reference_id || orderId,
                transactionId: data.reference_id,
                apiResponse: data,
            }
        }

        recordFailure()
        return {
            success: false,
            error: data.message || 'Fulfillment failed',
            apiResponse: data,
        }
    } catch (error: any) {
        recordFailure()
        return { success: false, error: error.message || 'Connection error' }
    }
}

export async function checkOrderStatus(transactionId: string, network: string): Promise<StatusResponse> {
    if (!checkCircuit()) return { success: false, status: 'pending', message: 'Service unavailable' }
    if (!CODECRAFT_API_KEY) return { success: false, status: 'pending', message: 'API not configured' }

    try {
        const endpoint = network === 'AT-BigTime' 
            ? `${CODECRAFT_API_BASE_URL}/response_big_time.php`
            : `${CODECRAFT_API_BASE_URL}/response_regular.php`
            
        // The docs say GET but pass a JSON payload { "reference_id": ... }. 
        // We will strictly use POST since standard browser/fetch doesn't allow bodies in GET.
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CODECRAFT_API_KEY,
            },
            body: JSON.stringify({ reference_id: transactionId }),
        })

        const data = await response.json()

        if (response.ok && data.status === 200 && data.success) {
            recordSuccess()
            return {
                success: true,
                status: mapStatus(data.data?.order_status),
                message: data.message,
                data: data.data,
            }
        }

        recordFailure()
        return { success: false, status: 'pending', message: data.message || 'Failed to check status' }
    } catch (error) {
        recordFailure()
        return { success: false, status: 'pending', message: 'Connection error' }
    }
}

function mapStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    const s = (status || '').toLowerCase()
    if (['success', 'completed', 'delivered'].includes(s)) return 'completed'
    if (['failed', 'error', 'rejected', 'reversed'].includes(s)) return 'failed'
    return 'processing'
}

export async function fetchSupplierBalance(): Promise<{ success: boolean; balance?: number; currency?: string; error?: string }> {
    try {
        const response = await fetch(`${CODECRAFT_API_BASE_URL}/wallet.php`, {
            method: 'GET',
            headers: { 'x-api-key': CODECRAFT_API_KEY },
        })

        const data = await response.json()
        console.log('[CodeCraft Balance] API Response:', JSON.stringify(data))

        if (response.ok && data.status === 'success') {
            let balance = 0
            
            if (data.data?.wallet !== undefined) {
                balance = parseFloat(data.data.wallet) || 0
            }

            return { success: true, balance, currency: 'GHS' }
        }

        return { success: false, error: data.message || 'Failed to fetch balance' }
    } catch (error: any) {
        console.error('[CodeCraft Balance] Error:', error)
        return { success: false, error: error.message }
    }
}
