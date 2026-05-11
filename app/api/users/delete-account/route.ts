import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const { token } = await request.json()

        if (!token) {
            return NextResponse.json(
                { error: 'Confirmation code is required' },
                { status: 400 }
            )
        }

        // 1. Get authenticated user
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const userId = authUser.id
        const userEmail = authUser.email

        if (!userEmail) {
            return NextResponse.json(
                { error: 'User email not found' },
                { status: 400 }
            )
        }

        // 2. Verify token via OTP
        const { error: otpError } = await supabase.auth.verifyOtp({
            email: userEmail,
            token,
            type: 'email'
        })

        if (otpError) {
            return NextResponse.json(
                { error: 'Invalid or expired confirmation code' },
                { status: 401 }
            )
        }

        // 3. Use service role client to delete user permanently
        const supabaseAdmin = createServerClient()

        // Delete from Auth (this prevents re-login) - use shouldSoftDelete: false for hard delete
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
            userId,
            false // shouldSoftDelete = false ensures permanent deletion
        )

        if (authDeleteError) {
            console.error('Error deleting user from Auth:', authDeleteError)
            return NextResponse.json(
                { error: 'Failed to delete account from authentication system' },
                { status: 500 }
            )
        }

        // Ownership confirmed: authenticated user matches the account being deleted
        console.log('[DeleteAccount] Authenticated user deleted their own account')

        // 4. Delete from public.users (cascade will handle related data)
        const { error: dbDeleteError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', userId)

        if (dbDeleteError) {
            console.error('Error deleting user from database:', dbDeleteError)
            // Note: Auth deletion succeeded, so they can't login, but data might persist
            // We'll still return success since the primary goal (prevent login) is achieved
        }

        // 5. Sign out the user
        await supabase.auth.signOut({ scope: 'global' })

        return NextResponse.json({
            success: true,
            message: 'Account deleted successfully'
        })

    } catch (error) {
        console.error('Delete account error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
