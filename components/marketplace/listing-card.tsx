'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PromotionBadge } from './promotion-badge'

interface ListingCardProps {
    listing: {
        id: string
        title: string
        description: string
        price_pesewas: number
        condition: string
        region?: string
        created_at: string
        promotion_tier?: number
        classified_listing_images?: Array<{
            image_url: string
            sort_order: number
        }>
    }
    initialFavorited?: boolean
}

export function ListingCard({ listing, initialFavorited = false }: ListingCardProps) {
    const priceGhs = (listing.price_pesewas / 100).toFixed(2)
    const image = listing.classified_listing_images?.[0]
    const [favorited, setFavorited] = useState(initialFavorited)
    const [busy, setBusy] = useState(false)

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.preventDefault()
        if (busy) return
        setBusy(true)
        const next = !favorited
        setFavorited(next) // optimistic
        try {
            const res = next
                ? await fetch('/api/marketplace/favorites', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ listing_id: listing.id }),
                  })
                : await fetch(`/api/marketplace/favorites?listing_id=${listing.id}`, {
                      method: 'DELETE',
                  })

            if (res.status === 401) {
                setFavorited(!next) // revert
                toast.error('Please log in to save favorites')
                return
            }
            if (!res.ok) throw new Error('request failed')
        } catch {
            setFavorited(!next) // revert on failure
            toast.error('Could not update favorites')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Link href={`/marketplace-domain/listings/${listing.id}`}>
            <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
                {/* Image */}
                <div className="relative aspect-square bg-muted overflow-hidden">
                    {image ? (
                        <Image
                            src={image.image_url}
                            alt={listing.title}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            No image
                        </div>
                    )}

                    {/* Promotion Badge */}
                    {listing.promotion_tier && (
                        <div className="absolute top-2 right-12">
                            <PromotionBadge tier={listing.promotion_tier} compact />
                        </div>
                    )}

                    {/* Condition Badge */}
                    <Badge
                        className="absolute top-2 right-2 capitalize"
                        variant="secondary"
                    >
                        {listing.condition}
                    </Badge>

                    {/* Favorite Button */}
                    <button
                        type="button"
                        title={favorited ? 'Remove from favorites' : 'Add to favorites'}
                        disabled={busy}
                        className="absolute top-2 left-2 rounded-full bg-white/80 p-2 hover:bg-white transition-colors disabled:opacity-60"
                        onClick={toggleFavorite}
                    >
                        <Heart
                            className={cn(
                                'w-4 h-4 transition-colors',
                                favorited ? 'fill-red-500 text-red-500' : 'text-gray-700'
                            )}
                            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                        />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-3">
                    <h3 className="font-semibold line-clamp-2 text-sm">
                        {listing.title}
                    </h3>

                    <p className="text-muted-foreground text-xs line-clamp-2 mt-1">
                        {listing.description}
                    </p>

                    <div className="mt-auto pt-2 flex items-center justify-between">
                        <div className="font-bold text-primary">
                            GHS {priceGhs}
                        </div>
                        {listing.region && (
                            <span className="text-xs text-muted-foreground">
                                {listing.region}
                            </span>
                        )}
                    </div>
                </div>
            </Card>
        </Link>
    )
}
