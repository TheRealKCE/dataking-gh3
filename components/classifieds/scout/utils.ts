import type { CompetitionLevel, Niche, SortKey } from './types'

/** 114_200_000 -> "114.2M", 52_300 -> "52.3K", 172 -> "172" */
export function compactNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
    return `${n}`
}

/** Ghana cedi formatting, e.g. 78000 -> "GH₵78,000" */
export function formatCedi(n: number): string {
    return `GH₵${n.toLocaleString('en-GH')}`
}

export function priceRange(p: { min: number; max: number }): string {
    return `${formatCedi(p.min)} – ${formatCedi(p.max)}`
}

/** Opportunity score buckets: green (high) / amber (medium) / red (low). */
export function opportunityTone(score: number): {
    label: string
    text: string
    bg: string
    bar: string
} {
    if (score >= 70)
        return {
            label: 'High opportunity',
            text: 'text-emerald-700 dark:text-emerald-400',
            bg: 'bg-emerald-100 dark:bg-emerald-900/30',
            bar: 'bg-emerald-500',
        }
    if (score >= 45)
        return {
            label: 'Medium opportunity',
            text: 'text-amber-700 dark:text-amber-400',
            bg: 'bg-amber-100 dark:bg-amber-900/30',
            bar: 'bg-amber-500',
        }
    return {
        label: 'Low opportunity',
        text: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        bar: 'bg-red-500',
    }
}

export function competitionTone(level: CompetitionLevel): {
    label: string
    text: string
    bg: string
} {
    switch (level) {
        case 'low':
            return {
                label: 'Low competition',
                text: 'text-emerald-700 dark:text-emerald-400',
                bg: 'bg-emerald-100 dark:bg-emerald-900/30',
            }
        case 'medium':
            return {
                label: 'Medium competition',
                text: 'text-amber-700 dark:text-amber-400',
                bg: 'bg-amber-100 dark:bg-amber-900/30',
            }
        case 'high':
            return {
                label: 'High competition',
                text: 'text-red-700 dark:text-red-400',
                bg: 'bg-red-100 dark:bg-red-900/30',
            }
    }
}

const COMPETITION_ORDER: Record<CompetitionLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
}

/**
 * Rank niches by the active tab. All three sorts are descending in "goodness":
 * - opportunity: highest score first
 * - volume: most searches first
 * - competition: lowest competition first (best for a new seller)
 */
export function sortNiches(niches: Niche[], sort: SortKey): Niche[] {
    const copy = [...niches]
    switch (sort) {
        case 'opportunity':
            return copy.sort((a, b) => b.opportunityScore - a.opportunityScore)
        case 'volume':
            return copy.sort((a, b) => b.searchVolume - a.searchVolume)
        case 'competition':
            return copy.sort(
                (a, b) =>
                    COMPETITION_ORDER[a.competitionLevel] - COMPETITION_ORDER[b.competitionLevel] ||
                    b.opportunityScore - a.opportunityScore
            )
    }
}

/** Deep-link into the Post Ad flow, pre-seeding the niche + category. */
export function postAdHref(niche: Niche): string {
    const params = new URLSearchParams({
        niche: niche.name,
        category: niche.category,
    })
    return `/classifieds/seller/dashboard/new?${params.toString()}`
}
