'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
    Loader2, ShieldCheck, Plus, Clock, CheckCircle2, XCircle,
    AlertCircle, Wallet, Download, Eye, FileText, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

// ─── Constants ───────────────────────────────────────────
const REGIONS = [
    'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central',
    'Northern', 'Volta', 'Upper East', 'Upper West', 'Bono',
    'Bono East', 'Ahafo', 'Savannah', 'North East', 'Oti', 'Western North',
]

const ID_TYPES = [
    { value: 'Ghana Card', label: 'Ghana Card', placeholder: 'GHA-XXXXXXXXX-X', hint: 'Format: GHA-XXXXXXXXX-X (e.g. GHA-123456789-0)' },
    { value: 'Passport', label: 'Passport', placeholder: 'G1234567', hint: 'Format: Letter followed by 7 digits (e.g. G1234567)' },
    { value: "Driver's License", label: "Driver's License", placeholder: 'DVLA-XXXXXXXXXX', hint: 'Format: DVLA- followed by 10 digits' },
    { value: 'Voter ID', label: 'Voter ID', placeholder: '0123456789', hint: 'Format: 10 digit numeric code' },
]

const ID_PATTERNS: Record<string, RegExp> = {
    'Ghana Card': /^GHA-\d{9}-\d$/,
    'Passport': /^[A-Z]\d{7}$/,
    "Driver's License": /^DVLA-\d{10}$/,
    'Voter ID': /^\d{10}$/,
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; description: string }> = {
    pending: {
        label: 'Pending', icon: Clock,
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
        description: 'Your application has been received and is awaiting review.',
    },
    processing: {
        label: 'Processing', icon: Clock,
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
        description: 'Our team is currently processing your registration.',
    },
    completed: {
        label: 'Completed', icon: CheckCircle2,
        color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
        description: 'Your AFA registration is complete. You are now an authorized field agent.',
    },
    cancelled: {
        label: 'Cancelled', icon: XCircle,
        color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
        description: 'This application was cancelled. Please contact support for more information.',
    },
}

const EMPTY_FORM = {
    full_name: '', phone: '', id_type: '', id_number: '',
    location: '', region: 'Greater Accra', notes: '',
}

// ─── Types ────────────────────────────────────────────────
type AfarOrder = {
    id: string
    full_name: string
    phone: string
    id_type: string
    id_number: string
    ghana_card?: string
    location: string
    region: string
    occupation: string
    status: string
    notes?: string
    payment_amount?: number
    created_at: string
    updated_at?: string
}

// ─── ID Validation ────────────────────────────────────────
function validateId(idType: string, idNumber: string): string | null {
    const pattern = ID_PATTERNS[idType]
    if (!pattern) return null
    if (!pattern.test(idNumber.trim())) {
        const meta = ID_TYPES.find(t => t.value === idType)
        return meta?.hint ?? 'Invalid ID format'
    }
    return null
}

