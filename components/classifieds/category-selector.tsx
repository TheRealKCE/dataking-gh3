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
    // Get all categories and group them: main categories first, then subcategories
    const mainCategories = categories
        .filter(cat => !cat.parent_id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

    const allCategories = [
        ...mainCategories,
        ...categories
            .filter(cat => cat.parent_id)
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
    ]

    return (
        <div className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-200 dark:border-gray-700 overflow-y-auto w-full max-h-96">
            <div className="p-0">
                {allCategories.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                        No categories available
                    </div>
                ) : (
                    allCategories.map((category, index) => {
                        const isMainCategory = !category.parent_id
                        const isSelected = selectedCategoryId === category.id

                        return (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => onSelectCategory(category.id)}
                                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors flex items-center justify-between ${
                                    isSelected
                                        ? 'bg-blue-50 dark:bg-blue-900/20'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                } ${!isMainCategory ? 'pl-8' : ''}`}
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    {category.icon_emoji && (
                                        <span className="text-lg">{category.icon_emoji}</span>
                                    )}
                                    <div>
                                        <div
                                            className={`font-semibold text-sm ${
                                                isSelected
                                                    ? 'text-blue-700 dark:text-blue-400'
                                                    : 'text-gray-900 dark:text-white'
                                            } ${!isMainCategory ? 'text-xs' : ''}`}
                                        >
                                            {category.name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            0 ads
                                        </div>
                                    </div>
                                </div>
                                {isMainCategory && (
                                    <ChevronRight
                                        className={`w-4 h-4 ${
                                            isSelected
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-gray-400'
                                        }`}
                                    />
                                )}
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}
