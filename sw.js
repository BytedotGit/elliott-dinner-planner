const CACHE='elliott-meal-v4-2';
const ASSETS=["./", "./index.html", "./styles.css", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./data-inventory.js", "./data-meals-1.js", "./data-meals-2.js", "./data-meals-3.js", "./data-meals-final.js", "./data-portions.js", "./app-1.js", "./app-2.js", "./app-3.js", "./app-4.js", "./app-5.js"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;}).catch(()=>caches.match('./index.html')))));
