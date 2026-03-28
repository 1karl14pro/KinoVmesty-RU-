// ============================================================
<<<<<<< HEAD
// Файл: rooms.js
// Расположение: lib/rooms.js
// ============================================================

const crypto = require('crypto');
const { fetchVideoTitle, fetchThumbnail, extractVideo } = require('./proxy');
const { getLogger, closeLogger, isCodeUsed } = require('./roomLogger');
=======
//  lib/rooms.js — управление комнатами и socket handlers
// ============================================================

const crypto = require('crypto');
const { fetchVideoTitle, extractVideo } = require('./proxy');
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a

const rooms         = {};
const syncIntervals = {};

function makeCode() {
<<<<<<< HEAD
    let c;
    let attempts = 0;
    do {
        c = Math.random().toString(36).slice(2, 8).toUpperCase();
        if (++attempts >= 100) { c = c.slice(0, 4) + Math.random().toString(36).slice(2, 4).toUpperCase(); break; }
    } while (rooms[c] || isCodeUsed(c));
    return c;
}

function sanitize(str, max = 300) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, max);
=======
  let c;
  do { c = Math.random().toString(36).slice(2, 8).toUpperCase(); } while (rooms[c]);
  return c;
}
function sanitize(str, max = 300) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, max);
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
}

// ─── Синхронизация ────────────────────────────────────────────

function startSyncInterval(io, roomCode) {
<<<<<<< HEAD
    if (syncIntervals[roomCode]) return;
    syncIntervals[roomCode] = setInterval(() => {
        const room = rooms[roomCode];
        if (!room || room.members.size === 0) { stopSyncInterval(roomCode); return; }
        io.to(roomCode).emit('sync_time', { time: room.time, state: room.state, force: false });
    }, 1000);
}

function stopSyncInterval(roomCode) {
    if (syncIntervals[roomCode]) { clearInterval(syncIntervals[roomCode]); delete syncIntervals[roomCode]; }
}

function forceSyncRoom(io, roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    io.to(roomCode).emit('sync_time', { time: room.time, state: room.state, force: true });
}

// ─── REST ─────────────────────────────────────────────────────

function registerRoutes(app) {
    app.get('/api/rooms', (req, res) => {
        res.json(
            Object.values(rooms)
                .filter(r => r.type === 'open' && r.members.size > 0)
                .map(r => ({
                    code:       r.code,
                    title:      r.title,
                    videoTitle: r.videoTitle || null,  // ← добавить
                    members:    r.members.size,
                    platform:   r.platform,
                    videoId:    r.videoId,
                    thumbnail:  r.thumbnail || null,
                }))
        );
    });
=======
  if (syncIntervals[roomCode]) return;
  syncIntervals[roomCode] = setInterval(() => {
    const room = rooms[roomCode];
    if (!room || room.members.size === 0) { stopSyncInterval(roomCode); return; }
    io.to(roomCode).emit('sync_time', { time: room.time, state: room.state, force: false });
  }, 1000);
}

function stopSyncInterval(roomCode) {
  if (syncIntervals[roomCode]) { clearInterval(syncIntervals[roomCode]); delete syncIntervals[roomCode]; }
}

function forceSyncRoom(io, roomCode) {
  const room = rooms[roomCode]; if (!room) return;
  io.to(roomCode).emit('sync_time', { time: room.time, state: room.state, force: true });
}

// ─── REST: список открытых комнат ─────────────────────────────

function registerRoutes(app) {
  app.get('/api/rooms', (req, res) => {
    res.json(
      Object.values(rooms)
        .filter(r => r.type === 'open' && r.members.size > 0)
        .map(r => ({
          code:     r.code,
          title:    r.title,
          members:  r.members.size,
          videoUrl: r.videoUrl,
          platform: r.platform,
        }))
    );
  });
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
}

// ─── Socket handlers ──────────────────────────────────────────

