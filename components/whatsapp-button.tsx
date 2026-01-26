'use client'

import React from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from './ui/button'

export function WhatsAppButton() {
    const PHONE_NUMBER = '233578065809'
    const WHATSAPP_URL = `https://wa.me/${PHONE_NUMBER}`

    return (
        <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in duration-300"
            aria-label="Contact Support on WhatsApp"
        >
            <div className="relative group">
                <span className="absolute -top-12 right-0 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs px-3 py-1 rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                    Chat with Support
                </span>
                <Button
                    size="icon"
                    className="h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#20bd5a] shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] border-none transition-all duration-300 hover:scale-110"
                >
                    <MessageCircle className="h-8 w-8 text-white fill-white" />
                </Button>
                {/* Ping animation ping ring */}
                <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-75 animate-ping -z-10 group-hover:hidden"></span>
            </div>
        </a>
    )
}
