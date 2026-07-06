'use client'

import { CategoryIcon } from '@/components/classifieds/category-icon'
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
    // Get main categories sorted by display order
    const mainCategories = categories
        .filter(cat => !cat.parent_id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

    // Create a map of subcategories by parent_id
    const subcategoriesByParent = categories.reduce((acc, cat) => {
        if (cat.parent_id) {
            if (!acc[cat.parent_id]) {
                acc[cat.parent_id] = []
            }
            acc[cat.parent_id].push(cat)
        }
        return acc
    }, {} as Record<string, ClassifiedCategory[]>)

    // Sort subcategories by display order
    Object.keys(subcategoriesByParent).forEach(parentId => {
        subcategoriesByParent[parentId].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    })

    return (
        <div className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-200 dark:border-gray-700 overflow-y-auto w-full max-h-96">
            <div className="p-0">
                {mainCategories.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                        No categories available
                    </div>
                ) : (
                    mainCategories.map((mainCategory) => {
                        const isSelected = selectedCategoryId === mainCategory.id
                        const subs = subcategoriesByParent[mainCategory.id] || []

                        return (
                            <div key={mainCategory.id}>
                                {/* Main Category */}
                                <button
                                    type="button"
                                    onClick={() => onSelectCategory(mainCategory.id)}
                                    className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors flex items-center gap-3 font-bold text-sm ${
                                        isSelected
                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-900 dark:text-white'
                                    }`}
                                >
                                    <CategoryIcon name={mainCategory.icon} className="w-5 h-5" />
                                    <div>
                                        <div>{mainCategory.name}</div>
                                        <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                            {subs.length} subcats
                                        </div>
                                    </div>
                                </button>

                                {/* Subcategories */}
                                {subs.map((subCategory) => {
                                    const isSubSelected = selectedCategoryId === subCategory.id

                                    return (
                                        <button
                                            key={subCategory.id}
                                            type="button"
                                            onClick={() => onSelectCategory(subCategory.id)}
                                            className={`w-full text-left px-4 py-2 pl-12 border-b border-gray-50 dark:border-gray-900 transition-colors flex items-center gap-3 text-xs ${
                                                isSubSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/20'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                            }`}
                                        >
                                            <CategoryIcon name={subCategory.icon} className="w-4 h-4" />
                                            <div>
                                                <div
                                                    className={`font-semibold ${
                                                        isSubSelected
                                                            ? 'text-blue-700 dark:text-blue-400'
                                                            : 'text-gray-900 dark:text-white'
                                                    }`}
                                                >
                                                    {subCategory.name}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    0 ads
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
