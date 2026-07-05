import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Heart, Share2, MapPin, Zap } from 'lucide-react'
import { ContactSellerButton } from '@/components/marketplace/contact-seller-button'
import { PromotionBadge } from '@/components/marketplace/promotion-badge'
import { CheckoutDialog } from '@/components/marketplace/checkout-dialog'

async function getListing(id: string) {
    try {
        const supabase = await createRouteHandlerClient()

        const { data: listing, error } = await supabase
            .from('classified_listings')
            .select(
                `
                id,
                title,
                description,
                price_pesewas,
                category_id,
                region,
                city,
                condition,
                status,
                moderation_status,
                promotion_tier,
                promoted_until,
                created_at,
                user_id,
                classified_listing_images(
                    id,
                    image_url,
                    sort_order
                )
                `
            )
            .eq('id', id)
            .single()

        if (error) {
            console.error('[Listing] Error:', error)
            return null
        }

        // Only show approved active listings to non-admins
        if (listing.status !== 'active' || listing.moderation_status !== 'approved') {
            return null
        }

        return listing
    } catch (error) {
        console.error('[Listing] Fetch error:', error)
        return null
    }
}

async function getSellerProfile(userId: string) {
    try {
        const supabase = await createRouteHandlerClient()

        const { data, error } = await supabase
            .from('marketplace_seller_profiles')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (error) return null
        return data
    } catch (error) {
        console.error('[Seller] Error:', error)
        return null
    }
}

export async function generateMetadata({
    params: { id },
}: {
    params: { id: string }
}) {
    const listing = await getListing(id)

    if (!listing) {
        return {
            title: 'Listing Not Found | Arhms Marketplace',
        }
    }

    return {
        title: `${listing.title} | Arhms Marketplace`,
        description: listing.description.substring(0, 160),
    }
}

export default async function ListingPage({
    params: { id },
}: {
    params: { id: string }
}) {
    const listing = await getListing(id)

    if (!listing) {
        notFound()
    }

    const seller = await getSellerProfile(listing.user_id)
    const priceGhs = (listing.price_pesewas / 100).toFixed(2)

    const images = listing.classified_listing_images
        ?.sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, 10) || []

    const mainImage = images[0]
    const thumbnails = images.slice(0, 5)

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8">
                {/* Back Link */}
                <Link
                    href="/marketplace-domain/browse"
                    className="text-primary hover:underline mb-6 inline-block"
                >
                    ← Back to listings
                </Link>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Images */}
                        <div className="space-y-4">
                            {mainImage && (
                                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                                    <Image
                                        src={mainImage.image_url}
                                        alt={listing.title}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            )}

                            {thumbnails.length > 1 && (
                                <div className="grid grid-cols-5 gap-2">
                                    {thumbnails.map((img) => (
                                        <div
                                            key={img.id}
                                            className="relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-75 transition-opacity"
                                        >
                                            <Image
                                                src={img.image_url}
                                                alt=""
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Details */}
                        <Card className="p-6">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <h1 className="text-3xl font-bold">
                                    {listing.title}
                                </h1>
                                {listing.promotion_tier && (
                                    <PromotionBadge tier={listing.promotion_tier} />
                                )}
                            </div>

                            <div className="flex gap-3 mb-4">
                                <Badge variant="secondary">
                                    {listing.condition}
                                </Badge>
                                <Badge variant="outline">
                                    {new Date(listing.created_at).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </Badge>
                                {listing.promotion_tier && listing.promoted_until && (
                                    <Badge variant="outline" className="text-xs">
                                        <Zap className="w-3 h-3 mr-1" />
                                        Expires {new Date(listing.promoted_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </Badge>
                                )}
                            </div>

                            <p className="text-muted-foreground whitespace-pre-wrap">
                                {listing.description}
                            </p>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Price Card */}
                        <Card className="p-6">
                            <div className="mb-6">
                                <p className="text-muted-foreground text-sm mb-1">
                                    Price
                                </p>
                                <p className="text-4xl font-bold text-primary">
                                    GHS {priceGhs}
                                </p>
                            </div>

                            {/* Location */}
                            {(listing.region || listing.city) && (
                                <div className="mb-6 flex items-start gap-2">
                                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            Location
                                        </p>
                                        <p className="font-medium">
                                            {listing.city}
                                            {listing.city && listing.region ? ', ' : ''}
                                            {listing.region}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Seller Info */}
                            {seller && (
                                <div className="mb-6 pb-6 border-b">
                                    <p className="text-sm text-muted-foreground mb-3">
                                        Seller
                                    </p>
                                    <div className="space-y-2">
                                        <p className="font-medium">
                                            {seller.display_name || 'Anonymous Seller'}
                                        </p>
                                        {seller.verification_tier && (
                                            <Badge variant="outline">
                                                {seller.verification_tier}
                                            </Badge>
                                        )}
                                        {seller.rating && (
                                            <p className="text-sm">
                                                ⭐ {seller.rating.toFixed(1)} rating
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="space-y-2">
                                <CheckoutDialog
                                    listingId={listing.id}
                                    price={listing.price_pesewas}
                                    title={listing.title}
                                    supportedModes={listing.payment_modes || ['direct']}
                                />
                                <ContactSellerButton
                                    listingId={listing.id}
                                    sellerId={listing.user_id}
                                />
                                <Button
                                    variant="outline"
                                    className="w-full"
                                >
                                    <Heart className="w-4 h-4 mr-2" />
                                    Save
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="w-full"
                                >
                                    <Share2 className="w-4 h-4 mr-2" />
                                    Share
                                </Button>
                            </div>
                        </Card>

                        {/* Safety Tips */}
                        <Card className="p-4 bg-amber-50 border-amber-200">
                            <h3 className="font-semibold text-sm mb-2">
                                Safety Tips
                            </h3>
                            <ul className="text-xs text-muted-foreground space-y-1">
                                <li>• Meet in a safe, public place</li>
                                <li>• Verify the item before paying</li>
                                <li>• Use Arhms payment when possible</li>
                                <li>• Never share personal information</li>
                            </ul>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
