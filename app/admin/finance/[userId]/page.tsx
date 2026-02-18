'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { WalletStatsCard } from '@/components/dashboard/WalletStatsCard'

export default function UserTransactionHistoryPage({ params }: { params: Promise<{ userId: string }> }) {
    // Unwrap params using React.use()
    const { userId } = use(params)
    const router = useRouter()

    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)
    const [walletStats, setWalletStats] = useState<any>(null)
    const [user, setUser] = useState<any>(null) // New state for user details
    const [page, setPage] = useState(0)

    // Filters
    const [typeFilter, setTypeFilter] = useState('all')
    const [sourceFilter, setSourceFilter] = useState('all') // Changed from statusFilter
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const ITEMS_PER_PAGE = 20

    useEffect(() => {
        fetchTransactions()
    }, [userId, page, typeFilter, sourceFilter, startDate, endDate]) // Updated dependency

    const fetchTransactions = async () => {
        try {
            setLoading(true)
            const offset = page * ITEMS_PER_PAGE
            const queryParams = new URLSearchParams({
                limit: ITEMS_PER_PAGE.toString(),
                offset: offset.toString(),
                type: typeFilter,
                source: sourceFilter, // Updated param key
            })

            if (startDate) queryParams.append('startDate', startDate)
            if (endDate) queryParams.append('endDate', endDate)

            const response = await fetch(`/api/admin/finance/users/${userId}/transactions?${queryParams}`)
            if (!response.ok) throw new Error('Failed to fetch transactions')
            const data = await response.json()

            setTransactions(data.transactions || [])
            setTotalCount(data.totalCount || 0)
            setWalletStats(data.wallet || null) // Set full wallet stats
            setUser(data.user || null)
        } catch (error) {
            console.error('Error:', error)
            toast.error('Failed to load transactions')
        } finally {
            setLoading(false)
        }
    }

    // Helper to format source for display
    const formatSource = (source: string) => {
        switch (source) {
            case 'purchase': return 'Order'
            case 'payment': return 'Wallet Funding'
            case 'admin': return 'Admin Adjustment'
            case 'refund': return 'Refund'
            default: return source
        }
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Button
                    variant="ghost"
                    className="w-fit -ml-4 text-muted-foreground hover:text-foreground"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Wallet Analytics
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Transaction History</h1>
                    {user ? (
                        <div className="flex flex-col mt-1">
                            <p className="text-lg font-medium">{user.first_name} {user.last_name}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground font-mono">
                                <span>{user.phone_number}</span>
                                <span className="text-muted-foreground/30">•</span>
                                <span>{user.email}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground font-mono text-xs mt-1">User ID: {userId}</p>
                    )}
                </div>
            </div>

            {/* Lifetime Stats Card */}
            {walletStats && (
                <WalletStatsCard
                    balance={walletStats.balance || 0}
                    totalCredited={walletStats.total_credited || 0}
                    totalSpent={walletStats.total_spent || 0}
                />
            )}

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="space-y-2 w-full md:w-auto">
                            <label className="text-xs font-medium text-muted-foreground">Type</label>
                            <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(0) }}>
                                <SelectTrigger className="w-full md:w-[150px]">
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="credit">Credit (+)</SelectItem>
                                    <SelectItem value="debit">Debit (-)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Source Filter (Replaces Status) */}
                        <div className="space-y-2 w-full md:w-auto">
                            <label className="text-xs font-medium text-muted-foreground">Category</label>
                            <Select value={sourceFilter} onValueChange={(val) => { setSourceFilter(val); setPage(0) }}>
                                <SelectTrigger className="w-full md:w-[150px]">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="purchase">Orders / Purchases</SelectItem>
                                    <SelectItem value="payment">Wallet Funding</SelectItem>
                                    <SelectItem value="admin">Admin Adjustments</SelectItem>
                                    <SelectItem value="refund">Refunds</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 w-full md:w-auto">
                            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
                                className="w-full md:w-auto"
                            />
                        </div>
                        <div className="space-y-2 w-full md:w-auto">
                            <label className="text-xs font-medium text-muted-foreground">End Date</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
                                className="w-full md:w-auto"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setTypeFilter('all')
                                setSourceFilter('all') // Reset source
                                setStartDate('')
                                setEndDate('')
                                setPage(0)
                            }}
                            className="w-full md:w-auto"
                        >
                            Reset
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Prev Bal</TableHead>
                                <TableHead className="text-right">New Bal</TableHead>
                                <TableHead>Category</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                        No transactions found matching your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((txn) => (
                                    <TableRow key={txn.id}>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {formatDate(txn.created_at)}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {txn.reference || '-'}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={txn.description}>
                                            {txn.description}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={txn.type === 'credit'
                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                    : 'bg-red-50 text-red-700 border-red-200'
                                                }
                                            >
                                                {txn.type === 'credit' ? <ArrowUpCircle className="w-3 h-3 mr-1" /> : <ArrowDownCircle className="w-3 h-3 mr-1" />}
                                                {txn.type.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                            {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                            {txn.balance_before !== undefined ? formatCurrency(txn.balance_before) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs font-medium">
                                            {txn.balance_after !== undefined ? formatCurrency(txn.balance_after) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="capitalize font-normal text-muted-foreground bg-slate-100 hover:bg-slate-200 text-xs">
                                                {formatSource(txn.source)}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div>
                    Showing {Math.min(transactions.length, ITEMS_PER_PAGE)} of {totalCount} records
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0 || loading}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={transactions.length < ITEMS_PER_PAGE || loading}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
