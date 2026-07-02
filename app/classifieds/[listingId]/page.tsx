'use client'

import { useState, useEffect } from 'react'
import { notFound, useRouter } from 'next/navigation'
import { getListingById, getListingsWithPagination } from '@/lib/classifieds-queries'
import { ImageCarousel } from '@/components/classifieds/image-carousel'
import { ContactRevealButton } from '@/components/classifieds/contact-reveal-button'
import { ListingGrid } from '@/components/classifieds/listing-grid'
import { Heart, MapPin, Calendar, AlertCircle, CheckCircle, Loader2, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import type { ClassifiedListing } from '@/types/supabase'

export default function ListingDetailPage({
    params,
}: {
    params: { listingId: string }
}) {
    const router = useRouter()
    const { user } = useAuth()
    const [listing, setListing] = useState<ClassifiedListing | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isFavorited, setIsFavorited] = useState(false)
    const [similarListings, setSimilarListings] = useState<ClassifiedListing[]>([])
    const [isLoadingSimilar, setIsLoadingSimilar] = useState(false)
    const [images, setImages] = useState<Array<{ url: string; alt: string }> | null>(null)

    useEffect(() => {
        const loadListing = async () => {
            try {
                const data = await getListingById(params.listingId)
                if (!data) {
                    notFound()
                }
                setListing(data as any)

                // Transform listing images to carousel format
                console.log('Listing data:', data)
                console.log('Images from listing:', data.classified_listing_images)

                if (data.classified_listing_images && data.classified_listing_images.length > 0) {
                    const carouselImages = (data.classified_listing_images as any[]).map((img: any) => {
                        const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/classifieds-listings/${img.storage_path}`
                        console.log('Image URL:', imageUrl)
                        return {
                            url: imageUrl,
                            alt: data.title || 'Listing image'
                        }
                    })
                    console.log('Carousel images:', carouselImages)
                    setImages(carouselImages)
                } else {
                    console.log('No images found for listing')
                }

                setIsLoadingSimilar(true)
                const similar = await getListingsWithPagination({
                    category_id: data.category_id,
                    status: 'active',
                    limit: 8,
                })
                setSimilarListings(similar.listings.filter(l => l.id !== params.listingId))
            } catch (error) {
                console.error('Error loading listing:', error)
                notFound()
            } finally {
                setIsLoading(false)
                setIsLoadingSimilar(false)
            }
        }

        loadListing()
    }, [params.listingId])

    const userId = user?.id

    const getSafetyTips = () => {
        const categorySlug = (listing?.classified_categories as any)?.slug || ''

        // Property/Real Estate tips
        if (['land', 'commercial-property', 'residential-property', 'apartments'].includes(categorySlug)) {
            return [
                'Request proper documentation including deed and land certificate',
                'Visit the property in person with a trusted friend or family member',
                'Verify property ownership with the Land Registry or relevant authority',
                'Hire a surveyor to inspect the property and verify its condition',
                'Be cautious of deals that seem too good to be true',
                'Avoid paying deposits through informal channels',
            ]
        }

        // Vehicle tips
        if (['cars', 'motorcycles-scooters', 'trucks-trailers', 'buses-microbuses', 'construction-heavy-machinery'].includes(categorySlug)) {
            return [
                'Request a test drive and inspect the vehicle thoroughly',
                'Verify the vehicle registration and ownership documents',
                'Get a pre-purchase inspection from a certified mechanic',
                'Check the vehicle\'s history and mileage',
                'Inspect for signs of accident damage or rust',
                'Only pay after you\'ve completed your inspection',
            ]
        }

        // Default tips for goods
        return [
            'It\'s safer not to pay ahead for inspections',
            'Ask friends or somebody you trust to accompany you for viewing',
            'Look around and ensure the item meets your expectations',
            'Don\'t pay beforehand if they won\'t let you inspect immediately',
            'Verify that the item is exactly what you\'re looking for',
            'Only pay if you\'re satisfied with the condition',
        ]
    }

    const handleFavoriteToggle = async () => {
        try {
            if (!user) {
                toast.error('Please log in to save favorites', {
                    action: {
                        label: 'Log in',
                        onClick: () => router.push('/auth/login')
                    }
                })
                return
            }

            const endpoint = isFavorited
                ? `/api/classifieds/favorites?listing_id=${params.listingId}`
                : '/api/classifieds/favorites'

            const response = await fetch(endpoint, {
                method: isFavorited ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
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

    const handleMarkUnavailable = async () => {
        try {
            if (!user) {
                toast.error('Please log in', {
                    action: {
                        label: 'Log in',
                        onClick: () => router.push('/auth/login')
                    }
                })
                return
            }

            const response = await fetch(`/api/classifieds/listings/${params.listingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'archived' }),
            })

            if (response.ok) {
                const updated = await response.json()
                setListing(updated)
                toast.success('Listing marked as unavailable')
            } else {
                toast.error('Failed to update listing')
            }
        } catch (error) {
            console.error('Error marking unavailable:', error)
            toast.error('Error updating listing')
        }
    }

    const getSellerName = () => {
        if (!listing) return ''
        const users = listing.users as any
        if (!users) return 'Seller'
        return [users.first_name, users.last_name].filter(Boolean).join(' ') || 'Seller'
    }

    const getYearsActive = () => {
        if (!listing) return ''
        const users = listing.users as any
        if (!users) return ''
        if (users.seller_verified_at) {
            const year = new Date(users.seller_verified_at).getFullYear()
            return `on the marketplace since ${year}`
        }
        const year = new Date(listing.created_at).getFullYear()
        return `on the marketplace since ${year}`
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
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
                {/* Images */}
                <ImageCarousel images={images} />

                {/* Title */}
                <div className="bg-white dark:bg-[#151c2c] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                    <h1 className="text-xl font-black text-gray-900 dark:text-white mb-1">
                        {listing.title}
                    </h1>
                    {listing.classified_categories && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            in <span className="font-semibold">{(listing.classified_categories as any).name}</span>
                        </p>
                    )}
                </div>

                {/* Price & Negotiable */}
                <div className="bg-white dark:bg-[#151c2c] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-2">
                        GHS {listing.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Negotiable</p>
                    <button type="button" className="w-full border border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400 font-semibold py-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                        Request call back
                    </button>
                </div>

                {/* Seller Card */}
                <div className="bg-white dark:bg-[#151c2c] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {getSellerName().charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                                <h3 className="font-bold text-gray-900 dark:text-white text-sm">{getSellerName()}</h3>
                                {(listing.users as any)?.seller_verified_at && (
                                    <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                )}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">1+ years on site</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Typically replies within an hour</p>
                        </div>
                    </div>

                    {/* Seller Action Buttons */}
                    <div className="space-y-2">
                        <button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                            <Phone className="w-4 h-4" />
                            Show contact
                        </button>
                        <button type="button" className="w-full border border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400 font-semibold py-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-sm">
                            Start chat
                        </button>
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="grid grid-cols-2 gap-3">
                    <button type="button" className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm">
                        Marked
                    </button>
                    <button type="button" className="border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-semibold py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm">
                        Report Abuse
                    </button>
                </div>

                {/* Info Grid */}
                {(listing.condition || listing.location) && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {listing.condition && (
                            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Condition</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{listing.condition}</p>
                            </div>
                        )}

                        {listing.location && (
                            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Location</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{listing.location}</p>
                            </div>
                        )}

                        <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Posted</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {new Date(listing.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                )}

                {/* Description */}
                {listing.description && (
                    <div className="bg-white dark:bg-[#151c2c] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase">Description</h2>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {listing.description}
                        </p>
                    </div>
                )}

                {/* Unavailable Banner */}
                {listing.status === 'archived' && (
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-sm font-bold text-gray-600 dark:text-gray-400">This listing is no longer available</p>
                    </div>
                )}

                {/* Owner Mark Unavailable */}
                {userId && userId === listing.seller_id && listing.status !== 'archived' && (
                    <button
                        type="button"
                        onClick={handleMarkUnavailable}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                    >
                        Mark unavailable
                    </button>
                )}

                {/* Post Ad Like This Button */}
                <button type="button" className="w-full border border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400 font-semibold py-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-sm">
                    Post Ad Like This
                </button>

                {/* Safety Notice */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
                    <div className="flex gap-3 mb-4">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Safety tips</p>
                    </div>
                    <ul className="space-y-2 ml-8">
                        {getSafetyTips().map((tip, index) => (
                            <li key={index} className="text-xs text-amber-800 dark:text-amber-400">{tip}</li>
                        ))}
                    </ul>
                </div>

                {/* View Count */}
                <div className="text-center text-xs text-gray-500 dark:text-gray-500">
                    {listing.view_count} people viewed this listing
                </div>

                {/* Similar Adverts */}
                {similarListings.length > 0 && (
                    <div className="mt-12 border-t border-gray-200 dark:border-gray-800 pt-8">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">Similar Adverts</h2>
                        {isLoadingSimilar ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 animate-spin" />
                            </div>
                        ) : (
                            <ListingGrid
                                listings={similarListings}
                                isLoading={false}
                                favorites={[]}
                                onFavoriteToggle={() => {}}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
