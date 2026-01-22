'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Search,
    ShoppingCart,
    CheckCircle2,
    Clock,
    XCircle,
    AlertCircle,
    Loader2,
    MessageSquare
} from 'lucide-react'
import { toast } from 'sonner'
import { Order } from '@/types/supabase'

const NETWORKS = ['All', 'MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const STATUSES = ['All', 'pending', 'processing', 'completed', 'failed']

export default function MyOrdersPage() {
    const { dbUser } = useAuth()
    const [orders, setOrders] = useState<Order[]>([])
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        processing: 0,
        failed: 0,
        pending: 0,
    })
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [networkFilter, setNetworkFilter] = useState('All')
    const [statusFilter, setStatusFilter] = useState('All')

    // Complaint dialog
    const [complaintOrder, setComplaintOrder] = useState<Order | null>(null)
    const [complaintDescription, setComplaintDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (dbUser) {
            fetchOrders()
        }
    }, [dbUser])

    useEffect(() => {
        filterOrders()
    }, [orders, searchQuery, networkFilter, statusFilter])

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', dbUser?.id as any)
                .order('created_at', { ascending: false })

            if (error) throw error

            setOrders(data || [])

            setStats({
                total: data?.length || 0,
                completed: (data as any[]).filter(o => o.status === 'completed').length,
                processing: (data as any[]).filter(o => o.status === 'processing').length,
                failed: (data as any[]).filter(o => o.status === 'failed').length,
                pending: (data as any[]).filter(o => o.status === 'pending').length
            })
        } catch (error) {
            console.error('Error fetching orders:', error)
            toast.error('Failed to load orders')
        } finally {
            setIsLoading(false)
        }
    }

    const filterOrders = () => {
        let filtered = orders

        if (networkFilter !== 'All') {
            filtered = filtered.filter(o => o.network === networkFilter)
        }

        if (statusFilter !== 'All') {
            filtered = filtered.filter(o => o.status === statusFilter)
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(o =>
                o.phone_number.includes(query) ||
                o.reference_code.toLowerCase().includes(query) ||
                o.size.toLowerCase().includes(query)
            )
        }

        setFilteredOrders(filtered)
    }

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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="w-4 h-4 text-green-600" />
            case 'processing':
                return <Clock className="w-4 h-4 text-blue-600" />
            case 'failed':
                return <XCircle className="w-4 h-4 text-red-600" />
            default:
                return <AlertCircle className="w-4 h-4 text-amber-600" />
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'pending' | 'processing' | 'completed' | 'failed'> = {
            pending: 'pending',
            processing: 'processing',
            completed: 'completed',
            failed: 'failed',
        }
        return <Badge variant={variants[status]}>{status}</Badge>
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">My Orders</h1>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.completed}</p>
                            <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.processing}</p>
                            <p className="text-xs text-muted-foreground">Processing</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.failed}</p>
                            <p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.pending}</p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by phone, reference..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={networkFilter} onValueChange={setNetworkFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Network" />
                            </SelectTrigger>
                            <SelectContent>
                                {NETWORKS.map((network) => (
                                    <SelectItem key={network} value={network}>
                                        {network}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((status) => (
                                    <SelectItem key={status} value={status}>
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
                <CardContent className="p-0">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-12">
                            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No orders found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Network</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono text-sm">{order.reference_code}</TableCell>
                                            <TableCell>{order.phone_number}</TableCell>
                                            <TableCell>
                                                <Badge variant={order.network === 'MTN' ? 'mtn' : order.network === 'Telecel' ? 'telecel' : 'airteltigo'}>
                                                    {order.network}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{order.size}</TableCell>
                                            <TableCell>{formatCurrency(order.price)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(order.status)}
                                                    {getStatusBadge(order.status)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(order.created_at)}
                                            </TableCell>
                                            <TableCell>
                                                {order.status === 'failed' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleComplaint(order)}
                                                    >
                                                        <MessageSquare className="w-4 h-4 mr-1" />
                                                        Complain
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Complaint Dialog */}
            <Dialog open={!!complaintOrder} onOpenChange={() => setComplaintOrder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>File a Complaint</DialogTitle>
                        <DialogDescription>
                            Describe the issue with order {complaintOrder?.reference_code}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-4 rounded-xl bg-muted/50 text-sm">
                            <div className="flex justify-between">
                                <span>Order:</span>
                                <span className="font-mono">{complaintOrder?.reference_code}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Phone:</span>
                                <span>{complaintOrder?.phone_number}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Package:</span>
                                <span>{complaintOrder?.size}</span>
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
