'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface TrustedNumber {
    msisdn: string
    verified_by: string | null
    verified_at: string
    last_used_at: string | null
    payment_count: number
    revoked_at: string | null
}

/**
 * Admin view of numbers that have completed the one-time payment verification.
 * Since trust never expires, revoking here is the only way to force a number to
 * verify again.
 */
export default function TrustedNumbersPage() {
    const [numbers, setNumbers] = useState<TrustedNumber[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [revoking, setRevoking] = useState<string | null>(null)

    const load = useCallback(async (term: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/trusted-numbers?search=${encodeURIComponent(term)}`)
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Could not load trusted numbers')
                return
            }
            setNumbers(data.numbers || [])
        } catch {
            toast.error('Network error while loading trusted numbers')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const t = setTimeout(() => load(search), 300)
        return () => clearTimeout(t)
    }, [search, load])

    const revoke = async (msisdn: string) => {
        setRevoking(msisdn)
        try {
            const res = await fetch('/api/admin/trusted-numbers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: msisdn }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Could not revoke this number')
                return
            }
            toast.success(data.message || 'Trust revoked.')
            load(search)
        } catch {
            toast.error('Network error while revoking')
        } finally {
            setRevoking(null)
        }
    }

    const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Trusted Payment Numbers</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Numbers that completed the one-time SMS verification. They pay via Hubtel
                    without a code. Revoking forces the next payment to verify again.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {loading ? 'Loading…' : `${numbers.length} number${numbers.length === 1 ? '' : 's'}`}
                    </CardTitle>
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by number…"
                        inputMode="numeric"
                        className="max-w-xs mt-2"
                    />
                </CardHeader>
                <CardContent>
                    {!loading && numbers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                            No trusted numbers yet.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                        <th className="py-2 pr-4 font-medium">Number</th>
                                        <th className="py-2 pr-4 font-medium">Source</th>
                                        <th className="py-2 pr-4 font-medium">Verified</th>
                                        <th className="py-2 pr-4 font-medium">Last paid</th>
                                        <th className="py-2 pr-4 font-medium">Payments</th>
                                        <th className="py-2 pr-4 font-medium">Status</th>
                                        <th className="py-2 font-medium"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {numbers.map((n) => (
                                        <tr key={n.msisdn} className="border-b last:border-0">
                                            <td className="py-2 pr-4 font-mono">{n.msisdn}</td>
                                            <td className="py-2 pr-4">{n.verified_by ? 'Account' : 'Storefront'}</td>
                                            <td className="py-2 pr-4 whitespace-nowrap">{fmt(n.verified_at)}</td>
                                            <td className="py-2 pr-4 whitespace-nowrap">{fmt(n.last_used_at)}</td>
                                            <td className="py-2 pr-4">{n.payment_count}</td>
                                            <td className="py-2 pr-4">
                                                {n.revoked_at
                                                    ? <Badge variant="destructive">Revoked</Badge>
                                                    : <Badge variant="secondary">Trusted</Badge>}
                                            </td>
                                            <td className="py-2 text-right">
                                                {!n.revoked_at && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={revoking === n.msisdn}
                                                        onClick={() => revoke(n.msisdn)}
                                                    >
                                                        {revoking === n.msisdn ? 'Revoking…' : 'Revoke'}
                                                    </Button>
                                                )}
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
