import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()

        const {
            data: { user },
        } = await supabaseUserClient.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'))
        const limit = Math.min(50, parseInt(request.nextUrl.searchParams.get('limit') || '20'))
        const offset = (page - 1) * limit
        const role = request.nextUrl.searchParams.get('role') || 'buyer' // buyer or seller

        // Get orders
        let query = supabaseUserClient
            .from('marketplace_orders')
            .select(
                `
                id,
                buyer_id,
                seller_id,
                listing_id,
                quantity,
                total_price_pesewas,
                status,
                payment_mode,
                created_at,
                paid_at,
                delivered_at,
                classified_listings(title, price_pesewas)
                `,
                { count: 'exact' }
            )

        if (role === 'buyer') {
            query = query.eq('buyer_id', user.id)
        } else {
            query = query.eq('seller_id', user.id)
        }

        const { data: orders, count, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('[Orders List] Query error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch orders' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            orders: orders || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                pages: Math.ceil((count || 0) / limit),
            },
        })
    } catch (error) {
        console.error('[Orders List] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
