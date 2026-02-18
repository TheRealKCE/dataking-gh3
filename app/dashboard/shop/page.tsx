'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Store, Wallet, TrendingUp, ShoppingCart, ArrowRight,
    Settings, Tag, Banknote, Clock, CheckCircle2, XCircle,
    AlertCircle, ExternalLink, Copy, Check, Lightbulb, Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ShopProfile {
    id: string
    shop_name: string
    shop_slug: string
    description: string
    approval_status: 'pending' | 'approved' | 'rejected' | 'suspended'
    approval_note: string | null
    is_active: boolean
    owner_phone: string
    whatsapp_number: string | null
    logo_url: string | null
    brand_color: string
}

interface ShopWallet {
    balance: number
    total_earned: number
    total_withdrawn: number
}

interface ShopStats {
    total_orders: number
    completed_orders: number
    processing_orders: number
    failed_orders: number
    total_revenue: number
    total_profit: number
}

interface RecentOrder {
    id: string
    guest_phone: string
    network: string
    package_size: string
    selling_price: number
    profit: number
    status: string
    created_at: string
}

const statusConfig = {
    pending: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
    approved: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    suspended: { label: 'Suspended', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
}

const orderStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
    refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
}

export default function ShopOverviewPage() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()
    const [shop, setShop] = useState<ShopProfile | null>(null)
    const [wallet, setWallet] = useState<ShopWallet | null>(null)
    const [stats, setStats] = useState<ShopStats | null>(null)
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
    const [filter, setFilter] = useState<'today' | '7d' | '30d' | 'all'>('today')
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (dbUser && !isAdmin && !isSubAdmin) {
            router.replace('/dashboard')
            return
        }
        if (dbUser) fetchShopData()
    }, [dbUser, isAdmin, isSubAdmin, filter])

    const fetchShopData = async () => {
        try {
            // Fetch shop profile
            const { data: shopData } = await ((supabase as any)
                .from('shop_profiles')
                .select('*')
                .eq('owner_id', dbUser!.id)
                .single())

            if (!shopData) {
                setLoading(false)
                return
            }
            setShop(shopData)

            // Determine date range for stats and orders
            let query = (supabase as any)
                .from('shop_orders')
                .select('*')
                .eq('shop_id', shopData.id)
                .neq('status', 'pending') // Always exclude unpaid pending orders

            const now = new Date()
            if (filter === 'today') {
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
                query = query.gte('created_at', startOfDay)
            } else if (filter === '7d') {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
                query = query.gte('created_at', sevenDaysAgo)
            } else if (filter === '30d') {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
                query = query.gte('created_at', thirtyDaysAgo)
            }

            // Fetch wallet, stats, and filtered orders in parallel
            const [walletRes, ordersRes] = await Promise.all([
                ((supabase as any).from('shop_wallets').select('*').eq('owner_id', dbUser!.id).single()),
                query.order('created_at', { ascending: false }),
            ])

            if (walletRes.data) setWallet(walletRes.data)

            const orders = ordersRes.data || []
            setRecentOrders(orders)

            // Calculate stats based on non-pending filtered orders
            const completed = orders.filter((o: any) => o.status === 'completed')
            const processing = orders.filter((o: any) => o.status === 'processing')
            const failed = orders.filter((o: any) => o.status === 'failed')

            setStats({
                total_orders: orders.length,
                completed_orders: completed.length,
                processing_orders: processing.length,
                failed_orders: failed.length,
                total_revenue: completed.reduce((sum: number, o: any) => sum + (o.selling_price || 0), 0),
                total_profit: completed.reduce((sum: number, o: any) => sum + (o.profit || 0), 0),
            })
        } catch (err) {
            console.error('Error fetching shop data:', err)
        } finally {
            setLoading(false)
        }
    }

    const shopUrl = shop ? `https://kingflexygh.com/shop/${shop.shop_slug}` : ''

    const copyLink = async () => {
        await navigator.clipboard.writeText(shopUrl)
        setCopied(true)
        toast.success('Shop link copied!')
        setTimeout(() => setCopied(false), 2000)
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
                </div>
                <Skeleton className="h-64" />
            </div>
        )
    }

    // No shop yet
    if (!shop) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
                <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Store className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold mb-2">Set Up Your Shop</h2>
                    <p className="text-muted-foreground max-w-sm">
                        Create your reseller storefront and start earning profit on every data bundle sale.
                    </p>
                </div>
                <Link href="/dashboard/shop/setup">
                    <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                        <Store className="w-5 h-5" />
                        Create My Shop
                    </Button>
                </Link>
            </div>
        )
    }

    const StatusIcon = statusConfig[shop.approval_status]?.icon || Clock
    const isPending = shop.approval_status === 'pending'

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Store className="w-6 h-6 text-emerald-600" />
                        {shop.shop_name}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full', statusConfig[shop.approval_status]?.color)}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig[shop.approval_status]?.label}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Link href="/dashboard/shop/setup">
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Settings className="w-4 h-4" /> Edit Shop
                        </Button>
                    </Link>
                    <div className={cn("flex gap-2", isPending && "opacity-40 pointer-events-none grayscale")}>
                        <Link href="/dashboard/shop/pricing">
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Tag className="w-4 h-4" /> Pricing
                            </Button>
                        </Link>
                        <Link href="/dashboard/shop/withdraw">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                                <Banknote className="w-4 h-4" /> Withdraw
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Approval notice */}
            {shop.approval_status === 'pending' && (
                <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex gap-3">
                    <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">Awaiting Admin Approval</p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">Your shop is under review. You'll be notified once it's approved and live.</p>
                    </div>
                </div>
            )}
            {(shop.approval_status === 'rejected' || shop.approval_status === 'suspended') && shop.approval_note && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-red-800 dark:text-red-300 text-sm">
                            {shop.approval_status === 'suspended' ? 'Shop Suspended' : 'Shop Rejected'}
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{shop.approval_note}</p>
                    </div>
                </div>
            )}

            {/* Shop link */}
            {shop.approval_status === 'approved' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-muted-foreground flex-1 truncate font-mono">{shopUrl}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={copyLink}>
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <a href={shopUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </a>
                </div>
            )}

            {/* Profit Tip */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex gap-3">
                <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-semibold mb-1">How Profit Works</p>
                    <p className="text-blue-700 dark:text-blue-400 leading-relaxed">
                        You earn profit on every <strong>completed</strong> order made through your shop link.
                        Profit is calculated as: <code>Selling Price - Cost Price</code>.
                        Funds are credited to your Profit Balance instantly upon order completion.
                    </p>
                </div>
            </div>

            {/* Shop Wallet */}
            <Card className={cn("overflow-hidden border-0 shadow-md", isPending && "opacity-40 grayscale pointer-events-none")}>
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white">
                    <p className="text-emerald-100 text-sm font-medium mb-1">Profit Balance</p>
                    <p className="text-4xl font-black mb-4">{formatCurrency(wallet?.balance || 0)}</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/10 rounded-xl p-3">
                            <p className="text-emerald-100 text-xs mb-0.5">Total Earned</p>
                            <p className="text-white font-bold">{formatCurrency(wallet?.total_earned || 0)}</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3">
                            <p className="text-emerald-100 text-xs mb-0.5">Total Withdrawn</p>
                            <p className="text-white font-bold">{formatCurrency(wallet?.total_withdrawn || 0)}</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Stats */}
            <div className={cn("space-y-4", isPending && "opacity-40 grayscale pointer-events-none")}>
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Performance Stats
                    </h3>
                    <div className="flex bg-muted rounded-lg p-1">
                        {[
                            { id: 'today', label: 'Today' },
                            { id: '7d', label: '7 Days' },
                            { id: '30d', label: '30 Days' },
                            { id: 'all', label: 'All Time' },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id as any)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                    filter === f.id ? "bg-white dark:bg-gray-800 shadow-sm text-emerald-600" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                        { label: 'Total Orders', value: stats?.total_orders || 0, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                        { label: 'Processing', value: stats?.processing_orders || 0, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                        { label: 'Completed', value: stats?.completed_orders || 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                        { label: 'Total Revenue', value: formatCurrency(stats?.total_revenue || 0), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                        { label: 'Total Profit', value: formatCurrency(stats?.total_profit || 0), icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    ].map((stat) => (
                        <Card key={stat.label} className="border shadow-sm">
                            <CardContent className="p-4">
                                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', stat.bg)}>
                                    <stat.icon className={cn('w-5 h-5', stat.color)} />
                                </div>
                                <p className="text-xs text-muted-foreground">{stat.label}</p>
                                <p className="text-lg font-bold mt-0.5">{stat.value}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Recent Orders */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">Order History</CardTitle>
                    <span className="text-xs text-muted-foreground">
                        {filter === 'today' ? 'Showing Today' :
                            filter === '7d' ? 'Last 7 Days' :
                                filter === '30d' ? 'Last 30 Days' : 'All Time'}
                    </span>
                </CardHeader>
                <CardContent className="p-0">
                    {recentOrders.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No orders yet. Share your shop link to get started!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                        <th className="text-left px-4 py-2 font-medium">Phone</th>
                                        <th className="text-left px-4 py-2 font-medium">Package</th>
                                        <th className="text-right px-4 py-2 font-medium">Price</th>
                                        <th className="text-right px-4 py-2 font-medium">Profit</th>
                                        <th className="text-left px-4 py-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentOrders.map((order) => (
                                        <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs">{order.guest_phone}</td>
                                            <td className="px-4 py-3 text-xs">{order.network} {order.package_size}</td>
                                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(order.selling_price)}</td>
                                            <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatCurrency(order.profit)}</td>
                                            <td className="px-4 py-3">
                                                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', orderStatusConfig[order.status]?.color)}>
                                                    {orderStatusConfig[order.status]?.label || order.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
