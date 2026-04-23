'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Bell, Info, Megaphone, CheckCircle2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// Types
interface Announcement {
    id: string
    title: string
    message: string
    created_at: string
}

const STORAGE_KEY = 'ARHMS_last_viewed_announcements'
const HIDE_KEY = 'ARHMS_bell_dismissed_at'

interface AnnouncementBellProps {
    inline?: boolean
}

export function AnnouncementBell({ inline = false }: AnnouncementBellProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [lastViewed, setLastViewed] = useState<string | null>(null)
    const [dismissedAt, setDismissedAt] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Fetch logic
    const fetchAnnouncements = async (isInitial = false) => {
        try {
            const { data, error } = await supabase
                .from('system_announcements')
                .select('id, title, message, created_at')
                .eq('is_active', true)
                .in('visible_on', ['main_site', 'both'])
                .order('created_at', { ascending: false })
                .limit(5)

            if (error) throw error
            if (data) {
                if (isInitial || JSON.stringify(data) !== JSON.stringify(announcements)) {
                    setAnnouncements(data)
                }
            }
        } catch (error) {
            console.error('Error fetching announcements:', error)
        }
    }

    // Load states and initial fetch
    useEffect(() => {
        const savedViewed = localStorage.getItem(STORAGE_KEY)
        const savedDismissed = localStorage.getItem(HIDE_KEY)
        
        if (savedViewed) setLastViewed(savedViewed)
        if (savedDismissed) setDismissedAt(savedDismissed)
        
        fetchAnnouncements(true)

        const interval = setInterval(() => {
            fetchAnnouncements()
        }, 3 * 60 * 1000)

        return () => clearInterval(interval)
    }, [])

    const latestCreatedAt = announcements.length > 0 ? announcements[0].created_at : null
    
    // Determine if the bell should be visible
    // Visible if: 
    // 1. Not dismissed OR
    // 2. New announcement arrived AFTER dismissal
    const isVisible = announcements.length > 0 && (
        !dismissedAt || (latestCreatedAt && new Date(latestCreatedAt) > new Date(dismissedAt))
    )

    const hasUnread = announcements.some(a => {
        if (!lastViewed) return true
        return new Date(a.created_at) > new Date(lastViewed)
    })

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleOpen = () => {
        const nextState = !isOpen
        if (nextState) {
            const now = new Date().toISOString()
            setLastViewed(now)
            localStorage.setItem(STORAGE_KEY, now)
        }
        setIsOpen(nextState)
    }

    const dismissBell = () => {
        const now = new Date().toISOString()
        setDismissedAt(now)
        localStorage.setItem(HIDE_KEY, now)
        setIsOpen(false)
    }

    if (!isVisible) return null

    return (
        <div
            ref={containerRef}
            className={cn(
                inline ? "relative z-10" : "fixed top-20 right-4 z-[100] lg:right-8"
            )}
        >
            {/* --- Alert Popover (shown when unread and closed) --- */}
            {hasUnread && !isOpen && (
                <div className="absolute top-1/2 -left-3 -translate-x-full -translate-y-1/2 hidden md:flex items-center">
                    <div className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg animate-bounce-x flex items-center gap-1 whitespace-nowrap">
                        <Megaphone className="w-3 h-3" />
                        New notice available!
                    </div>
                    <div className="w-2 h-2 bg-primary rotate-45 -ml-1"></div>
                </div>
            )}

            {/* --- Ring Button --- */}
            <button
                onClick={toggleOpen}
                className={cn(
                    "relative w-12 h-12 flex items-center justify-center rounded-2xl bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-800 shadow-xl backdrop-blur-xl transition-all duration-300",
                    "hover:scale-110 active:scale-95 group",
                    isOpen ? "ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-black" : ""
                )}
            >
                <div className={cn(
                    "relative transition-transform duration-300 group-hover:rotate-12",
                    hasUnread && "animate-elastic-ring"
                )}>
                    <Bell className={cn(
                        "w-6 h-6 transition-colors duration-300",
                        hasUnread 
                            ? "text-[#FFD700] fill-[#FFD700]/30 drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]" 
                            : "text-gray-400 dark:text-gray-500 hover:text-amber-500"
                    )} />
                </div>

                {/* Notification Dot */}
                {hasUnread && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white dark:border-gray-950 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                        </span>
                    </span>
                )}
            </button>

            {/* --- Announcements Popover --- */}
            <div className={cn(
                "absolute right-0 w-[340px] max-w-[calc(100vw-1.5rem)] max-h-[550px] overflow-hidden bg-white/98 dark:bg-gray-950/98 border border-gray-200 dark:border-gray-800 rounded-[2rem] shadow-2xl backdrop-blur-2xl transition-all duration-500 origin-top-right",
                inline ? "top-14" : "top-16",
                isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-4 pointer-events-none"
            )}>
                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-800/50 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/40">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-sm font-black tracking-tight uppercase text-gray-800 dark:text-gray-100">Announcements</h2>
                    </div>
                    <button 
                        onClick={dismissBell}
                        className="text-[11px] font-bold text-gray-400 hover:text-primary dark:hover:text-primary-foreground transition-colors flex items-center gap-1"
                    >
                        <CheckCircle2 className="w-3 h-3" />
                        Got it, thanks
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[380px] p-4 space-y-4 custom-scrollbar">
                    {announcements.length > 0 ? (
                        announcements.map((announcement) => {
                            const isNew = !lastViewed || new Date(announcement.created_at) > new Date(lastViewed);
                            return (
                                <div
                                    key={announcement.id}
                                    className={cn(
                                        "p-5 rounded-3xl transition-all duration-300 relative group border",
                                        isNew
                                            ? "bg-amber-50/40 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30 shadow-sm"
                                            : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800/50 text-gray-500 opacity-80"
                                    )}
                                >
                                    <div className="flex flex-col gap-2 mb-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className={cn(
                                                "text-[14px] font-extrabold leading-tight",
                                                isNew ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
                                            )}>
                                                {announcement.title}
                                            </h3>
                                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0">
                                                {formatDate(announcement.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                                        {announcement.message}
                                    </p>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center mb-4">
                                <Info className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-[13px] font-bold text-gray-300 dark:text-gray-600">No active announcements</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50/80 dark:bg-gray-900/50 text-center border-t border-gray-100 dark:border-gray-800/50">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold tracking-wider uppercase flex items-center justify-center gap-2">
                        <span className="w-1 h-1 bg-primary rounded-full"></span>
                        Stay Connected • ARHMS
                        <span className="w-1 h-1 bg-primary rounded-full"></span>
                    </p>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(156, 163, 175, 0.2);
                    border-radius: 10px;
                }
                @keyframes bounce-x {
                    0%, 100% { transform: translateX(-5px) translateY(-50%); }
                    50% { transform: translateX(5px) translateY(-50%); }
                }
                .animate-bounce-x {
                    animation: bounce-x 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    )
}