// ─── Receipt Generator ────────────────────────────────────
function downloadReceipt(app: AfarOrder) {
    const idNumber = app.id_number || app.ghana_card || 'N/A'
    const idType = app.id_type || 'Ghana Card'
    const lines = [
        '╔══════════════════════════════════════════════╗',
        '║        MTN AFA REGISTRATION RECEIPT          ║',
        '╚══════════════════════════════════════════════╝',
        '',
        `Application ID   : ${app.id}`,
        `Submitted On     : ${format(new Date(app.created_at), 'dd MMM yyyy, hh:mm a')}`,
        '',
        '── Applicant Details ──────────────────────────',
        `Full Name        : ${app.full_name}`,
        `Phone Number     : ${app.phone}`,
        `ID Type          : ${idType}`,
        `ID Number        : ${idNumber}`,
        `Region           : ${app.region}`,
        `City / Town      : ${app.location}`,
        `Occupation       : ${app.occupation || 'Farmer'}`,
        ...(app.notes ? [`Notes            : ${app.notes}`] : []),
        '',
        '── Payment Summary ────────────────────────────',
        `Registration Fee : GHS ${app.payment_amount?.toFixed(2) ?? '—'}`,
        `Payment Status   : PAID`,
        '',
        '── Application Status ─────────────────────────',
        `Current Status   : ${(app.status || 'pending').toUpperCase()}`,
        '',
        '══════════════════════════════════════════════',
        '  AFA membership is permanent. You do not need',
        '  to register again after completion.',
        '  Processed by: KingFlexy Dashboard',
        '══════════════════════════════════════════════',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `AFA_Receipt_${app.full_name.replace(/\s+/g, '_')}_${app.id.slice(0, 8)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

// ─── Main Page ────────────────────────────────────────────
export default function AFAOrdersPage() {
    const { dbUser } = useAuth()

    // Data state
    const [applications, setApplications] = useState<AfarOrder[]>([])
    const [applicationPrice, setApplicationPrice] = useState(0)
    const [walletBalance, setWalletBalance] = useState(0)
    const [loadingPrice, setLoadingPrice] = useState(true)
    const [loadingApps, setLoadingApps] = useState(true)

    // Form state
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({ ...EMPTY_FORM })
    const [idError, setIdError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)

    // Detail modal state
    const [selectedApp, setSelectedApp] = useState<AfarOrder | null>(null)

    // ── Fetch ──────────────────────────────────────────────
    const fetchApplications = useCallback(async () => {
        if (!dbUser?.id) return
        setLoadingApps(true)
        const { data } = await (supabase.from('afa_orders') as any)
            .select('*')
            .eq('user_id', dbUser.id)
            .order('created_at', { ascending: false })
        setApplications(data || [])
        setLoadingApps(false)
    }, [dbUser?.id])

    const fetchApplicationPrice = useCallback(async () => {
        try {
            const res = await fetch(
                `/api/admin-settings?keys=afa_price_customer,afa_price_agent&t=${Date.now()}`,
                { cache: 'no-store' }
            )
            if (res.ok) {
                const json = await res.json()
                const userRole = dbUser?.role || 'customer'
                const price = userRole === 'agent'
                    ? parseFloat(json?.afa_price_agent || '10')
                    : parseFloat(json?.afa_price_customer || '10')
                setApplicationPrice(isNaN(price) ? 15 : price)
            } else throw new Error()
        } catch {
            try {
                const { data } = await (supabase.from('admin_settings') as any)
                    .select('key, value')
                    .in('key', ['afa_price_customer', 'afa_price_agent'])
                const s: Record<string, string> = (data || []).reduce((acc: any, curr: any) => {
                    acc[curr.key] = curr.value; return acc
                }, {})
                const price = dbUser?.role === 'agent'
                    ? parseFloat(s?.afa_price_agent || '10')
                    : parseFloat(s?.afa_price_customer || '10')
                setApplicationPrice(isNaN(price) ? 15 : price)
            } catch { setApplicationPrice(15) }
        } finally { setLoadingPrice(false) }
    }, [dbUser?.role])

    const fetchWalletBalance = useCallback(async () => {
        if (!dbUser?.id) return
        const { data } = await (supabase.from('wallets')
            .select('balance')
            .eq('user_id', dbUser.id)
            .single() as any)
        if (data) setWalletBalance(data.balance || 0)
    }, [dbUser?.id])

    // ── Init + Real-time subscription ─────────────────────
    useEffect(() => {
        if (!dbUser) return
        fetchApplications()
        fetchApplicationPrice()
        fetchWalletBalance()

        // Live status updates
        // NOTE: No filter here — filtering by user_id on UPDATE events can cause them
        // to be dropped when user_id isn't included in the changed columns of the event.
        // RLS + the ID check below ensures we only process our own orders.
        const channel = supabase
            .channel(`afa_orders_user_${dbUser.id}`)
            .on(
                'postgres_changes' as any,
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'afa_orders',
                },
                (payload: any) => {
                    setApplications(prev =>
                        prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a)
                    )
                    // Keep selected modal in sync
                    setSelectedApp(prev =>
                        prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev
                    )
                    const newStatus = payload.new.status as string
                    const cfg = STATUS_CONFIG[newStatus]
                    if (cfg) {
                        toast.info(`Application status updated to "${cfg.label}"`, {
                            description: cfg.description,
                        })
                    }
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [dbUser, fetchApplications, fetchApplicationPrice, fetchWalletBalance])

    // ── ID Validation ──────────────────────────────────────
    const handleIdNumberChange = (value: string) => {
        setFormData(p => ({ ...p, id_number: value }))
        if (formData.id_type && value.length > 3) {
            setIdError(validateId(formData.id_type, value))
        } else {
            setIdError(null)
        }
    }

    const handleIdTypeChange = (type: string) => {
        setFormData(p => ({ ...p, id_type: type, id_number: '' }))
        setIdError(null)
    }

    // ── Form actions ───────────────────────────────────────
    const openNewForm = () => {
        setFormData({ ...EMPTY_FORM })
        setIdError(null)
        setShowForm(true)
    }

    const cancelForm = () => {
        setShowForm(false)
        setFormData({ ...EMPTY_FORM })
        setIdError(null)
    }

    // Pre-submit validation — shows confirm dialog if passes
    const handlePreSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.id_type) { toast.error('Please select an ID type'); return }
        if (!formData.id_number.trim()) { toast.error('Please enter your ID number'); return }

        const idValidationError = validateId(formData.id_type, formData.id_number)
        if (idValidationError) {
            setIdError(idValidationError)
            toast.error('Invalid ID format', { description: idValidationError })
            return
        }

        setShowConfirmDialog(true)
    }

    // Actual submission after confirm
    const handleConfirmedSubmit = async () => {
        setShowConfirmDialog(false)
        setIsSubmitting(true)

        try {
            if (walletBalance < applicationPrice) {
                toast.error(`Insufficient balance. You need GHS ${applicationPrice.toFixed(2)} but have GHS ${walletBalance.toFixed(2)}`)
                return
            }

            const { data: wallet, error: walletError } = await (supabase
                .from('wallets')
                .select('*')
                .eq('user_id', dbUser!.id)
                .single() as any)

            if (walletError || !wallet) { toast.error('Failed to access wallet'); return }

            const newBalance = (wallet as any).balance - applicationPrice
            const { error: debitError } = await (supabase.from('wallets') as any)
                .update({
                    balance: newBalance,
                    total_spent: ((wallet as any).total_spent || 0) + applicationPrice,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', (wallet as any).id)

            if (debitError) { toast.error('Failed to process payment'); return }

            await (supabase.from('wallet_transactions') as any).insert({
                wallet_id: (wallet as any).id,
                user_id: dbUser?.id,
                type: 'debit',
                amount: applicationPrice,
                description: 'MTN AFA Registration Fee',
                source: 'afa_application',
                status: 'completed',
            })

            const { error } = await (supabase.from('afa_orders') as any).insert({
                user_id: dbUser?.id,
                full_name: formData.full_name,
                phone: formData.phone,
                // Backward-compat: ghana_card may be NOT NULL in the original schema
                ghana_card: formData.id_number,
                id_type: formData.id_type,
                id_number: formData.id_number,
                location: formData.location,
                region: formData.region,
                occupation: 'Farmer',
                notes: formData.notes,
                status: 'pending',
                payment_amount: applicationPrice,
            })

            if (error) {
                // Rollback
                await (supabase.from('wallets') as any)
                    .update({ balance: (wallet as any).balance, total_spent: (wallet as any).total_spent, updated_at: new Date().toISOString() })
                    .eq('id', (wallet as any).id)
                throw error
            }

            toast.success('Registration submitted successfully!', {
                description: 'Our team will process your application within 24 hours.',
            })
            setWalletBalance(newBalance)
            cancelForm()
            fetchApplications()
        } catch (err) {
            console.error(err)
            toast.error('Failed to submit registration')
        } finally {
            setIsSubmitting(false)
        }
    }

    // ── Derived ─────────────────────────────────────────────
    const canAfford = walletBalance >= applicationPrice
    const idMeta = ID_TYPES.find(t => t.value === formData.id_type)

    if (loadingApps) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-10">

            {/* ── Hero Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 p-6 sm:p-8 text-white shadow-xl">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-5 h-5 opacity-80" />
                        <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Official Registration</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">MTN AFA REGISTRATION</h1>
                    <p className="mt-2 text-yellow-100 text-sm max-w-lg leading-relaxed">
                        Enroll in the MTN Authorized Field Agent (AFA) programme.{' '}
                        <strong className="text-white">AFA membership is permanent</strong> — you only need to register once.
                        Your data will be securely submitted and processed by our team within 24 hours.
                    </p>
                </div>
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-6 -right-16 w-56 h-56 rounded-full bg-white/5" />
            </div>

            {/* ── Wallet & Fee Summary ── */}
            {!showForm && (
                <div className="grid grid-cols-2 gap-4">
                    <Card className="border border-yellow-200 dark:border-yellow-900/40 bg-yellow-50/50 dark:bg-yellow-900/10">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
                                <Wallet className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">Wallet Balance</p>
                                <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400 truncate">GHS {walletBalance.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">Registration Fee</p>
                                <p className="text-xl font-bold truncate">GHS {loadingPrice ? '...' : applicationPrice.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Application List ── */}
            {!showForm && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold">My Registrations</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                View your AFA application status and download receipts.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1.5 shrink-0"
                            onClick={openNewForm}
                        >
                            <Plus className="w-4 h-4" />
                            New Registration
                        </Button>
                    </div>

                    {applications.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                                <ShieldCheck className="w-10 h-10 opacity-20" />
                                <p className="text-sm">No registrations yet. Start your first AFA application.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        applications.map((app) => {
                            const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
                            const StatusIcon = cfg.icon
                            return (
                                <Card key={app.id} className="shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        {/* Top row */}
                                        <div className="flex items-start gap-3">
                                            {/* Status icon */}
                                            <div className={cn(
                                                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                                                app.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20' :
                                                app.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/20' :
                                                app.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/20' :
                                                'bg-yellow-100 dark:bg-yellow-900/20'
                                            )}>
                                                <StatusIcon className={cn(
                                                    'w-5 h-5',
                                                    app.status === 'completed' ? 'text-green-600' :
                                                    app.status === 'cancelled' ? 'text-red-600' :
                                                    app.status === 'processing' ? 'text-blue-600' :
                                                    'text-yellow-600'
                                                )} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                                    <div>
                                                        <p className="font-semibold leading-tight">{app.full_name}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">{app.phone}</p>
                                                    </div>
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0',
                                                        cfg.color
                                                    )}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {cfg.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {app.id_type || 'Ghana Card'} · {app.id_number || app.ghana_card} · {app.location}, {app.region}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Submitted {format(new Date(app.created_at), 'dd MMM yyyy, hh:mm a')}
                                                </p>
                                                {/* Status description */}
                                                <p className="text-xs italic text-muted-foreground/80 mt-1">{cfg.description}</p>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex gap-2 mt-3 pt-3 border-t flex-wrap">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 h-8 text-xs"
                                                onClick={() => setSelectedApp(app)}
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                View Details
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 h-8 text-xs text-yellow-700 border-yellow-300 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-800 dark:hover:bg-yellow-900/20"
                                                onClick={() => downloadReceipt(app)}
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                Receipt
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            )}

            {/* ── Application Form ── */}
            {showForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>New AFA Registration</CardTitle>
                        <CardDescription>
                            Complete all fields carefully. AFA membership is permanent — you only need to register once.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePreSubmit} className="space-y-5">

                            {/* Full Name & Phone */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Full Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        required
                                        value={formData.full_name}
                                        onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                                        placeholder="John Kwame Mensah"
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Phone Number <span className="text-red-500">*</span></Label>
                                    <Input
                                        required
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                        placeholder="024xxxxxxx"
                                        className="h-11"
                                    />
                                </div>
                            </div>

                            {/* ID Type & ID Number */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>ID Type <span className="text-red-500">*</span></Label>
                                    <Select
                                        required
                                        value={formData.id_type}
                                        onValueChange={handleIdTypeChange}
                                    >
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Select ID type..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ID_TYPES.map(t => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>ID Number <span className="text-red-500">*</span></Label>
                                    <Input
                                        required
                                        value={formData.id_number}
                                        onChange={e => handleIdNumberChange(e.target.value)}
                                        placeholder={idMeta?.placeholder ?? 'Enter ID number'}
                                        className={cn('h-11', idError ? 'border-red-500 focus-visible:ring-red-500' : '')}
                                    />
                                    {/* Format hint */}
                                    {idMeta?.hint && !idError && (
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> {idMeta.hint}
                                        </p>
                                    )}
                                    {/* Validation error */}
                                    {idError && (
                                        <p className="text-[11px] text-red-500 flex items-center gap-1">
                                            <XCircle className="w-3 h-3" /> {idError}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Region & Location */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Region <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={formData.region}
                                        onValueChange={v => setFormData(p => ({ ...p, region: v }))}
                                    >
                                        <SelectTrigger className="h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {REGIONS.map(r => (
                                                <SelectItem key={r} value={r}>{r}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>City / Town <span className="text-red-500">*</span></Label>
                                    <Input
                                        required
                                        value={formData.location}
                                        onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                                        placeholder="e.g. Kumasi"
                                        className="h-11"
                                    />
                                </div>
                            </div>

                            {/* Occupation — locked */}
                            <div className="space-y-1.5">
                                <Label>Occupation</Label>
                                <Input
                                    value="Farmer"
                                    readOnly
                                    className="bg-muted cursor-not-allowed text-muted-foreground h-11"
                                />
                            </div>

                            {/* Notes */}
                            <div className="space-y-1.5">
                                <Label>Additional Notes <span className="text-xs text-muted-foreground">(optional)</span></Label>
                                <Input
                                    value={formData.notes}
                                    onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Any extra information..."
                                    className="h-11"
                                />
                            </div>

                            {/* Requirements */}
                            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <AlertDescription>
                                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1.5">Requirements &amp; Verification</p>
                                    <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                                        <li>• Applicants must be <strong>at least 18 years of age</strong> at time of registration.</li>
                                        <li>• A <strong>valid, government-issued Ghana ID</strong> is mandatory to complete registration.</li>
                                        <li>• All submitted applications are verified by our team <strong>within 24 hours</strong>.</li>
                                        <li>• By submitting, you authorize the deduction of <strong>GHS {applicationPrice.toFixed(2)}</strong> from your wallet.</li>
                                        <li>• <strong>AFA membership is permanent</strong> — you do not need to register again after completion.</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            {/* ── Pre-Submit Warning ── */}
                            <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
                                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                                        Verify Your Details Before Submitting
                                    </p>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                        Once submitted, your application cannot be edited. <strong>Incorrect details may lead to cancellation</strong> and your payment may not be refundable. Please review all fields carefully.
                                    </p>
                                </div>
                            </div>

                            {/* Balance check */}
                            <div className={cn(
                                'rounded-xl p-4 flex items-center gap-3 border',
                                canAfford
                                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                            )}>
                                <Wallet className={cn('w-5 h-5 shrink-0', canAfford ? 'text-green-600' : 'text-red-600')} />
                                <div className="text-sm">
                                    {canAfford ? (
                                        <>
                                            <span className="font-medium text-green-800 dark:text-green-300">Balance after payment: </span>
                                            <span className="font-bold text-green-700 dark:text-green-400">GHS {(walletBalance - applicationPrice).toFixed(2)}</span>
                                        </>
                                    ) : (
                                        <span className="font-medium text-red-800 dark:text-red-300">
                                            Insufficient balance. Please top up at least GHS {(applicationPrice - walletBalance).toFixed(2)} to proceed.
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
                                <Button type="button" variant="outline" className="flex-1 h-11" onClick={cancelForm}>
                                    Cancel
                                </Button>
                                {canAfford && (
                                    <Button
                                        type="submit"
                                        className="flex-1 h-11 bg-yellow-500 hover:bg-yellow-600 text-white font-bold gap-2"
                                        disabled={isSubmitting || loadingPrice || !!idError}
                                    >
                                        {isSubmitting ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                                        ) : (
                                            <><ShieldCheck className="w-4 h-4" /> Submit &amp; Pay GHS {applicationPrice.toFixed(2)}</>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* ──────────────────────────────────────────────────────
                Confirmation Dialog
            ────────────────────────────────────────────────────── */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Confirm Submission
                        </DialogTitle>
                        <DialogDescription>
                            Please review the details below before proceeding. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        {/* Summary of details */}
                        <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
                            {[
                                { label: 'Full Name', value: formData.full_name },
                                { label: 'Phone', value: formData.phone },
                                { label: 'ID Type', value: formData.id_type },
                                { label: 'ID Number', value: formData.id_number },
                                { label: 'Region', value: formData.region },
                                { label: 'City / Town', value: formData.location },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs font-medium w-24 shrink-0">{row.label}</span>
                                    <span className="font-semibold text-right break-all">{row.value || '—'}</span>
                                </div>
                            ))}
                        </div>

                        {/* Payment line */}
                        <div className="flex justify-between items-center px-1">
                            <span className="text-sm font-medium">Registration Fee</span>
                            <span className="font-black text-lg text-yellow-600">GHS {applicationPrice.toFixed(2)}</span>
                        </div>

                        {/* Final warning */}
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                                Incorrect details may lead to cancellation. Once submitted, this application
                                cannot be edited and your payment may not be refunded.
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setShowConfirmDialog(false)} className="flex-1">
                            Go Back &amp; Edit
                        </Button>
                        <Button
                            onClick={handleConfirmedSubmit}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold gap-2"
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                                : <><ShieldCheck className="w-4 h-4" /> Confirm &amp; Pay</>
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ──────────────────────────────────────────────────────
                Application Detail Modal
            ────────────────────────────────────────────────────── */}
            <Dialog open={!!selectedApp} onOpenChange={(open) => { if (!open) setSelectedApp(null) }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    {selectedApp && (() => {
                        const cfg = STATUS_CONFIG[selectedApp.status] || STATUS_CONFIG.pending
                        const StatusIcon = cfg.icon
                        const idNumber = selectedApp.id_number || selectedApp.ghana_card || 'N/A'
                        const idType = selectedApp.id_type || 'Ghana Card'

                        return (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-yellow-500" />
                                        Application Details
                                    </DialogTitle>
                                    <DialogDescription>
                                        Submitted {format(new Date(selectedApp.created_at), 'dd MMM yyyy, hh:mm a')}
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Status Banner */}
                                <div className={cn(
                                    'rounded-xl p-4 flex items-center gap-3 border',
                                    selectedApp.status === 'completed' ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' :
                                    selectedApp.status === 'cancelled' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
                                    selectedApp.status === 'processing' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' :
                                    'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                                )}>
                                    <StatusIcon className="w-5 h-5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={cn('text-sm font-bold uppercase', cfg.color.replace(/bg-\S+ /, ''))}>
                                                {cfg.label}
                                            </span>
                                            {selectedApp.payment_amount != null && (
                                                <span className="text-xs text-muted-foreground">· Fee Paid: GHS {selectedApp.payment_amount.toFixed(2)}</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                                    </div>
                                </div>

                                {/* Application Fields */}
                                <div className="rounded-xl border bg-muted/30 dark:bg-muted/10 divide-y overflow-hidden">
                                    {[
                                        { label: 'Full Name', value: selectedApp.full_name },
                                        { label: 'Phone Number', value: selectedApp.phone },
                                        { label: 'ID Type', value: idType },
                                        { label: 'ID Number', value: idNumber },
                                        { label: 'Region', value: selectedApp.region },
                                        { label: 'City / Town', value: selectedApp.location },
                                        { label: 'Occupation', value: selectedApp.occupation || 'Farmer' },
                                        ...(selectedApp.notes ? [{ label: 'Notes', value: selectedApp.notes }] : []),
                                        { label: 'Application ID', value: selectedApp.id },
                                    ].map(row => (
                                        <div key={row.label} className="flex items-center justify-between px-4 py-3 gap-3">
                                            <p className="text-xs font-medium text-muted-foreground w-28 shrink-0">{row.label}</p>
                                            <p className="text-sm font-semibold text-right break-all">{row.value || '—'}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Download Receipt Button */}
                                <Button
                                    className="w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold"
                                    onClick={() => downloadReceipt(selectedApp)}
                                >
                                    <Download className="w-4 h-4" />
                                    Download Receipt (.txt)
                                </Button>

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setSelectedApp(null)} className="w-full">
                                        Close
                                    </Button>
                                </DialogFooter>
                            </>
                        )
                    })()}
                </DialogContent>
            </Dialog>

        </div>
    )
}
