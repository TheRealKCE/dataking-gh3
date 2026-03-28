'use client'

import { useEffect, useState } from 'react'
import { createServerClient } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Users,
    ShoppingCart,
    Wallet,
    CheckCircle2,
    TrendingUp,
    Clock,
    DollarSign,
    AlertTriangle,
    Bell,
    MessageSquare,
    Store,
    Banknote,
    BadgeCheck,
    Crown,
    ArrowRight,
    Scale
} from 'lucide-react'
import { useAdminCounts } from '@/hooks/use-admin-counts'
import Link from 'next/link'

interface AdminStats {
    totalUsers: number
    totalOrders: number
    completedOrders: number
    pendingOrders: number
    totalRevenue: number
    totalWalletBalance: number
    successRate: number
    todayOrders: number
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<AdminStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [debtStats, setDebtStats] = useState<{ totalOwed: number; pendingUsersCount: number } | null>(null)
    const { counts: adminCounts } = useAdminCounts()

    // Calculate total actions required
    const totalActions = Object.values(adminCounts).reduce((a, b) => a + b, 0)

    useEffect(() => {
        fetchStats()
        fetch('/api/admin/top-up/debt-summary')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setDebtStats(data) })
            .catch(() => {})
    }, [])

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/admin/stats')
            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Failed to fetch stats')
            }
            const data = await response.json()
            setStats(data)
        } catch (error: any) {
            console.error('Error fetching admin stats:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Admin Dashboard</h1>
                    <p className="text-muted-foreground font-medium text-sm">Overview of platform performance and required actions.</p>
                </div>
                {totalActions > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/10 px-4 py-2 rounded-full border border-red-100 dark:border-red-900/20 animate-pulse">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-black text-red-700 dark:text-red-400">
                            {totalActions} Action{totalActions > 1 ? 's' : ''} Required
                        </span>
                    </div>
                )}
            </div>

            {/* Action Required Banner */}
            {totalActions > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    {adminCounts.pendingOrders > 0 && (
                        <Link href="/admin/orders">
                            <Card className="hover:shadow-md transition-all border-l-4 border-l-orange-500 group cursor-pointer h-full">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600">
                                            <ShoppingCart className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Orders</p>
                                            <p className="text-lg font-black">{adminCounts.pendingOrders} Pending</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                                </CardContent>
                            </Card>
                        </Link>
                    )}

                    {adminCounts.pendingShops > 0 && (
                        <Link href="/admin/shops">
                            <Card className="hover:shadow-md transition-all border-l-4 border-l-blue-500 group cursor-pointer h-full">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600">
                                            <Store className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Shops</p>
                                            <p className="text-lg font-black">{adminCounts.pendingShops} Review</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                                </CardContent>
                            </Card>
                        </Link>
                    )}

                    {adminCounts.pendingWithdrawals > 0 && (
                        <Link href="/admin/shops/withdrawals">
                            <Card className="hover:shadow-md transition-all border-l-4 border-l-emerald-500 group cursor-pointer h-full">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg text-emerald-600">
                                            <Banknote className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Withdrawals</p>
                                            <p className="text-lg font-black">{adminCounts.pendingWithdrawals} Pending</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                                </CardContent>
                            </Card>
                        </Link>
                    )}

                    {adminCounts.pendingComplaints > 0 && (
                        <Link href="/admin/complaints">
                            <Card className="hover:shadow-md transition-all border-l-4 border-l-red-500 group cursor-pointer h-full">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg text-red-600">
                                            <MessageSquare className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Complaints</p>
                                            <p className="text-lg font-black">{adminCounts.pendingComplaints} Issues</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-red-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                                </CardContent>
                            </Card>
                        </Link>
                    )}

                    {adminCounts.pendingAfa > 0 && (
                        <Link href="/admin/afa-management">
                            <Card className="hover:shadow-md transition-all border-l-4 border-l-amber-500 group cursor-pointer h-full">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg text-amber-600">
                                            <BadgeCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">AFA Apps</p>
                                            <p className="text-lg font-black">{adminCounts.pendingAfa} Pending</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                                </CardContent>
                            </Card>
                        </Link>
                    )}

                    {adminCounts.expiringAgents > 0 && (
                        <Link href="/admin/memberships">
                            <Card className="hover:shadow-md transition-all border-l-4 border-l-purple-500 group cursor-pointer h-full">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600">
                                            <Crown className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Expired Agents</p>
                                            <p className="text-lg font-black">{adminCounts.expiringAgents} Soon</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-100 text-sm font-medium">Total Users</p>
                                <p className="text-3xl font-bold mt-1">{stats?.totalUsers}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <Users className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-100 text-sm font-medium">Total Orders</p>
                                <p className="text-3xl font-bold mt-1">{stats?.totalOrders}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-100 text-sm font-medium">Total Revenue</p>
                                <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.totalRevenue || 0)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <DollarSign className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-emerald-100 text-sm font-medium">Completed</p>
                                <p className="text-3xl font-bold mt-1">{stats?.completedOrders}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-indigo-100 text-sm font-medium">Success Rate</p>
                                <p className="text-3xl font-bold mt-1">{stats?.successRate}%</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#FACC15] text-[#1A1A1A] border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[#1A1A1A]/70 text-sm font-medium">Total Wallet Balance</p>
                                <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.totalWalletBalance || 0)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-[#1A1A1A]/10 flex items-center justify-center">
                                <Wallet className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-orange-100 text-sm font-medium">Pending Orders</p>
                                <p className="text-3xl font-bold mt-1">{stats?.pendingOrders}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <Clock className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-cyan-100 text-sm font-medium">Today's Orders</p>
                                <p className="text-3xl font-bold mt-1">{stats?.todayOrders}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Debt Widget — hidden when 0 */}
                {debtStats && debtStats.totalOwed > 0 && (
                    <Link href="/admin/top-up?tab=settlements">
                        <Card className={`bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 cursor-pointer hover:opacity-90 transition-opacity ${debtStats.totalOwed > 0 ? 'animate-pulse' : ''}`}>
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-amber-100 text-sm font-medium">Outstanding Debts</p>
                                        <p className="text-3xl font-bold mt-1">{formatCurrency(debtStats.totalOwed)}</p>
                                        <p className="text-xs text-amber-200 mt-1">{debtStats.pendingUsersCount} user{debtStats.pendingUsersCount !== 1 ? 's' : ''} owe you · View All →</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Scale className="w-6 h-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )}
            </div>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <a href="/admin/orders" className="p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-center">
                            <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                            <p className="font-medium">Manage Orders</p>
                        </a>
                        <a href="/admin/users" className="p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-center">
                            <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                            <p className="font-medium">Manage Users</p>
                        </a>
                        <a href="/admin/packages" className="p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-center">
                            <Wallet className="w-8 h-8 mx-auto mb-2 text-green-500" />
                            <p className="font-medium">Data Packages</p>
                        </a>
                        <a href="/admin/settings" className="p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-center">
                            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                            <p className="font-medium">Settings</p>
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
