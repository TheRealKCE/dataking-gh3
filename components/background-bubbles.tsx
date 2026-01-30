'use client'

import { useEffect, useState } from 'react'

interface BackgroundBubblesProps {
    scrollable?: boolean
}

export function BackgroundBubbles({ scrollable = false }: BackgroundBubblesProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    // Scrollable version - background moves with content
    if (scrollable) {
        return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 min-h-full">
                {/* Light gray background */}
                <div className="absolute inset-0 bg-[#E5E7EB] min-h-full"></div>

                {/* Interactive animated bubbles - optimized for low-end mobiles */}
                <div className="bubbles pointer-events-auto">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="bubble"></div>
                    ))}
                </div>

                <style jsx>{`
                    .bubbles {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        min-height: 100vh;
                    }
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
                    
                    .bubble:hover,
                    .bubble:active {
                        transform: scale(1.15);
                        background: radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.4), rgba(59, 130, 246, 0.15));
                    }
                    
                    @keyframes float {
                        0%, 100% { transform: translateY(0) rotate(0deg); }
                        50% { transform: translateY(-15px) rotate(3deg); }
                    }
                    
                    /* Optimized positioned bubbles - fewer for better mobile performance */
                    .bubble:nth-child(1) { width: 50px; height: 50px; left: 8%; top: 12%; animation-delay: 0s; }
                    .bubble:nth-child(2) { width: 35px; height: 35px; left: 15%; top: 65%; animation-delay: 0.8s; }
                    .bubble:nth-child(3) { width: 65px; height: 65px; left: 22%; top: 30%; animation-delay: 1.6s; }
                    .bubble:nth-child(4) { width: 42px; height: 42px; left: 38%; top: 75%; animation-delay: 2.4s; }
                    .bubble:nth-child(5) { width: 55px; height: 55px; left: 48%; top: 18%; animation-delay: 3.2s; }
                    .bubble:nth-child(6) { width: 28px; height: 28px; left: 58%; top: 55%; animation-delay: 4s; }
                    .bubble:nth-child(7) { width: 48px; height: 48px; left: 68%; top: 8%; animation-delay: 4.8s; }
                    .bubble:nth-child(8) { width: 38px; height: 38px; left: 75%; top: 42%; animation-delay: 5.6s; }
                    .bubble:nth-child(9) { width: 60px; height: 60px; left: 82%; top: 68%; animation-delay: 0.6s; }
                    .bubble:nth-child(10) { width: 32px; height: 32px; left: 90%; top: 25%; animation-delay: 1.4s; }
                    .bubble:nth-child(11) { width: 45px; height: 45px; left: 5%; top: 88%; animation-delay: 2.2s; }
                    .bubble:nth-child(12) { width: 52px; height: 52px; left: 92%; top: 82%; animation-delay: 3s; }
                    
                    @media (max-width: 640px) {
                        .bubble {
                            animation-duration: 8s;
                        }
                        .bubble:hover,
                        .bubble:active {
                            transform: scale(1.1);
                        }
                    }
                `}</style>
            </div>
        )
    }

    // Fixed version - original behavior
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Light gray background */}
            <div className="absolute inset-0 bg-[#E5E7EB]"></div>

            {/* Interactive bubbles - optimized for performance */}
            <div className="bubbles pointer-events-auto">
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="bubble"></div>
                ))}
            </div>

            <style jsx>{`
                .bubbles {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                }
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
                    touch-action: manipulation;
                }
                
                .bubble:hover,
                .bubble:active {
                    transform: scale(1.15);
                    background: radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.4), rgba(59, 130, 246, 0.15));
                }
                
                /* Static positioned bubbles spread across the screen */
                .bubble:nth-child(1) { width: 50px; height: 50px; left: 8%; top: 15%; }
                .bubble:nth-child(2) { width: 35px; height: 35px; left: 15%; top: 60%; }
                .bubble:nth-child(3) { width: 65px; height: 65px; left: 22%; top: 35%; }
                .bubble:nth-child(4) { width: 42px; height: 42px; left: 38%; top: 78%; }
                .bubble:nth-child(5) { width: 55px; height: 55px; left: 48%; top: 20%; }
                .bubble:nth-child(6) { width: 28px; height: 28px; left: 58%; top: 50%; }
                .bubble:nth-child(7) { width: 48px; height: 48px; left: 68%; top: 10%; }
                .bubble:nth-child(8) { width: 38px; height: 38px; left: 75%; top: 45%; }
                .bubble:nth-child(9) { width: 60px; height: 60px; left: 82%; top: 70%; }
                .bubble:nth-child(10) { width: 32px; height: 32px; left: 90%; top: 28%; }
                .bubble:nth-child(11) { width: 45px; height: 45px; left: 5%; top: 85%; }
                .bubble:nth-child(12) { width: 52px; height: 52px; left: 92%; top: 80%; }
                
                @media (max-width: 640px) {
                    .bubble:hover,
                    .bubble:active {
                        transform: scale(1.1);
                    }
                }
            `}</style>
        </div>
    )
}
