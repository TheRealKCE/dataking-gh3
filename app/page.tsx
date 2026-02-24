'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
    Smartphone,
    Zap,
    Shield,
    Clock,
    ArrowRight,
    Wifi,
    CreditCard,
    CheckCircle2,
    Store,
    ExternalLink
} from 'lucide-react'
import { WhatsAppCommunityButtons } from '@/components/whatsapp-community-buttons'
import { NetworkIcon } from '@/components/network-icon'
import Image from 'next/image'
import { getCachedPricing } from '@/lib/pricing-cache'

export default function HomePage() {
    const router = useRouter()
    const [guestUrl, setGuestUrl] = useState('https://kingflexygh.com/shop/felix-s-shop')

    useEffect(() => {
        try {
            const slug = sessionStorage.getItem('shop_sticky_slug')
            if (slug) {
                router.replace(`/shop/${slug}`)
            }
        } catch (_) { }

        getCachedPricing().then(data => {
            if (data?.guestStorefrontUrl) {
                setGuestUrl(data.guestStorefrontUrl)
            }
        }).catch(console.error)
    }, [router])

    return (
        <div className="min-h-screen bg-[#E5E7EB] overflow-x-hidden">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-white lg:bg-white/80 lg:backdrop-blur-xl border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-2 opacity-0"></div>
                        <div className="flex items-center space-x-4">
                            <Link href="/auth/login">
                                <Button variant="ghost" className="text-slate-700 hover:bg-slate-100 font-semibold">
                                    Login
                                </Button>
                            </Link>
                            <Link href="/auth/signup">
                                <Button className="bg-[#0056B3] hover:bg-[#004494] text-white font-bold">
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center">
                        {/* Branding & Contact Header */}
                        <div className="flex flex-col items-center justify-center mb-8 space-y-4">
                            <div className="flex flex-col items-center space-y-2">
                                <div className="relative w-24 h-24 mb-2 drop-shadow-lg lg:drop-shadow-2xl">
                                    <Image
                                        src="/logo.png"
                                        alt="King Flexy Data Ltd Logo"
                                        width={96}
                                        height={96}
                                        className="object-contain"
                                        priority
                                        sizes="96px"
                                    />
                                </div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight drop-shadow-sm">KING FLEXY DATA LTD</h1>
                            </div>

                            <div className="flex flex-col items-center space-y-2">
                                <p className="text-slate-600 font-medium">Need help?</p>
                                <a
                                    href="https://wa.me/233578065809"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-2 px-4 py-2 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white transition-all hover:scale-105 shadow-lg shadow-green-500/20"
                                >
                                    <Smartphone className="w-4 h-4" />
                                    <span className="font-bold">Contact Us on WhatsApp</span>
                                </a>
                            </div>
                        </div>

                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 shadow-sm mb-8">
                            <Zap className="w-4 h-4 text-yellow-500 mr-2" />
                            <span className="text-sm text-slate-700 font-medium">Ultra Fast Instant Delivery</span>
                        </div>
                        <h1 className="text-4xl md:text-7xl font-bold text-slate-900 mb-6 leading-tight">
                            Buy Data Bundles
                            <br />
                            <span className="bg-gradient-to-r from-[#0056B3] via-[#0077B6] to-[#00B4D8] bg-clip-text text-transparent">
                                Instantly
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 px-4">
                            Purchase data bundles for MTN, Telecel, AT-iShare, and AT-BigTime networks.
                            Ultra fast, reliable, and affordable with instant automatic delivery.
                        </p>
                        <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center px-4">
                            <Link href="/auth/signup" className="flex-1 sm:flex-none">
                                <Button size="xl" className="w-full bg-[#0056B3] hover:bg-[#004494] text-white text-lg px-8 font-bold shadow-md lg:shadow-lg">
                                    Start Buying Now
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                            <Link href="/auth/login" className="flex-1 sm:flex-none">
                                <Button size="xl" className="w-full bg-[#FACC15] text-slate-900 hover:bg-[#FACC15]/90 border-0 text-lg px-8 font-bold shadow-lg">
                                    Login to Dashboard
                                </Button>
                            </Link>
                            <a href={guestUrl} className="flex-1 sm:flex-none">
                                <Button size="xl" variant="outline" className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-lg px-8 font-bold shadow-sm">
                                    <Store className="w-5 h-5 mr-2" />
                                    Buy as Guest (No Account)
                                    <ExternalLink className="w-4 h-4 ml-2 opacity-70" />
                                </Button>
                            </a>
                        </div>
                    </div>

                    {/* Network Logos */}
                    <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-3xl mx-auto px-2">
                        {[
                            { name: 'MTN', color: 'from-yellow-400 to-yellow-600' },
                            { name: 'Telecel', color: 'from-red-500 to-red-700' },
                            { name: 'AT-iShare', color: 'from-orange-400 to-red-500' },
                            { name: 'AT-BigTime', color: 'from-orange-500 to-red-600' },
                        ].map((network) => (
                            <div
                                key={network.name}
                                className="group relative p-6 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105"
                            >
                                <div className="flex items-center justify-center mb-4">
                                    <NetworkIcon network={network.name} size={64} />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">{network.name}</h3>
                                <p className="text-sm text-slate-500">Data Bundles</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                            Why Choose KING FLEXY DATA LTD?
                        </h2>
                        <p className="text-slate-600 max-w-xl mx-auto">
                            Experience the fastest and most reliable way to purchase mobile data bundles in Ghana
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 md:gap-8">
                        {[
                            {
                                icon: Zap,
                                title: 'Ultra Fast Delivery',
                                description: 'Your data bundle is delivered within seconds after purchase. No waiting, no delays.',
                                gradient: 'from-yellow-500 to-orange-500',
                            },
                            {
                                icon: Shield,
                                title: 'Secure Payments',
                                description: 'Pay securely with mobile money, bank cards, or wallet balance. Your money is safe.',
                                gradient: 'from-green-500 to-emerald-500',
                            },
                            {
                                icon: Clock,
                                title: '24/7 Available',
                                description: 'Buy data bundles anytime, anywhere. Our platform is always available for you.',
                                gradient: 'from-blue-500 to-cyan-500',
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group p-8 rounded-2xl bg-white/95 lg:bg-white/80 lg:backdrop-blur-sm border border-slate-200 shadow-sm lg:shadow-md lg:hover:shadow-xl transition-all duration-300"
                            >
                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                    <feature.icon className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-600">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                            How It Works
                        </h2>
                        <p className="text-slate-600 max-w-xl mx-auto">
                            Get started in three simple steps
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 md:gap-8">
                        {[
                            {
                                step: '01',
                                title: 'Create Account',
                                description: 'Sign up with your email and phone number. Verification is quick and easy.',
                                icon: Smartphone,
                            },
                            {
                                step: '02',
                                title: 'Fund Your Wallet',
                                description: 'Add money to your wallet using mobile money, bank cards, or bank transfer.',
                                icon: CreditCard,
                            },
                            {
                                step: '03',
                                title: 'Buy Data Bundle',
                                description: 'Select a package, enter the phone number, and receive data instantly.',
                                icon: CheckCircle2,
                            },
                        ].map((item, index) => (
                            <div key={index} className="relative">
                                <div className="text-6xl font-bold text-slate-200 absolute -top-4 left-0">
                                    {item.step}
                                </div>
                                <div className="relative z-10 pt-8">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0056B3] to-[#00B4D8] flex items-center justify-center mb-4">
                                        <item.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-900 mb-3">{item.title}</h3>
                                    <p className="text-slate-600">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0056B3] to-[#00B4D8] p-8 lg:p-12 text-center shadow-lg lg:shadow-2xl">
                        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                Ready to Get Started?
                            </h2>
                            <p className="text-white/90 max-w-xl mx-auto mb-8">
                                Join thousands of Ghanaians who trust KING FLEXY DATA LTD for their mobile data bundle needs.
                            </p>
                            <Link href="/auth/signup">
                                <Button size="xl" className="bg-white text-[#0056B3] hover:bg-white/90 text-lg px-8 font-bold shadow-lg">
                                    Create Free Account
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Community Section */}
            <section className="py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Join Our Community</h2>
                        <p className="text-slate-600">
                            Stay updated with exclusive offers and news on our WhatsApp platforms.
                        </p>
                    </div>
                    <WhatsAppCommunityButtons />
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-300 bg-white/50">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between">
                        <div className="flex items-center space-x-2 mb-4 md:mb-0">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0056B3] to-[#00B4D8] flex items-center justify-center">
                                <Wifi className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-semibold text-slate-900">KING FLEXY DATA LTD</span>
                        </div>
                        <p className="text-slate-500 text-sm">
                            © 2026 KING FLEXY DATA LTD. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
