'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCategories, getListingsWithPagination } from '@/lib/classifieds-queries'
import { ListingGrid } from '@/components/classifieds/listing-grid'
import { CategoryPicture } from '@/components/classifieds/category-picture'
import { ArrowLeft, Loader2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { CategorySubcategoryCarousel } from '@/components/classifieds/category-subcategory-carousel'
import type { ClassifiedListing, ClassifiedCategory } from '@/types/supabase'

interface CategoryPageParams {
    params: { categoryId: string }
}

export default function CategoryPage({ params }: CategoryPageParams) {
    const router = useRouter()
    const { user, session } = useAuth()
    const [allCategories, setAllCategories] = useState<ClassifiedCategory[]>([])
    const [currentCategory, setCurrentCategory] = useState<ClassifiedCategory | null>(null)
    const [subCategories, setSubCategories] = useState<ClassifiedCategory[]>([])
    const [listings, setListings] = useState<ClassifiedListing[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingListings, setIsLoadingListings] = useState(false)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [favorites, setFavorites] = useState<string[]>([])

    const categoryIds = currentCategory
        ? currentCategory.parent_id === null
            ? [currentCategory.id, ...subCategories.map(c => c.id)].join(',')
            : currentCategory.id
        : ''

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const categories = await getCategories()
                setAllCategories(categories)

                const category = categories.find(c => c.id === params.categoryId)
                if (category) {
                    setCurrentCategory(category)
                    const children = categories.filter(c => c.parent_id === category.id)
                    setSubCategories(children.sort((a, b) => a.display_order - b.display_order))
                }
            } catch (error) {
                console.error('Error loading categories:', error)
                toast.error('Failed to load categories')
            } finally {
                setIsLoading(false)
            }
        }

        loadCategories()
    }, [params.categoryId])

    useEffect(() => {
        const loadListings = async () => {
            if (!categoryIds) return

            setIsLoadingListings(true)
            try {
                const result = await getListingsWithPagination({
                    category_id: categoryIds,
                    status: 'active',
                    page,
                    limit: 20,
                })

                if (page === 1) {
                    setListings(result.listings)
                } else {
                    setListings(prev => [...prev, ...result.listings])
                }
                setTotalPages(result.totalPages)
            } catch (error) {
                console.error('Error loading listings:', error)
                toast.error('Failed to load listings')
            } finally {
                setIsLoadingListings(false)
            }
        }

        loadListings()
    }, [categoryIds, page])

    const handleFavoriteToggle = async (listingId: string) => {
        try {
            if (!user || !session) {
                toast.error('Please log in to save favorites', {
                    action: {
                        label: 'Log in',
                        onClick: () => router.push('/auth/login')
                    }
                })
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

    const handleLoadMore = () => {
        if (page < totalPages) {
            setPage(page + 1)
        }
    }

    const getParentCategory = () => {
        if (!currentCategory?.parent_id) return null
        return allCategories.find(c => c.id === currentCategory.parent_id)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
            </div>
        )
    }

    if (!currentCategory) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <p className="text-center text-gray-600 dark:text-gray-400">Category not found</p>
                </div>
            </div>
        )
    }

    const parentCategory = getParentCategory()

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
            {/* Header */}
            <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-2 mb-4">
                        <button
                            onClick={() => router.back()}
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                        {parentCategory && (
                            <>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <button
                                    onClick={() => router.push(`/classifieds/category/${parentCategory.id}`)}
                                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                    {parentCategory.name}
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <CategoryPicture imageUrl={currentCategory.image_url} iconName={currentCategory.icon} name={currentCategory.name} className="w-12 h-12 rounded-xl" iconClassName="w-8 h-8 text-gray-700 dark:text-gray-300" />
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                                {currentCategory.name}
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {listings.length} {listings.length === 1 ? 'listing' : 'listings'} available
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subcategories Chip Strip */}
            {subCategories.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-800 py-4 sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="overflow-x-auto scrollbar-hide">
                            <div className="flex gap-3 pb-1">
                                {subCategories.map((subCat) => (
                                    <button
                                        key={subCat.id}
                                        onClick={() => router.push(`/classifieds/category/${subCat.id}`)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#151c2c] border border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors text-left flex-shrink-0 whitespace-nowrap"
                                    >
                                        <CategoryPicture imageUrl={subCat.image_url} iconName={subCat.icon} name={subCat.name} className="w-8 h-8 rounded-md" iconClassName="w-5 h-5 text-gray-700 dark:text-gray-300" />
                                        <div className="min-w-0">
                                            <div className="text-xs font-semibold text-gray-900 dark:text-white">{subCat.name}</div>
                                            <div className="text-xs text-emerald-600 dark:text-emerald-400">Browse</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <CategorySubcategoryCarousel 
                    mainCategory={parentCategory || currentCategory} 
                    subCategories={subCategories.length > 0 ? subCategories : [currentCategory]} 
                />

                {isLoadingListings && listings.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                    </div>
                ) : listings.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400">No listings available in {currentCategory.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Check back soon for new items</p>
                    </div>
                ) : (
                    <>
                        <ListingGrid
                            listings={listings}
                            isLoading={isLoadingListings}
                            favorites={favorites}
                            onFavoriteToggle={handleFavoriteToggle}
                            onLoadMore={page < totalPages ? handleLoadMore : undefined}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
