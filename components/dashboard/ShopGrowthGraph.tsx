'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
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
    const buckets: { label: string; orders: number; revenue: number; profit: number; fullDate: string }[] = []

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)
        buckets.push({
            label: getDayLabel(d, true),
            fullDate: d.toISOString(),
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
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

    const days = range === '7d' ? 7 : 30
    const buckets = useMemo(() => buildDailyData(data, days), [data, days])

    const maxOrders = Math.max(...buckets.map(b => b.orders), 1)
    const totalOrders = buckets.reduce((s, b) => s + b.orders, 0)
    const totalRevenue = buckets.reduce((s, b) => s + b.revenue, 0)
    const totalProfit = buckets.reduce((s, b) => s + b.profit, 0)

    // Calculate trend: Compare first half vs second half to determine color
    const trend = useMemo(() => {
        if (buckets.length === 0) return 'up'
        const mid = Math.floor(buckets.length / 2)
        const firstHalf = buckets.slice(0, mid).reduce((sum, b) => sum + b.orders, 0)
        const secondHalf = buckets.slice(mid).reduce((sum, b) => sum + b.orders, 0)
        return secondHalf >= firstHalf ? 'up' : 'down'
    }, [buckets])

    const isUp = trend === 'up'
    const colorClass = isUp ? 'text-emerald-500' : 'text-rose-500'
    const bgClass = isUp ? 'bg-emerald-500' : 'bg-rose-500'
    const fromColor = isUp ? '#10b981' : '#f43f5e' // emerald-500 / rose-500
    const toColor = isUp ? 'rgba(16, 185, 129, 0)' : 'rgba(244, 63, 94, 0)'
    const TrendIcon = isUp ? TrendingUp : TrendingDown

    // SVG Layout parameters
    const width = 1000
    const height = 240
    const padding = 20
    const graphWidth = width - padding * 2
    const graphHeight = height - padding * 2

    // Generate path points
    const points = buckets.map((bucket, i) => {
        const x = padding + (i / Math.max(buckets.length - 1, 1)) * graphWidth
        // If maxOrders is 0 (no data), perfectly flat line at bottom
        const y = totalOrders === 0 
            ? height - padding 
            : height - padding - (bucket.orders / maxOrders) * graphHeight
        return { x, y, bucket }
    })

    const pathD = points.length > 0
        ? `M ${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')
        : ''

    const areaD = points.length > 0
        ? `${pathD} L ${points[points.length - 1].x},${height - padding} L ${points[0].x},${height - padding} Z`
        : ''

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-md", isUp ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-rose-100 dark:bg-rose-900/30")}>
                            <TrendIcon className={cn("w-4 h-4", colorClass)} />
                        </div>
                        <CardTitle className="text-base font-bold">Shop Performance Trend</CardTitle>
                    </div>
                    {/* Toggle */}
                    <div className="flex bg-muted rounded-lg p-0.5 relative z-20">
                        {(['7d', '30d'] as RangeKey[]).map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={cn(
                                    'px-3 py-1 text-xs font-medium rounded-md transition-all',
                                    range === r
                                        ? `bg-white dark:bg-gray-800 shadow-sm ${colorClass}`
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {r === '7d' ? '7D' : '30D'}
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
                        <span className={cn("font-semibold", colorClass)}>{formatCurrency(totalProfit)}</span> profit
                    </span>
                </div>
            </CardHeader>
            <CardContent className="p-0 pb-4 relative">
                {totalOrders === 0 ? (
                     <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                         <TrendIcon className="w-8 h-8 text-muted-foreground/40" />
                         <p className="text-sm text-muted-foreground">No orders in this period</p>
                         <p className="text-xs text-muted-foreground">Share your shop link to get your first sale!</p>
                     </div>
                ) : (
                    <div className="relative w-full h-[240px] mt-4" onMouseLeave={() => setHoveredIdx(null)}>
                        <svg 
                            viewBox={`0 0 ${width} ${height}`} 
                            className="w-full h-full overflow-visible"
                            preserveAspectRatio="none"
                        >
                            <defs>
                                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={fromColor} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={toColor} stopOpacity={0.0} />
                                </linearGradient>
                            </defs>

                            {/* Area fill */}
                            <path 
                                d={areaD} 
                                fill="url(#areaGradient)" 
                                className="transition-all duration-500 ease-in-out"
                            />

                            {/* Main line */}
                            <path 
                                d={pathD} 
                                fill="none" 
                                stroke={fromColor} 
                                strokeWidth="3" 
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="transition-all duration-500 ease-in-out"
                            />

                            {/* Data points & Interaction Areas */}
                            {points.map((p, i) => (
                                <g key={i}>
                                    {/* Invisible thick rect for easier hovering */}
                                    <rect
                                        x={p.x - (graphWidth / buckets.length) / 2}
                                        y={0}
                                        width={graphWidth / buckets.length}
                                        height={height}
                                        fill="transparent"
                                        onMouseEnter={() => setHoveredIdx(i)}
                                        className="cursor-crosshair"
                                    />
                                    {/* Visible point when hovered */}
                                    {hoveredIdx === i && (
                                        <>
                                            {/* Vertical line indicator */}
                                            <line 
                                                x1={p.x} 
                                                y1={padding} 
                                                x2={p.x} 
                                                y2={height - padding} 
                                                stroke={fromColor} 
                                                strokeWidth="1" 
                                                strokeDasharray="4 4" 
                                                opacity="0.5" 
                                            />
                                            {/* Data point circle */}
                                            <circle 
                                                cx={p.x} 
                                                y={p.y} 
                                                r="5" 
                                                fill="white" 
                                                stroke={fromColor} 
                                                strokeWidth="2" 
                                                className="shadow-sm"
                                            />
                                            <circle 
                                                cx={p.x} 
                                                y={p.y} 
                                                r="12" 
                                                fill={fromColor} 
                                                opacity="0.2" 
                                                className="animate-pulse"
                                            />
                                        </>
                                    )}
                                </g>
                            ))}
                        </svg>

                        {/* Tooltip HTML Overlay */}
                        {hoveredIdx !== null && (
                            <div 
                                className="absolute pointer-events-none z-30 transition-all duration-100 ease-out"
                                style={{ 
                                    left: `calc(${(points[hoveredIdx].x / width) * 100}% - 4px)`, 
                                    top: `${(points[hoveredIdx].y / height) * 100}%`,
                                    transform: 'translate(-50%, -120%)'
                                } as React.CSSProperties}
                            >
                                <div className="bg-gray-900/95 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-2xl border border-gray-800/60 ring-1 ring-white/10 min-w-[120px]">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                            {points[hoveredIdx].bucket.label}
                                        </span>
                                        <div className="flex items-center justify-between gap-3 text-xs">
                                            <span className="text-gray-300">Orders:</span>
                                            <span className="font-bold">{points[hoveredIdx].bucket.orders}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-xs">
                                            <span className="text-gray-300">Revenue:</span>
                                            <span className="font-bold">{formatCurrency(points[hoveredIdx].bucket.revenue)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-xs mt-0.5 pt-1 border-t border-gray-800">
                                            <span className="text-gray-300">Profit:</span>
                                            <span className={cn("font-bold", colorClass)}>
                                                {formatCurrency(points[hoveredIdx].bucket.profit)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {/* Tooltip Caret */}
                                <div className="w-3 h-3 bg-gray-900/95 border-r border-b border-gray-800/60 rotate-45 mx-auto -mt-1.5" />
                            </div>
                        )}

                        {/* X-Axis Labels Overlay */}
                        <div className="absolute bottom-2 left-0 right-0 flex items-center justify-between px-5 pointer-events-none">
                             {buckets.map((bucket, i) => {
                                 const showLabel = days === 7
                                     ? true
                                     : i === 0 || i === Math.floor(days / 2) || i === days - 1
                                 return (
                                     <div key={i} className="flex-none text-center" style={{ width: `${100 / (days === 7 ? days : 3)}%` } as React.CSSProperties}>
                                         {showLabel && (
                                             <span className="text-[10px] font-medium text-muted-foreground">
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
