'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Search, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis
} from '@/components/ui/pagination'

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const ITEMS_PER_PAGE = 20

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm)
            setCurrentPage(1) // Reset to first page on search
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true)
            const from = (currentPage - 1) * ITEMS_PER_PAGE
            const to = from + ITEMS_PER_PAGE - 1

            let query = supabase
                .from('wallet_transactions')
                .select(`
                    *,
                    users (
                        first_name,
                        last_name,
                        email,
                        phone_number
                    )
                `, { count: 'exact' })

            if (debouncedSearch) {
                query = query.or(`reference.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`)
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(from, to)

            if (error) throw error
            setTransactions(data || [])
            setTotalCount(count || 0)
        } catch (error) {
            console.error('Error fetching transactions:', error)
        } finally {
            setLoading(false)
        }
    }, [currentPage, debouncedSearch])

    useEffect(() => {
        fetchTransactions()
    }, [fetchTransactions])

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

    const renderPaginationItems = () => {
        const items = []
        const maxVisible = 5
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
        let endPage = Math.min(totalPages, startPage + maxVisible - 1)

        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1)
        }

        if (startPage > 1) {
            items.push(
                <PaginationItem key="1">
                    <PaginationLink onClick={() => setCurrentPage(1)} className="cursor-pointer">1</PaginationLink>
                </PaginationItem>
            )
            if (startPage > 2) items.push(<PaginationEllipsis key="e1" />)
        }

        for (let i = startPage; i <= endPage; i++) {
            items.push(
                <PaginationItem key={i}>
                    <PaginationLink
                        isActive={currentPage === i}
                        onClick={() => setCurrentPage(i)}
                        className="cursor-pointer"
                    >
                        {i}
                    </PaginationLink>
                </PaginationItem>
            )
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) items.push(<PaginationEllipsis key="e2" />)
            items.push(
                <PaginationItem key={totalPages}>
                    <PaginationLink onClick={() => setCurrentPage(totalPages)} className="cursor-pointer">{totalPages}</PaginationLink>
                </PaginationItem>
            )
        }

        return items
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Global Transactions</h1>
                    <p className="text-muted-foreground">View all wallet transactions across the platform</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by user, reference, or description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <span>Loading transactions...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        No transactions found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((txn) => (
                                    <TableRow key={txn.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{txn.users?.first_name} {txn.users?.last_name}</span>
                                                <span className="text-xs text-muted-foreground">{txn.users?.phone_number || txn.users?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{txn.reference}</TableCell>
                                        <TableCell>
                                            <Badge variant={txn.type === 'credit' ? 'default' : 'destructive'} className={txn.type === 'credit' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                                                {txn.type.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{txn.description}</TableCell>
                                        <TableCell className={txn.type === 'credit' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                            {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`text-xs capitalize font-medium ${txn.status === 'completed' ? 'text-green-600' :
                                                txn.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                {txn.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {formatDate(txn.created_at)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
                    <p className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} transactions
                    </p>
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                />
                            </PaginationItem>
                            {renderPaginationItems()}
                            <PaginationItem>
                                <PaginationNext
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </div>
    )
}
