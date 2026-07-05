'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, MessageCircle } from 'lucide-react'

interface Conversation {
    id: string
    listing_id: string
    listing: {
        title: string
        price_pesewas: number
    }
    other_user_id: string
    last_message: string
    last_message_at: string
    unread_count: number
}

interface PaginationData {
    page: number
    limit: number
    total: number
    pages: number
}

export function ConversationList() {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
    })
    const [loading, setLoading] = useState(true)

    const fetchConversations = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.append('page', page.toString())
            params.append('limit', '20')

            const response = await fetch(`/api/marketplace/conversations/list?${params}`)
            const data = await response.json()

            if (!response.ok) throw new Error(data.error)

            setConversations(data.conversations)
            setPagination(data.pagination)
        } catch (error) {
            console.error('[ConversationList] Fetch error:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchConversations(1)

        // Poll for new messages every 3 seconds
        const interval = setInterval(() => {
            fetchConversations(pagination.page)
        }, 3000)

        return () => clearInterval(interval)
    }, [pagination.page])

    const formatTime = (date: string) => {
        const d = new Date(date)
        const now = new Date()

        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        }

        if (d.getFullYear() === now.getFullYear()) {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }

        return d.toLocaleDateString('en-US')
    }

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (conversations.length === 0) {
        return (
            <Card className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No conversations yet</p>
            </Card>
        )
    }

    return (
        <div className="space-y-2">
            {conversations.map((conv) => (
                <Link key={conv.id} href={`/marketplace-domain/messages/${conv.id}`}>
                    <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between mb-1 gap-2">
                                    <h3 className="font-semibold text-sm line-clamp-1">
                                        {conv.listing.title}
                                    </h3>
                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                        {formatTime(conv.last_message_at)}
                                    </span>
                                </div>

                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                    {conv.last_message || '(no messages yet)'}
                                </p>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        GHS {(conv.listing.price_pesewas / 100).toFixed(2)}
                                    </span>
                                    {conv.unread_count > 0 && (
                                        <Badge variant="default" className="text-xs">
                                            {conv.unread_count}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                </Link>
            ))}

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button
                        className="px-3 py-2 text-sm border rounded hover:bg-muted disabled:opacity-50"
                        disabled={pagination.page === 1}
                        onClick={() => fetchConversations(pagination.page - 1)}
                    >
                        Previous
                    </button>
                    <span className="text-sm text-muted-foreground px-3 py-2">
                        {pagination.page} / {pagination.pages}
                    </span>
                    <button
                        className="px-3 py-2 text-sm border rounded hover:bg-muted disabled:opacity-50"
                        disabled={pagination.page === pagination.pages}
                        onClick={() => fetchConversations(pagination.page + 1)}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}
