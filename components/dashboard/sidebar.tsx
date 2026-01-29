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
    Plus
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const userNavItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/dashboard/data-packages', label: 'Data Packages', icon: Package },
    { href: '/dashboard/my-orders', label: 'Orders', icon: ShoppingCart },
    { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
    { href: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
    { href: '/dashboard/profile', label: 'Profile', icon: User },
]

const adminNavItems = [
    { href: '/admin', label: 'Dashboard', icon: Shield },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/packages', label: 'Packages', icon: Package },
    { href: '/admin/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/admin/announcements', label: 'Announce', icon: Bell },
    { href: '/admin/sms-broadcast', label: 'SMS', icon: MessageSquare },
    { href: '/admin/profits-history', label: 'Profits', icon: Wallet },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
]

// Role configuration with rank icons and colors
const roleConfig = {
    'admin': {
        icon: Crown,
        label: 'Admin',
        rank: '#1',
        color: '#E60000',
        bgColor: 'rgba(230, 0, 0, 0.1)',
        textColor: '#E60000'
    },
    'sub-admin': {
        icon: Star,
        label: 'Sub-Admin',
        rank: '#2',
        color: '#FACC15',
        bgColor: 'rgba(250, 204, 21, 0.15)',
        textColor: '#B59410'
    },
    'agent': {
        icon: BadgeCheck,
        label: 'Agent',
        rank: '#3',
        color: '#25D366',
        bgColor: 'rgba(37, 211, 102, 0.1)',
        textColor: '#25D366'
    },
    'customer': {
        icon: UserCircle,
        label: 'Customer',
        rank: '#4',
        color: '#0056B3',
        bgColor: 'rgba(0, 86, 179, 0.1)',
        textColor: '#0056B3'
    }
}

export function DashboardSidebar() {
    const pathname = usePathname()
    const { dbUser, isAdmin, isSubAdmin, signOut } = useAuth()
    const { isInternalSidebarOpen, closeSidebar } = useUI()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [walletBalance, setWalletBalance] = useState(0)

    // Fetch wallet balance
    useEffect(() => {
        const fetchBalance = async () => {
            if (!dbUser?.id) return
            const { data } = await (supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', dbUser.id)
                .single() as any)
            if (data) setWalletBalance(data.balance || 0)
        }
        fetchBalance()
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
                    "fixed left-0 top-0 z-50 h-full bg-[#E5E7EB] dark:bg-[#000000] transition-all duration-300 ease-in-out",
                    isCollapsed ? "w-20" : "w-72",
                    "transform lg:transform-none",
                    isInternalSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo Header */}
                <div className="h-14 flex items-center justify-between px-4 border-b border-gray-300 dark:border-gray-800">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="relative w-8 h-8 flex-shrink-0">
                            <Image
                                src="/logo.png"
                                alt="KING FLEXY"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-yellow-500 dark:text-yellow-400">KING FLEXY</span>
                                <span className="text-[10px] text-gray-600 dark:text-gray-400 -mt-0.5">DATA LIMITED</span>
                            </div>
                        )}
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-800 w-7 h-7"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeSidebar}
                        className="lg:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white w-7 h-7"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </div>

                {/* Profile Widget - Premium Card Style */}
                {!isCollapsed && dbUser && (
                    <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-gray-200/80 to-gray-300 dark:from-gray-800/80 dark:to-gray-900 border border-gray-400/50 dark:border-gray-700/50">
                        {/* User Info Row */}
                        <div className="flex items-center gap-2.5 mb-3">
                            {/* Avatar with Initials */}
                            <div
                                className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                style={{ backgroundColor: currentRole.color }}
                            >
                                {dbUser.first_name?.charAt(0)}{dbUser.last_name?.charAt(0)}
                                <div
                                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-900"
                                    style={{ backgroundColor: currentRole.bgColor }}
                                >
                                    <RoleIcon className="w-2.5 h-2.5" style={{ color: currentRole.color }} />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 dark:text-white truncate">
                                    {dbUser.first_name} {dbUser.last_name}
                                </p>
                                <div className="flex items-center gap-1">
                                    <span
                                        className="text-[10px] font-normal"
                                        style={{ color: currentRole.textColor }}
                                    >
                                        {currentRole.rank} {currentRole.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Wallet Section */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-300/60 dark:bg-gray-900/60 border border-gray-400/30 dark:border-gray-700/30">
                            <div>
                                <p className="text-[9px] text-gray-600 dark:text-gray-500 uppercase tracking-wider font-medium">Balance</p>
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(walletBalance)}</p>
                            </div>
                            <Link href="/dashboard/wallet">
                                <Button
                                    size="sm"
                                    className="h-7 px-2.5 text-[10px] font-semibold bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Top Up
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className={cn(
                    "px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-500 dark:hover:scrollbar-thumb-gray-600",
                    !isCollapsed ? "h-[calc(100vh-14rem)]" : "h-[calc(100vh-8rem)]"
                )}>
                    {!isCollapsed && (
                        <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-2">
                            Menu
                        </p>
                    )}
                    {userNavItems.map((item) => {
                        const isActive = isLinkActive(item.href)
                        return (
                            <Link key={item.href} href={item.href} onClick={() => {
                                if (window.innerWidth < 1024) closeSidebar()
                            }}>
                                <div
                                    className={cn(
                                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200",
                                        isActive
                                            ? "bg-yellow-500/20 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-300/60 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200",
                                        isCollapsed && "justify-center px-2"
                                    )}
                                >
                                    <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-yellow-600 dark:text-yellow-400")} />
                                    {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                                </div>
                            </Link>
                        )
                    })}

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
                                return (
                                    <Link key={item.href} href={item.href} onClick={() => {
                                        if (window.innerWidth < 1024) closeSidebar()
                                    }}>
                                        <div
                                            className={cn(
                                                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200",
                                                isActive
                                                    ? "bg-red-500/20 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-300/60 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200",
                                                isCollapsed && "justify-center px-2"
                                            )}
                                        >
                                            <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-red-600 dark:text-red-400")} />
                                            {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                                        </div>
                                    </Link>
                                )
                            })}
                        </>
                    )}
                </nav>

                {/* Logout Button */}
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-300 dark:border-gray-800 bg-[#E5E7EB] dark:bg-[#000000]">
                    <Button
                        variant="ghost"
                        onClick={signOut}
                        className={cn(
                            "w-full justify-start text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/10 h-9",
                            isCollapsed && "justify-center"
                        )}
                    >
                        <LogOut className="w-4 h-4" />
                        {!isCollapsed && <span className="ml-2 text-sm font-medium">Logout</span>}
                    </Button>
                </div>
            </aside >
        </>
    )
}
