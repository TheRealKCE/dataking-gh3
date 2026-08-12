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
import { shopNavItems, type NavItem } from '@/lib/dashboard-nav'

/**
 * Floating pill bottom navigation for the mobile dashboard.
 *
 * The pill and the detached hamburger sit on the accent channel, so the bar
 * follows the per-shop brand colour and the sub-themes rather than carrying a
 * colour of its own. Two deliberate choices:
 *
 *  - The gradient is built from --accent-solid → --accent-strong rather than
 *    --gradient-accent. Every theme's --gradient-accent is a three-stop ramp
 *    ending on a cyan/teal third stop, which reads as a colour shift when it is
 *    stretched across something this wide. Solid → strong stays on one hue.
 *  - Text on the pill is a literal white, not hsl(var(--accent-contrast)).
 *    The pill surface is a saturated accent in both light and dark mode, but
 *    --accent-contrast flips to near-black in dark, which would be the wrong
 *    pairing here.
 *
 * The active tab expands into a white chip carrying a toggle for that section's
 * sub-pages.
 */

// The `shadow:` type hint is load-bearing — without it Tailwind reads a bare
// var() as a shadow *colour* and emits no geometry, so the glow disappears.
const ACCENT_SURFACE =
    'bg-[linear-gradient(135deg,hsl(var(--accent-solid)),hsl(var(--accent-strong)))] shadow-[shadow:var(--glow-accent)]'

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
    const [openSection, setOpenSection] = useState<string | null>(null)

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
                    className="absolute -top-14 right-2 h-10 w-10 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shadow-soft text-slate-600 dark:text-white active:scale-95 transition-transform"
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
                                    <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--accent-solid))]" />
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
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95 ${ACCENT_SURFACE}`}
                    >
                        <span className="flex h-full w-full items-center justify-center rounded-full bg-white/15">
                            <Menu className="h-6 w-6" />
                        </span>
                    </button>

                    <nav
                        className={`flex min-w-0 flex-1 items-center gap-1 rounded-full p-2 ${ACCENT_SURFACE}`}
                    >
                        {tabs.map((tab) => {
                            const Icon = tab.icon

                            if (tab.id === activeId) {
                                const subItems = visibleSubItems(tab.id)
                                const expanded = openSection === tab.id
                                return (
                                    <div
                                        key={tab.id}
                                        className="flex min-w-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[hsl(var(--accent-solid))]"
                                    >
                                        <Link
                                            href={tab.href}
                                            aria-current={pathname === tab.href ? 'page' : undefined}
                                            className="flex min-w-0 items-center gap-1.5"
                                        >
                                            <Icon className="h-5 w-5 shrink-0" />
                                            <span className="truncate text-sm font-bold">{tab.label}</span>
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
                                                    ? <X className="h-4 w-4" />
                                                    : <Menu className="h-4 w-4" />}
                                            </button>
                                        )}
                                    </div>
                                )
                            }

                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1 text-white/85 transition-transform active:scale-95"
                                >
                                    <Icon className="h-5 w-5" />
                                    <span className="truncate text-[10px] font-semibold leading-none">
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
