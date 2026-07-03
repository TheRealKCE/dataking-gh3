'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
    ChevronLeft,
    ChevronRight,
    Megaphone,
    ShoppingBag,
    Rocket,
    ShieldCheck,
    ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Slide definitions                                                  */
/* ------------------------------------------------------------------ */
const slides = [
    {
        id: 1,
        badge: 'FOR SELLERS',
        title: 'Boost Your\nVisibility',
        subtitle:
            'Promote your items to reach more buyers and sell faster.',
        cta: 'Start Promoting',
        href: '/classifieds/seller/dashboard',
        gradient: 'from-violet-700 via-purple-600 to-fuchsia-600',
        glow: 'rgba(139,92,246,0.45)',
        accent: '#e9d5ff',
        Icon: Megaphone,
        floaters: ['✨', '⭐', '🔥'],
        mirror: false,
    },
    {
        id: 2,
        badge: 'FOR BUYERS',
        title: 'Discover\nGreat Deals',
        subtitle:
            'Find everything you need at unbeatable prices from trusted sellers.',
        cta: 'Shop Now',
        href: '/classifieds',
        gradient: 'from-blue-600 via-indigo-600 to-cyan-500',
        glow: 'rgba(99,102,241,0.45)',
        accent: '#bfdbfe',
        Icon: ShoppingBag,
        floaters: ['🏷️', '💎', '🛍️'],
        mirror: true,
    },
    {
        id: 3,
        badge: 'SELL FASTER',
        title: 'Sell Faster,\nSell More',
        subtitle:
            'List your items in minutes and connect with thousands of active buyers.',
        cta: 'Post a Listing',
        href: '/classifieds/seller/dashboard/new',
        gradient: 'from-emerald-600 via-teal-500 to-green-400',
        glow: 'rgba(16,185,129,0.45)',
        accent: '#a7f3d0',
        Icon: Rocket,
        floaters: ['💰', '📈', '🚀'],
        mirror: false,
    },
    {
        id: 4,
        badge: 'TRUST & SAFETY',
        title: 'Trust &\nSafety First',
        subtitle:
            'A secure marketplace designed to protect both buyers and sellers.',
        cta: 'Learn More',
        href: '/classifieds',
        gradient: 'from-orange-500 via-amber-500 to-yellow-400',
        glow: 'rgba(245,158,11,0.45)',
        accent: '#fde68a',
        Icon: ShieldCheck,
        floaters: ['✅', '🔒', '🛡️'],
        mirror: true,
    },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function HeroCarousel() {
    const [current, setCurrent] = useState(0)
    const [animating, setAnimating] = useState(false)
    const [slideDir, setSlideDir] = useState<'left' | 'right'>('right')
    const [visible, setVisible] = useState(true)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
            goTo('right')
        }, 5000)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Slide transition: fade-out → swap → fade-in
    const goTo = useCallback(
        (dirOrIndex: 'left' | 'right' | number) => {
            if (animating) return
            setAnimating(true)
            setVisible(false)

            setTimeout(() => {
                if (typeof dirOrIndex === 'number') {
                    setSlideDir(dirOrIndex > current ? 'right' : 'left')
                    setCurrent(dirOrIndex)
                } else {
                    setSlideDir(dirOrIndex)
                    setCurrent((prev) =>
                        dirOrIndex === 'right'
                            ? (prev + 1) % slides.length
                            : (prev - 1 + slides.length) % slides.length
                    )
                }
                setVisible(true)
                setTimeout(() => setAnimating(false), 400)
            }, 300)
        },
        [animating, current]
    )

    // Auto-advance
    useEffect(() => {
        startTimer()
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [startTimer])

    // Reset timer on manual nav
    const handleNav = useCallback(
        (dirOrIndex: 'left' | 'right' | number) => {
            goTo(dirOrIndex)
            startTimer()
        },
        [goTo, startTimer]
    )

    const slide = slides[current]
    const { Icon } = slide

    return (
        <div
            className="relative w-full overflow-hidden rounded-2xl shadow-2xl select-none"
            style={{ minHeight: '200px' }}
        >
            {/* ── Animated gradient background ── */}
            <div
                className={cn(
                    'absolute inset-0 bg-gradient-to-br transition-all duration-700',
                    slide.gradient
                )}
                style={{ boxShadow: `inset 0 0 100px ${slide.glow}` }}
            />

            {/* ── Decorative circles ── */}
            <div className="pointer-events-none absolute -top-16 -right-16 w-72 h-72 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute top-6 right-44 w-28 h-28 rounded-full bg-white/5" />

            {/* ── Dot-grid pattern ── */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.08]"
                style={{
                    backgroundImage:
                        'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '22px 22px',
                }}
            />

            {/* ── Main content (fade transition) ── */}
            <div
                className={cn(
                    'relative z-10 flex items-center justify-between gap-4 px-6 md:px-12 py-8 md:py-10 transition-all duration-300',
                    slide.mirror ? 'flex-row-reverse' : 'flex-row',
                    visible
                        ? 'opacity-100 translate-y-0'
                        : slideDir === 'right'
                          ? 'opacity-0 translate-y-3'
                          : 'opacity-0 -translate-y-3'
                )}
            >
                {/* ── Text block (order flips when mirrored) ── */}
                <div className={cn('flex-1 min-w-0', slide.mirror ? 'text-right' : 'text-left')}>
                    {/* Badge */}
                    <span
                        className="inline-block text-[10px] font-black tracking-[0.2em] px-3 py-1 rounded-full mb-3 uppercase"
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.18)',
                            color: slide.accent,
                        }}
                    >
                        {slide.badge}
                    </span>

                    {/* Title */}
                    <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3 whitespace-pre-line drop-shadow-md">
                        {slide.title}
                    </h2>

                    {/* Subtitle */}
                    <p className={cn(
                        'text-sm md:text-base text-white/85 font-medium mb-6 leading-relaxed max-w-sm',
                        slide.mirror ? 'ml-auto' : ''
                    )}>
                        {slide.subtitle}
                    </p>

                    {/* CTA button */}
                    <div className={cn('flex', slide.mirror ? 'justify-end' : 'justify-start')}>
                        <Link
                            href={slide.href}
                            className="inline-flex items-center gap-2 font-black text-sm px-6 py-3 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                color: '#111',
                            }}
                        >
                            {slide.cta}
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* ── Icon with halo (position controlled by parent flex-row / flex-row-reverse) ── */}
                <div className="hidden sm:flex flex-col items-center justify-center flex-shrink-0">
                    <div className="relative w-32 h-32 md:w-44 md:h-44 flex items-center justify-center">
                        {/* Pulsing halo rings */}
                        <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse" />
                        <div className="absolute inset-5 rounded-full bg-white/10" />

                        {/* Icon */}
                        <Icon
                            className="relative z-10 drop-shadow-2xl"
                            style={{ color: slide.accent, width: '48%', height: '48%' }}
                            strokeWidth={1.5}
                        />

                        {/* Floating decorations — flip sides when mirrored */}
                        <span
                            className={cn(
                                'absolute -top-3 text-xl md:text-2xl animate-bounce',
                                slide.mirror ? '-left-1' : '-right-1'
                            )}
                        >
                            {slide.floaters[0]}
                        </span>
                        <span
                            className={cn(
                                'absolute bottom-1 text-base md:text-xl animate-bounce',
                                slide.mirror ? '-right-4' : '-left-4'
                            )}
                            style={{ animationDelay: '0.3s' }}
                        >
                            {slide.floaters[1]}
                        </span>
                        <span
                            className={cn(
                                'absolute top-1/2 text-sm animate-bounce',
                                slide.mirror ? '-left-5' : '-right-5'
                            )}
                            style={{ animationDelay: '0.6s' }}
                        >
                            {slide.floaters[2]}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Left arrow ── */}
            <button
                type="button"
                onClick={() => handleNav('left')}
                aria-label="Previous slide"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/25 hover:bg-black/45 text-white flex items-center justify-center transition-all duration-150 backdrop-blur-sm hover:scale-110"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            {/* ── Right arrow ── */}
            <button
                type="button"
                onClick={() => handleNav('right')}
                aria-label="Next slide"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/25 hover:bg-black/45 text-white flex items-center justify-center transition-all duration-150 backdrop-blur-sm hover:scale-110"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            {/* ── Dot indicators ── */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                {slides.map((_, i) => (
                    <button
                        key={i}
                        type="button"
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={() => handleNav(i)}
                        className={cn(
                            'h-1.5 rounded-full bg-white transition-all duration-300',
                            i === current
                                ? 'w-7 opacity-100'
                                : 'w-1.5 opacity-40 hover:opacity-70'
                        )}
                    />
                ))}
            </div>

            {/* ── Progress bar ── */}
            <div className="absolute bottom-0 left-0 right-0 z-20 h-[3px] bg-white/15">
                <div
                    key={current}
                    className="h-full bg-white/60 rounded-full"
                    style={{
                        animation: 'progress-bar 5s linear forwards',
                    }}
                />
            </div>

            <style jsx>{`
                @keyframes progress-bar {
                    from {
                        width: 0%;
                    }
                    to {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    )
}
