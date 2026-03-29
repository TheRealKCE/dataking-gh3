'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog, DialogClose,
    DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle2, CreditCard, AlertCircle } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { differenceInMinutes } from 'date-fns'

const DESCRIPTION_TEMPLATES = [
    { id: 'manual', label: 'Manual wallet top-up' },
    { id: 'data_order', label: 'Credit for data order' },
    { id: 'owe_momo', label: 'Unpaid — will settle via Momo' },
    { id: 'owe_cash', label: 'Unpaid — will pay in cash' },
    { id: 'error_fix', label: 'Correcting previous error' },
    { id: 'promo', label: 'Promotional credit' },
    { id: 'advance', label: 'Partial advance for order' },
]

interface DebtInfo {
    id: string
    amount_owed: number
    amount_settled: number
    remaining: number
    created_at: string
    notes: string | null
}

interface TopUpFormProps {
    selectedUser: {
        id: string
        first_name: string
        last_name: string
        phone_number: string
        wallet_balance: number
        pending_debt_total: number
        last_admin_topup_at: string | null
        last_admin_topup_amount: number | null
    } | null
    onSuccess: () => void
}

export function TopUpForm({ selectedUser, onSuccess }: TopUpFormProps) {
    const [amount, setAmount] = useState('')
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>(['manual'])
    const [description, setDescription] = useState('Manual wallet top-up')
    const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid')
    const [notes, setNotes] = useState('')
    const [deductFromDebt, setDeductFromDebt] = useState(false)
    const [deductAmount, setDeductAmount] = useState('')
    const [debts, setDebts] = useState<DebtInfo[]>([])
    const [selectedDebtId, setSelectedDebtId] = useState<string>('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const amountNum = parseFloat(amount) || 0
    const deductNum = parseFloat(deductAmount) || 0
    const netCredit = deductFromDebt ? Math.max(0, amountNum - deductNum) : amountNum
    const selectedDebt = debts.find(d => d.id === selectedDebtId)
    const debtRemaining = selectedDebt ? Math.max(0, selectedDebt.remaining - deductNum) : 0

    // Same-amount within 30 min warning
    const showSameAmountWarning = selectedUser?.last_admin_topup_amount &&
        amountNum > 0 &&
        amountNum === selectedUser.last_admin_topup_amount &&
        selectedUser.last_admin_topup_at &&
        differenceInMinutes(new Date(), new Date(selectedUser.last_admin_topup_at)) < 30

    // Fetch debts when user selected
    useEffect(() => {
        if (!selectedUser?.id || selectedUser.pending_debt_total <= 0) { setDebts([]); return }
        fetch(`/api/admin/top-up/user-debt/${selectedUser.id}`)
            .then(r => r.json())
            .then(data => {
                setDebts(data.debts || [])
                if (data.debts?.length > 0) setSelectedDebtId(data.debts[0].id)
            })
            .catch(() => { })
    }, [selectedUser?.id, selectedUser?.pending_debt_total])

    // Auto-fill description from templates
    useEffect(() => {
        const labels = selectedTemplates
            .map(id => DESCRIPTION_TEMPLATES.find(t => t.id === id)?.label)
            .filter(Boolean)
            .join('; ')
        setDescription(labels)
    }, [selectedTemplates])

    // Cap deduct amount
    useEffect(() => {
        if (!selectedDebt) return
        const maxDeduct = Math.min(selectedDebt.remaining, amountNum)
        if (deductNum > maxDeduct) setDeductAmount(String(maxDeduct))
    }, [amountNum, selectedDebt?.remaining, selectedDebt, deductNum])

    // Auto-fill deduct amount when toggled
    useEffect(() => {
        if (deductFromDebt && selectedDebt) {
            const autoDeduct = Math.min(selectedDebt.remaining, amountNum)
            setDeductAmount(autoDeduct > 0 ? String(autoDeduct) : '')
        }
    }, [deductFromDebt, selectedDebt?.remaining, amountNum, selectedDebt])

    const toggleTemplate = (id: string) => {
        setSelectedTemplates(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        )
    }

    const addPreset = (val: number) => {
        setAmount(prev => String((parseFloat(prev) || 0) + val))
    }

    const getButtonLabel = () => {
        if (!selectedUser || amountNum <= 0) return 'Select a user and enter an amount'
        if (deductFromDebt && deductNum > 0) return `Credit GHS ${netCredit.toFixed(2)} · Settle GHS ${deductNum.toFixed(2)} Debt`
        if (paymentStatus === 'unpaid') return `Credit GHS ${amountNum.toFixed(2)} — Mark as Debt`
        return `Credit GHS ${amountNum.toFixed(2)} — Paid`
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        setShowConfirm(false)
        try {
            const res = await fetch('/api/admin/top-up/credit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUser!.id,
                    amount: amountNum,
                    description,
                    markAsUnpaid: paymentStatus === 'unpaid',
                    notes: notes || undefined,
                    deductFromDebt,
                    deductAmount: deductNum,
                    settlementId: selectedDebtId || undefined,
                })
            })
            const data = await res.json()
            if (!res.ok) {
                if (data.error === 'DUPLICATE') {
                    toast.error('⛔ Duplicate top-up blocked — this exact amount was just processed for this user.')
                } else {
                    toast.error(data.error || 'Top-up failed')
                }
                return
            }
            toast.success(`✅ GHS ${netCredit.toFixed(2)} credited to ${selectedUser!.first_name} ${selectedUser!.last_name}`)
            // Reset form
            setAmount('')
            setDeductAmount('')
            setDeductFromDebt(false)
            setPaymentStatus('paid')
            setNotes('')
            setSelectedTemplates(['manual'])
            onSuccess()
        } catch {
            toast.error('Network error. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!selectedUser) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Select a user above to top up their wallet</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* Amount Zone */}
            <div className="space-y-2">
                <Label htmlFor="topup-amount" className="font-semibold">Amount (GHS)</Label>
                <Input
                    id="topup-amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="text-2xl font-bold h-14 text-center"
                    min="0"
                />
                <div className="flex flex-wrap gap-2">
                    {[5, 10, 20, 50, 100].map(v => (
                        <Button key={v} type="button" variant="outline" size="sm" onClick={() => addPreset(v)} className="font-bold">
                            +{v}
                        </Button>
                    ))}
                </div>
                {amountNum > 0 && (
                    <p className="text-sm text-muted-foreground">
                        New balance after top-up: <strong className="text-emerald-600">{formatCurrency(selectedUser.wallet_balance + netCredit)}</strong>
                    </p>
                )}
                {showSameAmountWarning && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 text-xs">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        🔁 You topped up this user <strong>GHS {amountNum}</strong> recently. Double-check this isn&apos;t a duplicate.
                    </div>
                )}
            </div>

            {/* Description Templates */}
            <div className="space-y-2">
                <Label htmlFor="topup-description" className="font-semibold">Description</Label>
                <div className="flex flex-wrap gap-1.5">
                    {DESCRIPTION_TEMPLATES.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTemplate(t.id)}
                            className={cn(
                                'text-xs px-2.5 py-1.5 rounded-full border transition-all',
                                selectedTemplates.includes(t.id)
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <Textarea
                    id="topup-description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    className="text-sm"
                />
            </div>

            {/* Force Settlement Zone */}
            {selectedUser.pending_debt_total > 0 && debts.length > 0 && (
                <div className="border border-orange-200 dark:border-orange-800 rounded-xl p-4 bg-orange-50 dark:bg-orange-900/10 space-y-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="deductFromDebt"
                            checked={deductFromDebt}
                            onChange={e => setDeductFromDebt(e.target.checked)}
                            className="w-4 h-4 accent-orange-500"
                            title="Deduct debt from this top-up"
                        />
                        <Label htmlFor="deductFromDebt" className="font-semibold text-orange-700 dark:text-orange-400 cursor-pointer">
                            ⚡ Deduct debt from this top-up (Force Settle)
                        </Label>
                    </div>

                    {deductFromDebt && (
                        <div className="space-y-3 pl-6">
                            {debts.length > 1 && (
                                <div>
                                    <Label htmlFor="debt-select" className="text-xs">Which debt?</Label>
                                    <select
                                        id="debt-select"
                                        title="Select debt to settle"
                                        value={selectedDebtId}
                                        onChange={e => setSelectedDebtId(e.target.value)}
                                        className="w-full mt-1 text-sm border rounded-lg p-2 bg-white dark:bg-slate-900"
                                    >
                                        {debts.map((d, i) => (
                                            <option key={d.id} value={d.id}>
                                                Debt #{i + 1} — {new Date(d.created_at).toLocaleDateString()} — {formatCurrency(d.remaining)} remaining
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <Label htmlFor="deduct-amount" className="text-xs">Deduct Amount (max: {formatCurrency(Math.min(selectedDebt?.remaining || 0, amountNum))})</Label>
                                <Input
                                    id="deduct-amount"
                                    type="number"
                                    inputMode="decimal"
                                    value={deductAmount}
                                    onChange={e => setDeductAmount(e.target.value)}
                                    min="0"
                                    max={Math.min(selectedDebt?.remaining || 0, amountNum)}
                                    className="mt-1"
                                />
                            </div>
                            {amountNum > 0 && deductNum > 0 && (
                                <div className="text-xs space-y-1 bg-white dark:bg-slate-900 rounded-lg p-3 font-mono">
                                    <div className="flex justify-between"><span>Cash received:</span><span className="font-bold">GHS {amountNum.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-red-600"><span>Debt deducted:</span><span className="font-bold">−GHS {deductNum.toFixed(2)}</span></div>
                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                                    <div className="flex justify-between text-emerald-600 font-bold"><span>Wallet credit:</span><span>GHS {netCredit.toFixed(2)}</span></div>
                                    <div className={cn('flex justify-between', debtRemaining === 0 ? 'text-green-600' : 'text-amber-600')}>
                                        <span>Debt remaining:</span>
                                        <span className="font-bold">{debtRemaining === 0 ? '✅ Fully settled' : `GHS ${debtRemaining.toFixed(2)}`}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Payment Status */}
            <div className="space-y-2">
                <Label className="font-semibold">Payment Status</Label>
                <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" checked={paymentStatus === 'paid'} onChange={() => setPaymentStatus('paid')} className="w-4 h-4 accent-green-600" />
                        <span className="font-medium text-green-700 dark:text-green-400">✅ Paid — cash / MoMo received</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" checked={paymentStatus === 'unpaid'} onChange={() => setPaymentStatus('unpaid')} className="w-4 h-4 accent-amber-500" />
                        <span className="font-medium text-amber-700 dark:text-amber-400">💳 Unpaid — mark as debt</span>
                    </label>
                </div>
                {paymentStatus === 'unpaid' && (
                    <Textarea
                        id="unpaid-notes"
                        placeholder="Optional note (e.g. will pay tomorrow via MoMo)"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        className="text-sm border-amber-200 dark:border-amber-800"
                    />
                )}
            </div>

            {/* Submit Button */}
            <Button
                onClick={() => setShowConfirm(true)}
                disabled={isSubmitting || !selectedUser || amountNum <= 0}
                className={cn(
                    'w-full h-12 text-base font-bold transition-all',
                    paymentStatus === 'unpaid'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : deductFromDebt
                            ? 'bg-teal-600 hover:bg-teal-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                )}
            >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                {getButtonLabel()}
            </Button>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle>Confirm Top-Up</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-2 text-sm">
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 font-mono space-y-1">
                                    {deductFromDebt && deductNum > 0 ? (
                                        <>
                                            <p>✅ Credit <strong>GHS {netCredit.toFixed(2)}</strong> to {selectedUser.first_name}&apos;s wallet</p>
                                            <p className="text-muted-foreground text-xs">(GHS {amountNum.toFixed(2)} cash − GHS {deductNum.toFixed(2)} debt deducted)</p>
                                            <p>✅ Mark GHS {deductNum.toFixed(2)} debt as: {debtRemaining === 0 ? 'Settled' : 'Partially Settled'}</p>
                                        </>
                                    ) : (
                                        <p>✅ Credit <strong>GHS {amountNum.toFixed(2)}</strong> to {selectedUser.first_name}&apos;s wallet</p>
                                    )}
                                    {paymentStatus === 'unpaid' && <p>💳 Mark as: Unpaid (debt created)</p>}
                                    <p className="text-muted-foreground text-xs">📱 SMS will be sent to {selectedUser.phone_number}</p>
                                </div>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
