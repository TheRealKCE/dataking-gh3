'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Bookmark, PlusSquare, MessageSquare, User } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

/**
 * Fixed bottom navigation for the marketplace (marketplace.arhmsgh.com).
 *
 * Mobile-only (md:hidden) — desktop uses the header nav. Shown on the public
 * browsing surface (home, categories, listing detail) and hidden on the
 * admin / seller / buyer dashboards, which carry their own navigation.
 *
 * The bar chrome is full-bleed while the icon row is capped at 480px, so the
 * bar never renders as a centred island over full-width page content between
 * 480px and the md breakpoint. It also emits its own in-flow spacer, so pages
 * clear exactly the bar height (incl. the iOS home indicator) and gain no dead
 * space on the routes where the bar hides itself.
 */

// Brand green kept as a literal so the active colour matches the design spec
// regardless of the Tailwind theme.
const BRAND_GREEN = '#00A652'

// Bar height: py-2 (16) + icon (24) + gap (4) + label (12) + py-1 (8) = 64px,
// plus the iOS home indicator. Kept in one place so the spacer can't drift.
const BAR_HEIGHT = 'calc(4rem + env(safe-area-inset-bottom))'

const NAV_ITEMS = [
    { id: 'home', label: 'Home', icon: Home, href: '/classifieds' },
    { id: 'saved', label: 'Saved', icon: Bookmark, href: '/classifieds/buyer/favorites' },
    { id: 'sell', label: 'Sell', icon: PlusSquare, href: '/classifieds/seller/dashboard' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, href: '/classifieds/buyer/messages' },
    { id: 'profile', label: 'Profile', icon: User, href: '/classifieds/buyer/profile' },
] as const

// Routes that own their own chrome (sidebars) — the bottom bar stays out of
// their way. The Saved / Messages tabs live under /buyer but are standalone
// mobile pages, so they intentionally keep the bar.
const HIDDEN_PREFIXES = [
    '/classifieds/admin',
    '/classifieds/seller',
    '/classifieds/buyer/dashboard',
]

export function MarketplaceBottomNav() {
    const pathname = usePathname() ?? ''
    const unread = useUnreadMessageCount()

    if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null

    // Home is active only on the exact root; others match by path prefix.
    const isActive = (href: string) =>
        href === '/classifieds' ? pathname === '/classifieds' : pathname.startsWith(href)

    return (
        <>
        {/* Clears the fixed bar without padding the routes where it is hidden. */}
        <div className="md:hidden" style={{ height: BAR_HEIGHT }} aria-hidden="true" />

        <nav
            aria-label="Marketplace"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-1px_16px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#0f1628] dark:shadow-[0_-1px_16px_rgba(0,0,0,0.5)] md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {/* Chrome is full-bleed; only the icon row is capped and centred. */}
            <ul className="mx-auto flex max-w-[480px] items-stretch justify-around px-1 py-2">
                {NAV_ITEMS.map((item) => {
                    const active = isActive(item.href)
                    const Icon = item.icon
                    return (
                        <li key={item.id} className="flex-1">
                            <Link
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className="flex min-h-[44px] flex-col items-center justify-center gap-1 py-1"
                            >
                                <span className="relative">
                                    {/* Inactive colours come from classes so dark
                                        mode can override them; only the active
                                        brand green is pinned inline. */}
                                    <Icon
                                        className={cn(
                                            'h-6 w-6',
                                            !active && 'text-gray-800 dark:text-gray-300'
                                        )}
                                        strokeWidth={active ? 2.4 : 2}
                                        style={active ? { color: BRAND_GREEN } : undefined}
                                    />
                                    {item.id === 'messages' && unread > 0 && (
                                        <span
                                            className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0f1628]"
                                            style={{ backgroundColor: BRAND_GREEN }}
                                            aria-label={`${unread} unread messages`}
                                        >
                                            {unread > 9 ? '9+' : unread}
                                        </span>
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        'text-xs leading-none',
                                        active
                                            ? 'font-semibold'
                                            : 'font-medium text-gray-700 dark:text-gray-400'
                                    )}
                                    style={active ? { color: BRAND_GREEN } : undefined}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
        </>
    )
}

/**
 * Polls the conversations list for the total unread count (every 20s) while a
 * user is signed in. Logged-out visitors never poll — the endpoint can only 401
 * for them. Silent on errors. Reuses the list endpoint to avoid a dedicated
 * count route.
 */
function useUnreadMessageCount(): number {
    const { user } = useAuth()
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!user) {
            setCount(0)
            return
        }

        let active = true
        const load = async () => {
            try {
                const res = await fetch('/api/marketplace/conversations/list?limit=50')
                if (!res.ok) {
                    if (active) setCount(0)
                    return
                }
                const data = await res.json()
                const total = (data.conversations || []).reduce(
                    (sum: number, c: any) => sum + (c.unread_count || 0),
                    0
                )
                if (active) setCount(total)
            } catch {
                /* ignore transient errors */
            }
        }
        load()
        const interval = setInterval(load, 20000)
        return () => {
            active = false
            clearInterval(interval)
        }
    }, [user])

    return count
}

export default MarketplaceBottomNav
