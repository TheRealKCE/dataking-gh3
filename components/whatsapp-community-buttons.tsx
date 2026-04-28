'use client'

import React, { useEffect, useState } from 'react'
import { MessagesSquare, Tv } from 'lucide-react'
import { cn } from '@/lib/utils'

export function WhatsAppCommunityButtons({
    className,
    compact = false,
    groupLink = '',
    channelLink = '',
}: {
    className?: string
    compact?: boolean
    groupLink?: string
    channelLink?: string
}) {
    const [links, setLinks] = useState({
        group: groupLink,
        channel: channelLink
    })

    useEffect(() => {
        if (groupLink || channelLink) {
            setLinks({ group: groupLink, channel: channelLink })
            return
        }

        fetch('/api/public/config').then(response => response.ok ? response.json() : null).then(data => {
            if (data) {
                setLinks({
                    group: data.whatsappGroupLink || "",
                    channel: data.whatsappChannelLink || ""
                })
            }
        }).catch(console.error)
    }, [groupLink, channelLink])

    if (!links.group && !links.channel) return null

    // WhatsApp SVG Icon
    const WhatsAppIcon = ({ className: iconClass }: { className?: string }) => (
        <svg viewBox="0 0 24 24" className={`fill-current ${iconClass}`} xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    )

    // Compact version for auth pages - side by side buttons
    if (compact) {
        return (
            <div className={`w-full ${className}`}>
                <p className="text-xs font-medium text-slate-500 text-center mb-2">Join Our Community</p>
                <div className={cn(
                    "grid gap-2",
                    links.group && links.channel ? "grid-cols-2" : "grid-cols-1"
                )}>
                    {links.group && (
                        <a
                            href={links.group}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366] hover:border-[#25D366] transition-all duration-300"
                        >
                            <div className="flex items-center gap-1.5">
                                <WhatsAppIcon className="w-4 h-4 text-[#25D366] group-hover:text-white transition-colors" />
                                <MessagesSquare className="w-3 h-3 text-[#25D366] group-hover:text-white transition-colors" />
                            </div>
                            <span className="text-xs font-semibold text-[#25D366] group-hover:text-white transition-colors">Group</span>
                        </a>
                    )}
                    {links.channel && (
                        <a
                            href={links.channel}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366] hover:border-[#25D366] transition-all duration-300"
                        >
                            <div className="flex items-center gap-1.5">
                                <WhatsAppIcon className="w-4 h-4 text-[#25D366] group-hover:text-white transition-colors" />
                                <Tv className="w-3 h-3 text-[#25D366] group-hover:text-white transition-colors" />
                            </div>
                            <span className="text-xs font-semibold text-[#25D366] group-hover:text-white transition-colors">Channel</span>
                        </a>
                    )}
                </div>
            </div>
        )
    }

    // Full version for dashboard/home pages
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mx-auto ${className}`}>
            <div className="text-center mb-2 col-span-full">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Join Our Community</h3>
            </div>

            {
                [
                    links.group ? {
                        title: "Join WhatsApp Group",
                        subtitle: "Connect with the community",
                        link: links.group,
                        icon: <MessagesSquare className="w-5 h-5" />
                    } : null,
                    links.channel ? {
                        title: "Join WhatsApp Channel",
                        subtitle: "Get latest updates & news",
                        link: links.channel,
                        icon: <Tv className="w-5 h-5" />
                    } : null
                ].filter(Boolean).map((item: any, index) => (
                    <a
                        key={index}
                        href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full group"
                >
                    <div className="relative overflow-hidden rounded-xl border border-[#25D366]/20 bg-gradient-to-r from-[#25D366]/5 to-transparent p-[1px] transition-all duration-300 hover:border-[#25D366]/50 hover:shadow-[0_4px_20px_-12px_rgba(37,211,102,0.5)] hover:-translate-y-0.5">
                        <div className="relative flex items-center gap-4 rounded-[11px] bg-background/50 p-3 backdrop-blur-sm transition-all group-hover:bg-background/80">
                            {/* Icon Container */}
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] ring-1 ring-[#25D366]/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-[#25D366] group-hover:text-white group-hover:ring-offset-2">
                                <WhatsAppIcon className="w-5 h-5" />
                                <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
                                    {item.icon}
                                </div>
                            </div>

                            {/* Text Content */}
                            <div className="flex-1">
                                <h4 className="font-semibold text-sm leading-none text-foreground group-hover:text-[#128C7E] dark:group-hover:text-[#25D366] transition-colors">{item.title}</h4>
                                <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">{item.subtitle}</p>
                            </div>

                            {/* Chevron */}
                            <div className="text-muted-foreground/30 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[#25D366]">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                            </div>
                        </div>
                    </div>
                </a>
            ))}
        </div>
    )
}
