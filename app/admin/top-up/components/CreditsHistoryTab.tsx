'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Loader2, Search, TrendingUp, Banknote, Hash,
    Plus, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, X
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'

type FilterType = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all'

const FILTERS: { value: FilterType; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'all', label: 'All Time' },
]

const ROLE_COLORS: Record<string, string> = {
    agent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    customer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    subadmin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

interface Transaction {
    id: string
    user_id: string
    amount: number
    description: string
    created_at: string
    first_name: string
    last_name: string
    phone_number: string
    role: string
    linked_debt: {
        status: string
        amount_owed: number
        amount_settled: number
    } | null
}

function AddDebtPopover({ tx, onDone }: { tx: Transaction; onDone: () => void }) {
    const [amount, setAmount] = useState(String(tx.amount))
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async () => {
        const amt = parseFloat(amount)
        if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
        setLoading(true)
        try {
            const res = await fetch('/api/admin/top-up/manual-debt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: tx.user_id,
                    amount: amt,
                    notes: notes || undefined,
                    linkedTransactionId: tx.id,
                })
            })
            const data = await res.json()
            if (!res.ok) { toast.error(data.error || 'Failed'); return }
            toast.success('✅ Debt record created! Check Settlements tab.')
            onDone()
        } catch { toast.error('Network error') }
        finally { setLoading(false) }
    }

    return (
        <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                ➕ Create Manual Debt Record
            </p>
            <p className="text-[11px] text-muted-foreground">
                This will mark the user as owing money without touching their wallet balance.
            </p>
            <div className="flex gap-2">
                <Input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-28 h-8 text-sm"
                    placeholder="Amount"
                    min="0"
                />
                <Input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    placeholder="Note (optional)…"
                />
            </div>
            <div className="flex gap-2">
                <Button size="sm" onClick={handleSubmit} disabled={loading}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7">
                    {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                    Confirm Debt
                </Button>
                <Button size="sm" variant="ghost" onClick={onDone} className="text-xs h-7">
                    <X className="w-3 h-3 mr-1" /> Cancel
                </Button>
            </div>
        </div>
    )
}

function TransactionRow({ tx, onDebtAdded }: { tx: Transaction; onDebtAdded: () => void }) {
    const [expanded, setExpanded] = useState(false)
    const initials = `${tx.first_name[0] || '?'}${tx.last_name[0] || ''}`.toUpperCase()
    const hasLinkedDebt = !!tx.linked_debt
    const isUnpaid = hasLinkedDebt && tx.linked_debt!.status !== 'settled'

    return (
        <div className={cn(
            'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 transition-all',
            isUnpaid && 'border-l-4 border-l-amber-400'
        )}>
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={cn(
                    'w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm',
                    isUnpaid ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                )}>
                    {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{tx.first_name} {tx.last_name}</span>
                        <Badge className={cn('text-[10px] px-1.5 py-0', ROLE_COLORS[tx.role] || ROLE_COLORS.customer)}>
                            {tx.role}
                        </Badge>
                        {isUnpaid && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                Unpaid debt
                            </Badge>
                        )}
                        {hasLinkedDebt && !isUnpaid && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">Settled</Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{tx.phone_number}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{tx.description}</p>
                </div>

                {/* Amount + time */}
                <div className="text-right flex-shrink-0">
                    <p className={cn('font-black text-base', isUnpaid ? 'text-amber-600' : 'text-emerald-600')}>
                        +{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        {format(new Date(tx.created_at), 'dd MMM, HH:mm')}
                    </p>
                </div>
            </div>

            {/* Action Row */}
            {!hasLinkedDebt && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpanded(prev => !prev)}
                        className="text-xs h-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Debt
                        {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                    </Button>
                </div>
            )}

            {expanded && (
                <AddDebtPopover tx={tx} onDone={() => { setExpanded(false); onDebtAdded() }} />
            )}
        </div>
    )
}

export function CreditsHistoryTab() {
    const [filter, setFilter] = useState<FilterType>('today')
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [totalCredited, setTotalCredited] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const fetchHistory = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/top-up/credits-history?filter=${filter}`)
            if (res.ok) {
                const data = await res.json()
                setTransactions(data.transactions || [])
                setTotalCredited(data.totalCredited || 0)
                setTotalCount(data.totalCount || 0)
            }
        } catch { /* silent */ }
        finally { setLoading(false) }
    }, [filter])

    useEffect(() => { fetchHistory() }, [fetchHistory])

    const filtered = transactions.filter(tx => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return [tx.first_name, tx.last_name, tx.phone_number, tx.description]
            .some(v => v?.toLowerCase().includes(q))
    })

    const avgAmount = totalCount > 0 ? totalCredited / totalCount : 0
    const unpaidCount = filtered.filter(tx => tx.linked_debt && tx.linked_debt.status !== 'settled').length

    return (
        <div className="space-y-4">
            {/* Tip */}
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3">
                📋 <strong>Credits History</strong> — all admin-credited top-ups. Use <strong>Add Debt</strong> to retroactively mark a top-up as unpaid (wallet balance stays unchanged).
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                            filter === f.value
                                ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white shadow'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-slate-400'
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Summary Stats */}
            {!loading && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { icon: Banknote, label: 'Total Credited', value: formatCurrency(totalCredited), color: 'text-emerald-600' },
                        { icon: Hash, label: 'Top-Ups', value: String(totalCount), color: 'text-blue-600' },
                        { icon: TrendingUp, label: 'Avg Amount', value: formatCurrency(avgAmount), color: 'text-amber-600' },
                    ].map(card => (
                        <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-center">
                            <card.icon className={cn('w-4 h-4 mx-auto mb-1', card.color)} />
                            <p className={cn('text-base font-black', card.color)}>{card.value}</p>
                            <p className="text-[10px] text-muted-foreground">{card.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name, phone, or description…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search credits history"
                    className="pl-9"
                />
            </div>

            {/* Status indicator */}
            {unpaidCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span><strong>{unpaidCount}</strong> top-up{unpaidCount > 1 ? 's' : ''} in this period have outstanding debt records.</span>
                </div>
            )}

            {/* Transaction List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground">
                    <Banknote className="w-14 h-14 mx-auto mb-3 opacity-20" />
                    <p className="font-semibold">No top-ups found</p>
                    <p className="text-xs mt-1">
                        {search ? `No results for "${search}"` : `No admin top-ups in the selected period.`}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(tx => (
                        <TransactionRow key={tx.id} tx={tx} onDebtAdded={fetchHistory} />
                    ))}
                </div>
            )}
        </div>
    )
}
