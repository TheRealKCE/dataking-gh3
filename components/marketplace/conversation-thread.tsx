'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase'

interface Message {
    id: string
    user_id: string
    message: string
    created_at: string
    read_at?: string
}

interface ConversationThreadProps {
    conversationId: string
    otherUserId: string
}

export function ConversationThread({ conversationId, otherUserId }: ConversationThreadProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [messageInput, setMessageInput] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string>('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabaseRef = useRef(createBrowserClient())

    // Get current user
    useEffect(() => {
        const getUser = async () => {
            const supabase = supabaseRef.current
            const {
                data: { user },
            } = await supabase.auth.getUser()
            setCurrentUserId(user?.id || '')
        }
        getUser()
    }, [])

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Fetch messages
    const fetchMessages = useCallback(async () => {
        try {
            const response = await fetch(`/api/marketplace/conversations/${conversationId}`)
            const data = await response.json()

            if (!response.ok) throw new Error(data.error)

            setMessages(data.messages || [])
        } catch (error) {
            console.error('[ConversationThread] Fetch error:', error)
        } finally {
            setLoading(false)
        }
    }, [conversationId])

    // Initial load
    useEffect(() => {
        fetchMessages()
    }, [fetchMessages])

    // Poll for new messages
    useEffect(() => {
        const interval = setInterval(() => {
            fetchMessages()
        }, 2000)

        return () => clearInterval(interval)
    }, [fetchMessages])

    // Send message
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()

        const trimmedMessage = messageInput.trim()
        if (!trimmedMessage) return

        setSending(true)
        try {
            const response = await fetch(
                `/api/marketplace/conversations/${conversationId}/messages`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: conversationId,
                        message: trimmedMessage,
                    }),
                }
            )

            if (!response.ok) throw new Error('Failed to send message')

            setMessageInput('')
            await fetchMessages()
        } catch (error) {
            console.error('[Send Message] Error:', error)
            toast.error('Failed to send message')
        } finally {
            setSending(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 p-4 mb-4">
                {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No messages yet. Say hello!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.user_id === currentUserId

                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-xs px-4 py-2 rounded-lg ${
                                        isOwn
                                            ? 'bg-primary text-primary-foreground rounded-br-none'
                                            : 'bg-muted rounded-bl-none'
                                    }`}
                                >
                                    <p className="text-sm break-words">{msg.message}</p>
                                    <p
                                        className={`text-xs mt-1 ${
                                            isOwn
                                                ? 'text-primary-foreground/70'
                                                : 'text-muted-foreground'
                                        }`}
                                    >
                                        {new Date(msg.created_at).toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        disabled={sending}
                        className="flex-1"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={sending || !messageInput.trim()}
                    >
                        {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </form>
            </div>
        </div>
    )
}
