'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type {
    AuthUser,
    ListingRef,
    SellerContact,
    ListingStatus,
    MarkUnavailableReason,
    ReportReason,
} from './types'
import { CALLBACK_COOLDOWN_MS, ACTIVE_STATUSES } from './types'
import {
    CallBackError,
    ReportError,
    createCallBackRequest,
    getRevealCountToday,
    revealContact as apiRevealContact,
    markListingUnavailable,
    markListingAvailable,
    submitReport as apiSubmitReport,
    hasReported as apiHasReported,
} from './mock-api'
import { findOrCreateConversation } from './conversations'

interface ListingContactValue {
    // auth
    user: AuthUser | null
    isAuthed: boolean

    // listing / seller
    listing: ListingRef
    seller: SellerContact

    // contact reveal
    revealed: boolean
    revealing: boolean
    revealCountToday: number | null
    revealContact: () => void

    // action sheet (call / whatsapp / message)
    actionSheetOpen: boolean
    openActionSheet: () => void
    closeActionSheet: () => void
    telHref: string
    whatsappHref: string
    /** Find-or-create the conversation for this listing and open the chat. */
    startChat: () => void
    onSendMessage: () => void

    // call-back request
    callBackModalOpen: boolean
    openCallBackModal: () => void
    closeCallBackModal: () => void
    submitCallBack: (input: { phone: string; note?: string }) => Promise<boolean>
    submitting: boolean
    cooldownRemainingMs: number
    lastRequestAt: number | null

    // login gate
    loginGateOpen: boolean
    loginGateReason: string
    closeLoginGate: () => void
    confirmLogin: () => Promise<void>

    // ownership & listing status
    isOwner: boolean
    status: ListingStatus
    listingActive: boolean
    /** Contact actions are disabled for viewers once a listing is inactive. */
    contactDisabled: boolean

    // mark unavailable / available (owner only)
    markModalOpen: boolean
    openMarkModal: () => void
    closeMarkModal: () => void
    markUnavailable: (reason?: MarkUnavailableReason) => Promise<void>
    markAvailable: () => Promise<void>
    statusUpdating: boolean

    // report abuse (viewers only)
    reportModalOpen: boolean
    openReportModal: () => void
    closeReportModal: () => void
    submitReport: (input: { reason: ReportReason; details?: string }) => Promise<boolean>
    reporting: boolean
    alreadyReported: boolean
}

const Ctx = createContext<ListingContactValue | null>(null)

export function useListingContact(): ListingContactValue {
    const v = useContext(Ctx)
    if (!v) throw new Error('useListingContact must be used within <ListingContactProvider>')
    return v
}

// tel:/wa.me links want digits only, in international form.
function toInternational(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('233')) return `+${digits}`
    if (digits.startsWith('0')) return `+233${digits.slice(1)}`
    return `+${digits}`
}

interface ProviderProps {
    listing: ListingRef
    seller: SellerContact
    /** Initial listing status (defaults to active). */
    initialStatus?: ListingStatus
    /** Pre-authenticated buyer, if any. Null = logged out (triggers login gate). */
    initialUser?: AuthUser | null
    /**
     * Real auth hook-in. Return the signed-in user, or null if the user
     * cancelled. Defaults to a mock sign-in for the prototype.
     */
    onSignIn?: () => Promise<AuthUser | null>
    /**
     * Override chat navigation. Receives the conversation id and the default
     * chat URL. Defaults to router.push(url).
     */
    onOpenChat?: (conversationId: string, url: string) => void
    children: React.ReactNode
}

const MOCK_BUYER: AuthUser = {
    id: 'buyer_demo',
    name: 'Demo Buyer',
    phone: '024 000 1234',
}

