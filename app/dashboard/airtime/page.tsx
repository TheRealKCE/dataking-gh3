'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Phone, CheckCircle, Copy, Wallet, AlertTriangle, Loader2, ChevronRight, Info, History, X, ArrowRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Constants ────────────────────────────────────────────────────────────────
const NETWORKS = [
    { id: 'MTN', label: 'MTN', color: '#F5A623', gradient: 'from-[#F5A623] to-[#FFCC02]', textColor: 'text-[#b37700]', prefixes: ['024','054','055','059','025','053'] },
    { id: 'Telecel', label: 'Telecel', color: '#e63946', gradient: 'from-[#e63946] to-[#ff6b6b]', textColor: 'text-[#9b1e28]', prefixes: ['020','050'] },
    { id: 'AT', label: 'AirtelTigo', color: '#F97316', gradient: 'from-[#F97316] to-[#fb923c]', textColor: 'text-[#9a4e0f]', prefixes: ['027','057','026','056','028','058'] },
]

const QUICK_AMOUNTS = [1, 2, 5, 10, 20, 50]

function detectNetwork(phone: string) {
    if (phone.length < 3) return null
    const prefix = phone.slice(0, 3)
    return NETWORKS.find(n => n.prefixes.includes(prefix)) || null
}

function getNetworkWarning(phone: string, selectedNetwork: string | null) {
    if (!selectedNetwork || phone.length < 3) return null
    const auto = detectNetwork(phone)
    if (!auto) return 'Unrecognized prefix — please confirm your network.'
    if (auto.id !== selectedNetwork) return `This number looks like it belongs to ${auto.label}. Please verify before proceeding.`
    return null
}

// ─── Network Logo SVGs ────────────────────────────────────────────────────────
function MTNLogo() {
    return (
        <svg viewBox="0 0 60 60" className="w-8 h-8" fill="none">
            <circle cx="30" cy="30" r="30" fill="#FFD200"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1a1a1a">MTN</text>
        </svg>
    )
}
function TelecelLogo() {
    return (
        <svg viewBox="0 0 60 60" className="w-8 h-8" fill="none">
            <circle cx="30" cy="30" r="30" fill="#e63946"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">Telecel</text>
        </svg>
    )
}
function ATLogo() {
    return (
        <svg viewBox="0 0 60 60" className="w-8 h-8" fill="none">
            <circle cx="30" cy="30" r="30" fill="#F97316"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">AT</text>
        </svg>
    )
}

const NetworkLogo = ({ id }: { id: string }) => {
    if (id === 'MTN') return <MTNLogo />
    if (id === 'Telecel') return <TelecelLogo />
    return <ATLogo />
}

interface AirtimeSettings {
    fee_mtn_customer: number; fee_mtn_agent: number
    fee_telecel_customer: number; fee_telecel_agent: number
    fee_at_customer: number; fee_at_agent: number
    min_amount: number; max_amount: number
    enabled_mtn: boolean; enabled_telecel: boolean; enabled_at: boolean
}

interface AirtimeOrder {
    id: string; reference_code: string; network: string; beneficiary_phone: string
    airtime_amount: number; fee_amount: number; total_paid: number
    status: string; created_at: string; use_exact_amount: boolean
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-700 border-amber-200',
        processing: 'bg-blue-100 text-blue-700 border-blue-200',
        completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        failed: 'bg-red-100 text-red-700 border-red-200',
    }
    return (
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize', map[status] || 'bg-slate-100 text-slate-600 border-slate-200')}>
            {status}
        </span>
    )
}

