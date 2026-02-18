'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Store, Search, CheckCircle2, Clock, XCircle, AlertCircle,
    Settings, ChevronRight, Loader2, Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Shop {
    id: string
    shop_name: string
    shop_slug: string
    owner_id: string
    approval_status: 'pending' | 'approved' | 'rejected' | 'suspended'
    pricing_status: 'not_submitted' | 'pending_review' | 'approved' | 'rejected'
    is_active: boolean
    created_at: string
    owner_phone: string
    owner?: { first_name: string; last_name: string; email: string }
}

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
    approved: { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
    suspended: { label: 'Suspended', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400', icon: AlertCircle },
}

export default function AdminShopsPage() {
    const { dbUser, isAdmin } = useAuth()
    const router = useRouter()
    const [shops, setShops] = useState<Shop[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [actioning, setActioning] = useState<string | null>(null)

    useEffect(() => {
        if (dbUser && !isAdmin) { router.replace('/dashboard'); return }
        if (dbUser) fetchShops()
    }, [dbUser, isAdmin])

    const fetchShops = async () => {
        const { data } = await (supabase
            .from('shop_profiles')
            .select('*, owner:users!shop_profiles_owner_id_fkey(first_name, last_name, email)')
            .order('created_at', { ascending: false }) as any)
        setShops(data || [])
        setLoading(false)
    }

    const handleProfileAction = async (shopId: string, action: 'approved' | 'rejected', e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setActioning(shopId + action)
        try {
            const updates: any = {
                approval_status: action,
                updated_at: new Date().toISOString(),
            }
            // On approval, reset pricing status so owner can now set prices
            if (action === 'approved') {
                updates.pricing_status = 'not_submitted'
                updates.is_active = false
            }
            const { error } = await (supabase as any).from('shop_profiles').update(updates).eq('id', shopId)
            if (error) throw error
            toast.success(action === 'approved' ? 'Shop profile approved! Owner can now set prices.' : 'Shop rejected.')
            fetchShops()
        } catch (err: any) {
            toast.error(err.message || 'Action failed')
        } finally {
            setActioning(null)
        }
    }

    const filtered = shops.filter(s => {
        const matchSearch = !search ||
            s.shop_name.toLowerCase().includes(search.toLowerCase()) ||
            s.shop_slug.toLowerCase().includes(search.toLowerCase()) ||
            s.owner_phone.includes(search) ||
            s.owner?.email?.toLowerCase().includes(search.toLowerCase())
        const matchStatus = filterStatus === 'all' || s.approval_status === filterStatus
        return matchSearch && matchStatus
    })

    const counts = {
        all: shops.length,
        pending: shops.filter(s => s.approval_status === 'pending').length,
        approved: shops.filter(s => s.approval_status === 'approved').length,
        suspended: shops.filter(s => s.approval_status === 'suspended').length,
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Store className="w-6 h-6 text-emerald-600" />
                        Shop Management
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">{shops.length} shops total</p>
                </div>
                <Link href="/admin/shops/settings">
                    <Button variant="outline" size="sm" className="gap-1.5">
                        <Settings className="w-4 h-4" /> Global Settings
                    </Button>
                </Link>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {(['all', 'pending', 'approved', 'suspended'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={cn(
                            'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition-all border',
                            filterStatus === status
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                        )}
                    >
                        {status === 'all' ? 'All' : statusConfig[status].label}
                        <span className="ml-1.5 text-xs opacity-70">({counts[status] || 0})</span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, slug, phone, or email..."
                    className="pl-9"
                />
            </div>

            {/* Shop list */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Store className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No shops found.</p>
                    </div>
                ) : (
                    filtered.map(shop => {
                        const cfg = statusConfig[shop.approval_status]
                        const Icon = cfg.icon
                        const owner = shop.owner
                        const isApprovingProfile = actioning === shop.id + 'approved'
                        const isRejectingProfile = actioning === shop.id + 'rejected'

                        return (
                            <Card key={shop.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Store className="w-5 h-5 text-emerald-600" />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-sm">{shop.shop_name}</p>
                                                <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                                                    <Icon className="w-3 h-3" />
                                                    {cfg.label}
                                                </span>
                                                {/* Pricing status badge */}
                                                {shop.approval_status === 'approved' && (
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                                                        shop.pricing_status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                                                            shop.pricing_status === 'pending_review' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                                                                shop.pricing_status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                                                                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                    )}>
                                                        <Tag className="w-3 h-3" />
                                                        {shop.pricing_status === 'approved' ? 'Pricing ✓' :
                                                            shop.pricing_status === 'pending_review' ? 'Pricing Review' :
                                                                shop.pricing_status === 'rejected' ? 'Pricing Rejected' :
                                                                    'Awaiting Pricing'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                /shop/{shop.shop_slug} · {owner?.first_name} {owner?.last_name} · {shop.owner_phone}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Created {new Date(shop.created_at).toLocaleDateString()}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {/* Stage 1: Profile pending — show Approve/Reject */}
                                            {shop.approval_status === 'pending' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                                                        onClick={(e) => handleProfileAction(shop.id, 'approved', e)}
                                                        disabled={!!actioning}
                                                    >
                                                        {isApprovingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 text-xs border-red-400 text-red-600 hover:bg-red-50 gap-1"
                                                        onClick={(e) => handleProfileAction(shop.id, 'rejected', e)}
                                                        disabled={!!actioning}
                                                    >
                                                        {isRejectingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                                        Reject
                                                    </Button>
                                                </>
                                            )}

                                            {/* Stage 2: Pricing pending review — show Review Pricing */}
                                            {shop.approval_status === 'approved' && shop.pricing_status === 'pending_review' && (
                                                <Link href={`/admin/shops/${shop.id}`}>
                                                    <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1">
                                                        <Tag className="w-3 h-3" />
                                                        Review Pricing
                                                    </Button>
                                                </Link>
                                            )}

                                            {/* Active shop — Manage link */}
                                            {shop.approval_status === 'approved' && shop.pricing_status === 'approved' && (
                                                <Link href={`/admin/shops/${shop.id}`}>
                                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                                                        Manage <ChevronRight className="w-3 h-3" />
                                                    </Button>
                                                </Link>
                                            )}

                                            {/* Other approved states — View details */}
                                            {shop.approval_status === 'approved' &&
                                                shop.pricing_status !== 'pending_review' &&
                                                shop.pricing_status !== 'approved' && (
                                                    <Link href={`/admin/shops/${shop.id}`}>
                                                        <Button size="sm" variant="ghost" className="h-8 text-xs">
                                                            <ChevronRight className="w-4 h-4" />
                                                        </Button>
                                                    </Link>
                                                )}

                                            {/* Rejected shop — View details */}
                                            {shop.approval_status === 'rejected' && (
                                                <Link href={`/admin/shops/${shop.id}`}>
                                                    <Button size="sm" variant="ghost" className="h-8 text-xs">
                                                        <ChevronRight className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        </div>
    )
}
