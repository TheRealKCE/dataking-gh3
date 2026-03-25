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
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
    Tag, Save, Loader2, TrendingUp, AlertCircle, CheckCircle2,
    Clock, XCircle, Lightbulb, Send, Lock, ArrowLeft, Sparkles, PhoneCall
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
    airtime_fee_mtn?: number
    airtime_fee_telecel?: number
    airtime_fee_at?: number
}

const networkColors: Record<string, string> = {
    MTN: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    Telecel: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'AT-iShare': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'AT-BigTime': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    AT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const AIRTIME_NETWORKS = ['MTN', 'Telecel', 'AT']

export default function ShopPricingPage() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()
    const [shop, setShop] = useState<ShopProfile | null>(null)
    const [packages, setPackages] = useState<Package[]>([])
    const [pricing, setPricing] = useState<Record<string, string>>({})
    const [airtimeFees, setAirtimeFees] = useState({ mtn: '', telecel: '', at: '' })
    const [adminAirtimeFees, setAdminAirtimeFees] = useState<Record<string, number>>({})
    
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [savingAirtime, setSavingAirtime] = useState(false)
    const [acknowledging, setAcknowledging] = useState(false)
    const [activeNetwork, setActiveNetwork] = useState<string>('MTN')
    const [manualMargin, setManualMargin] = useState<string>('0.50')

    useEffect(() => {
        if (dbUser) fetchData()
    }, [dbUser, isAdmin, isSubAdmin])

    const fetchData = async () => {
        try {
            const { data: shopData } = await ((supabase as any)
                .from('shop_profiles')
                .select('id, shop_name, owner_id, approval_status, pricing_status, pricing_note, pricing_rejection_acknowledged, airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at')
                .eq('owner_id', dbUser!.id)
                .single())

            if (shopData && shopData.owner_id) {
                const { data: uData } = await (supabase as any).from('users').select('role').eq('id', shopData.owner_id).single()
                shopData.owner_role = uData?.role || 'customer'
            }

            if (!shopData) {
                toast.error('Please create your shop first')
                router.push('/dashboard/shop/setup')
                return
            }
            setShop(shopData)

            setAirtimeFees({
                mtn: shopData.airtime_fee_mtn?.toString() || '',
                telecel: shopData.airtime_fee_telecel?.toString() || '',
                at: shopData.airtime_fee_at?.toString() || ''
            })

            const [pkgRes, priceRes, adminRes] = await Promise.all([
                (supabase.from('data_packages').select('*').eq('is_available', true).order('sort_order') as any),
                ((supabase as any).from('shop_pricing').select('*').eq('shop_id', shopData.id)),
                fetch('/api/shop/pricing').then(res => res.json())
            ])

            setPackages(pkgRes.data || [])

            const adminFlags: Record<string, number> = {}
            for (const [key, value] of Object.entries(adminRes || {})) {
                adminFlags[key] = parseFloat(value as string) || 0
            }
            setAdminAirtimeFees(adminFlags)

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

    const getMaxAirtimeProfit = (networkStr: string) => {
        const role = shop?.owner_role || 'customer'
        const key = `airtime_fee_${networkStr.toLowerCase()}_${role}`
        const adminFee = adminAirtimeFees[key] || 0
        return Math.max(0, 10 - adminFee)
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

    const handleSaveAirtimeOnly = async () => {
        if (!shop) return
        setSavingAirtime(true)
        try {
            // Validate Airtime explicitly
            let valid = true
            for (const net of ['mtn', 'telecel', 'at']) {
                const max = getMaxAirtimeProfit(net)
                const val = parseFloat(airtimeFees[net as keyof typeof airtimeFees] || '0')
                if (val > max) {
                    toast.error(`${net.toUpperCase()} Airtime Profit exceeds maximum of ${max.toFixed(2)}%`)
                    valid = false
                }
            }
            if (!valid) return

            const res = await fetch('/api/shop/pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId: shop.id, airtimeFees }) // Send only airtimeFees to update airtime globally without clearing packages
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to submit airtime settings')
            toast.success('Airtime Profit Settings Live!')
        } catch (err: any) {
            toast.error(err.message || 'Failed to submit airtime settings')
        } finally {
            setSavingAirtime(false)
        }
    }

    const handleSubmit = async () => {
        if (!shop) return

        const maxDataProfit = shop.owner_role === 'agent' ? 10 : 5
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
            if (profit > maxDataProfit) {
                invalidReason = `Profit cannot exceed GHS ${maxDataProfit.toFixed(2)}`
                return true
            }
            return false
        })

        if (invalid.length > 0) {
            toast.error(`${invalidReason} for: ${invalid.map(p => `${p.network} ${p.size}`).join(', ')}`)
            return
        }

        // Validate Airtime explicitly alongside data package bundle
        for (const net of ['mtn', 'telecel', 'at']) {
            const max = getMaxAirtimeProfit(net)
            const val = parseFloat(airtimeFees[net as keyof typeof airtimeFees] || '0')
            if (val > max) {
                toast.error(`${net.toUpperCase()} Airtime Profit exceeds maximum of ${max.toFixed(2)}%`)
                return
            }
        }

        const rows = packages
            .filter(pkg => pricing[pkg.id] && parseFloat(pricing[pkg.id]) > 0)
            .map(pkg => ({
                shop_id: shop.id,
                package_id: pkg.id,
                profit_margin: getProfit(pkg, pricing[pkg.id]),
                selling_price: parseFloat(pricing[pkg.id])
            }))

        if (rows.length === 0 && !airtimeFees.mtn && !airtimeFees.telecel && !airtimeFees.at) {
            toast.error('Please configure a price to save changes')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/shop/pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId: shop.id, items: rows, airtimeFees })
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
            <div className="space-y-4 max-w-7xl mx-auto px-4">
                <Skeleton className="h-8 w-48" />
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
            </div>
        )
    }

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
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-12"
                        >
                            {acknowledging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            I Understand, Let Me Revise
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

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
        toast.success(`Applied GHS ${margin.toFixed(2)} profit to ${count} packages`)
    }

    return (
        <div className="space-y-8 pb-32 max-w-7xl mx-auto px-4 md:px-8 mt-6">
            <div className="flex flex-col gap-4">
                <Link href="/dashboard/shop">
                    <Button variant="ghost" size="sm" className="w-fit gap-2 -ml-2 text-muted-foreground hover:text-emerald-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Shop Dashboard
                    </Button>
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <Tag className="w-8 h-8 text-emerald-600" />
                            Pricing Engine
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1 font-bold uppercase tracking-widest opacity-80">
                            Configure your Storefront Rates
                        </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <Button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xl h-12 px-6 rounded-2xl"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Save & Go Live'}
                        </Button>
                    </div>
                </div>

                {isResubmission && (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex gap-3 text-sm text-amber-700 dark:text-amber-300 mt-4">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
                        <span>
                            <strong>Heads up!</strong> Your new prices will go live automatically, but admins reserve the right to review and reject them later.
                        </span>
                    </div>
                )}
            </div>

            {/* AIRTIME PROFIT SECTION (ABOVE DATA GRID) */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 rounded-[2.5rem] p-6 md:p-8 border border-indigo-100 dark:border-indigo-900 shadow-sm relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 relative z-10">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                            <PhoneCall className="w-6 h-6" /> Airtime Profit Configurator
                        </h2>
                        <p className="text-xs font-bold text-indigo-700/70 dark:text-indigo-400/70 uppercase tracking-widest mt-1 max-w-xl">
                            By default, airtime profit is zero. You earn nothing until you explicitly configure your markup below. The max allowed combined total fee is strictly 10%.
                        </p>
                    </div>
                    <Button 
                        onClick={handleSaveAirtimeOnly} 
                        disabled={savingAirtime}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 px-6 rounded-2xl shrink-0 gap-2 shadow-lg w-full md:w-auto"
                    >
                        {savingAirtime ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Airtime Only
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                    {AIRTIME_NETWORKS.map(net => {
                        const key = net.toLowerCase() as keyof typeof airtimeFees
                        const maxAllowed = getMaxAirtimeProfit(net)
                        const val = parseFloat(airtimeFees[key] || '0')
                        const isOverLimit = val > maxAllowed

                        return (
                            <div key={net} className={cn(
                                "bg-white dark:bg-slate-900 p-6 rounded-[2rem] border transition-all",
                                isOverLimit ? "border-red-300 shadow-md ring-2 ring-red-100" : "border-indigo-100 dark:border-slate-800 shadow-sm hover:border-indigo-300"
                            )}>
                                <div className="flex justify-between items-center mb-6">
                                    <Badge variant="outline" className={cn("px-4 py-1.5 uppercase font-black tracking-widest", networkColors[net] || networkColors['MTN'])}>{net}</Badge>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Max Markup</p>
                                        <p className="font-black text-slate-900 dark:text-white">{maxAllowed.toFixed(2)}%</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="relative group/input">
                                        <Input
                                            type="number"
                                            value={airtimeFees[key]}
                                            onChange={e => setAirtimeFees(s => ({ ...s, [key]: e.target.value }))}
                                            className={cn(
                                                "rounded-xl h-14 pr-12 bg-slate-50 dark:bg-slate-800 text-xl font-black text-center shadow-inner transition-colors",
                                                isOverLimit ? "text-red-600 bg-red-50 dark:bg-red-900/10 focus-visible:ring-red-300" : "text-indigo-900 dark:text-white"
                                            )}
                                            min="0" max={maxAllowed} step="0.1" placeholder="0.00"
                                        />
                                        <span className={cn("absolute right-5 top-1/2 -translate-y-1/2 font-black text-sm", isOverLimit ? "text-red-500" : "text-slate-400")}>%</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-500 uppercase tracking-widest">Network Cost:</span>
                                        <span className="font-black text-slate-400">{(10 - maxAllowed).toFixed(2)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Your Profit:</span>
                                        <span className={cn("font-black text-lg", isOverLimit ? "text-red-500" : "text-emerald-500")}>{val.toFixed(2)}%</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Existing Data Package Section */}
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2 p-6 rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-6 h-6 text-emerald-600" />
                            <span className="font-black text-lg uppercase tracking-tight text-emerald-800 dark:text-emerald-300">Data Pricing Guide</span>
                        </div>
                        <div className="text-sm text-emerald-800/80 dark:text-emerald-200/80 space-y-3 font-medium">
                            <p>Your cost price is what you pay us. Your profit is what you add on top.</p>
                            <div className="p-4 bg-white dark:bg-black/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm flex flex-col gap-1">
                                <span className="text-emerald-900 dark:text-emerald-100 mb-1"><strong>Example:</strong> If cost is GHS 10 and you add GHS {shop?.owner_role === 'agent' ? '3' : '2'}</span>
                                <span className="font-black text-lg">You sell at GHS {shop?.owner_role === 'agent' ? '13' : '12'}</span>
                            </div>
                            <ul className="space-y-2 pt-2 text-xs uppercase tracking-wider font-bold">
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Max profit: GHS {shop?.owner_role === 'agent' ? '10.00' : '5.00'}</li>
                                <li className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500"/> Cannot sell below cost</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 p-6 rounded-3xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 shadow-sm justify-center">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-6 h-6 text-blue-600" />
                            <span className="font-black text-lg uppercase tracking-tight text-blue-800 dark:text-blue-300">Bulk Data Margin</span>
                        </div>
                        <p className="text-sm font-medium text-blue-700/80 dark:text-blue-400/80 mb-2">
                            Enter desired profit amount, then click <strong>Apply</strong> to quickly set all {activeNetwork} items to Cost + your profit.
                        </p>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-black uppercase tracking-widest">GHS</span>
                                <Input
                                    type="number" min="0.01" max={shop?.owner_role === 'agent' ? "10.00" : "5.00"} step="0.01" value={manualMargin}
                                    onChange={(e) => setManualMargin(e.target.value)}
                                    className="pl-14 h-14 rounded-2xl bg-white dark:bg-gray-800 text-xl font-bold border-transparent focus:ring-blue-500 shadow-inner"
                                />
                            </div>
                            <Button
                                onClick={handleApplyManualMargin}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-2xl h-14 font-black uppercase tracking-widest gap-2 shadow-lg"
                            >
                                Apply Bulk
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 pt-4 scrollbar-hide">
                    {NETWORKS.map(network => {
                        const count = packages.filter(p => p.network === network).length
                        if (count === 0) return null
                        const isActiveTab = activeNetwork === network
                        return (
                            <button
                                key={network}
                                onClick={() => setActiveNetwork(network)}
                                className={cn(
                                    'flex items-center gap-2 h-12 px-6 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 shrink-0',
                                    isActiveTab
                                        ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                                )}
                            >
                                {network}
                                <span className={cn("px-2 py-0.5 rounded-md", isActiveTab ? "bg-white/20" : "bg-slate-100 dark:bg-slate-700")}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
                    {filteredPackages.map((pkg) => {
                        const valStr = pricing[pkg.id] || ''
                        const cost = getCostPrice(pkg)
                        const finalSelling = parseFloat(valStr) || 0
                        const profitStr = finalSelling > 0 ? (finalSelling - cost).toFixed(2) : ''
                        const valid = isValidPrice(pkg, valStr)

                        return (
                            <div key={pkg.id} className={cn(
                                "flex flex-col p-6 rounded-[2rem] border-2 transition-all duration-300",
                                valStr && valid === false ? "border-red-400 bg-red-50/50 dark:border-red-900/30" : 
                                valStr && valid === true ? "border-emerald-300 shadow-md bg-white dark:bg-slate-900" : "border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"
                            )}>
                                <div className="mb-6 space-y-2">
                                    <h3 className="font-black text-xl tracking-tighter text-foreground">{pkg.size}</h3>
                                    <span className="inline-block text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                                        Cost: {formatCurrency(cost)}
                                    </span>
                                </div>

                                <div className="mt-auto space-y-5">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selling Price</Label>
                                            {valStr && valid === false && <span className="text-[10px] text-red-600 font-bold uppercase tracking-tight">Max Profit: {shop?.owner_role === 'agent' ? '10' : '5'}</span>}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">GHS</span>
                                            <Input
                                                type="number" inputMode="decimal" value={valStr}
                                                onChange={(e) => setPricing(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                                                placeholder={cost.toFixed(2)}
                                                className={cn(
                                                    'h-14 rounded-2xl pl-14 text-xl font-black shadow-inner transition-colors',
                                                    valStr && valid === false ? 'border-red-500 bg-red-50 text-red-900 focus:ring-red-400' : 
                                                    valStr && valid === true ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-transparent'
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3 border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Price tag</span>
                                            <span className="font-black text-lg">{valStr && valid !== null ? formatCurrency(finalSelling) : '—'}</span>
                                        </div>
                                        <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                        <div className="flex items-center justify-between">
                                            <span className={cn("text-[10px] font-black uppercase tracking-widest", valid ? "text-emerald-600" : "text-slate-400")}>Profit</span>
                                            <span className={cn("font-black text-base", valid ? "text-emerald-500" : valid === false ? "text-red-500" : "text-slate-400")}>
                                                {valStr && valid !== null ? `${parseFloat(profitStr) > 0 ? '+' : ''} ${formatCurrency(parseFloat(profitStr) || 0)}` : '—'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 z-50 pointer-events-none">
                <Button
                    onClick={handleSubmit} disabled={saving}
                    className="w-full md:w-auto min-w-[200px] h-16 rounded-[2rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest shadow-2xl hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] pointer-events-auto hover:bg-black hover:scale-105 transition-all outline-none"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />}
                    {saving ? 'Saving Everything...' : 'Save & Go Live'}
                </Button>
            </div>
        </div>
    )
}
