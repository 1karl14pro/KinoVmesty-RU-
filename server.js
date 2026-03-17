// КиноВместе — сервер v4
// npm install express socket.io
// node server.js

const express  = require('express');
const http     = require('http');
const https    = require('https');
const urlMod   = require('url');
const crypto   = require('crypto');
const { Server } = require('socket.io');
const path     = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3015;

app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.get('/health', (req, res) => res.send('ok'));
// ─── Сессии (хранятся в памяти, в продакшне — Redis) ──────────────────────
// session = { sessionId, name, roomCode, createdAt }
const sessions = new Map();

function createSession(name) {
  const sessionId = crypto.randomBytes(24).toString('hex');
  sessions.set(sessionId, { sessionId, name, roomCode: null, createdAt: Date.now() });
  return sessionId;
}

function getSession(sessionId) {
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

// Чистим старые сессии раз в час (старше 24ч)
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}, 60 * 60 * 1000);

// ─── REST: управление сессиями ─────────────────────────────────────────────

// Создать/проверить сессию
app.post('/api/session', (req, res) => {
  const { sessionId, name } = req.body;
  const existing = getSession(sessionId);
  if (existing) {
    // Обновляем имя если передали
    if (name) existing.name = sanitize(name, 32);
    return res.json({ sessionId: existing.sessionId, name: existing.name, roomCode: existing.roomCode });
  }
  // Новая сессия
  const safeName = sanitize(name, 32) || 'Гость';
  const newId = createSession(safeName);
  res.json({ sessionId: newId, name: safeName, roomCode: null });
});

// Получить список открытых комнат
app.get('/api/rooms', (req, res) => {
  const list = Object.values(rooms)
    .filter(r => r.type === 'open' && r.members.size > 0)
    .map(r => ({
      code:    r.code,
      title:   r.title,
      members: r.members.size,
      videoUrl: r.videoUrl,
    }));
  res.json(list);
});

