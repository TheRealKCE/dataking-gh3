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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ArrowLeft, Loader2, Calendar as CalendarIcon, Wallet, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export default function UserTransactionHistoryPage({ params }: { params: Promise<{ userId: string }> }) {
    // Unwrap params using React.use()
    const { userId } = use(params)
    const router = useRouter()

    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(0)

    // Filters
    const [typeFilter, setTypeFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // User Summary (Could be fetched separately or passed, but for now we fetch basic user info if needed or just rely on IDs)
    // Actually, we probably want to show WHO this is for. 
    // The previous page has user info, but deep linking needs a fetch.
    // Let's assume we might need a quick user fetch or just show ID for now.
    // Enhanced: Fetch user summary stats alongside if possible, but our transaction API doesn't return user details.
    // We can fetch user details from the finance user API or a dedicated one.
    // Let's add a small fetch for user details to display name.
    const [userDetails, setUserDetails] = useState<any>(null)

    const ITEMS_PER_PAGE = 20

    useEffect(() => {
        const fetchUserDetails = async () => {
            try {
                // leveraging the existing finance users api but searching by ID is not efficiently supported there without filter.
                // Let's use the basic users endpoint or just display ID.
                // Better: generic /api/admin/users/ID if available? No.
                // We'll rely on the transactions page mostly.
                // Actually, let's just fetch the transactions. The user name isn't critical but nice to have.
                // We can fetch it from the client-side supabase if needed, or just ignore for this iteration.
            } catch (e) { console.error(e) }
        }
        fetchUserDetails()
    }, [userId])

    useEffect(() => {
        fetchTransactions()
    }, [userId, page, typeFilter, statusFilter, startDate, endDate])

    const fetchTransactions = async () => {
        try {
            setLoading(true)
            const offset = page * ITEMS_PER_PAGE
            const queryParams = new URLSearchParams({
                limit: ITEMS_PER_PAGE.toString(),
                offset: offset.toString(),
                type: typeFilter,
                status: statusFilter,
            })

            if (startDate) queryParams.append('startDate', startDate)
            if (endDate) queryParams.append('endDate', endDate)

            const response = await fetch(`/api/admin/finance/users/${userId}/transactions?${queryParams}`)
            if (!response.ok) throw new Error('Failed to fetch transactions')
            const data = await response.json()

            setTransactions(data.transactions || [])
            setTotalCount(data.totalCount || 0)
        } catch (error) {
            console.error('Error:', error)
            toast.error('Failed to load transactions')
        } finally {
            setLoading(false)
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
                    <p className="text-muted-foreground font-mono text-xs mt-1">User ID: {userId}</p>
                </div>
            </div>

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
                        <div className="space-y-2 w-full md:w-auto">
                            <label className="text-xs font-medium text-muted-foreground">Status</label>
                            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0) }}>
                                <SelectTrigger className="w-full md:w-[150px]">
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
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
                                setStatusFilter('all')
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
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
                                        <TableCell>
                                            <span className={`text-xs font-medium capitalize ${txn.status === 'completed' ? 'text-green-600' :
                                                    txn.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                {txn.status}
                                            </span>
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
