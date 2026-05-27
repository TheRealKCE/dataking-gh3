'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { usePwa } from '@/hooks/use-pwa'
import { toast } from 'sonner'
import { Bell, Share, Plus, X } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const LS_PERM_DENIED  = 'push_perm_denied'  // browser actually denied
const LS_IOS_INSTALL_DISMISSED = 'push_ios_install_dismissed'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function registerSubscription() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) throw new Error('VAPID key missing')
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
        try {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })
        } catch {
            // VAPID key mismatch — rotate subscription
            const old = await registration.pushManager.getSubscription()
            if (old) await old.unsubscribe()
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })
        }
    }
    const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
    })
    if (!res.ok) throw new Error(`Subscribe API ${res.status}`)
}

function isPushSupported() {
    if (typeof window === 'undefined') return false
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

function isPermDenied() {
    try { return localStorage.getItem(LS_PERM_DENIED) === '1' } catch { return false }
}
function setPermDenied() {
    try { localStorage.setItem(LS_PERM_DENIED, '1') } catch {}
}
function isIosInstallDismissed() {
    try { return localStorage.getItem(LS_IOS_INSTALL_DISMISSED) === '1' } catch { return false }
}
function dismissIosInstall() {
    try { localStorage.setItem(LS_IOS_INSTALL_DISMISSED, '1') } catch {}
}

// ─── iOS Install Banner ────────────────────────────────────────────────────────
// iOS still requires this because Apple physically blocks all push notifications
// unless the website is installed to the home screen first.
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

// ─── Main Manager ─────────────────────────────────────────────────────────────
export function PushNotificationManager() {
    const { user } = useAuth()
    const { isIOS, isInstalled } = usePwa()
    const [showIosBanner, setShowIosBanner] = useState(false)
    const subscribed = useRef(false)
    const attemptedAutoPrompt = useRef(false)

    // Helper to auto-trigger the native browser prompt
    const triggerAutomaticPrompt = async () => {
        if (attemptedAutoPrompt.current) return
        attemptedAutoPrompt.current = true

        try {
            const result = await Notification.requestPermission()
            if (result === 'granted') {
                await registerSubscription()
                toast.success('Push notifications enabled!')
            } else if (result === 'denied') {
                setPermDenied()
            }
        } catch {
            // Ignore if browser blocks automatic prompting
        }
    }

    useEffect(() => {
        if (!user) return

        // 1. If already granted, silently re-register
        if (isPushSupported() && Notification.permission === 'granted') {
            if (!subscribed.current) {
                subscribed.current = true
                registerSubscription().catch(() => {})
            }
            return
        }

        // 2. Browser-level permanently denied
        if (isPushSupported() && Notification.permission === 'denied') {
            setPermDenied()
            return
        }

        if (isPermDenied()) return

        // 3. iOS not installed — WE MUST SHOW INSTALL GUIDE
        // Apple does NOT support push notifications in Safari unless installed as a PWA
        if (isIOS && !isInstalled) {
            if (!isIosInstallDismissed()) {
                const t = setTimeout(() => setShowIosBanner(true), 1500)
                return () => clearTimeout(t)
            }
            return
        }

        // 4. Push not supported
        if (!isPushSupported()) return

        // 5. Automagically trigger native permission prompt (No custom banner!)
        // Delay slightly to let the page load so the browser doesn't block it as spam
        const t = setTimeout(() => triggerAutomaticPrompt(), 1500)
        return () => clearTimeout(t)
        
    }, [user, isIOS, isInstalled])

    const handleIosDismiss = () => {
        dismissIosInstall()
        setShowIosBanner(false)
    }

    if (showIosBanner) {
        return <IosInstallBanner onDismiss={handleIosDismiss} />
    }

    return null
}
