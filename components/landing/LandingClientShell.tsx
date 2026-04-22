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

            {/* Hero Section — Cinematic & Professional */}
            <section className="relative pt-40 pb-32 px-6 lg:px-10 overflow-hidden">
                {/* Visual Anchors */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] -mr-96 -mt-96 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[100px] -ml-72 -mb-72 pointer-events-none" />

                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="flex flex-col items-center text-center space-y-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 backdrop-blur-md animate-slow-fade">
                            <Zap className="w-4 h-4 text-primary fill-primary" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">Ghana&apos;s #1 Reselling Terminal</span>
                        </div>

                        <div className="space-y-6 max-w-4xl">
                            <h1 className="font-heading font-black text-6xl md:text-8xl lg:text-9xl tracking-tighter leading-[0.9] text-foreground">
                                Scale Your <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-primary/60">Digital Assets</span>
                            </h1>
                            <p className="max-w-2xl mx-auto text-lg md:text-xl font-medium text-muted-foreground/80 leading-relaxed">
                                Join the elite network of data resellers in Ghana. Deploy instant bundles, track every pesewa, and manage your business from a state-of-the-art terminal.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-5 pt-6 w-full sm:w-auto">
                            <Link href="/auth/signup" className="w-full sm:w-auto">
                                <Button className="w-full sm:w-auto h-16 px-12 rounded-2xl bg-primary text-primary-foreground font-black text-lg uppercase tracking-widest shadow-blue-premium hover:scale-105 active:scale-95 transition-all">
                                    Get Started Free
                                    <ArrowRight className="ml-3 w-5 h-5 stroke-[3]" />
                                </Button>
                            </Link>
                            <a href={initialGuestUrl} className="w-full sm:w-auto">
                                <Button variant="outline" className="w-full sm:w-auto h-16 px-12 rounded-2xl border-border/50 bg-background/50 backdrop-blur-md font-black text-lg uppercase tracking-widest hover:bg-secondary/50 transition-all">
                                    <Store className="mr-3 w-5 h-5" />
                                    Guest Store
                                </Button>
                            </a>
                        </div>

                        {/* Social Proof */}
                        <div className="pt-12 flex flex-col items-center gap-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-50">Trusted by over 50,000 users</p>
                            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
                                <span className="font-black text-2xl tracking-tighter">PAYSTACK</span>
                                <span className="font-black text-2xl tracking-tighter">MTN</span>
                                <span className="font-black text-2xl tracking-tighter">TELECEL</span>
                                <span className="font-black text-2xl tracking-tighter">AT</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid — Structured Excellence */}
            <section id="features" className="py-32 px-6 lg:px-10 bg-secondary/20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24 space-y-4">
                        <h2 className="text-xs font-black uppercase tracking-[0.5em] text-primary">Capabilities</h2>
                        <h3 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground">Engineered for <span className="text-primary">Performance</span></h3>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { icon: Zap, title: 'Instant Delivery', desc: 'Proprietary routing ensures data hits the target number in under 3 seconds.' },
                            { icon: BarChart3, title: 'Elite Pricing', desc: 'Wholesale rates optimized for maximum profit margins on every transaction.' },
                            { icon: Store, title: 'Branded Stores', desc: 'Launch your own white-label storefront and build your independent brand.' },
                            { icon: Wallet, title: 'Unified Wallet', desc: 'Secure, high-speed funding with instant balance settlement across all networks.' },
                            { icon: Shield, title: 'Enterprise Security', desc: 'Military-grade encryption and real-time fraud monitoring for every order.' },
                            { icon: HeadphonesIcon, title: '24/7 Command', desc: 'Dedicated terminal support via WhatsApp and secure internal ticketing.' },
                        ].map((feature, i) => (
                            <div key={i} className="card-premium p-10 group hover:border-primary/50 transition-all duration-500">
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

            {/* Network Section — High Visibility */}
            <section id="networks" className="py-32 px-6 lg:px-10">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="space-y-10">
                            <div className="space-y-6">
                                <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">
                                    Universal <br />
                                    <span className="text-primary">Connectivity.</span>
                                </h2>
                                <p className="text-xl text-muted-foreground font-medium max-w-lg">
                                    One terminal, every network. We provide deep integration with all major Ghanaian carriers.
                                </p>
                            </div>
                            
                            <div className="space-y-4">
                                {[
                                    { name: 'MTN Ghana', status: 'Optimal', color: 'bg-yellow-400' },
                                    { name: 'Telecel Ghana', status: 'Stable', color: 'bg-red-500' },
                                    { name: 'AirtelTigo', status: 'Stable', color: 'bg-blue-500' },
                                ].map((net, i) => (
                                    <div key={i} className="flex items-center justify-between p-6 rounded-2xl bg-secondary/50 border border-border/50">
                                        <div className="flex items-center gap-4">
                                            <div className={cn("w-3 h-3 rounded-full animate-pulse", net.color)} />
                                            <span className="font-bold text-lg">{net.name}</span>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">{net.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-[100px] -z-10" />
                            <Card className="card-premium p-10 overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <Layers className="w-40 h-40" />
                                </div>
                                <div className="relative z-10 space-y-8">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">System Status</p>
                                        <p className="text-4xl font-black">99.9% Uptime</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Response Time</p>
                                            <p className="text-2xl font-black">1.2s</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Success Rate</p>
                                            <p className="text-2xl font-black">99.98%</p>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <div className="h-full w-[99%] bg-primary shadow-gold" />
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA — The Close */}
            <section className="py-32 px-6 lg:px-10">
                <div className="max-w-7xl mx-auto">
                    <Card className="relative overflow-hidden rounded-[40px] border-0 bg-foreground p-12 md:p-24 text-background text-center shadow-2xl">
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] -mr-64 -mt-64" />
                        
                        <div className="relative z-10 space-y-12">
                            <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9]">
                                Ready to Upgrade <br />
                                <span className="text-primary">Your Business?</span>
                            </h2>
                            <p className="max-w-2xl mx-auto text-xl font-medium opacity-70">
                                Stop struggling with slow deliveries and poor rates. Step into the future of data reselling with ARHMS DATA Terminal.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-6 justify-center">
                                <Link href="/auth/signup" className="w-full sm:w-auto">
                                    <Button className="w-full sm:w-auto h-20 px-16 rounded-3xl bg-primary text-primary-foreground font-black text-xl uppercase tracking-widest shadow-blue-premium hover:scale-105 active:scale-95 transition-all">
                                        Create Account
                                    </Button>
                                </Link>
                                <Link href="/auth/login" className="w-full sm:w-auto">
                                    <Button variant="outline" className="w-full sm:w-auto h-20 px-16 rounded-3xl border-background/20 bg-background/5 text-background font-black text-xl uppercase tracking-widest hover:bg-background/10 transition-all">
                                        Sign In
                                    </Button>
                                </Link>
                            </div>
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
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Terminal</p>
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
