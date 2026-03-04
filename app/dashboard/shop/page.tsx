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
    AlertCircle, ExternalLink, Copy, Check, Lightbulb, Filter, RefreshCcw, Crown,
    MessageCircle, Loader2, X
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
    pricing_status: 'not_submitted' | 'pending_review' | 'approved' | 'rejected'
}

interface ShopWallet {
    balance: number
    total_earned: number
    total_withdrawn: number
}

interface ShopStats {
    total_orders: number
    completed_orders: number
    pending_orders: number
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
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [copied, setCopied] = useState(false)

    // Announcement state
    const [shopAnnouncement, setShopAnnouncement] = useState<{ id: string; message: string; is_active: boolean } | null>(null)
    const [annMsg, setAnnMsg] = useState('')
    const [isSavingAnn, setIsSavingAnn] = useState(false)
    const [adminAnnActive, setAdminAnnActive] = useState(false)

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

            // Calculate stats
            const pending = orders.filter((o: any) => o.status === 'pending')
            const completed = orders.filter((o: any) => o.status === 'completed')
            const processing = orders.filter((o: any) => o.status === 'processing')
            const failed = orders.filter((o: any) => o.status === 'failed')

            const earningStatuses = ['pending', 'processing', 'completed']
            const earningsOrders = orders.filter((o: any) => earningStatuses.includes(o.status))

