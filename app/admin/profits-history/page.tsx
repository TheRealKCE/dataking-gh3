'use client'

import { useEffect, useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    DollarSign,
    Wallet,
    BarChart3,
    Users,
    AlertCircle,
    Store,
    Activity
} from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts'

type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
type ChannelFilter = 'all' | 'main' | 'shop'

export default function AdminProfitsPage() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [range, setRange] = useState<TimeRange>('today')
    const [channel, setChannel] = useState<ChannelFilter>('all')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    const [data, setData] = useState<any>(null)

    useEffect(() => {
        fetchAnalytics()
    }, [range, customStart, customEnd])

    const fetchAnalytics = async () => {
        setLoading(true)
        setError(null)
        try {
            const now = new Date()
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

            let startDate: Date
            let endDate: Date

            if (range === 'today') {
                startDate = todayStart
                endDate = todayEnd
            } else if (range === 'yesterday') {
                startDate = new Date(todayStart)
                startDate.setDate(startDate.getDate() - 1)
                endDate = new Date(todayEnd)
                endDate.setDate(endDate.getDate() - 1)
            } else if (range === 'week') {
                const dayOfWeek = now.getDay() || 7
                startDate = new Date(todayStart)
                startDate.setDate(startDate.getDate() - dayOfWeek + 1)
                endDate = todayEnd
            } else if (range === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
                endDate = todayEnd
            } else if (range === 'all') {
                startDate = new Date(2023, 0, 1)
                endDate = todayEnd
            } else {
                startDate = customStart ? new Date(customStart) : todayStart
                endDate = customEnd ? new Date(customEnd) : todayEnd
                if (endDate < startDate) endDate = new Date(startDate)
                endDate.setHours(23, 59, 59, 999)
            }

            const url = `/api/admin/profit-analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
            const res = await fetch(url)
            const json = await res.json()

            if (!res.ok) throw new Error(json.error || 'Failed to load analytics')
            setData(json)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // --- Derived Views based on Channel Filter ---
    const displayMetrics = useMemo(() => {
        if (!data) return null

        if (channel === 'main') {
            return {
                revenue: data.main_stats.revenue,
                cost: data.main_stats.cost,
                profit: data.main_stats.profit,
                orders: data.main_stats.orders,
            }
        }
        if (channel === 'shop') {
            // Note: from shop platform perspective
            return {
                revenue: data.shop_stats.revenue,
                cost: data.shop_stats.platform_cost,
                profit: data.shop_stats.platform_profit,
                orders: data.shop_stats.orders,
            }
        }
        return {
            revenue: data.summary.total_revenue,
            cost: data.summary.total_cost,
            profit: data.summary.total_profit,
            orders: data.summary.total_orders,
        }
    }, [data, channel])

    const insights = useMemo(() => {
        if (!data) return null
        const margin = data.summary.profit_margin || 0
        const growth = data.summary.growth_percent || 0
        const mainP = data.main_stats.profit || 0
        const shopP = data.shop_stats.platform_profit || 0
        
        let growthText = growth >= 0 
           ? `Profit is up by ${growth.toFixed(1)}% compared to the previous period.`
           : `Profit is down by ${Math.abs(growth).toFixed(1)}% compared to the previous period.`
        
        let domText = mainP > shopP 
           ? `Main platform drives ${(mainP / (mainP + shopP || 1) * 100).toFixed(0)}% of your earnings.`
           : `Shops drive ${(shopP / (mainP + shopP || 1) * 100).toFixed(0)}% of your earnings.`

        let healthText = margin > 20 
           ? 'Healthy margins above 20%.' 
           : margin > 5 ? 'Stable, moderate margins.' : 'Low margins. Consider adjusting pricing.'

        return [
            { title: 'Growth Trend', desc: growthText, icon: growth >= 0 ? TrendingUp : TrendingDown, color: growth >= 0 ? 'text-green-500' : 'text-red-500' },
            { title: 'Channel Dominance', desc: domText, icon: Store, color: 'text-blue-500' },
            { title: 'Business Health', desc: healthText, icon: Activity, color: margin > 10 ? 'text-emerald-500' : 'text-amber-500' }
        ]
    }, [data])

    if (loading && !data) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-red-500 max-w-lg mx-auto mt-20">
                    <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                        <AlertCircle className="w-12 h-12 text-red-500" />
                        <h2 className="text-xl font-semibold">Failed to load analytics</h2>
                        <p className="text-muted-foreground">{error}</p>
                        <Button onClick={fetchAnalytics}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const COLORS = ['#10b981', '#3b82f6'];

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8 bg-zinc-50/50 min-h-screen pb-20">
            
            {/* --- HEADER & CONTROLS --- */}
            <div className="flex flex-col gap-6 md:flex-row md:items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Financial Intelligence</h1>
                    <p className="text-muted-foreground">Comprehensive overview of revenue, costs, and pure profit.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl shadow-sm border">
                    {(['today', 'yesterday', 'week', 'month', 'all'] as TimeRange[]).map((r) => (
                        <Button
                            key={r}
                            variant={range === r ? "default" : "ghost"}
                            className={`rounded-lg ${range === r ? 'shadow-sm' : ''}`}
                            size="sm"
                            onClick={() => setRange(r)}
                        >
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                        </Button>
                    ))}
                    <div className="h-6 w-px bg-border mx-1" />
                    <Button 
                        variant={range === 'custom' ? "default" : "ghost"} 
                        size="sm" 
                        onClick={() => setRange('custom')}
                        className="rounded-lg"
                    >
                        <Calendar className="w-4 h-4 mr-2" /> Custom
                    </Button>
                </div>
            </div>

            {range === 'custom' && (
                <Card className="bg-white/50 backdrop-blur-sm border-dashed">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium uppercase text-muted-foreground tracking-wider">Start Date</label>
                            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[160px]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium uppercase text-muted-foreground tracking-wider">End Date</label>
                            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[160px]" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* --- TRANSPARENCY NOTICE --- */}
            {data?.summary?.excluded_orders > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                        <p className="font-semibold text-sm">Transparency Notice</p>
                        <p className="text-sm">
                            {data.summary.excluded_orders} {data.summary.excluded_orders === 1 ? 'transaction was' : 'transactions were'} excluded from this period's profit analytics because accurate historical supplier cost data was unavailable at the time of purchase.
                        </p>
                    </div>
                </div>
            )}

            {/* --- TOP SUMMARY CARDS --- */}
            <Tabs defaultValue="all" value={channel} onValueChange={(v) => setChannel(v as ChannelFilter)} className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <TabsList className="bg-white border shadow-sm">
                        <TabsTrigger value="all">Overall System</TabsTrigger>
                        <TabsTrigger value="main">Main Platform</TabsTrigger>
                        <TabsTrigger value="shop">DataKazina Storefronts</TabsTrigger>
                    </TabsList>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-0 shadow-sm bg-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <DollarSign className="w-16 h-16" />
                        </div>
                        <CardContent className="p-6 relative">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Revenue (Gross)</p>
                            <p className="text-3xl font-bold">{formatCurrency(displayMetrics?.revenue || 0)}</p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm bg-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-rose-500">
                            <TrendingDown className="w-16 h-16" />
                        </div>
                        <CardContent className="p-6 relative">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Supplier Cost</p>
                            <p className="text-3xl font-bold">{formatCurrency(displayMetrics?.cost || 0)}</p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-900 to-indigo-800 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingUp className="w-16 h-16" />
                        </div>
                        <CardContent className="p-6 relative">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-indigo-200 uppercase tracking-wider">Real Profit (Earnings)</p>
                                {channel === 'all' && (
                                    <Badge className="bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/40 border-0">
                                        {data?.summary?.growth_percent > 0 ? '+' : ''}{data?.summary?.growth_percent}%
                                    </Badge>
                                )}
                            </div>
                            <p className="text-3xl font-bold">{formatCurrency(displayMetrics?.profit || 0)}</p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm bg-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <BarChart3 className="w-16 h-16" />
                        </div>
                        <CardContent className="p-6 relative">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Completed Orders</p>
                            <p className="text-3xl font-bold">{displayMetrics?.orders || 0}</p>
                        </CardContent>
                    </Card>
                </div>
            </Tabs>


            {/* --- SECOND ROW: CHARTS & COMPARISONS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LINE CHART */}
                <Card className="col-span-1 lg:col-span-2 shadow-sm border-0">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-2 uppercase tracking-wide">
                            <Activity className="w-4 h-4" /> 
                            {channel === 'all' ? 'Overall' : channel === 'main' ? 'Main' : 'Shop'} Performance Trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data?.charts_data?.daily || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 12, fill: '#888'}} 
                                        dy={10}
                                        tickFormatter={(val) => {
                                            const d = new Date(val);
                                            return `${d.getDate()}/${d.getMonth()+1}`;
                                        }}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 12, fill: '#888'}}
                                        dx={-10}
                                        tickFormatter={(val) => `GH₵${val}`}
                                    />
                                    <CartesianGrid vertical={false} stroke="#f0f0f0" />
                                    <Tooltip 
                                        formatter={(value: any) => [`GHS ${Number(value).toFixed(2)}`, '']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    
                                    {channel === 'all' && <Area type="monotone" name="Main Profit" dataKey="main_profit" stroke="#3b82f6" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />}
                                    {channel === 'all' && <Area type="monotone" name="Shop Platform Profit" dataKey="shop_platform_profit" stroke="#10b981" fillOpacity={0} strokeWidth={2} />}
                                    
                                    {channel === 'main' && <Area type="monotone" name="Profit" dataKey="main_profit" stroke="#3b82f6" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />}
                                    {channel === 'main' && <Line type="monotone" name="Revenue" dataKey="main_revenue" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />}
                                    
                                    {channel === 'shop' && <Area type="monotone" name="Platform Profit" dataKey="shop_platform_profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />}
                                    {channel === 'shop' && <Line type="monotone" name="Revenue" dataKey="shop_revenue" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />}
                                    <Legend iconType="circle" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* PIE CHART / INSIGHTS */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wide">Profit Origin Split</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[200px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Main Platform', value: data?.main_stats?.profit || 0 },
                                                { name: 'Storefronts', value: data?.shop_stats?.platform_profit || 0 }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {COLORS.map((color, index) => (
                                                <Cell key={`cell-${index}`} fill={color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: any) => `GHS ${Number(value).toFixed(2)}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                    <span className="text-xs text-muted-foreground uppercase font-medium">Margin</span>
                                    <span className="text-2xl font-bold">{data?.summary?.profit_margin || 0}%</span>
                                </div>
                            </div>
                            <div className="flex justify-center gap-6 mt-2 text-sm">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Main</div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Shop</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-0 bg-blue-50/50">
                        <CardContent className="p-5 space-y-4">
                            {insights?.map((insight, idx) => (
                                <div key={idx} className="flex gap-3">
                                    <div className={`mt-0.5 ${insight.color}`}>
                                        <insight.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{insight.title}</p>
                                        <p className="text-sm text-muted-foreground">{insight.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* --- THIRD ROW: WALLETS AND SHOP SUMMARY --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* WALLETS */}
                <Card className="shadow-sm border-0">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-muted-foreground uppercase flex items-center tracking-wide gap-2">
                            <Wallet className="w-4 h-4" /> System Liability (Wallets)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 rounded-xl border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-slate-100 p-2 rounded-lg"><Users className="w-5 h-5 text-slate-600" /></div>
                                <div>
                                    <p className="font-semibold">Main Platform Users</p>
                                    <p className="text-sm text-muted-foreground">{data?.wallet_stats?.user_count || 0} active wallets</p>
                                </div>
                            </div>
                            <p className="text-xl font-bold">{formatCurrency(data?.wallet_stats?.total_user_balance || 0)}</p>
                        </div>

                        <div className="p-4 rounded-xl border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-slate-100 p-2 rounded-lg"><Store className="w-5 h-5 text-slate-600" /></div>
                                <div>
                                    <p className="font-semibold">Shop Owners</p>
                                    <p className="text-sm text-muted-foreground">{data?.wallet_stats?.shop_owner_count || 0} active wallets</p>
                                </div>
                            </div>
                            <p className="text-xl font-bold">{formatCurrency(data?.wallet_stats?.total_shop_owner_balance || 0)}</p>
                        </div>
                        
                        <div className="text-xs text-muted-foreground text-center mt-2">
                            These balances represent customer money held by the system, entirely separate from pure profit.
                        </div>
                    </CardContent>
                </Card>

                {/* SHOP OWNER LEADERBOARD */}
                <Card className="shadow-sm border-0 flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-muted-foreground uppercase flex items-center tracking-wide gap-2">
                            <Store className="w-4 h-4" /> Top Storefront Earners
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto max-h-[300px]">
                        {data?.shop_owner_stats && data.shop_owner_stats.length > 0 ? (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-3 font-medium">Owner / Shop</th>
                                        <th className="pb-3 font-medium text-right">Your Cut</th>
                                        <th className="pb-3 font-medium text-right">Their Cut</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.shop_owner_stats.map((shop: any) => (
                                        <tr key={shop.owner_id} className="border-b last:border-0">
                                            <td className="py-3">
                                                <p className="font-semibold">{shop.owner_name}</p>
                                                <p className="text-xs text-muted-foreground">{shop.shop_name} • {shop.total_sales_count} sales</p>
                                            </td>
                                            <td className="py-3 text-right font-semibold text-blue-600">
                                                +{formatCurrency(shop.platform_profit)}
                                            </td>
                                            <td className="py-3 text-right font-medium text-slate-600">
                                                {formatCurrency(shop.owner_profit)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="h-full flex items-center justify-center flex-col text-muted-foreground py-10">
                                <Store className="w-10 h-10 mb-3 opacity-20" />
                                <p>No shop analytics available for this timeframe.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

        </div>
    )
}
