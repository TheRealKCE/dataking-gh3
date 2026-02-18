'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2, CheckCircle2, XCircle, Clock, Smartphone, Package } from 'lucide-react'
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
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
    refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700', icon: XCircle },
}

export default function ShopStatusTracker() {
    const [phone, setPhone] = useState('')
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const supabase = createClientComponentClient()

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!phone.trim()) { toast.error('Enter a phone number'); return }

        const cleanPhone = phone.replace(/\s+/g, '')
        setLoading(true)
        setHasSearched(true)

        try {
            const { data, error } = await supabase
                .from('shop_orders')
                .select('*, shop_profiles(shop_name, shop_slug)')
                .eq('guest_phone', cleanPhone)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error
            setOrders(data as any || [])
        } catch (err) {
            console.error(err)
            toast.error('Failed to fetch orders')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-md mx-auto p-4 space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">Track Your Order</h1>
                <p className="text-muted-foreground text-sm">
                    Enter your phone number to see the status of your recent data bundle purchases.
                </p>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <Input
                            type="tel"
                            placeholder="e.g. 0244123456"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {hasSearched && (
                <div className="space-y-4">
                    {orders.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p>No orders found for this number.</p>
                        </div>
                    ) : (
                        orders.map(order => {
                            const cfg = statusConfig[order.status] || statusConfig.pending
                            const Icon = cfg.icon
                            return (
                                <Card key={order.id} className="overflow-hidden">
                                    <div className="p-4 flex items-center gap-4">
                                        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', cfg.color)}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-sm truncate">{order.network} {order.package_size}</p>
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
                        })
                    )}
                </div>
            )}
        </div>
    )
}
