'use client'

import { Bell, X, CheckCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAnnouncements } from './AnnouncementProvider'
import type { SystemAnnouncement } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(iso))
}

function isReadLocally(id: string): boolean {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(`announcement_read_${id}`) === 'true'
}

// ---------------------------------------------------------------------------
// Announcement Item
// ---------------------------------------------------------------------------
function AnnouncementItem({
    announcement,
    isUnread,
    onRead,
}: {
    announcement: SystemAnnouncement
    isUnread: boolean
    onRead: () => void
}) {
    return (
        <div
            className={cn(
                'group relative flex flex-col gap-1.5 rounded-xl p-3.5 transition-all duration-200',
                isUnread
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-blue-200/60 dark:ring-blue-700/30'
                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
            )}
        >
            {/* Unread indicator bar */}
            {isUnread && (
                <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-blue-500" />
            )}

            <div className="flex items-start justify-between gap-2 pl-2">
                <p className={cn(
                    'text-[13px] font-semibold leading-tight tracking-tight',
                    isUnread
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-800 dark:text-gray-200'
                )}>
                    {announcement.title}
                </p>
                {isUnread && (
                    <button
                        onClick={onRead}
                        className="shrink-0 text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300 transition-colors"
                        title="Mark as read"
                    >
                        <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            <p className="pl-2 text-[12px] leading-relaxed text-gray-600 dark:text-gray-400">
                {announcement.message}
            </p>

            <p className="pl-2 text-[11px] tabular-nums text-gray-400 dark:text-gray-600">
                {formatDate(announcement.created_at)}
            </p>
        </div>
    )
}

// ---------------------------------------------------------------------------
// FloatingBell
// ---------------------------------------------------------------------------
export function FloatingBell() {
    const { announcements, unreadCount, markRead, markAllRead } = useAnnouncements()
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const hasUnread = unreadCount > 0

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Close on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [])

    if (announcements.length === 0) return null

    return (
        <div ref={containerRef} className="fixed top-5 right-5 z-50">
            {/* ── Bell Button ── */}
            <button
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    'relative flex h-11 w-11 items-center justify-center rounded-2xl',
                    'backdrop-blur-xl border shadow-lg',
                    'bg-white/80 dark:bg-gray-900/80',
                    'border-gray-200/70 dark:border-white/10',
                    'shadow-black/10 dark:shadow-black/40',
                    'transition-all duration-200 ease-out',
                    'hover:scale-110 hover:shadow-xl active:scale-95',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                )}
                aria-label="Announcements"
                aria-expanded={open}
            >
                {/* Bell icon — elastic ring animation when unread */}
                <Bell
                    className={cn(
                        'h-5 w-5 text-gray-700 dark:text-gray-200 transition-colors',
                        hasUnread && 'animate-elastic-ring text-blue-600 dark:text-blue-400'
                    )}
                    strokeWidth={1.8}
                />

                {/* Pinging unread dot */}
                {hasUnread && (
                    <span className="absolute right-2 top-2">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-70" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
                        </span>
                    </span>
                )}
            </button>

            {/* ── Dropdown Panel ── */}
            <div
                className={cn(
                    'absolute right-0 mt-2 w-80 rounded-2xl overflow-hidden',
                    'backdrop-blur-2xl',
                    'bg-white/90 dark:bg-gray-900/90',
                    'border border-gray-200/60 dark:border-white/10',
                    'shadow-2xl shadow-black/15 dark:shadow-black/50',
                    'transition-all duration-200 ease-out origin-top-right',
                    open
                        ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                )}
                role="dialog"
                aria-label="Announcements panel"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/80 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-gray-500 dark:text-gray-400" strokeWidth={1.8} />
                        <span className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                            Announcements
                        </span>
                        {hasUnread && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {hasUnread && (
                            <button
                                onClick={markAllRead}
                                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline transition-all"
                            >
                                Mark all read
                            </button>
                        )}
                        <button
                            onClick={() => setOpen(false)}
                            className="ml-1 rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                {/* Announcement list */}
                <div className="max-h-80 overflow-y-auto overscroll-contain scrollbar-hide p-2 flex flex-col gap-1">
                    {announcements.map((a) => (
                        <AnnouncementItem
                            key={a.id}
                            announcement={a}
                            isUnread={!isReadLocally(a.id)}
                            onRead={() => markRead(a.id)}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-gray-100/80 dark:border-white/[0.06]">
                    <p className="text-center text-[11px] text-gray-400 dark:text-gray-600">
                        {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>
        </div>
    )
}
