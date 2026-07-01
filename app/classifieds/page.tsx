'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCategories } from '@/lib/classifieds-queries'
import { ListingGrid } from '@/components/classifieds/listing-grid'
import { Loader2, Search, Grid3x3, List, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { ClassifiedListing, ClassifiedCategory } from '@/types/supabase'

export default function ClassifiedsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [listings, setListings] = useState<ClassifiedListing[]>([])
    const [allCategories, setAllCategories] = useState<ClassifiedCategory[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [favorites, setFavorites] = useState<string[]>([])
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [showSellGuide, setShowSellGuide] = useState(false)
    const [showBuyGuide, setShowBuyGuide] = useState(false)
    const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(
        searchParams.get('main_category_id') || null
    )

    const category_id = searchParams.get('category_id') || undefined
    const location = searchParams.get('location') || undefined

    const mainCategories = allCategories.filter(cat => !cat.parent_id).sort((a, b) => a.display_order - b.display_order)
    const subCategories = selectedMainCategory
        ? allCategories.filter(cat => cat.parent_id === selectedMainCategory).sort((a, b) => a.display_order - b.display_order)
        : []

    const selectedCategoryName = allCategories.find(cat => cat.id === selectedMainCategory)?.name || null

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true)
            try {
                // Load all categories
                const categoriesData = await getCategories()
                setAllCategories(categoriesData)

                // Set first main category as selected if none chosen
                if (!selectedMainCategory && categoriesData.length > 0) {
                    const firstMainCat = categoriesData.find(cat => !cat.parent_id)
                    if (firstMainCat) {
                        setSelectedMainCategory(firstMainCat.id)
                    }
                }
            } catch (error) {
                console.error('Error loading categories:', error)
                setAllCategories([])
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [])

    useEffect(() => {
        const loadListings = async () => {
            try {
                const params = new URLSearchParams()
                if (selectedMainCategory) params.set('category_id', selectedMainCategory)
                if (location) params.set('location', location)

                const listingsRes = await fetch(`/api/classifieds/promoted?${params.toString()}`)
                if (listingsRes.ok) {
                    const data = await listingsRes.json()
                    setListings(data.promoted_listings || [])
                } else {
                    setListings([])
                }
            } catch (error) {
                console.error('Error loading listings:', error)
                setListings([])
            }
        }

        if (selectedMainCategory) {
            loadListings()
        }
    }, [selectedMainCategory, location])

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
        <div className="min-h-screen bg-white dark:bg-[#0a0f1c]">
            {/* Green Banner Search */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 py-6">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white text-xl font-bold">What are you looking for?</h2>
                        <Link href="/classifieds/seller/dashboard">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg px-6 py-2">
                                SELL
                            </Button>
                        </Link>
                    </div>
                    <form onSubmit={handleSearch} className="flex gap-3">
                        <select
                            aria-label="Location filter"
                            className="px-4 py-2 rounded-lg bg-white text-gray-900 font-medium border-0 focus:ring-2 focus:ring-emerald-400"
                        >
                            <option>All Ghana</option>
                            <option>Ahafo</option>
                            <option>Ashanti</option>
                            <option>Bono</option>
                            <option>Bono East</option>
                            <option>Central</option>
                            <option>Eastern</option>
                            <option>Greater Accra</option>
                            <option>North East</option>
                            <option>Northern</option>
                            <option>Oti</option>
                            <option>Savannah</option>
                            <option>Upper East</option>
                            <option>Upper West</option>
                            <option>Volta</option>
                            <option>Western</option>
                            <option>Western North</option>
                        </select>
                        <div className="relative flex-1">
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

            {/* Main Categories + Subcategories Layout */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Main Categories Sidebar (Jiji Style) */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-100 dark:border-gray-800 p-4 max-h-[600px] overflow-y-auto sticky top-4">
                            <nav className="space-y-1">
                                {mainCategories.map((cat) => {
                                    const catListingCount = allCategories
                                        .filter(c => c.parent_id === cat.id)
                                        .length

                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedMainCategory(cat.id)}
                                            className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors ${
                                                selectedMainCategory === cat.id
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-600'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 flex-1 text-left">
                                                <span className="text-2xl">{cat.icon_emoji || '📦'}</span>
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{cat.name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{catListingCount} subcats</div>
                                                </div>
                                            </div>
                                            <ChevronRight className={`w-4 h-4 transition-transform ${selectedMainCategory === cat.id ? 'text-emerald-600' : 'text-gray-400'}`} />
                                        </button>
                                    )
                                })}
                            </nav>
                        </div>
                    </div>

                    {/* Subcategories + Quick Actions + Listings */}
                    <div className="lg:col-span-4">
                        {/* Quick Action Cards */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <Link href="/classifieds/niche-intelligence">
                                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
                                    <div className="text-3xl mb-2">🔍</div>
                                    <p className="font-bold text-sm text-gray-900 dark:text-white">Niche Intelligence</p>
                                </div>
                            </Link>
                            <button
                                type="button"
                                onClick={() => setShowSellGuide(true)}
                                className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer"
                            >
                                <div className="text-3xl mb-2">📦</div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">How to sell</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowBuyGuide(true)}
                                className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer"
                            >
                                <div className="text-3xl mb-2">🛍️</div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">How to buy</p>
                            </button>
                        </div>

                        {/* Subcategories List (Jiji Style - Compact) */}
                        {selectedCategoryName && subCategories.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{selectedCategoryName}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {subCategories.map((subCat) => (
                                        <button
                                            key={subCat.id}
                                            onClick={() => setSelectedMainCategory(subCat.id)}
                                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                                        >
                                            <span className="text-lg flex-shrink-0">{subCat.icon_emoji || '📦'}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">{subCat.name}</div>
                                                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">View listings</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <hr className="my-6 border-gray-200 dark:border-gray-800" />
                            </div>
                        )}

                        {/* Listings Section */}
                        {listings.length > 0 && (
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Trending in {selectedCategoryName}
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
                            <div className="text-center py-12">
                                <p className="text-gray-600 dark:text-gray-400">No listings yet in {selectedCategoryName}. Check back soon!</p>
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


            {/* How to Sell Modal */}
            {showSellGuide && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#151c2c] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-[#151c2c] border-b border-gray-200 dark:border-gray-800 p-6 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">How to Sell</h2>
                            <button
                                type="button"
                                onClick={() => setShowSellGuide(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">1</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Create Your Account</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Sign up with your phone number and verify your account to become a seller.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">2</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Set Up Your Seller Profile</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Add your profile photo, business name, phone number, and location. This helps buyers trust you.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">3</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Post Your First Listing</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Click "Post New Listing" and add product title, description, photos, price, condition, and location.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">4</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Promote Your Listing (Optional)</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Pay a small fee to boost your listing to the top and reach more buyers. Choose from 6 duration options.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">5</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Connect with Buyers</h3>
                                    <p className="text-gray-600 dark:text-gray-400">When a buyer is interested, they'll request your contact info. Respond quickly and negotiate the best deal.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">6</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Complete the Sale</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Meet the buyer, verify payment, and hand over the product. Mark your listing as sold when complete.</p>
                                </div>
                            </div>

                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mt-6">
                                <p className="text-sm text-emerald-900 dark:text-emerald-100">
                                    💡 <strong>Pro Tip:</strong> Use Niche Intelligence to find high-demand products with low competition and maximize your sales potential!
                                </p>
                            </div>

                            <Link href="/classifieds/seller/dashboard">
                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-3 font-bold">
                                    Start Selling Now
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* How to Buy Modal */}
            {showBuyGuide && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#151c2c] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-[#151c2c] border-b border-gray-200 dark:border-gray-800 p-6 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">How to Buy</h2>
                            <button
                                type="button"
                                onClick={() => setShowBuyGuide(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Browse the Marketplace</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Browse promoted listings on our homepage or use filters to find items by category, location, or price.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">View Listing Details</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Click on any listing to see full details, photos, seller info, price, and buyer reviews.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">3</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Save to Favorites (Optional)</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Like an item? Click the heart icon to save it to your favorites for later.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">4</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Request Seller Contact</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Click "Reveal Contact" and read the safety tips to protect yourself during the transaction.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">5</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Negotiate & Arrange Meeting</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Contact the seller via phone or message. Agree on price, condition, and meet-up time and location.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">6</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Meet Safely & Inspect</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Meet in a public place during daytime. Inspect the item thoroughly before making payment.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">7</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Complete the Purchase</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Pay the agreed amount and take the product. Keep your receipt or payment proof.</p>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6 space-y-3">
                                <p className="text-sm font-bold text-blue-900 dark:text-blue-100">🛡️ Safety Tips:</p>
                                <ul className="text-sm text-blue-900 dark:text-blue-100 space-y-1 list-disc list-inside">
                                    <li>Always meet in public places (mall, market, police station)</li>
                                    <li>Bring a friend or family member to the meeting</li>
                                    <li>Check the product thoroughly before paying</li>
                                    <li>Avoid sending money before seeing the item</li>
                                    <li>Report suspicious listings to our team</li>
                                </ul>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowBuyGuide(false)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-bold"
                            >
                                Start Shopping
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
