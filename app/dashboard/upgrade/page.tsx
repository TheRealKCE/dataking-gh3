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
        if (dbUser && dbUser.role !== 'customer') {
            router.push('/dashboard')
            return
        }

        const fetchPrice = async () => {
            try {
                console.log('Fetching upgrade price from admin settings...')
                const { data, error } = await (supabase as any)
                    .from('admin_settings')
                    .select('value')
                    .eq('key', 'agent_upgrade_price')
                    .single()

                console.log('Price fetch result:', { data, error })

                if (error) {
                    console.error('Error fetching price:', error)
                } else if (data?.value) {
                    const price = Number(data.value)
                    console.log('Setting upgrade price to:', price)
                    setUpgradePrice(price)
                } else {
                    console.log('No price found, using default: 100')
                }
            } catch (err) {
                console.error('Exception fetching price:', err)
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
        <div className="fixed inset-0 bg-gradient-to-br from-amber-50 via-yellow-100 to-amber-50 overflow-y-auto z-50">
            <Link href="/dashboard" className="fixed top-6 right-6 z-50 p-3 rounded-full bg-amber-600/90 backdrop-blur-md hover:bg-amber-700 transition-all duration-300 group shadow-lg">
                <X className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-300" />
            </Link>

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-300/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-amber-200/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

                {[...Array(30)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full animate-float"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            width: `${2 + Math.random() * 4}px`,
                            height: `${2 + Math.random() * 4}px`,
                            backgroundColor: i % 3 === 0 ? 'rgba(251, 191, 36, 0.4)' : i % 3 === 1 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(252, 211, 77, 0.4)',
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${5 + Math.random() * 10}s`
                        }}
                    ></div>
                ))}
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-20 space-y-8">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/40"></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/20 to-transparent animate-shimmer"></div>
                        <div className="relative inline-flex items-center justify-center w-40 h-40 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-2xl shadow-amber-500/60">
                            <Crown className="w-20 h-20 text-amber-900 animate-bounce drop-shadow-lg" style={{ animationDuration: '2s' }} />
                        </div>
                        <div className="absolute -top-3 -right-3 w-10 h-10">
                            <Star className="w-full h-full text-amber-500 animate-spin drop-shadow-lg" style={{ animationDuration: '3s' }} />
                        </div>
                        <div className="absolute -bottom-2 -left-2 w-8 h-8">
                            <Sparkles className="w-full h-full text-yellow-500 animate-pulse" />
                        </div>
                    </div>

                    <div className="space-y-5">
                        <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-700 bg-clip-text text-transparent drop-shadow-xl animate-title-glow">
                            Kingdom Palace
                        </h1>
                        <p className="text-3xl sm:text-4xl text-amber-900 font-bold drop-shadow-md">Ascend to Agent Status</p>
                        <div className="flex items-center justify-center gap-4 text-amber-700">
                            <div className="h-1 w-16 bg-gradient-to-r from-transparent via-amber-600 to-amber-600 rounded-full"></div>
                            <Sparkles className="w-7 h-7 animate-pulse drop-shadow-md" />
                            <span className="text-xl font-black tracking-wide">EXCLUSIVE BENEFITS AWAIT</span>
                            <Sparkles className="w-7 h-7 animate-pulse drop-shadow-md" />
                            <div className="h-1 w-16 bg-gradient-to-l from-transparent via-amber-600 to-amber-600 rounded-full"></div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
                    {benefits.map((benefit, index) => (
                        <div key={index} className="group relative bg-white/60 backdrop-blur-md rounded-2xl p-6 border-2 border-amber-200 hover:border-amber-400 transition-all duration-500 hover:scale-105 hover:-translate-y-2 shadow-lg hover:shadow-2xl">
                            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${benefit.color} opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500`}></div>
                            <div className="relative space-y-4">
                                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${benefit.color} ${benefit.glow} shadow-lg group-hover:shadow-2xl transition-shadow duration-500 group-hover:scale-110 transform-gpu`}>
                                    <benefit.icon className="w-8 h-8 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-amber-900 group-hover:text-amber-700 transition-colors duration-300">{benefit.title}</h3>
                                    <p className="text-amber-800/80 text-sm leading-relaxed group-hover:text-amber-900 transition-colors duration-300">{benefit.description}</p>
                                </div>
                                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <CheckCircle className="w-6 h-6 text-green-600 drop-shadow-md" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="max-w-2xl mx-auto">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 rounded-3xl p-12 shadow-2xl">
                            <div className="text-center space-y-8">
                                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm shadow-inner">
                                    <Crown className="w-12 h-12 text-white drop-shadow-lg" />
                                </div>
                                <div className="space-y-3">
                                    <h2 className="text-5xl sm:text-6xl font-black text-amber-900 drop-shadow-md">Join the Elite</h2>
                                    <p className="text-amber-900/90 text-xl font-bold">Transform your business today</p>
                                </div>
                                <div className="py-8">
                                    <div className="text-8xl font-black text-amber-950 mb-4 drop-shadow-xl">{formatCurrency(upgradePrice)}</div>
                                    <p className="text-amber-900/80 text-lg font-black uppercase tracking-wider">One-Time Investment</p>
                                </div>
                                <Button
                                    onClick={handleUpgrade}
                                    disabled={isProcessing}
                                    size="lg"
                                    className="w-full h-20 text-2xl font-black bg-amber-900 hover:bg-amber-950 text-amber-50 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 active:scale-95 disabled:opacity-50 group/btn"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-amber-50 mr-3"></div>
                                            Processing Your Upgrade...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-7 h-7 mr-3 group-hover/btn:animate-spin" />
                                            Become an Agent Now
                                            <ArrowRight className="w-7 h-7 ml-3 group-hover/btn:translate-x-2 transition-transform duration-300" />
                                        </>
                                    )}
                                </Button>
                                <div className="flex items-center justify-center gap-2 text-amber-900/90">
                                    <Shield className="w-6 h-6" />
                                    <span className="text-base font-bold">Secured by Paystack Payment Gateway</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-20 text-center">
                    <div className="flex items-center justify-center gap-10 flex-wrap">
                        {[
                            { icon: CheckCircle, text: 'Instant Activation' },
                            { icon: Shield, text: 'Secure Payment' },
                            { icon: Star, text: '100+ Active Agents' }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-amber-800 hover:text-amber-600 transition-colors duration-300 group/trust">
                                <item.icon className="w-7 h-7 text-green-600 group-hover/trust:scale-110 transition-transform duration-300 drop-shadow-md" />
                                <span className="text-lg font-bold">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0px) translateX(0px);
                        opacity: 0.4;
                    }
                    50% {
                        transform: translateY(-30px) translateX(15px);
                        opacity: 0.8;
                    }
                }
                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
                @keyframes title-glow {
                    0%, 100% {
                        filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.5));
                    }
                    50% {
                        filter: drop-shadow(0 0 40px rgba(245, 158, 11, 0.8));
                    }
                }
                .animate-float {
                    animation: float linear infinite;
                }
                .animate-shimmer {
                    animation: shimmer 3s linear infinite;
                }
                .animate-title-glow {
                    animation: title-glow 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    )
}
