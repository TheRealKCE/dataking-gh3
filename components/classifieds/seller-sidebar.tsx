'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Plus, ShoppingCart, ArrowLeft, BadgeCheck } from 'lucide-react'

const sellerNavItems = [
    { href: '/classifieds/seller/dashboard', label: 'My Listings', icon: LayoutDashboard },
    { href: '/classifieds/seller/dashboard/new', label: 'Post New Listing', icon: Plus },
    { href: '/classifieds/seller/dashboard/verification', label: 'Get Verified', icon: BadgeCheck },
]

export function ClassifiedsSellerSidebar() {
    const pathname = usePathname()

    return (
        <div className="hidden lg:block w-64 bg-white dark:bg-[#151c2c] border-r border-gray-200 dark:border-gray-800 min-h-screen sticky top-0">
            <div className="p-6">
                <Link href="/classifieds" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Browse Marketplace</span>
                </Link>

                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Seller Tools</h2>

                <nav className="space-y-2">
                    {sellerNavItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors',
                                    isActive
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </div>
    )
}
