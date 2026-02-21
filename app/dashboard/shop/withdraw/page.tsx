'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Banknote, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, Wallet, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ShopWallet {
    id: string
    balance: number
    total_earned: number
    total_withdrawn: number
}

interface WithdrawalRequest {
    id: string
    amount: number
    fee: number
    net_amount: number
    account_name: string
    momo_number: string
    status: 'pending' | 'completed' | 'rejected'
    admin_note: string | null
    created_at: string
}

interface GlobalSettings {
    withdrawal_fee_percent: number
    withdrawal_fee_flat: number
    min_withdrawal_amount: number
}

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
    completed: { label: 'Paid', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
}

export default function ShopWithdrawPage() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()
    const [wallet, setWallet] = useState<ShopWallet | null>(null)
    const [history, setHistory] = useState<WithdrawalRequest[]>([])
    const [settings, setSettings] = useState<GlobalSettings>({ withdrawal_fee_percent: 5, withdrawal_fee_flat: 0, min_withdrawal_amount: 10 })
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [amount, setAmount] = useState('')
    const [accountName, setAccountName] = useState('')
    const [momoNumber, setMomoNumber] = useState('')
    const [shopName, setShopName] = useState('')

    useEffect(() => {
        if (dbUser && !isAdmin && !isSubAdmin && dbUser?.role !== 'agent') {
            router.replace('/dashboard')
            return
        }
        if (dbUser) fetchData()
    }, [dbUser, isAdmin, isSubAdmin])

    const fetchData = async () => {
        try {
            const db = supabase as any
            const [walletRes, historyRes, settingsRes, shopRes] = await Promise.all([
                db.from('shop_wallets').select('*').eq('owner_id', dbUser!.id).single(),
                db.from('shop_wallet_transactions')
                    .select('*')
                    .eq('type', 'withdrawal')
                    .order('created_at', { ascending: false })
                    .limit(20),
                db.from('shop_global_settings').select('*'),
                db.from('shop_profiles')
                    .select('shop_name, withdrawal_fee_percent, withdrawal_fee_flat, min_withdrawal_amount')
                    .eq('owner_id', dbUser!.id)
                    .single(),
            ])

            if (walletRes.data) setWallet(walletRes.data)
            setHistory(historyRes.data || [])
            if (shopRes.data?.shop_name) setShopName(shopRes.data.shop_name)

            // Parse global settings
            if (settingsRes.data) {
                const s: Record<string, any> = {}
                for (const row of settingsRes.data) {
                    s[row.key] = typeof row.value === 'string' ? parseFloat(row.value) : row.value
                }
                setSettings({
                    withdrawal_fee_percent: s.withdrawal_fee_percent || 5,
                    withdrawal_fee_flat: s.withdrawal_fee_flat || 0,
                    min_withdrawal_amount: s.min_withdrawal_amount || 10,
                })

                // Overlay shop-specific overrides
                if (shopRes.data) {
                    const sp = shopRes.data
                    setSettings(prev => ({
                        withdrawal_fee_percent: sp.withdrawal_fee_percent != null ? parseFloat(String(sp.withdrawal_fee_percent)) : prev.withdrawal_fee_percent,
                        withdrawal_fee_flat: sp.withdrawal_fee_flat != null ? parseFloat(String(sp.withdrawal_fee_flat)) : prev.withdrawal_fee_flat,
                        min_withdrawal_amount: sp.min_withdrawal_amount != null ? parseFloat(String(sp.min_withdrawal_amount)) : prev.min_withdrawal_amount,
                    }))
                }
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const amountNum = parseFloat(amount) || 0
    const feePercent = (amountNum * settings.withdrawal_fee_percent) / 100
    const totalFee = feePercent + settings.withdrawal_fee_flat
    const netAmount = amountNum - totalFee

    const handleSubmit = async () => {
        if (!amount || amountNum <= 0) { toast.error('Enter a valid amount'); return }
        if (amountNum < settings.min_withdrawal_amount) { toast.error(`Minimum withdrawal is ${formatCurrency(settings.min_withdrawal_amount)}`); return }
        if (amountNum > (wallet?.balance || 0)) { toast.error('Insufficient shop wallet balance'); return }
        if (!accountName.trim()) { toast.error('Enter the account holder name'); return }
        if (!momoNumber.trim()) { toast.error('Enter your MoMo number'); return }

        setSubmitting(true)
        try {
            const { error } = await (supabase as any).from('shop_wallet_transactions').insert({
                shop_wallet_id: wallet!.id,
                type: 'withdrawal',
                amount: amountNum,
                fee: totalFee,
                net_amount: netAmount,
                account_name: accountName.trim(),
                momo_number: momoNumber.trim(),
                description: `Withdrawal request for ${accountName.trim()} — MoMo: ${momoNumber.trim()}`,
                status: 'pending',
            })
            if (error) throw error

            // Deduct from balance immediately (pending)
            await (supabase as any).from('shop_wallets').update({
                balance: (wallet!.balance - amountNum),
                updated_at: new Date().toISOString(),
            }).eq('id', wallet!.id)

            toast.success('Withdrawal request submitted! Admin will process within 24 hours.')
            setAmount('')
            setAccountName('')
            setMomoNumber('')
            fetchData()

            // Alert 11 — notify admin about new withdrawal request (non-blocking)
            fetch('/api/shop/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'admin_withdrawal_request',
                    payload: {
                        shopName: shopName || 'Unknown Shop',
                        shopId: wallet?.id || '',
                        ownerName: `${dbUser?.first_name || ''} ${dbUser?.last_name || ''}`.trim(),
                        accountName: accountName.trim(),
                        amount: amountNum,
                        momoNumber: momoNumber.trim(),
                        date: new Date().toLocaleString('en-GB'),
                    },
                }),
            }).catch(err => console.warn('[ShopAlert]', err))
        } catch (err: any) {
            toast.error(err.message || 'Failed to submit request')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-40" />
                <Skeleton className="h-64" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Header */}
            <div className="space-y-4">
                <Link href="/dashboard/shop">
                    <Button variant="ghost" size="sm" className="w-fit gap-2 -ml-2 text-muted-foreground hover:text-emerald-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Shop Dashboard
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Banknote className="w-6 h-6 text-emerald-600" />
                        Withdraw Earnings
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Request a payout from your shop wallet to your MoMo number.</p>
                </div>

                {/* Wallet Balance */}
                <Card className="overflow-hidden border-0 shadow-md">
                    <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
                        <div className="flex items-center gap-3 mb-3">
                            <Wallet className="w-5 h-5 text-emerald-200" />
                            <p className="text-emerald-100 text-sm font-medium">Available Balance</p>
                        </div>
                        <p className="text-4xl font-black">{formatCurrency(wallet?.balance || 0)}</p>
                        <div className="flex gap-4 mt-3 text-xs text-emerald-200">
                            <span>Earned: {formatCurrency(wallet?.total_earned || 0)}</span>
                            <span>Withdrawn: {formatCurrency(wallet?.total_withdrawn || 0)}</span>
                        </div>
                    </div>
                </Card>

                {/* Withdrawal Form */}
                <Card>
                    <CardHeader><CardTitle className="text-base">New Withdrawal Request</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="amount">Amount (GHS)</Label>
                            <Input
                                id="amount"
                                type="number"
                                min={settings.min_withdrawal_amount}
                                max={wallet?.balance || 0}
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={`Min: ${formatCurrency(settings.min_withdrawal_amount)}`}
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="accountName">Account Holder Name</Label>
                            <Input
                                id="accountName"
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                placeholder="e.g. John Doe"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="momo">MoMo Number</Label>
                            <Input
                                id="momo"
                                value={momoNumber}
                                onChange={(e) => setMomoNumber(e.target.value)}
                                placeholder="0244123456"
                                className="mt-1"
                            />
                        </div>

                        {/* Fee breakdown */}
                        {amountNum > 0 && (
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Amount Requested</span>
                                    <span className="font-medium">{formatCurrency(amountNum)}</span>
                                </div>
                                <div className="flex justify-between text-red-600 dark:text-red-400">
                                    <span>Fee ({settings.withdrawal_fee_percent}%{settings.withdrawal_fee_flat > 0 ? ` + ${formatCurrency(settings.withdrawal_fee_flat)}` : ''})</span>
                                    <span>- {formatCurrency(totalFee)}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t pt-1.5 mt-1">
                                    <span>You Receive</span>
                                    <span className="text-emerald-600">{formatCurrency(Math.max(0, netAmount))}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>Withdrawals are processed manually within 24 hours. A fee is deducted from your requested amount.</span>
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={submitting || !amount || amountNum <= 0 || amountNum > (wallet?.balance || 0)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 font-semibold gap-2"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                            {submitting ? 'Submitting...' : 'Request Withdrawal'}
                        </Button>
                    </CardContent>
                </Card>

                {/* History */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Withdrawal History</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        {history.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No withdrawal requests yet.</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-xs text-muted-foreground">
                                                <th className="text-left px-4 py-2 font-medium">Date</th>
                                                <th className="text-right px-4 py-2 font-medium">Amount</th>
                                                <th className="text-right px-4 py-2 font-medium">Fee</th>
                                                <th className="text-right px-4 py-2 font-medium">Net</th>
                                                <th className="text-left px-4 py-2 font-medium">Account</th>
                                                <th className="text-left px-4 py-2 font-medium">MoMo</th>
                                                <th className="text-left px-4 py-2 font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {history.map((row) => {
                                                const cfg = statusConfig[row.status]
                                                const Icon = cfg.icon
                                                return (
                                                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                                            {new Date(row.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                                                        <td className="px-4 py-3 text-right text-red-500 text-xs">-{formatCurrency(row.fee)}</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(row.net_amount)}</td>
                                                        <td className="px-4 py-3 text-xs">{row.account_name}</td>
                                                        <td className="px-4 py-3 font-mono text-xs">{row.momo_number}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                                                                <Icon className="w-3 h-3" />
                                                                {cfg.label}
                                                            </span>
                                                            {row.admin_note && row.status === 'rejected' && (
                                                                <p className="text-xs text-red-500 mt-0.5">{row.admin_note}</p>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="md:hidden divide-y">
                                    {history.map((row) => {
                                        const cfg = statusConfig[row.status]
                                        const Icon = cfg.icon
                                        return (
                                            <div key={row.id} className="p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-0.5">
                                                        <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</p>
                                                        <p className="font-semibold text-emerald-600">{formatCurrency(row.net_amount)}</p>
                                                        <p className="text-[10px] text-muted-foreground">Original: {formatCurrency(row.amount)} (Fee: {formatCurrency(row.fee)})</p>
                                                    </div>
                                                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.color)}>
                                                        <Icon className="w-2.5 h-2.5" />
                                                        {cfg.label.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2 rounded-lg">
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Account</p>
                                                        <p className="font-medium truncate">{row.account_name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">MoMo Number</p>
                                                        <p className="font-mono">{row.momo_number}</p>
                                                    </div>
                                                </div>
                                                {row.admin_note && row.status === 'rejected' && (
                                                    <div className="p-2 bg-red-50 border border-red-100 rounded text-[10px] text-red-600">
                                                        <strong>Admin Note:</strong> {row.admin_note}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
