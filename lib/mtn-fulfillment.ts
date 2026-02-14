// MTN Fulfillment Service with DataKazina API Integration

const DATAKAZINA_API_KEY = process.env.DATAKAZINA_API_KEY || ''
const DATAKAZINA_API_BASE_URL = process.env.DATAKAZINA_API_BASE_URL || 'https://reseller.dakazinabusinessconsult.com/api/v1'

// Circuit breaker state
let circuitState: 'closed' | 'open' | 'half-open' = 'closed'
let failureCount = 0
let lastFailureTime: number | null = null
const FAILURE_THRESHOLD = 5
const RECOVERY_TIMEOUT = 60000 // 1 minute

interface MTNFulfillmentResponse {
    success: boolean
    reference?: string
    transactionId?: string
    message?: string
    error?: string
    apiResponse?: any
}

interface MTNStatusResponse {
    success: boolean
    status: 'pending' | 'processing' | 'completed' | 'failed'
    message?: string
    data?: any
}

interface DataPackage {
    id: number
    network_id: number
    network_name: string
    bundle_name: string
    bundle_volume: string
    price: number
    validity: string
}

// DataKazina network ID for MTN
const NETWORK_ID_MTN = 3 // Based on the documentation

// Cache for bundle mappings (will be populated from API)
let bundleMappingCache: Record<string, number> | null = null
let lastBundleFetch: number | null = null
const BUNDLE_CACHE_DURATION = 3600000 // 1 hour

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

    // half-open - allow one request
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
        console.log('[DataKazina] Circuit breaker opened')
    }
}

/**
 * Fetch available data packages from DataKazina and build bundle mapping
 */
export async function fetchBundleMappings(): Promise<Record<string, number>> {
    // Return cached mappings if still valid
    const now = Date.now()
    if (bundleMappingCache && lastBundleFetch && (now - lastBundleFetch) < BUNDLE_CACHE_DURATION) {
        return bundleMappingCache
    }

    try {
        console.log('[DataKazina] Fetching available data packages...')
        console.log('[DataKazina] API Key:', DATAKAZINA_API_KEY ? `${DATAKAZINA_API_KEY.substring(0, 10)}...` : 'NOT SET')
        console.log('[DataKazina] API URL:', `${DATAKAZINA_API_BASE_URL}/fetch-data-packages`)

        const response = await fetch(`${DATAKAZINA_API_BASE_URL}/fetch-data-packages`, {
            method: 'GET',
            headers: {
                'x-api-key': DATAKAZINA_API_KEY,
            },
        })

        console.log('[DataKazina] Response status:', response.status)
        console.log('[DataKazina] Response ok:', response.ok)

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[DataKazina] API Error:', errorText)
            throw new Error(`Failed to fetch packages: ${response.status}`)
        }

        const data = await response.json()
        console.log('[DataKazina] Full API Response:', JSON.stringify(data, null, 2))

        // Build mapping from the response
        const mapping: Record<string, number> = {}

        // DataKazina returns a direct array, not wrapped in { data: [...] }
        if (Array.isArray(data)) {
            console.log('[DataKazina] Found', data.length, 'total packages')
            const mtnPackages = data.filter((pkg: any) => pkg.network_id === NETWORK_ID_MTN)
            console.log('[DataKazina] Found', mtnPackages.length, 'MTN packages')

            mtnPackages.forEach((pkg: any) => {
                // DataKazina uses 'volumeGB' field (e.g., "1GB", "2GB")
                console.log('[DataKazina] Mapping:', pkg.volumeGB, '→', pkg.id)
                mapping[pkg.volumeGB] = pkg.id
            })

            console.log('[DataKazina] Bundle mappings loaded:', mapping)
        } else {
            console.error('[DataKazina] Unexpected response format - expected array, got:', typeof data)
        }

        // Cache the mappings
        bundleMappingCache = mapping
        lastBundleFetch = now

        return mapping
    } catch (error) {
        console.error('[DataKazina] Error fetching bundle mappings:', error)

        // Return fallback mappings if API fails
        console.log('[DataKazina] Using fallback bundle mappings')
        return {
            '1GB': 1,
            '2GB': 2,
            '5GB': 5,
            '10GB': 10,
        }
    }
}

