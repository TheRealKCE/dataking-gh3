import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

export async function GET(
    request: NextRequest,
    { params: { id } }: { params: { id: string } }
) {
    try {
        const supabaseUserClient = await createRouteHandlerClient()

        const {
            data: { user },
        } = await supabaseUserClient.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'))
        const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') || '50'))
        const offset = (page - 1) * limit

        // Get conversation
        const { data: conversation, error: convError } = await supabaseUserClient
            .from('marketplace_conversations')
            .select('*')
            .eq('id', id)
            .single()

        if (convError || !conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        // Check authorization
        if (
            conversation.buyer_id !== user.id &&
            conversation.seller_id !== user.id
        ) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Get messages
        const { data: messages, count, error: messagesError } = await supabaseUserClient
            .from('marketplace_conversation_messages')
            .select('id, user_id, message, created_at, read_at', { count: 'exact' })
            .eq('conversation_id', id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (messagesError) {
            console.error('[Conversation] Messages error:', messagesError)
            return NextResponse.json(
                { error: 'Failed to fetch messages' },
                { status: 500 }
            )
        }

        // Mark messages as read
        const unreadMessageIds = (messages || [])
            .filter((m: any) => !m.read_at && m.user_id !== user.id)
            .map((m: any) => m.id)

        if (unreadMessageIds.length > 0) {
            await supabaseUserClient
                .from('marketplace_conversation_messages')
                .update({ read_at: new Date().toISOString() })
                .in('id', unreadMessageIds)
        }

        const otherUserId =
            conversation.buyer_id === user.id
                ? conversation.seller_id
                : conversation.buyer_id

        return NextResponse.json({
            success: true,
            conversation: {
                id: conversation.id,
                listing_id: conversation.listing_id,
                other_user_id: otherUserId,
                created_at: conversation.created_at,
            },
            messages: (messages || []).reverse(),
            pagination: {
                page,
                limit,
                total: count || 0,
                pages: Math.ceil((count || 0) / limit),
            },
        })
    } catch (error) {
        console.error('[Conversation] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
