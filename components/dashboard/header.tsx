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
import { roleConfig } from '@/lib/roles'
// ... (keep other imports)

export function DashboardHeader() {
    // ... (keep other hooks)

    // Get role config
    const userRole = isAdmin ? 'admin' : isSubAdmin ? 'sub-admin' : (dbUser?.role || 'customer') as keyof typeof roleConfig
    const currentRole = roleConfig[userRole] || roleConfig['customer']
    const RoleIcon = currentRole.icon

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
        </header>
    )
}
