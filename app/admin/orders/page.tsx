'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Search,
    MoreVertical,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    RefreshCw,
    Eye,
    Filter
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [networkFilter, setNetworkFilter] = useState('all')
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 20

    useEffect(() => {
        fetchOrders()
    }, [])

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
          *,
          users (
            first_name,
            last_name,
            email
          )
        `)
                .order('created_at', { ascending: false })
                .limit(100) // Limit to 100 for now for performance

            if (error) throw error
            setOrders(data || [])
        } catch (error) {
            console.error('Error fetching orders:', error)
            toast.error('Failed to load orders')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId)

            if (error) throw error

            setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
            toast.success(`Order marked as ${newStatus}`)

            // Create notification for user
            const order = orders.find(o => o.id === orderId)
            if (order) {
                await supabase.from('notifications').insert({
                    user_id: order.user_id,
                    title: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
                    message: `Your order ${order.reference_code} has been marked as ${newStatus}.`,
                    type: 'order_update',
                    action_url: `/dashboard/my-orders`
                })
            }
        } catch (error) {
            toast.error('Failed to update status')
        }
    }

    const handleRefund = async (order: any) => {
        if (!confirm('Are you sure you want to refund this order? This will credit the user\'s wallet.')) return

        try {
            // 1. Credit wallet
            const { data: wallet } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', order.user_id)
                .single()

            if (!wallet) throw new Error('User wallet not found')

            await supabase
                .from('wallets')
                .update({
                    balance: wallet.balance + order.price,
                    total_spent: wallet.total_spent - order.price
                })
                .eq('id', wallet.id)

            // 2. Create refund transaction
            await supabase.from('wallet_transactions').insert({
                wallet_id: wallet.id,
                user_id: order.user_id,
                type: 'credit',
                amount: order.price,
                description: `Refund for order ${order.reference_code}`,
                reference: `REF-${order.reference_code}`,
                source: 'refund',
                status: 'completed'
            })

            // 3. Update order payment status
            await supabase
                .from('orders')
                .update({ payment_status: 'refunded', status: 'failed' })
                .eq('id', order.id)

            setOrders(orders.map(o => o.id === order.id ? { ...o, payment_status: 'refunded', status: 'failed' } : o))
            toast.success('Order refunded successfully')

            // Notify user
            await supabase.from('notifications').insert({
                user_id: order.user_id,
                title: 'Order Refunded',
                message: `Your order ${order.reference_code} has been refunded. GHS ${order.price} has been credited to your wallet.`,
                type: 'balance_updated',
                action_url: `/dashboard/wallet`
            })

        } catch (error) {
            console.error('Refund error:', error)
            toast.error('Failed to process refund')
        }
    }

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.reference_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.phone_number.includes(searchTerm) ||
            order.users?.email?.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus = statusFilter === 'all' || order.status === statusFilter
        const matchesNetwork = networkFilter === 'all' || order.network === networkFilter

        return matchesSearch && matchesStatus && matchesNetwork
    })

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        }
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
                {status.toUpperCase()}
            </span>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Orders Management</h1>
                    <p className="text-muted-foreground">View and manage all customer orders</p>
                </div>
                <Button onClick={fetchOrders} variant="outline" disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search orders..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px]">
                                    <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={networkFilter} onValueChange={setNetworkFilter}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Network" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Networks</SelectItem>
                                    <SelectItem value="MTN">MTN</SelectItem>
                                    <SelectItem value="Telecel">Telecel</SelectItem>
                                    <SelectItem value="AT-iShare">AT-iShare</SelectItem>
                                    <SelectItem value="AT-BigTime">BigTime</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Package</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No orders found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono text-sm">{order.reference_code}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{order.users?.first_name} {order.users?.last_name}</span>
                                                    <span className="text-xs text-muted-foreground">{order.users?.email}</span>
                                                    <span className="text-xs text-muted-foreground">{order.phone_number}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{order.network} {order.size}</Badge>
                                            </TableCell>
                                            <TableCell>{formatCurrency(order.price)}</TableCell>
                                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDate(order.created_at)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>

                                                        {order.status !== 'completed' && (
                                                            <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'completed')}>
                                                                <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                                                                Mark as Completed
                                                            </DropdownMenuItem>
                                                        )}

                                                        {order.status !== 'failed' && (
                                                            <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'failed')}>
                                                                <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                                                Mark as Failed
                                                            </DropdownMenuItem>
                                                        )}

                                                        {order.status !== 'processing' && (
                                                            <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'processing')}>
                                                                <Clock className="w-4 h-4 mr-2 text-blue-500" />
                                                                Mark as Processing
                                                            </DropdownMenuItem>
                                                        )}

                                                        {order.payment_status !== 'refunded' && (
                                                            <DropdownMenuItem onClick={() => handleRefund(order)}>
                                                                <RefreshCw className="w-4 h-4 mr-2 text-amber-500" />
                                                                Refund Order
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
