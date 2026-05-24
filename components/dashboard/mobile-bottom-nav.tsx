'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type LucideIcon, LayoutDashboard, Wallet, Package, ShoppingCart, Store, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
    href: string
    label: string
    icon: LucideIcon
}

const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/wallet', label: 'Topup', icon: Wallet },
    { href: '/dashboard/data-packages', label: 'Buy Data', icon: Package },
    { href: '/dashboard/my-orders', label: 'Orders', icon: ShoppingCart },
    { href: '/dashboard/shop', label: 'My Shop', icon: Store },
]

export function MobileBottomNav() {
    const pathname = usePathname()

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard'
        if (href === '/dashboard/shop') return pathname?.startsWith('/dashboard/shop')
        return pathname?.startsWith(href)
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl md:hidden">
            <div className="grid grid-cols-6 gap-1 px-2 py-2 max-w-xl mx-auto">
                {navItems.map((item) => {
                    const active = isActive(item.href)
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors min-w-0',
                                active
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                            )}
                        >
                            <Icon className={cn('h-4 w-4 shrink-0', active && 'scale-110')} />
                            <span className="truncate leading-none">{item.label}</span>
                        </Link>
                    )
                })}

                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground min-w-0"
                    aria-label="Refresh page"
                    title="Refresh page"
                >
                    <RefreshCw className="h-4 w-4 shrink-0" />
                    <span className="truncate leading-none">Refresh</span>
                </button>
            </div>
        </div>
    )
}
