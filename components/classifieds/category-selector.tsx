'use client'

import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ClassifiedCategory } from '@/types/supabase'

interface CategorySelectorProps {
    categories: ClassifiedCategory[]
    selectedCategoryId: string
    onSelectCategory: (categoryId: string) => void
}

export function CategorySelector({
    categories,
    selectedCategoryId,
    onSelectCategory,
}: CategorySelectorProps) {
    const [selectedParentId, setSelectedParentId] = useState<string | null>(null)

    // Get main categories (no parent_id)
    const mainCategories = categories
        .filter(cat => !cat.parent_id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

    // Get subcategories for selected main category
    const subCategories = selectedParentId
        ? categories
            .filter(cat => cat.parent_id === selectedParentId)
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        : []

    // Auto-select parent if a subcategory is selected
    useEffect(() => {
        if (selectedCategoryId && !selectedParentId) {
            const selected = categories.find(cat => cat.id === selectedCategoryId)
            if (selected?.parent_id) {
                setSelectedParentId(selected.parent_id)
            }
        }
    }, [selectedCategoryId, categories, selectedParentId])

    return (
        <div className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-full">
            <div className="grid grid-cols-2 gap-0 min-h-80 max-h-96">
                {/* Main Categories */}
                <div className="border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                    <div className="p-0">
                        {mainCategories.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                                No categories available
                            </div>
                        ) : (
                            mainCategories.map(category => (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => setSelectedParentId(category.id)}
                                    className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors flex items-center justify-between ${
                                        selectedParentId === category.id
                                            ? 'bg-blue-50 dark:bg-blue-900/20'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 flex-1">
                                        {category.icon_emoji && (
                                            <span className="text-lg">{category.icon_emoji}</span>
                                        )}
                                        <div>
                                            <div className={`font-semibold text-sm ${
                                                selectedParentId === category.id
                                                    ? 'text-blue-700 dark:text-blue-400'
                                                    : 'text-gray-900 dark:text-white'
                                            }`}>
                                                {category.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                0 ads
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 ${
                                        selectedParentId === category.id
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-gray-400'
                                    }`} />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Subcategories */}
                <div className="overflow-y-auto bg-gray-50 dark:bg-gray-900/30">
                    {selectedParentId && subCategories.length > 0 ? (
                        <div className="p-0">
                            {subCategories.map(category => (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => {
                                        onSelectCategory(category.id)
                                    }}
                                    className={`w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-800 transition-colors flex items-center gap-2 ${
                                        selectedCategoryId === category.id
                                            ? 'bg-blue-100 dark:bg-blue-900/40'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {category.icon_emoji && (
                                        <span className="text-lg">{category.icon_emoji}</span>
                                    )}
                                    <div className="flex-1">
                                        <div className={`font-semibold text-sm ${
                                            selectedCategoryId === category.id
                                                ? 'text-blue-700 dark:text-blue-400'
                                                : 'text-gray-900 dark:text-white'
                                        }`}>
                                            {category.name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            0 ads
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                            {selectedParentId ? 'No subcategories' : 'Select a category'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
