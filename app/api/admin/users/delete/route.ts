import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const { userId } = await request.json()

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            )
        }

        // 1. Verify verify requester is admin
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Check if requester is admin
        const { data: requesterData, error: requesterError } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (requesterError || requesterData?.role !== 'admin') {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 403 }
            )
        }

        // Prevent self-deletion
        if (userId === session.user.id) {
            return NextResponse.json(
                { error: 'Cannot delete your own account' },
                { status: 400 }
            )
        }

        // 2. Perform deletion using service role client
        const supabaseAdmin = createServerClient()

        // Delete from Auth (this is critical to prevent re-login)
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (authDeleteError) {
            console.error('Error deleting user from Auth:', authDeleteError)
            return NextResponse.json(
                { error: 'Failed to delete user from authentication system' },
                { status: 500 }
            )
        }

        // 3. Delete from public.users (if not handled by cascade)
        // Even if cascade is set up, explicit delete is safer
        const { error: dbDeleteError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', userId)

        if (dbDeleteError) {
            console.error('Error deleting user from database:', dbDeleteError)
            // Note: Auth deletion succeeded, so they can't login, but data might persist
            // We'll return success but log the error
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Delete user error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
