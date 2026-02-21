'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
    ShoppingCart, Clock, CheckCircle2, XCircle, TrendingUp,
    Search, ArrowLeft, AlertCircle, RefreshCcw
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface ShopOrder {
    id: string
    guest_phone: string
    network: string
    package_size: string
    selling_price: number
    profit: number
    status: string
    created_at: string
    shop_id: string
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', icon: Clock },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
    refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: AlertCircle },
}

export default function ShopOrdersPage() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()

    // Data state
    const [orders, setOrders] = useState<ShopOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Filter state
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterDate, setFilterDate] = useState<'today' | '7d' | '30d' | 'all'>('today')
    const [searchPhone, setSearchPhone] = useState('')

    useEffect(() => {
        if (!dbUser) return
        fetchOrders()
    }, [dbUser, filterDate])

    const fetchOrders = async () => {
        try {
            // Fetch this user's shop profile first
            const { data: shopData, error: shopErr } = await (supabase as any)
                .from('shop_profiles')
                .select('id')
                .eq('owner_id', dbUser!.id)
                .single()

            if (shopErr || !shopData) {
                if (!isAdmin && !isSubAdmin && dbUser?.role !== 'agent') {
                    router.replace('/dashboard')
                    return
                }
                setOrders([])
                return
            }

            // Build the orders query — all statuses, filtered by date
            let query = (supabase as any)
                .from('shop_orders')
                .select('*')
                .eq('shop_id', shopData.id)

            const now = new Date()
            if (filterDate === 'today') {
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
                query = query.gte('created_at', startOfDay)
            } else if (filterDate === '7d') {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
                query = query.gte('created_at', sevenDaysAgo)
            } else if (filterDate === '30d') {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
                query = query.gte('created_at', thirtyDaysAgo)
            }
            // 'all' = no date filter

            const { data, error } = await query.order('created_at', { ascending: false })

            if (error) {
                console.error('[ShopOrders] Query error:', error)
                toast.error('Failed to load orders')
                setOrders([])
                return
            }

            setOrders(data || [])
        } catch (err) {
            console.error('Error fetching orders:', err)
            toast.error('Failed to load orders')
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await fetchOrders()
        setIsRefreshing(false)
        toast.success('Orders updated')
    }

    // Filter Logic
    const filteredOrders = orders.filter(order => {
        if (filterStatus !== 'all' && order.status !== filterStatus) return false
        if (searchPhone && !order.guest_phone.includes(searchPhone)) return false
        return true
    })

    // Stats Calculation
    const completed = filteredOrders.filter(o => o.status === 'completed')
    const stats = {
        total: filteredOrders.length,
        pending: filteredOrders.filter(o => o.status === 'pending').length,
        processing: filteredOrders.filter(o => o.status === 'processing').length,
        completed: completed.length,
        revenue: completed.reduce((sum, o) => sum + (o.selling_price || 0), 0),
        profit: completed.reduce((sum, o) => sum + (o.profit || 0), 0)
    }

    if (loading) {
        return <div className="p-8 space-y-6">
            <div className="flex justify-between">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-96" />
        </div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/shop">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-emerald-600" />
                        Shop Orders
                    </h1>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="gap-2"
                    >
                        <RefreshCcw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters Section - Moved to Top */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-muted/30 p-4 rounded-xl border">
                {/* Search */}
                <div className="relative w-full lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search phone number..."
                        value={searchPhone}
                        onChange={(e) => setSearchPhone(e.target.value)}
                        className="pl-9 h-9 bg-background"
                    />
                </div>

                {/* Filters */}
                <div className="flex w-full lg:w-auto overflow-x-auto gap-2">
                    {/* Date Filter */}
                    <div className="flex bg-muted rounded-lg p-1 shrink-0">
                        {[
                            { id: 'today', label: 'Today' },
                            { id: '7d', label: '7 Days' },
                            { id: '30d', label: '30 Days' },
                            { id: 'all', label: 'All' },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFilterDate(f.id as any)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                    filterDate === f.id ? "bg-white dark:bg-gray-800 shadow-sm text-emerald-600" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Status Filter */}
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="processing">Processing</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                    </select>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Total Orders', value: stats.total, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                    { label: 'Processing', value: stats.processing, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                    { label: 'Total Revenue', value: formatCurrency(stats.revenue), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                    { label: 'Total Profit', value: formatCurrency(stats.profit), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
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

            {/* Table */}
            <Card>
                <CardHeader className="p-4 border-b">
                    <CardTitle className="text-base">Order History</CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-xs text-muted-foreground bg-gray-50/50 dark:bg-gray-900/50">
                                    <th className="text-left px-4 py-3 font-medium">Date</th>
                                    <th className="text-left px-4 py-3 font-medium">Customer</th>
                                    <th className="text-left px-4 py-3 font-medium">Package</th>
                                    <th className="text-right px-4 py-3 font-medium">Price</th>
                                    <th className="text-right px-4 py-3 font-medium">Profit</th>
                                    <th className="text-center px-4 py-3 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-muted-foreground">
                                            No orders found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map((order) => {
                                        const StatusIcon = statusConfig[order.status]?.icon || Clock
                                        return (
                                            <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                                    {new Date(order.created_at).toLocaleDateString()}
                                                    <br />
                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs">{order.guest_phone}</td>
                                                <td className="px-4 py-3 text-xs font-medium">{order.network} {order.package_size}</td>
                                                <td className="px-4 py-3 text-right font-medium">{formatCurrency(order.selling_price)}</td>
                                                <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatCurrency(order.profit)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full',
                                                        statusConfig[order.status]?.color || 'bg-gray-100 text-gray-600'
                                                    )}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusConfig[order.status]?.label || order.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
