'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Download, Share } from 'lucide-react'
import { usePwa } from '@/hooks/use-pwa'

interface ShopPwaInstallPromptProps {
    shopName: string
    shopSlug: string
    logoUrl: string | null
    brandColor: string
}

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getStorageKey(shopSlug: string) {
    return `shop-pwa-dismissed-${shopSlug}`
}

function wasDismissedRecently(shopSlug: string): boolean {
    try {
        const stored = localStorage.getItem(getStorageKey(shopSlug))
        if (!stored) return false
        const ts = parseInt(stored, 10)
        return Date.now() - ts < DISMISS_DURATION_MS
    } catch { return false }
}

function markDismissed(shopSlug: string) {
    try { localStorage.setItem(getStorageKey(shopSlug), String(Date.now())) } catch { /* ignore */ }
}

export default function ShopPwaInstallPrompt({
    shopName,
    shopSlug,
    logoUrl,
    brandColor,
}: ShopPwaInstallPromptProps) {
    const { isInstallable, isInstalled, isIOS, installPwa } = usePwa()
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window === 'undefined') return false
        return wasDismissedRecently(shopSlug)
    })

    const isValidHex = (color: string) => /^#([A-Fa-f0-9]{3}){1,4}$/.test(color)
    const safeBrandColor = isValidHex(brandColor) ? brandColor : '#2563eb'

    const handleInstall = async () => {
        await installPwa()
        markDismissed(shopSlug)
        setDismissed(true)
    }

    const handleDismiss = () => {
        markDismissed(shopSlug)
        setDismissed(true)
    }

    // Don't show if: already installed, dismissed for this shop, or nothing to prompt
    if (isInstalled || dismissed || (!isInstallable && !isIOS)) return null

    const shortName = shopName.length > 16 ? shopName.substring(0, 16).trim() + '…' : shopName

    return (
        <div
            role="dialog"
            aria-label={`Install ${shopName} app`}
            className={`fixed bottom-20 md:bottom-6 right-3 md:right-6 left-auto md:max-w-sm z-50
                       bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/60
                       p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300 max-w-[calc(100vw-1.5rem)]
                       [--shop-brand:${safeBrandColor}]`}
        >
            {/* Shop icon */}
            <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden border border-white/10 bg-[var(--shop-brand)]"
            >
                {logoUrl ? (
                    <Image
                        src={logoUrl}
                        alt={shopName}
                        width={48}
                        height={48}
                        className="w-full h-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                ) : (
                    <span className="text-xl font-black text-white">{shopName[0]?.toUpperCase()}</span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white leading-tight truncate">Install {shortName}</p>

                {isInstallable && (
                    <>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-snug">
                            Add this shop to your home screen for instant access.
                        </p>
                        <button
                            onClick={handleInstall}
                            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg transition-colors text-white shadow-sm bg-[var(--shop-brand)]"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Install App
                        </button>
                    </>
                )}

                {isIOS && (
                    <>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-snug">
                            Tap <Share className="w-3 h-3 inline mx-0.5 text-zinc-300" />
                            <strong className="text-zinc-200"> Share</strong>, then{' '}
                            <strong className="text-zinc-200">Add to Home Screen</strong>.
                        </p>
                    </>
                )}
            </div>

            <button
                onClick={handleDismiss}
                aria-label="Dismiss install prompt"
                className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 p-0.5 mt-0.5"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
