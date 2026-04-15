const CACHE_NAME = 'sourdough-v1';
const ASSETS = [
    'index.html',
    'style.css',
    'app.js',
    'manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});

let timerTimeout = null;

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'START_TIMER') {
        const { endTime, message } = event.data;
        const delay = endTime - Date.now();

        if (timerTimeout) clearTimeout(timerTimeout);

        if (delay > 0) {
            // event.waitUntil keeps the service worker alive for the duration of the promise
            event.waitUntil(
                new Promise((resolve) => {
                    timerTimeout = setTimeout(async () => {
                        await self.registration.showNotification('Sourdough Master', {
                            body: message,
                            icon: 'favicon.ico',
                            tag: 'sourdough-progress',
                            renotify: false,
                            vibrate: [200, 100, 200]
                        });
                        resolve();
                    }, delay);
                })
            );
        }
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there is already a window/tab open with the app
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            // If no window/tab is open, open a new one
            if (clients.openWindow) {
                return clients.openWindow(self.registration.scope);
            }
        })
    );
});
