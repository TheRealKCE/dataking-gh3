'use client'

import { ClassifiedsAdminSidebar } from '@/components/classifieds/admin-sidebar'
import { BarChart3, Package, Users, Zap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AdminDashboardPage() {
    const stats = [
        { label: 'Total Listings', value: '0', icon: Package, href: '/classifieds/admin/listings' },
        { label: 'Active Sellers', value: '0', icon: Users, href: '/classifieds/admin/sellers' },
        { label: 'Boosts This Month', value: '0', icon: Zap, href: '/classifieds/admin/boosts' },
        { label: 'Revenue', value: 'GHS 0.00', icon: BarChart3, href: '/classifieds/admin/reports' },
    ]

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsAdminSidebar />

            <div className="flex-1">
                <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Classifieds Admin
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Manage listings, sellers, boosts, and platform analytics
                        </p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {stats.map((stat) => {
                            const Icon = stat.icon
                            return (
                                <Link key={stat.label} href={stat.href}>
                                    <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-6 hover:shadow-md transition-shadow cursor-pointer">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{stat.label}</p>
                                                <p className="text-3xl font-black text-gray-900 dark:text-white mt-2">{stat.value}</p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                                <Icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>

                    <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📊</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Analytics Coming Soon
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
                            Detailed analytics, charts, and insights will be available in Phase 5. Use the sidebar to access individual sections.
                        </p>
                        <Link href="/classifieds/admin/listings">
                            <Button className="bg-emerald-600 hover:bg-emerald-700">
                                View Listings
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
