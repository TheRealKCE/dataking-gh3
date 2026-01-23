'use client'

import { useEffect, useState, Fragment } from 'react'
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
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
    Filter,
    Download,
    ChevronDown,
    ChevronUp,
    User
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [networkFilter, setNetworkFilter] = useState('all')
    const [batches, setBatches] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState('available')
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
    const [batchOrders, setBatchOrders] = useState<Record<string, any[]>>({})
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 20

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            await Promise.all([fetchOrders(), fetchBatches()])
            setLoading(false)
        }
        loadData()
    }, [])

    const fetchOrders = async () => {
        try {
            const response = await fetch('/api/admin/orders?available=true')
            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Failed to fetch orders')
            }
            const data = await response.json()
            setOrders(data || [])
        } catch (error: any) {
            console.error('Error fetching orders:', error)
            toast.error(error.message || 'Failed to load orders')
        }
    }

    const fetchBatches = async () => {
        try {
            const response = await fetch('/api/admin/batches')
            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Failed to fetch batches')
            }
            const data = await response.json()
            setBatches(data || [])
        } catch (error: any) {
            console.error('Error fetching batches:', error)
        }
    }

    const toggleBatch = async (batchId: string) => {
        if (expandedBatch === batchId) {
            setExpandedBatch(null)
            return
        }

        setExpandedBatch(batchId)

        // Fetch orders if not already in state
        if (!batchOrders[batchId]) {
            try {
                setLoading(true)
                const response = await fetch(`/api/admin/orders?batchId=${batchId}`)
                if (!response.ok) {
                    const result = await response.json()
                    throw new Error(result.error || 'Failed to fetch batch orders')
                }
                const data = await response.json()
                setBatchOrders(prev => ({ ...prev, [batchId]: data || [] }))
            } catch (error: any) {
                console.error('Error fetching batch orders:', error)
                toast.error(error.message || 'Failed to load batch details')
            } finally {
                setLoading(false)
            }
        }
    }

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const response = await fetch('/api/admin/orders/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status: newStatus })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update status')

            setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
            toast.success(`Order marked as ${newStatus}`)
        } catch (error: any) {
            console.error('Update status error:', error)
            toast.error(`Error: ${error.message || 'Failed to update status'}`)
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

            await (supabase.from('wallets') as any)
                .update({
                    balance: (wallet as any).balance + order.price,
                    total_spent: (wallet as any).total_spent - order.price
                })
                .eq('id', (wallet as any).id)

            // 2. Create refund transaction
            await (supabase.from('wallet_transactions') as any).insert({
                wallet_id: (wallet as any).id,
                user_id: order.user_id,
                type: 'credit',
                amount: order.price,
                description: `Refund for order ${order.reference_code}`,
                reference: `REF-${order.reference_code}`,
                source: 'refund',
                status: 'completed'
            })

            // 3. Update order payment status
            await (supabase
                .from('orders') as any)
                .update({ payment_status: 'refunded', status: 'failed' } as any)
                .eq('id', order.id)

            setOrders(orders.map(o => o.id === order.id ? { ...o, payment_status: 'refunded', status: 'failed' } : o))
            toast.success('Order refunded successfully')

            // Notify user
            await (supabase.from('notifications') as any).insert({
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

    const handleExportExcel = async () => {
        const pendingOrders = (filteredOrders as any[]).filter(o => o.status === 'pending')

        if (pendingOrders.length === 0) {
            toast.error('No PENDING orders to export')
            return
        }

        if (!confirm(`This will export ${pendingOrders.length} pending orders and move them to the "Downloaded" tab. Continue?`)) {
            return
        }

        try {
            const fileName = `ghdata_orders_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`

            const idempotencyKey = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

            // 1. Create batch and link orders via API (Secure)
            const response = await fetch('/api/admin/orders/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderIds: pendingOrders.map((o: any) => o.id),
                    filename: fileName,
                    network: networkFilter === 'all' ? 'Multiple' : networkFilter,
                    idempotencyKey: idempotencyKey
                })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to create batch')

            // 3. Perform export
            const dataToExport = (pendingOrders as any[]).map(order => ({
                'Number': order.phone_number,
                'Data Size': order.size.replace(/GB/i, '')
            }))

            // Dynamic import
            // @ts-ignore
            const { utils, writeFile } = await import('xlsx-js-style')

            const worksheet = utils.json_to_sheet(dataToExport)

            // Reduce text size
            const range = utils.decode_range(worksheet['!ref'] || 'A1:A1')
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell_address = utils.encode_cell({ r: R, c: C })
                    if (!worksheet[cell_address]) continue

                    // Keep existing style if any, but enforce font size
                    worksheet[cell_address].s = {
                        font: { sz: 10, name: 'Arial' },
                        alignment: { horizontal: "center", vertical: "center" }
                    }
                }
            }

            // Set column widths
            worksheet['!cols'] = [
                { wch: 15 }, // Number
                { wch: 10 }  // Data Size
            ]

            const workbook = utils.book_new()
            utils.book_append_sheet(workbook, worksheet, "Orders")

            writeFile(workbook, fileName)
            toast.success('Orders exported and moved to batches')

            // 4. Refresh data
            fetchOrders()
            fetchBatches()
        } catch (error) {
            console.error('Export error:', error)
            toast.error('Failed to export orders')
        }
    }

    const reDownloadBatch = async (batch: any) => {
        try {
            const { data: batchOrders, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    users (first_name, last_name, email)
                `)
                .eq('download_batch_id', batch.id)

            if (error) throw error

            const dataToExport = (batchOrders as any[]).map(order => ({
                'Number': order.phone_number,
                'Data Size': order.size.replace(/GB/i, '')
            }))

            // Dynamic import
            // @ts-ignore
            const { utils, writeFile } = await import('xlsx-js-style')

            const worksheet = utils.json_to_sheet(dataToExport)

            // Reduce text size
            const range = utils.decode_range(worksheet['!ref'] || 'A1:A1')
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell_address = utils.encode_cell({ r: R, c: C })
                    if (!worksheet[cell_address]) continue

                    // Keep existing style if any, but enforce font size
                    worksheet[cell_address].s = {
                        font: { sz: 10, name: 'Arial' },
                        alignment: { horizontal: "center", vertical: "center" }
                    }
                }
            }

            // Set column widths
            worksheet['!cols'] = [
                { wch: 15 }, // Number
                { wch: 10 }  // Data Size
            ]

            const workbook = utils.book_new()
            utils.book_append_sheet(workbook, worksheet, "Orders")
            writeFile(workbook, batch.filename)
            toast.success('Batch re-downloaded')
        } catch (error) {
            toast.error('Failed to re-download batch')
        }
    }

    const handleUpdateBatchStatus = async (batchId: string, newStatus: string) => {
        const batch = batches.find(b => b.id === batchId)
        if (!confirm(`Are you sure you want to mark all ${batch?.order_count || ''} orders in this batch as ${newStatus}?`)) return

        try {
            setLoading(true)

            const response = await fetch('/api/admin/orders/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId, status: newStatus })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update batch status')

            toast.success(`Success! All ${result.updatedCount || ''} orders marked as ${newStatus}`)

            // Refresh batch orders if this batch is currently expanded
            if (expandedBatch === batchId || batchOrders[batchId]) {
                const { data: updatedBatchOrders, error: fetchError } = await supabase
                    .from('orders')
                    .select('*, users(first_name, last_name, email)')
                    .eq('download_batch_id', batchId)
                    .order('created_at', { ascending: false })

                if (!fetchError && updatedBatchOrders) {
                    setBatchOrders(prev => ({ ...prev, [batchId]: updatedBatchOrders }))
                }
            }

            // Refresh both lists
            await fetchOrders()
            await fetchBatches()
        } catch (error: any) {
            console.error('Error updating batch status:', error)
            toast.error(`Error: ${error.message || 'Failed to update batch orders status'}`)
        } finally {
            setLoading(false)
        }
    }

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.reference_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.phone_number.includes(searchTerm) ||
            order.users?.email?.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesNetwork = networkFilter === 'all' || order.network === networkFilter

        return matchesSearch && matchesNetwork
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
                <div className="flex gap-2">
                    <Button
                        onClick={handleExportExcel}
                        variant="default"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export to Excel
                    </Button>
                    <Button onClick={() => { fetchOrders(); fetchBatches(); }} variant="outline" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="available" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="available">Available ({orders.length})</TabsTrigger>
                    <TabsTrigger value="downloaded">Downloaded History</TabsTrigger>
                </TabsList>

                <TabsContent value="available" className="space-y-4">
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
                </TabsContent>

                <TabsContent value="downloaded">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Batch Download History</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead>Download Time</TableHead>
                                        <TableHead>Filename</TableHead>
                                        <TableHead>Network</TableHead>
                                        <TableHead>Orders</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {batches.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                No download history found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        batches.map((batch) => (
                                            <Fragment key={batch.id}>
                                                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleBatch(batch.id)}>
                                                    <TableCell>
                                                        {expandedBatch === batch.id ?
                                                            <ChevronUp className="w-4 h-4 text-muted-foreground" /> :
                                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                        }
                                                    </TableCell>
                                                    <TableCell>{formatDate(batch.created_at)}</TableCell>
                                                    <TableCell className="font-mono text-sm">{batch.filename}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{batch.network}</Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium text-blue-600">{batch.order_count} orders</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="outline" size="sm">
                                                                        Update Status
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => handleUpdateBatchStatus(batch.id, 'completed')}>
                                                                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                                                                        Mark All as Completed
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleUpdateBatchStatus(batch.id, 'failed')}>
                                                                        <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                                                        Mark All as Failed
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => reDownloadBatch(batch)}
                                                            >
                                                                <Download className="w-4 h-4 mr-2" />
                                                                Re-download
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {/* Expanded Detail View */}
                                                {expandedBatch === batch.id && (
                                                    <TableRow className="bg-muted/20">
                                                        <TableCell colSpan={6} className="p-0">
                                                            <div className="p-4 border-l-4 border-blue-500 bg-blue-50/30 dark:bg-blue-900/10">
                                                                <div className="mb-4 flex items-center justify-between">
                                                                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center">
                                                                        <Clock className="w-4 h-4 mr-2" />
                                                                        Orders in this Batch
                                                                    </h4>
                                                                    <span className="text-xs text-muted-foreground italic">
                                                                        Showing details for {batchOrders[batch.id]?.length || 0} orders
                                                                    </span>
                                                                </div>
                                                                <div className="rounded-md border bg-card">
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                                <TableHead className="text-xs">Reference</TableHead>
                                                                                <TableHead className="text-xs">Customer</TableHead>
                                                                                <TableHead className="text-xs">Phone</TableHead>
                                                                                <TableHead className="text-xs">Package</TableHead>
                                                                                <TableHead className="text-xs">Price</TableHead>
                                                                                <TableHead className="text-xs">Status</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {(batchOrders[batch.id] as any[])?.map((order) => (
                                                                                <TableRow key={order.id} className="text-xs">
                                                                                    <TableCell className="font-mono">{order.reference_code}</TableCell>
                                                                                    <TableCell>
                                                                                        <div className="flex items-center">
                                                                                            <User className="w-3 h-3 mr-1 text-muted-foreground" />
                                                                                            {order.users?.first_name} {order.users?.last_name}
                                                                                        </div>
                                                                                    </TableCell>
                                                                                    <TableCell>{order.phone_number}</TableCell>
                                                                                    <TableCell>
                                                                                        <Badge variant="outline" className="text-[10px] py-0">
                                                                                            {order.network} {order.size}
                                                                                        </Badge>
                                                                                    </TableCell>
                                                                                    <TableCell className="font-medium text-green-600">{formatCurrency(order.price)}</TableCell>
                                                                                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                            {(!batchOrders[batch.id] || batchOrders[batch.id].length === 0) && (
                                                                                <TableRow>
                                                                                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground italic">
                                                                                        {loading ? 'Crunching details...' : 'Fetching orders...'}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            )}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
