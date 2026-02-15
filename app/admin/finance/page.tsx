'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, Loader2, ArrowUpDown, Eye, Wallet, TrendingUp, TrendingDown, Users, Shield, User } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export default function AdminFinancePage() {
    const router = useRouter()
    const [users, setUsers] = useState<any[]>([])
    const [stats, setStats] = useState<any>({ totalBalance: 0, totalCredited: 0, totalSpent: 0 })
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [sortBy, setSortBy] = useState('balance')
    const [sortOrder, setSortOrder] = useState('desc')
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [roleFilter, setRoleFilter] = useState('all')
    const ITEMS_PER_PAGE = 20

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Fetch data
    useEffect(() => {
        fetchUsers()
        fetchStats()
    }, [debouncedSearch, sortBy, sortOrder, page, roleFilter])

    const fetchStats = async () => {
        try {
            const queryParams = new URLSearchParams()
            if (roleFilter !== 'all') queryParams.append('role', roleFilter)

            const response = await fetch(`/api/admin/finance/stats?${queryParams}`)
            if (!response.ok) throw new Error('Failed to fetch stats')
            const data = await response.json()
            setStats(data)
        } catch (error) {
            console.error('Stats Error:', error)
        }
    }

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const offset = page * ITEMS_PER_PAGE
            const queryParams = new URLSearchParams({
                limit: ITEMS_PER_PAGE.toString(),
                offset: offset.toString(),
                sort: sortBy,
                order: sortOrder,
                search: debouncedSearch
            })

            if (roleFilter !== 'all') queryParams.append('role', roleFilter)

            const response = await fetch(`/api/admin/finance/users?${queryParams}`)
            if (!response.ok) throw new Error('Failed to fetch data')
            const data = await response.json()

            setUsers(data.users || [])
            setTotalCount(data.totalCount || 0)
        } catch (error) {
            console.error('Error:', error)
            toast.error('Failed to load financial data')
        } finally {
            setLoading(false)
        }
    }

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(column)
            setSortOrder('desc')
        }
    }

    const SortIcon = ({ column }: { column: string }) => {
        if (sortBy !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
        return sortOrder === 'asc'
            ? <TrendingUp className="ml-2 h-4 w-4 text-primary" />
            : <TrendingDown className="ml-2 h-4 w-4 text-primary" />
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        Wallet Analytics
                    </h1>
                    <p className="text-muted-foreground">
                        Track user balances, lifetime spends, and credits.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-[180px]">
                        <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(0) }}>
                            <SelectTrigger className="bg-white dark:bg-slate-950">
                                <SelectValue placeholder="Filter by Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="customer">Customers</SelectItem>
                                <SelectItem value="agent">Agents</SelectItem>
                                <SelectItem value="admin">Admins</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Big Stats Card */}
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 border-none shadow-lg text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-100 flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Total System Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatCurrency(stats.totalBalance)}</div>
                        <p className="text-xs text-emerald-100 mt-1">
                            Across {stats.count || 0} users
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-emerald-100 dark:border-emerald-900/20 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, phone, or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-emerald-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(val) => {
                                const [col, ord] = val.split('-')
                                setSortBy(col)
                                setSortOrder(ord)
                            }}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="balance-desc">Highest Balance</SelectItem>
                                    <SelectItem value="balance-asc">Lowest Balance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-md border border-emerald-100 dark:border-emerald-900/20 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-emerald-50/50 dark:bg-emerald-900/10">
                                <TableRow>
                                    <TableHead className="w-[300px]">User</TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-emerald-100/50 transition-colors text-right"
                                        onClick={() => handleSort('balance')}
                                    >
                                        <div className="flex justify-end items-center">
                                            Current Balance
                                            <SortIcon column="balance" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            <div className="flex justify-center items-center gap-2 text-muted-foreground">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Loading financial data...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                            No users found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user) => (
                                        <TableRow key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{user.first_name} {user.last_name}</span>
                                                    <span className="text-xs text-muted-foreground">{user.phone_number}</span>
                                                    <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(user.wallet_balance)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="hover:bg-emerald-50 hover:text-emerald-700"
                                                    onClick={() => router.push(`/admin/finance/${user.id}`)}
                                                >
                                                    View History
                                                    <Eye className="w-4 h-4 ml-2" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Pagination */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div>
                    Showing {users.length} of {totalCount} users
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
                        disabled={users.length < ITEMS_PER_PAGE || loading}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
