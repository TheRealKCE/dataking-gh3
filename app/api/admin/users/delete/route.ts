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
        // @ts-expect-error - auth-helpers types conflict with Next.js 15
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

        if (requesterError || (requesterData?.role !== 'admin' && requesterData?.role !== 'sub-admin')) {
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
        // This client relies on SUPABASE_SERVICE_ROLE_KEY in .env.local
        const supabaseAdmin = createServerClient()

        console.log(`[Admin Delete] Attempting to delete user ${userId}`)

        // Step A: Delete from public.users first (Database Layer)
        // Although we have ON DELETE CASCADE, explicit delete ensures we know it worked
        // and handles cases where cascade might fail or be missing
        const { error: dbDeleteError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', userId)

        if (dbDeleteError) {
            console.error('[Admin Delete] Database deletion failed:', dbDeleteError)
            return NextResponse.json(
                { error: `Database deletion failed: ${dbDeleteError.message}` },
                { status: 500 }
            )
        } else {
            console.log('[Admin Delete] Database record deleted (or will be cascaded)')
        }

        // Step B: Delete from Auth (Authentication Layer)
        // This invalidates sessions and removes the auth user
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
            userId
        )

        if (authDeleteError) {
            console.error('[Admin Delete] Auth deletion failed:', authDeleteError)
            // If DB delete worked but Auth failed, we have an inconsistent state
            // But usually, if DB delete worked, Auth delete is less likely to fail unless ID is wrong
            return NextResponse.json(
                { error: `Auth deletion failed: ${authDeleteError.message}` },
                { status: 500 }
            )
        }

        console.log('[Admin Delete] User successfully deleted from Auth and DB')

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('[Admin Delete] Unexpected error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
