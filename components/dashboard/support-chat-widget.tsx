'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, X, User, Headphones, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Message {
    id: string
    text: string
    sender: 'user' | 'support'
    timestamp: Date
}

export function SupportChatWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Hello! How can we help you today?',
            sender: 'support',
            timestamp: new Date(),
        },
    ])
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isOpen])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!message.trim() || isLoading) return

        const userText = message

        const newUserMessage: Message = {
            id: Date.now().toString(),
            text: userText,
            sender: 'user',
            timestamp: new Date(),
        }

        setMessages((prev) => [...prev, newUserMessage])
        setMessage('')
        setIsLoading(true)

        try {
            const response = await fetch('/api/support-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userText }),
            })

            const data = await response.json()

            const supportResponse: Message = {
                id: (Date.now() + 1).toString(),
                text: data.reply || "Sorry, I couldn't process that request.",
                sender: 'support',
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, supportResponse])
        } catch (error) {
            const errorResponse: Message = {
                id: (Date.now() + 1).toString(),
                text: "Network error. Please try again.",
                sender: 'support',
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, errorResponse])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-[60]">
            {/* Chat Window */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 w-[350px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-10rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                    {/* Header */}
                    <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between shadow-md">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                                <Headphones className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Customer Support</h3>
                                <p className="text-[10px] opacity-80">We typically reply in minutes</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-md transition-colors"
                            >
                                <Minimize2 className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-md transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50"
                    >
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex w-full",
                                    msg.sender === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                <div className={cn(
                                    "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                                    msg.sender === 'user'
                                        ? "bg-primary text-primary-foreground rounded-tr-none"
                                        : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-none"
                                )}>
                                    <p>{msg.text}</p>
                                    <p className={cn(
                                        "text-[10px] mt-1 opacity-60 text-right",
                                        msg.sender === 'user' ? "text-primary-foreground/80" : "text-slate-500"
                                    )}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Input Area */}
                    <form
                        onSubmit={handleSend}
                        className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
                    >
                        <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 bg-slate-100 dark:bg-slate-800 border-none focus-visible:ring-1 focus-visible:ring-primary h-10"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={!message.trim() || isLoading}
                            className="h-10 w-10 shrink-0"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            )}

            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95",
                    isOpen
                        ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white"
                        : "bg-primary text-primary-foreground"
                )}
            >
                {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}

                {/* Notification Badge (only when closed) */}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-white">
                        1
                    </span>
                )}
            </button>
        </div>
    )
}
