/**
 * mNotify SMS Service
 * 
 * Handles sending SMS notifications via mNotify API.
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

const MNOTIFY_BASE_URL = 'https://api.mnotify.com/api/sms/quick'

/**
 * Send a quick SMS via mNotify
 */
export async function sendSMS(options: SMSOptions): Promise<SMSResult> {
    const apiKey = process.env.MNOTIFY_API_KEY
    const defaultSender = process.env.MNOTIFY_SENDER_ID || 'KingFlexy'

    if (!apiKey) {
        console.warn('MNOTIFY_API_KEY not set. SMS not sent.')
        return { success: false, error: 'SMS service not configured' }
    }

    try {
        // Normalize phone number to strict international format (233...)
        let normalizedPhone = options.recipient
            .replace(/\s+/g, '') // Remove spaces
            .replace(/-/g, '')   // Remove dashes

        if (normalizedPhone.startsWith('0') && normalizedPhone.length === 10) {
            normalizedPhone = '233' + normalizedPhone.slice(1)
        }
        // mNotify usually works without '+', but if it fails we can try adding it.
        // Based on typical Ghana SMS gateways, '233XXXXXXXXX' is the safest format.

        const payload = {
            key: apiKey,
            recipient: [normalizedPhone],
            sender: options.sender || defaultSender,
            message: options.message,
            is_schedule: false,
            schedule_date: ''
        }

        console.log(`Sending SMS to ${options.recipient}:`, options.message)

        const response = await fetch(MNOTIFY_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()

        if (data.code === '2000' || data.status === 'success') {
            console.log('SMS sent successfully:', data)
            return { success: true, messageId: data.summary?._id || 'sent' }
        } else {
            console.error('mNotify API Error:', data)
            return { success: false, error: data.message || 'Failed to send SMS' }
        }
    } catch (error: any) {
        console.error('Failed to send SMS:', error.message)
        return { success: false, error: error.message || 'Network error' }
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
    const message = `Wallet Credited! Your wallet has been credited with GHS ${details.amount.toFixed(2)}. New Balance: GHS ${details.newBalance.toFixed(2)}.`

    return sendSMS({
        recipient: phoneNumber,
        message
    })
}
