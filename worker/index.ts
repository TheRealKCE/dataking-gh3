/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

self.addEventListener('push', (event) => {
    let data: { title?: string; body?: string; url?: string } = {}
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
    const url: string = (event.notification.data as { url: string })?.url ?? '/dashboard/notifications'
    event.waitUntil(
        (self.clients as Clients).matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    (client as WindowClient).navigate(url)
                    return (client as WindowClient).focus()
                }
            }
            return (self.clients as Clients).openWindow(url)
        })
    )
})
