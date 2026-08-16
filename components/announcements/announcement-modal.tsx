'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AlertTriangle, ArrowRight, Megaphone, MessagesSquare, Store, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTone, type AnnouncementTone } from '@/lib/announcement-tones'

const TONE_ICONS: Record<AnnouncementTone, React.ComponentType<{ className?: string }>> = {
    official: Megaphone,
    shop: Store,
    success: Sparkles,
    alert: AlertTriangle,
}

interface AnnouncementModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Drives every colour in the card. See lib/announcement-tones.ts. */
    tone?: AnnouncementTone
    /** Overrides the tone's default badge copy. */
    badgeLabel?: string
    title?: string | null
    message?: string | null
    /** Optional WhatsApp / community link shown as the secondary action. */
    communityLink?: string | null
    dismissLabel?: string
    /** Fires on the primary button, the X, Esc and the backdrop alike. */
    onDismiss?: () => void
}

export function AnnouncementModal({
    open,
    onOpenChange,
    tone = 'official',
    badgeLabel,
    title,
    message,
    communityLink,
    dismissLabel = 'Got it, thanks',
    onDismiss,
}: AnnouncementModalProps) {
    const t = getTone(tone)
    const Icon = TONE_ICONS[tone] ?? Megaphone

    const close = () => {
        onDismiss?.()
        onOpenChange(false)
    }

    return (
        <DialogPrimitive.Root
            open={open}
            onOpenChange={(next) => {
                if (!next) close()
                else onOpenChange(true)
            }}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-gray-950/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                <DialogPrimitive.Content
                    className={cn(
                        'fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-[26rem] -translate-x-1/2 -translate-y-1/2',
                        'overflow-hidden rounded-[28px] border border-gray-200/80 dark:border-white/10',
                        'bg-white dark:bg-[#0f1524] shadow-[0_40px_90px_-30px_rgba(2,6,23,0.6)]',
                        'duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                        'data-[state=open]:slide-in-from-bottom-4',
                    )}
                >
                    {/* Tone hairline — the first thing the eye reads as "which kind of notice is this". */}
                    <div className={cn('h-1 w-full', t.bar)} />

                    {/* ── Header: wash + orbs, icon on the left, badge and title stacked beside it ── */}
                    <div className="relative overflow-hidden px-5 pb-5 pt-6 sm:px-6">
                        <div className={cn('pointer-events-none absolute inset-0', t.wash)} />
                        <div className={cn('pointer-events-none absolute -left-10 -top-14 h-32 w-32 rounded-full blur-3xl', t.orbA)} />
                        <div className={cn('pointer-events-none absolute -right-8 -top-6 h-24 w-24 rounded-full blur-2xl', t.orbB)} />

                        <DialogPrimitive.Close
                            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900/5 text-gray-500 transition-colors hover:bg-gray-900/10 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                            aria-label="Close announcement"
                        >
                            <X className="h-4 w-4" />
                        </DialogPrimitive.Close>

                        <div className="relative z-[1] flex items-start gap-4 pr-8">
                            <div className="relative shrink-0">
                                <span className={cn('absolute inset-0 animate-ping rounded-2xl opacity-60', t.halo)} style={{ animationDuration: '2.6s' }} />
                                <div className={cn('relative flex h-14 w-14 items-center justify-center rounded-2xl', t.tile)}>
                                    <Icon className="h-7 w-7 text-white" />
                                </div>
                            </div>

                            <div className="min-w-0 flex-1 pt-0.5">
                                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', t.badge)}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
                                    {badgeLabel || t.label}
                                </span>
                                <DialogPrimitive.Title className="mt-2 text-lg font-black leading-tight tracking-tight text-gray-900 dark:text-white sm:text-xl">
                                    {title || 'Important Update'}
                                </DialogPrimitive.Title>
                            </div>
                        </div>
                    </div>

                    {/* ── Message: spine-marked panel, scrolls on its own with a fade at the seam ── */}
                    <div className="px-5 sm:px-6">
                        <div className={cn('relative overflow-hidden rounded-2xl', t.panel)}>
                            <div className={cn('absolute inset-y-0 left-0 w-1', t.spine)} />
                            <div className="announcement-scroll max-h-[42vh] overflow-y-auto py-4 pl-5 pr-4">
                                <DialogPrimitive.Description className="whitespace-pre-wrap break-words text-[13.5px] font-medium leading-relaxed text-gray-600 dark:text-gray-300 sm:text-sm">
                                    {message}
                                </DialogPrimitive.Description>
                            </div>
                        </div>
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex flex-col gap-2.5 p-5 sm:p-6">
                        <button
                            type="button"
                            onClick={close}
                            className={cn(
                                'group flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black tracking-wide transition-all active:scale-[0.98]',
                                t.cta,
                            )}
                        >
                            {dismissLabel}
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </button>

                        {communityLink && (
                            <a
                                href={communityLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-[13px] font-bold text-gray-600 transition-colors hover:border-[#25D366]/40 hover:bg-[#25D366]/5 hover:text-[#128C7E] dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-[#25D366]/40 dark:hover:text-[#25D366]"
                            >
                                <MessagesSquare className="h-4 w-4" />
                                Join our community
                            </a>
                        )}
                    </div>

                    <style jsx global>{`
                        .announcement-scroll::-webkit-scrollbar {
                            width: 4px;
                        }
                        .announcement-scroll::-webkit-scrollbar-track {
                            background: transparent;
                        }
                        .announcement-scroll::-webkit-scrollbar-thumb {
                            background: rgba(148, 163, 184, 0.35);
                            border-radius: 999px;
                        }
                    `}</style>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
