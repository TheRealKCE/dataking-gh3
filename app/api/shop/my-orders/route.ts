import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
    try {
        // Service-role client to bypass RLS.
        const supabaseAdmin = createServerClient()

        // Verify the caller is authenticated
        const supabase = await createRouteHandlerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get the shop for this user (using service role to bypass RLS)
        const { data: shop, error: shopErr } = await supabaseAdmin
            .from('shop_profiles')
            .select('id')
            .eq('owner_id', user.id)
            .single()

        if (shopErr || !shop) {
            return NextResponse.json({ error: 'No shop found', details: shopErr?.message }, { status: 404 })
        }

        // Get filter parameters
        const { searchParams } = new URL(req.url)
        const filterDate = searchParams.get('filterDate') || 'today'

        // Build query — include ALL statuses (pending, processing, completed, failed, refunded)
        let query = supabaseAdmin
            .from('shop_orders')
            .select('*')
            .eq('shop_id', shop.id)

        // Apply date filter
        const now = new Date()
        if (filterDate === 'today') {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
            query = query.gte('created_at', startOfDay)
        } else if (filterDate === '7d') {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
            query = query.gte('created_at', sevenDaysAgo)
        } else if (filterDate === '30d') {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
            query = query.gte('created_at', thirtyDaysAgo)
        }
        // 'all' = no date filter

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) {
            console.error('[ShopOrders API] Query error:', error)
            return NextResponse.json({ error: 'Failed to fetch orders', details: error.message }, { status: 500 })
        }

        return NextResponse.json({ orders: data || [], shopId: shop.id })
    } catch (err: any) {
        console.error('[ShopOrders API] Error:', err)
        return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
    }
}
