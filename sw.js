const CACHE = 'kinovmeste-v4';
const STATIC = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Кешируем только запросы к нашему серверу
  if (e.request.url.startsWith(self.location.origin)) {
    // Пропускаем API и socket
    if (e.request.url.includes('/api/') || e.request.url.includes('/socket.io')) return;

    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (e.request.method === 'GET' && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
  }
  // Все внешние запросы (yandex, youtube, etc) — пропускаем без кеширования
});
