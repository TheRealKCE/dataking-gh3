'use client'

import { useEffect, useState, useMemo } from 'react'
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
    Receipt, History, TrendingUp, AlertCircle
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
                            amount: w.net_amount,
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

    const stats = useMemo(() => ({
        totalProfit: filteredCredits.reduce((sum, c) => sum + (c.amount || 0), 0),
        totalWithdrawn: filteredWithdrawals
            .filter(w => w.status === 'completed')
            .reduce((sum, w) => sum + (w.net_amount || 0), 0),
        pendingCount: filteredWithdrawals.filter(w => w.status === 'pending').length,
        pendingAmount: filteredWithdrawals
            .filter(w => w.status === 'pending')
            .reduce((sum, w) => sum + (w.net_amount || 0), 0),
    }), [filteredWithdrawals, filteredCredits])

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

            {/* Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl shadow-lg bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 relative overflow-hidden text-white border border-white/10">
                    <TrendingUp className="w-5 h-5 absolute top-4 right-4 opacity-50" />
                    <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">Total Shop Profit</p>
                    <p className="text-2xl font-black mt-1">{formatCurrency(stats.totalProfit)}</p>
                    <p className="text-xs text-white/60 mt-1">From {filteredCredits.length} credits</p>
                </div>
                <div className="rounded-xl shadow-lg bg-gradient-to-br from-blue-600 to-blue-800 p-4 relative overflow-hidden text-white border border-white/10">
                    <Banknote className="w-5 h-5 absolute top-4 right-4 opacity-50" />
                    <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">Total Withdrawn</p>
                    <p className="text-2xl font-black mt-1">{formatCurrency(stats.totalWithdrawn)}</p>
                    <p className="text-xs text-white/60 mt-1">From completed withdrawals</p>
                </div>
                <div className="rounded-xl shadow-lg bg-gradient-to-br from-yellow-500 to-amber-600 p-4 relative overflow-hidden text-white border border-white/10">
                    <Clock className="w-5 h-5 absolute top-4 right-4 opacity-50" />
                    <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">Pending Requests</p>
                    <p className="text-2xl font-black mt-1">{stats.pendingCount}</p>
                    <p className="text-xs text-white/60 mt-1">Awaiting approval</p>
                </div>
                <div className="rounded-xl shadow-lg bg-gradient-to-br from-orange-500 to-red-600 p-4 relative overflow-hidden text-white border border-white/10">
                    <AlertCircle className="w-5 h-5 absolute top-4 right-4 opacity-50" />
                    <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">Pending Amount</p>
                    <p className="text-2xl font-black mt-1">{formatCurrency(stats.pendingAmount)}</p>
                    <p className="text-xs text-white/60 mt-1">Total pending payout</p>
                </div>
            </div>

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
                                            <thead className="bg-gray-900 dark:bg-black text-white">
                                                <tr className="border-b-0 text-xs uppercase tracking-wider">
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
                                            <tbody className="divide-y relative">
                                                {filteredWithdrawals.map((w) => (
                                                    <tr key={w.id} className={cn(
                                                        "hover:bg-muted/30 transition-colors border-l-4 border-b",
                                                        w.status === 'pending' ? 'border-l-yellow-500' :
                                                            w.status === 'completed' ? 'border-l-emerald-500' :
                                                                'border-l-red-500'
                                                    )}>
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
                                                        <td className="px-4 py-4 text-right font-black text-emerald-500 text-lg">{formatCurrency(w.net_amount)}</td>
                                                        <td className="px-4 py-4 text-right text-xs text-muted-foreground">
                                                            {w.balance_snapshot != null ? formatCurrency(w.balance_snapshot) : '—'}
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className={cn(
                                                                'text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider',
                                                                w.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border border-yellow-500/20 animate-pulse' :
                                                                    w.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20' :
                                                                        'bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20'
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
                                    <div className="lg:hidden space-y-4 p-4">
                                        {filteredWithdrawals.map((w) => (
                                            <div key={w.id} className={cn(
                                                "bg-[#111827] dark:bg-[#0f0f0f] rounded-xl overflow-hidden border-l-4 shadow-xl",
                                                w.status === 'pending' ? 'border-l-yellow-500' :
                                                    w.status === 'completed' ? 'border-l-emerald-500' :
                                                        'border-l-red-500'
                                            )}>
                                                <div className="p-4 space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <h3 className="font-bold text-white text-base leading-none">{w.shop.shop_name}</h3>
                                                            <p className="text-xs text-gray-400 font-medium">{w.shop.owner_name}</p>
                                                        </div>
                                                        <span className={cn(
                                                            'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                                                            w.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 animate-pulse' :
                                                                w.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                                                                    'bg-red-500/20 text-red-500 border border-red-500/30'
                                                        )}>
                                                            {w.status}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <p className="text-3xl font-black text-emerald-400 font-display tracking-tight">{formatCurrency(w.net_amount)}</p>
                                                        <p className="text-[10px] text-gray-500 font-medium uppercase mt-0.5">Gross: {formatCurrency(w.amount)} • Fee: {formatCurrency(w.fee)}</p>
                                                    </div>

                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2 text-xs">
                                                        <div className="flex justify-between items-center text-gray-300">
                                                            <span className="uppercase tracking-wider text-[10px] font-bold text-gray-500">Account</span>
                                                            <span className="font-bold truncate max-w-[150px]">{w.account_name}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-gray-300">
                                                            <span className="uppercase tracking-wider text-[10px] font-bold text-gray-500">Network</span>
                                                            <span>{w.network || '—'}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-gray-300">
                                                            <span className="uppercase tracking-wider text-[10px] font-bold text-gray-500">MoMo Number</span>
                                                            <span className="font-mono text-emerald-400">{w.momo_number}</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                                                        {new Date(w.created_at).toLocaleString()}
                                                    </div>

                                                    {w.admin_note && (
                                                        <div className="p-2.5 bg-red-900/20 border border-red-900/50 rounded-lg text-xs text-red-400 italic">
                                                            <strong>Note:</strong> {w.admin_note}
                                                        </div>
                                                    )}
                                                </div>

                                                {w.status === 'pending' && (
                                                    <div className="flex border-t border-white/5">
                                                        <button
                                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-colors flex items-center justify-center gap-2"
                                                            onClick={() => {
                                                                if (confirm(`Confirm payout of ${formatCurrency(w.net_amount)} to ${w.account_name}?`)) {
                                                                    processWithdrawal(w, 'completed')
                                                                }
                                                            }}
                                                            disabled={!!processingId}
                                                        >
                                                            {processingId === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'PAY NOW'}
                                                        </button>
                                                        <button
                                                            className="flex-1 py-3 bg-transparent hover:bg-red-950 text-red-500 font-bold text-sm transition-colors"
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
                                                        </button>
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
                                            <thead className="bg-gray-900 dark:bg-black text-white">
                                                <tr className="border-b-0 text-xs uppercase tracking-wider">
                                                    <th className="text-left px-4 py-3 font-medium">Date</th>
                                                    <th className="text-left px-4 py-3 font-medium">Shop / Owner</th>
                                                    <th className="text-left px-4 py-3 font-medium">Order Details</th>
                                                    <th className="text-left px-4 py-3 font-medium">Guest / Ref</th>
                                                    <th className="text-right px-4 py-3 font-medium">Profit Credited</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y relative">
                                                {filteredCredits.map((c) => (
                                                    <tr key={c.id} className="hover:bg-muted/30 transition-colors border-l-4 border-l-emerald-500 border-b">
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
                                    <div className="lg:hidden space-y-4 p-4">
                                        {filteredCredits.map((c) => (
                                            <div key={c.id} className="bg-white dark:bg-[#111827] rounded-xl overflow-hidden border border-border shadow-sm border-l-4 border-l-emerald-500">
                                                <div className="p-4 space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                    {c.order?.network}
                                                                </span>
                                                                <span className="text-xs font-bold text-muted-foreground">{c.order?.package_size}</span>
                                                            </div>
                                                            <h3 className="font-bold text-sm mt-2">{c.shop.shop_name}</h3>
                                                        </div>
                                                        <p className="font-black text-emerald-600 dark:text-emerald-500 text-xl font-display">{formatCurrency(c.amount)}</p>
                                                    </div>

                                                    <div className="bg-muted/50 dark:bg-white/5 rounded-xl p-3 space-y-2 text-xs border border-muted-foreground/10">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Guest Contact</span>
                                                            <span className="font-medium">{c.order?.guest_phone}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-muted-foreground">
                                                            <span className="text-[10px] uppercase font-bold">Reference</span>
                                                            <span className="font-mono text-[10px] truncate max-w-[120px] uppercase">{c.order?.paystack_reference}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                                        {new Date(c.created_at).toLocaleString()}
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
