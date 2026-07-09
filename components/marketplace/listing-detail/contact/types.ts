// Data model for the buyer↔seller contact & call-back system.
// Mirrors the DATA MODEL spec so a real backend can drop in with the same shapes.

export type CallBackStatus = 'pending' | 'called' | 'expired'

// --- Listing status & moderation -------------------------------------------

export type ListingStatus =
    | 'active'
    | 'unavailable'
    | 'sold'
    | 'under_review'
    | 'removed'

/** Statuses that keep the ad contactable / in active search. */
export const ACTIVE_STATUSES: ListingStatus[] = ['active']

export type ReportReason =
    | 'scam'
    | 'prohibited'
    | 'duplicate'
    | 'wrong_category'
    | 'offensive'
    | 'already_sold'
    | 'other'

export type ReportStatus = 'pending' | 'reviewed' | 'actioned'

export interface Report {
    id: string
    listingId: string
    reportedBy: string
    reason: ReportReason
    details?: string
    status: ReportStatus
    createdAt: string // ISO
}

export type MarkUnavailableReason = 'sold' | 'no_longer_selling' | 'other'

/** Reports on a single listing past this count auto-flag for priority review. */
export const REPORT_AUTOHIDE_THRESHOLD = 3

export interface CallBackRequest {
    id: string
    listingId: string
    listingTitle: string
    listingThumbnail?: string
    buyerId: string
    buyerName: string
    buyerAvatarUrl?: string
    sellerId: string
    buyerPhone: string
    note?: string
    status: CallBackStatus
    createdAt: string // ISO
    respondedAt?: string // ISO
}

export interface ContactReveal {
    id: string
    listingId: string
    viewerId: string
    sellerId: string
    revealedAt: string // ISO
}

/** The signed-in buyer (null when logged out). */
export interface AuthUser {
    id: string
    name: string
    avatarUrl?: string
    phone: string
}

/** Seller contact surface for a listing. */
export interface SellerContact {
    id: string
    name: string
    phone: string
    whatsappNumber?: string
    /** Seller setting — when false, the "Request call back" flow is disabled. */
    allowCallBacks: boolean
}

export interface ListingRef {
    id: string
    title: string
    thumbnail?: string
    /** Price in major units (e.g. GHS) — pinned to the chat header. */
    price?: number
}

// --- limits (client mirrors server; server is source of truth) -------------
export const CALLBACK_COOLDOWN_MS = 60 * 60 * 1000 // 1 request / seller / hour
export const MAX_CALLBACKS_PER_DAY = 10 // per buyer, per rolling day
