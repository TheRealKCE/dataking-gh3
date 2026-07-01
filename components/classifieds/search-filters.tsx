'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ClassifiedCategory } from '@/types/supabase'

interface SearchFiltersProps {
    categories: ClassifiedCategory[]
}

export function SearchFilters({ categories }: SearchFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category_id') || '')
    const [location, setLocation] = useState(searchParams.get('location') || '')
    const [priceMin, setPriceMin] = useState(searchParams.get('price_min') || '')
    const [priceMax, setPriceMax] = useState(searchParams.get('price_max') || '')

    const handleApplyFilters = () => {
        const params = new URLSearchParams()

        if (searchQuery) params.set('q', searchQuery)
        if (selectedCategory) params.set('category_id', selectedCategory)
        if (location) params.set('location', location)
        if (priceMin) params.set('price_min', priceMin)
        if (priceMax) params.set('price_max', priceMax)

        router.push(`/classifieds?${params.toString()}`)
    }

    const handleReset = () => {
        setSearchQuery('')
        setSelectedCategory('')
        setLocation('')
        setPriceMin('')
        setPriceMax('')
        router.push('/classifieds')
    }

    const hasFilters = searchQuery || selectedCategory || location || priceMin || priceMax

    return (
        <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-5 sticky top-24">
            <div className="space-y-4">
                {/* Search */}
                <div>
                    <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2">
                        Search
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Search listings..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Category */}
                <div>
                    <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2">
                        Category
                    </label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="">All Categories</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Location */}
                <div>
                    <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2">
                        Location
                    </label>
                    <Input
                        type="text"
                        placeholder="City or area..."
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    />
                </div>

                {/* Price Range */}
                <div>
                    <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2">
                        Price Range
                    </label>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            placeholder="Min"
                            value={priceMin}
                            onChange={(e) => setPriceMin(e.target.value)}
                        />
                        <Input
                            type="number"
                            placeholder="Max"
                            value={priceMax}
                            onChange={(e) => setPriceMax(e.target.value)}
                        />
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-2">
                    <Button
                        onClick={handleApplyFilters}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg"
                    >
                        Apply
                    </Button>
                    {hasFilters && (
                        <Button
                            onClick={handleReset}
                            variant="outline"
                            className="flex-1"
                        >
                            <X className="w-4 h-4 mr-1" /> Reset
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
