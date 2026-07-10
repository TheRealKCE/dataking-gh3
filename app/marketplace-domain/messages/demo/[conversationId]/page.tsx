'use client'

import { Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ChatConversation, type ChatHeader } from '@/components/marketplace/chat-conversation'

/**
 * Chat conversation screen reached from the listing detail page (Send Message /
 * Chat). The pinned listing + starter template arrive as query params from the
 * find-or-create step. With the real backend, load the conversation + messages
 * by :conversationId and drop the query params.
 */
function ChatDemoInner() {
    const router = useRouter()
    const params = useParams<{ conversationId: string }>()
    const sp = useSearchParams()

    const header: ChatHeader = {
        other_user: {
            id: sp.get('sellerId') ?? 's1',
            name: sp.get('sellerName') ?? 'Seller',
            last_seen: 'online',
        },
        listing: {
            id: sp.get('listingId') ?? 'l1',
            title: sp.get('title') ?? 'Listing',
            price_pesewas: Number(sp.get('price') ?? 0),
            image_url: sp.get('image') ?? undefined,
        },
    }

    return (
        <ChatConversation
            conversationId={params.conversationId}
            currentUserId={sp.get('buyerId') ?? 'me'}
            header={header}
            initialMessages={[]}
            initialInput={sp.get('starter') ?? ''}
            onBack={() => router.back()}
            onOpenListing={() => router.push('/marketplace-domain/listings/demo')}
        />
    )
}

export default function ChatDemoPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading chat…</div>}>
            <ChatDemoInner />
        </Suspense>
    )
}
