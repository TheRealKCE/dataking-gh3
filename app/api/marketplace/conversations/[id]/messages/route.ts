import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { z } from 'zod'

const SendMessageSchema = z.object({
    conversation_id: z.string().uuid(),
    message: z.string().min(1).max(5000),
})

export async function POST(
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

        const body = await request.json()
        const { message } = SendMessageSchema.parse(body)

        // Verify conversation exists and user is part of it
        const { data: conversation, error: convError } = await supabaseUserClient
            .from('marketplace_conversations')
            .select('id, buyer_id, seller_id')
            .eq('id', id)
            .single()

        if (convError || !conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Insert message
        const { data: newMessage, error: insertError } = await (supabaseUserClient
            .from('marketplace_messages') as any)
            .insert({
                conversation_id: id,
                sender_id: user.id,
                body: message.trim(),
            })
            .select()
            .single()

        if (insertError) {
            console.error('[Send Message] Insert error:', insertError)
            return NextResponse.json(
                { error: 'Failed to send message' },
                { status: 500 }
            )
        }

        // Update conversation updated_at
        await supabaseUserClient
            .from('marketplace_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', id)

        return NextResponse.json({
            success: true,
            message: newMessage,
        })
    } catch (error) {
        console.error('[Send Message] Error:', error)
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
