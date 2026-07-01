'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassifiedListing } from '@/types/supabase'

interface ListingCardProps {
    listing: ClassifiedListing & { classified_categories?: { name: string; slug: string } }
    isFavorited?: boolean
    onFavoriteToggle?: (listingId: string) => void
}

export function ListingCard({ listing, isFavorited, onFavoriteToggle }: ListingCardProps) {
    return (
        <Link href={`/classifieds/${listing.id}`}>
            <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-300 cursor-pointer h-full flex flex-col">
                {/* Image */}
                <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {/* Placeholder image */}
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center text-gray-400">
                        <span className="text-sm">No image</span>
                    </div>

                    {/* Category badge */}
                    {listing.classified_categories && (
                        <div className="absolute top-2 left-2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                            {listing.classified_categories.name}
                        </div>
                    )}

                    {/* Favorite button */}
                    <button
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
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 mb-1">
                        {listing.title}
                    </h3>

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
