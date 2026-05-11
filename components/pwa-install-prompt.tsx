'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'arhms-pwa-install-dismissed'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isIOS() {
    if (typeof navigator === 'undefined') return false
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in window.navigator && (window.navigator as any).standalone === true)
}

function wasDismissedRecently(): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return false
        const ts = parseInt(stored, 10)
        return Date.now() - ts < DISMISS_DURATION_MS
    } catch { return false }
}

function markDismissed() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch { /* ignore */ }
}

export default function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [showAndroid, setShowAndroid] = useState(false)
    const [showIOS, setShowIOS] = useState(false)

    useEffect(() => {
        // Already installed — don't show
        if (isInStandaloneMode()) return
        // Dismissed recently — don't show
        if (wasDismissedRecently()) return

        if (isIOS()) {
            // iOS: show share-sheet instructions
            setShowIOS(true)
            return
        }

        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setShowAndroid(true)
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted' || outcome === 'dismissed') {
            markDismissed()
            setShowAndroid(false)
        }
    }

    const handleDismiss = () => {
        markDismissed()
        setShowAndroid(false)
        setShowIOS(false)
    }

    if (!showAndroid && !showIOS) return null

    return (
        <div
            role="dialog"
            aria-label="Install ARHMS app"
            className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:max-w-sm z-50
                       bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/60
                       p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300"
        >
            {/* App icon */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon-192x192.png" alt="ARHMS" className="w-8 h-8 rounded-lg object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">Install ARHMS</p>

                {showAndroid && (
                    <>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-snug">
                            Add to your home screen for the full app experience.
                        </p>
                        <button
                            onClick={handleInstall}
                            className="mt-2.5 inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400
                                       text-black text-xs font-black px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Install App
                        </button>
                    </>
                )}

                {showIOS && (
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