function registerSocketHandlers(io, socket, sessions) {
<<<<<<< HEAD
    const getSession  = async id => id ? (await sessions.get(id)) || null : null;
    const saveSession = async s  => sessions.set ? sessions.set(s.sessionId, s) : null;

    // ── Авторизация ──────────────────────────────────────────────
    socket.on('auth', async ({ sessionId }) => {
        const session = await getSession(sessionId);
        if (!session) { socket.emit('auth_fail'); return; }
        socket.sessionId = sessionId;
        socket.userName  = session.name;

        if (session.roomCode && rooms[session.roomCode] && rooms[session.roomCode].members.size > 0) {
            socket.emit('session_restore', {
                roomCode: session.roomCode,
                name:     session.name,
                title:    rooms[session.roomCode]?.title || session.roomCode,
            });
        } else {
            session.roomCode = null;
            await saveSession(session);
            socket.emit('auth_ok', { name: session.name });
        }
    });

    // ── Создание комнаты ─────────────────────────────────────────
    socket.on('create_room', async ({ name, videoUrl, type, title, sessionId }) => {
        const safeName  = sanitize(name, 32) || 'Хозяин';
        const safeUrl   = sanitize(videoUrl, 500);
        const safeType  = type === 'open' ? 'open' : 'closed';
        const safeTitle = sanitize(title, 60) || safeName + ' смотрит';
        const video     = extractVideo(safeUrl);

        if (!video) { socket.emit('error_msg', 'Не могу распознать ссылку. Поддерживаются YouTube, VK Видео, Rutube'); return; }

        const code = makeCode();
        rooms[code] = {
            code, hostId: socket.id, videoUrl: safeUrl, videoId: video.id,
            platform: video.platform, type: safeType, title: safeTitle,
            state: 'paused', time: 0, members: new Set([socket.id]),
            names: { [socket.id]: safeName }, queue: [], deleteTimeout: null,
            thumbnail: null,
        };

        socket.join(code);
        socket.roomCode  = code;
        socket.userName  = safeName;
        socket.sessionId = sessionId;

        const session = await getSession(sessionId);
        if (session) { session.roomCode = code; session.name = safeName; await saveSession(session); }

        const logger = getLogger(code);
        logger.setCreator(socket, sessionId, safeName);
        logger.setRoomInfo({ title: safeTitle, type: safeType, videoId: video.id, videoUrl: safeUrl, platform: video.platform });
        logger.addMember(socket, sessionId, safeName);

        startSyncInterval(io, code);
        socket.emit('room_created', { code, videoId: video.id, videoUrl: safeUrl, platform: video.platform, type: safeType });
        console.log(`[ROOM] ${code} (${safeType}) ${video.platform} — ${safeName}`);

        // Асинхронно подгружаем превью
        fetchThumbnail(video.platform, video.id).then(url => {
            if (url && rooms[code]) {
                rooms[code].thumbnail = url;
                console.log(`[THUMB] ${code} → ${url}`);
            }
        }).catch(() => {});
        fetchVideoTitle(video.platform, video.id).then(title => {
            if (title && rooms[code]) rooms[code].videoTitle = title;
        }).catch(() => {});
    });

    // ── Вход в комнату ───────────────────────────────────────────
    socket.on('join_room', async ({ name, code, sessionId }) => {
        const safeName = sanitize(name, 32) || 'Гость';
        const room     = rooms[sanitize(code, 6).toUpperCase()];
        if (!room) { socket.emit('error_msg', 'Комната не найдена — проверь код'); return; }
        await _joinRoom(room, safeName, sessionId);
    });

    socket.on('join_open_room', async ({ name, code, sessionId }) => {
        const safeName = sanitize(name, 32) || 'Гость';
        const room     = rooms[code];
        if (!room || room.type !== 'open') { socket.emit('error_msg', 'Комната не найдена'); return; }
        await _joinRoom(room, safeName, sessionId);
    });

    socket.on('rejoin', async ({ sessionId }) => {
        const session = await getSession(sessionId);
        if (!session?.roomCode) { socket.emit('error_msg', 'Сессия не найдена'); return; }
        const room = rooms[session.roomCode];
        if (!room) {
            session.roomCode = null;
            await saveSession(session);
            socket.emit('error_msg', 'Комната уже закрыта');
            return;
        }
        await _joinRoom(room, session.name, sessionId);
        socket.emit('rejoined');
    });

    async function _joinRoom(room, safeName, sessionId) {
        room.members.add(socket.id);
        room.names[socket.id] = safeName;
        socket.join(room.code);
        socket.roomCode  = room.code;
        socket.userName  = safeName;
        socket.sessionId = sessionId;

        if (room.deleteTimeout) { clearTimeout(room.deleteTimeout); room.deleteTimeout = null; }

        const session = await getSession(sessionId);
        if (session) { session.roomCode = room.code; session.name = safeName; await saveSession(session); }

        const logger = getLogger(room.code);
        logger.addMember(socket, sessionId, safeName);
        startSyncInterval(io, room.code);

        socket.emit('room_joined', {
            code: room.code, videoId: room.videoId, videoUrl: room.videoUrl,
            platform: room.platform, state: room.state, time: room.time,
            count: room.members.size, isHost: room.hostId === socket.id,
            type: room.type,
            membersList: [...room.members].filter(id => id !== socket.id).map(id => ({ id, name: room.names[id] })),
            queue: room.queue,
        });

        socket.to(room.code).emit('user_joined', { name: safeName, count: room.members.size, id: socket.id });
        console.log(`[JOIN] ${safeName} → ${room.code}`);
    }

    // ── Плеер ────────────────────────────────────────────────────
    socket.on('time_update', ({ time }) => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.hostId) return;
        if (typeof time !== 'number' || !isFinite(time)) return;
        room.time = time;
        socket.to(socket.roomCode).emit('sync_time', { time, state: room.state, force: false });
    });

    socket.on('player_action', ({ action, time }) => {
        const room = rooms[socket.roomCode];
        if (!room) return;
        if (action === 'seek' && socket.id !== room.hostId) return;
        if (typeof time === 'number' && isFinite(time) && time >= 0) room.time = time;
        if (action === 'play')  room.state = 'playing';
        if (action === 'pause') room.state = 'paused';
        if (action === 'seek')  room.state = 'paused';
        socket.to(socket.roomCode).emit('player_action', { action, time: room.time, name: socket.userName });
        getLogger(socket.roomCode).addPlayerAction(action, room.time, socket.userName);
        setTimeout(() => forceSyncRoom(io, socket.roomCode), 100);
    });

    socket.on('change_room_type', ({ type }) => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.hostId) return;
        room.type = type === 'open' ? 'open' : 'closed';
        io.to(socket.roomCode).emit('room_type_changed', { type: room.type, name: socket.userName });
        getLogger(socket.roomCode).setRoomType(room.type, socket.userName);
    });

    // ── Чат ──────────────────────────────────────────────────────
    socket.on('chat', ({ text }) => {
        const safeText = sanitize(text, 500);
        if (!safeText || !socket.roomCode) return;
        getLogger(socket.roomCode).addChat(socket, socket.userName, safeText);
        socket.to(socket.roomCode).emit('chat', { name: socket.userName, text: safeText });
    });

    // ── WebRTC ───────────────────────────────────────────────────
    socket.on('mic_start', () => {
        socket.to(socket.roomCode).emit('mic_start', { from: socket.id, name: socket.userName });
        if (socket.roomCode) getLogger(socket.roomCode).addEvent('mic_start', { name: socket.userName });
    });
    socket.on('mic_stop',    () => socket.to(socket.roomCode).emit('mic_stop',    { from: socket.id }));
    socket.on('rtc_offer',   ({ to, offer })     => io.to(to).emit('rtc_offer',   { from: socket.id, offer }));
    socket.on('rtc_answer',  ({ to, answer })    => io.to(to).emit('rtc_answer',  { from: socket.id, answer }));
    socket.on('rtc_ice',     ({ to, candidate }) => io.to(to).emit('rtc_ice',     { from: socket.id, candidate }));

    // ── Очередь ──────────────────────────────────────────────────
    socket.on('queue_add', async ({ videoUrl }) => {
        const room = rooms[socket.roomCode];
        if (!room) return;
        const safeUrl = sanitize(videoUrl, 500);
        const vid     = extractVideo(safeUrl);
        if (!vid)                    { socket.emit('error_msg', 'Не могу распознать ссылку'); return; }
        if (room.queue.length >= 50) { socket.emit('error_msg', 'Очередь заполнена (макс. 50)'); return; }

        const item = { id: crypto.randomBytes(8).toString('hex'), videoUrl: safeUrl, videoId: vid.id, platform: vid.platform, title: null, addedBy: socket.userName, addedById: socket.id };
        room.queue.push(item);
        io.to(room.code).emit('queue_update', { queue: room.queue });
        getLogger(room.code).addQueueItem(item, 'added', socket.userName);

        const title = await fetchVideoTitle(vid.platform, vid.id);
        if (title) { item.title = title; io.to(room.code).emit('queue_update', { queue: room.queue }); }
    });

    socket.on('queue_add_playlist', ({ episodes, auto = false }) => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.hostId || !Array.isArray(episodes)) return;
        const logger = getLogger(room.code);
        let added = 0;
        for (const ep of episodes) {
            if (room.queue.length >= 50) break;
            const videoId  = ep.videoId || ep.id;
            const videoUrl = ep.videoUrl || (videoId ? `https://rutube.ru/video/${videoId}/` : null);
            if (!videoId || !videoUrl) continue;
            const item = { id: crypto.randomBytes(8).toString('hex'), videoUrl, videoId, platform: ep.platform || 'rutube', title: ep.title || null, addedBy: auto ? 'Система' : socket.userName, addedById: socket.id, auto, sourceChannel: ep.sourceChannel || null };
            room.queue.push(item);
            logger.addQueueItem(item, 'added_playlist', auto ? 'Система' : socket.userName);
            added++;
        }
        if (added > 0) { io.to(room.code).emit('queue_update', { queue: room.queue }); console.log(`[QUEUE] ${auto ? 'Авто' : socket.userName} +${added} → ${room.code}`); }
    });

    socket.on('queue_remove', ({ itemId }) => {
        const room = rooms[socket.roomCode];
        if (!room) return;
        const idx = room.queue.findIndex(i => i.id === itemId);
        if (idx === -1) return;
        if (socket.id !== room.hostId && room.queue[idx].addedById !== socket.id) return;
        const item = room.queue[idx];
        room.queue.splice(idx, 1);
        getLogger(room.code).addQueueItem(item, 'removed', socket.userName);
        io.to(room.code).emit('queue_update', { queue: room.queue });
    });

    socket.on('queue_move', ({ itemId, direction }) => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.hostId) return;
        const idx = room.queue.findIndex(i => i.id === itemId);
        if (idx === -1) return;
        const ni = direction === 'up' ? idx - 1 : idx + 1;
        if (ni < 0 || ni >= room.queue.length) return;
        [room.queue[idx], room.queue[ni]] = [room.queue[ni], room.queue[idx]];
        io.to(room.code).emit('queue_update', { queue: room.queue });
    });

    socket.on('queue_play_item', ({ itemId }) => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.hostId) return;
        const item = room.queue.find(i => i.id === itemId);
        if (!item) return;
        room.queue    = room.queue.filter(i => i.id !== itemId);
        room.videoId  = item.videoId; room.videoUrl = item.videoUrl;
        room.platform = item.platform; room.state = 'paused'; room.time = 0;
        const logger = getLogger(room.code);
        logger.addQueueItem(item, 'played', socket.userName);
        logger.addVideo({ videoId: item.videoId, videoUrl: item.videoUrl, platform: item.platform, title: item.title, addedBy: socket.userName, fromQueue: true });
        io.to(room.code).emit('queue_play_item', { item });
        io.to(room.code).emit('queue_update', { queue: room.queue });
    });

    socket.on('queue_next', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.hostId || !room.queue.length) return;
        const item = room.queue.shift();
        if (!item) return;
        room.videoId  = item.videoId; room.videoUrl = item.videoUrl;
        room.platform = item.platform; room.state = 'paused'; room.time = 0;
        const logger = getLogger(room.code);
        logger.addQueueItem(item, 'auto_played', 'Система');
        logger.addVideo({ videoId: item.videoId, videoUrl: item.videoUrl, platform: item.platform, title: item.title, addedBy: 'Авто-переход', fromQueue: true });
        io.to(room.code).emit('queue_next', { item, queue: room.queue });
    });

    socket.on('queue_clear', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.hostId) return;
        getLogger(room.code).addEvent('queue_cleared', { itemsCount: room.queue.length, by: socket.userName });
        room.queue = [];
        io.to(room.code).emit('queue_update', { queue: [] });
    });

    // ── Отключение ───────────────────────────────────────────────
    socket.on('disconnect', () => {
        const code = socket.roomCode;
        const room = rooms[code];
        if (!room) return;

        room.members.delete(socket.id);
        delete room.names[socket.id];

        const logger = getLogger(code);
        logger.removeMember(socket.id, socket.userName);

        if (room.hostId === socket.id && room.members.size > 0) {
            room.hostId = [...room.members][0];
            io.to(room.hostId).emit('you_are_host');
            logger.setNewHost(room.hostId, room.names[room.hostId]);
        }

        socket.to(code).emit('user_left', { name: socket.userName, count: room.members.size, id: socket.id });
        console.log(`[-] ${socket.userName} из ${code}`);

        if (room.members.size === 0) {
            logger._save();
            logger._saveTextReport();

            room.deleteTimeout = setTimeout(() => {
                if (rooms[code] && rooms[code].members.size === 0) {
                    closeLogger(code);
                    delete rooms[code];
                    stopSyncInterval(code);
                    console.log(`[DEL] ${code}`);
                }
            }, 600000);
        }
    });
