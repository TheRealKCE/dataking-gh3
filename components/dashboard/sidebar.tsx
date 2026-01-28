'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Wallet,
    Receipt,
    User,
    MessageSquare,
    Bell,
    Users,
    FileText,
    Wifi,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Settings,
    Shield
} from 'lucide-react'
import { useState } from 'react'

const userNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/data-packages', label: 'Data Packages', icon: Package },
    { href: '/dashboard/my-orders', label: 'My Orders', icon: ShoppingCart },
    { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
    // { href: '/dashboard/transactions', label: 'Transactions', icon: Receipt }, // Disabled for optimization
    { href: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
    // { href: '/dashboard/afa-orders', label: 'AFA Orders', icon: FileText }, // Disabled for optimization
    { href: '/dashboard/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/profile', label: 'Profile', icon: User },
]

const adminNavItems = [
    { href: '/admin', label: 'Admin Dashboard', icon: Shield },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/packages', label: 'Packages', icon: Package },
    { href: '/admin/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/admin/announcements', label: 'Post Message', icon: Bell },
    { href: '/admin/sms-broadcast', label: 'SMS Broadcast', icon: MessageSquare },
    // { href: '/admin/transactions', label: 'Transactions', icon: Receipt }, // Disabled for optimization
    // { href: '/admin/afa-management', label: 'AFA Management', icon: FileText }, // Disabled for optimization
    // { href: '/admin/mtn-logs', label: 'MTN Logs', icon: Wifi }, // Disabled for optimization
    { href: '/admin/profits-history', label: 'Profits', icon: Wallet },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export function DashboardSidebar() {
    const pathname = usePathname()
    const { dbUser, isAdmin, isSubAdmin, signOut } = useAuth()
    const { isInternalSidebarOpen, closeSidebar } = useUI()
    const [isCollapsed, setIsCollapsed] = useState(false)

    // Ensure we handle "active" logic correctly for sub-routes
    // e.g. /dashboard/products should not highlight /dashboard
    const isLinkActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard'
        }
        return pathname?.startsWith(href)
    }

    return (
        <>
            {/* Mobile Overlay */}
            {isInternalSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-50 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out",
                    isCollapsed ? "w-20" : "w-72",
                    // Mobile visibility logic using transform
                    "transform lg:transform-none",
                    isInternalSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
                    <Link href="/dashboard" className="flex items-center space-x-2">
                        <div className="relative w-10 h-10 flex-shrink-0">
                            <Image
                                src="/logo.png"
                                alt="KING FLEXY DATA LTD"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                        {!isCollapsed && (
                            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                KING FLEXY DATA LTD
                            </span>
                        )}
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>

                    {/* Close button for mobile */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeSidebar}
                        className="lg:hidden text-gray-500"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                </div>

                {/* Profile Widget */}
                {!isCollapsed && dbUser && (
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {dbUser.first_name?.charAt(0)}{dbUser.last_name?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {dbUser.first_name} {dbUser.last_name}
                                </p>
                                <Badge
                                    variant={isAdmin ? 'default' : isSubAdmin ? 'secondary' : 'outline'}
                                    className={cn(
                                        "text-[10px] px-1.5 py-0",
                                        isAdmin && "bg-red-500 hover:bg-red-600",
                                        isSubAdmin && "bg-purple-500 hover:bg-purple-600 text-white",
                                        dbUser.role === 'agent' && "bg-green-500 hover:bg-green-600 text-white",
                                        !isAdmin && !isSubAdmin && dbUser.role !== 'agent' && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                    )}
                                >
                                    {isAdmin ? 'Admin' : isSubAdmin ? 'Sub-Admin' : dbUser.role === 'agent' ? 'Agent' : 'Customer'}
                                </Badge>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-12rem)]">
                    {isAdmin && !isCollapsed && (
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                            User Menu
                        </p>
                    )}
                    {userNavItems.map((item) => {
                        const isActive = isLinkActive(item.href)
                        return (
                            <Link key={item.href} href={item.href} onClick={() => {
                                // Close sidebar on mobile when a link is clicked
                                if (window.innerWidth < 1024) closeSidebar()
                            }}>
                                <div
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                                        isActive
                                            ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                                        isCollapsed && "justify-center px-2"
                                    )}
                                >
                                    <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-white")} />
                                    {!isCollapsed && <span className="font-medium">{item.label}</span>}
                                </div>
                            </Link>
                        )
                    })}

                    {(isAdmin || isSubAdmin) && (
                        <>
                            {!isCollapsed && (
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-6 mb-2 px-3">
                                    Admin Menu
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
                                                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                                                isActive
                                                    ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/25"
                                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                                                isCollapsed && "justify-center px-2"
                                            )}
                                        >
                                            <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-white")} />
                                            {!isCollapsed && <span className="font-medium">{item.label}</span>}
                                        </div>
                                    </Link>
                                )
                            })}
                        </>
                    )}
                </nav>

                {/* User Info & Logout */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <Button
                        variant="ghost"
                        onClick={signOut}
                        className={cn(
                            "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20",
                            isCollapsed && "justify-center"
                        )}
                    >
                        <LogOut className="w-5 h-5" />
                        {!isCollapsed && <span className="ml-2">Logout</span>}
                    </Button>
                </div>
            </aside>
        </>
    )
}
