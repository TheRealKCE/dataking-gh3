import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function PUT(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { listing_id, ...updates } = body

        if (!listing_id) {
            return NextResponse.json({ error: 'listing_id is required' }, { status: 400 })
        }

        // Verify ownership
        const { data: listing, error: fetchError } = await supabaseUserClient
            .from('classified_listings')
            .select('seller_id')
            .eq('id', listing_id)
            .single()

        if (fetchError || !listing || listing.seller_id !== authUser.id) {
            return NextResponse.json(
                { error: 'Listing not found or unauthorized' },
                { status: 404 }
            )
        }

        // Update listing
        const { data, error } = await supabaseUserClient
            .from('classified_listings')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', listing_id)
            .select()
            .single()

        if (error) {
            console.error('[ListingUpdate] Error:', error)
            return NextResponse.json(
                { error: 'Failed to update listing' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            listing: data,
        })
    } catch (error) {
        console.error('[ListingUpdate] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
