// MTN Fulfillment Service with Circuit Breaker Pattern

const MTN_API_KEY = process.env.MTN_API_KEY || ''
const MTN_API_BASE_URL = process.env.MTN_API_BASE_URL || ''

// Circuit breaker state
let circuitState: 'closed' | 'open' | 'half-open' = 'closed'
let failureCount = 0
let lastFailureTime: number | null = null
const FAILURE_THRESHOLD = 5
const RECOVERY_TIMEOUT = 60000 // 1 minute

interface MTNFulfillmentResponse {
    success: boolean
    reference?: string
    message?: string
    error?: string
}

interface MTNStatusResponse {
    success: boolean
    status: 'pending' | 'processing' | 'completed' | 'failed'
    message?: string
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
        console.log('MTN Circuit breaker opened')
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
            error: 'MTN service temporarily unavailable',
        }
    }

    try {
        // Normalize phone number
        let normalizedPhone = phoneNumber
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '233' + normalizedPhone.slice(1)
        }

        const response = await fetch(`${MTN_API_BASE_URL}/data/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MTN_API_KEY}`,
            },
            body: JSON.stringify({
                recipient: normalizedPhone,
                data_size: dataSize,
                reference: orderId,
            }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
            recordSuccess()
            return {
                success: true,
                reference: data.reference || data.transaction_id,
                message: data.message || 'Order submitted successfully',
            }
        }

        recordFailure()
        return {
            success: false,
            error: data.message || data.error || 'MTN fulfillment failed',
        }
    } catch (error) {
        recordFailure()
        console.error('MTN fulfillment error:', error)
        return {
            success: false,
            error: 'Failed to connect to MTN API',
        }
    }
}

export async function checkMTNOrderStatus(
    reference: string
): Promise<MTNStatusResponse> {
    if (!checkCircuit()) {
        return {
            success: false,
            status: 'pending',
            message: 'MTN service temporarily unavailable',
        }
    }

    try {
        const response = await fetch(`${MTN_API_BASE_URL}/data/status/${reference}`, {
            headers: {
                'Authorization': `Bearer ${MTN_API_KEY}`,
            },
        })

        const data = await response.json()

        if (response.ok) {
            recordSuccess()
            return {
                success: true,
                status: mapMTNStatus(data.status),
                message: data.message,
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
        console.error('MTN status check error:', error)
        return {
            success: false,
            status: 'pending',
            message: 'Failed to connect to MTN API',
        }
    }
}

function mapMTNStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    const lowerStatus = (status || '').toLowerCase()

    if (lowerStatus === 'success' || lowerStatus === 'completed' || lowerStatus === 'delivered') {
        return 'completed'
    }
    if (lowerStatus === 'failed' || lowerStatus === 'error' || lowerStatus === 'rejected') {
        return 'failed'
    }
    if (lowerStatus === 'processing' || lowerStatus === 'in_progress') {
        return 'processing'
    }
    return 'pending'
}

export function getCircuitState() {
    return {
        state: circuitState,
        failureCount,
        lastFailureTime,
    }
}
