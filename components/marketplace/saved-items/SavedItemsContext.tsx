'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react'
import { toast } from 'sonner'
import type { SaveUser } from './types'
import { addSavedItem, getSavedItems, removeSavedItem } from './mock-api'

interface SavedItemsValue {
    user: SaveUser | null
    isAuthed: boolean
    /** True if the given listing is saved by the current user. */
    isSaved: (listingId: string) => boolean
    /** Optimistic toggle. Opens the login gate first when logged out. */
    toggleSave: (listingId: string) => void
    /** Whether the current viewer owns a listing (used to hide the save icon). */
    isOwner: (ownerId?: string) => boolean

    // login gate
    loginGateOpen: boolean
    closeLoginGate: () => void
    confirmLogin: () => Promise<void>
}

const Ctx = createContext<SavedItemsValue | null>(null)

export function useSavedItems(): SavedItemsValue {
    const v = useContext(Ctx)
    if (!v) throw new Error('useSavedItems must be used within <SavedItemsProvider>')
    return v
}

interface ProviderProps {
    initialUser?: SaveUser | null
    initialSaved?: string[]
    /** Real auth hook-in; return the signed-in user or null if cancelled. */
    onSignIn?: () => Promise<SaveUser | null>
    children: React.ReactNode
}

const MOCK_USER: SaveUser = { id: 'buyer_demo', name: 'Demo Buyer' }

export function SavedItemsProvider({
    initialUser = null,
    initialSaved = [],
    onSignIn,
    children,
}: ProviderProps) {
    const [user, setUser] = useState<SaveUser | null>(initialUser)
    const [saved, setSaved] = useState<Set<string>>(() => new Set(initialSaved))

    const [loginGateOpen, setLoginGateOpen] = useState(false)
    const pendingListingId = useRef<string | null>(null)

    // Hydrate the saved set for the current user.
    useEffect(() => {
        if (!user) {
            setSaved(new Set())
            return
        }
        let alive = true
        getSavedItems(user.id).then((items) => {
            if (alive) setSaved(new Set(items.map((i) => i.listingId)))
        })
        return () => {
            alive = false
        }
    }, [user])

    const isSaved = useCallback((listingId: string) => saved.has(listingId), [saved])
    const isOwner = useCallback(
        (ownerId?: string) => !!ownerId && !!user && user.id === ownerId,
        [user]
    )

    // Optimistic persist with rollback on failure.
    const persist = useCallback(
        async (u: SaveUser, listingId: string, nextSaved: boolean) => {
            // optimistic
            setSaved((prev) => {
                const next = new Set(prev)
                if (nextSaved) next.add(listingId)
                else next.delete(listingId)
                return next
            })
            try {
                if (nextSaved) await addSavedItem(u.id, listingId)
                else await removeSavedItem(u.id, listingId)
            } catch {
                // rollback
                setSaved((prev) => {
                    const next = new Set(prev)
                    if (nextSaved) next.delete(listingId)
                    else next.add(listingId)
                    return next
                })
                toast.error('Could not update your saved list. Try again.')
            }
        },
        []
    )

    const doToggle = useCallback(
        (u: SaveUser, listingId: string) => {
            const willSave = !saved.has(listingId)
            void persist(u, listingId, willSave)

            if (willSave) {
                toast.success('Saved to your list', {
                    action: {
                        label: 'Undo',
                        onClick: () => void persist(u, listingId, false),
                    },
                })
            } else {
                toast('Removed from saved')
            }
        },
        [saved, persist]
    )

    const toggleSave = useCallback(
        (listingId: string) => {
            if (user) {
                doToggle(user, listingId)
                return
            }
            pendingListingId.current = listingId
            setLoginGateOpen(true)
        },
        [user, doToggle]
    )

    const confirmLogin = useCallback(async () => {
        const signedIn = onSignIn ? await onSignIn() : MOCK_USER
        if (!signedIn) return
        setUser(signedIn)
        setLoginGateOpen(false)
        const listingId = pendingListingId.current
        pendingListingId.current = null
        // Defer so the freshly-set user is used by the save.
        if (listingId) setTimeout(() => doToggle(signedIn, listingId), 0)
    }, [onSignIn, doToggle])

    const closeLoginGate = useCallback(() => {
        pendingListingId.current = null
        setLoginGateOpen(false)
    }, [])

    const value: SavedItemsValue = {
        user,
        isAuthed: !!user,
        isSaved,
        toggleSave,
        isOwner,
        loginGateOpen,
        closeLoginGate,
        confirmLogin,
    }

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
