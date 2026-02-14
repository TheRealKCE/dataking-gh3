'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    RefreshCw,
    Wallet,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Package,
    Activity,
    Server,
    Filter
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { fetchSupplierBalance } from '@/lib/fulfillment-service'

interface Order {
    id: string
    created_at: string
    phone_number: string
    network: string
    size: string
    price: number
    status: string
    user_id: string
    users: {
        first_name: string
        last_name: string
        email: string
        role: string
    }
    mtn_fulfillment_tracking: Array<{
        api_response: any
    }>
}

interface FulfillmentSettings {
    is_global_enabled: boolean
    networks: Record<string, boolean>
}

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']

export default function FulfillmentPage() {
    const { dbUser } = useAuth()
    const [orders, setOrders] = useState<Order[]>([])
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
    const [isLoadingOrders, setIsLoadingOrders] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)
    const [networkFilter, setNetworkFilter] = useState('All')

    // Settings state
    const [settings, setSettings] = useState<FulfillmentSettings>({
        is_global_enabled: true,
        networks: NETWORKS.reduce((acc, n) => ({ ...acc, [n]: true }), {})
    })
    const [isSavingSettings, setIsSavingSettings] = useState(false)
    const [supplierBalance, setSupplierBalance] = useState<number | null>(null)
    const [isLoadingBalance, setIsLoadingBalance] = useState(false)

    useEffect(() => {
        if (dbUser?.role === 'admin') {
            fetchSettings()
            fetchOrders()
            getSupplierBalance()
        }
    }, [dbUser, networkFilter])

    const fetchSettings = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('key, value')
                .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings'])

            const map = (data || []).reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            const dbFulfillmentSettings = typeof map.fulfillment_settings === 'string'
                ? JSON.parse(map.fulfillment_settings)
                : map.fulfillment_settings || { networks: {} }

            setSettings({
                is_global_enabled: map.auto_fulfillment_enabled !== 'false',
                networks: {
                    ...NETWORKS.reduce((acc, n) => ({ ...acc, [n]: true }), {}),
                    ...(dbFulfillmentSettings.networks || {})
                }
            })
        } catch (error) {
            console.error('Failed to fetch settings:', error)
        }
    }

    const saveSettings = async (newSettings: FulfillmentSettings) => {
        setIsSavingSettings(true)
        try {
            const updates = [
                { key: 'auto_fulfillment_enabled', value: String(newSettings.is_global_enabled) },
                { key: 'fulfillment_settings', value: JSON.stringify({ networks: newSettings.networks }) }
            ]

            const { error } = await (supabase
                .from('admin_settings') as any)
                .upsert(updates)

            if (error) throw error
            setSettings(newSettings)
            toast.success('Fulfillment settings updated')
        } catch (error: any) {
            toast.error('Failed to save settings: ' + error.message)
        } finally {
            setIsSavingSettings(false)
        }
    }

    const toggleNetwork = (network: string) => {
        const newSettings = {
            ...settings,
            networks: {
                ...settings.networks,
                [network]: !settings.networks[network]
            }
        }
        saveSettings(newSettings)
    }

    const toggleGlobal = () => {
        const newSettings = {
            ...settings,
            is_global_enabled: !settings.is_global_enabled
        }
        saveSettings(newSettings)
    }

    const getSupplierBalance = async () => {
        setIsLoadingBalance(true)
        try {
            const result = await fetchSupplierBalance()
            if (result.success) {
                setSupplierBalance(result.balance || 0)
            }
        } catch (error) {
            console.error('Failed to fetch balance:', error)
        } finally {
            setIsLoadingBalance(false)
        }
    }

    const fetchOrders = async () => {
        setIsLoadingOrders(true)
        try {
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    users(first_name, last_name, email, role),
                    mtn_fulfillment_tracking(api_response)
                `)
                .in('status', ['processing', 'failed', 'completed'])
                .order('created_at', { ascending: false })
                .limit(100)

            if (networkFilter !== 'All') {
                query = query.eq('network', networkFilter)
            }

            const { data, error } = await query

            if (error) throw error
            setOrders(data || [])
        } catch (error: any) {
            toast.error('Failed to fetch orders: ' + error.message)
        } finally {
            setIsLoadingOrders(false)
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
            const response = await fetch('/api/admin/orders/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds, status: newStatus }),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Update failed')

            toast.success(`${orderIds.length} order(s) marked as ${newStatus}`)
            setSelectedOrders(new Set())
            await fetchOrders()
        } catch (error: any) {
            toast.error('Update failed: ' + error.message)
        } finally {
            setIsUpdating(false)
        }
    }

    if (dbUser?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground">Admin privileges required.</p>
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Fulfillment Center</h1>
                    <p className="text-muted-foreground">Manage multi-network automated and manual order processing</p>
                </div>
                <div className="flex items-center gap-3">
                    <Card className="shadow-sm">
                        <CardContent className="p-3 flex items-center gap-4">
                            <div className="bg-primary/10 p-2 rounded-full">
                                <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1">Supplier Balance</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-lg font-bold">
                                        {supplierBalance !== null ? formatCurrency(supplierBalance) : 'GHS 0.00'}
                                    </p>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={getSupplierBalance} disabled={isLoadingBalance}>
                                        <RefreshCw className={`h-3 w-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 bg-background border px-3 py-1.5 rounded-full shadow-sm">
                            <span className="text-xs font-semibold">Auto-Fulfillment</span>
                            <Switch checked={settings.is_global_enabled} onCheckedChange={toggleGlobal} disabled={isSavingSettings} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Network Connections */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {NETWORKS.map(net => (
                    <Card key={net} className={`border-l-4 ${settings.networks[net] ? 'border-l-green-500' : 'border-l-gray-300'}`}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Activity className={`w-4 h-4 ${settings.networks[net] ? 'text-green-500' : 'text-gray-400'}`} />
                                <span className="font-semibold">{net}</span>
                            </div>
                            <Button
                                variant={settings.networks[net] ? "outline" : "default"}
                                size="sm"
                                className="h-8"
                                onClick={() => toggleNetwork(net)}
                                disabled={isSavingSettings}
                            >
                                {settings.networks[net] ? 'Disconnect' : 'Connect'}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Column: Stats & Filters */}
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Filter className="w-4 h-4" /> Filters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Network</label>
                                <div className="flex flex-wrap gap-2">
                                    {['All', ...NETWORKS].map(n => (
                                        <Button
                                            key={n}
                                            variant={networkFilter === n ? "default" : "outline"}
                                            size="sm"
                                            className="h-7 text-xs px-3"
                                            onClick={() => setNetworkFilter(n)}
                                        >
                                            {n}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 border-t">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 italic">
                                        <p className="text-xs text-yellow-700 font-bold">Processing</p>
                                        <p className="text-2xl font-black text-yellow-600">{orders.filter(o => o.status === 'processing').length}</p>
                                    </div>
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                        <p className="text-xs text-green-700 font-bold">Completed</p>
                                        <p className="text-2xl font-black text-green-600">{orders.filter(o => o.status === 'completed').length}</p>
                                    </div>
                                    <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                        <p className="text-xs text-red-700 font-bold">Failed</p>
                                        <p className="text-2xl font-black text-red-600">{orders.filter(o => o.status === 'failed').length}</p>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <p className="text-xs text-blue-700 font-bold">Selected</p>
                                        <p className="text-2xl font-black text-blue-600">{selectedOrders.size}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-none shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Server className="w-5 h-5" /> Automation Tip
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs leading-relaxed opacity-90">
                            Status sync is now manual to save CPU. Mark orders as complete or failed after checking your supplier portal history. Correct status ensures platform integrity.
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Order List */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Bulk Actions Bar */}
                    {selectedOrders.size > 0 && (
                        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-4 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center gap-2">
                                <Badge variant="default" className="rounded-full px-2.5">{selectedOrders.size}</Badge>
                                <span className="text-sm font-medium">Orders Ready to Update</span>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={() => bulkUpdateStatus('completed')} className="bg-green-600 hover:bg-green-700 shadow-sm" disabled={isUpdating}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Completed
                                </Button>
                                <Button size="sm" onClick={() => bulkUpdateStatus('failed')} variant="destructive" className="shadow-sm" disabled={isUpdating}>
                                    <XCircle className="w-4 h-4 mr-2" /> Mark Failed
                                </Button>
                            </div>
                        </div>
                    )}

                    <Card className="shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <CardTitle className="text-xl font-bold">Order History</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedOrders(new Set())} disabled={selectedOrders.size === 0}>
                                    Clear Selection
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setSelectedOrders(new Set(orders.map(o => o.id)))} disabled={orders.length === 0}>
                                    Select All Page
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingOrders ? (
                                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                                    <RefreshCw className="w-10 h-10 animate-spin mb-4" />
                                    <span>Syncing with database...</span>
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="text-center py-20 border-2 border-dashed rounded-xl">
                                    <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                                    <h3 className="text-lg font-bold">No Records Found</h3>
                                    <p className="text-muted-foreground text-sm">No orders matching your current filters.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map(order => (
                                        <div
                                            key={order.id}
                                            className={`group relative flex items-center gap-4 p-4 border rounded-xl transition-all duration-200 hover:shadow-md ${selectedOrders.has(order.id) ? 'bg-primary/5 border-primary/50' : 'bg-card hover:border-primary/20'
                                                }`}
                                        >
                                            <Checkbox
                                                checked={selectedOrders.has(order.id)}
                                                onCheckedChange={() => {
                                                    const next = new Set(selectedOrders)
                                                    next.has(order.id) ? next.delete(order.id) : next.add(order.id)
                                                    setSelectedOrders(next)
                                                }}
                                            />

                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-6 items-center gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Beneficiary</p>
                                                    <p className="text-sm font-bold truncate">{order.phone_number}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Bundle</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant="outline" className="text-[10px] px-1 font-black">{order.network}</Badge>
                                                        <span className="text-sm font-bold">{order.size}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1 hidden md:block">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Cost</p>
                                                    <p className="text-sm font-semibold">{formatCurrency(order.price)}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Purchaser</p>
                                                    <div className="text-xs">
                                                        <p className="font-bold truncate">{order.users?.first_name} {order.users?.last_name}</p>
                                                        <p className="text-muted-foreground opacity-60 capitalize">{order.users?.role}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Status</p>
                                                    <Badge
                                                        variant={order.status === 'completed' ? 'success' : order.status === 'failed' ? 'destructive' : 'default'}
                                                        className="text-[10px] font-black uppercase tracking-wider h-5"
                                                    >
                                                        {order.status}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-1 text-right">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Timestamp</p>
                                                    <p className="text-[10px] font-medium opacity-60">
                                                        {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
