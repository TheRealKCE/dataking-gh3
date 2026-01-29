'use client'

import { MessagesSquare } from 'lucide-react'

export function FloatingWhatsApp() {
    const WHATSAPP_LINK = "https://wa.me/233241234567" // Keeping placeholder strictly, user can update

    return (
        <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 group"
        >
            <div className="relative flex items-center justify-center w-14 h-14 bg-[#25D366] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 hover:-translate-y-1">
                <MessagesSquare className="w-8 h-8 text-white fill-white" />
                <span className="absolute right-full mr-3 bg-white text-slate-900 px-3 py-1 rounded-lg text-sm font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Chat with us
                </span>
            </div>
            {/* Ping animation effect */}
            <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-30 animate-ping pointer-events-none"></span>
        </a>
    )
}
