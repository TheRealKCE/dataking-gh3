import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ConversationThread } from '@/components/marketplace/conversation-thread'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft } from 'lucide-react'

async function getConversation(id: string, userId: string) {
    try {
        const supabase = await createRouteHandlerClient()

        const { data, error } = await supabase
            .from('marketplace_conversations')
            .select(
                `
                id,
                listing_id,
                buyer_id,
                seller_id,
                created_at,
                classified_listings(title, price_pesewas)
                `
            )
            .eq('id', id)
            .single()

        if (error || !data) return null

        // Check authorization
        if (data.buyer_id !== userId && data.seller_id !== userId) {
            return null
        }

        return data
    } catch (error) {
        console.error('[Get Conversation] Error:', error)
        return null
    }
}

export async function generateMetadata({
    params: { id },
}: {
    params: { id: string }
}) {
    return {
        title: `Conversation | Arhms Marketplace`,
    }
}

export default async function ConversationPage({
    params: { id },
}: {
    params: { id: string }
}) {
    const supabase = await createRouteHandlerClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/messages')
    }

    const conversation = await getConversation(id, user.id)

    if (!conversation) {
        notFound()
    }

    const otherUserId =
        conversation.buyer_id === user.id
            ? conversation.seller_id
            : conversation.buyer_id

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8 max-w-4xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/marketplace-domain/messages">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">
                            {conversation.classified_listings.title}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            GHS{' '}
                            {(conversation.classified_listings.price_pesewas / 100).toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Chat */}
                <Card className="h-[600px] flex flex-col overflow-hidden">
                    <ConversationThread
                        conversationId={id}
                        otherUserId={otherUserId}
                    />
                </Card>
            </div>
        </div>
    )
}
