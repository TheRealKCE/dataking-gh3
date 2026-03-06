'use client'

import { useEffect, useState, useCallback } from 'react'
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
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
    Banknote, Loader2, Clock, CheckCircle2, XCircle, AlertCircle,
    Wallet, ArrowLeft, Star, Trash2, Plus, BookUser, RefreshCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

const NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'] as const
type Network = typeof NETWORKS[number]

const NETWORK_COLORS: Record<Network, string> = {
    'MTN MoMo': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Telecel Cash': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    'AirtelTigo Money': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

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
    network: string | null
    status: 'pending' | 'completed' | 'rejected'
    admin_note: string | null
    created_at: string
    balance_snapshot: number | null
}

interface GlobalSettings {
    withdrawal_fee_percent: number
    withdrawal_fee_flat: number
    min_withdrawal_amount: number
}

interface SavedDetail {
    id: string
    account_name: string
    momo_number: string
    network: Network
    is_default: boolean
}

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
    completed: { label: 'Paid', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
}

// ─────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────

export default function ShopWithdrawPage() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()

    const [wallet, setWallet] = useState<ShopWallet | null>(null)
    const [history, setHistory] = useState<WithdrawalRequest[]>([])
    const [savedDetails, setSavedDetails] = useState<SavedDetail[]>([])
    const [settings, setSettings] = useState<GlobalSettings>({ withdrawal_fee_percent: 5, withdrawal_fee_flat: 0, min_withdrawal_amount: 10 })
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [shopName, setShopName] = useState('')

    // Form state
    const [amount, setAmount] = useState('')
    const [selectedSavedId, setSelectedSavedId] = useState<string>('manual')
    const [network, setNetwork] = useState<Network | ''>('')
    const [accountName, setAccountName] = useState('')
    const [momoNumber, setMomoNumber] = useState('')
    const [saveForLater, setSaveForLater] = useState(false)

    // Saved Details manager modal
    const [savedModalOpen, setSavedModalOpen] = useState(false)
    const [newNetwork, setNewNetwork] = useState<Network | ''>('')
    const [newAccountName, setNewAccountName] = useState('')
    const [newMomoNumber, setNewMomoNumber] = useState('')
    const [addingDetail, setAddingDetail] = useState(false)

    // Resubmit modal
    const [resubmitTarget, setResubmitTarget] = useState<WithdrawalRequest | null>(null)
    const [resubmitSelectedId, setResubmitSelectedId] = useState<string>('manual')
    const [resubmitNetwork, setResubmitNetwork] = useState<Network | ''>('')
    const [resubmitAccountName, setResubmitAccountName] = useState('')
    const [resubmitMomoNumber, setResubmitMomoNumber] = useState('')
    const [resubmitting, setResubmitting] = useState(false)

    useEffect(() => {
        if (dbUser && !isAdmin && !isSubAdmin && dbUser?.role !== 'agent') {
            router.replace('/dashboard')
            return
        }
        if (dbUser) fetchData()
    }, [dbUser, isAdmin, isSubAdmin])

    const fetchData = useCallback(async () => {
        try {
            const db = supabase as any
            const [walletRes, historyRes, settingsRes, shopRes, savedRes] = await Promise.all([
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
                db.from('shop_payment_details')
                    .select('*')
                    .eq('shop_owner_id', dbUser!.id)
                    .order('is_default', { ascending: false }),
            ])

            if (walletRes.data) setWallet(walletRes.data)
            setHistory(historyRes.data || [])
            if (shopRes.data?.shop_name) setShopName(shopRes.data.shop_name)
            setSavedDetails(savedRes.data || [])

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

            // Pre-fill with default payment detail if exists
            const defaultDetail = savedRes.data?.find((d: SavedDetail) => d.is_default)
            if (defaultDetail) {
                setSelectedSavedId(defaultDetail.id)
                setNetwork(defaultDetail.network)
                setAccountName(defaultDetail.account_name)
                setMomoNumber(defaultDetail.momo_number)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [dbUser])

    // When user picks a saved detail in the form
    const handleSavedSelect = (id: string) => {
        setSelectedSavedId(id)
        if (id === 'manual') {
            setNetwork('')
            setAccountName('')
            setMomoNumber('')
        } else {
            const d = savedDetails.find(s => s.id === id)
            if (d) {
                setNetwork(d.network)
                setAccountName(d.account_name)
                setMomoNumber(d.momo_number)
            }
        }
    }

    const amountNum = parseFloat(amount) || 0
    const handleSubmit = async () => {
        const amountNum = parseFloat(amount) || 0
        if (!amount || amountNum <= 0) { toast.error('Enter a valid amount'); return }
        if (amountNum < settings.min_withdrawal_amount) { toast.error(`Minimum withdrawal is ${formatCurrency(settings.min_withdrawal_amount)}`); return }
        if (amountNum > (wallet?.balance || 0)) { toast.error('Insufficient shop wallet balance'); return }
        if (!network) { toast.error('Select a mobile money network'); return }
        if (!accountName.trim()) { toast.error('Enter the account holder name'); return }
        if (!momoNumber.trim()) { toast.error('Enter your MoMo number'); return }

        setSubmitting(true)
        try {
            const res = await fetch('/api/shop/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amountNum,
                    accountName: accountName.trim(),
                    momoNumber: momoNumber.trim(),
                    network: network,
                    saveForLater: saveForLater && selectedSavedId === 'manual'
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to submit request')

            toast.success('Withdrawal request submitted! Admin will process within 24 hours.')
            setAmount('')
            setSaveForLater(false)
            fetchData() // Refresh balances and history

            // Alert admin (non-blocking)
            fetch('/api/shop/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'admin_withdrawal_request',
                    payload: {
                        shopName: shopName || 'Unknown Shop',
                        shopId: wallet?.id || '',
                        ownerName: `${dbUser?.first_name || ''} ${dbUser?.last_name || ''}`.trim(),
                        ownerPhone: (dbUser as any)?.phone || '',
                        accountName: accountName.trim(),
                        amount: amountNum,
                        momoNumber: momoNumber.trim(),
                        network: network,
                        balanceSnapshot: newBalance,
                        date: new Date().toLocaleString('en-GB'),
                        isResubmission: false,
                    },
                }),
            }).catch(err => console.warn('[ShopAlert]', err))
        } catch (err: any) {
            toast.error(err.message || 'Failed to submit request')
        } finally {
            setSubmitting(false)
        }
    }

    // ── Resubmit handler
    const openResubmit = (item: WithdrawalRequest) => {
        setResubmitTarget(item)
        setResubmitSelectedId('manual')
        setResubmitNetwork('')
        setResubmitAccountName('')
        setResubmitMomoNumber('')
    }

    const handleResubmit = async () => {
        if (!resubmitTarget) return
        if (!resubmitNetwork) { toast.error('Select a mobile money network'); return }
        if (!resubmitAccountName.trim()) { toast.error('Enter the account holder name'); return }
        if (!resubmitMomoNumber.trim()) { toast.error('Enter the MoMo number'); return }

        setResubmitting(true)
        try {
            const { error } = await (supabase as any).rpc('resubmit_withdrawal', {
                p_transaction_id: resubmitTarget.id,
                p_account_name:   resubmitAccountName.trim(),
                p_momo_number:    resubmitMomoNumber.trim(),
                p_network:        resubmitNetwork,
            })

            if (error) throw error

            toast.success('Resubmission sent successfully!')
            setResubmitTarget(null)
            fetchData()

            // Alert admin
            fetch('/api/shop/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'admin_withdrawal_request',
                    payload: {
                        shopName: shopName || 'Unknown Shop',
                        shopId: wallet?.id || '',
                        ownerName: `${dbUser?.first_name || ''} ${dbUser?.last_name || ''}`.trim(),
                        ownerPhone: (dbUser as any)?.phone || '',
                        accountName: resubmitAccountName.trim(),
                        amount: resubmitTarget.amount,
                        momoNumber: resubmitMomoNumber.trim(),
                        network: resubmitNetwork,
                        balanceSnapshot: resubmitTarget.balance_snapshot ?? 0,
                        date: new Date().toLocaleString('en-GB'),
                        isResubmission: true,
                    },
                }),
            }).catch(err => console.warn('[ShopAlert]', err))
        } catch (err: any) {
            toast.error(err.message || 'Failed to resubmit')
        } finally {
            setResubmitting(false)
        }
    }

    // ── Saved details CRUD
    const handleAddSavedDetail = async () => {
        if (!newNetwork) { toast.error('Select a network'); return }
        if (!newAccountName.trim()) { toast.error('Enter account name'); return }
        if (!newMomoNumber.trim()) { toast.error('Enter MoMo number'); return }
        if (savedDetails.length >= 5) { toast.error('Maximum of 5 saved details reached'); return }

        setAddingDetail(true)
        try {
            const { error } = await (supabase as any).from('shop_payment_details').insert({
                shop_owner_id: dbUser!.id,
                account_name: newAccountName.trim(),
                momo_number: newMomoNumber.trim(),
                network: newNetwork,
                is_default: savedDetails.length === 0,
            })
            if (error) throw error
            toast.success('Payment detail saved!')
            setNewNetwork('')
            setNewAccountName('')
            setNewMomoNumber('')
            fetchData()
        } catch (err: any) {
            toast.error(err.message || 'Failed to save')
        } finally {
            setAddingDetail(false)
        }
    }

    const handleDeleteSavedDetail = async (id: string) => {
        await (supabase as any).from('shop_payment_details').delete().eq('id', id)
        fetchData()
    }

    const handleSetDefault = async (id: string) => {
        await (supabase as any).from('shop_payment_details').update({ is_default: false }).eq('shop_owner_id', dbUser!.id)
        await (supabase as any).from('shop_payment_details').update({ is_default: true }).eq('id', id)
        fetchData()
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

    const isManual = selectedSavedId === 'manual'

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
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Banknote className="w-6 h-6 text-emerald-600" />
                            Withdraw Earnings
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">Request a payout from your shop wallet to your mobile money account.</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSavedModalOpen(true)}
                        className="gap-2 text-xs shrink-0"
                    >
                        <BookUser className="w-3.5 h-3.5" />
                        Saved Details ({savedDetails.length}/5)
                    </Button>
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
                        {/* Amount */}
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

                        {/* Select saved or manual */}
                        {savedDetails.length > 0 && (
                            <div>
                                <Label>Use Saved Payment Detail</Label>
                                <Select value={selectedSavedId} onValueChange={handleSavedSelect}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select a saved detail or enter manually" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">Enter manually</SelectItem>
                                        {savedDetails.map(d => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.is_default ? '⭐ ' : ''}{d.account_name} — {d.network} ({d.momo_number})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Manual fields */}
                        <div>
                            <Label>Mobile Money Network</Label>
                            <Select value={network} onValueChange={(v) => setNetwork(v as Network)} disabled={!isManual}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select network" />
                                </SelectTrigger>
                                <SelectContent>
                                    {NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="accountName">Account Holder Name</Label>
                            <Input
                                id="accountName"
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                placeholder="e.g. John Doe"
                                className="mt-1"
                                disabled={!isManual}
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
                                disabled={!isManual}
                            />
                        </div>

                        {/* Save for later option */}
                        {isManual && savedDetails.length < 5 && (
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
                                <input
                                    type="checkbox"
                                    checked={saveForLater}
                                    onChange={e => setSaveForLater(e.target.checked)}
                                    className="accent-emerald-600 w-4 h-4"
                                />
                                Save these payment details for next time
                            </label>
                        )}

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
                                                <th className="text-left px-4 py-2 font-medium">Network / MoMo</th>
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
                                                        <td className="px-4 py-3">
                                                            {row.network && (
                                                                <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-0.5', NETWORK_COLORS[row.network as Network] || 'bg-gray-100 text-gray-700')}>
                                                                    {row.network}
                                                                </span>
                                                            )}
                                                            <p className="font-mono text-xs text-muted-foreground">{row.momo_number}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                                                                <Icon className="w-3 h-3" />
                                                                {cfg.label}
                                                            </span>
                                                            {row.admin_note && row.status === 'rejected' && (
                                                                <div className="mt-1 space-y-1">
                                                                    <p className="text-xs text-red-500">{row.admin_note}</p>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 text-xs border-emerald-500 text-emerald-600 gap-1"
                                                                        onClick={() => openResubmit(row)}
                                                                    >
                                                                        <RefreshCcw className="w-3 h-3" /> Resubmit
                                                                    </Button>
                                                                </div>
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
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Network</p>
                                                        {row.network ? (
                                                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', NETWORK_COLORS[row.network as Network] || 'bg-gray-100 text-gray-700')}>
                                                                {row.network}
                                                            </span>
                                                        ) : <p className="text-[10px] text-muted-foreground">—</p>}
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">MoMo Number</p>
                                                        <p className="font-mono">{row.momo_number}</p>
                                                    </div>
                                                </div>
                                                {row.admin_note && row.status === 'rejected' && (
                                                    <div className="space-y-2">
                                                        <div className="p-2 bg-red-50 border border-red-100 rounded text-[10px] text-red-600">
                                                            <strong>Admin Note:</strong> {row.admin_note}
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="w-full h-9 border-emerald-500 text-emerald-600 gap-2"
                                                            onClick={() => openResubmit(row)}
                                                        >
                                                            <RefreshCcw className="w-3.5 h-3.5" /> Edit Details & Resubmit
                                                        </Button>
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

            {/* ── Saved Payment Details Modal */}
            <Dialog open={savedModalOpen} onOpenChange={setSavedModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookUser className="w-4 h-4 text-emerald-600" />
                            Saved Payment Details
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {savedDetails.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No saved details yet.</p>
                        )}
                        {savedDetails.map(d => (
                            <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                                <div className="space-y-0.5">
                                    <p className="font-semibold text-sm">{d.account_name}</p>
                                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', NETWORK_COLORS[d.network])}>{d.network}</span>
                                    <p className="font-mono text-xs text-muted-foreground mt-0.5">{d.momo_number}</p>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className={cn('h-7 w-7', d.is_default ? 'text-yellow-500' : 'text-muted-foreground')}
                                        onClick={() => handleSetDefault(d.id)}
                                        title={d.is_default ? 'Default' : 'Set as default'}
                                    >
                                        <Star className="w-4 h-4" fill={d.is_default ? 'currentColor' : 'none'} />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-red-500 hover:text-red-700"
                                        onClick={() => handleDeleteSavedDetail(d.id)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {savedDetails.length < 5 && (
                        <div className="border-t pt-4 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add New Detail</p>
                            <Select value={newNetwork} onValueChange={v => setNewNetwork(v as Network)}>
                                <SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger>
                                <SelectContent>
                                    {NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Input placeholder="Account holder name" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} />
                            <Input placeholder="MoMo number" value={newMomoNumber} onChange={e => setNewMomoNumber(e.target.value)} />
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                onClick={handleAddSavedDetail}
                                disabled={addingDetail}
                            >
                                {addingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Save Detail
                            </Button>
                        </div>
                    )}
                    {savedDetails.length >= 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">Maximum of 5 saved details reached. Delete one to add more.</p>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSavedModalOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Resubmit Modal */}
            <Dialog open={!!resubmitTarget} onOpenChange={open => !open && setResubmitTarget(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RefreshCcw className="w-4 h-4 text-emerald-600" />
                            Edit Details & Resubmit
                        </DialogTitle>
                    </DialogHeader>

                    {resubmitTarget && (
                        <div className="space-y-4">
                            {/* Show original rejection reason */}
                            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-sm">
                                <p className="font-semibold text-red-700 dark:text-red-400 text-xs uppercase tracking-wide mb-1">Rejection Reason</p>
                                <p className="text-red-600 dark:text-red-300">{resubmitTarget.admin_note}</p>
                            </div>

                            <div className="p-3 bg-muted/40 rounded-xl text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-xs">Amount (locked)</span>
                                    <span className="font-bold">{formatCurrency(resubmitTarget.amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-xs">You Receive</span>
                                    <span className="font-bold text-emerald-600">{formatCurrency(resubmitTarget.net_amount)}</span>
                                </div>
                            </div>

                            {/* Saved selector */}
                            {savedDetails.length > 0 && (
                                <div>
                                    <Label>Use Saved Detail</Label>
                                    <Select value={resubmitSelectedId} onValueChange={id => {
                                        setResubmitSelectedId(id)
                                        if (id === 'manual') {
                                            setResubmitNetwork('')
                                            setResubmitAccountName('')
                                            setResubmitMomoNumber('')
                                        } else {
                                            const d = savedDetails.find(s => s.id === id)
                                            if (d) {
                                                setResubmitNetwork(d.network)
                                                setResubmitAccountName(d.account_name)
                                                setResubmitMomoNumber(d.momo_number)
                                            }
                                        }
                                    }}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Select or enter manually" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manual">Enter manually</SelectItem>
                                            {savedDetails.map(d => (
                                                <SelectItem key={d.id} value={d.id}>
                                                    {d.is_default ? '⭐ ' : ''}{d.account_name} — {d.network}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div>
                                <Label>Network</Label>
                                <Select value={resubmitNetwork} onValueChange={v => setResubmitNetwork(v as Network)} disabled={resubmitSelectedId !== 'manual'}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select network" /></SelectTrigger>
                                    <SelectContent>
                                        {NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Account Holder Name</Label>
                                <Input className="mt-1" value={resubmitAccountName} onChange={e => setResubmitAccountName(e.target.value)} disabled={resubmitSelectedId !== 'manual'} placeholder="e.g. John Doe" />
                            </div>
                            <div>
                                <Label>MoMo Number</Label>
                                <Input className="mt-1" value={resubmitMomoNumber} onChange={e => setResubmitMomoNumber(e.target.value)} disabled={resubmitSelectedId !== 'manual'} placeholder="0244123456" />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setResubmitTarget(null)}>Cancel</Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                            onClick={handleResubmit}
                            disabled={resubmitting}
                        >
                            {resubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                            {resubmitting ? 'Resubmitting...' : 'Resubmit Request'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
