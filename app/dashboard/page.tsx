'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
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
    brandColor?: string
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
                .select('id, approval_status, shop_slug, shop_name, brand_color')
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
            brandColor: shop.brand_color,
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
                ? (supabase as any).from('shop_wallets').select('*').eq('owner_id', dbUser?.id).maybeSingle()
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
            brandColor: shop.brand_color,
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
        <div className="space-y-8 animate-slow-fade">
            {/* Header Section with Tutorial Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Dashboard</h2>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">Manage your business and track your performance</p>
                </div>
                <HelpButton onClick={startTutorial} />
            </div>

            {/* Dynamic Role Greeting Box */}
            <RoleGreetingBox stats={stats!} />

            {/* Premium Wallet & Business Card */}
            <div className="grid lg:grid-cols-3 gap-6">
                <Card id="wallet-card" className="lg:col-span-2 overflow-hidden border-0 shadow-blue-premium bg-gradient-to-br from-primary to-primary/80 group">
                    <CardContent className="p-8 relative">
                        {/* Decorative pattern */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/5 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                                        <Wallet className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-white font-black tracking-[0.2em] text-[10px] uppercase drop-shadow-md">Available Balance</p>
                                </div>
                                <p className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-lg">
                                    {formatCurrency(stats?.walletBalance || 0)}
                                </p>
                            </div>
                            
                            <Link href="/dashboard/wallet" className="w-full md:w-auto">
                                <Button className="w-full md:w-auto bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-black h-14 px-10 rounded-2xl shadow-xl shadow-black/10 text-lg transition-all hover:scale-[1.02] active:scale-95">
                                    <Plus className="w-6 h-6 mr-2 stroke-[3]" />
                                    Refill Wallet
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <Card className="card-premium p-8 flex flex-col justify-between group overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Store className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Quick Stats</p>
                        <h3 className="text-2xl font-black text-foreground mb-2">My Shop</h3>
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                            {shopStatus.hasShop ? `Managing "${shopStatus.shopName}"` : "You haven't set up your shop yet."}
                        </p>
                    </div>
                    <Link href="/dashboard/shop" className="relative z-10 mt-6">
                        <Button variant="secondary" className="w-full font-bold rounded-xl h-12">
                            {shopStatus.hasShop ? "Go to Shop Profile" : "Create My Shop"}
                        </Button>
                    </Link>
                </Card>
            </div>

            {/* Core Stats Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: 'Total Orders', value: stats?.totalOrders, icon: ShoppingCart, color: 'bg-blue-500', text: 'text-blue-500' },
                    { label: 'Completed', value: stats?.completedOrders, icon: CheckCircle2, color: 'bg-emerald-500', text: 'text-emerald-500' },
                    { label: 'Processing', value: stats?.processingOrders, icon: Clock, color: 'bg-amber-500', text: 'text-amber-500' },
                    { label: 'Failed', value: stats?.failedOrders, icon: XCircle, color: 'bg-red-500', text: 'text-red-500' },
                ].map((stat, idx) => (
                    <Card key={idx} className="card-premium group hover:border-primary/50 shadow-md hover:shadow-xl transition-all duration-300">
                        <CardContent className="p-6">
                            <div className="flex flex-col gap-4">
                                <div className={cn("w-14 h-14 rounded-[1.25rem] flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform", stat.color)}>
                                    <stat.icon className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">{stat.label}</p>
                                    <p className="text-3xl font-black text-foreground mt-1 tracking-tight drop-shadow-sm">{stat.value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Business Performance & Recent Activity */}
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <BusinessPerformanceWidget />
                    <RecentOrdersWidget />
                </div>
                <div className="space-y-8">
                    <TodaysOrdersSummary />
                    
                    {/* Simplified Quick Actions */}
                    <Card className="card-premium">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-black tracking-tight">Quick Links</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {[
                                { href: '/dashboard/data-packages', label: 'Buy Data Bundles', icon: Package },
                                { href: '/dashboard/wallet', label: 'Wallet History', icon: Wallet },
                                { href: '/dashboard/complaints', label: 'Help & Support', icon: AlertCircle },
                                { href: '/dashboard/shop', label: 'Store Settings', icon: Store },
                            ].map((link, i) => (
                                <Link key={i} href={link.href}>
                                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors group cursor-pointer">
                                        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                            <link.icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors">{link.label}</span>
                                    </div>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Shop Management (If applicable) */}
            <ShopDashboardSection
                isLoading={shopStatus.isLoading}
                hasShop={shopStatus.hasShop}
                hasPricingConfigured={shopStatus.hasPricingConfigured}
                isApproved={shopStatus.isApproved}
                shopId={shopStatus.shopId}
                shopName={shopStatus.shopName}
                brandColor={shopStatus.brandColor}
                shopSlug={(shopStatus as any).shopSlug}
                wallet={shopStatus.wallet}
                graphData={shopStatus.graphData}
                orderStats={shopStatus.orderStats}
            />
        </div>
    )
}
