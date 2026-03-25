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
    Search, ArrowLeft, AlertCircle, RefreshCcw, MessageSquare, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { format, differenceInHours } from 'date-fns'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ShopOrder {
    id: string
    guest_phone: string
    network: string
    package_size: string
    selling_price: number
    profit: number
    status: string
    created_at: string
    order_type?: 'data' | 'airtime'
    orders?: {
        id: string
        complaints: any[]
    }[]
}

interface ShopFees {
    mtn: number
    telecel: number
    at: number
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
    const [fees, setFees] = useState<ShopFees>({ mtn: 0, telecel: 0, at: 0 })
    const [activeTab, setActiveTab] = useState<'data' | 'airtime'>('data')

    // Filter state
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterNetwork, setFilterNetwork] = useState<string>('all')
    const [filterDate, setFilterDate] = useState<'today' | '7d' | '30d' | 'all'>('today')
    const [searchPhone, setSearchPhone] = useState('')

    // Complaint state
    const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null)
    const [complaintDescription, setComplaintDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!dbUser) return
        fetchOrders()
    }, [dbUser, filterDate])

    const fetchOrders = async () => {
        try {
            // Fetch this user's shop profile first
            const { data: shopData, error: shopErr } = await (supabase as any)
                .from('shop_profiles')
                .select('id, airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at')
                .eq('owner_id', dbUser!.id)
                .single()

            if (shopErr || !shopData) {
                setOrders([])
                return
            }

            setFees({
                mtn: shopData.airtime_fee_mtn || 0,
                telecel: shopData.airtime_fee_telecel || 0,
                at: shopData.airtime_fee_at || 0
            })

            // Build the orders query — all statuses, filtered by date
            let query = (supabase as any)
                .from('shop_orders')
                .select('*, orders:orders!shop_order_id(id, complaints(*))')
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

    const submitComplaint = async () => {
        if (!selectedOrder || !complaintDescription) return

        setIsSubmitting(true)
        try {
            // First, find the mirrored order ID
            const { data: mirror, error: mirrorErr } = await (supabase as any)
                .from('orders')
                .select('id, reference_code')
                .eq('shop_order_id', selectedOrder.id)
                .single()

            if (mirrorErr || !mirror) {
                throw new Error('Could not find linked order record')
            }

            const response = await fetch('/api/complaints/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: mirror.id,
                    title: `[Shop: ${dbUser?.first_name}] Issue with order ${mirror.reference_code}`,
                    description: complaintDescription,
                    priority: 'medium',
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to submit complaint')
            }

            const { complaint: newComplaint } = await response.json()

            toast.success('Complaint submitted successfully')

            // Optimistic Update: Add the complaint to the local state
            setOrders(prevOrders => prevOrders.map(o => {
                if (o.id === selectedOrder.id) {
                    return {
                        ...o,
                        orders: [{
                            id: mirror.id,
                            complaints: [newComplaint]
                        }]
                    }
                }
                return o
            }))

            setSelectedOrder(null)
            setComplaintDescription('')
        } catch (error: any) {
            console.error('Complaint submission error:', error)
            toast.error(error.message || 'Failed to submit complaint')
        } finally {
            setIsSubmitting(false)
        }
    }

    const isWithin48Hours = (createdAt: string) => {
        const orderDate = new Date(createdAt)
        const now = new Date()
        return differenceInHours(now, orderDate) < 48
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await fetchOrders()
        setIsRefreshing(false)
        toast.success('Orders updated')
    }

    // Filter Logic
    const filteredOrders = orders.filter(order => {
        // Tab Filter
        const type = order.order_type || 'data'
        if (type !== activeTab) return false
        
        if (filterStatus !== 'all' && order.status !== filterStatus) return false
        if (filterNetwork !== 'all' && order.network.toLowerCase() !== filterNetwork.toLowerCase()) return false
        if (searchPhone && !order.guest_phone.includes(searchPhone)) return false
        return true
    })

    const hasNoAirtimeFees = fees.mtn === 0 && fees.telecel === 0 && fees.at === 0

    // Stats Calculation
    const completed = filteredOrders.filter(o => o.status === 'completed')
    const earningStatuses = ['pending', 'processing', 'completed']
    const earningsOrders = filteredOrders.filter(o => earningStatuses.includes(o.status))

    const stats = {
        total: filteredOrders.length,
        pending: filteredOrders.filter(o => o.status === 'pending').length,
        processing: filteredOrders.filter(o => o.status === 'processing').length,
        completed: completed.length,
        revenue: earningsOrders.reduce((sum, o) => sum + (o.selling_price || 0), 0),
        profit: earningsOrders.reduce((sum, o) => sum + (o.profit || 0), 0)
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

            {/* Tabs & Filters Section */}
            <div className="space-y-4">
                {/* Tabs */}
                <div className="flex p-1 bg-muted rounded-xl w-fit border shadow-sm">
                    <button
                        onClick={() => setActiveTab('data')}
                        className={cn(
                            "px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2",
                            activeTab === 'data' ? "bg-white dark:bg-gray-800 shadow-sm text-emerald-600" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <ShoppingCart className="w-4 h-4" />
                        Data Bundles
                    </button>
                    <button
                        onClick={() => setActiveTab('airtime')}
                        className={cn(
                            "px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2",
                            activeTab === 'airtime' ? "bg-white dark:bg-gray-800 shadow-sm text-purple-600" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Airtime
                    </button>
                </div>

                {/* Airtime Warning Banner */}
                {activeTab === 'airtime' && hasNoAirtimeFees && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-purple-50 border border-purple-100 dark:bg-purple-900/10 dark:border-purple-900/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-purple-900 dark:text-purple-100 uppercase tracking-tight">No Profit Gained</h3>
                                <p className="text-xs text-purple-700 dark:text-purple-400">You haven't set any airtime fees yet. Customers can still buy airtime, but you won't earn any commission on these orders.</p>
                            </div>
                        </div>
                        <Link href="/dashboard/shop/pricing">
                            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-lg shadow-purple-200 dark:shadow-none whitespace-nowrap">
                                Set Fees & Start Earning
                            </Button>
                        </Link>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-muted/30 p-4 rounded-xl border">
                    {/* Search */}
                    <div className="relative w-full lg:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search phone number..."
                            title="Search phone number"
                            aria-label="Search phone number"
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

                        {/* Network Filter */}
                        <select
                            title="Filter by Network"
                            aria-label="Filter by Network"
                            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={filterNetwork}
                            onChange={(e) => setFilterNetwork(e.target.value)}
                        >
                            <option value="all">All Networks</option>
                            <option value="mtn">MTN</option>
                            <option value="telecel">Telecel</option>
                            <option value="at">AT</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            title="Filter by Status"
                            aria-label="Filter by Status"
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
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Total Orders', value: stats.total, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                    { label: 'Processing', value: stats.processing, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                    { label: 'Total Revenue', value: formatCurrency(stats.revenue), icon: TrendingUp, color: activeTab === 'airtime' ? 'text-purple-600' : 'text-emerald-600', bg: activeTab === 'airtime' ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'Total Profit', value: formatCurrency(stats.profit), icon: TrendingUp, color: activeTab === 'airtime' ? 'text-purple-600' : 'text-emerald-600', bg: activeTab === 'airtime' ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20' },
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

            {/* Orders List & Table */}
            <Card>
                <CardHeader className="p-4 border-b">
                    <CardTitle className="text-base">Order History</CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
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
                                                <td className="px-4 py-3 text-xs font-medium">
                                                    {order.order_type === 'airtime' ? (
                                                        <span className="flex items-center gap-1.5">
                                                            <RefreshCcw className="w-3 h-3 text-purple-600" />
                                                            {order.network} Airtime
                                                        </span>
                                                    ) : (
                                                        `${order.network} ${order.package_size}`
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">{formatCurrency(order.selling_price)}</td>
                                                <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatCurrency(order.profit)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span className={cn(
                                                            'inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full',
                                                            statusConfig[order.status]?.color || 'bg-gray-100 text-gray-600'
                                                        )}>
                                                            <StatusIcon className="w-3 h-3" />
                                                            {statusConfig[order.status]?.label || order.status}
                                                        </span>

                                                        {/* Complaint Status or Button */}
                                                        {(() => {
                                                            const orderComplaints = order.orders?.[0]?.complaints || []
                                                            if (orderComplaints.length > 0) {
                                                                const complaintStatus = orderComplaints[0].status
                                                                return (
                                                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                                                        <MessageSquare className="w-2.5 h-2.5" />
                                                                        <span className="text-[9px] font-bold uppercase">
                                                                            Complaint: {complaintStatus.replace('_', ' ')}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            }
                                                            if (order.status === 'completed' && isWithin48Hours(order.created_at)) {
                                                                return (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-6 px-2 text-[10px] text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                                        onClick={() => {
                                                                            setSelectedOrder(order)
                                                                            setComplaintDescription('')
                                                                        }}
                                                                    >
                                                                        <MessageSquare className="w-3 h-3 mr-1" />
                                                                        Complain
                                                                    </Button>
                                                                )
                                                            }
                                                            return null
                                                        })()}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y">
                        {filteredOrders.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                No orders found matching your filters.
                            </div>
                        ) : (
                            filteredOrders.map((order) => {
                                const StatusIcon = statusConfig[order.status]?.icon || Clock
                                return (
                                    <div key={order.id} className="p-4 space-y-4 hover:bg-muted/30 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-sm flex items-center gap-2">
                                                    {order.order_type === 'airtime' && <RefreshCcw className="w-3.5 h-3.5 text-purple-600" />}
                                                    {order.network} {order.order_type === 'airtime' ? 'Airtime' : order.package_size}
                                                </p>
                                                <p className="text-xs font-mono text-muted-foreground mt-0.5">{order.guest_phone}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={cn(
                                                    'inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full',
                                                    statusConfig[order.status]?.color || 'bg-gray-100 text-gray-600'
                                                )}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {statusConfig[order.status]?.label || order.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Date & Time</p>
                                                <p className="text-xs">
                                                    {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-[10px] uppercase text-muted-foreground font-medium">Earnings</p>
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-xs font-medium">{formatCurrency(order.selling_price)}</span>
                                                    <span className="text-xs font-bold text-emerald-600">({formatCurrency(order.profit)})</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Area for Mobile */}
                                        <div className="pt-2">
                                            {(() => {
                                                const orderComplaints = order.orders?.[0]?.complaints || []
                                                if (orderComplaints.length > 0) {
                                                    const complaintStatus = orderComplaints[0].status
                                                    return (
                                                        <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800 w-full">
                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                            <span className="text-[11px] font-bold uppercase tracking-wide">
                                                                Complaint: {complaintStatus.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                    )
                                                }
                                                if (order.status === 'completed' && isWithin48Hours(order.created_at)) {
                                                    return (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="w-full h-9 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 dark:border-orange-900"
                                                            onClick={() => {
                                                                setSelectedOrder(order)
                                                                setComplaintDescription('')
                                                            }}
                                                        >
                                                            <MessageSquare className="w-3.5 h-3.5 mr-2" />
                                                            File a Complaint
                                                        </Button>
                                                    )
                                                }
                                                return null
                                            })()}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Complaint Dialog */}
            <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>File a Complaint</DialogTitle>
                        <DialogDescription>
                            Describe the issue for order to {selectedOrder?.guest_phone}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-4 rounded-xl bg-muted/50 text-sm">
                            <div className="flex justify-between">
                                <span>Phone:</span>
                                <span className="font-mono">{selectedOrder?.guest_phone}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Package:</span>
                                <span>{selectedOrder?.network} {selectedOrder?.package_size}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Price:</span>
                                <span>{formatCurrency(selectedOrder?.selling_price || 0)}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Issue Description</Label>
                            <Textarea
                                placeholder="Describe the problem your customer is facing..."
                                value={complaintDescription}
                                onChange={(e) => setComplaintDescription(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                            Cancel
                        </Button>
                        <Button onClick={submitComplaint} disabled={isSubmitting || !complaintDescription}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Complaint'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
