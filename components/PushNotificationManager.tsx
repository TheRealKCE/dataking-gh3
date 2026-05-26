'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

const PROMPT_DISMISSED_KEY = 'push_prompt_v2'

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function subscribe() {
    const registration = await navigator.serviceWorker.ready
    const key = urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
    let subscription
    try {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    } catch {
        // VAPID key rotation — unsubscribe stale subscription and retry
        const old = await registration.pushManager.getSubscription()
        if (old) await old.unsubscribe()
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    }
    await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
    })
}

function isPushSupported(): boolean {
    if (typeof window === 'undefined') return false
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
    // iOS requires PWA (standalone mode) for push
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIOS) {
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true
        return isStandalone
    }
    return true
}

export function PushNotificationManager() {
    const { user } = useAuth()

    useEffect(() => {
        if (!user) return
        if (!isPushSupported()) return

        const perm = Notification.permission

        if (perm === 'granted') {
            // Silently refresh subscription (handles key rotation + first-time setup)
            subscribe().catch(() => {})
            return
        }

        if (perm === 'denied') return

        // permission === 'default' — show prompt toast once per browser session
        if (sessionStorage.getItem(PROMPT_DISMISSED_KEY)) return

        const timer = setTimeout(() => {
            toast('Get instant notifications', {
                description: 'Enable push alerts for orders and wallet updates.',
                duration: 12000,
                action: {
                    label: 'Enable',
                    onClick: async () => {
                        try {
                            const result = await Notification.requestPermission()
                            if (result === 'granted') {
                                await subscribe()
                                toast.success('Push notifications enabled!')
                            }
                        } catch {
                            // ignore
                        }
                    },
                },
                onDismiss: () => sessionStorage.setItem(PROMPT_DISMISSED_KEY, '1'),
                onAutoClose: () => sessionStorage.setItem(PROMPT_DISMISSED_KEY, '1'),
            })
        }, 3500)

        return () => clearTimeout(timer)
    }, [user])

    return null
}
