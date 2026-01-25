'use client'

import { useEffect, useState, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Search,
    MoreVertical,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    Download,
    ChevronDown,
    User,
    Package,
    Phone,
    FileText,
    Loader2
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [networkFilter, setNetworkFilter] = useState('all')
    const [batches, setBatches] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState('available')

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

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const response = await fetch('/api/admin/orders/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status: newStatus })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update status')

            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
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

            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, payment_status: 'refunded', status: 'failed' } : o))
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

            // 3. Perform export - STACKED LAYOUT
            const rows: any[][] = []

            // Header Colors
            const COLORS = {
                MTN: 'FACC15',
                Telecel: 'E60000',
                AT: '0056B3',
                Header: '0056B3',
                Border: 'E5E7EB',
                White: 'FFFFFF'
            } as const

            // Build Data Rows
            pendingOrders.forEach((order: any) => {
                const userName = `${order.users?.first_name || ''} ${order.users?.last_name || ''}`.trim()
                const phone = order.phone_number
                const size = order.size.replace(/GB/i, '')

                rows.push([userName, ''])
                rows.push([phone, size])
            })

            // @ts-ignore
            const { utils, writeFile } = await import('xlsx-js-style')

            const worksheet = utils.aoa_to_sheet(rows)

            const range = utils.decode_range(worksheet['!ref'] || 'A1:A1')

            // Set widths
            worksheet['!cols'] = [
                { wch: 30 }, // Phone/User column
                { wch: 15 }  // Size column
            ]

            // Merges
            const merges = []

            for (let R = range.s.r; R <= range.e.r; ++R) {
                // Calculate if this is a User Row or Data Row
                // Even rows (0, 2, 4...) are User Headers
                // Odd rows (1, 3, 5...) are Data

                const isUserRow = R % 2 === 0

                const orderIndex = Math.floor(R / 2)
                const order = (orderIndex >= 0 && orderIndex < pendingOrders.length) ? pendingOrders[orderIndex] : null
                const network = order?.network || 'Other'

                let netColor = '000000'
                if (network.includes('MTN')) netColor = COLORS.MTN
                else if (network.includes('Telecel')) netColor = COLORS.Telecel
                else if (network.includes('AT') || network.includes('BigTime')) netColor = COLORS.AT

                if (isUserRow) {
                    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 1 } })
                }

                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell_address = utils.encode_cell({ r: R, c: C })
                    if (!worksheet[cell_address]) continue

                    if (isUserRow) {
                        worksheet[cell_address].s = {
                            font: { sz: 12, bold: true, color: { rgb: COLORS.White } },
                            fill: { fgColor: { rgb: netColor } },
                            alignment: { horizontal: "center", vertical: "center" },
                            border: { top: { style: 'thin', color: { rgb: COLORS.Border } } }
                        }
                    } else {
                        worksheet[cell_address].s = {
                            font: { sz: 11, bold: false, color: { rgb: '000000' } },
                            alignment: { horizontal: "center", vertical: "center" },
                            border: {
                                bottom: { style: 'thin', color: { rgb: COLORS.Border } },
                                right: { style: 'thin', color: { rgb: COLORS.Border } },
                                left: { style: 'thin', color: { rgb: COLORS.Border } }
                            }
                        }
                    }
                }
            }

            worksheet['!merges'] = merges

            const workbook = utils.book_new()
            utils.book_append_sheet(workbook, worksheet, "Orders")

            writeFile(workbook, fileName)
            toast.success('Orders exported and moved to batches')

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
                .select(`*, users (first_name, last_name, email)`)
                .eq('download_batch_id', batch.id)

            if (error) throw error

            // Perform export - STACKED LAYOUT
            const rows: any[][] = []

            // Header Colors
            const COLORS = {
                MTN: 'FACC15',
                Telecel: 'E60000',
                AT: '0056B3',
                Header: '0056B3',
                Border: 'E5E7EB',
                White: 'FFFFFF'
            } as const

            // Build Data Rows
            (batchOrders as any[]).forEach((order: any) => {
                const userName = `${order.users?.first_name || ''} ${order.users?.last_name || ''}`.trim()
                const phone = order.phone_number
                const size = order.size.replace(/GB/i, '')

                rows.push([userName, ''])
                rows.push([phone, size])
            })

            // @ts-ignore
            const { utils, writeFile } = await import('xlsx-js-style')
            const worksheet = utils.aoa_to_sheet(rows)

            const range = utils.decode_range(worksheet['!ref'] || 'A1:A1')
            // Set widths
            worksheet['!cols'] = [{ wch: 30 }, { wch: 15 }]
            // Merges
            const merges = []

            for (let R = range.s.r; R <= range.e.r; ++R) {
                // Determine Row Type
                const isUserRow = R % 2 === 0

                if (isUserRow) {
                    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 1 } })
                }

                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell_address = utils.encode_cell({ r: R, c: C })
                    if (!worksheet[cell_address]) continue

                    if (isUserRow) {
                        worksheet[cell_address].s = {
                            font: { sz: 12, bold: true, color: { rgb: COLORS.White } },
                            fill: { fgColor: { rgb: COLORS.Header } },
                            alignment: { horizontal: "center", vertical: "center" },
                            border: { top: { style: 'thin', color: { rgb: COLORS.Border } } }
                        }
                    } else {
                        worksheet[cell_address].s = {
                            font: { sz: 11, bold: false, color: { rgb: '000000' } },
                            alignment: { horizontal: "center", vertical: "center" },
                            border: {
                                bottom: { style: 'thin', color: { rgb: COLORS.Border } },
                                right: { style: 'thin', color: { rgb: COLORS.Border } },
                                left: { style: 'thin', color: { rgb: COLORS.Border } }
                            }
                        }
                    }
                }
            }
            worksheet['!merges'] = merges

            const workbook = utils.book_new()
            utils.book_append_sheet(workbook, worksheet, "Orders")
            writeFile(workbook, batch.filename)
            toast.success('Batch re-downloaded')
        } catch (error) {
            toast.error('Failed to re-download batch')
        }
    }

    // Batch Card Component defined locally to access props/state needs
    const BatchCard = ({ batch }: { batch: any }) => {
        const [batchOrders, setBatchOrders] = useState<any[]>([])
        const [isLoadingOrders, setIsLoadingOrders] = useState(true)
        const [isUpdating, setIsUpdating] = useState(false)

        useEffect(() => {
            const loadBatchOrders = async () => {
                try {
                    const response = await fetch(`/api/admin/orders?batchId=${batch.id}`)
                    if (response.ok) {
                        const data = await response.json()
                        setBatchOrders(data || [])
                    }
                } catch (error) {
                    console.error('Failed to load batch orders', error)
                } finally {
                    setIsLoadingOrders(false)
                }
            }
            loadBatchOrders()
        }, [batch.id])

        const onUpdateBatchStatus = async (status: string) => {
            if (!confirm(`Mark all ${batchOrders.length} orders as ${status}?`)) return
            setIsUpdating(true)
            try {
                const response = await fetch('/api/admin/orders/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ batchId: batch.id, status })
                })

                if (!response.ok) throw new Error('Failed to update')

                toast.success('Batch updated successfully')
                // Refresh local orders
                const updatedOrders = batchOrders.map(o => ({ ...o, status }))
                setBatchOrders(updatedOrders)
                fetchBatches() // Update global counts if needed
            } catch (error) {
                toast.error('Failed to update batch status')
            } finally {
                setIsUpdating(false)
            }
        }

        return (
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col h-[500px]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
                    <div className="flex flex-col overflow-hidden">
                        <CardTitle className="text-sm font-medium truncate" title={batch.filename}>
                            {batch.filename}
                        </CardTitle>
                        <Badge variant="outline" className="w-fit mt-1">{batch.network}</Badge>
                    </div>
                    <FileText className="w-8 h-8 text-blue-100 dark:text-blue-900 flex-shrink-0" />
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden flex flex-col py-2">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{formatDate(batch.created_at)}</span>
                        <span className="text-sm font-bold text-blue-600">{batch.order_count} orders</span>
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-md bg-muted/5 p-2 space-y-2">
                        {isLoadingOrders ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : batchOrders.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                No orders found
                            </div>
                        ) : (
                            batchOrders.map(order => (
                                <div key={order.id} className="text-xs p-2 bg-background rounded border flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="font-mono font-medium">{order.phone_number}</span>
                                        <span className="text-[10px] text-muted-foreground">{order.network} {order.size}</span>
                                    </div>
                                    {getStatusBadge(order.status)}
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>

                <CardFooter className="p-4 pt-2 border-t flex-shrink-0 gap-2">
                    <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                        onClick={() => onUpdateBatchStatus('completed')}
                        disabled={isUpdating}
                    >
                        {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Mark All Completed
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onUpdateBatchStatus('failed')}>
                                <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                Mark All Failed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => reDownloadBatch(batch)}>
                                <Download className="w-4 h-4 mr-2" />
                                Re-download
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardFooter>
            </Card>
        )
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
        // Simplified badge for the small list view
        return (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${styles[status] || styles.pending}`}>
                {status === 'in_review' ? 'Review' : status}
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
                    <Card className="border-none shadow-none bg-transparent">
                        <CardHeader className="px-0 pt-0">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search orders..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-background"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Select value={networkFilter} onValueChange={setNetworkFilter}>
                                        <SelectTrigger className="w-[140px] bg-background">
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
                    </Card>

                    {filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-lg border border-dashed">
                            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground text-center">No orders found matching your criteria.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredOrders.map((order) => (
                                <Card key={order.id} className="shadow-md hover:shadow-lg transition-shadow duration-200">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <div className="font-mono text-sm text-muted-foreground">
                                            {order.reference_code}
                                        </div>
                                        {getStatusBadge(order.status)}
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                <User className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">{order.users?.first_name} {order.users?.last_name}</p>
                                                <p className="text-xs text-muted-foreground">{order.users?.email}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                                <Phone className="w-3 h-3 text-muted-foreground" />
                                                <span className="font-mono text-xs">{order.phone_number}</span>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                                <Package className="w-3 h-3 text-muted-foreground" />
                                                <span className="text-xs font-medium">{order.network} {order.size}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t">
                                            <p className="text-sm text-muted-foreground">Price</p>
                                            <p className="font-bold text-lg">{formatCurrency(order.price)}</p>
                                        </div>

                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(order.created_at)}
                                        </div>
                                    </CardContent>

                                    <CardFooter className="bg-muted/10 p-4 pt-0 mt-4 flex justify-between items-center border-t border-muted/20">
                                        <div className="w-full pt-4">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="w-full">
                                                        Actions <ChevronDown className="w-4 h-4 ml-2" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Manage Order</DropdownMenuLabel>
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
                                        </div>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="downloaded">
                    {batches.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-lg border border-dashed">
                            <Download className="w-12 h-12 text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground text-center">No download history found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {batches.map((batch) => (
                                <BatchCard key={batch.id} batch={batch} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
