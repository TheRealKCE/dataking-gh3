'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    ShoppingCart,
    CheckCircle2,
    Clock,
    XCircle,
    Wallet,
    TrendingUp,
    ArrowRight,
    Package,
    AlertCircle,
    Plus,
    Banknote
} from 'lucide-react'

interface DashboardStats {
    totalOrders: number
    completedOrders: number
    processingOrders: number
    failedOrders: number
    pendingOrders: number
    successRate: number
    walletBalance: number
    totalSpent: number
}

interface RecentOrder {
    id: string
    phone_number: string
    network: string
    size: string
    price: number
    status: string
    created_at: string
}

export default function DashboardPage() {
    const { dbUser } = useAuth()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (dbUser) {
            fetchDashboardData()
        }
    }, [dbUser])

    const fetchDashboardData = async () => {
        try {
            const [ordersRes, walletRes, recentRes] = await Promise.all([
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
                    .single(),

                // Fetch recent orders
                supabase
                    .from('orders')
                    .select('id, phone_number, network, size, price, status, created_at')
                    .eq('user_id', dbUser?.id as any)
                    .order('created_at', { ascending: false })
                    .limit(5)
            ])

            const orders = ordersRes.data
            const wallet = walletRes.data
            const recent = recentRes.data

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
                successRate,
                walletBalance: (wallet as any)?.balance || 0,
                totalSpent,
            })
            setRecentOrders(recent || [])
        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'pending' | 'processing' | 'completed' | 'failed'> = {
            pending: 'pending',
            processing: 'processing',
            completed: 'completed',
            failed: 'failed',
        }
        return <Badge variant={variants[status] || 'pending'}>{status}</Badge>
    }

    const getNetworkBadge = (network: string) => {
        const variants: Record<string, 'mtn' | 'telecel' | 'airteltigo'> = {
            'MTN': 'mtn',
            'Telecel': 'telecel',
            'AT-iShare': 'airteltigo',
            'AT-BigTime': 'airteltigo',
        }
        return <Badge variant={variants[network] || 'secondary'}>{network}</Badge>
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-6">
                                <Skeleton className="h-4 w-24 mb-2" />
                                <Skeleton className="h-8 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-[#0056B3] text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/80 text-sm font-medium">Total Orders</p>
                                <p className="text-3xl font-bold mt-1">{stats?.totalOrders}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#25D366] text-black border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-black/70 text-sm font-medium">Completed</p>
                                <p className="text-3xl font-bold mt-1">{stats?.completedOrders}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-black/10 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#FFCE00] text-black border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-black/70 text-sm font-medium">Processing</p>
                                <p className="text-3xl font-bold mt-1">{stats?.processingOrders}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-black/10 flex items-center justify-center">
                                <Clock className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#E60000] text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/80 text-sm font-medium">Failed</p>
                                <p className="text-3xl font-bold mt-1">{stats?.failedOrders}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <XCircle className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-100 text-sm font-medium">Success Rate</p>
                                <p className="text-3xl font-bold mt-1">{stats?.successRate}%</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#E5E7EB] text-gray-900 border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-600 text-sm font-medium">Total Spent</p>
                                <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.totalSpent || 0)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gray-900/10 flex items-center justify-center">
                                <Banknote className="w-6 h-6" />
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
                                <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-800 hover:shadow-lg transition-all cursor-pointer group">
                                    <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Package className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="font-medium text-sm">Buy Data</p>
                                    <p className="text-xs text-muted-foreground">MTN, Telecel...</p>
                                </div>
                            </Link>
                            <Link href="/dashboard/my-orders">
                                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all cursor-pointer group">
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

            {/* Recent Orders */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Orders</CardTitle>
                    <Link href="/dashboard/my-orders">
                        <Button variant="ghost" size="sm">
                            View All <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    {recentOrders.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No orders yet</p>
                            <Link href="/dashboard/data-packages">
                                <Button className="mt-4" variant="outline">
                                    Buy Your First Data Package
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                            {order.network.slice(0, 2)}
                                        </div>
                                        <div>
                                            <p className="font-medium">{order.phone_number}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getNetworkBadge(order.network)}
                                                <span className="text-sm text-muted-foreground">{order.size}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{formatCurrency(order.price)}</p>
                                        <div className="mt-1">{getStatusBadge(order.status)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
