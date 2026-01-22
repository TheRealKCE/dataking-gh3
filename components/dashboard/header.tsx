'use client'

import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { useTheme } from 'next-themes'
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
import { Bell, Moon, Sun, Menu, User, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function DashboardHeader() {
    const { dbUser, signOut, isAdmin } = useAuth()
    const { toggleSidebar } = useUI()
    const { theme, setTheme } = useTheme()
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
            .eq('user_id', dbUser?.id)
            .eq('is_read', false)

        setUnreadCount(count || 0)
    }

    const getInitials = () => {
        if (!dbUser) return 'U'
        return `${dbUser.first_name?.[0] || ''}${dbUser.last_name?.[0] || ''}`.toUpperCase()
    }

    return (
        <header className="sticky top-0 z-40 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
            <div className="h-full px-4 lg:px-8 flex items-center justify-between">
                {/* Mobile Menu Button */}
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
                    <Menu className="w-5 h-5" />
                </Button>

                {/* Welcome Message */}
                <div className="hidden lg:block">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Welcome back, {dbUser?.first_name || 'User'}! 👋
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Here's what's happening with your account
                    </p>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                    {/* Admin Badge */}
                    {isAdmin && (
                        <Badge variant="destructive" className="hidden sm:flex">
                            Admin
                        </Badge>
                    )}

                    {/* Theme Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </Button>

                    {/* Notifications */}
                    <Link href="/dashboard/notifications">
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </Button>
                    </Link>

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                                        {getInitials()}
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
        </header>
    )
}
