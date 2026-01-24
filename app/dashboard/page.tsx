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
    Plus
} from 'lucide-react'

interface DashboardStats {
    totalOrders: number
    completedOrders: number
    processingOrders: number
    failedOrders: number
    pendingOrders: number
    walletBalance: number
}



export default function DashboardPage() {
    const { dbUser } = useAuth()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (dbUser) {
            fetchDashboardData()
        }
    }, [dbUser])

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                <Card className="bg-[#0056B3] text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/80 text-sm font-medium">Total Orders</p>
                                <p className="text-2xl lg:text-3xl font-bold mt-1">{stats?.totalOrders}</p>
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
                                <p className="text-2xl lg:text-3xl font-bold mt-1">{stats?.completedOrders}</p>
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
                                <p className="text-2xl lg:text-3xl font-bold mt-1">{stats?.processingOrders}</p>
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
                                <p className="text-2xl lg:text-3xl font-bold mt-1">{stats?.failedOrders}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <XCircle className="w-6 h-6" />
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

        </div >
    )
}
