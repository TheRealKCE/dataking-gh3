import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const { userId, status } = await request.json()

        if (!userId || !status) {
            return NextResponse.json(
                { error: 'User ID and status are required' },
                { status: 400 }
            )
        }

        if (!['active', 'suspended', 'inactive'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status. Must be active, suspended, or inactive' },
                { status: 400 }
            )
        }

        // Verify requester is admin
        const cookieStore = await cookies()
        // @ts-expect-error - auth-helpers types conflict with Next.js 15
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Check if requester is admin or sub-admin
        const { data: requesterData, error: requesterError } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (requesterError || (requesterData?.role !== 'admin' && requesterData?.role !== 'sub-admin')) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 403 }
            )
        }

        // Prevent changing own status
        if (userId === authUser.id) {
            return NextResponse.json(
                { error: 'Cannot change your own account status' },
                { status: 400 }
            )
        }

        // Use service role client for the update (bypasses RLS)
        const supabaseAdmin = createServerClient()

        // Update user status
        const { error: updateError } = await (supabaseAdmin
            .from('users') as any)
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', userId)

        if (updateError) {
            console.error('Error updating user status:', updateError)
            return NextResponse.json(
                { error: `Failed to update user status: ${updateError.message}` },
                { status: 500 }
            )
        }

        console.log('[Admin] User status updated', { status })

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Update status error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
