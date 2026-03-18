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
    shop_name: string
    owner_role: string
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
    const [manualMargin, setManualMargin] = useState<string>('0.50')

    useEffect(() => {
        // Shop feature is available to all authenticated users (agent, customer, admin, sub-admin)
        if (dbUser) fetchData()
    }, [dbUser, isAdmin, isSubAdmin])

    const fetchData = async () => {
        try {
            const { data: shopData } = await ((supabase as any)
                .from('shop_profiles')
                .select('id, shop_name, owner_id, approval_status, pricing_status, pricing_note, pricing_rejection_acknowledged')
                .eq('owner_id', dbUser!.id)
                .single())

            if (shopData && shopData.owner_id) {
                const { data: uData } = await supabase.from('users').select('role').eq('id', shopData.owner_id).single();
                shopData.owner_role = uData?.role || 'customer';
            }

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
        const maxProfit = shop?.owner_role === 'agent' ? 10 : 5
        return profit > 0 && profit <= maxProfit
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

        const maxProfit = shop.owner_role === 'agent' ? 10 : 5
        let invalidReason = ''
        const invalid = packages.filter(pkg => {
            const val = pricing[pkg.id]
            if (!val || parseFloat(val) <= 0) return false
            const profit = getProfit(pkg, val)
            if (profit === null) return false
            if (profit <= 0) {
                invalidReason = 'Profit must be more than 0'
                return true
            }
            if (profit > maxProfit) {
                invalidReason = `Profit cannot exceed GHS ${maxProfit.toFixed(2)}`
                return true
            }
            return false
        })

        if (invalid.length > 0) {
            toast.error(`${invalidReason} for: ${invalid.map(p => `${p.network} ${p.size}`).join(', ')}`)
            return
        }

        const rows = packages
            .filter(pkg => pricing[pkg.id] && parseFloat(pricing[pkg.id]) > 0)
            .map(pkg => ({
                shop_id: shop.id,
                package_id: pkg.id,
                profit_margin: getProfit(pkg, pricing[pkg.id]),
                selling_price: parseFloat(pricing[pkg.id])
            }))

        if (rows.length === 0) {
            toast.error('Set at least one price before submitting')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/shop/pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId: shop.id, items: rows })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to submit pricing')

            toast.success('Your shop is now live! Customers can start buying.')
            setShop(prev => prev ? { ...prev, pricing_status: 'approved', approval_status: 'approved' } : null)
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

    // ── Editable state (approved or rejected/acknowledged) ──
    const filteredPackages = packages.filter(p => p.network === activeNetwork)
    const setPricedCount = Object.values(pricing).filter(v => v && parseFloat(v) > 0).length
    const isResubmission = shop?.pricing_status === 'approved'

    const handleApplyManualMargin = () => {
        const margin = parseFloat(manualMargin)
        if (isNaN(margin) || margin <= 0) {
            toast.error('Profit must be more than 0')
            return
        }
        const maxProfit = shop?.owner_role === 'agent' ? 10 : 5
        if (margin > maxProfit) {
            toast.error(`Profit cannot exceed GHS ${maxProfit.toFixed(2)}`)
            return
        }
        
        const newPricing: Record<string, string> = { ...pricing }
        let count = 0
        packages.forEach(pkg => {
            if (!pkg.is_available) return
            const selling = getCostPrice(pkg) + margin
            newPricing[pkg.id] = selling.toFixed(2)
            count++
        })
        setPricing(newPricing)
        toast.success(`Applied GHS ${margin.toFixed(2)} profit to ${count} packages`, {
            description: 'Review below then click Save & Go Live when ready.'
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
                        <Button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Save & Go Live'}
                        </Button>
                    </div>
                </div>

                {/* Warning banner for resubmission */}
                {isResubmission && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                            <strong>Heads up!</strong> Your new prices will go live automatically, but admins reserve the right to review and reject them later.
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

                {/* ── User Education & Pricing Tools ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* How to Set Your Price (Education block) */}
                    <div className="flex flex-col gap-2 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10">
                        <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-5 h-5 text-emerald-600" />
                            <span className="font-bold text-base text-emerald-800 dark:text-emerald-300">How to Set Your Price</span>
                        </div>
                        <div className="text-sm text-emerald-800 dark:text-emerald-200 space-y-3">
                            <p>Your cost price is what you pay us.<br/>Your profit is what you add on top.</p>
                            <div className="p-3 bg-white dark:bg-black/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                                <strong>Example:</strong><br/>If your cost is GHS 10 and you add GHS {shop?.owner_role === 'agent' ? '3' : '2'},<br/>you will sell at <strong>GHS {shop?.owner_role === 'agent' ? '13' : '12'}</strong>.
                            </div>
                            <ul className="space-y-1.5 pt-1 font-medium">
                                <li>✅ <strong>Max profit:</strong> GHS {shop?.owner_role === 'agent' ? '10.00' : '5.00'}</li>
                                <li>❌ You cannot sell below your cost</li>
                            </ul>
                            <div className="pt-2 text-emerald-700 dark:text-emerald-400 font-medium pb-1">
                                {shop?.owner_role === 'agent' 
                                    ? '💡 Tip: Agents can set higher profit to cover subscription costs.' 
                                    : '💡 Tip: Start with GHS 1–2 profit.'}
                            </div>
                        </div>
                    </div>

                    {/* Manual Profit Block */}
                    <div className="flex flex-col gap-3 p-5 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            <span className="font-bold text-base text-blue-800 dark:text-blue-300">Set Bulk Profit Margin</span>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-400">
                            Enter your desired profit amount, then click <strong>Apply</strong> to quickly set all {activeNetwork} items to Cost + your profit.
                        </p>
                        <div className="flex gap-3 mt-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">GHS</span>
                                <Input
                                    type="number"
                                    min="0.01"
                                    max={shop?.owner_role === 'agent' ? "10.00" : "5.00"}
                                    step="0.01"
                                    value={manualMargin}
                                    onChange={(e) => setManualMargin(e.target.value)}
                                    className="pl-12 h-12 bg-white dark:bg-gray-800 text-lg shadow-sm"
                                    placeholder="e.g. 1.00"
                                />
                            </div>
                            <Button
                                onClick={handleApplyManualMargin}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-12 font-semibold shadow-sm gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Apply
                            </Button>
                        </div>
                    </div>
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
                                {/* Unified Mobile-Friendly Card View */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                                    {filteredPackages.map((pkg) => {
                                        const valStr = pricing[pkg.id] || ''
                                        const cost = getCostPrice(pkg)
                                        const finalSelling = parseFloat(valStr) || 0
                                        const profitStr = finalSelling > 0 ? (finalSelling - cost).toFixed(2) : ''
                                        
                                        const valid = isValidPrice(pkg, valStr)

                                        return (
                                            <div key={pkg.id} className={cn(
                                                "flex flex-col p-5 rounded-2xl border-2 transition-colors",
                                                valStr && valid === false ? "border-red-300 bg-red-50/30 dark:border-red-900 overflow-hidden" : 
                                                valStr && valid === true ? "border-emerald-200 shadow-sm" : "border-gray-200 dark:border-gray-800 shadow-sm"
                                            )}>
                                                {/* Header & Cost */}
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="font-black text-lg text-foreground">{pkg.size}</h3>
                                                        <span className="inline-block mt-1 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                                                            Cost: {formatCurrency(cost)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Profit Input */}
                                                <div className="mt-auto space-y-4">
                                                    <div>
                                                        <label className="text-sm font-semibold flex items-center justify-between mb-1.5 text-foreground">
                                                            Enter Profit
                                                            {valStr && valid === false && (
                                                                <span className="text-xs text-red-600 dark:text-red-400 font-medium">GHS 0.01 - {shop?.owner_role === 'agent' ? '10.00' : '5.00'}</span>
                                                            )}
                                                        </label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">GHS</span>
                                                            <Input
                                                                type="number"
                                                                inputMode="decimal"
                                                                value={profitStr}
                                                                onChange={(e) => {
                                                                    const parsedProfit = parseFloat(e.target.value)
                                                                    if (isNaN(parsedProfit)) {
                                                                        setPricing(prev => ({ ...prev, [pkg.id]: '' }))
                                                                    } else {
                                                                        setPricing(prev => ({ ...prev, [pkg.id]: (cost + parsedProfit).toFixed(2) }))
                                                                    }
                                                                }}
                                                                placeholder="0.00"
                                                                className={cn(
                                                                    'h-12 pl-12 text-lg font-medium',
                                                                    valStr && valid === false && 'border-red-500 focus-visible:ring-red-500 bg-white dark:bg-gray-900',
                                                                    valStr && valid === true && 'border-green-500 focus-visible:ring-green-500 bg-white dark:bg-gray-900',
                                                                )}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Selling Price Display */}
                                                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border">
                                                        <span className="text-sm font-medium text-muted-foreground">You Sell At:</span>
                                                        {valStr && valid !== null ? (
                                                            <span className="text-lg font-black text-foreground">
                                                                {formatCurrency(finalSelling)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-lg font-bold text-muted-foreground">—</span>
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
                <div className="fixed bottom-4 left-4 right-4 md:hidden z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-2 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl">
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold shadow-xl gap-2 rounded-xl"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        {saving ? 'Saving...' : 'Save & Go Live'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
