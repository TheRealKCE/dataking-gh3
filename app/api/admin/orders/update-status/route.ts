import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncShopOrderStatus } from '@/lib/shop-service'
import { sendPushToUser } from '@/lib/web-push'
import { sendOrderFailedSMS } from '@/lib/sms-service'

// Create a service role client to bypass RLS for admin updates functions
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function POST(request: Request) {
    try {
        const supabase = await createRouteHandlerClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Verify admin role
        const { data: user } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (!user || (user.role !== 'admin' && user.role !== 'sub-admin')) {
            return NextResponse.json(
                { error: 'Forbidden: Admin access required' },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { orderIds, batchId, status } = body

        if (!status) {
            return NextResponse.json(
                { error: 'Status is required' },
                { status: 400 }
            )
        }

        if ((!orderIds || !Array.isArray(orderIds)) && !batchId) {
            return NextResponse.json(
                { error: 'Invalid request body: orderIds array or batchId is required' },
                { status: 400 }
            )
        }

        let targetOrderIds: string[] = []

        if (batchId) {
            // Fetch non-refunded orders for this batch
            const { data: batchOrders, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('download_batch_id', batchId)
                .neq('payment_status', 'refunded')
            
            if (fetchError) {
                console.error('Error fetching batch orders:', fetchError)
                return NextResponse.json({ error: fetchError.message }, { status: 500 })
            }
            targetOrderIds = (batchOrders || []).map(o => o.id)
        } else {
            targetOrderIds = orderIds
        }

        if (targetOrderIds.length === 0) {
            return NextResponse.json({ success: true, count: 0 })
        }

        // Use service role client to update orders
        const { error } = await supabaseAdmin
            .from('orders')
            .update({ status })
            .in('id', targetOrderIds)

        if (error) {
            console.error('Error updating orders:', error)
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            )
        }

        // Sync with shop_orders
        const results = await Promise.allSettled(targetOrderIds.map(id => syncShopOrderStatus(id, status)))
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.error(`[UpdateStatus] syncShopOrderStatus failed for order ${targetOrderIds[i]}:`, r.reason)
            }
        })

        // Notify affected users (awaited to prevent Vercel from killing)
        if (status === 'completed' || status === 'failed') {
            try {
                const { data: orderData } = await supabaseAdmin
                    .from('orders')
                    .select('user_id, network, size, phone_number, users!inner(phone_number)')
                    .in('id', targetOrderIds)
                if (orderData?.length) {
                    const pushTitle = status === 'completed' ? 'Data Bundle Sent' : 'Order Failed'
                    await Promise.allSettled(
                        orderData.map((o: any) =>
                            sendPushToUser(o.user_id, {
                                title: pushTitle,
                                body: status === 'completed'
                                    ? `Your ${o.network} ${o.size} bundle for ${o.phone_number} has been sent.`
                                    : `Your ${o.network} ${o.size} order for ${o.phone_number} could not be completed. Contact support.`,
                                url: '/dashboard/my-orders',
                            })
                        )
                    )

                    // SMS the user when their order is marked failed
                    if (status === 'failed') {
                        await Promise.allSettled(
                            orderData.map((o: any) => {
                                const userPhone = o.users?.phone_number
                                if (!userPhone) return Promise.resolve()
                                return sendOrderFailedSMS(userPhone, o.phone_number, {
                                    network: o.network,
                                    size: o.size,
                                })
                            })
                        )
                    }
                }
            } catch {}
        }

        return NextResponse.json({ success: true, count: targetOrderIds.length })
    } catch (error: any) {
        console.error('Error in update status route:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
