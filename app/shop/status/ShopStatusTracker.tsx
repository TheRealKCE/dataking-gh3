'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Search, Loader2, CheckCircle2, XCircle, Clock,
    Package, CalendarDays, History, Info
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
    shop_profiles: {
        shop_name: string
        shop_slug: string
    }
}

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Loader2 },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: XCircle },
}

function OrderCard({ order }: { order: Order }) {
    const cfg = statusConfig[order.status] || statusConfig.pending
    const Icon = cfg.icon
    return (
        <Card className="overflow-hidden">
            <div className="p-4 flex items-center gap-4">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', cfg.color)}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-sm">{order.network} {order.package_size}</p>
                            <Link href={`/shop/${order.shop_profiles?.shop_slug}`} className="text-xs text-blue-600 hover:underline">
                                {order.shop_profiles?.shop_name}
                            </Link>
                        </div>
                        <p className="font-semibold text-sm">{formatCurrency(order.selling_price)}</p>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm', cfg.color)}>
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
    const [searchLoading, setSearchLoading] = useState(false)
    const [todayLoading, setTodayLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const supabase = createClientComponentClient()

    // Auto-load today's orders from saved phone in localStorage
    useEffect(() => {
        let savedPhone: string | null = null
        try { savedPhone = localStorage.getItem('shop_last_phone') } catch (_) { }
        if (!savedPhone) return

        const loadTodayOrders = async () => {
            setTodayLoading(true)
            try {
                // Today's date range (midnight → now in local time, converted to ISO)
                const todayStart = new Date()
                todayStart.setHours(0, 0, 0, 0)

                const { data, error } = await supabase
                    .from('shop_orders')
                    .select('*, shop_profiles(shop_name, shop_slug)')
                    .eq('guest_phone', savedPhone)
                    .gte('created_at', todayStart.toISOString())
                    .order('created_at', { ascending: false })
                    .limit(10)

                if (!error) setTodayOrders(data as any || [])
            } catch (_) {
                // Silently fail — user can still search manually
            } finally {
                setTodayLoading(false)
            }
        }

        loadTodayOrders()
    }, [])

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!phone.trim()) { toast.error('Enter a phone number'); return }

        const cleanPhone = phone.replace(/\s+/g, '')
        setSearchLoading(true)
        setHasSearched(true)

        try {
            const { data, error } = await supabase
                .from('shop_orders')
                .select('*, shop_profiles(shop_name, shop_slug)')
                .eq('guest_phone', cleanPhone)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error
            setSearchOrders(data as any || [])
        } catch (err) {
            console.error(err)
            toast.error('Failed to fetch orders')
        } finally {
            setSearchLoading(false)
        }
    }

    return (
        <div className="max-w-md mx-auto p-4 space-y-6">
            {/* Page header */}
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">Track Your Order</h1>
                <p className="text-muted-foreground text-sm">
                    Check the status of your data bundle purchases.
                </p>
            </div>

            {/* ── Today's Orders (auto-loaded) ── */}
            {(todayLoading || todayOrders.length > 0) && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-emerald-600" />
                        <h2 className="font-bold text-sm">Today's Orders</h2>
                        {todayLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                    </div>

                    {todayOrders.length > 0 ? (
                        <div className="space-y-3">
                            {todayOrders.map(order => <OrderCard key={order.id} order={order} />)}
                        </div>
                    ) : !todayLoading ? (
                        <div className="text-center py-6 text-muted-foreground">
                            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No orders placed today yet.</p>
                        </div>
                    ) : null}

                    {/* Explanatory note */}
                    <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            <strong>Today's orders</strong> are shown automatically and reset each day at midnight.
                            To find older orders, search by your phone number below.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Phone Search ── */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-500" />
                    <h2 className="font-bold text-sm text-gray-700 dark:text-gray-300">Search All Orders</h2>
                </div>

                <Card>
                    <CardContent className="pt-4 pb-4">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <Input
                                type="tel"
                                placeholder="Enter phone: 0244123456"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="flex-1"
                            />
                            <Button type="submit" disabled={searchLoading}>
                                {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            </Button>
                        </form>
                        {!todayOrders.length && !todayLoading && (
                            <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                Today's orders auto-appear after a purchase. Search by phone to find older orders — they're always available here.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {hasSearched && (
                    <div className="space-y-3">
                        {searchOrders.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No orders found for this number.</p>
                            </div>
                        ) : (
                            searchOrders.map(order => <OrderCard key={order.id} order={order} />)
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