            setStats({
                total_orders: orders.length,
                completed_orders: completed.length,
                pending_orders: pending.length,
                processing_orders: processing.length,
                failed_orders: failed.length,
                total_revenue: earningsOrders.reduce((sum: number, o: any) => sum + (o.selling_price || 0), 0),
                total_profit: earningsOrders.reduce((sum: number, o: any) => sum + (o.profit || 0), 0),
            })
        } catch (err) {
            console.error('Error fetching shop data:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchShopAnnouncement = async () => {
        try {
            const res = await fetch('/api/shop/announcements')
            const data = await res.json()
            if (data.announcement) {
                setShopAnnouncement(data.announcement)
                setAnnMsg(data.announcement.message)
            }

            // Also check if admin has one active to show "Locked" state
            const { data: adminAnn } = await supabase
                .from('system_announcements')
                .select('id')
                .eq('is_active', true)
                .in('visible_on', ['storefronts', 'both'])
                .limit(1)
                .maybeSingle()

            setAdminAnnActive(!!adminAnn)
        } catch (err) {
            console.error('Error fetching announcement:', err)
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await fetchShopData()
        setIsRefreshing(false)
        toast.success('Dashboard updated')
    }

    useEffect(() => {
        if (dbUser && !isAdmin && !isSubAdmin && dbUser?.role !== 'agent') {
            router.replace('/dashboard')
            return
        }
        if (dbUser) {
            fetchShopData()
            fetchShopAnnouncement()
        }
    }, [dbUser, isAdmin, isSubAdmin, filter])

    const shopUrl = shop ? `https://kingflexygh.com/shop/${shop.shop_slug}` : ''

    const copyLink = async () => {
        await navigator.clipboard.writeText(shopUrl)
        setCopied(true)
        toast.success('Shop link copied!')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSaveAnnouncement = async () => {
        if (!annMsg.trim()) {
            toast.error('Message cannot be empty')
            return
        }
        setIsSavingAnn(true)
        try {
            const res = await fetch('/api/shop/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: annMsg })
            })
            const data = await res.json()
            if (res.ok) {
                setShopAnnouncement(data.announcement)
                toast.success('Storefront announcement updated!')
            } else {
                toast.error(data.message || 'Failed to update announcement')
            }
        } catch (err) {
            toast.error('Failed to update announcement')
        } finally {
            setIsSavingAnn(false)
        }
    }

    const handleToggleAnnouncement = async () => {
        setIsSavingAnn(true)
        try {
            const res = await fetch('/api/shop/announcements', {
                method: 'DELETE'
            })
            if (res.ok) {
                setShopAnnouncement(prev => prev ? { ...prev, is_active: false } : null)
                toast.success('Announcement deactivated')
            } else {
                toast.error('Failed to deactivate')
            }
        } catch (err) {
            toast.error('Failed to deactivate')
        } finally {
            setIsSavingAnn(false)
        }
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

    const daysLeft = dbUser?.agent_expires_at
        ? Math.ceil((new Date(dbUser.agent_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0

    const isPermanentAgent = dbUser?.role === 'agent' && dbUser?.agent_expires_at === null

    const cfg = statusConfig[shop.approval_status]
    const StatusIcon = cfg?.icon || Clock
    const isPending = shop.approval_status === 'pending'

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 animate-in fade-in zoom-in duration-500">
                        <Store className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {shop.shop_name}
                        </h1>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm', statusConfig[shop.approval_status]?.color)}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusConfig[shop.approval_status]?.label}
                            </span>
                            {dbUser?.role === 'agent' && (
                                isPermanentAgent ? (
                                    <div className="space-y-1.5 min-w-[200px]">
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-slate-900 to-black text-yellow-400 rounded-full text-[11px] font-black shadow-[0_2px_10px_-3px_rgba(0,0,0,0.5)] border border-slate-700 transition-all hover:scale-105 active:scale-95 cursor-default w-fit">
                                            <Crown className="w-3.5 h-3.5 fill-yellow-500 text-yellow-600" />
                                            LIFETIME ACTIVE
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-tight max-w-[250px] font-medium">
                                            You have permanent access to the agent role. Your shop will never expire.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 min-w-[200px]">
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm transition-colors w-fit",
                                            daysLeft <= 3
                                                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 animate-pulse"
                                                : daysLeft <= 7
                                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                                                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                                        )}>
                                            <Clock className="w-3.5 h-3.5" />
                                            {daysLeft <= 0 ? 'Subscription Expired' : `${daysLeft} Days Left`}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-tight max-w-[250px] font-medium">
                                            <AlertCircle className="w-3 h-3 inline mr-1 text-amber-500" />
                                            When expired, your shop will be <strong>deactivated</strong> and you'll lose access to <strong>wholesale pricing</strong>.
                                        </p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap sm:justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-9"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshCcw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                        Refresh
                    </Button>

                    {!isPermanentAgent && (
                        <Link href="/dashboard/upgrade">
                            <Button
                                size="sm"
                                className={cn(
                                    "gap-1.5 h-9 transition-all active:scale-95 shadow-md",
                                    daysLeft <= 7
                                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                                        : "bg-blue-600 hover:bg-blue-700 text-white"
                                )}
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Renew Subscription
                            </Button>
                        </Link>
                    )}

                    <Link href="/dashboard/shop/setup">
                        <Button variant="outline" size="sm" className="gap-1.5 h-9">
                            <Settings className="w-4 h-4" /> Edit Shop
                        </Button>
                    </Link>
                    <div className={cn("flex gap-2", isPending && "opacity-40 pointer-events-none grayscale")}>
                        <Link href="/dashboard/shop/pricing">
                            <Button variant="outline" size="sm" className="gap-1.5 h-9">
                                <Tag className="w-4 h-4" /> Pricing
                            </Button>
                        </Link>
                        <Link href="/dashboard/shop/withdraw">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9">
                                <Banknote className="w-4 h-4" /> Withdraw
                            </Button>
                        </Link>
                    </div>

                    {/* Pricing Status Indicators */}
                    {shop.pricing_status === 'pending_review' && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800 shadow-sm">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold whitespace-nowrap">Review Pricing</span>
                        </div>
                    )}

                    {shop.pricing_status === 'approved' && (
                        <div className="flex flex-col items-start md:items-end -my-1">
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 mb-0.5 shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">Pricing Approved</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline-block animate-pulse">
                                Share link to earn profit 🚀
                            </span>
                        </div>
                    )}
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

            {/* Shop Wallet & Announcement */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className={cn("overflow-hidden border-0 shadow-md h-full", isPending && "opacity-40 grayscale pointer-events-none")}>
                    <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white h-full flex flex-col justify-between">
                        <div>
                            <p className="text-emerald-100 text-sm font-medium mb-1">Profit Balance</p>
                            <p className="text-4xl font-black mb-4">{formatCurrency(wallet?.balance || 0)}</p>
                        </div>
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

                <Card className={cn("overflow-hidden border shadow-sm h-full", isPending && "opacity-40 grayscale pointer-events-none")}>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-emerald-600" />
                            <CardTitle className="text-base">Storefront Announcement</CardTitle>
                        </div>
                        {shopAnnouncement?.is_active && !adminAnnActive && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none text-[10px]">Active</Badge>
                        )}
                        {adminAnnActive && (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px] animate-pulse">Paused by Admin</Badge>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <textarea
                                className={cn(
                                    "w-full min-h-[100px] p-3 text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-none",
                                    adminAnnActive && "opacity-60 grayscale cursor-not-allowed"
                                )}
                                placeholder="E.g. We are open for bulk orders! Fast delivery guaranteed."
                                value={annMsg}
                                onChange={(e) => setAnnMsg(e.target.value)}
                                disabled={adminAnnActive || isSavingAnn}
                            />
                            {adminAnnActive && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-white/90 dark:bg-black/80 px-4 py-2 rounded-lg border border-amber-100 dark:border-amber-900 shadow-sm">
                                        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            Admin announcement active
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                onClick={handleSaveAnnouncement}
                                disabled={adminAnnActive || isSavingAnn || !annMsg.trim()}
                            >
                                {isSavingAnn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                                {shopAnnouncement ? 'Update Announcement' : 'Set Announcement'}
                            </Button>
                            {shopAnnouncement?.is_active && !adminAnnActive && (
                                <Button
                                    variant="outline"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold"
                                    onClick={handleToggleAnnouncement}
                                    disabled={isSavingAnn}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

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
                        { label: 'Pending', value: stats?.pending_orders || 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                        { label: 'Processing', value: stats?.processing_orders || 0, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                        { label: 'Completed', value: stats?.completed_orders || 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                        { label: 'Total Revenue', value: formatCurrency(stats?.total_revenue || 0), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
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
