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

    // SMS service initialized
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

        // Sending SMS to Moolre API

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

        // Response parsed successfully

        // Success response check - Common patterns for SMS APIs
        // Moolre might return: success: true, status: 'success', code: 200, etc.
        const isSuccess =
            data.success === true ||
            data.status === 'success' ||
            data.status === 'sent' ||
            (response.status >= 200 && response.status < 300 && !data.error)

        if (isSuccess) {
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
 * Send order success SMS to account holder
 * Optimized for MTN delivery - uses stealth keywords to bypass content filters
 */
export async function sendOrderSuccessSMS(
    accountHolderPhone: string,
    details: {
        network: string
        size: string
        price: number
        recipientNumber: string
        currentBalance: number
    }
) {
    // Extract last 9 digits of phone number (remove country code)
    const recipientDisplay = details.recipientNumber.replace(/^233/, '').replace(/^0/, '')

    // Updated Template: "Your order for [Data Size] to [Recipient] has been placed and is being processed. Your new wallet balance is GH[Remaining Balance]"
    const message = `Your order for ${details.size} to ${recipientDisplay} has been placed and is being processed. Your new wallet balance is GH${details.currentBalance.toFixed(2)}

KingFlexyGh`

    return sendSMS({
        recipient: accountHolderPhone,
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
    // DISABLED AS REQUESTED
    /*
    const message = `Order Update: Your order ${details.referenceCode} is now ${details.status.toUpperCase()}. Check your dashboard for details.`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
    */
    return { success: true, messageId: 'disabled', error: undefined } // Mock success to prevent errors
}

/**
 * Send wallet top-up success SMS
 * Optimized for MTN delivery - uses stealth keywords to bypass content filters
 */
export async function sendWalletTopupSuccessSMS(
    phoneNumber: string,
    details: {
        amount: number
        newBalance: number
    }
) {
    // Updated Template: "Hello! You have added GH[Amount] to your Flexy-Wallet. Your Flexy-Wallet is now GH[New_Balance]"
    const message = `Hello! You have added GH${details.amount.toFixed(2)} to your Flexy-Wallet. Your Flexy-Wallet is now GH${details.newBalance.toFixed(2)}

KingFlexyGh`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send welcome SMS to new users
 * Optimized for MTN delivery - uses stealth keywords to bypass content filters
 */
export async function sendWelcomeSMS(
    phoneNumber: string,
    firstName: string
) {
    // DISABLED AS REQUESTED
    /*
    const message = `Hello! Welcome to KingFlexyGh Ltd. All we do here is instant Delivery (PA-TU-PA) start ordering your package now. Chat us on WhatsApp:578065809`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
    */
    return { success: true, messageId: 'disabled', error: undefined }
}
/**
 * Send Agent upgrade success SMS
 * Template: "Hi [User First Name]! Your [Plan purchase days] Upgrade to Agent Role was Successful! Your Agent role is now valid for [Remaining Agent Role Days] thank you. KingFlexyGh"
 */
/**
 * Send Agent upgrade success SMS
 * Updated Template: "Congratulations! Your Agent membership has been upgraded until [Remaining_days]"
 */
export async function sendAgentUpgradeSuccessSMS(
    phoneNumber: string,
    firstName: string,
    planDays: string,
    remainingDays: number,
    expiryDate?: string | Date // Optional for compatibility, but preferred
) {
    let formattedDate = ''

    if (expiryDate) {
        const date = new Date(expiryDate)
        // Format: "February 10th, 2026"
        const day = date.getDate()
        const month = date.toLocaleString('default', { month: 'long' })
        const year = date.getFullYear()

        // Add ordinal suffix (st, nd, rd, th)
        const suffix = ["th", "st", "nd", "rd"][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0]

        formattedDate = `${month} ${day}${suffix}, ${year}`
    } else {
        // Fallback if no specific date provided
        const date = new Date()
        date.setDate(date.getDate() + remainingDays)
        const day = date.getDate()
        const month = date.toLocaleString('default', { month: 'long' })
        const year = date.getFullYear()
        const suffix = ["th", "st", "nd", "rd"][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0]
        formattedDate = `${month} ${day}${suffix}, ${year}`
    }

    const message = `Congratulations! Your Agent membership has been upgraded until ${formattedDate}

KingFlexyGh`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send Agent Extend/Renewal Success SMS
 * Template: "Congratulations! Your Agent membership has been extended until [Formatted_Date]"
 */
export async function sendAgentExtensionSuccessSMS(
    phoneNumber: string,
    expiryDate: string | Date
) {
    const date = new Date(expiryDate)
    const day = date.getDate()
    const month = date.toLocaleString('default', { month: 'long' })
    const year = date.getFullYear()

    const suffix = ["th", "st", "nd", "rd"][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0]

    const formattedDate = `${month} ${day}${suffix}, ${year}`

    const message = `Congratulations! Your Agent membership has been extended until ${formattedDate}

KingFlexyGh`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send Admin Alert for New Agent Order
 * Template: "NEW AGENT ORDER"
 */
export async function sendAdminAgentOrderAlert() {
    // DISABLED AS REQUESTED
    /*
    // Strictly use the requested number for agent orders: 0551617309
    const targetNumber = '0551617309'

    return sendSMS({
        recipient: targetNumber,
        message: 'NEW AGENT ORDER'
    })
    */
    return { success: true, messageId: 'disabled', error: undefined } // Mock success to prevent errors
}

/**
 * Send Agent renewal reminder SMS (1 day left)
 * Template: "Hi [Agent First Name]! Your Agent Role plan is about to expire, kindly extend your plan to continue enjoying the benefits thank you. KingFlexyGh."
 */
export async function sendAgentRenewalReminderSMS(
    phoneNumber: string,
    firstName: string
) {
    // DISABLED AS REQUESTED
    /*
    const message = `Hi ${firstName}! Your Agent Role plan is about to expire, kindly extend your plan to continue enjoying the benefits thank you.

KingFlexyGh.`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
    */
    return { success: true, messageId: 'disabled', error: undefined } // Mock success to prevent errors
}

/**
 * Send SMS notification when agent subscription expires
 */
export async function sendAgentExpiryNotificationSMS(
    phoneNumber: string,
    firstName: string
) {
    const message = `Hello ${firstName},

Your Agent membership has expired. You can renew your subscription anytime to continue enjoying agent benefits.

Visit: kingflexydataltd.com/dashboard/upgrade

KingFlexyGh`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

