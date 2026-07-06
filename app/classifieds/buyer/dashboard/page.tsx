'use client'

import { ClassifiedsBuyerSidebar } from '@/components/classifieds/buyer-sidebar'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function BuyerDashboardPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsBuyerSidebar />

            <div className="flex-1">
                <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Favorites
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Your saved listings
                        </p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 py-12">
                    <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">❤️</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            No Favorites Yet
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto mb-6">
                            Browse listings and save your favorites to see them here.
                        </p>
                        <Link href="/classifieds">
                            <Button className="bg-emerald-600 hover:bg-emerald-700">
                                Browse Listings
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
