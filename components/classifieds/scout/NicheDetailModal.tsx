'use client'

import Link from 'next/link'
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { Heart, PlusCircle, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Niche } from './types'
import {
    compactNumber,
    competitionTone,
    formatCedi,
    opportunityTone,
    postAdHref,
    priceRange,
} from './utils'

interface NicheDetailModalProps {
    niche: Niche | null
    onClose: () => void
    /** Jump to a related niche by name (resolved by the parent). */
    onSelectRelated: (name: string) => void
    favorite: boolean
    onToggleFavorite: (id: string) => void
}

export function NicheDetailModal({
    niche,
    onClose,
    onSelectRelated,
    favorite,
    onToggleFavorite,
}: NicheDetailModalProps) {
    return (
        <Dialog open={!!niche} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
                {niche && <DetailBody
                    niche={niche}
                    onSelectRelated={onSelectRelated}
                    favorite={favorite}
                    onToggleFavorite={onToggleFavorite}
                />}
            </DialogContent>
        </Dialog>
    )
}

function DetailBody({
    niche,
    onSelectRelated,
    favorite,
    onToggleFavorite,
}: Omit<NicheDetailModalProps, 'onClose' | 'niche'> & { niche: Niche }) {
    const comp = competitionTone(niche.competitionLevel)
    const oppTone = opportunityTone(niche.opportunityScore)
    const up = niche.searchVolumeTrend >= 0
    const TrendIcon = up ? TrendingUp : TrendingDown
    // Show ~30 evenly-spaced points from the 90-day history for a clean chart.
    const chartData = niche.history.filter((_, i) => i % 3 === 0)

    return (
        <div>
            <DialogHeader className="p-6 pb-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3 pr-8">
                    <div>
                        <DialogTitle className="text-2xl font-black text-gray-900 dark:text-white">
                            {niche.name}
                        </DialogTitle>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {niche.category}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onToggleFavorite(niche.id)}
                        aria-label={favorite ? 'Remove from favorites' : 'Save niche'}
                        aria-pressed={favorite}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <Heart
                            className={`w-5 h-5 ${
                                favorite ? 'fill-red-500 text-red-500' : 'text-gray-400'
                            }`}
                        />
                    </button>
                </div>
            </DialogHeader>

            <div className="p-6 space-y-6">
                {/* Metric tiles */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Searches/mo</p>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
                                {compactNumber(niche.searchVolume)}
                            </span>
                            <span
                                className={`inline-flex items-center text-xs font-bold ${
                                    up ? 'text-emerald-600' : 'text-red-500'
                                }`}
                            >
                                <TrendIcon className="w-3.5 h-3.5" />
                                {up ? '+' : ''}
                                {niche.searchVolumeTrend}%
                            </span>
                        </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Competition</p>
                        <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${comp.bg} ${comp.text}`}
                        >
                            {comp.label}
                        </span>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Opportunity</p>
                        <span className={`text-xl font-black ${oppTone.text}`}>
                            {niche.opportunityScore}
                            <span className="text-sm text-gray-400 font-medium">/100</span>
                        </span>
                    </div>
                </div>

                {/* Search volume trend */}
                <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                        Search volume — last 90 days
                    </h4>
                    <div className="h-48 -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="scoutTrend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#00A652" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#00A652" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                                    interval={6}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                                    tickFormatter={(v) => compactNumber(v as number)}
                                    tickLine={false}
                                    axisLine={false}
                                    width={40}
                                />
                                <Tooltip
                                    formatter={(v) => [compactNumber(v as number), 'Searches']}
                                    contentStyle={{
                                        borderRadius: 12,
                                        border: '1px solid #e5e7eb',
                                        fontSize: 12,
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#00A652"
                                    strokeWidth={2}
                                    fill="url(#scoutTrend)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Suggested price range */}
                <div className="rounded-xl border border-[#00A652]/30 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                        SUGGESTED PRICE RANGE
                    </p>
                    <p className="text-lg font-black text-[#0A7A4F] dark:text-emerald-400">
                        {priceRange(niche.avgPrice)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Based on {niche.topListingsCount.toLocaleString()} active listings in this niche.
                    </p>
                </div>

                {/* Related niches */}
                <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                        Related niches
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {niche.relatedNiches.map((name) => (
                            <button
                                key={name}
                                type="button"
                                onClick={() => onSelectRelated(name)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-[#00A652] hover:text-[#00A652] transition-colors"
                            >
                                {name}
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Top existing listings */}
                <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                        Top existing listings
                    </h4>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800">
                        {niche.topListings.map((listing) => (
                            <div
                                key={listing.title}
                                className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {listing.title}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {listing.location}
                                    </p>
                                </div>
                                <span className="text-sm font-black text-gray-900 dark:text-white whitespace-nowrap">
                                    {formatCedi(listing.price)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky CTA */}
            <div className="sticky bottom-0 bg-white dark:bg-[#151c2c] border-t border-gray-200 dark:border-gray-800 p-4">
                <Link href={postAdHref(niche)} className="block">
                    <Button className="w-full bg-[#00A652] hover:bg-[#0A7A4F] text-white rounded-full py-6 text-base font-bold">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        Post Ad in {niche.name}
                    </Button>
                </Link>
            </div>
        </div>
    )
}
