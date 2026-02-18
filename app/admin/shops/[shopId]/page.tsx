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
    Banknote, ExternalLink, Loader2, Save, ShoppingCart, Wallet
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
    is_active: boolean
    fulfillment_mode: 'auto' | 'manual'
    paystack_fee_percent: number | null
    owner_phone: string
    owner_email: string | null
    whatsapp_number: string | null
    created_at: string
    users?: { first_name: string; last_name: string; email: string }
}

interface ShopWallet {
    balance: number
    total_earned: number
    total_withdrawn: number
}

interface WithdrawalRequest {
    id: string
    amount: number
    fee: number
    net_amount: number
    momo_number: string
    status: 'pending' | 'completed' | 'rejected'
    created_at: string
    admin_note: string | null
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
    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
    const [orderCount, setOrderCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [approvalNote, setApprovalNote] = useState('')
    const [feeOverride, setFeeOverride] = useState('')
    const [fulfillmentMode, setFulfillmentMode] = useState<'auto' | 'manual'>('auto')
    const [isActive, setIsActive] = useState(true)

    useEffect(() => {
        if (dbUser && !isAdmin) { router.replace('/dashboard'); return }
        if (dbUser && shopId) fetchData()
    }, [dbUser, isAdmin, shopId])

    const fetchData = async () => {
        try {
            const [shopRes, walletRes, withdrawalRes, ordersRes] = await Promise.all([
                (supabase as any).from('shop_profiles').select('*, users(first_name, last_name, email)').eq('id', shopId).single(),
                (supabase as any).from('shop_wallets').select('*').eq('shop_id', shopId).single(),
                (supabase as any).from('shop_wallet_transactions').select('*').eq('type', 'withdrawal').order('created_at', { ascending: false }).limit(20),
                (supabase as any).from('shop_orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
            ])

            if (shopRes.data) {
                setShop(shopRes.data)
                setApprovalNote(shopRes.data.approval_note || '')
                setFeeOverride(shopRes.data.paystack_fee_percent != null ? String(shopRes.data.paystack_fee_percent) : '')
                setFulfillmentMode(shopRes.data.fulfillment_mode || 'auto')
                setIsActive(shopRes.data.is_active ?? true)
            }
            if (walletRes.data) setWallet(walletRes.data)
            setWithdrawals(withdrawalRes.data || [])
            setOrderCount(ordersRes.count || 0)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const updateApproval = async (status: 'approved' | 'rejected' | 'suspended') => {
        setSaving(true)
        try {
            const { error } = await (supabase as any).from('shop_profiles').update({
                approval_status: status,
                approval_note: approvalNote.trim() || null,
                updated_at: new Date().toISOString(),
            }).eq('id', shopId)
            if (error) throw error
            toast.success(`Shop ${status}`)
            fetchData()
        } catch (err: any) {
            toast.error(err.message || 'Failed to update status')
        } finally {
            setSaving(false)
        }
    }

    const saveSettings = async () => {
        setSaving(true)
        try {
            const { error } = await (supabase as any).from('shop_profiles').update({
                fulfillment_mode: fulfillmentMode,
                is_active: isActive,
                paystack_fee_percent: feeOverride ? parseFloat(feeOverride) : null,
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

    const processWithdrawal = async (withdrawalId: string, action: 'completed' | 'rejected', note?: string) => {
        try {
            const { error } = await (supabase as any).from('shop_wallet_transactions').update({
                status: action,
                admin_note: note || null,
                updated_at: new Date().toISOString(),
            }).eq('id', withdrawalId)
            if (error) throw error

            if (action === 'rejected') {
                // Refund to wallet
                const w = withdrawals.find(w => w.id === withdrawalId)
                if (w && wallet) {
                    await (supabase as any).from('shop_wallets').update({
                        balance: (wallet.balance || 0) + w.amount,
                        updated_at: new Date().toISOString(),
                    }).eq('shop_id', shopId)
                }
            } else if (action === 'completed') {
                // Update total_withdrawn
                const w = withdrawals.find(w => w.id === withdrawalId)
                if (w && wallet) {
                    await (supabase as any).from('shop_wallets').update({
                        total_withdrawn: (wallet.total_withdrawn || 0) + w.amount,
                        updated_at: new Date().toISOString(),
                    }).eq('shop_id', shopId)
                }
            }

            toast.success(`Withdrawal ${action}`)
            fetchData()
        } catch (err: any) {
            toast.error(err.message || 'Failed to process withdrawal')
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

    const owner = shop.users as any
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
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Store className="w-5 h-5 text-emerald-600" />
                        {shop.shop_name}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                        </span>
                        <a href={`/shop/${shop.shop_slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                            /shop/{shop.shop_slug} <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Owner info */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Owner Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{owner?.first_name} {owner?.last_name}</p></div>
                    <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{owner?.email}</p></div>
                    <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{shop.owner_phone}</p></div>
                    <div><p className="text-xs text-muted-foreground">WhatsApp</p><p className="font-medium">{shop.whatsapp_number || '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date(shop.created_at).toLocaleDateString()}</p></div>
                    <div><p className="text-xs text-muted-foreground">Total Orders</p><p className="font-medium">{orderCount}</p></div>
                </CardContent>
            </Card>

            {/* Shop Wallet */}
            <Card className="overflow-hidden border-0 shadow-md">
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4 text-emerald-200" />
                        <p className="text-emerald-100 text-sm font-medium">Shop Wallet</p>
                    </div>
                    <p className="text-3xl font-black">{formatCurrency(wallet?.balance || 0)}</p>
                    <div className="flex gap-4 mt-2 text-xs text-emerald-200">
                        <span>Earned: {formatCurrency(wallet?.total_earned || 0)}</span>
                        <span>Withdrawn: {formatCurrency(wallet?.total_withdrawn || 0)}</span>
                    </div>
                </div>
            </Card>

            {/* Approval Controls */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Approval Controls</CardTitle></CardHeader>
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
                            <CheckCircle2 className="w-4 h-4" /> Approve
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
                            <XCircle className="w-4 h-4" /> Reject
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
                        <Label htmlFor="fee_override">Paystack Fee Override (%) — leave blank to use global default</Label>
                        <Input
                            id="fee_override"
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            value={feeOverride}
                            onChange={(e) => setFeeOverride(e.target.value)}
                            placeholder="e.g. 1.95"
                            className="mt-1 max-w-xs"
                        />
                    </div>

                    <Button onClick={saveSettings} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Settings
                    </Button>
                </CardContent>
            </Card>

            {/* Withdrawal Requests */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Withdrawal Requests</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {withdrawals.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No withdrawal requests.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                        <th className="text-left px-4 py-2 font-medium">Date</th>
                                        <th className="text-right px-4 py-2 font-medium">Amount</th>
                                        <th className="text-right px-4 py-2 font-medium">Net</th>
                                        <th className="text-left px-4 py-2 font-medium">MoMo</th>
                                        <th className="text-left px-4 py-2 font-medium">Status</th>
                                        <th className="text-left px-4 py-2 font-medium">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {withdrawals.map((w) => (
                                        <tr key={w.id} className="border-b last:border-0">
                                            <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(w.amount)}</td>
                                            <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatCurrency(w.net_amount)}</td>
                                            <td className="px-4 py-3 font-mono text-xs">{w.momo_number}</td>
                                            <td className="px-4 py-3">
                                                <span className={cn(
                                                    'text-xs font-semibold px-2 py-0.5 rounded-full',
                                                    w.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                        w.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                            'bg-red-100 text-red-700'
                                                )}>
                                                    {w.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {w.status === 'pending' && (
                                                    <div className="flex gap-1">
                                                        <Button
                                                            size="sm"
                                                            className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                                                            onClick={() => processWithdrawal(w.id, 'completed')}
                                                        >
                                                            Pay
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-2 text-xs border-red-500 text-red-600"
                                                            onClick={() => processWithdrawal(w.id, 'rejected', 'Rejected by admin')}
                                                        >
                                                            Reject
                                                        </Button>
                                                    </div>
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
