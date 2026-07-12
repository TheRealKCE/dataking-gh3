'use client'

/**
 * Sub-Agent Portal shell — teal header + sidebar chrome around every
 * /dashboard/sub/* page. De-branded (no ARHMS chrome). Follows the phone's
 * light/dark preference via next-themes `system`.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/auth-context'
import type { BrandConfig } from '@/lib/brand-context'
import {
  LayoutDashboard,
  ShoppingCart,
  Store,
  User,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

// Portal brand colour for the header + sidebar chrome.
const TEAL = '#1a6c78'
const TEAL_DARK = '#155963'

const NAV = [
  { href: '/dashboard/sub', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/sub/orders', label: 'My Orders', icon: ShoppingCart },
  { href: '/dashboard/sub/shop', label: 'My Shop', icon: Store },
  { href: '/dashboard/sub/profile', label: 'Profile', icon: User },
]

export function SubPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { dbUser, signOut } = useAuth()
  const { setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [brand, setBrand] = useState<BrandConfig | null>(null)

  // Follow the phone's light/dark setting inside the portal.
  useEffect(() => {
    setTheme('system')
  }, [setTheme])

  useEffect(() => {
    fetch('/api/dashboard/sub/data')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.brandConfig && setBrand(d.brandConfig))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const shopName = brand?.shopName || brand?.appName || 'My Portal'
  const initial = shopName.charAt(0).toUpperCase()
  const current = NAV.find((n) => (n.exact ? pathname === n.href : pathname?.startsWith(n.href)))
  const title = current?.label || 'Dashboard'

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-64 flex flex-col text-white transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: TEAL }}
      >
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-5" style={{ backgroundColor: TEAL_DARK }}>
          {brand?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo} alt={shopName} className="h-9 w-9 rounded-lg object-contain bg-white/90 p-0.5" />
          ) : (
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-white/15 font-bold">
              {initial}
            </div>
          )}
          <span className="font-bold truncate">{shopName}</span>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden ml-auto text-white/80"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  active ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </Link>
            )
          })}
          {brand?.uplineShopSlug && (
            <a
              href={`/shop/${brand.uplineShopSlug}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ExternalLink className="w-5 h-5 flex-shrink-0" />
              Visit Store
            </a>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/15">
          {dbUser && (
            <div className="px-3 py-2 mb-1">
              <p className="text-sm font-semibold truncate">
                {dbUser.first_name} {dbUser.last_name}
              </p>
              <p className="text-xs text-white/60">Sub-Agent</p>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/90 hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="fixed top-0 right-0 left-0 lg:left-64 z-30 h-14 flex items-center gap-3 px-4 text-white shadow-sm"
        style={{ backgroundColor: TEAL }}
      >
        <button
          onClick={() => setOpen(true)}
          className="lg:hidden text-white"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-semibold truncate">{title}</span>
        <span className="ml-auto text-sm text-white/80 truncate max-w-[45%]">
          {dbUser ? `${dbUser.first_name} ${dbUser.last_name}` : ''}
        </span>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="lg:pl-64 pt-14">
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  )
}
