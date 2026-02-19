'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Search, Loader2, CheckCircle2, XCircle, Clock,
    Package, CalendarDays, History, Info, ShoppingCart
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

interface Order {
    id: string
    network: string
    package_size: string
    selling_price: number
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
    created_at: string
    shop_name: string // Flattened from RPC
    shop_slug: string // Flattened from RPC
    guest_phone: string
}

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Loader2 },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: XCircle },
}

function OrderCard({ order }: { order: Order }) {
    // Determine status config with fallback
    const cfg = statusConfig[order.status] || statusConfig.pending
    const Icon = cfg.icon

    return (
        <Card className="overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4 flex items-center gap-4">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', cfg.color)}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{order.network} {order.package_size}</p>
                            <Link href={`/shop/${order.shop_slug}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                {order.shop_name}
                            </Link>
                        </div>
                        <p className="font-black text-sm text-gray-800 dark:text-gray-200">{formatCurrency(order.selling_price)}</p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', cfg.color)}>
                            {cfg.label}
                        </span>
                    </div>
                </div>
            </div>
        </Card>
    )
}


export default function ShopStatusTracker() {
    const [phone, setPhone] = useState('')
    const [searchOrders, setSearchOrders] = useState<Order[]>([])
    const [todayOrders, setTodayOrders] = useState<Order[]>([])
    const [lastShopSlug, setLastShopSlug] = useState<string | null>(null)

    // Loading states
    const [searchLoading, setSearchLoading] = useState(false)
    const [todayLoading, setTodayLoading] = useState(false) // Initial load state

    const [hasSearched, setHasSearched] = useState(false)
    const supabase = createClientComponentClient()

    // ─── 1. Auto-load Today's Orders (on mount) ───
    useEffect(() => {
        let savedPhone: string | null = null
        try {
            savedPhone = localStorage.getItem('shop_last_phone')
            setLastShopSlug(localStorage.getItem('shop_last_slug'))
        } catch (_) { }

        if (!savedPhone) return

        const loadTodayOrders = async () => {
            setTodayLoading(true)
            try {
                // Use the RPC for consistent fetching
                const { data, error } = await supabase
                    .rpc('get_shop_orders_by_phone', {
                        phone_number: savedPhone,
                        limit_count: 10
                    })

                if (error) throw error

                // Filter client-side for "today only" logic if needed, 
                // but showing the last 10 explicit recent orders is actually better UX anyway.
                // We'll trust the RPC's "order by created_at desc"

                // Let's filter to only show orders from last 24h to keep "Today's Orders" semantic
                const yesterday = new Date()
                yesterday.setHours(yesterday.getHours() - 24)

                const recent = (data as any[] || []).filter(o => new Date(o.created_at) > yesterday)

                setTodayOrders(recent)
                if (recent.length > 0) setPhone(savedPhone) // Pre-fill search
            } catch (err) {
                console.error("Error loading auto orders:", err)
            } finally {
                setTodayLoading(false)
            }
        }

        loadTodayOrders()
    }, [])

    // ─── 2. Handle Manual Search ───
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!phone.trim()) { toast.error('Enter a phone number'); return }

        const cleanPhone = phone.replace(/\s+/g, '')

        // Optimistic UI updates
        setSearchLoading(true)
        setHasSearched(true)
        setSearchOrders([]) // Clear previous results while loading

        try {
            // Call the secure RPC function
            const { data, error } = await supabase
                .rpc('get_shop_orders_by_phone', {
                    phone_number: cleanPhone,
                    limit_count: 50 // Fetch more history for manual search
                })

            if (error) throw error

            const orders = data as any[] || []
            setSearchOrders(orders)

            // Save successful search to history for next time
            if (orders.length > 0) {
                try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }
            }

        } catch (err) {
            console.error(err)
            toast.error('Failed to fetch orders. Please try again.')
        } finally {
            setSearchLoading(false)
        }
    }

    return (
        <div className="max-w-md mx-auto p-4 space-y-8 pb-20">
            {/* Page header */}
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">Track Your Order</h1>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Enter your phone number to see the status of your data bundles.
                </p>
                {/* Buy More Data Button - Visible if we know the last shop visited */}
                {(todayOrders.length > 0 || searchOrders.length > 0 || lastShopSlug) && (
                    <div className="pt-2">
                        <Link
                            href={`/shop/${(todayOrders[0] || searchOrders[0])?.shop_slug || lastShopSlug}`}
                            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-full transition-colors"
                        >
                            <ShoppingCart className="w-4 h-4" />
                            Buy More Data
                        </Link>
                    </div>
                )}
            </div>

            {/* ── Today/Recent Auto-Load Section ── */}
            {(todayLoading || todayOrders.length > 0) && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 px-1">
                        <History className="w-4 h-4 text-emerald-600" />
                        <h2 className="font-bold text-sm text-gray-800 dark:text-gray-200">Recent Activity</h2>
                        {todayLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    </div>

                    <div className="space-y-3">
                        {todayOrders.map(order => <OrderCard key={order.id} order={order} />)}
                    </div>

                    {/* Divider */}
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200 dark:border-gray-800"></span></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-gray-50 dark:bg-gray-950 px-2 text-muted-foreground">Or Search History</span></div>
                    </div>
                </div>
            )}

            {/* ── Search Section ── */}
            <Card className="border-none shadow-lg bg-white dark:bg-gray-900">
                <CardContent className="p-5 space-y-4">
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                Phone Number
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="tel"
                                    placeholder="0244123456"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="pl-9 h-11 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={searchLoading || !phone.trim()}
                            className="w-full h-11 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-[0.98] transition-all"
                        >
                            {searchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Find My Orders'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* ── Search Results ── */}
            {hasSearched && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <div className="flex items-center gap-2 px-1">
                        {searchOrders.length > 0 ? (
                            <CalendarDays className="w-4 h-4 text-emerald-600" />
                        ) : (
                            <Info className="w-4 h-4 text-muted-foreground" />
                        )}
                        <h2 className="font-bold text-sm text-gray-800 dark:text-gray-200">
                            {searchOrders.length > 0 ? `Found ${searchOrders.length} Order${searchOrders.length === 1 ? '' : 's'}` : 'Search Results'}
                        </h2>
                    </div>

                    {searchOrders.length === 0 ? (
                        <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                                <Package className="w-6 h-6 text-gray-400" />
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white">No orders found</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                We couldn't find any orders for <span className="font-mono font-medium text-emerald-600">{phone}</span>.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {searchOrders.map(order => <OrderCard key={order.id} order={order} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
