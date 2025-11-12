// Nombre de caché (sube el número para invalidar versiones anteriores)
const CACHE_NAME = 'cedis-cache-v6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instala y precachea estáticos
self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS)));
});

// Limpia cachés viejas
self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    ))
  );
});

// Estrategia:
//  - Archivos locales: cache-first
//  - Llamadas a la API (…/exec?action=…): stale-while-revalidate (5 min de validez)
self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  const isLocal = url.origin === location.origin;

  if (isLocal) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
    return;
  }

  const isApi = /\/exec(\?|$)/.test(url.pathname);
  if (isApi) {
    e.respondWith(staleWhileRevalidate(e.request, 5 * 60 * 1000));
    return;
  }

  // por defecto
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});

async function staleWhileRevalidate(req, maxAgeMs){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const now = Date.now();

  if (cached) {
    const date = new Date(cached.headers.get('sw-fetched-at') || 0).getTime();
    if (now - date < maxAgeMs) {
      // devuelve de caché y actualiza por detrás
      fetch(req).then(res=>putWithStamp(cache, req, res)).catch(()=>{});
      return cached;
    }
  }
  const res = await fetch(req);
  putWithStamp(cache, req, res.clone());
  return res;
}

function putWithStamp(cache, req, res){
  const headers = new Headers(res.headers);
  headers.set('sw-fetched-at', new Date().toUTCString());
  const stamped = new Response(res.body, {status:res.status, statusText:res.statusText, headers});
  return cache.put(req, stamped);
}
