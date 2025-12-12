const CACHE_NAME = 'kv-cache-v2';
const CORE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(CORE))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // cache-first for core assets
  const url = new URL(e.request.url);
  if (CORE.includes(url.pathname) || CORE.includes(url.pathname + '/')) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).catch(()=> caches.match('/')))
    );
    return;
  }

  // network-first for dynamic requests, fallback to cache
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
      return res;
    }).catch(()=> caches.match(e.request))
  );
});
