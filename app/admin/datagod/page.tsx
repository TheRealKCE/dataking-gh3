'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Package,
    Activity,
    Server,
    Filter,
    Calendar as CalendarIcon,
    Search,
    DatabaseZap
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
    mtn_fulfillment_tracking: Array<{
        status: string;
        api_response?: any;
    }>
}

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime', 'Special MTN Mashup']

export default function DataGodConsolePage() {
    const { dbUser } = useAuth()

    // Data State
    const [orders, setOrders] = useState<Order[]>([])
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
    const [isLoadingOrders, setIsLoadingOrders] = useState(true)
    const [isRefulfilling, setIsRefulfilling] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [liveStatuses, setLiveStatuses] = useState<Record<string, { status?: string, error?: string }>>({})

    // Filter State
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
    const [networkFilter, setNetworkFilter] = useState('All')
    const [searchQuery, setSearchQuery] = useState('')

    // Balance state
    const [balance, setBalance] = useState<{ amount: number; currency: string; username?: string; role?: string } | null>(null)
    const [isLoadingBalance, setIsLoadingBalance] = useState(false)

    useEffect(() => {
        if (dbUser?.role === 'admin') {
            fetchBalance()
        }
    }, [dbUser])

    useEffect(() => {
        fetchOrders(true)
    }, [networkFilter, activeTab, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

    const fetchOrders = async (resetSelection = false) => {
        setIsLoadingOrders(true)
        if (resetSelection) setSelectedOrders(new Set())
        
        try {
            let url = `/api/admin/datagod/${activeTab === 'pending' ? 'orders' : 'history'}?network=${networkFilter}&limit=100`
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`

            const response = await fetch(url)
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to fetch orders')
            }

            const data = await response.json()
            setOrders(data.orders || [])
        } catch (error: any) {
            console.error('Fetch orders error:', error)
            toast.error('Failed to fetch orders: ' + error.message)
        } finally {
            setIsLoadingOrders(false)
        }
    }

    const fetchBalance = async () => {
        setIsLoadingBalance(true)
        try {
            const response = await fetch('/api/admin/datagod/balance')
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to fetch balance')
            }

            const data = await response.json()
            setBalance({ 
                amount: data.balance, 
                currency: data.currency,
                username: data.username,
                role: data.role
            })
        } catch (error: any) {
            console.error('Balance fetch error:', error)
            toast.error('Failed to fetch supplier balance')
        } finally {
            setIsLoadingBalance(false)
        }
    }

    const fulfillSelected = async () => {
        if (selectedOrders.size === 0) {
            toast.error('No orders selected')
            return
        }

        setIsRefulfilling(true)
        try {
            const orderIds = Array.from(selectedOrders)
            const response = await fetch('/api/admin/datagod/fulfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds }),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Fulfillment failed')

            toast.success(`DataGod Fulfillment complete: ${data.fulfilled} processed, ${data.failed} failed.`)
            setSelectedOrders(new Set())

            await fetchOrders(true)
            await fetchBalance()
        } catch (error: any) {
            toast.error('Fulfillment execution failed: ' + error.message)
        } finally {
            setIsRefulfilling(false)
        }
    }

    const syncSelected = async () => {
        if (selectedOrders.size === 0) {
            toast.error('No orders selected')
            return
        }

        setIsSyncing(true)
        try {
            const orderIds = Array.from(selectedOrders)
            const response = await fetch('/api/admin/datagod/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds }),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Sync failed')

            toast.success(`Fetch complete: ${data.updated} statuses retrieved, ${data.failed} failed.`)
            setSelectedOrders(new Set())

            const newStatuses = { ...liveStatuses }
            data.results?.forEach((r: any) => {
                newStatuses[r.id] = { status: r.status, error: r.error }
            })
            setLiveStatuses(newStatuses)

        } catch (error: any) {
            toast.error('Status fetch failed: ' + error.message)
        } finally {
            setIsSyncing(false)
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
                        <DatabaseZap className="w-8 h-8 text-indigo-500" />
                        DataGod Console
                    </h1>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                        Isolated manual fulfillment system for DataGod provider.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => fetchOrders(true)} disabled={isLoadingOrders} variant="outline" size="sm" className="h-9 md:h-10 text-xs md:text-sm">
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </Button>
                </div>
            </div>

            <Card className="bg-gradient-to-br from-indigo-700 to-indigo-950 text-white border-none shadow-lg">
                <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2.5 rounded-lg">
                                <Server className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-90">
                                    {balance?.username ? `${balance.username} · ${balance.role}` : 'DataGod System'}
                                </p>
                                <p className="text-2xl md:text-3xl font-black">
                                    {balance ? `${balance.currency} ${balance.amount.toFixed(2)}` : (isLoadingBalance ? 'Loading...' : 'GHS 0.00')}
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={fetchBalance}
                            disabled={isLoadingBalance}
                            variant="secondary"
                            size="sm"
                            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                            Refresh Balance
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex border-b">
                <button
                    className={cn(
                        "px-6 py-3 font-bold text-sm transition-colors border-b-2",
                        activeTab === 'pending' 
                            ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" 
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveTab('pending')}
                >
                    Pending Orders (Available)
                </button>
                <button
                    className={cn(
                        "px-6 py-3 font-bold text-sm transition-colors border-b-2",
                        activeTab === 'history' 
                            ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" 
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveTab('history')}
                >
                    DataGod History
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Filter className="w-4 h-4" /> Filters
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

                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Network</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {['All', ...NETWORKS].map(n => (
                                        <Button
                                            key={n}
                                            variant={networkFilter === n ? "default" : "outline"}
                                            size="sm"
                                            className="h-7 text-[10px] px-2.5"
                                            onClick={() => setNetworkFilter(n)}
                                        >
                                            {n}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-3 space-y-4">
                    {selectedOrders.size > 0 && (
                        <div className="sticky top-20 z-30 flex items-center justify-between bg-primary/10 dark:bg-primary/20 backdrop-blur-md border border-primary/20 p-2 md:p-3 rounded-xl shadow-lg animate-in fade-in flex-wrap gap-2 mx-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="default" className="rounded-full px-2 text-[10px]">{selectedOrders.size}</Badge>
                                <span className="text-[10px] md:text-xs font-bold uppercase">Selected</span>
                            </div>
                            {activeTab === 'pending' ? (
                                <Button
                                    size="sm"
                                    onClick={fulfillSelected}
                                    className="h-9 md:h-10 text-xs md:text-sm px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
                                    disabled={isRefulfilling || isSyncing}
                                >
                                    {isRefulfilling ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <DatabaseZap className="w-4 h-4 mr-2" />}
                                    {isRefulfilling ? 'Processing via DataGod...' : 'Fulfill via DataGod'}
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={syncSelected}
                                    className="h-9 md:h-10 text-xs md:text-sm px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                                    disabled={isRefulfilling || isSyncing}
                                >
                                    {isSyncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                    {isSyncing ? 'Fetching Status...' : 'Fetch Live Status'}
                                </Button>
                            )}
                        </div>
                    )}

                    <Card className="shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <CardTitle className="text-lg font-bold">
                                {activeTab === 'pending' ? 'Ready to Fulfill' : 'DataGod Fulfillment Log'}
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedOrders(new Set())} disabled={selectedOrders.size === 0}>
                                    Clear
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedOrders(new Set(orders.map(o => o.id)))} disabled={orders.length === 0}>
                                    Select All
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="px-1 md:px-6">
                            {orders.length === 0 && !isLoadingOrders ? (
                                <div className="text-center py-20 border-2 border-dashed rounded-xl m-2">
                                    <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                                    <h3 className="text-sm font-bold">No Records Found</h3>
                                    <p className="text-muted-foreground text-xs">Try adjusting your filters.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map(order => (
                                        <div
                                            key={order.id}
                                            onClick={() => {
                                                const next = new Set(selectedOrders)
                                                next.has(order.id) ? next.delete(order.id) : next.add(order.id)
                                                setSelectedOrders(next)
                                            }}
                                            className={cn(
                                                "group relative flex items-center gap-3 p-3 border-2 rounded-xl transition-all duration-200 select-none cursor-pointer",
                                                selectedOrders.has(order.id)
                                                    ? "bg-primary/10 border-primary shadow-md scale-[1.01]"
                                                    : "bg-card border-transparent hover:border-primary/20 hover:bg-accent/50"
                                            )}
                                        >
                                            <Checkbox
                                                checked={selectedOrders.has(order.id)}
                                                className="scale-110 pointer-events-none"
                                            />

                                            <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 items-center gap-x-2 gap-y-3 p-1">
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Beneficiary</p>
                                                    <p className="text-sm font-black truncate text-primary">{order.phone_number}</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Bundle</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-secondary/50 font-black">{order.network}</Badge>
                                                        <span className="text-xs font-black">{order.size}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Order ID</p>
                                                    <p className="text-[10px] font-mono font-medium truncate opacity-70" title={order.id}>{order.id}</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Status</p>
                                                    <div className="flex items-center gap-2">
                                                        <Badge
                                                            variant={order.status === 'completed' ? 'success' : order.status === 'failed' ? 'destructive' : order.status === 'pending' ? 'outline' : 'default'}
                                                            className="text-[10px] font-black uppercase"
                                                        >
                                                            {order.status}
                                                        </Badge>
                                                        
                                                        {liveStatuses[order.id] && (
                                                            <>
                                                                <span className="text-[10px] font-bold text-muted-foreground">→</span>
                                                                {liveStatuses[order.id].error ? (
                                                                    <Badge variant="destructive" className="text-[10px] font-black uppercase border-dashed" title={liveStatuses[order.id].error}>
                                                                        ERROR
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge 
                                                                        variant={liveStatuses[order.id].status === 'completed' ? 'success' : liveStatuses[order.id].status === 'failed' ? 'destructive' : 'default'} 
                                                                        className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400"
                                                                        title="Live Status from DataGod"
                                                                    >
                                                                        LIVE: {liveStatuses[order.id].status}
                                                                    </Badge>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5 text-right hidden lg:block">
                                                    <p className="text-[10px] uppercase font-extrabold text-muted-foreground">Time</p>
                                                    <p className="text-xs font-bold opacity-80">
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
