'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Bell, X, Info, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
interface Announcement {
    id: string
    title: string
    message: string
    date: string
    isRead: boolean
}

const SAMPLE_ANNOUNCEMENTS: Announcement[] = [
    {
        id: '1',
        title: 'New Service: Mobile App Available',
        message: 'You can now download the official KingFlexyGh mobile app from the dashboard.',
        date: '2026-03-05',
        isRead: false
    },
    {
        id: '2',
        title: 'System Upgrade Scheduled',
        message: 'A minor system upgrade is scheduled for Sunday at 2 AM. Expect brief downtime.',
        date: '2026-03-04',
        isRead: false
    }
]

export function AnnouncementBell() {
    const [isOpen, setIsOpen] = useState(false)
    const [announcements, setAnnouncements] = useState<Announcement[]>(SAMPLE_ANNOUNCEMENTS)
    const containerRef = useRef<HTMLDivElement>(null)

    const unreadCount = announcements.filter(a => !a.isRead).length
    const hasUnread = unreadCount > 0

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

    const toggleOpen = () => setIsOpen(!isOpen)

    const markAllRead = () => {
        setAnnouncements(announcements.map(a => ({ ...a, isRead: true })))
    }

    const markAsRead = (id: string) => {
        setAnnouncements(announcements.map(a => a.id === id ? { ...a, isRead: true } : a))
    }

    return (
        <div ref={containerRef} className="absolute top-2.5 left-2.5 z-[100] lg:left-4">
            {/* --- Ring Button --- */}
            <button
                onClick={toggleOpen}
                className={cn(
                    "relative w-11 h-11 flex items-center justify-center rounded-xl bg-white/90 dark:bg-gray-950/90 border border-gray-200 dark:border-gray-800 shadow-lg backdrop-blur-xl transition-all duration-300",
                    "hover:scale-110 active:scale-95 group",
                    isOpen ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-black" : ""
                )}
            >
                <div className={cn(
                    "relative transition-transform duration-300 group-hover:rotate-12",
                    hasUnread && "animate-elastic-ring"
                )}>
                    <Bell className={cn(
                        "w-5 h-5",
                        hasUnread ? "text-primary fill-primary/10" : "text-gray-500 dark:text-gray-400"
                    )} />
                </div>

                {/* Notification Dot */}
                {hasUnread && (
                    <span className="absolute top-2 right-2 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-gray-900"></span>
                    </span>
                )}
            </button>

            {/* --- Announcements Popover --- */}
            <div className={cn(
                "absolute top-14 left-0 w-80 max-h-[450px] overflow-hidden bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl backdrop-blur-2xl transition-all duration-300 origin-top-left",
                isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-4 pointer-events-none"
            )}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-bold tracking-tight uppercase">Latest Notices</h2>
                    </div>
                    {hasUnread && (
                        <button
                            onClick={markAllRead}
                            className="text-[11px] font-semibold text-primary hover:underline"
                        >
                            Mark all as read
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-80 p-2 space-y-2 custom-scrollbar">
                    {announcements.length > 0 ? (
                        announcements.map((announcement) => (
                            <div
                                key={announcement.id}
                                onClick={() => markAsRead(announcement.id)}
                                className={cn(
                                    "p-4 rounded-2xl transition-all duration-200 cursor-pointer group relative",
                                    announcement.isRead
                                        ? "bg-transparent text-gray-500 opacity-60 hover:opacity-100 dark:hover:bg-gray-800/50"
                                        : "bg-primary/5 hover:bg-primary/10 border-l-4 border-primary shadow-sm"
                                )}
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <h3 className={cn(
                                        "text-sm font-bold",
                                        !announcement.isRead && "text-gray-900 dark:text-white"
                                    )}>
                                        {announcement.title}
                                    </h3>
                                    <span className="text-[10px] opacity-50 font-medium">
                                        {announcement.date}
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed line-clamp-2">
                                    {announcement.message}
                                </p>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <Info className="w-8 h-8 opacity-20 mb-2" />
                            <p className="text-sm font-medium">No new announcements</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30 text-center border-t border-gray-200 dark:border-gray-800">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                        Stay updated with the latest service news
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
                    background: rgba(156, 163, 175, 0.3);
                    border-radius: 2px;
                }
            `}</style>
        </div>
    )
}
