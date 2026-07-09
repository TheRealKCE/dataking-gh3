// Global saved-items (bookmark) model. Shared across the listing detail page,
// feed cards, search results and the Saved Items screen.

export interface SavedItem {
    userId: string
    listingId: string
    savedAt: string // ISO
}

/** Minimal auth shape the save flow needs (kept independent of other modules). */
export interface SaveUser {
    id: string
    name?: string
}

export type SaveButtonSize = 'sm' | 'md' | 'lg'
export type SaveButtonPlacement = 'overlay' | 'inline'
