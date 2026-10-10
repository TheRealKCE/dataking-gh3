'use client'

import { useEffect, useRef } from 'react'

const LS_PERM_DENIED = 'push_perm_denied'

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array) {
    if (!a) return false
    const av = new Uint8Array(a)
    return av.length === b.length && av.every((v, i) => v === b[i])
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(message)), ms)
        promise.then(
            (v) => { clearTimeout(t); resolve(v) },
            (e) => { clearTimeout(t); reject(e) },
        )
    })
}

// `navigator.serviceWorker.ready` never settles when no worker is registered for
// the page, and on a first install it waits for the whole precache to download.
// Awaiting it bare left the Enable button stuck on "Enabling…" forever, so
// register the worker if it is missing and give up with a real error instead.
export async function getActiveRegistration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing?.active) return existing
    if (!existing) await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return withTimeout(navigator.serviceWorker.ready, 30000, 'App is still installing, try again in a moment')
}

async function getOrCreateSubscription(): Promise<PushSubscription> {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) throw new Error('VAPID key missing')

    const registration = await getActiveRegistration()
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
        // A subscription made under an old VAPID key is rejected by the push
        // service forever, so reusing it would never heal after a key rotation.
        if (sameKey(existing.options.applicationServerKey, urlBase64ToUint8Array(vapidKey))) {
            return existing
        }
        await existing.unsubscribe().catch(() => {})
        return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
    }

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

    // 'granted' only once the device is subscribed AND saved; 'failed' means the
    // user allowed it but push setup broke (reason in `error`).
    async function requestPermission(): Promise<{ result: NotificationPermission | 'failed'; error?: string }> {
        if (!isPushSupported()) return { result: 'default' }

        let result: NotificationPermission
        try {
            result = await Notification.requestPermission()
        } catch {
            return { result: 'default' }
        }

        if (result === 'granted') {
            clearPermDenied()
            try {
                const sub = await withTimeout(getOrCreateSubscription(), 45000, 'Push setup timed out')
                await withTimeout(saveSubscription(sub), 15000, 'Saving timed out')
                subscribed.current = true
            } catch (err) {
                const error = err instanceof Error ? err.message : String(err)
                console.error('[Push] Enable failed:', error)
                return { result: 'failed', error }
            }
        } else if (result === 'denied') {
            setPermDenied()
        }

        return { result }
    }

    return {
        isPermDenied: getPermDenied(),
        requestPermission,
    }
}
