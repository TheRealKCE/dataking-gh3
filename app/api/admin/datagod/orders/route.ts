import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { parsePagination } from '@/lib/pagination'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const network = searchParams.get('network')
        const search = searchParams.get('search')
        const { limit } = parsePagination(searchParams, { defaultLimit: 100, maxLimit: 200 })

        const supabase = createServerClient()

        let query = supabase
            .from('orders')
            .select(`
                id, created_at, phone_number, network, size, price, status, user_id, shop_name, shop_order_id, cost_price_at_time,
                users (
                    first_name,
                    last_name,
                    role,
                    email
                ),
                shop_orders (
                    cost_price,
                    admin_cost_at_time
                ),
                mtn_fulfillment_tracking (
                    status,
                    api_response,
                    retry_count
                )
            `)
            .eq('status', 'pending') // STRICTLY pending

        if (network && network !== 'All') {
            query = query.eq('network', network)
        }

        if (search) {
            query = query.ilike('phone_number', `%${search}%`)
        }

        const { data: rawOrders, error: fetchError } = await query
            .order('created_at', { ascending: false })
            .limit(limit)

        if (fetchError) {
            console.error('[DataGodPendingFetch] Error:', fetchError)
            throw fetchError
        }

        const orders = (rawOrders || []).map((order: any) => {
            const tracking = order.mtn_fulfillment_tracking && order.mtn_fulfillment_tracking[0]
                ? order.mtn_fulfillment_tracking
                : []

            const isShopOrder = order.shop_order_id && order.shop_orders
            
            const adminRevenue = isShopOrder 
                ? order.shop_orders.cost_price
                : order.price

            const adminTrueCost = isShopOrder
                ? order.shop_orders.admin_cost_at_time
                : order.cost_price_at_time

            return {
                ...order,
                original_shop_price: order.price,
                price: adminRevenue,
                cost_price: adminTrueCost,
                mtn_fulfillment_tracking: tracking
            }
        })

        return NextResponse.json({ orders })
    } catch (error: any) {
        console.error('DataGod Pending Orders Fetch Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
