/**
 * Brevo Email Service
 * 
 * This service handles all transactional emails using Brevo (formerly Sendinblue).
 * It provides reusable functions for sending various types of emails.
 */

// @ts-ignore - Brevo SDK doesn't have type definitions
import * as SibApiV3Sdk from '@getbrevo/brevo'

// Initialize API instance
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
const apiKey = apiInstance.authentications['apiKey']
apiKey.apiKey = process.env.BREVO_API_KEY || ''

// Sender configuration
const DEFAULT_SENDER = {
    name: process.env.BREVO_SENDER_NAME || 'KING FLEXY DATA LTD',
    email: process.env.BREVO_SENDER_EMAIL || 'noreply@kingflexydata.com'
}

// Email types for tracking
export type EmailType =
    | 'welcome'
    | 'order_confirmation'
    | 'order_completed'
    | 'order_failed'
    | 'wallet_credited'
    | 'wallet_debited'
    | 'payment_success'
    | 'password_reset'
    | 'complaint_resolved'
    | 'admin_alert'

interface SendEmailOptions {
    to: string
    toName?: string
    subject: string
    htmlContent: string
    textContent?: string
    templateId?: number
    params?: Record<string, string | number>
}

interface EmailResult {
    success: boolean
    messageId?: string
    error?: string
}

/**
 * Core function to send transactional email via Brevo
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    if (!process.env.BREVO_API_KEY) {
        console.warn('BREVO_API_KEY not set. Email not sent.')
        return { success: false, error: 'Email service not configured' }
    }

    try {
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()

        sendSmtpEmail.sender = DEFAULT_SENDER
        sendSmtpEmail.to = [{ email: options.to, name: options.toName || options.to }]
        sendSmtpEmail.subject = options.subject

        // Use template if provided, otherwise use HTML content
        if (options.templateId) {
            sendSmtpEmail.templateId = options.templateId
            sendSmtpEmail.params = options.params || {}
        } else {
            sendSmtpEmail.htmlContent = options.htmlContent
            if (options.textContent) {
                sendSmtpEmail.textContent = options.textContent
            }
        }

        const data = await apiInstance.sendTransacEmail(sendSmtpEmail)
        console.log('Email sent successfully:', data.messageId)

        return { success: true, messageId: data.messageId }
    } catch (error: any) {
        console.error('Failed to send email:', error.response?.body || error.message)
        return {
            success: false,
            error: error.response?.body?.message || error.message || 'Failed to send email'
        }
    }
}

/**
 * Generate base HTML email template with consistent branding
 */
