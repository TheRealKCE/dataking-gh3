'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Search, Loader2, CheckCircle2, XCircle, Clock,
    Package, CalendarDays, History, Info, ShoppingCart, Phone
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

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
                    <div className="flex flex-col gap-1 mt-2">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-emerald-500" />
                            {order.guest_phone || 'N/A'}
                        </p>
                        <div className="flex justify-between items-center">
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
            </div>
        </Card>
    )
}


export default function ShopStatusTracker() {
    const searchParams = useSearchParams()
    const shopParam = searchParams.get('shop')
    const nameParam = searchParams.get('name')

    const [phone, setPhone] = useState('')
    const [searchOrders, setSearchOrders] = useState<Order[]>([])
    const [lastShopSlug, setLastShopSlug] = useState<string | null>(null)

    // Loading states
    const [searchLoading, setSearchLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)

    // ─── 1. Load Phone & Slug from Storage (No auto-fetch) ───
    useEffect(() => {
        try {
            const savedPhone = localStorage.getItem('shop_last_phone')
            if (savedPhone) setPhone(savedPhone)
            setLastShopSlug(sessionStorage.getItem('shop_sticky_slug'))
        } catch (_) { }
    }, [])

    // ─── 2. Handle Manual Search ───
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!phone.trim()) { toast.error('Enter a phone number'); return }

        const cleanPhone = phone.replace(/\s+/g, '')
        const ghanaPhoneRegex = /^(0\d{9}|233\d{9})$/
        if (!ghanaPhoneRegex.test(cleanPhone)) {
            toast.error('Enter a valid Ghana phone number (e.g. 0244123456)')
            return
        }

        setSearchLoading(true)
        setHasSearched(true)
        setSearchOrders([])

        try {
            const res = await fetch(`/api/shop/lookup-orders?phone=${encodeURIComponent(cleanPhone)}&limit=50`)
            if (!res.ok) throw new Error('Failed to fetch')
            const json = await res.json()

            let orders = (json.orders as Order[] || [])

            // Filter by shop if param exists
            if (shopParam) {
                orders = orders.filter(o => o.shop_slug === shopParam)
            }

            setSearchOrders(orders)

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
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                    {nameParam ? `Track Your ${nameParam} Orders` : 'Track Your Order'}
                </h1>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Enter your phone number to see the status of your data bundles.
                </p>
                {/* Buy More Data Button */}
                {(searchOrders.length > 0 || lastShopSlug || shopParam) && (
                    <div className="pt-2">
                        <Link
                            href={`/shop/${shopParam || searchOrders[0]?.shop_slug || lastShopSlug}`}
                            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-full transition-colors"
                        >
                            <ShoppingCart className="w-4 h-4" />
                            Buy More Data
                        </Link>
                    </div>
                )}
            </div>


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
