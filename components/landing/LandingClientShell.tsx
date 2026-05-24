'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
    ArrowRight,
    BarChart3,
    Bell,
    CheckCircle2,
    HeadphonesIcon,
    Layers,
    MessageSquare,
    Shield,
    Smartphone,
    Store,
    Wallet,
    WalletCards,
    Zap,
} from 'lucide-react'

interface LandingClientShellProps {
    initialGuestUrl: string
    initialAdminPhone: string
    initialPlanPrices?: Record<TierId, number>
    initialWhatsappGroupLink?: string
    initialWhatsappChannelLink?: string
}

type TierId = '3d' | '14d' | '30d' | 'permanent'

const DEFAULT_PLAN_PRICES: Record<TierId, number> = {
    '3d': 9.99,
    '14d': 49.99,
    '30d': 99.99,
    permanent: 149.99,
}

const planCards: Array<{
    id: TierId
    name: string
    duration: string
    badge: string
    highlight?: boolean
}> = [
    { id: '3d', name: '3 Days', duration: '3 Days Access', badge: 'STARTER' },
    { id: '14d', name: '2 weeks', duration: '14 Days Access', badge: 'MOST POPULAR', highlight: true },
    { id: '30d', name: '1 month', duration: '30 Days Access', badge: 'PREMIUM' },
    { id: 'permanent', name: 'Lifetime', duration: 'Permanent Access', badge: 'LIFETIME ELITE' },
]

const featureCards: Array<{ icon: any; title: string; desc: string }> = [
    { icon: Zap, title: 'Instant Delivery', desc: 'Proprietary routing ensures data hits the target number in under 3 seconds.' },
    { icon: BarChart3, title: 'Elite Pricing', desc: 'Wholesale rates optimized for maximum profit margins on every transaction.' },
    { icon: Store, title: 'Branded Stores', desc: 'Launch your own white-label storefront and build your independent brand.' },
    { icon: Wallet, title: 'Unified Wallet', desc: 'Secure, high-speed funding with instant balance settlement across all networks.' },
    { icon: Shield, title: 'Enterprise Security', desc: 'Military-grade encryption and real-time fraud monitoring for every order.' },
    { icon: HeadphonesIcon, title: '24/7 Support', desc: 'Dedicated platform support via WhatsApp and secure internal ticketing.' },
    { icon: Smartphone, title: 'Airtime Top-Up', desc: 'Sell MTN, Telecel, and AT airtime with automatic network detection and fee handling.' },
    { icon: CheckCircle2, title: 'AFA Orders', desc: 'Submit and track AFA registration requests with ID capture and live status updates.' },
    { icon: Bell, title: 'Order Tracking', desc: 'Let buyers track recent orders by phone with live status and direct support options.' },
    { icon: WalletCards, title: 'Wallet Management', desc: 'Top up, monitor balances, and review credits or debits from one dashboard.' },
]

const faqItems = [
    {
        q: 'How do I start selling on ARHMS?',
        a: 'Create an account, log in to your dashboard, fund your wallet, and then sell directly or through your own storefront link.',
    },
    {
        q: 'Can I sell both data bundles and airtime?',
        a: 'Yes. ARHMS supports data bundle sales and airtime top-up flows across MTN, Telecel, and AT where enabled.',
    },
    {
        q: 'How do I fund my wallet?',
        a: 'You can top up through Paystack or use the manual top-up process in the Wallet page, with transaction history available in dashboard.',
    },
    {
        q: 'Can I create my own shop link?',
        a: 'Yes. You can set up a branded storefront with your shop name, slug, logo, banner, support contacts, and community link.',
    },
    {
        q: 'How do customers track orders or report issues?',
        a: 'Customers can use the public order tracker, while logged-in users can review orders, notifications, and complaints from dashboard pages.',
    },
]

import { BrandLogo } from '@/components/BrandLogo'

