// Service Worker - Offline Caching PWA (Network First, Cache Fallback)
const CACHE_NAME = 'agt-store-v1';
const STATIC_ASSETS = [
  'index.html',
  'products.html',
  'contact.html',
  'css/style.css',
  'js/supabase-config.js',
  'manifest.json',
  'icons/logo.jpeg'
];

// Install: Pre-cache static pages
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  e.waitUntil(clients.claim());
});

// Fetch: Network first, fall back to cache
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // For API calls (Supabase), try network then cache
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // For CDN resources (Tailwind, Font Awesome, Google Fonts, Supabase JS)
  if (url.hostname.includes('cdn.') || url.hostname.includes('fonts.') || url.hostname.includes('cdnjs.')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // For local pages/assets: Network first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
