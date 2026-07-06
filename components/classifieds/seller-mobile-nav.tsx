'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Plus, BadgeCheck } from 'lucide-react'

// Mobile-only bottom tab bar for the seller dashboard. Mirrors the routes/icons
// in seller-sidebar.tsx (sellerNavItems); the sidebar is hidden below `lg` and
// this bar takes over so the listing area gets the full phone width.
const sellerNavItems = [
    { href: '/classifieds/seller/dashboard', label: 'My Listings', icon: LayoutDashboard },
    { href: '/classifieds/seller/dashboard/new', label: 'Post', icon: Plus },
    { href: '/classifieds/seller/dashboard/verification', label: 'Get Verified', icon: BadgeCheck },
]

export function ClassifiedsSellerMobileNav() {
    const pathname = usePathname()

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white dark:bg-[#151c2c] border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-stretch justify-around">
                {sellerNavItems.map((item) => {
                    // Match the exact route for "My Listings" so /new and /verification
                    // (which are nested under it) don't also mark it active.
                    const isActive =
                        item.href === '/classifieds/seller/dashboard'
                            ? pathname === item.href
                            : pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors',
                                isActive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-gray-500 dark:text-gray-400'
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
