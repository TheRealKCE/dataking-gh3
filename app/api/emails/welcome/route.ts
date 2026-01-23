import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email-service'

/**
 * API route to send welcome email after user signup.
 * This is called from the client after successful signup.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, firstName } = body

        if (!email || !firstName) {
            return NextResponse.json(
                { error: 'Email and firstName are required' },
                { status: 400 }
            )
        }

        const result = await sendWelcomeEmail(email, firstName)

        if (!result.success) {
            console.error('[WelcomeEmail] Failed to send:', result.error)
            return NextResponse.json(
                { error: 'Failed to send welcome email' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, messageId: result.messageId })
    } catch (error: any) {
        console.error('[WelcomeEmail] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
