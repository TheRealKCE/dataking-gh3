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
                {/* Ocean gradient background */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0077B6] via-[#00B4D8] to-[#90E0EF] min-h-full"></div>

                {/* Animated bubbles */}
                <div className="bubbles">
                    {[...Array(25)].map((_, i) => (
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
                        background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15));
                        border-radius: 50%;
                        box-shadow: 
                            inset 0 0 8px rgba(255, 255, 255, 0.4),
                            0 0 15px rgba(255, 255, 255, 0.15);
                        animation: float 8s ease-in-out infinite;
                    }
                    
                    @keyframes float {
                        0%, 100% { transform: translateY(0) rotate(0deg); }
                        50% { transform: translateY(-20px) rotate(5deg); }
                    }
                    
                    /* Animated positioned bubbles spread across the screen */
                    .bubble:nth-child(1) { width: 45px; height: 45px; left: 5%; top: 10%; animation-delay: 0s; }
                    .bubble:nth-child(2) { width: 25px; height: 25px; left: 12%; top: 40%; animation-delay: 0.5s; }
                    .bubble:nth-child(3) { width: 60px; height: 60px; left: 8%; top: 65%; animation-delay: 1s; }
                    .bubble:nth-child(4) { width: 35px; height: 35px; left: 20%; top: 20%; animation-delay: 1.5s; }
                    .bubble:nth-child(5) { width: 50px; height: 50px; left: 25%; top: 80%; animation-delay: 2s; }
                    .bubble:nth-child(6) { width: 20px; height: 20px; left: 30%; top: 8%; animation-delay: 2.5s; }
                    .bubble:nth-child(7) { width: 40px; height: 40px; left: 35%; top: 50%; animation-delay: 3s; }
                    .bubble:nth-child(8) { width: 55px; height: 55px; left: 45%; top: 15%; animation-delay: 3.5s; }
                    .bubble:nth-child(9) { width: 30px; height: 30px; left: 50%; top: 70%; animation-delay: 4s; }
                    .bubble:nth-child(10) { width: 48px; height: 48px; left: 55%; top: 35%; animation-delay: 4.5s; }
                    .bubble:nth-child(11) { width: 22px; height: 22px; left: 62%; top: 8%; animation-delay: 5s; }
                    .bubble:nth-child(12) { width: 65px; height: 65px; left: 68%; top: 60%; animation-delay: 5.5s; }
                    .bubble:nth-child(13) { width: 28px; height: 28px; left: 72%; top: 28%; animation-delay: 6s; }
                    .bubble:nth-child(14) { width: 42px; height: 42px; left: 78%; top: 85%; animation-delay: 6.5s; }
                    .bubble:nth-child(15) { width: 38px; height: 38px; left: 82%; top: 12%; animation-delay: 7s; }
                    .bubble:nth-child(16) { width: 52px; height: 52px; left: 88%; top: 45%; animation-delay: 7.5s; }
                    .bubble:nth-child(17) { width: 18px; height: 18px; left: 92%; top: 32%; animation-delay: 0.3s; }
                    .bubble:nth-child(18) { width: 33px; height: 33px; left: 95%; top: 68%; animation-delay: 0.8s; }
                    .bubble:nth-child(19) { width: 58px; height: 58px; left: 3%; top: 30%; animation-delay: 1.3s; }
                    .bubble:nth-child(20) { width: 26px; height: 26px; left: 40%; top: 3%; animation-delay: 1.8s; }
                    .bubble:nth-child(21) { width: 32px; height: 32px; left: 15%; top: 88%; animation-delay: 2.3s; }
                    .bubble:nth-child(22) { width: 44px; height: 44px; left: 60%; top: 92%; animation-delay: 2.8s; }
                    .bubble:nth-child(23) { width: 28px; height: 28px; left: 85%; top: 75%; animation-delay: 3.3s; }
                    .bubble:nth-child(24) { width: 36px; height: 36px; left: 48%; top: 55%; animation-delay: 3.8s; }
                    .bubble:nth-child(25) { width: 24px; height: 24px; left: 75%; top: 5%; animation-delay: 4.3s; }
                `}</style>
            </div>
        )
    }

    // Fixed version - original behavior
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Ocean gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0077B6] via-[#00B4D8] to-[#90E0EF]"></div>

            {/* Static bubbles - no animation for better performance */}
            <div className="bubbles">
                {[...Array(20)].map((_, i) => (
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
                    background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15));
                    border-radius: 50%;
                    box-shadow: 
                        inset 0 0 8px rgba(255, 255, 255, 0.4),
                        0 0 15px rgba(255, 255, 255, 0.15);
                }
                
                /* Static positioned bubbles spread across the screen */
                .bubble:nth-child(1) { width: 45px; height: 45px; left: 5%; top: 15%; }
                .bubble:nth-child(2) { width: 25px; height: 25px; left: 12%; top: 55%; }
                .bubble:nth-child(3) { width: 60px; height: 60px; left: 8%; top: 75%; }
                .bubble:nth-child(4) { width: 35px; height: 35px; left: 20%; top: 25%; }
                .bubble:nth-child(5) { width: 50px; height: 50px; left: 25%; top: 85%; }
                .bubble:nth-child(6) { width: 20px; height: 20px; left: 30%; top: 10%; }
                .bubble:nth-child(7) { width: 40px; height: 40px; left: 35%; top: 60%; }
                .bubble:nth-child(8) { width: 55px; height: 55px; left: 45%; top: 20%; }
                .bubble:nth-child(9) { width: 30px; height: 30px; left: 50%; top: 80%; }
                .bubble:nth-child(10) { width: 48px; height: 48px; left: 55%; top: 45%; }
                .bubble:nth-child(11) { width: 22px; height: 22px; left: 62%; top: 12%; }
                .bubble:nth-child(12) { width: 65px; height: 65px; left: 68%; top: 70%; }
                .bubble:nth-child(13) { width: 28px; height: 28px; left: 72%; top: 35%; }
                .bubble:nth-child(14) { width: 42px; height: 42px; left: 78%; top: 90%; }
                .bubble:nth-child(15) { width: 38px; height: 38px; left: 82%; top: 18%; }
                .bubble:nth-child(16) { width: 52px; height: 52px; left: 88%; top: 55%; }
                .bubble:nth-child(17) { width: 18px; height: 18px; left: 92%; top: 40%; }
                .bubble:nth-child(18) { width: 33px; height: 33px; left: 95%; top: 75%; }
                .bubble:nth-child(19) { width: 58px; height: 58px; left: 3%; top: 40%; }
                .bubble:nth-child(20) { width: 26px; height: 26px; left: 40%; top: 5%; }
            `}</style>
        </div>
    )
}
