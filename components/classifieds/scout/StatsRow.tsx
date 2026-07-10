'use client'

import { compactNumber } from './utils'
import type { PlatformStats } from './types'

interface StatCard {
    key: keyof PlatformStats
    label: string
    suffix?: string
}

const CARDS: StatCard[] = [
    { key: 'totalSearches', label: 'Buyer Searches', suffix: '+' },
    { key: 'productsTracked', label: 'Products Tracked', suffix: '+' },
    { key: 'totalCategories', label: 'Categories' },
    { key: 'nichesFound', label: 'Niches Found', suffix: '+' },
]

export function StatsRow({ stats }: { stats: PlatformStats }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CARDS.map((card) => (
                <div
                    key={card.key}
                    className="bg-white rounded-2xl px-5 py-6 text-center shadow-sm"
                >
                    <div className="text-2xl md:text-3xl font-black text-[#00A652] mb-1 tabular-nums">
                        {compactNumber(stats[card.key])}
                        {card.suffix ?? ''}
                    </div>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">{card.label}</p>
                </div>
            ))}
        </div>
    )
}
