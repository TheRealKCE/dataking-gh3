self.addEventListener('push', (event) => {
    let data = {}
    try {
        data = event.data?.json() ?? {}
    } catch {
        data = { title: 'ARHMS', body: event.data?.text() ?? '' }
    }

    event.waitUntil(
        self.registration.showNotification(data.title ?? 'ARHMS', {
            body: data.body ?? '',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: {
                url: data.url ?? '/dashboard/notifications',
                notificationId: data.notificationId ?? null,
            },
        })
    )
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const { url, notificationId } = event.notification.data ?? {}
    let targetUrl = url ?? '/dashboard/notifications'

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
