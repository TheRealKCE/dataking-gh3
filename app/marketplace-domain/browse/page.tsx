import { createRouteHandlerClient } from '@/lib/supabase-server'
import { MarketplaceFeed } from '@/components/marketplace/marketplace-feed'

async function getCategories() {
    try {
        const supabase = await createRouteHandlerClient()
        const { data, error } = await supabase
            .from('classifieds_categories')
            .select('id, name')
            .order('name')

        if (error) {
            console.error('[Browse] Categories error:', error)
            return []
        }

        return data || []
    } catch (error) {
        console.error('[Browse] Fetch categories error:', error)
        return []
    }
}

export const metadata = {
    title: 'Browse Listings | Arhms Marketplace',
    description: 'Browse all listings on Arhms Marketplace',
}

export default async function BrowsePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; category?: string }>
}) {
    const [categories, params] = await Promise.all([getCategories(), searchParams])

    return (
        <div className="min-h-screen bg-background">
            {/* Header banner */}
            <div className="mkt-hero border-b">
                <div className="container py-10">
                    <h1 className="text-3xl font-bold">Browse Listings</h1>
                    <p className="text-muted-foreground mt-1">
                        Discover items from sellers across Ghana
                    </p>
                </div>
            </div>

            <div className="container py-8">
                <MarketplaceFeed
                    categories={categories}
                    categoryId={params.category}
                    initialQuery={params.q ?? ''}
                />
            </div>
        </div>
    )
}
