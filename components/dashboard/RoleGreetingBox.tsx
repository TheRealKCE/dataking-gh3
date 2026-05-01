'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
    Sparkles,
    Shield,
    Clock,
    Star,
    Crown,
    Settings,
    ShoppingCart,
    Wallet
} from 'lucide-react'

interface RoleGreetingBoxProps {
    stats?: {
        totalOrders: number
        walletBalance: number
    }
}

export function RoleGreetingBox({ stats }: RoleGreetingBoxProps) {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    if (!dbUser) return null

    const getGreeting = () => {
        const hour = currentTime.getHours()
        if (hour >= 5 && hour < 12) return 'Good Morning'
        if (hour >= 12 && hour < 17) return 'Good Afternoon'
        if (hour >= 17 && hour < 21) return 'Good Evening'
        return 'Good Night'
    }

    const formatDateTime = () => {
        const dateStr = currentTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        const timeStr = currentTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        })
        return { dateStr, timeStr }
    }

    const { dateStr, timeStr } = formatDateTime()

    const calculateDaysRemaining = () => {
        if (!dbUser?.agent_expires_at || dbUser?.role !== 'agent') return null
        const now = new Date()
        const expires = new Date(dbUser.agent_expires_at)
        const days = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return days > 0 ? days : 0
    }

    const daysRemaining = calculateDaysRemaining()

    const getTimeSinceJoined = () => {
        if (!dbUser?.created_at) return 'Recently'
        const now = new Date()
        const joined = new Date(dbUser.created_at)
        const diffMs = now.getTime() - joined.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
        if (diffDays < 365) {
            const months = Math.floor(diffDays / 30)
            return `${months} ${months === 1 ? 'month' : 'months'} ago`
        }
        const years = Math.floor(diffDays / 365)
        return `${years} ${years === 1 ? 'year' : 'years'} ago`
    }

    let roleLabel = ''
    let Icon = Sparkles
    let accentClass = 'text-primary'
    let pillClass = 'bg-primary/15 text-primary'

    if (isAdmin) {
        roleLabel = 'System Administrator'
        Icon = Shield
        accentClass = 'text-rose-500'
        pillClass = 'bg-rose-500/15 text-rose-500'
    } else if (isSubAdmin) {
        roleLabel = 'Sub-Administrator'
        Icon = Shield
        accentClass = 'text-indigo-500'
        pillClass = 'bg-indigo-500/15 text-indigo-500'
    } else if (dbUser.role === 'agent') {
        roleLabel = 'Authorized Agent'
        Icon = Crown
        accentClass = 'text-amber-500'
        pillClass = 'bg-amber-500/15 text-amber-500'
    } else {
        roleLabel = 'Valued Customer'
        Icon = Star
        accentClass = 'text-blue-500'
        pillClass = 'bg-blue-500/15 text-blue-500'
    }

    return (
        <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border/70 bg-card shadow-sm hover:shadow-md transition-all overflow-hidden relative">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_45%)]" />
            <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 pointer-events-none">
                <Icon className={cn('w-40 h-40', accentClass)} />
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <Icon className={cn('w-5 h-5 sm:w-6 sm:h-6 shrink-0', accentClass)} />
                        <h2 className="text-xl sm:text-2xl font-black text-foreground truncate">
                            {getGreeting()}, {dbUser.first_name}!
                        </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground pl-0.5">
                        Here is an overview of your transactions, shop performance, and recent activity.
                    </p>
                </div>
                <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 sm:gap-0 text-foreground">
                    <p className="text-xs sm:text-sm font-semibold text-muted-foreground">{dateStr}</p>
                    <p className="text-sm sm:text-lg font-black">{timeStr}</p>
                </div>
            </div>

            <div className="relative z-10 flex flex-col gap-3">
                <div className="bg-secondary/35 rounded-xl p-3 sm:p-4 flex items-center justify-between border border-border/60">
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                        <p className="text-xs sm:text-sm text-muted-foreground font-semibold">Your Role</p>
                    </div>
                    <p className={cn('text-sm sm:text-base font-black px-3 py-1 rounded-full', pillClass)}>
                        {roleLabel}
                    </p>
                </div>

                {dbUser.role === 'agent' ? (
                    <div className="bg-secondary/35 rounded-xl p-3 sm:p-4 flex items-center justify-between border border-border/60">
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                            <div className="flex flex-col">
                                <p className="text-xs sm:text-sm text-muted-foreground font-semibold">Membership</p>
                                <div className={cn(
                                    'inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold w-fit mt-0.5',
                                    daysRemaining !== null && daysRemaining <= 3
                                        ? 'bg-red-500/20 text-red-500'
                                        : daysRemaining !== null && daysRemaining <= 7
                                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                )}>
                                    Active
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {daysRemaining !== null && (
                                <p className={cn(
                                    'text-sm sm:text-lg font-black',
                                    daysRemaining <= 3
                                        ? 'text-red-500'
                                        : daysRemaining <= 7
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-foreground'
                                )}>
                                    {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                                </p>
                            )}
                            {daysRemaining !== null && daysRemaining <= 7 && (
                                <Link href="/dashboard/upgrade">
                                    <Button size="sm" className="h-7 px-3 text-[10px] sm:text-xs bg-red-600 hover:bg-red-700 text-white border-0 shadow-md">
                                        Renew Now
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                ) : isAdmin || isSubAdmin ? (
                    <div className="bg-secondary/35 rounded-xl p-3 sm:p-4 flex items-center justify-between border border-border/60">
                        <div className="flex items-center gap-3">
                            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                            <p className="text-xs sm:text-sm text-muted-foreground font-semibold">System Access</p>
                        </div>
                        <Link href="/admin">
                            <Button size="sm" className="h-8 px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-transform hover:scale-105">
                                Go to Admin Panel
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="bg-secondary/35 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-2 border border-border/60">
                        <div className="flex items-center gap-3 min-w-0">
                            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground shrink-0" />
                            <p className="text-xs sm:text-sm text-muted-foreground font-semibold">Total Orders</p>
                        </div>
                        <p className="text-sm sm:text-lg font-black text-foreground shrink-0">
                            {stats?.totalOrders || 0}
                        </p>
                    </div>
                )}

                <div className="bg-secondary/35 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-2 border border-border/60">
                    <div className="flex items-center gap-3 min-w-0">
                        {dbUser.role === 'customer' ? (
                            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground shrink-0" />
                        ) : (
                            <Star className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground shrink-0" />
                        )}
                        <p className="text-xs sm:text-sm text-muted-foreground font-semibold">
                            {dbUser.role === 'customer' ? 'Wallet Balance' : 'Member Since'}
                        </p>
                    </div>
                    <p className="text-xs sm:text-sm md:text-lg font-black text-foreground shrink-0 text-right max-w-[50%] break-all">
                        {dbUser.role === 'customer'
                            ? formatCurrency(stats?.walletBalance || 0)
                            : getTimeSinceJoined()
                        }
                    </p>
                </div>
            </div>
        </div>
    )
}

