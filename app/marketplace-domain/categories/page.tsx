import Link from 'next/link'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'

async function getCategories() {
    try {
        const supabase = await createRouteHandlerClient()

        // Get categories with listing counts
        const { data, error } = await supabase.from('classifieds_categories').select(`
            id,
            name,
            classified_listings(count)
        `)

        if (error) throw error

        return (
            data?.map((cat) => ({
                id: cat.id,
                name: cat.name,
                count: cat.classified_listings?.[0]?.count || 0,
            })) || []
        )
    } catch (error) {
        console.error('[Categories] Error:', error)
        return []
    }
}

export const metadata = {
    title: 'Categories | Arhms Marketplace',
    description: 'Browse listings by category',
}

export default async function CategoriesPage() {
    const categories = await getCategories()

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Browse Categories</h1>
                    <p className="text-muted-foreground">
                        Find what you're looking for
                    </p>
                </div>

                {/* Categories Grid */}
                {categories.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>No categories available</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map((category) => (
                            <Link
                                key={category.id}
                                href={`/marketplace-domain/browse?category=${category.id}`}
                            >
                                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-lg">
                                                {category.name}
                                            </h3>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {category.count}{' '}
                                                {category.count === 1
                                                    ? 'listing'
                                                    : 'listings'}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
