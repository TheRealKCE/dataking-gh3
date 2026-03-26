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
        <Card className="border shadow-none rounded-xl bg-white dark:bg-gray-950 overflow-hidden relative mb-2">
            <CardContent className="p-5">
                <div className="flex justify-between items-start">
                    {/* Left side info */}
                    <div className="space-y-3 flex-1">
                        <div>
                            <p className="text-gray-500 font-medium text-sm">Today&apos;s Orders</p>
                            <div className="flex items-center gap-2 mt-1">
                                <ShoppingCart className="w-8 h-8 text-blue-600 fill-blue-600" />
                                <span className="text-3xl font-black text-gray-900 dark:text-gray-100 leading-none">
                                    {stats.totalCount}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-2">
                            {/* Completed */}
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-green-500 fill-green-500/20" />
                                <span className="text-green-600 font-medium">
                                    {stats.completed.count} completed ({stats.completed.gb}GB) ({formatCurrency(stats.completed.amount)})
                                </span>
                            </div>
                            
                            {/* Processing */}
                            <div className="flex items-center gap-2 text-sm">
                                <Truck className="w-4 h-4 text-blue-500" />
                                <span className="text-blue-600 font-medium">
                                    {stats.processing.count} processing ({stats.processing.gb}GB) ({formatCurrency(stats.processing.amount)})
                                </span>
                            </div>

                            {/* Pending */}
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                                <span className="text-amber-600 font-medium">
                                    {stats.pending.count} pending ({stats.pending.gb}GB) ({formatCurrency(stats.pending.amount)})
                                </span>
                            </div>

                            {/* AFA */}
                            <div className="flex items-center gap-2 text-sm">
                                <Star className="w-4 h-4 text-purple-600 fill-purple-600" />
                                <span className="text-purple-600 font-medium">
                                    {stats.afa.count} AFA orders ({formatCurrency(stats.afa.amount)})
                                </span>
                            </div>

                            {/* Total Spent */}
                            <div className="flex items-center gap-2 text-sm pt-0.5">
                                <Banknote className="w-4 h-4 text-blue-700 fill-blue-700" />
                                <span className="text-blue-700 font-bold">
                                    {formatCurrency(stats.totalSpent)} spent
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right side decorative cart */}
                    <div className="hidden sm:flex shrink-0 ml-4 items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <ShoppingCart className="w-7 h-7 text-blue-600" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
