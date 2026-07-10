'use client'

import { EyeOff, ShieldAlert } from 'lucide-react'
import { useListingContact } from './ListingContactContext'
import { MarkUnavailableButton } from './MarkUnavailableModal'
import { ReportAbuseButton } from './ReportModal'
import type { ListingStatus } from './types'

/**
 * Mutually-exclusive status actions. The owner sees "Mark unavailable" /
 * "Mark as available"; everyone else sees "Report Abuse". Never both.
 */
export function ListingStatusActions() {
    const { isOwner } = useListingContact()
    return (
        <div>
            {isOwner ? <MarkUnavailableButton /> : <ReportAbuseButton />}
        </div>
    )
}

// --- Presentational status label (context-free) ------------------------------

const STATUS_LABEL: Partial<Record<ListingStatus, string>> = {
    unavailable: 'No longer available',
    sold: 'Sold',
    under_review: 'Under review',
    removed: 'Removed',
}

/** True for any status that should show an overlay / drop out of search. */
export function isInactiveStatus(status: ListingStatus): boolean {
    return status !== 'active'
}

/**
 * Gray overlay badge for a listing image in feeds / My Ads / Saved Items.
 * Context-free — pass the status directly. Renders nothing when active.
 *
 *   <div className="relative">
 *     <img ... />
 *     <ListingStatusOverlay status={listing.status} />
 *   </div>
 */
export function ListingStatusOverlay({ status }: { status: ListingStatus }) {
    const label = STATUS_LABEL[status]
    if (!label) return null
    return (
        <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/55">
            <span className="rounded-md bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                {label}
            </span>
        </div>
    )
}

// --- Detail-page banner (context-driven) -------------------------------------

/** Banner shown at the top of the listing detail when the ad is inactive. */
export function ListingUnavailableBanner() {
    const { status, listingActive, isOwner } = useListingContact()
    if (listingActive) return null

    const underReview = status === 'under_review'
    const label = STATUS_LABEL[status] ?? 'Unavailable'

    return (
        <div
            className={`flex items-start gap-2 rounded-2xl p-4 text-sm shadow-sm ${
                underReview ? 'bg-amber-50 text-amber-800' : 'bg-gray-800 text-white'
            }`}
        >
            {underReview ? (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
                <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
                <p className="font-semibold">
                    {underReview ? 'This ad is under review' : `This ad is ${label.toLowerCase()}`}
                </p>
                <p className={underReview ? 'text-amber-700' : 'text-white/70'}>
                    {isOwner
                        ? underReview
                            ? 'It is temporarily hidden while our team reviews reports.'
                            : 'It is hidden from search and buyers can’t contact you. Relist it any time.'
                        : underReview
                          ? 'It has been temporarily hidden pending moderation.'
                          : 'The seller is no longer accepting contact about this ad.'}
                </p>
            </div>
        </div>
    )
}
