import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { userId } = await request.json()

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

        // Update user status to approved
        const { error: updateError } = await (supabase
            .from('users') as any)
            .update({
                account_status: 'approved',
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (updateError) {
            console.error('Error approving user:', updateError)
            return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 })
        }

        // Get user details for email
        const { data: approvedUser } = await (supabase
            .from('users') as any)
            .select('email, first_name, last_name')
            .eq('id', userId)
            .single()

        // Send approval email
        if (approvedUser) {
            try {
                await fetch(`${request.nextUrl.origin}/api/emails/approval`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: approvedUser.email,
                        name: `${approvedUser.first_name} ${approvedUser.last_name}`
                    })
                })
            } catch (emailError) {
                console.error('Failed to send approval email:', emailError)
                // Don't fail the request if email fails
            }
        }

        return NextResponse.json({
            success: true,
            message: 'User approved successfully'
        })

    } catch (error) {
        console.error('Error in approve endpoint:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
