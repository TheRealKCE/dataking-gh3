'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Crown, Sparkles, Zap, TrendingUp, Users, Palette, MessageCircle, ArrowRight, Shield, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

export default function UpgradePage() {
    const { dbUser } = useAuth()
    const router = useRouter()
    const [upgradePrice, setUpgradePrice] = useState(100)
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)

    useEffect(() => {
        // Redirect if already agent or admin
        if (dbUser && dbUser.role !== 'customer') {
            router.push('/dashboard')
            return
        }

        // Fetch upgrade price from admin settings
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

            // Redirect to Paystack
            window.location.href = authorization_url
        } catch (error: any) {
            toast.error(error.message || 'Failed to start upgrade process')
            setIsProcessing(false)
        }
    }

    const benefits = [
        {
            icon: TrendingUp,
            title: 'Agent-Exclusive Pricing',
            description: 'Access discounted rates on all data packages. Save more on every transaction and maximize your profit margins.',
            color: 'from-yellow-400 to-yellow-600'
        },
        {
            icon: Zap,
            title: 'Faster Order Processing',
            description: 'Your orders are prioritized in our fulfillment queue for near-instant delivery. No more waiting.',
            color: 'from-orange-400 to-orange-600'
        },
        {
            icon: Sparkles,
            title: '0% Wallet Top-Up Fees',
            description: 'Enjoy zero transaction fees when adding funds to your wallet. Every cedi you add is fully credited.',
            color: 'from-emerald-400 to-emerald-600'
        },
        {
            icon: Users,
            title: 'Customer Management',
            description: 'Track all purchases made by your customers. Build and manage your client base with detailed analytics.',
            color: 'from-blue-400 to-blue-600'
        },
        {
            icon: Palette,
            title: 'Golden UI Theme',
            description: 'Experience our exclusive premium interface with royal golden aesthetics designed for agents.',
            color: 'from-purple-400 to-purple-600'
        },
        {
            icon: MessageCircle,
            title: 'Live Admin Chat',
            description: 'Get instant support through direct messaging with available administrators. Priority assistance when you need it.',
            color: 'from-pink-400 to-pink-600'
        }
    ]

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                {/* Hero Section */}
                <div className="text-center mb-16 space-y-6">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-2xl shadow-yellow-500/50 animate-bounce">
                        <Crown className="w-12 h-12 text-black" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-5xl sm:text-6xl font-extrabold bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                            Welcome to the Kingdom Palace
                        </h1>
                        <p className="text-xl sm:text-2xl text-gray-300 font-medium">
                            Elevate Your Status to Agent
                        </p>
                        <div className="flex items-center justify-center gap-2 text-yellow-400">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                            <span className="text-sm font-semibold">Unlock Exclusive Benefits</span>
                            <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Benefits Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                    {benefits.map((benefit, index) => (
                        <Card
                            key={index}
                            className="bg-gray-800/50 border-gray-700 backdrop-blur-sm hover:bg-gray-800/70 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/20"
                        >
                            <CardContent className="p-6 space-y-4">
                                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${benefit.color} shadow-lg`}>
                                    <benefit.icon className="w-7 h-7 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-bold text-white">{benefit.title}</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">{benefit.description}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Pricing Card */}
                <div className="max-w-2xl mx-auto">
                    <Card className="bg-gradient-to-br from-yellow-500 via-yellow-600 to-yellow-700 border-none shadow-2xl shadow-yellow-500/50">
                        <CardContent className="p-8 sm:p-12 text-center space-y-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black/20 backdrop-blur-sm">
                                <Crown className="w-8 h-8 text-white" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl sm:text-4xl font-extrabold text-black">
                                    Become an Agent Now
                                </h2>
                                <p className="text-black/80 text-lg">Join our growing network of successful agents</p>
                            </div>

                            <div className="py-6">
                                <div className="text-6xl font-black text-black mb-2">
                                    {formatCurrency(upgradePrice)}
                                </div>
                                <p className="text-black/70 text-sm font-semibold">One-time upgrade fee</p>
                            </div>

                            <Button
                                onClick={handleUpgrade}
                                disabled={isProcessing}
                                size="lg"
                                className="w-full h-14 text-lg font-bold bg-black hover:bg-gray-900 text-yellow-400 rounded-xl shadow-xl hover:shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-400 mr-3"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Upgrade to Agent
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </>
                                )}
                            </Button>

                            <div className="flex items-center justify-center gap-2 text-black/70 text-sm">
                                <Shield className="w-4 h-4" />
                                <span className="font-semibold">Secure payment via Paystack</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Trust Indicators */}
                <div className="mt-12 text-center space-y-4">
                    <div className="flex items-center justify-center gap-6 flex-wrap">
                        <div className="flex items-center gap-2 text-gray-400">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium">Instant Activation</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium">Secure Payment</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium">24/7 Support</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
