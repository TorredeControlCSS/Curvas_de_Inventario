// sw.js — Curvas_de_Inventario (con Navigation Preload)
// =======================================================
const CACHE_VERSION = 'v3.3-2025-11-28'; // ⬅️ súbelo en cada release
const STATIC_CACHE = `static-${CACHE_VERSION}`;

/** Lista mínima del app-shell.
 *  Usa RUTAS RELATIVAS porque estás en /Curvas_de_Inventario/
 */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // './css/app.css',
  // './js/app.js',
];

// Install: precache del app-shell
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

// Activate: limpia versiones antiguas, habilita Navigation Preload y toma control
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== STATIC_CACHE ? caches.delete(k) : Promise.resolve())));
    // Habilita Navigation Preload si está disponible (mejora TTFB en navigations)
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

// Fetch policy:
// - Navegaciones (HTML): usa preload si existe; si no, network-first; fallback caché.
// - Estáticos locales (script/style/image/font): stale-while-revalidate.
// - Externos (otro origen): no interceptar.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // No tocar otros orígenes (CDN, Google Apps Script, etc.)
  if (url.origin !== location.origin) return;

  // HTML / navegaciones => usa preload -> network-first -> cache
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const fresh = await fetch(req, { cache: 'no-store' });
        return fresh;
      } catch {
        const cached = await caches.match('./index.html');
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Estáticos locales => SWR
  if (req.method === 'GET' && (req.destination === 'script' || req.destination === 'style' || req.destination === 'image' || req.destination === 'font')) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || fetchPromise || Response.error();
    })());
    return;
  }

  // Por defecto: red con fallback a caché
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// Permite a la página activar YA la nueva versión
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
