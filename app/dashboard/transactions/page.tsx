'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Search, ArrowUpRight, ArrowDownLeft, Receipt, CreditCard, Wallet as WalletIcon, RefreshCw } from 'lucide-react'
import { WalletTransaction } from '@/types/supabase'
import { WalletStatsCard } from '@/components/dashboard/WalletStatsCard'

export default function TransactionsPage() {
    const { dbUser } = useAuth()
    const [transactions, setTransactions] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [sourceFilter, setSourceFilter] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const ITEMS_PER_PAGE = 20

    const [stats, setStats] = useState({
        total: 0,
        todayCredits: 0,
        todayDebits: 0,
        todayRefunds: 0,
    })

    useEffect(() => {
        if (dbUser) {
            fetchTransactions()
        }
    }, [dbUser, page, typeFilter, sourceFilter, startDate, endDate])

    // Local search filter (since we search description/reference)
    const filteredTransactions = searchQuery
        ? transactions.filter(t =>
            t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.reference?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : transactions

    const fetchTransactions = async () => {
        try {
            setIsLoading(true)
            const params = {
                p_user_id: dbUser?.id,
                p_limit: ITEMS_PER_PAGE,
                p_offset: page * ITEMS_PER_PAGE,
                p_source_filter: sourceFilter,
                p_type_filter: typeFilter,
                p_start_date: startDate || null,
                p_end_date: endDate ? `${endDate}T23:59:59` : null
            }

            // @ts-ignore
            const { data, error } = await supabase.rpc('get_user_transactions_with_balance', params)

            if (error) throw error
            setTransactions(data || [])

            // Fetch total count and stats
            const { count } = await supabase
                .from('wallet_transactions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', dbUser?.id as any)

            setTotalCount(count || 0)

            // Fetch Wallet Data for Lifetime Stats
            const { data: walletData } = await supabase
                .from('wallets')
                .select('balance, total_credited, total_spent')
                .eq('user_id', dbUser?.id as any)
                .single()

            if (walletData) {
                // @ts-ignore
                setStats(prev => ({ ...prev, wallet: walletData }))
            }
        } catch (error) {
            console.error('Error fetching transactions:', error)
        } finally {
            setIsLoading(false)
        }
    }



    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Transactions</h1>

            {/* Lifetime Stats */}
            {/* @ts-ignore */}
            {stats.wallet && (
                <WalletStatsCard
                    // @ts-ignore
                    balance={stats.wallet.balance || 0}
                    // @ts-ignore
                    totalCredited={stats.wallet.total_credited || 0}
                    // @ts-ignore
                    totalSpent={stats.wallet.total_spent || 0}
                />
            )}

            {/* Daily Stats Grid - Keep for today's context if needed or remove depending on preference. 
                User asked for "one big card", but keeping daily stats below might be useful. 
                If user wants ONLY the big card, I should remove this grid. 
                For now, I'll keep it as supplementary info but prominently feature the big card. */}
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            {/* @ts-ignore */}
                            <p className="text-2xl font-bold">{stats.total || 0}</p>
                            <p className="text-xs text-muted-foreground">Total Transactions</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            {/* @ts-ignore */}
                            <p className="text-2xl font-bold">{formatCurrency(stats.todayCredits || 0)}</p>
                            <p className="text-xs text-muted-foreground">Today's Income</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <WalletIcon className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            {/* @ts-ignore */}
                            <p className="text-2xl font-bold">{formatCurrency(stats.todayDebits || 0)}</p>
                            <p className="text-xs text-muted-foreground">Today's Expenses</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            {/* @ts-ignore */}
                            <p className="text-2xl font-bold">{formatCurrency(stats.todayRefunds || 0)}</p>
                            <p className="text-xs text-muted-foreground">Today's Refunds</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search in this page..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="credit">Credits</SelectItem>
                                    <SelectItem value="debit">Debits</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="purchase">Data Purchase</SelectItem>
                                    <SelectItem value="payment">Wallet Funding</SelectItem>
                                    <SelectItem value="admin">Adjustments</SelectItem>
                                    <SelectItem value="refund">Refunds</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="grid grid-cols-2 gap-2 flex-1">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">From</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">To</label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                                    className="h-9"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setStartDate('');
                                setEndDate('');
                                setTypeFilter('all');
                                setSourceFilter('all');
                                setSearchQuery('');
                                setPage(0);
                            }}
                            className="text-xs text-blue-600 hover:underline mb-2"
                        >
                            Reset Filters
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
                <CardContent className="p-0">
                    {filteredTransactions.length === 0 ? (
                        <div className="text-center py-12">
                            <Receipt className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No transactions found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Prev Bal</TableHead>
                                    <TableHead className="text-right">New Bal</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTransactions.map((txn) => (
                                    <TableRow key={txn.id}>
                                        <TableCell>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${txn.type === 'credit'
                                                ? 'bg-green-100 dark:bg-green-900/30'
                                                : 'bg-red-100 dark:bg-red-900/30'
                                                }`}>
                                                {txn.type === 'credit' ? (
                                                    <ArrowDownLeft className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <ArrowUpRight className="w-4 h-4 text-red-600" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{txn.description}</TableCell>
                                        <TableCell>
                                            <div className="font-mono text-sm uppercase tracking-tighter text-muted-foreground">
                                                {txn.reference?.slice(-6) || '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                            {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                            {txn.balance_before !== undefined ? formatCurrency(txn.balance_before) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs font-semibold">
                                            {txn.balance_after !== undefined ? formatCurrency(txn.balance_after) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={txn.status === 'completed' ? 'completed' : txn.status === 'failed' ? 'failed' : 'pending'} className="text-[10px] h-5 px-1.5">
                                                {txn.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                            {formatDate(txn.created_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    {/* Pagination */}
                    {totalCount > ITEMS_PER_PAGE && (
                        <div className="p-4 border-t flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Showing {page * ITEMS_PER_PAGE + 1} to {Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="px-3 py-1 text-xs border rounded hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={(page + 1) * ITEMS_PER_PAGE >= totalCount}
                                    className="px-3 py-1 text-xs border rounded hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
