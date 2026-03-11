'use client'

import { useState, useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface ShopOrderDataPoint {
    created_at: string
    selling_price: number
    profit: number
}

interface ShopGrowthGraphProps {
    data: ShopOrderDataPoint[]
}

type RangeKey = '7d' | '30d'

function getDayLabel(date: Date, short = false): string {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: short ? 'short' : 'long' })
}

function buildDailyData(data: ShopOrderDataPoint[], days: number) {
    const now = new Date()
    const buckets: { label: string; orders: number; revenue: number; profit: number }[] = []

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)
        buckets.push({
            label: getDayLabel(d, true),
            orders: 0,
            revenue: 0,
            profit: 0,
        })
    }

    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - days)
    cutoff.setHours(0, 0, 0, 0)

    for (const item of data) {
        const d = new Date(item.created_at)
        if (d < cutoff) continue
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
        const idx = days - 1 - diffDays
        if (idx >= 0 && idx < buckets.length) {
            buckets[idx].orders++
            buckets[idx].revenue += item.selling_price || 0
            buckets[idx].profit += item.profit || 0
        }
    }

    return buckets
}

export function ShopGrowthGraph({ data }: ShopGrowthGraphProps) {
    const [range, setRange] = useState<RangeKey>('7d')

    const days = range === '7d' ? 7 : 30
    const buckets = useMemo(() => buildDailyData(data, days), [data, days])

    const maxOrders = Math.max(...buckets.map(b => b.orders), 1)
    const totalOrders = buckets.reduce((s, b) => s + b.orders, 0)
    const totalRevenue = buckets.reduce((s, b) => s + b.revenue, 0)
    const totalProfit = buckets.reduce((s, b) => s + b.profit, 0)

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
                            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <CardTitle className="text-base font-bold">Shop Orders Growth</CardTitle>
                    </div>
                    {/* Toggle */}
                    <div className="flex bg-muted rounded-lg p-0.5">
                        {(['7d', '30d'] as RangeKey[]).map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={cn(
                                    'px-3 py-1 text-xs font-medium rounded-md transition-all',
                                    range === r
                                        ? 'bg-white dark:bg-gray-800 shadow-sm text-emerald-600 dark:text-emerald-400'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {r === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Summary row */}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span>
                        <span className="font-semibold text-foreground">{totalOrders}</span> orders
                    </span>
                    <span>
                        <span className="font-semibold text-foreground">{formatCurrency(totalRevenue)}</span> revenue
                    </span>
                    <span>
                        <span className="font-semibold text-emerald-600">{formatCurrency(totalProfit)}</span> profit
                    </span>
                </div>
            </CardHeader>
            <CardContent className="pb-4">
                {totalOrders === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                        <TrendingUp className="w-8 h-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No orders in this period</p>
                        <p className="text-xs text-muted-foreground">Share your shop link to get your first sale!</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {/* Bar Chart */}
                        <div
                            className="flex items-end gap-1 h-24"
                            aria-label="Shop orders bar chart"
                        >
                            {buckets.map((bucket, i) => {
                                const heightPct = maxOrders > 0 ? (bucket.orders / maxOrders) * 100 : 0
                                return (
                                    <div
                                        key={i}
                                        className="flex-1 flex flex-col items-center justify-end group relative"
                                        title={`${bucket.label}: ${bucket.orders} orders`}
                                    >
                                        <div
                                            className={cn(
                                                'w-full rounded-t-sm transition-all duration-300',
                                                bucket.orders > 0
                                                    ? 'bg-emerald-500 dark:bg-emerald-600 group-hover:bg-emerald-600 dark:group-hover:bg-emerald-500'
                                                    : 'bg-muted'
                                            )}
                                            style={{ height: `${Math.max(heightPct, bucket.orders > 0 ? 8 : 4)}%` }}
                                        />
                                        {/* Tooltip on hover */}
                                        <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                                            <div className="bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded whitespace-nowrap shadow-lg">
                                                {bucket.label}: {bucket.orders}
                                            </div>
                                            <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 -mt-0.5" />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {/* X-axis labels — only show a few to avoid crowding on 30d */}
                        <div className="flex items-center gap-1">
                            {buckets.map((bucket, i) => {
                                const showLabel = days === 7
                                    ? true
                                    : i === 0 || i === Math.floor(days / 2) || i === days - 1
                                return (
                                    <div key={i} className="flex-1 text-center">
                                        {showLabel && (
                                            <span className="text-[9px] text-muted-foreground leading-none">
                                                {bucket.label}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
