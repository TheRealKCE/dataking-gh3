'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
    Phone, Mail, MessageCircle, ShoppingCart, Loader2,
    CheckCircle2, AlertCircle, X, Search, Zap, Smartphone, ChevronDown, Check, Menu, Bell,
    History, TrendingUp, Coins, Calendar, CalendarRange, RefreshCw, Info, Clock, Copy, ArrowRight, AlertTriangle, Users, Target, Sparkles, Download, Share2, GraduationCap
} from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { CopyrightFooter } from '@/components/CopyrightFooter'
import dynamic from 'next/dynamic'
import { usePwa } from '@/hooks/use-pwa'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const ShopPwaInstallPrompt = dynamic(() => import('@/components/ShopPwaInstallPrompt'), { ssr: false })

// ─── Divider SVG paths (matching setup page) ──────────────────────────────────
const DIVIDER_PATHS: Record<string, string> = {
    'asymmetric-curve': 'M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C0,0,0,0,0,0c0,0,0,0,0,0Q160.69,78,321.39,56.44Z',
    'angled': 'M0,0 L1200,80 L1200,120 L0,120 Z',
    'zigzag': 'M0,60 L100,0 L200,60 L300,0 L400,60 L500,0 L600,60 L700,0 L800,60 L900,0 L1000,60 L1100,0 L1200,60 L1200,120 L0,120 Z',
    'concave': 'M0,0 Q600,120 1200,0 L1200,120 L0,120 Z',
    'animated-wave': 'M0,64 C150,100 350,0 600,60 C850,120 1050,20 1200,64 L1200,120 L0,120 Z',
    'layered-waves': 'M0,80 C200,20 400,100 600,60 C800,20 1000,100 1200,80 L1200,120 L0,120 Z',
    'tilt': 'M0,40 L1200,0 L1200,120 L0,120 Z',
    'organic-blob': 'M0,80 C100,20 300,100 500,70 C700,40 900,110 1100,60 C1150,45 1180,50 1200,60 L1200,120 L0,120 Z',
    'paper-cut': 'M0,80 L120,40 L240,80 L360,40 L480,80 L600,40 L720,80 L840,40 L960,80 L1080,40 L1200,80 L1200,120 L0,120 Z',
    'torn-edge': 'M0,90 L30,70 L60,95 L90,65 L130,85 L170,60 L210,90 L260,55 L310,80 L370,50 L430,85 L490,58 L560,90 L640,55 L720,85 L800,50 L880,80 L960,45 L1040,75 L1120,50 L1200,70 L1200,120 L0,120 Z',
    'convex': 'M0,120 Q600,0 1200,120 L1200,120 L0,120 Z',
    'slant': 'M0,80 L1200,0 L1200,120 L0,120 Z',
    'skewed': 'M0,0 L900,0 L1200,120 L0,120 Z',
    'glassmorphic': 'M0,100 Q600,60 1200,100 L1200,120 L0,120 Z',
    'multi-step-wave': 'M0,60 C100,40 200,80 300,60 C400,40 500,80 600,60 C700,40 800,80 900,60 C1000,40 1100,80 1200,60 L1200,120 L0,120 Z',
}

function DividerSVG({ style, fillClass }: { style?: string | null; fillClass: string }) {
    const path = DIVIDER_PATHS[style || 'asymmetric-curve'] || DIVIDER_PATHS['asymmetric-curve']
    const isAnimated = style === 'animated-wave'
    return (
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={cn('relative block w-full h-[40px]', fillClass, isAnimated && 'animate-pulse')} aria-hidden="true">
                <title>Section divider</title>
                <path d={path} />
            </svg>
        </div>
    )
}

interface ShopData {
    id: string
    shop_name: string
    shop_slug: string
    description: string
    owner_phone: string
    owner_email: string | null
    whatsapp_number: string | null
    logo_url: string | null
    banner_url?: string | null
    community_link?: string | null
    divider_style?: string | null
    brand_color: string
    brand_accent: string
    ownerRole: string
    airtime_fee_mtn?: number
    airtime_fee_telecel?: number
    airtime_fee_at?: number
    banner_pos_x?: number
    banner_pos_y?: number
    banner_zoom?: number
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
    initialAnnouncement?: StorefrontAnnouncement | null
}

interface StorefrontAnnouncement {
    type: 'admin' | 'shop'
    message: string
    title?: string
}

// Fixed network order + brand colors (matches main platform)
const NETWORK_ORDER = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime', 'AT', 'Special MTN Mashup', 'EXPRESS MTN']

