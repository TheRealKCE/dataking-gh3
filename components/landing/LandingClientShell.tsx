'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
    Zap,
    Shield,
    ArrowRight,
    Store,
    Wallet,
    BarChart3,
    HeadphonesIcon,
    Layers,
    LogOut,
    UserCircle,
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
        <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary-foreground">

            {/* Navigation - Premium Glassmorphism */}
            <nav className={cn(
                "fixed top-0 w-full z-[100] transition-all duration-700 h-20 flex items-center",
                headerScrolled
                    ? "bg-background/80 backdrop-blur-2xl border-b border-border/40 shadow-premium"
                    : "bg-transparent"
            )}>
                <div className="max-w-7xl mx-auto px-6 lg:px-10 w-full flex items-center justify-between">
                    <div className="flex items-center gap-3 group cursor-pointer">
                        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-blue-premium transition-transform group-hover:scale-110">
                            <Image src="/logo.png" alt="A" width={24} height={24} className="object-contain" />
                        </div>
                        <span className="font-heading font-black text-2xl tracking-tighter text-foreground group-hover:text-primary transition-colors">
                            ARHMS <span className="text-primary">DATA</span>
                        </span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Features</a>
                        <a href="#networks" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Networks</a>
                        <a href="#support" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">Support</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link href="/auth/login">
                            <Button variant="ghost" className="hidden sm:flex text-xs font-black uppercase tracking-widest hover:bg-secondary/50">
                                Login
                            </Button>
                        </Link>
                        <Link href="/auth/signup">
                            <Button className="bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-2xl shadow-blue-premium hover:scale-105 active:scale-95 transition-all">
                                Open Account
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section — Clean & Action-Oriented */}
            <section className="relative pt-32 pb-20 px-6 lg:px-10">
                <div className="max-w-7xl mx-auto flex flex-col items-center">
                    <p className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-muted-foreground mb-8 drop-shadow-sm opacity-80">
                        Already an Agent? <Link href="/auth/login" className="text-primary hover:underline cursor-pointer decoration-2 underline-offset-4 decoration-primary/30 transition-all">Log In to your account.</Link>
                    </p>
                    
                    <div className="flex gap-4 w-full max-w-md">
                        <Link href="/auth/login" className="flex-1">
                            <Button className="w-full h-16 rounded-2xl bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                                <LogOut className="w-5 h-5 rotate-180" />
                                Log in
                            </Button>
                        </Link>
                        <Link href="/auth/signup" className="flex-1">
                            <Button className="w-full h-16 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                                <UserCircle className="w-5 h-5" />
                                Create account
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Network Selection Section */}
            <section id="networks" className="py-12 px-6 lg:px-10">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl md:text-5xl font-black text-center mb-12 tracking-tight">Select Your Network</h2>
                    
                    <div className="grid gap-6 max-w-xl mx-auto">
                        {/* MTN Card */}
                        <div className="group cursor-pointer">
                            <div className="relative overflow-hidden rounded-[2.5rem] bg-[#FFCC00] p-10 flex flex-col items-center text-center transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-yellow-500/10">
                                <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-6">
                                    <Zap className="w-8 h-8 text-black/60" />
                                </div>
                                <h3 className="text-2xl font-black text-black tracking-tight mb-2 uppercase drop-shadow-sm">MTN Non-Expiry Bundles</h3>
                                <p className="text-black/70 font-black text-sm drop-shadow-sm">15 bundles available</p>
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Zap className="w-32 h-32 text-black" />
                                </div>
                            </div>
                        </div>

                        {/* Telecel Card */}
                        <div className="group cursor-pointer">
                            <div className="relative overflow-hidden rounded-[2.5rem] bg-[#E60000] p-10 flex flex-col items-center text-center transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-red-500/20">
                                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-6 shadow-inner">
                                    <Zap className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-tight mb-2 uppercase drop-shadow-md">TELECEL</h3>
                                <p className="text-white/80 font-black text-sm drop-shadow-md">9 bundles available</p>
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Zap className="w-32 h-32 text-white" />
                                </div>
                            </div>
                        </div>

                        {/* AT Card */}
                        <div className="group cursor-pointer">
                            <div className="relative overflow-hidden rounded-[2.5rem] bg-[#0066FF] p-10 flex flex-col items-center text-center transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-blue-500/20">
                                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-6 shadow-inner">
                                    <Zap className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-tight mb-2 uppercase drop-shadow-md">AT PREMIUM BUNDLES</h3>
                                <p className="text-white/80 font-black text-sm drop-shadow-md">14 bundles available</p>
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Zap className="w-32 h-32 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Choose Us Section */}
            <section id="features" className="py-24 px-6 lg:px-10">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl md:text-5xl font-black text-center mb-16 tracking-tight">Why Choose Us?</h2>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { icon: Zap, title: 'Instant Delivery', desc: 'Proprietary routing ensures data hits the target number in under 3 seconds.' },
                            { icon: BarChart3, title: 'Elite Pricing', desc: 'Wholesale rates optimized for maximum profit margins on every transaction.' },
                            { icon: Shield, title: 'Secure Terminal', desc: 'Military-grade encryption and real-time fraud monitoring for every order.' },
                        ].map((feature, i) => (
                            <div key={i} className="bg-secondary/30 backdrop-blur-md p-10 rounded-[2.5rem] border border-border/50 group hover:border-primary/50 transition-all duration-500">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:bg-primary transition-colors">
                                    <feature.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
                                </div>
                                <h4 className="text-2xl font-black text-foreground mb-4 tracking-tight">{feature.title}</h4>
                                <p className="text-muted-foreground font-medium leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA — Compact */}
            <section className="py-20 px-6 lg:px-10">
                <div className="max-w-3xl mx-auto">
                    <Card className="relative overflow-hidden rounded-[3rem] border-0 bg-primary p-12 text-primary-foreground text-center shadow-2xl">
                        <div className="relative z-10 space-y-8">
                            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
                                Ready to Upgrade <br />
                                Your Business?
                            </h2>
                            <p className="text-lg font-medium opacity-80">
                                Join the elite network of data resellers in Ghana today.
                            </p>
                            <Link href="/auth/signup">
                                <Button className="h-16 px-12 rounded-2xl bg-white text-primary font-black text-lg uppercase tracking-widest hover:bg-white/90 transition-all">
                                    Create Account
                                </Button>
                            </Link>
                        </div>
                    </Card>
                </div>
            </section>

            {/* Footer — Professional & Detailed */}
            <footer className="py-20 px-6 lg:px-10 border-t border-border/40">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-4 gap-16 mb-20">
                        <div className="md:col-span-2 space-y-8">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-gold">
                                    <Image src="/logo.png" alt="A" width={20} height={20} className="object-contain" />
                                </div>
                                <span className="font-heading font-black text-xl tracking-tighter">ARHMS DATA</span>
                            </div>
                            <p className="text-muted-foreground font-medium max-w-sm">
                                The definitive platform for digital asset reselling in West Africa. Built for speed, security, and absolute reliability.
                            </p>
                        </div>
                        <div className="space-y-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Dashboard</p>
                            <ul className="space-y-4 text-sm font-bold text-muted-foreground">
                                <li><a href="#" className="hover:text-primary transition-colors">Platform Features</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Pricing Structure</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Network Status</a></li>
                            </ul>
                        </div>
                        <div className="space-y-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Legal</p>
                            <ul className="space-y-4 text-sm font-bold text-muted-foreground">
                                <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                                <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Protocol</Link></li>
                                <li><Link href="/contact" className="hover:text-primary transition-colors">Secure Contact</Link></li>
                            </ul>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 pt-10 border-t border-border/40 opacity-50">
                        <p className="text-[10px] font-black uppercase tracking-widest">© 2025 ARHMS DATA LTD • ALL RIGHTS RESERVED</p>
                        <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest">
                            <span>WEST AFRICA</span>
                            <span>HQ: ACCRA, GHANA</span>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    )
}
