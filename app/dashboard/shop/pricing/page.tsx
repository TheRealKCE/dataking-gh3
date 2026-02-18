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
    cost_price: number
    is_available: boolean
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

export default function ShopPricingPage() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()
    const [shopId, setShopId] = useState<string | null>(null)
    const [packages, setPackages] = useState<Package[]>([])
    const [pricing, setPricing] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

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
            const { data: shop } = await (supabase
                .from('shop_profiles')
                .select('id')
                .eq('owner_id', dbUser!.id)
                .single() as any)

            if (!shop) {
                toast.error('Please create your shop first')
                router.push('/dashboard/shop/setup')
                return
            }
            setShopId(shop.id)

            // Get packages and existing pricing in parallel
            const [pkgRes, priceRes] = await Promise.all([
                (supabase.from('data_packages').select('*').eq('is_available', true).order('network').order('sort_order') as any),
                (supabase.from('shop_pricing').select('*').eq('shop_id', shop.id) as any),
            ])

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

    const getProfit = (pkg: Package, sellingStr: string) => {
        const selling = parseFloat(sellingStr)
        if (isNaN(selling)) return null
        return selling - pkg.cost_price
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

            if (rows.length === 0) {
                toast.error('Set at least one price')
                return
            }

            // Delete existing and re-insert (clean upsert)
            await (supabase.from('shop_pricing').delete().eq('shop_id', shopId) as any)
            const { error } = await (supabase.from('shop_pricing').insert(rows) as any)
            if (error) throw error

            toast.success(`${rows.length} prices saved!`)
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

    // Group by network
    const grouped = packages.reduce((acc, pkg) => {
        if (!acc[pkg.network]) acc[pkg.network] = []
        acc[pkg.network].push(pkg)
        return acc
    }, {} as Record<string, Package[]>)

    const setPricedCount = Object.values(pricing).filter(v => v && parseFloat(v) > 0).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Tag className="w-6 h-6 text-emerald-600" />
                        Pricing Engine
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Set your selling prices. Only packages with a price will appear on your shop.
                        {setPricedCount > 0 && <span className="ml-2 font-semibold text-emerald-600">{setPricedCount} packages priced</span>}
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save All Prices'}
                </Button>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex gap-2 text-sm text-blue-700 dark:text-blue-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Leave a price blank to hide that package from your shop. Selling price must be higher than cost price.</span>
            </div>

            {/* Packages by network */}
            {Object.entries(grouped).map(([network, pkgs]) => (
                <Card key={network}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', networkColors[network] || 'bg-gray-100 text-gray-700')}>
                                {network}
                            </span>
                            <span className="text-muted-foreground font-normal">{pkgs.length} packages</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                        <th className="text-left px-4 py-2 font-medium">Package</th>
                                        <th className="text-right px-4 py-2 font-medium">Cost Price</th>
                                        <th className="text-right px-4 py-2 font-medium w-36">Your Price (GHS)</th>
                                        <th className="text-right px-4 py-2 font-medium">Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pkgs.map((pkg) => {
                                        const val = pricing[pkg.id] || ''
                                        const profit = getProfit(pkg, val)
                                        const valid = isValidPrice(pkg, val)
                                        return (
                                            <tr key={pkg.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 font-medium">{pkg.size}</td>
                                                <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(pkg.cost_price)}</td>
                                                <td className="px-4 py-3">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={val}
                                                        onChange={(e) => setPricing(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                                                        placeholder="—"
                                                        className={cn(
                                                            'h-8 text-right text-sm w-28 ml-auto',
                                                            val && valid === false && 'border-red-500 focus-visible:ring-red-500',
                                                            val && valid === true && 'border-green-500 focus-visible:ring-green-500',
                                                        )}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {profit !== null ? (
                                                        <span className={cn(
                                                            'font-semibold flex items-center justify-end gap-1',
                                                            profit > 0 ? 'text-emerald-600' : 'text-red-500'
                                                        )}>
                                                            {profit > 0
                                                                ? <><TrendingUp className="w-3.5 h-3.5" />{formatCurrency(profit)}</>
                                                                : <><AlertCircle className="w-3.5 h-3.5" />Below cost</>
                                                            }
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
                    </CardContent>
                </Card>
            ))}

            <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold gap-2"
            >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? 'Saving...' : 'Save All Prices'}
            </Button>
        </div>
    )
}
