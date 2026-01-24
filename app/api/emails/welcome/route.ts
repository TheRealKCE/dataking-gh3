import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail, sendAdminNewUserAlert } from '@/lib/email-service'

/**
 * API route to send welcome email after user signup.
 * Also sends admin notification about new user registration.
 * This is called from the client after successful signup.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, firstName, lastName, phoneNumber } = body

        if (!email || !firstName) {
            return NextResponse.json(
                { error: 'Email and firstName are required' },
                { status: 400 }
            )
        }

        // Send welcome email to user
        const welcomeResult = await sendWelcomeEmail(email, firstName)

        if (!welcomeResult.success) {
            console.error('[WelcomeEmail] Failed to send:', welcomeResult.error)
        }

        // Send admin notification about new user (non-blocking)
        sendAdminNewUserAlert({
            firstName,
            lastName: lastName || '',
            email,
            phoneNumber: phoneNumber || 'Not provided'
        }).catch((err: Error) => console.error('[WelcomeEmail] Admin notification failed:', err))

        return NextResponse.json({
            success: true,
            messageId: welcomeResult.messageId
        })
    } catch (error: any) {
        console.error('[WelcomeEmail] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
