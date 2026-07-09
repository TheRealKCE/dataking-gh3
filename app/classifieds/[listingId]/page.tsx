'use client'

import { useState, useEffect } from 'react'
import { notFound, useRouter } from 'next/navigation'
import { getListingById, getListingsWithPagination } from '@/lib/classifieds-queries'
import { ImageCarousel } from '@/components/classifieds/image-carousel'
import { ContactRevealButton } from '@/components/classifieds/contact-reveal-button'
import { ListingGrid } from '@/components/classifieds/listing-grid'
import { Heart, MapPin, Calendar, AlertCircle, CheckCircle, Loader2, Phone, Flag } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import type { ClassifiedListing } from '@/types/supabase'

const REPORT_REASONS: { value: string; label: string }[] = [
    { value: 'scam', label: 'Scam or fraud' },
    { value: 'prohibited', label: 'Prohibited item' },
    { value: 'duplicate', label: 'Duplicate listing' },
    { value: 'wrong_category', label: 'Wrong category' },
    { value: 'offensive', label: 'Offensive content' },
    { value: 'already_sold', label: 'Item already sold' },
    { value: 'other', label: 'Other' },
]

export default function ListingDetailPage({
    params,
}: {
    params: { listingId: string }
}) {
    const router = useRouter()
    const { user, session } = useAuth()
    const [listing, setListing] = useState<ClassifiedListing | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isFavorited, setIsFavorited] = useState(false)
    const [isSavingFavorite, setIsSavingFavorite] = useState(false)
    const [isRequestingCallback, setIsRequestingCallback] = useState(false)
    const [showReportModal, setShowReportModal] = useState(false)
    const [reportReason, setReportReason] = useState('')
    const [reportDetails, setReportDetails] = useState('')
    const [isReporting, setIsReporting] = useState(false)
    const [hasReported, setHasReported] = useState(false)
    const [similarListings, setSimilarListings] = useState<ClassifiedListing[]>([])
    const [isLoadingSimilar, setIsLoadingSimilar] = useState(false)
    const [images, setImages] = useState<Array<{ url: string; alt: string }> | null>(null)

    // Bearer token for the classifieds API routes (they verify via token, not cookies).
    const authHeaders = (): Record<string, string> => ({
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    })

    const requireLogin = (): boolean => {
        if (user) return true
        toast.error('Please log in to continue', {
            action: { label: 'Log in', onClick: () => router.push('/auth/login') },
        })
        return false
    }

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
                        const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/classified-listing-images/${img.storage_path}`
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

    // Load whether the current user has already saved this listing.
    useEffect(() => {
        if (!session?.access_token) {
            setIsFavorited(false)
            return
        }
        let alive = true
        fetch('/api/classifieds/favorites', {
            headers: { Authorization: `Bearer ${session.access_token}` },
        })
            .then((r) => (r.ok ? r.json() : { favorites: [] }))
            .then((data) => {
                if (!alive) return
                const ids: string[] = data?.favorites ?? []
                setIsFavorited(ids.includes(params.listingId))
            })
            .catch(() => {})
        return () => {
            alive = false
        }
    }, [session?.access_token, params.listingId])

    const userId = user?.id

    const getSafetyTips = () => {
        const categorySlug = (listing?.classified_categories as any)?.slug || ''

        // Property/Real Estate tips (screenshot 2)
        if (['land', 'commercial-property', 'residential-property', 'apartments', 'houses', 'property'].includes(categorySlug)) {
            return [
                "It's safer not to pay ahead for inspections",
                'Ask friends or somebody you trust to accompany you for viewing',
                'Look around and ensure the item meets your expectations',
                "Don't pay beforehand if they won't let you inspect immediately",
                "Verify that the item is exactly what you're looking for",
                "Only pay if you're satisfied with the condition",
            ]
        }

        // Default tips for goods and items, including vehicles (screenshot 1)
        return [
            'Avoid paying in advance, even for delivery',
            'Meet with the seller at a safe public place',
            "Inspect the item and ensure it's exactly what you want",
            'Make sure that the packed item is the one you\'ve inspected',
            "Only pay if you're satisfied",
        ]
    }

    const handleFavoriteToggle = async () => {
        if (!requireLogin()) return
        const next = !isFavorited
        setIsSavingFavorite(true)
        // Optimistic update.
        setIsFavorited(next)
        try {
            const endpoint = next
                ? '/api/classifieds/favorites'
                : `/api/classifieds/favorites?listing_id=${params.listingId}`

            const response = await fetch(endpoint, {
                method: next ? 'POST' : 'DELETE',
                headers: authHeaders(),
                ...(next && { body: JSON.stringify({ listing_id: params.listingId }) }),
            })

            if (!response.ok) throw new Error('request failed')
            toast.success(next ? 'Saved to your list' : 'Removed from saved')
        } catch (error) {
            setIsFavorited(!next) // rollback
            toast.error('Error updating saved list')
        } finally {
            setIsSavingFavorite(false)
        }
    }

    const handleRequestCallback = async () => {
        if (!requireLogin()) return
        setIsRequestingCallback(true)
        try {
            const response = await fetch('/api/classifieds/call-back', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ listing_id: params.listingId }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data?.error || 'request failed')
            toast.success('Request sent', {
                description: `${getSellerName()} will call you back soon.`,
            })
        } catch (error: any) {
            toast.error(error?.message || 'Could not send request')
        } finally {
            setIsRequestingCallback(false)
        }
    }

    const handleSubmitReport = async () => {
        if (!requireLogin()) return
        if (!reportReason) {
            toast.error('Please choose a reason')
            return
        }
        setIsReporting(true)
        try {
            const response = await fetch('/api/classifieds/report', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    listing_id: params.listingId,
                    reason: reportReason,
                    details: reportDetails,
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data?.error || 'request failed')
            setHasReported(true)
            setShowReportModal(false)
            toast.success('Thanks for reporting', {
                description: 'Our team will review this ad.',
            })
        } catch (error: any) {
            toast.error(error?.message || 'Could not submit report')
        } finally {
            setIsReporting(false)
        }
    }

    const handleMarkUnavailable = async () => {
        if (!requireLogin()) return
        try {
            const response = await fetch(`/api/classifieds/listings/${params.listingId}`, {
                method: 'PUT',
                headers: authHeaders(),
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
                <div className="max-w-2xl mx-auto px-4 py-4">
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
                    <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white mb-1">
                        {listing.title}
                    </h1>
                </div>

                {/* Price & Negotiable */}
                <div className="bg-white dark:bg-[#151c2c] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-2">
                        GHS {listing.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Negotiable</p>
                    <button
                        type="button"
                        onClick={handleRequestCallback}
                        disabled={isRequestingCallback}
                        className="w-full border border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400 font-semibold py-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-60"
                    >
                        {isRequestingCallback ? 'Sending…' : 'Request call back'}
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
                        <ContactRevealButton listing={listing} userId={userId} />
                        <button
                            type="button"
                            onClick={() => toast('In-app chat is coming soon', { description: 'For now, use Contact Seller or Request call back.' })}
                            className="w-full border border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400 font-semibold py-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-sm"
                        >
                            Start chat (Coming Soon)
                        </button>
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={handleFavoriteToggle}
                        disabled={isSavingFavorite}
                        aria-pressed={isFavorited}
                        className="flex items-center justify-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm disabled:opacity-60"
                    >
                        <Heart className={`w-4 h-4 ${isFavorited ? 'fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400' : ''}`} />
                        {isFavorited ? 'Saved' : 'Save'}
                    </button>
                    <button
                        type="button"
                        onClick={() => (requireLogin() ? setShowReportModal(true) : null)}
                        disabled={hasReported}
                        className="flex items-center justify-center gap-1.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-semibold py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm disabled:opacity-60"
                    >
                        <Flag className="w-4 h-4" />
                        {hasReported ? 'Reported' : 'Report Abuse'}
                    </button>
                </div>

                {/* Details & Description */}
                <div className="bg-white dark:bg-[#151c2c] rounded-xl px-4 py-2 border border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-2 mb-2">
                        {listing.condition && (
                            <div className="flex py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                                <span className="w-1/3 sm:w-1/4 text-sm font-bold text-gray-900 dark:text-white">Condition</span>
                                <span className="w-2/3 sm:w-3/4 text-sm text-gray-700 dark:text-gray-300 capitalize">{listing.condition.replace('-', ' ')}</span>
                            </div>
                        )}
                        {listing.location && (
                            <div className="flex py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                                <span className="w-1/3 sm:w-1/4 text-sm font-bold text-gray-900 dark:text-white">Location</span>
                                <span className="w-2/3 sm:w-3/4 text-sm text-gray-700 dark:text-gray-300">{listing.location}</span>
                            </div>
                        )}
                        <div className="flex py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                            <span className="w-1/3 sm:w-1/4 text-sm font-bold text-gray-900 dark:text-white">Posted</span>
                            <span className="w-2/3 sm:w-3/4 text-sm text-gray-700 dark:text-gray-300">
                                {new Date(listing.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    {listing.description && (
                        <div className="mt-2 pb-2">
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {listing.description}
                            </p>
                        </div>
                    )}
                </div>

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
                <button
                    type="button"
                    onClick={() => router.push('/classifieds/seller/dashboard/new')}
                    className="w-full border border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400 font-semibold py-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-sm"
                >
                    Post Ad Like This
                </button>

                {/* Safety Notice */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 sm:p-6">
                    <div className="flex gap-3 mb-4">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Safety tips</p>
                    </div>
                    <ul className="space-y-2 ml-5 sm:ml-8">
                        {getSafetyTips().map((tip, index) => (
                            <li key={index} className="text-xs text-amber-800 dark:text-amber-400">{tip}</li>
                        ))}
                    </ul>
                </div>

                {/* View Count */}
                <div className="text-center text-xs text-gray-500 dark:text-gray-500">
                    {listing.view_count} people viewed this listing
                </div>

                {/* Report modal */}
                {showReportModal && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => !isReporting && setShowReportModal(false)}>
                        <div className="w-full sm:max-w-sm bg-white dark:bg-[#151c2c] rounded-t-2xl sm:rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col items-center text-center mb-3">
                                <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400 mb-2">
                                    <Flag className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white">Report this ad</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Reports are private and reviewed by our team.</p>
                            </div>

                            <div className="space-y-1 mb-3">
                                {REPORT_REASONS.map((r) => (
                                    <label
                                        key={r.value}
                                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                                            reportReason === r.value
                                                ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-gray-900 dark:text-white'
                                                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="report-reason"
                                            value={r.value}
                                            checked={reportReason === r.value}
                                            onChange={() => setReportReason(r.value)}
                                            className="accent-red-600"
                                        />
                                        {r.label}
                                    </label>
                                ))}
                            </div>

                            <textarea
                                value={reportDetails}
                                onChange={(e) => setReportDetails(e.target.value)}
                                rows={3}
                                maxLength={500}
                                placeholder="Additional details (optional)"
                                className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-red-400 mb-3"
                            />

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReportModal(false)}
                                    disabled={isReporting}
                                    className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitReport}
                                    disabled={isReporting || !reportReason}
                                    className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    {isReporting ? 'Submitting…' : 'Submit Report'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
