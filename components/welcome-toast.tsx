'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTone, type AnnouncementTone } from '@/lib/announcement-tones'

interface WelcomeToastOptions {
    /** First name, when we know it: "Welcome back, Derrick". */
    name?: string | null
    /** Small eyebrow above the greeting — the platform or the shop. */
    brand?: string
    /** Overrides the generated greeting entirely. */
    title?: string
    subtitle?: string
    /** Same badge tones the announcements use. */
    tone?: AnnouncementTone
    duration?: number
}

function WelcomeToastCard({
    name,
    brand = 'ARHMS',
    title,
    subtitle = 'You are signed in — taking you to your dashboard',
    tone = 'success',
    duration = 4200,
    onClose,
}: WelcomeToastOptions & { onClose: () => void }) {
    const t = getTone(tone)
    const greeting = title || (name ? `Welcome back, ${name}` : 'Welcome back!')
    const initial = (name || brand).trim().charAt(0).toUpperCase()

    return (
        <div className="relative w-[min(92vw,25rem)] overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_24px_50px_-20px_rgba(2,6,23,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1524]/95">
            {/* Tone hairline, same language as the announcement card */}
            <div className={cn('h-1 w-full', t.bar)} />

            <div className={cn('pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl', t.orbA)} />

            <div className="relative flex items-center gap-3 px-3.5 py-3">
                {/* Monogram tile with a confirmation pip — no big green block, just a mark */}
                <div className="relative shrink-0">
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl text-base font-black text-white', t.tile)}>
                        {initial}
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0f1524]">
                        <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                    </span>
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                        {brand}
                    </p>
                    <p className="mt-0.5 truncate text-[15px] font-black leading-tight tracking-tight text-gray-900 dark:text-white">
                        {greeting}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        {subtitle}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Dismiss"
                    className="shrink-0 self-start rounded-full p-1 text-gray-300 transition-colors hover:bg-gray-900/5 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Time remaining, drawn as a hairline rather than a filled bar */}
            <div className="h-0.5 w-full bg-gray-100 dark:bg-white/5">
                <div
                    className={cn('welcome-toast-progress h-full', t.progress)}
                    style={{ animationDuration: `${duration}ms` }}
                />
            </div>

            <style jsx global>{`
                @keyframes welcome-toast-drain {
                    from {
                        transform: scaleX(1);
                    }
                    to {
                        transform: scaleX(0);
                    }
                }
                .welcome-toast-progress {
                    transform-origin: left;
                    animation-name: welcome-toast-drain;
                    animation-timing-function: linear;
                    animation-fill-mode: forwards;
                }
                @media (prefers-reduced-motion: reduce) {
                    .welcome-toast-progress {
                        animation: none;
                    }
                }
            `}</style>
        </div>
    )
}

/**
 * Branded sign-in confirmation. Replaces `toast.success('Welcome back!')` so the
 * greeting carries the same badge tone the announcements do.
 */
export function showWelcomeToast(options: WelcomeToastOptions = {}) {
    const duration = options.duration ?? 4200

    toast.custom(
        (id) => <WelcomeToastCard {...options} duration={duration} onClose={() => toast.dismiss(id)} />,
        { duration, position: 'top-center' },
    )
}