// ─── Success Modal ─────────────────────────────────────────────────────────────
function SuccessModal({ order, onClose, onBuyMore }: { order: AirtimeOrder | null; onClose: () => void; onBuyMore: () => void }) {
    const [copied, setCopied] = useState(false)
    if (!order) return null

    const copy = () => {
        navigator.clipboard.writeText(order.reference_code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Green top bar */}
                <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-green-500" />
                <div className="p-8 text-center">
                    {/* Animated checkmark */}
                    <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
                        <CheckCircle className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Order Placed!</h2>
                    <p className="text-slate-500 text-sm mb-6">Your airtime is being processed</p>

                    {/* Summary card */}
                    <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-left space-y-2.5">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Network</span><span className="font-semibold text-slate-900">{order.network}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Recipient</span><span className="font-semibold text-slate-900">{order.beneficiary_phone}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Airtime</span><span className="font-semibold text-emerald-600">GHS {order.airtime_amount.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Fee</span><span className="font-semibold text-slate-900">GHS {order.fee_amount.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm border-t border-slate-200 pt-2.5 mt-1"><span className="text-slate-500 font-medium">You Paid</span><span className="font-bold text-slate-900">GHS {order.total_paid.toFixed(2)}</span></div>
                    </div>

                    {/* Reference */}
                    <button onClick={copy} className="w-full flex items-center justify-between bg-slate-100 hover:bg-slate-200 rounded-xl px-4 py-3 mb-6 transition-colors group">
                        <div className="text-left">
                            <p className="text-xs text-slate-400 mb-0.5">Reference Code</p>
                            <p className="font-mono font-bold text-slate-800 text-sm">{order.reference_code}</p>
                        </div>
                        <Copy className={cn('w-4 h-4 transition-colors', copied ? 'text-emerald-500' : 'text-slate-400 group-hover:text-slate-600')} />
                    </button>

                    <p className="text-xs text-slate-400 mb-6">The network provider will send a confirmation SMS once the airtime is credited.</p>

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 rounded-xl" onClick={onBuyMore}>Buy More</Button>
                        <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={onClose}>
                            View History <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Confirm Sheet ─────────────────────────────────────────────────────────────
function ConfirmSheet({ open, onCancel, onConfirm, isLoading, details }: {
    open: boolean; onCancel: () => void; onConfirm: () => void; isLoading: boolean
    details: { network: string; phone: string; airtime: number; fee: number; total: number; mode: boolean }
}) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-in slide-in-from-bottom-4 duration-300">
                <div className="h-1.5 bg-gradient-to-r from-slate-700 to-slate-900 rounded-t-3xl" />
                <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Confirm Payment</h3>
                    <p className="text-sm text-slate-500 mb-5">Please review before proceeding</p>
                    <div className="space-y-2.5 mb-6">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Network</span><span className="font-semibold">{details.network}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Recipient</span><span className="font-semibold">{details.phone}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Airtime to send</span><span className="font-semibold text-emerald-600">GHS {details.airtime.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Service fee</span><span className="font-semibold">GHS {details.fee.toFixed(2)}</span></div>
                        <div className="flex justify-between text-sm border-t border-slate-100 pt-2.5 mt-1">
                            <span className="font-bold text-slate-800">Total to Pay</span>
                            <span className="font-bold text-lg text-slate-900">GHS {details.total.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                        <Button
                            className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white"
                            onClick={onConfirm}
                            disabled={isLoading}
                        >
                            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <>Confirm & Pay <ArrowRight className="w-4 h-4 ml-1" /></>}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AirtimePage() {
    const [activeTab, setActiveTab] = useState<'buy' | 'history'>('buy')

    // Settings & wallet
    const [settings, setSettings] = useState<AirtimeSettings | null>(null)
    const [walletBalance, setWalletBalance] = useState<number | null>(null)
    const [userRole, setUserRole] = useState<'customer' | 'agent'>('customer')
    const [settingsLoading, setSettingsLoading] = useState(true)

    // Form state
    const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null)
    const [phone, setPhone] = useState('')
    const [amount, setAmount] = useState('')
    const [useExact, setUseExact] = useState(false)

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [successOrder, setSuccessOrder] = useState<AirtimeOrder | null>(null)

    // History
    const [orders, setOrders] = useState<AirtimeOrder[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // Load settings + wallet
    useEffect(() => {
        const loadData = async () => {
            setSettingsLoading(true)
            try {
                const [settingsRes, walletRes] = await Promise.all([
                    fetch('/api/admin/airtime/settings'),
                    fetch('/api/user/wallet'),
                ])
                if (settingsRes.ok) {
                    const { settings: raw } = await settingsRes.json()
                    setSettings({
                        fee_mtn_customer: parseFloat(raw.airtime_fee_mtn_customer || '5'),
                        fee_mtn_agent: parseFloat(raw.airtime_fee_mtn_agent || '3'),
                        fee_telecel_customer: parseFloat(raw.airtime_fee_telecel_customer || '5'),
                        fee_telecel_agent: parseFloat(raw.airtime_fee_telecel_agent || '3'),
                        fee_at_customer: parseFloat(raw.airtime_fee_at_customer || '5'),
                        fee_at_agent: parseFloat(raw.airtime_fee_at_agent || '3'),
                        min_amount: parseFloat(raw.airtime_min_amount || '1'),
                        max_amount: parseFloat(raw.airtime_max_amount || '500'),
                        enabled_mtn: raw.airtime_enabled_mtn !== 'false',
                        enabled_telecel: raw.airtime_enabled_telecel !== 'false',
                        enabled_at: raw.airtime_enabled_at !== 'false',
                    })
                }
                if (walletRes.ok) {
                    const d = await walletRes.json()
                    setWalletBalance(d.balance ?? d.wallet?.balance ?? 0)
                    setUserRole(d.role === 'agent' ? 'agent' : 'customer')
                }
            } catch (e) { console.error(e) }
            setSettingsLoading(false)
        }
        loadData()
    }, [])

    // History loader
    const loadHistory = useCallback(async () => {
        setHistoryLoading(true)
        try {
            const res = await fetch('/api/airtime/history')
            if (res.ok) {
                const d = await res.json()
                setOrders(d.orders || [])
            }
        } catch (e) { console.error(e) }
        setHistoryLoading(false)
    }, [])

    useEffect(() => {
        if (activeTab === 'history') loadHistory()
    }, [activeTab, loadHistory])

    // Fee calculation
    const getFeeRate = useCallback(() => {
        if (!settings || !selectedNetwork) return 5
        const net = selectedNetwork.toLowerCase().replace('telecel', 'telecel').replace('at', 'at')
        const keyMap: Record<string, string> = { mtn: 'mtn', telecel: 'telecel', at: 'at' }
        const key = `fee_${keyMap[selectedNetwork.toLowerCase()]}_${userRole}` as keyof AirtimeSettings
        return (settings[key] as number) || 5
    }, [settings, selectedNetwork, userRole])

    const parsedAmount = parseFloat(amount) || 0
    const feeRate = getFeeRate()

    let airtimeAmount = 0, feeAmount = 0, totalPaid = 0
    if (parsedAmount > 0) {
        const round2 = (n: number) => Math.round(n * 100) / 100
        if (useExact) {
            airtimeAmount = parsedAmount
            feeAmount = round2(parsedAmount * (feeRate / 100))
            totalPaid = round2(parsedAmount + feeAmount)
        } else {
            totalPaid = parsedAmount
            feeAmount = round2(parsedAmount * (feeRate / 100))
            airtimeAmount = round2(parsedAmount - feeAmount)
        }
    }

    const phoneWarning = phone.length >= 3 ? getNetworkWarning(phone, selectedNetwork) : null
    const isPhoneValid = /^0\d{9}$/.test(phone)
    const isAmountValid = parsedAmount >= (settings?.min_amount || 1) && parsedAmount <= (settings?.max_amount || 500)
    const hasEnoughBalance = walletBalance !== null && totalPaid > 0 && walletBalance >= totalPaid
    const canProceed = selectedNetwork && isPhoneValid && isAmountValid && hasEnoughBalance && !isSubmitting

    // Auto-select network on phone input
    const handlePhoneChange = (val: string) => {
        const clean = val.replace(/\D/g, '')
        setPhone(clean.slice(0, 10))
        if (clean.length >= 3) {
            const auto = detectNetwork(clean)
            if (auto && !selectedNetwork) setSelectedNetwork(auto.id)
        }
    }

    const handleSubmit = async () => {
        if (!canProceed) return
        setIsSubmitting(true)
        setShowConfirm(false)
        try {
            const res = await fetch('/api/airtime/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    beneficiaryPhone: phone,
                    network: selectedNetwork,
                    amount: parsedAmount,
                    useExactAmount: useExact,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Failed to place order')
                return
            }
            if (data.walletBalance !== undefined) setWalletBalance(data.walletBalance)
            else if (data.order?.new_balance !== undefined) setWalletBalance(data.order.new_balance)
            setSuccessOrder(data.order)
            setPhone(''); setAmount(''); setSelectedNetwork(null); setUseExact(false)
        } catch {
            toast.error('An unexpected error occurred. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleBuyMore = () => { setSuccessOrder(null); setActiveTab('buy') }
    const handleSuccessClose = () => { setSuccessOrder(null); setActiveTab('history') }

    if (settingsLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Phone className="w-6 h-6 text-emerald-500" /> Buy Airtime
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Top up any Ghana network instantly from your wallet</p>
            </div>

            {/* Wallet Balance Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-xl">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="relative">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                        <Wallet className="w-4 h-4" /> Wallet Balance
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">
                        GHS {walletBalance !== null ? walletBalance.toFixed(2) : '—'}
                    </div>
                    {walletBalance !== null && walletBalance < 5 && (
                        <div className={cn('flex items-center gap-1.5 text-xs font-medium mt-2', walletBalance < 1 ? 'text-red-400' : 'text-amber-400')}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {walletBalance < 1 ? 'Your balance is too low. Please top up.' : 'Low balance. Consider topping up soon.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                {(['buy', 'history'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            'flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize flex items-center justify-center gap-2',
                            activeTab === tab
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        {tab === 'buy' ? <Phone className="w-4 h-4" /> : <History className="w-4 h-4" />}
                        {tab === 'buy' ? 'Buy Airtime' : 'History'}
                    </button>
                ))}
            </div>

            {/* ── BUY TAB ─────────────────────────────────────────────────────────── */}
            {activeTab === 'buy' && (
                <div className="space-y-6">
                    {/* Network Selector */}
                    <div>
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">Select Network</Label>
                        <div className="grid grid-cols-3 gap-3">
                            {NETWORKS.map(net => {
                                const enabledKey = `enabled_${net.id.toLowerCase()}` as keyof AirtimeSettings
                                const isEnabled = settings ? settings[enabledKey] as boolean : true
                                const isSelected = selectedNetwork === net.id
                                return (
                                    <button
                                        key={net.id}
                                        onClick={() => isEnabled && setSelectedNetwork(net.id)}
                                        disabled={!isEnabled}
                                        className={cn(
                                            'relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-200 font-semibold text-sm',
                                            isSelected
                                                ? `bg-gradient-to-br ${net.gradient} border-transparent shadow-lg scale-[1.03]`
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-400',
                                            !isEnabled && 'opacity-50 cursor-not-allowed grayscale'
                                        )}
                                    >
                                        <NetworkLogo id={net.id} />
                                        <span className={isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-300'}>{net.label}</span>
                                        {!isEnabled && (
                                            <span className="absolute top-2 right-2 bg-slate-200 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-full">OFF</span>
                                        )}
                                        {isSelected && <div className="absolute inset-0 rounded-2xl ring-2 ring-white/40" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Phone input */}
                    <div>
                        <Label htmlFor="beneficiary-phone" className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                            Beneficiary Phone Number
                        </Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                id="beneficiary-phone"
                                type="tel"
                                inputMode="numeric"
                                placeholder="0XXXXXXXXX"
                                value={phone}
                                onChange={e => handlePhoneChange(e.target.value)}
                                className="pl-9 rounded-xl h-12 font-mono text-base"
                                maxLength={10}
                            />
                            {phone.length === 10 && (
                                <div className={cn('absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center', isPhoneValid ? 'bg-emerald-100' : 'bg-red-100')}>
                                    {isPhoneValid
                                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                        : <X className="w-3.5 h-3.5 text-red-600" />
                                    }
                                </div>
                            )}
                        </div>
                        {phoneWarning && (
                            <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {phoneWarning}
                            </p>
                        )}
                        {phone.length > 0 && phone.length < 10 && (
                            <p className="mt-1.5 text-xs text-slate-400">{10 - phone.length} more digits needed</p>
                        )}
                    </div>

                    {/* Quick amounts */}
                    <div>
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">Quick Amount (GHS)</Label>
                        <div className="flex gap-2 flex-wrap">
                            {QUICK_AMOUNTS.map(q => (
                                <button
                                    key={q}
                                    onClick={() => setAmount(String(q))}
                                    className={cn(
                                        'px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all',
                                        amount === String(q)
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                                    )}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom amount */}
                    <div>
                        <Label htmlFor="airtime-amount" className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                            Custom Amount (GHS)
                            {settings && <span className="font-normal text-slate-400 ml-2">Min: {settings.min_amount} · Max: {settings.max_amount}</span>}
                        </Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">GHS</span>
                            <Input
                                id="airtime-amount"
                                type="number"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="pl-12 rounded-xl h-12 text-base font-semibold"
                                min={settings?.min_amount || 1}
                                max={settings?.max_amount || 500}
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* Exact amount checkbox */}
                    <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <Checkbox
                            id="exact-mode"
                            checked={useExact}
                            onCheckedChange={v => setUseExact(!!v)}
                            className="mt-0.5"
                        />
                        <div>
                            <label htmlFor="exact-mode" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                                Send this exact amount — I'll pay more
                            </label>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                <Info className="w-3 h-3 shrink-0" />
                                When checked, recipient gets exactly what you type. You cover the fee on top.
                            </p>
                        </div>
                    </div>

                    {/* Live fee breakdown */}
                    {parsedAmount > 0 && selectedNetwork && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fee Breakdown</p>
                            </div>
                            <div className="p-4 space-y-2.5 text-sm">
                                {useExact ? (
                                    <>
                                        <div className="flex justify-between"><span className="text-slate-500">You type</span><span className="font-semibold">GHS {parsedAmount.toFixed(2)}</span></div>
                                        <div className="flex justify-between text-emerald-600"><span>Beneficiary receives</span><span className="font-bold">GHS {airtimeAmount.toFixed(2)} ✓</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Service fee ({feeRate}%)</span><span className="font-semibold">+ GHS {feeAmount.toFixed(2)}</span></div>
                                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-2.5 mt-1">
                                            <span className="font-bold text-slate-800 dark:text-white">You pay</span>
                                            <span className="font-bold text-lg text-slate-900 dark:text-white">GHS {totalPaid.toFixed(2)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between"><span className="text-slate-500">You type</span><span className="font-semibold">GHS {parsedAmount.toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Service fee ({feeRate}%)</span><span className="font-semibold">– GHS {feeAmount.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 -mx-1">
                                            <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                Beneficiary receives
                                            </span>
                                            <span className="font-bold text-amber-700 dark:text-amber-400">GHS {airtimeAmount.toFixed(2)}</span>
                                        </div>
                                        <p className="text-[11px] text-amber-600 dark:text-amber-500 -mt-1 px-1">Not GHS {parsedAmount.toFixed(2)} — fee deducted. Enable "Send exact" above to avoid this.</p>
                                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-2.5 mt-1">
                                            <span className="font-bold text-slate-800 dark:text-white">You pay</span>
                                            <span className="font-bold text-lg text-slate-900 dark:text-white">GHS {totalPaid.toFixed(2)} ✓</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Wallet warning / Pay button */}
                    {parsedAmount > 0 && !hasEnoughBalance && walletBalance !== null ? (
                        <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Insufficient Balance</p>
                                <p className="text-xs text-red-500">You need GHS {totalPaid.toFixed(2)} but have GHS {walletBalance.toFixed(2)}. Please top up your wallet.</p>
                            </div>
                        </div>
                    ) : (
                        <Button
                            onClick={() => setShowConfirm(true)}
                            disabled={!canProceed}
                            className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                        >
                            {isSubmitting
                                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
                                : parsedAmount > 0
                                    ? <>Pay GHS {totalPaid.toFixed(2)} <ArrowRight className="w-5 h-5 ml-2" /></>
                                    : 'Enter Amount to Continue'
                            }
                        </Button>
                    )}
                </div>
            )}

            {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500">{orders.length} order{orders.length !== 1 ? 's' : ''} found</p>
                        <Button variant="ghost" size="sm" onClick={loadHistory} disabled={historyLoading}>
                            <RefreshCw className={cn('w-4 h-4 mr-1', historyLoading && 'animate-spin')} /> Refresh
                        </Button>
                    </div>

                    {historyLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <Phone className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="font-medium">No airtime orders yet</p>
                            <p className="text-sm">Buy airtime and your orders will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {orders.map(order => (
                                <div key={order.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-300 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-bold text-slate-900 dark:text-white text-sm">{order.network}</span>
                                                <span className="text-slate-400 text-xs">·</span>
                                                <span className="text-slate-500 text-xs font-mono">{order.beneficiary_phone}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 font-mono">{order.reference_code}</p>
                                        </div>
                                        <StatusBadge status={order.status} />
                                    </div>
                                    <div className="flex justify-between text-sm border-t border-slate-100 dark:border-slate-700 pt-3">
                                        <div className="text-center">
                                            <p className="text-xs text-slate-400 mb-0.5">Airtime</p>
                                            <p className="font-bold text-emerald-600">GHS {order.airtime_amount.toFixed(2)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-slate-400 mb-0.5">Fee</p>
                                            <p className="font-semibold text-slate-700 dark:text-slate-300">GHS {order.fee_amount.toFixed(2)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-slate-400 mb-0.5">Paid</p>
                                            <p className="font-bold text-slate-900 dark:text-white">GHS {order.total_paid.toFixed(2)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-slate-400 mb-0.5">Date</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                                {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Overlays */}
            <ConfirmSheet
                open={showConfirm}
                onCancel={() => setShowConfirm(false)}
                onConfirm={handleSubmit}
                isLoading={isSubmitting}
                details={{ network: selectedNetwork || '', phone, airtime: airtimeAmount, fee: feeAmount, total: totalPaid, mode: useExact }}
            />
            <SuccessModal order={successOrder} onClose={handleSuccessClose} onBuyMore={handleBuyMore} />
        </div>
    )
}
