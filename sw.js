// sw.js
const CACHE = 'cedis-cache-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // CDNs quedan fuera: el navegador los cachea bien, pero si quieres, añádelos también
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k===CACHE?null:caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Estrategia "Stale-While-Revalidate" para GET (incluye API)
  if (req.method === 'GET') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then(res => {
        // sólo cacheamos 200 OK
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => null);

      // Devuelve rápido caché, y en paralelo actualiza
      return cached || fetchPromise || new Response('{"offline":true}', {
        headers:{'Content-Type':'application/json'}
      });
    })());
    return;
  }

  // Fallback directo
  event.respondWith(fetch(req));
});
