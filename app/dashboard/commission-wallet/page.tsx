'use client'

/**
 * Commission Wallet — what a Commission Services partner has earned on bill payments.
 *
 * Lived as a card inside /dashboard/developer-api until it got its own sidebar entry.
 * Earnings are credited by lib/commission-earning when a bill paid with a Commission
 * Services key completes: the partner receives `share_percent` of the commission the
 * provider paid ARHMS on that order. Airtime and data earn nothing here.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Coins, Percent, RefreshCw, Receipt, ArrowRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Wallet {
    balance: number
    total_earned: number
    total_withdrawn: number
    currency: string
}

interface CommissionTx {
    id: string
    source: string | null
    amount: number
    description: string | null
    reference: string | null
    created_at: string
}

const ghs = (n: number) => `GHS ${Number(n || 0).toFixed(2)}`

export default function CommissionWalletPage() {
    const [wallet, setWallet] = useState<Wallet | null>(null)
    const [transactions, setTransactions] = useState<CommissionTx[]>([])
    const [sharePercent, setSharePercent] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/user/commission-wallet', { cache: 'no-store' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Could not load your commission wallet')
            setWallet(json.wallet ?? null)
            setTransactions(json.transactions ?? [])
            setSharePercent(typeof json.share_percent === 'number' ? json.share_percent : null)
        } catch (e: any) {
            setError(e?.message || 'Could not load your commission wallet')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight">Commission Wallet</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        What you have earned on bill payments made with your Commission Services key.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={load} disabled={loading} className="shrink-0">
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                    {error}
                </div>
            )}

            {/* Balances */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { label: 'Available', value: wallet?.balance },
                    { label: 'Total earned', value: wallet?.total_earned },
                    { label: 'Withdrawn', value: wallet?.total_withdrawn },
                ].map(stat => (
                    <Card key={stat.label}>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                            {loading && !wallet
                                ? <Skeleton className="h-7 w-28 mt-1" />
                                : <p className="text-2xl font-black tabular-nums mt-0.5">{ghs(stat.value ?? 0)}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* How it is earned */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Percent className="w-4 h-4" /> How you earn
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                        Every bill you pay through the API with your Commission Services key earns a commission from
                        the provider. You receive{' '}
                        <strong className="text-foreground">
                            {sharePercent === null ? 'a share' : `${sharePercent}%`}
                        </strong>{' '}
                        of it, credited here once the bill completes.
                    </p>
                    <p>
                        Bills are paid at face value. Failed or refunded bills earn nothing, and data, airtime and AFA
                        orders do not earn commission.
                    </p>
                    <Link
                        href="/dashboard/developer-api"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
                    >
                        Manage your Commission Services key <ArrowRight className="w-3 h-3" />
                    </Link>
                </CardContent>
            </Card>

            {/* Earnings history */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Coins className="w-4 h-4" /> Recent earnings
                    </CardTitle>
                    <CardDescription>The last 20 commissions credited to this wallet.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading && transactions.length === 0 ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-8 text-center">
                            <Receipt className="w-9 h-9 mx-auto text-muted-foreground/50 mb-2" />
                            <p className="text-sm font-medium">No commission yet</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Your first earning appears here once a bill paid with your Commission Services key completes.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/60">
                            {transactions.map(tx => (
                                <div key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{tx.description || 'Commission'}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {formatDate(tx.created_at)}
                                            {tx.reference ? ` · ${tx.reference}` : ''}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                        +{ghs(tx.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
