const CACHE = 'bh-invest-v6';
const ASSETS = ['./index.html', './app.js?v=6', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon.svg', './market.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(ASSETS.map(url => new Request(url, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => /^bh-invest-v[1-5]$/.test(key)).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (new URL(request.url).pathname.endsWith('/market.json')) { event.respondWith(fetch(request, {cache:'no-store'}).then(async response => { if(response.ok) {const cache=await caches.open(CACHE); await cache.put(request,response.clone());} return response; }).catch(async () => (await (await caches.open(CACHE)).match(request)) || Response.error())); return; }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, {cache: 'no-store'}).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match('./index.html')) || Response.error();
    }));
    return;
  }

  event.respondWith(caches.open(CACHE).then(async cache => {
    return (await cache.match(request)) || fetch(request);
  }));
});

