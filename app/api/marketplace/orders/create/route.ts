import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { z } from 'zod'

const CreateOrderSchema = z.object({
    listing_id: z.string().uuid(),
    payment_mode: z.enum(['direct', 'split', 'escrow']),
    quantity: z.number().int().positive().optional().default(1),
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
        const { listing_id, payment_mode, quantity } = CreateOrderSchema.parse(body)

        // Get listing details
        const { data: listing, error: listingError } = await supabaseUserClient
            .from('classified_listings')
            .select('id, user_id, title, price_pesewas, payment_modes')
            .eq('id', listing_id)
            .eq('status', 'active')
            .eq('moderation_status', 'approved')
            .single()

        if (listingError || !listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        }

        // Can't buy own listing
        if (listing.user_id === user.id) {
            return NextResponse.json(
                { error: 'Cannot purchase your own listing' },
                { status: 400 }
            )
        }

        // Check if payment mode is supported
        const supportedModes = listing.payment_modes || ['direct']
        if (!supportedModes.includes(payment_mode)) {
            return NextResponse.json(
                { error: `Payment mode ${payment_mode} not available for this listing` },
                { status: 400 }
            )
        }

        // Calculate total price
        const totalPesewas = listing.price_pesewas * quantity

        // Create order
        const { data: order, error: orderError } = await supabaseUserClient
            .from('marketplace_orders')
            .insert({
                buyer_id: user.id,
                seller_id: listing.user_id,
                listing_id,
                quantity,
                total_price_pesewas: totalPesewas,
                payment_mode,
                status: 'created',
            })
            .select()
            .single()

        if (orderError) {
            console.error('[Create Order] Insert error:', orderError)
            return NextResponse.json(
                { error: 'Failed to create order' },
                { status: 500 }
            )
        }

        // Log event
        await supabaseUserClient.from('marketplace_order_events').insert({
            order_id: order.id,
            event_type: 'created',
            new_status: 'created',
            actor_id: user.id,
            notes: `Order created for ${listing.title}`,
        })

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                listing_id,
                total_price_pesewas: totalPesewas,
                payment_mode,
                status: 'created',
            },
        })
    } catch (error) {
        console.error('[Create Order] Error:', error)
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
