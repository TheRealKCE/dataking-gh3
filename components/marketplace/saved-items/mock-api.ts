// -----------------------------------------------------------------------------
// MOCK BACKEND — saved items
// -----------------------------------------------------------------------------
// In-memory stand-in for the saved-items endpoints. Swap each body for a
// `fetch()` at the "// BACKEND:" markers. Store persists for the session.
// -----------------------------------------------------------------------------

import type { SavedItem } from './types'

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

// userId -> Set<listingId>
const store = new Map<string, Set<string>>()
const savedAt = new Map<string, string>() // `${userId}:${listingId}` -> ISO

function bucket(userId: string): Set<string> {
    let b = store.get(userId)
    if (!b) {
        b = new Set()
        store.set(userId, b)
    }
    return b
}

// BACKEND: GET /saved-items → the current user's saved listing ids.
export async function getSavedItems(userId: string): Promise<SavedItem[]> {
    await delay(120)
    return [...bucket(userId)].map((listingId) => ({
        userId,
        listingId,
        savedAt: savedAt.get(`${userId}:${listingId}`) ?? new Date().toISOString(),
    }))
}

// BACKEND: POST /saved-items { listingId }
export async function addSavedItem(userId: string, listingId: string): Promise<SavedItem> {
    await delay(200)
    bucket(userId).add(listingId)
    const at = new Date().toISOString()
    savedAt.set(`${userId}:${listingId}`, at)
    return { userId, listingId, savedAt: at }
}

// BACKEND: DELETE /saved-items/:listingId
export async function removeSavedItem(userId: string, listingId: string): Promise<void> {
    await delay(200)
    bucket(userId).delete(listingId)
    savedAt.delete(`${userId}:${listingId}`)
}
