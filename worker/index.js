const APP_NAME = 'ARHMS'
const DEFAULT_ICON = '/icon-192x192.png'
// Monochrome silhouette. Android draws this in the status bar and next to the
// app name in the shade — a full-colour icon there renders as a grey blob.
const DEFAULT_BADGE = '/badge-96x96.png'
const DEFAULT_URL = '/dashboard/notifications'
// Short buzz-pause-buzz, the same shape as an incoming SMS.
const VIBRATE_PATTERN = [180, 80, 180]
const MAX_ACTIONS = 2

self.addEventListener('push', (event) => {
    let data = {}
    try {
        data = event.data?.json() ?? {}
    } catch {
        data = { title: APP_NAME, body: event.data?.text() ?? '' }
    }

    // A distinct tag per message keeps notifications stacked in the shade like
    // separate messages. Senders that pass an explicit tag (e.g. one per order)
    // get the opposite: the new one replaces the old instead of piling up.
    const tag = data.tag || (data.notificationId ? `n-${data.notificationId}` : `arhms-${Date.now()}`)

    const actions = Array.isArray(data.actions) && data.actions.length
        ? data.actions.slice(0, MAX_ACTIONS)
        : [
            { action: 'open', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' },
        ]

    const options = {
        body: data.body ?? '',
        icon: data.icon ?? DEFAULT_ICON,
        badge: DEFAULT_BADGE,
        tag,
        // With a tag set, this makes a replacement notification buzz again
        // rather than swapping in silently.
        renotify: true,
        // Without this the shade shows the time the SW woke up, not the time
        // the event happened — noticeable when the phone was asleep.
        timestamp: data.timestamp ?? Date.now(),
        vibrate: data.silent ? [] : VIBRATE_PATTERN,
        silent: data.silent === true,
        requireInteraction: data.requireInteraction === true,
        actions,
        lang: 'en',
        dir: 'ltr',
        data: {
            url: data.url ?? DEFAULT_URL,
            notificationId: data.notificationId ?? null,
        },
    }

    if (data.image) options.image = data.image

    event.waitUntil(
        self.registration.showNotification(data.title ?? APP_NAME, options)
            // Older Android WebViews reject unknown option keys outright; a bare
            // title+body notification still beats no notification at all.
            .catch(() => self.registration.showNotification(data.title ?? APP_NAME, {
                body: options.body,
                icon: options.icon,
                badge: DEFAULT_BADGE,
                data: options.data,
            }))
    )
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    if (event.action === 'dismiss') return

    const { url, notificationId } = event.notification.data ?? {}
    let targetUrl = url ?? DEFAULT_URL

    // Append deep-link params so the app can open the notification panel
    // and highlight the specific notification when the user clicks
    const deepLink = new URL(targetUrl, self.location.origin)
    deepLink.searchParams.set('openNotifications', 'true')
    if (notificationId) deepLink.searchParams.set('highlight', notificationId)
    targetUrl = deepLink.pathname + deepLink.search

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    // App is already open — post a message so it can handle the deep-link
                    // without a full navigation (avoids jarring page reload)
                    client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl, notificationId })
                    return client.focus()
                }
            }
            return self.clients.openWindow(targetUrl)
        })
    )
})

// Push services rotate endpoints on their own schedule. Without this the
// subscription in our DB goes stale and the device silently stops receiving
// anything until the user next opens the app.
self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil((async () => {
        let subscription = event.newSubscription

        if (!subscription) {
            const applicationServerKey = event.oldSubscription?.options?.applicationServerKey
            if (!applicationServerKey) return
            subscription = await self.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
            })
        }

        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(subscription.toJSON()),
        })
    })().catch(() => {}))
})
