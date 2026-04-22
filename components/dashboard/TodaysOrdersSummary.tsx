'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { ShoppingCart, CheckCircle2, Clock, Truck, Star, Banknote } from 'lucide-react'

interface TodayOrderStats {
    totalCount: number
    completed: { count: number; gb: number; amount: number }
    pending: { count: number; gb: number; amount: number }
    processing: { count: number; gb: number; amount: number }
    afa: { count: number; amount: number }
    totalSpent: number
}

export function TodaysOrdersSummary() {
    const { dbUser } = useAuth()
    const [stats, setStats] = useState<TodayOrderStats>({
        totalCount: 0,
        completed: { count: 0, gb: 0, amount: 0 },
        pending: { count: 0, gb: 0, amount: 0 },
        processing: { count: 0, gb: 0, amount: 0 },
        afa: { count: 0, amount: 0 },
        totalSpent: 0
    })
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!dbUser) return

        const fetchTodayOrders = async () => {
            try {
                // Get start of today (midnight)
                const now = new Date()
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
                const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()

                // Fetch normal data orders
                const { data: regularOrders } = await supabase
                    .from('orders')
                    .select('status, size, price')
                    .eq('user_id', dbUser.id)
                    .is('shop_order_id', null)
                    .gte('created_at', startOfToday)
                    .lte('created_at', endOfToday)

                // Fetch AFA orders
                const { data: afaOrders } = await supabase
                    .from('afa_registrations')
                    .select('status, amount')
                    .eq('user_id', dbUser.id)
                    .gte('created_at', startOfToday)
                    .lte('created_at', endOfToday)

                const currentStats = {
                    totalCount: 0,
                    completed: { count: 0, gb: 0, amount: 0 },
                    pending: { count: 0, gb: 0, amount: 0 },
                    processing: { count: 0, gb: 0, amount: 0 },
                    afa: { count: 0, amount: 0 },
                    totalSpent: 0
                }

                // Parse standard orders
                if (regularOrders) {
                    currentStats.totalCount += regularOrders.length
                    regularOrders.forEach((order: any) => {
                        const gbMatch = order.size ? String(order.size).match(/(\d+)/) : null
                        const gb = gbMatch ? parseInt(gbMatch[1], 10) : 0
                        const amount = order.price || 0

                        if (order.status === 'completed') {
                            currentStats.completed.count++
                            currentStats.completed.gb += gb
                            currentStats.completed.amount += amount
                            currentStats.totalSpent += amount
                        } else if (order.status === 'processing') {
                            currentStats.processing.count++
                            currentStats.processing.gb += gb
                            currentStats.processing.amount += amount
                            currentStats.totalSpent += amount
                        } else if (order.status === 'pending') {
                            currentStats.pending.count++
                            currentStats.pending.gb += gb
                            currentStats.pending.amount += amount
                            currentStats.totalSpent += amount
                        }
                    })
                }

                // Parse AFA orders
                if (afaOrders) {
                    currentStats.totalCount += afaOrders.length
                    afaOrders.forEach((order: any) => {
                        const amount = order.amount || 0
                        currentStats.afa.count++
                        currentStats.afa.amount += amount
                        
                        // Include in total spent if not failed/refunded
                        if (['completed', 'processing', 'pending'].includes(order.status)) {
                            currentStats.totalSpent += amount
                        }
                    })
                }

                setStats(currentStats)
            } catch (error) {
                console.error('Error fetching today orders:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchTodayOrders()
    }, [dbUser])

    if (isLoading) return null

    return (
        <Card className="border-0 shadow-blue-premium rounded-[2rem] bg-white dark:bg-gray-950 overflow-hidden relative mb-4 group hover:shadow-xl transition-all duration-500">
            <CardContent className="p-8">
                <div className="flex justify-between items-start">
                    {/* Left side info */}
                    <div className="space-y-6 flex-1">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60 mb-2">Today&apos;s Performance</p>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner group-hover:bg-primary/20 transition-colors">
                                    <ShoppingCart className="w-7 h-7 text-primary" />
                                </div>
                                <div>
                                    <span className="text-4xl md:text-5xl font-black text-foreground tracking-tighter drop-shadow-sm">
                                        {stats.totalCount}
                                    </span>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Total Orders</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 pt-4 border-t border-border/50">
                            {/* Completed */}
                            <div className="flex items-center gap-3 text-sm group/item">
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                <span className="text-green-600 dark:text-green-400 font-black tracking-tight drop-shadow-sm">
                                    {stats.completed.count} Completed <span className="opacity-60 font-medium">({stats.completed.gb}GB • {formatCurrency(stats.completed.amount)})</span>
                                </span>
                            </div>
                            
                            {/* Processing */}
                            <div className="flex items-center gap-3 text-sm group/item">
                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                <span className="text-blue-600 dark:text-blue-400 font-black tracking-tight drop-shadow-sm">
                                    {stats.processing.count} Processing <span className="opacity-60 font-medium">({stats.processing.gb}GB • {formatCurrency(stats.processing.amount)})</span>
                                </span>
                            </div>

                            {/* Pending */}
                            <div className="flex items-center gap-3 text-sm group/item">
                                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                <span className="text-amber-600 dark:text-amber-400 font-black tracking-tight drop-shadow-sm">
                                    {stats.pending.count} Pending <span className="opacity-60 font-medium">({stats.pending.gb}GB • {formatCurrency(stats.pending.amount)})</span>
                                </span>
                            </div>

                            {/* AFA */}
                            <div className="flex items-center gap-3 text-sm group/item">
                                <div className="w-2 h-2 rounded-full bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.5)]" />
                                <span className="text-purple-600 dark:text-purple-400 font-black tracking-tight drop-shadow-sm">
                                    {stats.afa.count} AFA Orders <span className="opacity-60 font-medium">({formatCurrency(stats.afa.amount)})</span>
                                </span>
                            </div>

                            {/* Total Spent */}
                            <div className="md:col-span-2 mt-2 p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Banknote className="w-5 h-5 text-primary" />
                                    <span className="text-xs font-black uppercase tracking-widest text-primary/80">Daily Expenditure</span>
                                </div>
                                <span className="text-xl font-black text-primary drop-shadow-sm">
                                    {formatCurrency(stats.totalSpent)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
