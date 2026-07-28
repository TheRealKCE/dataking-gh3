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
        // --- Stage 1: Fetch the shop profile in isolation ---
        // Once a profile is found, we set the shop immediately so user sees shop UI.
        let shopData: any = null
        try {
            const { data, error } = await ((supabase as any)
                .from('shop_profiles')
                .select('*')
                .eq('owner_id', dbUser!.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle())

            if (error) throw error
            shopData = data
        } catch (profileErr) {
            console.error('[ShopPage] Failed to fetch shop profile:', profileErr)
            setLoading(false)
            return
        }

        if (!shopData) {
            setLoading(false)
            return
        }

        // --- Stage 2: Shop found — render it immediately ---
        setShop(shopData)

        // --- Stage 3: Fetch secondary data (wallet, orders) with allSettled ---
        // Failures here never hide the shop dashboard.
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

        const [walletSettled, ordersSettled] = await Promise.allSettled([
            (supabase as any).from('shop_wallets').select('*').eq('owner_id', dbUser!.id).maybeSingle(),
            query.order('created_at', { ascending: false }),
        ])

        if (walletSettled.status === 'fulfilled' && walletSettled.value?.data) {
            setWallet(walletSettled.value.data)
        }

        const orders = (ordersSettled.status === 'fulfilled' ? ordersSettled.value?.data : null) || []
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

        setLoading(false)
    }

    const fetchShopAnnouncement = async (signal?: AbortSignal) => {
        try {
            const res = await fetch('/api/shop/announcements', { signal })
            if (signal?.aborted) return
            const data = await res.json()
            if (data.announcement) {
                setShopAnnouncement(data.announcement)
                setAnnMsg(data.announcement.message)
            }

            // Also check if admin has one active to show "Locked" state
            const { data: adminAnn, error: adminAnnError } = await supabase
                .from('system_announcements')
                .select('id')
                .eq('is_active', true)
                .in('visible_on', ['storefronts', 'both'])
                .limit(1)
                .maybeSingle()

            if (adminAnnError?.message?.includes('AbortError')) return
            setAdminAnnActive(!!adminAnn)
        } catch (err: any) {
            // Silently ignore abort errors — they are expected on unmount/re-render
            if (err?.name === 'AbortError' || err?.message?.includes('AbortError') || err?.message?.includes('aborted')) return
            console.error('Error fetching announcements:', err)
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await fetchShopData()
        setIsRefreshing(false)
        toast.success('Dashboard updated')
    }

    useEffect(() => {
        // Shop feature is available to all authenticated users
        if (dbUser) {
            fetchShopData()
            const controller = new AbortController()
            fetchShopAnnouncement(controller.signal)
            return () => controller.abort()
        }
    }, [dbUser, isAdmin, isSubAdmin, filter])

    const shopUrl = shop ? `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/shop/${shop.shop_slug}` : ''

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
    const shopIsLive = shop.approval_status === 'approved' && shop.pricing_status === 'approved' && shop.is_active

    return (
        <div className="space-y-6 pb-20 md:pb-6">
            {/* --- PREMIUM HERO HEADER --- */}
            <div className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 shadow-sm">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-emerald-500/20 via-emerald-400/5 to-transparent dark:from-emerald-900/40 dark:via-emerald-900/10 pointer-events-none" />
                <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-emerald-400/10 blur-3xl rounded-full pointer-events-none" />
                
                <div className="p-6 sm:p-8 relative z-10 w-full">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/20 flex items-center justify-center flex-shrink-0 border border-emerald-200/50 dark:border-emerald-800/50 shadow-inner">
                                <Store className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">{shop.shop_name}</h1>
                                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                    <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full shadow-sm', statusConfig[shop.approval_status]?.color)}>
                                        <StatusIcon className="w-3.5 h-3.5" />
                                        {statusConfig[shop.approval_status]?.label}
                                    </span>
                                    {dbUser?.role === 'agent' && (
                                        isPermanentAgent ? (
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-slate-900 to-black text-yellow-400 rounded-full text-xs font-black border border-slate-800">
                                                <Crown className="w-3.5 h-3.5 fill-yellow-500" /> LIFETIME
                                            </div>
                                        ) : (
                                            <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm", daysLeft <= 3 ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                                                <Clock className="w-3.5 h-3.5" /> {daysLeft <= 0 ? 'Expired' : `${daysLeft} Days Left`}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="hidden md:flex flex-wrap items-center gap-3 bg-gray-50/50 dark:bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200/50 dark:border-gray-800/50">
                            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-9 gap-2 rounded-xl">
                                <RefreshCcw className={cn("w-4 h-4 text-emerald-600", isRefreshing && "animate-spin")} /> Sync
                            </Button>
                            <Link href="/dashboard/shop/setup"><Button variant="ghost" size="sm" className="h-9 gap-2 rounded-xl"><Settings className="w-4 h-4 text-blue-600" /> Edit</Button></Link>
                            <div className={cn("flex items-center gap-2", isPending && "opacity-40 pointer-events-none")}>
                                <div className="h-5 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
                                <Link href="/dashboard/shop/pricing"><Button variant="ghost" size="sm" className="h-9 gap-2 rounded-xl"><Tag className="w-4 h-4 text-purple-600" /> Pricing</Button></Link>
                                <Link href="/dashboard/shop/withdraw"><Button size="sm" className="h-9 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Withdraw</Button></Link>
                            </div>
                        </div>
                    </div>

                    {shopIsLive && (
                         <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-2xl bg-emerald-50/50 dark:bg-emerald-950/20 p-2 sm:pl-4 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/50 backdrop-blur-sm">
                            <span className="text-sm font-mono text-emerald-800 dark:text-emerald-300 truncate w-full px-2 text-center sm:text-left">{shopUrl}</span>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Button onClick={copyLink} variant="secondary" className="flex-1 sm:flex-none h-10 sm:h-9 bg-white dark:bg-zinc-900 text-emerald-600 gap-2 rounded-xl font-bold">
                                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied!' : 'Copy Link'}
                                </Button>
                                <a href={shopUrl} target="_blank" rel="noopener noreferrer" aria-label="Go to live storefront"><Button className="w-full sm:w-auto h-10 sm:h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-bold"><ExternalLink className="w-4 h-4" /> Go to Live</Button></a>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- NEXT STEP GUIDANCE BANNER --- */}
            {!shopIsLive && shop.approval_status === 'approved' && (() => {
                if (!shop.is_active && shop.pricing_status === 'approved') {
                    return (
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <XCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-amber-900 dark:text-amber-200">Your shop is set to Closed</p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Customers cannot visit your storefront. Toggle it to <strong>Open</strong> in your shop settings to go live.</p>
                            </div>
                            <Link href="/dashboard/shop/setup" className="shrink-0">
                                <Button size="sm" className="h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl gap-1.5">
                                    <Settings className="w-3.5 h-3.5" /> Open Shop
                                </Button>
                            </Link>
                        </div>
                    )
                }
                if (shop.pricing_status === 'pending_review') {
                    return (
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-blue-900 dark:text-blue-200">Pricing is under review</p>
                                <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">An admin is reviewing your submitted prices. Your shop will go live automatically once approved.</p>
                            </div>
                        </div>
                    )
                }
                // not_submitted or rejected
                return (
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Tag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-emerald-900 dark:text-emerald-200">One more step — set your prices</p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">Your shop profile is approved. Configure your selling prices to make your storefront live and start earning.</p>
                        </div>
                        <Link href="/dashboard/shop/pricing" className="shrink-0">
                            <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-1.5">
                                <Tag className="w-3.5 h-3.5" /> Set Prices
                            </Button>
                        </Link>
                    </div>
                )
            })()}

            {/* --- RECRUIT SUB-AGENTS --- */}
            {shop.approval_status === 'approved' && <SubAgentInviteCard />}

            {/* --- SMART STATS --- */}
            <div className={cn("space-y-3", isPending && "opacity-50 pointer-events-none")}>
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Performance</h3>
                    <div className="flex bg-gray-100 dark:bg-zinc-900 rounded-xl p-1">
                        {['today', '7d', '30d', 'all'].map((f) => (
                            <button key={f} onClick={() => setFilter(f as any)} className={cn("px-3 py-1 text-[11px] font-bold rounded-lg", filter === f ? "bg-white shadow-sm text-emerald-600" : "text-gray-500")}>{f.toUpperCase()}</button>
                        ))}
                    </div>
                </div>
                <div className="flex overflow-x-auto pb-4 gap-4 snap-x">
                     <div className="min-w-[200px] flex-1 bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 rounded-3xl text-white shadow-md relative overflow-hidden">
                         <p className="text-emerald-100 text-xs font-bold mb-1 opacity-90">TOTAL SALES</p>
                         <p className="text-3xl font-black">{formatCurrency(stats?.total_revenue || 0)}</p>
                     </div>
                     <div className="min-w-[240px] flex-1 bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                        <div className="relative w-16 h-16 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-100 dark:stroke-zinc-800" strokeWidth="4" />
                                {stats && stats.total_orders > 0 && (
                                    <circle cx="18" cy="18" r="16" fill="none" className="stroke-emerald-500" strokeWidth="4" strokeDasharray={`${(stats.completed_orders / stats.total_orders) * 100} 100`} />
                                )}
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center font-black">{stats?.total_orders || 0}</div>
                        </div>
                        <div className="flex-1 space-y-1">
                           <div className="flex justify-between text-[10px] font-bold text-emerald-600"><span>Success</span><span>{stats?.completed_orders || 0}</span></div>
                           <div className="flex justify-between text-[10px] font-bold text-yellow-600"><span>Pending</span><span>{stats?.pending_orders || 0}</span></div>
                           <div className="flex justify-between text-[10px] font-bold text-red-500"><span>Failed</span><span>{stats?.failed_orders || 0}</span></div>
                        </div>
                     </div>
                </div>
            </div>

            {/* --- CORE CONTENT --- */}
            <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6", isPending && "opacity-50 pointer-events-none")}>
                <div className="lg:col-span-4 space-y-6">
                    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-zinc-900 to-black p-8 text-white shadow-xl border border-zinc-800">
                         <div className="absolute top-0 left-[-100%] w-[150%] h-full bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 animate-sheen pointer-events-none" />
                         <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Available Profit</p>
                         <p className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-emerald-500">{formatCurrency(wallet?.balance || 0)}</p>
                         <div className="mt-8">
                             <Button asChild className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl h-12 shadow-[0_0_20px_rgba(16,185,129,0.3)] border-0">
                                 <Link href="/dashboard/shop/withdraw">Withdraw Earnings <ArrowRight className="w-4 h-4 ml-2" /></Link>
                             </Button>
                         </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
                        <div className="flex items-center gap-2 font-bold text-sm"><MessageCircle className="w-4 h-4 text-emerald-600" /> Storefront Notice</div>
                        <textarea aria-label="Storefront Notice" placeholder="Write a notice for your storefront..." className="w-full min-h-[100px] p-3 text-sm rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 focus:ring-1 focus:ring-emerald-500" value={annMsg} onChange={(e) => setAnnMsg(e.target.value)} disabled={adminAnnActive} />
                        <Button className="w-full bg-black text-white rounded-xl h-10 font-bold" onClick={handleSaveAnnouncement} disabled={adminAnnActive || !annMsg.trim()}>Save Notice</Button>
                    </div>
                </div>

                <div className="lg:col-span-8">
                    <div className="bg-white dark:bg-zinc-950 rounded-[2rem] border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-lg">Recent Activity</h3>
                            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center"><Clock className="w-5 h-5 text-emerald-600" /></div>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[500px] p-4">
                            {recentOrders.length === 0 ? (
                                <div className="h-[300px] flex flex-col items-center justify-center text-center">
                                    <Tag className="w-12 h-12 text-gray-200 mb-4" />
                                    <p className="text-gray-500 font-medium">No sales yet. Share your link to start earning!</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {recentOrders.map((order) => (
                                        <div key={order.id} className="p-4 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700">{order.network.charAt(0)}</div>
                                                <div><p className="font-bold text-sm">{order.network} {order.package_size}</p><p className="text-xs text-gray-500">{order.guest_phone}</p></div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-sm">{formatCurrency(order.selling_price)}</p>
                                                <p className="text-[10px] font-bold text-emerald-600">+{formatCurrency(order.profit)} profit</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="md:hidden fixed bottom-14 left-0 right-0 bg-white/90 backdrop-blur-xl border-t p-3 flex gap-2 z-40">
                 <Link href="/dashboard/shop/setup" className="flex-1"><Button variant="secondary" className="w-full rounded-xl font-bold h-11"><Settings className="w-4 h-4 mr-2" /> Edit</Button></Link>
                 <Link href="/dashboard/shop/pricing" className="flex-1"><Button variant="secondary" className="w-full rounded-xl font-bold h-11"><Tag className="w-4 h-4 mr-2" /> Prices</Button></Link>
            </div>
            
            <style jsx global>{`
                @keyframes sheen { 100% { left: 150%; } }
                .animate-sheen { animation: sheen 3s infinite; }
            `}</style>
        </div>
    )
}

// Sub-agent invite generator, surfaced on the shop overview so eligible Leads
// (lifetime agents / active dealers) can recruit resellers. Eligibility is
// enforced server-side by /api/shop/invites; ineligible owners get an error toast.
function SubAgentInviteCard() {
    const [loading, setLoading] = useState(false)
    const [url, setUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const generate = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/shop/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxUses: null, expiresInHours: 168 }), // unlimited uses, 7-day expiry
            })
            const data = await res.json()
            if (res.ok && data?.invite?.url) {
                setUrl(data.invite.url)
            } else {
                toast.error(data.error || 'Could not generate invite link')
            }
        } catch {
            toast.error('Could not generate invite link')
        } finally {
            setLoading(false)
        }
    }

    const copy = async () => {
        if (!url) return
        await navigator.clipboard.writeText(url)
        setCopied(true)
        toast.success('Invite link copied')
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="rounded-2xl border border-violet-100 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/20 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-sm text-violet-900 dark:text-violet-200">Recruit Sub-Agents</p>
                        <p className="text-xs text-violet-700 dark:text-violet-400 mt-0.5">Share an invite link to build your reseller network.</p>
                    </div>
                </div>
                {!url && (
                    <Button onClick={generate} disabled={loading} size="sm" className="h-9 gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold shrink-0">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />} {loading ? 'Generating…' : 'Generate Invite'}
                    </Button>
                )}
            </div>

            {url && (
                <div className="mt-3 flex flex-col sm:flex-row items-center gap-2 bg-white dark:bg-zinc-900 p-2 sm:pl-4 rounded-xl border border-violet-100 dark:border-violet-900/40">
                    <span className="text-xs font-mono text-violet-800 dark:text-violet-300 truncate w-full px-1 text-center sm:text-left">{url}</span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button onClick={copy} variant="secondary" className="flex-1 sm:flex-none h-9 bg-white dark:bg-zinc-900 text-violet-600 gap-2 rounded-xl font-bold">
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied!' : 'Copy Link'}
                        </Button>
                        <Link href="/dashboard/shop/sub-agents" aria-label="Go to sub-agents"><Button className="w-full sm:w-auto h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2 font-bold">Go to Sub-Agents <ArrowRight className="w-4 h-4" /></Button></Link>
                    </div>
                </div>
            )}
        </div>
    )
}
