'use client'

import { useEffect, useState } from 'react'

export function BackgroundBubbles() {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Ocean gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0077B6] via-[#00B4D8] to-[#90E0EF]"></div>

            {/* Animated bubbles */}
            <div className="bubbles">
                {[...Array(25)].map((_, i) => (
                    <div key={i} className="bubble"></div>
                ))}
            </div>

            {/* Subtle wave overlay */}
            <div className="absolute inset-0 opacity-20">
                <div className="wave"></div>
            </div>

            <style jsx>{`
                .bubbles {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                }
                .bubble {
                    position: absolute;
                    bottom: -100px;
                    background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.2));
                    border-radius: 50%;
                    animation: rise linear infinite;
                    box-shadow: 
                        inset 0 0 10px rgba(255, 255, 255, 0.5),
                        0 0 20px rgba(255, 255, 255, 0.2);
                }
                
                .bubble:nth-child(1) { width: 30px; height: 30px; left: 5%; animation-duration: 12s; }
                .bubble:nth-child(2) { width: 18px; height: 18px; left: 10%; animation-duration: 8s; animation-delay: 0.5s; }
                .bubble:nth-child(3) { width: 45px; height: 45px; left: 15%; animation-duration: 14s; animation-delay: 1s; }
                .bubble:nth-child(4) { width: 25px; height: 25px; left: 20%; animation-duration: 10s; animation-delay: 2s; }
                .bubble:nth-child(5) { width: 60px; height: 60px; left: 25%; animation-duration: 16s; animation-delay: 0s; }
                .bubble:nth-child(6) { width: 15px; height: 15px; left: 30%; animation-duration: 9s; animation-delay: 1.5s; }
                .bubble:nth-child(7) { width: 35px; height: 35px; left: 35%; animation-duration: 11s; animation-delay: 3s; }
                .bubble:nth-child(8) { width: 50px; height: 50px; left: 40%; animation-duration: 13s; animation-delay: 0.8s; }
                .bubble:nth-child(9) { width: 22px; height: 22px; left: 45%; animation-duration: 10s; animation-delay: 2.5s; }
                .bubble:nth-child(10) { width: 40px; height: 40px; left: 50%; animation-duration: 15s; animation-delay: 1.2s; }
                .bubble:nth-child(11) { width: 28px; height: 28px; left: 55%; animation-duration: 11s; animation-delay: 0.3s; }
                .bubble:nth-child(12) { width: 55px; height: 55px; left: 60%; animation-duration: 14s; animation-delay: 2s; }
                .bubble:nth-child(13) { width: 20px; height: 20px; left: 65%; animation-duration: 9s; animation-delay: 1.8s; }
                .bubble:nth-child(14) { width: 38px; height: 38px; left: 70%; animation-duration: 12s; animation-delay: 0.6s; }
                .bubble:nth-child(15) { width: 48px; height: 48px; left: 75%; animation-duration: 16s; animation-delay: 3s; }
                .bubble:nth-child(16) { width: 16px; height: 16px; left: 80%; animation-duration: 8s; animation-delay: 1s; }
                .bubble:nth-child(17) { width: 32px; height: 32px; left: 85%; animation-duration: 13s; animation-delay: 2.2s; }
                .bubble:nth-child(18) { width: 42px; height: 42px; left: 90%; animation-duration: 11s; animation-delay: 0.4s; }
                .bubble:nth-child(19) { width: 24px; height: 24px; left: 95%; animation-duration: 10s; animation-delay: 1.6s; }
                .bubble:nth-child(20) { width: 36px; height: 36px; left: 2%; animation-duration: 14s; animation-delay: 2.8s; }
                .bubble:nth-child(21) { width: 19px; height: 19px; left: 8%; animation-duration: 9s; animation-delay: 0.9s; }
                .bubble:nth-child(22) { width: 52px; height: 52px; left: 48%; animation-duration: 15s; animation-delay: 1.4s; }
                .bubble:nth-child(23) { width: 27px; height: 27px; left: 72%; animation-duration: 12s; animation-delay: 2.6s; }
                .bubble:nth-child(24) { width: 44px; height: 44px; left: 88%; animation-duration: 13s; animation-delay: 0.7s; }
                .bubble:nth-child(25) { width: 33px; height: 33px; left: 38%; animation-duration: 11s; animation-delay: 1.9s; }
                
                @keyframes rise {
                    0% {
                        bottom: -100px;
                        transform: translateX(0) scale(1);
                        opacity: 0.6;
                    }
                    25% {
                        transform: translateX(15px) scale(1.05);
                    }
                    50% {
                        transform: translateX(-15px) scale(0.95);
                        opacity: 0.8;
                    }
                    75% {
                        transform: translateX(10px) scale(1.02);
                    }
                    100% {
                        bottom: 110%;
                        transform: translateX(-10px) scale(1);
                        opacity: 0.3;
                    }
                }
                
                .wave {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 200%;
                    height: 100%;
                    background: linear-gradient(180deg, transparent 80%, rgba(255,255,255,0.1) 100%);
                    animation: wave 8s linear infinite;
                }
                
                @keyframes wave {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    )
}