// ─── Утилита: HTTPS GET ────────────────────────────────────────────────────
function httpsGet(targetUrl, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new urlMod.URL(targetUrl);
    https.get({
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer':    'https://rutube.ru/',
        'Origin':     'https://rutube.ru',
        ...extraHeaders,
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

// ─── HLS: получить URL ─────────────────────────────────────────────────────
app.get('/api/rutube-hls', async (req, res) => {
  const id = String(req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) return res.status(400).json({ error: 'no id' });
  try {
    const apiUrl = `https://rutube.ru/api/play/options/${id}/?no_404=true&referer=https%3A%2F%2Frutube.ru&format=json`;
    const { body } = await httpsGet(apiUrl);
    const data = JSON.parse(body.toString());
    const hlsUrl = data?.video_balancer?.m3u8;
    if (!hlsUrl) return res.status(404).json({ error: 'HLS не найден. Видео приватное или недоступное.' });
    console.log(`[HLS] OK id=${id}`);
    res.json({ hlsUrl: `/api/hls-proxy?u=${encodeURIComponent(hlsUrl)}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── HLS: прокси сегментов ─────────────────────────────────────────────────
app.get('/api/hls-proxy', async (req, res) => {
  const targetUrl = req.query.u;
  if (!targetUrl) return res.status(400).send('no url');
  let parsed;
  try { parsed = new urlMod.URL(targetUrl); } catch { return res.status(400).send('bad url'); }
  if (!parsed.hostname.endsWith('rutube.ru') && !parsed.hostname.endsWith('cdnvideo.ru') && !parsed.hostname.endsWith('video.rutube.ru')) {
    return res.status(403).send('forbidden domain');
  }
  try {
    const { status, headers, body } = await httpsGet(targetUrl);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=30');
    if (targetUrl.includes('.m3u8') || (headers['content-type'] || '').includes('mpegurl')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const text = body.toString('utf8').split('\n').map(line => {
        const l = line.trim();
        if (!l || l.startsWith('#')) return l;
        const abs = l.startsWith('http') ? l : base + l;
        return `/api/hls-proxy?u=${encodeURIComponent(abs)}`;
      }).join('\n');
      return res.send(text);
    }
    res.setHeader('Content-Type', headers['content-type'] || 'video/mp2t');
    res.status(status).send(body);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// ─── Хранилище комнат ──────────────────────────────────────────────────────
// room.type = 'open' | 'closed'
const rooms = {};

function makeCode() {
  let code;
  do { code = Math.random().toString(36).slice(2, 8).toUpperCase(); } while (rooms[code]);
  return code;
}

function sanitize(str, max = 300) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, max);
}

function extractId(u) {
  const m = u.match(/rutube\.ru\/(?:video|play\/embed)\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// ─── Socket.IO ─────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[+] ${socket.id}`);

  // Привязать сессию к сокету
  socket.on('auth', ({ sessionId }) => {
    const session = getSession(sessionId);
    if (!session) { socket.emit('auth_fail'); return; }
    socket.sessionId = sessionId;
    socket.userName  = session.name;
    // Если сессия была в комнате — предлагаем переподключиться
    if (session.roomCode && rooms[session.roomCode]) {
      socket.emit('session_restore', { roomCode: session.roomCode, name: session.name });
    } else {
      socket.emit('auth_ok', { name: session.name });
    }
  });

  // Создать комнату
  socket.on('create_room', ({ name, videoUrl, type, title, sessionId }) => {
    const safeName  = sanitize(name, 32) || 'Хозяин';
    const safeUrl   = sanitize(videoUrl, 500);
    const safeType  = type === 'open' ? 'open' : 'closed';
    const safeTitle = sanitize(title, 60) || safeName + ' смотрит';
    const videoId   = extractId(safeUrl);
    if (!videoId) { socket.emit('error_msg', 'Не могу распознать ссылку Rutube'); return; }

    const code = makeCode();
    rooms[code] = {
      code,
      hostId:   socket.id,
      videoUrl: safeUrl,
      videoId,
      type:     safeType,
      title:    safeTitle,
      state:    'paused',
      time:     0,
      members:  new Set([socket.id]),
      names:    { [socket.id]: safeName },
    };

    socket.join(code);
    socket.roomCode  = code;
    socket.userName  = safeName;
    socket.sessionId = sessionId;

    // Запоминаем комнату в сессии
    const session = getSession(sessionId);
    if (session) { session.roomCode = code; session.name = safeName; }

    socket.emit('room_created', { code, videoId, videoUrl: safeUrl, type: safeType });
    console.log(`[ROOM] ${code} (${safeType}) — ${safeName}`);
  });

  // Войти по коду
  socket.on('join_room', ({ name, code, sessionId }) => {
    const safeName = sanitize(name, 32) || 'Гость';
    const safeCode = sanitize(code, 6).toUpperCase();
    const room = rooms[safeCode];
    if (!room) { socket.emit('error_msg', 'Комната не найдена — проверь код'); return; }

    _joinRoom(socket, room, safeName, sessionId);
  });

  // Войти через список открытых комнат
  socket.on('join_open_room', ({ name, code, sessionId }) => {
    const safeName = sanitize(name, 32) || 'Гость';
    const room = rooms[code];
    if (!room || room.type !== 'open') { socket.emit('error_msg', 'Комната не найдена'); return; }
    _joinRoom(socket, room, safeName, sessionId);
  });

  // Переподключение после разрыва (по сессии)
  socket.on('rejoin', ({ sessionId }) => {
    const session = getSession(sessionId);
    if (!session || !session.roomCode) { socket.emit('error_msg', 'Сессия не найдена'); return; }
    const room = rooms[session.roomCode];
    if (!room) { socket.emit('error_msg', 'Комната уже закрыта'); return; }
    _joinRoom(socket, room, session.name, sessionId);
    socket.emit('rejoined');
  });

  function _joinRoom(socket, room, safeName, sessionId) {
    room.members.add(socket.id);
    room.names[socket.id] = safeName;
    socket.join(room.code);
    socket.roomCode  = room.code;
    socket.userName  = safeName;
    socket.sessionId = sessionId;

    const session = getSession(sessionId);
    if (session) { session.roomCode = room.code; session.name = safeName; }

    socket.emit('room_joined', {
      code:     room.code,
      videoId:  room.videoId,
      videoUrl: room.videoUrl,
      state:    room.state,
      time:     room.time,
      count:    room.members.size,
      isHost:   room.hostId === socket.id,
      type:     room.type,
    });

    socket.to(room.code).emit('user_joined', { name: safeName, count: room.members.size });
    console.log(`[JOIN] ${safeName} → ${room.code}`);
  }

  // Управление плеером (только хост может seek)
  socket.on('player_action', ({ action, time }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    // Перемотку разрешаем только хосту
    if (action === 'seek' && socket.id !== room.hostId) return;
    if (typeof time === 'number' && isFinite(time) && time >= 0) room.time = time;
    if (action === 'play')  room.state = 'playing';
    if (action === 'pause') room.state = 'paused';
    if (action === 'seek')  room.state = 'paused';
    socket.to(socket.roomCode).emit('player_action', { action, time: room.time, name: socket.userName });
  });

  socket.on('time_update', ({ time }) => {
    const room = rooms[socket.roomCode];
    if (room && socket.id === room.hostId && typeof time === 'number') room.time = time;
  });

  socket.on('chat', ({ text }) => {
    const safeText = sanitize(text, 500);
    if (!safeText || !socket.roomCode) return;
    socket.to(socket.roomCode).emit('chat', { name: socket.userName, text: safeText });
  });

  socket.on('disconnect', () => {
    const code = socket.roomCode;
    const room = rooms[code];
    if (!room) return;

    room.members.delete(socket.id);
    delete room.names[socket.id];

    if (room.hostId === socket.id && room.members.size > 0) {
      room.hostId = [...room.members][0];
      io.to(room.hostId).emit('you_are_host');
    }
    socket.to(code).emit('user_left', { name: socket.userName, count: room.members.size });
    console.log(`[-] ${socket.userName} из ${code}`);

    if (room.members.size === 0) {
      setTimeout(() => {
        if (rooms[code]?.members.size === 0) { delete rooms[code]; console.log(`[DEL] ${code}`); }
      }, 600000);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 КиноВместе v4 запущен → http://localhost:${PORT}\n`);
});