'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldCheck, TrendingDown, Store, User, Smartphone, RefreshCw } from 'lucide-react'

type DateFilter = 'All' | 'Today' | 'Yesterday' | 'This Week' | 'This Month'
type DateRange = { start: string, end: string } | null

export default function ProfitLogsClient() {
    const supabase = createClientComponentClient()

    // Filters
    const [dateFilter, setDateFilter] = useState<DateFilter>('Today')
    const [typeFilter, setTypeFilter] = useState<'All' | 'main' | 'shop'>('All')
    
    // Data State
    const [logs, setLogs] = useState<any[]>([])
    const [losses, setLosses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [page, setPage] = useState(0)

    const limit = 50

    // Date Range Helpers
    const getDateRange = (filter: DateFilter): DateRange => {
        if (filter === 'All') return null

        const now = new Date()
        
        if (filter === 'Today') {
            const start = new Date(now)
            start.setHours(0, 0, 0, 0)
            const end = new Date(now)
            end.setHours(23, 59, 59, 999)
            return { start: start.toISOString(), end: end.toISOString() }
        }
        
        if (filter === 'Yesterday') {
            const start = new Date(now)
            start.setDate(now.getDate() - 1)
            start.setHours(0, 0, 0, 0)
            const end = new Date(now)
            end.setDate(now.getDate() - 1)
            end.setHours(23, 59, 59, 999)
            return { start: start.toISOString(), end: end.toISOString() }
        }

        if (filter === 'This Week') {
            const start = new Date(now)
            start.setDate(now.getDate() - now.getDay()) // Sunday start
            start.setHours(0, 0, 0, 0)
            const end = new Date(now)
            end.setHours(23, 59, 59, 999)
            return { start: start.toISOString(), end: end.toISOString() }
        }

        if (filter === 'This Month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1)
            const end = new Date(now)
            end.setHours(23, 59, 59, 999)
            return { start: start.toISOString(), end: end.toISOString() }
        }

        return null
    }

    const enrichLogs = async (rawLogs: any[]) => {
        if (!rawLogs.length) return rawLogs

        const mainIds = rawLogs.filter(l => l.transaction_type === 'main').map(l => l.transaction_id)
        const shopIds = rawLogs.filter(l => l.transaction_type === 'shop').map(l => l.transaction_id)

        let mainOrdersMap: Record<string, any> = {}
        let shopOrdersMap: Record<string, any> = {}

        if (mainIds.length > 0) {
            const { data: mainOrders } = await supabase
                .from('orders')
                .select('id, phone_number')
                .in('id', mainIds)
            
            mainOrders?.forEach(o => { mainOrdersMap[o.id] = o })
        }

        if (shopIds.length > 0) {
            const { data: shopOrders } = await supabase
                .from('shop_orders')
                .select('id, shop_name')
                .in('id', shopIds)
            
            shopOrders?.forEach(o => { shopOrdersMap[o.id] = o })
        }

        return rawLogs.map(log => ({
            ...log,
            enrichedData: log.transaction_type === 'main' 
                ? mainOrdersMap[log.transaction_id] 
                : shopOrdersMap[log.transaction_id]
        }))
    }

    const loadLogs = useCallback(async (isLoadMore = false, currentPage = 0) => {
        if (!isLoadMore) {
            setLoading(true)
            setPage(0)
            setHasMore(true)
        } else {
            setLoadingMore(true)
        }

        try {
            let query = supabase
                .from('admin_profit_logs')
                .select('*')
                .order('created_at', { ascending: false })

            // Apply Filters
            if (typeFilter !== 'All') {
                query = query.eq('transaction_type', typeFilter)
            }

            const dateRange = getDateRange(dateFilter)
            if (dateRange) {
                query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end)
            }

            // Pagination
            const offset = currentPage * limit
            query = query.range(offset, offset + limit - 1)

            const { data, error } = await query

            if (error) throw error

            const enrichedData = await enrichLogs(data || [])

            if (isLoadMore) {
                setLogs(prev => [...prev, ...enrichedData])
            } else {
                setLogs(enrichedData)
            }

            // Check if there's more data
            if (enrichedData.length < limit) {
                setHasMore(false)
            }

        } catch (error) {
            console.error('Error fetching logs:', error)
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [dateFilter, typeFilter])

    // Fetch total losses regardless of pagination for the highlighted card
    useEffect(() => {
        const loadLosses = async () => {
            const dateRange = getDateRange(dateFilter)
            let query = supabase.from('admin_profit_logs').select('*').eq('is_loss', true).order('created_at', { ascending: false }).limit(50)
            if (dateRange) {
                query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end)
            }
            const { data } = await query
            setLosses(data || [])
        }
        loadLosses()
    }, [dateFilter])

    // Load main data when filters change
    useEffect(() => {
        loadLogs(false, 0)
    }, [dateFilter, typeFilter, loadLogs])

    const handleLoadMore = () => {
        const nextPage = page + 1
        setPage(nextPage)
        loadLogs(true, nextPage)
    }

    const calculateTotals = () => {
        const totalProfit = logs.reduce((acc, log) => acc + (parseFloat(log.profit) || 0), 0)
        return totalProfit
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 bg-zinc-50/50 min-h-screen">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-indigo-600" />
                    Premium Profit Logs
                </h1>
                <p className="text-muted-foreground max-w-3xl">
                    Immutable read-only ledger of every completed transaction. These records are 100% accurate at the time of purchase and are never re-calculated.
                </p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="space-y-4 w-full">
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center w-full">
                        {/* Date Filters */}
                        <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex-wrap">
                            {(['Today', 'Yesterday', 'This Week', 'This Month', 'All'] as DateFilter[]).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setDateFilter(f)}
                                    className={`px-4 py-2 text-sm font-semibold transition-colors flex-1 text-center whitespace-nowrap
                                        ${dateFilter === f ? 'bg-indigo-600 text-white shadow-inner' : 'text-slate-600 hover:bg-slate-100'}
                                    `}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        
                        {/* Type Filter */}
                        <select 
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="bg-white border border-slate-200 text-sm font-semibold text-slate-700 px-4 py-2 rounded-lg ml-auto min-w-[150px] cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="All">All Transactions</option>
                            <option value="main">Main Platform Filter</option>
                            <option value="shop">Shop Platform Filter</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* HIGHLIGHT: PRICING ANOMALIES (LOSSES) */}
            {losses.length > 0 && (
                <Card className="border-red-200 bg-red-50/50 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <CardHeader className="pb-3 border-b border-red-100">
                        <CardTitle className="text-red-700 font-semibold flex items-center gap-2">
                            <TrendingDown className="w-5 h-5" />
                            Pricing Anomalies Detected ({losses.length})
                        </CardTitle>
                        <CardDescription className="text-red-600/80">
                            The system has detected transactions where the platform lost money. Review your package cost vs selling prices immediately.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 max-h-[300px] overflow-auto">
                        <div className="space-y-3">
                            {losses.slice(0, 5).map(loss => (
                                <div key={loss.id} className="bg-white p-3 rounded-lg border border-red-100 flex items-center justify-between shadow-sm">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="destructive" className="bg-red-500">LOSS</Badge>
                                            <span className="text-sm font-medium">{formatDate(loss.created_at)}</span>
                                            <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded-full uppercase bg-slate-50">{loss.channel}</span>
                                        </div>
                                        <p className="text-sm font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded inline-block mt-1">
                                            {loss.calculation_note}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-red-600">{formatCurrency(loss.profit)}</p>
                                    </div>
                                </div>
                            ))}
                            {losses.length > 5 && (
                                <div className="text-center text-sm text-red-500 pt-2 font-medium">
                                    + {losses.length - 5} more loss records hidden.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* MAIN LOGS DATA TABLE */}
            <Card className="shadow-sm border-0 bg-white overflow-hidden text-sm">
                <CardHeader className="pb-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Financial Logs</CardTitle>
                        <CardDescription>Filtered records base on your selection</CardDescription>
                    </div>
                    {!loading && logs.length > 0 && (
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Filtered Profit</p>
                            <p className={`text-xl font-black ${calculateTotals() >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {calculateTotals() >= 0 ? '+' : ''}{formatCurrency(calculateTotals())}
                            </p>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-white text-muted-foreground uppercase tracking-wider text-[11px] h-12">
                                    <th className="px-6 font-bold text-left whitespace-nowrap">Transaction Timeline</th>
                                    <th className="px-6 font-bold text-left">Source / Entity</th>
                                    <th className="px-6 font-bold text-right">Selling/Paid</th>
                                    <th className="px-6 font-bold text-right">Admin Cost</th>
                                    <th className="px-6 font-bold text-right whitespace-nowrap">Net Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading && logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
                                            <p className="text-slate-500 font-semibold">Loading ledger records...</p>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-muted-foreground bg-slate-50/30">
                                            <Loader2 className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                            <h3 className="text-lg font-bold text-slate-400">No records found</h3>
                                            <p className="text-sm">There are no profit logs for the selected filters.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-6 align-top">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-slate-700 whitespace-nowrap">{formatDate(log.created_at)}</span>
                                                    <code className="text-[10px] text-slate-400">ID: {log.transaction_id.split('-')[0]}...</code>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 align-top">
                                                <div className="flex flex-col gap-2 items-start">
                                                    <Badge variant="outline" className={`uppercase text-[10px] tracking-wider px-2 py-0 border ${log.channel === 'main' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                                                        {log.channel === 'main' ? 'Main Platform' : 'Shop System'} · {log.role_at_time || 'Guest'}
                                                    </Badge>
                                                    
                                                    {/* Enriched Entity View */}
                                                    <div className="flex items-center gap-2 text-slate-600 mt-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                                        {log.channel === 'main' ? (
                                                            <>
                                                                <User className="w-4 h-4 text-slate-400 shrink-0" />
                                                                <span className="text-xs font-semibold">{log.enrichedData?.phone_number || 'Direct Customer'}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Store className="w-4 h-4 text-slate-400 shrink-0" />
                                                                <span className="text-xs font-semibold">{log.enrichedData?.shop_name || 'Storefront'}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-black text-slate-800 align-top">
                                                {formatCurrency(log.channel === 'main' ? log.selling_price : log.amount_paid_to_admin)}
                                            </td>
                                            <td className="py-4 px-6 text-right font-bold text-slate-500 align-top">
                                                {formatCurrency(log.admin_cost)}
                                            </td>
                                            <td className="py-4 px-6 text-right align-top">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-base font-black px-2 py-0.5 rounded-full ${log.is_loss ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {log.is_loss ? '' : '+'}{formatCurrency(log.profit)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 mt-1 max-w-[120px] leading-tight" title={log.calculation_note}>
                                                        {log.calculation_note.split('|')[0]}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
                
                {/* Pagination Load More */}
                {logs.length > 0 && hasMore && (
                    <div className="p-4 border-t bg-slate-50 flex justify-center">
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-6 rounded-full shadow-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                        >
                            {loadingMore ? (
                                <><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Fetching records...</>
                            ) : (
                                <><RefreshCw className="w-4 h-4 text-slate-400" /> Load More Records</>
                            )}
                        </button>
                    </div>
                )}
                {logs.length > 0 && !hasMore && (
                    <div className="p-4 border-t bg-slate-50 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                        End of ledgers
                    </div>
                )}
            </Card>
        </div>
    )
}
