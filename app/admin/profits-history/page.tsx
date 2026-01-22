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
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function AdminProfitsPage() {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        profitMargin: 0,
        dailyRevenue: [] as any[]
    })

    useEffect(() => {
        calculateProfits()
    }, [])

    const calculateProfits = async () => {
        try {
            // Fetch all completed orders
            const { data: orders, error } = await supabase
                .from('orders')
                .select('created_at, price, cost_price, network')
                .eq('status', 'completed')
                .order('created_at', { ascending: true })

            if (error) throw error

            if (!orders || orders.length === 0) {
                setStats({
                    totalRevenue: 0,
                    totalCost: 0,
                    totalProfit: 0,
                    profitMargin: 0,
                    dailyRevenue: []
                })
                setLoading(false)
                return
            }

            let totalRevenue = 0
            let totalCost = 0

            // Daily aggregation
            const dailyMap = new Map<string, { revenue: number, profit: number }>();

            if (orders) {
                for (const order of (orders as any[])) {
                    const revenue = order.price || 0;
                    // Use recorded cost_price or estimate 80% if not set (legacy data)
                    const cost = order.cost_price || (revenue * 0.8);
                    const profit = revenue - cost;

                    totalRevenue += revenue;
                    totalCost += cost;

                    const day = (order.created_at as string).split('T')[0];
                    const current = dailyMap.get(day) || { revenue: 0, profit: 0 };
                    dailyMap.set(day, {
                        revenue: current.revenue + revenue,
                        profit: current.profit + profit
                    });
                }
            }

            const totalProfit = totalRevenue - totalCost
            const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

            // Convert map to sorted array
            const dailyRevenue = Array.from(dailyMap.entries())
                .map(([date, data]: any) => ({ date, ...data }))
                .sort((a, b) => (b as any).date.localeCompare((a as any).date)); // Recent first

            setStats({
                totalRevenue,
                totalCost,
                totalProfit,
                profitMargin,
                dailyRevenue
            })

        } catch (error) {
            console.error('Error calculating profits:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Profits & Revenue</h1>
                    <p className="text-muted-foreground">Financial performance overview</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                                <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                                <p className="text-2xl font-bold mt-1 text-red-500">-{formatCurrency(stats.totalCost)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <TrendingDown className="w-5 h-5 text-red-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                                <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(stats.totalProfit)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Profit Margin</p>
                                <p className="text-2xl font-bold mt-1">{stats.profitMargin.toFixed(1)}%</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daily Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Revenue</TableHead>
                                <TableHead>Profit</TableHead>
                                <TableHead>Margin</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.dailyRevenue.map((day) => {
                                const margin = day.revenue > 0 ? (day.profit / day.revenue) * 100 : 0
                                return (
                                    <TableRow key={day.date}>
                                        <TableCell className="font-medium">{day.date}</TableCell>
                                        <TableCell>{formatCurrency(day.revenue)}</TableCell>
                                        <TableCell className="text-green-600">{formatCurrency(day.profit)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{margin.toFixed(1)}%</Badge>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