export function ListingContactProvider({
    listing,
    seller,
    initialStatus = 'active',
    initialUser = null,
    onSignIn,
    onOpenChat,
    children,
}: ProviderProps) {
    const router = useRouter()
    const [user, setUser] = useState<AuthUser | null>(initialUser)

    const [status, setStatus] = useState<ListingStatus>(initialStatus)
    const [statusUpdating, setStatusUpdating] = useState(false)
    const [markModalOpen, setMarkModalOpen] = useState(false)

    const [reportModalOpen, setReportModalOpen] = useState(false)
    const [reporting, setReporting] = useState(false)
    const [alreadyReported, setAlreadyReported] = useState(false)

    const isOwner = !!user && user.id === seller.id
    const listingActive = ACTIVE_STATUSES.includes(status)
    const contactDisabled = !listingActive && !isOwner

    const [revealed, setRevealed] = useState(false)
    const [revealing, setRevealing] = useState(false)
    const [revealCountToday, setRevealCountToday] = useState<number | null>(null)

    const [actionSheetOpen, setActionSheetOpen] = useState(false)
    const [callBackModalOpen, setCallBackModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [lastRequestAt, setLastRequestAt] = useState<number | null>(null)

    const [loginGateOpen, setLoginGateOpen] = useState(false)
    const [loginGateReason, setLoginGateReason] = useState('')
    const pendingAction = useRef<(() => void) | null>(null)

    // Tick so the cooldown label / disabled state updates without a manual refresh.
    const [, forceTick] = useState(0)
    useEffect(() => {
        if (lastRequestAt == null) return
        const iv = setInterval(() => forceTick((n) => n + 1), 30_000)
        return () => clearInterval(iv)
    }, [lastRequestAt])

    const cooldownRemainingMs = useMemo(() => {
        if (lastRequestAt == null) return 0
        return Math.max(0, CALLBACK_COOLDOWN_MS - (Date.now() - lastRequestAt))
    }, [lastRequestAt])

    // Load social-proof reveal count.
    useEffect(() => {
        let alive = true
        getRevealCountToday(listing.id).then((n) => alive && setRevealCountToday(n))
        return () => {
            alive = false
        }
    }, [listing.id])

    // --- auth gate -----------------------------------------------------------
    const requireAuth = useCallback(
        (action: () => void, reason: string) => {
            if (user) {
                action()
                return
            }
            pendingAction.current = action
            setLoginGateReason(reason)
            setLoginGateOpen(true)
        },
        [user]
    )

    const confirmLogin = useCallback(async () => {
        const signedIn = onSignIn ? await onSignIn() : MOCK_BUYER
        if (!signedIn) return // user cancelled
        setUser(signedIn)
        setLoginGateOpen(false)
        const action = pendingAction.current
        pendingAction.current = null
        // Defer so the freshly-set user is visible to the resumed action.
        setTimeout(() => action?.(), 0)
    }, [onSignIn])

    const closeLoginGate = useCallback(() => {
        pendingAction.current = null
        setLoginGateOpen(false)
    }, [])

    // --- reveal --------------------------------------------------------------
    const doReveal = useCallback(async () => {
        setRevealing(true)
        try {
            const current = user ?? MOCK_BUYER
            await apiRevealContact({
                listingId: listing.id,
                viewerId: current.id,
                sellerId: seller.id,
            })
            setRevealed(true)
            setRevealCountToday((prev) => (prev ?? 7) + 1)
            setActionSheetOpen(true)
        } catch {
            toast.error('Could not load contact details. Try again.')
        } finally {
            setRevealing(false)
        }
    }, [user, listing.id, seller.id])

    const revealContact = useCallback(() => {
        if (contactDisabled) {
            toast.error('This ad is no longer available.')
            return
        }
        if (revealed) {
            setActionSheetOpen(true)
            return
        }
        requireAuth(() => void doReveal(), 'Sign in to see contact details')
    }, [contactDisabled, revealed, requireAuth, doReveal])

    // --- call-back -----------------------------------------------------------
    const openCallBackModal = useCallback(() => {
        if (contactDisabled) {
            toast.error('This ad is no longer available.')
            return
        }
        requireAuth(() => setCallBackModalOpen(true), 'Sign in to request a call back')
    }, [contactDisabled, requireAuth])

    const submitCallBack = useCallback(
        async ({ phone, note }: { phone: string; note?: string }): Promise<boolean> => {
            const current = user ?? MOCK_BUYER
            setSubmitting(true)
            try {
                await createCallBackRequest({
                    listingId: listing.id,
                    listingTitle: listing.title,
                    listingThumbnail: listing.thumbnail,
                    buyerId: current.id,
                    buyerName: current.name,
                    buyerAvatarUrl: current.avatarUrl,
                    sellerId: seller.id,
                    buyerPhone: phone,
                    note,
                    sellerAllowsCallBacks: seller.allowCallBacks,
                })
                setLastRequestAt(Date.now())
                setCallBackModalOpen(false)
                toast.success('Request sent', {
                    description: `${seller.name} will call you back soon.`,
                })
                return true
            } catch (err) {
                if (err instanceof CallBackError) {
                    if (err.code === 'RATE_LIMITED' && err.retryAfterMs) {
                        setLastRequestAt(Date.now() - (CALLBACK_COOLDOWN_MS - err.retryAfterMs))
                    }
                    toast.error(err.message)
                } else {
                    toast.error('Could not send request. Try again.')
                }
                return false
            } finally {
                setSubmitting(false)
            }
        },
        [user, listing, seller]
    )

    // --- listing status (owner) ---------------------------------------------
    const markUnavailable = useCallback(
        async (reason?: MarkUnavailableReason) => {
            if (!isOwner || !user) return
            setStatusUpdating(true)
            try {
                const { status: next } = await markListingUnavailable({
                    listingId: listing.id,
                    ownerId: user.id,
                    reason,
                })
                setStatus(next)
                setMarkModalOpen(false)
                toast.success(next === 'sold' ? 'Marked as sold' : 'Ad marked unavailable')
            } catch {
                toast.error('Could not update the ad. Try again.')
            } finally {
                setStatusUpdating(false)
            }
        },
        [isOwner, user, listing.id]
    )

    const markAvailable = useCallback(async () => {
        if (!isOwner || !user) return
        setStatusUpdating(true)
        try {
            const { status: next } = await markListingAvailable({
                listingId: listing.id,
                ownerId: user.id,
            })
            setStatus(next)
            toast.success('Ad is live again')
        } catch {
            toast.error('Could not relist the ad. Try again.')
        } finally {
            setStatusUpdating(false)
        }
    }, [isOwner, user, listing.id])

    // --- report abuse (viewers) ---------------------------------------------
    // Track whether the current user has already reported this listing.
    useEffect(() => {
        if (!user) {
            setAlreadyReported(false)
            return
        }
        let alive = true
        apiHasReported(listing.id, user.id).then((v) => alive && setAlreadyReported(v))
        return () => {
            alive = false
        }
    }, [user, listing.id])

    const openReportModal = useCallback(() => {
        requireAuth(() => setReportModalOpen(true), 'Sign in to report this ad')
    }, [requireAuth])

    const submitReport = useCallback(
        async ({ reason, details }: { reason: ReportReason; details?: string }): Promise<boolean> => {
            const current = user ?? MOCK_BUYER
            setReporting(true)
            try {
                const { autoFlagged } = await apiSubmitReport({
                    listingId: listing.id,
                    reportedBy: current.id,
                    reason,
                    details,
                })
                setAlreadyReported(true)
                setReportModalOpen(false)
                if (autoFlagged) setStatus('under_review')
                toast.success('Thanks for reporting', {
                    description: 'Our team will review this ad.',
                })
                return true
            } catch (err) {
                if (err instanceof ReportError) {
                    setAlreadyReported(true)
                    toast.error(err.message)
                } else {
                    toast.error('Could not submit report. Try again.')
                }
                return false
            } finally {
                setReporting(false)
            }
        },
        [user, listing.id]
    )

    // --- deep links ----------------------------------------------------------
    const telHref = useMemo(() => `tel:${toInternational(seller.phone)}`, [seller.phone])
    const whatsappHref = useMemo(() => {
        const num = toInternational(seller.whatsappNumber || seller.phone).replace('+', '')
        const msg = `Hi, I'm interested in your "${listing.title}" on Arhms`
        return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
    }, [seller.whatsappNumber, seller.phone, listing.title])

    // --- chat entry point ----------------------------------------------------
    const navigateToChat = useCallback(async () => {
        const buyer = user ?? MOCK_BUYER
        const { conversation } = await findOrCreateConversation({
            listingId: listing.id,
            buyerId: buyer.id,
            sellerId: seller.id,
        })
        // Starter template the buyer can edit, send, or clear.
        const starter = `Hi, is "${listing.title}" still available?`
        const qs = new URLSearchParams({
            title: listing.title,
            sellerId: seller.id,
            sellerName: seller.name,
            buyerId: buyer.id,
            starter,
        })
        if (listing.thumbnail) qs.set('image', listing.thumbnail)
        if (listing.price != null) qs.set('price', String(Math.round(listing.price * 100)))
        const url = `/marketplace-domain/messages/demo/${conversation.id}?${qs.toString()}`
        if (onOpenChat) onOpenChat(conversation.id, url)
        else router.push(url)
    }, [user, listing, seller, onOpenChat, router])

    const startChat = useCallback(() => {
        setActionSheetOpen(false)
        requireAuth(() => void navigateToChat(), 'Sign in to message the seller')
    }, [requireAuth, navigateToChat])

    const value: ListingContactValue = {
        user,
        isAuthed: !!user,
        listing,
        seller,
        revealed,
        revealing,
        revealCountToday,
        revealContact,
        actionSheetOpen,
        openActionSheet: () => setActionSheetOpen(true),
        closeActionSheet: () => setActionSheetOpen(false),
        telHref,
        whatsappHref,
        startChat,
        onSendMessage: startChat,
        callBackModalOpen,
        openCallBackModal,
        closeCallBackModal: () => setCallBackModalOpen(false),
        submitCallBack,
        submitting,
        cooldownRemainingMs,
        lastRequestAt,
        loginGateOpen,
        loginGateReason,
        closeLoginGate,
        confirmLogin,
        isOwner,
        status,
        listingActive,
        contactDisabled,
        markModalOpen,
        openMarkModal: () => setMarkModalOpen(true),
        closeMarkModal: () => setMarkModalOpen(false),
        markUnavailable,
        markAvailable,
        statusUpdating,
        reportModalOpen,
        openReportModal,
        closeReportModal: () => setReportModalOpen(false),
        submitReport,
        reporting,
        alreadyReported,
    }

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
