import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { z } from 'zod'

const CreateConversationSchema = z.object({
    listing_id: z.string().uuid(),
    other_user_id: z.string().uuid(),
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
        const { listing_id, other_user_id } = CreateConversationSchema.parse(body)

        // Can't message yourself
        if (other_user_id === user.id) {
            return NextResponse.json(
                { error: 'Cannot message yourself' },
                { status: 400 }
            )
        }

        // Verify listing exists
        const { data: listing, error: listingError } = await supabaseUserClient
            .from('classified_listings')
            .select('id, seller_id')
            .eq('id', listing_id)
            .single()

        if (listingError || !listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        }

        // Determine buyer/seller roles
        let buyerId: string
        let sellerId: string

        if ((listing as any).seller_id === user.id) {
            // Current user is seller, other user is buyer
            sellerId = user.id
            buyerId = other_user_id
        } else {
            // Current user is buyer, other user is seller
            buyerId = user.id
            sellerId = other_user_id
        }

        // Check if conversation already exists
        const { data: existingConv } = await supabaseUserClient
            .from('marketplace_conversations')
            .select('id')
            .eq('listing_id', listing_id)
            .eq('buyer_id', buyerId)
            .eq('seller_id', sellerId)
            .single()

        if (existingConv) {
            return NextResponse.json({
                success: true,
                conversation_id: existingConv.id,
                is_new: false,
            })
        }

        // Create conversation
        const { data: conversation, error: createError } = await supabaseUserClient
            .from('marketplace_conversations')
            .insert({
                listing_id,
                buyer_id: buyerId,
                seller_id: sellerId,
            })
            .select()
            .single()

        if (createError) {
            console.error('[Create Conversation] Insert error:', createError)
            return NextResponse.json(
                { error: 'Failed to create conversation' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            conversation_id: conversation.id,
            is_new: true,
        })
    } catch (error) {
        console.error('[Create Conversation] Error:', error)
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
