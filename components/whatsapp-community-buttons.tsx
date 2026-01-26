'use client'

import React from 'react'
import { MessagesSquare, Tv } from 'lucide-react'
import { Button } from './ui/button'

export function WhatsAppCommunityButtons({ className }: { className?: string }) {
    const GROUP_LINK = "https://chat.whatsapp.com/FC6jYV3VDEQ4MmdTXiFqDV?mode=gi_t"
    const CHANNEL_LINK = "https://whatsapp.com/channel/0029Vb7HTfx47XeIZz7ht232"

    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 w-full ${className}`}>
            <a
                href={GROUP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full group"
            >
                <Button
                    variant="outline"
                    className="w-full h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-br from-[#25D366]/5 to-[#128C7E]/5 hover:from-[#25D366]/10 hover:to-[#128C7E]/10 border-[#25D366]/30 hover:border-[#25D366] transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(37,211,102,0.15)] group-hover:-translate-y-1"
                >
                    <div className="p-2 rounded-full bg-[#25D366]/10 group-hover:bg-[#25D366] transition-colors duration-300">
                        <MessagesSquare className="w-5 h-5 text-[#25D366] group-hover:text-white transition-colors duration-300" />
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-[#128C7E] dark:text-[#25D366]">Join WhatsApp Group</span>
                        <span className="text-xs text-muted-foreground group-hover:text-foreground/80">Connect with community</span>
                    </div>
                </Button>
            </a>

            <a
                href={CHANNEL_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full group"
            >
                <Button
                    variant="outline"
                    className="w-full h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-br from-[#25D366]/5 to-[#128C7E]/5 hover:from-[#25D366]/10 hover:to-[#128C7E]/10 border-[#25D366]/30 hover:border-[#25D366] transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(37,211,102,0.15)] group-hover:-translate-y-1"
                >
                    <div className="p-2 rounded-full bg-[#25D366]/10 group-hover:bg-[#25D366] transition-colors duration-300">
                        <Tv className="w-5 h-5 text-[#25D366] group-hover:text-white transition-colors duration-300" />
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-[#128C7E] dark:text-[#25D366]">Join WhatsApp Channel</span>
                        <span className="text-xs text-muted-foreground group-hover:text-foreground/80">Get latest updates</span>
                    </div>
                </Button>
            </a>
        </div>
    )
}
