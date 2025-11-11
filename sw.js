// Service Worker para GitHub Pages (no cachea APIs externas)
const CACHE = 'cedis-curvas-v2';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  ;
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const sameOrigin = new URL(request.url).origin === self.location.origin;

  // Nunca interceptar terceros (e.g., Google Apps Script)
  if (!sameOrigin) return;

  // Cache-first para assets propios
  e.respondWith(
    caches.match(request).then(r => r || fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
      return resp;
    }))
  );
});
