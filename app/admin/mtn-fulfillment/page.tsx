'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    RefreshCw,
    Wallet,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Package
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

interface Order {
    id: string
    created_at: string
    phone_number: string
    size: string
    price: number
    status: string
    user_id: string
    users: {
        first_name: string
        last_name: string
        email: string
    }
    mtn_fulfillment_tracking: Array<{
        api_response: any
    }>
}

export default function MTNFulfillmentPage() {
    const { dbUser } = useAuth()
    const [orders, setOrders] = useState<Order[]>([])
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
    const [supplierBalance, setSupplierBalance] = useState<number | null>(null)
    const [isLoadingBalance, setIsLoadingBalance] = useState(false)
    const [isLoadingOrders, setIsLoadingOrders] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        if (dbUser?.role === 'admin') {
            fetchOrders()
        }
    }, [dbUser])

    const fetchOrders = async () => {
        setIsLoadingOrders(true)
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    users(first_name, last_name, email),
                    mtn_fulfillment_tracking(api_response)
                `)
                .eq('network', 'MTN')
                .in('status', ['pending', 'processing'])
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error
            setOrders(data || [])
        } catch (error: any) {
            toast.error('Failed to fetch orders: ' + error.message)
        } finally {
            setIsLoadingOrders(false)
        }
    }

    const fetchBalance = async () => {
        setIsLoadingBalance(true)
        try {
            const response = await fetch('/api/admin/supplier-balance')
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch balance')
            }

            setSupplierBalance(data.balance)
            toast.success(`Supplier Balance: GHS ${data.balance.toFixed(2)}`)
        } catch (error: any) {
            toast.error(error.message || 'Failed to fetch balance')
        } finally {
            setIsLoadingBalance(false)
        }
    }

    const toggleOrderSelection = (orderId: string) => {
        const newSelection = new Set(selectedOrders)
        if (newSelection.has(orderId)) {
            newSelection.delete(orderId)
        } else {
            newSelection.add(orderId)
        }
        setSelectedOrders(newSelection)
    }

    const selectAll = () => {
        if (selectedOrders.size === orders.length) {
            setSelectedOrders(new Set())
        } else {
            setSelectedOrders(new Set(orders.map(o => o.id)))
        }
    }

    const bulkUpdateStatus = async (newStatus: 'completed' | 'failed') => {
        if (selectedOrders.size === 0) {
            toast.error('No orders selected')
            return
        }

        setIsUpdating(true)
        try {
            const orderIds = Array.from(selectedOrders)

            const { error } = await (supabase.from('orders') as any)
                .update({ status: newStatus })
                .in('id', orderIds)

            if (error) throw error

            toast.success(`${orderIds.length} order(s) marked as ${newStatus}`)
            setSelectedOrders(new Set())
            fetchOrders()
        } catch (error: any) {
            toast.error('Failed to update orders: ' + error.message)
        } finally {
            setIsUpdating(false)
        }
    }

    if (dbUser?.role !== 'admin') {
        return (
            <div className="text-center p-8">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p className="text-muted-foreground">Admin access required</p>
            </div>
        )
    }

    const processingOrders = orders.filter(o => o.status === 'processing')
    const pendingOrders = orders.filter(o => o.status === 'pending')

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">MTN Fulfillment Management</h1>
                    <p className="text-muted-foreground">Manage manual order completions</p>
                </div>
                <Button onClick={fetchOrders} disabled={isLoadingOrders}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                    Refresh Orders
                </Button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Processing</p>
                                <p className="text-2xl font-bold">{processingOrders.length}</p>
                            </div>
                            <Clock className="w-8 h-8 text-yellow-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Pending</p>
                                <p className="text-2xl font-bold">{pendingOrders.length}</p>
                            </div>
                            <Package className="w-8 h-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Selected</p>
                                <p className="text-2xl font-bold">{selectedOrders.size}</p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Supplier Balance</p>
                            <p className="text-2xl font-bold mb-2">
                                {supplierBalance !== null
                                    ? formatCurrency(supplierBalance)
                                    : '---'
                                }
                            </p>
                            <Button
                                size="sm"
                                onClick={fetchBalance}
                                disabled={isLoadingBalance}
                                className="w-full"
                            >
                                <Wallet className={`w-3 h-3 mr-2 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                                {isLoadingBalance ? 'Checking...' : 'Check Balance'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bulk Actions */}
            {selectedOrders.size > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <p className="font-medium">
                                {selectedOrders.size} order(s) selected
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => bulkUpdateStatus('completed')}
                                    disabled={isUpdating}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Mark as Completed
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => bulkUpdateStatus('failed')}
                                    disabled={isUpdating}
                                    variant="destructive"
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Mark as Failed
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Orders List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>MTN Orders (Pending / Processing)</CardTitle>
                        {orders.length > 0 && (
                            <Button variant="outline" size="sm" onClick={selectAll}>
                                {selectedOrders.size === orders.length ? 'Deselect All' : 'Select All'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingOrders ? (
                        <div className="text-center py-8">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                            <p className="text-muted-foreground mt-2">Loading orders...</p>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-2" />
                            <p className="font-medium">All orders completed!</p>
                            <p className="text-sm text-muted-foreground">No pending or processing orders</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {orders.map(order => (
                                <div
                                    key={order.id}
                                    className={`p-4 border rounded-lg hover:bg-gray-50 transition-colors ${selectedOrders.has(order.id) ? 'bg-blue-50 border-blue-300' : ''
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <Checkbox
                                            checked={selectedOrders.has(order.id)}
                                            onCheckedChange={() => toggleOrderSelection(order.id)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Phone</p>
                                                <p className="font-medium">{order.phone_number}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Size</p>
                                                <p className="font-medium">{order.size}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Price</p>
                                                <p className="font-medium">{formatCurrency(order.price)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Customer</p>
                                                <p className="font-medium text-sm">
                                                    {order.users?.first_name} {order.users?.last_name}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Status</p>
                                                <Badge variant={order.status === 'processing' ? 'default' : 'secondary'}>
                                                    {order.status}
                                                </Badge>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Created</p>
                                                <p className="text-sm">
                                                    {new Date(order.created_at).toLocaleString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    {order.mtn_fulfillment_tracking?.[0]?.api_response?.data?.transaction_id && (
                                        <div className="mt-2 ml-10 text-xs text-muted-foreground">
                                            Transaction: {order.mtn_fulfillment_tracking[0].api_response.data.transaction_id}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
