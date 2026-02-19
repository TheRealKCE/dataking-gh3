'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
    Phone, Mail, MessageCircle, ShoppingCart, Loader2,
    CheckCircle2, AlertCircle, X, ClipboardList
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
}

interface Package {
    id: string
    network: string
    size: string
    selling_price: number
}

interface Props {
    shop: ShopData
    packages: Package[]
}

// Fixed network order + brand colors (matches main platform)
const NETWORK_ORDER = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']

const networkColors: Record<string, { bg: string; text: string; border: string }> = {
    MTN: { bg: '#FFCE00', text: '#000000', border: '#e6b800' },
    Telecel: { bg: '#E60000', text: '#ffffff', border: '#cc0000' },
    'AT-iShare': { bg: '#0056B3', text: '#ffffff', border: '#004494' },
    'AT-BigTime': { bg: '#6f42c1', text: '#ffffff', border: '#5a32a3' },
}

export default function ShopStorefront({ shop, packages }: Props) {
    const searchParams = useSearchParams()
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(false)
    const [pageLoading, setPageLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [contactInfo, setContactInfo] = useState<{ phone?: string; whatsapp?: string; email?: string } | null>(null)

    // Derive available networks in fixed order
    const availableNetworks = NETWORK_ORDER.filter(n => packages.some(p => p.network === n))
    // Also include any networks not in the fixed list (future-proofing)
    const extraNetworks = [...new Set(packages.map(p => p.network))].filter(n => !NETWORK_ORDER.includes(n))
    const networks = [...availableNetworks, ...extraNetworks]

    const [activeNetwork, setActiveNetwork] = useState<string>(networks[0] || '')

    // Instant loader animation
    useEffect(() => {
        const timer = setTimeout(() => setPageLoading(false), 400)
        return () => clearTimeout(timer)
    }, [])

    // Show error from URL params (e.g. payment_failed)
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

    const filteredPackages = packages.filter(p => p.network === activeNetwork)

    const handleBuy = async () => {
        if (!selectedPackage) { toast.error('Select a package first'); return }
        if (!phone.trim()) { toast.error('Enter your phone number'); return }

        const cleanPhone = phone.replace(/\s+/g, '')
        const ghanaPhoneRegex = /^(0\d{9}|233\d{9})$/
        if (!ghanaPhoneRegex.test(cleanPhone)) {
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
                }),
            })
            const data = await res.json()

            if (!res.ok || !data.authorization_url) {
                setErrorMsg(data.error || 'Failed to initialize payment')
                if (data.contact) {
                    setContactInfo(data.contact)
                }
                setLoading(false)
                return
            }

            // Save phone to localStorage so status page can auto-load today's orders
            try { localStorage.setItem('shop_last_phone', cleanPhone) } catch (_) { }

            // Redirect to Paystack
            window.location.href = data.authorization_url
        } catch (err) {
            toast.error('Network error. Please try again.')
            setLoading(false)
        }
    }

    const brandColor = shop.brand_color || '#2563eb'

    if (pageLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: brandColor }}>
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
                            <div
                                key={i}
                                className="w-2 h-2 rounded-full bg-white animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            {/* Header / Hero */}
            <div className="relative transition-colors duration-300 pt-10 pb-16" style={{ backgroundColor: brandColor }}>
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

                {/* ── Need Help? Contact Card ── */}
                <div className="mb-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Need Help?</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <a
                                href={`tel:${shop.owner_phone}`}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            >
                                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                                {shop.owner_phone}
                            </a>
                            {shop.owner_email && (
                                <a
                                    href={`mailto:${shop.owner_email}`}
                                    className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate max-w-[180px]"
                                >
                                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">{shop.owner_email}</span>
                                </a>
                            )}
                            {shop.whatsapp_number && (
                                <a
                                    href={`https://wa.me/${shop.whatsapp_number}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#25D366] hover:text-[#1ebe5d] transition-colors"
                                >
                                    <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                    WhatsApp
                                </a>
                            )}
                        </div>
                    </div>
                    {/* Track Order button */}
                    <Link
                        href="/shop/status"
                        className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-center"
                    >
                        <ClipboardList className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-300 leading-tight">Track<br />Order</span>
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
                                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                                        This shop is temporarily offline. Please contact the owner directly to complete your purchase:
                                    </p>
                                ) : (
                                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">Please try again or contact support if the issue persists.</p>
                                )}
                            </div>
                            <button onClick={() => { setErrorMsg(null); setContactInfo(null); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-800/40 rounded-full transition-colors">
                                <X className="w-4 h-4 text-red-400" />
                            </button>
                        </div>

                        {contactInfo && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {contactInfo.phone && (
                                    <a href={`tel:${contactInfo.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/50 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">
                                        <Phone className="w-3.5 h-3.5" /> Call {contactInfo.phone}
                                    </a>
                                )}
                                {contactInfo.whatsapp && (
                                    <a href={`https://wa.me/${contactInfo.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-xs font-bold text-white shadow-sm">
                                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                    </a>
                                )}
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
                                    key={net}
                                    onClick={() => { setActiveNetwork(net); setSelectedPackage(null) }}
                                    className={cn(
                                        'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-all border-2',
                                        isActive
                                            ? 'shadow-md scale-[1.03]'
                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                    )}
                                    style={isActive && netStyle
                                        ? { backgroundColor: netStyle.bg, color: netStyle.text, borderColor: netStyle.border }
                                        : isActive
                                            ? { backgroundColor: brandColor, color: '#fff', borderColor: brandColor }
                                            : {}
                                    }
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
                                    key={pkg.id}
                                    onClick={() => setSelectedPackage(isSelected ? null : pkg)}
                                    className={cn(
                                        'relative p-4 rounded-2xl border-2 text-left transition-all duration-200 active:scale-95',
                                        isSelected
                                            ? 'shadow-lg scale-[1.02]'
                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                                    )}
                                    style={isSelected ? {
                                        backgroundColor: brandColor,
                                        borderColor: brandColor,
                                    } : {}}
                                >
                                    {isSelected && (
                                        <div className="absolute top-2 right-2">
                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                    <div
                                        className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full mb-2"
                                        style={netStyle
                                            ? { backgroundColor: netStyle.bg, color: netStyle.text }
                                            : { backgroundColor: '#e5e7eb', color: '#374151' }
                                        }
                                    >
                                        {pkg.network}
                                    </div>
                                    <p className={cn('text-base font-black leading-tight', isSelected ? 'text-white' : 'text-gray-900 dark:text-white')}>
                                        {pkg.size}
                                    </p>
                                    <p className={cn('text-sm font-bold mt-1', isSelected ? 'text-white/90' : 'text-gray-600 dark:text-gray-300')}>
                                        {formatCurrency(pkg.selling_price)}
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Checkout card */}
                {selectedPackage && (
                    <div className="sticky bottom-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Selected</p>
                                <p className="font-bold text-sm">{selectedPackage.network} {selectedPackage.size}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Total</p>
                                <p className="font-black text-lg" style={{ color: brandColor }}>
                                    {formatCurrency(selectedPackage.selling_price)}
                                </p>
                            </div>
                        </div>

                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Recipient phone: 0244123456"
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 transition-all"
                                style={{ '--tw-ring-color': brandColor } as any}
                            />
                        </div>

                        <button
                            onClick={handleBuy}
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                            style={{ backgroundColor: brandColor }}
                        >
                            {loading ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                            ) : (
                                <><ShoppingCart className="w-5 h-5" /> Pay {formatCurrency(selectedPackage.selling_price)}</>
                            )}
                        </button>

                        <p className="text-[10px] text-center text-muted-foreground">
                            Secured by Paystack · No account needed
                        </p>
                    </div>
                )}
            </div>

            {/* WhatsApp floating button */}
            {shop.whatsapp_number && (
                <a
                    href={`https://wa.me/${shop.whatsapp_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
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
