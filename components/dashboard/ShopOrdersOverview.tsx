import Link from 'next/link'
import { ShoppingCart, CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface ShopOrderStats {
    total: number
    completed: number
    pending: number
    processing: number
    failed: number
    revenue: number
    profit: number
}

interface ShopOrdersOverviewProps {
    stats: ShopOrderStats
}

export function ShopOrdersOverview({ stats }: ShopOrdersOverviewProps) {
    const items = [
        { label: 'Total', value: stats.total, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        { label: 'Processing', value: stats.pending + stats.processing, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
    ]

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                            <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <CardTitle className="text-base font-bold">Shop Orders Overview</CardTitle>
                    </div>
                    <Link href="/dashboard/shop/orders">
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-blue-600 hover:text-blue-700 dark:text-blue-400 gap-1">
                            View All
                            <ArrowRight className="w-3 h-3" />
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {items.map(item => (
                        <div key={item.label} className={cn('rounded-xl p-3 flex flex-col gap-1', item.bg)}>
                            <div className="flex items-center gap-1.5">
                                <item.icon className={cn('w-3.5 h-3.5', item.color)} />
                                <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
                            </div>
                            <span className={cn('text-2xl font-bold', item.color)}>{item.value}</span>
                        </div>
                    ))}
                </div>

                {/* Revenue / Profit row */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t">
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">Total Revenue</p>
                        <p className="text-lg font-bold">{formatCurrency(stats.revenue)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">Total Profit</p>
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.profit)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
