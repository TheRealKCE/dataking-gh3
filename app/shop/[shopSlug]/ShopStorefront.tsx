'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
    Phone, Mail, MessageCircle, ShoppingCart, Loader2,
    CheckCircle2, AlertCircle, X, Search, Zap, Smartphone, ChevronDown, Check,
    History, TrendingUp, Coins, Calendar, CalendarRange, RefreshCw, Info, Clock, Copy, ArrowRight, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface ShopData {
    id: string
    shop_name: string
    shop_slug: string
    description: string
    owner_phone: string
    owner_email: string | null
    whatsapp_number: string | null
    logo_url: string | null
    brand_color: string
    brand_accent: string
    ownerRole: string
    airtime_fee_mtn?: number
    airtime_fee_telecel?: number
    airtime_fee_at?: number
}

interface Package {
    id: string
    network: string
    size: string
    description: string | null
    selling_price: number
}

interface Props {
    shop: ShopData
    packages: Package[]
    adminSettings: Record<string, string>
}

// Fixed network order + brand colors (matches main platform)
const NETWORK_ORDER = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime', 'AT']

const networkColors: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
    MTN: { bg: '#FFCE00', text: '#000000', border: '#e6b800', gradient: 'from-yellow-400 to-yellow-500' },
    Telecel: { bg: '#E60000', text: '#ffffff', border: '#cc0000', gradient: 'from-red-500 to-red-600' },
    'AT-iShare': { bg: '#0056B3', text: '#ffffff', border: '#004494', gradient: 'from-blue-600 to-blue-700' },
    'AT-BigTime': { bg: '#6f42c1', text: '#ffffff', border: '#5a32a3', gradient: 'from-purple-600 to-purple-700' },
    AT: { bg: '#F97316', text: '#ffffff', border: '#ea580c', gradient: 'from-orange-500 to-orange-600' },
}

const QUICK_AMOUNTS = [1, 2, 5, 10, 20, 50, 100]

function MTNLogo() {
    return (
        <svg viewBox="0 0 60 60" className="w-8 h-8" fill="none">
            <circle cx="30" cy="30" r="30" fill="#FFD200"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1a1a1a">MTN</text>
        </svg>
    )
}
function TelecelLogo() {
    return (
        <svg viewBox="0 0 60 60" className="w-8 h-8" fill="none">
            <circle cx="30" cy="30" r="30" fill="#e63946"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">Telecel</text>
        </svg>
    )
}
function ATLogo() {
    return (
        <svg viewBox="0 0 60 60" className="w-8 h-8" fill="none">
            <circle cx="30" cy="30" r="30" fill="#F97316"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">AT</text>
        </svg>
    )
}

const NetworkLogo = ({ id }: { id: string }) => {
    if (id === 'MTN') return <MTNLogo />
    if (id === 'Telecel') return <TelecelLogo />
    return <ATLogo />
}

