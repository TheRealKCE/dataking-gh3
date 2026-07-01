'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCategories } from '@/lib/classifieds-queries'
import { ListingGrid } from '@/components/classifieds/listing-grid'
import { Loader2, Search, Grid3x3, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { ClassifiedListing, ClassifiedCategory } from '@/types/supabase'

export default function ClassifiedsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [listings, setListings] = useState<ClassifiedListing[]>([])
    const [categories, setCategories] = useState<ClassifiedCategory[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [favorites, setFavorites] = useState<string[]>([])
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchQuery) {
            router.push(`/classifieds?q=${encodeURIComponent(searchQuery)}`)
        }
    }

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
            {/* Green Banner Search */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 py-8">
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-white text-center text-xl font-bold mb-6">
                        What are you looking for?
                    </h2>
                    <form onSubmit={handleSearch} className="flex gap-3 justify-center flex-wrap">
                        <select
                            aria-label="Location filter"
                            className="px-4 py-2 rounded-lg bg-white text-gray-900 font-medium border-0 focus:ring-2 focus:ring-emerald-400"
                        >
                            <option>All Ghana</option>
                            <option>Greater Accra</option>
                            <option>Ashanti</option>
                            <option>Volta</option>
                        </select>
                        <div className="relative flex-1 max-w-md">
                            <input
                                type="text"
                                placeholder="I am looking for..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border-0 focus:ring-2 focus:ring-emerald-400"
                            />
                            <button
                                type="submit"
                                aria-label="Search listings"
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                                <Search className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-100 dark:bg-gray-900/30 py-8">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Link href="/classifieds/seller/dashboard">
                            <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
                                <div className="text-3xl mb-2">🔍</div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">Niche Intelligence</p>
                            </div>
                        </Link>
                        <Link href="/classifieds/seller/dashboard">
                            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
                                <div className="text-3xl mb-2">💼</div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">Apply for job</p>
                            </div>
                        </Link>
                        <Link href="/classifieds/seller/dashboard">
                            <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
                                <div className="text-3xl mb-2">📦</div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">How to sell</p>
                            </div>
                        </Link>
                        <Link href="/classifieds">
                            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
                                <div className="text-3xl mb-2">🛍️</div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">How to buy</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Sidebar Categories */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-100 dark:border-gray-800 p-4 sticky top-24">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Categories</h3>
                            <nav className="space-y-2">
                                {categories.map((cat) => (
                                    <Link
                                        key={cat.id}
                                        href={`/classifieds?category_id=${cat.id}`}
                                        className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 py-2 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                        <span>{cat.name}</span>
                                        <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">0</span>
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Listings */}
                    <div className="lg:col-span-4">
                        {listings.length > 0 && (
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Trending ads
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        aria-label="Grid view"
                                        className={`p-2 rounded ${viewMode === 'grid' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'text-gray-400'}`}
                                    >
                                        <Grid3x3 className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        aria-label="List view"
                                        className={`p-2 rounded ${viewMode === 'list' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'text-gray-400'}`}
                                    >
                                        <List className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}

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
