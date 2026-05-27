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
            data: { url: data.url ?? '/dashboard/notifications' },
        })
    )
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = event.notification.data?.url ?? '/dashboard/notifications'
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.navigate(url)
                    return client.focus()
                }
            }
            return self.clients.openWindow(url)
        })
    )
})
