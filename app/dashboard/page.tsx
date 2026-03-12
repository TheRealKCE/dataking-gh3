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
    Star,
    Store,
} from 'lucide-react'
import { useTutorial } from '@/hooks/useTutorial'
import { HelpButton } from '@/components/tutorial/HelpButton'
import { RoleGreetingBox } from '@/components/dashboard/RoleGreetingBox'
import { RecentOrdersWidget } from '@/components/dashboard/RecentOrdersWidget'
import { BusinessPerformanceWidget } from '@/components/dashboard/BusinessPerformanceWidget'
import { ShopDashboardSection } from '@/components/dashboard/ShopDashboardSection'
import { TodaysOrdersSummary } from '@/components/dashboard/TodaysOrdersSummary'

interface DashboardStats {
    totalOrders: number
    completedOrders: number
    processingOrders: number
    failedOrders: number
    pendingOrders: number
    walletBalance: number
}

interface ShopStatus {
    isLoading: boolean
    hasShop: boolean
    hasPricingConfigured: boolean
    isApproved: boolean
    shopId?: string
    shopName?: string
    wallet?: { balance: number; total_earned: number; total_withdrawn: number } | null
    graphData?: { created_at: string; selling_price: number; profit: number }[]
    orderStats?: {
        total: number
        completed: number
        pending: number
        processing: number
        failed: number
        revenue: number
        profit: number
    }
}