function generateEmailTemplate(title: string, content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #facc15;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
        }
        .header .tagline {
            color: #fff;
            font-size: 14px;
            margin-top: 5px;
            opacity: 0.8;
        }
        .content {
            padding: 30px;
        }
        .content h2 {
            color: #1a1a2e;
            margin-top: 0;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
            color: #1a1a2e !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 15px 0;
        }
        .info-box {
            background-color: #f8f9fa;
            border-left: 4px solid #facc15;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .footer {
            background-color: #1a1a2e;
            color: #fff;
            padding: 20px;
            text-align: center;
            font-size: 12px;
        }
        .footer a {
            color: #facc15;
            text-decoration: none;
        }
        .highlight {
            color: #facc15;
            font-weight: bold;
        }
        .amount {
            font-size: 28px;
            font-weight: bold;
            color: #16a34a;
        }
        .status-success { color: #16a34a; }
        .status-failed { color: #dc2626; }
        .status-pending { color: #ca8a04; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>KING FLEXY DATA LTD</h1>
            <div class="tagline">Your Trusted Data Provider</div>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} KING FLEXY DATA LTD. All rights reserved.</p>
            <p>
                Need help? <a href="mailto:support@kingflexydata.com">Contact Support</a> | 
                <a href="https://kingflexydata.com">Visit Website</a>
            </p>
        </div>
    </div>
</body>
</html>`
}

// ==========================================
// TRANSACTIONAL EMAIL FUNCTIONS
// ==========================================

/**
 * Send welcome email after user registration
 */
export async function sendWelcomeEmail(
    email: string,
    firstName: string
): Promise<EmailResult> {
    const content = `
        <h2>Welcome to KING FLEXY DATA LTD, ${firstName}! 🎉</h2>
        <p>Thank you for creating an account with us. You're now part of Ghana's most trusted data reseller platform.</p>
        
        <div class="info-box">
            <strong>What you can do now:</strong>
            <ul>
                <li>💰 Fund your wallet via Paystack</li>
                <li>📱 Buy affordable MTN, Telecel, and AirtelTigo data bundles</li>
                <li>👥 Manage your customer numbers</li>
                <li>📊 Track all your orders in real-time</li>
            </ul>
        </div>
        
        <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">
                Go to Dashboard
            </a>
        </p>
        
        <p>If you have any questions, our support team is always here to help.</p>
        <p>Happy data buying! 📶</p>
    `

    return sendEmail({
        to: email,
        toName: firstName,
        subject: `Welcome to KING FLEXY DATA LTD, ${firstName}! 🎉`,
        htmlContent: generateEmailTemplate('Welcome', content)
    })
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(
    email: string,
    firstName: string,
    orderDetails: {
        referenceCode: string
        phoneNumber: string
        network: string
        size: string
        price: number
    }
): Promise<EmailResult> {
    const content = `
        <h2>Order Confirmed! 📱</h2>
        <p>Hi ${firstName},</p>
        <p>Your data order has been received and is being processed.</p>
        
        <div class="info-box">
            <h3 style="margin-top: 0;">Order Details</h3>
            <p><strong>Reference:</strong> ${orderDetails.referenceCode}</p>
            <p><strong>Recipient:</strong> ${orderDetails.phoneNumber}</p>
            <p><strong>Network:</strong> ${orderDetails.network}</p>
            <p><strong>Package:</strong> ${orderDetails.size}</p>
            <p><strong>Amount:</strong> <span class="highlight">GHS ${orderDetails.price.toFixed(2)}</span></p>
        </div>
        
        <p>You will receive a notification once the data has been delivered to the recipient's number.</p>
        
        <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/my-orders" class="button">
                Track Order
            </a>
        </p>
    `

    return sendEmail({
        to: email,
        toName: firstName,
        subject: `Order Confirmed - ${orderDetails.referenceCode}`,
        htmlContent: generateEmailTemplate('Order Confirmation', content)
    })
}

/**
 * Send order completion email
 */
export async function sendOrderCompletedEmail(
    email: string,
    firstName: string,
    orderDetails: {
        referenceCode: string
        phoneNumber: string
        network: string
        size: string
    }
): Promise<EmailResult> {
    const content = `
        <h2 class="status-success">Order Completed! ✅</h2>
        <p>Hi ${firstName},</p>
        <p>Great news! Your data order has been successfully delivered.</p>
        
        <div class="info-box">
            <h3 style="margin-top: 0;">Delivery Details</h3>
            <p><strong>Reference:</strong> ${orderDetails.referenceCode}</p>
            <p><strong>Recipient:</strong> ${orderDetails.phoneNumber}</p>
            <p><strong>Network:</strong> ${orderDetails.network}</p>
            <p><strong>Package:</strong> ${orderDetails.size}</p>
            <p><strong>Status:</strong> <span class="status-success">DELIVERED</span></p>
        </div>
        
        <p>The recipient can now use the data immediately. Thank you for choosing KING FLEXY DATA LTD!</p>
        
        <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/data-packages" class="button">
                Buy More Data
            </a>
        </p>
    `

    return sendEmail({
        to: email,
        toName: firstName,
        subject: `Order Delivered - ${orderDetails.referenceCode} ✅`,
        htmlContent: generateEmailTemplate('Order Completed', content)
    })
}

/**
 * Send order failed email
 */
export async function sendOrderFailedEmail(
    email: string,
    firstName: string,
    orderDetails: {
        referenceCode: string
        phoneNumber: string
        network: string
        size: string
        reason?: string
    }
): Promise<EmailResult> {
    const content = `
        <h2 class="status-failed">Order Failed ❌</h2>
        <p>Hi ${firstName},</p>
        <p>Unfortunately, we were unable to process your data order.</p>
        
        <div class="info-box">
            <h3 style="margin-top: 0;">Order Details</h3>
            <p><strong>Reference:</strong> ${orderDetails.referenceCode}</p>
            <p><strong>Recipient:</strong> ${orderDetails.phoneNumber}</p>
            <p><strong>Network:</strong> ${orderDetails.network}</p>
            <p><strong>Package:</strong> ${orderDetails.size}</p>
            <p><strong>Status:</strong> <span class="status-failed">FAILED</span></p>
            ${orderDetails.reason ? `<p><strong>Reason:</strong> ${orderDetails.reason}</p>` : ''}
        </div>
        
        <p>Please file a complaint to request a refund. Our team will review and process it promptly.</p>
        
        <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/my-orders" class="button">
                File Complaint
            </a>
        </p>
    `

    return sendEmail({
        to: email,
        toName: firstName,
        subject: `Order Failed - ${orderDetails.referenceCode}`,
        htmlContent: generateEmailTemplate('Order Failed', content)
    })
}

/**
 * Send wallet credit confirmation email
 */
export async function sendWalletCreditEmail(
    email: string,
    firstName: string,
    amount: number,
    newBalance: number,
    source: string
): Promise<EmailResult> {
    const content = `
        <h2>Wallet Credited! 💰</h2>
        <p>Hi ${firstName},</p>
        <p>Your wallet has been successfully credited.</p>
        
        <div style="text-align: center; padding: 20px;">
            <p style="margin-bottom: 5px;">Amount Credited</p>
            <p class="amount">+ GHS ${amount.toFixed(2)}</p>
        </div>
        
        <div class="info-box">
            <p><strong>Source:</strong> ${source}</p>
            <p><strong>New Balance:</strong> <span class="highlight">GHS ${newBalance.toFixed(2)}</span></p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/data-packages" class="button">
                Buy Data Now
            </a>
        </p>
    `

    return sendEmail({
        to: email,
        toName: firstName,
        subject: `Wallet Credited - GHS ${amount.toFixed(2)}`,
        htmlContent: generateEmailTemplate('Wallet Credited', content)
    })
}

/**
 * Send payment successful email (Paystack)
 */
export async function sendPaymentSuccessEmail(
    email: string,
    firstName: string,
    amount: number,
    reference: string
): Promise<EmailResult> {
    const content = `
        <h2 class="status-success">Payment Successful! ✅</h2>
        <p>Hi ${firstName},</p>
        <p>Your payment has been processed successfully and your wallet has been credited.</p>
        
        <div style="text-align: center; padding: 20px;">
            <p style="margin-bottom: 5px;">Amount Paid</p>
            <p class="amount">GHS ${amount.toFixed(2)}</p>
        </div>
        
        <div class="info-box">
            <p><strong>Reference:</strong> ${reference}</p>
            <p><strong>Payment Method:</strong> Paystack</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p>You can now use your wallet balance to purchase data bundles.</p>
        
        <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet" class="button">
                View Wallet
            </a>
        </p>
    `

    return sendEmail({
        to: email,
        toName: firstName,
        subject: `Payment Successful - GHS ${amount.toFixed(2)}`,
        htmlContent: generateEmailTemplate('Payment Success', content)
    })
}

/**
 * Send complaint resolved email
 */
export async function sendComplaintResolvedEmail(
    email: string,
    firstName: string,
    complaintDetails: {
        complaintId: string
        title: string
        resolution: string
        refundAmount?: number
    }
): Promise<EmailResult> {
    const content = `
        <h2 class="status-success">Complaint Resolved ✅</h2>
        <p>Hi ${firstName},</p>
        <p>Your complaint has been reviewed and resolved by our team.</p>
        
        <div class="info-box">
            <h3 style="margin-top: 0;">Complaint Details</h3>
            <p><strong>Title:</strong> ${complaintDetails.title}</p>
            <p><strong>Resolution:</strong> ${complaintDetails.resolution}</p>
            ${complaintDetails.refundAmount ? `<p><strong>Refund Amount:</strong> <span class="status-success">GHS ${complaintDetails.refundAmount.toFixed(2)}</span></p>` : ''}
        </div>
        
        <p>Thank you for your patience. We value your business and are committed to providing you with the best service.</p>
        
        <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/complaints" class="button">
                View Complaints
            </a>
        </p>
    `

    return sendEmail({
        to: email,
        toName: firstName,
        subject: `Complaint Resolved - ${complaintDetails.title}`,
        htmlContent: generateEmailTemplate('Complaint Resolved', content)
    })
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetLink: string
): Promise<EmailResult> {
    const content = `
        <h2>Reset Your Password 🔐</h2>
        <p>Hi ${firstName},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        
        <p style="text-align: center;">
            <a href="${resetLink}" class="button">
                Reset Password
            </a>
        </p>
        
        <div class="info-box">
            <p><strong>⚠️ Important:</strong></p>
            <ul>
                <li>This link expires in 1 hour</li>
                <li>If you didn't request this, please ignore this email</li>
                <li>Never share this link with anyone</li>
            </ul>
        </div>
        
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; font-size: 12px; color: #666;">${resetLink}</p>
    `

    return sendEmail({
        to: email,
        toName: firstName,
        subject: 'Reset Your Password - KING FLEXY DATA LTD',
        htmlContent: generateEmailTemplate('Password Reset', content)
    })
}

/**
 * Send admin alert email (for critical system events)
 */
export async function sendAdminAlertEmail(
    alertTitle: string,
    alertMessage: string,
    details?: Record<string, string>
): Promise<EmailResult> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@kingflexydata.com'

    let detailsHtml = ''
    if (details) {
        detailsHtml = '<div class="info-box"><h4>Details:</h4>'
        for (const [key, value] of Object.entries(details)) {
            detailsHtml += `<p><strong>${key}:</strong> ${value}</p>`
        }
        detailsHtml += '</div>'
    }

    const content = `
        <h2>⚠️ Admin Alert</h2>
        <h3>${alertTitle}</h3>
        <p>${alertMessage}</p>
        
        ${detailsHtml}
        
        <div class="info-box">
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
        </div>
        
        <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin" class="button">
                Go to Admin Panel
            </a>
        </p>
    `

    return sendEmail({
        to: adminEmail,
        subject: `[ALERT] ${alertTitle}`,
        htmlContent: generateEmailTemplate('Admin Alert', content)
    })
}
