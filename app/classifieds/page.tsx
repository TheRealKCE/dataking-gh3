'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getCategories } from '@/lib/classifieds-queries'
import { ListingGrid } from '@/components/classifieds/listing-grid'
import { SearchFilters } from '@/components/classifieds/search-filters'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { ClassifiedListing, ClassifiedCategory } from '@/types/supabase'

export default function ClassifiedsPage() {
    const searchParams = useSearchParams()

    const [listings, setListings] = useState<ClassifiedListing[]>([])
    const [categories, setCategories] = useState<ClassifiedCategory[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [favorites, setFavorites] = useState<string[]>([])

    const category_id = searchParams.get('category_id') || undefined
    const location = searchParams.get('location') || undefined

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true)
            try {
                // Load categories
                const categoriesData = await getCategories()
                setCategories(categoriesData)

                // Load promoted listings only
                const params = new URLSearchParams()
                if (category_id) params.set('category_id', category_id)
                if (location) params.set('location', location)

                const listingsRes = await fetch(`/api/classifieds/promoted?${params.toString()}`)
                if (listingsRes.ok) {
                    const data = await listingsRes.json()
                    setListings(data.promoted_listings || [])
                } else {
                    setListings([])
                }
            } catch (error) {
                console.error('Error loading classifieds:', error)
                setListings([])
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [category_id, location])

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
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                        Promoted Listings
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Browse promoted listings or post your own
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
                        ) : listings.length === 0 ? (
                            <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-12 text-center">
                                <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-6">
                                    <span className="text-4xl">📢</span>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    No promoted listings yet
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 mb-8">
                                    Be the first to promote your listing and reach buyers instantly!
                                </p>
                                <Link href="/classifieds/seller/dashboard">
                                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-8 py-2">
                                        Post & Promote a Listing
                                    </Button>
                                </Link>
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
