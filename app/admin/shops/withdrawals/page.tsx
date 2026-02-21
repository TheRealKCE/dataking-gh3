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
    Banknote, Filter, Search, Calendar, Loader2
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
    status: 'pending' | 'completed' | 'rejected'
    created_at: string
    admin_note: string | null
    shop_wallet_id: string
    shop: {
        shop_name: string
        owner_id: string
        owner_name: string
        owner_email: string
        owner_phone: string
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
    const [shops, setShops] = useState<ShopOption[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [shopFilter, setShopFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (dbUser && !isAdmin) { router.replace('/dashboard'); return }
        if (dbUser) {
            fetchShops()
            fetchWithdrawals()
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
            // We need to join transactions -> wallets -> profiles
            // But since we have owner_id in both wallets and profiles, we can join transactions -> wallets (owner_id) -> profiles (owner_id)
            // Or simpler: Join transactions (shop_wallet_id) -> wallets (id) and then we use the owner_id to find shop name

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

            // Now we need to attach shop names. Since we fetched shops already, we can map them.
            // A better way would be a single join if the relationship allows, but Supabase joins can be tricky with non-FK joins.
            // Let's manually map them for now as the number of shops won't be massive.

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
            console.error(err)
            toast.error('Failed to load withdrawals')
        } finally {
            setLoading(false)
        }
    }

    // Refresh when filters change
    useEffect(() => {
        if (dbUser && shops.length > 0) {
            fetchWithdrawals()
        }
    }, [statusFilter])

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

            // 2. Update wallet (balance restoration or withdrawal count)
            if (action === 'rejected') {
                // Restore balance
                const { data: wallet } = await (supabase as any).from('shop_wallets').select('balance').eq('owner_id', w.shop.owner_id).single()
                await (supabase as any).from('shop_wallets').update({
                    balance: (wallet?.balance || 0) + w.amount,
                    updated_at: new Date().toISOString(),
                }).eq('owner_id', w.shop.owner_id)
            } else if (action === 'completed') {
                // Update total withdrawn
                const { data: wallet } = await (supabase as any).from('shop_wallets').select('total_withdrawn').eq('owner_id', w.shop.owner_id).single()
                await (supabase as any).from('shop_wallets').update({
                    total_withdrawn: (wallet?.total_withdrawn || 0) + w.amount,
                    updated_at: new Date().toISOString(),
                }).eq('owner_id', w.shop.owner_id)

                // Fire alert
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'withdrawal_processed',
                        payload: {
                            ownerId: w.shop.owner_id, // API route should look up user details by ownerId
                            amount: w.amount,
                            momoNumber: w.momo_number,
                            shopName: w.shop.shop_name
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

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/admin/shops">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Banknote className="w-6 h-6 text-emerald-600" />
                    Withdrawal Management
                </h1>
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
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
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

            {/* Withdrawal List */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : filteredWithdrawals.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Banknote className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No withdrawal requests found.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden lg:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                                            <th className="text-left px-4 py-3 font-medium">Date</th>
                                            <th className="text-left px-4 py-3 font-medium">Shop</th>
                                            <th className="text-left px-4 py-3 font-medium">Account Info</th>
                                            <th className="text-right px-4 py-3 font-medium">Gross</th>
                                            <th className="text-right px-4 py-3 font-medium">Fee</th>
                                            <th className="text-right px-4 py-3 font-medium">Net Payout</th>
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
                                                <td className="px-4 py-4 text-right text-muted-foreground">{formatCurrency(w.amount)}</td>
                                                <td className="px-4 py-4 text-right text-red-500 text-xs">-{formatCurrency(w.fee)}</td>
                                                <td className="px-4 py-4 text-right font-bold text-emerald-600 text-base">{formatCurrency(w.net_amount)}</td>
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

                            {/* Mobile Cards (reuse from previous task) */}
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
                                                <span className="text-muted-foreground uppercase tracking-tight text-[10px] font-bold">MoMo Number</span>
                                                <span className="font-mono font-medium bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded">{w.momo_number}</span>
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
                </CardContent>
            </Card>
        </div>
    )
}
