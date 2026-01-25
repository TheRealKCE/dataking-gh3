import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { id, status, resolution_notes, user_id, order_ref } = body

        if (!id || !status) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const supabase = createServerClient()

        // Update complaint
        const { error: updateError } = await (supabase
            .from('complaints') as any)
            .update({
                status,
                resolution_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (updateError) throw updateError

        // Create notification
        const { error: notifyError } = await (supabase
            .from('notifications') as any)
            .insert({
                user_id,
                title: `Complaint ${status === 'resolved' ? 'Resolved' : 'Rejected'}`,
                message: `Your complaint regarding order ${order_ref} has been ${status}.`,
                type: 'complaint_resolved',
                action_url: '/dashboard/complaints'
            })

        if (notifyError) {
            console.error('Error creating notification:', notifyError)
        }

        // Send email notification
        try {
            // Fetch user email first
            const { data: userData } = await (supabase
                .from('users') as any)
                .select('email, first_name')
                .eq('id', user_id)
                .single()

            if (userData?.email) {
                const { sendComplaintResolvedEmail } = await import('@/lib/email-service')
                await sendComplaintResolvedEmail(
                    userData.email,
                    userData.first_name || 'User',
                    {
                        orderRef: order_ref,
                        status,
                        resolutionNotes: resolution_notes || ''
                    }
                )
            }
        } catch (emailError) {
            console.error('Failed to send resolution email:', emailError)
            // Don't fail the request
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error resolving complaint:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to resolve complaint' },
            { status: 500 }
        )
    }
}
