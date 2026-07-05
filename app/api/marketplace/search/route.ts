import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()

        const url = new URL(request.url)
        const query = url.searchParams.get('q') || ''
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
        const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '24'))
        const offset = (page - 1) * limit

        const category = url.searchParams.get('category')
        const region = url.searchParams.get('region')
        const minPrice = url.searchParams.get('minPrice')
        const maxPrice = url.searchParams.get('maxPrice')
        const condition = url.searchParams.get('condition')

        // Build query
        let dbQuery = supabaseUserClient
            .from('classified_listings')
            .select(
                `
                id,
                title,
                description,
                price_pesewas,
                category_id,
                region,
                condition,
                status,
                promotion_tier,
                created_at,
                classified_listing_images(image_url, sort_order)
                `,
                { count: 'exact' }
            )
            .eq('status', 'active')
            .eq('moderation_status', 'approved')

        // Full-text search (tsvector)
        if (query && query.trim()) {
            const searchQuery = query
                .trim()
                .split(' ')
                .map((word) => `${word}:*`)
                .join(' & ')

            dbQuery = dbQuery.filter('search_tsvector', 'phfts', searchQuery)
        }

        // Filters
        if (category) dbQuery = dbQuery.eq('category_id', category)
        if (region) dbQuery = dbQuery.eq('region', region)
        if (condition) dbQuery = dbQuery.eq('condition', condition)
        if (minPrice) dbQuery = dbQuery.gte('price_pesewas', parseInt(minPrice))
        if (maxPrice) dbQuery = dbQuery.lte('price_pesewas', parseInt(maxPrice))

        // Sort: newest first
        dbQuery = dbQuery.order('created_at', { ascending: false })

        // Paginate
        const { data: listings, error, count } = await dbQuery.range(offset, offset + limit - 1)

        if (error) {
            console.error('[Search] Query error:', error)
            return NextResponse.json(
                { error: 'Search failed' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            results: listings || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                pages: Math.ceil((count || 0) / limit),
            },
        })
    } catch (error) {
        console.error('[Search] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
