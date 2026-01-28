/**
 * Moolre SMS Service
 * 
 * Handles sending SMS notifications via Moolre API.
 */

interface SMSOptions {
    recipient: string
    message: string
    sender?: string
}

interface SMSResult {
    success: boolean
    messageId?: string
    error?: string
}

const MOOLRE_BASE_URL = 'https://api.moolre.com'
const MOOLRE_SMS_ENDPOINT = '/open/sms/send' // Correct endpoint from Moolre documentation

/**
 * Validate SMS configuration on module load
 */
function validateSMSConfig() {
    const apiKey = process.env.MOOLRE_API_KEY
    const senderId = process.env.MOOLRE_SENDER_ID

    if (!apiKey) {
        console.error('[SMS Config] CRITICAL: MOOLRE_API_KEY is not set in environment variables!')
        console.error('[SMS Config] Get your API key from: https://app.moolre.com → Profile → Security → API Key')
    }
    if (!senderId) {
        console.warn('[SMS Config] WARNING: MOOLRE_SENDER_ID is not set, will use default')
    }

    console.log('[SMS Config] Moolre SMS Service Initialized:', {
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'NOT SET',
        senderId: senderId || 'NOT SET',
        endpoint: MOOLRE_BASE_URL + MOOLRE_SMS_ENDPOINT
    })
}

// Run validation when module loads
validateSMSConfig()

/**
 * Send a quick SMS via Moolre
 */
export async function sendSMS(options: SMSOptions): Promise<SMSResult> {
    const apiKey = process.env.MOOLRE_API_KEY
    const defaultSender = process.env.MOOLRE_SENDER_ID || 'GHDATA'

    // Strict validation - no fallback
    if (!apiKey) {
        const error = 'MOOLRE_API_KEY not configured in environment variables. Get it from https://app.moolre.com'
        console.error('[SMS Service] ERROR:', error)
        return { success: false, error }
    }

    try {
        // Normalize phone number to strict international format (233...)
        let normalizedPhone = options.recipient
            .replace(/\s+/g, '') // Remove spaces
            .replace(/-/g, '')   // Remove dashes
            .replace(/\+/g, '')  // Remove plus sign

        // Convert 0XXXXXXXXX to 233XXXXXXXXX
        if (normalizedPhone.startsWith('0') && normalizedPhone.length === 10) {
            normalizedPhone = '233' + normalizedPhone.slice(1)
        }

        // Ensure it starts with 233
        if (!normalizedPhone.startsWith('233')) {
            console.error('[SMS Service] Invalid phone format:', options.recipient)
            return { success: false, error: 'Phone number must be in Ghana format (0XXXXXXXXX or 233XXXXXXXXX)' }
        }

        // Build the full URL
        const url = MOOLRE_BASE_URL + MOOLRE_SMS_ENDPOINT

        // Generate a unique reference for tracking
        const reference = `SMS-${Date.now()}-${Math.random().toString(36).substring(7)}`

        // Moolre API payload format (exact format from documentation)
        const payload = {
            type: 1,  // Type 1 for sending SMS
            senderid: options.sender || defaultSender,
            messages: [
                {
                    recipient: normalizedPhone,
                    message: options.message,
                    ref: reference  // Unique reference for this message
                }
            ]
        }

        console.log('[SMS Service] Sending SMS via Moolre:', {
            to: normalizedPhone,
            sender: payload.senderid,
            messageLength: options.message.length,
            endpoint: url,
            reference: reference
        })
        console.log('[SMS Service] Full payload:', JSON.stringify(payload, null, 2))

        // Moolre uses X-API-KEY and X-API-VASKEY headers for authentication
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-API-KEY': apiKey,
                'X-API-VASKEY': apiKey  // Moolre also uses VASKEY (same as API key)
            },
            body: JSON.stringify(payload)
        })

        const responseText = await response.text()
        console.log('[SMS Service] Raw response:', responseText)
        console.log('[SMS Service] Response status:', response.status)
        console.log('[SMS Service] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))

        let data: any
        try {
            data = JSON.parse(responseText)
        } catch (parseError) {
            console.error('[SMS Service] Failed to parse response as JSON:', parseError)

            // Check if it's an HTML error page (common when endpoint is wrong)
            if (responseText.toLowerCase().includes('<!doctype') || responseText.toLowerCase().includes('<html')) {
                return {
                    success: false,
                    error: 'Invalid API endpoint - received HTML instead of JSON. Please verify the Moolre SMS endpoint.'
                }
            }

            return {
                success: false,
                error: `Invalid API response: ${responseText.substring(0, 100)}`
            }
        }

        console.log('[SMS Service] Parsed response:', JSON.stringify(data, null, 2))

        // Success response check - Common patterns for SMS APIs
        // Moolre might return: success: true, status: 'success', code: 200, etc.
        const isSuccess =
            data.success === true ||
            data.status === 'success' ||
            data.status === 'sent' ||
            (response.status >= 200 && response.status < 300 && !data.error)

        if (isSuccess) {
            console.log('[SMS Service] ✅ SUCCESS - SMS sent successfully via Moolre')
            const messageId = data.message_id || data.id || data.reference || 'sent'
            return { success: true, messageId }
        } else {
            // Log failure details
            console.error('[SMS Service] ❌ FAILED - Moolre rejected the message')
            console.error('[SMS Service] Error data:', JSON.stringify(data, null, 2))
            console.error('[SMS Service] Status code:', response.status)

            // Extract error message from various possible formats
            const errorMessage =
                data.message ||
                data.error ||
                data.error_message ||
                data.msg ||
                `Moolre API error (status ${response.status})`

            return {
                success: false,
                error: errorMessage
            }
        }
    } catch (error: any) {
        console.error('[SMS Service] ❌ EXCEPTION occurred:', error)
        console.error('[SMS Service] Exception message:', error.message)
        console.error('[SMS Service] Exception stack:', error.stack)
        return {
            success: false,
            error: `Network or system error: ${error.message}`
        }
    }
}

// ==========================================
// SPECIFIC SMS FUNCTIONS
// ==========================================

/**
 * Send order success SMS
 */
export async function sendOrderSuccessSMS(
    phoneNumber: string,
    details: {
        referenceCode: string
        size: string
        network: string
    }
) {
    const message = `Order Confirmed! Your purchase of ${details.size} data for ${details.network} has been received. Reference: ${details.referenceCode}. Thanks for choosing King Flexy Data.`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send status update SMS
 */
export async function sendStatusUpdateSMS(
    phoneNumber: string,
    details: {
        referenceCode: string
        status: string
    }
) {
    const message = `Order Update: Your order ${details.referenceCode} is now ${details.status.toUpperCase()}. Check your dashboard for details.`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send wallet top-up success SMS
 */
export async function sendWalletTopupSuccessSMS(
    phoneNumber: string,
    details: {
        amount: number
        newBalance: number
    }
) {
    const message = `Your wallet has been credited with GHS${details.amount.toFixed(2)} successfully. Your new balance is GHS${details.newBalance.toFixed(2)}

KING FLEXY DATA LTD`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}
