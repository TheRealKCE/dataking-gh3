'use client'

import { useEffect, useState } from 'react'
import { Gift, Loader2, AlertCircle, Users, History } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ReferralShareCard } from '@/components/dashboard/ReferralShareCard'
import { ReferralStats } from '@/components/dashboard/ReferralStats'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Summary {
    code: string | null
    shareUrl: string | null
    referredCount: number
    activeCount: number
    totalEarned: number
    bonusCount: number
    enabled: boolean
    percentOfSale: number
}

interface ReferredUser {
    id: string
    name: string
    joinedAt: string
    status: string
    earningOrders: number
    earned: number
}

interface BonusRow {
    id: string
    createdAt: string
    orderReference: string
    amount: number
    reversed: boolean
    reversedAmount: number | null
}

const PAGE_SIZE = 20

export default function ReferPage() {
    const [summary, setSummary] = useState<Summary | null>(null)
    const [referred, setReferred] = useState<ReferredUser[]>([])
    const [bonuses, setBonuses] = useState<BonusRow[]>([])
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        fetch(`/api/referrals/me?limit=${PAGE_SIZE}`)
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Failed to load')
                return r.json()
            })
            .then((data) => {
                setSummary(data.summary)
                setReferred(data.referred || [])
                setBonuses(data.bonuses || [])
                setHasMore(!!data.hasMore)
            })
            .catch((e) => setError(e.message || 'Could not load your referral details'))
            .finally(() => setLoading(false))
    }, [])

    const loadMore = async () => {
        setLoadingMore(true)
        try {
            const r = await fetch(`/api/referrals/me?limit=${PAGE_SIZE}&offset=${bonuses.length}`)
            if (r.ok) {
                const data = await r.json()
                setBonuses((prev) => [...prev, ...(data.bonuses || [])])
                setHasMore(!!data.hasMore)
            }
        } finally {
            setLoadingMore(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error || !summary) {
        return (
            <Alert variant="destructive" className="rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error || 'Could not load your referral details'}</AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-5 max-w-3xl">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Refer &amp; Earn</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Invite friends and earn every time they buy data.
                </p>
            </div>

            {!summary.enabled && (
                <Alert className="rounded-xl border-amber-500/30 bg-amber-500/10">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Referral bonuses are paused right now. Your code still works and anything you have
                        already earned stays in your wallet.
                    </AlertDescription>
                </Alert>
            )}

            {summary.code && summary.shareUrl ? (
                <ReferralShareCard
                    code={summary.code}
                    shareUrl={summary.shareUrl}
                    percentOfSale={summary.percentOfSale}
                    enabled={summary.enabled}
                />
            ) : (
                <Alert className="rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                        Your referral code is still being set up. Please check back shortly.
                    </AlertDescription>
                </Alert>
            )}

            <ReferralStats
                referredCount={summary.referredCount}
                totalEarned={summary.totalEarned}
                bonusCount={summary.bonusCount}
            />

            {/* How it works. The rate is shown as "up to" because a margin cap can
                reduce it on thin-margin bundles — see the migration header. */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Gift className="w-4 h-4 text-indigo-500" />
                        How it works
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <ol className="text-xs sm:text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                        <li>Share your link or code with friends.</li>
                        <li>They sign up using it — their prices stay exactly the same.</li>
                        <li>
                            You earn up to <strong className="text-foreground">{summary.percentOfSale}%</strong> of
                            every data purchase they make, for as long as they keep buying.
                        </li>
                        <li>Bonuses land straight in your wallet, ready to spend on data.</li>
                    </ol>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        Your Referrals ({referred.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    {referred.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                            Nobody yet. Share your link to get started.
                        </p>
                    ) : (
                        <div className="divide-y divide-border">
                            {referred.map((r) => (
                                <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                            {r.name}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Joined {formatDate(r.joinedAt)}
                                            {r.status !== 'active' && (
                                                <span className="ml-2 text-amber-600 font-semibold">
                                                    &middot; under review
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(r.earned)}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {r.earningOrders} order{r.earningOrders === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <History className="w-4 h-4 text-muted-foreground" />
                        Bonus History
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    {bonuses.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                            No bonuses yet.
                        </p>
                    ) : (
                        <>
                            <div className="divide-y divide-border">
                                {bonuses.map((b) => (
                                    <div key={b.id} className="flex items-center justify-between gap-3 py-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-mono text-gray-900 dark:text-gray-100 truncate">
                                                {b.orderReference}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                {formatDate(b.createdAt)}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p
                                                className={
                                                    b.reversed
                                                        ? 'text-sm font-bold text-muted-foreground line-through'
                                                        : 'text-sm font-bold text-emerald-600 dark:text-emerald-400'
                                                }
                                            >
                                                +{formatCurrency(b.amount)}
                                            </p>
                                            {b.reversed && (
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
                                                    Reversed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {hasMore && (
                                <Button
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    variant="outline"
                                    className="w-full mt-4 h-10 text-xs"
                                >
                                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load more'}
                                </Button>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
