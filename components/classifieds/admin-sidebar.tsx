'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Package, Users, Settings, BarChart3, AlertCircle, ArrowLeft } from 'lucide-react'

const adminNavItems = [
    { href: '/classifieds/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/classifieds/admin/listings', label: 'Listings', icon: Package },
    { href: '/classifieds/admin/sellers', label: 'Seller Verification', icon: Users },
    { href: '/classifieds/admin/boosts', label: 'Promotion Fees', icon: Package },
    { href: '/classifieds/admin/reports', label: 'Reports', icon: BarChart3 },
    { href: '/classifieds/admin/flagged', label: 'Flagged Listings', icon: AlertCircle },
    { href: '/classifieds/admin/settings', label: 'Settings', icon: Settings },
]

export function ClassifiedsAdminSidebar() {
    const pathname = usePathname()

    return (
        <div className="w-64 bg-white dark:bg-[#151c2c] border-r border-gray-200 dark:border-gray-800 min-h-screen sticky top-0">
            <div className="p-6">
                <Link href="/classifieds" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back to Marketplace</span>
                </Link>

                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Admin Panel</h2>

                <nav className="space-y-2">
                    {adminNavItems.map((item) => {
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
