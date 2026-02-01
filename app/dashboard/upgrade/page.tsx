'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Crown, Sparkles, Zap, TrendingUp, Users, Palette, MessageCircle, ArrowRight, Shield, CheckCircle, X, Star } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

export default function UpgradePage() {
    const { dbUser } = useAuth()
    const router = useRouter()
    const [upgradePrice, setUpgradePrice] = useState(100)
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)

    useEffect(() => {
        // Only redirect if we ARE sure they aren't a customer anymore
        if (dbUser && dbUser.role !== 'customer') {
            router.push('/dashboard')
            return
        }

        const fetchPrice = async () => {
            try {
                // More robust fetch: select all and filter manually to avoid .single() issues if multiple rows somehow exist or if the key is tricky
                const { data, error } = await (supabase as any)
                    .from('admin_settings')
                    .select('*')

                if (error) throw error

                const priceSetting = data?.find((s: any) => s.key === 'agent_upgrade_price')
                if (priceSetting?.value) {
                    const price = Number(priceSetting.value)
                    if (!isNaN(price)) {
                        setUpgradePrice(price)
                    }
                }
            } catch (err) {
                console.error('Failed to fetch upgrade price:', err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPrice()
    }, [dbUser, router])

    const handleUpgrade = async () => {
        setIsProcessing(true)
        try {
            const response = await fetch('/api/user/upgrade/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to initialize upgrade')
            }

            const { authorization_url } = await response.json()
            window.location.href = authorization_url
        } catch (error: any) {
            toast.error(error.message || 'Failed to start upgrade process')
            setIsProcessing(false)
        }
    }

    const benefits = [
        { icon: TrendingUp, title: 'Agent-Exclusive Pricing', description: 'Access discounted rates on all data packages and maximize profit margins', color: 'from-amber-400 to-yellow-500', glow: 'shadow-amber-500/50' },
        { icon: Zap, title: 'Faster Processing', description: 'Priority order fulfillment with near-instant delivery', color: 'from-yellow-400 to-orange-500', glow: 'shadow-yellow-500/50' },
        { icon: Sparkles, title: '0% Top-Up Fees', description: 'Zero transaction fees when adding funds to your wallet', color: 'from-amber-500 to-yellow-600', glow: 'shadow-amber-500/50' },
        { icon: Users, title: 'Customer Management', description: 'Track purchases and manage your client base with analytics', color: 'from-yellow-500 to-amber-600', glow: 'shadow-yellow-500/50' },
        { icon: Palette, title: 'Golden UI Theme', description: 'Exclusive premium interface with royal golden aesthetics', color: 'from-amber-400 to-yellow-500', glow: 'shadow-amber-500/50' },
        { icon: MessageCircle, title: 'Live Admin Chat', description: 'Direct messaging with administrators for priority support', color: 'from-yellow-400 to-amber-500', glow: 'shadow-yellow-500/50' }
    ]

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-amber-50 via-yellow-100 to-amber-50 flex items-center justify-center z-50">
                <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/30"></div>
                    <Crown className="w-16 h-16 text-amber-600 animate-bounce relative z-10" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-100 to-amber-50 overflow-x-hidden selection:bg-amber-200" style={{ fontFamily: '"Fira Sans", sans-serif' }}>
            {/* Close Button */}
            <Link
                href="/dashboard"
                className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 p-2 sm:p-3 rounded-full bg-amber-600/90 backdrop-blur-md hover:bg-amber-700 transition-all duration-300 group shadow-lg"
            >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:rotate-90 transition-transform duration-300" />
            </Link>

            {/* Decorative Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-amber-300/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-yellow-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full animate-float hidden sm:block"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            width: `${2 + Math.random() * 4}px`,
                            height: `${2 + Math.random() * 4}px`,
                            backgroundColor: 'rgba(251, 191, 36, 0.4)',
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${5 + Math.random() * 10}s`
                        }}
                    ></div>
                ))}
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-24">
                {/* Hero Section */}
                <div className="text-center mb-12 sm:mb-20 space-y-6 sm:space-y-8">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/40 opacity-20"></div>
                        <div className="relative inline-flex items-center justify-center w-24 h-24 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-2xl shadow-amber-500/60 ring-4 ring-white/50">
                            <Crown className="w-12 h-12 sm:w-20 sm:h-20 text-amber-950 animate-bounce drop-shadow-lg" style={{ animationDuration: '2s' }} />
                        </div>
                        <Star className="absolute -top-1 -right-1 sm:-top-3 sm:-right-3 w-6 h-6 sm:w-10 sm:h-10 text-amber-500 animate-spin drop-shadow-md" style={{ animationDuration: '3s' }} />
                    </div>

                    <div className="space-y-3 sm:space-y-5">
                        <h1 className="text-4xl sm:text-7xl lg:text-9xl font-black bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950 bg-clip-text text-transparent drop-shadow-sm leading-tight">
                            Kingdom Palace
                        </h1>
                        <p className="text-lg sm:text-3xl lg:text-4xl text-amber-900 font-bold max-w-3xl mx-auto px-4 italic">
                            Elevate your business to Agent status and unlock exclusive wholesale benefits.
                        </p>
                        <div className="flex items-center justify-center gap-3 sm:gap-4 text-amber-700 mt-6">
                            <div className="h-[2px] w-8 sm:w-16 bg-gradient-to-r from-transparent to-amber-600 rounded-full"></div>
                            <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 animate-pulse text-amber-600" />
                            <span className="text-xs sm:text-xl font-black tracking-[0.2em] uppercase">The Elite Experience</span>
                            <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 animate-pulse text-amber-600" />
                            <div className="h-[2px] w-8 sm:w-16 bg-gradient-to-l from-transparent to-amber-600 rounded-full"></div>
                        </div>
                    </div>
                </div>

                {/* Benefits Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-16 sm:mb-24">
                    {benefits.map((benefit, index) => (
                        <div key={index} className="group relative bg-white/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white hover:border-amber-400/50 transition-all duration-500 shadow-sm hover:shadow-xl hover:-translate-y-1">
                            <div className="relative space-y-4">
                                <div className={`inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br ${benefit.color} text-white shadow-md group-hover:scale-110 transition-transform duration-500`}>
                                    <benefit.icon className="w-6 h-6 sm:w-8 sm:h-8" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg sm:text-xl font-black text-amber-900">{benefit.title}</h3>
                                    <p className="text-amber-800/70 text-sm leading-relaxed font-medium">
                                        {benefit.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA Section */}
                <div className="max-w-3xl mx-auto">
                    <div className="relative overflow-hidden bg-gradient-to-br from-amber-600 to-amber-800 rounded-3xl p-8 sm:p-12 shadow-[0_20px_50px_rgba(180,83,9,0.3)] border-t border-white/20">
                        {/* Shimmer background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-x-[-100%] animate-[shimmer_3s_infinite] pointer-events-none"></div>

                        <div className="relative text-center space-y-8 z-10">
                            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-white/10 backdrop-blur-md shadow-inner">
                                <Crown className="w-10 h-10 text-white" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-3xl sm:text-5xl font-black text-white">Join the Elite</h2>
                                <p className="text-amber-100 text-lg font-medium opacity-90">One-time royalty fee for lifetime benefits</p>
                            </div>

                            <div className="py-4 sm:py-6">
                                <div className="text-6xl sm:text-8xl font-black text-white tracking-tighter mb-2">
                                    {formatCurrency(upgradePrice)}
                                </div>
                                <p className="text-amber-200/80 text-xs sm:text-sm font-black uppercase tracking-widest">Investment in Success</p>
                            </div>

                            <Button
                                onClick={handleUpgrade}
                                disabled={isProcessing}
                                className="w-full h-16 sm:h-20 text-xl font-black bg-white hover:bg-amber-50 text-amber-900 rounded-2xl shadow-xl transition-all duration-300 active:scale-95 disabled:opacity-70 flex items-center justify-center gap-3"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-900"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-6 h-6 text-amber-600" />
                                        Ascend Now
                                        <ArrowRight className="w-6 h-6 ml-1 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </Button>

                            <div className="flex items-center justify-center gap-2 text-amber-100/80 text-sm font-bold pt-4">
                                <Shield className="w-4 h-4" />
                                <span>Secured by Paystack Payment Gateway</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trust Badges */}
                <div className="mt-16 sm:mt-24 flex flex-wrap justify-center gap-6 sm:gap-12 opacity-60">
                    {[
                        { icon: CheckCircle, text: 'Instant Access' },
                        { icon: Shield, text: 'Authorized Secure' },
                        { icon: Star, text: 'Elite Membership' }
                    ].map((badge, i) => (
                        <div key={i} className="flex items-center gap-2 text-amber-900/70 grayscale hover:grayscale-0 transition-all">
                            <badge.icon className="w-5 h-5" />
                            <span className="text-sm font-bold uppercase tracking-wider">{badge.text}</span>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0px) translateX(0px);
                    }
                    50% {
                        transform: translateY(-20px) translateX(10px);
                    }
                }
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
                .animate-float {
                    animation: float ease-in-out infinite;
                }
            `}</style>
        </div>
    )
}
