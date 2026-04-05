import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { validateAdminAccess } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(true, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }
        const { supabase: supabaseUserClient, user: sessionUser } = authResult

        const { searchParams } = new URL(request.url)
        const available = searchParams.get('available') === 'true'
        const batchId = searchParams.get('batchId')
        const batchIds = searchParams.get('batchIds')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        let query = supabase
            .from('orders')
            .select(`
                *,
                users (
                    first_name,
                    last_name,
                    email
                ),
                shop_orders (
                    cost_price,
                    admin_cost_at_time
                )
            `, { count: 'exact' })

        if (batchIds) {
            query = query.in('download_batch_id', batchIds.split(','))
        } else if (batchId) {
            query = query.eq('download_batch_id', batchId)
        } else if (available) {
            query = query.is('download_batch_id', null).eq('status', 'pending')
        }

        const { data: orders, count, error: fetchError } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (fetchError) {
            console.error('[AdminOrdersFetch] Error:', fetchError)
            throw fetchError
        }

        // We remove the expensive server-side O(N^2) loop that was matching packages to orders.
        // This significantly reduces Fluid Active CPU usage.
        
        // Robust Conditional Mapping for Admin True Costs
        const mappedOrders = (orders || []).map((order: any) => {
            const isShopOrder = order.shop_order_id && order.shop_orders
            
            const adminRevenue = isShopOrder 
                ? order.shop_orders.cost_price         // What the shop owner paid the admin
                : order.price                          // What the direct customer paid the admin

            const adminTrueCost = isShopOrder
                ? order.shop_orders.admin_cost_at_time // Admin's supplier cost for the shop order
                : order.cost_price_at_time             // Admin's supplier cost for the direct order

            return {
                ...order,
                original_shop_price: order.price,      // Retain original frontend price if needed
                price: adminRevenue,                   // Override so frontend uses this for Revenue / "Cost" displays
                cost_price: adminTrueCost              // Override so frontend uses this for Base Cost
            }
        })

        return NextResponse.json({
            orders: mappedOrders,
            totalCount: count || 0
        })
    } catch (error: any) {
        console.error('Admin Orders Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
