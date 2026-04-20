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
        <div className="min-h-screen bg-brand-dark text-white overflow-x-hidden">

            {/* Navigation */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${headerScrolled
                ? 'bg-brand-dark/95 backdrop-blur-lg border-b border-brand-border shadow-xl'
                : 'bg-transparent'
                }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold">
                                A
                            </div>
                            <span className="font-heading font-bold text-white text-lg tracking-tight">ARHMS</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <Link href="/auth/login">
                                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 font-medium transition-all duration-300">
                                    Login
                                </Button>
                            </Link>
                            <Link href="/auth/signup">
                                <Button className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-gold text-primary-foreground font-semibold rounded-xl px-6 transition-all duration-300">
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
                        <div className="flex flex-col space-y-8">
                            <div className="badge-luxury">
                                <Zap className="w-3.5 h-3.5" />
                                Ghana&apos;s Premium Data Reselling Platform
                            </div>

                            <div>
                                <h1 className="font-heading font-bold text-5xl md:text-7xl leading-tight text-white text-left mb-6">
                                    Power Your <span className="gradient-text">Business</span>
                                </h1>
                                <p className="font-body text-lg text-gray-300 max-w-lg leading-relaxed">
                                    Buy and resell MTN, Telecel &amp; AirtelTigo bundles instantly with industry-leading rates and premium support.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <Link href="/auth/signup">
                                    <Button className="btn-luxury bg-gradient-to-r from-primary to-primary/90 hover:shadow-gold text-primary-foreground font-semibold rounded-xl px-8 py-3 h-auto text-base w-full sm:w-auto">
                                        Get Started Free
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </Link>
                                <Link href="/auth/login">
                                    <Button className="btn-luxury border-2 border-primary/30 hover:border-primary/60 text-primary hover:bg-primary/10 font-semibold rounded-xl px-8 py-3 h-auto text-base w-full sm:w-auto transition-all duration-300">
                                        View Packages
                                    </Button>
                                </Link>
                            </div>

                            {initialAdminPhone && (
                                <a
                                    href={`https://wa.me/${initialAdminPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex w-fit items-center space-x-2 px-4 py-2 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20 transition-all duration-300 text-sm font-semibold"
                                >
                                    <span>💬 WhatsApp Support Available 24/7</span>
                                </a>
                            )}

                            <a href={initialGuestUrl} className="link-luxury text-sm font-medium flex items-center gap-2 group">
                                <Store className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                Try as Guest (No Account Required)
                            </a>
                        </div>

                        {/* Right Column — Premium Stats Cluster */}
                        <div className="grid grid-cols-1 gap-5 animate-fadeIn">
                            {[
                                { label: '50K+', sublabel: 'Orders Fulfilled', icon: BarChart3, color: 'from-primary to-primary/60', glow: 'shadow-gold' },
                                { label: '3 Networks', sublabel: 'MTN · Telecel · AT', icon: Layers, color: 'from-secondary to-secondary/60', glow: 'shadow-xl' },
                                { label: 'Instant', sublabel: 'Delivery Speed', icon: Zap, color: 'from-accent to-accent/60', glow: 'shadow-xl' },
                            ].map((stat, idx) => (
                                <div
                                    key={stat.label}
                                    className={`glass-effect rounded-2xl p-7 flex items-center gap-5 ${stat.glow} transition-all duration-500 hover:shadow-gold hover:border-primary/30 group`}
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                >
                                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                                        <stat.icon className="w-7 h-7 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-heading font-bold text-2xl text-white group-hover:text-primary transition-colors">{stat.label}</div>
                                        <div className="font-body text-sm text-gray-400">{stat.sublabel}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 2 — TRUST BAR */}
            <section className="divider-luxury py-6">
                <p className="text-center text-sm text-gray-500 font-body tracking-widest uppercase font-semibold">
                    Secured by Paystack &nbsp;·&nbsp; MTN &nbsp;·&nbsp; Telecel &nbsp;·&nbsp; AirtelTigo
                </p>
            </section>

            {/* SECTION 3 — FEATURES GRID */}
            <section className="section-luxury px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="font-heading font-bold text-4xl md:text-5xl text-white mb-4">
                            Why Choose <span className="gradient-text">ARHMS</span>?
                        </h2>
                        <p className="font-body text-lg text-gray-400 max-w-2xl mx-auto">
                            Premium features built for agents, resellers, and everyday buyers across Ghana
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: Zap,
                                title: 'Lightning Fast',
                                description: 'Orders delivered in seconds with 99.9% uptime guaranteed',
                            },
                            {
                                icon: BarChart3,
                                title: 'Best Rates',
                                description: 'Competitive wholesale pricing with exclusive agent tiers',
                            },
                            {
                                icon: Store,
                                title: 'Your Store',
                                description: 'Branded storefront URL to scale your reselling business',
                            },
                            {
                                icon: Wallet,
                                title: 'Smart Wallet',
                                description: 'Top up once, order anytime with instant balance updates',
                            },
                            {
                                icon: Shield,
                                title: 'Real-time Tracking',
                                description: 'Live order status from placement to customer delivery',
                            },
                            {
                                icon: HeadphonesIcon,
                                title: 'Premium Support',
                                description: 'Dedicated WhatsApp and email support 24/7',
                            },
                        ].map((feature, idx) => (
                            <div
                                key={feature.title}
                                className="card-luxury p-8 group hover:scale-105 transition-all duration-500"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center mb-5 group-hover:from-primary/50 group-hover:to-secondary/50 transition-all">
                                    <feature.icon className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="font-heading font-bold text-lg text-white mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                                <p className="font-body text-sm text-gray-400 leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 4 — NETWORKS GRID */}
            <section className="section-luxury px-4 sm:px-6 lg:px-8 bg-brand-surface/50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="font-heading font-bold text-4xl md:text-5xl text-white mb-4">
                            Supported <span className="gradient-text">Networks</span>
                        </h2>
                        <p className="font-body text-lg text-gray-400">All major Ghanaian networks with premium coverage</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {[
                            {
                                name: 'MTN',
                                subtitle: 'Mobile Data Bundles',
                                borderColor: 'border-l-4 border-mtn',
                                textColor: 'text-mtn',
                            },
                            {
                                name: 'Telecel',
                                subtitle: 'Data & Airtime',
                                borderColor: 'border-l-4 border-telecel',
                                textColor: 'text-telecel',
                            },
                            {
                                name: 'AirtelTigo',
                                subtitle: 'Data Bundles',
                                borderColor: 'border-l-4 border-airteltigo',
                                textColor: 'text-airteltigo',
                            },
                        ].map((network) => (
                            <div
                                key={network.name}
                                className={`card-luxury ${network.borderColor} p-8 text-center hover:scale-105 transition-transform`}
                            >
                                <h3 className={`font-heading font-bold text-3xl mb-2 ${network.textColor}`}>{network.name}</h3>
                                <p className="font-body text-sm text-gray-400">{network.subtitle}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 5 — CTA BANNER */}
            <section className="section-luxury px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="relative overflow-hidden rounded-3xl p-12 md:p-16 bg-gradient-to-br from-primary/20 via-secondary/10 to-brand-dark border border-primary/30 shadow-gold-lg">
                        {/* Decorative background */}
                        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl"></div>
                        
                        <div className="relative z-10">
                            <h2 className="font-heading font-bold text-4xl md:text-5xl text-white mb-6 text-center leading-tight">
                                Ready to Start <span className="gradient-text">Earning Today?</span>
                            </h2>
                            <p className="font-body text-lg text-gray-300 max-w-2xl mx-auto mb-10 text-center">
                                Join thousands of successful agents earning daily with ARHMS DATA. Get started with instant wallet top-up and begin reselling within minutes.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link href="/auth/signup">
                                    <Button className="btn-luxury bg-gradient-to-r from-primary to-primary/90 hover:shadow-gold-lg text-primary-foreground font-bold rounded-xl px-10 py-4 h-auto text-lg w-full sm:w-auto">
                                        Create Free Account
                                        <ArrowRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </Link>
                                <Link href="/auth/login">
                                    <Button className="btn-luxury border-2 border-white/30 hover:border-white/60 text-white hover:bg-white/10 font-semibold rounded-xl px-10 py-4 h-auto text-lg w-full sm:w-auto transition-all">
                                        Login
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 6 — FOOTER */}
            <footer className="border-t border-brand-border py-12 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-8 mb-8">
                        <div>
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-primary-foreground">
                                    A
                                </div>
                                <span className="font-heading font-bold text-white text-lg">ARHMS</span>
                            </div>
                            <p className="font-body text-gray-400 max-w-xs">
                                Ghana&apos;s leading premium data reselling platform. Buy, resell, and earn.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-heading font-semibold text-white mb-4">Product</h4>
                                <ul className="space-y-2 font-body text-sm text-gray-400">
                                    <li><a href="#" className="link-luxury">Features</a></li>
                                    <li><a href="#" className="link-luxury">Pricing</a></li>
                                    <li><a href="#" className="link-luxury">Networks</a></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-heading font-semibold text-white mb-4">Support</h4>
                                <ul className="space-y-2 font-body text-sm text-gray-400">
                                    <li><a href="#" className="link-luxury">Help Center</a></li>
                                    <li><a href="#" className="link-luxury">Contact</a></li>
                                    <li><a href="#" className="link-luxury">Status</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="divider-luxury my-8"></div>
                    <p className="text-center font-body text-sm text-gray-500">
                        © 2025 ARHMS DATA LTD. All rights reserved.
                    </p>
                </div>
            </footer>

        </div>
    )
}
