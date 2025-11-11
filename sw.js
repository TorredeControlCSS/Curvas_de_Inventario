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

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Network-first para la API; cache-first para estáticos
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  const isApi = url.searchParams.get('action');

  if (isApi){
    e.respondWith(
      fetch(e.request).then(resp=>{
        const clone = resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request, clone));
        return resp;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(res=> res || fetch(e.request))
  );
});