'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { SystemAnnouncement } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Client-side Supabase (uses the public anon key — read-only operations only)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface AnnouncementContextValue {
    announcements: SystemAnnouncement[]
    unreadCount: number
    isLoading: boolean
    markAllRead: () => void
    markRead: (id: string) => void
}

const AnnouncementContext = createContext<AnnouncementContextValue>({
    announcements: [],
    unreadCount: 0,
    isLoading: true,
    markAllRead: () => { },
    markRead: () => { },
})

export function useAnnouncements() {
    return useContext(AnnouncementContext)
}

// ---------------------------------------------------------------------------
// Helper: sessionStorage keys
// ---------------------------------------------------------------------------
const SESSION_KEY = (id: string) => `announcement_read_${id}`

function isRead(id: string): boolean {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(SESSION_KEY(id)) === 'true'
}

function markReadInSession(id: string) {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(SESSION_KEY(id), 'true')
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AnnouncementProvider({
    children,
    initialAnnouncements = [],
}: {
    children: React.ReactNode
    initialAnnouncements?: SystemAnnouncement[]
}) {
    const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>(initialAnnouncements)
    const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetchAnnouncements() {
            try {
                const response = await fetch('/api/public/config')
                if (!response.ok) return

                const config = await response.json()
                const list = ((config.activeSystemAnnouncements ?? []) as SystemAnnouncement[])
                    .filter((announcement) => announcement.visible_on === 'main_site' || announcement.visible_on === 'both')
                setAnnouncements(list)

                // Compute unread set by comparing against sessionStorage
                const unread = new Set<string>()
                list.forEach((a) => {
                    if (!isRead(a.id)) unread.add(a.id)
                })
                setUnreadIds(unread)
            } catch (err) {
                console.error('[Announcements] Unexpected error:', err)
            } finally {
                setIsLoading(false)
            }
        }

        if (initialAnnouncements.length > 0) {
            const unread = new Set<string>()
            initialAnnouncements.forEach((a) => {
                if (!isRead(a.id)) unread.add(a.id)
            })
            setUnreadIds(unread)
            setIsLoading(false)
            return
        }

        fetchAnnouncements()
    }, [initialAnnouncements])

    const markRead = useCallback((id: string) => {
        markReadInSession(id)
        setUnreadIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
        })
    }, [])

    const markAllRead = useCallback(() => {
        announcements.forEach((a) => markReadInSession(a.id))
        setUnreadIds(new Set())
    }, [announcements])

    return (
        <AnnouncementContext.Provider
            value={{
                announcements,
                unreadCount: unreadIds.size,
                isLoading,
                markAllRead,
                markRead,
            }}
        >
            {children}
        </AnnouncementContext.Provider>
    )
}
