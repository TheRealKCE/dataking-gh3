import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service-role so this works for unauthenticated storefront visitors
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    if (!phone) {
        return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    // Sanitize: only allow digits, plus sign, spaces — strip anything else
    const cleanPhone = phone.replace(/[^\d+ ]/g, '').trim()
    if (!cleanPhone) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
        .rpc('get_shop_orders_by_phone', {
            phone_number: cleanPhone,
            limit_count: Math.min(limit, 100), // Cap at 100 to prevent abuse
        })

    if (error) {
        console.error('[ShopOrders API] RPC error:', error)
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ orders: data || [] })
}
