// sw.js — Curvas_de_Inventario
// =======================================================
// CAMBIO CRÍTICO: Versión actualizada para forzar recarga
const CACHE_VERSION = 'v5.0-FINAL-FIX-2026-02-20';
const STATIC_CACHE = `static-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 1. Install: Precacheo agresivo
self.addEventListener('install', (event) => {
  // Obliga al SW a activarse inmediatamente, sin esperar
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
});

// 2. Activate: Limpieza inmediata de cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim()) // Toma control de la página inmediatamente
  );
});

// 3. Fetch: Estrategia Network-First para HTML (Vital para evitar que index.html se pegue)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo interceptar peticiones del mismo origen
  if (url.origin !== location.origin) return;

  // Estrategia para HTML (Navegación): Network First, luego Cache
  // Esto asegura que siempre intente bajar el index.html nuevo primero.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Estrategia para recursos estáticos (JS, CSS, Imágenes): Cache First
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((response) => {
        return caches.open(STATIC_CACHE).then((cache) => {
          cache.put(req, response.clone());
          return response;
        });
      });
    })
  );
});
