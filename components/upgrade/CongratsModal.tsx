'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, CheckCircle, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CongratsModalProps {
    onClose: () => void
    onBrowsePackages: () => void
}

export default function CongratsModal({ onClose, onBrowsePackages }: CongratsModalProps) {
    const [showConfetti, setShowConfetti] = useState(true)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Trigger entrance animation
        setTimeout(() => setIsVisible(true), 50)

        // Hide confetti after 3 seconds
        const timer = setTimeout(() => setShowConfetti(false), 3000)

        return () => clearTimeout(timer)
    }, [])

    const agentFeatures = [
        'Exclusive Wholesale Pricing',
        'Priority Customer Support',
        'No Top Up Charges (0% Paystack Fee)',
        'Live Chat with Agents',
        'Faster Order Processing & Delivery',
        'Crown Badge on Profile with Avatar'
    ]

    const handleClose = () => {
        setIsVisible(false)
        setTimeout(onClose, 300)
    }

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Confetti Animation */}
            {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(50)].map((_, i) => {
                        const colors = ['#FBBF24', '#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6']
                        const randomColor = colors[Math.floor(Math.random() * colors.length)]
                        return (
                            <div
                                key={i}
                                className="absolute animate-confetti"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: '-10%',
                                    width: `${Math.random() * 8 + 4}px`,
                                    height: `${Math.random() * 12 + 6}px`,
                                    backgroundColor: randomColor,
                                    animationDelay: `${Math.random() * 0.5}s`,
                                    animationDuration: `${2 + Math.random() * 2}s`,
                                    transform: `rotate(${Math.random() * 360}deg)`
                                }}
                            />
                        )
                    })}
                </div>
            )}

            {/* Modal */}
            <div className={`relative bg-gradient-to-br from-yellow-400/95 via-amber-500/90 to-yellow-600/95 rounded-3xl p-6 sm:p-10 max-w-2xl w-full border-4 border-yellow-300 shadow-2xl shadow-yellow-500/50 transform transition-all duration-500 ${isVisible ? 'scale-100 translate-y-0' : 'scale-75 translate-y-8'}`}>
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                    <X className="w-5 h-5 text-white" />
                </button>

                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <Crown className="w-24 h-24 sm:w-32 sm:h-32 text-white animate-[bounce_1s_infinite] drop-shadow-lg" />
                        <div className="absolute inset-0 animate-ping opacity-30">
                            <Crown className="w-24 h-24 sm:w-32 sm:h-32 text-white" />
                        </div>
                        <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-white animate-pulse" />
                        <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-white animate-pulse" style={{ animationDelay: '0.5s' }} />
                    </div>
                </div>

                {/* Success Message */}
                <div className="text-center mb-8">
                    <h2 className="text-4xl sm:text-5xl font-black text-white mb-3 drop-shadow-lg">
                        🎉 Congratulations! 🎉
                    </h2>
                    <p className="text-xl sm:text-2xl font-bold text-amber-50">
                        You are Now a Premium Agent!
                    </p>
                </div>

                {/* Features List */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8 mb-8 border-2 border-white/20">
                    <h3 className="text-xl sm:text-2xl font-black text-white mb-5 text-center flex items-center justify-center gap-2">
                        <Crown className="w-6 h-6" />
                        Your Premium Benefits
                        <Crown className="w-6 h-6" />
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {agentFeatures.map((feature, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 animate-slideIn"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mt-0.5">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-sm sm:text-base font-bold text-white leading-snug">
                                    {feature}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        onClick={onBrowsePackages}
                        className="flex-1 h-14 bg-white text-amber-600 hover:bg-amber-50 font-black text-lg rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg"
                    >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Browse Your New Packages
                    </Button>
                    <Button
                        onClick={handleClose}
                        variant="outline"
                        className="sm:w-auto h-14 bg-transparent border-2 border-white text-white hover:bg-white/10 font-bold rounded-xl"
                    >
                        Close
                    </Button>
                </div>
            </div>

            {/* Animations */}
            <style jsx>{`
                @keyframes confetti {
                    0% { transform: translateY(-10%) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-confetti {
                    animation: confetti linear forwards;
                }
                .animate-slideIn {
                    animation: slideIn 0.5s ease-out forwards;
                    opacity: 0;
                }
            `}</style>
        </div>
    )
}
