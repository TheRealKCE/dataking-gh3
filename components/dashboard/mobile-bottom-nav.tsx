'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutGrid,
    Wallet,
    Package,
    ClipboardList,
    Store,
    RefreshCw,
    Menu,
    X,
    User,
    Activity,
    Bell,
    Crown,
    Download,
    Phone,
    Zap,
    Tag,
    BadgeCheck,
    MessageSquare,
} from 'lucide-react'
import { usePageAccess } from '@/hooks/use-page-access'
import { useUI } from '@/contexts/ui-context'
import { useAuth } from '@/contexts/auth-context'
import { type UserRole } from '@/lib/roles'
import { shopNavItems, type NavItem } from '@/lib/dashboard-nav'

/**
 * Floating pill bottom navigation for the mobile dashboard.
 *
 * The pill and the detached hamburger carry the signed-in role's colour, so the
 * bar matches the badge and chrome the user already sees elsewhere.
 *
 * The active tab expands into a white chip carrying a toggle for that section's
 * sub-pages.
 */

interface NavTheme {
    /** Tailwind gradient stops for the pill and hamburger. */
    gradient: string
    /** Active chip's text colour — it sits on white. */
    ink: string
    /** Inactive tab text colour — it sits on the gradient. */
    onSurface: string
    /**
     * False for surfaces light enough to need dark text. Gold is the only one:
     * white on #D4AF37 is about 2.1:1 and unreadable, so the customer bar is
     * the mirror image of the others — dark text, gentler specular bloom.
     */
    darkSurface: boolean
}

/**
 * Nav chrome per role, matching each role's badge colour in lib/roles.ts.
 *
 * Colours are applied inline rather than as text-[#hex] classes, which would
 * each need a tailwind.config.ts safelist entry to survive the production
 * purge. The gradient stops are class names, so they do need to be safelisted
 * when they are arbitrary hexes.
 */
const NAV_THEME: Record<UserRole, NavTheme> = {
    'admin': {
        gradient: 'from-rose-600 via-rose-700 to-red-900',
        ink: '#9F1239', onSurface: 'rgba(255,255,255,0.92)', darkSurface: true,
    },
    'sub-admin': {
        gradient: 'from-emerald-500 via-teal-600 to-teal-800',
        ink: '#0F766E', onSurface: 'rgba(255,255,255,0.92)', darkSurface: true,
    },
    'agent': {
        gradient: 'from-[#123A63] via-[#0E3255] to-[#0A2A4A]',
        ink: '#0A2A4A', onSurface: 'rgba(255,255,255,0.92)', darkSurface: true,
    },
    'dealer': {
        gradient: 'from-purple-600 via-violet-700 to-indigo-800',
        ink: '#5B21B6', onSurface: 'rgba(255,255,255,0.92)', darkSurface: true,
    },
    // Gold, to match the customer badge. #4A3810 on the mid-gold reads ~5:1.
    'customer': {
        gradient: 'from-brand-gold-light via-brand-gold to-brand-gold-dark',
        ink: '#7A5F22', onSurface: '#4A3810', darkSurface: false,
    },
}

/** Depth shared by the pill and the hamburger: rim light plus a cast shadow. */
const SURFACE_DEPTH =
    'ring-1 ring-inset ring-white/30 shadow-[0_18px_38px_-14px_rgba(0,0,0,0.55)]'

/**
 * The mirrored finish. A bright specular bloom off the top-left plus a darker
 * pool along the bottom edge reads as a convex, polished surface — the same
 * trick a glass button uses. Both layers are decorative and inert; siblings
 * that should sit above them need their own `relative`, since an absolutely
 * positioned element otherwise paints over static content.
 */
function Sheen({ dark }: { dark: boolean }) {
    return (
        <>
            <span
                aria-hidden="true"
                className={
                    dark
                        ? 'pointer-events-none absolute inset-0 bg-[radial-gradient(125%_170%_at_12%_-45%,rgba(255,255,255,0.42),rgba(255,255,255,0.12)_36%,rgba(255,255,255,0)_62%)]'
                        : 'pointer-events-none absolute inset-0 bg-[radial-gradient(125%_170%_at_12%_-45%,rgba(255,255,255,0.55),rgba(255,255,255,0.16)_34%,rgba(255,255,255,0)_60%)]'
                }
            />
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgba(0,0,0,0.20),rgba(0,0,0,0))]"
            />
        </>
    )
}

interface Tab extends NavItem {
    id: string
}

/** Home is the fallback tab, so it is matched last and by prefix. */
const TABS: Tab[] = [
    { id: 'home', label: 'Home', href: '/dashboard', icon: LayoutGrid },
    { id: 'wallet', label: 'Wallet', href: '/dashboard/wallet', icon: Wallet },
    { id: 'data', label: 'Data', href: '/dashboard/data-packages', icon: Package },
    { id: 'orders', label: 'Orders', href: '/dashboard/my-orders', icon: ClipboardList },
    { id: 'shop', label: 'Shop', href: '/dashboard/shop', icon: Store },
]

