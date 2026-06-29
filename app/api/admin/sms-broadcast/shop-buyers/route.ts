import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

/**
 * GET endpoint to fetch deduped guest phone numbers from shop_orders
 * across ALL shops, for the "Shop Buyers" SMS broadcast tab.
 * Admin only - bypasses RLS.
 */
export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (!userData || (userData as any).role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        const supabase = createServerClient() // service role, bypasses RLS

        // Optional query params for filtering
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') // e.g. 'completed'
        const shopId = searchParams.get('shopId')  // optional: filter to one shop
        const fromDate = searchParams.get('from')  // ISO date
        const toDate = searchParams.get('to')

        let query = supabase
            .from('shop_orders')
            .select('id, shop_id, guest_phone, status, created_at, shop_profiles(shop_name)')
            .not('guest_phone', 'is', null)
            .order('created_at', { ascending: false })
            .limit(20000) // safety cap; paginate further if this is ever exceeded

        if (status) query = query.eq('status', status)
        if (shopId) query = query.eq('shop_id', shopId)
        if (fromDate) query = query.gte('created_at', fromDate)
        if (toDate) query = query.lte('created_at', toDate)

        const { data: orders, error } = await query

        if (error) {
            console.error('[SMSBroadcast:ShopBuyers] Error fetching shop orders:', error)
            return NextResponse.json({ error: 'Failed to fetch shop buyers' }, { status: 500 })
        }

        // Dedupe by normalized phone number, keep most recent purchase + shop name
        const byPhone = new Map<string, {
            phone_number: string
            shop_name: string
            last_purchase_at: string
            order_count: number
        }>()

        for (const row of (orders || []) as any[]) {
            const normalized = (row.guest_phone || '').replace(/\s+/g, '')
            if (!normalized) continue

            const existing = byPhone.get(normalized)
            if (existing) {
                existing.order_count += 1
                // created_at is already sorted desc, so first-seen is most recent
            } else {
                byPhone.set(normalized, {
                    phone_number: normalized,
                    shop_name: row.shop_profiles?.shop_name || 'Unknown Shop',
                    last_purchase_at: row.created_at,
                    order_count: 1,
                })
            }
        }

        const buyers = Array.from(byPhone.values())

        return NextResponse.json({
            success: true,
            buyers,
            totalOrders: orders?.length || 0,
            uniqueBuyers: buyers.length,
        })
    } catch (error: any) {
        console.error('[SMSBroadcast:ShopBuyers] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
