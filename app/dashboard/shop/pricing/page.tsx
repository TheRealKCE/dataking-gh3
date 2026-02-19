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
    Tag, Save, Loader2, TrendingUp, AlertCircle, CheckCircle2,
    Clock, XCircle, Lightbulb, Send, Lock, ArrowLeft, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Package {
    id: string
    network: string
    size: string
    price: number
    agent_price: number
    cost_price: number
    is_available: boolean
    sort_order: number
}

interface ShopProfile {
    id: string
    approval_status: string
    pricing_status: 'not_submitted' | 'pending_review' | 'approved' | 'rejected'
    pricing_note: string | null
    pricing_rejection_acknowledged: boolean
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
    const [shop, setShop] = useState<ShopProfile | null>(null)
    const [packages, setPackages] = useState<Package[]>([])
    const [pricing, setPricing] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [acknowledging, setAcknowledging] = useState(false)
    const [activeNetwork, setActiveNetwork] = useState<string>('MTN')
    const [profitMargin, setProfitMargin] = useState<string>('0.50')

    useEffect(() => {
        if (dbUser && !isAdmin && !isSubAdmin) {
            router.replace('/dashboard')
            return
        }
        if (dbUser) fetchData()
    }, [dbUser, isAdmin, isSubAdmin])

    const fetchData = async () => {
        try {
            const { data: shopData } = await ((supabase as any)
                .from('shop_profiles')
                .select('id, approval_status, pricing_status, pricing_note, pricing_rejection_acknowledged')
                .eq('owner_id', dbUser!.id)
                .single())

            if (!shopData) {
                toast.error('Please create your shop first')
                router.push('/dashboard/shop/setup')
                return
            }
            setShop(shopData)

            const [pkgRes, priceRes] = await Promise.all([
                (supabase.from('data_packages').select('*').eq('is_available', true).order('sort_order') as any),
                // Load live prices (for display reference)
                ((supabase as any).from('shop_pricing').select('*').eq('shop_id', shopData.id)),
            ])

            setPackages(pkgRes.data || [])

            // Build pricing map from live prices (what's currently approved)
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

    const getCostPrice = (pkg: Package) => {
        if (dbUser?.role === 'agent' && pkg.agent_price > 0) return pkg.agent_price
        return pkg.price
    }

    const getProfit = (pkg: Package, sellingStr: string) => {
        const selling = parseFloat(sellingStr)
        if (isNaN(selling)) return null
        return selling - getCostPrice(pkg)
    }

    const isValidPrice = (pkg: Package, sellingStr: string) => {
        const profit = getProfit(pkg, sellingStr)
        if (profit === null) return null
        return profit > 0
    }

    const handleAcknowledge = async () => {
        if (!shop) return
        setAcknowledging(true)
        try {
            const { error } = await (supabase as any).from('shop_profiles').update({
                pricing_rejection_acknowledged: true,
                updated_at: new Date().toISOString(),
            }).eq('id', shop.id)
            if (error) throw error
            setShop(prev => prev ? { ...prev, pricing_rejection_acknowledged: true } : null)
        } catch (err: any) {
            toast.error(err.message || 'Failed to acknowledge')
        } finally {
            setAcknowledging(false)
        }
    }

    const handleSubmit = async () => {
        if (!shop) return

        const invalid = packages.filter(pkg => {
            const val = pricing[pkg.id]
            if (!val) return false
            return !isValidPrice(pkg, val)
        })
        if (invalid.length > 0) {
            toast.error(`Price must be above cost for: ${invalid.map(p => `${p.network} ${p.size}`).join(', ')}`)
            return
        }

        const rows = packages
            .filter(pkg => pricing[pkg.id] && parseFloat(pricing[pkg.id]) > 0)
            .map(pkg => ({
                shop_id: shop.id,
                package_id: pkg.id,
                selling_price: parseFloat(pricing[pkg.id]),
                submitted_at: new Date().toISOString(),
            }))

        if (rows.length === 0) {
            toast.error('Set at least one price before submitting')
            return
        }

        setSaving(true)
        try {
            // Save to pending table (not live table)
            await (supabase as any).from('shop_pricing_pending').delete().eq('shop_id', shop.id)
            const { error: insertErr } = await (supabase as any).from('shop_pricing_pending').insert(rows)
            if (insertErr) throw insertErr

            // Update pricing status
            const { error } = await (supabase as any).from('shop_profiles').update({
                pricing_status: 'pending_review',
                pricing_submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq('id', shop.id)
            if (error) throw error

            toast.success('Pricing submitted for admin review!')
            setShop(prev => prev ? { ...prev, pricing_status: 'pending_review' } : null)
        } catch (err: any) {
            toast.error(err.message || 'Failed to submit pricing')
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

    // ── State: Profile not yet approved ──
    if (shop?.approval_status !== 'approved') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold">Awaiting Profile Approval</h2>
                <p className="text-muted-foreground text-sm max-w-sm">
                    Your shop profile is being reviewed by an admin. You'll be able to set your prices once your profile is approved.
                </p>
            </div>
        )
    }

    // ── State: Pricing rejected — must acknowledge before editing ──
    if (shop?.pricing_status === 'rejected' && !shop?.pricing_rejection_acknowledged) {
        return (
            <div className="max-w-lg mx-auto py-10 space-y-4">
                <Card className="border-red-200 dark:border-red-800">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <XCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">Pricing Rejected</h2>
                                <p className="text-sm text-muted-foreground">Admin has reviewed and rejected your submitted prices.</p>
                            </div>
                        </div>

                        {shop.pricing_note && (
                            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Admin Note:</p>
                                <p className="text-sm text-red-800 dark:text-red-300">{shop.pricing_note}</p>
                            </div>
                        )}

                        <p className="text-sm text-muted-foreground">
                            Please read the admin's feedback above, then click below to revise your prices.
                        </p>

                        <Button
                            onClick={handleAcknowledge}
                            disabled={acknowledging}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        >
                            {acknowledging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            I Understand, Let Me Revise
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // ── State: Pricing submitted, awaiting admin review ──
    if (shop?.pricing_status === 'pending_review') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-purple-600 animate-pulse" />
                </div>
                <h2 className="text-xl font-bold">Pricing Under Review</h2>
                <p className="text-muted-foreground text-sm max-w-sm">
                    Your prices have been submitted and are awaiting admin approval. Your current live prices remain active in the meantime.
                </p>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 max-w-sm">
                    <AlertCircle className="w-4 h-4 inline mr-1.5" />
                    You'll be notified once the admin reviews your submission.
                </div>
            </div>
        )
    }

    // ── Editable state (not_submitted or approved) ──
    const filteredPackages = packages.filter(p => p.network === activeNetwork)
    const setPricedCount = Object.values(pricing).filter(v => v && parseFloat(v) > 0).length
    const isResubmission = shop?.pricing_status === 'approved'

    const handleAutoGenerate = () => {
        if (!packages.length) return

        const newPricing: Record<string, string> = { ...pricing }
        let count = 0

        packages.forEach(pkg => {
            if (!pkg.is_available) return
            const cost = getCostPrice(pkg)
            // Logic: Cost + 0.50
            const selling = cost + 0.50
            newPricing[pkg.id] = selling.toFixed(2)
            count++
        })

        setPricing(newPricing)
        toast.success(`Generated prices for ${count} packages (Cost + 0.50)!`, {
            description: 'Review the prices below and click Submit when ready.'
        })
    }

    return (
        <div className="space-y-6 pb-20 md:pb-0">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href="/dashboard/shop">
                    <Button variant="ghost" size="sm" className="w-fit gap-2 -ml-2 text-muted-foreground hover:text-emerald-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Shop Dashboard
                    </Button>
                </Link>
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
                    <div className="hidden sm:flex items-center gap-2">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">GHS</span>
                            <Input
                                type="number"
                                value={profitMargin}
                                onChange={(e) => setProfitMargin(e.target.value)}
                                className="w-24 pl-8 h-10 bg-white dark:bg-gray-800"
                                placeholder="0.50"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleAutoGenerate}
                            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                        >
                            <Sparkles className="w-4 h-4" />
                            Auto Generate
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {saving ? 'Submitting...' : 'Submit for Approval'}
                        </Button>
                    </div>
                </div>

                {/* Warning banner for resubmission */}
                {isResubmission && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                            <strong>Heads up!</strong> Your current live prices will remain active until the admin approves your new submission. Customers will continue to see your old prices in the meantime.
                        </span>
                    </div>
                )}

                {/* Cost info banner */}
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex gap-2 text-sm text-blue-700 dark:text-blue-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                        Your cost price is based on your role ({dbUser?.role === 'agent' ? 'Agent' : 'Customer'}).
                        Selling price must be higher than your cost.
                    </span>
                </div>

                {/* Business Tips */}
                <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <Lightbulb className="w-4 h-4" />
                            Tips for Better Business Growth
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <ul className="text-xs text-emerald-800 dark:text-emerald-300 space-y-1.5">
                            <li className="flex items-start gap-2">
                                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                                <span>Keep your profit margin <strong>small but consistent</strong> — lower prices attract more repeat customers.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                                <span>A <strong>GHS 0.50–1.00 profit</strong> per bundle adds up to big earnings with volume sales.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                                <span>Competitive pricing builds <strong>customer loyalty</strong> faster than one-time high margins.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                                <span>Bundles with the <strong>best value-for-money</strong> get shared the most on WhatsApp — free marketing!</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                                <span>Check what other shops charge and price <strong>slightly below</strong> to stand out and win customers.</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Network Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {NETWORKS.map(network => {
                        const count = packages.filter(p => p.network === network).length
                        if (count === 0) return null
                        const isActiveTab = activeNetwork === network
                        const colorClass = networkColors[network]
                        return (
                            <button
                                key={network}
                                onClick={() => setActiveNetwork(network)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap border',
                                    isActiveTab
                                        ? 'border-transparent shadow-sm scale-105'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50',
                                    isActiveTab && colorClass
                                )}
                            >
                                {network}
                                <span className="text-xs opacity-70 px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Pricing Table */}
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
                                {/* Desktop Table */}
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

                {/* Mobile Sticky Submit Button */}
                <div className="fixed bottom-4 left-4 right-4 md:hidden z-10 flex gap-2 items-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-2 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl">
                    <div className="relative w-20 flex-shrink-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">GHS</span>
                        <Input
                            type="number"
                            value={profitMargin}
                            onChange={(e) => setProfitMargin(e.target.value)}
                            className="w-full pl-6 h-10 text-xs bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                            placeholder="0.50"
                        />
                    </div>
                    <Button
                        variant="outline"
                        onClick={handleAutoGenerate}
                        className="flex-1 bg-white dark:bg-gray-800 border-emerald-200 text-emerald-700 h-10 text-xs gap-1 px-2"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Auto
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white h-10 text-sm gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {saving ? 'Submit' : 'Submit'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
