'use client'

import React, { useState, useEffect } from 'react'
import { X, HelpCircle } from 'lucide-react'
import { Button } from './ui/button'

interface FloatingWhatsAppProps {
    variant?: 'default' | 'auth'
}

export function FloatingWhatsApp({ variant = 'default' }: FloatingWhatsAppProps) {
    const PHONE_NUMBER = '233578065809'
    const WHATSAPP_URL = `https://wa.me/${PHONE_NUMBER}`

    const [isVisible, setIsVisible] = useState(true)
    const [showNote, setShowNote] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    // WhatsApp Logo SVG
    const WhatsAppIcon = () => (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" className="text-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    )

    useEffect(() => {
        // Show professional note after 3 seconds for auth variant
        const timer = setTimeout(() => {
            if (isVisible && variant === 'auth') {
                setShowNote(true)
            }
        }, 3000)

        return () => clearTimeout(timer)
    }, [isVisible, variant])

    if (!isVisible) return null

    // Auth variant - more professional with help text
    if (variant === 'auth') {
        return (
            <div
                className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Professional Help Note */}
                {showNote && (
                    <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-xl max-w-[200px] animate-in slide-in-from-right-5 fade-in duration-300 border border-slate-200 relative">
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setShowNote(false)
                            }}
                            className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 p-1 rounded-full shadow-md border border-slate-100 z-50 flex items-center justify-center h-5 w-5 transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-3 h-3" />
                        </button>
                        <div className="flex items-start gap-2">
                            <HelpCircle className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-semibold text-slate-800">Need help?</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                    Experiencing login issues? Chat with us!
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative transition-all duration-300 hover:scale-105"
                    aria-label="Contact Support on WhatsApp"
                >
                    {/* Glow effect */}
                    <div className="absolute -inset-1.5 bg-[#25D366]/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Main button */}
                    <div className="relative h-12 w-12 rounded-full bg-[#25D366] hover:bg-[#20bd5a] shadow-lg flex items-center justify-center transition-all">
                        <WhatsAppIcon />
                    </div>

                    {/* Pulse ring */}
                    <span className="absolute -inset-0.5 rounded-full border-2 border-[#25D366] opacity-50 animate-ping pointer-events-none" />
                </a>
            </div>
        )
    }

    // Default variant - original floating button
    return (
        <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 group"
        >
            <div className="relative flex items-center justify-center w-14 h-14 bg-[#25D366] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 hover:-translate-y-1">
                <WhatsAppIcon />
                <span className="absolute right-full mr-3 bg-white text-slate-900 px-3 py-1 rounded-lg text-sm font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Chat with us
                </span>
            </div>
            {/* Ping animation effect */}
            <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-30 animate-ping pointer-events-none"></span>
        </a>
    )
}
