'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ListingCard } from './listing-card'
import { SearchFilters } from './search-filters'
import { Loader2 } from 'lucide-react'

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

interface MarketplaceFeedProps {
    categoryId?: string
    categories: Array<{ id: string; name: string }>
}

export function MarketplaceFeed({ categoryId, categories }: MarketplaceFeedProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 24,
        total: 0,
        pages: 0,
    })
    const [filters, setFilters] = useState({
        category: categoryId,
        minPrice: undefined,
        maxPrice: undefined,
        region: undefined,
        condition: undefined,
    })
    const [loading, setLoading] = useState(false)

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
            } finally {
                setLoading(false)
            }
        },
        [searchQuery, filters]
    )

    useEffect(() => {
        fetchListings(1)
    }, [searchQuery, filters])

    return (
        <div className="space-y-6">
            {/* Search & Filters */}
            <div className="flex gap-2">
                <Input
                    placeholder="Search listings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                />
                <SearchFilters
                    categories={categories}
                    onFilterChange={(newFilters) => setFilters({ ...filters, ...newFilters })}
                />
            </div>

            {/* Results */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : results.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No listings found. Try adjusting your filters.</p>
                </div>
            ) : (
                <>
                    {/* Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {results.map((listing) => (
                            <ListingCard
                                key={listing.id}
                                listing={listing}
                            />
                        ))}
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex justify-center gap-2 mt-6">
                            <Button
                                variant="outline"
                                disabled={pagination.page === 1}
                                onClick={() => fetchListings(pagination.page - 1)}
                            >
                                Previous
                            </Button>

                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                    Page {pagination.page} of {pagination.pages}
                                </span>
                            </div>

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
