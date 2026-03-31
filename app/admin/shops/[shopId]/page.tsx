'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Store, ArrowLeft, CheckCircle2, XCircle, AlertCircle, Clock,
    ExternalLink, Loader2, Save, Wallet, Tag, MessageCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ShopDetail {
    id: string
    shop_name: string
    shop_slug: string
    owner_id: string
    approval_status: 'pending' | 'approved' | 'rejected' | 'suspended'
    approval_note: string | null
    pricing_status: 'not_submitted' | 'pending_review' | 'approved' | 'rejected'
    pricing_note: string | null
    is_active: boolean
    fulfillment_mode: 'auto' | 'manual'
    paystack_fee_percent: number | null
    owner_phone: string
    owner_email: string | null
    whatsapp_number: string | null
    created_at: string
    owner?: { first_name: string; last_name: string; email: string; role: string }
}

interface ShopWallet {
    balance: number
    total_earned: number
    total_withdrawn: number
}


interface PendingPrice {
    package_id: string
    selling_price: number
    submitted_at: string
    data_packages: { network: string; size: string; price: number; agent_price: number }
}

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    approved: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
    suspended: { label: 'Suspended', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
}

export default function AdminShopDetailPage() {
    const { dbUser, isAdmin } = useAuth()
    const router = useRouter()
    const params = useParams()
    const shopId = params.shopId as string

    const [shop, setShop] = useState<ShopDetail | null>(null)
    const [wallet, setWallet] = useState<ShopWallet | null>(null)
    const [pendingPrices, setPendingPrices] = useState<PendingPrice[]>([])
    const [orderCount, setOrderCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [pricingAction, setPricingAction] = useState<'approving' | 'rejecting' | null>(null)

    const [approvalNote, setApprovalNote] = useState('')
    const [pricingNote, setPricingNote] = useState('')
    const [feeOverride, setFeeOverride] = useState('')
    const [withdrawFeePercent, setWithdrawFeePercent] = useState('')
    const [withdrawFeeFlat, setWithdrawFeeFlat] = useState('')
    const [minWithdrawAmount, setMinWithdrawAmount] = useState('')
    const [fulfillmentMode, setFulfillmentMode] = useState<'auto' | 'manual'>('auto')
    const [isActive, setIsActive] = useState(true)

    useEffect(() => {
        if (dbUser && !isAdmin) { router.replace('/dashboard'); return }
        if (dbUser && shopId) fetchData()
    }, [dbUser, isAdmin, shopId])

    const fetchData = async () => {
        try {
            const [shopRes, walletRes, withdrawalRes, ordersRes, pendingRes] = await Promise.all([
                // Fix: explicit FK to avoid ambiguous relationship error
                (supabase as any).from('shop_profiles')
                    .select('*, owner:users!shop_profiles_owner_id_fkey(first_name, last_name, email, role)')
                    .eq('id', shopId).single(),
                (supabase as any).from('shop_wallets').select('*').eq('owner_id',
                    // We'll get owner_id after shop loads — fetch by shop_id workaround
                    // Actually fetch after shop loads
                    'placeholder'
                ).single(),
                (supabase as any).from('shop_wallet_transactions').select('*')
                    .eq('type', 'withdrawal').order('created_at', { ascending: false }).limit(20),
                (supabase as any).from('shop_orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
                (supabase as any).from('shop_pricing_pending')
                    .select('*, data_packages(network, size, price, agent_price)')
                    .eq('shop_id', shopId)
                    .order('submitted_at', { ascending: false }),
            ])

            if (shopRes.data) {
                const s = shopRes.data
                setShop(s)
                setApprovalNote(s.approval_note || '')
                setPricingNote(s.pricing_note || '')
                setFeeOverride(s.paystack_fee_percent != null ? String(s.paystack_fee_percent) : '')
                setWithdrawFeePercent(s.withdrawal_fee_percent != null ? String(s.withdrawal_fee_percent) : '')
                setWithdrawFeeFlat(s.withdrawal_fee_flat != null ? String(s.withdrawal_fee_flat) : '')
                setMinWithdrawAmount(s.min_withdrawal_amount != null ? String(s.min_withdrawal_amount) : '')
                setFulfillmentMode(s.fulfillment_mode || 'auto')
                setIsActive(s.is_active ?? true)

                // Now fetch wallet by owner_id
                const walletRes2 = await (supabase as any).from('shop_wallets').select('*').eq('owner_id', s.owner_id).single()
                if (walletRes2.data) setWallet(walletRes2.data)
            }
            setOrderCount(ordersRes.count || 0)
            setPendingPrices(pendingRes.data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const updateApproval = async (status: 'approved' | 'rejected' | 'suspended') => {
        setSaving(true)
        try {
            const updates: any = {
                approval_status: status,
                approval_note: approvalNote.trim() || null,
                updated_at: new Date().toISOString(),
            }
            if (status === 'approved') {
                updates.pricing_status = 'not_submitted'
                updates.is_active = false
            }
            const { error } = await (supabase as any).from('shop_profiles').update(updates).eq('id', shopId)
            if (error) throw error
            toast.success(`Shop ${status}`)
            fetchData()

            // Alerts 5 & 6 — profile approved/rejected SMS + Email (non-blocking)
            if ((status === 'approved' || status === 'rejected') && shop && owner) {
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: status === 'approved' ? 'profile_approved' : 'profile_rejected',
                        payload: {
                            phone: shop.owner_phone,
                            firstName: owner.first_name,
                            email: owner.email,
                            shopName: shop.shop_name,
                            reason: status === 'rejected' ? (approvalNote.trim() || 'Please check your dashboard for details.') : undefined,
                        },
                    }),
                }).catch(err => console.warn('[ShopAlert]', err))
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to update status')
        } finally {
            setSaving(false)
        }
    }

    const approvePricing = async () => {
        if (pendingPrices.length === 0) {
            toast.error('No pending prices to approve')
            return
        }
        setPricingAction('approving')
        try {
            // 1. Delete current live prices for this shop
            await (supabase as any).from('shop_pricing').delete().eq('shop_id', shopId)

            // 2. Copy pending prices to live pricing table
            const liveRows = pendingPrices.map(p => ({
                shop_id: shopId,
                package_id: p.package_id,
                selling_price: p.selling_price,
            }))
            const { error: insertErr } = await (supabase as any).from('shop_pricing').insert(liveRows)
            if (insertErr) throw insertErr

            // 3. Clear pending prices
            await (supabase as any).from('shop_pricing_pending').delete().eq('shop_id', shopId)

            // 4. Update shop profile
            const { error } = await (supabase as any).from('shop_profiles').update({
                pricing_status: 'approved',
                pricing_note: null,
                pricing_approved_at: new Date().toISOString(),
                pricing_approved_by: dbUser?.id,
                is_active: true,
                updated_at: new Date().toISOString(),
            }).eq('id', shopId)
            if (error) throw error

            toast.success('Pricing approved! Shop is now live.')
            fetchData()

            // Alert 3 — SMS + Email to owner (non-blocking)
            if (shop && owner) {
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'pricing_approved',
                        payload: { phone: shop.owner_phone, firstName: owner.first_name, email: owner.email, shopName: shop.shop_name },
                    }),
                }).catch(err => console.warn('[ShopAlert]', err))
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to approve pricing')
        } finally {
            setPricingAction(null)
        }
    }

    const rejectPricing = async () => {
        if (!pricingNote.trim()) {
            toast.error('Please add a rejection note for the shop owner')
            return
        }
        setPricingAction('rejecting')
        try {
            const { error } = await (supabase as any).from('shop_profiles').update({
                pricing_status: 'rejected',
                pricing_note: pricingNote.trim(),
                pricing_rejection_acknowledged: false,
                updated_at: new Date().toISOString(),
            }).eq('id', shopId)
            if (error) throw error
            toast.success('Pricing rejected. Owner will be notified.')
            fetchData()

            // Alert 4 — SMS + Email to owner (non-blocking)
            if (shop && owner) {
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'pricing_rejected',
                        payload: { phone: shop.owner_phone, firstName: owner.first_name, email: owner.email, shopName: shop.shop_name, reason: pricingNote.trim() },
                    }),
                }).catch(err => console.warn('[ShopAlert]', err))
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to reject pricing')
        } finally {
            setPricingAction(null)
        }
    }

    const saveSettings = async () => {
        setSaving(true)
        try {
            // Fee override parsing rule:
            // - Blank ("") → null  → means "Inherit from Global Settings for this shop's owner role"
            // - "0"        → 0     → means "Deliberately free for this shop"
            // - any number → that exact number as an override
            const parseOverride = (val: string): number | null => {
                const trimmed = val.trim()
                if (trimmed === '' || trimmed === null) return null
                const parsed = parseFloat(trimmed)
                return isNaN(parsed) ? null : parsed
            }

            const { error } = await (supabase as any).from('shop_profiles').update({
                fulfillment_mode:       fulfillmentMode,
                is_active:              isActive,
                paystack_fee_percent:   parseOverride(feeOverride),
                withdrawal_fee_percent: parseOverride(withdrawFeePercent),
                withdrawal_fee_flat:    parseOverride(withdrawFeeFlat),
                min_withdrawal_amount:  parseOverride(minWithdrawAmount),
                updated_at: new Date().toISOString(),
            }).eq('id', shopId)
            if (error) throw error
            toast.success('Settings saved')
            fetchData()
        } catch (err: any) {
            toast.error(err.message || 'Failed to save settings')
        } finally {
            setSaving(false)
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

    if (!shop) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Shop not found.</p>
                <Link href="/admin/shops"><Button variant="outline" className="mt-4">Back to Shops</Button></Link>
            </div>
        )
    }

    const owner = shop.owner as any
    const cfg = statusConfig[shop.approval_status]
    const Icon = cfg.icon

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href="/admin/shops">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Store className="w-5 h-5 text-emerald-600" />
                        {shop.shop_name}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                        </span>
                        <a href={`/shop/${shop.shop_slug}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                            /shop/{shop.shop_slug} <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Owner info + WhatsApp */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Owner Details</CardTitle>
                        {shop.whatsapp_number && (
                            <a
                                href={`https://wa.me/${shop.whatsapp_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Button size="sm" className="h-8 text-xs bg-[#25D366] hover:bg-[#1ebe5d] text-white gap-1.5">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    WhatsApp Owner
                                </Button>
                            </a>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{owner?.first_name} {owner?.last_name}</p></div>
                    <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{owner?.email}</p></div>
                    <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{shop.owner_phone}</p></div>
                    <div><p className="text-xs text-muted-foreground">WhatsApp</p><p className="font-medium">{shop.whatsapp_number || '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date(shop.created_at).toLocaleDateString()}</p></div>
                    <div><p className="text-xs text-muted-foreground">Total Orders</p><p className="font-medium">{orderCount}</p></div>
                </CardContent>
            </Card>

            {/* Profit Wallet */}
            <Card className="overflow-hidden border-0 shadow-md">
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4 text-emerald-200" />
                        <p className="text-emerald-100 text-sm font-medium">Profit Wallet</p>
                    </div>
                    <p className="text-3xl font-black">{formatCurrency(wallet?.balance || 0)}</p>
                    <div className="flex gap-4 mt-2 text-xs text-emerald-200">
                        <span>Earned: {formatCurrency(wallet?.total_earned || 0)}</span>
                        <span>Withdrawn: {formatCurrency(wallet?.total_withdrawn || 0)}</span>
                    </div>
                </div>
            </Card>

            {/* Stage 2: Pricing Review Panel */}
            {shop.approval_status === 'approved' && shop.pricing_status === 'pending_review' && (
                <Card className="border-purple-200 dark:border-purple-800">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400">
                            <Tag className="w-4 h-4" />
                            Pricing Review — Action Required
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            The shop owner has submitted their pricing for review. Review the prices below and approve or reject.
                        </p>

                        {/* Pricing table */}
                        <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 border-b text-xs text-muted-foreground">
                                        <th className="text-left px-3 py-2 font-medium">Package</th>
                                        <th className="text-right px-3 py-2 font-medium">Cost</th>
                                        <th className="text-right px-3 py-2 font-medium">Selling</th>
                                        <th className="text-right px-3 py-2 font-medium">Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingPrices.map(p => {
                                        const pkg = p.data_packages as any
                                        // Agents get the agent_price, others get regular price
                                        const isAgent = owner?.role === 'agent'
                                        const cost = (isAgent && pkg?.agent_price > 0) ? pkg.agent_price : (pkg?.price || 0)
                                        const profit = p.selling_price - cost
                                        return (
                                            <tr key={p.package_id} className="border-b last:border-0">
                                                <td className="px-3 py-2 font-medium">{pkg?.network} {pkg?.size}</td>
                                                <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(cost)}</td>
                                                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(p.selling_price)}</td>
                                                <td className={cn('px-3 py-2 text-right font-bold', profit > 0 ? 'text-emerald-600' : 'text-red-600')}>
                                                    {profit > 0 ? '+' : ''}{formatCurrency(profit)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Rejection note */}
                        <div>
                            <Label htmlFor="pricing_note">Rejection Note (required if rejecting)</Label>
                            <Textarea
                                id="pricing_note"
                                value={pricingNote}
                                onChange={(e) => setPricingNote(e.target.value)}
                                placeholder="Explain why the pricing was rejected so the owner can revise..."
                                rows={2}
                                className="mt-1"
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={approvePricing}
                                disabled={!!pricingAction}
                                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                            >
                                {pricingAction === 'approving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Approve Pricing
                            </Button>
                            <Button
                                onClick={rejectPricing}
                                disabled={!!pricingAction}
                                variant="outline"
                                className="border-red-500 text-red-600 hover:bg-red-50 gap-1.5"
                            >
                                {pricingAction === 'rejecting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                Reject Pricing
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Approval Controls */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Profile Approval Controls</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="approval_note">Admin Note (shown to shop owner)</Label>
                        <Textarea
                            id="approval_note"
                            value={approvalNote}
                            onChange={(e) => setApprovalNote(e.target.value)}
                            placeholder="Reason for rejection/suspension, or approval message..."
                            rows={2}
                            className="mt-1"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() => updateApproval('approved')}
                            disabled={saving || shop.approval_status === 'approved'}
                            className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Approve Profile
                        </Button>
                        <Button
                            onClick={() => updateApproval('suspended')}
                            disabled={saving || shop.approval_status === 'suspended'}
                            variant="outline"
                            className="border-orange-500 text-orange-600 hover:bg-orange-50 gap-1.5"
                        >
                            <AlertCircle className="w-4 h-4" /> Suspend
                        </Button>
                        <Button
                            onClick={() => updateApproval('rejected')}
                            disabled={saving || shop.approval_status === 'rejected'}
                            variant="outline"
                            className="border-red-500 text-red-600 hover:bg-red-50 gap-1.5"
                        >
                            <XCircle className="w-4 h-4" /> Reject Profile
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Shop Settings */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Shop Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                            <p className="text-sm font-medium">Shop Active</p>
                            <p className="text-xs text-muted-foreground">Toggle to hide shop without changing approval status</p>
                        </div>
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                            <p className="text-sm font-medium">Auto Fulfillment</p>
                            <p className="text-xs text-muted-foreground">Auto-fulfill orders via DataKazina API</p>
                        </div>
                        <Switch
                            checked={fulfillmentMode === 'auto'}
                            onCheckedChange={(v) => setFulfillmentMode(v ? 'auto' : 'manual')}
                        />
                    </div>

                    <div>
                        <Label htmlFor="fee_override">Paystack Fee Override (%)</Label>
                        <Input
                            id="fee_override"
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            value={feeOverride}
                            onChange={(e) => setFeeOverride(e.target.value)}
                            placeholder="Blank = Inherits Global Rate"
                            className="mt-1 max-w-xs"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Leave blank to inherit the global rate for this owner's role. Enter <strong>0</strong> to waive the fee entirely for this shop.
                        </p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/40 border border-dashed text-xs text-muted-foreground mb-1">
                        <strong>Note:</strong> Blank = Inherits rate from Global Settings (based on owner's role). &nbsp;|&nbsp; <strong>0</strong> = Fee deliberately waived for this shop.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="withdraw_fee_percent">Withdrawal Fee (%) Override</Label>
                            <Input
                                id="withdraw_fee_percent"
                                type="number"
                                min="0"
                                max="50"
                                step="0.1"
                                value={withdrawFeePercent}
                                onChange={(e) => setWithdrawFeePercent(e.target.value)}
                                placeholder="Blank = Inherits Global Rate"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="withdraw_fee_flat">Withdrawal Flat Fee (GHS) Override</Label>
                            <Input
                                id="withdraw_fee_flat"
                                type="number"
                                min="0"
                                step="0.01"
                                value={withdrawFeeFlat}
                                onChange={(e) => setWithdrawFeeFlat(e.target.value)}
                                placeholder="Blank = Inherits Global Rate"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="min_withdraw">Min Withdrawal (GHS) Override</Label>
                            <Input
                                id="min_withdraw"
                                type="number"
                                min="0"
                                step="0.01"
                                value={minWithdrawAmount}
                                onChange={(e) => setMinWithdrawAmount(e.target.value)}
                                placeholder="Blank = Inherits Global Rate"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <Button onClick={saveSettings} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Settings
                    </Button>
                </CardContent>
            </Card>

        </div>
    )
}
