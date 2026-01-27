'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    CircleDollarSign,
    TrendingUp,
    TrendingDown,
    Activity,
    Calendar,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'



export default function AdminProfitsPage() {
    const [loading, setLoading] = useState(true)
    const [range, setRange] = useState<string>('today')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [stats, setStats] = useState({
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0,
        previousRevenue: 0,
        previousProfit: 0,
        revenueGrowth: 0,
        profitGrowth: 0,
        dailyData: [] as any[]
    })

    useEffect(() => {
        calculateProfits()
    }, [range, customStart, customEnd])

    const calculateProfits = async () => {
        setLoading(true)
        try {
            const now = new Date()
            let startDate = new Date()
            let endDate = new Date()
            let previousStartDate = new Date()
            let previousEndDate = new Date()

            // Define date ranges
            if (range === 'today') {
                startDate = new Date(now.setHours(0, 0, 0, 0))
                endDate = new Date(now.setHours(23, 59, 59, 999))

                // Compare with yesterday
                previousStartDate = new Date(startDate)
                previousStartDate.setDate(startDate.getDate() - 1)
                previousEndDate = new Date(endDate)
                previousEndDate.setDate(endDate.getDate() - 1)
            } else if (range === 'yesterday') {
                const yest = new Date()
                yest.setDate(yest.getDate() - 1)
                startDate = new Date(yest.setHours(0, 0, 0, 0))
                endDate = new Date(yest.setHours(23, 59, 59, 999))

                // Compare with day before yesterday
                previousStartDate = new Date(startDate)
                previousStartDate.setDate(startDate.getDate() - 1)
                previousEndDate = new Date(endDate)
                previousEndDate.setDate(endDate.getDate() - 1)
            } else if (range === 'week') {
                const day = now.getDay() || 7
                if (day !== 1) now.setHours(-24 * (day - 1))
                else now.setHours(0, 0, 0, 0)

                startDate = new Date(now)
                endDate = new Date() // Up to now

                // Compare with previous week
                previousStartDate = new Date(startDate)
                previousStartDate.setDate(startDate.getDate() - 7)
                previousEndDate = new Date(endDate)
                previousEndDate.setDate(endDate.getDate() - 7)
            } else if (range === 'custom') {
                if (!customStart || !customEnd) {
                    setLoading(false)
                    return
                }
                startDate = new Date(customStart)
                startDate.setHours(0, 0, 0, 0)
                endDate = new Date(customEnd)
                endDate.setHours(23, 59, 59, 999)

                // Calculate duration
                const duration = endDate.getTime() - startDate.getTime()
                previousEndDate = new Date(startDate.getTime() - 1) // Just before start
                previousStartDate = new Date(previousEndDate.getTime() - duration)
            } else {
                // All time
                startDate = new Date(0)
                endDate = new Date()
                // No comparison for all time effectively
                previousStartDate = new Date(0)
                previousEndDate = new Date(0)
            }

            // Fetch current period orders
            const { data: orders, error } = await supabase
                .from('orders')
                .select('created_at, price, cost_price, network, size')
                .eq('status', 'completed')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: true })

            if (error) throw error

            // Fetch previous period orders for comparison
            let previousOrders: any[] = []
            if (range !== 'all' && !(range === 'custom' && (!customStart || !customEnd))) {
                const { data: prevData } = await supabase
                    .from('orders')
                    .select('price, cost_price, network, size')
                    .eq('status', 'completed')
                    .gte('created_at', previousStartDate.toISOString())
                    .lte('created_at', previousEndDate.toISOString())
                previousOrders = prevData || []
            }

            // Fetch packages for cost lookup
            const { data: packages } = await supabase
                .from('data_packages')
                .select('network, size, price, cost_price') as any

            const packageMap = new Map<string, { cost: number, price: number }>()
            if (packages) {
                packages.forEach(pkg => {
                    const key = `${pkg.network}-${pkg.size}`
                    packageMap.set(key, {
                        cost: Number(pkg.cost_price) || 0,
                        price: Number(pkg.price) || 0
                    })
                })
            }

            // Metrics Calculation
            const calculateMetrics = (orderList: any[]) => {
                let rev = 0
                let cst = 0
                orderList.forEach(order => {
                    // Try to match with current package settings
                    const key = `${order.network}-${order.size}`
                    const pkg = packageMap.get(key)

                    // Revenue: Use order price (actual sale), fallback to package selling price
                    const price = Number(order.price) || (pkg ? pkg.price : 0)

                    // Cost: Use package cost price (as requested), fallback to order cost, then 80% estimate
                    let cost = pkg?.cost || Number(order.cost_price) || 0

                    // If no valid cost found, use 80% rule
                    if (cost === 0 && price > 0) {
                        cost = price * 0.8
                    }

                    rev += price
                    cst += cost
                })
                return { revenue: rev, cost: cst, profit: rev - cst }
            }

            const current = calculateMetrics(orders || [])
            const previous = calculateMetrics(previousOrders)

            const calculateGrowth = (curr: number, prev: number) => {
                if (prev === 0) return curr > 0 ? 100 : 0
                return ((curr - prev) / prev) * 100
            }

            // Daily Map
            const dailyMap = new Map<string, { revenue: number, profit: number }>()
            if (orders) {
                orders.forEach((order: any) => {
                    const d = new Date(order.created_at)
                    const dateStr = d.toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric',
                        ...(range === 'today' || range === 'yesterday' ? { hour: 'numeric', minute: '2-digit' } : {})
                    })

                    const key = `${order.network}-${order.size}`
                    const pkg = packageMap.get(key)

                    const price = Number(order.price) || (pkg ? pkg.price : 0)
                    let cost = pkg?.cost || Number(order.cost_price) || 0

                    if (cost === 0 && price > 0) {
                        cost = price * 0.8
                    }

                    const profit = price - cost

                    const existing = dailyMap.get(dateStr) || { revenue: 0, profit: 0 }
                    dailyMap.set(dateStr, {
                        revenue: existing.revenue + price,
                        profit: existing.profit + profit
                    })
                })
            }

            setStats({
                revenue: current.revenue,
                cost: current.cost,
                profit: current.profit,
                margin: current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0,
                previousRevenue: previous.revenue,
                previousProfit: previous.profit,
                revenueGrowth: range === 'all' ? 0 : calculateGrowth(current.revenue, previous.revenue),
                profitGrowth: range === 'all' ? 0 : calculateGrowth(current.profit, previous.profit),
                dailyData: Array.from(dailyMap.entries()).map(([date, vals]) => ({ date, ...vals })).reverse()
            })

        } catch (error) {
            console.error('Error calculating profits:', error)
        } finally {
            setLoading(false)
        }
    }

    const StatCard = ({ title, value, icon: Icon, colorClass, growth = null, prefix = '' }: any) => (
        <Card className="hover:shadow-lg transition-shadow duration-300 overflow-hidden relative">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className={`text-2xl font-bold ${colorClass}`}>
                                {prefix}{value}
                            </h2>
                        </div>
                        {growth !== null && range !== 'all' && (
                            <div className={`flex items-center text-xs font-medium ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {growth >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                                {Math.abs(growth).toFixed(1)}% vs previous
                            </div>
                        )}
                    </div>
                    <div className={`p-3 rounded-xl ${colorClass.replace('text-', 'bg-').replace('600', '100')} ${colorClass.replace('text-', 'text-')}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )

    return (
        <div className="space-y-8 pb-20">
            {/* Header with Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        Financial Overview
                    </h1>
                    <p className="text-muted-foreground mt-1">Track your revenue, costs, and effective profit.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                    {range === 'custom' && (
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-1 rounded-lg border">
                            <Input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="h-8 w-32 border-0 focus-visible:ring-0"
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="h-8 w-32 border-0 focus-visible:ring-0"
                            />
                        </div>
                    )}
                    <Tabs value={range} onValueChange={setRange} className="w-full md:w-auto">
                        <TabsList className="grid w-full grid-cols-4 md:w-auto">
                            <TabsTrigger value="today">Today</TabsTrigger>
                            <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
                            <TabsTrigger value="week">Week</TabsTrigger>
                            <TabsTrigger value="all">All</TabsTrigger>
                        </TabsList>
                        <TabsList className="mt-1 w-full md:hidden">
                            <TabsTrigger value="custom" className="w-full">Custom Range</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button
                        variant={range === 'custom' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setRange('custom')}
                        className="hidden md:flex ml-2"
                    >
                        Custom Range
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Revenue"
                    value={formatCurrency(stats.revenue)}
                    icon={DollarSign}
                    colorClass="text-blue-600"
                    growth={stats.revenueGrowth}
                />
                <StatCard
                    title="Total Cost"
                    value={formatCurrency(stats.cost)}
                    icon={TrendingDown}
                    colorClass="text-red-600"
                    prefix="-"
                />
                <StatCard
                    title="Net Profit"
                    value={formatCurrency(stats.profit)}
                    icon={TrendingUp}
                    colorClass="text-green-600"
                    growth={stats.profitGrowth}
                />
                <StatCard
                    title="Profit Margin"
                    value={stats.margin.toFixed(1) + "%"}
                    icon={Activity}
                    colorClass="text-purple-600"
                />
            </div>
            {/* Table remains same... */}
            <Card className="border-border/50 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                        Performance Breakdown
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="h-[400px] overflow-auto">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0">
                                <TableRow>
                                    <TableHead>Time Period</TableHead>
                                    <TableHead>Revenue</TableHead>
                                    <TableHead>Cost (Est.)</TableHead>
                                    <TableHead>Real Profit</TableHead>
                                    <TableHead>Margin</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Calculating financials...
                                        </TableCell>
                                    </TableRow>
                                ) : stats.dailyData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No data found for this period.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    stats.dailyData.map((day) => (
                                        <TableRow key={day.date} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="font-medium">{day.date}</TableCell>
                                            <TableCell>{formatCurrency(day.revenue)}</TableCell>
                                            <TableCell className="text-red-500 text-xs">-{formatCurrency(day.revenue - day.profit)}</TableCell>
                                            <TableCell className="text-green-600 font-bold">{formatCurrency(day.profit)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`
                                                    ${(day.profit / day.revenue) * 100 > 15 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}
                                                `}>
                                                    {((day.profit / day.revenue) * 100).toFixed(1)}%
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
