'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getListingsWithPagination, getCategories } from '@/lib/classifieds-queries'
import { ListingGrid } from '@/components/classifieds/listing-grid'
import { SearchFilters } from '@/components/classifieds/search-filters'
import { Loader2 } from 'lucide-react'
import type { ClassifiedListing, ClassifiedCategory } from '@/types/supabase'

export default function ClassifiedsPage() {
    const searchParams = useSearchParams()

    const [listings, setListings] = useState<ClassifiedListing[]>([])
    const [categories, setCategories] = useState<ClassifiedCategory[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [favorites, setFavorites] = useState<string[]>([])

    const page = parseInt(searchParams.get('page') || '1')
    const category_id = searchParams.get('category_id') || undefined
    const location = searchParams.get('location') || undefined
    const price_min = searchParams.get('price_min') ? parseFloat(searchParams.get('price_min')!) : undefined
    const price_max = searchParams.get('price_max') ? parseFloat(searchParams.get('price_max')!) : undefined

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true)
            try {
                const [listingsData, categoriesData] = await Promise.all([
                    getListingsWithPagination({
                        page,
                        limit: 20,
                        category_id,
                        location,
                        price_min,
                        price_max,
                    }),
                    getCategories(),
                ])

                setListings(listingsData.listings as any)
                setCategories(categoriesData)
            } catch (error) {
                console.error('Error loading classifieds:', error)
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [page, category_id, location, price_min, price_max])

    const handleFavoriteToggle = async (listingId: string) => {
        try {
            const token = localStorage.getItem('sb-token')
            if (!token) {
                alert('Please log in to save favorites')
                return
            }

            const isFavorited = favorites.includes(listingId)
            const endpoint = isFavorited
                ? `/api/classifieds/favorites?listing_id=${listingId}`
                : '/api/classifieds/favorites'

            const response = await fetch(endpoint, {
                method: isFavorited ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                ...((!isFavorited) && {
                    body: JSON.stringify({ listing_id: listingId }),
                }),
            })

            if (response.ok) {
                if (isFavorited) {
                    setFavorites(favorites.filter(id => id !== listingId))
                } else {
                    setFavorites([...favorites, listingId])
                }
            }
        } catch (error) {
            console.error('Error toggling favorite:', error)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
            {/* Header */}
            <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                        Classifieds
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Browse and buy from local sellers
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar Filters */}
                    <div className="lg:col-span-1">
                        <SearchFilters categories={categories} />
                    </div>

                    {/* Listings */}
                    <div className="lg:col-span-3">
                        {isLoading && listings.length === 0 ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                            </div>
                        ) : (
                            <ListingGrid
                                listings={listings}
                                isLoading={isLoading}
                                favorites={favorites}
                                onFavoriteToggle={handleFavoriteToggle}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
