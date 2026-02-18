'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Store, Search, CheckCircle2, Clock, XCircle, AlertCircle, Settings, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Shop {
    id: string
    shop_name: string
    shop_slug: string
    owner_id: string
    approval_status: 'pending' | 'approved' | 'rejected' | 'suspended'
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



    useEffect(() => {
        if (dbUser && !isAdmin) { router.replace('/dashboard'); return }
        if (dbUser) fetchShops()
    }, [dbUser, isAdmin])

    const fetchShops = async () => {
        // Fix: Explicitly specify the relationship to avoid ambiguity with 'approved_by'
        const { data, error } = await (supabase
            .from('shop_profiles')
            .select('*, owner:users!shop_profiles_owner_id_fkey(first_name, last_name, email)')
            .order('created_at', { ascending: false }) as any)


        setShops(data || [])
        setLoading(false)
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
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
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
                        return (
                            <Link key={shop.id} href={`/admin/shops/${shop.id}`}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                                            <Store className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-sm truncate">{shop.shop_name}</p>
                                                <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                                                    <Icon className="w-3 h-3" />
                                                    {cfg.label}
                                                </span>
                                                {!shop.is_active && (
                                                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                /shop/{shop.shop_slug} · {owner?.first_name} {owner?.last_name} · {shop.owner_phone}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Created {new Date(shop.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    </CardContent>
                                </Card>
                            </Link>
                        )
                    })
                )}
            </div>
        </div>
    )
}
