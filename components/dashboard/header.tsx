'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { roleConfig } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { Menu, Sun, Moon, Bell, User, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DashboardHeader() {
    const { dbUser, signOut, isAdmin, isSubAdmin } = useAuth()
    const { toggleSidebar } = useUI()
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        if (dbUser) {
            fetchUnreadNotifications()
        }
    }, [dbUser])

    const fetchUnreadNotifications = async () => {
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', dbUser?.id as any)
            .eq('is_read', false)

        setUnreadCount(count || 0)
    }

    const getInitials = () => {
        if (!dbUser) return 'U'
        return `${dbUser.first_name?.[0] || ''}${dbUser.last_name?.[0] || ''}`.toUpperCase()
    }

    // Get role config
    const userRole = isAdmin ? 'admin' : isSubAdmin ? 'sub-admin' : (dbUser?.role || 'customer') as keyof typeof roleConfig
    const currentRole = roleConfig[userRole] || roleConfig['customer']
    const RoleIcon = currentRole.icon

    return (
        <header className={cn(
            "sticky top-0 z-40 h-16 backdrop-blur-xl border-b transition-colors duration-200",
            dbUser?.role === 'agent'
                ? "bg-gradient-to-b from-yellow-400 via-amber-500 to-amber-600 border-amber-600/20 shadow-sm"
                : "bg-white/80 dark:bg-gray-900/80 border-gray-200 dark:border-gray-800"
        )}>
            <div className="h-full px-4 lg:px-8 flex items-center justify-between">
                {/* Mobile Menu Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("lg:hidden", dbUser?.role === 'agent' ? "text-black hover:bg-black/10" : "")}
                    onClick={toggleSidebar}
                >
                    <Menu className="w-5 h-5" />
                </Button>

                {/* Welcome Message */}
                <div className="hidden lg:block">
                    <h1 className={cn(
                        "text-lg font-semibold",
                        dbUser?.role === 'agent' ? "text-black drop-shadow-sm font-bold" : "text-gray-900 dark:text-white"
                    )}>
                        Welcome back, {dbUser?.first_name || 'User'}! 👋
                    </h1>
                    <p className={cn(
                        "text-sm",
                        dbUser?.role === 'agent' ? "text-black/80 font-medium" : "text-gray-500 dark:text-gray-400"
                    )}>
                        Here's what's happening with your account
                    </p>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                    {/* Role Badge */}
                    <Badge
                        className="hidden sm:flex text-xs"
                        style={{
                            backgroundColor: currentRole.color,
                            color: isSubAdmin ? 'black' : 'white'
                        }}
                    >
                        {currentRole.label}
                    </Badge>

                    {/* Notifications */}
                    <Link href="/dashboard/notifications">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("relative", dbUser?.role === 'agent' ? "text-black hover:bg-black/10" : "")}
                        >
                            <Bell className={cn("w-5 h-5", dbUser?.role === 'agent' ? "text-black" : "text-gray-500 dark:text-gray-400")} />
                            {unreadCount > 0 && (
                                <span className={cn(
                                    "absolute -top-1 -right-1 w-5 h-5 text-xs rounded-full flex items-center justify-center",
                                    dbUser?.role === 'agent' ? "bg-black text-[#FFCE00]" : "bg-red-500 text-white"
                                )}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </Button>
                    </Link>

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                <Avatar className="h-10 w-10 ring-2 ring-primary/20 transition-transform hover:scale-105 active:scale-95">
                                    <AvatarFallback className="text-white font-semibold flex items-center justify-center delay-0 duration-0" style={{ backgroundColor: currentRole.color }}>
                                        <RoleIcon className="w-5 h-5" />
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {dbUser?.first_name} {dbUser?.last_name}
                                    </p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {dbUser?.email}
                                    </p>
                                    <Badge
                                        className="w-fit mt-1 text-[10px] px-1.5 py-0"
                                        style={{
                                            backgroundColor: isAdmin ? '#E60000' : isSubAdmin ? '#FACC15' : dbUser?.role === 'agent' ? '#25D366' : '#0056B3',
                                            color: isSubAdmin ? 'black' : 'white'
                                        }}
                                    >
                                        {isAdmin ? 'Admin' : isSubAdmin ? 'Sub-Admin' : dbUser?.role === 'agent' ? 'Agent' : 'Customer'}
                                    </Badge>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <Link href="/dashboard/profile">
                                <DropdownMenuItem>
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Profile</span>
                                </DropdownMenuItem>
                            </Link>
                            {isAdmin && (
                                <Link href="/admin/settings">
                                    <DropdownMenuItem>
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Admin Settings</span>
                                    </DropdownMenuItem>
                                </Link>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={signOut} className="text-red-600">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span className="cursor-pointer">Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header >
    )
}
