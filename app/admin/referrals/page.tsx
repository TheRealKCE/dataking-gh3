'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, RefreshCw, AlertCircle, Gift } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Party {
    id: string
    name: string
    email: string | null
}

interface ReferralRow {
    id: string
    codeUsed: string
    status: string
    flagReason: string | null
    source: string
    claimedAt: string
    reviewedAt: string | null
    referrer: Party
    referred: Party
    lifetimePaid: number
}

interface Stats {
    monthToDate: number
    total: number
    capped: number
    cappedPct: number
}

const STATUS_FILTERS = ['all', 'active', 'flagged', 'blocked'] as const

export default function AdminReferralsPage() {
    const [rows, setRows] = useState<ReferralRow[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [reconciling, setReconciling] = useState(false)
    const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('all')
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const qs = filter === 'all' ? '' : `?status=${filter}`
            const r = await fetch(`/api/admin/referrals${qs}`)
            if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Failed to load')
            const data = await r.json()
            setRows(data.referrals || [])
            setStats(data.stats || null)
        } catch (e: any) {
            setError(e.message || 'Failed to load referrals')
        } finally {
            setLoading(false)
        }
    }, [filter])

    useEffect(() => {
        load()
    }, [load])

    const setStatus = async (id: string, status: string) => {
        setBusyId(id)
        try {
            const r = await fetch('/api/admin/referrals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            })
            if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Update failed')
            toast.success(`Referral marked ${status}`)
            await load()
        } catch (e: any) {
            toast.error(e.message || 'Update failed')
        } finally {
            setBusyId(null)
        }
    }

    const reconcile = async () => {
        setReconciling(true)
        try {
            const r = await fetch('/api/admin/referrals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reconcile' }),
            })
            const data = await r.json()
            if (!r.ok) throw new Error(data?.error || 'Reconcile failed')
            toast.success(`Examined ${data.examined}, credited ${data.credited}`)
            await load()
        } catch (e: any) {
            toast.error(e.message || 'Reconcile failed')
        } finally {
            setReconciling(false)
        }
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <Gift className="w-5 h-5 text-indigo-500" />
                        Referrals
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Who referred whom, what it has paid, and anything flagged for review.
                    </p>
                </div>
                <Button onClick={reconcile} disabled={reconciling} variant="outline" className="gap-2">
                    {reconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Reconcile now
                </Button>
            </div>

            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xl font-bold">{formatCurrency(stats.monthToDate)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Paid this month</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xl font-bold">{stats.total}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Bonuses paid (all time)</p>
                        </CardContent>
                    </Card>
                    <Card className={stats.cappedPct > 50 ? 'border-amber-500/40 bg-amber-500/5' : ''}>
                        <CardContent className="p-4">
                            <p className="text-xl font-bold">{stats.cappedPct}%</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Hit the margin cap ({stats.capped} of {stats.total})
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* The honest-advertising check. If the cap fires on most orders, users are
                being promised a rate the system routinely does not pay. The fix is to
                LOWER the advertised rate — widening the cap is what would break the
                guarantee that the platform stays net-positive on every bonus. */}
            {stats && stats.total > 10 && stats.cappedPct > 50 && (
                <Alert className="rounded-xl border-amber-500/30 bg-amber-500/10">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                        The margin cap is reducing <strong>{stats.cappedPct}%</strong> of bonuses, so most users
                        are earning less than the advertised rate. Consider lowering
                        <strong> Bonus Rate (% of sale)</strong> in Settings rather than raising the cap.
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((s) => (
                    <Button
                        key={s}
                        size="sm"
                        variant={filter === s ? 'default' : 'outline'}
                        onClick={() => setFilter(s)}
                        className="capitalize text-xs"
                    >
                        {s}
                    </Button>
                ))}
            </div>

            {error && (
                <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold">Referrals ({rows.length})</CardTitle>
                    <CardDescription className="text-xs">
                        Flagged referrals are attributed but earn nothing until you mark them active.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : rows.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No referrals found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border text-left text-muted-foreground">
                                        <th className="py-2 pr-3 font-semibold">Referrer</th>
                                        <th className="py-2 pr-3 font-semibold">Referred</th>
                                        <th className="py-2 pr-3 font-semibold">Code</th>
                                        <th className="py-2 pr-3 font-semibold">Status</th>
                                        <th className="py-2 pr-3 font-semibold text-right">Paid</th>
                                        <th className="py-2 pr-3 font-semibold">Joined</th>
                                        <th className="py-2 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.id} className="border-b border-border/50 align-top">
                                            <td className="py-2.5 pr-3">
                                                <p className="font-semibold">{r.referrer.name}</p>
                                                <p className="text-muted-foreground truncate max-w-[160px]">
                                                    {r.referrer.email}
                                                </p>
                                            </td>
                                            <td className="py-2.5 pr-3">
                                                <p className="font-semibold">{r.referred.name}</p>
                                                <p className="text-muted-foreground truncate max-w-[160px]">
                                                    {r.referred.email}
                                                </p>
                                            </td>
                                            <td className="py-2.5 pr-3 font-mono">{r.codeUsed}</td>
                                            <td className="py-2.5 pr-3">
                                                <span
                                                    className={
                                                        r.status === 'active'
                                                            ? 'font-bold text-emerald-600'
                                                            : r.status === 'flagged'
                                                                ? 'font-bold text-amber-600'
                                                                : 'font-bold text-red-600'
                                                    }
                                                >
                                                    {r.status}
                                                </span>
                                                {r.flagReason && (
                                                    <p className="text-muted-foreground">{r.flagReason}</p>
                                                )}
                                                <p className="text-muted-foreground">via {r.source}</p>
                                            </td>
                                            <td className="py-2.5 pr-3 text-right font-semibold">
                                                {formatCurrency(r.lifetimePaid)}
                                            </td>
                                            <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">
                                                {formatDate(r.claimedAt)}
                                            </td>
                                            <td className="py-2.5">
                                                <div className="flex gap-1">
                                                    {r.status !== 'active' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-[10px] px-2"
                                                            disabled={busyId === r.id}
                                                            onClick={() => setStatus(r.id, 'active')}
                                                        >
                                                            Approve
                                                        </Button>
                                                    )}
                                                    {r.status !== 'flagged' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-[10px] px-2"
                                                            disabled={busyId === r.id}
                                                            onClick={() => setStatus(r.id, 'flagged')}
                                                        >
                                                            Flag
                                                        </Button>
                                                    )}
                                                    {r.status !== 'blocked' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-[10px] px-2 text-red-600"
                                                            disabled={busyId === r.id}
                                                            onClick={() => setStatus(r.id, 'blocked')}
                                                        >
                                                            Block
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
