'use client'

import { useEffect, useRef } from 'react'

const LS_PERM_DENIED = 'push_perm_denied'

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function getOrCreateSubscription(): Promise<PushSubscription> {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) throw new Error('VAPID key missing')

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing) return existing

    try {
        return await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
    } catch {
        // VAPID key mismatch — rotate subscription
        const stale = await registration.pushManager.getSubscription()
        if (stale) await stale.unsubscribe()
        return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
    }
}

async function saveSubscription(sub: PushSubscription) {
    const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
    })
    if (!res.ok) throw new Error(`Subscribe API ${res.status}`)
}

async function deleteSubscription(endpoint: string) {
    await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
    })
}

export function isPushSupported() {
    if (typeof window === 'undefined') return false
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

function getPermDenied() {
    try { return localStorage.getItem(LS_PERM_DENIED) === '1' } catch { return false }
}

function setPermDenied() {
    try { localStorage.setItem(LS_PERM_DENIED, '1') } catch {}
}

function clearPermDenied() {
    try { localStorage.removeItem(LS_PERM_DENIED) } catch {}
}

export interface UsePushNotificationsOptions {
    userId: string | undefined
}

export function usePushNotifications({ userId }: UsePushNotificationsOptions) {
    const subscribed = useRef(false)

    // Re-subscribe on mount if permission already granted
    useEffect(() => {
        if (!userId || !isPushSupported()) return
        if (Notification.permission !== 'granted') return
        if (subscribed.current) return

        subscribed.current = true
        getOrCreateSubscription()
            .then(saveSubscription)
            .catch(() => {
                subscribed.current = false
            })
    }, [userId])

    // Listen for permission state changes (handles revocation)
    useEffect(() => {
        if (!isPushSupported()) return
        if (!('permissions' in navigator)) return

        let descriptor: PermissionStatus | null = null

        navigator.permissions.query({ name: 'notifications' as PermissionName }).then((status) => {
            descriptor = status

            status.addEventListener('change', async () => {
                if (status.state === 'denied' || status.state === 'prompt') {
                    setPermDenied()
                    subscribed.current = false

                    // Remove the subscription from the browser and our DB
                    try {
                        const registration = await navigator.serviceWorker.ready
                        const sub = await registration.pushManager.getSubscription()
                        if (sub) {
                            await deleteSubscription(sub.endpoint)
                            await sub.unsubscribe()
                        }
                    } catch {
                        // Best-effort cleanup — don't throw
                    }
                } else if (status.state === 'granted') {
                    clearPermDenied()
                }
            })
        }).catch(() => {})

        return () => {
            descriptor?.removeEventListener('change', () => {})
        }
    }, [])

    async function requestPermission(): Promise<'granted' | 'denied' | 'default'> {
        if (!isPushSupported()) return 'default'

        let result: NotificationPermission
        try {
            result = await Notification.requestPermission()
        } catch {
            return 'default'
        }

        if (result === 'granted') {
            clearPermDenied()
            try {
                const sub = await getOrCreateSubscription()
                await saveSubscription(sub)
                subscribed.current = true
            } catch {
                // Subscription failed — permission was granted but push setup failed
            }
        } else if (result === 'denied') {
            setPermDenied()
        }

        return result
    }

    return {
        isPermDenied: getPermDenied(),
        requestPermission,
    }
}
