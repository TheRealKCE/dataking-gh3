'use client'

import Link from 'next/link'
import { Heart, TrendingUp, TrendingDown, PlusCircle } from 'lucide-react'
import type { Niche, ViewMode } from './types'
import {
    compactNumber,
    competitionTone,
    opportunityTone,
    postAdHref,
} from './utils'

interface NicheListProps {
    niches: Niche[]
    viewMode: ViewMode
    favorites: string[]
    onToggleFavorite: (id: string) => void
    onSelect: (niche: Niche) => void
}

export function NicheList({
    niches,
    viewMode,
    favorites,
    onToggleFavorite,
    onSelect,
}: NicheListProps) {
    if (niches.length === 0) {
        return (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <p className="font-semibold">No niches match your search.</p>
                <p className="text-sm mt-1">Try a different term or clear the filter.</p>
            </div>
        )
    }

    return (
        <div
            className={
                viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'space-y-3'
            }
        >
            {niches.map((niche) =>
                viewMode === 'grid' ? (
                    <GridCard
                        key={niche.id}
                        niche={niche}
                        favorite={favorites.includes(niche.id)}
                        onToggleFavorite={onToggleFavorite}
                        onSelect={onSelect}
                    />
                ) : (
                    <ListRow
                        key={niche.id}
                        niche={niche}
                        favorite={favorites.includes(niche.id)}
                        onToggleFavorite={onToggleFavorite}
                        onSelect={onSelect}
                    />
                )
            )}
        </div>
    )
}

interface CardProps {
    niche: Niche
    favorite: boolean
    onToggleFavorite: (id: string) => void
    onSelect: (niche: Niche) => void
}

function TrendPill({ trend }: { trend: number }) {
    const up = trend >= 0
    const Icon = up ? TrendingUp : TrendingDown
    return (
        <span
            className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                up ? 'text-emerald-600' : 'text-red-500'
            }`}
        >
            <Icon className="w-3.5 h-3.5" />
            {up ? '+' : ''}
            {trend}%
        </span>
    )
}

function HeartButton({
    niche,
    favorite,
    onToggleFavorite,
}: Omit<CardProps, 'onSelect'>) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(niche.id)
            }}
            aria-label={favorite ? 'Remove from favorites' : 'Save niche'}
            {...{ 'aria-pressed': favorite }}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
            <Heart
                className={`w-5 h-5 transition-colors ${
                    favorite ? 'fill-red-500 text-red-500' : 'text-gray-400'
                }`}
            />
        </button>
    )
}

function OpportunityBar({ score }: { score: number }) {
    const tone = opportunityTone(score)
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Opportunity
                </span>
                <span className={`text-xs font-black ${tone.text}`}>{score}/100</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                    className={`h-full rounded-full ${tone.bar}`}
                    style={{ width: `${score}%` }}
                />
            </div>
        </div>
    )
}

function GridCard({ niche, favorite, onToggleFavorite, onSelect }: CardProps) {
    const comp = competitionTone(niche.competitionLevel)
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(niche)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(niche)
                }
            }}
            className="group flex flex-col bg-white dark:bg-[#151c2c] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md hover:border-[#00A652]/40 transition cursor-pointer"
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white leading-tight truncate">
                        {niche.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {niche.category}
                    </p>
                </div>
                <HeartButton
                    niche={niche}
                    favorite={favorite}
                    onToggleFavorite={onToggleFavorite}
                />
            </div>

            <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                    {compactNumber(niche.searchVolume)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">searches/mo</span>
                <TrendPill trend={niche.searchVolumeTrend} />
            </div>

            <span
                className={`self-start px-2.5 py-1 rounded-full text-xs font-bold mb-3 ${comp.bg} ${comp.text}`}
            >
                {comp.label}
            </span>

            <div className="mt-auto">
                <OpportunityBar score={niche.opportunityScore} />
            </div>

            <Link
                href={postAdHref(niche)}
                onClick={(e) => e.stopPropagation()}
                className="mt-4 inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-full bg-[#00A652] hover:bg-[#0A7A4F] text-white text-sm font-bold transition-colors"
            >
                <PlusCircle className="w-4 h-4" />
                Post Ad in this Niche
            </Link>
        </div>
    )
}

function ListRow({ niche, favorite, onToggleFavorite, onSelect }: CardProps) {
    const comp = competitionTone(niche.competitionLevel)
    const oppTone = opportunityTone(niche.opportunityScore)
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(niche)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(niche)
                }
            }}
            className="group flex items-center gap-4 bg-white dark:bg-[#151c2c] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md hover:border-[#00A652]/40 transition cursor-pointer"
        >
            <HeartButton
                niche={niche}
                favorite={favorite}
                onToggleFavorite={onToggleFavorite}
            />

            {/* Name + category */}
            <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white truncate">
                    {niche.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{niche.category}</p>
            </div>

            {/* Search volume */}
            <div className="hidden sm:block text-right w-28">
                <div className="font-black text-gray-900 dark:text-white tabular-nums">
                    {compactNumber(niche.searchVolume)}
                </div>
                <div className="flex items-center justify-end gap-1 text-xs text-gray-500 dark:text-gray-400">
                    searches/mo
                </div>
            </div>

            <div className="hidden md:block w-16 text-right">
                <TrendPill trend={niche.searchVolumeTrend} />
            </div>

            {/* Competition */}
            <span
                className={`hidden sm:inline-block px-2.5 py-1 rounded-full text-xs font-bold w-32 text-center ${comp.bg} ${comp.text}`}
            >
                {comp.label}
            </span>

            {/* Opportunity badge */}
            <span
                className={`px-3 py-1.5 rounded-full text-sm font-black w-16 text-center ${oppTone.bg} ${oppTone.text}`}
            >
                {niche.opportunityScore}
            </span>

            {/* CTA */}
            <Link
                href={postAdHref(niche)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Post Ad in this niche"
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#00A652] hover:bg-[#0A7A4F] text-white text-sm font-bold transition-colors"
            >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden lg:inline">Post Ad</span>
            </Link>
        </div>
    )
}