=======
  const getSession = id => id ? sessions.get(id) || null : null;

  // ── Авторизация ──────────────────────────────────────────────
  socket.on('auth', ({ sessionId }) => {
    const session = getSession(sessionId);
    if (!session) { socket.emit('auth_fail'); return; }
    socket.sessionId = sessionId;
    socket.userName  = session.name;
    if (session.roomCode && rooms[session.roomCode]) {
      socket.emit('session_restore', {
        roomCode: session.roomCode,
        name:     session.name,
        title:    rooms[session.roomCode]?.title || session.roomCode,
      });
    } else {
      socket.emit('auth_ok', { name: session.name });
    }
  });

  // ── Создание комнаты ─────────────────────────────────────────
  socket.on('create_room', ({ name, videoUrl, type, title, sessionId }) => {
    const safeName  = sanitize(name, 32)  || 'Хозяин';
    const safeUrl   = sanitize(videoUrl, 500);
    const safeType  = type === 'open' ? 'open' : 'closed';
    const safeTitle = sanitize(title, 60) || safeName + ' смотрит';
    const video     = extractVideo(safeUrl);
    if (!video) { socket.emit('error_msg', 'Не могу распознать ссылку. Поддерживаются YouTube, VK Видео, Rutube'); return; }

    const code = makeCode();
    rooms[code] = {
      code, hostId: socket.id, videoUrl: safeUrl, videoId: video.id,
      platform: video.platform, type: safeType, title: safeTitle,
      state: 'paused', time: 0, members: new Set([socket.id]),
      names: { [socket.id]: safeName }, queue: [],
    };

    socket.join(code);
    socket.roomCode  = code;
    socket.userName  = safeName;
    socket.sessionId = sessionId;

    const session = getSession(sessionId);
    if (session) { session.roomCode = code; session.name = safeName; }

    startSyncInterval(io, code);
    socket.emit('room_created', { code, videoId: video.id, videoUrl: safeUrl, platform: video.platform, type: safeType });
    console.log(`[ROOM] ${code} (${safeType}) ${video.platform} — ${safeName}`);
  });

  // ── Вход в комнату ───────────────────────────────────────────
  socket.on('join_room', ({ name, code, sessionId }) => {
    const safeName = sanitize(name, 32) || 'Гость';
    const room     = rooms[sanitize(code, 6).toUpperCase()];
    if (!room) { socket.emit('error_msg', 'Комната не найдена — проверь код'); return; }
    _joinRoom(room, safeName, sessionId);
  });

  socket.on('join_open_room', ({ name, code, sessionId }) => {
    const safeName = sanitize(name, 32) || 'Гость';
    const room     = rooms[code];
    if (!room || room.type !== 'open') { socket.emit('error_msg', 'Комната не найдена'); return; }
    _joinRoom(room, safeName, sessionId);
  });

  socket.on('rejoin', ({ sessionId }) => {
    const session = getSession(sessionId);
    if (!session?.roomCode) { socket.emit('error_msg', 'Сессия не найдена'); return; }
    const room = rooms[session.roomCode];
    if (!room) { socket.emit('error_msg', 'Комната уже закрыта'); return; }
    _joinRoom(room, session.name, sessionId);
    socket.emit('rejoined');
  });

  function _joinRoom(room, safeName, sessionId) {
    room.members.add(socket.id);
    room.names[socket.id] = safeName;
    socket.join(room.code);
    socket.roomCode  = room.code;
    socket.userName  = safeName;
    socket.sessionId = sessionId;

    const session = getSession(sessionId);
    if (session) { session.roomCode = room.code; session.name = safeName; }

    startSyncInterval(io, room.code);

    socket.emit('room_joined', {
      code:        room.code,
      videoId:     room.videoId,
      videoUrl:    room.videoUrl,
      platform:    room.platform,
      state:       room.state,
      time:        room.time,
      count:       room.members.size,
      isHost:      room.hostId === socket.id,
      type:        room.type,
      membersList: [...room.members].filter(id => id !== socket.id).map(id => ({ id, name: room.names[id] })),
      queue:       room.queue,
    });

    socket.to(room.code).emit('user_joined', { name: safeName, count: room.members.size, id: socket.id });
    console.log(`[JOIN] ${safeName} → ${room.code}`);
  }

  // ── Плеер ────────────────────────────────────────────────────
  socket.on('time_update', ({ time }) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.hostId || typeof time !== 'number' || !isFinite(time)) return;
    room.time = time;
    socket.to(socket.roomCode).emit('sync_time', { time, state: room.state, force: false });
  });

  socket.on('player_action', ({ action, time }) => {
    const room = rooms[socket.roomCode]; if (!room) return;
    if (action === 'seek' && socket.id !== room.hostId) return;
    if (typeof time === 'number' && isFinite(time) && time >= 0) room.time = time;
    if (action === 'play')  room.state = 'playing';
    if (action === 'pause') room.state = 'paused';
    if (action === 'seek')  room.state = 'paused';
    socket.to(socket.roomCode).emit('player_action', { action, time: room.time, name: socket.userName });
    setTimeout(() => forceSyncRoom(io, socket.roomCode), 100);
  });

  socket.on('change_room_type', ({ type }) => {
    const room = rooms[socket.roomCode]; if (!room || socket.id !== room.hostId) return;
    room.type = type === 'open' ? 'open' : 'closed';
    io.to(socket.roomCode).emit('room_type_changed', { type: room.type, name: socket.userName });
  });

  // ── Чат ──────────────────────────────────────────────────────
  socket.on('chat', ({ text }) => {
    const safeText = sanitize(text, 500);
    if (!safeText || !socket.roomCode) return;
    socket.to(socket.roomCode).emit('chat', { name: socket.userName, text: safeText });
  });

  // ── WebRTC ───────────────────────────────────────────────────
  socket.on('mic_start',  () => socket.to(socket.roomCode).emit('mic_start', { from: socket.id, name: socket.userName }));
  socket.on('mic_stop',   () => socket.to(socket.roomCode).emit('mic_stop',  { from: socket.id }));
  socket.on('rtc_offer',  ({ to, offer })     => io.to(to).emit('rtc_offer',  { from: socket.id, offer }));
  socket.on('rtc_answer', ({ to, answer })    => io.to(to).emit('rtc_answer', { from: socket.id, answer }));
  socket.on('rtc_ice',    ({ to, candidate }) => io.to(to).emit('rtc_ice',    { from: socket.id, candidate }));

  // ── Очередь ──────────────────────────────────────────────────
  socket.on('queue_add', async ({ videoUrl }) => {
    const room = rooms[socket.roomCode]; if (!room) return;
    const safeUrl = sanitize(videoUrl, 500);
    const vid     = extractVideo(safeUrl);
    if (!vid) { socket.emit('error_msg', 'Не могу распознать ссылку'); return; }
    if (room.queue.length >= 50) { socket.emit('error_msg', 'Очередь заполнена (макс. 50)'); return; }

    const item = {
      id: crypto.randomBytes(8).toString('hex'),
      videoUrl: safeUrl, videoId: vid.id, platform: vid.platform,
      title: null, addedBy: socket.userName, addedById: socket.id,
    };
    room.queue.push(item);
    io.to(room.code).emit('queue_update', { queue: room.queue });

    const title = await fetchVideoTitle(vid.platform, vid.id);
    if (title) { item.title = title; io.to(room.code).emit('queue_update', { queue: room.queue }); }
  });

  socket.on('queue_add_playlist', ({ episodes, auto = false }) => {
    const room = rooms[socket.roomCode]; if (!room || socket.id !== room.hostId) return;
    if (!Array.isArray(episodes)) return;
    let added = 0;
    for (const ep of episodes) {
      if (room.queue.length >= 50) break;
      const videoId  = ep.videoId || ep.id;
      const videoUrl = ep.videoUrl || (videoId ? `https://rutube.ru/video/${videoId}/` : null);
      if (!videoId || !videoUrl) continue;
      room.queue.push({
        id: crypto.randomBytes(8).toString('hex'),
        videoUrl, videoId, platform: ep.platform || 'rutube',
        title: ep.title || null,
        addedBy: auto ? 'Система' : socket.userName,
        addedById: socket.id,
        auto,
        sourceChannel: ep.sourceChannel || null,
      });
      added++;
    }
    if (added > 0) {
      io.to(room.code).emit('queue_update', { queue: room.queue });
      console.log(`[QUEUE] ${auto ? 'Авто' : socket.userName} +${added} → ${room.code}`);
    } else {
      console.warn(`[QUEUE] 0 добавлено из ${episodes.length}`);
    }
  });

  socket.on('queue_remove', ({ itemId }) => {
    const room = rooms[socket.roomCode]; if (!room) return;
    const idx  = room.queue.findIndex(i => i.id === itemId); if (idx === -1) return;
    if (socket.id !== room.hostId && room.queue[idx].addedById !== socket.id) return;
    room.queue.splice(idx, 1);
    io.to(room.code).emit('queue_update', { queue: room.queue });
  });

  socket.on('queue_move', ({ itemId, direction }) => {
    const room = rooms[socket.roomCode]; if (!room || socket.id !== room.hostId) return;
    const idx  = room.queue.findIndex(i => i.id === itemId); if (idx === -1) return;
    const ni   = direction === 'up' ? idx - 1 : idx + 1;
    if (ni < 0 || ni >= room.queue.length) return;
    [room.queue[idx], room.queue[ni]] = [room.queue[ni], room.queue[idx]];
    io.to(room.code).emit('queue_update', { queue: room.queue });
  });

  socket.on('queue_play_item', ({ itemId }) => {
    const room = rooms[socket.roomCode]; if (!room || socket.id !== room.hostId) return;
    const item = room.queue.find(i => i.id === itemId); if (!item) return;
    room.queue      = room.queue.filter(i => i.id !== itemId);
    room.videoId    = item.videoId;
    room.videoUrl   = item.videoUrl;
    room.platform   = item.platform;
    room.state      = 'paused';
    room.time       = 0;
    io.to(room.code).emit('queue_play_item', { item });
    io.to(room.code).emit('queue_update',    { queue: room.queue });
  });

  socket.on('queue_next', () => {
    const room = rooms[socket.roomCode]; if (!room || socket.id !== room.hostId || !room.queue.length) return;
    const item  = room.queue.shift();
    room.videoId  = item.videoId;
    room.videoUrl = item.videoUrl;
    room.platform = item.platform;
    room.state    = 'paused';
    room.time     = 0;
    io.to(room.code).emit('queue_next', { item, queue: room.queue });
  });

  socket.on('queue_clear', () => {
    const room = rooms[socket.roomCode]; if (!room || socket.id !== room.hostId) return;
    room.queue = [];
    io.to(room.code).emit('queue_update', { queue: [] });
  });

  // ── Отключение ───────────────────────────────────────────────
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

    socket.to(code).emit('user_left', { name: socket.userName, count: room.members.size, id: socket.id });
    console.log(`[-] ${socket.userName} из ${code}`);

    if (room.members.size === 0) {
      setTimeout(() => {
        if (rooms[code]?.members.size === 0) {
          delete rooms[code];
          stopSyncInterval(code);
          console.log(`[DEL] ${code}`);
        }
      }, 600000); // 10 минут
    }
  });
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
}

module.exports = { registerRoutes, registerSocketHandlers };