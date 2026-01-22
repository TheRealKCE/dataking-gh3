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

export default function TransactionsPage() {
    const { dbUser } = useAuth()
    const [transactions, setTransactions] = useState<WalletTransaction[]>([])
    const [filteredTransactions, setFilteredTransactions] = useState<WalletTransaction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
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
    }, [dbUser])

    useEffect(() => {
        filterTransactions()
    }, [transactions, searchQuery, typeFilter])

    const fetchTransactions = async () => {
        try {
            const { data, error } = await supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', dbUser?.id as any)
                .order('created_at', { ascending: false })

            if (error) throw error
            setTransactions(data || [])

            // Calculate stats
            const today = new Date().toISOString().split('T')[0]
            const todayTxns = (data as any)?.filter((t: any) => t.created_at.startsWith(today)) || []

            setStats({
                total: data?.length || 0,
                todayCredits: todayTxns.filter((t: any) => t.type === 'credit' && t.source !== 'refund').reduce((sum: number, t: any) => sum + t.amount, 0),
                todayDebits: todayTxns.filter((t: any) => t.type === 'debit').reduce((sum: number, t: any) => sum + t.amount, 0),
                todayRefunds: todayTxns.filter((t: any) => t.source === 'refund').reduce((sum: number, t: any) => sum + t.amount, 0),
            })
        } catch (error) {
            console.error('Error fetching transactions:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const filterTransactions = () => {
        let filtered = transactions

        if (typeFilter !== 'all') {
            filtered = filtered.filter(t => t.type === typeFilter)
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(t =>
                t.description.toLowerCase().includes(query) ||
                t.reference?.toLowerCase().includes(query)
            )
        }

        setFilteredTransactions(filtered)
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

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.total}</p>
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
                            <p className="text-2xl font-bold">{formatCurrency(stats.todayCredits)}</p>
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
                            <p className="text-2xl font-bold">{formatCurrency(stats.todayDebits)}</p>
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
                            <p className="text-2xl font-bold">{formatCurrency(stats.todayRefunds)}</p>
                            <p className="text-xs text-muted-foreground">Today's Refunds</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search transactions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="credit">Credits</SelectItem>
                                <SelectItem value="debit">Debits</SelectItem>
                            </SelectContent>
                        </Select>
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
                                    <TableHead>Source</TableHead>
                                    <TableHead>Amount</TableHead>
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
                                        <TableCell className="font-mono text-sm">{txn.reference || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{txn.source}</Badge>
                                        </TableCell>
                                        <TableCell className={txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                                            {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={txn.status === 'completed' ? 'completed' : txn.status === 'failed' ? 'failed' : 'pending'}>
                                                {txn.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {formatDate(txn.created_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