/** Sub-pages surfaced from the active tab. Mirrors the sidebar's link set. */
const SUB_ITEMS: Record<string, NavItem[]> = {
    home: [
        { href: '/dashboard/profile', label: 'Profile', icon: User },
        { href: '/dashboard/transactions', label: 'Transactions', icon: Activity },
        { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
        { href: '/dashboard/upgrade', label: 'Role Upgrade', icon: Crown },
        { href: '/dashboard/install', label: 'Download App', icon: Download },
    ],
    wallet: [
        { href: '/dashboard/wallet', label: 'Top Up', icon: Wallet },
        { href: '/dashboard/transactions', label: 'Transactions', icon: Activity },
    ],
    data: [
        { href: '/dashboard/data-packages', label: 'Data Packages', icon: Package },
        { href: '/dashboard/airtime', label: 'Buy Airtime', icon: Phone },
        { href: '/dashboard/data-packages?network=Special%20MTN%20Mashup', label: 'Special MTN Mashup', icon: Zap },
        { href: '/dashboard/data-packages?network=EXPRESS%20MTN', label: 'EXPRESS MTN', icon: Zap },
        { href: '/dashboard/results-checker', label: 'Results Checker', icon: Tag },
        { href: '/dashboard/afa-orders', label: 'AFA Application', icon: BadgeCheck },
    ],
    orders: [
        { href: '/dashboard/my-orders', label: 'My Orders', icon: ClipboardList },
        { href: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare },
    ],
    shop: shopNavItems,
}

export function MobileBottomNav() {
    const pathname = usePathname() ?? ''
    const { isPageAccessible } = usePageAccess()
    const { toggleSidebar } = useUI()
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const [openSection, setOpenSection] = useState<string | null>(null)

    // Same precedence the header uses: the admin flags outrank the stored role.
    const role: UserRole = isAdmin
        ? 'admin'
        : isSubAdmin
            ? 'sub-admin'
            : ((dbUser?.role as UserRole) || 'customer')
    const theme = NAV_THEME[role] ?? NAV_THEME['customer']
    const surface = `relative overflow-hidden bg-gradient-to-br ${theme.gradient} ${SURFACE_DEPTH}`

    // The sub-menu is anchored to the active chip, so a route change always
    // invalidates it.
    useEffect(() => {
        setOpenSection(null)
    }, [pathname])

    useEffect(() => {
        if (!openSection) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpenSection(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [openSection])

    const tabs = TABS.filter((tab) => isPageAccessible(tab.href))

    // Home owns every dashboard route no other tab claims — without the
    // fallback the chip (and with it the sub-menu) would vanish on pages like
    // /dashboard/profile, stranding the user on a route they reached from it.
    const activeId =
        tabs.find((tab) => tab.id !== 'home' && pathname.startsWith(tab.href))?.id ??
        (pathname.startsWith('/dashboard') ? 'home' : null)

    // Query-string entries share a base route, so gate on the path only.
    const visibleSubItems = (id: string) =>
        (SUB_ITEMS[id] ?? []).filter((item) => isPageAccessible(item.href.split('?')[0]))

    const openItems = openSection ? visibleSubItems(openSection) : []

    return (
        <>
        <RefreshFab />
        <div className="fixed inset-x-0 bottom-0 z-40 md:hidden px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {/* Backdrop — a tap anywhere outside dismisses the sub-menu. */}
            {openSection && (
                <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setOpenSection(null)}
                    className="fixed inset-0 z-0 cursor-default"
                />
            )}

            <div className="relative mx-auto max-w-lg">
                {/* Sub-menu for the active section */}
                {openSection && openItems.length > 0 && (
                    <div
                        id={`nav-submenu-${openSection}`}
                        className="absolute bottom-full left-0 right-0 mb-3 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 shadow-nav animate-in fade-in slide-in-from-bottom-2"
                    >
                        {openItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setOpenSection(null)}
                                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 active:bg-slate-100 dark:active:bg-zinc-800"
                                >
                                    <Icon className="h-4 w-4 shrink-0" style={{ color: theme.ink }} />
                                    <span className="truncate">{item.label}</span>
                                </Link>
                            )
                        })}
                    </div>
                )}

                <div className="relative flex items-center gap-3">
                    {/* Sidebar drawer trigger — the same panel the header button opens */}
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        aria-label="Open menu"
                        className={`flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${surface}`}
                        style={{ color: theme.onSurface }}
                    >
                        <Sheen dark={theme.darkSurface} />
                        <Menu className="relative h-8 w-8" />
                    </button>

                    <nav
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-full p-3 ${surface}`}
                    >
                        <Sheen dark={theme.darkSurface} />
                        {tabs.map((tab) => {
                            const Icon = tab.icon

                            if (tab.id === activeId) {
                                const subItems = visibleSubItems(tab.id)
                                const expanded = openSection === tab.id
                                return (
                                    <div
                                        key={tab.id}
                                        className="relative flex min-w-0 items-center gap-2.5 rounded-full bg-white px-5 py-3.5 shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
                                        style={{ color: theme.ink }}
                                    >
                                        <Link
                                            href={tab.href}
                                            aria-current={pathname === tab.href ? 'page' : undefined}
                                            className="flex min-w-0 items-center gap-2.5"
                                        >
                                            <Icon className="h-7 w-7 shrink-0" />
                                            <span className="truncate text-lg font-bold">{tab.label}</span>
                                        </Link>
                                        {subItems.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setOpenSection(expanded ? null : tab.id)}
                                                aria-expanded={expanded}
                                                aria-controls={`nav-submenu-${tab.id}`}
                                                aria-label={`${tab.label} sub-menu`}
                                                className="-mr-1 shrink-0 rounded-full p-0.5 active:scale-95"
                                            >
                                                {expanded
                                                    ? <X className="h-6 w-6" />
                                                    : <Menu className="h-6 w-6" />}
                                            </button>
                                        )}
                                    </div>
                                )
                            }

                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    className={`relative flex min-w-0 flex-1 flex-col items-center gap-2 py-1.5 transition-transform active:scale-95 ${
                                        theme.darkSurface ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]' : ''
                                    }`}
                                    style={{ color: theme.onSurface }}
                                >
                                    <Icon className="h-7 w-7" />
                                    <span className="truncate text-xs font-semibold leading-none">
                                        {tab.label}
                                    </span>
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            </div>
        </div>
        </>
    )
}

const FAB_SIZE = 48
const FAB_MARGIN = 12
const FAB_STORAGE_KEY = 'arhms:refresh-fab'
/** Below this much travel the gesture is a tap, not a drag. */
const DRAG_THRESHOLD = 6

/**
 * Draggable refresh button.
 *
 * Position is viewport-relative and therefore client-only — the button renders
 * nothing until the first effect resolves it, which also keeps it out of the
 * SSR markup and away from a hydration mismatch. On release it snaps to
 * whichever side it is nearest so it can never be abandoned mid-screen, and the
 * resting place is remembered across loads.
 */
function RefreshFab() {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
    const [dragging, setDragging] = useState(false)
    const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null)

    const clamp = (p: { x: number; y: number }) => ({
        x: Math.min(Math.max(p.x, FAB_MARGIN), window.innerWidth - FAB_SIZE - FAB_MARGIN),
        y: Math.min(Math.max(p.y, FAB_MARGIN), window.innerHeight - FAB_SIZE - FAB_MARGIN),
    })

    useEffect(() => {
        // Default rest position: right-hand side, clear of the nav pill.
        const fallback = {
            x: window.innerWidth - FAB_SIZE - FAB_MARGIN,
            y: window.innerHeight - FAB_SIZE - 150,
        }
        let start = fallback
        try {
            const raw = window.localStorage.getItem(FAB_STORAGE_KEY)
            const saved = raw ? JSON.parse(raw) : null
            if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') start = saved
        } catch {
            /* unreadable or disabled storage — fall back */
        }
        setPos(clamp(start))

        // A rotate or keyboard can shrink the viewport out from under a saved
        // position, stranding the button off-screen.
        const onResize = () => setPos((p) => (p ? clamp(p) : p))
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    if (!pos) return null

    const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, startX: e.clientX, startY: e.clientY, moved: false }
        setDragging(true)
    }

    const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        const d = drag.current
        if (!d) return
        if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) {
            d.moved = true
        }
        setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }))
    }

    const onPointerUp = () => {
        const d = drag.current
        drag.current = null
        setDragging(false)
        if (!d) return
        if (!d.moved) {
            window.location.reload()
            return
        }
        setPos((prev) => {
            if (!prev) return prev
            const toLeft = prev.x + FAB_SIZE / 2 < window.innerWidth / 2
            const snapped = {
                x: toLeft ? FAB_MARGIN : window.innerWidth - FAB_SIZE - FAB_MARGIN,
                y: prev.y,
            }
            try {
                window.localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(snapped))
            } catch {
                /* storage disabled — position simply will not persist */
            }
            return snapped
        })
    }

    return (
        <button
            type="button"
            aria-label="Refresh page"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ left: pos.x, top: pos.y, width: FAB_SIZE, height: FAB_SIZE, touchAction: 'none' }}
            className={`fixed z-50 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-soft dark:border-zinc-700 dark:bg-zinc-800 dark:text-white md:hidden ${
                dragging ? 'scale-110 cursor-grabbing shadow-nav' : 'transition-[left,top,transform] duration-200 active:scale-95'
            }`}
        >
            <RefreshCw className="h-5 w-5" />
        </button>
    )
}
