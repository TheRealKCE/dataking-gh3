// -----------------------------------------------------------------------------
// MOCK BACKEND
// -----------------------------------------------------------------------------
// A self-contained in-memory stand-in for the REST endpoints described in the
// spec. Every function returns a Promise so swapping to `fetch()` later is a
// drop-in change. Search for "// BACKEND:" markers for the real endpoint each
// mock maps to.
// -----------------------------------------------------------------------------

import {
    CallBackRequest,
    CallBackStatus,
    ContactReveal,
    MAX_CALLBACKS_PER_DAY,
    CALLBACK_COOLDOWN_MS,
    ListingStatus,
    MarkUnavailableReason,
    Report,
    ReportReason,
    REPORT_AUTOHIDE_THRESHOLD,
} from './types'

let seq = 0
const id = (p: string) => `${p}_${Date.now().toString(36)}_${seq++}`
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms))

// In-memory stores (reset on reload — a real backend persists these).
const reveals: ContactReveal[] = []
const requests: CallBackRequest[] = seedRequests()
const reports: Report[] = []
const listingStatus = new Map<string, ListingStatus>()

const startOfToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

// --- Contact reveals ---------------------------------------------------------

// BACKEND: POST /contact-reveals  → logs a reveal, returns today's total.
export async function revealContact(params: {
    listingId: string
    viewerId: string
    sellerId: string
}): Promise<{ reveal: ContactReveal; countToday: number }> {
    await delay(250)
    const reveal: ContactReveal = {
        id: id('rev'),
        listingId: params.listingId,
        viewerId: params.viewerId,
        sellerId: params.sellerId,
        revealedAt: new Date().toISOString(),
    }
    reveals.push(reveal)
    return { reveal, countToday: countRevealsToday(params.listingId) }
}

// BACKEND: GET /contact-reveals?listingId=&range=today → analytics count.
export async function getRevealCountToday(listingId: string): Promise<number> {
    await delay(120)
    // Seed some social-proof baseline so the UI isn't empty on first load.
    return 7 + countRevealsToday(listingId)
}

function countRevealsToday(listingId: string): number {
    const since = startOfToday()
    return reveals.filter(
        (r) => r.listingId === listingId && new Date(r.revealedAt).getTime() >= since
    ).length
}

// --- Call-back requests ------------------------------------------------------

export class CallBackError extends Error {
    constructor(
        public code: 'RATE_LIMITED' | 'DAILY_CAP' | 'DISABLED',
        message: string,
        public retryAfterMs?: number
    ) {
        super(message)
        this.name = 'CallBackError'
    }
}

// BACKEND: POST /call-back-requests → validates limits, persists, pushes to seller.
export async function createCallBackRequest(params: {
    listingId: string
    listingTitle: string
    listingThumbnail?: string
    buyerId: string
    buyerName: string
    buyerAvatarUrl?: string
    sellerId: string
    buyerPhone: string
    note?: string
    sellerAllowsCallBacks: boolean
}): Promise<CallBackRequest> {
    await delay(500)

    if (!params.sellerAllowsCallBacks) {
        throw new CallBackError('DISABLED', 'This seller is not accepting call-back requests.')
    }

    // Rate limit: 1 request per seller per hour, per buyer.
    const recent = requests
        .filter(
            (r) =>
                r.buyerId === params.buyerId &&
                r.sellerId === params.sellerId &&
                r.listingId === params.listingId
        )
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]

    if (recent) {
        const elapsed = Date.now() - new Date(recent.createdAt).getTime()
        if (elapsed < CALLBACK_COOLDOWN_MS) {
            throw new CallBackError(
                'RATE_LIMITED',
                'You already sent a request recently.',
                CALLBACK_COOLDOWN_MS - elapsed
            )
        }
    }

    // Daily cap: max N requests per buyer per day (across all sellers).
    const today = requests.filter(
        (r) => r.buyerId === params.buyerId && +new Date(r.createdAt) >= startOfToday()
    ).length
    if (today >= MAX_CALLBACKS_PER_DAY) {
        throw new CallBackError('DAILY_CAP', `Daily limit of ${MAX_CALLBACKS_PER_DAY} requests reached.`)
    }

    const req: CallBackRequest = {
        id: id('cbr'),
        listingId: params.listingId,
        listingTitle: params.listingTitle,
        listingThumbnail: params.listingThumbnail,
        buyerId: params.buyerId,
        buyerName: params.buyerName,
        buyerAvatarUrl: params.buyerAvatarUrl,
        sellerId: params.sellerId,
        buyerPhone: params.buyerPhone,
        note: params.note?.trim() || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
    }
    requests.unshift(req)

    // BACKEND: trigger push (FCM/OneSignal) to seller's device here.
    void sendSellerPush(req)

    return req
}

