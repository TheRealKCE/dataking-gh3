'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { usePwa } from '@/hooks/use-pwa'
import { usePushNotifications, isPushSupported } from '@/hooks/usePushNotifications'
import { toast } from 'sonner'
import { Bell, Share, Plus, X } from 'lucide-react'

const LS_IOS_INSTALL_DISMISSED = 'push_ios_install_dismissed'

function isIosInstallDismissed() {
    try { return localStorage.getItem(LS_IOS_INSTALL_DISMISSED) === '1' } catch { return false }
}
function dismissIosInstall() {
    try { localStorage.setItem(LS_IOS_INSTALL_DISMISSED, '1') } catch {}
}

function IosInstallBanner({ onDismiss }: { onDismiss: () => void }) {
    return (
        <div className="fixed bottom-20 left-0 right-0 z-50 px-3 pb-1 md:bottom-4 md:left-auto md:right-4 md:max-w-sm animate-in slide-in-from-bottom-4 duration-300">
            <div className="relative rounded-2xl border border-amber-400/40 bg-amber-950/90 backdrop-blur-lg shadow-2xl p-4 text-white overflow-hidden">
                <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500 rounded-t-2xl" />
                <button onClick={onDismiss} className="absolute top-3 right-3 text-amber-300/70 hover:text-white transition-colors" aria-label="Dismiss">
                    <X className="w-4 h-4" />
                </button>
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bell className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-amber-100">Install app for instant alerts</p>
                        <p className="text-xs text-amber-200/70 mt-0.5 leading-snug">
                            To get push notifications on iPhone, install this app first.
                        </p>
                    </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-amber-100/80">
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center text-amber-300 font-bold flex-shrink-0 text-[10px]">1</span>
                        <span>Tap the <Share className="w-3 h-3 inline mx-0.5 text-amber-300" /> <strong>Share</strong> button at the bottom of Safari</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center text-amber-300 font-bold flex-shrink-0 text-[10px]">2</span>
                        <span>Scroll down and tap <Plus className="w-3 h-3 inline mx-0.5 text-amber-300" /> <strong>Add to Home Screen</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center text-amber-300 font-bold flex-shrink-0 text-[10px]">3</span>
                        <span>Open the app from your home screen — notifications will be ready!</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function PushNotificationManager() {
    const { user } = useAuth()
    const { isIOS, isInstalled } = usePwa()
    const [showIosBanner, setShowIosBanner] = useState(false)
    const attemptedAutoPrompt = useRef(false)

    const { isPermDenied, requestPermission } = usePushNotifications({ userId: user?.id })

    useEffect(() => {
        if (!user) return

        // Already granted — hook handles re-subscription silently
        if (isPushSupported() && Notification.permission === 'granted') return

        // Browser-level permanently denied
        if (isPushSupported() && Notification.permission === 'denied') return

        if (isPermDenied) return

        // iOS not installed — Apple blocks push unless installed as PWA
        if (isIOS && !isInstalled) {
            if (!isIosInstallDismissed()) {
                const t = setTimeout(() => setShowIosBanner(true), 1500)
                return () => clearTimeout(t)
            }
            return
        }

        if (!isPushSupported()) return

        // Auto-trigger native permission prompt with a short delay
        const t = setTimeout(async () => {
            if (attemptedAutoPrompt.current) return
            attemptedAutoPrompt.current = true

            const result = await requestPermission()
            if (result === 'granted') {
                toast.success('Push notifications enabled!')
            }
        }, 1500)

        return () => clearTimeout(t)
    }, [user, isIOS, isInstalled, isPermDenied, requestPermission])

    const handleIosDismiss = () => {
        dismissIosInstall()
        setShowIosBanner(false)
    }

    if (showIosBanner) {
        return <IosInstallBanner onDismiss={handleIosDismiss} />
    }

    return null
}
