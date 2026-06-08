import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sendAdminNewComplaintAlert } from '@/lib/email-service'
import { z } from 'zod'
import { shortTextSchema, longTextSchema } from '@/lib/validation'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        
        const complaintSchema = z.object({
            title: shortTextSchema,
            description: longTextSchema,
            order_id: z.string(),
            priority: z.string().optional()
        })

        const validation = complaintSchema.safeParse(body)
        if (!validation.success) {
            const errorDetails = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
            return NextResponse.json({ error: 'Invalid input', details: errorDetails }, { status: 400 })
        }

        const { order_id, title, description, priority = 'medium' } = validation.data

        const cookieStore = await cookies()
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const user = authUser

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
