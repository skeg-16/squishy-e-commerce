const STATIC_CACHE = 'squishies-static-v2';
const API_CACHE = 'squishies-api-v2';

const PRECACHE_ASSETS = [
  '/assets/images/product-dumpling.svg',
  '/assets/images/product-cheese.svg',
  '/assets/images/product-catpaw.svg',
  '/assets/images/product-toast.svg',
  '/assets/images/product-butter.svg',
  '/assets/images/product-peanut.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Vite dev HMR or source module transforms
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // Cache-first for static 3D models, images, audio, and built bundle assets
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/models/') ||
    /\.(?:svg|png|jpg|jpeg|webp|glb|mp3|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          // Refresh in background
          fetch(request)
            .then((response) => {
              if (response && response.ok) {
                cache.put(request, response.clone());
              }
            })
            .catch(() => {});
          return cached;
        }
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })
    );
    return;
  }

  // Stale-while-revalidate for public read-only catalog & reviews API endpoints
  if (
    url.pathname.startsWith('/api/products') ||
    url.pathname.startsWith('/api/reviews') ||
    url.pathname === '/api/vouchers/available'
  ) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          return cached;
        }
        const live = await networkPromise;
        if (live) return live;
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Offline and no cached data available.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
  }
});

