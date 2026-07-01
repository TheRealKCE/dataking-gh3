'use client'

import { useState, useEffect } from 'react'
import { notFound } from 'next/navigation'
import { getListingById } from '@/lib/classifieds-queries'
import { ImageCarousel } from '@/components/classifieds/image-carousel'
import { ContactRevealButton } from '@/components/classifieds/contact-reveal-button'
import { Heart, MapPin, Calendar, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { ClassifiedListing } from '@/types/supabase'

export default function ListingDetailPage({
    params,
}: {
    params: { listingId: string }
}) {
    const [listing, setListing] = useState<ClassifiedListing | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [userId, setUserId] = useState<string | undefined>()
    const [isFavorited, setIsFavorited] = useState(false)

    useEffect(() => {
        const loadListing = async () => {
            try {
                const data = await getListingById(params.listingId)
                if (!data) {
                    notFound()
                }
                setListing(data as any)
            } catch (error) {
                console.error('Error loading listing:', error)
                notFound()
            } finally {
                setIsLoading(false)
            }
        }

        const token = localStorage.getItem('sb-token')
        if (token) {
            // Decode JWT to get user ID (simplified)
            try {
                const payload = JSON.parse(atob(token.split('.')[1]))
                setUserId(payload.sub)
            } catch (e) {
                console.error('Error parsing token:', e)
            }
        }

        loadListing()
    }, [params.listingId])

    const handleFavoriteToggle = async () => {
        try {
            const token = localStorage.getItem('sb-token')
            if (!token) {
                toast.error('Please log in to save favorites')
                return
            }

            const endpoint = isFavorited
                ? `/api/classifieds/favorites?listing_id=${params.listingId}`
                : '/api/classifieds/favorites'

            const response = await fetch(endpoint, {
                method: isFavorited ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                ...((!isFavorited) && {
                    body: JSON.stringify({ listing_id: params.listingId }),
                }),
            })

            if (response.ok) {
                setIsFavorited(!isFavorited)
                toast.success(isFavorited ? 'Removed from favorites' : 'Added to favorites')
            }
        } catch (error) {
            toast.error('Error updating favorites')
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex items-center justify-center">
                <p className="text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
        )
    }

    if (!listing) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
            {/* Header */}
            <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <a href="/classifieds" className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                        ← Back to listings
                    </a>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
                {/* Images */}
                <ImageCarousel images={null} />

                {/* Title & Price */}
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                                {listing.title}
                            </h1>
                            {listing.classified_categories && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    in <span className="font-bold">{(listing.classified_categories as any).name}</span>
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleFavoriteToggle}
                            className={`p-3 rounded-full transition-all ${
                                isFavorited
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-red-500'
                            }`}
                        >
                            <Heart className={`w-6 h-6 ${isFavorited && 'fill-current'}`} />
                        </button>
                    </div>

                    <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                        GHS {listing.price.toFixed(2)}
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {listing.condition && (
                        <div className="bg-white dark:bg-[#151c2c] rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Condition</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white capitalize mt-1">{listing.condition}</p>
                        </div>
                    )}

                    {listing.location && (
                        <div className="bg-white dark:bg-[#151c2c] rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 mb-1">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Location</p>
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{listing.location}</p>
                        </div>
                    )}

                    <div className="bg-white dark:bg-[#151c2c] rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Posted</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {new Date(listing.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                {/* Description */}
                <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4">Description</h2>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {listing.description}
                    </p>
                </div>

                {/* Contact Section */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">Get in Touch</h2>
                    <ContactRevealButton listing={listing} userId={userId} />
                </div>

                {/* Safety Notice */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Always buy safely</p>
                        <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">
                            Meet the seller in person, inspect items before paying, and only pay after you're satisfied.
                        </p>
                    </div>
                </div>

                {/* View Count */}
                <div className="text-center text-xs text-gray-500 dark:text-gray-500">
                    {listing.view_count} people viewed this listing
                </div>
            </div>
        </div>
    )
}
