const CACHE_NAME = 'cedis-cache-v8';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API: siempre red (no cachear)
  if (url.hostname === 'script.google.com') {
    e.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).then(r => {
        const copy=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(request, copy)); return r;
      }).catch(()=>caches.match(request))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then(cached => cached ||
      fetch(request).then(r => { const copy=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(request, copy)); return r; })
    )
  );
});