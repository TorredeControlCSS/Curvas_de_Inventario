// minimal SW
const VERSION = 'v3';
self.addEventListener('install', (e)=>{ self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ clients.claim(); });
self.addEventListener('fetch', (e)=>{
  // passthrough; rely on network (no caching of API to avoid stale data)
});
