'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Crown, Sparkles, Zap, Star, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

export default function UpgradePage() {
    const { dbUser } = useAuth()
    const router = useRouter()

    // Prices for tiers
    const [prices, setPrices] = useState({
        '3d': 9.99,
        '14d': 49.99,
        '30d': 99.99
    })

    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState<string | null>(null)

    useEffect(() => {
        if (dbUser && dbUser.role !== 'customer') {
            router.push('/dashboard')
            return
        }

        const fetchPrices = async () => {
            try {
                const { data, error } = await (supabase as any)
                    .from('admin_settings')
                    .select('*')

                if (error) throw error

                const getVal = (key: string, def: number) => {
                    const s = data?.find((s: any) => s.key === key)
                    return s ? Number(s.value) : def
                }

                setPrices({
                    '3d': getVal('agent_upgrade_price_3d', 9.99),
                    '14d': getVal('agent_upgrade_price_14d', 49.99),
                    '30d': getVal('agent_upgrade_price_30d', 99.99)
                })
            } catch (err) {
                console.error('Failed to fetch upgrade prices:', err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPrices()
    }, [dbUser, router])

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
            popular: false,
            color: 'border-yellow-100'
        },
        {
            id: '14d',
            name: '2 weeks',
            duration: '14 Days Access',
            price: prices['14d'],
            popular: true,
            color: 'border-yellow-400 ring-2 ring-yellow-400/20'
        },
        {
            id: '30d',
            name: '1 month',
            duration: '30 Days Access',
            price: prices['30d'],
            popular: false,
            color: 'border-yellow-100'
        }
    ]

    const commonFeatures = [
        'Exclusive Wholesale Pricing',
        'Crown Badge on Profile',
        'Priority Customer Support',
        'Manage Sub-Agents',
        'Bulk Order Access',
        'Custom Shop Branding'
    ]

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-[#fffdf5] flex items-center justify-center z-50">
                <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-yellow-400/20"></div>
                    <Crown className="w-16 h-16 text-yellow-600 animate-bounce relative z-10" />
                </div>
            </div>
        )
    }

    return (
        <div className="relative -m-4 sm:-m-6 min-h-[calc(100vh+2rem)] lg:min-h-screen bg-[#fffdf5] overflow-x-hidden selection:bg-yellow-200 px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center" style={{ fontFamily: '"Fira Sans", sans-serif' }}>

            {/* Twinkling Star Background */}
            <div className="absolute inset-0 pointer-events-none z-0">
                {[...Array(50)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute bg-yellow-400 rounded-full animate-twinkle opacity-0"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            width: `${Math.random() * 3 + 1}px`,
                            height: `${Math.random() * 3 + 1}px`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${3 + Math.random() * 4}s`
                        }}
                    ></div>
                ))}
            </div>

            <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">

                {/* Header Section */}
                <div className="text-center mb-10 sm:mb-16 space-y-4">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-yellow-100/90 border border-yellow-200 backdrop-blur-sm shadow-sm group">
                        <span className="text-[10px] sm:text-xs font-black text-yellow-700 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Star className="w-3 h-3 fill-yellow-600 text-yellow-600 group-hover:rotate-180 transition-transform duration-700" />
                            PREMIUM MEMBERSHIP
                            <Star className="w-3 h-3 fill-yellow-600 text-yellow-600 group-hover:rotate-180 transition-transform duration-700" />
                        </span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-[#b45309] leading-tight flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
                        BE A KING FLEXY AGENT
                        <Crown className="w-10 h-10 sm:w-14 sm:h-14 text-yellow-500 inline-block animate-[bounce_2s_infinite]" />
                    </h1>

                    <p className="text-base sm:text-lg lg:text-xl text-gray-600 font-semibold max-w-2xl mx-auto opacity-80">
                        Unlock wholesale rates, sub-agent management, and exclusive features to grow your business.
                    </p>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12 w-full max-w-5xl items-stretch">
                    {tiers.map((tier) => (
                        <div
                            key={tier.id}
                            className={`relative bg-white rounded-3xl p-8 flex flex-col transition-all duration-500 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_40px_-4px_rgba(234,179,8,0.15)] border ${tier.color} ${tier.popular ? 'md:scale-105 z-10' : 'opacity-95'}`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-full shadow-lg z-20 flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-white fill-current" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                        MOST POPULAR
                                    </span>
                                </div>
                            )}

                            <div className="text-center mb-6 space-y-1">
                                <h3 className="text-2xl font-black text-gray-900 border-b-2 border-yellow-50/50 pb-2">{tier.name}</h3>
                                <p className="text-gray-400 text-sm font-bold pt-1">{tier.duration}</p>
                            </div>

                            <div className="text-center mb-8 flex items-baseline justify-center gap-1.5">
                                <span className="text-gray-400 font-black text-lg">GHS</span>
                                <span className="text-5xl lg:text-6xl font-black text-gray-900 tracking-tighter">
                                    {tier.price.toString().split('.')[0]}
                                    <span className="text-3xl font-black">{tier.price.toFixed(2).includes('.') ? '.' + tier.price.toFixed(2).split('.')[1] : '.99'}</span>
                                </span>
                            </div>

                            <div className="space-y-4 mb-10 flex-1">
                                {commonFeatures.map((feature, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-green-50 flex items-center justify-center">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        </div>
                                        <span className="text-sm font-bold text-gray-600">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={() => handleUpgrade(tier.id)}
                                disabled={isProcessing !== null}
                                className={`w-full h-14 rounded-2xl text-base font-black transition-all active:scale-95 shadow-lg ${tier.popular
                                        ? 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white shadow-yellow-500/20'
                                        : 'bg-[#1a1a2e] hover:bg-[#1a1a2e]/90 text-white'
                                    }`}
                            >
                                {isProcessing === tier.id ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                ) : (
                                    'Renew / Extend'
                                )}
                            </Button>
                        </div>
                    ))}
                </div>

                {/* Secure Badge Section */}
                <div className="w-full max-w-3xl">
                    <div className="bg-white/40 backdrop-blur-xl rounded-2xl p-6 sm:p-10 border border-white shadow-sm flex flex-col items-center text-center space-y-6">
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

            <style jsx>{`
                @keyframes twinkle {
                    0%, 100% { opacity: 0; transform: scale(0.5); }
                    50% { opacity: 0.8; transform: scale(1.2); }
                }
                .animate-twinkle {
                    animation: twinkle ease-in-out infinite;
                }
            `}</style>
        </div>
    )
}
