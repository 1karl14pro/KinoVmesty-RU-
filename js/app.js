// ============================================================
//  app.js — инициализация, сессии, комнаты, socket events
//  Исправления:
//    - rejoinRoom: хрупкий querySelector заменён на ID (БАГ 7)
//    - roomMembers использует socket.id вместо 'me' (БАГ 11)
// ============================================================

mySessionId = getCookie('kv_session') || null;

window.addEventListener('DOMContentLoaded', async () => {
  // Восстановление сессии
  if (mySessionId) {
    try {
      const resp = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: mySessionId }),
      });
      const data = await resp.json();
      if (data.sessionId) {
        mySessionId = data.sessionId;
        setCookie('kv_session', mySessionId);
        if (data.name) {
          ['nameCreate', 'nameJoin', 'nameBrowse'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = data.name;
          });
        }
        if (data.roomCode) socket.emit('auth', { sessionId: mySessionId });
      }
    } catch {}
  }

  loadOpenRooms();

  // Код комнаты из URL (?room=ABC123)
  const roomFromUrl = new URLSearchParams(location.search).get('room');
  if (roomFromUrl) {
    switchTab('join');
    document.getElementById('codeInput').value = roomFromUrl.toUpperCase();
  }

  // Слушатель инпута чата для @упоминаний
  const inp = document.getElementById('chatInp');
  if (inp) {
    inp.addEventListener('input', () => {
      const m = inp.value.match(/@(\S*)$/);
      if (m) showMentionDropdown(m[1]);
      else   hideMentionDropdown();
    });
  }

  document.getElementById('invitePopup')?.addEventListener('click', closeInvitePopup);
  selectType('open');
  initSwipeGestures();
});

// ─── Сессии / авторизация ────────────────────────────────────

socket.on('session_restore', ({ roomCode, name, title }) => {
  const b = document.createElement('div');
  // БАГ 7: дан явный ID вместо поиска по стилю position:fixed
  b.id = 'session-restore-banner';
  b.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:300',
    'background:#1a1d2a', 'border-bottom:1px solid #252836',
    'padding:12px 20px', 'display:flex', 'align-items:center',
    'gap:12px', 'font-size:.85rem', 'animation:msgIn .3s ease',
  ].join(';');
  b.innerHTML = `
    <span>👋 Ты был в комнате <b>${title || roomCode}</b> как <b>${name}</b>. Вернуться?</span>
    <button onclick="rejoinRoom()"
      style="padding:6px 14px;border-radius:8px;border:none;background:#06d6a0;color:#0c0d12;font-weight:700;cursor:pointer;">
      Вернуться
    </button>
    <button onclick="this.parentNode.remove()"
      style="padding:6px 14px;border-radius:8px;border:1px solid #252836;background:transparent;color:#5c6080;cursor:pointer;">
      Нет
    </button>`;
  document.body.prepend(b);
});

// БАГ 7: используем ID вместо querySelector('[style*="position:fixed"]')
function rejoinRoom() {
  document.getElementById('session-restore-banner')?.remove();
  socket.emit('rejoin', { sessionId: mySessionId });
}

socket.on('auth_ok', () => {});

// ─── Табы ────────────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.stab[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'browse') loadOpenRooms();
}

function selectType(type) {
  selectedType = type;
  document.getElementById('typeOpen').classList.toggle('active', type === 'open');
  document.getElementById('typeClosed').classList.toggle('active', type === 'closed');
  document.getElementById('titleGroup').style.display = type === 'open' ? 'flex' : 'none';
}

// ─── Открытые комнаты ────────────────────────────────────────

async function loadOpenRooms() {
  const list = document.getElementById('roomsList');
  list.innerHTML = '<div class="rooms-empty">Загружаем...</div>';
  try {
    const data = await fetch('/api/rooms').then(r => r.json());
    if (!data.length) {
      list.innerHTML = '<div class="rooms-empty">Открытых комнат пока нет 🌚<br>Создай первую!</div>';
      return;
    }
    list.innerHTML = '';
    data.forEach(r => {
      const item = document.createElement('div');
      item.className = 'room-item';
      item.innerHTML = `
        <div class="room-item-icon">🎬</div>
        <div class="room-item-info">
          <div class="room-item-title">${esc(r.title)}</div>
          <div class="room-item-meta">👥 ${r.members} · ${esc(r.videoUrl.slice(0, 40))}...</div>
        </div>
        <button class="room-item-join" onclick="joinOpenRoom('${r.code}')">Войти</button>`;
      list.appendChild(item);
    });
  } catch {
    list.innerHTML = '<div class="rooms-empty">Ошибка загрузки 😕</div>';
  }
}

