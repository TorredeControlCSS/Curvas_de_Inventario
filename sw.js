// SW: Stale-while-revalidate para estáticos + caché ligero de últimos items
const STATIC_CACHE = 'static-v3';
const DYNAMIC_CACHE = 'dyn-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(STATIC_CACHE).then(c=>c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>![STATIC_CACHE,DYNAMIC_CACHE].includes(k)).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);

  // API: cache solo GET del item/search por poco tiempo
  if (url.pathname.includes('/macros/') && e.request.method==='GET'){
    e.respondWith(staleWhileRevalidate(e.request, DYNAMIC_CACHE, 5*60)); // 5 min
    return;
  }

  // Estáticos
  if (STATIC_ASSETS.some(a => url.href.startsWith(a) || url.pathname.endsWith(a))){
    e.respondWith(staleWhileRevalidate(e.request, STATIC_CACHE, 24*60*60));
    return;
  }
});

async function staleWhileRevalidate(req, cacheName, maxAgeSec){
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, {ignoreSearch:false});
  const fetchPromise = fetch(req).then(res=>{
    cache.put(req, res.clone());
    return res;
  }).catch(()=> cached); // si offline

  if (!cached) return fetchPromise;
  // validar edad
  if (maxAgeSec){
    const date = new Date(cached.headers.get('date') || 0);
    if (Date.now() - date.getTime() > maxAgeSec*1000) return fetchPromise;
  }
  return cached;
}
