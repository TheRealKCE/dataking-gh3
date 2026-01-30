import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email-service'

export async function POST(request: NextRequest) {
    try {
        const { email, name } = await request.json()

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
                    .header { background: linear-gradient(135deg, #0056B3 0%, #003d82 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; padding: 12px 30px; background: #25D366; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Account Approved!</h1>
                    </div>
                    <div class="content">
                        <h2>Welcome to KING FLEXY DATA LTD, ${name}!</h2>
                        <p>Great news! Your account has been approved by our admin team.</p>
                        <p>You can now login and start using our services:</p>
                        <ul>
                            <li>Purchase data packages</li>
                            <li>Top up your wallet</li>
                            <li>Track your orders</li>
                            <li>And much more!</li>
                        </ul>
                        <div style="text-align: center;">
                            <a href="${process.env.NEXTAUTH_URL || 'https://your-domain.com'}/auth/login" class="button">Login Now</a>
                        </div>
                        <p>If you have any questions, feel free to contact our support team.</p>
                        <p>Best regards,<br>KING FLEXY DATA LTD Team</p>
                    </div>
                    <div class="footer">
                        <p>© 2026 KING FLEXY DATA LTD. All rights reserved.</p>
                        <p>Contact: support@kingflexydataltd.com</p>
                    </div>
                </div>
            </body>
            </html>
        `

        await sendEmail({
            to: email,
            subject: 'Account Approved - Welcome to KING FLEXY DATA LTD',
            htmlContent
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error sending approval email:', error)
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
}
