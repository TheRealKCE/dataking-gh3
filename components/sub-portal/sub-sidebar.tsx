'use client'

/**
 * De-branded Sub-Agent Portal sidebar.
 *
 * Self-contained (does NOT use the main app's UI context or ARHMS chrome). It
 * shows the upline shop's brand (logo/name/colour) and only sub-relevant nav.
 * Responsive: fixed on desktop, slide-in with a hamburger on mobile.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

const NAV = [
  { href: '/dashboard/sub', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/sub/orders', label: 'My Orders', icon: ShoppingCart },
  { href: '/dashboard/sub/shop', label: 'My Shop', icon: Store },
  { href: '/dashboard/sub/profile', label: 'Profile', icon: User },
]

export function SubSidebar() {
  const pathname = usePathname()
  const { dbUser, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [brand, setBrand] = useState<BrandConfig | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/sub/data')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.brandConfig) setBrand(d.brandConfig)
      })
      .catch(() => {})
  }, [])

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const brandColor = brand?.brandColor || '#2563eb'
  const shopName = brand?.shopName || brand?.appName || 'My Portal'
  const initial = shopName.charAt(0).toUpperCase()

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname?.startsWith(item.href)

  const NavList = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {NAV.map((item) => {
        const active = isActive(item)
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={
              active
                ? { backgroundColor: `${brandColor}15`, color: brandColor }
                : { color: '#374151' }
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </Link>
        )
      })}

      {brand?.uplineShopSlug && (
        <a
          href={`/shop/${brand.uplineShopSlug}`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ExternalLink className="w-5 h-5 flex-shrink-0" />
          Visit Store
        </a>
      )}
    </nav>
  )

  const Header = () => (
    <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-100">
      {brand?.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo} alt={shopName} className="h-9 w-9 rounded-lg object-contain" />
      ) : (
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: brandColor }}
        >
          {initial}
        </div>
      )}
      <span className="font-bold text-gray-900 truncate">{shopName}</span>
    </div>
  )

  const Footer = () => (
    <div className="p-3 border-t border-gray-100">
      {dbUser && (
        <div className="px-3 py-2 mb-1 text-sm">
          <p className="font-semibold text-gray-900 truncate">
            {dbUser.first_name} {dbUser.last_name}
          </p>
          <p className="text-xs text-gray-500">Sub-Agent</p>
        </div>
      )}
      <button
        onClick={signOut}
        className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-5 h-5 flex-shrink-0" />
        Sign Out
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-4">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-gray-700">
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-gray-900 truncate">{shopName}</span>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar (fixed on desktop, slide-in on mobile) */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="lg:hidden flex justify-end p-2">
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <Header />
        <NavList />
        <Footer />
      </aside>
    </>
  )
}
