import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListingCard } from '@/components/marketplace/listing-card'
import Link from 'next/link'
import { Heart } from 'lucide-react'

export const metadata = {
    title: 'Favorites | Arhms Marketplace',
    description: 'Your favorite marketplace listings',
}

async function getFavoriteListings(userId: string) {
    const supabase = await createRouteHandlerClient()

    // classified_favorites → classified_listings (the marketplace listing table)
    const { data, error } = await supabase
        .from('classified_favorites')
        .select(
            `
            listing_id,
            classified_listings (
                id,
                title,
                description,
                price_pesewas,
                region,
                condition,
                status,
                promotion_tier,
                created_at,
                classified_listing_images(image_url, sort_order)
            )
            `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[Favorites] Fetch error:', error)
        return []
    }

    // Flatten to the listing rows, dropping any favorites whose listing was removed
    return (data || [])
        .map((row: any) => row.classified_listings)
        .filter((listing: any) => listing && listing.status === 'active')
}

export default async function FavoritesPage() {
    const supabase = await createRouteHandlerClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/favorites')
    }

    const listings = await getFavoriteListings(user.id)

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Favorites</h1>
                    <p className="text-muted-foreground">
                        Your saved listings
                    </p>
                </div>

                {listings.length === 0 ? (
                    <Card className="p-8 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                                <Heart className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-semibold">No favorites yet</p>
                                <p className="text-muted-foreground text-sm mt-1">
                                    Tap the heart on any listing to save it here.
                                </p>
                            </div>
                            <Button asChild>
                                <Link href="/marketplace-domain/browse">
                                    Browse Listings
                                </Link>
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {listings.map((listing: any) => (
                            <ListingCard key={listing.id} listing={listing} initialFavorited />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
