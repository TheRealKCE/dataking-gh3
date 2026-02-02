'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, X, Send, Minimize2, Maximize2, Loader2, Crown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Message {
    id: string
    sender_id: string
    message: string
    read: boolean
    created_at: string
}

interface ConversationData {
    id: string
    agent_id: string
    status: string
}

export default function AgentChatFloat() {
    const { dbUser } = useAuth()
    const { isInternalSidebarOpen } = useUI()
    const [isOpen, setIsOpen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [conversation, setConversation] = useState<ConversationData | null>(null)
    const [unreadCount, setUnreadCount] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [isDismissed, setIsDismissed] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Hide if not an agent or dismissed
    if (dbUser?.role !== 'agent' || isDismissed) return null

    // Hide on mobile if sidebar is open
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024
    if (isMobile && isInternalSidebarOpen) return null

    // Fetch or create conversation
    useEffect(() => {
        const initConversation = async () => {
            if (!dbUser?.id) return

            try {
                // Check if conversation exists
                const { data: existing } = await (supabase
                    .from('chat_conversations')
                    .select('*')
                    .eq('agent_id', dbUser.id)
                    .eq('status', 'active')
                    .single() as any)

                if (existing) {
                    setConversation(existing)
                } else {
                    // Create new conversation
                    // @ts-ignore
                    const { data: newConv, error } = await (supabase
                        .from('chat_conversations')
                        // @ts-ignore
                        .insert({ agent_id: dbUser.id }) as any)
                        .select()
                        .single()

                    if (error) throw error
                    setConversation(newConv)
                }
            } catch (error) {
                console.error('Error initializing conversation:', error)
            }
        }

        initConversation()
    }, [dbUser?.id])

    // Fetch messages
    useEffect(() => {
        if (!conversation?.id) return

        const fetchMessages = async () => {
            setIsLoading(true)
            try {
                const { data, error } = await (supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('conversation_id', conversation.id)
                    .order('created_at', { ascending: true }) as any)

                if (error) throw error
                setMessages(data || [])

                // Count unread messages from admin
                const unread = (data || []).filter(
                    (m: Message) => !m.read && m.sender_id !== dbUser?.id
                ).length
                setUnreadCount(unread)
            } catch (error) {
                console.error('Error fetching messages:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchMessages()

        // Subscribe to realtime updates
        const channel = supabase
            .channel(`chat_${conversation.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${conversation.id}`
            }, (payload) => {
                const newMsg = payload.new as Message
                setMessages(prev => [...prev, newMsg])

                // Update unread count if message from admin
                if (newMsg.sender_id !== dbUser?.id) {
                    setUnreadCount(prev => prev + 1)

                    // Show notification if chat is closed
                    if (!isOpen) {
                        toast.info('New message from admin')
                    }
                }

                scrollToBottom()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [conversation?.id, dbUser?.id, isOpen])

    // Mark messages as read when opening chat
    useEffect(() => {
        if (isOpen && conversation?.id && dbUser?.id) {
            const markAsRead = async () => {
                // @ts-ignore
                await (supabase
                    .from('chat_messages')
                    // @ts-ignore
                    .update({ read: true }) as any)
                    .eq('conversation_id', conversation.id)
                    .eq('read', false)
                    .neq('sender_id', dbUser.id)

                setUnreadCount(0)
            }
            markAsRead()
        }
    }, [isOpen, conversation?.id, dbUser?.id])

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Send message
    const handleSend = async () => {
        if (!newMessage.trim() || !conversation?.id || !dbUser?.id) return

        setIsSending(true)
        try {
            // @ts-ignore
            const { error } = await (supabase
                .from('chat_messages')
                // @ts-ignore
                .insert({
                    conversation_id: conversation.id,
                    sender_id: dbUser.id,
                    message: newMessage.trim()
                }) as any)

            if (error) throw error

            setNewMessage('')
        } catch (error) {
            console.error('Error sending message:', error)
            toast.error('Failed to send message')
        } finally {
            setIsSending(false)
        }
    }

    // Handle Enter key
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <>
            {/* Float Button Label + Button */}
            {!isOpen && (
                <div className={cn(
                    "fixed bottom-6 right-6 z-50 flex items-center gap-3 transition-all duration-300",
                    isInternalSidebarOpen && !isMobile ? "translate-x-[-320px]" : "" // Shift if sidebar is open on desktop
                )}>
                    {/* Label */}
                    <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-gray-200 animate-in fade-in slide-in-from-right-4 duration-500">
                        <p className="text-sm font-bold text-gray-800 whitespace-nowrap">
                            Chat Live with Admin
                        </p>
                    </div>

                    <div className="relative group">
                        <button
                            onClick={() => setIsOpen(true)}
                            className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                        >
                            <MessageCircle className="w-7 h-7" />
                            {unreadCount > 0 && (
                                <Badge className="absolute -top-2 -right-2 bg-red-500 text-white px-2 py-0.5 text-xs font-bold">
                                    {unreadCount}
                                </Badge>
                            )}
                        </button>

                        {/* Dismiss Button */}
                        <button
                            onClick={() => setIsDismissed(true)}
                            className="absolute -top-1 -left-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-red-500 border border-gray-200 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Chat Window */}
            {isOpen && (
                <Card
                    className={cn(
                        "fixed bottom-6 right-6 z-50 shadow-2xl border-2 transition-all duration-300",
                        isInternalSidebarOpen && !isMobile ? "translate-x-[-320px]" : "", // Shift if sidebar is open on desktop
                        isMinimized ? "w-80 h-16" : "w-96 h-[600px]",
                        "flex flex-col"
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-t-lg">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-black" />
                            <h3 className="font-bold text-black">Admin Support</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsMinimized(!isMinimized)}
                                className="h-8 w-8 text-black hover:bg-yellow-500"
                            >
                                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsOpen(false)}
                                className="h-8 w-8 text-black hover:bg-yellow-500"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-gray-500 text-sm text-center">
                                        <p>No messages yet.<br />Start a conversation with admin!</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isOwn = msg.sender_id === dbUser?.id
                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "flex",
                                                    isOwn ? "justify-end" : "justify-start"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm",
                                                        isOwn
                                                            ? "bg-yellow-500 text-black"
                                                            : "bg-white text-gray-900"
                                                    )}
                                                >
                                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                                    <p className={cn(
                                                        "text-xs mt-1",
                                                        isOwn ? "text-black/60" : "text-gray-500"
                                                    )}>
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-4 border-t bg-white">
                                <div className="flex gap-2">
                                    <Input
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        placeholder="Type a message..."
                                        className="flex-1"
                                        disabled={isSending}
                                    />
                                    <Button
                                        onClick={handleSend}
                                        disabled={!newMessage.trim() || isSending}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-black"
                                    >
                                        {isSending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </Card>
            )}
        </>
    )
}
