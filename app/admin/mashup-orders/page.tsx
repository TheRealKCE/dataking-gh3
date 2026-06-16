'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Package,
    Activity,
    Search,
    Zap,
    Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, cn } from '@/lib/utils'

interface Order {
    id: string
    created_at: string
    phone_number: string
    network: string
    size: string
    price: number
    status: string
    user_id: string
    shop_name?: string
    users: {
        first_name: string
        last_name: string
        role: string
    }
}

export default function MashupOrdersPage() {
    const { dbUser } = useAuth()

    const [orders, setOrders] = useState<Order[]>([])
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
    const [isLoadingOrders, setIsLoadingOrders] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        fetchOrders()
    }, [])

    const fetchOrders = async (resetSelection = false) => {
        setIsLoadingOrders(true)
        if (resetSelection) setSelectedOrders(new Set())
        
        try {
            // We use the existing orders API but strictly fetch pending/processing
            const response = await fetch(`/api/admin/orders?available=true`)
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to fetch orders')
            }

            const data = await response.json()
            // Filter strictly for Special MTN Mashup on the client to keep it simple,
            // though the API could handle it if we added a network filter.
            const mashupOrders = (data.orders || []).filter((o: Order) => o.network === 'Special MTN Mashup')
            setOrders(mashupOrders)
        } catch (error: any) {
            console.error('Fetch orders error:', error)
            toast.error('Failed to fetch orders: ' + error.message)
        } finally {
            setIsLoadingOrders(false)
        }
    }

    const filteredOrders = orders.filter(order => {
        if (!searchQuery) return true
        return order.phone_number.includes(searchQuery) || 
               order.users?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               order.users?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
    })

    const handleUpdateStatus = async (status: 'completed' | 'failed' | 'processing') => {
        if (selectedOrders.size === 0) {
            toast.error('No orders selected')
            return
        }

        if (!confirm(`Mark ${selectedOrders.size} order(s) as ${status}?`)) return

        setIsUpdating(true)
        try {
            const orderIds = Array.from(selectedOrders)
            const res = await fetch('/api/admin/orders/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds, status }),
            })
            
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to update orders')
            }

            toast.success(`Successfully marked ${selectedOrders.size} orders as ${status}`)
            setSelectedOrders(new Set())
            fetchOrders()
        } catch (error: any) {
            toast.error('Status update failed: ' + error.message)
            fetchOrders() // Refresh anyway to get latest state
        } finally {
            setIsUpdating(false)
        }
    }

    const handleSingleUpdate = async (orderId: string, status: 'completed' | 'failed' | 'processing') => {
        if (!confirm(`Mark order as ${status}?`)) return

        try {
            const res = await fetch('/api/admin/orders/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: [orderId], status }),
            })
            
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to update order')
            }

            toast.success(`Order marked as ${status}`)
            fetchOrders()
        } catch (error: any) {
            toast.error('Status update failed: ' + error.message)
        }
    }

    if (dbUser?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <Activity className="w-12 h-12 text-destructive mb-4" />
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground">Admin privileges required.</p>
            </div>
        )
    }

    return (
        <div className="px-2 py-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <Zap className="w-8 h-8 text-yellow-500" />
                        Special MTN Mashup
                    </h1>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                        Manual fulfillment queue for custom Mashup packages.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => fetchOrders(true)} disabled={isLoadingOrders} variant="outline" size="sm" className="h-9 md:h-10 text-xs md:text-sm">
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </Button>
                </div>
            </div>

            <Card className="bg-gradient-to-br from-yellow-500 to-yellow-700 text-black border-none shadow-lg">
                <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-black/10 p-2.5 rounded-lg">
                                <Package className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-90">
                                    Pending Orders
                                </p>
                                <p className="text-2xl md:text-3xl font-black">
                                    {isLoadingOrders ? '...' : filteredOrders.length}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Search className="w-4 h-4" /> Search
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search Phone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 text-xs h-8"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-3 space-y-4">
                    {selectedOrders.size > 0 && (
                        <div className="sticky top-20 z-30 flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 backdrop-blur-md border border-yellow-200 dark:border-yellow-900 p-2 md:p-3 rounded-xl shadow-lg animate-in fade-in flex-wrap gap-2 mx-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="default" className="rounded-full px-2 text-[10px] bg-yellow-500 text-black">{selectedOrders.size}</Badge>
                                <span className="text-[10px] md:text-xs font-bold uppercase text-yellow-900 dark:text-yellow-500">Selected</span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleUpdateStatus('failed')}
                                    className="h-9 md:h-10 text-xs md:text-sm px-4 bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm"
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                                    Mark Failed
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleUpdateStatus('processing')}
                                    className="h-9 md:h-10 text-xs md:text-sm px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
                                    Mark Processing
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleUpdateStatus('completed')}
                                    className="h-9 md:h-10 text-xs md:text-sm px-4 bg-green-600 hover:bg-green-700 text-white font-bold shadow-sm"
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                    Mark Completed
                                </Button>
                            </div>
                        </div>
                    )}

                    <Card className="shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <CardTitle className="text-lg font-bold">
                                Manual Processing Queue
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedOrders(new Set())} disabled={selectedOrders.size === 0}>
                                    Clear
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedOrders(new Set(filteredOrders.map(o => o.id)))} disabled={filteredOrders.length === 0}>
                                    Select All
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="px-1 md:px-6">
                            {filteredOrders.length === 0 && !isLoadingOrders ? (
                                <div className="text-center py-20 border-2 border-dashed rounded-xl m-2">
                                    <Zap className="w-12 h-12 mx-auto text-yellow-500/30 mb-3" />
                                    <h3 className="text-sm font-bold">No Pending Mashup Orders</h3>
                                    <p className="text-muted-foreground text-xs">All caught up!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredOrders.map(order => (
                                        <div
                                            key={order.id}
                                            className={cn(
                                                "group relative flex items-center gap-3 p-3 border-2 rounded-xl transition-all duration-200 select-none",
                                                selectedOrders.has(order.id)
                                                    ? "bg-yellow-500/10 border-yellow-500 shadow-md scale-[1.01]"
                                                    : "bg-card border-transparent hover:border-yellow-500/20 hover:bg-accent/50"
                                            )}
                                        >
                                            <div 
                                                className="cursor-pointer p-2 -m-2" 
                                                onClick={() => {
                                                    const next = new Set(selectedOrders)
                                                    next.has(order.id) ? next.delete(order.id) : next.add(order.id)
                                                    setSelectedOrders(next)
                                                }}
                                            >
                                                <Checkbox
                                                    checked={selectedOrders.has(order.id)}
                                                    className="scale-110 pointer-events-none"
                                                />
                                            </div>

                                            <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 items-center gap-x-2 gap-y-3 p-1">
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Beneficiary</p>
                                                    <p className="text-sm font-black truncate text-primary">{order.phone_number}</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Bundle</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-black bg-yellow-500 text-black px-1 rounded">{order.size}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5 hidden lg:block">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">User</p>
                                                    <p className="text-[10px] font-medium truncate opacity-70">
                                                        {order.users?.first_name} {order.users?.last_name}
                                                    </p>
                                                    {order.shop_name && (
                                                        <Badge variant="secondary" className="text-[9px] h-4 px-1 flex w-max">Shop: {order.shop_name}</Badge>
                                                    )}
                                                </div>
                                                <div className="space-y-0.5 text-right lg:text-left">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Status</p>
                                                    <Badge
                                                        variant={order.status === 'processing' ? 'default' : 'outline'}
                                                        className={cn("text-[10px] font-black uppercase cursor-pointer", 
                                                            order.status === 'processing' ? 'bg-blue-500 hover:bg-blue-600' : ''
                                                        )}
                                                        onClick={() => {
                                                            if (order.status === 'pending') handleSingleUpdate(order.id, 'processing')
                                                        }}
                                                    >
                                                        {order.status}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-0.5 text-right hidden lg:block">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Time</p>
                                                    <p className="text-xs font-bold opacity-80 flex items-center justify-end gap-1">
                                                        <Clock className="w-3 h-3 text-muted-foreground" />
                                                        {new Date(order.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
