import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email-service'

export async function POST(request: NextRequest) {
    try {
        const { email, name, reason } = await request.json()

        if (!email || !name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #E60000 0%, #b30000 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                    .reason-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Account Registration Update</h1>
                    </div>
                    <div class="content">
                        <h2>Dear ${name},</h2>
                        <p>Thank you for your interest in KING FLEXY DATA LTD.</p>
                        <p>Unfortunately, your account registration could not be approved at this time.</p>
                        ${reason && reason !== 'No specific reason provided' ? `
                            <div class="reason-box">
                                <strong>Reason:</strong> ${reason}
                            </div>
                        ` : ''}
                        <p>If you believe this is an error or would like more information, please contact our support team:</p>
                        <p><strong>Email:</strong> support@kingflexydataltd.com</p>
                        <p>We appreciate your understanding.</p>
                        <p>Best regards,<br>KING FLEXY DATA LTD Team</p>
                    </div>
                    <div class="footer">
                        <p>© 2026 KING FLEXY DATA LTD. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `

        await sendEmail({
            to: email,
            subject: 'Account Registration Update - KING FLEXY DATA LTD',
            htmlContent
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error sending rejection email:', error)
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
}
