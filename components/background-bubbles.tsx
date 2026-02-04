'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface BackgroundBubblesProps {
    scrollable?: boolean
}

interface Bubble {
    id: number
    size: number
    left: number
    top: number
    delay: number
    duration: number
}

export function BackgroundBubbles({ scrollable = false }: BackgroundBubblesProps) {
    const [mounted, setMounted] = useState(false)
    const [bubbles, setBubbles] = useState<Bubble[]>([])

    useEffect(() => {
        setMounted(true)
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024
        const count = isMobile ? 6 : 12 // Fewer bubbles on mobile for performance

        const newBubbles = Array.from({ length: count }, (_, i) => ({
            id: i,
            size: Math.random() * (isMobile ? 80 : 150) + 40,
            left: Math.random() * 100,
            top: Math.random() * 100,
            delay: Math.random() * 5,
            duration: Math.random() * 10 + 10,
        }))
        setBubbles(newBubbles)
    }, [])

    if (!mounted) return null

    return (
        <div className={cn(
            "fixed inset-0 pointer-events-none overflow-hidden z-[-1]",
            scrollable ? "absolute h-full" : "fixed h-screen w-full"
        )}>
            {/* Background Gradients */}
            <div className="absolute inset-0 bg-[#F8FAFC] dark:bg-[#020617] transition-colors duration-700" />
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 via-white to-indigo-50/50 dark:from-blue-950/20 dark:via-slate-950 dark:to-indigo-950/20" />

            {/* Bubble Container */}
            <div className="absolute inset-0 opacity-40 dark:opacity-30">
                {bubbles.map((bubble) => (
                    <div
                        key={bubble.id}
                        className="bubble"
                        style={{
                            width: `${bubble.size}px`,
                            height: `${bubble.size}px`,
                            left: `${bubble.left}%`,
                            top: `${bubble.top}%`,
                            animationDelay: `${bubble.delay}s`,
                            animationDuration: `${bubble.duration}s`,
                        }}
                    />
                ))}
            </div>

            <style jsx>{`
                .bubble {
                    position: absolute;
                    background: radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.1));
                    border-radius: 50%;
                    box-shadow: 
                        inset 0 0 10px rgba(59, 130, 246, 0.2),
                        0 0 20px rgba(59, 130, 246, 0.1);
                    cursor: pointer;
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    will-change: transform;
                    animation: float 6s ease-in-out infinite;
                    touch-action: manipulation;
                }

                @media (max-width: 1024px) {
                    .bubble {
                        /* Simpler background and no external shadow for mobile performance */
                        background: rgba(59, 130, 246, 0.15);
                        box-shadow: inset 0 0 8px rgba(59, 130, 246, 0.1);
                        animation-duration: 8s; /* Slower is cheaper */
                    }
                }

                .bubble:hover {
                    transform: scale(1.15);
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-15px) rotate(3deg); }
                }
            `}</style>
        </div>
    )
}
