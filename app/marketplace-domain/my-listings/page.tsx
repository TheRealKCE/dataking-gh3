import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PromoteListingDialog } from '@/components/marketplace/promote-listing-dialog'
import { PromotionBadge } from '@/components/marketplace/promotion-badge'

export const metadata = {
    title: 'My Listings | Arhms Marketplace',
    description: 'Manage your marketplace listings',
}

export default async function MyListingsPage() {
    const supabase = await createRouteHandlerClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/my-listings')
    }

    // Get user's listings
    const { data: listings, error } = await supabase
        .from('classified_listings')
        .select('id, title, price_pesewas, status, moderation_status, promotion_tier, promoted_until, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('[My Listings] Error:', error)
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">My Listings</h1>
                        <p className="text-muted-foreground">
                            Manage your active and inactive listings
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/marketplace-domain/sell">
                            Create New Listing
                        </Link>
                    </Button>
                </div>

                {!listings || listings.length === 0 ? (
                    <Card className="p-8 text-center">
                        <p className="text-muted-foreground mb-4">
                            You haven't created any listings yet
                        </p>
                        <Button asChild>
                            <Link href="/marketplace-domain/sell">
                                Create Your First Listing
                            </Link>
                        </Button>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {listings.map((listing: any) => (
                            <Card key={listing.id} className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Link
                                                href={`/marketplace-domain/listings/${listing.id}`}
                                                className="font-semibold hover:text-primary transition-colors"
                                            >
                                                {listing.title}
                                            </Link>
                                            {listing.promotion_tier && (
                                                <PromotionBadge tier={listing.promotion_tier} compact />
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            GHS {(listing.price_pesewas / 100).toFixed(2)}
                                        </p>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {listing.status}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                {listing.moderation_status}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 flex-shrink-0">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/marketplace-domain/listings/${listing.id}`}>
                                                View
                                            </Link>
                                        </Button>
                                        {listing.status === 'active' && listing.moderation_status === 'approved' && (
                                            <PromoteListingDialog listingId={listing.id} />
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
