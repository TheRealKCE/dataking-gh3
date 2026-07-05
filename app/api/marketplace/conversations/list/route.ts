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

        // Get conversations for current user (as buyer or seller)
        const { data: conversations, count, error } = await supabaseUserClient
            .from('marketplace_conversations')
            .select(
                `
                id,
                listing_id,
                buyer_id,
                seller_id,
                created_at,
                updated_at,
                classified_listings(title, price_pesewas),
                marketplace_conversation_messages(message, created_at, read_at, user_id)
                `,
                { count: 'exact' }
            )
            .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('[Conversations List] Query error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch conversations' },
                { status: 500 }
            )
        }

        // Transform: add last message, unread count, other person info
        const transformed = conversations?.map((conv: any) => {
            const messages = conv.marketplace_conversation_messages || []
            const lastMessage = messages[messages.length - 1]

            const unreadCount = messages.filter(
                (m: any) => !m.read_at && m.user_id !== user.id
            ).length

            const otherUserId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id

            return {
                id: conv.id,
                listing_id: conv.listing_id,
                listing: conv.classified_listings,
                other_user_id: otherUserId,
                last_message: lastMessage?.message || '',
                last_message_at: lastMessage?.created_at || conv.updated_at,
                unread_count: unreadCount,
                created_at: conv.created_at,
            }
        }) || []

        return NextResponse.json({
            success: true,
            conversations: transformed,
            pagination: {
                page,
                limit,
                total: count || 0,
                pages: Math.ceil((count || 0) / limit),
            },
        })
    } catch (error) {
        console.error('[Conversations List] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