export async function fulfillMTNOrder(
    phoneNumber: string,
    dataSize: string,
    orderId: string
): Promise<MTNFulfillmentResponse> {
    // Check circuit breaker
    if (!checkCircuit()) {
        return {
            success: false,
            error: 'DataKazina service temporarily unavailable',
        }
    }

    // Check if API key is configured
    if (!DATAKAZINA_API_KEY) {
        console.error('[MTN Fulfillment] DATAKAZINA_API_KEY not configured')
        return {
            success: false,
            error: 'API key not configured',
        }
    }

    try {
        // Fetch bundle mappings
        const bundleMapping = await fetchBundleMappings()

        // Get bundle ID from mapping
        const bundleId = bundleMapping[dataSize]
        if (!bundleId) {
            console.error(`[MTN Fulfillment] Unknown data size: ${dataSize}`)
            console.log('[MTN Fulfillment] Available sizes:', Object.keys(bundleMapping))
            return {
                success: false,
                error: `Unsupported data size: ${dataSize}. Available: ${Object.keys(bundleMapping).join(', ')}`,
            }
        }

        // Normalize phone number - DataKazina expects format like 0551053716
        let normalizedPhone = phoneNumber
        if (normalizedPhone.startsWith('233')) {
            normalizedPhone = '0' + normalizedPhone.slice(3)
        } else if (!normalizedPhone.startsWith('0')) {
            normalizedPhone = '0' + normalizedPhone
        }

        const requestBody = {
            recipient_msisdn: normalizedPhone,
            network_id: NETWORK_ID_MTN,
            shared_bundle: bundleId,
            incoming_api_ref: orderId, // Use our order ID as the reference
        }

        console.log('[MTN Fulfillment] Sending request to DataKazina:', {
            phone: normalizedPhone,
            bundle: dataSize,
            bundleId,
            orderId,
        })

        const response = await fetch(`${DATAKAZINA_API_BASE_URL}/buy-data-package`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-api-key': DATAKAZINA_API_KEY,
            },
            body: JSON.stringify(requestBody),
        })

        const data = await response.json()

        console.log('[MTN Fulfillment] DataKazina response:', {
            status: response.status,
            data,
        })

        if (response.ok && data.success) {
            recordSuccess()
            return {
                success: true,
                reference: data.data?.reference || orderId,
                transactionId: data.data?.transaction_id,
                message: data.message || 'Order submitted successfully',
                apiResponse: data,
            }
        }

        recordFailure()
        return {
            success: false,
            error: data.message || data.error || 'DataKazina fulfillment failed',
            apiResponse: data,
        }
    } catch (error) {
        recordFailure()
        console.error('[MTN Fulfillment] Error:', error)
        return {
            success: false,
            error: 'Failed to connect to DataKazina API',
        }
    }
}

export async function checkMTNOrderStatus(
    transactionId: string
): Promise<MTNStatusResponse> {
    if (!checkCircuit()) {
        return {
            success: false,
            status: 'pending',
            message: 'DataKazina service temporarily unavailable',
        }
    }

    if (!DATAKAZINA_API_KEY) {
        return {
            success: false,
            status: 'pending',
            message: 'API key not configured',
        }
    }

    try {
        const response = await fetch(`${DATAKAZINA_API_BASE_URL}/fetch-single-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': DATAKAZINA_API_KEY,
            },
            body: JSON.stringify({
                transaction_id: transactionId,
            }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
            recordSuccess()

            // Map DataKazina status to our internal status
            const status = mapDataKazinaStatus(data.data?.status)

            return {
                success: true,
                status,
                message: data.message,
                data: data.data,
            }
        }

        recordFailure()
        return {
            success: false,
            status: 'pending',
            message: data.message || 'Failed to check status',
        }
    } catch (error) {
        recordFailure()
        console.error('[MTN Status Check] Error:', error)
        return {
            success: false,
            status: 'pending',
            message: 'Failed to connect to DataKazina API',
        }
    }
}

function mapDataKazinaStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    const lowerStatus = (status || '').toLowerCase()

    if (lowerStatus === 'success' || lowerStatus === 'completed' || lowerStatus === 'delivered') {
        return 'completed'
    }
    if (lowerStatus === 'failed' || lowerStatus === 'error' || lowerStatus === 'rejected') {
        return 'failed'
    }
    if (lowerStatus === 'processing' || lowerStatus === 'in_progress' || lowerStatus === 'pending') {
        return 'processing'
    }
    return 'pending'
}

/**
 * Fetch DataKazina Supplier/Reseller Account Balance
 * This should ONLY be called manually (e.g., when admin clicks a refresh button)
 * NEVER call this automatically or in a loop to avoid wasting CPU
 */
export async function fetchSupplierBalance(): Promise<{
    success: boolean
    balance?: number
    currency?: string
    message?: string
    error?: string
}> {
    if (!DATAKAZINA_API_KEY) {
        return {
            success: false,
            error: 'DataKazina API key not configured'
        }
    }

    try {
        console.log('[DataKazina] Fetching supplier account balance...')

        const response = await fetch(`${DATAKAZINA_API_BASE_URL}/fetch-user-account-balance`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': DATAKAZINA_API_KEY,
            },
        })

        const data = await response.json()

        console.log('[DataKazina] Balance response:', data)

        if (!response.ok) {
            return {
                success: false,
                error: data.message || data.error || 'Failed to fetch balance',
            }
        }

        // Assuming DataKazina returns: { success: true, data: { balance: 1234.56, currency: "GHS" } }
        // Adjust based on actual API response format
        if (data.success && data.data) {
            return {
                success: true,
                balance: data.data.balance || 0,
                currency: data.data.currency || 'GHS',
                message: 'Balance fetched successfully'
            }
        }

        return {
            success: false,
            error: 'Unexpected response format'
        }
    } catch (error: any) {
        console.error('[DataKazina] Error fetching balance:', error)
        return {
            success: false,
            error: error.message || 'Network error'
        }
    }
}

export function getCircuitState() {
    return {
        state: circuitState,
        failureCount,
        lastFailureTime,
    }
}

// Helper function to clear bundle cache (useful for testing)
export function clearBundleCache() {
    bundleMappingCache = null
    lastBundleFetch = null
}
