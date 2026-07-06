import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin/sub-admin
        const { data: userRole } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userRole?.role !== 'admin' && userRole?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        // Get pagination
        const url = new URL(request.url)
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
        const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20'))
        const offset = (page - 1) * limit
        const status = url.searchParams.get('status') || 'pending'

        // Fetch pending listings
        const { data: listings, error: listingsError, count } = await supabaseUserClient
            .from('classified_listings')
            .select(
                `
                id,
                title,
                description,
                category_id,
                price_pesewas,
                seller_id,
                moderation_status,
                rejection_reason,
                created_at,
                users!seller_id(email, phone_number)
                `,
                { count: 'exact' }
            )
            .eq('moderation_status', status)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (listingsError) {
            console.error('[ModerationQueue] Fetch error:', listingsError)
            return NextResponse.json(
                { error: 'Failed to fetch listings' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            listings: listings || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                pages: Math.ceil((count || 0) / limit),
            },
        })
    } catch (error) {
        console.error('[ModerationQueue] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
