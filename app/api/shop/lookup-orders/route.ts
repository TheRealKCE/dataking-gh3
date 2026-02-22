import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS completely
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

    const cleanPhone = phone.replace(/[^\d+ ]/g, '').trim()
    if (!cleanPhone) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    try {
        const { data, error } = await supabaseAdmin
            .rpc('get_shop_orders_by_phone', {
                phone_number: cleanPhone,
                limit_count: Math.min(limit, 100),
            })

        if (error) {
            console.error('[ShopOrdersLookup] RPC error:', error)
            return NextResponse.json({ error: 'Failed to fetch orders', details: error.message }, { status: 500 })
        }

        return NextResponse.json({ orders: data || [] }, {
            headers: {
                'Cache-Control': 'private, max-age=600'
            }
        })
    } catch (err: any) {
        console.error('[ShopOrdersLookup] Error:', err)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
