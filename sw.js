const CACHE_NAME = 'sourdough-v5'; // Bumped to force reinstall

const ASSETS = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'eyes_open.png',
    'eyes_star.png',
    'temperature.png',
    'dutch.png',
    'knife.png',
    'boule.png',
    'start_screen.png',
    'celebration.gif',
    'favicon.ico'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching assets');
            return Promise.allSettled(
                ASSETS.map(asset => cache.add(asset))
            ).then((results) => {
                results.forEach((r, i) => {
                    if (r.status === 'rejected') {
                        console.warn('Failed to cache:', ASSETS[i]);
                    }
                });
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            clients.claim()
        ])
    );
});

self.addEventListener('fetch', (event) => {
    // For navigation requests, try network first then fall back to cached index.
    // Uses scope-relative path so it works on GitHub Pages subfolders.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(self.registration.scope + 'index.html');
            })
        );
        return;
    }

    // For static assets, use Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cacheCopy);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return cachedResponse || new Response('Offline - resource not available', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            });

            return cachedResponse || fetchPromise;
        })
    );
});

// ---------------------------------------------------------------------------
// Notification-only handler.
// The main page (app.js) owns the timer via setTimeout + localStorage.
// It posts NOTIFY here when the timer fires.
// CANCEL_TIMER is a no-op so app.js can call it safely on restart.
// ---------------------------------------------------------------------------

self.addEventListener('message', (event) => {
    const { type, message } = event.data || {};

    if (type === 'NOTIFY') {
        // Guard against the permission error — SW can't show notifications
        // unless the user already granted permission in the page.
        if (self.Notification && self.Notification.permission !== 'granted') {
            console.warn('[SW] Notification permission not granted, skipping.');
            return;
        }

        event.waitUntil(
            self.registration.showNotification('Sourdough Master', {
                body: message || "Timer finished! Time for the next step.",
                icon: 'favicon.ico',
                tag: 'sourdough-progress',
                renotify: true,
                vibrate: [200, 100, 200]
            })
        );
    }

    if (type === 'CANCEL_TIMER') {
        console.log('[SW] CANCEL_TIMER received');
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(self.registration.scope);
            }
        })
    );
});
