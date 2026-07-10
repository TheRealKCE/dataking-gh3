// -----------------------------------------------------------------------------
// MOCK BACKEND — conversations (chat entry point)
// -----------------------------------------------------------------------------
// Idempotent find-or-create for the buyer↔seller↔listing conversation. The id
// is derived deterministically from (listingId, buyerId, sellerId) so the same
// triple always resolves to the same thread — enforcing "one conversation per
// (listingId, buyerId, sellerId)" without a race, even across reloads.
//
// BACKEND: POST /conversations/find-or-create { listingId, buyerId, sellerId }
// -----------------------------------------------------------------------------

export interface Conversation {
    id: string
    listingId: string
    buyerId: string
    sellerId: string
    lastMessage: string
    lastMessageTime: string // ISO
    unreadCount: number
}

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))

// In-memory store (a real backend persists these).
const conversations = new Map<string, Conversation>()

// djb2 → base36: short, stable, URL-safe id for a given triple.
function hash(input: string): string {
    let h = 5381
    for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
    return h.toString(36)
}

export function conversationId(listingId: string, buyerId: string, sellerId: string): string {
    return `conv_${hash(`${listingId}|${buyerId}|${sellerId}`)}`
}

export async function findOrCreateConversation(params: {
    listingId: string
    buyerId: string
    sellerId: string
}): Promise<{ conversation: Conversation; created: boolean }> {
    await delay()
    const id = conversationId(params.listingId, params.buyerId, params.sellerId)

    const existing = conversations.get(id)
    if (existing) return { conversation: existing, created: false }

    const conversation: Conversation = {
        id,
        listingId: params.listingId,
        buyerId: params.buyerId,
        sellerId: params.sellerId,
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
    }
    conversations.set(id, conversation)

    // BACKEND: notify the seller (WebSocket/Firebase) so their Messages inbox
    // shows the new row with the listing thumbnail and the unread badge on the
    // bottom-nav "Messages" icon increments in real time.
    void notifySellerNewConversation(conversation)

    return { conversation, created: true }
}

async function notifySellerNewConversation(c: Conversation): Promise<void> {
    // eslint-disable-next-line no-console
    console.info('[realtime→seller] new conversation', c.id, 'listing', c.listingId)
}
