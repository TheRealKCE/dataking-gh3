'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Bookmark, PlusSquare, MessageSquare, User } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Fixed bottom navigation for the marketplace (marketplace.arhmsgh.com).
 *
 * Mobile-only (md:hidden) — desktop uses the header nav. Shown on the public
 * browsing surface (home, categories, listing detail) and hidden on the
 * admin / seller / buyer dashboards, which carry their own navigation.
 */

// Brand green kept as a literal so the active colour matches the design spec
// regardless of the Tailwind theme.
const BRAND_GREEN = '#00A652'

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

    if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null

    // Home is active only on the exact root; others match by path prefix.
    const isActive = (href: string) =>
        href === '/classifieds' ? pathname === '/classifieds' : pathname.startsWith(href)

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-gray-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#0f1628] md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <ul className="flex items-stretch justify-around px-1 py-2">
                {NAV_ITEMS.map((item) => {
                    const active = isActive(item.href)
                    const Icon = item.icon
                    return (
                        <li key={item.id} className="flex-1">
                            <Link
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className="flex flex-col items-center gap-1 py-1"
                            >
                                <Icon
                                    className="h-6 w-6"
                                    strokeWidth={active ? 2.4 : 2}
                                    style={{ color: active ? BRAND_GREEN : '#1A1A1A' }}
                                />
                                <span
                                    className={cn(
                                        'text-xs leading-none',
                                        active ? 'font-semibold' : 'font-medium'
                                    )}
                                    style={{ color: active ? BRAND_GREEN : '#333' }}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}

export default MarketplaceBottomNav
