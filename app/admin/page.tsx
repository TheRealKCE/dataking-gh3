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
    AlertTriangle
} from 'lucide-react'

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

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            // Fetch users count
            const { count: usersCount } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })

            // Fetch orders
            const { data: orders } = await supabase
                .from('orders')
                .select('status, price, created_at')

            const totalOrders = orders?.length || 0
            const completedOrders = orders?.filter(o => o.status === 'completed').length || 0
            const pendingOrders = orders?.filter(o => o.status === 'pending' || o.status === 'processing').length || 0
            const totalRevenue = orders?.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.price, 0) || 0
            const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0

            // Today's orders
            const today = new Date().toISOString().split('T')[0]
            const todayOrders = orders?.filter(o => o.created_at.startsWith(today)).length || 0

            // Total wallet balance
            const { data: wallets } = await supabase
                .from('wallets')
                .select('balance')

            const totalWalletBalance = wallets?.reduce((sum, w) => sum + w.balance, 0) || 0

            setStats({
                totalUsers: usersCount || 0,
                totalOrders,
                completedOrders,
                pendingOrders,
                totalRevenue,
                totalWalletBalance,
                successRate,
                todayOrders,
            })
        } catch (error) {
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
            <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-muted-foreground">Overview of your platform statistics</p>
            </div>

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

                <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-amber-100 text-sm font-medium">Total Wallet Balance</p>
                                <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.totalWalletBalance || 0)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
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
