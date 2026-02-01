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
            const { data } = await (supabase as any)
                .from('admin_settings')
                .select('value')
                .eq('key', 'agent_upgrade_price')
                .single()

            if (data?.value) {
                setUpgradePrice(Number(data.value))
            }
            setIsLoading(false)
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
        { icon: TrendingUp, title: 'Agent-Exclusive Pricing', description: 'Access discounted rates on all data packages and maximize profit margins', color: 'from-yellow-400 to-amber-500', glow: 'shadow-yellow-500/30' },
        { icon: Zap, title: 'Faster Processing', description: 'Priority order fulfillment with near-instant delivery', color: 'from-orange-400 to-red-500', glow: 'shadow-orange-500/30' },
        { icon: Sparkles, title: '0% Top-Up Fees', description: 'Zero transaction fees when adding funds to your wallet', color: 'from-emerald-400 to-teal-500', glow: 'shadow-emerald-500/30' },
        { icon: Users, title: 'Customer Management', description: 'Track purchases and manage your client base with analytics', color: 'from-blue-400 to-indigo-500', glow: 'shadow-blue-500/30' },
        { icon: Palette, title: 'Golden UI Theme', description: 'Exclusive premium interface with royal golden aesthetics', color: 'from-purple-400 to-pink-500', glow: 'shadow-purple-500/30' },
        { icon: MessageCircle, title: 'Live Admin Chat', description: 'Direct messaging with administrators for priority support', color: 'from-pink-400 to-rose-500', glow: 'shadow-pink-500/30' }
    ]

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-900 to-yellow-900/20 flex items-center justify-center z-50">
                <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/20"></div>
                    <Crown className="w-16 h-16 text-yellow-500 animate-pulse relative z-10" />
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black overflow-y-auto z-50">
            <Link href="/dashboard" className="fixed top-6 right-6 z-50 p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300 group">
                <X className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-300" />
            </Link>

            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
                {[...Array(20)].map((_, i) => (
                    <div key={i} className="absolute w-2 h-2 bg-yellow-400/30 rounded-full animate-float" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${5 + Math.random() * 10}s` }}></div>
                ))}
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-20 space-y-8">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/30"></div>
                        <div className="relative inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 shadow-2xl shadow-yellow-500/50">
                            <Crown className="w-16 h-16 text-black animate-bounce" style={{ animationDuration: '2s' }} />
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8">
                            <Star className="w-full h-full text-yellow-300 animate-spin" style={{ animationDuration: '4s' }} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-2xl">Kingdom Palace</h1>
                        <p className="text-2xl sm:text-3xl text-gray-300 font-semibold">Ascend to Agent Status</p>
                        <div className="flex items-center justify-center gap-3 text-yellow-400">
                            <div className="h-px w-12 bg-gradient-to-r from-transparent to-yellow-400"></div>
                            <Sparkles className="w-6 h-6 animate-pulse" />
                            <span className="text-lg font-bold tracking-wide">EXCLUSIVE BENEFITS AWAIT</span>
                            <Sparkles className="w-6 h-6 animate-pulse" />
                            <div className="h-px w-12 bg-gradient-to-l from-transparent to-yellow-400"></div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
                    {benefits.map((benefit, index) => (
                        <div key={index} className="group relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-yellow-500/50 transition-all duration-500 hover:scale-105 hover:-translate-y-2">
                            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${benefit.color} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`}></div>
                            <div className="relative space-y-4">
                                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${benefit.color} ${benefit.glow} shadow-lg group-hover:shadow-2xl transition-shadow duration-500 group-hover:scale-110 transform-gpu`}>
                                    <benefit.icon className="w-8 h-8 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-white group-hover:text-yellow-400 transition-colors duration-300">{benefit.title}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors duration-300">{benefit.description}</p>
                                </div>
                                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="max-w-2xl mx-auto">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                        <div className="relative bg-gradient-to-br from-yellow-500 via-amber-500 to-yellow-600 rounded-3xl p-12 shadow-2xl">
                            <div className="text-center space-y-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-black/20 backdrop-blur-sm">
                                    <Crown className="w-10 h-10 text-white" />
                                </div>
                                <div className="space-y-3">
                                    <h2 className="text-4xl sm:text-5xl font-black text-black">Join the Elite</h2>
                                    <p className="text-black/80 text-lg font-semibold">Transform your business today</p>
                                </div>
                                <div className="py-6">
                                    <div className="text-7xl font-black text-black mb-3">{formatCurrency(upgradePrice)}</div>
                                    <p className="text-black/70 text-base font-bold uppercase tracking-wide">One-Time Investment</p>
                                </div>
                                <Button onClick={handleUpgrade} disabled={isProcessing} size="lg" className="w-full h-16 text-xl font-black bg-black hover:bg-gray-900 text-yellow-400 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 active:scale-95 disabled:opacity-50 group/btn">
                                    {isProcessing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400 mr-3"></div>
                                            Processing Your Upgrade...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-6 h-6 mr-3 group-hover/btn:animate-spin" />
                                            Become an Agent Now
                                            <ArrowRight className="w-6 h-6 ml-3 group-hover/btn:translate-x-2 transition-transform duration-300" />
                                        </>
                                    )}
                                </Button>
                                <div className="flex items-center justify-center gap-2 text-black/80">
                                    <Shield className="w-5 h-5" />
                                    <span className="text-sm font-bold">Secured by Paystack Payment Gateway</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                        {[{ icon: CheckCircle, text: 'Instant Activation' }, { icon: Shield, text: 'Secure Payment' }, { icon: Star, text: '100+ Active Agents' }].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-gray-400 hover:text-yellow-400 transition-colors duration-300 group/trust">
                                <item.icon className="w-6 h-6 text-green-400 group-hover/trust:scale-110 transition-transform duration-300" />
                                <span className="text-base font-semibold">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0px) translateX(0px);
                        opacity: 0.3;
                    }
                    50% {
                        transform: translateY(-20px) translateX(10px);
                        opacity: 0.6;
                    }
                }
                .animate-float {
                    animation: float linear infinite;
                }
            `}</style>
        </div>
    )
}
