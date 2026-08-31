// Resonance Service Worker — v2.0
// Handles offline caching for PWA functionality

const CACHE_NAME = 'resonance-v3';
const OFFLINE_URL = '/';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event — cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Resonance SW: caching core assets');
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('Resonance SW: deleting old cache', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// Fetch event — serve from cache, fall back to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase requests — always need fresh data
  const hostname = url.hostname.toLowerCase();
  const isFirebaseHost = hostname === 'firebaseapp.com'
    || hostname.endsWith('.firebaseapp.com')
    || hostname === 'firebaseio.com'
    || hostname.endsWith('.firebaseio.com');
  const isFirestoreHost = hostname === 'firestore.googleapis.com';
  if (isFirebaseHost || isFirestoreHost) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Serve from cache and update in background (stale-while-revalidate)
        const fetchPromise = fetch(request).then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
          }
          return response;
        }).catch(() => cached); // If network fails, use cached version
        return cached;
      }
      // Not in cache — fetch from network and cache it
      return fetch(request).then(response => {
        if (!response || response.status !== 200) return response;
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
        return response;
      }).catch(() => {
        // Completely offline — return offline page
        if (request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// Background sync for Firebase data
self.addEventListener('sync', event => {
  if (event.tag === 'sync-resonance-data') {
    console.log('Resonance SW: background sync triggered');
  }
});

// Push notifications
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Resonance';
  const options = {
    body: data.body || 'Your frequency session is ready.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'resonance-reminder',
    data: data,
    actions: [
      { action: 'open', title: '▶ Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
