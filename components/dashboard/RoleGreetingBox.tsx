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

    // Role specific configurations
    let themeClasses = ''
    let roleLabel = ''
    let Icon = Sparkles
    let textColor = ''

    if (isAdmin) {
        themeClasses = 'bg-gradient-to-br from-red-600 to-red-800 border-red-500/30'
        roleLabel = 'System Administrator'
        Icon = Shield
        textColor = 'text-white'
    } else if (isSubAdmin) {
        themeClasses = 'bg-gradient-to-br from-indigo-600 to-indigo-800 border-indigo-500/30'
        roleLabel = 'Sub-Administrator'
        Icon = Shield
        textColor = 'text-white'
    } else if (dbUser.role === 'agent') {
        themeClasses = 'bg-gradient-to-br from-[#FFCE00] to-yellow-600 border-yellow-600/30'
        roleLabel = 'Authorized Agent'
        Icon = Crown
        textColor = 'text-black'
    } else {
        // Customer
        themeClasses = 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-500/30'
        roleLabel = 'Valued Customer'
        Icon = Star
        textColor = 'text-white'
    }

    return (
        <div className={cn("rounded-2xl p-4 sm:p-6 border-2 shadow-lg hover:shadow-xl transition-all overflow-hidden relative", themeClasses)}>
            
            {/* Background decoration */ }
            <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 pointer-events-none">
                <Icon className={cn("w-48 h-48", textColor)} />
            </div>

            {/* Greeting and Date/Time Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 relative z-10">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Icon className={cn("w-6 h-6 sm:w-8 sm:h-8", textColor, dbUser.role === 'agent' ? "fill-black" : "fill-white/20")} />
                        <h2 className={cn("text-xl sm:text-2xl font-black", textColor)}>
                            {getGreeting()}, {dbUser.first_name}!
                        </h2>
                    </div>
                    <p className={cn("text-xs sm:text-sm font-medium opacity-90 pl-1", textColor)}>
                        Here's an overview of your transactions, shop performance, and recent activity.
                    </p>
                </div>
                <div className={cn("flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0", textColor)}>
                    <p className="text-xs sm:text-base font-bold opacity-90">{dateStr}</p>
                    <p className="text-sm sm:text-xl font-black">{timeStr}</p>
                </div>
            </div>

            {/* Information Rows */}
            <div className="flex flex-col gap-3 relative z-10">
                {/* Row 1: Role */}
                <div className="bg-black/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 flex items-center justify-between border border-white/10">
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        <p className="text-xs sm:text-sm text-white/90 font-semibold">Your Role</p>
                    </div>
                    <p className="text-sm sm:text-lg font-black text-white">
                        {roleLabel}
                    </p>
                </div>

                {/* Conditional Row 2 */}
                {dbUser.role === 'agent' ? (
                    <div className="bg-black/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 flex items-center justify-between border border-white/10">
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            <div className="flex flex-col">
                                <p className="text-xs sm:text-sm text-white/90 font-semibold">Membership</p>
                                <div className={cn(
                                    "inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold w-fit mt-0.5",
                                    daysRemaining !== null && daysRemaining <= 3
                                        ? "bg-red-500 text-white"
                                        : daysRemaining !== null && daysRemaining <= 7
                                            ? "bg-yellow-500 text-black"
                                            : "bg-green-500 text-white"
                                )}>
                                    Active
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {daysRemaining !== null && (
                                <p className={cn(
                                    "text-sm sm:text-lg font-black",
                                    daysRemaining <= 3
                                        ? "text-red-400"
                                        : daysRemaining <= 7
                                            ? "text-yellow-400"
                                            : "text-white"
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
                    <div className="bg-black/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 flex items-center justify-between border border-white/10">
                        <div className="flex items-center gap-3">
                            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            <p className="text-xs sm:text-sm text-white/90 font-semibold">System Access</p>
                        </div>
                        <Link href="/admin">
                            <Button size="sm" className="h-8 px-4 text-xs font-bold bg-white text-red-600 hover:bg-gray-100 shadow-md transition-transform hover:scale-105">
                                Go to Admin Panel
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="bg-black/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 flex items-center justify-between border border-white/10">
                        <div className="flex items-center gap-3">
                            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            <p className="text-xs sm:text-sm text-white/90 font-semibold">Total Orders</p>
                        </div>
                        <p className="text-sm sm:text-lg font-black text-white">
                            {stats?.totalOrders || 0}
                        </p>
                    </div>
                )}

                {/* Row 3: Member Since / Extra Info */}
                <div className="bg-black/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 flex items-center justify-between border border-white/10">
                    <div className="flex items-center gap-3">
                        {dbUser.role === 'customer' ? (
                            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        ) : (
                            <Star className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white/50" />
                        )}
                        <p className="text-xs sm:text-sm text-white/90 font-semibold">
                            {dbUser.role === 'customer' ? 'Wallet Balance' : 'Member Since'}
                        </p>
                    </div>
                    <p className="text-sm sm:text-lg font-black text-white">
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
