'use client'

import React, { useState, useEffect } from 'react'
import { X, HelpCircle, MessageCircle } from 'lucide-react'

interface FloatingWhatsAppProps {
    variant?: 'default' | 'auth'
    phoneNumber?: string
}

// Pre-filled complaint/support message for users
const COMPLAINT_MESSAGE = encodeURIComponent(
    'Hi ARHMS Support 👋\n\nI need help with the following issue:\n\n[Describe your complaint or question here]\n\nAccount details:\nName: \nPhone: '
)

function buildWhatsAppUrl(phone: string): string {
    const cleaned = phone.replace(/\D/g, '')
    return `https://wa.me/${cleaned}?text=${COMPLAINT_MESSAGE}`
}

const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" className="text-white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
)

export function FloatingWhatsApp({ variant = 'default', phoneNumber: initialPhoneNumber = '' }: FloatingWhatsAppProps) {
    const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber)
    const [isVisible, setIsVisible] = useState(true)
    const [showNote, setShowNote] = useState(false)
    const [displayText, setDisplayText] = useState('')
    const [isTypingDone, setIsTypingDone] = useState(false)

    const POPUP_MESSAGE = 'Got a complaint or need help with your account? Tap below to chat with our admin on WhatsApp — we respond fast! 💬'

    // Fetch admin phone number from public config if not passed as prop
    useEffect(() => {
        if (initialPhoneNumber) return
        fetch('/api/public/config')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.whatsappAdminNumber) setPhoneNumber(data.whatsappAdminNumber)
            })
            .catch(() => { /* fail silently */ })
    }, [initialPhoneNumber])

    // Typing animation for the popup note
    useEffect(() => {
        if (!showNote) return
        setDisplayText('')
        setIsTypingDone(false)
        let i = 0
        const timer = setInterval(() => {
            setDisplayText(POPUP_MESSAGE.substring(0, i + 1))
            i++
            if (i >= POPUP_MESSAGE.length) {
                clearInterval(timer)
                setIsTypingDone(true)
            }
        }, 22)
        return () => clearInterval(timer)
    }, [showNote])

    // Auto-show popup after 4s (auth/dashboard variant only)
    useEffect(() => {
        if (variant !== 'auth') return
        const timer = setTimeout(() => { if (isVisible) setShowNote(true) }, 4000)
        return () => clearTimeout(timer)
    }, [isVisible, variant])

    if (!isVisible || !phoneNumber) return null

    const waUrl = buildWhatsAppUrl(phoneNumber)

    // ── AUTH / DASHBOARD variant ──────────────────────────────────────────────
    if (variant === 'auth') {
        return (
            <div
                className={[
                    // Positioned bottom-LEFT on mobile to avoid conflicting with the PWA install
                    // prompt (bottom-right) and the bottom nav bar.
                    // On md+ screens we move it back to bottom-right like before.
                    'fixed z-50 flex flex-col items-start gap-2',
                    'bottom-5 left-3',
                    'md:bottom-6 md:left-auto md:right-5 md:items-end',
                ].join(' ')}
            >
                {/* Popup card */}
                {showNote && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl w-[min(270px,calc(100vw-3.5rem))] animate-in slide-in-from-bottom-4 fade-in duration-500 border border-emerald-100 dark:border-emerald-900/40 relative overflow-hidden">
                        {/* Top accent bar */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#25D366] to-[#128C7E]" />

                        {/* Close button */}
                        <button
                            onClick={e => { e.stopPropagation(); setShowNote(false) }}
                            className="absolute top-2 right-2 bg-slate-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 p-1 rounded-full border border-slate-200 dark:border-zinc-700 h-6 w-6 flex items-center justify-center transition-all hover:rotate-90"
                            aria-label="Close"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-start gap-3">
                            <div className="bg-[#25D366]/10 p-2 rounded-xl shrink-0">
                                <HelpCircle className="w-5 h-5 text-[#25D366] animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    Support &amp; Complaints
                                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-ping" />
                                </p>
                                <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1.5 leading-relaxed font-medium min-h-[52px]">
                                    {displayText}
                                    {!isTypingDone && <span className="inline-block w-1 h-3 bg-[#25D366] ml-0.5 animate-pulse align-middle" />}
                                </div>
                            </div>
                        </div>

                        {isTypingDone && (
                            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">We reply within minutes</span>
                                <span className="text-[10px] text-[#25D366] font-bold animate-bounce">Tap below →</span>
                            </div>
                        )}
                    </div>
                )}

                {/* WhatsApp button */}
                <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Contact Support or File a Complaint on WhatsApp"
                    className="group relative flex items-center justify-center w-14 h-14 transition-all duration-300 hover:scale-110 active:scale-95"
                    onClick={() => setShowNote(false)}
                >
                    {/* Glow */}
                    <div className="absolute -inset-2 bg-gradient-to-tr from-[#25D366] to-[#128C7E] rounded-full blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                    {/* Button */}
                    <div className="relative h-full w-full rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-[0_6px_24px_rgb(37,211,102,0.45)] flex items-center justify-center ring-4 ring-white/10 group-hover:ring-white/30 transition-all duration-300">
                        <WhatsAppIcon />
                    </div>
                    {/* Pulse rings */}
                    <span className="absolute -inset-1 rounded-full border-2 border-[#25D366] opacity-30 animate-ping pointer-events-none" />
                    <span className="absolute -inset-2 rounded-full border-2 border-[#25D366]/30 animate-pulse pointer-events-none" />

                    {/* Tooltip label (shown when popup is dismissed) */}
                    {!showNote && (
                        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            Support &amp; Complaints
                        </span>
                    )}
                </a>
            </div>
        )
    }

    // ── DEFAULT variant (landing / shop pages) ────────────────────────────────
    return (
        <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact Support on WhatsApp"
            className="fixed bottom-6 right-6 z-50 group flex items-center justify-center"
        >
            <div className="absolute -inset-4 rounded-full pointer-events-none" />
            <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-full shadow-[0_8px_30px_rgb(37,211,102,0.4)] hover:shadow-[0_12px_40px_rgb(37,211,102,0.6)] transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1 ring-4 ring-white/10 group-hover:ring-white/30">
                <WhatsAppIcon />
                <span className="absolute right-full mr-4 bg-white/95 backdrop-blur-sm text-slate-900 px-4 py-2 rounded-xl text-sm font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 whitespace-nowrap pointer-events-none border border-emerald-100">
                    Support &amp; Complaints
                </span>
            </div>
            <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-30 animate-ping pointer-events-none" />
            <span className="absolute -inset-2 rounded-full border-2 border-[#25D366]/20 animate-pulse pointer-events-none" />
        </a>
    )
}
