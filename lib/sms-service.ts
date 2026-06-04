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

const MOOLRE_BASE_URL = process.env.MOOLRE_API_URL || 'https://api.moolre.com'
const MOOLRE_SMS_ENDPOINT = '/open/sms/send'

const MNOTIFY_BASE_URL = 'https://api.mnotify.com/api/sms/quick'

function isValidApiKey(key: string | undefined): boolean {
    if (!key || key.trim() === '') return false
    const lower = key.toLowerCase()
    if (lower.includes('placeholder') || lower.includes('your_') || lower.includes('_here')) return false
    return true
}

/**
 * Validate SMS configuration on module load
 */
function validateSMSConfig() {
    if (!isValidApiKey(process.env.MOOLRE_API_KEY)) {
        console.warn('[SMS Config] WARNING: MOOLRE_API_KEY is not set or is a placeholder. Moolre SMS will use fallback.')
    }
    if (!isValidApiKey(process.env.MNOTIFY_API_KEY)) {
        console.warn('[SMS Config] WARNING: MNOTIFY_API_KEY is not set or is a placeholder. mNotify SMS features will fail.')
    }
}

// Run validation when module loads
validateSMSConfig()

/**
 * Send a quick SMS via Moolre
 */
export async function sendSMS(options: SMSOptions): Promise<SMSResult> {
    if (process.env.SMS_ENABLED === 'false') {
        console.log('[SMS Service] SMS_ENABLED=false — skipping send.')
        return { success: true, messageId: 'sms_disabled' }
    }

    const apiKey = process.env.MOOLRE_API_KEY
    const defaultSender = process.env.MOOLRE_SENDER_ID || 'ARHMS'

    if (!isValidApiKey(apiKey)) {
        console.error('[SMS Service] MOOLRE_API_KEY not configured or is a placeholder. Falling back to mNotify.')
        return await sendMnotifySMS(options)
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

        const url = MOOLRE_BASE_URL + MOOLRE_SMS_ENDPOINT

        const payload = {
            recipient: normalizedPhone,
            message: options.message,
            sender_id: options.sender || defaultSender,
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
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

        console.log('[SMS Service] Moolre response:', response.status, JSON.stringify(data))

        // Moolre uses numeric status: 1 = success, 0 = failure
        const isSuccess =
            data.status === 1 ||
            data.success === true ||
            data.status === 'success' ||
            data.status === 'sent'

        if (isSuccess) {
            const messageId = data.message_id || data.id || data.reference || data.data?.id || 'sent'
            return { success: true, messageId }
        } else {
            console.error('[SMS Service] ❌ FAILED - Moolre rejected the message')
            console.error('[SMS Service] Code:', data.code, '| Message:', data.message)

            if (data.code === 'AIN01') {
                console.error('[SMS Service] AIN01 = Authentication Error. Check: 1) MOOLRE_API_KEY is correct 2) Account has SMS credits/balance')
            }

            return { success: false, error: `Moolre error ${data.code}: ${data.message}` }
        }
    } catch (error: any) {
        console.error('[SMS Service] ❌ EXCEPTION occurred:', error.message)
        return { success: false, error: `SMS exception: ${error.message}` }
    }
}

/**
 * Send a quick SMS via mNotify
 */
export async function sendMnotifySMS(options: SMSOptions): Promise<SMSResult> {
    if (process.env.SMS_ENABLED === 'false') {
        console.log('[SMS Service] SMS_ENABLED=false — skipping mNotify send.')
        return { success: true, messageId: 'sms_disabled' }
    }

    const apiKey = process.env.MNOTIFY_API_KEY
    const defaultSender = process.env.MNOTIFY_SENDER_ID || 'ARHMSGh'

    if (!isValidApiKey(apiKey)) {
        const error = 'MNOTIFY_API_KEY not configured or is a placeholder.'
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

        const url = `${MNOTIFY_BASE_URL}?key=${apiKey}`
        
        const payload = {
            recipient: [normalizedPhone],
            sender: options.sender || defaultSender,
            message: options.message,
            is_schedule: false,
            schedule_date: ''
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const responseText = await response.text()
        let data: any
        try {
            data = JSON.parse(responseText)
        } catch (e) {
            console.error('[SMS Service] mNotify JSON parse error:', responseText)
            return { success: false, error: 'Invalid mNotify response' }
        }

        if (data.status === "success" || data.code === "2000") {
            return { success: true, messageId: data.summary?._id || 'mNotify_sent' }
        } else {
            console.error('[SMS Service] mNotify API Error:', data.message || data.error || responseText)
            return { success: false, error: data.message || data.error || 'mNotify API Error' }
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

ARHMSGh`

    // ROUTE: Moolre (Temporary fallback)
    return sendSMS({
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

ARHMSGh`

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
    const message = `Hello! Welcome to ARHMSGh Ltd. All we do here is instant Delivery (PA-TU-PA) start ordering your package now. Chat us on WhatsApp:578065809`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
    */
    return { success: true, messageId: 'disabled', error: undefined }
}
/**
 * Send Agent upgrade success SMS
 * Template: "Hi [User First Name]! Your [Plan purchase days] Upgrade to Agent Role was Successful! Your Agent role is now valid for [Remaining Agent Role Days] thank you. ARHMSGh"
 */
/**
 * Send Agent upgrade success SMS
 * Updated Template: "Congratulations! Your Agent membership has been upgraded until [Remaining_days]"
 */
export async function sendDealerUpgradeSuccessSMS(
    phoneNumber: string,
    firstName: string,
    expiryDate: string
) {
    const date = new Date(expiryDate)
    const day = date.getDate()
    const month = date.toLocaleString('default', { month: 'long' })
    const year = date.getFullYear()
    const suffix = ["th", "st", "nd", "rd"][((day % 100) > 10 && (day % 100) < 20) ? 0 : (day % 10 < 4) ? day % 10 : 0]
    const formattedDate = `${month} ${day}${suffix}, ${year}`

    const message = `Congratulations ${firstName}! You have been upgraded to Dealer on ARHMSGh. You now enjoy exclusive Dealer prices valid until ${formattedDate}. Login to start selling!\n\nARHMSGh`

    return sendSMS({ recipient: phoneNumber, message })
}

export async function sendAgentUpgradeSuccessSMS(
    phoneNumber: string,
    firstName: string,
    planDays: string,
    remainingDays: number,
    expiryDate: string
) {
    const message = `Congratulation ${firstName}! Your Agent membership has been activated for ${planDays}. You now have access to our cheapest Agent prices. Login to enjoy! \n\nARHMSGh`

    // ROUTE: Moolre (Temporary fallback)
    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Send SMS notification when an agent upgrades to the permanent plan
 */
export async function sendPermanentAgentUpgradeSuccessSMS(
    phoneNumber: string
) {
    const message = `Congratulations! Your Agent membership is now PERMANENT 👑. You have lifetime access to premium agent benefits. Thank you for choosing ARHMSGh.`

    // ROUTE: Moolre (Temporary fallback)
    return sendSMS({ recipient: phoneNumber, message })
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

ARHMSGh`

    // ROUTE: Moolre (Temporary fallback)
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
 * Template: "Hi [Agent First Name]! Your Agent Role plan is about to expire, kindly extend your plan to continue enjoying the benefits thank you. ARHMSGh."
 */
export async function sendAgentRenewalReminderSMS(
    phoneNumber: string,
    firstName: string
) {
    // DISABLED AS REQUESTED
    /*
    const message = `Hi ${firstName}! Your Agent Role plan is about to expire, kindly extend your plan to continue enjoying the benefits thank you.

ARHMSGh.`

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

ARHMSGh`

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

ARHMSGh`

    // ROUTE: Moolre (Temporary fallback)
    return sendSMS({
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
    const message = `${firstName} Great news! Your shop pricing has been approved. Your prices are now live on your shop. Visit- ARHMSgh.com/dashboard/shop

ARHMSGh`

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

ARHMSGh`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Alert 5 · Shop Profile Approved — SMS to shop owner
 */
export async function sendShopProfileApprovedSMS(
    phoneNumber: string,
    shopName: string
) {
    const message = `Congrats! Your shop "${shopName}" has been approved. You can now set your prices and go live. - ARHMSgh.com

ARHMSGh`

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
    const message = `${firstName} Your shop application was not approved. Reason: ${reason}. Log in to update your profile. - ARHMSgh.com

ARHMSGh`

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
    const message = `${firstName} Your Net Payout of GH${netAmount.toFixed(2)} has been successfully sent to your ${network} number ${momoNumber}. Thank you for selling with ARHMSGh.`

    return sendSMS({ recipient: phoneNumber, message })
}

/**
 * Alert 7b · Withdrawal Rejected — SMS to shop owner
 */
export async function sendShopWithdrawalRejectedSMS(
    phoneNumber: string,
    firstName: string
) {
    const message = `${firstName} Your withdrawal request was rejected. You can find out the reason from your withdrawal history. Please log in to your dashboard to update your payment details and resubmit. ARHMSGh`

    return sendSMS({ recipient: phoneNumber, message })
}

// ==========================================
// AIRTIME FUNCTIONS
// ==========================================

/**
 * Send beneficiary confirmation SMS when airtime order is placed
 * Triggered immediately after successful wallet deduction
 */
export async function sendAirtimeBeneficiarySMS(
    beneficiaryPhone: string,
    airtimeAmount: number
): Promise<SMSResult> {
    const message = `Your order for GH ${airtimeAmount.toFixed(2)} airtime has been received and is being processed. You will receive the confirmation sms very soon.\n\nARHMSGh`

    return sendSMS({
        recipient: beneficiaryPhone,
        message
    })
}

/**
 * Send admin alert when a new airtime order is placed (both shop and main site)
 * Sent only to admins, excluding sub-admins.
 */
export async function sendAdminAirtimeAlertSMS(
    adminPhones: string[],
    details: {
        source: string
        receiver: string
        amount: number | string
        network: string
        orderType?: 'airtime' | 'mashup'
        bundlePreference?: 'balanced' | 'data' | 'voice'
    }
): Promise<void> {
    const amountNum = typeof details.amount === 'string' ? parseFloat(details.amount) : details.amount;

    // Anti-spam: Mashup uses a different title to bypass carrier keyword filters
    const isMashup = details.orderType === 'mashup'
    const prefCodeMap: Record<string, string> = { balanced: 'B', data: 'D', voice: 'V' }
    const prefCode = isMashup && details.bundlePreference ? prefCodeMap[details.bundlePreference] || 'B' : null

    const message = isMashup
        ? `NEW MASHUP ORDER:
Source : ${details.source}
Receiver : ${details.receiver}
Amount: GH ${amountNum.toFixed(2)}
Network: ${details.network}
Pref: ${prefCode} Focus`
        : `NEW AIRTIME ORDER:
Source : ${details.source}
Receiver : ${details.receiver}
Amount: GH ${amountNum.toFixed(2)}
Network: ${details.network}`

    // Send to all provided admins in parallel
    const promises = adminPhones.map(phone => sendSMS({ recipient: phone, message }))
    await Promise.allSettled(promises)
}

/**
 * Send alert when a main site or shop airtime order is marked as completed
 */
export async function sendAirtimeCompletedSMS(
    beneficiaryPhone: string,
    amount: number
): Promise<void> {
    const message = `Dear customer, your airtime order of GH${amount.toFixed(2)} has been credited successfully. Kindly dial *124# to check your balance thank you.

ARHMSGh`

    await sendSMS({
        recipient: beneficiaryPhone,
        message
    })
}

