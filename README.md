# КиноВместе 🎬

> Смотри видео с друзьями в реальном времени — Rutube, YouTube, VK Видео

Веб-приложение для совместного просмотра видео. Участники комнаты видят синхронизированное воспроизведение, общаются в чате и управляют очередью видео.

---

## Содержание

- [Возможности](#возможности)
- [Технологии](#технологии)
- [Структура проекта](#структура-проекта)
- [Установка и запуск](#установка-и-запуск)
- [Архитектура](#архитектура)
- [API](#api)
- [Исправленные баги](#исправленные-баги)
- [Известные ограничения](#известные-ограничения)

---

## Возможности

### Комнаты
- **Создание комнаты** с видео с Rutube, YouTube или VK Видео
- **Открытые комнаты** — видны всем в списке, можно войти без кода
- **Закрытые комнаты** — доступ только по 6-значному коду
- **Смена типа комнаты** хостом в реальном времени
- **Восстановление сессии** при переподключении

### Плеер
- Поддержка **Rutube** (HLS через прокси)
- Поддержка **YouTube** (IFrame API)
- Поддержка **VK Видео** (iframe embed)
- **Синхронизация** воспроизведения между всеми участниками
- **Хост** управляет паузой, перемоткой и воспроизведением
- Автоматическая коррекция дрейфа времени у гостей

### Очередь видео
- Добавление видео любым участником
- Управление очередью (перемещение, удаление, воспроизведение) только хостом
- **Автоплейлист** — автоматический поиск серий сериала по Rutube и добавление в очередь
- Автопереход к следующему видео по окончании

### Чат
- Текстовый чат в реальном времени
- **@-упоминания** с автодополнением
- **Эмодзи-пикер**
- Чат в полноэкранном режиме
- Мигание вкладки при новых сообщениях

### Голос
- **WebRTC** голосовая связь между участниками
- Автоматическое снижение громкости видео во время разговора (duck volume)
- Push-to-talk и режим постоянного включения

### UX
- Тёмная и светлая тема
- PWA — устанавливается на устройство
- Мобильный свайп для переключения между видео и чатом
- Оффлайн-кеш через Service Worker

---

## Технологии

### Backend
| Пакет | Назначение |
|-------|-----------|
| `express` | HTTP сервер, REST API |
| `socket.io` | WebSocket для real-time событий |
| `cors` | CORS-заголовки для REST API |
| Node.js `https` | Прокси-запросы к Rutube API |

### Frontend
| Технология | Назначение |
|-----------|-----------|
| Vanilla JS (ES6+) | Вся логика без фреймворков |
| Socket.IO Client | Подключение к серверу |
| HLS.js (CDN) | HLS-плеер для Rutube |
| YouTube IFrame API | Встроенный YouTube-плеер |
| Web Audio API | Звуковые уведомления |
| WebRTC | Голосовая связь |
| Service Worker | PWA, оффлайн-кеш |

---

## Структура проекта

```
kinovmeste/
├── server.js              # Точка входа, Express + Socket.IO
├── index.html             # Единственная HTML-страница (SPA)
├── style.css              # Все стили
├── manifest.json          # PWA манифест
├── sw.js                  # Service Worker
├── favicon.ico
├── icon-192.png
├── icon-512.png
│
├── js/                    # Клиентские скрипты (порядок загрузки важен!)
│   ├── globals.js         # Глобальные переменные + socket = io()
│   ├── utils.js           # Утилиты: esc, toast, cookie, initSession
│   ├── player.js          # Видеоплеер, платформы, синхронизация
│   ├── chat.js            # Чат, @упоминания, эмодзи
│   ├── queue.js           # Очередь видео
│   ├── playlist.js        # Автоплейлист сериалов (клиент)
│   ├── ui.js              # Сайдбар, тема, микрофон, WebRTC
│   └── app.js             # Инициализация, комнаты, сессии
│
└── lib/                   # Серверные модули
    ├── proxy.js           # HLS-прокси, парсинг URL видео
    ├── playlist.js        # Поиск серий на Rutube, автоплейлист
    └── rooms.js           # Управление комнатами, Socket.IO хендлеры
```

---

## Установка и запуск

### Требования
- Node.js ≥ 18
- npm

### Зависимости `package.json`

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "socket.io": "^4.7.0",
    "cors": "^2.8.5"
  }
}
```

### Установка

```bash
git clone <repo-url>
cd kinovmeste
npm install
```

### Запуск

```bash
# Разработка
node server.js

# Продакшн (debug-логи выключены)
NODE_ENV=production node server.js

# С авто-перезапуском
npx nodemon server.js
```

По умолчанию сервер запускается на `http://localhost:8080`.

### Переменные окружения

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `PORT` | `8080` | Порт HTTP сервера |
| `NODE_ENV` | — | `production` отключает debug-логи в lib/playlist.js |

---

## Архитектура

### Поток событий Socket.IO

```
Клиент (хост)                Сервер                  Клиент (гость)
     │                          │                          │
     ├─ create_room ───────────►│                          │
     │◄─ room_created ──────────┤                          │
     │                          │◄─ join_room ─────────────┤
     │                          ├─ room_joined ───────────►│
     │                          ├─ user_joined ───────────►│ (все)
     │                          │                          │
     ├─ player_action(play) ───►│                          │
     │                          ├─ player_action ─────────►│
     │                          ├─ sync_time (1s) ────────►│
     │                          │                          │
     ├─ chat ──────────────────►│                          │
     │                          ├─ chat ──────────────────►│
     │                          │                          │
     ├─ queue_add ─────────────►│                          │
     │                          ├─ queue_update ──────────►│ (все)
```

### Синхронизация видео

1. **Хост** отправляет `time_update` каждую секунду с текущей позицией
2. Сервер рассылает `sync_time` всем гостям каждую секунду
3. Гость сравнивает своё время с полученным — если разница > 0.5с, делает seek
4. При событиях `player_action` (play/pause/seek) — принудительная синхронизация

### Сессии

Сессии хранятся в памяти сервера (`Map`). При перезапуске все сессии теряются.

- Сессия создаётся при первом входе, ID хранится в cookie `kv_session` (30 дней)
- При reconnect клиент отправляет `sessionId` → сервер восстанавливает пользователя в комнате
- Сессии без активности 24 часа удаляются автоматически

### Смена хоста

При отключении хоста новым хостом автоматически становится первый участник из `Set` (в порядке подключения). Клиент получает событие `you_are_host`.

### Rutube HLS

Rutube не отдаёт HLS напрямую браузеру из-за CORS. Схема обхода:

```
Browser → GET /api/rutube-hls?id=XXX
       ← { hlsUrl: "/api/hls-proxy?u=..." }

Browser → GET /api/hls-proxy?u=https://rutube-cdn.../manifest.m3u8
       ← m3u8 с перемаппингными сегментами на /api/hls-proxy?u=...

Browser → GET /api/hls-proxy?u=https://rutube-cdn.../segment.ts
       ← бинарный ts-сегмент
```

### Автоплейлист

1. По `videoId` текущего видео запрашиваются метаданные Rutube API
2. Парсится заголовок: "Название 1 сезон 5 серия" → `{showName, season, episode}`
3. По showName ищутся серии через `rutube.ru/api/search/video/`
4. Собирается список серий после текущей, при необходимости — следующий сезон
5. Эпизоды добавляются в очередь через `queue_add_playlist`

---

## API

### REST

#### `POST /api/session`
Создать или восстановить сессию.

```json
// Request
{ "sessionId": "abc...", "name": "Иван" }

// Response
{ "sessionId": "abc...", "name": "Иван", "roomCode": "XYZ123" }
```

#### `GET /api/rooms`
Список открытых комнат.

```json
[
  {
    "code": "XYZ123",
    "title": "Смотрим аниме 🍿",
    "members": 3,
    "videoUrl": "https://rutube.ru/video/...",
    "platform": "rutube"
  }
]
```

#### `GET /api/rutube-hls?id=<videoId>`
Получить HLS URL для видео Rutube.

```json
{ "hlsUrl": "/api/hls-proxy?u=...", "title": "Название видео" }
```

#### `GET /api/hls-proxy?u=<encodedUrl>`
Прокси для HLS-манифестов и сегментов Rutube.

#### `GET /api/episode-playlist?id=<videoId>`
Автоплейлист для сериала.

```json
{
  "found": true,
  "showName": "Игра Престолов",
  "season": 1,
  "currentEp": 3,
  "nextEpisodes": [...],
  "hasNextSeason": false
}
```

#### `GET /health`
Проверка работоспособности. Возвращает `ok`.

### Socket.IO события

#### Клиент → Сервер

| Событие | Данные | Описание |
|---------|--------|---------|
| `create_room` | `{name, videoUrl, type, title, sessionId}` | Создать комнату |
| `join_room` | `{name, code, sessionId}` | Войти по коду |
| `join_open_room` | `{name, code, sessionId}` | Войти в открытую |
| `rejoin` | `{sessionId}` | Переподключение |
| `auth` | `{sessionId}` | Авторизация сессии |
| `player_action` | `{action, time}` | play / pause / seek |
| `time_update` | `{time}` | Текущая позиция (хост, 1/с) |
| `chat` | `{text}` | Сообщение в чат |
| `queue_add` | `{videoUrl}` | Добавить видео в очередь |
| `queue_add_playlist` | `{episodes, auto}` | Добавить список серий |
| `queue_remove` | `{itemId}` | Удалить из очереди |
| `queue_move` | `{itemId, direction}` | Переместить в очереди |
| `queue_play_item` | `{itemId}` | Запустить из очереди |
| `queue_next` | — | Следующее видео |
| `queue_clear` | — | Очистить очередь |
| `change_room_type` | `{type}` | Сменить тип комнаты |
| `mic_start` | — | Включить микрофон |
| `mic_stop` | — | Выключить микрофон |
| `rtc_offer` | `{to, offer}` | WebRTC offer |
| `rtc_answer` | `{to, answer}` | WebRTC answer |
| `rtc_ice` | `{to, candidate}` | ICE candidate |

#### Сервер → Клиент

| Событие | Данные | Описание |
|---------|--------|---------|
| `room_created` | `{code, videoId, platform, type}` | Комната создана |
| `room_joined` | `{code, state, time, isHost, queue, ...}` | Вошёл в комнату |
| `user_joined` | `{name, count, id}` | Участник зашёл |
| `user_left` | `{name, count, id}` | Участник вышел |
| `player_action` | `{action, time, name}` | Действие плеера |
| `sync_time` | `{time, state, force}` | Синхронизация (1/с) |
| `chat` | `{name, text}` | Входящее сообщение |
| `queue_update` | `{queue}` | Обновление очереди |
| `queue_next` | `{item, queue}` | Следующее видео |
| `queue_play_item` | `{item}` | Запуск из очереди |
| `you_are_host` | — | Назначен хостом |
| `session_restore` | `{roomCode, name, title}` | Предложение вернуться |
| `room_type_changed` | `{type, name}` | Тип комнаты изменён |
| `error_msg` | `string` | Ошибка |

---

## Исправленные баги

### 🔴 Критические

| # | Файл | Проблема | Решение |
|---|------|---------|---------|
| 1 | `js/globals.js` | `socket` не создавался — `socket.on/emit` везде падали с `ReferenceError`, приложение не работало совсем | Добавлен `var socket = io();` в `globals.js` первой строкой |
| 2 | `sw.js` | `'/style.css'` был закомментирован — при оффлайне страница показывалась без стилей | Раскомментирован |
| 3 | `sw.js` | В STATIC кешировался `/app.js` (не существует), а в HTML все скрипты из `/js/*.js` — ни один JS не кешировался | Заменено на `/js/globals.js`, `/js/utils.js` и т.д. |

### 🟠 Важные

| # | Файл | Проблема | Решение |
|---|------|---------|---------|
| 4 | `sw.js` | `hls.js` с CDN не попадал под условие `startsWith(origin)` и не кешировался — Rutube в оффлайне не работал | Убрано условие origin, все GET кешируются; CDN добавлен в STATIC |
| 5 | `server.js` | `Cache-Control: no-store` стоял на всё включая CSS/JS — конфликтовал с Service Worker | Ограничен только для `/api/` |
| 6 | `server.js` | `express.json()` был подключён после `express.static` — нарушение порядка middleware | Перемещён первым |
| 7 | `js/app.js` | `rejoinRoom` искал баннер по `querySelector('[style*="position:fixed"]')` — мог удалить любой fixed-элемент (toast, popup) | Баннеру дан ID `session-restore-banner`, удаление по ID |

### 🟡 Незначительные

| # | Файл | Проблема | Решение |
|---|------|---------|---------|
| 8 | `js/utils.js` | `el.className = 'toast show ${type}'` — класс `toast` не существовал в CSS | Убран лишний класс, оставлено `show ${type}` |
| 9 | `js/playlist.js` | `showPlaylistBanner()` была заглушкой, но `autoPlaylistBannerActive` никогда не ставился в `true` | `showPlaylistBanner` реализована полноценно, `autoPlaylistBannerActive` управляется корректно |
| 10 | `js/playlist.js` | Toast показывал полное `nextEpisodes.length` до фактического добавления (добавлялось только 5 первых) | Toast теперь говорит «Загружаем N серий…» вместо финального числа |
| 11 | `js/app.js`, `js/chat.js` | `roomMembers['me'] = myName` — при одинаковых никах пользователь пропадал из @-упоминаний | Заменено на `roomMembers[socket.id] = myName`, фильтрация по `id !== socket.id` |
| 12 | `server.js` | Дублирующий `app.get('/')` никогда не достигался — `express.static` уже отдавал `index.html` | Удалён |
| 13 | `server.js` | Нет CORS-заголовков на REST API — проблемы при деплое на отдельный домен | Добавлен `cors()` для `/api/` |
| 14 | `lib/playlist.js` | `console.log` с данными пользователей засорял stdout в продакшне | Заменён на `log()` — обёртка, выключающаяся при `NODE_ENV=production` |

---

## Деплой

### Простой (VPS)

```bash
npm install --production
NODE_ENV=production PORT=80 node server.js
```

### С pm2

```bash
npm install -g pm2
NODE_ENV=production pm2 start server.js --name kinovmeste
pm2 save
pm2 startup
```

### Nginx (reverse proxy + HTTPS)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        # Обязательно для Socket.IO WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

> ⚠️ **HTTPS обязателен** для WebRTC (микрофон) и PWA (установка на устройство).
> На HTTP браузеры блокируют `getUserMedia` и Service Worker.

---

## Известные ограничения

- **Видео по подписке** на Rutube (`18+`, платный контент) недоступно через HLS-прокси
- **Приватные видео** YouTube (`unlisted`, `private`) не воспроизводятся через IFrame API
- **VK Видео** не синхронизируется (нет JS API в iframe-плеере VK) — только совместная комната
- **Комнаты не персистентны** — при перезапуске сервера все комнаты и сессии удаляются
- **Автоплейлист** работает только для Rutube и только если в заголовке видео указан сезон/серия
- **WebRTC голос** требует HTTPS в продакшне
- **Очередь** ограничена 50 видео на комнату