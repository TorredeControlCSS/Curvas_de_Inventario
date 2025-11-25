// sw.js v3.1 — cache bust & no interception of external requests
const CACHE_VERSION = 'v3.1-2025-11-24';
const CACHE_NAME = `inv-cache-${CACHE_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k.startsWith('inv-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Do not intercept non-origin (external) requests (e.g., Apps Script API)
  if (url.origin !== location.origin) return;
  // Cache-first for app shell, network for the rest on same origin
  if (APP_SHELL.some(p => url.pathname.endsWith(p.replace('./','/')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  } else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
