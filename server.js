// ============================================================
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
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 КиноВместе → http://localhost:${PORT}\n`);
});