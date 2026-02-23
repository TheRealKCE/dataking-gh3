// Universal Fulfillment Service with DataKazina API Integration

const DATAKAZINA_API_KEY = process.env.DATAKAZINA_API_KEY || ''
const DATAKAZINA_API_BASE_URL = process.env.DATAKAZINA_API_BASE_URL || 'https://reseller.dakazinabusinessconsult.com/api/v1'

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
    message?: string
    error?: string
    apiResponse?: any
}

interface StatusResponse {
    success: boolean
    status: 'pending' | 'processing' | 'completed' | 'failed'
    message?: string
    data?: any
}

// DataKazina network IDs
const NETWORK_IDS: Record<string, number> = {
    'MTN': 3,
    'Telecel': 2,
    'AT-iShare': 1,
    'AT-BigTime': 1, // Usually same provider ID in DataKazina, or close enough. Will verify via dynamic fetch.
}

// Cache for bundle mappings (will be populated from API)
// Structure: { [networkId]: { [volume]: packageId } }
let bundleMappingCache: Record<number, Record<string, number>> = {}
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
 * Fetch available data packages from DataKazina and build bundle mapping for all networks
 */
export async function fetchAllBundleMappings(): Promise<Record<number, Record<string, number>>> {
    const now = Date.now()
    if (Object.keys(bundleMappingCache).length > 0 && lastBundleFetch && (now - lastBundleFetch) < BUNDLE_CACHE_DURATION) {
        return bundleMappingCache
    }

    try {
        const response = await fetch(`${DATAKAZINA_API_BASE_URL}/fetch-data-packages`, {
            method: 'GET',
            headers: { 'x-api-key': DATAKAZINA_API_KEY },
        })

        if (!response.ok) throw new Error(`Failed to fetch packages: ${response.status}`)

        const data = await response.json()
        const newCache: Record<number, Record<string, number>> = {}

        if (Array.isArray(data)) {
            data.forEach((pkg: any) => {
                if (!newCache[pkg.network_id]) newCache[pkg.network_id] = {}
                // Mapping volume string to package ID
                newCache[pkg.network_id][pkg.volumeGB] = pkg.id
            })
        }

        bundleMappingCache = newCache
        lastBundleFetch = now
        return newCache
    } catch (error) {
        console.error('[DataKazina] Error fetching bundle mappings:', error)
        return bundleMappingCache
    }
}

/**
 * Main fulfillment function for any network
 */
export async function fulfillOrder(
    network: string,
    phoneNumber: string,
    dataSize: string,
    orderId: string
): Promise<FulfillmentResponse> {
    if (!checkCircuit()) return { success: false, error: 'Service temporarily unavailable' }
    if (!DATAKAZINA_API_KEY) return { success: false, error: 'API key not configured' }

    try {
        const mappings = await fetchAllBundleMappings()
        const networkId = NETWORK_IDS[network]

        if (!networkId) {
            console.log(`[DataKazina] Skip: Unsupported network ${network}`)
            return { success: false, error: `Unsupported network: ${network}` }
        }

        const networkMappings = mappings[networkId]
        if (!networkMappings) {
            console.log(`[DataKazina] Skip: No mappings found for network ${network} (ID: ${networkId})`)
            return { success: false, error: `No packages found for network: ${network}` }
        }

        // --- SIZE NORMALIZATION ---
        // Try exact match first, then normalized numeric match
        let bundleId = networkMappings[dataSize]

        if (!bundleId) {
            const numericSize = dataSize.replace(/[^0-9]/g, '')
            bundleId = networkMappings[numericSize] || networkMappings[numericSize + 'GB'] || networkMappings[numericSize + ' GB']

            if (bundleId) {
                console.log(`[DataKazina] Normalized size "${dataSize}" to "${numericSize}" (Found ID: ${bundleId})`)
            }
        }

        if (!bundleId) {
            console.log(`[DataKazina] Skip: Unsupported size "${dataSize}" for ${network}. Available: ${Object.keys(networkMappings).join(', ')}`)
            return {
                success: false,
                error: `Unsupported data size: ${dataSize} for ${network}.`
            }
        }

        // Extract volume value for payload
        const sizeMatch = dataSize.match(/\d+/)
        const volumeValue = sizeMatch ? sizeMatch[0] : null

        if (!volumeValue) {
            console.log(`[DataKazina] Skip: Could not extract numeric volume from "${dataSize}"`)
            return { success: false, error: `Invalid data size format: ${dataSize}. Whole number expected.` }
        }

        console.log(`[DataKazina] Fulfillment Start: Order ${orderId} | Network: ${network} (${networkId}) | Package: ${dataSize} (Vol: ${volumeValue})`)
        // ---------------------------

        // Normalize phone number
        let normalizedPhone = phoneNumber
        if (normalizedPhone.startsWith('233')) normalizedPhone = '0' + normalizedPhone.slice(3)
        else if (!normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone

        const requestBody = {
            recipient_msisdn: normalizedPhone,
            network_id: networkId,
            shared_bundle: volumeValue, // Send volume (e.g. "15") instead of ID (e.g. 12)
            incoming_api_ref: orderId,
        }

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
            error: data.message || data.error || 'Fulfillment failed',
            apiResponse: data,
        }
    } catch (error: any) {
        recordFailure()
        return { success: false, error: error.message || 'Connection error' }
    }
}

export async function checkOrderStatus(transactionId: string): Promise<StatusResponse> {
    if (!checkCircuit()) return { success: false, status: 'pending', message: 'Service unavailable' }
    if (!DATAKAZINA_API_KEY) return { success: false, status: 'pending', message: 'API not configured' }

    try {
        const response = await fetch(`${DATAKAZINA_API_BASE_URL}/fetch-single-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': DATAKAZINA_API_KEY,
            },
            body: JSON.stringify({ transaction_id: transactionId }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
            recordSuccess()
            return {
                success: true,
                status: mapStatus(data.data?.status),
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
    if (['failed', 'error', 'rejected'].includes(s)) return 'failed'
    return 'processing'
}

export async function fetchSupplierBalance(): Promise<{ success: boolean; balance?: number; currency?: string; error?: string }> {
    if (!DATAKAZINA_API_KEY) return { success: false, error: 'API key not configured' }
    try {
        const response = await fetch(`${DATAKAZINA_API_BASE_URL}/check-console-balance`, {
            method: 'GET',
            headers: { 'x-api-key': DATAKAZINA_API_KEY },
        })
        const data = await response.json()

        console.log('[DataKazina Balance] API Response:', JSON.stringify(data))

        // Handle successful response
        if (response.ok) {
            let balance = 0
            let currency = 'GHS'

            // DataKazina actual response: { "Wallet Balance": "444.10", ... }
            if (data['Wallet Balance'] !== undefined) {
                balance = parseFloat(data['Wallet Balance']) || 0
            }
            // Structure 1: { success: true, data: { balance, currency } }
            else if (data.data?.balance !== undefined) {
                balance = parseFloat(data.data.balance) || 0
                currency = data.data.currency || 'GHS'
            }
            // Structure 2: { balance, currency } directly
            else if (data.balance !== undefined) {
                balance = parseFloat(data.balance) || 0
                currency = data.currency || 'GHS'
            }
            // Structure 3: { data: balance_value }
            else if (typeof data.data === 'number') {
                balance = parseFloat(data.data) || 0
            }

            return { success: true, balance, currency }
        }

        return { success: false, error: data.message || data.error || 'Failed to fetch balance' }
    } catch (error: any) {
        console.error('[DataKazina Balance] Error:', error)
        return { success: false, error: error.message }
    }
}
