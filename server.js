// ============================================================
<<<<<<< HEAD
// Файл: server.js
// Расположение: server.js
// Описание: Главный серверный файл приложения КиноВместе.
// Инициализирует Express, Socket.io, Redis-сессии и модули.
// ============================================================

const express      = require('express');
const http         = require('http');
const crypto       = require('crypto');
const { Server }   = require('socket.io');
const path         = require('path');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const Redis        = require('ioredis');

const proxy      = require('./lib/proxy');
const playlist   = require('./lib/playlist');
const rooms      = require('./lib/rooms');
const roomLogger = require('./lib/roomLogger');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 8080;
require('dotenv').config();
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/admin.html', (req, res, next) => {
    const validKey = process.env.ADMIN_KEY || 'mySecretKey123';
    if (!req.query.key || req.query.key !== validKey) {
        return res.redirect('/');
    }
    next(); // пускаем дальше к express.static
});
// ─── Redis ───────────────────────────────────────────────────

const redis = new Redis({
    host:           process.env.REDIS_HOST || '127.0.0.1',
    port:           process.env.REDIS_PORT || 6379,
    password:       process.env.REDIS_PASS || undefined,
    retryStrategy:  times => Math.min(times * 200, 3000), // переподключение
    lazyConnect:    false,
});

redis.on('connect',     () => console.log('✅ Redis подключён'));
redis.on('error',  err => console.error('❌ Redis ошибка:', err.message));

const SESSION_TTL = 30 * 24 * 60 * 60; // 30 дней в секундах

// ─── Сессии через Redis ──────────────────────────────────────

async function createSession(name) {
    const id   = crypto.randomBytes(24).toString('hex');
    const data = { sessionId: id, name, roomCode: null, createdAt: Date.now(), lastActive: Date.now() };
    await redis.setex(`session:${id}`, SESSION_TTL, JSON.stringify(data));
    return id;
}

async function getSession(id) {
    if (!id) return null;
    const raw = await redis.get(`session:${id}`);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Обновляем lastActive и продлеваем TTL
    session.lastActive = Date.now();
    await redis.setex(`session:${id}`, SESSION_TTL, JSON.stringify(session));
    return session;
}

async function saveSession(session) {
    await redis.setex(`session:${session.sessionId}`, SESSION_TTL, JSON.stringify(session));
}

async function deleteSession(id) {
    await redis.del(`session:${id}`);
}

// Обёртка для совместимости с rooms.js (он ждёт Map-like объект)
// Передаём прокси который умеет get/set асинхронно
const sessionsProxy = {
    get:    id  => getSession(id),
    set:    (id, val) => saveSession(val),
    delete: id  => deleteSession(id),
};

// ─── Socket.IO с защитой ─────────────────────────────────────

const io = new Server(server, {
    cors:               { origin: '*' },
    // Лимиты подключений
    pingTimeout:        20000,
    pingInterval:       25000,
    maxHttpBufferSize:  1e5,        // 100KB макс размер сообщения
    transports:         ['websocket', 'polling'],
    // Защита от флуда событий
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 минуты восстановление
    },
});

// ─── Middleware ───────────────────────────────────────────────

app.set('trust proxy', 1); // для корректного IP за nginx

app.use(express.json({ limit: '10kb' })); // ограничение тела запроса

// CORS только для API
app.use('/api', cors({ origin: '*' }));
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// ─── Rate Limiting ────────────────────────────────────────────

// Общий лимит для всего API
const apiLimiter = rateLimit({
    windowMs:         60 * 1000,   // 1 минута
    max:              120,          // 120 запросов в минуту с одного IP
    standardHeaders:  true,
    legacyHeaders:    false,
    message:          { error: 'Слишком много запросов, подожди немного' },
});

// Жёсткий лимит для создания сессий
const sessionLimiter = rateLimit({
    windowMs:         60 * 1000,   // 1 минута
    max:              10,           // 10 новых сессий в минуту
    standardHeaders:  true,
    legacyHeaders:    false,
    message:          { error: 'Слишком много запросов' },
});

// Лимит для HLS прокси (тяжёлые запросы)
const hlsLimiter = rateLimit({
    windowMs:         60 * 1000,
    max:              300,          // 300 сегментов в минуту
    standardHeaders:  true,
    legacyHeaders:    false,
    message:          'Too many requests',
});

app.use('/api', apiLimiter);
app.use('/api/session', sessionLimiter);
app.use('/api/hls-proxy', hlsLimiter);

// Статика
app.use(express.static(path.join(__dirname), { maxAge: '1h', etag: true }));

app.get('/health', (req, res) => res.send('ok'));

// ─── REST: сессии ────────────────────────────────────────────

