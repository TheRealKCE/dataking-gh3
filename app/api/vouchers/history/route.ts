import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteClient()
        
        // Verify authentication
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        if (authError || !session) {
            console.error('[VouchersHistory] Auth error:', authError)
            return NextResponse.json({ error: 'Unauthorized', detail: authError?.message }, { status: 401 })
        }

        const userId = session.user.id
        console.log('[VouchersHistory] Fetching history for user:', userId)

        // Use service role client to bypass all RLS
        const admin = createServerClient()
        
        // Step 1: Fetch all orders for this user
        const { data: orders, error: ordersError } = await admin
            .from('results_checker_orders')
            .select('id, type_name, quantity, total_paid, status, payment_status, reference_code, created_at, inventory_ids')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (ordersError) {
            console.error('[VouchersHistory] Orders error:', ordersError)
            return NextResponse.json({ error: 'Failed to fetch orders', detail: ordersError.message }, { status: 500 })
        }

        console.log('[VouchersHistory] Found orders:', orders?.length ?? 0)

        if (!orders || orders.length === 0) {
            return NextResponse.json({ success: true, data: [] })
        }

        // Step 2: Fetch ALL inventory sold to this user (bypass inventory RLS via service role)
        const { data: soldInventory, error: invError } = await admin
            .from('results_checker_inventory')
            .select('id, pin, serial_number, sold_at')
            .eq('sold_to_user_id', userId)
            .eq('status', 'sold')
            .order('sold_at', { ascending: true })

        if (invError) {
            console.error('[VouchersHistory] Inventory error:', invError)
            // Don't fail — just return orders without voucher details
        }

        console.log('[VouchersHistory] Found sold inventory items:', soldInventory?.length ?? 0)

        const inventoryById: Record<string, { id: string; pin: string; serial_number: string }> = {}
        for (const item of (soldInventory || [])) {
            inventoryById[item.id] = item
        }

        // Step 3: Match vouchers to orders via inventory_ids array
        // For orders where inventory_ids is null/empty, assign unmatched vouchers
        const usedInventoryIds = new Set<string>()

        const enrichedOrders = orders.map((order: any) => {
            const ids: string[] = order.inventory_ids || []
            const matched = ids
                .map((id: string) => inventoryById[id])
                .filter(Boolean)
            
            matched.forEach((v: any) => usedInventoryIds.add(v.id))
            
            return { ...order, vouchers: matched }
        })

        // Assign any unmatched sold vouchers to orders that have none
        const unmatched = (soldInventory || []).filter(v => !usedInventoryIds.has(v.id))
        if (unmatched.length > 0) {
            console.log('[VouchersHistory] Unmatched inventory items:', unmatched.length, '— assigning to empty orders')
            let ui = 0
            for (const order of enrichedOrders) {
                if (order.vouchers.length === 0 && ui < unmatched.length) {
                    const slice = unmatched.slice(ui, ui + order.quantity)
                    order.vouchers = slice
                    ui += slice.length
                }
            }
        }

        return NextResponse.json({ success: true, data: enrichedOrders })
    } catch (error: any) {
        console.error('[VouchersHistory] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error', detail: error.message }, { status: 500 })
    }
}
