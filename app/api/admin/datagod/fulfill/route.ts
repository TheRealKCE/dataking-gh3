import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { fulfillDataGodOrder } from '@/lib/datagod-service'

export async function POST(request: Request) {
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

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { orderIds } = body

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return NextResponse.json({ error: 'No order IDs provided' }, { status: 400 })
        }

        const supabase = createServerClient()
        
        let fulfilledCount = 0
        let failedCount = 0
        const results = []

        // Fetch selected orders that are pending
        const { data: ordersToProcess, error: fetchError } = await (supabase as any)
            .from('orders')
            .select('id, network, phone_number, size, status, user_id')
            .in('id', orderIds)
            .eq('status', 'pending')

        if (fetchError) {
            console.error('[DataGod Fulfill] Fetch error:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
        }

        if (!ordersToProcess || ordersToProcess.length === 0) {
            return NextResponse.json({ error: 'No valid pending orders found for the given IDs.' }, { status: 400 })
        }

        interface PendingOrder {
            id: string;
            network: string;
            phone_number: string;
            size: string;
            status: string;
            user_id: string;
        }

        // Process sequentially to respect potential rate limits
        for (const order of (ordersToProcess as PendingOrder[])) {
            console.log(`[DataGod Fulfill] Processing order: ${order.id} | ${order.network} | ${order.phone_number}`);
            
            // Generate unique reference (using our order ID)
            const reference = `dg_${order.id}_${Date.now().toString().slice(-6)}`

            // Make the API request
            const result = await fulfillDataGodOrder(
                order.network,
                order.phone_number,
                order.size,
                reference
            )

            if (result.success) {
                // Determine new status. Usually APIs return success but still need to be checked later,
                // so we mark as processing and let a status checker or admin confirm. The docs say 
                // standalone orders might complete immediately or go queued.
                const nextStatus: 'pending' | 'processing' | 'completed' | 'failed' = result.apiResponse?.status === 'success' || result.apiResponse?.data?.status === 'success' ? 'completed' : 'processing'

                const { error: updateError } = await (supabase as any)
                    .from('orders')
                    .update({ status: nextStatus })
                    .eq('id', order.id)

                if (updateError) {
                    console.error(`[DataGod Fulfill] Update error for ${order.id}:`, updateError)
                }

                // Log into fulfillment tracking
                await (supabase as any)
                    .from('mtn_fulfillment_tracking')
                    .insert({
                        order_id: order.id,
                        status: nextStatus,
                        retry_count: 0,
                        api_response: {
                            supplier: 'datagod',
                            note: 'Manual DataGod Fulfillment Success',
                            datagod_response: result.apiResponse,
                            reference: result.reference
                        }
                    })

                fulfilledCount++
                results.push({ id: order.id, success: true, status: nextStatus, message: 'Processed' })
            } else {
                // Log failure into tracking but keep order status as pending
                await (supabase as any)
                    .from('mtn_fulfillment_tracking')
                    .insert({
                        order_id: order.id,
                        status: 'failed',
                        retry_count: 0,
                        api_response: {
                            supplier: 'datagod_failed',
                            note: 'Manual DataGod Fulfillment Failed',
                            error: result.error,
                            datagod_response: result.apiResponse,
                            reference: reference
                        }
                    })

                failedCount++
                results.push({ id: order.id, success: false, error: result.error })
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${fulfilledCount + failedCount} orders`,
            fulfilled: fulfilledCount,
            failed: failedCount,
            results
        })

    } catch (error: any) {
        console.error('DataGod Manual Fulfill Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
