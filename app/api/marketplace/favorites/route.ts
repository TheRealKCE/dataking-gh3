import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

// Marketplace favorites reuse the classified_favorites table, which references
// classified_listings (the table the marketplace listings live in).

export async function GET() {
    try {
        const supabase = await createRouteHandlerClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data, error } = await (supabase.from('classified_favorites') as any)
            .select('listing_id')
            .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json({ favorites: (data || []).map((f: any) => f.listing_id) })
    } catch (error: any) {
        console.error('[Marketplace Favorites] GET error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch favorites' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { listing_id } = await request.json()
        if (!listing_id) {
            return NextResponse.json({ error: 'Missing listing_id' }, { status: 400 })
        }

        const { error } = await (supabase.from('classified_favorites') as any)
            .insert({ user_id: user.id, listing_id })

        // Ignore duplicate (already favorited) — treat as success
        if (error && error.code !== '23505') throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[Marketplace Favorites] POST error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to add favorite' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createRouteHandlerClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const listing_id = request.nextUrl.searchParams.get('listing_id')
        if (!listing_id) {
            return NextResponse.json({ error: 'Missing listing_id' }, { status: 400 })
        }

        const { error } = await (supabase.from('classified_favorites') as any)
            .delete()
            .eq('user_id', user.id)
            .eq('listing_id', listing_id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[Marketplace Favorites] DELETE error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to remove favorite' },
            { status: 500 }
        )
    }
}
