'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'

export function WhatsAppButton() {
    const PHONE_NUMBER = '233578065809'
    const WHATSAPP_URL = `https://wa.me/${PHONE_NUMBER}`

    const [isVisible, setIsVisible] = useState(true)
    const [showNote, setShowNote] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    // WhatsApp Logo SVG
    const WhatsAppIcon = () => (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" className="text-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    )

    useEffect(() => {
        // Show professional note after 5 seconds and keep it
        const timer = setTimeout(() => {
            if (isVisible) {
                setShowNote(true)
            }
        }, 5000)

        // Cleanup timer on unmount or if visibility changes
        return () => clearTimeout(timer)
    }, [isVisible])

    if (!isVisible) return null

    return (
        <div
            className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Professional Note Popover */}
            {showNote && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-xl mb-2 max-w-[250px] animate-in slide-in-from-right-10 fade-in duration-300 border border-slate-100 dark:border-slate-700 relative">
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsVisible(false)
                        }}
                        className="absolute -top-3 -right-3 bg-white dark:bg-slate-700 text-slate-500 hover:text-red-500 p-2 rounded-full shadow-md border border-slate-100 dark:border-slate-600 z-50 flex items-center justify-center h-8 w-8 transition-colors"
                        aria-label="Close Whatsapp Support"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        Hello! 👋
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Need any assistance with your orders? Chat with us directly on WhatsApp!
                    </p>
                </div>
            )}

            <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-110"
                aria-label="Contact Support on WhatsApp"
            >
                <div className="absolute -inset-2 bg-green-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                <Button
                    size="icon"
                    className="h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#20bd5a] shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] border-none relative z-10"
                >
                    <WhatsAppIcon />
                </Button>

                {/* Status Dot */}
                <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 border-2 border-white dark:border-slate-900 z-20">
                    <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75"></span>
                </span>
            </a>
        </div>
    )
}