app.post('/api/session', async (req, res) => {
    try {
        const { sessionId, name } = req.body;
        const ex = await getSession(sessionId);
        if (ex) {
            if (name) {
                ex.name = name.trim().slice(0, 32);
                await saveSession(ex);
            }
            return res.json({ sessionId: ex.sessionId, name: ex.name, roomCode: ex.roomCode });
        }
        const safeName = (name || '').trim().slice(0, 32) || 'Гость';
        const newId    = await createSession(safeName);
        res.json({ sessionId: newId, name: safeName, roomCode: null });
    } catch (e) {
        console.error('[SESSION]', e.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ─── Socket.IO: защита от флуда ───────────────────────────────

// Счётчик событий на сокет за последние N секунд
const socketEventCount = new Map();

function checkSocketFlood(socketId, limit = 30, windowMs = 1000) {
    const now  = Date.now();
    const data = socketEventCount.get(socketId) || { count: 0, resetAt: now + windowMs };

    if (now > data.resetAt) {
        data.count   = 1;
        data.resetAt = now + windowMs;
    } else {
        data.count++;
    }

    socketEventCount.set(socketId, data);
    return data.count <= limit;
}

// Чистим счётчики отключившихся
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of socketEventCount) {
        if (now > data.resetAt + 5000) socketEventCount.delete(id);
    }
}, 10000);

// ─── Лимит одновременных подключений ─────────────────────────

const MAX_CONNECTIONS = 500;

io.use((socket, next) => {
    if (io.engine.clientsCount > MAX_CONNECTIONS) {
        return next(new Error('Сервер перегружен, попробуй позже'));
    }
    next();
=======
//  server.js — точка входа
//  Исправления:
//    - express.json() перемещён первым (БАГ 6)
//    - Cache-Control: no-store только для /api/ (БАГ 5)
//    - удалён дублирующий app.get('/') (БАГ 12)
//    - добавлен CORS для REST API (БАГ 13)
// ============================================================

const express    = require('express');
const http       = require('http');
const crypto     = require('crypto');
const { Server } = require('socket.io');
const path       = require('path');
const cors       = require('cors');

const proxy    = require('./lib/proxy');
const playlist = require('./lib/playlist');
const rooms    = require('./lib/rooms');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
});
const PORT = process.env.PORT || 8080;

// ─── БАГ 6: express.json() ставим ПЕРВЫМ, до всего ───────────
app.use(express.json());

// ─── БАГ 5: Cache-Control: no-store только для API ───────────
//  Раньше стоял на всё — ломал кеш статики и конфликтовал со SW
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ─── БАГ 13: CORS для REST API ───────────────────────────────
app.use('/api', cors({ origin: '*' }));

// ─── Статика — кешируется браузером нормально ─────────────────
app.use(express.static(path.join(__dirname), {
  maxAge: '1h',
  etag: true,
}));

// ─── БАГ 12: удалён дублирующий app.get('/') ─────────────────
//  express.static с index:'index.html' (по умолчанию) уже
//  обрабатывает GET / — второй роут никогда не достигался

app.get('/health', (req, res) => res.send('ok'));

// ─── Сессии ───────────────────────────────────────────────────

const sessions = new Map();

function createSession(name) {
  const id = crypto.randomBytes(24).toString('hex');
  sessions.set(id, {
    sessionId: id,
    name,
    roomCode: null,
    createdAt: Date.now(),
  });
  return id;
}

function getSession(id) {
  return id ? sessions.get(id) || null : null;
}

// Чистим сессии старше 24 часов
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}, 60 * 60 * 1000);

app.post('/api/session', (req, res) => {
  const { sessionId, name } = req.body;
  const ex = getSession(sessionId);
  if (ex) {
    if (name) ex.name = name.trim().slice(0, 32);
    return res.json({ sessionId: ex.sessionId, name: ex.name, roomCode: ex.roomCode });
  }
  const safeName = (name || '').trim().slice(0, 32) || 'Гость';
  res.json({ sessionId: createSession(safeName), name: safeName, roomCode: null });
});

proxy.registerRoutes(app);
playlist.registerRoutes(app);
rooms.registerRoutes(app);

// ─── Socket.IO ───────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[+] ${socket.id}`);
  rooms.registerSocketHandlers(io, socket, sessions);
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
});

// ─── Middleware Socket.IO: антифлуд ───────────────────────────

io.use((socket, next) => {
    const originalOnEvent = socket.onevent.bind(socket);
    socket.onevent = function(packet) {
        if (!checkSocketFlood(socket.id, 40, 1000)) {
            console.warn(`[FLOOD] ${socket.id} превысил лимит событий`);
            socket.emit('error_msg', 'Слишком много запросов');
            return;
        }
        originalOnEvent(packet);
    };
    next();
});

// ─── Регистрация роутов ───────────────────────────────────────

proxy.registerRoutes(app);
playlist.registerRoutes(app);
rooms.registerRoutes(app);
roomLogger.registerRoutes(app);

// ─── Socket.IO ────────────────────────────────────────────────

io.on('connection', socket => {
    console.log(`[+] ${socket.id} (всего: ${io.engine.clientsCount})`);
    // Передаём sessionsProxy вместо Map
    rooms.registerSocketHandlers(io, socket, sessionsProxy);

    socket.on('disconnect', () => {
        socketEventCount.delete(socket.id);
        console.log(`[-] ${socket.id} (всего: ${io.engine.clientsCount})`);
    });
});

// ─── Graceful shutdown ────────────────────────────────────────

async function shutdown(signal) {
    console.log(`\n[${signal}] Завершение...`);
    server.close(() => {
        redis.quit().then(() => {
            console.log('Redis отключён');
            process.exit(0);
        });
    });
    setTimeout(() => process.exit(1), 10000); // форс-выход через 10с
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Запуск ───────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
<<<<<<< HEAD
    console.log(`\n🎬 КиноВместе → http://localhost:${PORT}`);
    console.log(`📁 Логи комнат → ./rooms/`);
    console.log(`📊 API логов   → /api/admin/logs\n`);
=======
  console.log(`\n🎬 КиноВместе → http://localhost:${PORT}\n`);
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
});