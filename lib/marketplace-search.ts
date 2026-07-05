/**
 * Marketplace Search & Ranking
 * Handles search queries, filtering, and result ranking
 */

import { createRouteHandlerClient } from '@/lib/supabase-server'

export interface SearchResult {
    id: string
    title: string
    description: string
    price_pesewas: number
    category_id: string
    region?: string
    condition: string
    status: string
    created_at: string
    image?: {
        image_url: string
        sort_order: number
    }
    rank_score?: number
}

export interface SearchOptions {
    query?: string
    category?: string
    region?: string
    minPrice?: number
    maxPrice?: number
    condition?: string
    page?: number
    limit?: number
    sortBy?: 'relevance' | 'newest' | 'price-asc' | 'price-desc'
}

/**
 * Ranking formula for search results
 * Combines relevance (tsvector rank) + recency + boost status
 */
export function calculateRankScore(
    listing: any,
    relevanceRank: number = 0,
    boostTier: number = 0
): number {
    const now = Date.now()
    const listingAgeMs = now - new Date(listing.created_at).getTime()
    const daysOld = listingAgeMs / (1000 * 60 * 60 * 24)

    // Decay score based on age (half-life: 2 days)
    const recencyScore = Math.exp(-(daysOld / 2) * Math.LN2)

    // Boost points for promotion tier
    const boostScore = boostTier >= 1 ? 1.5 : 0

    // Final ranking:
    // relevance (0-1) * 4.0 + recency (0-1) * 2.0 + boost (0-1.5)
    const finalScore = relevanceRank * 4.0 + recencyScore * 2.0 + boostScore

    return finalScore
}

/**
 * Parse search query into terms for advanced search
 * e.g., "iphone 12" -> ["iphone", "12"]
 */
export function parseSearchQuery(query: string): string[] {
    return query
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((term) => term.length > 0)
}

/**
 * Build PostgreSQL tsvector query string
 * Converts ["iphone", "12"] -> "iphone:* & 12:*"
 */
export function buildTsvectorQuery(terms: string[]): string {
    return terms.map((term) => `${term}:*`).join(' & ')
}

/**
 * Filter results by price range (client-side, for additional filtering)
 */
export function filterByPriceRange(
    results: SearchResult[],
    minPrice?: number,
    maxPrice?: number
): SearchResult[] {
    return results.filter((item) => {
        if (minPrice && item.price_pesewas < minPrice) return false
        if (maxPrice && item.price_pesewas > maxPrice) return false
        return true
    })
}

/**
 * Sort results by different criteria
 */
export function sortResults(
    results: SearchResult[],
    sortBy: 'relevance' | 'newest' | 'price-asc' | 'price-desc' = 'relevance'
): SearchResult[] {
    const sorted = [...results]

    switch (sortBy) {
        case 'relevance':
            return sorted.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0))
        case 'newest':
            return sorted.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
        case 'price-asc':
            return sorted.sort((a, b) => a.price_pesewas - b.price_pesewas)
        case 'price-desc':
            return sorted.sort((a, b) => b.price_pesewas - a.price_pesewas)
        default:
            return sorted
    }
}

/**
 * Highlight search terms in text (for UI display)
 */
export function highlightTerms(text: string, terms: string[]): string {
    let result = text
    const regex = new RegExp(`(${terms.join('|')})`, 'gi')
    result = result.replace(regex, '<mark>$1</mark>')
    return result
}
