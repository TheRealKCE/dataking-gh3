import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminAccess } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 })
        }

        // Use the service role client to look up the target user's email
        const supabase = createServerClient()

        const { data: targetUser, error: userLookupError } = await (supabase
            .from('users') as any)
            .select('email, first_name, last_name')
            .eq('id', userId)
            .single()

        if (userLookupError || !targetUser) {
            console.error('[AdminResetPassword] User lookup error:', userLookupError)
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (!targetUser.email) {
            return NextResponse.json({ error: 'Target user has no email address' }, { status: 422 })
        }

        // Trigger the standard Supabase password reset email
        // This sends the user an email with a link pointing to our /auth/update-password page
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ''
        const redirectTo = `${siteUrl}/auth/update-password`

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
            targetUser.email,
            { redirectTo }
        )

        if (resetError) {
            console.error('[AdminResetPassword] Reset error:', resetError)
            return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: `Password reset email sent to ${targetUser.email}`
        })
    } catch (error: any) {
        console.error('[AdminResetPassword] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
