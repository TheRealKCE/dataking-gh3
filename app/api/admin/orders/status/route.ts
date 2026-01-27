import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendStatusUpdateSMS } from '@/lib/sms-service'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { orderId, batchId, status } = body

        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 })
        }

        if (!orderId && !batchId) {
            return NextResponse.json({ error: 'orderId or batchId is required' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        let affectedOrders: any[] = []

        if (orderId) {
            console.log(`[AdminStatusUpdate] Updating single order: ${orderId} to ${status}`)
            // Update single order
            const { data: order, error: fetchError } = await supabase
                .from('orders')
                .select('id, user_id, reference_code, phone_number, users!inner(phone_number)')
                .eq('id', orderId)
                .single()

            if (fetchError) {
                console.error(`[AdminStatusUpdate] Fetch error for order ${orderId}:`, fetchError)
                throw fetchError
            }
            affectedOrders.push(order)

            const { error: updateError } = await (supabase
                .from('orders') as any)
                .update({
                    status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId)

            if (updateError) {
                console.error(`[AdminStatusUpdate] Update error for order ${orderId}:`, updateError)
                throw updateError
            }
        } else if (batchId) {
            console.log(`[AdminStatusUpdate] Updating batch: ${batchId} to ${status}`)
            // Update batch of orders
            const { data: orders, error: fetchError } = await supabase
                .from('orders')
                .select('id, user_id, reference_code, phone_number, users!inner(phone_number)')
                .eq('download_batch_id', batchId)

            if (fetchError) {
                console.error(`[AdminStatusUpdate] Fetch error for batch ${batchId}:`, fetchError)
                throw fetchError
            }

            affectedOrders = orders || []
            console.log(`[AdminStatusUpdate] Found ${affectedOrders.length} orders in batch ${batchId}`)

            if (affectedOrders.length > 0) {
                const { error: updateError } = await (supabase
                    .from('orders') as any)
                    .update({
                        status,
                        updated_at: new Date().toISOString()
                    })
                    .eq('download_batch_id', batchId)

                if (updateError) {
                    console.error(`[AdminStatusUpdate] Update error for batch ${batchId}:`, updateError)
                    throw updateError
                }
            }
        }

        // Send notifications
        if (affectedOrders.length > 0) {
            console.log(`[AdminStatusUpdate] Sending notifications for ${affectedOrders.length} orders`)
            const notifications = affectedOrders.map(order => ({
                user_id: (order as any).user_id,
                title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                message: `Your order ${(order as any).reference_code} has been marked as ${status}.`,
                type: 'order_update',
                action_url: `/dashboard/my-orders`,
                is_read: false
            }))


            // Send SMS to each user
            for (const order of affectedOrders) {
                const userPhone = (order as any).users?.phone_number

                if (userPhone) {
                    sendStatusUpdateSMS(
                        userPhone,
                        {
                            referenceCode: (order as any).reference_code,
                            status
                        }
                    ).catch(err => console.error(`[AdminStatusUpdate] SMS error for ${(order as any).reference_code}:`, err))
                } else {
                    console.warn(`[AdminStatusUpdate] No registered phone for user ${(order as any).user_id} (Order ${(order as any).reference_code})`)
                }
            }


            const { error: notifyError } = await (supabase.from('notifications') as any).insert(notifications)
            if (notifyError) {
                console.error('[AdminStatusUpdate] Notification insert error:', notifyError)
                // Don't fail the whole request if notifications fail
            }
        }

        return NextResponse.json({
            success: true,
            updatedCount: affectedOrders.length
        })
    } catch (error: any) {
        console.error('Admin Status Update Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
