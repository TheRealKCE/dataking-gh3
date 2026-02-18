'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tag, Save, Loader2, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Package {
    id: string
    network: string
    size: string
    price: number
    agent_price: number // Added agent price
    cost_price: number // Admin cost
    is_available: boolean
    sort_order: number
}

interface PricingRow {
    package_id: string
    selling_price: string
}

const networkColors: Record<string, string> = {
    MTN: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    Telecel: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'AT-iShare': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'AT-BigTime': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']

export default function ShopPricingPage() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()
    const [shopId, setShopId] = useState<string | null>(null)
    const [packages, setPackages] = useState<Package[]>([])
    const [pricing, setPricing] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeNetwork, setActiveNetwork] = useState<string>('MTN')

    useEffect(() => {
        if (dbUser && !isAdmin && !isSubAdmin) {
            router.replace('/dashboard')
            return
        }
        if (dbUser) fetchData()
    }, [dbUser, isAdmin, isSubAdmin])

    const fetchData = async () => {
        try {
            // Get shop
            const { data: shop } = await ((supabase as any)
                .from('shop_profiles')
                .select('id')
                .eq('owner_id', dbUser!.id)
                .single())

            if (!shop) {
                toast.error('Please create your shop first')
                router.push('/dashboard/shop/setup')
                return
            }
            setShopId(shop.id)

            // Get packages and existing pricing in parallel
            const [pkgRes, priceRes] = await Promise.all([
                (supabase.from('data_packages').select('*').eq('is_available', true).order('sort_order') as any),
                ((supabase as any).from('shop_pricing').select('*').eq('shop_id', shop.id)),
            ])

            // Sort packages by network priority manually if needed, or trust sort_order
            // We'll rely on activeNetwork filtering anyway
            setPackages(pkgRes.data || [])

            // Build pricing map
            const priceMap: Record<string, string> = {}
            for (const row of (priceRes.data || [])) {
                priceMap[row.package_id] = String(row.selling_price)
            }
            setPricing(priceMap)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    // Determine the cost based on user role
    const getCostPrice = (pkg: Package) => {
        if (dbUser?.role === 'agent' && pkg.agent_price > 0) {
            return pkg.agent_price
        }
        return pkg.price
    }

    const getProfit = (pkg: Package, sellingStr: string) => {
        const selling = parseFloat(sellingStr)
        if (isNaN(selling)) return null
        const cost = getCostPrice(pkg)
        return selling - cost
    }

    const isValidPrice = (pkg: Package, sellingStr: string) => {
        const profit = getProfit(pkg, sellingStr)
        if (profit === null) return null
        return profit > 0
    }

    const handleSave = async () => {
        // Validate all entered prices
        const invalid = packages.filter(pkg => {
            const val = pricing[pkg.id]
            if (!val) return false
            return !isValidPrice(pkg, val)
        })
        if (invalid.length > 0) {
            toast.error(`Selling price must be greater than cost price for: ${invalid.map(p => `${p.network} ${p.size}`).join(', ')}`)
            return
        }

        setSaving(true)
        try {
            // Build upsert rows for packages that have a price set
            const rows = packages
                .filter(pkg => pricing[pkg.id] && parseFloat(pricing[pkg.id]) > 0)
                .map(pkg => ({
                    shop_id: shopId,
                    package_id: pkg.id,
                    selling_price: parseFloat(pricing[pkg.id]),
                }))

            // Even if rows is empty, we might want to clear prices. 
            // Current logic requires at least one price? Valid for a shop.
            if (rows.length === 0) {
                // If they clear everything, we should allow it? 
                // "Only packages with a price will appear". 
                // If they want to close shop effectively, maybe.
                // But let's stick to previous logic or just warn.
                // toast.error('Set at least one price')
                // return
            }

            // Transaction-like update: delete all for this shop, insert new
            await ((supabase as any).from('shop_pricing').delete().eq('shop_id', shopId))

            if (rows.length > 0) {
                const { error } = await ((supabase as any).from('shop_pricing').insert(rows))
                if (error) throw error
            }

            toast.success(`Prices saved successfully!`)
        } catch (err: any) {
            toast.error(err.message || 'Failed to save prices')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
        )
    }

    // Filter by active network
    const filteredPackages = packages.filter(p => p.network === activeNetwork)

    // Sort logic: use sort_order, then size
    // Using explicit sorting to match admin view if possible
    // packages are already sorted by sort_order from fetch

    const setPricedCount = Object.values(pricing).filter(v => v && parseFloat(v) > 0).length

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Tag className="w-6 h-6 text-emerald-600" />
                        Pricing Engine
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Set your selling prices. Only packages with a price will appear on your shop.
                        {setPricedCount > 0 && <span className="ml-2 font-semibold text-emerald-600">{setPricedCount} active</span>}
                    </p>
                </div>
                <div className="hidden sm:block">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save All Prices'}
                    </Button>
                </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex gap-2 text-sm text-blue-700 dark:text-blue-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                    Your cost price depends on your role ({dbUser?.role === 'agent' ? 'Agent' : 'Customer'}).
                    Selling price must be higher than your cost.
                </span>
            </div>

            {/* Network Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {NETWORKS.map(network => {
                    const count = packages.filter(p => p.network === network).length
                    if (count === 0) return null
                    const isActive = activeNetwork === network
                    const colorClass = networkColors[network]
                    return (
                        <button
                            key={network}
                            onClick={() => setActiveNetwork(network)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap border',
                                isActive
                                    ? 'border-transparent shadow-sm scale-105'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50',
                                isActive && colorClass
                            )}
                        >
                            {network}
                            <span className={cn('text-xs opacity-70 px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10')}>
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Content Area */}
            <Card>
                <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-sm flex items-center justify-between">
                        <span>{activeNetwork} Packages</span>
                        <span className="text-xs font-normal text-muted-foreground">{filteredPackages.length} available</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredPackages.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            No packages available for {activeNetwork}.
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/40 text-xs text-muted-foreground">
                                            <th className="text-left px-4 py-3 font-medium">Package</th>
                                            <th className="text-right px-4 py-3 font-medium">Your Cost</th>
                                            <th className="text-right px-4 py-3 font-medium w-40">Your Price (GHS)</th>
                                            <th className="text-right px-4 py-3 font-medium">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPackages.map((pkg) => {
                                            const val = pricing[pkg.id] || ''
                                            const cost = getCostPrice(pkg)
                                            const profit = getProfit(pkg, val)
                                            const valid = isValidPrice(pkg, val)
                                            return (
                                                <tr key={pkg.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-medium">{pkg.size}</td>
                                                    <td className="px-4 py-3 text-right text-muted-foreground font-mono">{formatCurrency(cost)}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="relative max-w-[120px] ml-auto">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={val}
                                                                onChange={(e) => setPricing(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                                                                placeholder="—"
                                                                className={cn(
                                                                    'text-right pr-2',
                                                                    val && valid === false && 'border-red-500 focus-visible:ring-red-500',
                                                                    val && valid === true && 'border-green-500 focus-visible:ring-green-500',
                                                                )}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {profit !== null ? (
                                                            <span className={cn(
                                                                'font-bold inline-flex items-center gap-1',
                                                                profit > 0 ? 'text-emerald-600' : 'text-red-500'
                                                            )}>
                                                                {profit > 0 ? '+' : ''}{formatCurrency(profit)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y">
                                {filteredPackages.map((pkg) => {
                                    const val = pricing[pkg.id] || ''
                                    const cost = getCostPrice(pkg)
                                    const profit = getProfit(pkg, val)
                                    const valid = isValidPrice(pkg, val)
                                    return (
                                        <div key={pkg.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-base">{pkg.size}</span>
                                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                                    Cost: {formatCurrency(cost)}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 items-center">
                                                <div>
                                                    <label className="text-xs text-muted-foreground mb-1 block">Your Price</label>
                                                    <Input
                                                        type="number"
                                                        inputMode="decimal"
                                                        value={val}
                                                        onChange={(e) => setPricing(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                                                        placeholder="Set Price"
                                                        className={cn(
                                                            'h-10',
                                                            val && valid === false && 'border-red-500 focus-visible:ring-red-500',
                                                            val && valid === true && 'border-green-500 focus-visible:ring-green-500',
                                                        )}
                                                    />
                                                </div>
                                                <div className="text-right">
                                                    <label className="text-xs text-muted-foreground mb-1 block">Profit</label>
                                                    {profit !== null ? (
                                                        <span className={cn(
                                                            'text-lg font-bold block',
                                                            profit > 0 ? 'text-emerald-600' : 'text-red-500'
                                                        )}>
                                                            {formatCurrency(profit)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-lg font-medium text-muted-foreground block">—</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Mobile Sticky Save Button */}
            <div className="fixed bottom-4 left-4 right-4 md:hidden z-10">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg shadow-xl"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    {saving ? 'Saving...' : 'Save Prices'}
                </Button>
            </div>
        </div>
    )
}
