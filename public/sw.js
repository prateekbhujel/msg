const CACHE_NAME = 'msg-shell-v1';
const CORE_ASSETS = [
    './manifest.webmanifest',
    './favicon.ico',
    './pwa/icon-192.png',
    './pwa/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .catch(() => null)
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);

    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    if (!['script', 'style', 'image', 'font', 'manifest'].includes(event.request.destination)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                const responseClone = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone).catch(() => null);
                });

                return networkResponse;
            });
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    const action = event.action || '';
    const notificationData = event.notification?.data || {};
    const targetUrl = notificationData.url || './messenger';

    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        }).then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'notification_action',
                    action,
                    session_uuid: notificationData.session_uuid || null,
                    room_url: notificationData.room_url || null,
                });
            });

            for (const client of clients) {
                if ('focus' in client) {
                    const nextUrl = action === 'accept' && notificationData.room_url
                        ? notificationData.room_url
                        : targetUrl;

                    client.navigate(nextUrl).catch(() => null);
                    return client.focus();
                }
            }

            if (self.clients.openWindow) {
                const nextUrl = action === 'accept' && notificationData.room_url
                    ? notificationData.room_url
                    : targetUrl;

                return self.clients.openWindow(nextUrl);
            }

            return null;
        })
    );
});

self.addEventListener('push', (event) => {
    let payload = {};

    try {
        payload = event.data?.json?.() || {};
    } catch (error) {
        payload = {};
    }

    if (payload.type !== 'incoming_call') {
        return;
    }

    const title = payload.title || 'Incoming call';
    const options = {
        body: payload.body || 'Someone is calling you.',
        icon: payload.icon || './pwa/icon-192.png',
        badge: payload.badge || './pwa/icon-192.png',
        tag: payload.tag || `incoming-call-${payload.session_uuid || 'call'}`,
        requireInteraction: true,
        renotify: true,
        actions: [
            { action: 'accept', title: 'Answer' },
            { action: 'decline', title: 'Decline' },
        ],
        data: {
            url: payload.url || './messenger',
            room_url: payload.room_url || null,
            session_uuid: payload.session_uuid || null,
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});
