'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Phone,
    ShoppingCart,
    Loader2,
    MessageSquare,
    Wifi
} from 'lucide-react'
import { toast } from 'sonner'
import { Order } from '@/types/supabase'
import { format } from 'date-fns'

const NETWORKS = ['All', 'MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const STATUSES = ['All', 'pending', 'processing', 'completed', 'failed']
const TIME_PERIODS = ['All Time', 'Today', 'Yesterday', 'This Week', 'This Month']

export default function MyOrdersPage() {
    const { dbUser } = useAuth()
    const [orders, setOrders] = useState<Order[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [networkFilter, setNetworkFilter] = useState('All')
    const [statusFilter, setStatusFilter] = useState('All')
    const [timePeriod, setTimePeriod] = useState('All Time')

    // Complaint dialog
    const [complaintOrder, setComplaintOrder] = useState<Order | null>(null)
    const [complaintDescription, setComplaintDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (dbUser) {
            fetchOrders()
        }
    }, [dbUser])

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', dbUser?.id as any)
                .order('created_at', { ascending: false })

            if (error) throw error
            setOrders(data || [])
        } catch (error) {
            console.error('Error fetching orders:', error)
            toast.error('Failed to load orders')
        } finally {
            setIsLoading(false)
        }
    }

    // Filter orders based on all criteria
    const filteredOrders = useMemo(() => {
        let filtered = orders

        // Time period filter
        if (timePeriod !== 'All Time') {
            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            const weekStart = new Date(today)
            weekStart.setDate(weekStart.getDate() - weekStart.getDay())
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

            filtered = filtered.filter(order => {
                const orderDate = new Date(order.created_at)
                switch (timePeriod) {
                    case 'Today':
                        return orderDate >= today
                    case 'Yesterday':
                        return orderDate >= yesterday && orderDate < today
                    case 'This Week':
                        return orderDate >= weekStart
                    case 'This Month':
                        return orderDate >= monthStart
                    default:
                        return true
                }
            })
        }

        // Network filter
        if (networkFilter !== 'All') {
            filtered = filtered.filter(o => o.network === networkFilter)
        }

        // Status filter
        if (statusFilter !== 'All') {
            filtered = filtered.filter(o => o.status === statusFilter)
        }

        // Phone search
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(o =>
                o.phone_number.includes(query)
            )
        }

        return filtered
    }, [orders, searchQuery, networkFilter, statusFilter, timePeriod])

    // Calculate stats from filtered orders
    const stats = useMemo(() => {
        const completedOrders = filteredOrders.filter(o => o.status === 'completed')
        const totalAmount = completedOrders.reduce((sum, o) => sum + (o.price || 0), 0)

        // Parse data sizes and sum them
        let totalDataGB = 0
        completedOrders.forEach(order => {
            const sizeStr = order.size.toLowerCase()
            const match = sizeStr.match(/([\d.]+)\s*(gb|mb)/i)
            if (match) {
                const value = parseFloat(match[1])
                const unit = match[2].toLowerCase()
                if (unit === 'gb') {
                    totalDataGB += value
                } else if (unit === 'mb') {
                    totalDataGB += value / 1024
                }
            }
        })

        return {
            totalOrders: filteredOrders.length,
            totalAmount,
            totalData: totalDataGB.toFixed(totalDataGB >= 1 ? 0 : 2)
        }
    }, [filteredOrders])

    const handleComplaint = (order: Order) => {
        setComplaintOrder(order)
        setComplaintDescription('')
    }

    const submitComplaint = async () => {
        if (!complaintOrder || !complaintDescription) return

        setIsSubmitting(true)
        try {
            const { error } = await (supabase.from('complaints') as any).insert({
                user_id: dbUser?.id as any,
                order_id: complaintOrder.id,
                title: `Issue with order ${complaintOrder.reference_code}`,
                description: complaintDescription,
                status: 'pending',
                priority: 'medium',
            })

            if (error) throw error

            toast.success('Complaint submitted successfully')
            setComplaintOrder(null)
        } catch (error) {
            toast.error('Failed to submit complaint')
        } finally {
            setIsSubmitting(false)
        }
    }

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'processing':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'failed':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            default:
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        }
    }

    const getNetworkIcon = (network: string) => {
        const colors: Record<string, string> = {
            'MTN': 'bg-yellow-400',
            'Telecel': 'bg-red-500',
            'AT-iShare': 'bg-orange-500',
            'AT-BigTime': 'bg-orange-600',
        }
        return colors[network] || 'bg-gray-400'
    }

    const getProductName = (order: Order) => {
        const networkNames: Record<string, string> = {
            'MTN': 'MTN Data Bundle',
            'Telecel': 'Telecel Data Bundle',
            'AT-iShare': 'AT Premium Bundles',
            'AT-BigTime': 'AT BigTime Bundle',
        }
        return networkNames[order.network] || `${order.network} Bundle`
    }

    const formatOrderDate = (dateStr: string) => {
        return format(new Date(dateStr), 'MMM dd, yyyy HH:mm')
    }

    if (isLoading) {
        return (
            <div className="space-y-6 px-4 py-6">
                <div className="text-center space-y-2">
                    <Skeleton className="h-8 w-48 mx-auto" />
                    <Skeleton className="h-4 w-64 mx-auto" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                    ))}
                </div>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold">My Order History</h1>
                <p className="text-sm text-muted-foreground">View and manage your order transactions</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-900 dark:bg-gray-800 rounded-xl p-4 text-center text-white">
                    <p className="text-2xl font-bold">{stats.totalOrders}</p>
                    <p className="text-xs text-gray-300">Total Orders</p>
                </div>
                <div className="bg-gray-900 dark:bg-gray-800 rounded-xl p-4 text-center text-white">
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
                    <p className="text-xs text-gray-300">Total Amount</p>
                </div>
                <div className="bg-gray-900 dark:bg-gray-800 rounded-xl p-4 text-center text-white">
                    <p className="text-2xl font-bold">{stats.totalData} GB</p>
                    <p className="text-xs text-gray-300">Total Data</p>
                </div>
            </div>

            {/* Time Period Filters */}
            <div className="flex flex-wrap gap-2 justify-center">
                {TIME_PERIODS.map((period) => (
                    <button
                        key={period}
                        onClick={() => setTimePeriod(period)}
                        className={`px-4 py-2 text-sm rounded-full border transition-all ${timePeriod === period
                                ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                                : 'bg-transparent border-gray-300 dark:border-gray-600 hover:border-gray-500'
                            }`}
                    >
                        {period}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="space-y-4">
                {/* Search by Phone */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">Search by Phone</Label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Enter phone number"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Filter Dropdowns */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Filter by Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((status) => (
                                    <SelectItem key={status} value={status}>
                                        {status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Filter by Network</Label>
                        <Select value={networkFilter} onValueChange={setNetworkFilter}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All Networks" />
                            </SelectTrigger>
                            <SelectContent>
                                {NETWORKS.map((network) => (
                                    <SelectItem key={network} value={network}>
                                        {network === 'All' ? 'All Networks' : network}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Order Cards */}
            <div className="space-y-4">
                {filteredOrders.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No orders found</p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredOrders.map((order) => (
                        <Card key={order.id} className="overflow-hidden">
                            <CardContent className="p-4 space-y-4">
                                {/* Header Row */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-full ${getNetworkIcon(order.network)} flex items-center justify-center`}>
                                            <Wifi className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{getProductName(order)}</p>
                                            <p className="text-sm text-muted-foreground">{order.phone_number}</p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                    </span>
                                </div>

                                {/* Details */}
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Order Date:</span>
                                        <span className="font-medium">{formatOrderDate(order.created_at)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Data Bundle:</span>
                                        <span className="font-medium">{order.size}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Amount:</span>
                                        <span className="font-medium">{formatCurrency(order.price)}</span>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-2 border-t">
                                    <span className="text-sm text-muted-foreground">{order.status}</span>
                                    {order.status === 'failed' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleComplaint(order)}
                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                        >
                                            <MessageSquare className="w-4 h-4 mr-1" />
                                            Complain
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Complaint Dialog */}
            <Dialog open={!!complaintOrder} onOpenChange={() => setComplaintOrder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>File a Complaint</DialogTitle>
                        <DialogDescription>
                            Describe the issue with your order
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-4 rounded-xl bg-muted/50 text-sm">
                            <div className="flex justify-between">
                                <span>Phone:</span>
                                <span>{complaintOrder?.phone_number}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Package:</span>
                                <span>{complaintOrder?.size}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Amount:</span>
                                <span>{formatCurrency(complaintOrder?.price || 0)}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                placeholder="Describe your issue..."
                                value={complaintDescription}
                                onChange={(e) => setComplaintDescription(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setComplaintOrder(null)}>
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