// BACKEND: GET /call-back-requests?sellerId= → seller inbox.
export async function getCallBackRequests(sellerId: string): Promise<CallBackRequest[]> {
    await delay(300)
    return requests
        .filter((r) => r.sellerId === sellerId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

// BACKEND: PATCH /call-back-requests/:id → update status.
export async function updateCallBackStatus(
    requestId: string,
    status: CallBackStatus
): Promise<CallBackRequest | null> {
    await delay(200)
    const req = requests.find((r) => r.id === requestId)
    if (!req) return null
    req.status = status
    if (status === 'called') req.respondedAt = new Date().toISOString()
    return req
}

// BACKEND: push provider integration (Firebase Cloud Messaging / OneSignal).
async function sendSellerPush(req: CallBackRequest): Promise<void> {
    // eslint-disable-next-line no-console
    console.info('[push→seller]', req.sellerId, `New call-back from ${req.buyerName}`)
}

// --- Listing status (owner-only) ---------------------------------------------

// BACKEND: POST /listings/:id/mark-unavailable  (owner-only, auth-protected)
export async function markListingUnavailable(params: {
    listingId: string
    ownerId: string
    reason?: MarkUnavailableReason
}): Promise<{ status: ListingStatus }> {
    await delay(300)
    // Selling → "sold", everything else → "unavailable".
    const status: ListingStatus = params.reason === 'sold' ? 'sold' : 'unavailable'
    listingStatus.set(params.listingId, status)
    return { status }
}

// BACKEND: POST /listings/:id/mark-available  (owner-only — relist)
export async function markListingAvailable(params: {
    listingId: string
    ownerId: string
}): Promise<{ status: ListingStatus }> {
    await delay(300)
    listingStatus.set(params.listingId, 'active')
    return { status: 'active' }
}

// --- Reports -----------------------------------------------------------------

export class ReportError extends Error {
    constructor(public code: 'ALREADY_REPORTED', message: string) {
        super(message)
        this.name = 'ReportError'
    }
}

// BACKEND: POST /listings/:id/report  (rate-limited: 1 per user per listing)
export async function submitReport(params: {
    listingId: string
    reportedBy: string
    reason: ReportReason
    details?: string
}): Promise<{ report: Report; autoFlagged: boolean }> {
    await delay(450)

    const already = reports.some(
        (r) => r.listingId === params.listingId && r.reportedBy === params.reportedBy
    )
    if (already) {
        throw new ReportError('ALREADY_REPORTED', 'You have already reported this ad.')
    }

    const report: Report = {
        id: id('rep'),
        listingId: params.listingId,
        reportedBy: params.reportedBy,
        reason: params.reason,
        details: params.details?.trim() || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
    }
    reports.push(report)

    // Threshold → auto-flag for priority moderation / temporary auto-hide.
    const total = reports.filter((r) => r.listingId === params.listingId).length
    const autoFlagged = total >= REPORT_AUTOHIDE_THRESHOLD
    if (autoFlagged) {
        listingStatus.set(params.listingId, 'under_review')
        // BACKEND: notify moderation queue with priority flag here.
    }

    return { report, autoFlagged }
}

// BACKEND: GET /listings/:id/reports/mine → has the current user reported?
export async function hasReported(listingId: string, userId: string): Promise<boolean> {
    await delay(80)
    return reports.some((r) => r.listingId === listingId && r.reportedBy === userId)
}

// --- Seed data ---------------------------------------------------------------

function seedRequests(): CallBackRequest[] {
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
    return [
        {
            id: 'cbr_seed_1',
            listingId: 'lst_kia_cerato_2025',
            listingTitle: 'Kia Cerato Automatic 2025 Red',
            buyerId: 'buyer_ama',
            buyerName: 'Ama Owusu',
            sellerId: 'sel_kwasi_ben',
            buyerPhone: '024 556 7788',
            note: 'Is this still available? Can I come see it this evening?',
            status: 'pending',
            createdAt: hoursAgo(0.5),
        },
        {
            id: 'cbr_seed_2',
            listingId: 'lst_kia_cerato_2025',
            listingTitle: 'Kia Cerato Automatic 2025 Red',
            buyerId: 'buyer_yaw',
            buyerName: 'Yaw Mensah',
            sellerId: 'sel_kwasi_ben',
            buyerPhone: '020 998 1122',
            note: 'What is your last price?',
            status: 'called',
            createdAt: hoursAgo(6),
            respondedAt: hoursAgo(5),
        },
    ]
}
