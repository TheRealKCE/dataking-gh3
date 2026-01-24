import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email-service'

/**
 * Test endpoint to debug email functionality
 * GET /api/emails/test?email=your@email.com
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const testEmail = searchParams.get('email')

    // Check environment variables
    const envCheck = {
        BREVO_API_KEY: process.env.BREVO_API_KEY ? `Set (${process.env.BREVO_API_KEY.substring(0, 10)}...)` : 'NOT SET',
        BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || 'NOT SET',
        BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || 'NOT SET',
        ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'NOT SET',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET'
    }

    // If no test email provided, just return env check
    if (!testEmail) {
        return NextResponse.json({
            message: 'Email test endpoint. Add ?email=your@email.com to send a test email.',
            environmentVariables: envCheck,
            instructions: [
                '1. Make sure BREVO_API_KEY is set in Vercel Environment Variables',
                '2. Make sure BREVO_SENDER_EMAIL is verified in Brevo dashboard',
                '3. Add ?email=your@email.com to this URL to send a test email'
            ]
        })
    }

    // Try to send a test email
    console.log('[EmailTest] Attempting to send test email to:', testEmail)
    console.log('[EmailTest] Environment check:', envCheck)

    try {
        const result = await sendWelcomeEmail(testEmail, 'Test User')

        return NextResponse.json({
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            environmentVariables: envCheck,
            testEmail: testEmail
        })
    } catch (error: any) {
        console.error('[EmailTest] Error:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error',
            errorDetails: error.response?.body || error.stack,
            environmentVariables: envCheck,
            testEmail: testEmail
        }, { status: 500 })
    }
}
