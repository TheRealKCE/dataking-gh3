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

        const listingId = request.nextUrl.searchParams.get('listing_id')

        if (!listingId) {
            return NextResponse.json(
                { error: 'Missing listing_id parameter' },
                { status: 400 }
            )
        }

        // Get active promotion for listing
        const { data: purchase, error } = await supabaseUserClient
            .from('marketplace_promotion_purchases')
            .select(
                `
                id,
                tier_id,
                price_pesewas,
                started_at,
                expires_at,
                marketplace_promotion_tiers(
                    tier_name,
                    display_name,
                    tier_level
                )
                `
            )
            .eq('listing_id', listingId)
            .eq('status', 'active')
            .order('expires_at', { ascending: false })
            .limit(1)
            .single()

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows returned
            console.error('[Active Promotion] Query error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch promotion' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            promotion: purchase || null,
        })
    } catch (error) {
        console.error('[Active Promotion] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
