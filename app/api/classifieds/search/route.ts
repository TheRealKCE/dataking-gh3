import { NextRequest, NextResponse } from 'next/server'
import { searchListings } from '@/lib/classifieds-queries'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams

        const q = searchParams.get('q') || ''
        const category_id = searchParams.get('category_id') || undefined
        const location = searchParams.get('location') || undefined
        const price_min = searchParams.get('price_min') ? parseFloat(searchParams.get('price_min')!) : undefined
        const price_max = searchParams.get('price_max') ? parseFloat(searchParams.get('price_max')!) : undefined

        if (!q && !category_id && !location) {
            return NextResponse.json(
                { error: 'Provide at least a search query or filter' },
                { status: 400 }
            )
        }

        const results = await searchListings(q, {
            category_id,
            location,
            price_min,
            price_max,
        })

        return NextResponse.json({ results, count: results.length })
    } catch (error: any) {
        console.error('Search error:', error)
        return NextResponse.json(
            { error: error.message || 'Search failed' },
            { status: 500 }
        )
    }
}
