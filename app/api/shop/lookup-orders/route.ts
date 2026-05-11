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
    const reference = searchParams.get('reference')

    if (!phone || !reference) {
        return NextResponse.json({ error: 'Phone number and payment reference are required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\s+/g, '').trim()
    const cleanReference = reference.trim()
    const ghanaPhoneRegex = /^(0\d{9}|233\d{9})$/
    const referenceRegex = /^SHOP-[A-Za-z0-9_-]{3,120}$/

    if (!ghanaPhoneRegex.test(cleanPhone)) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    if (!referenceRegex.test(cleanReference)) {
        return NextResponse.json({ error: 'Invalid payment reference' }, { status: 400 })
    }

    try {
        const { data, error } = await supabaseAdmin
            .rpc('get_shop_order_by_phone_reference', {
                phone_number: cleanPhone,
                order_reference: cleanReference,
            })

        if (error) {
            console.error('[ShopOrdersLookup] RPC error:', error)
            return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
        }

        return NextResponse.json({ orders: data || [] }, {
            headers: {
                'Cache-Control': 'private, max-age=600'
            }
        })
    } catch (err) {
        console.error('[ShopOrdersLookup] Error:', err)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
