'use client'

import { StatsRow } from './StatsRow'
import type { PlatformStats } from './types'

interface ScoutHeroProps {
    stats: PlatformStats
    /** Wordmark, e.g. "Arhms Scout". Defaults to a generic label. */
    brand?: string
}

export function ScoutHero({ stats, brand = 'Arhms Scout' }: ScoutHeroProps) {
    return (
        <header className="bg-[#0A7A4F] py-12 md:py-16">
            <div className="max-w-6xl mx-auto px-6">
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
                        {brand}
                    </h1>
                    <p className="text-white text-lg md:text-xl font-medium mb-1">
                        Find high-demand products with zero competition.
                    </p>
                    <p className="text-white/70 text-sm md:text-base">
                        Sell smarter, spend less on promotion.
                    </p>
                </div>

                <StatsRow stats={stats} />
            </div>
        </header>
    )
}
