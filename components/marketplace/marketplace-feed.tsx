'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ListingCard } from './listing-card'
import { SearchFilters } from './search-filters'
import { Search, PackageOpen, X } from 'lucide-react'

interface SearchResult {
    id: string
    title: string
    description: string
    price_pesewas: number
    category_id: string
    region?: string
    condition: string
    status: string
    created_at: string
    promotion_tier?: number
    classified_listing_images?: Array<{
        image_url: string
        sort_order: number
    }>
}

interface PaginationData {
    page: number
    limit: number
    total: number
    pages: number
}

interface Filters {
    category?: string
    minPrice?: number
    maxPrice?: number
    region?: string
    condition?: string
}

interface MarketplaceFeedProps {
    categoryId?: string
    categories: Array<{ id: string; name: string }>
    initialQuery?: string
}

type SortKey = 'newest' | 'price-asc' | 'price-desc'

export function MarketplaceFeed({ categoryId, categories, initialQuery = '' }: MarketplaceFeedProps) {
    const [searchQuery, setSearchQuery] = useState(initialQuery)
    const [results, setResults] = useState<SearchResult[]>([])
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 24,
        total: 0,
        pages: 0,
    })
    const [filters, setFilters] = useState<Filters>({
        category: categoryId,
        minPrice: undefined,
        maxPrice: undefined,
        region: undefined,
        condition: undefined,
    })
    const [sort, setSort] = useState<SortKey>('newest')
    const [loading, setLoading] = useState(true)

    // Fetch listings
    const fetchListings = useCallback(
        async (page = 1) => {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                params.append('page', page.toString())
                params.append('limit', '24')

                if (searchQuery) params.append('q', searchQuery)
                if (filters.category) params.append('category', filters.category)
                if (filters.region) params.append('region', filters.region)
                if (filters.minPrice) params.append('minPrice', filters.minPrice.toString())
                if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString())
                if (filters.condition) params.append('condition', filters.condition)

                const response = await fetch(`/api/marketplace/search?${params.toString()}`)
                const data = await response.json()

                if (!response.ok) throw new Error(data.error)

                setResults(data.results || [])
                setPagination(data.pagination)
            } catch (error) {
                console.error('[MarketplaceFeed] Fetch error:', error)
                setResults([])
            } finally {
                setLoading(false)
            }
        },
        [searchQuery, filters]
    )

    useEffect(() => {
        fetchListings(1)
    }, [searchQuery, filters])

    // Client-side sort of the current page (API sorts newest-first server-side)
    const sortedResults = useMemo(() => {
        if (sort === 'newest') return results
        const copy = [...results]
        copy.sort((a, b) =>
            sort === 'price-asc'
                ? a.price_pesewas - b.price_pesewas
                : b.price_pesewas - a.price_pesewas
        )
        return copy
    }, [results, sort])

    const clearFilter = (key: keyof Filters) =>
        setFilters((f) => ({ ...f, [key]: undefined }))

    const categoryName = (id?: string) =>
        categories.find((c) => c.id === id)?.name ?? 'Category'

    const activeChips = [
        filters.category && filters.category !== categoryId
            ? { key: 'category' as const, label: categoryName(filters.category) }
            : null,
        filters.region ? { key: 'region' as const, label: filters.region } : null,
        filters.condition ? { key: 'condition' as const, label: filters.condition } : null,
        filters.minPrice || filters.maxPrice
            ? {
                  key: 'price' as const,
                  label: `GHS ${filters.minPrice ?? 0}–${filters.maxPrice ?? '∞'}`,
              }
            : null,
    ].filter(Boolean) as Array<{ key: keyof Filters | 'price'; label: string }>

    return (
        <div className="space-y-6">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search listings..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="price-asc">Price: Low to High</SelectItem>
                            <SelectItem value="price-desc">Price: High to Low</SelectItem>
                        </SelectContent>
                    </Select>
                    <SearchFilters
                        categories={categories}
                        onFilterChange={(newFilters) => setFilters({ ...filters, ...newFilters })}
                    />
                </div>
            </div>

            {/* Result count + active filter chips */}
            <div className="flex flex-wrap items-center gap-2">
                {!loading && (
                    <span className="text-sm text-muted-foreground">
                        {pagination.total} {pagination.total === 1 ? 'listing' : 'listings'}
                    </span>
                )}
                {activeChips.map((chip) => (
                    <button
                        type="button"
                        key={chip.key}
                        onClick={() =>
                            chip.key === 'price'
                                ? setFilters((f) => ({ ...f, minPrice: undefined, maxPrice: undefined }))
                                : clearFilter(chip.key)
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize text-secondary-foreground hover:bg-secondary/70 transition-colors"
                    >
                        {chip.label}
                        <X className="w-3 h-3" />
                    </button>
                ))}
            </div>

            {/* Results */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-xl border overflow-hidden">
                            <Skeleton className="aspect-square w-full rounded-none" />
                            <div className="p-3.5 space-y-2">
                                <Skeleton className="h-4 w-4/5" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-5 w-1/3 mt-2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : sortedResults.length === 0 ? (
                <div className="flex flex-col items-center text-center py-16">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <PackageOpen className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 font-semibold">No listings found</h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                        Try adjusting your search or filters — or be the first to list an item here.
                    </p>
                    <div className="mt-4 flex gap-2">
                        {(searchQuery || activeChips.length > 0) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSearchQuery('')
                                    setFilters({ category: categoryId })
                                }}
                            >
                                Clear filters
                            </Button>
                        )}
                        <Button asChild>
                            <a href="/marketplace-domain/sell">Sell an item</a>
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {sortedResults.map((listing) => (
                            <ListingCard key={listing.id} listing={listing} />
                        ))}
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-6">
                            <Button
                                variant="outline"
                                disabled={pagination.page === 1}
                                onClick={() => fetchListings(pagination.page - 1)}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {pagination.page} of {pagination.pages}
                            </span>
                            <Button
                                variant="outline"
                                disabled={pagination.page === pagination.pages}
                                onClick={() => fetchListings(pagination.page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
