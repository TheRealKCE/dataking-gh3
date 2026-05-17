'use client'

import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface UsePwaReturn {
    isInstallable: boolean
    isInstalled: boolean
    isIOS: boolean
    installPwa: () => Promise<void>
}

export function usePwa(): UsePwaReturn {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [isInstalled, setIsInstalled] = useState(false)
    const [isIOS, setIsIOS] = useState(false)

    useEffect(() => {
        // Detect iOS
        if (typeof navigator !== 'undefined') {
            setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent))
        }

        // Detect standalone mode (already installed)
        const checkInstalled = () => {
            const standalone =
                window.matchMedia('(display-mode: standalone)').matches ||
                ('standalone' in window.navigator && (window.navigator as any).standalone === true)
            setIsInstalled(standalone)
        }
        checkInstalled()

        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
        }

        window.addEventListener('beforeinstallprompt', handler)

        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const installPwa = useCallback(async () => {
        if (!deferredPrompt) return
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted' || outcome === 'dismissed') {
            setDeferredPrompt(null)
        }
    }, [deferredPrompt])

    return {
        isInstallable: !!deferredPrompt,
        isInstalled,
        isIOS,
        installPwa,
    }
}
