'use client'

import { useCallback, useEffect, useState } from 'react'
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
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination'
import { toast } from 'sonner'

const ITEMS_PER_PAGE = 20

const FLOW_LABELS: Record<string, string> = {
    wallet: 'Wallet Top-up',
    shop: 'Storefront',
    data: 'Data Bundle',
    results_checker: 'Results Checker',
    boost: 'Listing Boost',
    agent_upgrade: 'Agent Upgrade',
    dealer_subscription: 'Dealer Subscription',
    ussd: 'USSD',
    unknown: 'Other',
}

/**
 * The only two flows worth filtering on today. The label map above stays complete so a
 * wallet or storefront row still renders a readable Type under "All types".
 */
const FILTERABLE_FLOWS = ['ussd', 'results_checker'] as const

interface HubtelPaymentRecord {
    id: string
    client_reference: string
    flow: string | null
    status: 'pending' | 'success' | 'failed'
    stage: string
    amount: number | null
    channel: string | null
    payer_msisdn: string | null
    transaction_id: string | null
    response_code: string | null
    message: string | null
    created_at: string
    updated_at: string
}

/**
 * Every Hubtel payment attempt, successful or not.
 *
 * Rows are written at initiate, at each callback (including the ones the webhook
 * ignores), by the reconciliation cron, and by USSD fulfilment — so this is the one
 * place that answers "did this customer's payment go through?" across all flows.
 */
export default function HubtelPaymentsPage() {
    const [records, setRecords] = useState<HubtelPaymentRecord[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('all')
    const [flow, setFlow] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [currentPage, setCurrentPage] = useState(1)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                limit: String(ITEMS_PER_PAGE),
            })
            if (search.trim()) params.set('search', search.trim())
            if (status !== 'all') params.set('status', status)
            if (flow !== 'all') params.set('flow', flow)
            if (startDate) params.set('startDate', startDate)
            if (endDate) params.set('endDate', endDate)

            const res = await fetch(`/api/admin/hubtel-payments?${params.toString()}`)
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Could not load payment records')
                return
            }
            setRecords(data.records || [])
            setTotalCount(data.total || 0)
        } catch {
            toast.error('Network error while loading payment records')
        } finally {
            setLoading(false)
        }
    }, [currentPage, search, status, flow, startDate, endDate])

    useEffect(() => {
        const t = setTimeout(load, 300)
        return () => clearTimeout(t)
    }, [load])

    // Any filter change invalidates the current page number.
    useEffect(() => {
        setCurrentPage(1)
    }, [search, status, flow, startDate, endDate])

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

    const renderPaginationItems = () => {
        const items = []
        const maxVisible = 5
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
        const endPage = Math.min(totalPages, startPage + maxVisible - 1)

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

    const statusBadge = (s: HubtelPaymentRecord['status']) => {
        if (s === 'success') {
            return <Badge className="bg-green-600 hover:bg-green-600 text-white">Successful</Badge>
        }
        if (s === 'failed') return <Badge variant="destructive">Failed</Badge>
        return <Badge variant="secondary">Pending</Badge>
    }

    const fmtDate = (iso: string) => new Date(iso).toLocaleString()
    const fmtAmount = (a: number | null) => (a == null ? '—' : `GHS ${Number(a).toFixed(2)}`)

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Hubtel Payments</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Every Hubtel payment attempt across wallet, storefront, data, results checker
                    and USSD — including the ones that failed.
                </p>
            </div>

            <Card>
                <CardHeader className="space-y-3">
                    <CardTitle className="text-base">
                        {loading ? 'Loading…' : `${totalCount} record${totalCount === 1 ? '' : 's'}`}
                    </CardTitle>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Reference, phone or Hubtel ID…"
                            className="lg:col-span-2"
                        />
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="success">Successful</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={flow} onValueChange={setFlow}>
                            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All types</SelectItem>
                                {FILTERABLE_FLOWS.map((value) => (
                                    <SelectItem key={value} value={value}>{FLOW_LABELS[value]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                aria-label="From date"
                            />
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                aria-label="To date"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : records.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                            No payment records match these filters.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                        <th className="py-2 pr-4 font-medium">Date</th>
                                        <th className="py-2 pr-4 font-medium">Reference</th>
                                        <th className="py-2 pr-4 font-medium">Type</th>
                                        <th className="py-2 pr-4 font-medium">Phone</th>
                                        <th className="py-2 pr-4 font-medium">Amount</th>
                                        <th className="py-2 pr-4 font-medium">Status</th>
                                        <th className="py-2 pr-4 font-medium">Hubtel Txn ID</th>
                                        <th className="py-2 font-medium">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((r) => (
                                        <tr key={r.id} className="border-b last:border-0">
                                            <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                                            <td className="py-2 pr-4 font-mono text-xs">{r.client_reference}</td>
                                            <td className="py-2 pr-4 whitespace-nowrap">
                                                {FLOW_LABELS[r.flow || 'unknown'] || r.flow}
                                            </td>
                                            <td className="py-2 pr-4 font-mono">{r.payer_msisdn || '—'}</td>
                                            <td className="py-2 pr-4 whitespace-nowrap">{fmtAmount(r.amount)}</td>
                                            <td className="py-2 pr-4">{statusBadge(r.status)}</td>
                                            <td className="py-2 pr-4 font-mono text-xs">{r.transaction_id || '—'}</td>
                                            <td
                                                className="py-2 max-w-[22rem] truncate text-muted-foreground"
                                                title={r.message || ''}
                                            >
                                                {r.message || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-2">
                    <p className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                        {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} records
                    </p>
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                />
                            </PaginationItem>
                            {renderPaginationItems()}
                            <PaginationItem>
                                <PaginationNext
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
