const CACHE = 'pemesanan-buku-v2';

const PRECACHE = [
  './',
  './index.php',
  './public/css/style.css',
  './public/css/characters.css',
  './public/css/emojis.css',
  './public/js/characters.js',
  './public/js/emojis.js',
  './public/js/notifications.js',
  './public/js/videocall.js',
  './public/js/keepalive.js',
  './public/js/chat-php.js',
  './public/js/pwa.js',
  './public/icons/icon-192.png',
  './public/icons/icon-512.png',
  './public/icons/apple-touch-icon.png',
  './manifest.php'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'keepalive') {
    /* menjaga service worker tetap responsif */
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
