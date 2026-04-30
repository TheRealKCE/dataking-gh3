'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Wallet,
    User,
    MessageSquare,
    Bell,
    Send,
    Users,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    LogOut,
    Settings,
    Shield,
    Crown,
    Star,
    BadgeCheck,
    UserCircle,
    Plus,
    Activity,
    Banknote,
    Store,
    Tag,
    Phone
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { usePageAccess } from '@/hooks/use-page-access'
import { useAdminCounts } from '@/hooks/use-admin-counts'
import { roleConfig } from '@/lib/roles'
import { BrandLogo } from '@/components/BrandLogo'

const userNavItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/dashboard/upgrade', label: 'Membership', icon: Crown },
    { href: '/dashboard/data-packages', label: 'Data Packages', icon: Package },
    { href: '/dashboard/airtime', label: 'Buy Airtime', icon: Phone },
    { href: '/dashboard/my-orders', label: 'Orders', icon: ShoppingCart },
    { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
    { href: '/dashboard/transactions', label: 'Transactions', icon: Activity },
    { href: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/dashboard/profile', label: 'Profile', icon: User },
    { href: '/dashboard/afa-orders', label: 'AFA Application', icon: BadgeCheck },
]

const adminNavItems = [
    { href: '/admin', label: 'Dashboard', icon: Shield },
    { href: '/admin/top-up', label: 'Top-Up', icon: Wallet },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/fulfillment', label: 'Fulfillment', icon: Activity },
    { href: '/admin/datagod', label: 'DataGod Console', icon: Activity },
    { href: '/admin/airtime', label: 'Airtime', icon: Phone },
    { href: '/admin/shops', label: 'Shops', icon: Store },
    { href: '/admin/shops/withdrawals', label: 'Shop Withdrawals', icon: Banknote },
    { href: '/admin/afa-management', label: 'AFA Management', icon: BadgeCheck },
    { href: '/admin/memberships', label: 'Agent Members', icon: Crown },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/packages', label: 'Packages', icon: Package },
    { href: '/admin/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/admin/announcements', label: 'Announce', icon: Bell },
    { href: '/admin/sms-broadcast', label: 'SMS', icon: MessageSquare },
    { href: '/admin/finance', label: 'Finance', icon: Banknote },
    { href: '/admin/profits-history', label: 'Profits', icon: Wallet },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
]

const shopNavItems = [
    { href: '/dashboard/shop', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/shop/setup', label: 'Shop Setup', icon: Settings },
    { href: '/dashboard/shop/pricing', label: 'Pricing', icon: Tag },
    { href: '/dashboard/shop/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/dashboard/shop/withdraw', label: 'Withdraw', icon: Banknote },
]

export function DashboardSidebar() {
    const pathname = usePathname()
    const { dbUser, isAdmin, isSubAdmin, signOut } = useAuth()
    const { isInternalSidebarOpen, closeSidebar, isCollapsed, toggleCollapse } = useUI()
    const { isPageAccessible, loading: pageAccessLoading } = usePageAccess()
    const [walletBalance, setWalletBalance] = useState(0)
    const [communityLink, setCommunityLink] = useState('https://chat.whatsapp.com/GY8X8nUkNgYATUiOY5gXAb')
    const { counts: adminCounts } = useAdminCounts()

    // My Shop accordion — auto-expands on any /dashboard/shop route
    const isOnShopRoute = pathname?.startsWith('/dashboard/shop') ?? false
    const [shopGroupOpen, setShopGroupOpen] = useState(isOnShopRoute)
    useEffect(() => {
        if (isOnShopRoute) setShopGroupOpen(true)
    }, [isOnShopRoute])

    // Calculate days remaining for agents
    const calculateDaysRemaining = () => {
        if (!dbUser?.agent_expires_at || dbUser?.role !== 'agent') return null
        const now = new Date()
        const expiresAt = new Date(dbUser.agent_expires_at)
        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return daysRemaining > 0 ? daysRemaining : 0
    }

    const daysRemaining = calculateDaysRemaining()

    // Fetch wallet balance + subscribe to real-time updates
    useEffect(() => {
        if (!dbUser?.id) return

        // Initial fetch
        const fetchBalance = async () => {
            const { data } = await (supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', dbUser.id)
                .single() as any)
            if (data) setWalletBalance(data.balance || 0)
        }
        fetchBalance()

        // Real-time subscription — fires instantly on any balance change
        const channel = supabase
            .channel(`sidebar-wallet-${dbUser.id}`)
            .on(
                'postgres_changes' as any,
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'wallets',
                    filter: `user_id=eq.${dbUser.id}`,
                },
                (payload: any) => {
                    if (payload.new?.balance !== undefined) {
                        setWalletBalance(payload.new.balance)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [dbUser?.id])

    // Fetch community link
    useEffect(() => {
        fetch('/api/public/config').then(response => response.ok ? response.json() : null).then(data => {
            if (data?.whatsappCommunityLink) {
                setCommunityLink(data.whatsappCommunityLink)
            }
        }).catch(console.error)
    }, [])

    const isLinkActive = (href: string) => {
        if (href === '/dashboard' || href === '/admin' || href === '/dashboard/shop') {
            return pathname === href
        }
        return pathname?.startsWith(href)
    }

    // Get role config
    const userRole = isAdmin ? 'admin' : isSubAdmin ? 'sub-admin' : (dbUser?.role || 'customer') as keyof typeof roleConfig
    const currentRole = roleConfig[userRole] || roleConfig['customer']
    const RoleIcon = currentRole.icon

    return (
        <>
            {/* Mobile Overlay */}
            {isInternalSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-50 h-full flex flex-col transition-all duration-300 ease-in-out",
                    dbUser?.role === 'agent' ? "bg-gradient-to-b from-amber-50/90 to-yellow-100/50 dark:from-amber-950/40 dark:to-yellow-900/20 border-r border-r-amber-400/50 dark:border-r-amber-700/50 backdrop-blur-xl" : "bg-card/80 backdrop-blur-xl border-r border-border/50",
                    isCollapsed ? "w-20" : "w-[260px]",
                    "transform lg:transform-none shadow-premium",
                    isInternalSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo Header */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-border/50">
                    <Link href="/dashboard">
                        <BrandLogo collapsed={isCollapsed} />
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleCollapse}
                        className="hidden lg:flex text-muted-foreground hover:text-foreground hover:bg-secondary/10 w-8 h-8 rounded-full"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>
                </div>

                {/* Profile Widget - Refined & Professional */}
                {!isCollapsed && dbUser && (
                    <div className="mx-4 mt-6 p-5 rounded-2xl bg-secondary/5 border border-border/50 shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={cn(
                                "relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-white/10 overflow-hidden bg-gradient-to-br",
                                currentRole.gradient
                            )}>
                                <RoleIcon className="w-6 h-6 text-white" />
                                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">
                                    {dbUser?.first_name} {dbUser?.last_name}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span
                                        className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                                        style={{ backgroundColor: currentRole.bgColor, color: currentRole.textColor }}
                                    >
                                        {currentRole.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Wallet Balance - Clean Look */}
                        <div className="p-3 rounded-xl bg-background/50 border border-border/50 flex items-center justify-between">
                            <div>
                                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Balance</p>
                                <p className="text-lg font-black text-foreground tracking-tight">{formatCurrency(walletBalance)}</p>
                            </div>
                            {isPageAccessible('/dashboard/wallet') && (
                                <Link href="/dashboard/wallet">
                                    <Button size="icon" className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </Link>
                            )}
                        </div>

                        {/* Agent Subscription - Subtle Indicator */}
                        {dbUser?.role === 'agent' && daysRemaining !== null && (
                            <div className="mt-3 flex items-center justify-between text-[11px] font-medium px-1">
                                <span className="text-muted-foreground">Subscription</span>
                                <span className={cn(
                                    "font-bold",
                                    daysRemaining <= 3 ? "text-red-500" : "text-emerald-500"
                                )}>{daysRemaining}d left</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <nav className="px-3 py-6 space-y-1 overflow-y-auto flex-1 scrollbar-hide">
                    {!isCollapsed && (
                        <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-4 px-3">
                            Main Menu
                        </p>
                    )}

                    {userNavItems.map((item) => {
                        const isActive = isLinkActive(item.href)
                        return (
                            <Link key={item.href} href={item.href} onClick={() => {
                                if (window.innerWidth < 1024) closeSidebar()
                            }}>
                                <div className={cn(
                                    "nav-link",
                                    isActive && "nav-link-active shadow-sm shadow-primary/5",
                                    isCollapsed && "justify-center px-0"
                                )}>
                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                    {!isCollapsed && <span className="text-sm font-semibold tracking-tight">{item.label}</span>}
                                </div>
                            </Link>
                        )
                    })}

                    {/* My Shop Group — only shown when shop access is enabled */}
                    {isPageAccessible('/dashboard/shop') && (
                        <>
                            {!isCollapsed && (
                                <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mt-8 mb-4 px-3">
                                    My Shop
                                </p>
                            )}

                            {isCollapsed ? (
                                <Link href="/dashboard/shop" onClick={() => {
                                    if (window.innerWidth < 1024) closeSidebar()
                                }}>
                                    <div className={cn(
                                        "nav-link justify-center px-0",
                                        isOnShopRoute && "nav-link-active shadow-sm shadow-primary/5"
                                    )}>
                                        <Store className="w-5 h-5 flex-shrink-0" />
                                    </div>
                                </Link>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setShopGroupOpen(prev => !prev)}
                                        className={cn(
                                            "nav-link w-full",
                                            isOnShopRoute && "nav-link-active shadow-sm shadow-primary/5"
                                        )}
                                    >
                                        <Store className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-sm font-semibold tracking-tight flex-1 text-left">My Shop</span>
                                        <ChevronDown className={cn(
                                            "w-4 h-4 transition-transform duration-200",
                                            shopGroupOpen && "rotate-180"
                                        )} />
                                    </button>

                                    {shopGroupOpen && (
                                        <div className="ml-4 pl-4 border-l border-border/30 space-y-0.5 mt-0.5">
                                            {shopNavItems.map((item) => {
                                                const isActive = isLinkActive(item.href)
                                                return (
                                                    <Link key={item.href} href={item.href} onClick={() => {
                                                        if (window.innerWidth < 1024) closeSidebar()
                                                    }}>
                                                        <div className={cn(
                                                            "nav-link",
                                                            isActive && "nav-link-active shadow-sm shadow-primary/5"
                                                        )}>
                                                            <item.icon className="w-4 h-4 flex-shrink-0" />
                                                            <span className="text-sm font-semibold tracking-tight">{item.label}</span>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* Admin Section - If applicable */}
                    {(isAdmin || isSubAdmin) && (
                        <>
                            {!isCollapsed && (
                                <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mt-8 mb-4 px-3">
                                    Administration
                                </p>
                            )}
                            {adminNavItems.filter(item => {
                                if (isAdmin) return true
                                if (isSubAdmin) return item.href === '/admin/orders'
                                return false
                            }).map((item) => {
                                const isActive = isLinkActive(item.href)
                                return (
                                    <Link key={item.href} href={item.href} onClick={() => {
                                        if (window.innerWidth < 1024) closeSidebar()
                                    }}>
                                        <div className={cn(
                                            "nav-link",
                                            isActive && "text-red-500 bg-red-500/10 font-bold",
                                            isCollapsed && "justify-center px-0"
                                        )}>
                                            <item.icon className="w-5 h-5 flex-shrink-0" />
                                            {!isCollapsed && <span className="text-sm tracking-tight">{item.label}</span>}
                                        </div>
                                    </Link>
                                )
                            })}
                        </>
                    )}

                    {/* Bottom Actions */}
                    <div className="mt-8 pt-8 border-t border-border/30 space-y-1">
                        <Button
                            variant="ghost"
                            onClick={signOut}
                            className={cn(
                                "w-full nav-link text-red-500/70 hover:text-red-500 hover:bg-red-500/5",
                                isCollapsed && "justify-center px-0"
                            )}
                        >
                            <LogOut className="w-5 h-5 flex-shrink-0" />
                            {!isCollapsed && <span className="text-sm font-semibold tracking-tight">Sign Out</span>}
                        </Button>
                    </div>
                </nav>
            </aside>
        </>
    )
}
