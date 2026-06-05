'use client'

import { AlertTriangle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface DealerExpiryBannerProps {
    dealerExpiresAt: string
}

export function DealerExpiryBanner({ dealerExpiresAt }: DealerExpiryBannerProps) {
    const expiryDate = new Date(dealerExpiresAt)
    const now = new Date()
    const diffMs = expiryDate.getTime() - now.getTime()
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (daysLeft > 7) return null

    const isExpired = daysLeft <= 0

    return (
        <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            isExpired
                ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
        }`}>
            <div className="flex items-start gap-3">
                {isExpired ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                ) : (
                    <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                    <p className={`font-bold text-sm ${isExpired ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {isExpired
                            ? 'Your dealership has expired'
                            : `Your dealership expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Subscribe for 6 months to keep your dealer pricing and shop benefits.
                    </p>
                </div>
            </div>
            <Link href="/dashboard/dealer-subscribe" className="flex-shrink-0">
                <Button
                    size="sm"
                    className={`font-bold rounded-xl h-9 ${
                        isExpired
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                >
                    Subscribe for 6 Months
                </Button>
            </Link>
        </div>
    )
}
