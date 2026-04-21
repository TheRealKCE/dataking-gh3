'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
    Zap,
    Shield,
    ArrowRight,
    Store,
    Wallet,
    BarChart3,
    HeadphonesIcon,
    Layers,
} from 'lucide-react'

interface LandingClientShellProps {
    initialGuestUrl: string
    initialAdminPhone: string
}

export function LandingClientShell({ initialGuestUrl, initialAdminPhone }: LandingClientShellProps) {
    const router = useRouter()
    const [headerScrolled, setHeaderScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => setHeaderScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        try {
            const slug = sessionStorage.getItem('shop_sticky_slug')
            if (slug) {
                router.replace(`/shop/${slug}`)
            }
        } catch (_) {}
    }, [router])

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">

            {/* Navigation */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${headerScrolled
                ? 'bg-[#0A0A0A]/90 backdrop-blur-md border-b border-[#1f1f1f]'
                : 'bg-transparent'
                }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-2">
                            <span className="font-heading font-bold text-white text-lg tracking-tight">ARHMS DATA</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <Link href="/auth/login">
                                <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 font-medium">
                                    Login
                                </Button>
                            </Link>
                            <Link href="/auth/signup">
                                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-5">
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* SECTION 1 — SPLIT HERO */}
            <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">

                        {/* Left Column */}
                        <div className="flex flex-col space-y-6">
                            <div className="inline-flex w-fit items-center px-4 py-1.5 rounded-full bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 text-sm font-medium">
                                <Zap className="w-3.5 h-3.5 mr-2" />
                                Ghana&apos;s #1 Data Reselling Platform
                            </div>

                            <h1 className="font-heading font-bold text-4xl md:text-6xl leading-tight text-white text-left !text-left">
                                Power Your Business<br />
                                With{' '}
                                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                                    ARHMS DATA
                                </span>
                            </h1>

                            <p className="font-body text-lg text-zinc-400 max-w-lg leading-relaxed text-left !text-left">
                                Buy and resell MTN, Telecel &amp; AirtelTigo bundles instantly.
                                Top up your wallet and start earning today.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Link href="/auth/signup">
                                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-6 py-3 h-auto text-base w-full sm:w-auto">
                                        Get Started Free
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </Link>
                                <Link href="/auth/login">
                                    <Button variant="outline" className="border-indigo-500/50 text-indigo-400 bg-transparent hover:bg-indigo-500/10 hover:text-indigo-300 rounded-lg px-6 py-3 h-auto text-base w-full sm:w-auto">
                                        View Packages
                                    </Button>
                                </Link>
                            </div>

                            {initialAdminPhone && (
                                <a
                                    href={`https://wa.me/${initialAdminPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex w-fit items-center space-x-2 px-4 py-2 rounded-full bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20 transition-colors text-sm font-medium"
                                >
                                    <span>Contact Us on WhatsApp</span>
                                </a>
                            )}

                            <a href={initialGuestUrl} className="inline-flex w-fit items-center space-x-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                                <Store className="w-4 h-4" />
                                <span>Buy as Guest (No Account Required)</span>
                            </a>
                        </div>

                        {/* Right Column — Stats Cluster */}
                        <div className="grid grid-cols-1 gap-4">
                            {[
                                { label: '10,000+', sublabel: 'Orders Fulfilled', icon: BarChart3, color: 'text-indigo-400', glow: 'shadow-indigo-500/20' },
                                { label: '3 Networks', sublabel: 'MTN · Telecel · AT', icon: Layers, color: 'text-violet-400', glow: 'shadow-violet-500/20' },
                                { label: 'Instant', sublabel: 'Delivery Speed', icon: Zap, color: 'text-teal-400', glow: 'shadow-teal-500/20' },
                            ].map((stat) => (
                                <div
                                    key={stat.label}
                                    className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex items-center gap-5 shadow-lg ${stat.glow}`}
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                    <div className="text-left">
                                        <div className={`font-heading font-bold text-2xl ${stat.color}`}>{stat.label}</div>
                                        <div className="font-body text-sm text-zinc-400">{stat.sublabel}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 2 — TRUST BAR */}
            <section className="border-y border-[#1f1f1f] py-4">
                <p className="text-center text-sm text-zinc-500 font-body tracking-wide">
                    Secured by Paystack &nbsp;·&nbsp; MTN &nbsp;·&nbsp; Telecel &nbsp;·&nbsp; AirtelTigo
                </p>
            </section>

            {/* SECTION 3 — FEATURES GRID */}
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="font-heading font-bold text-3xl md:text-4xl text-white mb-3">
                            Why Choose ARHMS DATA?
                        </h2>
                        <p className="font-body text-zinc-400 max-w-xl mx-auto">
                            Built for agents, resellers, and everyday buyers across Ghana
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-5">
                        {[
                            {
                                icon: Zap,
                                title: 'Instant Fulfillment',
                                description: 'Orders delivered in seconds via automated networks',
                            },
                            {
                                icon: BarChart3,
                                title: 'Competitive Pricing',
                                description: 'Wholesale rates with flexible agent tiers',
                            },
                            {
                                icon: Store,
                                title: 'Agent Storefronts',
                                description: 'Your own branded shop URL to sell to customers',
                            },
                            {
                                icon: Wallet,
                                title: 'Wallet System',
                                description: 'Top up once, order anytime with your balance',
                            },
                            {
                                icon: Shield,
                                title: 'Real-time Tracking',
                                description: 'Live order status from placement to delivery',
                            },
                            {
                                icon: HeadphonesIcon,
                                title: '24/7 Support',
                                description: 'Always available via WhatsApp and email',
                            },
                        ].map((feature) => (
                            <div
                                key={feature.title}
                                className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 hover:border-indigo-500/50 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                                    <feature.icon className="w-5 h-5 text-indigo-400" />
                                </div>
                                <h3 className="font-heading font-semibold text-white text-lg mb-2 text-left !text-left">{feature.title}</h3>
                                <p className="font-body text-sm text-zinc-400 text-left !text-left">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 4 — NETWORKS GRID */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#111111]/50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="font-heading font-bold text-3xl md:text-4xl text-white mb-3">
                            Supported Networks
                        </h2>
                        <p className="font-body text-zinc-400">All major Ghanaian networks covered</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        {[
                            {
                                name: 'MTN',
                                subtitle: 'Mobile Data Bundles',
                                borderColor: 'border-l-[#FFCC00]',
                                textColor: 'text-[#FFCC00]',
                            },
                            {
                                name: 'Telecel',
                                subtitle: 'Data & Airtime',
                                borderColor: 'border-l-[#E30613]',
                                textColor: 'text-[#E30613]',
                            },
                            {
                                name: 'AirtelTigo',
                                subtitle: 'Data Bundles',
                                borderColor: 'border-l-[#ED1C24]',
                                textColor: 'text-[#ED1C24]',
                            },
                        ].map((network) => (
                            <div
                                key={network.name}
                                className={`bg-[#111111] border border-[#1f1f1f] border-l-4 ${network.borderColor} rounded-2xl p-8 text-center`}
                            >
                                <h3 className={`font-heading font-bold text-2xl mb-1 text-left !text-left ${network.textColor}`}>{network.name}</h3>
                                <p className="font-body text-sm text-zinc-400 text-left !text-left">{network.subtitle}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 5 — CTA BANNER */}
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-indigo-600 rounded-2xl p-12 text-center">
                        <h2 className="font-heading font-bold text-3xl md:text-4xl text-white mb-4">
                            Ready to Start Reselling?
                        </h2>
                        <p className="font-body text-indigo-100 max-w-lg mx-auto mb-8">
                            Join hundreds of agents earning daily with ARHMS DATA LTD
                        </p>
                        <Link href="/auth/signup">
                            <Button className="bg-white text-indigo-600 hover:bg-white/90 font-bold rounded-lg px-8 py-4 h-auto text-base">
                                Create Free Account
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* SECTION 6 — FOOTER */}
            <footer className="border-t border-[#1f1f1f] py-8 px-4">
                <p className="text-center text-sm text-zinc-500 font-body">
                    © 2025 ARHMS DATA LTD. All rights reserved.
                </p>
            </footer>

        </div>
    )
}
