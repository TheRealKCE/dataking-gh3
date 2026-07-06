import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { z } from 'zod'

const PurchasePromotionSchema = z.object({
    listing_id: z.string().uuid(),
    tier_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()

        const {
            data: { user },
        } = await supabaseUserClient.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { listing_id, tier_id } = PurchasePromotionSchema.parse(body)

        // Verify listing exists and user owns it
        const { data: listing, error: listingError } = await supabaseUserClient
            .from('classified_listings')
            .select('id, user_id, promotion_tier')
            .eq('id', listing_id)
            .single()

        if (listingError || !listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        }

        if (listing.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Get promotion tier details
        const { data: tier, error: tierError } = await supabaseUserClient
            .from('marketplace_promotion_tiers')
            .select('*')
            .eq('id', tier_id)
            .eq('is_active', true)
            .single()

        if (tierError || !tier) {
            return NextResponse.json({ error: 'Promotion tier not found' }, { status: 404 })
        }

        // Calculate expiration
        const startsAt = new Date()
        const expiresAt = new Date(startsAt.getTime() + tier.duration_hours * 60 * 60 * 1000)

        // Create promotion purchase
        const { data: purchase, error: purchaseError } = await supabaseUserClient
            .from('marketplace_promotion_purchases')
            .insert({
                user_id: user.id,
                listing_id,
                tier_id,
                price_pesewas: tier.price_pesewas,
                started_at: startsAt.toISOString(),
                expires_at: expiresAt.toISOString(),
                status: 'active',
            })
            .select()
            .single()

        if (purchaseError) {
            console.error('[Purchase Promotion] Insert error:', purchaseError)
            return NextResponse.json(
                { error: 'Failed to purchase promotion' },
                { status: 500 }
            )
        }

        // Update listing with promotion tier
        const { error: updateError } = await supabaseUserClient
            .from('classified_listings')
            .update({
                promotion_tier: tier.tier_level,
                promoted_until: expiresAt.toISOString(),
            })
            .eq('id', listing_id)

        if (updateError) {
            console.error('[Purchase Promotion] Update error:', updateError)
            return NextResponse.json(
                { error: 'Failed to update listing' },
                { status: 500 }
            )
        }

        // Log action
        await supabaseUserClient.from('marketplace_promotion_logs').insert({
            user_id: user.id,
            listing_id,
            tier_id,
            action: 'purchased',
            amount_pesewas: tier.price_pesewas,
            notes: `Purchased ${tier.display_name} promotion`,
        })

        return NextResponse.json({
            success: true,
            purchase: {
                id: purchase.id,
                listing_id,
                tier_id,
                expires_at: expiresAt.toISOString(),
                price_pesewas: tier.price_pesewas,
            },
        })
    } catch (error) {
        console.error('[Purchase Promotion] Error:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request', details: error.errors },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
