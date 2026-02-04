'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    ShoppingCart,
    CheckCircle2,
    Clock,
    XCircle,
    Wallet,
    Package,
    AlertCircle,
    Plus,
    Crown,
    Shield,
    Star,
    Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardStats {
    totalOrders: number
    completedOrders: number
    processingOrders: number
    failedOrders: number
    pendingOrders: number
    walletBalance: number
}


import { WhatsAppCommunityButtons } from '@/components/whatsapp-community-buttons'

export default function DashboardPage() {
    const { dbUser } = useAuth()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())

    // Real-time clock updater
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (dbUser) {
            fetchDashboardData()
        }
    }, [dbUser])

    // Helper functions for greeting box
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

    const calculateDaysRemaining = () => {
        if (!dbUser?.agent_expires_at || dbUser?.role !== 'agent') return null
        const now = new Date()
        const expires = new Date(dbUser.agent_expires_at)
        const days = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return days > 0 ? days : 0
    }

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

    const fetchDashboardData = async () => {
        try {
            const [ordersRes, walletRes] = await Promise.all([
                // Fetch orders stats
                supabase
                    .from('orders')
                    .select('status, price')
                    .eq('user_id', dbUser?.id as any),

                // Fetch wallet balance
                supabase
                    .from('wallets')
                    .select('balance')
                    .eq('user_id', dbUser?.id as any)
                    .single()
            ])

            const orders = ordersRes.data
            const wallet = walletRes.data

            const totalOrders = orders?.length || 0
            const completedOrders = (orders as any)?.filter((o: any) => o.status === 'completed').length || 0
            const processingOrders = (orders as any)?.filter((o: any) => o.status === 'processing').length || 0
            const failedOrders = (orders as any)?.filter((o: any) => o.status === 'failed').length || 0
            const pendingOrders = (orders as any)?.filter((o: any) => o.status === 'pending').length || 0
            const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0
            const totalSpent = (orders as any)?.filter((o: any) => o.status === 'completed').reduce((acc: number, curr: any) => acc + (curr.price || 0), 0) || 0

            setStats({
                totalOrders,
                completedOrders,
                processingOrders,
                failedOrders,
                pendingOrders,
                walletBalance: (wallet as any)?.balance || 0
            })
        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-4 sm:p-6">
                                <Skeleton className="h-4 w-24 mb-2" />
                                <Skeleton className="h-8 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    const { dateStr, timeStr } = formatDateTime()
    const daysRemaining = calculateDaysRemaining()

    return (
        <div className="space-y-6">
            {/* Golden Greeting Box - Agent Only */}
            {dbUser?.role === 'agent' && (
                <div className="bg-[#FFCE00] rounded-2xl p-4 sm:p-6 border-2 border-yellow-600/30 shadow-md lg:shadow-xl">
                    {/* Greeting and Date/Time Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-black" />
                            <h2 className="text-xl sm:text-2xl font-black text-black">
                                {getGreeting()}, {dbUser?.first_name}!
                            </h2>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0 text-black">
                            <p className="text-xs sm:text-base font-bold">{dateStr}</p>
                            <p className="text-sm sm:text-xl font-black">{timeStr}</p>
                        </div>
                    </div>

                    {/* Three Information Rows (Single Column) */}
                    <div className="flex flex-col gap-3">
                        {/* Row 1: Role */}
                        <div className="bg-black rounded-xl p-3 sm:p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                <p className="text-xs sm:text-sm text-white/70 font-semibold">Your Role</p>
                            </div>
                            <p className="text-sm sm:text-lg font-black" style={{ color: '#25D366' }}>
                                Authorized Agent
                            </p>
                        </div>

                        {/* Row 2: Status & Countdown */}
                        <div className="bg-black rounded-xl p-3 sm:p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                <div className="flex flex-col">
                                    <p className="text-xs sm:text-sm text-white/70 font-semibold">Membership</p>
                                    <div className={cn(
                                        "inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold w-fit",
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
                                            ? "text-red-500"
                                            : daysRemaining <= 7
                                                ? "text-yellow-500"
                                                : "text-green-500"
                                    )}>
                                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                                    </p>
                                )}
                                {daysRemaining !== null && daysRemaining <= 3 && (
                                    <Link href="/dashboard/upgrade">
                                        <Button size="sm" className="h-7 px-3 text-[10px] sm:text-xs bg-red-600 hover:bg-red-700 text-white border-0">
                                            Renew Now
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Row 3: Member Since */}
                        <div className="bg-black rounded-xl p-3 sm:p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Star className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 fill-yellow-400" />
                                <p className="text-xs sm:text-sm text-white/70 font-semibold">Member Since</p>
                            </div>
                            <p className="text-sm sm:text-lg font-black text-white">
                                {getTimeSinceJoined()}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Card className="bg-[#0056B3] text-white border-0">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/80 text-xs sm:text-sm font-medium">Total Orders</p>
                                <p className="text-xl md:text-2xl lg:text-3xl font-bold mt-1">{stats?.totalOrders}</p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#25D366] text-black border-0">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-black/70 text-xs sm:text-sm font-medium">Completed</p>
                                <p className="text-xl md:text-2xl lg:text-3xl font-bold mt-1">{stats?.completedOrders}</p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/10 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#FFCE00] text-black border-0">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-black/70 text-xs sm:text-sm font-medium">Processing</p>
                                <p className="text-xl md:text-2xl lg:text-3xl font-bold mt-1">{stats?.processingOrders}</p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/10 flex items-center justify-center">
                                <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#E60000] text-white border-0">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/80 text-xs sm:text-sm font-medium">Failed</p>
                                <p className="text-xl md:text-2xl lg:text-3xl font-bold mt-1">{stats?.failedOrders}</p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Wallet & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Wallet Card */}
                <Card className="lg:col-span-1 overflow-hidden">
                    <div className="bg-[#FACC15] p-6 text-[#1A1A1A]">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[#1A1A1A]/80 font-medium">Wallet Balance</p>
                            <Wallet className="w-6 h-6 text-[#1A1A1A]/60" />
                        </div>
                        <p className="text-4xl font-bold mb-6">{formatCurrency(stats?.walletBalance || 0)}</p>
                        <Link href="/dashboard/wallet">
                            <Button className="w-full bg-[#1A1A1A]/10 hover:bg-[#1A1A1A]/20 text-[#1A1A1A] border-0">
                                <Plus className="w-4 h-4 mr-2" />
                                Top Up Wallet
                            </Button>
                        </Link>
                    </div>
                </Card>

                {/* Quick Actions */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Link href="/dashboard/data-packages">
                                <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-800 lg:hover:shadow-lg transition-all cursor-pointer group">
                                    <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Package className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="font-medium text-sm">Buy Data</p>
                                    <p className="text-xs text-muted-foreground">MTN, Telecel...</p>
                                </div>
                            </Link>
                            <Link href="/dashboard/my-orders">
                                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 lg:hover:shadow-lg transition-all cursor-pointer group">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <ShoppingCart className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="font-medium text-sm">My Orders</p>
                                    <p className="text-xs text-muted-foreground">Track orders</p>
                                </div>
                            </Link>
                            <Link href="/dashboard/wallet">
                                <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 hover:shadow-lg transition-all cursor-pointer group">
                                    <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Wallet className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="font-medium text-sm">Top Up</p>
                                    <p className="text-xs text-muted-foreground">Add funds</p>
                                </div>
                            </Link>
                            <Link href="/dashboard/complaints">
                                <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800 hover:shadow-lg transition-all cursor-pointer group">
                                    <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <AlertCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="font-medium text-sm">Complaints</p>
                                    <p className="text-xs text-muted-foreground">Get support</p>
                                </div>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Community Section */}
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Join our community for updates and support</p>
                <div className="grid grid-cols-2 gap-3">
                    <a
                        href="https://chat.whatsapp.com/FC6jYV3VDEQ4MmdTXiFqDV?mode=gi_t"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold text-sm transition-all duration-300 shadow-md hover:shadow-lg"
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp Group
                    </a>
                    <a
                        href="https://whatsapp.com/channel/0029Vb7HTfx47XeIZz7ht232"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold text-sm transition-all duration-300 shadow-md hover:shadow-lg"
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp Channel
                    </a>
                </div>
            </div>

        </div>
    )
}
