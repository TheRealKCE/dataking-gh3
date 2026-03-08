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

const MNOTIFY_BASE_URL = 'https://apps.mnotify.net/smsapi'

/**
 * Validate SMS configuration on module load
 */
function validateSMSConfig() {
    const moolreApiKey = process.env.MOOLRE_API_KEY
    const mnotifyApiKey = process.env.MNOTIFY_API_KEY

    if (!moolreApiKey) {
        console.warn('[SMS Config] WARNING: MOOLRE_API_KEY is not set. Moolre SMS features will fail.')
    }
    if (!mnotifyApiKey) {
        console.warn('[SMS Config] WARNING: MNOTIFY_API_KEY is not set. mNotify SMS features will fail.')
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

/**
 * Send a quick SMS via mNotify
 */
export async function sendMnotifySMS(options: SMSOptions): Promise<SMSResult> {
    const apiKey = process.env.MNOTIFY_API_KEY
    const defaultSender = process.env.MNOTIFY_SENDER_ID || 'KingFlexyGh'

    if (!apiKey) {
        const error = 'MNOTIFY_API_KEY not configured in environment variables.'
        console.error('[SMS Service] ERROR:', error)
        return { success: false, error }
    }

    try {
        let normalizedPhone = options.recipient
            .replace(/\s+/g, '')
            .replace(/-/g, '')
            .replace(/\+/g, '')

        if (normalizedPhone.startsWith('233')) {
            normalizedPhone = '0' + normalizedPhone.slice(3)
        }

        const url = `${MNOTIFY_BASE_URL}?key=${apiKey}&to=${normalizedPhone}&msg=${encodeURIComponent(options.message)}&sender_id=${encodeURIComponent(options.sender || defaultSender)}`

        const response = await fetch(url, {
            method: 'GET'
        })

        const responseText = await response.text()
        let data: any
        try {
            data = JSON.parse(responseText)
        } catch (e) {
            console.error('[SMS Service] mNotify JSON parse error:', responseText)
            return { success: false, error: 'Invalid mNotify response' }
        }

        if (data.status === "1000" || data.code === "1000") {
            return { success: true, messageId: 'mNotify_sent' }
        } else {
            console.error('[SMS Service] mNotify API Error:', data.message || responseText)
            return { success: false, error: data.message || 'mNotify API Error' }
        }
    } catch (error: any) {
        console.error('[SMS Service] mNotify Exception:', error.message)
        return { success: false, error: `System error: ${error.message}` }
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
    // Updated Template: "Your order for [Data Size] has been received and is being processed. You will receive your data in less than 1hr thank you."
    const message = `Your order for ${details.size} has been received and is being processed. You will receive your data in less than 1hr thank you.

KingFlexyGh`

    // ROUTE: mNotify
    return sendMnotifySMS({
        recipient: details.recipientNumber,
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

    // ROUTE: Moolre
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
    expiryDate: string
) {
    const message = `Congratulation ${firstName}! Your Agent membership has been activated for ${planDays}. You now have access to our cheapest Agent prices. Login to enjoy! \n\nKingFlexyGh`

    // ROUTE: mNotify
    return sendMnotifySMS({ recipient: phoneNumber, message })
}

/**
 * Send SMS notification when an agent upgrades to the permanent plan
 */
export async function sendPermanentAgentUpgradeSuccessSMS(
    phoneNumber: string
) {
    const message = `Congratulations! Your Agent membership is now PERMANENT 👑. You have lifetime access to premium agent benefits. Thank you for choosing KingFlexyGh.`

    // ROUTE: mNotify
    return sendMnotifySMS({ recipient: phoneNumber, message })
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

    // ROUTE: mNotify
    return sendMnotifySMS({
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
    const message = `Dear valued customer, your Agent membership has expired. You can renew your subscription anytime to continue enjoying agent benefits thank you.

KingFlexyGh`

    // ROUTE: Moolre
    return sendSMS({
        recipient: phoneNumber,
        message
    })
}

/**
 * Send SMS notification when an order is refunded
 */
export async function sendOrderRefundSMS(
    phoneNumber: string,
    recipientNumber: string,
    refundAmount: number,
    newBalance: number
) {
    // Format recipient number - remove country code prefix for display
    const displayNumber = recipientNumber.replace(/^233/, '').replace(/^0/, '')

    const message = `Your order for ${displayNumber} has been refunded due to an error. Refund was GH${refundAmount.toFixed(2)}. Your new Flexy-wallet is now GH${newBalance.toFixed(2)} thank you.

KingFlexyGh`

    // ROUTE: mNotify
    return sendMnotifySMS({
        recipient: phoneNumber,
        message
    })
}

// ==========================================
// SHOP ALERT SMS FUNCTIONS
// ==========================================

/**
 * Alert 3 · Pricing Approved — SMS to shop owner
 */
export async function sendShopPricingApprovedSMS(
    phoneNumber: string,
    firstName: string
) {
    const message = `${firstName} Great news! Your shop pricing has been approved. Your prices are now live on your shop. Visit- kingflexygh.com/dashboard/shop

KingFlexyGh`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Alert 4 · Pricing Rejected — SMS to shop owner
 */
export async function sendShopPricingRejectedSMS(
    phoneNumber: string,
    firstName: string,
    reason: string
) {
    const message = `${firstName} Your shop pricing was not approved. Reason: ${reason}. Please log in and resubmit a new one.

KingFlexyGh`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Alert 5 · Shop Profile Approved — SMS to shop owner
 */
export async function sendShopProfileApprovedSMS(
    phoneNumber: string,
    shopName: string
) {
    const message = `Congrats! Your shop "${shopName}" has been approved. You can now set your prices and go live. - kingflexygh.com

KingFlexyGh`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Alert 6 · Shop Profile Rejected — SMS to shop owner
 */
export async function sendShopProfileRejectedSMS(
    phoneNumber: string,
    firstName: string,
    reason: string
) {
    const message = `${firstName} Your shop application was not approved. Reason: ${reason}. Log in to update your profile. - kingflexygh.com

KingFlexyGh`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Alert 7 · Withdrawal Processed (Paid) — SMS to shop owner
 */
export async function sendShopWithdrawalProcessedSMS(
    phoneNumber: string,
    firstName: string,
    netAmount: number,
    network: string,
    momoNumber: string
) {
    const message = `${firstName} Your Net Payout of GH${netAmount.toFixed(2)} has been successfully sent to your ${network} number ${momoNumber}. Thank you for selling with KingFlexyGh.`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Alert 7b · Withdrawal Rejected — SMS to shop owner
 */
export async function sendShopWithdrawalRejectedSMS(
    phoneNumber: string,
    firstName: string
) {
    const message = `${firstName} Your withdrawal request was rejected. You can find out the reason from your withdrawal history. Please log in to your dashboard to update your payment details and resubmit. KingFlexyGh`

    return sendSMS({ recipient: phoneNumber, message })
}
