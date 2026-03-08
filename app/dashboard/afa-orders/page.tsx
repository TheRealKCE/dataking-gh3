'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Loader2, ShieldCheck, Plus, Pencil, Clock, CheckCircle2, XCircle, AlertCircle, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

const REGIONS = [
    'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central',
    'Northern', 'Volta', 'Upper East', 'Upper West', 'Bono',
    'Bono East', 'Ahafo', 'Savannah', 'North East', 'Oti', 'Western North'
]

const ID_TYPES = [
    { value: 'Ghana Card', label: 'Ghana Card' },
    { value: 'Passport', label: 'Passport' },
    { value: 'Driver\'s License', label: "Driver's License" },
    { value: 'Voter ID', label: 'Voter ID' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', icon: Clock },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
}

const EMPTY_FORM = {
    full_name: '',
    phone: '',
    id_type: '',
    id_number: '',
    location: '',
    region: 'Greater Accra',
    occupation: 'Farmer',
    notes: ''
}

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
}

export default function AFAOrdersPage() {
    const { dbUser } = useAuth()
    const [applications, setApplications] = useState<AfarOrder[]>([])
    const [formData, setFormData] = useState({ ...EMPTY_FORM })
    const [editingId, setEditingId] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [applicationPrice, setApplicationPrice] = useState(0)
    const [walletBalance, setWalletBalance] = useState(0)
    const [loadingPrice, setLoadingPrice] = useState(true)
    const [loadingApps, setLoadingApps] = useState(true)

    useEffect(() => {
        if (!dbUser) return
        fetchApplications()
        fetchApplicationPrice()
        fetchWalletBalance()
    }, [dbUser])

    const fetchApplications = async () => {
        setLoadingApps(true)
        const { data } = await (supabase
            .from('afa_orders') as any)
            .select('*')
            .eq('user_id', dbUser!.id)
            .order('created_at', { ascending: false })
        setApplications(data || [])
        setLoadingApps(false)
    }

    const fetchApplicationPrice = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('key, value')
                .in('key', ['afa_price_customer', 'afa_price_agent'])
            const settings = (data || []).reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})
            const userRole = dbUser?.role || 'customer'
            const price = userRole === 'agent'
                ? parseFloat(settings?.afa_price_agent || '10')
                : parseFloat(settings?.afa_price_customer || '10')
            setApplicationPrice(price)
        } catch {
            setApplicationPrice(15)
        } finally {
            setLoadingPrice(false)
        }
    }

    const fetchWalletBalance = async () => {
        if (!dbUser?.id) return
        const { data } = await (supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', dbUser.id)
            .single() as any)
        if (data) setWalletBalance(data.balance || 0)
    }

    const openNewForm = () => {
        setFormData({ ...EMPTY_FORM })
        setEditingId(null)
        setShowForm(true)
    }

    const openEditForm = (app: AfarOrder) => {
        // Only allow editing pending applications
        if (app.status !== 'pending') return
        setFormData({
            full_name: app.full_name,
            phone: app.phone,
            id_type: app.id_type || '',
            id_number: app.id_number || app.ghana_card || '',
            location: app.location,
            region: app.region,
            occupation: 'Farmer',
            notes: app.notes || '',
        })
        setEditingId(app.id)
        setShowForm(true)
    }

    const cancelForm = () => {
        setShowForm(false)
        setEditingId(null)
        setFormData({ ...EMPTY_FORM })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            // --- EDIT existing pending order ---
            if (editingId) {
                const { error } = await (supabase.from('afa_orders') as any)
                    .update({
                        ...formData,
                        occupation: 'Farmer',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingId)
                    .eq('status', 'pending') // server-side guard

                if (error) throw error
                toast.success('Application updated successfully!')
                await fetchApplications()
                cancelForm()
                return
            }

            // --- NEW order: check wallet balance ---
            if (walletBalance < applicationPrice) {
                toast.error(`Insufficient balance. You need GHS ${applicationPrice.toFixed(2)} but have GHS ${walletBalance.toFixed(2)}`)
                setIsSubmitting(false)
                return
            }

            const { data: wallet, error: walletError } = await (supabase
                .from('wallets')
                .select('*')
                .eq('user_id', dbUser!.id)
                .single() as any)

            if (walletError || !wallet) {
                toast.error('Failed to access wallet')
                setIsSubmitting(false)
                return
            }

            const newBalance = (wallet as any).balance - applicationPrice
            const { error: debitError } = await (supabase
                .from('wallets') as any)
                .update({
                    balance: newBalance,
                    total_spent: ((wallet as any).total_spent || 0) + applicationPrice,
                    updated_at: new Date().toISOString()
                })
                .eq('id', (wallet as any).id)

            if (debitError) {
                toast.error('Failed to process payment')
                setIsSubmitting(false)
                return
            }

            await (supabase.from('wallet_transactions') as any).insert({
                wallet_id: (wallet as any).id,
                user_id: dbUser?.id,
                type: 'debit',
                amount: applicationPrice,
                description: `MTN AFAR Registration Fee`,
                source: 'afa_application',
                status: 'completed'
            })

            const { error } = await (supabase.from('afa_orders') as any).insert({
                user_id: dbUser?.id,
                ...formData,
                occupation: 'Farmer',
                status: 'pending',
                payment_amount: applicationPrice
            })

            if (error) {
                // Rollback
                await (supabase.from('wallets') as any)
                    .update({
                        balance: (wallet as any).balance,
                        total_spent: (wallet as any).total_spent,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', (wallet as any).id)
                throw error
            }

            toast.success('Registration submitted successfully!')
            setWalletBalance(newBalance)
            await fetchApplications()
            cancelForm()
        } catch (error) {
            console.error('Error submitting application:', error)
            toast.error('Failed to submit registration')
        } finally {
            setIsSubmitting(false)
        }
    }

    const canAfford = walletBalance >= applicationPrice

    if (loadingApps) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-10">

            {/* ─── Hero Header ─── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 p-8 text-white shadow-xl">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-5 h-5 opacity-80" />
                        <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Official Registration</span>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight">MTN AFAR REGISTRATION</h1>
                    <p className="mt-2 text-yellow-100 text-sm max-w-lg">
                        Enroll in the MTN Authorized Field Agent Registration (AFAR) — a 30-day active registration package.
                        Your data will be securely submitted and processed by our team within 24 hours.
                    </p>
                </div>
                {/* Decorative circles */}
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-6 -right-16 w-56 h-56 rounded-full bg-white/5" />
            </div>

            {/* ─── Balance & Fee Summary ─── */}
            {!showForm && (
                <div className="grid grid-cols-2 gap-4">
                    <Card className="border border-yellow-200 dark:border-yellow-900/40 bg-yellow-50/50 dark:bg-yellow-900/10">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Wallet Balance</p>
                                <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">GHS {walletBalance.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Registration Fee</p>
                                <p className="text-xl font-bold">GHS {loadingPrice ? '...' : applicationPrice.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ─── Application List ─── */}
            {!showForm && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold">My Registrations</h2>
                        <Button
                            size="sm"
                            className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1.5"
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
                                <p className="text-sm">No registrations yet. Start your first AFAR application.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        applications.map((app) => {
                            const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
                            const StatusIcon = cfg.icon
                            return (
                                <Card key={app.id} className="shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-4 flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{app.full_name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{app.phone}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {app.id_type || 'Ghana Card'} &mdash; {app.id_number || app.ghana_card}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Submitted {format(new Date(app.created_at), 'dd MMM yyyy, hh:mm a')}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.color}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {cfg.label}
                                            </span>
                                            {app.status === 'pending' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2.5 text-xs gap-1"
                                                    onClick={() => openEditForm(app)}
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                    Edit
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            )}

            {/* ─── Application Form ─── */}
            {showForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>{editingId ? 'Edit Registration' : 'New AFAR Registration'}</CardTitle>
                        <CardDescription>
                            {editingId
                                ? 'Update your details below. You can only edit while the application is pending.'
                                : 'Complete all fields to submit your 30-day AFAR registration package.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Full Name & Phone */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Full Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        required
                                        value={formData.full_name}
                                        onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                                        placeholder="John Kwame Mensah"
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
                                    />
                                </div>
                            </div>

                            {/* ID Type & ID Number */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>ID Type <span className="text-red-500">*</span></Label>
                                    <Select
                                        required
                                        value={formData.id_type}
                                        onValueChange={v => setFormData(p => ({ ...p, id_type: v }))}
                                    >
                                        <SelectTrigger>
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
                                        onChange={e => setFormData(p => ({ ...p, id_number: e.target.value }))}
                                        placeholder={formData.id_type === 'Ghana Card' ? 'GHA-xxxxxxxxx-x' : 'Enter ID number'}
                                    />
                                </div>
                            </div>

                            {/* Region & Location */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Region <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={formData.region}
                                        onValueChange={v => setFormData(p => ({ ...p, region: v }))}
                                    >
                                        <SelectTrigger>
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
                                    />
                                </div>
                            </div>

                            {/* Occupation – locked to Farmer */}
                            <div className="space-y-1.5">
                                <Label>Occupation</Label>
                                <Input
                                    value="Farmer"
                                    readOnly
                                    className="bg-muted cursor-not-allowed text-muted-foreground"
                                />
                            </div>

                            {/* Notes */}
                            <div className="space-y-1.5">
                                <Label>Additional Notes <span className="text-xs text-muted-foreground">(optional)</span></Label>
                                <Input
                                    value={formData.notes}
                                    onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Any extra information..."
                                />
                            </div>

                            {/* ─── Requirements & Verification ─── */}
                            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <AlertDescription>
                                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1.5">
                                        Requirements &amp; Verification
                                    </p>
                                    <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-none">
                                        <li>• Applicants must be <strong>at least 18 years of age</strong> at time of registration.</li>
                                        <li>• A <strong>valid, government-issued Ghana ID</strong> is mandatory to complete registration.</li>
                                        <li>• All submitted applications are verified and processed by our team <strong>within 24 hours</strong>.</li>
                                        <li>• By submitting, you authorize the deduction of <strong>GHS {applicationPrice.toFixed(2)}</strong> from your wallet.</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            {/* Fee Notice for new applications */}
                            {!editingId && (
                                <div className={`rounded-xl p-4 flex items-center gap-3 border ${canAfford
                                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'}`}>
                                    <Wallet className={`w-5 h-5 shrink-0 ${canAfford ? 'text-green-600' : 'text-red-600'}`} />
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
                            )}

                            {/* ─── Action Buttons ─── */}
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={cancelForm}
                                >
                                    Cancel
                                </Button>

                                {/* Submit — hidden if balance insufficient (new applications only) */}
                                {(editingId || canAfford) && (
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                                        disabled={isSubmitting || loadingPrice}
                                    >
                                        {isSubmitting ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                                        ) : editingId ? (
                                            'Save Changes'
                                        ) : (
                                            `Submit & Pay GHS ${applicationPrice.toFixed(2)}`
                                        )}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
