'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Crown, Sparkles, Zap, Star, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import CongratsModal from '@/components/upgrade/CongratsModal'
import { cn } from '@/lib/utils'

export default function UpgradePage() {
    const { dbUser } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()

    // Congrats modal state
    const [showCongrats, setShowCongrats] = useState(false)

    // Prices for tiers
    const [prices, setPrices] = useState({
        '3d': 9.99,
        '14d': 49.99,
        '30d': 99.99
    })

    const [oldPrices, setOldPrices] = useState({
        '3d': 0,
        '14d': 0,
        '30d': 0
    })

    const [showStrikethrough, setShowStrikethrough] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState<string | null>(null)

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                // Use API endpoint to bypass RLS
                const response = await fetch('/api/admin/get-prices', {
                    cache: 'no-store' // Ensure fresh data
                })

                if (!response.ok) {
                    console.error('Failed to fetch upgrade prices')
                    toast.error('Failed to load upgrade prices. Please try again later.')
                    setIsLoading(false)
                    return
                }

                const data = await response.json()
                console.log('Fetched prices from API:', data)

                setPrices(data.prices)
                setOldPrices(data.oldPrices || { '3d': 0, '14d': 0, '30d': 0 })
                setShowStrikethrough(data.showStrikethrough || false)
                setIsLoading(false)
            } catch (err) {
                console.error('Failed to fetch upgrade prices:', err)
                toast.error('Failed to load upgrade prices.')
                setIsLoading(false)
            }
        }

        fetchPrices()
    }, [])

    const [isVerifying, setIsVerifying] = useState(false)

    // Detect successful payment and show congrats modal
    useEffect(() => {
        const success = searchParams.get('success') === 'true'

        if (success) {
            if (dbUser?.role === 'agent') {
                setShowCongrats(true)
                setIsVerifying(false)
                // Clean URL without reloading
                window.history.replaceState({}, '', '/dashboard/upgrade')
            } else {
                setIsVerifying(true)
                // Polling logic to wait for role update (every 2 seconds)
                const timer = setTimeout(() => {
                    // This will trigger re-run of this effect when dbUser updates
                    window.location.reload()
                }, 3000)
                return () => clearTimeout(timer)
            }
        }
    }, [searchParams, dbUser])

    const handleUpgrade = async (plan: string) => {
        setIsProcessing(plan)
        try {
            const response = await fetch('/api/user/upgrade/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to initialize upgrade')
            }

            const { authorization_url } = await response.json()
            window.location.href = authorization_url
        } catch (error: any) {
            toast.error(error.message || 'Failed to start upgrade process')
            setIsProcessing(null)
        }
    }

    const tiers = [
        {
            id: '3d',
            name: '3 Days',
            duration: '3 Days Access',
            price: prices['3d'],
            oldPrice: oldPrices['3d'],
            popular: false,
            tier: 'bronze',
            color: 'border-[#C0C0C0]',
            buttonClass: 'bg-gradient-to-r from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 text-gray-800 shadow-sm',
            badgeText: 'STARTER',
            badgeColor: 'from-gray-300 to-gray-400',
            priceColor: 'text-gray-600',
            bgClass: 'bg-slate-50'
        },
        {
            id: '14d',
            name: '2 weeks',
            duration: '14 Days Access',
            price: prices['14d'],
            oldPrice: oldPrices['14d'],
            popular: true,
            tier: 'gold',
            color: 'border-[#FFCE00] ring-2 ring-[#FFCE00]/30',
            buttonClass: 'bg-[#FFCE00] hover:bg-[#E6B800] text-black shadow-lg shadow-[#FFCE00]/20',
            badgeText: 'MOST POPULAR',
            badgeColor: 'from-[#FFCE00] to-[#E6B800]',
            priceColor: 'text-amber-600',
            bgClass: 'bg-amber-50'
        },
        {
            id: '30d',
            name: '1 month',
            duration: '30 Days Access',
            price: prices['30d'],
            oldPrice: oldPrices['30d'],
            popular: false,
            tier: 'diamond',
            color: 'border-purple-400 ring-2 ring-purple-400/30',
            buttonClass: 'bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 hover:from-purple-700 hover:via-blue-700 hover:to-indigo-800 shadow-lg shadow-purple-500/30',
            badgeText: 'PREMIUM',
            badgeColor: 'from-purple-600 to-indigo-700',
            priceColor: 'text-purple-600',
            bgClass: 'bg-purple-50'
        }
    ]

    const commonFeatures = [
        'Exclusive Wholesale Pricing',
        'Priority Customer Support',
        '0% Top Up Charges (Admin Manual Top Up)',
        'Faster Order Processing',
        'Bulk Order Import Feature',
        'New Exclusive UI Design Features',
        'The Awaited “Shop” Feature (Coming Soon)'
    ]

    if (isLoading || isVerifying) {
        return (
            <div className="fixed inset-0 bg-[#FFCE00] flex items-center justify-center z-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <Crown className="w-16 h-16 text-yellow-600 animate-bounce relative z-10" />
                    </div>
                    {isVerifying && (
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black text-yellow-800">Verifying Payment...</h2>
                            <p className="text-yellow-700 font-bold animate-pulse">Please wait while we activate your agent status.</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <>
            {/* Congrats Modal */}
            {showCongrats && (
                <CongratsModal
                    onClose={() => setShowCongrats(false)}
                    onBrowsePackages={() => router.push('/dashboard/data')}
                />
            )}

            <div className="relative -m-4 sm:-m-6 min-h-[calc(100vh+2rem)] lg:min-h-screen bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 overflow-x-hidden selection:bg-yellow-200 px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center scroll-smooth" style={{ fontFamily: '"Fira Sans", sans-serif' }}>

                <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">

                    {/* Header Section */}
                    <div className="text-center mb-8 sm:mb-12 space-y-3 sm:space-y-4">
                        <div className="mb-4 sm:mb-6 flex justify-center">
                            <div className="relative">
                                <Crown className="w-20 h-20 sm:w-28 sm:h-28 text-black animate-[bounce_2s_infinite] drop-shadow-xl" />
                            </div>
                        </div>

                        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-[#b45309] leading-tight">
                            {dbUser?.role === 'agent' ? (
                                <span className="relative inline-block">
                                    <span className="relative">
                                        A
                                        <Crown className="absolute -top-6 -left-3 w-8 h-8 sm:w-12 sm:h-12 text-yellow-500 fill-yellow-500 -rotate-[25deg] drop-shadow-md" />
                                    </span>
                                    LREADY AN AGENT
                                </span>
                            ) : (
                                <span className="relative inline-block">
                                    <span className="relative">
                                        B
                                        <Crown className="absolute -top-6 -left-3 w-8 h-8 sm:w-12 sm:h-12 text-yellow-500 fill-yellow-500 -rotate-[25deg] drop-shadow-md" />
                                    </span>
                                    ECOME AN AGENT
                                </span>
                            )}
                        </h1>

                        {/* Premium Badge - Only visible to agents */}
                        {dbUser?.role === 'agent' && (
                            <div className="inline-block px-4 py-1.5 rounded-full bg-yellow-100/90 border border-yellow-200 backdrop-blur-sm shadow-sm group">
                                <span className="text-[10px] sm:text-xs font-black text-yellow-700 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Crown className="w-3 h-3 fill-yellow-600 text-yellow-600 group-hover:rotate-180 transition-transform duration-700" />
                                    PREMIUM MEMBERSHIP
                                    <Crown className="w-3 h-3 fill-yellow-600 text-yellow-600 group-hover:rotate-180 transition-transform duration-700" />
                                </span>
                            </div>
                        )}

                        <p className="text-sm sm:text-base lg:text-lg text-white font-black max-w-3xl mx-auto px-4 drop-shadow-sm">
                            {dbUser?.role === 'agent'
                                ? "Renew/Extend Your Subscription to Continue Enjoying Your Existing Features and Benefits"
                                : "Unlock the New Premium Membership (Agent Role) for Exciting Features to Grow your Business. Choose from the Plans below (Each plan has same features)."}
                        </p>
                    </div>

                    {/* Plans Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 mb-12 w-full max-w-5xl items-stretch">
                        {tiers.map((tier) => (
                            <div
                                key={tier.id}
                                className={cn(
                                    "relative rounded-2xl p-6 flex flex-col transition-all duration-500 shadow-xl border-2",
                                    tier.bgClass,
                                    tier.color,
                                    tier.popular ? 'md:scale-105 z-10' : 'opacity-95'
                                )}
                            >
                                {/* Badge for all tiers */}
                                {tier.badgeText && (
                                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1.5 bg-gradient-to-r ${tier.badgeColor} rounded-full shadow-lg z-20 flex items-center gap-1.5 sm:gap-2`}>
                                        {tier.tier === 'bronze' && <Zap className="w-3 h-3 text-white fill-current" />}
                                        {tier.tier === 'gold' && <Sparkles className="w-3 h-3 text-white fill-current" />}
                                        {tier.tier === 'diamond' && <Crown className="w-3 h-3 text-white fill-current" />}
                                        <span className="text-[10px] font-black text-white uppercase tracking-wider sm:tracking-widest">
                                            {tier.badgeText}
                                        </span>
                                    </div>
                                )}

                                <div className="text-center mb-5 space-y-1">
                                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 border-b-2 border-yellow-50/50 pb-2">{tier.name}</h3>
                                    <p className="text-gray-400 text-xs sm:text-sm font-bold pt-1">{tier.duration}</p>
                                </div>

                                <div className="text-center mb-6 flex flex-col items-center justify-center gap-1">
                                    {/* Old Price with Strikethrough */}
                                    {showStrikethrough && tier.oldPrice > 0 && tier.oldPrice !== tier.price && (
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-gray-400 line-through text-sm font-bold">GHS {tier.oldPrice.toFixed(2)}</span>
                                        </div>
                                    )}

                                    {/* New Price */}
                                    <div className="flex items-baseline justify-center gap-1.5">
                                        <span className={`font-black text-base sm:text-lg ${tier.priceColor}`}>GHS</span>
                                        <span className={`text-4xl sm:text-5xl font-black ${tier.priceColor} tracking-tighter`}>
                                            {tier.price.toString().split('.')[0]}
                                            <span className="text-2xl sm:text-3xl font-black">{tier.price.toFixed(2).includes('.') ? '.' + tier.price.toFixed(2).split('.')[1] : '.99'}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-8 flex-1">
                                    {commonFeatures.map((feature, i) => {
                                        const isComingSoon = feature.toLowerCase().includes('coming soon')
                                        return (
                                            <div key={i} className="flex items-start gap-2.5">
                                                <div className={cn(
                                                    "mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                                                    isComingSoon ? "bg-yellow-100" : "bg-green-50"
                                                )}>
                                                    <CheckCircle className={cn(
                                                        "w-3.5 h-3.5",
                                                        isComingSoon ? "text-yellow-500" : "text-green-500"
                                                    )} />
                                                </div>
                                                <span className="text-xs sm:text-sm font-bold text-gray-700 leading-snug">{feature}</span>
                                            </div>
                                        )
                                    })}
                                </div>

                                <Button
                                    onClick={() => handleUpgrade(tier.id)}
                                    disabled={isProcessing !== null}
                                    className={`w-full h-11 sm:h-12 rounded-xl text-sm sm:text-base font-black transition-all active:scale-95 text-white ${tier.buttonClass}`}
                                >
                                    {isProcessing === tier.id ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        dbUser?.role === 'agent' ? 'Renew / Extend' : 'Be an Agent Today'
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Secure Badge Section */}
                    <div className="w-full max-w-3xl">
                        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 sm:p-10 border-2 shadow-[0_8px_30px_rgba(238,238,238,0.8)] flex flex-col items-center text-center space-y-6" style={{ borderColor: '#EEEEEE' }}>
                            <div className="inline-flex items-center gap-2 text-amber-600 bg-yellow-100/50 px-4 py-1.5 rounded-full border border-yellow-200/50">
                                <Zap className="w-5 h-5 fill-current" />
                                <span className="text-xs font-black uppercase tracking-[0.2em]">FAST & SECURE</span>
                            </div>
                            <p className="text-base text-gray-500 font-bold leading-relaxed max-w-xl">
                                Upgrade your account in seconds using card, mobile money or bank transfer via Paystack. Your benefits start immediately.
                            </p>
                            <div className="flex items-center gap-3 pt-2 grayscale opacity-50">
                                <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center text-[10px] font-black text-gray-500 border border-gray-300">?</div>
                                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">SECURE PAYMENTS BY PAYSTACK</span>
                            </div>
                        </div>
                    </div>
                </div>


            </div>
        </>
    )
}
