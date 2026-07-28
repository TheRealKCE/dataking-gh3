'use client'

import { useMemo, useState } from 'react'
import { Heart, Grid3x3, List } from 'lucide-react'
import { ScoutHero } from '@/components/classifieds/scout/ScoutHero'
import { NicheExplorer } from '@/components/classifieds/scout/NicheExplorer'
import { NicheList } from '@/components/classifieds/scout/NicheList'
import { NicheDetailModal } from '@/components/classifieds/scout/NicheDetailModal'
import {
    MOCK_NICHES,
    MOCK_STATS,
    MOCK_TRENDING,
} from '@/components/classifieds/scout/types'
import type { Niche, SortKey, ViewMode } from '@/components/classifieds/scout/types'
import { sortNiches } from '@/components/classifieds/scout/utils'

export default function NicheIntelligencePage() {
    const [sort, setSort] = useState<SortKey>('opportunity')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')
    const [query, setQuery] = useState('')
    const [favorites, setFavorites] = useState<string[]>([])
    const [showFavorites, setShowFavorites] = useState(false)
    const [selected, setSelected] = useState<Niche | null>(null)

    const toggleFavorite = (id: string) =>
        setFavorites((prev) =>
            prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
        )

    // Filter -> favorites-only -> sort. Recomputed only when inputs change.
    const niches = useMemo(() => {
        const q = query.trim().toLowerCase()
        let list = MOCK_NICHES
        if (q) {
            list = list.filter(
                (n) =>
                    n.name.toLowerCase().includes(q) ||
                    n.category.toLowerCase().includes(q)
            )
        }
        if (showFavorites) {
            list = list.filter((n) => favorites.includes(n.id))
        }
        return sortNiches(list, sort)
    }, [query, showFavorites, favorites, sort])

    const selectByName = (name: string) => {
        const match = MOCK_NICHES.find((n) => n.name === name)
        // If we track the related niche, open it; otherwise search for it.
        if (match) setSelected(match)
        else {
            setSelected(null)
            setQuery(name)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
            <ScoutHero stats={MOCK_STATS} />

            <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
                {/* Section heading + view toggles */}
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                        Explore Niches
                    </h2>
                    <div className="flex items-center gap-2">
                        <ToggleIcon
                            label="Favorites"
                            active={showFavorites}
                            onClick={() => setShowFavorites((v) => !v)}
                        >
                            <Heart
                                className={`w-5 h-5 ${
                                    showFavorites ? 'fill-white text-white' : ''
                                }`}
                            />
                        </ToggleIcon>
                        <ToggleIcon
                            label="Grid view"
                            active={viewMode === 'grid'}
                            onClick={() => setViewMode('grid')}
                        >
                            <Grid3x3 className="w-5 h-5" />
                        </ToggleIcon>
                        <ToggleIcon
                            label="List view"
                            active={viewMode === 'list'}
                            onClick={() => setViewMode('list')}
                        >
                            <List className="w-5 h-5" />
                        </ToggleIcon>
                    </div>
                </div>

                <NicheExplorer
                    sort={sort}
                    onSortChange={setSort}
                    query={query}
                    onQueryChange={setQuery}
                    trending={MOCK_TRENDING}
                />

                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing <strong className="text-gray-900 dark:text-white">{niches.length}</strong>{' '}
                    {showFavorites ? 'saved' : ''} niche{niches.length === 1 ? '' : 's'}
                    {query && (
                        <>
                            {' '}for “<span className="text-gray-900 dark:text-white">{query}</span>”
                        </>
                    )}
                </p>

                <NicheList
                    niches={niches}
                    viewMode={viewMode}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onSelect={setSelected}
                />
            </div>

            <NicheDetailModal
                niche={selected}
                onClose={() => setSelected(null)}
                onSelectRelated={selectByName}
                favorite={selected ? favorites.includes(selected.id) : false}
                onToggleFavorite={toggleFavorite}
            />
        </div>
    )
}

function ToggleIcon({
    label,
    active,
    onClick,
    children,
}: {
    label: string
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            {...{ 'aria-pressed': active }}
            className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${
                active
                    ? 'bg-[#00A652] border-[#00A652] text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
        >
            {children}
        </button>
    )
}
