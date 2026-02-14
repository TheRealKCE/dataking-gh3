'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Package,
    Activity,
    Server,
    Filter,
    RotateCcw,
    Search,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'

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
        role: string
    }
    mtn_fulfillment_tracking: Array<{
        transaction_id: string
    }>
}

interface FulfillmentSettings {
    is_global_enabled: boolean
    networks: Record<string, boolean>
}

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const PAGE_SIZE = 10

export default function FulfillmentPage() {
    const { dbUser } = useAuth()

    // Data State
    const [orders, setOrders] = useState<Order[]>([])
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
    const [isLoadingOrders, setIsLoadingOrders] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)

    // Filter State
    const [networkFilter, setNetworkFilter] = useState('All')
    const [dateFilter, setDateFilter] = useState('today')
    const [customDate, setCustomDate] = useState<Date | undefined>(undefined)
    const [searchQuery, setSearchQuery] = useState('')

    // Pagination State
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)

    // Settings state
    const [settings, setSettings] = useState<FulfillmentSettings>({
        is_global_enabled: true,
        networks: NETWORKS.reduce((acc, n) => ({ ...acc, [n]: true }), {})
    })
    const [isSavingSettings, setIsSavingSettings] = useState(false)

    useEffect(() => {
        if (dbUser?.role === 'admin') {
            fetchSettings()
        }
    }, [dbUser])

    // Reset page when filters change
    useEffect(() => {
        setPage(0)
        fetchOrders(0, true)
    }, [networkFilter, dateFilter, customDate, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

    // Determine Date Range
    const getDateRange = () => {
        const now = new Date()
        let start: Date | null = null
        let end: Date | null = null

        if (dateFilter === 'today') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        } else if (dateFilter === 'yesterday') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999)
        } else if (dateFilter === 'week') {
            const day = now.getDay() || 7 // Get current day number, converting Sun (0) to 7
            if (day !== 1) now.setHours(-24 * (day - 1)) // Set to Monday of this week
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            end = new Date() // Up to now
        } else if (dateFilter === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1)
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        } else if (dateFilter === 'custom' && customDate) {
            start = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate())
            end = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 23, 59, 59, 999)
        }

        return { start, end }
    }

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

    const fetchOrders = async (pageIdx = 0, isNewFilter = false) => {
        setIsLoadingOrders(true)
        try {
            const { start, end } = getDateRange()

            let query = supabase
                .from('orders')
                .select(`
                    id, created_at, phone_number, network, size, price, status, user_id,
                    users(first_name, last_name, role),
                    mtn_fulfillment_tracking!inner(transaction_id)
                `)
                .in('status', ['processing', 'failed', 'completed'])
                .is('batch_id', null) // Exclude manually downloaded orders (batched)
                .order('created_at', { ascending: false })
                .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1)

            // Apply Filters
            if (networkFilter !== 'All') {
                query = query.eq('network', networkFilter)
            }
            if (start) query = query.gte('created_at', start.toISOString())
            if (end) query = query.lte('created_at', end.toISOString())

            if (searchQuery) {
                query = query.ilike('phone_number', `%${searchQuery}%`)
            }

            const { data, error } = await query

            if (error) throw error

            const fetchedOrders = data as any as Order[] || []

            if (isNewFilter) {
                setOrders(fetchedOrders)
            } else {
                setOrders(prev => [...prev, ...fetchedOrders])
            }

            setHasMore(fetchedOrders.length === PAGE_SIZE)
        } catch (error: any) {
            toast.error('Failed to fetch orders: ' + error.message)
        } finally {
            setIsLoadingOrders(false)
        }
    }

    const loadMore = () => {
        const nextPage = page + 1
        setPage(nextPage)
        fetchOrders(nextPage, false)
    }

    const bulkUpdateStatus = async (newStatus: 'completed' | 'failed' | 'processing') => {
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

            // Re-fetch current view
            setPage(0)
            await fetchOrders(0, true)
        } catch (error: any) {
            toast.error('Update failed: ' + error.message)
        } finally {
            setIsUpdating(false)
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
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Fulfillment Center</h1>
                    <p className="text-xs md:text-sm text-muted-foreground">Manage multi-network automated and manual order processing</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => { setPage(0); fetchOrders(0, true); }} disabled={isLoadingOrders} variant="outline" size="sm">
                        <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <div className="flex items-center gap-2 bg-background border px-3 py-1.5 rounded-full shadow-sm">
                        <span className="text-[10px] md:text-xs font-semibold">Auto-Fulfillment</span>
                        <Switch checked={settings.is_global_enabled} onCheckedChange={toggleGlobal} disabled={isSavingSettings} className="scale-75 md:scale-90" />
                    </div>
                </div>
            </div>

            {/* Network Connections */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {NETWORKS.map(net => (
                    <Card key={net} className={`border-l-4 ${settings.networks[net] ? 'border-l-green-500' : 'border-l-gray-300'}`}>
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Activity className={`w-3.5 h-3.5 ${settings.networks[net] ? 'text-green-500' : 'text-gray-400'}`} />
                                    <span className="font-semibold text-xs md:text-sm">{net}</span>
                                </div>
                                <Button
                                    variant={settings.networks[net] ? "outline" : "default"}
                                    size="sm"
                                    className="h-6 text-[10px] md:text-xs px-2"
                                    onClick={() => toggleNetwork(net)}
                                    disabled={isSavingSettings}
                                >
                                    {settings.networks[net] ? 'Disconnect' : 'Connect'}
                                </Button>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Server className="w-3 h-3" />
                                Provider: <span className="font-medium text-primary">DataKazina</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Column: Stats & Filters */}
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Filter className="w-4 h-4" /> Filters & Search
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search Beneficiary..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 text-xs h-8"
                                />
                            </div>

                            {/* Date Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Date Range</label>
                                <Select value={dateFilter} onValueChange={setDateFilter}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todays">Today (Now)</SelectItem>
                                        <SelectItem value="today">Today (00:00 - 23:59)</SelectItem>
                                        <SelectItem value="yesterday">Yesterday</SelectItem>
                                        <SelectItem value="week">This Week</SelectItem>
                                        <SelectItem value="month">This Month</SelectItem>
                                        <SelectItem value="all">All Time</SelectItem>
                                        <SelectItem value="custom">Custom Date</SelectItem>
                                    </SelectContent>
                                </Select>
                                {dateFilter === 'custom' && (
                                    <div className="mt-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start text-left font-normal text-xs h-8">
                                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                    {customDate ? format(customDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={customDate}
                                                    onSelect={setCustomDate}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}
                            </div>

                            {/* Network Filter */}
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

                            <div className="pt-4 border-t">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2.5 bg-yellow-50 rounded-lg border border-yellow-100 italic">
                                        <p className="text-[10px] text-yellow-700 font-bold">Processing</p>
                                        <p className="text-xl font-black text-yellow-600">{orders.filter(o => o.status === 'processing').length}</p>
                                    </div>
                                    <div className="p-2.5 bg-green-50 rounded-lg border border-green-100">
                                        <p className="text-[10px] text-green-700 font-bold">Completed</p>
                                        <p className="text-xl font-black text-green-600">{orders.filter(o => o.status === 'completed').length}</p>
                                    </div>
                                    <div className="p-2.5 bg-red-50 rounded-lg border border-red-100">
                                        <p className="text-[10px] text-red-700 font-bold">Failed</p>
                                        <p className="text-xl font-black text-red-600">{orders.filter(o => o.status === 'failed').length}</p>
                                    </div>
                                    <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                                        <p className="text-[10px] text-blue-700 font-bold">Selected</p>
                                        <p className="text-xl font-black text-blue-600">{selectedOrders.size}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-none shadow-lg">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Server className="w-4 h-4" /> Tip
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-[10px] leading-relaxed opacity-90">
                            Check supplier portal manually. Mark orders appropriately to maintain accurate records.
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Order List */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Bulk Actions Bar */}
                    {selectedOrders.size > 0 && (
                        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-3 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="default" className="rounded-full px-2 text-[10px]">{selectedOrders.size}</Badge>
                                <span className="text-xs font-medium">Selected</span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <Button size="sm" onClick={() => bulkUpdateStatus('processing')} className="h-7 text-[10px] bg-yellow-500 hover:bg-yellow-600 text-black shadow-sm" disabled={isUpdating}>
                                    <RotateCcw className="w-3 h-3 mr-1.5" /> Reprocess
                                </Button>
                                <Button size="sm" onClick={() => bulkUpdateStatus('completed')} className="h-7 text-[10px] bg-green-600 hover:bg-green-700 shadow-sm" disabled={isUpdating}>
                                    <CheckCircle2 className="w-3 h-3 mr-1.5" /> Complete
                                </Button>
                                <Button size="sm" onClick={() => bulkUpdateStatus('failed')} variant="destructive" className="h-7 text-[10px] shadow-sm" disabled={isUpdating}>
                                    <XCircle className="w-3 h-3 mr-1.5" /> Fail
                                </Button>
                            </div>
                        </div>
                    )}

                    <Card className="shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <CardTitle className="text-lg font-bold">Order History</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedOrders(new Set())} disabled={selectedOrders.size === 0}>
                                    Clear
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedOrders(new Set(orders.map(o => o.id)))} disabled={orders.length === 0}>
                                    Select Page
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="px-2 md:px-6">
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
                                            className={`group relative flex items-center gap-3 p-3 border rounded-xl transition-all duration-200 hover:shadow-md ${selectedOrders.has(order.id) ? 'bg-primary/5 border-primary/50' : 'bg-card hover:border-primary/20'
                                                }`}
                                        >
                                            <Checkbox
                                                checked={selectedOrders.has(order.id)}
                                                onCheckedChange={() => {
                                                    const next = new Set(selectedOrders)
                                                    next.has(order.id) ? next.delete(order.id) : next.add(order.id)
                                                    setSelectedOrders(next)
                                                }}
                                                className="scale-90"
                                            />

                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-6 items-center gap-2 md:gap-4">
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] uppercase font-extrabold text-muted-foreground">Beneficiary</p>
                                                    <p className="text-xs md:text-sm font-bold truncate">{order.phone_number}</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] uppercase font-extrabold text-muted-foreground">Bundle</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant="outline" className="text-[9px] px-1 font-black leading-none py-0.5">{order.network}</Badge>
                                                        <span className="text-xs font-bold">{order.size}</span>
                                                    </div>
                                                </div>
                                                <div className="hidden md:block space-y-0.5">
                                                    <p className="text-[9px] uppercase font-extrabold text-muted-foreground">Cost</p>
                                                    <p className="text-xs font-semibold">{formatCurrency(order.price)}</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] uppercase font-extrabold text-muted-foreground">Purchaser</p>
                                                    <div className="text-[10px] md:text-xs">
                                                        <p className="font-bold truncate max-w-[80px] md:max-w-full" title={`${order.users?.first_name} ${order.users?.last_name}`}>
                                                            {order.users?.first_name || 'N/A'} {order.users?.last_name || ''}
                                                        </p>
                                                        <p className="text-muted-foreground opacity-60 capitalize">{order.users?.role || 'User'}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] uppercase font-extrabold text-muted-foreground">Status</p>
                                                    <Badge
                                                        variant={order.status === 'completed' ? 'success' : order.status === 'failed' ? 'destructive' : 'default'}
                                                        className="text-[9px] font-black uppercase tracking-wider h-4 md:h-5 px-1.5"
                                                    >
                                                        {order.status}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-0.5 text-right">
                                                    <p className="text-[9px] uppercase font-extrabold text-muted-foreground">Time</p>
                                                    <p className="text-[9px] md:text-[10px] font-medium opacity-60">
                                                        {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Transaction ID if available */}
                                            {order.mtn_fulfillment_tracking?.[0]?.transaction_id && (
                                                <div className="absolute top-1 right-1 hidden group-hover:block">
                                                    <Badge variant="secondary" className="text-[8px] font-mono px-1 py-0 h-3">
                                                        #{order.mtn_fulfillment_tracking[0].transaction_id}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Pagination Controls */}
                                    <div className="pt-4 flex items-center justify-center gap-4">
                                        {hasMore ? (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={loadMore}
                                                disabled={isLoadingOrders}
                                                className="w-full md:w-auto min-w-[150px]"
                                            >
                                                {isLoadingOrders && <RefreshCw className="h-3 w-3 mr-2 animate-spin" />}
                                                Load More Orders
                                            </Button>
                                        ) : orders.length > 0 && (
                                            <p className="text-xs text-muted-foreground">No more orders to load</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