function joinOpenRoom(code) {
  socket.emit('join_open_room', {
    name: document.getElementById('nameBrowse').value.trim() || 'Гость',
    code,
    sessionId: mySessionId,
  });
}

// ─── Создание / вход ─────────────────────────────────────────

async function createRoom() {
  const name     = document.getElementById('nameCreate').value.trim() || 'Хозяин';
  const videoUrl = document.getElementById('urlCreate').value.trim();
  const title    = document.getElementById('titleCreate').value.trim();
  if (!videoUrl) { toast('Вставь ссылку на видео!', 'info'); return; }
  setBtn('createBtn', true, '<span class="spinner"></span> Создаём...');
  const s = await initSession(name);
  mySessionId = s.sessionId;
  myName      = s.name;
  socket.emit('create_room', {
    name: myName,
    videoUrl,
    type: selectedType,
    title: title || myName + ' смотрит',
    sessionId: mySessionId,
  });
}

async function joinRoom() {
  const name = document.getElementById('nameJoin').value.trim() || 'Гость';
  const code = document.getElementById('codeInput').value.trim().toUpperCase();
  if (!code) { toast('Введи код комнаты!', 'info'); return; }
  setBtn('joinBtn', true, '<span class="spinner"></span> Входим...');
  const s = await initSession(name);
  mySessionId = s.sessionId;
  myName      = s.name;
  socket.emit('join_room', { name: myName, code, sessionId: mySessionId });
}

async function pasteCode() {
  try {
    document.getElementById('codeInput').value =
      (await navigator.clipboard.readText()).trim().toUpperCase().slice(0, 6);
    toast('📋 Вставлено!', 'copy');
  } catch {
    toast('Вставь вручную: Ctrl+V', 'info');
  }
}

function enterApp(code, type) {
  myRoom   = code;
  roomType = type;
  document.getElementById('topCode').textContent = code;
  document.getElementById('topType').textContent = type === 'open' ? '🌐 Открытая' : '🔒 Закрытая';
  document.getElementById('setup').style.display = 'none';
  document.getElementById('app').style.display   = 'flex';
}

// ─── Socket: комнаты ─────────────────────────────────────────

socket.on('room_created', ({ code, videoId, videoUrl, platform, type }) => {
  isHost = true;
  setBtn('createBtn', false, '✨ Создать комнату');
  enterApp(code, type);
  document.getElementById('bigCode').textContent = code;
  const badge = document.getElementById('popupTypeBadge');
  badge.textContent = type === 'open' ? '🌐 Открытая — видна всем' : '🔒 Закрытая — только по коду';
  badge.className = 'popup-type-badge ' + type;
  document.getElementById('codePopup').classList.add('show');
  document.getElementById('hostBadge').classList.add('show');

  // БАГ 11: храним себя по socket.id, а не по строке 'me'
  roomMembers[socket.id] = myName;

  loadVideo(videoId, videoUrl, platform);
  addLog('Комната создана', 'sys');
});

socket.on('room_joined', async ({ code, videoId, videoUrl, platform, state, time, count, isHost: host, type, membersList, queue }) => {
  isHost   = host;
  setBtn('joinBtn', false, '🚀 Войти в комнату');
  enterApp(code, type);
  membersN = count;
  updateMembers();

  if (isHost) document.getElementById('hostBadge').classList.add('show');
  if (!isHost) document.getElementById('vidProgress').classList.add('guest-mode');

  // БАГ 11: храним себя по socket.id
  roomMembers[socket.id] = myName;

  if (membersList) membersList.forEach(m => { roomMembers[m.id] = m.name; });
  if (queue) { queueItems = queue; renderQueue(); }

  await loadVideo(videoId, videoUrl, platform);

  if (time > 0) {
    const doSync = () => {
      platformSeek(time);
      if (state === 'playing') {
        platformPlay();
        document.getElementById('bigPlay').textContent = '⏸';
      }
      document.getElementById('videoEl').removeEventListener('canplay', doSync);
    };
    if (currentPlatform === 'rutube') {
      const v = document.getElementById('videoEl');
      if (v.readyState >= 3) doSync();
      else v.addEventListener('canplay', doSync);
    } else {
      setTimeout(doSync, 1500);
    }
  } else {
    if (state === 'playing') {
      platformPlay();
      document.getElementById('bigPlay').textContent = '⏸';
    }
  }
  addLog('Ты вошёл в комнату', 'sys');
});

