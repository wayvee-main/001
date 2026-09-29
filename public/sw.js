const CACHE_PREFIX = 'wayvee-shell-';
const BUILD_ID = '__WAYVEE_BUILD__';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/wayvee-192.png',
  '/wayvee-512.png',
  '/wayvee-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          CORE_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Outbound providers and remote restaurant/event imagery stay entirely on the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js') {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic' && !url.search) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;

        if (request.mode === 'navigate') {
          const appShell = await cache.match('/');
          if (appShell) return appShell;
        }

        throw error;
      }
    })(),
  );
});
