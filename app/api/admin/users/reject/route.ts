import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { userId, reason } = await request.json()

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => Promise.resolve(cookieStore) })

        // Verify the requester is an admin or sub-admin
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: dbUser, error: userError } = await (supabase
            .from('users') as any)
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userError || !dbUser || (dbUser.role !== 'admin' && dbUser.role !== 'sub-admin')) {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
        }

        // Get user details before updating
        const { data: rejectedUser } = await (supabase
            .from('users') as any)
            .select('email, first_name, last_name')
            .eq('id', userId)
            .single()

        // Update user status to rejected
        const { error: updateError } = await (supabase
            .from('users') as any)
            .update({
                account_status: 'rejected',
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (updateError) {
            console.error('Error rejecting user:', updateError)
            return NextResponse.json({ error: 'Failed to reject user' }, { status: 500 })
        }

        // Send rejection email
        if (rejectedUser) {
            try {
                await fetch(`${request.nextUrl.origin}/api/emails/rejection`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: rejectedUser.email,
                        name: `${rejectedUser.first_name} ${rejectedUser.last_name}`,
                        reason: reason || 'No specific reason provided'
                    })
                })
            } catch (emailError) {
                console.error('Failed to send rejection email:', emailError)
                // Don't fail the request if email fails
            }
        }

        return NextResponse.json({
            success: true,
            message: 'User rejected successfully'
        })

    } catch (error) {
        console.error('Error in reject endpoint:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
