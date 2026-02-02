'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, Send, Loader2, User, Crown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Message {
    id: string
    sender_id: string
    message: string
    read: boolean
    created_at: string
}

interface Conversation {
    id: string
    agent_id: string
    status: string
    last_message_at: string
    agent?: {
        first_name: string
        last_name: string
        email: string
    }
    unread_count?: number
}

export default function AdminChatPanel() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Only accessible to admins and sub-admins
    if (!isAdmin && !isSubAdmin) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">Access denied. Admin privileges required.</p>
            </div>
        )
    }

    // Fetch all conversations
    useEffect(() => {
        const fetchConversations = async () => {
            setIsLoading(true)
            try {
                const { data: convs, error } = await (supabase
                    .from('chat_conversations')
                    .select(`
                        *,
                        agent:users!agent_id(first_name, last_name, email)
                    `)
                    .order('last_message_at', { ascending: false }) as any)

                if (error) throw error

                // Fetch unread counts for each conversation
                const convsWithUnread = await Promise.all(
                    (convs || []).map(async (conv: any) => {
                        const { count } = await (supabase
                            .from('chat_messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('conversation_id', conv.id)
                            .eq('read', false)
                            .neq('sender_id', dbUser?.id) as any)

                        return { ...conv, unread_count: count || 0 }
                    })
                )

                setConversations(convsWithUnread)
            } catch (error) {
                console.error('Error fetching conversations:', error)
                toast.error('Failed to load conversations')
            } finally {
                setIsLoading(false)
            }
        }

        fetchConversations()

        // Subscribe to new conversations
        const channel = supabase
            .channel('admin_chat_conversations')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_conversations'
            }, () => {
                fetchConversations()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [dbUser?.id])

    // Fetch messages for selected conversation
    useEffect(() => {
        if (!selectedConv?.id) return

        const fetchMessages = async () => {
            try {
                const { data, error } = await (supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('conversation_id', selectedConv.id)
                    .order('created_at', { ascending: true }) as any)

                if (error) throw error
                setMessages(data || [])

                // Mark as read
                // @ts-ignore - Types will be available after running chat_schema.sql migration
                await (supabase
                    .from('chat_messages')
                    .update({ read: true }) as any)
                    .eq('conversation_id', selectedConv.id)
                    .eq('read', false)
                    .neq('sender_id', dbUser?.id)

                scrollToBottom()
            } catch (error) {
                console.error('Error fetching messages:', error)
            }
        }

        fetchMessages()

        // Subscribe to new messages
        const channel = supabase
            .channel(`admin_chat_${selectedConv.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${selectedConv.id}`
            }, (payload) => {
                setMessages(prev => [...prev, payload.new as Message])
                scrollToBottom()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [selectedConv?.id, dbUser?.id])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Send message
    const handleSend = async () => {
        if (!newMessage.trim() || !selectedConv?.id || !dbUser?.id) return

        setIsSending(true)
        try {
            // @ts-ignore - Types will be available after running chat_schema.sql migration
            const { error } = await (supabase
                .from('chat_messages')
                .insert({
                    conversation_id: selectedConv.id,
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

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex items-center gap-3">
                <MessageCircle className="w-8 h-8 text-yellow-600" />
                <div>
                    <h1 className="text-3xl font-bold">Agent Support Chats</h1>
                    <p className="text-gray-600 text-sm">Manage conversations with agents</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
                {/* Conversations List */}
                <Card className="lg:col-span-1 overflow-hidden flex flex-col">
                    <CardHeader className="bg-gradient-to-r from-yellow-400 to-yellow-600">
                        <CardTitle className="text-black text-lg">Conversations</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-500 text-sm p-4 text-center">
                                No agent conversations yet
                            </div>
                        ) : (
                            conversations.map((conv: any) => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConv(conv)}
                                    className={cn(
                                        "w-full p-4 border-b hover:bg-gray-100 transition-colors text-left",
                                        selectedConv?.id === conv.id && "bg-yellow-50 border-l-4 border-l-yellow-500"
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-sm flex items-center gap-1">
                                                    {conv.agent?.first_name} {conv.agent?.last_name}
                                                    <Crown className="w-3 h-3 text-yellow-500" />
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">{conv.agent?.email}</p>
                                            </div>
                                        </div>
                                        {conv.unread_count > 0 && (
                                            <Badge className="bg-red-500 text-white px-2 text-xs">
                                                {conv.unread_count}
                                            </Badge>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Chat Window */}
                <Card className="lg:col-span-2 overflow-hidden flex flex-col">
                    {selectedConv ? (
                        <>
                            <CardHeader className="bg-gradient-to-r from-yellow-400 to-yellow-600 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                                        <User className="w-5 h-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-black text-lg flex items-center gap-2">
                                            {selectedConv.agent?.first_name} {selectedConv.agent?.last_name}
                                            <Crown className="w-4 h-4 text-yellow-900" />
                                        </CardTitle>
                                        <p className="text-xs text-black/70">{selectedConv.agent?.email}</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                                {messages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                        No messages yet
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
                                                            ? "bg-blue-500 text-white"
                                                            : "bg-white text-gray-900"
                                                    )}
                                                >
                                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                                    <p className={cn(
                                                        "text-xs mt-1",
                                                        isOwn ? "text-white/70" : "text-gray-500"
                                                    )}>
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </CardContent>
                            <div className="p-4 border-t bg-white">
                                <div className="flex gap-2">
                                    <Input
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={handleKeyPress}
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
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Select a conversation to start chatting
                        </div>
                    )}
                </Card>
            </div>
        </div>
    )
}
