// Service Worker - Online Only PWA (no offline caching)
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// Pass all requests straight to network (no caching)
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
