'use client'

import { useState } from 'react'
import { Search, Grid3x3, List, Heart } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NicheIntelligencePage() {
    const [sortBy, setSortBy] = useState('opportunity')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [favorites, setFavorites] = useState<string[]>([])

    // Mock niche data
    const niches = [
        { id: 1, name: 'Toyota Corolla', demand: 'High demand', competition: 'High competition', category: 'Cars', volume: '351k/mo', trend: 'up' },
        { id: 2, name: 'Toyota Vitz', demand: 'High demand', competition: 'High competition', category: 'Cars', volume: '214k/mo', trend: 'up' },
        { id: 3, name: 'Toyota Yaris', demand: 'High demand', competition: 'High competition', category: 'Cars', volume: '207k/mo', trend: 'up' },
        { id: 4, name: 'Mazda CX-5', demand: 'High demand', competition: 'Medium competition', category: 'Cars', volume: '189k/mo', trend: 'up' },
    ]

    const toggleFavorite = (id: number) => {
        setFavorites(prev =>
            prev.includes(id.toString())
                ? prev.filter(fav => fav !== id.toString())
                : [...prev, id.toString()]
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
            {/* Green Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 py-12">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-black text-white mb-4">Jiji Scout</h1>
                        <p className="text-emerald-100 text-lg mb-2">
                            Find high-demand products with zero competition.
                        </p>
                        <p className="text-emerald-100">
                            Sell smarter, spend less on promotion.
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg p-4 text-center">
                            <div className="text-2xl font-black text-emerald-600 mb-1">114.2M+</div>
                            <p className="text-sm text-gray-600">Buyer Searches</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                            <div className="text-2xl font-black text-emerald-600 mb-1">3.1M+</div>
                            <p className="text-sm text-gray-600">Products Tracked</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                            <div className="text-2xl font-black text-emerald-600 mb-1">172</div>
                            <p className="text-sm text-gray-600">Categories</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                            <div className="text-2xl font-black text-emerald-600 mb-1">62K+</div>
                            <p className="text-sm text-gray-600">Niches Found</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 py-12">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white">
                        Explore Niches
                    </h2>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            aria-label="Favorites"
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <Heart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            aria-label="Grid view"
                            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-600' : 'border border-gray-200 dark:border-gray-700'}`}
                        >
                            <Grid3x3 className={`w-5 h-5 ${viewMode === 'grid' ? 'text-emerald-600' : 'text-gray-600 dark:text-gray-400'}`} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            aria-label="List view"
                            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-600' : 'border border-gray-200 dark:border-gray-700'}`}
                        >
                            <List className={`w-5 h-5 ${viewMode === 'list' ? 'text-emerald-600' : 'text-gray-600 dark:text-gray-400'}`} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-8">
                    <div className="flex flex-wrap gap-3 mb-4">
                        <button
                            type="button"
                            onClick={() => setSortBy('opportunity')}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${sortBy === 'opportunity' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            Opportunity
                        </button>
                        <button
                            type="button"
                            onClick={() => setSortBy('volume')}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${sortBy === 'volume' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            Search Volume
                        </button>
                        <button
                            type="button"
                            onClick={() => setSortBy('competition')}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${sortBy === 'competition' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            Competition
                        </button>
                    </div>

                    {/* Popular Tags */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-3">TRENDING SEARCHES</p>
                        <div className="flex flex-wrap gap-2">
                            {['mazda demo', 'Chevy Cruze', 'tecno camron 50 ultra'].map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    className="px-3 py-1 rounded-full text-sm font-medium border border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search niches..."
                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>

                {/* Category & Region Filters */}
                <div className="mb-8 space-y-4">
                    <div>
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-3 uppercase">Categories</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="px-3 py-2 rounded-full bg-emerald-600 text-white text-sm font-bold"
                            >
                                All
                            </button>
                            {['Vehicles', 'Electronics', 'Phones & Tablets', 'Home, Furniture & Appliances', 'More categories'].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    className="px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-3 uppercase">Regions</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="px-3 py-2 rounded-full bg-emerald-600 text-white text-sm font-bold"
                            >
                                All cities
                            </button>
                            {['Accra Metropolitan', 'Kumasi Metropolitan', 'Tema Metropolitan', 'Adentas', 'More regions'].map((city) => (
                                <button
                                    key={city}
                                    type="button"
                                    className="px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    {city}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Showing count */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Showing <strong>20+</strong> / <strong>3.1M+</strong> niches
                </p>

                {/* Niche Cards */}
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4' : 'space-y-4'}>
                    {niches.map((niche) => (
                        <div
                            key={niche.id}
                            className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <h3 className="font-bold text-gray-900 dark:text-white text-sm flex-1">
                                    {niche.name}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => toggleFavorite(niche.id)}
                                    className="ml-2"
                                    aria-label="Add to favorites"
                                >
                                    <Heart
                                        className={`w-5 h-5 ${favorites.includes(niche.id.toString()) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                                    />
                                </button>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded text-xs font-bold text-blue-700 dark:text-blue-400">
                                    {niche.demand}
                                </div>
                                <div className="inline-block ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded text-xs font-bold text-red-700 dark:text-red-400">
                                    {niche.competition}
                                </div>
                            </div>

                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                                ● {niche.category}
                            </div>

                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-black text-emerald-600">{niche.volume}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="text-center mt-12">
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Ready to sell a high-demand product with low competition?
                    </p>
                    <Link href="/classifieds/seller/dashboard">
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-8 py-3">
                            Post a Listing
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
