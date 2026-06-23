self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const title = data.title || 'SAGE Healthcare';
    const options = {
        body:     data.body  || '',
        icon:     data.icon  || '/logo.png',
        badge:    '/logo.png',
        tag:      data.tag   || 'sage-notification',
        renotify: true,
        dir:      'rtl',
        lang:     'ar',
        // Store the target URL so the click handler can navigate correctly
        data:     { url: data.url || '/' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            // If a tab with this URL is already open, focus it
            for (const client of list) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new tab
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});
