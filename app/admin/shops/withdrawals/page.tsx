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
import { Skeleton } from '@/components/ui/skeleton'
import {
    Store, ArrowLeft, CheckCircle2, XCircle, Clock,
    Banknote, Filter, Search, Calendar, Loader2,
    Receipt, History
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface WithdrawalRequest {
    id: string
    amount: number
    fee: number
    net_amount: number
    account_name: string
    momo_number: string
    network: string | null
    balance_snapshot: number | null
    description: string
    status: 'pending' | 'completed' | 'rejected'
    type: 'profit' | 'withdrawal'
    created_at: string
    admin_note: string | null
    shop_wallet_id: string
    shop_order_id?: string
    shop: {
        shop_name: string
        owner_id: string
        owner_name: string
        owner_email: string
        owner_phone: string
    }
    order?: {
        network: string
        package_size: string
        guest_phone: string
        paystack_reference: string
        profit: number
    }
}

interface ShopOption {
    id: string
    shop_name: string
    owner_id: string
    owner_phone: string
    owner: {
        first_name: string
        last_name: string
        email: string
    }
}

export default function AdminWithdrawalsPage() {
    const { dbUser, isAdmin } = useAuth()
    const router = useRouter()

    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
    const [credits, setCredits] = useState<WithdrawalRequest[]>([])
    const [shops, setShops] = useState<ShopOption[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    // View Toggle
    const [activeTab, setActiveTab] = useState<'withdrawals' | 'credits'>('withdrawals')

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [shopFilter, setShopFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (dbUser && !isAdmin) { router.replace('/dashboard'); return }
        if (dbUser) {
            fetchShops()
        }
    }, [dbUser, isAdmin])

    const fetchShops = async () => {
        const { data } = await (supabase as any)
            .from('shop_profiles')
            .select('id, shop_name, owner_id, owner_phone, owner:users!shop_profiles_owner_id_fkey(first_name, last_name, email)')
            .order('shop_name')
        setShops(data || [])
    }

    const fetchWithdrawals = async () => {
        setLoading(true)
        try {
            let query = (supabase as any)
                .from('shop_wallet_transactions')
                .select(`
                    *,
                    wallet:shop_wallets!inner(
                        owner_id
                    )
                `)
                .eq('type', 'withdrawal')
                .order('created_at', { ascending: false })

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }

            const { data, error } = await query
            if (error) throw error

            const enrichedData = data.map((w: any) => {
                const shop = shops.find(s => s.owner_id === w.wallet.owner_id)
                return {
                    ...w,
                    shop: shop ? {
                        shop_name: shop.shop_name,
                        owner_id: shop.owner_id,
                        owner_name: `${shop.owner?.first_name} ${shop.owner?.last_name}`,
                        owner_email: shop.owner?.email,
                        owner_phone: shop.owner_phone
                    } : {
                        shop_name: 'Unknown Shop',
                        owner_id: w.wallet.owner_id,
                        owner_name: 'Unknown',
                        owner_email: '',
                        owner_phone: ''
                    }
                }
            })

            setWithdrawals(enrichedData)
        } catch (err) {
            console.error('[fetchWithdrawals]', err)
            toast.error('Failed to load withdrawals')
        } finally {
            setLoading(false)
        }
    }

    const fetchCredits = async () => {
        setLoading(true)
        try {
            // Fetch credits with joined order details
            let query = (supabase as any)
                .from('shop_wallet_transactions')
                .select(`
                    *,
                    wallet:shop_wallets!inner(
                        owner_id
                    ),
                    order:shop_orders(
                        network,
                        package_size,
                        guest_phone,
                        paystack_reference,
                        profit
                    )
                `)
                .eq('type', 'profit')
                .order('created_at', { ascending: false })

            const { data, error } = await query
            if (error) throw error

            const enrichedData = data.map((c: any) => {
                const shop = shops.find(s => s.owner_id === c.wallet.owner_id)
                return {
                    ...c,
                    shop: shop ? {
                        shop_name: shop.shop_name,
                        owner_id: shop.owner_id,
                        owner_name: `${shop.owner?.first_name} ${shop.owner?.last_name}`,
                        owner_email: shop.owner?.email,
                        owner_phone: shop.owner_phone
                    } : {
                        shop_name: 'Unknown Shop',
                        owner_id: c.wallet.owner_id,
                        owner_name: 'Unknown',
                        owner_email: '',
                        owner_phone: ''
                    }
                }
            })

            setCredits(enrichedData)
        } catch (err) {
            console.error('[fetchCredits]', err)
            toast.error('Failed to load credits')
        } finally {
            setLoading(false)
        }
    }

    // Single source of truth for loading data
    useEffect(() => {
        if (dbUser && shops.length > 0) {
            if (activeTab === 'withdrawals') {
                fetchWithdrawals()
            } else {
                fetchCredits()
            }
        }
    }, [dbUser, shops, statusFilter, activeTab])

    const processWithdrawal = async (w: WithdrawalRequest, action: 'completed' | 'rejected', note?: string) => {
        setProcessingId(w.id)
        try {
            // 1. Update status
            const { error } = await (supabase as any).from('shop_wallet_transactions').update({
                status: action,
                admin_note: note || null,
                updated_at: new Date().toISOString(),
            }).eq('id', w.id)
            if (error) throw error

            // 2. For completed: wallet was already debited at request time — just notify.
            //    For rejected:  do NOT restore balance. The amount stays deducted
            //                   and the shop owner resubmits edited payment details.
            if (action === 'completed') {
                // Build the owner's first name for SMS/email
                const firstName = w.shop.owner_name.split(' ')[0] || w.shop.owner_name
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'withdrawal_processed',
                        payload: {
                            phone: w.shop.owner_phone,
                            email: w.shop.owner_email,
                            firstName,
                            shopName: w.shop.shop_name,
                            amount: w.amount,
                            momoNumber: w.momo_number,
                            network: w.network || 'MoMo',
                        },
                    }),
                }).catch(err => console.warn('[ShopAlert]', err))
            } else if (action === 'rejected') {
                const firstName = w.shop.owner_name.split(' ')[0] || w.shop.owner_name
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'withdrawal_rejected',
                        payload: {
                            phone: w.shop.owner_phone,
                            email: w.shop.owner_email,
                            firstName,
                            shopName: w.shop.shop_name,
                            amount: w.amount,
                            adminNote: note || 'Please check your dashboard for the reason.',
                        },
                    }),
                }).catch(err => console.warn('[ShopAlert]', err))
            }

            toast.success(`Withdrawal ${action}`)
            fetchWithdrawals()
        } catch (err: any) {
            toast.error(err.message || 'Failed to process withdrawal')
        } finally {
            setProcessingId(null)
        }
    }

    const filteredWithdrawals = withdrawals.filter(w => {
        const matchesShop = shopFilter === 'all' || w.shop.owner_id === shopFilter
        const matchesSearch = !searchTerm ||
            w.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            w.momo_number.includes(searchTerm) ||
            w.shop.shop_name.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesShop && matchesSearch
    })

    const filteredCredits = credits.filter(c => {
        const matchesShop = shopFilter === 'all' || c.shop.owner_id === shopFilter
        const matchesSearch = !searchTerm ||
            c.shop.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.order?.paystack_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.order?.guest_phone?.includes(searchTerm)
        return matchesShop && matchesSearch
    })

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link href="/admin/shops">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Banknote className="w-6 h-6 text-emerald-600" />
                        Shop Finance
                    </h1>
                </div>

                <div className="flex p-1 bg-muted rounded-xl gap-1">
                    <Button
                        variant={activeTab === 'withdrawals' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('withdrawals')}
                        className={cn(
                            "h-9 rounded-lg px-4 text-xs font-bold transition-all",
                            activeTab === 'withdrawals' ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Banknote className="w-3.5 h-3.5 mr-2" />
                        Withdrawals
                    </Button>
                    <Button
                        variant={activeTab === 'credits' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('credits')}
                        className={cn(
                            "h-9 rounded-lg px-4 text-xs font-bold transition-all",
                            activeTab === 'credits' ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Receipt className="w-3.5 h-3.5 mr-2" />
                        Profit Credits
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-muted/30 border-none shadow-none">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Search</p>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Account, MoMo, or Shop..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 h-10"
                            />
                        </div>
                    </div>

                    <div className="w-full md:w-48 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Status</p>
                        <Select
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                            disabled={activeTab === 'credits'}
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full md:w-64 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Shop</p>
                        <Select value={shopFilter} onValueChange={setShopFilter}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="All Shops" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Shops</SelectItem>
                                {shops.map(s => (
                                    <SelectItem key={s.id} value={s.owner_id}>{s.shop_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Content Area */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : activeTab === 'withdrawals' ? (
                        <>
                            {filteredWithdrawals.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Banknote className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No withdrawal requests found.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Withdrawals Desktop Table */}
                                    <div className="hidden lg:block overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                                                    <th className="text-left px-4 py-3 font-medium">Date</th>
                                                    <th className="text-left px-4 py-3 font-medium">Shop</th>
                                                    <th className="text-left px-4 py-3 font-medium">Account Info</th>
                                                    <th className="text-left px-4 py-3 font-medium">Network</th>
                                                    <th className="text-right px-4 py-3 font-medium">Gross</th>
                                                    <th className="text-right px-4 py-3 font-medium">Fee</th>
                                                    <th className="text-right px-4 py-3 font-medium">Net Payout</th>
                                                    <th className="text-right px-4 py-3 font-medium">Bal. Snapshot</th>
                                                    <th className="text-center px-4 py-3 font-medium">Status</th>
                                                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {filteredWithdrawals.map((w) => (
                                                    <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-4 text-xs text-muted-foreground">
                                                            {new Date(w.created_at).toLocaleDateString()}<br />
                                                            {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="font-semibold text-sm">{w.shop.shop_name}</p>
                                                            <p className="text-[10px] text-muted-foreground font-medium">{w.shop.owner_name}</p>
                                                            <p className="text-[10px] text-muted-foreground">{w.shop.owner_phone}</p>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="font-medium">{w.account_name}</p>
                                                            <p className="font-mono text-xs text-muted-foreground">{w.momo_number}</p>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            {w.network ? (
                                                                <span className={cn(
                                                                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                                                    w.network === 'MTN MoMo' ? 'bg-yellow-100 text-yellow-800' :
                                                                    w.network === 'Telecel Cash' ? 'bg-red-100 text-red-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                                )}>{w.network}</span>
                                                            ) : <span className="text-muted-foreground text-xs">—</span>}
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-muted-foreground">{formatCurrency(w.amount)}</td>
                                                        <td className="px-4 py-4 text-right text-red-500 text-xs">-{formatCurrency(w.fee)}</td>
                                                        <td className="px-4 py-4 text-right font-bold text-emerald-600 text-base">{formatCurrency(w.net_amount)}</td>
                                                        <td className="px-4 py-4 text-right text-xs text-muted-foreground">
                                                            {w.balance_snapshot != null ? formatCurrency(w.balance_snapshot) : '—'}
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className={cn(
                                                                'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                                                                w.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                                    w.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                        'bg-red-100 text-red-700'
                                                            )}>
                                                                {w.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-right">
                                                            {w.status === 'pending' && (
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-8 bg-green-600 hover:bg-green-700 text-white font-bold"
                                                                        onClick={() => {
                                                                            if (confirm(`Confirm payment of ${formatCurrency(w.net_amount)} to ${w.account_name} (${w.momo_number})?`)) {
                                                                                processWithdrawal(w, 'completed')
                                                                            }
                                                                        }}
                                                                        disabled={!!processingId}
                                                                    >
                                                                        {processingId === w.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Pay'}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 border-red-500 text-red-600 font-semibold"
                                                                        onClick={() => {
                                                                            const note = prompt('Enter rejection reason (Required):')
                                                                            if (note === null) return
                                                                            if (!note.trim()) {
                                                                                toast.error('Rejection reason is required')
                                                                                return
                                                                            }
                                                                            processWithdrawal(w, 'rejected', note.trim())
                                                                        }}
                                                                        disabled={!!processingId}
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

                                    {/* Withdrawals Mobile Cards */}
                                    <div className="lg:hidden divide-y">
                                        {filteredWithdrawals.map((w) => (
                                            <div key={w.id} className="p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <Store className="w-3 h-3 text-emerald-600" />
                                                            <div>
                                                                <p className="font-bold text-sm leading-none">{w.shop.shop_name}</p>
                                                                <p className="text-[10px] text-muted-foreground mt-1 font-medium">{w.shop.owner_name} · {w.shop.owner_phone}</p>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</p>
                                                        <p className="text-lg font-black text-emerald-600">{formatCurrency(w.net_amount)}</p>
                                                        <p className="text-[10px] text-muted-foreground">Gross: {formatCurrency(w.amount)} (Fees: {formatCurrency(w.fee)})</p>
                                                    </div>
                                                    <span className={cn(
                                                        'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                                                        w.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                            w.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                'bg-red-100 text-red-700'
                                                    )}>
                                                        {w.status}
                                                    </span>
                                                </div>

                                                <div className="bg-muted/50 p-3 rounded-xl space-y-2 text-xs border border-muted-foreground/10">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-muted-foreground uppercase tracking-tight text-[10px] font-bold">Account</span>
                                                        <span className="font-bold text-right max-w-[150px] truncate">{w.account_name}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-muted-foreground uppercase tracking-tight text-[10px] font-bold">Network</span>
                                                        {w.network ? (
                                                            <span className={cn(
                                                                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                                                                w.network === 'MTN MoMo' ? 'bg-yellow-100 text-yellow-800' :
                                                                w.network === 'Telecel Cash' ? 'bg-red-100 text-red-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            )}>{w.network}</span>
                                                        ) : <span className="text-muted-foreground">—</span>}
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-muted-foreground uppercase tracking-tight text-[10px] font-bold">MoMo Number</span>
                                                        <span className="font-mono font-medium bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded">{w.momo_number}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-muted-foreground uppercase tracking-tight text-[10px] font-bold">Bal. Snapshot</span>
                                                        <span className="font-medium text-muted-foreground">{w.balance_snapshot != null ? formatCurrency(w.balance_snapshot) : '—'}</span>
                                                    </div>
                                                </div>

                                                {w.status === 'pending' && (
                                                    <div className="flex gap-2 pt-1 font-display">
                                                        <Button
                                                            size="sm"
                                                            className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white font-black shadow-md shadow-green-600/20 active:scale-95 transition-all"
                                                            onClick={() => {
                                                                if (confirm(`Confirm payout of ${formatCurrency(w.net_amount)} to ${w.account_name}?`)) {
                                                                    processWithdrawal(w, 'completed')
                                                                }
                                                            }}
                                                            disabled={!!processingId}
                                                        >
                                                            {processingId === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'PAY NOW'}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 h-10 border-red-500 text-red-600 font-bold active:scale-95 transition-all"
                                                            onClick={() => {
                                                                const note = prompt('REJECTION REASON (REQUIRED):')
                                                                if (note === null) return
                                                                if (!note.trim()) {
                                                                    toast.error('Rejection reason is required')
                                                                    return
                                                                }
                                                                processWithdrawal(w, 'rejected', note.trim())
                                                            }}
                                                            disabled={!!processingId}
                                                        >
                                                            REJECT
                                                        </Button>
                                                    </div>
                                                )}
                                                {w.admin_note && (
                                                    <div className="p-2.5 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg text-[10px] text-red-600 dark:text-red-400 italic">
                                                        <strong>Admin Note:</strong> {w.admin_note}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {filteredCredits.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No profit credits found.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Profits Desktop Table */}
                                    <div className="hidden lg:block overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                                                    <th className="text-left px-4 py-3 font-medium">Date</th>
                                                    <th className="text-left px-4 py-3 font-medium">Shop / Owner</th>
                                                    <th className="text-left px-4 py-3 font-medium">Order Details</th>
                                                    <th className="text-left px-4 py-3 font-medium">Guest / Ref</th>
                                                    <th className="text-right px-4 py-3 font-medium">Profit Credited</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {filteredCredits.map((c) => (
                                                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-4 text-xs text-muted-foreground">
                                                            {new Date(c.created_at).toLocaleDateString()}<br />
                                                            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="font-semibold text-sm">{c.shop.shop_name}</p>
                                                            <p className="text-[10px] text-muted-foreground font-medium">{c.shop.owner_name}</p>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                                                                    {c.order?.network}
                                                                </span>
                                                                <span className="font-medium">{c.order?.package_size}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="text-xs font-medium">{c.order?.guest_phone}</p>
                                                            <p className="text-[10px] font-mono text-muted-foreground uppercase opacity-70">
                                                                {c.order?.paystack_reference?.slice(-12)}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-4 text-right">
                                                            <p className="font-bold text-emerald-600 text-lg">{formatCurrency(c.amount)}</p>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Profits Mobile Cards */}
                                    <div className="lg:hidden divide-y">
                                        {filteredCredits.map((c) => (
                                            <div key={c.id} className="p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Store className="w-3 h-3 text-emerald-600" />
                                                            <p className="font-bold text-sm leading-none">{c.shop.shop_name}</p>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground font-medium">{c.shop.owner_name}</p>
                                                    </div>
                                                    <p className="font-black text-emerald-600 text-xl">{formatCurrency(c.amount)}</p>
                                                </div>

                                                <div className="bg-muted/50 p-3 rounded-xl space-y-2 border border-muted-foreground/10 text-xs">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Order</span>
                                                        <span className="font-bold">{c.order?.network} {c.order?.package_size}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Guest Contact</span>
                                                        <span className="font-medium">{c.order?.guest_phone}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Reference</span>
                                                        <span className="font-mono text-[10px] truncate max-w-[120px] uppercase">{c.order?.paystack_reference}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-1 border-t border-muted-foreground/10">
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Date</span>
                                                        <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
