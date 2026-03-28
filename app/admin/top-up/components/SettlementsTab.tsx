'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, MessageSquare, CheckCircle2, Search } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { formatDistanceToNow, differenceInDays } from 'date-fns'
import { toast } from 'sonner'

interface Settlement {
    id: string
    user_id: string
    amount_owed: number
    amount_settled: number
    remaining: number
    status: string
    created_at: string
    notes: string | null
    first_name?: string
    last_name?: string
    phone_number?: string
}

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    partially_settled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    settled: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    partially_settled: 'Partial',
    settled: 'Settled',
}

const PAYMENT_METHODS = ['MoMo', 'Cash', 'Bank Transfer', 'Other']

export function SettlementsTab({ onDebtChange }: { onDebtChange: () => void }) {
    const [settlements, setSettlements] = useState<Settlement[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [settling, setSettling] = useState<Record<string, boolean>>({})
    const [payAmounts, setPayAmounts] = useState<Record<string, string>>({})
    const [payMethods, setPayMethods] = useState<Record<string, string>>({})
    const [sendingSms, setSendingSms] = useState<Record<string, boolean>>({})
    const [settled, setSettled] = useState<Set<string>>(new Set())

    const fetchSettlements = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/top-up/settlements')
            if (res.ok) {
                const data = await res.json()
                setSettlements(data.settlements || [])
                // Pre-fill pay amounts with remaining
                const amounts: Record<string, string> = {}
                const methods: Record<string, string> = {}
                for (const s of data.settlements || []) {
                    amounts[s.id] = String((s.amount_owed - s.amount_settled).toFixed(2))
                    methods[s.id] = 'MoMo'
                }
                setPayAmounts(amounts)
                setPayMethods(methods)
            }
        } catch { /* silent */ } finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchSettlements() }, [fetchSettlements])

    const handleSettle = async (s: Settlement) => {
        const payAmt = parseFloat(payAmounts[s.id] || '0')
        if (!payAmt || payAmt <= 0) { toast.error('Enter a valid payment amount'); return }

        setSettling(prev => ({ ...prev, [s.id]: true }))
        try {
            const res = await fetch('/api/admin/top-up/settle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settlementId: s.id,
                    paymentAmount: payAmt,
                    paymentMethod: payMethods[s.id] || 'MoMo',
                })
            })
            const data = await res.json()
            if (!res.ok) { toast.error(data.error || 'Settlement failed'); return }

            if (data.isFullySettled) {
                toast.success(`✅ Debt fully settled!`)
                setSettled(prev => new Set([...prev, s.id]))
                setTimeout(() => {
                    setSettlements(prev => prev.filter(x => x.id !== s.id))
                    setSettled(prev => { const n = new Set(prev); n.delete(s.id); return n })
                    onDebtChange()
                }, 1200)
            } else {
                toast.success(`Partial payment of GHS ${payAmt.toFixed(2)} recorded. GHS ${data.remaining.toFixed(2)} still owed.`)
                fetchSettlements()
                onDebtChange()
            }
        } catch { toast.error('Network error') } finally {
            setSettling(prev => ({ ...prev, [s.id]: false }))
        }
    }

    const handleSmsReminder = async (s: Settlement) => {
        setSendingSms(prev => ({ ...prev, [s.id]: true }))
        try {
            const res = await fetch('/api/admin/top-up/sms-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: s.user_id, amount: s.amount_owed - s.amount_settled })
            })
            const data = await res.json()
            if (data.success) toast.success('SMS reminder sent!')
            else toast.error('SMS failed: ' + (data.error || 'Unknown error'))
        } catch { toast.error('Network error') } finally {
            setSendingSms(prev => ({ ...prev, [s.id]: false }))
        }
    }

    const filtered = settlements.filter(s => {
        if (!search) return true
        const q = search.toLowerCase()
        return [s.first_name, s.last_name, s.phone_number].some(v => v?.toLowerCase().includes(q))
    })

    if (loading) {
        return (
            <div className="flex justify-center items-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (filtered.length === 0 && !search) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-green-500 opacity-70" />
                <p className="text-lg font-bold text-green-600">All clear!</p>
                <p className="text-sm">No outstanding debts. 🎉</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Tip */}
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
                💡 <strong>Tip:</strong> Enter the full amount for one-click full settlement, or a lower amount to record a partial payment.
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search by user name or phone…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* List */}
            <div className="space-y-3">
                {filtered.map(s => {
                    const remaining = s.amount_owed - s.amount_settled
                    const daysOverdue = differenceInDays(new Date(), new Date(s.created_at))
                    const isSettled = settled.has(s.id)

                    return (
                        <div
                            key={s.id}
                            className={cn(
                                'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 transition-all duration-500',
                                isSettled && 'bg-green-50 dark:bg-green-900/20 border-green-300 opacity-60'
                            )}
                        >
                            {/* User Info Row */}
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold">{s.first_name} {s.last_name}</span>
                                        <Badge className={STATUS_STYLES[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                                        {daysOverdue > 7 && (
                                            <Badge className="bg-red-100 text-red-700 text-[10px]">{daysOverdue}d overdue</Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{s.phone_number}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Created {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                                        {s.notes && ` · ${s.notes}`}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Owed / Settled</p>
                                    <p className="font-bold">{formatCurrency(s.amount_owed)} / {formatCurrency(s.amount_settled)}</p>
                                    <p className={cn('text-sm font-black', remaining > 0 ? 'text-amber-600' : 'text-green-600')}>
                                        Rem: {formatCurrency(remaining)}
                                    </p>
                                </div>
                            </div>

                            {/* Settlement Row */}
                            {!isSettled && s.status !== 'settled' && (
                                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        value={payAmounts[s.id] || ''}
                                        onChange={e => setPayAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                                        className="w-28 text-sm"
                                        placeholder="Amount"
                                        min="0"
                                        max={remaining}
                                    />
                                    <select
                                        value={payMethods[s.id] || 'MoMo'}
                                        onChange={e => setPayMethods(prev => ({ ...prev, [s.id]: e.target.value }))}
                                        className="text-sm border rounded-lg px-2 py-2 bg-white dark:bg-slate-900 h-10"
                                        title="Select payment method"
                                    >
                                        {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                                    </select>
                                    <Button
                                        size="sm"
                                        onClick={() => handleSettle(s)}
                                        disabled={settling[s.id]}
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold"
                                    >
                                        {settling[s.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                                        Mark Paid
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        title="Send SMS Reminder"
                                        onClick={() => handleSmsReminder(s)}
                                        disabled={sendingSms[s.id]}
                                        className="text-muted-foreground hover:text-blue-600"
                                    >
                                        {sendingSms[s.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