function SlideFooter({ current, total, onDotClick }: { current: number; total: number; onDotClick: (i: number) => void }) {
    return (
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/10 sm:border-border/30">
            <div className="flex items-center gap-1.5">
                {Array.from({ length: total }).map((_, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => onDotClick(i)}
                        className={cn(
                            'rounded-full transition-all duration-300',
                            i === current ? 'h-2 w-7 bg-amber-400' : 'h-2 w-2 bg-white/20 sm:bg-muted-foreground/25 hover:bg-amber-400/50'
                        )}
                        aria-label={`Go to slide ${i + 1}`}
                    />
                ))}
            </div>
            <span className="text-[10px] font-black text-white/30 sm:text-muted-foreground/50 tracking-widest">
                {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
        </div>
    )
}

export function LandingClientShell({
    initialGuestUrl,
    initialAdminPhone,
    initialPlanPrices,
}: LandingClientShellProps) {
    const router = useRouter()
    const [headerScrolled, setHeaderScrolled] = useState(false)
    const [guestUrl] = useState(initialGuestUrl)
    const [adminPhone] = useState(initialAdminPhone)
    const [planPrices] = useState<Record<TierId, number>>(initialPlanPrices || DEFAULT_PLAN_PRICES)
    const [slide, setSlide] = useState(0)
    const [touchStartX, setTouchStartX] = useState<number | null>(null)
    const SLIDE_COUNT = 4

    const isValidGuestUrl = Boolean(guestUrl && !guestUrl.endsWith('/shop/demo') && guestUrl.includes('/shop/'))

    useEffect(() => {
        const handleScroll = () => setHeaderScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        try {
            const slug = sessionStorage.getItem('shop_sticky_slug')
            if (slug) { router.replace(`/shop/${slug}`) }
        } catch (_) {}
    }, [router])

    // Auto-advance carousel every 4 s
    useEffect(() => {
        const t = setInterval(() => setSlide(s => (s + 1) % SLIDE_COUNT), 4000)
        return () => clearInterval(t)
    }, [])

    return (
        <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary-foreground">
            {/* ── NAV ── */}
            <nav className={cn(
                'fixed top-0 w-full z-[100] transition-all duration-500 h-16 sm:h-20 flex items-center',
                headerScrolled
                    ? 'bg-zinc-900/95 sm:bg-white/95 backdrop-blur-2xl border-b border-white/10 sm:border-border/40 shadow-sm'
                    : 'bg-transparent'
            )}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 w-full flex items-center justify-between">
                    <a href="#" className="flex items-center gap-2 group cursor-pointer">
                        <BrandLogo hideText />
                        <span className="font-heading font-black text-lg sm:text-xl tracking-tighter text-white sm:text-foreground group-hover:text-amber-400 transition-colors">
                            ARHMS <span className="text-amber-400">TECH</span>
                        </span>
                    </a>

                    {/* Desktop nav links */}
                    <div className="hidden md:flex items-center gap-6 lg:gap-8">
                        {[['Products','#features'],['Wallet','#plans'],['Resell','#plans'],['AFA','#support'],['Community','#support']].map(([label, href]) => (
                            <a key={label} href={href} className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">{label}</a>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden sm:block"><ThemeToggle /></div>
                        <Link href="/dashboard/install">
                            <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border-border/60 px-3 h-8">
                                <Smartphone className="w-3 h-3" /> Install App
                            </Button>
                        </Link>
                        <Link href="/auth/login">
                            <Button variant="ghost" size="sm" className="text-white sm:text-foreground hover:text-amber-400 sm:hover:text-foreground font-black uppercase tracking-widest text-xs px-3 h-9">
                                Login
                            </Button>
                        </Link>
                        <Link href="/auth/signup">
                            <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-black font-black uppercase tracking-widest text-xs h-9 px-5 rounded-full shadow-lg transition-all">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── HERO ── */}
            {/* Mobile: dark bg  |  Desktop: light gradient */}
            <section
                className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-10 overflow-hidden pt-16 bg-[#0b0b14] sm:bg-transparent"
                onTouchStart={e => setTouchStartX(e.touches[0].clientX)}
                onTouchEnd={e => {
                    if (touchStartX === null) return
                    const dx = e.changedTouches[0].clientX - touchStartX
                    if (Math.abs(dx) > 40) setSlide(s => dx < 0 ? (s + 1) % SLIDE_COUNT : (s - 1 + SLIDE_COUNT) % SLIDE_COUNT)
                    setTouchStartX(null)
                }}
            >
                {/* Desktop background — hidden on mobile */}
                <div className="hidden sm:block absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50/60 to-amber-50 pointer-events-none" />
                <div className="hidden sm:block absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="hidden sm:block absolute top-1/3 right-0 w-[500px] h-[500px] bg-amber-300/30 rounded-full blur-[100px] pointer-events-none" />
                <div className="hidden sm:block absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-400/15 rounded-full blur-[100px] pointer-events-none" />
                <div className="hidden sm:block absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(255,255,255,0.45),transparent)] pointer-events-none" />

                {/* Mobile background — subtle star/glow effect */}
                <div className="sm:hidden absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-[80px]" />
                    <div className="absolute bottom-1/4 right-0 w-60 h-60 bg-blue-500/10 rounded-full blur-[80px]" />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center w-full max-w-lg mx-auto gap-4">
                    {/* Logo */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white shadow-2xl shadow-black/20 ring-4 ring-white/20 sm:ring-white/60 flex items-center justify-center overflow-hidden">
                        <div className="relative w-14 h-14 sm:w-16 sm:h-16">
                            <Image src="/logo.png" alt="ARHMS Logo" fill className="object-contain" priority />
                        </div>
                    </div>

                    {/* Brand name */}
                    <div className="flex flex-col items-center gap-0.5">
                        <span className="font-heading font-black text-2xl sm:text-3xl tracking-tight text-white sm:text-foreground">
                            ARHMS <span className="text-amber-400">TECH</span>
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 sm:text-muted-foreground/60">Technologies Ltd</span>
                    </div>

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 sm:bg-white/70 border border-amber-400/30 sm:border-amber-300/50 backdrop-blur-sm shadow-sm">
                        <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80 sm:text-foreground/80">Ultra Fast Instant Delivery</span>
                    </div>

                    {/* ── CAROUSEL CARD ── */}
                    <div className="w-full relative" style={{ minHeight: 420 }}>
                        {/* Slide 1 — Welcome */}
                        <div className={cn(
                            'w-full rounded-3xl p-6 sm:p-8 text-left transition-all duration-500 absolute inset-0',
                            'bg-[#141424] sm:bg-white/70 border border-white/10 sm:border-white/80 shadow-2xl shadow-black/30 sm:shadow-black/10 backdrop-blur-xl',
                            slide === 0 ? 'opacity-100 translate-x-0 pointer-events-auto' : slide > 0 ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-0 translate-x-4 pointer-events-none'
                        )}>
                            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-400 mb-3">Welcome to</p>
                            <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tight leading-tight text-white sm:text-foreground mb-3">
                                ARHMS <span className="text-amber-400">TECH</span>
                            </h1>
                            <p className="text-sm font-medium text-white/60 sm:text-muted-foreground leading-relaxed mb-6">
                                Ghana&apos;s all-in-one platform for mobile data, airtime, Results Checkers, and business growth. Instant delivery, always.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 sm:flex-wrap">
                                <Link href="/auth/login" className="w-full sm:w-auto">
                                    <Button className="w-full sm:w-auto h-12 sm:h-10 rounded-full bg-amber-400 hover:bg-amber-500 text-black font-black text-sm sm:text-xs uppercase tracking-widest shadow-lg shadow-amber-400/30 transition-all">
                                        Sign In
                                    </Button>
                                </Link>
                                <Link href="/auth/signup" className="w-full sm:w-auto">
                                    <Button className="w-full sm:w-auto h-12 sm:h-10 rounded-full bg-white text-black font-black text-sm sm:text-xs uppercase tracking-widest border border-zinc-200 hover:bg-zinc-50 transition-all">
                                        Create Account
                                    </Button>
                                </Link>
                                {isValidGuestUrl && (
                                    <a href={guestUrl} className="w-full sm:w-auto">
                                        <Button className="w-full sm:w-auto h-12 sm:h-10 rounded-full bg-zinc-700 sm:bg-white/80 text-white sm:text-black font-black text-sm sm:text-xs uppercase tracking-widest border border-zinc-600 sm:border-zinc-200 hover:bg-zinc-600 sm:hover:bg-zinc-50 transition-all">
                                            Buy as Guest
                                        </Button>
                                    </a>
                                )}
                                <Link href="/dashboard/install" className="w-full sm:w-auto">
                                    <Button className="w-full sm:w-auto h-12 sm:h-10 rounded-full bg-zinc-700 sm:bg-white/80 text-white sm:text-black font-black text-sm sm:text-xs uppercase tracking-widest border border-zinc-600 sm:border-zinc-200 hover:bg-zinc-600 sm:hover:bg-zinc-50 transition-all">
                                        <Smartphone className="w-3.5 h-3.5 mr-1.5" /> Download App
                                    </Button>
                                </Link>
                            </div>
                            <SlideFooter current={0} total={SLIDE_COUNT} onDotClick={setSlide} />
                        </div>

                        {/* Slide 2 — Instant Delivery */}
                        <div className={cn(
                            'w-full rounded-3xl p-6 sm:p-8 text-left transition-all duration-500 absolute inset-0',
                            'bg-[#141424] sm:bg-white/70 border border-white/10 sm:border-white/80 shadow-2xl shadow-black/30 sm:shadow-black/10 backdrop-blur-xl',
                            slide === 1 ? 'opacity-100 translate-x-0 pointer-events-auto' : slide > 1 ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-0 translate-x-4 pointer-events-none'
                        )}>
                            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-400 mb-3">Lightning Fast</p>
                            <h2 className="font-heading font-black text-3xl sm:text-4xl tracking-tight leading-tight text-white sm:text-foreground mb-3">
                                Data in <span className="text-amber-400">Seconds</span>
                            </h2>
                            <p className="text-sm font-medium text-white/60 sm:text-muted-foreground leading-relaxed mb-5">
                                MTN, Telecel, and AT bundles delivered to any phone in under 3 seconds. Automated routing, zero delays.
                            </p>
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                {[
                                    { label: 'Delivery', value: '< 3s' },
                                    { label: 'Uptime', value: '99.9%' },
                                    { label: 'Success', value: '99.98%' },
                                ].map(s => (
                                    <div key={s.label} className="rounded-2xl bg-white/5 sm:bg-black/5 border border-white/10 sm:border-black/10 p-3 text-center">
                                        <p className="font-black text-lg text-amber-400">{s.value}</p>
                                        <p className="text-[10px] font-bold text-white/50 sm:text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                            <Link href="/auth/signup">
                                <Button className="h-12 sm:h-10 w-full sm:w-auto rounded-full bg-amber-400 hover:bg-amber-500 text-black font-black text-sm sm:text-xs uppercase tracking-widest shadow-lg shadow-amber-400/30 transition-all">
                                    <Zap className="w-4 h-4 mr-2 fill-black" /> Buy Data Now
                                </Button>
                            </Link>
                            <SlideFooter current={1} total={SLIDE_COUNT} onDotClick={setSlide} />
                        </div>

                        {/* Slide 3 — Your Own Shop */}
                        <div className={cn(
                            'w-full rounded-3xl p-6 sm:p-8 text-left transition-all duration-500 absolute inset-0',
                            'bg-[#141424] sm:bg-white/70 border border-white/10 sm:border-white/80 shadow-2xl shadow-black/30 sm:shadow-black/10 backdrop-blur-xl',
                            slide === 2 ? 'opacity-100 translate-x-0 pointer-events-auto' : slide > 2 ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-0 translate-x-4 pointer-events-none'
                        )}>
                            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-400 mb-3">Build Your Brand</p>
                            <h2 className="font-heading font-black text-3xl sm:text-4xl tracking-tight leading-tight text-white sm:text-foreground mb-3">
                                Launch Your <span className="text-amber-400">Shop</span>
                            </h2>
                            <p className="text-sm font-medium text-white/60 sm:text-muted-foreground leading-relaxed mb-5">
                                Create a branded storefront with your name, logo, pricing, and checkout link — share it anywhere and start earning.
                            </p>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {['Public Shop URL', 'Custom Pricing', 'Order Tracking', 'WhatsApp Support', 'Brand Logo'].map(f => (
                                    <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 sm:bg-black/5 border border-white/10 sm:border-black/10 text-[10px] font-bold text-white/70 sm:text-foreground/70 uppercase tracking-wide">
                                        <CheckCircle2 className="w-3 h-3 text-amber-400" />{f}
                                    </span>
                                ))}
                            </div>
                            <Link href="/auth/signup">
                                <Button className="h-12 sm:h-10 w-full sm:w-auto rounded-full bg-amber-400 hover:bg-amber-500 text-black font-black text-sm sm:text-xs uppercase tracking-widest shadow-lg shadow-amber-400/30 transition-all">
                                    <Store className="w-4 h-4 mr-2" /> Open Your Shop
                                </Button>
                            </Link>
                            <SlideFooter current={2} total={SLIDE_COUNT} onDotClick={setSlide} />
                        </div>

                        {/* Slide 4 — Agent Plans */}
                        <div className={cn(
                            'w-full rounded-3xl p-6 sm:p-8 text-left transition-all duration-500 absolute inset-0',
                            'bg-[#141424] sm:bg-white/70 border border-white/10 sm:border-white/80 shadow-2xl shadow-black/30 sm:shadow-black/10 backdrop-blur-xl',
                            slide === 3 ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none'
                        )}>
                            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-400 mb-3">Become an Agent</p>
                            <h2 className="font-heading font-black text-3xl sm:text-4xl tracking-tight leading-tight text-white sm:text-foreground mb-3">
                                Grow Your <span className="text-amber-400">Business</span>
                            </h2>
                            <p className="text-sm font-medium text-white/60 sm:text-muted-foreground leading-relaxed mb-5">
                                Unlock wholesale rates, priority support, and bulk tools. Plans starting from GHS 9.99 — pick yours today.
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {[
                                    { name: 'Starter', price: `GHS ${planPrices['3d'].toFixed(2)}`, period: '3 Days' },
                                    { name: 'Popular', price: `GHS ${planPrices['14d'].toFixed(2)}`, period: '14 Days', highlight: true },
                                    { name: 'Premium', price: `GHS ${planPrices['30d'].toFixed(2)}`, period: '30 Days' },
                                    { name: 'Lifetime', price: `GHS ${planPrices['permanent'].toFixed(2)}`, period: 'Forever' },
                                ].map(p => (
                                    <div key={p.name} className={cn(
                                        'rounded-2xl border p-3 text-center',
                                        p.highlight
                                            ? 'bg-amber-400/15 border-amber-400/40'
                                            : 'bg-white/5 sm:bg-black/5 border-white/10 sm:border-black/10'
                                    )}>
                                        <p className={cn('font-black text-sm', p.highlight ? 'text-amber-400' : 'text-white/80 sm:text-foreground/80')}>{p.name}</p>
                                        <p className="font-black text-base text-white sm:text-foreground">{p.price}</p>
                                        <p className="text-[10px] text-white/40 sm:text-muted-foreground uppercase tracking-wide">{p.period}</p>
                                    </div>
                                ))}
                            </div>
                            <Link href="/auth/signup">
                                <Button className="h-12 sm:h-10 w-full sm:w-auto rounded-full bg-amber-400 hover:bg-amber-500 text-black font-black text-sm sm:text-xs uppercase tracking-widest shadow-lg shadow-amber-400/30 transition-all">
                                    <ArrowRight className="w-4 h-4 mr-2" /> Become an Agent
                                </Button>
                            </Link>
                            <SlideFooter current={3} total={SLIDE_COUNT} onDotClick={setSlide} />
                        </div>
                    </div>

                    <Link href="/shop/status" className="inline-flex items-center gap-2 text-xs font-bold text-white/40 sm:text-muted-foreground hover:text-amber-400 transition-colors">
                        <CheckCircle2 className="w-4 h-4" /> Track an Order
                    </Link>
                </div>
            </section>

            <section className="py-28 px-6 lg:px-10 bg-secondary/20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-xs font-black uppercase tracking-[0.5em] text-primary">How It Works</h2>
                        <h3 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground">Start Reselling in <span className="text-primary">3 Simple Steps</span></h3>
                        <p className="max-w-3xl mx-auto text-muted-foreground font-medium">
                            ARHMS takes you from signup to first sale with wallet funding, agent upgrade options, and a ready-to-share storefront.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '01', title: 'Create account', desc: 'Create your account and unlock the dashboard.' },
                            { step: '02', title: 'Fund wallet', desc: 'Fund your wallet using Paystack or manual top-up.' },
                            { step: '03', title: 'Start selling', desc: 'Sell data or airtime and share your storefront link.' },
                        ].map((item) => (
                            <div key={item.step} className="card-premium p-8 relative">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{item.step}</span>
                                <h4 className="text-2xl font-black mt-4 mb-3">{item.title}</h4>
                                <p className="text-muted-foreground font-medium">{item.desc}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                        <Link href="/auth/signup">
                            <Button className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">Create Account</Button>
                        </Link>
                        <a href="#plans">
                            <Button variant="outline" className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">
                                See Agent Plans
                            </Button>
                        </a>
                    </div>
                </div>
            </section>

            <section id="features" className="py-32 px-6 lg:px-10">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20 space-y-4">
                        <h2 className="text-xs font-black uppercase tracking-[0.5em] text-primary">Capabilities</h2>
                        <h3 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground">
                            Everything You Need to <span className="text-primary">Sell and Support Customers</span>
                        </h3>
                        <p className="max-w-3xl mx-auto text-muted-foreground font-medium">
                            Keep the speed of instant delivery while adding the operational tools resellers use every day.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-6">
                        {featureCards.map((feature, i) => (
                            <div key={`${feature.title}-${i}`} className="card-premium p-7 group hover:border-primary/50 transition-all duration-500">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
                                    <feature.icon className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors" />
                                </div>
                                <h4 className="text-xl font-black text-foreground mb-3 tracking-tight">{feature.title}</h4>
                                <p className="text-sm text-muted-foreground font-medium leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
                        <Link href="/auth/signup">
                            <Button className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">Open Account</Button>
                        </Link>
                        <a href={guestUrl}>
                            <Button variant="outline" className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">
                                View Guest Store
                            </Button>
                        </a>
                    </div>
                </div>
            </section>

            <section id="plans" className="py-32 px-6 lg:px-10 bg-secondary/20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-xs font-black uppercase tracking-[0.5em] text-primary">Reseller Plans</h2>
                        <h3 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground">Choose Your <span className="text-primary">Agent Plan</span></h3>
                        <p className="max-w-3xl mx-auto text-muted-foreground font-medium">
                            Every plan unlocks the same reseller toolkit. Pick the access length that matches how you want to grow.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
                        {planCards.map((plan) => (
                            <Card
                                key={plan.id}
                                className={cn(
                                    'card-premium p-8 relative overflow-hidden',
                                    plan.highlight && 'border-primary shadow-blue-premium'
                                )}
                            >
                                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />
                                <div className="relative z-10 space-y-4">
                                    <p className="inline-flex text-[10px] font-black uppercase tracking-[0.18em] px-3 py-1 rounded-full bg-primary text-primary-foreground">
                                        {plan.badge}
                                    </p>
                                    <h4 className="text-3xl font-black tracking-tight">{plan.name}</h4>
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{plan.duration}</p>
                                    <p className="text-4xl font-black text-primary">GHS {planPrices[plan.id].toFixed(2)}</p>
                                    <Link href="/auth/signup">
                                        <Button className="w-full h-12 rounded-2xl font-black uppercase tracking-widest">
                                            Become an Agent
                                        </Button>
                                    </Link>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <div className="mt-10 card-premium p-8">
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-primary mb-4">Included in all plans</p>
                        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm font-bold text-muted-foreground">
                            {[
                                'Exclusive Wholesale Pricing',
                                'Priority Customer Support',
                                '0% Top Up Charges (Admin Manual Top Up)',
                                'Faster Order Processing',
                                'Bulk Order Import Feature',
                                'New Exclusive UI Design Features',
                                'Shop Storefront Feature (Live)',
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-center mt-10">
                        <a href="#features">
                            <Button variant="outline" className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">
                                Compare Features
                            </Button>
                        </a>
                    </div>
                </div>
            </section>

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
                                    One platform, every network. We provide deep integration with all major Ghanaian carriers.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { name: 'MTN Ghana', status: 'Optimal', color: 'bg-yellow-400' },
                                    { name: 'Telecel Ghana', status: 'Stable', color: 'bg-red-500' },
                                    { name: 'AT (AirtelTigo)', status: 'Stable', color: 'bg-orange-500' },
                                ].map((net, i) => (
                                    <div key={i} className="flex items-center justify-between p-6 rounded-2xl bg-secondary/50 border border-border/50">
                                        <div className="flex items-center gap-4">
                                            <div className={cn('w-3 h-3 rounded-full animate-pulse', net.color)} />
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

            <section className="py-32 px-6 lg:px-10 bg-secondary/20">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <h2 className="text-4xl md:text-6xl font-black tracking-tighter">
                                Your Own <span className="text-primary">Branded Storefront</span>
                            </h2>
                            <p className="text-lg text-muted-foreground font-medium">
                                Create a public shop link with your name, logo, banner, colors, community link, data packages, airtime checkout, order tracking, and a dedicated about page.
                            </p>
                            <div className="grid sm:grid-cols-2 gap-3 text-sm">
                                {[
                                    'Public shop URL',
                                    'Brand colors and logo',
                                    'Banner image',
                                    'Data package tabs by network',
                                    'Airtime recharge',
                                    'About Shop & Terms page',
                                    'WhatsApp support',
                                    'Community invite link',
                                    'Track My Orders',
                                ].map((item) => (
                                    <div key={item} className="flex items-center gap-2 font-bold text-muted-foreground">
                                        <CheckCircle2 className="w-4 h-4 text-primary" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                <a href={guestUrl}>
                                    <Button className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">View Guest Store Demo</Button>
                                </a>
                                <Link href="/shop/status">
                                    <Button variant="outline" className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">
                                        Track Demo Order
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        <Card className="card-premium p-8">
                            <div className="rounded-3xl border border-border/40 bg-background/80 overflow-hidden">
                                <div className="h-10 px-4 flex items-center gap-2 border-b border-border/40">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                                    <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Storefront Preview</span>
                                </div>
                                <div className="p-6 space-y-5">
                                    <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Shop Header</p>
                                        <p className="text-2xl font-black mt-1">Your Shop Name</p>
                                        <p className="text-sm opacity-80">Branded checkout for data and airtime sales.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['MTN Bundles', 'Telecel Bundles', 'AT Bundles', 'Airtime Top-Up'].map((block) => (
                                            <div key={block} className="rounded-xl border border-border/40 p-3">
                                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{block}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="rounded-xl border border-border/40 p-3 flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Track My Orders</span>
                                        <ArrowRight className="w-4 h-4 text-primary" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </section>

            <section className="py-32 px-6 lg:px-10">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-xs font-black uppercase tracking-[0.5em] text-primary">Testimonials</h2>
                        <h3 className="text-4xl md:text-6xl font-black tracking-tighter">Built for Real <span className="text-primary">Ghanaian Resellers</span></h3>
                        <p className="max-w-3xl mx-auto text-muted-foreground font-medium">
                            Supporting wallet funding, storefront sales, airtime orders, and order tracking across Ghana&apos;s major networks.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                quote: 'I started with data bundles, then added airtime sales and my own shop link. Customers can order and track status without calling me every time.',
                                name: 'Akosua M.',
                                role: 'Reseller, Accra',
                            },
                            {
                                quote: 'The wallet flow and storefront saved me from taking orders manually in WhatsApp all day. I can fund once and keep selling.',
                                name: 'Kwame B.',
                                role: 'Campus Vendor, Kumasi',
                            },
                            {
                                quote: 'What I like most is the visibility: shop branding, order history, and complaints support all live in one place.',
                                name: 'Efua N.',
                                role: 'Small Business Owner, Takoradi',
                            },
                        ].map((item) => (
                            <Card key={item.name} className="card-premium p-8">
                                <MessageSquare className="w-6 h-6 text-primary mb-4" />
                                <p className="text-muted-foreground font-medium leading-relaxed mb-6">&ldquo;{item.quote}&rdquo;</p>
                                <div>
                                    <p className="font-black text-foreground">{item.name}</p>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary">{item.role}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                        <Link href="/auth/signup">
                            <Button className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">Create Free Account</Button>
                        </Link>
                        {isValidGuestUrl && (
                        <a href={guestUrl}>
                            <Button variant="outline" className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">
                                Open Guest Store
                            </Button>
                        </a>
                        )}
                    </div>
                </div>
            </section>

            <section id="support" className="py-32 px-6 lg:px-10 bg-secondary/20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-xs font-black uppercase tracking-[0.5em] text-primary">FAQ</h2>
                        <h3 className="text-4xl md:text-6xl font-black tracking-tighter">Questions New Resellers <span className="text-primary">Ask First</span></h3>
                        <p className="max-w-3xl mx-auto text-muted-foreground font-medium">
                            Answering the practical questions that block new signups, based on features already live inside ARHMS.
                        </p>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-5">
                        {faqItems.map((item) => (
                            <details key={item.q} className="card-premium p-6 group open:border-primary/50">
                                <summary className="list-none cursor-pointer flex items-start justify-between gap-4">
                                    <span className="text-lg font-black">{item.q}</span>
                                    <ArrowRight className="w-4 h-4 mt-1 text-primary transition-transform group-open:rotate-90" />
                                </summary>
                                <p className="mt-4 text-muted-foreground font-medium leading-relaxed">{item.a}</p>
                            </details>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                        <Link href="/auth/signup">
                            <Button className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">Create Free Account</Button>
                        </Link>
                        <Link href="/shop/status">
                            <Button variant="outline" className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest">
                                Track an Order
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

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
                                Stop struggling with slow deliveries and poor rates. Step into the future of data and airtime reselling with ARHMS DATA.
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

            <footer className="py-20 px-6 lg:px-10 border-t border-border/40">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-4 gap-16 mb-20">
                        <div className="md:col-span-2 space-y-8">
                            <div className="flex items-center gap-3">
                                <BrandLogo hideText className="scale-75 origin-left" />
                                <span className="font-heading font-black text-xl tracking-tighter">ARHMS DATA</span>
                            </div>
                            <p className="text-muted-foreground font-medium max-w-sm">
                                The definitive platform for digital asset reselling in West Africa. Built for speed, security, and absolute reliability.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <Link href="/auth/signup">
                                    <Button className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest">Create Free Account</Button>
                                </Link>
                                <Link href="/auth/login">
                                    <Button variant="outline" className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                        Login
                                    </Button>
                                </Link>
                                {isValidGuestUrl && (
                                <a href={guestUrl}>
                                    <Button variant="outline" className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                        Open Guest Store
                                    </Button>
                                </a>
                                )}
                                <Link href="/shop/status">
                                    <Button variant="outline" className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                        Track Order Status
                                    </Button>
                                </Link>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Platform</p>
                            <ul className="space-y-4 text-sm font-bold text-muted-foreground">
                                <li>
                                    <a href="#features" className="hover:text-primary transition-colors">
                                        Features
                                    </a>
                                </li>
                                <li>
                                    <a href="#plans" className="hover:text-primary transition-colors">
                                        Reseller Plans
                                    </a>
                                </li>
                                <li>
                                    <Link href="/shop/status" className="hover:text-primary transition-colors">
                                        Order Tracking
                                    </Link>
                                </li>
                            </ul>
                        </div>
                        <div className="space-y-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Legal</p>
                            <ul className="space-y-4 text-sm font-bold text-muted-foreground">
                                <li>
                                    <Link href="/terms" className="hover:text-primary transition-colors">
                                        Terms of Service
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/privacy" className="hover:text-primary transition-colors">
                                        Privacy Protocol
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/contact" className="hover:text-primary transition-colors">
                                        Secure Contact
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 pt-10 border-t border-border/40 opacity-60">
                        <p className="text-[10px] font-black uppercase tracking-widest">© 2026 ARHMS DATA LTD • ALL RIGHTS RESERVED</p>
                        <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest">
                            <span>WEST AFRICA</span>
                            <span>HQ: ACCRA, GHANA</span>
                            {adminPhone ? <span>SUPPORT: {adminPhone}</span> : null}
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}

