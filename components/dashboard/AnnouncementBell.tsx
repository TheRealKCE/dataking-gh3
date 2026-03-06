'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Bell, Info, Megaphone } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// Types
interface Announcement {
    id: string
    title: string
    message: string
    created_at: string
}

const STORAGE_KEY = 'kingflexy_last_viewed_announcements'

export function AnnouncementBell() {
    const [isOpen, setIsOpen] = useState(false)
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [lastViewed, setLastViewed] = useState<string | null>(null)
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
                // Only update if there's a change or if it's the initial load
                if (isInitial || JSON.stringify(data) !== JSON.stringify(announcements)) {
                    setAnnouncements(data)
                }
            }
        } catch (error) {
            console.error('Error fetching announcements:', error)
        }
    }

    // Load last viewed timestamp and initial fetch
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) setLastViewed(saved)
        fetchAnnouncements(true)

        // Periodic refresh every 3 minutes
        const interval = setInterval(() => {
            fetchAnnouncements()
        }, 3 * 60 * 1000)

        return () => clearInterval(interval)
    }, [])

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
            // When opening, mark as read by updating the timestamp
            const now = new Date().toISOString()
            setLastViewed(now)
            localStorage.setItem(STORAGE_KEY, now)
        }
        setIsOpen(nextState)
    }

    return (
        <div ref={containerRef} className="fixed top-20 right-4 z-[100] lg:right-8">
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
                    "relative w-12 h-12 flex items-center justify-center rounded-2xl bg-white/95 dark:bg-gray-950/95 border border-gray-200 dark:border-gray-800 shadow-xl backdrop-blur-xl transition-all duration-300",
                    "hover:scale-110 active:scale-95 group",
                    isOpen ? "ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-black" : ""
                )}
            >
                <div className={cn(
                    "relative transition-transform duration-300 group-hover:rotate-12",
                    hasUnread && "animate-elastic-ring"
                )}>
                    {/* Gold Bell Icon */}
                    <Bell className={cn(
                        "w-6 h-6 transition-colors duration-300",
                        hasUnread 
                            ? "text-[#FFD700] fill-[#FFD700]/30 drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]" 
                            : "text-gray-400 dark:text-gray-500 hover:text-amber-500"
                    )} />
                </div>

                {/* Notification Dot (Pure Red) */}
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
                "absolute top-16 right-0 w-80 max-h-[480px] overflow-hidden bg-white/98 dark:bg-gray-900/98 border border-gray-200 dark:border-gray-800 rounded-[2rem] shadow-2xl backdrop-blur-2xl transition-all duration-500 origin-top-right",
                isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-4 pointer-events-none"
            )}>
                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-800/50 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/20">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-sm font-black tracking-tight uppercase text-gray-800 dark:text-gray-200">Announcements</h2>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[320px] p-3 space-y-2.5 custom-scrollbar">
                    {announcements.length > 0 ? (
                        announcements.map((announcement) => {
                            const isNew = !lastViewed || new Date(announcement.created_at) > new Date(lastViewed);
                            return (
                                <div
                                    key={announcement.id}
                                    className={cn(
                                        "p-4 rounded-2xl transition-all duration-300 relative group",
                                        isNew
                                            ? "bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 shadow-sm"
                                            : "bg-transparent text-gray-500 opacity-60 hover:opacity-100 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-1.5 gap-2">
                                        <h3 className={cn(
                                            "text-[13px] font-bold leading-tight",
                                            isNew ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"
                                        )}>
                                            {announcement.title}
                                        </h3>
                                        <span className="text-[10px] opacity-60 font-semibold whitespace-nowrap shrink-0 mt-0.5">
                                            {formatDate(announcement.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-[12px] leading-relaxed line-clamp-4">
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
                <div className="p-4 bg-gray-50/80 dark:bg-gray-800/50 text-center border-t border-gray-100 dark:border-gray-800/50">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold tracking-wider uppercase">
                        Stay Connected • KingFlexy
                    </p>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
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
