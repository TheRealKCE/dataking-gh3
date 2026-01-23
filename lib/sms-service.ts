// Moolre SMS Service

const MOOLRE_API_KEY = process.env.MOOLRE_API_KEY || ''
const MOOLRE_SENDER_ID = process.env.MOOLRE_SENDER_ID || 'KingFlexy'
const SMS_ENABLED = process.env.SMS_ENABLED === 'true'

interface SMSResponse {
    success: boolean
    message?: string
    error?: string
}

export async function sendSMS(
    phoneNumber: string,
    message: string
): Promise<SMSResponse> {
    if (!SMS_ENABLED) {
        console.log('SMS disabled, would send to', phoneNumber, ':', message)
        return { success: true, message: 'SMS disabled' }
    }

    try {
        // Normalize phone number to international format
        let normalizedPhone = phoneNumber
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '233' + normalizedPhone.slice(1)
        }
        if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = '+' + normalizedPhone
        }

        const response = await fetch('https://api.moolre.com/v1/sms/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MOOLRE_API_KEY}`,
            },
            body: JSON.stringify({
                to: normalizedPhone,
                from: MOOLRE_SENDER_ID,
                message: message,
            }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
            return { success: true, message: 'SMS sent successfully' }
        }

        return {
            success: false,
            error: data.message || data.error || 'Failed to send SMS',
        }
    } catch (error) {
        console.error('SMS sending error:', error)
        return {
            success: false,
            error: 'Failed to connect to SMS provider',
        }
    }
}

// SMS Templates
export function getWalletTopUpSMS(amount: number, newBalance: number): string {
    return `KING FLEXY DATA LTD: Your wallet has been credited with GHS ${amount.toFixed(2)}. New balance: GHS ${newBalance.toFixed(2)}`
}

export function getOrderSuccessSMS(phoneNumber: string, dataSize: string): string {
    return `KING FLEXY DATA LTD: ${dataSize} data has been sent to ${phoneNumber}. Thank you for using KING FLEXY DATA LTD!`
}

export function getOrderFailedSMS(phoneNumber: string, dataSize: string): string {
    return `KING FLEXY DATA LTD: Failed to send ${dataSize} to ${phoneNumber}. Please contact support or file a complaint.`
}

export function getOrderProcessingSMS(phoneNumber: string, dataSize: string): string {
    return `KING FLEXY DATA LTD: Your order for ${dataSize} to ${phoneNumber} is being processed. You will be notified when complete.`
}

export async function notifyAdmin(message: string): Promise<void> {
    // Get admin phone numbers from settings and send SMS
    // This is a placeholder - implement based on your admin notification needs
    console.log('Admin notification:', message)
}

export async function sendOrderNotification(
    userPhone: string,
    type: 'success' | 'failed' | 'processing',
    recipientPhone: string,
    dataSize: string
): Promise<SMSResponse> {
    let message: string

    switch (type) {
        case 'success':
            message = getOrderSuccessSMS(recipientPhone, dataSize)
            break
        case 'failed':
            message = getOrderFailedSMS(recipientPhone, dataSize)
            break
        case 'processing':
            message = getOrderProcessingSMS(recipientPhone, dataSize)
            break
    }

    return sendSMS(userPhone, message)
}
