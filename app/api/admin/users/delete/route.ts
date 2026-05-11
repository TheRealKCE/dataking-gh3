import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminAccess } from '@/lib/auth-utils'

export async function POST(request: Request) {
    try {
        const { userId } = await request.json()

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            )
        }

        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }
        const authUser = authResult.user!

        // Prevent self-deletion
        if (userId === authUser.id) {
            return NextResponse.json(
                { error: 'Cannot delete your own account' },
                { status: 400 }
            )
        }

        // 2. Perform deletion using service role client
        // This client relies on SUPABASE_SERVICE_ROLE_KEY in .env.local
        const supabaseAdmin = createServerClient()

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
                { error: 'Database deletion failed' },
                { status: 500 }
            )
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
                { error: 'Auth deletion failed' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('[Admin Delete] Unexpected error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
