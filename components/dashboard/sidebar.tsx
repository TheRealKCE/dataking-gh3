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
    Tag
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { usePageAccess } from '@/hooks/use-page-access'
import { differenceInDays } from 'date-fns'
import { useAdminCounts } from '@/hooks/use-admin-counts'

const userNavItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/dashboard/upgrade', label: 'Membership', icon: Crown },
    { href: '/dashboard/data-packages', label: 'Data Packages', icon: Package },
    { href: '/dashboard/my-orders', label: 'Orders', icon: ShoppingCart },
    { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
    { href: '/dashboard/transactions', label: 'Transactions', icon: Activity },
    { href: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/dashboard/profile', label: 'Profile', icon: User },
    { href: '/dashboard/afa-orders', label: 'AFA Application', icon: BadgeCheck },
]

const adminNavItems = [
    { href: '/admin', label: 'Dashboard', icon: Shield },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/fulfillment', label: 'Fulfillment', icon: Activity },
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

import { roleConfig } from '@/lib/roles'

export function DashboardSidebar() {
    const pathname = usePathname()
    const { dbUser, isAdmin, isSubAdmin, signOut } = useAuth()
    const { isInternalSidebarOpen, closeSidebar } = useUI()
    const { isPageAccessible, loading: pageAccessLoading } = usePageAccess()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [walletBalance, setWalletBalance] = useState(0)
    const { counts: adminCounts } = useAdminCounts()

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

    const isLinkActive = (href: string) => {
        if (href === '/dashboard' || href === '/admin') {
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
                    (dbUser?.role === 'agent')
                        ? "bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 dark:from-yellow-900 dark:via-amber-900 dark:to-yellow-800"
                        : "bg-[#E5E7EB] dark:bg-[#000000]",
                    isCollapsed ? "w-20" : "w-80",
                    "transform lg:transform-none",
                    isInternalSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo Header */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-gray-300 dark:border-gray-800">
                    <Link href="/dashboard" className="flex items-center gap-3 group">
                        <div className="relative w-10 h-10 flex-shrink-0 transition-transform group-hover:scale-110">
                            <Image
                                src="/logo.png"
                                alt="KING FLEXY"
                                fill
                                className="object-contain"
                                priority
                            />
                            {dbUser?.role === 'agent' && (
                                <Crown className="absolute -top-4 -left-3 w-6 h-6 text-black fill-black -rotate-[25deg] drop-shadow-md z-10" />
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col transition-transform group-hover:scale-105">
                                <span className="text-xl font-extrabold tracking-tight text-black dark:text-white font-display drop-shadow-sm">
                                    KING FLEXY
                                </span>
                                <span className="text-[11px] font-bold text-[#E60000] -mt-1 tracking-widest drop-shadow-sm">DATA LIMITED</span>
                            </div>
                        )}
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-800 w-8 h-8 rounded-full"
                    >
                        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeSidebar}
                        className="lg:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white w-8 h-8"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                </div>

                {/* Profile Widget - Premium Card Style */}
                {!isCollapsed && dbUser && (
                    <div className={cn(
                        "mx-4 mt-6 p-4 rounded-2xl border shadow-lg",
                        dbUser?.role === 'agent'
                            ? "bg-[#FFCE00] border-black/10"
                            : "bg-gradient-to-br from-gray-200/90 to-gray-300 dark:from-gray-800/90 dark:to-gray-900 border-gray-400/50 dark:border-gray-700/50"
                    )}>
                        {/* User Info Row */}
                        <div className="flex items-center gap-3.5 mb-4">
                            {/* Avatar with Role Icon */}
                            <div
                                className="relative w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md ring-2 ring-white/20"
                                style={{ backgroundColor: currentRole.color }}
                            >
                                <RoleIcon className="w-6 h-6" />
                                <div
                                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-800"
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate flex items-center gap-1.5 flex-wrap">
                                    {dbUser?.role === 'agent' ? (
                                        <>
                                            {dbUser?.first_name} {dbUser?.last_name}
                                            {daysRemaining !== null && (
                                                <span className={cn(
                                                    "text-xs font-bold px-1.5 py-0.5 rounded ml-1",
                                                    daysRemaining <= 3
                                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                )}>
                                                    {daysRemaining}d
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span>{dbUser?.first_name} {dbUser?.last_name}</span>
                                    )}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span
                                        className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-sm"
                                        style={{ color: currentRole.textColor }}
                                    >
                                        {currentRole.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Subscription Info for Agents / Upgrade for Customers */}
                        {dbUser?.role === 'agent' ? (
                            <div className="mt-3 space-y-2">
                                {/* Days Remaining Display */}
                                {daysRemaining !== null && (
                                    <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-700">
                                        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">
                                            Subscription Status
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-lg font-black",
                                                daysRemaining <= 3 ? "text-red-600 dark:text-red-500" : "text-green-600 dark:text-green-500"
                                            )}>
                                                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">remaining</span>
                                        </div>
                                    </div>
                                )}

                                {/* Extend Button */}
                                <Link href="/dashboard/upgrade" className="block" onClick={closeSidebar}>
                                    <Button
                                        size="sm"
                                        className="w-full h-9 text-xs font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Crown className="w-4 h-4" />
                                        Extend Subscription
                                    </Button>
                                </Link>
                            </div>
                        ) : dbUser?.role === 'customer' && (
                            <Link href="/dashboard/upgrade" className="block mt-3" onClick={closeSidebar}>
                                <Button
                                    size="sm"
                                    className="w-full h-9 text-xs font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Crown className="w-4 h-4" />
                                    Upgrade to Agent
                                </Button>
                            </Link>
                        )}

                        {/* Wallet Section */}
                        <div className={cn(
                            "flex items-center justify-between p-3 rounded-xl border backdrop-blur-md",
                            dbUser?.role === 'agent'
                                ? "bg-[#FFCE00] border-black/10"
                                : "bg-gray-300/60 dark:bg-black/40 border-gray-400/30 dark:border-gray-800/50"
                        )}>
                            <div>
                                <p className={cn(
                                    "text-[10px] uppercase tracking-wider font-bold mb-0.5",
                                    dbUser?.role === 'agent' ? "text-black" : "text-gray-600 dark:text-gray-400"
                                )}>Balance</p>
                                <p className={cn(
                                    "text-base font-black tracking-tight",
                                    dbUser?.role === 'agent' ? "text-black" : "text-emerald-600 dark:text-emerald-400"
                                )}>{formatCurrency(walletBalance)}</p>
                            </div>
                            {!(process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true' && !isAdmin) && isPageAccessible('/dashboard/wallet') && (
                                <Link href="/dashboard/wallet">
                                    <Button
                                        size="sm"
                                        className="h-8 px-3 text-xs font-bold bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                                        Top Up
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                )
                }

                {/* Navigation */}
                <nav className={cn(
                    "px-2 py-3 space-y-0.5 overflow-y-auto flex-1 scrollbar-thin scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-500 dark:hover:scrollbar-thumb-gray-600"
                )}>
                    {!isCollapsed && (
                        <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-2">
                            Menu
                        </p>
                    )}


                    {userNavItems
                        .map((item) => {
                            const isActive = isLinkActive(item.href)
                            return (
                                <Link key={item.href} href={item.href} onClick={() => {
                                    if (window.innerWidth < 1024) closeSidebar()
                                }}>
                                    <div
                                        className={cn(
                                            "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200",
                                            isActive
                                                ? dbUser?.role === 'agent'
                                                    ? "bg-black text-[#FFCE00] shadow-lg"
                                                    : "bg-yellow-500/20 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                                : dbUser?.role === 'agent'
                                                    ? "text-black hover:text-[#FFCE00] hover:bg-black/10"
                                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-300/60 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200",
                                            isCollapsed && "justify-center px-2"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "w-5 h-5 flex-shrink-0",
                                            isActive && (dbUser?.role === 'agent' ? "text-[#FFCE00]" : "text-yellow-600 dark:text-yellow-400")
                                        )} />
                                        {!isCollapsed && <span className="text-base font-medium">{item.label}</span>}
                                    </div>
                                </Link>
                            )
                        })}

                    {/* My Shop link — admin/sub-admin/agent, shown in main list */}
                    {(isAdmin || isSubAdmin || dbUser?.role === 'agent') && (() => {
                        const isActive = isLinkActive('/dashboard/shop')
                        return (
                            <Link href="/dashboard/shop" onClick={() => {
                                if (window.innerWidth < 1024) closeSidebar()
                            }}>
                                <div className={cn(
                                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200",
                                    isActive
                                        ? "bg-emerald-500/20 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-300/60 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200",
                                    isCollapsed && "justify-center px-2"
                                )}>
                                    <Store className={cn("w-5 h-5 flex-shrink-0", isActive && "text-emerald-600 dark:text-emerald-400")} />
                                    {!isCollapsed && <span className="text-base font-medium">My Shop</span>}
                                </div>
                            </Link>
                        )
                    })()}

                    {/* Shop Menu - Conditional */}
                    {pathname?.startsWith('/dashboard/shop') && (
                        <div className="mb-4">
                            {!isCollapsed && (
                                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1.5 px-2 flex items-center gap-1">
                                    <Store className="w-3 h-3" />
                                    My Shop
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {[
                                    { href: '/dashboard/shop', label: 'Overview', icon: LayoutDashboard },
                                    { href: '/dashboard/shop/orders', label: 'Orders', icon: ShoppingCart },
                                    { href: '/dashboard/shop/pricing', label: 'Pricing', icon: Tag },
                                    { href: '/dashboard/shop/setup', label: 'Shop Profile', icon: Settings },
                                    { href: '/dashboard/shop/withdraw', label: 'Withdraw', icon: Banknote },
                                ].map(item => {
                                    const isActive = pathname === item.href
                                    return (
                                        <Link key={item.href} href={item.href} onClick={() => {
                                            if (window.innerWidth < 1024) closeSidebar()
                                        }}>
                                            <div
                                                className={cn(
                                                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200",
                                                    isActive
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-semibold"
                                                        : "text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:text-emerald-600 dark:hover:text-emerald-400",
                                                    isCollapsed && "justify-center px-2"
                                                )}
                                            >
                                                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-emerald-600 dark:text-emerald-400")} />
                                                {!isCollapsed && <span className="text-sm">{item.label}</span>}
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                            {!isCollapsed && <div className="h-px bg-gray-200 dark:bg-gray-800 my-4 mx-2" />}
                        </div>
                    )}

                    {(isAdmin || isSubAdmin) && (
                        <>
                            {!isCollapsed && (
                                <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-500 uppercase tracking-wider mt-4 mb-1.5 px-2">
                                    Admin
                                </p>
                            )}
                            {adminNavItems.filter(item => {
                                if (isAdmin) return true
                                if (isSubAdmin) return item.href === '/admin/orders'
                                return false
                            }).map((item) => {
                                const isActive = isLinkActive(item.href)

                                // Get badge count for this item
                                let badgeCount = 0
                                if (item.href === '/admin/orders') badgeCount = adminCounts.pendingOrders
                                else if (item.href === '/admin/fulfillment') badgeCount = adminCounts.pendingFulfillment
                                else if (item.href === '/admin/shops') badgeCount = adminCounts.pendingShops
                                else if (item.href === '/admin/shops/withdrawals') badgeCount = adminCounts.pendingWithdrawals
                                else if (item.href === '/admin/afa-management') badgeCount = adminCounts.pendingAfa
                                else if (item.href === '/admin/memberships') badgeCount = adminCounts.expiringAgents
                                else if (item.href === '/admin/complaints') badgeCount = adminCounts.pendingComplaints

                                return (
                                    <Link key={item.href} href={item.href} onClick={() => {
                                        if (window.innerWidth < 1024) closeSidebar()
                                    }}>
                                        <div
                                            className={cn(
                                                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 relative",
                                                isActive
                                                    ? "bg-red-500/20 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-300/60 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200",
                                                isCollapsed && "justify-center px-2"
                                            )}
                                        >
                                            <div className="relative">
                                                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-red-600 dark:text-red-400")} />
                                                {isCollapsed && badgeCount > 0 && (
                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-200 dark:border-slate-900 animate-pulse" />
                                                )}
                                            </div>
                                            {!isCollapsed && (
                                                <>
                                                    <span className="text-base font-medium flex-1">{item.label}</span>
                                                    {badgeCount > 0 && (
                                                        <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 rounded-full animate-in zoom-in duration-300 relative">
                                                            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20" />
                                                            <span className="text-[10px] font-black text-white relative z-10">
                                                                {badgeCount > 9 ? '9+' : badgeCount}
                                                            </span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </Link>
                                )
                            })}
                        </>
                    )}
                    {/* Logout Button - Inside scrollable area */}
                    <div className="mt-4 pt-3 border-t border-gray-300 dark:border-gray-800">
                        <Button
                            variant="ghost"
                            onClick={signOut}
                            className={cn(
                                "w-full justify-start text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/10 h-10",
                                isCollapsed && "justify-center"
                            )}
                        >
                            <LogOut className="w-5 h-5" />
                            {!isCollapsed && <span className="ml-2 text-base font-medium">Logout</span>}
                        </Button>
                    </div>
                </nav>
            </aside >
        </>
    )
}
