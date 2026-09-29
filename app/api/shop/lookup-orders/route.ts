import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
    // Service-role client — bypasses RLS completely.
    const supabaseAdmin = createServerClient()

    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const reference = searchParams.get('reference')

    if (!phone || !reference) {
        return NextResponse.json({ error: 'Phone number and payment reference are required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\s+/g, '').trim()
    const cleanReference = reference.trim()
    const ghanaPhoneRegex = /^(0\d{9}|233\d{9})$/
    const referenceRegex = /^(RC-)?SHOP-[A-Za-z0-9_-]{3,120}$/

    if (!ghanaPhoneRegex.test(cleanPhone)) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    if (!referenceRegex.test(cleanReference)) {
        return NextResponse.json({ error: 'Invalid payment reference' }, { status: 400 })
    }

    try {
        if (cleanReference.startsWith('RC-')) {
            const { data, error } = await supabaseAdmin
                .from('results_checker_orders')
                .select('id, type_name, quantity, total_paid, status, created_at, shop_name, shop_profiles!inner(shop_slug)')
                .eq('customer_phone', cleanPhone)
                .eq('reference_code', cleanReference)

            if (error) {
                console.error('[ShopOrdersLookup] RC query error:', error)
                return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
            }

            const formatted = (data || []).map(d => ({
                id: d.id,
                network: 'Result Checker',
                package_size: `${d.quantity}x ${d.type_name.toUpperCase()}`,
                selling_price: d.total_paid,
                status: d.status,
                created_at: d.created_at,
                shop_name: d.shop_name,
                shop_slug: (d.shop_profiles as any)?.shop_slug
            }))

            return NextResponse.json({ orders: formatted }, {
                headers: { 'Cache-Control': 'private, max-age=600' }
            })
        }

        // Queried directly rather than through get_shop_order_by_phone_reference: that
        // RPC started erroring in production (every lookup 500'd), and this client is
        // service-role anyway, so the security-definer function bought nothing here.
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
        const { data: shopOrders, error } = await supabaseAdmin
            .from('shop_orders')
            .select('id, network, package_size, selling_price, status, created_at, shop_id')
            .eq('guest_phone', cleanPhone)
            .eq('paystack_reference', cleanReference)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(1)

        if (error) {
            console.error('[ShopOrdersLookup] shop_orders query error:', error)
            return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
        }

        const order = shopOrders?.[0]
        if (!order) {
            return NextResponse.json({ orders: [] }, {
                headers: { 'Cache-Control': 'private, max-age=600' }
            })
        }

        // Both extras are best-effort: a missing shop or mirrored orders row (fulfillment
        // may not have created it yet) must not drop the order from the tracker.
        const [{ data: shop }, { data: mirrored }] = await Promise.all([
            supabaseAdmin.from('shop_profiles').select('shop_name, shop_slug').eq('id', order.shop_id).maybeSingle(),
            supabaseAdmin.from('orders').select('supplier_status').eq('shop_order_id', order.id).limit(1),
        ])

        const { shop_id: _shopId, ...rest } = order
        const data = [{
            ...rest,
            supplier_status: mirrored?.[0]?.supplier_status ?? null,
            shop_name: shop?.shop_name ?? null,
            shop_slug: shop?.shop_slug ?? null,
        }]

        return NextResponse.json({ orders: data }, {
            headers: {
                'Cache-Control': 'private, max-age=600'
            }
        })
    } catch (err) {
        console.error('[ShopOrdersLookup] Error:', err)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
