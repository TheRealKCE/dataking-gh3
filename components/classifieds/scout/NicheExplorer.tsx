'use client'

import { Search, X } from 'lucide-react'
import type { SortKey } from './types'

const TABS: { key: SortKey; label: string }[] = [
    { key: 'opportunity', label: 'Opportunity' },
    { key: 'volume', label: 'Search Volume' },
    { key: 'competition', label: 'Competition' },
]

interface NicheExplorerProps {
    sort: SortKey
    onSortChange: (sort: SortKey) => void
    query: string
    onQueryChange: (query: string) => void
    trending: string[]
}

export function NicheExplorer({
    sort,
    onSortChange,
    query,
    onQueryChange,
    trending,
}: NicheExplorerProps) {
    return (
        <div className="bg-white dark:bg-[#151c2c] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 shadow-sm">
            {/* Sort tabs */}
            <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => {
                    const active = sort === tab.key
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => onSortChange(tab.key)}
                            {...{ 'aria-pressed': active }}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                                active
                                    ? 'bg-[#00A652] text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

            {/* Trending searches */}
            <p className="text-xs font-bold tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                TRENDING SEARCHES
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
                {trending.map((term) => (
                    <button
                        key={term}
                        type="button"
                        onClick={() => onQueryChange(term)}
                        className="px-3 py-1 rounded-full text-sm font-medium border border-[#00A652] text-[#00A652] bg-transparent hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                        {term}
                    </button>
                ))}
            </div>

            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search niches..."
                    className="w-full pl-11 pr-10 py-3 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00A652]"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => onQueryChange('')}
                        aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    )
}
