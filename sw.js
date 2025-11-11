const CACHE = 'cedis-cache-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1'
];

// install
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

// activate (limpieza)
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=> k!==CACHE && caches.delete(k))))
  );
  self.clients.claim();
});

// fetch: cache-first para estáticos, network-first para la API
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  const isAPI = url.href.includes('script.google.com/macros');

  if (isAPI) {
    e.respondWith(
      fetch(e.request).then(res=>{
        return res;
      }).catch(()=> caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached=>{
      return cached || fetch(e.request).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return res;
      });
    })
  );
});