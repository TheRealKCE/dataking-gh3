'use client'

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
    // Get main categories only (no parent_id)
    const mainCategories = categories.filter(cat => !cat.parent_id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

    return (
        <div className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-96 w-full">
            <div className="p-0">
                {mainCategories.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                        No categories available
                    </div>
                ) : (
                    mainCategories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => onSelectCategory(category.id)}
                            className={`w-full text-left px-4 py-4 border-b border-gray-100 dark:border-gray-800 transition-colors flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 last:border-b-0 ${
                                selectedCategoryId === category.id
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                    : ''
                            }`}
                        >
                            <div className="flex items-center gap-3 flex-1">
                                {category.icon_emoji && (
                                    <span className="text-lg">{category.icon_emoji}</span>
                                )}
                                <div>
                                    <div className={`font-semibold text-sm ${
                                        selectedCategoryId === category.id
                                            ? 'text-emerald-700 dark:text-emerald-400'
                                            : 'text-gray-900 dark:text-white'
                                    }`}>
                                        {category.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        0 ads
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className={`w-5 h-5 ${
                                selectedCategoryId === category.id
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-gray-400 dark:text-gray-500'
                            }`} />
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}
