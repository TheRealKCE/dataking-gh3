'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Wallet,
    BarChart3,
    Users
} from 'lucide-react'

type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

interface OrderData {
    created_at: string
    price: number
    cost_price: number
    network: string
    size: string
    status: string
}

interface PackageData {
    network: string
    size: string
    price: number
    cost_price: number
}

export default function AdminProfitsPage() {
    const [loading, setLoading] = useState(true)
    const [range, setRange] = useState<TimeRange>('today')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [userWalletTotal, setUserWalletTotal] = useState(0)
    const [userCount, setUserCount] = useState(0)
    const [stats, setStats] = useState({
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0,
        previousProfit: 0,
        profitGrowth: 0,
        totalOrders: 0,
        dailyData: [] as { date: string; revenue: number; profit: number; orders: number; cost: number }[]
    })

    useEffect(() => {
        fetchProfitData()
    }, [range, customStart, customEnd])

    const fetchProfitData = async () => {
        setLoading(true)
        try {
            // Calculate date ranges
            const now = new Date()
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

            let startDate: Date
            let endDate: Date
            let previousStartDate: Date
            let previousEndDate: Date

            if (range === 'today') {
                startDate = todayStart
                endDate = todayEnd
                previousStartDate = new Date(todayStart)
                previousStartDate.setDate(previousStartDate.getDate() - 1)
                previousEndDate = new Date(todayEnd)
                previousEndDate.setDate(previousEndDate.getDate() - 1)
            } else if (range === 'yesterday') {
                startDate = new Date(todayStart)
                startDate.setDate(startDate.getDate() - 1)
                endDate = new Date(todayEnd)
                endDate.setDate(endDate.getDate() - 1)
                previousStartDate = new Date(startDate)
                previousStartDate.setDate(previousStartDate.getDate() - 1)
                previousEndDate = new Date(endDate)
                previousEndDate.setDate(previousEndDate.getDate() - 1)
            } else if (range === 'week') {
                const dayOfWeek = now.getDay() || 7
                startDate = new Date(todayStart)
                startDate.setDate(startDate.getDate() - dayOfWeek + 1)
                endDate = new Date()
                previousStartDate = new Date(startDate)
                previousStartDate.setDate(previousStartDate.getDate() - 7)
                previousEndDate = new Date(startDate)
                previousEndDate.setTime(previousEndDate.getTime() - 1)
            } else if (range === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
                endDate = new Date()
                previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
                previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
            } else if (range === 'all') {
                startDate = new Date(2020, 0, 1, 0, 0, 0, 0)
                endDate = new Date()
                previousStartDate = new Date(2020, 0, 1)
                previousEndDate = new Date(2020, 0, 1)
            } else if (range === 'custom') {
                if (!customStart || !customEnd) {
                    setLoading(false)
                    return
                }
                startDate = new Date(customStart + 'T00:00:00')
                endDate = new Date(customEnd + 'T23:59:59.999')
                const duration = endDate.getTime() - startDate.getTime()
                previousEndDate = new Date(startDate.getTime() - 1)
                previousStartDate = new Date(previousEndDate.getTime() - duration)
            } else {
                startDate = todayStart
                endDate = todayEnd
                previousStartDate = new Date(todayStart)
                previousEndDate = new Date(todayEnd)
            }

            // Fetch from API (bypasses RLS)
            const response = await fetch(`/api/admin/profit-stats?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
            if (!response.ok) {
                throw new Error('Failed to fetch profit data')
            }
            const data = await response.json()

            // Set wallet data
            setUserWalletTotal(data.userWalletTotal || 0)
            setUserCount(data.userCount || 0)

            const orders: OrderData[] = data.orders || []
            const packages: PackageData[] = data.packages || []

            // Build package map for cost lookup
            const packageMap = new Map<string, { cost: number; price: number }>()
            packages.forEach((pkg) => {
                const key = `${pkg.network}-${pkg.size}`
                packageMap.set(key, {
                    cost: Number(pkg.cost_price) || 0,
                    price: Number(pkg.price) || 0
                })
            })

            // Calculate metrics - PRIORITIZE order's own cost_price
            const calculateMetrics = (orderList: OrderData[]) => {
                let rev = 0, cst = 0
                orderList.forEach(order => {
                    const price = Number(order.price) || 0
                    let cost = Number(order.cost_price) || 0

                    if (cost === 0) {
                        const key = `${order.network}-${order.size}`
                        const pkg = packageMap.get(key)
                        cost = pkg?.cost || 0
                    }

                    if (cost === 0 && price > 0) {
                        cost = price * 0.8
                    }

                    rev += price
                    cst += cost
                })
                return { revenue: rev, cost: cst, profit: rev - cst }
            }

            // Filter orders for current period
            const currentOrders = orders.filter(o => {
                const d = new Date(o.created_at)
                return d >= startDate && d <= endDate
            })

            // Fetch previous period data for comparison
            let previousOrders: OrderData[] = []
            if (range !== 'all') {
                const prevResponse = await fetch(`/api/admin/profit-stats?startDate=${previousStartDate.toISOString()}&endDate=${previousEndDate.toISOString()}`)
                if (prevResponse.ok) {
                    const prevData = await prevResponse.json()
                    previousOrders = prevData.orders || []
                }
            }

            const current = calculateMetrics(currentOrders)
            const previous = calculateMetrics(previousOrders)

            const profitGrowth = range === 'all' ? 0 : (
                previous.profit === 0
                    ? (current.profit > 0 ? 100 : 0)
                    : ((current.profit - previous.profit) / previous.profit) * 100
            )

            // Group by day/time
            const dailyMap = new Map<string, { revenue: number; profit: number; orders: number; cost: number }>()
            currentOrders.forEach((order) => {
                const d = new Date(order.created_at)
                const dateStr = range === 'today' || range === 'yesterday'
                    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })

                const price = Number(order.price) || 0
                let cost = Number(order.cost_price) || 0
                if (cost === 0) {
                    const key = `${order.network}-${order.size}`
                    const pkg = packageMap.get(key)
                    cost = pkg?.cost || 0
                }
                if (cost === 0 && price > 0) cost = price * 0.8

                const existing = dailyMap.get(dateStr) || { revenue: 0, profit: 0, orders: 0, cost: 0 }
                dailyMap.set(dateStr, {
                    revenue: existing.revenue + price,
                    cost: existing.cost + cost,
                    profit: existing.profit + (price - cost),
                    orders: existing.orders + 1
                })
            })

            setStats({
                revenue: current.revenue,
                cost: current.cost,
                profit: current.profit,
                margin: current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0,
                previousProfit: previous.profit,
                profitGrowth,
                totalOrders: currentOrders.length,
                dailyData: Array.from(dailyMap.entries())
                    .map(([date, vals]) => ({ date, ...vals }))
                    .reverse()
            })
        } catch (error) {
            console.error('Error fetching profit data:', error)
        } finally {
            setLoading(false)
        }
    }

    const rangeLabels: Record<TimeRange, string> = {
        today: 'Today',
        yesterday: 'Yesterday',
        week: 'This Week',
        month: 'This Month',
        all: 'All Time',
        custom: 'Custom'
    }

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                </div>
                <Skeleton className="h-32 rounded-xl" />
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-lg" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold">Profit Dashboard</h1>
                <p className="text-sm text-muted-foreground">All orders from all users (excl. failed)</p>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {(['today', 'yesterday', 'week', 'month', 'all', 'custom'] as TimeRange[]).map((r) => (
                    <Button
                        key={r}
                        size="sm"
                        variant={range === r ? 'default' : 'outline'}
                        onClick={() => setRange(r)}
                        className="flex-shrink-0"
                    >
                        {rangeLabels[r]}
                    </Button>
                ))}
            </div>

            {/* Custom Date Range */}
            {range === 'custom' && (
                <div className="flex gap-2 items-center p-3 bg-muted/50 rounded-lg">
                    <Input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="flex-1"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="flex-1"
                    />
                </div>
            )}

            {/* User Wallet Balance Card */}
            <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white overflow-hidden">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-amber-100 text-sm font-medium">User Wallet Balances</p>
                            <p className="text-3xl font-bold mt-1">{formatCurrency(userWalletTotal)}</p>
                            <p className="text-amber-100 text-xs mt-1">{userCount} users (excl. admins)</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Main Profit Card */}
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white overflow-hidden">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-green-100 text-sm font-medium">Net Profit ({rangeLabels[range]})</p>
                            <p className="text-3xl font-bold mt-1">{formatCurrency(stats.profit)}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-green-100 text-xs">{stats.totalOrders} orders</span>
                                {range !== 'all' && stats.profitGrowth !== 0 && (
                                    <div className={`flex items-center text-xs ${stats.profitGrowth >= 0 ? 'text-green-100' : 'text-red-200'}`}>
                                        {stats.profitGrowth >= 0 ? (
                                            <ArrowUpRight className="w-3 h-3 mr-1" />
                                        ) : (
                                            <ArrowDownRight className="w-3 h-3 mr-1" />
                                        )}
                                        {Math.abs(stats.profitGrowth).toFixed(1)}%
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid - 2 columns */}
            <div className="grid grid-cols-2 gap-3">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                <DollarSign className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Sales</p>
                                <p className="font-bold text-lg">{formatCurrency(stats.revenue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <TrendingDown className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Cost</p>
                                <p className="font-bold text-lg text-red-600">-{formatCurrency(stats.cost)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Profit Margin */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <BarChart3 className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Profit Margin</p>
                                <p className="font-bold text-lg">{stats.margin.toFixed(1)}%</p>
                            </div>
                        </div>
                        <Badge variant={stats.margin > 15 ? 'default' : 'secondary'} className={stats.margin > 15 ? 'bg-green-500' : ''}>
                            {stats.margin > 15 ? 'Good' : 'Low'}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Daily Breakdown */}
            <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Breakdown ({stats.dailyData.length} periods)
                </h2>

                {stats.dailyData.length === 0 ? (
                    <Card className="p-6 text-center">
                        <TrendingUp className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No orders for this period</p>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {stats.dailyData.map((day, index) => {
                            const margin = day.revenue > 0 ? (day.profit / day.revenue) * 100 : 0
                            return (
                                <Card key={index} className="hover:shadow-sm transition-shadow">
                                    <CardContent className="p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                                                    {day.orders}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{day.date}</p>
                                                    <div className="text-xs text-muted-foreground">
                                                        Sales: {formatCurrency(day.revenue)} | Cost: {formatCurrency(day.cost)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-600">{formatCurrency(day.profit)}</p>
                                                <p className="text-xs text-muted-foreground">{margin.toFixed(0)}%</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
