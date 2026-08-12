'use client'

import { useEffect, useState } from 'react'
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
 * bar matches the sidebar and header chrome the user is already looking at.
 * Text on the pill is a literal white in both themes: every role surface here
 * is a saturated mid-to-dark gradient, so white is the right pairing whether
 * the app is in light or dark mode.
 *
 * The active tab expands into a white chip carrying a toggle for that section's
 * sub-pages.
 */

/**
 * Nav chrome per role. The gradients mirror `roleConfig[role].gradient` except
 * for customer: that role's chrome is gold, which is far too light to carry
 * white text, so the customer bar runs on teal instead. The override lives here
 * rather than in lib/roles.ts on purpose — it restyles the nav, not the role.
 *
 * `ink` is the active chip's text colour, taken from the gradient's dark stop.
 * It is applied inline because an arbitrary text-[#hex] class would need a
 * tailwind.config.ts safelist entry to survive the production purge.
 */
const NAV_THEME: Record<UserRole, { gradient: string; ink: string }> = {
    'admin': { gradient: 'from-rose-600 via-rose-700 to-red-900', ink: '#9F1239' },
    'sub-admin': { gradient: 'from-emerald-500 via-teal-600 to-teal-800', ink: '#0F766E' },
    'agent': { gradient: 'from-[#123A63] via-[#0E3255] to-[#0A2A4A]', ink: '#0A2A4A' },
    'dealer': { gradient: 'from-purple-600 via-violet-700 to-indigo-800', ink: '#5B21B6' },
    'customer': { gradient: 'from-[#1E6E67] via-[#2F8A80] to-[#5FAAA1]', ink: '#1E6E67' },
}

/** Depth shared by the pill and the hamburger: rim light plus a cast shadow. */
const SURFACE_DEPTH =
    'ring-1 ring-inset ring-white/25 shadow-[0_16px_34px_-14px_rgba(0,0,0,0.55)]'

/**
 * The mirrored finish. A bright specular bloom off the top-left plus a darker
 * pool along the bottom edge reads as a convex, polished surface — the same
 * trick a glass button uses. Both layers are decorative and inert; siblings
 * that should sit above them need their own `relative`, since an absolutely
 * positioned element otherwise paints over static content.
 */
function Sheen() {
    return (
        <>
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(125%_170%_at_12%_-45%,rgba(255,255,255,0.42),rgba(255,255,255,0.12)_36%,rgba(255,255,255,0)_62%)]"
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

            <div className="relative mx-auto max-w-md">
                {/* Floating refresh button */}
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="absolute -top-16 right-2 h-10 w-10 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shadow-soft text-slate-600 dark:text-white active:scale-95 transition-transform"
                    aria-label="Refresh page"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>

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
                        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95 ${surface}`}
                    >
                        <Sheen />
                        <Menu className="relative h-7 w-7" />
                    </button>

                    <nav
                        className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-full p-2.5 ${surface}`}
                    >
                        <Sheen />
                        {tabs.map((tab) => {
                            const Icon = tab.icon

                            if (tab.id === activeId) {
                                const subItems = visibleSubItems(tab.id)
                                const expanded = openSection === tab.id
                                return (
                                    <div
                                        key={tab.id}
                                        className="relative flex min-w-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
                                        style={{ color: theme.ink }}
                                    >
                                        <Link
                                            href={tab.href}
                                            aria-current={pathname === tab.href ? 'page' : undefined}
                                            className="flex min-w-0 items-center gap-2"
                                        >
                                            <Icon className="h-6 w-6 shrink-0" />
                                            <span className="truncate text-base font-bold">{tab.label}</span>
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
                                                    ? <X className="h-5 w-5" />
                                                    : <Menu className="h-5 w-5" />}
                                            </button>
                                        )}
                                    </div>
                                )
                            }

                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 py-1 text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)] transition-transform active:scale-95"
                                >
                                    <Icon className="h-6 w-6" />
                                    <span className="truncate text-[11px] font-semibold leading-none">
                                        {tab.label}
                                    </span>
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            </div>
        </div>
    )
}
