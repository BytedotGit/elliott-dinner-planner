const CACHE='elliott-meal-v4-hot-20260910-1';
const ASSETS=[
  './','./index.html','./styles.css','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png',
  './data-inventory.js','./data-meals-1.js','./data-meals-2.js','./data-meals-3.js','./data-meals-final.js','./data-portions.js',
  './app-1.js','./app-2.js','./app-3.js','./app-4.js','./app-labels.js','./app-5.js','./app-update.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    clients.forEach(client => client.postMessage({type:'APP_UPDATED'}));
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first keeps installed Home Screen apps current whenever online.
  // The cache is an offline fallback, not the source of truth for app code.
  event.respondWith((async () => {
    try {
      const response = await fetch(request, {cache:'no-store'});
      if (response && response.ok) {
        const copy = response.clone();
        const cache = await caches.open(CACHE);
        await cache.put(request, copy);
      }
      return response;
    } catch (e) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match('./index.html');
      throw e;
    }
  })());
});