export default function ShopStorefront({ shop, packages, adminSettings }: Props) {
    const searchParams = useSearchParams()
    
    // Data State
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    
    // Airtime State
    const [isAirtimeOpen, setIsAirtimeOpen] = useState(false)
    const [airtimePhone, setAirtimePhone] = useState('')
    const [airtimeEmail, setAirtimeEmail] = useState('')
    const [airtimeAmount, setAirtimeAmount] = useState('')
    const [detectedNetwork, setDetectedNetwork] = useState<'MTN' | 'Telecel' | 'AT' | null>(null)
    const [isManualSelection, setIsManualSelection] = useState(false)
    const [useExact, setUseExact] = useState(false)
    const airtimeRef = useRef<HTMLDivElement>(null)
    
    // Global State
    const [loading, setLoading] = useState(false)
    const [pageLoading, setPageLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [contactInfo, setContactInfo] = useState<{ phone?: string; whatsapp?: string; email?: string } | null>(null)
    const [announcement, setAnnouncement] = useState<{ type: 'admin' | 'shop'; message: string; title?: string } | null>(null)
    const [announcementDismissed, setAnnouncementDismissed] = useState(false)

    // Derived flags for Airtime
    const isGlobalAirtimeEnabled = adminSettings['storefront_airtime_enabled'] === 'true'
    
    const airtimeNetworks = [
        { id: 'MTN', fee: shop.airtime_fee_mtn || 0, enabled: adminSettings['airtime_enabled_mtn'] !== 'false' },
        { id: 'Telecel', fee: shop.airtime_fee_telecel || 0, enabled: adminSettings['airtime_enabled_telecel'] !== 'false' },
        { id: 'AT', fee: shop.airtime_fee_at || 0, enabled: adminSettings['airtime_enabled_at'] !== 'false' }
    ].filter(n => n.fee > 0 && n.enabled)

    const isShopAirtimeEnabled = isGlobalAirtimeEnabled && airtimeNetworks.length > 0

    // Data Networks
    const availableNetworks = NETWORK_ORDER.filter(n => packages.some(p => p.network === n))
    const extraNetworks = [...new Set(packages.map(p => p.network))].filter(n => !NETWORK_ORDER.includes(n))
    const networks = [...availableNetworks, ...extraNetworks]
    const [activeNetwork, setActiveNetwork] = useState<string>(networks[0] || '')

    useEffect(() => {
        const timer = setTimeout(() => setPageLoading(false), 400)
        try { sessionStorage.setItem('shop_sticky_slug', shop.shop_slug) } catch (_) { }
        return () => clearTimeout(timer)
    }, [shop.shop_slug])

    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const { data: adminAnn } = await (supabase as any)
                    .from('system_announcements')
                    .select('title, message')
                    .eq('is_active', true)
                    .in('visible_on', ['storefronts', 'both'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (adminAnn) {
                    setAnnouncement({ type: 'admin', title: (adminAnn as any).title, message: (adminAnn as any).message })
                    return
                }

                const { data: shopAnn } = await (supabase as any)
                    .from('shop_announcements')
                    .select('message')
                    .eq('shop_id', shop.id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (shopAnn) {
                    setAnnouncement({ type: 'shop', message: (shopAnn as any).message })
                }
            } catch (err) {
                console.error('Error fetching announcements:', err)
            }
        }
        fetchAnnouncements()
    }, [shop.id])

    useEffect(() => {
        const error = searchParams.get('error')
        if (error) {
            const messages: Record<string, string> = {
                payment_failed: 'Payment was not completed. Please try again.',
                order_not_found: 'Order not found. Please try again.',
                server_error: 'Something went wrong. Please try again.',
                invalid_ref: 'Invalid payment reference.',
            }
            setErrorMsg(messages[error] || 'An error occurred. Please try again.')
        }
    }, [searchParams])

    // Auto-detect network for airtime
    useEffect(() => {
        if (isManualSelection) return
        
        const clean = airtimePhone.replace(/\s+/g, '')
        if (clean.length >= 3) {
            const prefix = clean.substring(0, 3)
            let detected: 'MTN' | 'Telecel' | 'AT' | null = null
            
            const prefixes = {
                MTN: ['024', '025', '053', '054', '055', '059', '098'],
                Telecel: ['020', '050'],
                AT: ['026', '027', '056']
            }

            for (const [net, prfxs] of Object.entries(prefixes)) {
                if (prfxs.includes(prefix)) {
                    detected = net as 'MTN' | 'Telecel' | 'AT'
                    break
                }
            }
            
            // Validate if detected network is supported by shop
            if (detected && airtimeNetworks.some(n => n.id === detected)) {
                setDetectedNetwork(detected)
            } else {
                setDetectedNetwork(null)
            }
        } else {
            setDetectedNetwork(null)
        }
    }, [airtimePhone, airtimeNetworks, isManualSelection])

    const calculateAirtimeFees = () => {
        if (!detectedNetwork || !airtimeAmount) return { feeAmount: 0, totalPay: 0, airtimeToReceive: 0 }
        const numAmount = parseFloat(airtimeAmount)
        if (isNaN(numAmount) || numAmount <= 0) return { feeAmount: 0, totalPay: 0, airtimeToReceive: 0 }

        const shopFeeConfig = airtimeNetworks.find(n => n.id === detectedNetwork)
        const shopFeeMultiplier = shopFeeConfig ? shopFeeConfig.fee : 0
        const adminFeeMultiplier = parseFloat(adminSettings[`airtime_fee_${detectedNetwork.toLowerCase()}_${shop.ownerRole}`] || '0')
        
        const totalMultiplier = (adminFeeMultiplier + shopFeeMultiplier) / 100
        const round2 = (n: number) => Math.round(n * 100) / 100

        if (useExact) {
            const feeAmount = round2(numAmount * totalMultiplier)
            return { feeAmount, totalPay: round2(numAmount + feeAmount), airtimeToReceive: numAmount }
        } else {
            const feeAmount = round2(numAmount * totalMultiplier)
            return { feeAmount, totalPay: numAmount, airtimeToReceive: round2(numAmount - feeAmount) }
        }
    }

    const handleBuyData = async () => {
        if (!selectedPackage) { toast.error('Select a package first'); return }
        if (!phone.trim()) { toast.error('Enter your phone number'); return }

        const cleanPhone = phone.replace(/\s+/g, '')
        if (!/^(0\d{9}|233\d{9})$/.test(cleanPhone)) {
            toast.error('Invalid phone number. Use format: 0XXXXXXXXX')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/shop/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopSlug: shop.shop_slug,
                    packageId: selectedPackage.id,
                    guestPhone: cleanPhone,
                    guestEmail: email.trim() || undefined,
                }),
            })
            const data = await res.json()

            if (!res.ok || !data.authorization_url) {
                setErrorMsg(data.error || 'Failed to initialize payment')
                if (data.contact) setContactInfo(data.contact)
                setLoading(false)
                return
            }

            try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }
            window.location.href = data.authorization_url
        } catch (err) {
            toast.error('Network error. Please try again.')
            setLoading(false)
        }
    }

    const handleBuyAirtime = async () => {
        if (!detectedNetwork) { toast.error('Enter a valid registered network number'); return }
        if (!airtimeAmount) { toast.error('Enter airtime amount'); return }
        
        const numAmount = parseFloat(airtimeAmount)
        const minAmount = parseFloat(adminSettings['airtime_min_amount'] || '1')
        const maxAmount = parseFloat(adminSettings['airtime_max_amount'] || '500')

        if (numAmount < minAmount) { toast.error(`Minimum airtime purchase is GHS ${minAmount.toFixed(2)}`); return }
        if (numAmount > maxAmount) { toast.error(`Maximum airtime purchase is GHS ${maxAmount.toFixed(2)}`); return }

        const cleanPhone = airtimePhone.replace(/\s+/g, '')
        
        setLoading(true)
        try {
            const res = await fetch('/api/shop/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopSlug: shop.shop_slug,
                    orderType: 'airtime',
                    network: detectedNetwork,
                    amount: numAmount,
                    useExactAmount: useExact,
                    guestPhone: cleanPhone,
                    guestEmail: airtimeEmail.trim() || undefined,
                }),
            })
            const data = await res.json()

            if (!res.ok || !data.authorization_url) {
                setErrorMsg(data.error || 'Failed to initialize airtime payment')
                if (data.contact) setContactInfo(data.contact)
                setLoading(false)
                return
            }

            try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }
            window.location.href = data.authorization_url
        } catch (err) {
            toast.error('Network error. Please try again.')
            setLoading(false)
        }
    }

    // Scroll to airtime when opened
    useEffect(() => {
        if (isAirtimeOpen && airtimeRef.current) {
            setTimeout(() => {
                airtimeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 100)
        }
    }, [isAirtimeOpen])

    const brandColor = shop.brand_color || '#2563eb'
    const filteredPackages = packages.filter(p => p.network === activeNetwork)
    const { feeAmount: airFee, totalPay: airTotal, airtimeToReceive } = calculateAirtimeFees()

    if (pageLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--brand-color)]" style={{ '--brand-color': brandColor } as any}>
                <div className="flex flex-col items-center gap-4">
                    {shop.logo_url ? (
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white/20">
                            <Image src={shop.logo_url} alt={shop.shop_name} fill className="object-contain" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                            <ShoppingCart className="w-8 h-8 text-white" />
                        </div>
                    )}
                    <div className="flex gap-1.5">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: `${i * 0.15}s` } as any} />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            {/* Header / Hero */}
            <div className="relative transition-colors duration-300 pt-10 pb-16 bg-[var(--brand-color)]" style={{ '--brand-color': brandColor } as any}>
                <div className="absolute top-4 right-4 z-10">
                    <ThemeToggle />
                </div>
                <div className="max-w-2xl mx-auto px-4 text-center">
                    <div className="flex flex-col items-center gap-4">
                        {shop.logo_url ? (
                            <div className="relative w-24 h-24 rounded-3xl overflow-hidden bg-white/20 flex-shrink-0 shadow-lg mb-2">
                                <Image src={shop.logo_url} alt={shop.shop_name} fill className="object-contain" />
                            </div>
                        ) : (
                            <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center flex-shrink-0 mb-2">
                                <ShoppingCart className="w-10 h-10 text-white" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-3xl font-black text-white leading-tight mb-2">{shop.shop_name}</h1>
                            {shop.description && (
                                <p className="text-white/90 text-sm max-w-sm mx-auto leading-relaxed">{shop.description}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Wave divider - moved to absolute bottom */}
                <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
                    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-full h-[40px] fill-gray-50 dark:fill-gray-950">
                        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C0,0,0,0,0,0c0,0,0,0,0,0Q160.69,78,321.39,56.44Z"></path>
                    </svg>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 pb-40 -mt-2">
                {/* ── Announcement Banner ── */}
                {announcement && !announcementDismissed && (
                    <div className={cn(
                        "mb-5 -mt-4 relative overflow-hidden rounded-2xl border shadow-lg animate-in fade-in slide-in-from-top-4 duration-500",
                        announcement.type === 'admin'
                            ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50"
                            : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50"
                    )}>
                        <div className={cn(
                            "absolute -right-4 -top-4 w-24 h-24 opacity-10 rounded-full",
                            announcement.type === 'admin' ? "bg-amber-500" : "bg-blue-500"
                        )} />

                        <div className="p-4 relative z-10">
                            <div className="flex items-start gap-3">
                                <div className={cn(
                                    "p-2 rounded-xl shrink-0",
                                    announcement.type === 'admin' ? "bg-amber-100 dark:bg-amber-900/50" : "bg-blue-100 dark:bg-blue-900/50"
                                )}>
                                    {announcement.type === 'admin' ? (
                                        <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                    ) : (
                                        <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    )}
                                </div>
                                <div className="flex-1 pt-0.5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn(
                                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                            announcement.type === 'admin' ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
                                        )}>
                                            {announcement.type === 'admin' ? 'Official Notice' : 'Shop Announcement'}
                                        </span>
                                        {announcement.title && (
                                            <span className="text-xs font-bold text-gray-500">{announcement.title}</span>
                                        )}
                                    </div>
                                    <p className={cn(
                                        "text-sm font-semibold leading-relaxed",
                                        announcement.type === 'admin' ? "text-amber-900 dark:text-amber-200" : "text-blue-900 dark:text-blue-200"
                                    )}>
                                        {announcement.message}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setAnnouncementDismissed(true)}
                                    title="Dismiss announcement"
                                    aria-label="Dismiss announcement"
                                    className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors shrink-0"
                                >
                                    <X className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Need Help? Contact Card ── */}
                <div className="mb-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Need Help?</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <a href={`tel:${shop.owner_phone}`} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {shop.owner_phone}
                            </a>
                            {shop.owner_email && (
                                <a href={`mailto:${shop.owner_email}`} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate max-w-[180px]">
                                    <Mail className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{shop.owner_email}</span>
                                </a>
                            )}
                            {shop.whatsapp_number && (
                                <a href={`https://wa.me/${shop.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#25D366] hover:text-[#1ebe5d] transition-colors">
                                    <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" /> WhatsApp
                                </a>
                            )}
                        </div>
                    </div>
                    {/* Track Order button */}
                    <Link
                        href={`/shop/status?shop=${shop.shop_slug}&name=${encodeURIComponent(shop.shop_name)}`}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all shadow-sm group"
                    >
                        <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                        <div className="text-left">
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight leading-none mb-0.5">My Orders</p>
                            <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 leading-tight">Track Now</span>
                        </div>
                    </Link>
                </div>

                {/* Error banner */}
                {errorMsg && (
                    <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-red-800 dark:text-red-300">{errorMsg}</p>
                                {contactInfo ? (
                                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">This shop is temporarily offline. Please contact the owner directly to complete your purchase:</p>
                                ) : (
                                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">Please try again or contact support if the issue persists.</p>
                                )}
                            </div>
                            <button 
                                onClick={() => { setErrorMsg(null); setContactInfo(null); }} 
                                title="Dismiss error"
                                aria-label="Dismiss error"
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-800/40 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4 text-red-400" />
                            </button>
                        </div>

                        {contactInfo && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {contactInfo.phone && <a href={`tel:${contactInfo.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-100 text-xs font-bold shadow-sm"><Phone className="w-3.5 h-3.5" /> Call {contactInfo.phone}</a>}
                                {contactInfo.whatsapp && <a href={`https://wa.me/${contactInfo.whatsapp}`} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-xs font-bold text-white shadow-sm"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Toggleable Airtime Drawer ── */}
                {isShopAirtimeEnabled && (
                    <div ref={airtimeRef} className="mb-6 bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-all duration-300">
                        <button 
                            onClick={() => { setIsAirtimeOpen(!isAirtimeOpen); setSelectedPackage(null) }}
                            className="w-full p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white transition-colors duration-500", isAirtimeOpen ? "bg-indigo-600" : "bg-gray-900 dark:bg-gray-700")}>
                                    <Smartphone className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Buy Direct Airtime</h3>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-tight">Instant Credit to Any Network</p>
                                </div>
                            </div>
                            <ChevronDown className={cn("w-6 h-6 text-gray-400 transition-transform duration-300", isAirtimeOpen && "rotate-180")} />
                        </button>

                        {isAirtimeOpen && (
                            <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2">
                                <div className="space-y-5 pt-5">
                                    {/* Network Selection Grid */}
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Select Network</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['MTN', 'Telecel', 'AT'].map(netId => {
                                                const netConfig = airtimeNetworks.find(n => n.id === netId)
                                                const isEnabled = !!netConfig
                                                const isSelected = detectedNetwork === netId
                                                const colors = networkColors[netId]
                                                
                                                return (
                                                    <button
                                                        key={netId}
                                                        disabled={!isEnabled}
                                                        onClick={() => { setDetectedNetwork(netId as any); setIsManualSelection(true) }}
                                                        className={cn(
                                                            "relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300",
                                                            isSelected 
                                                                ? `bg-gradient-to-br ${colors.gradient} border-transparent shadow-lg scale-[1.03]` 
                                                                : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200",
                                                            !isEnabled && "opacity-40 grayscale cursor-not-allowed"
                                                        )}
                                                    >
                                                        <NetworkLogo id={netId} />
                                                        <span className={cn("text-[10px] font-black uppercase tracking-tight", isSelected ? "text-white" : "text-gray-500")}>
                                                            {netId}
                                                        </span>
                                                        {!isEnabled && <span className="absolute top-1 right-1 px-1 py-0.5 bg-gray-200 dark:bg-gray-700 text-[8px] font-black rounded-md">OFF</span>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="tel" value={airtimePhone} onChange={(e) => setAirtimePhone(e.target.value)}
                                            placeholder="Receiver Phone (e.g. 024XXXXXXX)"
                                            className="w-full pl-12 pr-12 py-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-base font-bold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        {detectedNetwork && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div 
                                                    className="px-2 py-1 tracking-widest text-[10px] uppercase font-black rounded-lg shadow-sm"
                                                    style={{ 
                                                        backgroundColor: networkColors[detectedNetwork].bg, 
                                                        color: networkColors[detectedNetwork].text 
                                                    } as any}
                                                >
                                                    {detectedNetwork}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Recharge Amount</p>
                                        
                                        {/* Quick Amount Chips */}
                                        <div className="flex gap-2 flex-wrap mb-1">
                                            {QUICK_AMOUNTS.map(q => (
                                                <button
                                                    key={q}
                                                    onClick={() => setAirtimeAmount(String(q))}
                                                    className={cn(
                                                        "px-4 py-2 rounded-xl text-xs font-black border-2 transition-all",
                                                        airtimeAmount === String(q)
                                                            ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-md scale-105"
                                                            : "bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700 hover:border-gray-300"
                                                    )}
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="relative">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">GHS</span>
                                            <input
                                                type="number" min="1" step="0.5" value={airtimeAmount} onChange={(e) => setAirtimeAmount(e.target.value)}
                                                placeholder={`Custom Amount`}
                                                className="w-full pl-14 pr-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-lg font-black transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email" value={airtimeEmail} onChange={(e) => setAirtimeEmail(e.target.value)}
                                            placeholder="Email for receipt (Optional)"
                                            className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    {/* Pay Separately Toggle */}
                                    <div 
                                        onClick={() => setUseExact(!useExact)}
                                        className={cn(
                                            "flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer group",
                                            useExact 
                                                ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-400 shadow-sm" 
                                                : "bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-700 hover:border-gray-200"
                                        )}
                                    >
                                        <div className={cn(
                                            "mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                                            useExact ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 dark:border-gray-600 group-hover:border-gray-400"
                                        )}>
                                            {useExact && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                                        </div>
                                        <div className="flex-1">
                                            <p className={cn("text-xs font-black uppercase tracking-tight mb-0.5", useExact ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300")}>
                                                Pay processing fee separately
                                            </p>
                                            <p className="text-[10px] font-bold text-gray-500 leading-tight">
                                                {useExact ? "You'll pay a bit more, but recipient gets exactly the amount typed." : "Standard: Fee is deducted from the amount you recharge."}
                                            </p>
                                        </div>
                                    </div>

                                    {detectedNetwork && airtimeAmount !== '' && parseFloat(airtimeAmount) > 0 && (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-800 shadow-inner">
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                    <span>Recharge Value</span>
                                                    <span className="text-gray-900 dark:text-gray-200 font-black">{formatCurrency(parseFloat(airtimeAmount))}</span>
                                                </div>
                                                
                                                <div className="flex justify-between items-center text-xs font-bold">
                                                    <span className="text-gray-500 uppercase tracking-widest flex items-center gap-1">Processing Fee ({(((airFee) / (useExact ? parseFloat(airtimeAmount) : parseFloat(airtimeAmount) - airFee)) * 100).toFixed(0)}%)</span>
                                                    <span className="text-gray-600 dark:text-gray-400">{useExact ? '+' : '–'} {formatCurrency(airFee)}</span>
                                                </div>

                                                <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-indigo-100/50 dark:bg-indigo-950/50 border border-indigo-200/50 dark:border-indigo-900/50">
                                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter flex items-center gap-1.5">
                                                        <Info className="w-3.5 h-3.5" /> Recipient Gets
                                                    </span>
                                                    <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">{formatCurrency(airtimeToReceive)}</span>
                                                </div>

                                                <div className="pt-2 border-t border-indigo-200/30">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-tighter">You Pay Total</span>
                                                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(airTotal)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleBuyAirtime} disabled={loading || !detectedNetwork || parseFloat(airtimeAmount || '0') <= 0}
                                        className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base uppercase tracking-widest shadow-lg flex justify-center items-center gap-3 transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                                    >
                                        {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : <><Smartphone className="w-5 h-5"/> Recharge Airtime</>}
                                    </button>
                                </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Network Filter Tabs ── */}
                {networks.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
                        {networks.map(net => {
                            const isActive = activeNetwork === net
                            const netStyle = networkColors[net]
                            return (
                                <button
                                    key={net} onClick={() => { setActiveNetwork(net); setSelectedPackage(null); setIsAirtimeOpen(false) }}
                                    className={cn(
                                        'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-all border-2',
                                        isActive ? 'shadow-md scale-[1.03]' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                    )}
                                    style={isActive && netStyle ? { backgroundColor: netStyle.bg, color: netStyle.text, borderColor: netStyle.border } as any : isActive ? { backgroundColor: brandColor, color: '#fff', borderColor: brandColor } as any : {}}
                                >
                                    {net}
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Package grid */}
                {filteredPackages.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No packages available for this network.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                        {filteredPackages.map((pkg) => {
                            const netStyle = networkColors[pkg.network]
                            const isSelected = selectedPackage?.id === pkg.id
                            return (
                                <button
                                    key={pkg.id} onClick={() => setSelectedPackage(isSelected ? null : pkg)}
                                    className={cn(
                                        'relative p-4 rounded-2xl border-2 text-left transition-all duration-200 active:scale-95 flex flex-col gap-1.5',
                                        isSelected ? 'shadow-lg scale-[1.02]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                                    )}
                                    style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } as any : {}}
                                >
                                    {isSelected && <div className="absolute top-2 right-2"><CheckCircle2 className="w-4 h-4 text-white" /></div>}

                                    <div className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full self-start" style={netStyle ? { backgroundColor: netStyle.bg, color: netStyle.text } as any : { backgroundColor: '#e5e7eb', color: '#374151' } as any}>
                                        {pkg.network}
                                    </div>

                                    <p className={cn('text-base font-black leading-tight', isSelected ? 'text-white' : 'text-gray-900 dark:text-white')}>
                                        {pkg.size}
                                    </p>
                                    <p className={cn('text-sm font-bold', isSelected ? 'text-white/90' : 'text-gray-600 dark:text-gray-300')}>
                                        {formatCurrency(pkg.selling_price)}
                                    </p>

                                    <div className={cn('inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 self-start', isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400')}>
                                        <Zap className="w-2.5 h-2.5" /> Instant Delivery
                                    </div>

                                    {pkg.description && pkg.description !== 'Instant Delivery' && (
                                        <p className={cn('text-[10px] leading-snug mt-0.5 line-clamp-2', isSelected ? 'text-white/80' : 'text-gray-400 dark:text-gray-500')}>
                                            {pkg.description}
                                        </p>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Checkout card for DATA Packages */}
                {selectedPackage && (
                    <div className="sticky bottom-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Selected</p>
                                <p className="font-bold text-sm">{selectedPackage.network} {selectedPackage.size}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Total</p>
                                <p className="font-black text-lg text-[var(--brand-color)]" style={{ '--brand-color': brandColor } as any}>
                                    {formatCurrency(selectedPackage.selling_price)}
                                </p>
                            </div>
                        </div>

                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Recipient phone: 0244123456"
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 transition-all ring-[var(--brand-color)]"
                                style={{ '--brand-color': brandColor } as any}
                            />
                        </div>

                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email to receive transaction receipt (Optional)"
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 transition-all ring-[var(--brand-color)]"
                                style={{ '--brand-color': brandColor } as any}
                            />
                        </div>

                        <button
                            onClick={handleBuyData} disabled={loading}
                            className="w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 bg-[var(--brand-color)]"
                            style={{ '--brand-color': brandColor } as any}
                        >
                            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : <><ShoppingCart className="w-5 h-5" /> Pay {formatCurrency(selectedPackage.selling_price)}</>}
                        </button>
                        <p className="text-[10px] text-center text-muted-foreground">Secured by Paystack · No account needed</p>
                    </div>
                )}
            </div>

            {/* WhatsApp floating button */}
            {shop.whatsapp_number && (
                <a
                    href={`https://wa.me/${shop.whatsapp_number}`} target="_blank" rel="noopener noreferrer"
                    className="fixed bottom-6 right-4 w-14 h-14 rounded-full bg-[#25D366] shadow-xl flex items-center justify-center hover:scale-110 transition-transform z-50"
                    aria-label="Chat on WhatsApp"
                >
                    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                </a>
            )}
        </div>
    )
}