export default function DashboardPage() {
    const { dbUser } = useAuth()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [shopStatus, setShopStatus] = useState<ShopStatus>({
        isLoading: true, hasShop: false, hasPricingConfigured: false, isApproved: false
    })
    const userRole = dbUser?.role === 'agent' ? 'agent' : 'customer'
    const { hasSeenTutorial, startTutorial } = useTutorial(userRole as 'customer' | 'agent', '/dashboard')


    useEffect(() => {
        if (dbUser) {
            fetchDashboardData()
            fetchShopStatus()
        }
    }, [dbUser])

    // Auto-start tutorial for first-time users
    useEffect(() => {
        if (!isLoading && !hasSeenTutorial && dbUser) {
            // Delay 1 second for page to fully load
            const timer = setTimeout(() => {
                startTutorial()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [isLoading, hasSeenTutorial, dbUser, startTutorial])



    const fetchDashboardData = async () => {
        try {
            // Optimization: Use Supabase count functions to avoid fetching all rows
            // 1. Fetch orders stats counts (parallel to save time)
            const [
                totalRes,
                completedRes,
                processingRes,
                failedRes,
                pendingRes,
                walletRes
            ] = await Promise.all([
                supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', dbUser?.id as any).is('shop_order_id', null),
                supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', dbUser?.id as any).eq('status', 'completed').is('shop_order_id', null),
                supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', dbUser?.id as any).eq('status', 'processing').is('shop_order_id', null),
                supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', dbUser?.id as any).eq('status', 'failed').is('shop_order_id', null),
                supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', dbUser?.id as any).eq('status', 'pending').is('shop_order_id', null),
                supabase.from('wallets').select('balance').eq('user_id', dbUser?.id as any).single()
            ])

            setStats({
                totalOrders: totalRes.count || 0,
                completedOrders: completedRes.count || 0,
                processingOrders: processingRes.count || 0,
                failedOrders: failedRes.count || 0,
                pendingOrders: pendingRes.count || 0,
                walletBalance: (walletRes.data as any)?.balance || 0
            })
        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchShopStatus = async () => {
        // --- Stage 1: Fetch the shop profile in isolation ---
        // If this fails, we have no shop. If it succeeds, we lock in hasShop:true
        // so no secondary failure can ever hide the dashboard again.
        let shop: any = null
        try {
            const { data, error } = await (supabase as any)
                .from('shop_profiles')
                .select('id, approval_status, shop_slug, shop_name')
                .eq('owner_id', dbUser?.id)
                .maybeSingle()

            if (error) {
                if (error.code !== 'PGRST116') {
                    console.error('[ShopStatus] Database query error:', error)
                }
                setShopStatus({ isLoading: false, hasShop: false, hasPricingConfigured: false, isApproved: false })
                return
            }
            shop = data
        } catch (profileError) {
            console.error('[ShopStatus] Unexpected error fetching shop profile:', profileError)
            setShopStatus({ isLoading: false, hasShop: false, hasPricingConfigured: false, isApproved: false })
            return
        }

        if (!shop) {
            setShopStatus({ isLoading: false, hasShop: false, hasPricingConfigured: false, isApproved: false })
            return
        }

        // --- Stage 2: Shop exists — lock in hasShop:true with defaults ---
        const isApproved = shop.approval_status === 'approved'

        // Show dashboard immediately so users see it even if stats take time
        setShopStatus({
            isLoading: false,
            hasShop: true,
            hasPricingConfigured: false,
            isApproved,
            shopId: shop.id,
            shopName: shop.shop_name,
            wallet: null,
            graphData: [],
            orderStats: { total: 0, completed: 0, pending: 0, processing: 0, failed: 0, revenue: 0, profit: 0 },
            ...(shop.shop_slug && { shopSlug: shop.shop_slug })
        })

        // --- Stage 3: Fetch secondary data with allSettled so failures don't affect visibility ---
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const [pricingSettled, graphSettled, statsSettled, walletSettled] = await Promise.allSettled([
            (supabase as any).from('shop_pricing').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
            isApproved
                ? (supabase as any).from('shop_orders').select('created_at, selling_price, profit').eq('shop_id', shop.id).gte('created_at', thirtyDaysAgo.toISOString())
                : Promise.resolve({ data: [] }),
            isApproved
                ? Promise.all([
                    (supabase as any).from('shop_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id),
                    (supabase as any).from('shop_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'completed'),
                    (supabase as any).from('shop_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'pending'),
                    (supabase as any).from('shop_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'processing'),
                    (supabase as any).from('shop_orders').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'failed'),
                    (supabase as any).from('shop_orders').select('selling_price, profit').eq('shop_id', shop.id).eq('status', 'completed'),
                ])
                : Promise.resolve(null),
            isApproved
                ? (supabase as any).from('shop_wallets').select('*').eq('owner_id', dbUser?.id).single()
                : Promise.resolve({ data: null })
        ])

        const pricingRes = pricingSettled.status === 'fulfilled' ? pricingSettled.value : null
        const graphRes = graphSettled.status === 'fulfilled' ? graphSettled.value : null
        const orderStatsRes = statsSettled.status === 'fulfilled' ? statsSettled.value : null
        const walletRes = walletSettled.status === 'fulfilled' ? walletSettled.value : null

        const hasPricing = (pricingRes?.count || 0) > 0

        let orderStats = { total: 0, completed: 0, pending: 0, processing: 0, failed: 0, revenue: 0, profit: 0 }
        if (orderStatsRes) {
            const [totalR, completedR, pendingR, processingR, failedR, revenueR] = orderStatsRes as any[]
            const revenueRows: { selling_price: number; profit: number }[] = revenueR?.data || []
            orderStats = {
                total: totalR?.count || 0,
                completed: completedR?.count || 0,
                pending: pendingR?.count || 0,
                processing: processingR?.count || 0,
                failed: failedR?.count || 0,
                revenue: revenueRows.reduce((s: number, r: any) => s + (r.selling_price || 0), 0),
                profit: revenueRows.reduce((s: number, r: any) => s + (r.profit || 0), 0),
            }
        }

        // Update with enriched data
        setShopStatus({
            isLoading: false,
            hasShop: true,
            hasPricingConfigured: hasPricing,
            isApproved,
            shopId: shop.id,
            shopName: shop.shop_name,
            wallet: walletRes?.data || null,
            graphData: graphRes?.data || [],
            orderStats,
            ...(shop.shop_slug && { shopSlug: shop.shop_slug })
        })
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



    return (
        <div className="space-y-6">
            {/* Tutorial Help Button */}
            <div className="flex justify-end">
                <HelpButton onClick={startTutorial} />
            </div>

            {/* Dynamic Role Greeting Box */}
            <RoleGreetingBox stats={stats!} />

            {/* Main Wallet Balance Card moved to top as requested */}
            <Card id="wallet-card" className="overflow-hidden shadow-lg border-0 hover:shadow-xl transition-all duration-300">
                <div className="bg-[#FACC15] p-6 text-[#1A1A1A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="w-5 h-5 text-[#1A1A1A]/80" />
                            <p className="text-[#1A1A1A]/80 font-medium">Wallet Balance</p>
                        </div>
                        <p className="text-4xl md:text-5xl font-black tracking-tight">{formatCurrency(stats?.walletBalance || 0)}</p>
                    </div>
                    <Link href="/dashboard/wallet" className="w-full sm:w-auto">
                        <Button size="lg" className="w-full sm:w-auto bg-[#1A1A1A] hover:bg-black text-white border-0 shadow-lg rounded-xl font-bold h-12 px-8">
                            <Plus className="w-5 h-5 mr-2" />
                            Top Up Wallet
                        </Button>
                    </Link>
                </div>
            </Card>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/80 text-xs sm:text-sm font-medium">Total Orders</p>
                                <p className="text-xl md:text-2xl lg:text-3xl font-bold mt-1">{stats?.totalOrders}</p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/90 text-xs sm:text-sm font-medium">Completed</p>
                                <p className="text-xl md:text-2xl lg:text-3xl font-bold mt-1">{stats?.completedOrders}</p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-400 to-amber-500 text-black border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-black/80 text-xs sm:text-sm font-medium">Processing</p>
                                <p className="text-xl md:text-2xl lg:text-3xl font-bold mt-1">{stats?.processingOrders}</p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-600 to-red-800 text-white border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/80 text-xs sm:text-sm font-medium">Failed</p>
                                <p className="text-xl md:text-2xl lg:text-3xl font-bold mt-1">{stats?.failedOrders}</p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Premium Business Analytics Widget */}
            <BusinessPerformanceWidget />

            {/* Shop Dashboard Section */}
            <ShopDashboardSection
                isLoading={shopStatus.isLoading}
                hasShop={shopStatus.hasShop}
                hasPricingConfigured={shopStatus.hasPricingConfigured}
                isApproved={shopStatus.isApproved}
                shopId={shopStatus.shopId}
                shopName={shopStatus.shopName}
                shopSlug={(shopStatus as any).shopSlug}
                wallet={shopStatus.wallet}
                graphData={shopStatus.graphData}
                orderStats={shopStatus.orderStats}
            />

            {/* Today's Orders Summary */}
            <TodaysOrdersSummary />

            {/* Recent Orders Widget */}
            <RecentOrdersWidget />

            {/* Quick Actions (Moved to bottom) */}
            <Card className="border-0 shadow-sm mt-8">
                <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
                    <CardTitle className="text-lg font-bold">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div id="data-packages" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        <Link href="/dashboard/data-packages">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-center flex flex-col items-center">
                                <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <Package className="w-5 h-5 text-white" />
                                </div>
                                <p className="font-bold text-xs sm:text-sm">Buy Data</p>
                            </div>
                        </Link>
                        <Link href="/dashboard/my-orders">
                            <div id="order-history" className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-center flex flex-col items-center">
                                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <ShoppingCart className="w-5 h-5 text-white" />
                                </div>
                                <p className="font-bold text-xs sm:text-sm">Orders</p>
                            </div>
                        </Link>
                        <Link href="/dashboard/wallet">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-center flex flex-col items-center">
                                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <Wallet className="w-5 h-5 text-white" />
                                </div>
                                <p className="font-bold text-xs sm:text-sm">Top Up</p>
                            </div>
                        </Link>
                        <Link href="/dashboard/complaints">
                            <div id="complaint-button" className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-center flex flex-col items-center">
                                <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <AlertCircle className="w-5 h-5 text-white" />
                                </div>
                                <p className="font-bold text-xs sm:text-sm">Support</p>
                            </div>
                        </Link>
                        <Link href="/dashboard/afa-orders">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-center flex flex-col items-center">
                                <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <Star className="w-5 h-5 text-white" />
                                </div>
                                <p className="font-bold text-xs sm:text-sm">AFA Orders</p>
                            </div>
                        </Link>
                        <Link href="/dashboard/shop">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group text-center flex flex-col items-center">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <Store className="w-5 h-5 text-white" />
                                </div>
                                <p className="font-bold text-xs sm:text-sm">My Shop</p>
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>

        </div>
    )
}