socket.on('rejoined', () => {
  toast('✅ Восстановлено подключение', 'play');
  addLog('Переподключение восстановлено', 'sys');
});

socket.on('you_are_host', () => {
  isHost = true;
  document.getElementById('hostBadge').classList.add('show');
  document.getElementById('vidProgress').classList.remove('guest-mode');
  toast('👑 Ты теперь хост!', 'info');
  addLog('👑 Ты теперь хозяин комнаты', 'sys');
  renderQueue();
});

// ─── Socket: пользователи ────────────────────────────────────

socket.on('user_joined', ({ name, count, id }) => {
  membersN = count;
  updateMembers();
  addMsg('', `${esc(name)} присоединился 👋`, 'sys');
  toast(`${esc(name)} в комнате!`, 'info');
  addLog(`${esc(name)} вошёл`, 'sys');
  if (id) { roomMembers[id] = name; memberIds.push(id); }
});

socket.on('user_left', ({ name, count, id }) => {
  membersN = count;
  updateMembers();
  addMsg('', `${esc(name)} вышел 👋`, 'sys');
  addLog(`${esc(name)} вышел`, 'sys');
  if (id) {
    delete roomMembers[id];
    memberIds = memberIds.filter(i => i !== id);
    if (peerConns[id])     { peerConns[id].close(); delete peerConns[id]; }
    if (remoteAudios[id])  { remoteAudios[id].remove(); delete remoteAudios[id]; }
  }
});

socket.on('error_msg', msg => {
  toast(msg, 'err');
  setBtn('createBtn', false, '✨ Создать комнату');
  setBtn('joinBtn',   false, '🚀 Войти в комнату');
});

socket.on('disconnect', () => {
  document.getElementById('dot').classList.remove('on');
  addLog('Соединение потеряно', 'sys');
});

socket.on('connect', () => {
  document.getElementById('dot').classList.add('on');
  if (mySessionId && myRoom) socket.emit('rejoin', { sessionId: mySessionId });
});

// ─── Попапы / инвайт ─────────────────────────────────────────

function showCodePopup()  { document.getElementById('bigCode').textContent = myRoom; document.getElementById('codePopup').classList.add('show'); }
function closePopup()     { document.getElementById('codePopup').classList.remove('show'); }
function copyCode()       { navigator.clipboard.writeText(myRoom).then(() => toast('📋 Код скопирован!', 'copy')); }
function copyLink()       { navigator.clipboard.writeText(`${location.origin}/?room=${myRoom}`).then(() => toast('🔗 Ссылка скопирована!', 'copy')); }

function shareRoom() {
  const l = `${location.origin}/?room=${myRoom}`;
  if (navigator.share) {
    navigator.share({ title: 'КиноВместе', text: `🎬 КиноВместе\nКод: ${myRoom}\nСсылка: ${l}`, url: l });
  } else {
    navigator.clipboard.writeText(l).then(() => toast('🔗 Скопировано!', 'copy'));
  }
}

function showInvitePopup() {
  document.getElementById('inviteLinkText').textContent = `${location.origin}/?room=${myRoom}`;
  const o = roomType === 'open';
  document.getElementById('iTypeOpen').classList.toggle('active', o);
  document.getElementById('iTypeClosed').classList.toggle('active', !o);
  document.getElementById('inviteTypeRow').style.display  = isHost ? 'flex'  : 'none';
  document.getElementById('inviteHostOnly').style.display = isHost ? 'none'  : 'block';
  document.getElementById('invitePopup').classList.add('show');
}

function closeInvitePopup() { document.getElementById('invitePopup').classList.remove('show'); }
function copyInviteLink()   { navigator.clipboard.writeText(`${location.origin}/?room=${myRoom}`).then(() => toast('🔗 Ссылка скопирована!', 'copy')); }

function changeRoomType(type) {
  if (!isHost) return;
  roomType = type;
  socket.emit('change_room_type', { type });
  document.getElementById('iTypeOpen').classList.toggle('active', type === 'open');
  document.getElementById('iTypeClosed').classList.toggle('active', type === 'closed');
  document.getElementById('topType').textContent = type === 'open' ? '🌐 Открытая' : '🔒 Закрытая';
  toast(type === 'open' ? '🌐 Комната теперь публичная' : '🔒 Комната теперь приватная', 'info');
}

socket.on('room_type_changed', ({ type, name }) => {
  roomType = type;
  document.getElementById('topType').textContent = type === 'open' ? '🌐 Открытая' : '🔒 Закрытая';
  addLog(`${name} сменил тип`, 'sys');
});