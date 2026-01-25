import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { sendAdminNewComplaintAlert } from '@/lib/email-service'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { order_id, title, description, priority = 'medium' } = body

        if (!order_id || !title || !description) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const supabase = createServerClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // 1. Insert Complaint
        const { data: complaint, error: insertError } = await (supabase
            .from('complaints') as any)
            .insert({
                user_id: user.id,
                order_id,
                title,
                description,
                status: 'pending',
                priority,
            })
            .select()
            .single()

        if (insertError) throw insertError

        // 2. Fetch Order and User Details for Email
        // We need order reference code and user details
        const { data: orderData } = await (supabase
            .from('orders') as any)
            .select('reference_code')
            .eq('id', order_id)
            .single()

        const { data: userData } = await (supabase
            .from('users') as any)
            .select('email, first_name, last_name')
            .eq('id', user.id)
            .single()

        // 3. Send Email Alert to Admin
        if (orderData && userData) {
            try {
                await sendAdminNewComplaintAlert({
                    userEmail: userData.email,
                    userName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User',
                    orderRef: orderData.reference_code,
                    title,
                    description,
                    priority
                })
            } catch (emailError) {
                console.error('Failed to send admin alert:', emailError)
                // Don't fail the request
            }
        }

        return NextResponse.json({ success: true, complaint })

    } catch (error: any) {
        console.error('Error submitting complaint:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to submit complaint' },
            { status: 500 }
        )
    }
}
