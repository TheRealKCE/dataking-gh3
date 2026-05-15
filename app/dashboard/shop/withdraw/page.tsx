'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
    Wallet, ArrowLeft, Star, Trash2, Plus, BookUser,
    CreditCard, Shield, Info, CheckCircle, Landmark,
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

const NETWORK_BG: Record<Network, string> = {
    'MTN MoMo': 'bg-yellow-500',
    'Telecel Cash': 'bg-red-500',
    'AirtelTigo Money': 'bg-blue-500',
}

const NETWORK_SHORT: Record<Network, string> = {
    'MTN MoMo': 'MTN',
    'Telecel Cash': 'TC',
    'AirtelTigo Money': 'AT',
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
    status: 'pending' | 'completed' | 'moolre_pending'
    admin_note: string | null
    created_at: string
    balance_snapshot: number | null
    payment_type: 'momo' | 'bank' | null
    moolre_transaction_id: string | null
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
    payment_type?: 'momo' | 'bank'
    bank_id?: string
    bank_name?: string
}

interface BankEntry {
    id: string
    name: string
}

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
    completed: { label: 'Paid', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
    moolre_pending: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', icon: Loader2 },
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
    const [settings, setSettings] = useState<GlobalSettings>({ withdrawal_fee_percent: 0, withdrawal_fee_flat: 0, min_withdrawal_amount: 0 })
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [shopName, setShopName] = useState('')
    const [banks, setBanks] = useState<BankEntry[]>([])

    // Form state
    const [amount, setAmount] = useState('')
    const [selectedSavedId, setSelectedSavedId] = useState<string>('manual')
    const [network, setNetwork] = useState<Network | ''>('')
    const [momoNumber, setMomoNumber] = useState('')
    const [paymentType, setPaymentType] = useState<'momo' | 'bank'>('momo')
    const [selectedBankId, setSelectedBankId] = useState<string>('')
    const [branch, setBranch] = useState<string>('')
    const [saveForLater, setSaveForLater] = useState(false)

    // Validation state
    const [verifiedName, setVerifiedName] = useState<string | null>(null)
    const [validating, setValidating] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [manualName, setManualName] = useState<string>('')
    const [verificationRetried, setVerificationRetried] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Saved Details manager modal
    const [savedModalOpen, setSavedModalOpen] = useState(false)
    const [newNetwork, setNewNetwork] = useState<Network | ''>('')
    const [newAccountName, setNewAccountName] = useState('')
    const [newMomoNumber, setNewMomoNumber] = useState('')
    const [addingDetail, setAddingDetail] = useState(false)

    useEffect(() => {
        if (dbUser && !isAdmin && !isSubAdmin && dbUser?.role !== 'agent') {
            router.replace('/dashboard')
            return
        }
        if (dbUser) fetchData()
    }, [dbUser, isAdmin, isSubAdmin])

    // ─── Account name validation (declared before fetchData so it can be in its dep array) ────
    const triggerValidation = useCallback((phone: string, net: string, bankId?: string) => {
        if (!phone || !net || phone.length < 10) {
            setVerifiedName(null)
            setValidationError(null)
            return
        }

        setValidating(true)
        setVerifiedName(null)
        setValidationError(null)

        fetch('/api/shop/validate-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone.trim(), network: net, bankId }),
        })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.name) {
                    setVerifiedName(data.name)
                    setValidationError(null)
                } else {
                    setVerifiedName(null)
                    setValidationError(data.error || 'Could not verify account name')
                }
            })
            .catch(() => {
                setVerifiedName(null)
                setValidationError('Network error during validation')
            })
            .finally(() => setValidating(false))
    }, [])

    const fetchData = useCallback(async () => {
        try {
            const db = supabase as any
            // Phase 1: fetch wallet + settings + shop + saved details in parallel
            const [walletRes, settingsRes, shopRes, savedRes] = await Promise.all([
                db.from('shop_wallets').select('*').eq('owner_id', dbUser!.id).maybeSingle(),
                db.from('shop_global_settings').select('*'),
                db.from('shop_profiles')
                    .select('shop_name, withdrawal_fee_percent, withdrawal_fee_flat, min_withdrawal_amount')
                    .eq('owner_id', dbUser!.id)
                    .maybeSingle(),
                db.from('shop_payment_details')
                    .select('*')
                    .eq('shop_owner_id', dbUser!.id)
                    .order('is_default', { ascending: false }),
            ])

            const walletData = walletRes.data
            if (walletData) setWallet(walletData)

            // Phase 2: fetch history scoped to this user's wallet (requires wallet ID)
            if (walletData?.id) {
                const historyRes = await db.from('shop_wallet_transactions')
                    .select('*')
                    .eq('shop_wallet_id', walletData.id)
                    .eq('type', 'withdrawal')
                    .order('created_at', { ascending: false })
                    .limit(20)
                setHistory(historyRes.data || [])
            }
            if (shopRes.data?.shop_name) setShopName(shopRes.data.shop_name)
            setSavedDetails(savedRes.data || [])

            if (settingsRes.data) {
                const s: Record<string, any> = {}
                for (const row of settingsRes.data) {
                    s[row.key] = typeof row.value === 'string' ? parseFloat(row.value) : row.value
                }
                const ownerRole = dbUser!.role || 'customer'
                const resolveGlobal = (baseKey: string, fallback: number): number => {
                    const roleVal = s[`${baseKey}_${ownerRole}`]
                    if (roleVal != null && !isNaN(roleVal)) return roleVal
                    const legacyVal = s[baseKey]
                    if (legacyVal != null && !isNaN(legacyVal)) return legacyVal
                    return fallback
                }
                setSettings({
                    withdrawal_fee_percent: resolveGlobal('withdrawal_fee_percent', 0),
                    withdrawal_fee_flat: resolveGlobal('withdrawal_fee_flat', 0),
                    min_withdrawal_amount: resolveGlobal('min_withdrawal_amount', 0),
                })
                if (shopRes.data) {
                    const sp = shopRes.data
                    setSettings(prev => ({
                        withdrawal_fee_percent: sp.withdrawal_fee_percent != null ? parseFloat(String(sp.withdrawal_fee_percent)) : prev.withdrawal_fee_percent,
                        withdrawal_fee_flat: sp.withdrawal_fee_flat != null ? parseFloat(String(sp.withdrawal_fee_flat)) : prev.withdrawal_fee_flat,
                        min_withdrawal_amount: sp.min_withdrawal_amount != null ? parseFloat(String(sp.min_withdrawal_amount)) : prev.min_withdrawal_amount,
                    }))
                }
            }

            // Pre-fill with default payment detail
            const defaultDetail = savedRes.data?.find((d: SavedDetail) => d.is_default)
            if (defaultDetail) {
                setSelectedSavedId(defaultDetail.id)
                setNetwork(defaultDetail.network)
                setMomoNumber(defaultDetail.momo_number)
                setPaymentType(defaultDetail.payment_type || 'momo')
                if (defaultDetail.bank_id) setSelectedBankId(defaultDetail.bank_id)
                // Auto-validate the pre-filled number
                triggerValidation(defaultDetail.momo_number, defaultDetail.network, defaultDetail.bank_id)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [dbUser, triggerValidation])

    // Fetch bank list lazily when switching to bank mode
    useEffect(() => {
        if (paymentType === 'bank' && banks.length === 0) {
            fetch('/api/shop/banks')
                .then(r => r.json())
                .then(d => { if (d.banks) setBanks(d.banks) })
                .catch(err => console.warn('[banks]', err))
        }
    }, [paymentType])


    // Auto-verify debounce
    useEffect(() => {
        if (selectedSavedId !== 'manual') return

        if (debounceRef.current) clearTimeout(debounceRef.current)
        
        if (momoNumber.length >= 10 && network) {
            debounceRef.current = setTimeout(() => {
                triggerValidation(momoNumber, network, selectedBankId || undefined)
            }, 800)
        } else {
            setVerifiedName(null)
            setValidationError(null)
        }

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [momoNumber, network, selectedBankId, selectedSavedId, triggerValidation])



    // When a saved detail is selected
    const handleSavedSelect = (id: string) => {
        setSelectedSavedId(id)
        if (id === 'manual') {
            setNetwork('')
            setMomoNumber('')
            setSelectedBankId('')
            setBranch('')
            setVerifiedName(null)
            setValidationError(null)
        } else {
            const d = savedDetails.find(s => s.id === id)
            if (d) {
                setNetwork(d.network)
                setMomoNumber(d.momo_number)
                setPaymentType(d.payment_type || 'momo')
                if (d.bank_id) setSelectedBankId(d.bank_id)
                // Clear branch — saved details never store branch; avoids stale bank session data
                setBranch('')
                // Silent re-validation — name may have changed on the network
                triggerValidation(d.momo_number, d.network, d.bank_id)
            }
        }
    }

    const amountNum = parseFloat(amount) || 0
    const feePercent = (amountNum * settings.withdrawal_fee_percent) / 100
    const totalFee = feePercent + settings.withdrawal_fee_flat
    const netAmount = amountNum - totalFee

    // Allow manual name entry as a fallback when auto-verification fails after a retry
    const effectiveAccountName = verifiedName || manualName.trim()
    const canSubmit =
        amountNum > 0 &&
        amountNum >= settings.min_withdrawal_amount &&
        amountNum <= (wallet?.balance || 0) &&
        !!network &&
        !!momoNumber &&
        !!effectiveAccountName &&
        !validating &&
        !submitting

    const handleSubmit = async () => {
        if (!canSubmit) return

        setSubmitting(true)
        try {
            const res = await fetch('/api/shop/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amountNum,
                    momoNumber: momoNumber.trim(),
                    network,
                    payment_type: paymentType,
                    bankId: selectedBankId || undefined,
                    branch: branch.trim() || undefined,
                    saveForLater: saveForLater && selectedSavedId === 'manual',
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to submit request')

            toast.success(`Withdrawal submitted! Admin will process shortly.`)
            setAmount('')
            setSaveForLater(false)
            setVerifiedName(null)
            setManualName('')
            setVerificationRetried(false)
            fetchData()

        } catch (err: any) {
            toast.error(err.message || 'Failed to submit request')
        } finally {
            setSubmitting(false)
        }
    }

    const handleAddSavedDetail = async () => {
        if (!newNetwork) { toast.error('Select a network'); return }
        if (!newMomoNumber.trim()) { toast.error('Enter MoMo number'); return }
        if (savedDetails.length >= 5) { toast.error('Maximum of 5 saved details reached'); return }

        setAddingDetail(true)
        try {
            // First, verify the account with Moolre to ensure accuracy
            const validateRes = await fetch('/api/shop/validate-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    phone: newMomoNumber.trim(), 
                    network: newNetwork 
                }),
            })
            const validateData = await validateRes.json()
            if (!validateData.success || !validateData.name) {
                toast.error(validateData.error || 'Could not verify account name')
                return
            }

            const verifiedModalName = validateData.name

            // Only insert if validation succeeds
            const { error } = await (supabase as any).from('shop_payment_details').insert({
                shop_owner_id: dbUser!.id,
                account_name: verifiedModalName,
                momo_number: newMomoNumber.trim(),
                network: newNetwork,
                is_default: savedDetails.length === 0,
            })
            if (error) throw error
            toast.success('Payment method verified & saved!')
            setNewNetwork('')
            setNewAccountName('') // Keep this just for backwards compat if needed, even though it's hidden now
            setNewMomoNumber('')
            fetchData()
            setSavedModalOpen(false)
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
        <div className="space-y-6">

            {/* ── Header ── */}
            <div>
                <Link href="/dashboard/shop">
                    <Button variant="ghost" size="sm" className="w-fit gap-2 -ml-2 text-muted-foreground hover:text-emerald-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Shop Dashboard
                    </Button>
                </Link>
                <div className="mt-2">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Banknote className="w-6 h-6 text-emerald-600" />
                        Withdraw Earnings
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Request a payout from your shop wallet to your mobile money or bank account.
                    </p>
                </div>
            </div>

            {/* ── Wallet Balance Card ── */}
            <Card className="overflow-hidden border-0 shadow-md">
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
                    <div className="flex items-center gap-3 mb-3">
                        <Wallet className="w-5 h-5 text-emerald-200" />
                        <p className="text-emerald-100 text-sm font-medium">Available Balance</p>
                    </div>
                    <p className="text-4xl font-black">{formatCurrency(wallet?.balance || 0)}</p>
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-emerald-200">
                        <span>Total Earned: {formatCurrency(wallet?.total_earned || 0)}</span>
                        <span>Total Withdrawn: {formatCurrency(wallet?.total_withdrawn || 0)}</span>
                    </div>
                </div>
            </Card>

            {/* ── Withdrawal Form ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">New Withdrawal Request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* STEP 1 — Amount */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">1</span>
                            <Label htmlFor="amount" className="text-sm font-semibold">Enter Withdrawal Amount (GHS)</Label>
                        </div>
                        <Input
                            id="amount"
                            type="number"
                            min={settings.min_withdrawal_amount}
                            max={wallet?.balance || 0}
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`Min: ${formatCurrency(settings.min_withdrawal_amount)}`}
                            className="h-12 text-lg font-semibold"
                        />
                        {amountNum > (wallet?.balance || 0) && amountNum > 0 && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Amount exceeds your available balance
                            </p>
                        )}
                        {amountNum > 0 && amountNum < settings.min_withdrawal_amount && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Minimum withdrawal is {formatCurrency(settings.min_withdrawal_amount)}
                            </p>
                        )}
                    </div>

                    {/* Payout Summary */}
                    <div className={cn(
                        'rounded-xl border-2 overflow-hidden transition-all duration-300',
                        amountNum > 0 ? 'border-emerald-200 dark:border-emerald-800' : 'border-dashed border-muted'
                    )}>
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 flex items-center gap-2 border-b border-emerald-100 dark:border-emerald-900">
                            <Shield className="w-4 h-4 text-emerald-600" />
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Payout Breakdown</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-card space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Withdrawal Amount</span>
                                <span className="font-semibold tabular-nums">{amountNum > 0 ? formatCurrency(amountNum) : '—'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2 text-red-500 dark:text-red-400">
                                    Processing Fee
                                    <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded-full font-bold">
                                        {settings.withdrawal_fee_percent}%
                                    </span>
                                </span>
                                <span className="text-red-500 dark:text-red-400 tabular-nums">
                                    {amountNum > 0 ? `− ${formatCurrency(feePercent)}` : '—'}
                                </span>
                            </div>
                            {settings.withdrawal_fee_flat > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-red-500 dark:text-red-400">Flat Processing Fee</span>
                                    <span className="text-red-500 dark:text-red-400 tabular-nums">
                                        {amountNum > 0 ? `− ${formatCurrency(settings.withdrawal_fee_flat)}` : '—'}
                                    </span>
                                </div>
                            )}
                            <div className="border-t border-dashed" />
                            <div className="flex justify-between items-center pt-0.5">
                                <div>
                                    <p className="font-bold">You Receive</p>
                                    <p className="text-[11px] text-muted-foreground">Sent directly to your account</p>
                                </div>
                                <span className={cn(
                                    'text-3xl font-black tabular-nums leading-none',
                                    amountNum > 0 && netAmount > 0 ? 'text-emerald-600' : 'text-muted-foreground'
                                )}>
                                    {amountNum > 0 ? formatCurrency(Math.max(0, netAmount)) : 'GHS 0.00'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* STEP 2 — Payment Type Toggle */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">2</span>
                            <Label className="text-sm font-semibold">Payment Method Type</Label>
                        </div>
                        <div className="flex p-1 bg-muted rounded-xl gap-1">
                            <button
                                type="button"
                                onClick={() => { 
                                    setPaymentType('momo')
                                    setSelectedBankId('')
                                    setBranch('')
                                    setVerifiedName(null)
                                    setValidationError(null)
                                    setSelectedSavedId('manual')
                                    setMomoNumber('') 
                                }}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-bold transition-all',
                                    paymentType === 'momo'
                                        ? 'bg-white dark:bg-card shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <CreditCard className="w-3.5 h-3.5" />
                                Mobile Money
                            </button>
                            <button
                                type="button"
                                onClick={() => { 
                                    setPaymentType('bank')
                                    setNetwork('Bank' as any)
                                    setSelectedSavedId('manual')
                                    setVerifiedName(null)
                                    setValidationError(null)
                                    setMomoNumber('') 
                                }}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-bold transition-all',
                                    paymentType === 'bank'
                                        ? 'bg-white dark:bg-card shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <Landmark className="w-3.5 h-3.5" />
                                Bank Transfer
                            </button>
                        </div>
                    </div>

                    {/* STEP 3 — Payment Method */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">3</span>
                                <Label className="text-sm font-semibold">
                                    {paymentType === 'momo' ? 'Mobile Money Account' : 'Bank Account'}
                                </Label>
                            </div>
                            {paymentType === 'momo' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-2"
                                    onClick={() => setSavedModalOpen(true)}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    {savedDetails.length === 0 ? 'Add Payment Method' : 'Manage Saved Methods'}
                                </Button>
                            )}
                        </div>

                        {/* Saved detail cards for MoMo */}
                        {paymentType === 'momo' && savedDetails.length > 0 && (
                            <div className="space-y-2.5">
                                {savedDetails.map(d => (
                                    <button
                                        key={d.id}
                                        type="button"
                                        onClick={() => handleSavedSelect(d.id)}
                                        className={cn(
                                            'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200',
                                            selectedSavedId === d.id
                                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                                                : 'border-border hover:border-emerald-300 hover:bg-muted/30'
                                        )}
                                    >
                                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-extrabold text-xs', NETWORK_BG[d.network])}>
                                            {NETWORK_SHORT[d.network]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="font-semibold text-sm">{d.account_name}</p>
                                                {d.is_default && (
                                                    <span className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{d.momo_number} · {d.network}</p>
                                        </div>
                                        <div className={cn(
                                            'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                            selectedSavedId === d.id ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30'
                                        )}>
                                            {selectedSavedId === d.id && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                    </button>
                                ))}

                                {/* Manual entry option */}
                                <button
                                    type="button"
                                    onClick={() => handleSavedSelect('manual')}
                                    className={cn(
                                        'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200',
                                        selectedSavedId === 'manual'
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                                            : 'border-border hover:border-emerald-300 hover:bg-muted/30'
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">Use a Different Account</p>
                                        <p className="text-xs text-muted-foreground">Enter account details manually</p>
                                    </div>
                                    <div className={cn(
                                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                        selectedSavedId === 'manual' ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30'
                                    )}>
                                        {selectedSavedId === 'manual' && <div className="w-2 h-2 rounded-full bg-white" />}
                                    </div>
                                </button>
                            </div>
                        )}

                        {/* Manual entry fields */}
                        {(isManual || paymentType === 'bank') && (
                            <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-dashed">

                                {/* Network selector — MoMo only */}
                                {paymentType === 'momo' && (
                                    <div>
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Mobile Money Network
                                        </Label>
                                        <Select value={network} onValueChange={(v) => {
                                            setNetwork(v as Network)
                                            setVerifiedName(null)
                                            setValidationError(null)
                                        }}>
                                            <SelectTrigger className="mt-1.5 h-11">
                                                <SelectValue placeholder="Select network (MTN MoMo, Telecel...)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Bank selector */}
                                {paymentType === 'bank' && (
                                    <div>
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Select Bank
                                        </Label>
                                        <Select value={selectedBankId} onValueChange={(v) => {
                                            setSelectedBankId(v)
                                            setNetwork('Bank' as any)
                                            setVerifiedName(null)
                                            setValidationError(null)
                                        }}>
                                            <SelectTrigger className="mt-1.5 h-11">
                                                <SelectValue placeholder="Select your bank" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {banks.length === 0 ? (
                                                    <SelectItem value="loading" disabled>Loading banks...</SelectItem>
                                                ) : (
                                                    banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Branch — Bank only, optional */}
                                {paymentType === 'bank' && (
                                    <div>
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Branch <span className="normal-case font-normal">(Optional)</span>
                                        </Label>
                                        <Input
                                            value={branch}
                                            onChange={(e) => setBranch(e.target.value)}
                                            placeholder="e.g. Accra Main"
                                            className="mt-1.5 h-11"
                                        />
                                    </div>
                                )}

                                {/* MoMo / Bank Account Number */}
                                <div>
                                    <Label htmlFor="momo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        {paymentType === 'momo' ? 'MoMo Number' : 'Bank Account Number'}
                                    </Label>
                                    <Input
                                        id="momo"
                                        value={momoNumber}
                                        onChange={(e) => {
                                            setMomoNumber(e.target.value)
                                            setVerifiedName(null)
                                            setValidationError(null)
                                        }}
                                        placeholder={paymentType === 'momo' ? '0244123456' : 'Account number'}
                                        className="mt-1.5 h-11 font-mono"
                                    />
                                </div>

                                {/* Verified account name — read-only, auto-filled */}
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Account Holder Name
                                        </Label>
                                        {validating && (
                                            <span className="text-[10px] text-emerald-600 font-bold animate-pulse uppercase tracking-tight">
                                                Auto-verifying...
                                            </span>
                                        )}
                                        {validationError && !validating && (
                                            <Button 
                                                size="sm" 
                                                className="h-7 text-[11px] bg-red-100 hover:bg-red-200 text-red-600 shadow-none border-none font-bold px-3 uppercase tracking-wide transition-all"
                                                onClick={() => {
                                                    setVerificationRetried(true)
                                                    triggerValidation(momoNumber, network || '', selectedBankId || undefined)
                                                }}
                                                disabled={validating || !momoNumber || !network}
                                                type="button"
                                            >
                                                Retry Verification
                                            </Button>
                                        )}
                                    </div>
                                    <div className="mt-1.5 relative">
                                        <Input
                                            value={verifiedName || ''}
                                            readOnly
                                            placeholder={
                                                validating
                                                    ? 'Verifying...'
                                                    : validationError
                                                        ? 'Verification failed'
                                                        : 'Enter number above to verify name'
                                            }
                                            className={cn(
                                                'h-11 bg-muted/50 font-semibold pr-10',
                                                verifiedName ? 'text-emerald-600 border-emerald-300 dark:border-emerald-700' : '',
                                                validationError ? 'border-red-300 dark:border-red-700 text-red-500' : ''
                                            )}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {validating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                                            {verifiedName && !validating && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                            {validationError && !validating && <AlertCircle className="w-4 h-4 text-red-500" />}
                                        </div>
                                    </div>
                                    {validationError && (
                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> {validationError}
                                        </p>
                                    )}
                                    {/* Manual name fallback — shown after a failed retry */}
                                    {validationError && verificationRetried && !validating && (
                                        <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                                <Info className="w-3 h-3 flex-shrink-0" /> Auto-verification unavailable. Enter your account name manually.
                                            </p>
                                            <Input
                                                value={manualName}
                                                onChange={e => setManualName(e.target.value)}
                                                placeholder="Account holder name (e.g. John Mensah)"
                                                className="h-10 text-sm font-semibold"
                                            />
                                            <p className="text-[10px] text-amber-600 dark:text-amber-500">
                                                Admin will verify this name before processing your payout.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Save for later */}
                                {!!effectiveAccountName && !validating && savedDetails.length < 5 && (
                                    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none mt-4 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                                        <input
                                            type="checkbox"
                                            checked={saveForLater}
                                            onChange={e => setSaveForLater(e.target.checked)}
                                            className="accent-emerald-600 w-4 h-4"
                                        />
                                        Save these verified details for future withdrawals
                                    </label>
                                )}
                            </div>
                        )}

                        {/* Read-only saved detail display strip */}
                        {!isManual && (() => {
                            const d = savedDetails.find(s => s.id === selectedSavedId)
                            if (!d) return null
                            return (
                                <div className="p-3 rounded-xl bg-muted/30 border space-y-3">
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Network</p>
                                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', NETWORK_COLORS[d.network] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>
                                                {d.network}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Account</p>
                                            <p className="font-medium truncate">
                                                {validating ? '...' : verifiedName || d.account_name}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Number</p>
                                            <p className="font-mono">{d.momo_number}</p>
                                        </div>
                                    </div>
                                    
                                    {(!verifiedName || validationError) && (
                                        <div className="flex items-center justify-between pt-2 border-t border-dashed">
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">{validationError || 'Needs verification'}</p>
                                            <Button 
                                                size="sm" 
                                                className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold uppercase tracking-wide px-3 transition-all"
                                                onClick={() => triggerValidation(d.momo_number, d.network, d.bank_id || undefined)}
                                                disabled={validating}
                                                type="button"
                                            >
                                                {validating ? 'Verifying...' : 'Verify Saved Account'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                    </div>

                    {/* ── Notice */}
                    {(!verifiedName || validationError) && (
                        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                                Your account name will be automatically verified once you enter a valid number. 
                                This ensures your payout is sent to the correct person.
                            </span>
                        </div>
                    )}

                    {/* ── Submit Button */}
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-bold gap-2 text-base shadow-lg shadow-emerald-600/20"
                    >
                        {submitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Banknote className="w-5 h-5" />
                        )}
                        {submitting
                            ? 'Submitting...'
                            : !effectiveAccountName
                                ? verificationRetried
                                    ? 'Enter Account Name Above to Continue'
                                    : 'Verify Account to Continue'
                                : amountNum > 0 && netAmount > 0
                                    ? `Request ${formatCurrency(Math.max(0, netAmount))} Payout`
                                    : 'Request Withdrawal'}
                    </Button>

                </CardContent>
            </Card>

            {/* ── Withdrawal History ── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Withdrawal History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
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
                                            <th className="text-left px-4 py-2.5 font-medium">Date</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Requested</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Fee</th>
                                            <th className="text-right px-4 py-2.5 font-medium">Payout</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Account</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Network</th>
                                            <th className="text-left px-4 py-2.5 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((row) => {
                                            const cfg = statusConfig[row.status] ?? statusConfig['pending']
                                            const Icon = cfg.icon
                                            return (
                                                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                                        {new Date(row.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                                                    <td className="px-4 py-3 text-right text-red-500 text-xs">−{formatCurrency(row.fee)}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(row.net_amount)}</td>
                                                    <td className="px-4 py-3 text-xs">{row.account_name}</td>
                                                    <td className="px-4 py-3">
                                                        {row.network && (
                                                            <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full', NETWORK_COLORS[row.network as Network] || 'bg-gray-100 text-gray-700')}>
                                                                {row.network}
                                                            </span>
                                                        )}
                                                        <p className="font-mono text-xs text-muted-foreground mt-0.5">{row.momo_number}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                                                            <Icon className={cn("w-3 h-3", row.status === 'moolre_pending' && 'animate-spin')} />
                                                            {cfg.label}
                                                        </span>
                                                        {row.moolre_transaction_id && (
                                                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-[120px]" title={row.moolre_transaction_id}>
                                                                {row.moolre_transaction_id.slice(0, 12)}…
                                                            </p>
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
                                    const cfg = statusConfig[row.status] ?? statusConfig['pending']
                                    const Icon = cfg.icon
                                    return (
                                        <div key={row.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">
                                                        {new Date(row.created_at).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-2xl font-black text-emerald-600 leading-none">
                                                        {formatCurrency(row.net_amount)}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground mt-1">
                                                        Requested: {formatCurrency(row.amount)} · Fee: {formatCurrency(row.fee)}
                                                    </p>
                                                </div>
                                                <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full shrink-0', cfg.color)}>
                                                    <Icon className={cn("w-2.5 h-2.5", row.status === 'moolre_pending' && 'animate-spin')} />
                                                    {cfg.label.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-3 rounded-xl text-xs">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Account Name</p>
                                                    <p className="font-medium mt-0.5 truncate">{row.account_name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Network</p>
                                                    {row.network ? (
                                                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 inline-block', NETWORK_COLORS[row.network as Network] || 'bg-gray-100 text-gray-700')}>
                                                            {row.network}
                                                        </span>
                                                    ) : (
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">—</p>
                                                    )}
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">MoMo Number</p>
                                                    <p className="font-mono mt-0.5">{row.momo_number}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ── Saved Payment Details Modal ── */}
            <Dialog open={savedModalOpen} onOpenChange={setSavedModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookUser className="w-4 h-4 text-emerald-600" />
                            Saved Payment Methods
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-0.5">
                        {savedDetails.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                No saved payment methods yet. Add one below.
                            </p>
                        )}
                        {savedDetails.map(d => (
                            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-xs', NETWORK_BG[d.network])}>
                                    {NETWORK_SHORT[d.network]}
                                </div>
                                <div className="flex-1 min-w-0 space-y-0">
                                    <p className="font-semibold text-sm truncate">{d.account_name}</p>
                                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block', NETWORK_COLORS[d.network])}>
                                        {d.network}
                                    </span>
                                    <p className="font-mono text-xs text-muted-foreground">{d.momo_number}</p>
                                </div>
                                <div className="flex gap-1 items-center flex-shrink-0">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className={cn('h-8 w-8', d.is_default ? 'text-yellow-500' : 'text-muted-foreground')}
                                        onClick={() => handleSetDefault(d.id)}
                                        title={d.is_default ? 'Default method' : 'Set as default'}
                                    >
                                        <Star className="w-4 h-4" fill={d.is_default ? 'currentColor' : 'none'} />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-red-500 hover:text-red-700"
                                        onClick={() => handleDeleteSavedDetail(d.id)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {savedDetails.length < 5 ? (
                        <div className="border-t pt-4 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Add New Payment Method ({savedDetails.length}/5)
                            </p>
                            <Select value={newNetwork} onValueChange={v => setNewNetwork(v as Network)}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Select network" />
                                </SelectTrigger>
                                <SelectContent>
                                    {NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder="MoMo number (e.g. 0244123456)"
                                value={newMomoNumber}
                                onChange={e => setNewMomoNumber(e.target.value)}
                                className="h-10 font-mono"
                            />
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium px-1">
                                Notice: The account name will be auto-verified before saving.
                            </p>
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                onClick={handleAddSavedDetail}
                                disabled={addingDetail}
                            >
                                {addingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {addingDetail ? 'Verifying & Saving...' : 'Verify & Save Payment Method'}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                            Maximum of 5 saved methods reached. Delete one to add more.
                        </p>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSavedModalOpen(false)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
