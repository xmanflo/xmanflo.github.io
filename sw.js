const CACHE_NAME = 'kv-cache-v1';
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
  // Simple cache-first for core static assets, network-first for others
  if (CORE.includes(new URL(e.request.url).pathname)) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).catch(()=> caches.match('/')))
    );
    return;
  }

  // For other requests use network-first with cache fallback
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
      return res;
    }).catch(()=> caches.match(e.request))
  );
});
