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

export default async function BrowsePage() {
    const categories = await getCategories()

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Browse Listings</h1>
                    <p className="text-muted-foreground">
                        Discover items from sellers across Ghana
                    </p>
                </div>

                <MarketplaceFeed categories={categories} />
            </div>
        </div>
    )
}
