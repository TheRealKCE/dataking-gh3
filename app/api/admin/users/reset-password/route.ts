import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Only admin and sub-admin can reset other users' passwords
        const { data: callerData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (!callerData || (callerData.role !== 'admin' && callerData.role !== 'sub-admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.kingflexygh.com'
        const redirectTo = `${siteUrl}/auth/update-password`

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
            targetUser.email,
            { redirectTo }
        )

        if (resetError) {
            console.error('[AdminResetPassword] Reset error:', resetError)
            return NextResponse.json({ error: resetError.message || 'Failed to send reset email' }, { status: 500 })
        }

        console.log(`[AdminResetPassword] Reset email sent for user ${userId} (${targetUser.email}) by admin ${session.user.id}`)

        return NextResponse.json({
            success: true,
            message: `Password reset email sent to ${targetUser.email}`
        })
    } catch (error: any) {
        console.error('[AdminResetPassword] Unexpected error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