const networkColors: Record<string, { bgClass: string; textClass: string; borderClass: string; gradient: string }> = {
    MTN: { bgClass: 'bg-[#FFCE00]', textClass: 'text-[#000000]', borderClass: 'border-[#e6b800]', gradient: 'from-yellow-400 to-yellow-500' },
    Telecel: { bgClass: 'bg-[#E60000]', textClass: 'text-[#ffffff]', borderClass: 'border-[#cc0000]', gradient: 'from-red-500 to-red-600' },
    'AT-iShare': { bgClass: 'bg-[#0056B3]', textClass: 'text-[#ffffff]', borderClass: 'border-[#004494]', gradient: 'from-blue-600 to-blue-700' },
    'AT-BigTime': { bgClass: 'bg-[#6f42c1]', textClass: 'text-[#ffffff]', borderClass: 'border-[#5a32a3]', gradient: 'from-purple-600 to-purple-700' },
    AT: { bgClass: 'bg-[#F97316]', textClass: 'text-[#ffffff]', borderClass: 'border-[#ea580c]', gradient: 'from-orange-500 to-orange-600' },
    'Special MTN Mashup': { bgClass: 'bg-[#FFCE00]', textClass: 'text-[#000000]', borderClass: 'border-[#e6b800]', gradient: 'from-yellow-300 to-yellow-500' },
    'EXPRESS MTN': { bgClass: 'bg-[#FFCE00]', textClass: 'text-[#000000]', borderClass: 'border-[#e6b800]', gradient: 'from-orange-300 to-yellow-500' },
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

export default function ShopStorefront({ shop, packages, adminSettings, initialAnnouncement = null }: Props) {
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
    const heroRef = useRef<HTMLDivElement>(null)
    
    // Global State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'data' | 'airtime' | 'mashup' | 'results_checker'>('data')
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
    const [loading, setLoading] = useState(false)
    const [pageLoading, setPageLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [pollingRef, setPollingRef] = useState<string | null>(null)
    const [contactInfo, setContactInfo] = useState<{ phone?: string; whatsapp?: string; email?: string } | null>(null)
    const [announcement] = useState<StorefrontAnnouncement | null>(initialAnnouncement)
    const [announcementDismissed, setAnnouncementDismissed] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const [otpRequired, setOtpRequired] = useState(false)
    const [otpCode, setOtpCode] = useState('')
    const [otpReference, setOtpReference] = useState<string | null>(null)
    const [otpOrderType, setOtpOrderType] = useState<'data' | 'airtime' | 'mashup' | 'results_checker'>('data')

    // Results Checker State
    const [rcTypes, setRcTypes] = useState<any[]>([])
    const [rcPhone, setRcPhone] = useState('')
    const [rcEmail, setRcEmail] = useState('')
    const [selectedRc, setSelectedRc] = useState<any | null>(null)

    const { isInstallable, isInstalled, isIOS, installPwa } = usePwa()

    const handleInstallShop = async () => {
        setIsSidebarOpen(false)
        if (isIOS) {
            toast('Install on iOS', {
                description: `Tap the Share button in Safari, then "Add to Home Screen" to install ${shop.shop_name}.`,
                duration: 6000,
            })
            return
        }
        if (!isInstallable) {
            toast('Install the Shop App', {
                description: 'In your browser menu, tap "Add to Home Screen" or "Install App" to install this shop.',
                duration: 6000,
            })
            return
        }
        await installPwa()
    }

    // Mashup State
    const [mashupPhone, setMashupPhone] = useState('')
    const [mashupEmail, setMashupEmail] = useState('')
    const [mashupAmount, setMashupAmount] = useState('')
    const [bundlePreference, setBundlePreference] = useState<'balanced' | 'data' | 'voice'>('balanced')
    const [mashupUseExact, setMashupUseExact] = useState(false)

    // Derived flags for Airtime & Mashup
    const isGlobalAirtimeEnabled = adminSettings['storefront_airtime_enabled'] === 'true'
    const isGlobalMashupEnabled = adminSettings['storefront_mashup_enabled'] === 'true'
    const isGlobalRcEnabled = adminSettings['storefront_rc_enabled'] === 'true'
    
    const airtimeNetworks = [
        { id: 'MTN', fee: shop.airtime_fee_mtn || 0, enabled: adminSettings['airtime_enabled_mtn'] !== 'false' },
        { id: 'Telecel', fee: shop.airtime_fee_telecel || 0, enabled: adminSettings['airtime_enabled_telecel'] !== 'false' },
        { id: 'AT', fee: shop.airtime_fee_at || 0, enabled: adminSettings['airtime_enabled_at'] !== 'false' }
    ].filter(n => n.enabled)

    const isShopAirtimeEnabled = isGlobalAirtimeEnabled && airtimeNetworks.length > 0
    const isShopRcEnabled = isGlobalRcEnabled && rcTypes.length > 0

    const [isSpecialMtnMashupHidden, setIsSpecialMtnMashupHidden] = useState(adminSettings['special_mtn_mashup_hidden'] === 'true')
    const [isExpressMtnHidden, setIsExpressMtnHidden] = useState(adminSettings['express_mtn_hidden'] === 'true')
    const [isStandardMtnHidden, setIsStandardMtnHidden] = useState(adminSettings['standard_mtn_hidden'] === 'true')

    useEffect(() => {
        // Bypass ISR cache to get the very latest toggle status
        fetch('/api/admin-settings?keys=special_mtn_mashup_hidden,express_mtn_hidden,standard_mtn_hidden', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (data && typeof data.special_mtn_mashup_hidden !== 'undefined') {
                    setIsSpecialMtnMashupHidden(String(data.special_mtn_mashup_hidden) === 'true')
                }
                if (data && typeof data.express_mtn_hidden !== 'undefined') {
                    setIsExpressMtnHidden(String(data.express_mtn_hidden) === 'true')
                }
                if (data && typeof data.standard_mtn_hidden !== 'undefined') {
                    setIsStandardMtnHidden(String(data.standard_mtn_hidden) === 'true')
                }
            })
            .catch(() => {})
    }, [])

    const networks = useMemo(() => {
        const available = NETWORK_ORDER.filter(n => {
            if (n === 'Special MTN Mashup' && isSpecialMtnMashupHidden) return false
            if (n === 'EXPRESS MTN' && isExpressMtnHidden) return false
            if (n === 'MTN' && isStandardMtnHidden) return false
            return packages.some(p => p.network === n)
        })
        const extra = [...new Set(packages.map(p => p.network))].filter(n => !NETWORK_ORDER.includes(n))
        return [...available, ...extra]
    }, [packages, isSpecialMtnMashupHidden, isExpressMtnHidden, isStandardMtnHidden])

    const [activeNetwork, setActiveNetwork] = useState<string>(networks[0] || '')

    useEffect(() => {
        if (activeNetwork && !networks.includes(activeNetwork)) {
            setActiveNetwork(networks[0] || '')
        }
    }, [networks, activeNetwork])

    useEffect(() => {
        setPageLoading(false)
        try { sessionStorage.setItem('shop_sticky_slug', shop.shop_slug) } catch (_) { }
    }, [shop.shop_slug])

    // Sticky header scroll listener
    useEffect(() => {
        const handleScroll = () => {
            const heroHeight = heroRef.current?.offsetHeight || 200
            setScrolled(window.scrollY > heroHeight - 60)
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        if (isGlobalRcEnabled) {
            fetch(`/api/shop/rc/types?shopSlug=${shop.shop_slug}`)
                .then(r => r.json())
                .then(data => { if (data.types) setRcTypes(data.types) })
                .catch(() => {})
        }
    }, [shop.shop_slug, isGlobalRcEnabled])

    useEffect(() => {
        if (!announcement) return

        const seenKey = `announcement_seen_${shop.id}`
        if (!sessionStorage.getItem(seenKey)) {
            setShowAnnouncementModal(true)
            setAnnouncementDismissed(true)
            sessionStorage.setItem(seenKey, 'true')
        }
    }, [announcement, shop.id])

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

    // RC voucher delivery state
    const [rcVouchers, setRcVouchers] = useState<{ pin: string; serial_number: string }[]>([])
    const [showRcDelivery, setShowRcDelivery] = useState(false)

    // Poll for payment status when reference is set
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (pollingRef) {
            interval = setInterval(async () => {
                try {
                    const isRcOrder = pollingRef.startsWith('RC-SHOP-')
                    const endpoint = isRcOrder
                        ? `/api/shop/rc/verify?ref=${pollingRef}&slug=${shop.shop_slug}`
                        : `/api/shop/verify?ref=${pollingRef}&slug=${shop.shop_slug}`
                    const res = await fetch(endpoint, { headers: { 'Accept': 'application/json' } })
                    const data = await res.json()

                    if (data.status === 'completed') {
                        clearInterval(interval)
                        setPollingRef(null)
                        setLoading(false)
                        if (isRcOrder && data.vouchers?.length > 0) {
                            // Show vouchers instantly on-screen
                            setRcVouchers(data.vouchers)
                            setShowRcDelivery(true)
                        } else {
                            toast.success('Payment completed successfully!')
                            window.location.href = `/shop/${shop.shop_slug}/success?ref=${pollingRef}`
                        }
                    } else if (data.status === 'failed') {
                        clearInterval(interval)
                        setPollingRef(null)
                        setLoading(false)
                        setErrorMsg(data.message || 'Payment failed or cancelled.')
                    }
                } catch (e) {
                    console.error('Polling error', e)
                }
            }, 3000)
        }
        return () => clearInterval(interval)
    }, [pollingRef, shop.shop_slug])

    // Auto-detect network for airtime
    useEffect(() => {
        const clean = airtimePhone.replace(/\s+/g, '')
        
        // Reset network selection and manual flag if phone is deleted or < 3 chars
        if (clean.length < 3) {
            setDetectedNetwork(null)
            setIsManualSelection(false)
            return
        }

        if (isManualSelection) return
        
        const prefix = clean.substring(0, 3)
        let detected: 'MTN' | 'Telecel' | 'AT' | null = null
        
        const prefixes = {
            MTN: ['024', '054', '055', '059', '025', '053', '098'],
            Telecel: ['020', '050'],
            AT: ['026', '027', '056', '028', '058', '057'] // Includes 057 and 028 from main site
        }

        for (const [net, prfxs] of Object.entries(prefixes)) {
            if (prfxs.includes(prefix)) {
                detected = net as 'MTN' | 'Telecel' | 'AT'
                break
            }
        }
        
        if (detected && airtimeNetworks.some(n => n.id === detected)) {
            setDetectedNetwork(detected)
        } else {
            setDetectedNetwork(null)
        }
    }, [airtimePhone, airtimeNetworks, isManualSelection])

    // Generate Network Soft Warning
    const airtimeNetworkWarning = useMemo(() => {
        const clean = airtimePhone.replace(/\s+/g, '')
        if (clean.length < 3) return null

        const prefix = clean.substring(0, 3)
        const prefixes = {
            MTN: ['024', '054', '055', '059', '025', '053', '098'],
            Telecel: ['020', '050'],
            AT: ['026', '027', '056', '028', '058', '057']
        }
        
        let actualNet = null
        for (const [net, prfxs] of Object.entries(prefixes)) {
            if (prfxs.includes(prefix)) {
                actualNet = net
                break
            }
        }

        if (!actualNet) return 'Unrecognized prefix — please confirm your network.'
        if (detectedNetwork && actualNet !== detectedNetwork) {
            return `This number looks like it belongs to ${actualNet}. Please verify before proceeding.`
        }
        return null
    }, [airtimePhone, detectedNetwork])

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

            if (!res.ok || !data.reference) {
                setErrorMsg(data.error || 'Failed to initialize payment')
                if (data.contact) setContactInfo(data.contact)
                setLoading(false)
                return
            }

            if (data.gateway === 'paystack') {
                window.location.href = data.authorization_url
                return
            }

            // Moolre: show OTP modal
            try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }
            setOtpReference(data.reference)
            setOtpOrderType('data')
            setOtpRequired(true)
            setLoading(false)
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

            if (!res.ok || !data.reference) {
                setErrorMsg(data.error || 'Failed to initialize airtime payment')
                if (data.contact) setContactInfo(data.contact)
                setLoading(false)
                return
            }

            if (data.gateway === 'paystack') {
                window.location.href = data.authorization_url
                return
            }

            // Moolre: show OTP modal
            try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }
            setOtpReference(data.reference)
            setOtpOrderType('airtime')
            setOtpRequired(true)
            setLoading(false)
        } catch (err) {
            toast.error('Network error. Please try again.')
            setLoading(false)
        }
    }

    // ─── MTN Mashup Bundle Estimator ──────────────────────────────────────────
    const MASHUP_SKEW = {
        balanced: { data: 1.00, voice: 1.00 },
        data:     { data: 1.25, voice: 0.60 },
        voice:    { data: 0.60, voice: 1.40 },
    }
    const MASHUP_TIERS = [
        { amount: 1,  dataMB: 10,  voiceMin: 9  },
        { amount: 2,  dataMB: 20,  voiceMin: 18 },
        { amount: 5,  dataMB: 75,  voiceMin: 72 },
    ]
    type BundleEst = { mode: 'exact'; dataMB: number; voiceMin: number } | { mode: 'estimate'; dataLowMB: number; dataHighMB: number; voiceLowMin: number; voiceHighMin: number }
    const estimateMashupBundle = (amount: number, pref: 'balanced' | 'data' | 'voice'): BundleEst => {
        const skew = MASHUP_SKEW[pref]
        if (amount >= 10) {
            return { mode: 'exact', dataMB: Math.round(amount * 18 * skew.data), voiceMin: Math.round(amount * 17.3 * skew.voice) }
        }
        const lower = [...MASHUP_TIERS].reverse().find(t => t.amount <= amount) || MASHUP_TIERS[0]
        const upper = MASHUP_TIERS.find(t => t.amount >= amount) || MASHUP_TIERS[MASHUP_TIERS.length - 1]
        return { mode: 'estimate', dataLowMB: lower.dataMB, dataHighMB: upper.dataMB, voiceLowMin: lower.voiceMin, voiceHighMin: upper.voiceMin }
    }

    const calculateMashupFees = () => {
        const numAmount = parseFloat(mashupAmount)
        if (isNaN(numAmount) || numAmount <= 0) return { feeAmount: 0, totalPay: 0, bundleValue: 0 }
        const mtnNetConfig = airtimeNetworks.find(n => n.id === 'MTN')
        const shopFeeMultiplier = mtnNetConfig ? mtnNetConfig.fee : 0
        const adminFeeMultiplier = parseFloat(adminSettings[`airtime_fee_mtn_${shop.ownerRole}`] || '0')
        const totalMultiplier = (adminFeeMultiplier + shopFeeMultiplier) / 100
        const round2 = (n: number) => Math.round(n * 100) / 100
        if (mashupUseExact) {
            const feeAmount = round2(numAmount * totalMultiplier)
            return { feeAmount, totalPay: round2(numAmount + feeAmount), bundleValue: numAmount }
        } else {
            const feeAmount = round2(numAmount * totalMultiplier)
            return { feeAmount, totalPay: numAmount, bundleValue: round2(numAmount - feeAmount) }
        }
    }

    const handleBuyMashup = async () => {
        const numAmount = parseFloat(mashupAmount)
        const cleanPhone = mashupPhone.replace(/\s+/g, '')
        if (!mashupPhone.trim() || !/^(0\d{9}|233\d{9})$/.test(cleanPhone)) {
            toast.error('Enter a valid 10-digit phone number')
            return
        }
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error('Enter a valid amount')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/shop/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopSlug: shop.shop_slug,
                    orderType: 'airtime',
                    network: 'MTN',
                    amount: numAmount,
                    useExactAmount: mashupUseExact,
                    isMashup: true,
                    bundlePreference,
                    guestPhone: cleanPhone,
                    guestEmail: mashupEmail.trim() || undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.reference) {
                setErrorMsg(data.error || 'Failed to initialize mashup payment')
                if (data.contact) setContactInfo(data.contact)
                setLoading(false)
                return
            }
            try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }
            setOtpReference(data.reference)
            setOtpOrderType('mashup')
            setOtpRequired(true)
            setLoading(false)
        } catch (err) {
            toast.error('Network error. Please try again.')
            setLoading(false)
        }
    }

    const handleBuyRc = async () => {
        if (!selectedRc) { toast.error('Select a voucher type'); return }
        const cleanPhone = rcPhone.replace(/\s+/g, '')
        if (!/^(0\d{9}|233\d{9})$/.test(cleanPhone)) { toast.error('Enter valid phone'); return }
        
        setLoading(true)
        try {
            const res = await fetch('/api/shop/rc/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopSlug: shop.shop_slug,
                    rcTypeId: selectedRc.id,
                    quantity: 1,
                    customerPhone: cleanPhone,
                    customerEmail: rcEmail.trim() || undefined
                })
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                setErrorMsg(data.error || 'Failed to initialize payment')
                setLoading(false)
                return
            }

            if (data.gateway === 'paystack') {
                window.location.href = data.authorization_url
                return
            }

            try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }
            if (data.otpRequired) {
                // AT network requires OTP — show OTP modal
                setOtpReference(data.reference)
                setOtpOrderType('results_checker')
                setOtpRequired(true)
                setLoading(false)
            } else {
                // MTN/Telecel: MoMo prompt sent — start polling
                toast.success(data.message || 'Payment prompt sent! Please approve on your phone.')
                setPollingRef(data.reference)
            }
        } catch (err) {
            toast.error('Network error. Please try again.')
            setLoading(false)
        }
    }

    const handleVerifyOtp = async () => {
        if (!otpCode || otpCode.trim().length < 1) {
            toast.error('Please enter the OTP sent to your phone')
            return
        }

        setLoading(true)
        try {
            const body = (otpOrderType === 'airtime' || otpOrderType === 'mashup') ? {
                shopSlug: shop.shop_slug,
                orderType: 'airtime',
                network: otpOrderType === 'mashup' ? 'MTN' : detectedNetwork,
                amount: parseFloat(otpOrderType === 'mashup' ? mashupAmount : airtimeAmount),
                useExactAmount: otpOrderType === 'mashup' ? mashupUseExact : useExact,
                isMashup: otpOrderType === 'mashup',
                bundlePreference: otpOrderType === 'mashup' ? bundlePreference : undefined,
                guestPhone: (otpOrderType === 'mashup' ? mashupPhone : airtimePhone).replace(/\s+/g, ''),
                guestEmail: (otpOrderType === 'mashup' ? mashupEmail : airtimeEmail).trim() || undefined,
                otpCode: otpCode.trim(),
                reference: otpReference
            } : otpOrderType === 'results_checker' ? {
                shopSlug: shop.shop_slug,
                rcTypeId: selectedRc?.id,
                quantity: 1,
                customerPhone: rcPhone.replace(/\s+/g, ''),
                customerEmail: rcEmail.trim() || undefined,
                otpCode: otpCode.trim(),
                reference: otpReference
            } : {
                shopSlug: shop.shop_slug,
                packageId: selectedPackage?.id,
                guestPhone: phone.replace(/\s+/g, ''),
                guestEmail: email.trim() || undefined,
                otpCode: otpCode.trim(),
                reference: otpReference
            }

            const endpoint = otpOrderType === 'results_checker' ? '/api/shop/rc/initialize' : '/api/shop/initialize'
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Invalid OTP. Please try again.')
            }

            if (data.otpRequired) {
                throw new Error('Invalid OTP or OTP expired. Please try again.')
            }

            setOtpRequired(false)
            setOtpCode('')
            toast.success(data.message || 'OTP verified! Please approve the prompt on your phone.')
            setPollingRef(data.reference)
        } catch (error: any) {
            toast.error(error.message || 'Failed to verify OTP')
            setLoading(false)
            // Keep modal open so user can retry
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

    // Contrast utility
    const isLightColor = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
        return yiq >= 128
    }

    const brandColor = shop.brand_color || '#2563eb'
    const isValidHex = (color: string) => /^#([A-Fa-f0-9]{3}){1,4}$/.test(color)
    const safeBrandColor = isValidHex(brandColor) ? brandColor : '#2563eb'
    
    const brandContrastText = isLightColor(safeBrandColor) ? '#030712' : '#ffffff'
    const filteredPackages = packages.filter(p => p.network === (activeTab === 'mashup' ? 'Special MTN Mashup' : activeNetwork))
    const { feeAmount: airFee, totalPay: airTotal, airtimeToReceive } = calculateAirtimeFees()

    if (pageLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--brand-color)] theme-shop">
                <style dangerouslySetInnerHTML={{ __html: `.theme-shop { --brand-color: ${safeBrandColor}; }` }} />
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
                            <div key={i} className={cn("w-2 h-2 rounded-full bg-white animate-bounce", ['[animation-delay:0s]', '[animation-delay:0.15s]', '[animation-delay:0.3s]'][i])} />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 theme-shop">
            <style dangerouslySetInnerHTML={{ __html: `
                .theme-shop { 
                    --brand-color: ${safeBrandColor}; 
                    --brand-contrast-text: ${brandContrastText};
                }
                @keyframes shake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(15deg); } 75% { transform: rotate(-15deg); } }
                .animate-shake { animation: shake 0.5s ease-in-out 3; transform-origin: top center; }
            ` }} />
            {/* ── Permanent Top Bar ── */}
            <div className="fixed top-0 left-0 w-full z-[45] shadow-lg border-b border-black/5 dark:border-white/5 bg-[var(--brand-color)] transition-all duration-300 ease-in-out">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-1 bg-[#FFCE00] hover:bg-[#E6B800] rounded-lg transition-colors flex-shrink-0 text-black border border-black/10 shadow-sm" aria-label="Open menu">
                            <Menu className="w-6 h-6 text-black" />
                        </button>
                        {shop.logo_url && (
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-black/5 shadow-sm bg-white/20">
                                <Image src={shop.logo_url} alt="Logo" fill className="object-contain" />
                            </div>
                        )}
                        <h1 className="font-black text-[15px] sm:text-lg truncate text-[var(--brand-contrast-text)] transition-colors">
                            {shop.shop_name}
                        </h1>
                    </div>
                    <ThemeToggle />
                </div>
            </div>
            {/* Spacer to account for fixed top bar height */}
            <div className="h-[60px] flex-shrink-0" />

            {/* ── Floating Notification Bell ── */}
            {announcement && (
                <button 
                    onClick={() => { setShowAnnouncementModal(true); setAnnouncementDismissed(true); }}
                    className="fixed top-[76px] right-4 z-[40] p-3 rounded-full bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 hover:scale-110 transition-transform group"
                    aria-label="Announcements"
                >
                    <Bell className={cn("w-6 h-6 text-amber-500", !announcementDismissed && "animate-shake")} />
                    {!announcementDismissed && <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-gray-800 animate-pulse" />}
                </button>
            )}

            {/* Header / Hero */}
            <div ref={heroRef} className="relative transition-colors duration-300 pt-6 pb-16 bg-[var(--brand-color)]">
                <div className="max-w-2xl mx-auto px-4 text-center">
                    <div className="flex flex-col items-center gap-3">
                        {/* 1. Logo */}
                        {shop.logo_url ? (
                            <div className="relative w-24 h-24 rounded-3xl overflow-hidden bg-white/20 flex-shrink-0 shadow-lg">
                                <Image src={shop.logo_url} alt={shop.shop_name} fill className="object-contain" />
                            </div>
                        ) : (
                            <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                <ShoppingCart className="w-10 h-10 text-white" />
                            </div>
                        )}
                        {/* 2. Shop Name */}
                        <h1 className="text-3xl font-black text-white leading-tight">{shop.shop_name}</h1>
                        {/* 3. Description */}
                        {shop.description && (
                            <p className="text-white/90 text-sm max-w-sm mx-auto leading-relaxed">{shop.description}</p>
                        )}
                        {/* 4. Banner Image (below description, only if set) */}
                        {shop.banner_url && (
                            <div className="relative w-full h-[180px] rounded-2xl overflow-hidden mt-4 shadow-lg bg-black/5 border border-white/10">
                                <Image 
                                    src={shop.banner_url} 
                                    alt={`${shop.shop_name} banner`} 
                                    fill 
                                    className="object-cover transition-opacity duration-700"
                                    style={{ 
                                        objectPosition: `${shop.banner_pos_x ?? 50}% ${shop.banner_pos_y ?? 50}%`,
                                        transform: `scale(${shop.banner_zoom ?? 1})`
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
                {/* 5. Divider SVG — always at absolute bottom */}
                <DividerSVG style={shop.divider_style} fillClass="fill-gray-950" />
            </div>

            <div className="max-w-2xl mx-auto px-4 pb-40 -mt-2">
                
                {/* ── Main Layout Tabs ── */}
                <div className="flex flex-col gap-3 mb-6">
                    <div className="flex items-center gap-2 bg-gray-200/50 dark:bg-gray-800/50 p-2 rounded-2xl overflow-x-auto scrollbar-hide">
                        <button onClick={() => setActiveTab('data')} className={cn("flex-shrink-0 flex-1 min-w-[110px] py-4 rounded-xl font-black text-sm sm:text-base transition-all flex items-center justify-center gap-1.5", activeTab === 'data' ? "bg-white dark:bg-gray-900 shadow-md text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}>
                            <Zap className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> Data Packages
                        </button>
                        {isShopAirtimeEnabled && (
                            <button onClick={() => setActiveTab('airtime')} className={cn("flex-shrink-0 flex-1 min-w-[100px] py-4 rounded-xl font-black text-sm sm:text-base transition-all flex items-center justify-center gap-1.5", activeTab === 'airtime' ? "bg-white dark:bg-gray-900 shadow-md text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}>
                                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> Airtime
                            </button>
                        )}

                    </div>
                    
                    {!isSpecialMtnMashupHidden && (
                        <button onClick={() => setActiveTab('mashup')} className={cn("w-full py-4 px-4 rounded-2xl font-black text-base sm:text-lg transition-all flex items-center justify-center gap-2 border-2", activeTab === 'mashup' ? "bg-amber-500 text-white border-amber-600 shadow-lg scale-[1.01]" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40")}>
                            <Target className="w-6 h-6 animate-pulse" /> Special MTN Mashup
                        </button>
                    )}
                    {isShopRcEnabled && (
                        <button onClick={() => setActiveTab('results_checker')} className={cn("w-full py-4 px-4 rounded-2xl font-black text-base sm:text-lg transition-all flex items-center justify-center gap-2 border-2", activeTab === 'results_checker' ? "bg-emerald-600 text-white border-emerald-700 shadow-lg scale-[1.01]" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40")}>
                            <GraduationCap className="w-6 h-6 animate-pulse" /> Result Checker
                        </button>
                    )}
                </div>

                {/* ── Need Help? Contact Card ── */}
                <div className="mb-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-4 space-y-3">
                    <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 text-center">Need Help?</p>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                        <a href={`tel:${shop.owner_phone}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-emerald-600 transition-colors">
                            <Phone className="w-4 h-4" /> {shop.owner_phone}
                        </a>
                        {shop.owner_email && (
                            <a href={`mailto:${shop.owner_email}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-emerald-600 transition-colors">
                                <Mail className="w-4 h-4" /> Email Us
                            </a>
                        )}
                    </div>
                    {shop.community_link && (
                        <a href={shop.community_link} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 shadow-md bg-[var(--brand-color)]">
                            <Users className="w-4 h-4" /> Join Our Community
                        </a>
                    )}
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

                {/* ── Airtime Tab Content ── */}
                {isShopAirtimeEnabled && activeTab === 'airtime' && (
                    <div ref={airtimeRef} className="mb-6 bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-3 mb-5 border-b border-gray-100 dark:border-gray-800 pb-5">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white bg-indigo-600 shadow-sm">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Buy Direct Airtime</h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-tight">Instant Credit to Any Network</p>
                            </div>
                        </div>

                        <div className="space-y-5">
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
                                                        className={cn("px-2 py-1 tracking-widest text-[10px] uppercase font-black rounded-lg shadow-sm", networkColors[detectedNetwork].bgClass, networkColors[detectedNetwork].textClass)}
                                                    >
                                                        {detectedNetwork}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {airtimeNetworkWarning && (
                                            <div className="flex gap-2 items-start bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                                <p className="text-xs font-medium leading-relaxed">{airtimeNetworkWarning}</p>
                                            </div>
                                        )}

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
                                        {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {pollingRef ? 'Waiting for Approval...' : 'Processing...'}</> : <><Smartphone className="w-5 h-5"/> Recharge Airtime</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                )}

                {/* ── MTN Mashup Tab Content ── */}
                {/* Custom Mashup Form Removed - Now using predefined packages in Data Packages tab */}

                {/* ── Results Checker Tab Content ── */}
                {isShopRcEnabled && activeTab === 'results_checker' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {rcTypes.map((type) => {
                                const isSelected = selectedRc?.id === type.id
                                return (
                                    <button
                                        key={type.id} 
                                        disabled={type.stock_count === 0}
                                        onClick={() => type.stock_count > 0 && setSelectedRc(isSelected ? null : type)}
                                        className={cn(
                                            'relative p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col gap-1.5',
                                            type.stock_count === 0 ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-70 cursor-not-allowed' :
                                            isSelected ? 'bg-[var(--brand-color)] border-[var(--brand-color)] shadow-lg scale-[1.02] active:scale-95' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md active:scale-95'
                                        )}
                                    >
                                        {isSelected && <div className="absolute top-2 right-2"><CheckCircle2 className="w-4 h-4 text-white" /></div>}
                                        
                                        <div className={cn("inline-block text-[10px] font-black px-2 py-0.5 rounded-full self-start", type.stock_count === 0 ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400")}>
                                            PIN + SERIAL
                                        </div>
                                        
                                        <p className={cn('text-base font-black leading-tight', isSelected ? 'text-white' : 'text-gray-900 dark:text-white')}>
                                            {type.name}
                                        </p>
                                        <p className={cn('text-sm font-bold', isSelected ? 'text-white/90' : 'text-gray-600 dark:text-gray-300')}>
                                            {formatCurrency(type.selling_price)}
                                        </p>
                                        
                                        {type.stock_count === 0 ? (
                                            <div className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 self-start bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                Out of Stock
                                            </div>
                                        ) : (
                                            <div className={cn('inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 self-start', isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400')}>
                                                <Zap className="w-2.5 h-2.5" /> Instant Delivery
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                        
                        {selectedRc && (
                            <div className="sticky bottom-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Selected</p>
                                        <p className="font-bold text-sm">{selectedRc.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Total</p>
                                        <p className="font-black text-lg text-[var(--brand-color)]">
                                            {formatCurrency(selectedRc.selling_price)}
                                        </p>
                                    </div>
                                </div>

                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="tel" value={rcPhone} onChange={(e) => setRcPhone(e.target.value)} placeholder="Recipient MoMo phone: 0244123456"
                                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 transition-all ring-[var(--brand-color)]"
                                    />
                                </div>

                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="email" value={rcEmail} onChange={(e) => setRcEmail(e.target.value)} placeholder="Email to receive PIN (Optional)"
                                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 transition-all ring-[var(--brand-color)]"
                                    />
                                </div>

                                <button
                                    onClick={handleBuyRc} disabled={loading}
                                    className="w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 bg-[var(--brand-color)]"
                                >
                                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {pollingRef ? 'Waiting for Approval...' : 'Processing...'}</> : <><ShoppingCart className="w-5 h-5" /> Pay {formatCurrency(selectedRc.selling_price)}</>}
                                </button>
                                <p className="text-[10px] text-center text-muted-foreground">Direct MoMo Prompt</p>
                            </div>
                        )}
                    </div>
                )}


                {/* ── Data Packages Tab Content ── */}
                {(activeTab === 'data' || activeTab === 'mashup') && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">

                {/* ── Network Filter Tabs ── */}
                {activeTab === 'data' && networks.length > 1 && (
                    <div className="flex gap-3 overflow-x-auto pb-2 mb-6 scrollbar-hide">
                        {networks.map(net => {
                            const isActive = activeNetwork === net
                            const netStyle = networkColors[net]
                            return (
                                <button
                                    key={net} onClick={() => { setActiveNetwork(net); setSelectedPackage(null); setIsAirtimeOpen(false) }}
                                    className={cn(
                                        'flex-shrink-0 px-6 py-2.5 rounded-full text-base sm:text-lg font-extrabold transition-all border-2',
                                        isActive && !netStyle && 'bg-[var(--brand-color)] text-white border-[var(--brand-color)]',
                                        isActive && netStyle && netStyle.bgClass,
                                        isActive && netStyle && netStyle.textClass,
                                        isActive && netStyle && netStyle.borderClass,
                                        isActive ? 'shadow-md scale-[1.03]' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                    )}
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
                                        isSelected ? 'bg-[var(--brand-color)] border-[var(--brand-color)] shadow-lg scale-[1.02]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                                    )}
                                >
                                    {isSelected && <div className="absolute top-2 right-2"><CheckCircle2 className="w-4 h-4 text-white" /></div>}

                                    <div className={cn("inline-block text-[10px] font-black px-2 py-0.5 rounded-full self-start",
                                        netStyle ? netStyle.bgClass : 'bg-[#e5e7eb]',
                                        netStyle ? netStyle.textClass : 'text-[#374151]'
                                    )}>
                                        {pkg.network}
                                    </div>

                                    <p className={cn(
                                        pkg.network === 'Special MTN Mashup' ? 'text-xl sm:text-2xl' : 'text-base',
                                        'font-black leading-tight', 
                                        isSelected ? 'text-white' : 'text-gray-900 dark:text-white'
                                    )}>
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
                                <p className="font-black text-lg text-[var(--brand-color)]">
                                    {formatCurrency(selectedPackage.selling_price)}
                                </p>
                            </div>
                        </div>

                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Recipient phone: 0244123456"
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 transition-all ring-[var(--brand-color)]"
                            />
                        </div>

                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email to receive transaction receipt (Optional)"
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 transition-all ring-[var(--brand-color)]"
                            />
                        </div>

                        <button
                            onClick={handleBuyData} disabled={loading}
                            className="w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 bg-[var(--brand-color)]"
                        >
                            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {pollingRef ? 'Waiting for Approval...' : 'Processing...'}</> : <><ShoppingCart className="w-5 h-5" /> Pay {formatCurrency(selectedPackage.selling_price)}</>}
                        </button>
                        <p className="text-[10px] text-center text-muted-foreground">Direct MoMo Prompt</p>
                    </div>
                )}
            </div>

            {/* WhatsApp floating button */}
            {shop.whatsapp_number && (
                <div className="fixed bottom-6 right-4 z-50 flex items-center gap-3 group animate-in slide-in-from-bottom-6 duration-700">
                    <style dangerouslySetInnerHTML={{ __html: `
                        @keyframes promptPeek {
                            0%, 100% { transform: translateX(5px); opacity: 0; }
                            10%, 90% { transform: translateX(0); opacity: 1; }
                        }
                        .animate-prompt-peek { animation: promptPeek 4s ease-in-out infinite; }
                    ` }} />
                    <div className="absolute right-[4.5rem] hidden sm:block bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-1.5 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity animate-prompt-peek whitespace-nowrap">
                        <span className="font-bold text-xs sm:text-sm tracking-tight text-gray-700 dark:text-gray-200">Need Help?</span>
                        <div className="absolute top-1/2 -mt-1 -right-1.5 w-3 h-3 bg-white dark:bg-gray-800 border-r border-t border-gray-100 dark:border-gray-700 rotate-45" />
                    </div>
                    <a
                        href={`https://wa.me/${shop.whatsapp_number}`} target="_blank" rel="noopener noreferrer"
                        className="w-14 h-14 rounded-full bg-[#25D366] shadow-xl flex items-center justify-center hover:scale-110 transition-transform relative"
                        aria-label="Chat on WhatsApp"
                    >
                        <div className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" />
                        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white relative z-10" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                    </a>
                </div>
            )}

            {/* ── Sidebar Navigation Overlay ── */}
            <div className={cn("fixed inset-0 z-[100] transition-opacity duration-200", isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
                <div className={cn("absolute top-0 left-0 w-[min(300px,88vw)] h-full bg-gray-50 dark:bg-gray-950 shadow-2xl transition-transform duration-200 transform flex flex-col will-change-transform", isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
                    <div className="p-5 relative flex flex-col items-center justify-center bg-[var(--brand-color)] h-32 overflow-hidden shadow-inner border-b border-black/10">
                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                        {shop.logo_url ? (
                            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-white/20 shadow-md mb-2">
                                <Image src={shop.logo_url} alt="Logo" fill className="object-contain" />
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shadow-md mb-2">
                                <ShoppingCart className="w-6 h-6 text-white" />
                            </div>
                        )}
                        <p className="font-black text-white text-lg truncate w-full text-center relative z-10 drop-shadow-md">{shop.shop_name}</p>
                        <button 
                            onClick={() => setIsSidebarOpen(false)} 
                            className="absolute top-3 right-3 p-1.5 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors backdrop-blur-sm shadow-sm border border-white/10"
                            aria-label="Close menu"
                            title="Close menu"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1.5">
                        <button onClick={() => { setIsSidebarOpen(false); setActiveTab('data'); }} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all shadow-sm border", activeTab === 'data' ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 border-transparent")}>
                            <Zap className={cn("w-5 h-5", activeTab === 'data' ? "text-[var(--brand-color)]" : "text-gray-400")} /> <span className="font-bold flex-1 text-left">Data Packages</span> 
                            {activeTab === 'data' && <Check className="w-4 h-4 text-[var(--brand-color)]" />}
                        </button>
                        {networks.map(net => (
                            <button key={net} onClick={() => { setIsSidebarOpen(false); setActiveTab('data'); setActiveNetwork(net); }} className="w-full flex items-center gap-3 px-3 py-2 pl-11 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-left text-sm font-semibold text-gray-500 transition-colors">
                                {net} Bundles
                            </button>
                        ))}

                        {isShopAirtimeEnabled && (
                            <button onClick={() => { setIsSidebarOpen(false); setActiveTab('airtime'); }} className={cn("mt-2 w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all shadow-sm border", activeTab === 'airtime' ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 border-transparent")}>
                                <Smartphone className={cn("w-5 h-5", activeTab === 'airtime' ? "text-[var(--brand-color)]" : "text-gray-400")} /> <span className="font-bold flex-1 text-left">Airtime Recharge</span>
                                {activeTab === 'airtime' && <Check className="w-4 h-4 text-[var(--brand-color)]" />}
                            </button>
                        )}
                        {isGlobalMashupEnabled && (
                            <button onClick={() => { setIsSidebarOpen(false); setActiveTab('mashup'); }} className={cn("mt-2 w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all shadow-sm border", activeTab === 'mashup' ? "bg-amber-500 text-white border-amber-600" : "hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 border-transparent")}>
                                <Target className={cn("w-5 h-5", activeTab === 'mashup' ? "text-white" : "text-gray-400")} /> <span className="font-bold flex-1 text-left">MTN Mashup</span>
                                {activeTab === 'mashup' && <Check className="w-4 h-4 text-white" />}
                            </button>
                        )}
                        {isShopRcEnabled && (
                            <button onClick={() => { setIsSidebarOpen(false); setActiveTab('results_checker'); }} className={cn("mt-2 w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all shadow-sm border", activeTab === 'results_checker' ? "bg-blue-600 text-white border-blue-700" : "hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400 border-transparent")}>
                                <GraduationCap className={cn("w-5 h-5", activeTab === 'results_checker' ? "text-white" : "text-blue-500")} /> <span className="font-bold flex-1 text-left">Result Checker</span>
                                {activeTab === 'results_checker' && <Check className="w-4 h-4 text-white" />}
                            </button>
                        )}
                        <div className="my-4 border-t border-gray-200 dark:border-gray-800" />
                        <Link href={`/shop/status?shop=${shop.shop_slug}&name=${encodeURIComponent(shop.shop_name)}`} onClick={() => setIsSidebarOpen(false)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 text-left font-bold text-gray-600 dark:text-gray-400 transition-colors">
                            <History className="w-5 h-5 text-gray-400" /> Track My Orders
                        </Link>
                        <Link href={`/shop/${shop.shop_slug}/about`} onClick={() => setIsSidebarOpen(false)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 text-left font-bold text-gray-600 dark:text-gray-400 transition-colors">
                            <Info className="w-5 h-5 text-gray-400" /> About Shop & Terms
                        </Link>

                        {/* Install Shop Button — always visible unless already installed in standalone mode */}
                        {!isInstalled && (
                            <>
                                <div className="my-2 border-t border-gray-200 dark:border-gray-800" />
                                <button
                                    onClick={handleInstallShop}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left font-bold transition-colors text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                    aria-label={isIOS ? 'Add to Home Screen' : 'Install Shop App'}
                                >
                                    {isIOS
                                        ? <Share2 className="w-5 h-5" />
                                        : <Download className="w-5 h-5" />
                                    }
                                    {isIOS ? 'Add to Home Screen' : 'Install Shop App'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Announcement Modal ── */}
            {announcement && showAnnouncementModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowAnnouncementModal(false)} />
                    <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 border border-gray-100 dark:border-gray-800">
                        <div className={cn(
                            "p-6 flex flex-col items-center text-center",
                            announcement.type === 'admin' ? "bg-amber-50 dark:bg-amber-950/20" : "bg-blue-50 dark:bg-blue-950/20"
                        )}>
                            <div className={cn(
                                "w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-inner border-4 border-white dark:border-gray-800",
                                announcement.type === 'admin' ? "bg-amber-500" : "bg-blue-500"
                            )}>
                                <Bell className="w-8 h-8 text-white" />
                            </div>
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2 bg-white dark:bg-gray-800 shadow-sm border",
                                announcement.type === 'admin' ? "text-amber-600 border-amber-200" : "text-blue-600 border-blue-200"
                            )}>
                                {announcement.type === 'admin' ? 'Official Platform Notice' : 'Shop Announcement'}
                            </span>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white capitalize">{announcement.title || 'Important Update'}</h3>
                        </div>
                        <div className="p-6 pt-5 bg-white dark:bg-gray-900">
                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 leading-relaxed text-center mb-6">
                                {announcement.message}
                            </p>
                            <button 
                                onClick={() => setShowAnnouncementModal(false)}
                                className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform"
                            >
                                Got it, thanks!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CopyrightFooter 
                variant="shop" 
                shopName={shop.shop_name} 
                adminSettings={adminSettings}
                className="pb-20 pt-10" // Extra padding to stay clear of floating buttons
            />

            {/* Per-shop PWA install prompt — lazy loaded, no SSR impact */}
            <ShopPwaInstallPrompt
                shopName={shop.shop_name}
                shopSlug={shop.shop_slug}
                logoUrl={shop.logo_url}
                brandColor={shop.brand_color}
            />

            {/* OTP Modal */}
            <Dialog open={otpRequired} onOpenChange={(open) => !open && setOtpRequired(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>OTP Verification</DialogTitle>
                        <DialogDescription>
                            Please enter the OTP sent to your phone to complete the payment.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="otp">Enter OTP</Label>
                            <Input
                                id="otp"
                                type="text"
                                placeholder="Enter code"
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value)}
                                className="h-12 text-center text-2xl tracking-widest font-bold"
                            />
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setOtpRequired(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleVerifyOtp}
                            disabled={loading || !otpCode}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── RC Voucher Delivery Modal ── */}
            <Dialog open={showRcDelivery} onOpenChange={setShowRcDelivery}>
                <DialogContent className="max-w-sm mx-auto">
                    <DialogHeader>
                        <div className="flex justify-center mb-2">
                            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <GraduationCap className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                        <DialogTitle className="text-center text-lg font-black">
                            🎉 Payment Successful!
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm">
                            Your Result Checker {rcVouchers.length > 1 ? 'vouchers are' : 'voucher is'} ready. Copy and save your PIN and Serial Number.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 my-2">
                        {rcVouchers.map((v, i) => (
                            <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
                                {rcVouchers.length > 1 && (
                                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Voucher {i + 1}</p>
                                )}
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">PIN</p>
                                        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                                            <span className="font-mono text-base font-black text-gray-900 dark:text-white tracking-widest">{v.pin}</span>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(v.pin); toast.success('PIN copied!') }}
                                                title="Copy PIN"
                                                className="ml-2 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Serial Number</p>
                                        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
                                            <span className="font-mono text-base font-black text-gray-900 dark:text-white tracking-widest">{v.serial_number}</span>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(v.serial_number); toast.success('Serial copied!') }}
                                                title="Copy Serial Number"
                                                className="ml-2 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium text-center">
                            ⚠️ Save your PIN and Serial Number now. This screen will not appear again.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            className="w-full"
                            onClick={() => { setShowRcDelivery(false); setSelectedRc(null); setRcPhone(''); setRcEmail('') }}
                        >
                            Done — Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
