// Service Worker simple para GitHub Pages
const CACHE = 'cedis-curvas-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))
  ;
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const { request } = e;
  // Network-first para API; cache-first para estáticos
  if (request.url.includes('script.google.com')) {
    e.respondWith(fetch(request).catch(()=>caches.match(request)));
  } else {
    e.respondWith(
      caches.match(request).then(r => r || fetch(request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c=>c.put(request, copy));
        return resp;
      }))
    );
  }
});
