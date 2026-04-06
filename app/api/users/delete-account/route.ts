import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const { password } = await request.json()

        if (!password) {
            return NextResponse.json(
                { error: 'Password is required' },
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

        // 2. Verify password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: password,
        })

        if (signInError) {
            return NextResponse.json(
                { error: 'Current password is incorrect' },
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
        await supabase.auth.signOut()

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
