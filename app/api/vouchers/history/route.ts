import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteClient()
        
        // Ensure user is authenticated
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        if (authError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Use the admin (service role) client to bypass RLS on inventory
        const adminSupabase = createServerClient()
        
        // Step 1: Fetch all orders for this user
        const { data: orders, error: ordersError } = await adminSupabase
            .from('results_checker_orders')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })

        if (ordersError) {
            console.error('[VouchersHistory] Orders fetch error:', ordersError)
            return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
        }

        if (!orders || orders.length === 0) {
            return NextResponse.json({ success: true, data: [] })
        }

        // Step 2: Collect all inventory IDs from all orders (stored as UUID arrays)
        const allInventoryIds: string[] = []
        for (const order of orders) {
            if (order.inventory_ids && Array.isArray(order.inventory_ids)) {
                allInventoryIds.push(...order.inventory_ids)
            }
        }

        // Step 3: Fetch voucher details for those IDs (admin client bypasses RLS)
        let inventoryMap: Record<string, { pin: string; serial_number: string }> = {}
        if (allInventoryIds.length > 0) {
            const { data: inventory, error: invError } = await adminSupabase
                .from('results_checker_inventory')
                .select('id, pin, serial_number')
                .in('id', allInventoryIds)

            if (invError) {
                console.error('[VouchersHistory] Inventory fetch error:', invError)
                // Don't fail the whole request — just return orders without vouchers
            } else if (inventory) {
                for (const item of inventory) {
                    inventoryMap[item.id] = { pin: item.pin, serial_number: item.serial_number }
                }
            }
        }

        // Step 4: Merge voucher details into each order
        const enrichedOrders = orders.map((order: any) => ({
            ...order,
            vouchers: (order.inventory_ids || [])
                .map((id: string) => inventoryMap[id])
                .filter(Boolean)
        }))

        return NextResponse.json({ success: true, data: enrichedOrders })
    } catch (error: any) {
        console.error('[VouchersHistory] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
