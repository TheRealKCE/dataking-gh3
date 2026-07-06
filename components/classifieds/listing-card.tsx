'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, BadgeCheck, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassifiedListing, ClassifiedListingImage } from '@/types/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const STORAGE_BUCKET = 'classified-listing-images'

function getImagePublicUrl(storagePath: string): string {
    return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`
}

interface ListingCardProps {
    listing: ClassifiedListing & {
        classified_categories?: { name: string; slug: string }
        classified_listing_images?: Pick<ClassifiedListingImage, 'id' | 'storage_path' | 'display_order'>[]
        users?: { seller_verified_at?: string | null }
    }
    isFavorited?: boolean
    onFavoriteToggle?: (listingId: string) => void
}

export function ListingCard({ listing, isFavorited, onFavoriteToggle }: ListingCardProps) {
    // Sort images by display_order and pick the first one
    const images = [...(listing.classified_listing_images || [])].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    )
    const coverImage = images[0]
    const coverUrl = coverImage ? getImagePublicUrl(coverImage.storage_path) : null

    // When a listing is promoted (actively boosted) we keep the image clean:
    // no "Promoted" tag and no category pill — the Verified badge is the accent.
    const isPromoted = Boolean(
        listing.is_boosted && listing.boosted_until && new Date(listing.boosted_until) > new Date()
    )

    return (
        <Link href={`/classifieds/${listing.id}`}>
            <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-300 cursor-pointer h-full flex flex-col">
                {/* Image */}
                <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {coverUrl ? (
                        <Image
                            src={coverUrl}
                            alt={listing.title}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover"
                            onError={(e) => {
                                // On error fall back to placeholder
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.parentElement?.querySelector('.img-fallback')?.removeAttribute('style')
                            }}
                        />
                    ) : null}

                    {/* Placeholder — shown when no image or image fails to load */}
                    <div
                        className={cn(
                            'img-fallback w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex flex-col items-center justify-center text-gray-400 gap-2',
                            coverUrl && 'hidden'
                        )}
                    >
                        <ImageIcon className="w-8 h-8 opacity-50" />
                        <span className="text-xs font-medium">No image</span>
                    </div>

                    {/* Multi-image count badge */}
                    {images.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            {images.length}
                        </div>
                    )}

                    {/* Category badge — hidden on promoted listings for a clean image */}
                    {listing.classified_categories && !isPromoted && (
                        <div className="absolute top-2 left-2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                            {listing.classified_categories.name}
                        </div>
                    )}

                    {/* Favorite button */}
                    <button
                        title="Toggle favorite"
                        aria-label="Toggle favorite"
                        onClick={(e) => {
                            e.preventDefault()
                            onFavoriteToggle?.(listing.id)
                        }}
                        className={cn(
                            'absolute top-2 right-2 rounded-full p-2 transition-all',
                            isFavorited
                                ? 'bg-red-500 text-white'
                                : 'bg-white/80 dark:bg-gray-800/80 text-gray-500 hover:bg-white hover:text-red-500'
                        )}
                    >
                        <Heart className={cn('w-5 h-5', isFavorited && 'fill-current')} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 flex-1">
                            {listing.title}
                        </h3>
                        {listing.users?.seller_verified_at && (
                            <div className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-2 py-0.5 shadow-sm shadow-blue-500/25 ring-1 ring-white/25">
                                <BadgeCheck className="w-3.5 h-3.5 text-white" />
                                <span className="text-[11px] font-bold tracking-wide text-white">Verified</span>
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        {listing.location || 'Location not specified'}
                    </p>

                    {/* Condition badge */}
                    {listing.condition && (
                        <div className="inline-flex w-fit mb-3">
                            <span className="text-xs font-semibold px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 capitalize">
                                {listing.condition}
                            </span>
                        </div>
                    )}

                    <div className="mt-auto">
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            GHS {listing.price.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Posted {new Date(listing.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    )
}

