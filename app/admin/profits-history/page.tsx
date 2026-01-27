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
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    Calendar,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type TimeRange = 'today' | 'week' | 'all'

export default function AdminProfitsPage() {
    const [loading, setLoading] = useState(true)
    const [range, setRange] = useState<TimeRange>('today')
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
    }, [range])

    const calculateProfits = async () => {
        setLoading(true)
        try {
            const now = new Date()
            let startDate = new Date(0) // Default all time
            let comparisonStartDate = new Date(0)

            // Define date ranges
            if (range === 'today') {
                startDate = new Date(now.setHours(0, 0, 0, 0))
                // Compare with yesterday
                comparisonStartDate = new Date(now)
                comparisonStartDate.setDate(comparisonStartDate.getDate() - 1)
            } else if (range === 'week') {
                const day = now.getDay() || 7 // Get current day number, converting Sun (0) to 7
                if (day !== 1) now.setHours(-24 * (day - 1)); // Set to Monday past
                else now.setHours(0, 0, 0, 0) // Today is Monday
                startDate = new Date(now)

                // Compare with previous week
                comparisonStartDate = new Date(startDate)
                comparisonStartDate.setDate(comparisonStartDate.getDate() - 7)
            }

            // Fetch current period orders
            const { data: orders, error } = await supabase
                .from('orders')
                .select('created_at, price, cost_price, network')
                .eq('status', 'completed')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true })

            if (error) throw error

            // Fetch previous period orders for comparison (if not all time)
            let previousOrders: any[] = []
            if (range !== 'all') {
                const { data: prevData } = await supabase
                    .from('orders')
                    .select('price, cost_price')
                    .eq('status', 'completed')
                    .gte('created_at', comparisonStartDate.toISOString())
                    .lt('created_at', startDate.toISOString())
                previousOrders = prevData || []
            }

            // Metrics Calculation helper
            const calculateMetrics = (orderList: any[]) => {
                let rev = 0
                let cst = 0
                orderList.forEach(order => {
                    const price = order.price || 0
                    // Fallback to 80% cost if missing, to avoid inflated profits
                    const cost = order.cost_price ?? (price * 0.8)
                    rev += price
                    cst += cost
                })
                return { revenue: rev, cost: cst, profit: rev - cst }
            }

            const current = calculateMetrics(orders || [])
            const previous = calculateMetrics(previousOrders)

            // Growth %
            const calculateGrowth = (curr: number, prev: number) => {
                if (prev === 0) return curr > 0 ? 100 : 0
                return ((curr - prev) / prev) * 100
            }

            // Daily/Group aggregation for chart/table
            const dailyMap = new Map<string, { revenue: number, profit: number }>()
            if (orders) {
                orders.forEach((order: any) => {
                    const date = new Date(order.created_at).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric',
                        ...(range === 'today' && { hour: 'numeric', minute: '2-digit' })
                    })

                    const price = order.price || 0
                    const cost = order.cost_price ?? (price * 0.8)
                    const profit = price - cost

                    const existing = dailyMap.get(date) || { revenue: 0, profit: 0 }
                    dailyMap.set(date, {
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
                                {Math.abs(growth).toFixed(1)}% vs last {range === 'today' ? 'day' : 'week'}
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
                <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)} className="w-full md:w-auto">
                    <TabsList className="grid w-full grid-cols-3 md:w-[300px]">
                        <TabsTrigger value="today">Today</TabsTrigger>
                        <TabsTrigger value="week">This Week</TabsTrigger>
                        <TabsTrigger value="all">All Time</TabsTrigger>
                    </TabsList>
                </Tabs>
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

            {/* Detailed Table */}
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
