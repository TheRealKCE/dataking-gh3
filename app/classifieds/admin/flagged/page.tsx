'use client'

import { ClassifiedsAdminSidebar } from '@/components/classifieds/admin-sidebar'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AdminFlaggedPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsAdminSidebar />

            <div className="flex-1">
                <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Flagged Listings</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Review listings flagged as inappropriate</p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 py-12">
                    <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🚩</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Coming Soon
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
                            The flagged listings moderation interface will be available in Phase 5.
                        </p>
                        <Link href="/classifieds/admin/dashboard">
                            <Button variant="outline">Back to Dashboard</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
