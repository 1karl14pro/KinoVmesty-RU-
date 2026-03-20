// ============================================================
//  sw.js — Service Worker / PWA кеш
//  Исправления:
//    - style.css раскомментирован
//    - пути JS исправлены на /js/*.js
//    - CDN-ресурсы теперь тоже кешируются
//    - убрано условие startsWith(origin) из fetch-обработчика
// ============================================================

const CACHE = 'kinovmeste-v6';
const STATIC = [
  '/',
  '/index.html',
  '/style.css',           // БАГ 2: был закомментирован
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // БАГ 3: исправлены пути — в HTML скрипты из /js/, а не корня
  '/js/globals.js',
  '/js/utils.js',
  '/js/player.js',
  '/js/chat.js',
  '/js/queue.js',
  '/js/playlist.js',
  '/js/ui.js',
  '/js/app.js',
  // БАГ 4: CDN кешируем явно при install
  'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Пропускаем не-GET запросы
  if (e.request.method !== 'GET') return;

  // Пропускаем API и Socket.IO — всегда идут в сеть
  if (url.includes('/api/') || url.includes('/socket.io')) return;

  // БАГ 4: убрано условие startsWith(origin) — теперь кешируем
  // и свои файлы, и внешние CDN (hls.js, шрифты и т.д.)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(response => {
        // Кешируем только успешные ответы
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Оффлайн-фоллбек для навигационных запросов
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});