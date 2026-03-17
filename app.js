// ============================================================
//  КиноВместе — app.js v5
// ============================================================

const socket = io();

// ─── Состояние ───────────────────────────────────────────────────────────────
let myName       = '';
let myRoom       = '';
let isHost       = false;
let membersN     = 1;
let msgN         = 0;
let roomType     = 'closed';
let hls          = null;
let isSeeking    = false;
let selectedType = 'open';

const video = document.getElementById('videoEl');

// ============================================================
//  СЕССИИ (куки)
// ============================================================

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name, value, days = 30) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

async function initSession(name) {
  const savedId = getCookie('kv_session');
  const resp = await fetch('/api/session', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: savedId, name }),
  });
  const data = await resp.json();
  setCookie('kv_session', data.sessionId);
  return data;
}

let mySessionId = getCookie('kv_session') || null;

window.addEventListener('DOMContentLoaded', async () => {
  if (mySessionId) {
    try {
      const resp = await fetch('/api/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: mySessionId }),
      });
      const data = await resp.json();
      if (data.sessionId) {
        mySessionId = data.sessionId;
        setCookie('kv_session', mySessionId);
        if (data.name) {
          document.getElementById('nameCreate').value = data.name;
          document.getElementById('nameJoin').value   = data.name;
          document.getElementById('nameBrowse').value = data.name;
        }
        if (data.roomCode) socket.emit('auth', { sessionId: mySessionId });
      }
    } catch (e) { console.warn('Ошибка проверки сессии:', e); }
  }
  loadOpenRooms();

  const params = new URLSearchParams(location.search);
  const roomFromUrl = params.get('room');
  if (roomFromUrl) {
    switchTab('join');
    document.getElementById('codeInput').value = roomFromUrl.toUpperCase();
  }

  const inp = document.getElementById('chatInp');
  if (inp) {
    inp.addEventListener('input', () => {
      const atMatch = inp.value.match(/@(\S*)$/);
      if (atMatch) showMentionDropdown(atMatch[1]);
      else hideMentionDropdown();
    });
  }

  document.getElementById('invitePopup')?.addEventListener('click', closeInvitePopup);
});

socket.on('session_restore', ({ roomCode, name }) => {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:300;
    background:#1a1d2a;border-bottom:1px solid #252836;
    padding:12px 20px;display:flex;align-items:center;gap:12px;
    font-size:.85rem;animation:msgIn .3s ease;
  `;
  banner.innerHTML = `
    <span>👋 Ты был в комнате <b>${roomCode}</b> как <b>${name}</b>. Вернуться?</span>
    <button onclick="rejoinRoom()" style="padding:6px 14px;border-radius:8px;border:none;background:#06d6a0;color:#0c0d12;font-weight:700;cursor:pointer;">Вернуться</button>
    <button onclick="this.parentNode.remove()" style="padding:6px 14px;border-radius:8px;border:1px solid #252836;background:transparent;color:#5c6080;cursor:pointer;">Нет</button>
  `;
  document.body.prepend(banner);
});

function rejoinRoom() {
  document.querySelector('[style*="position:fixed"]')?.remove();
  socket.emit('rejoin', { sessionId: mySessionId });
}

socket.on('auth_ok', () => {});

// ============================================================
//  ТАБЫ
// ============================================================

function switchTab(tab) {
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.stab[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'browse') loadOpenRooms();
}

function selectType(type) {
  selectedType = type;
  document.getElementById('typeOpen').classList.toggle('active',   type === 'open');
  document.getElementById('typeClosed').classList.toggle('active', type === 'closed');
  document.getElementById('titleGroup').style.display = type === 'open' ? 'flex' : 'none';
}
selectType('open');

async function loadOpenRooms() {
  const list = document.getElementById('roomsList');
  list.innerHTML = '<div class="rooms-empty">Загружаем...</div>';
  try {
    const resp = await fetch('/api/rooms');
    const data = await resp.json();
    if (!data.length) { list.innerHTML = '<div class="rooms-empty">Открытых комнат пока нет 🌚<br>Создай первую!</div>'; return; }
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
        <button class="room-item-join" onclick="joinOpenRoom('${r.code}')">Войти</button>
      `;
      list.appendChild(item);
    });
  } catch (e) { list.innerHTML = '<div class="rooms-empty">Ошибка загрузки 😕</div>'; }
}

function joinOpenRoom(code) {
  const name = document.getElementById('nameBrowse').value.trim() || 'Гость';
  socket.emit('join_open_room', { name, code, sessionId: mySessionId });
}

// ============================================================
//  СОЗДАНИЕ / ВХОД
// ============================================================

async function createRoom() {
  const name     = document.getElementById('nameCreate').value.trim() || 'Хозяин';
  const videoUrl = document.getElementById('urlCreate').value.trim();
  const title    = document.getElementById('titleCreate').value.trim();
  if (!videoUrl) { toast('Вставь ссылку на видео!', 'info'); return; }
  setBtn('createBtn', true, '<span class="spinner"></span> Создаём...');
  const session = await initSession(name);
  mySessionId = session.sessionId;
  myName = session.name;
  socket.emit('create_room', { name: myName, videoUrl, type: selectedType, title: title || myName + ' смотрит', sessionId: mySessionId });
}

async function joinRoom() {
  const name = document.getElementById('nameJoin').value.trim() || 'Гость';
  const code = document.getElementById('codeInput').value.trim().toUpperCase();
  if (!code) { toast('Введи код комнаты!', 'info'); return; }
  setBtn('joinBtn', true, '<span class="spinner"></span> Входим...');
  const session = await initSession(name);
  mySessionId = session.sessionId;
  myName = session.name;
  socket.emit('join_room', { name: myName, code, sessionId: mySessionId });
}

async function pasteCode() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('codeInput').value = text.trim().toUpperCase().slice(0, 6);
    toast('📋 Вставлено!', 'copy');
  } catch (e) { toast('Вставь вручную: Ctrl+V', 'info'); }
}

function enterApp(code, type) {
  myRoom = code; roomType = type;
  document.getElementById('topCode').textContent = code;
  document.getElementById('topType').textContent = type === 'open' ? '🌐 Открытая' : '🔒 Закрытая';
  document.getElementById('setup').style.display = 'none';
  document.getElementById('app').style.display   = 'flex';
}

// ✅ platform деструктурируется
socket.on('room_created', ({ code, videoId, videoUrl, platform, type }) => {
  isHost = true;
  setBtn('createBtn', false, '✨ Создать комнату');
  enterApp(code, type);
  document.getElementById('bigCode').textContent = code;
  const badge = document.getElementById('popupTypeBadge');
  badge.textContent = type === 'open' ? '🌐 Открытая — видна всем' : '🔒 Закрытая — только по коду';
  badge.className   = 'popup-type-badge ' + type;
  document.getElementById('codePopup').classList.add('show');
  document.getElementById('hostBadge').classList.add('show');
  roomMembers['me'] = myName;
  loadVideo(videoId, videoUrl, platform);
  addLog('Комната создана', 'sys');
});

// ✅ platform деструктурируется
socket.on('room_joined', async ({ code, videoId, videoUrl, platform, state, time, count, isHost: host, type, membersList }) => {
  isHost = host;
  setBtn('joinBtn', false, '🚀 Войти в комнату');
  enterApp(code, type);
  membersN = count; updateMembers();
  if (isHost) document.getElementById('hostBadge').classList.add('show');
  if (!isHost) document.getElementById('vidProgress').classList.add('guest-mode');
  roomMembers['me'] = myName;
  if (membersList) membersList.forEach(m => { roomMembers[m.id] = m.name; });
  await loadVideo(videoId, videoUrl, platform);
  if (time > 1) {
    const syncTime = () => { platformSeek(time); if (state === 'playing') platformPlay(); video.removeEventListener('canplay', syncTime); };
    if (currentPlatform === 'rutube') { if (video.readyState >= 3) syncTime(); else video.addEventListener('canplay', syncTime); }
    else setTimeout(syncTime, 1500);
  } else {
    if (state === 'playing') platformPlay();
  }
  addLog('Ты вошёл в комнату', 'sys');
});

socket.on('rejoined', () => { toast('✅ Восстановлено подключение', 'play'); addLog('Переподключение восстановлено', 'sys'); });

socket.on('you_are_host', () => {
  isHost = true;
  document.getElementById('hostBadge').classList.add('show');
  document.getElementById('vidProgress').classList.remove('guest-mode');
  toast('👑 Ты теперь хост!', 'info');
  addLog('👑 Ты теперь хозяин комнаты', 'sys');
});

// ============================================================
//  ПОЛЬЗОВАТЕЛИ
// ============================================================

socket.on('user_joined', ({ name, count, id }) => {
  membersN = count; updateMembers();
  addMsg('', `${esc(name)} присоединился 👋`, 'sys');
  toast(`${esc(name)} в комнате!`, 'info');
  addLog(`${esc(name)} вошёл в комнату`, 'sys');
  if (id) { roomMembers[id] = name; memberIds.push(id); }
});

socket.on('user_left', ({ name, count, id }) => {
  membersN = count; updateMembers();
  addMsg('', `${esc(name)} вышел 👋`, 'sys');
  addLog(`${esc(name)} вышел`, 'sys');
  if (id) {
    delete roomMembers[id];
    memberIds = memberIds.filter(i => i !== id);
    if (peerConns[id])    { peerConns[id].close();     delete peerConns[id]; }
    if (remoteAudios[id]) { remoteAudios[id].remove(); delete remoteAudios[id]; }
  }
});

socket.on('error_msg', msg => {
  toast(msg, 'err');
  setBtn('createBtn', false, '✨ Создать комнату');
  setBtn('joinBtn',   false, '🚀 Войти в комнату');
});

socket.on('disconnect', () => {
  document.getElementById('dot').classList.remove('on');
  document.getElementById('statusTxt').textContent = 'Соединение потеряно...';
  addLog('Соединение потеряно', 'sys');
});

socket.on('connect', () => {
  document.getElementById('dot').classList.add('on');
  document.getElementById('statusTxt').textContent = 'Онлайн';
  if (mySessionId && myRoom) socket.emit('rejoin', { sessionId: mySessionId });
});

// ============================================================
//  ПЛАТФОРМЫ
// ============================================================

let selectedPlatform = 'rutube';

const PLATFORM_INFO = {
  rutube:  { label: 'Rutube',   hint: 'Вставь ссылку: https://rutube.ru/video/...',       placeholder: 'https://rutube.ru/video/...' },
  youtube: { label: 'YouTube',  hint: 'Вставь ссылку: https://youtube.com/watch?v=...',   placeholder: 'https://youtube.com/watch?v=...' },
  vk:      { label: 'VK Видео', hint: 'Вставь ссылку: https://vkvideo.ru/video-123_456', placeholder: 'https://vkvideo.ru/video-123_456' },
};

function selectPlatform(platform) {
  selectedPlatform = platform;
  document.querySelectorAll('.platform-opt').forEach(el => el.classList.remove('active'));
  document.getElementById(`plt-${platform}`).classList.add('active');
  const info = PLATFORM_INFO[platform];
  document.getElementById('urlLabel').textContent     = `Ссылка на видео ${info.label}`;
  document.getElementById('urlCreate').placeholder    = info.placeholder;
  document.getElementById('platformHint').textContent = info.hint;
}

// ============================================================
//  ПЛЕЕР — мультиплатформа
// ============================================================

let currentPlatform = 'rutube';
let ytPlayer        = null;
let ytReady         = false;

window.onYouTubeIframeAPIReady = function() { ytReady = true; };

function loadYouTubeAPI() {
  if (document.getElementById('yt-api-script')) return;
  const tag = document.createElement('script');
  tag.id = 'yt-api-script'; tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}
loadYouTubeAPI();

async function loadVideo(videoId, videoUrl, platform) {
  currentPlatform = platform || 'rutube';
  showLoading(true);
  document.getElementById('vidError').classList.remove('show');
  document.getElementById('urlDisplay').textContent = videoUrl;
  const oldFrame = document.getElementById('embedFrame');
  if (oldFrame) oldFrame.remove();
  if (hls)      { hls.destroy(); hls = null; }
  if (ytPlayer) { try { ytPlayer.destroy(); } catch(e){} ytPlayer = null; }
  if (platform === 'youtube')  await loadYouTube(videoId);
  else if (platform === 'vk')  await loadVK(videoId);
  else                         await loadRutube(videoId);
}

async function loadRutube(videoId) {
  document.getElementById('videoEl').style.display = 'block';
  let hlsUrl;
  try {
    const resp = await fetch(`/api/rutube-hls?id=${encodeURIComponent(videoId)}`);
    const data = await resp.json();
    if (!resp.ok || !data.hlsUrl) throw new Error(data.error || 'нет hlsUrl');
    hlsUrl = data.hlsUrl;
  } catch (e) { showError(`Ошибка HLS: ${e.message}`); return; }
  if (Hls.isSupported()) {
    hls = new Hls({ enableWorker: true });
    hls.loadSource(hlsUrl); hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      showLoading(false);
      const overlay = document.getElementById('vidOverlay');
      overlay.classList.add('force-show');
      setTimeout(() => overlay.classList.remove('force-show'), 2000);
    });
    hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) showError('Ошибка HLS — ' + d.type); });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = hlsUrl; showLoading(false);
  } else { showError('Браузер не поддерживает HLS.'); }
}

function loadYouTube(videoId) {
  return new Promise(resolve => {
    document.getElementById('videoEl').style.display = 'none';
    const wrap = document.getElementById('videoWrap');
    const div  = document.createElement('div');
    div.id = 'embedFrame'; div.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    wrap.appendChild(div);
    let syncInterval = null;
    const tryCreate = () => {
      ytPlayer = new YT.Player('embedFrame', {
        videoId,
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => { showLoading(false); resolve(); },
          onError: (e) => { showError('YouTube: видео недоступно (' + e.data + ')'); resolve(); },
          onStateChange: (e) => {
            if (isHost && e.data === YT.PlayerState.PLAYING) {
              if (syncInterval) clearInterval(syncInterval);
              syncInterval = setInterval(() => { if (ytPlayer && isHost) socket.emit('time_update', { time: ytPlayer.getCurrentTime() }); }, 3000);
            } else if (e.data === YT.PlayerState.PAUSED) {
              if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
            }
          }
        }
      });
    };
    if (ytReady && typeof YT !== 'undefined') tryCreate();
    else { window.onYouTubeIframeAPIReady = () => { ytReady = true; tryCreate(); }; }
  });
}

function loadVK(videoId) {
  return new Promise(resolve => {
    document.getElementById('videoEl').style.display = 'none';
    const wrap = document.getElementById('videoWrap');
    const [oid, id] = videoId.split('_');
    const iframe = document.createElement('iframe');
    iframe.id  = 'embedFrame';
    iframe.src = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&autoplay=0&js_api=1`;
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
    iframe.allow = 'autoplay; fullscreen'; iframe.allowFullscreen = true;
    iframe.onload  = () => { showLoading(false); resolve(); };
    iframe.onerror = () => { showError('VK: не удалось загрузить видео'); resolve(); };
    wrap.appendChild(iframe);
  });
}

function platformPlay() {
  if (currentPlatform === 'youtube' && ytPlayer) ytPlayer.playVideo();
  else if (currentPlatform === 'vk') sendVKCmd('play');
  else video.play().catch(() => {});
}
function platformPause() {
  if (currentPlatform === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
  else if (currentPlatform === 'vk') sendVKCmd('pause');
  else video.pause();
}
function platformSeek(time) {
  if (currentPlatform === 'youtube' && ytPlayer) ytPlayer.seekTo(time, true);
  else if (currentPlatform !== 'vk') video.currentTime = time;
}
function platformGetTime() {
  if (currentPlatform === 'youtube' && ytPlayer) return ytPlayer.getCurrentTime() || 0;
  return video.currentTime || 0;
}
function platformIsPlaying() {
  if (currentPlatform === 'youtube' && ytPlayer) return ytPlayer.getPlayerState() === YT.PlayerState.PLAYING;
  return !video.paused;
}
function sendVKCmd(cmd) {
  const frame = document.getElementById('embedFrame');
  if (frame?.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ method: cmd }), '*');
}

video.addEventListener('timeupdate', () => {
  if (isSeeking || currentPlatform !== 'rutube') return;
  const cur = video.currentTime, dur = video.duration || 0;
  if (dur > 0) {
    document.getElementById('vidProgress').value = (cur / dur) * 100;
    document.getElementById('vidTime').textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
  }
  if (isHost && Math.floor(cur) % 3 === 0) socket.emit('time_update', { time: cur });
});
video.addEventListener('waiting', () => showLoading(true));
video.addEventListener('playing', () => showLoading(false));
video.addEventListener('canplay', () => showLoading(false));

// ============================================================
//  УПРАВЛЕНИЕ ПЛЕЕРОМ
// ============================================================

function togglePlay() {
  if (platformIsPlaying()) playerAction('pause');
  else                     playerAction('play');
}

function playerAction(action) {
  const time = platformGetTime();
  if (action === 'play')  { platformPlay();  document.getElementById('bigPlay').textContent = '⏸'; addLog('▶ Ты запустил видео', 'play'); }
  if (action === 'pause') { platformPause(); document.getElementById('bigPlay').textContent = '▶'; addLog('⏸ Ты поставил паузу', 'pause'); }
  socket.emit('player_action', { action, time });
}

function onSeekInput(el) {
  if (!isHost || currentPlatform !== 'rutube') return;
  isSeeking = true;
  const t = (el.value / 100) * (video.duration || 0);
  document.getElementById('vidTime').textContent = `${fmtTime(t)} / ${fmtTime(video.duration || 0)}`;
}
function onSeekChange(el) {
  if (!isHost || currentPlatform !== 'rutube') return;
  isSeeking = false;
  const t = (el.value / 100) * (video.duration || 0);
  platformSeek(t);
  socket.emit('player_action', { action: 'seek', time: t });
  addLog(`🔄 Перемотка на ${fmtTime(t)}`, 'seek');
}

socket.on('player_action', ({ action, time, name }) => {
  if (action === 'play')  { platformPlay();  document.getElementById('bigPlay').textContent = '⏸'; toast(`▶ ${esc(name)} запустил видео`, 'play');          addLog(`▶ ${esc(name)} запустил видео`, 'play'); }
  if (action === 'pause') { platformPause(); document.getElementById('bigPlay').textContent = '▶'; toast(`⏸ ${esc(name)} поставил паузу`, 'pause');         addLog(`⏸ ${esc(name)} поставил паузу`, 'pause'); }
  if (action === 'seek')  { platformSeek(time); platformPlay(); document.getElementById('bigPlay').textContent = '⏸'; toast(`🔄 ${esc(name)} перемотал на ${fmtTime(time)}`, 'info'); addLog(`🔄 ${esc(name)} перемотал на ${fmtTime(time)}`, 'seek'); }
});

// ============================================================
//  ГРОМКОСТЬ
// ============================================================

function onVolumeChange(el) { video.volume = parseFloat(el.value); video.muted = video.volume === 0; updateVolBtn(); }
function toggleMute() { video.muted = !video.muted; document.getElementById('volSlider').value = video.muted ? 0 : video.volume; updateVolBtn(); }
function updateVolBtn() {
  const btn = document.getElementById('volBtn');
  if (video.muted || video.volume === 0) btn.textContent = '🔇';
  else if (video.volume < 0.5)           btn.textContent = '🔉';
  else                                   btn.textContent = '🔊';
}

// ============================================================
//  ФУЛЛСКРИН
// ============================================================

function toggleFullscreen() {
  const wrap = document.getElementById('videoWrap');
  if (!document.fullscreenElement) wrap.requestFullscreen().catch(() => toast('Фуллскрин недоступен', 'err'));
  else document.exitFullscreen();
}
document.addEventListener('fullscreenchange', () => {
  const btn = document.querySelector('.fs-btn');
  if (btn) btn.textContent = document.fullscreenElement ? '✕' : '⛶';
});

// ============================================================
//  ЗАГРУЗКА / ОШИБКА
// ============================================================

function showLoading(yes) { document.getElementById('vidLoading').classList.toggle('show', yes); }
function showError(msg) {
  document.getElementById('vidLoading').classList.remove('show');
  document.getElementById('vidError').classList.add('show');
  document.getElementById('vidErrorText').textContent = msg || 'Не удалось загрузить видео';
}

// ============================================================
//  ЛОГИ
// ============================================================

function addLog(text, type = 'sys') {
  const body = document.getElementById('logsBody');
  const div  = document.createElement('div');
  div.className = `log-entry log-${type}`;
  const t = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  div.innerHTML = `<span class="log-time">${t}</span>${text}`;
  body.appendChild(div); body.scrollTop = body.scrollHeight;
}
function toggleLogs() { document.getElementById('logsPanel').classList.toggle('show'); document.querySelector('.logs-toggle-btn').classList.toggle('active'); }
function clearLogs() { document.getElementById('logsBody').innerHTML = ''; }

// ============================================================
//  ЧАТ
// ============================================================

function sendMsg() {
  const inp  = document.getElementById('chatInp');
  const text = inp.value.trim().slice(0, 500);
  if (!text) return;
  addMsg(myName, text, 'me');
  socket.emit('chat', { text });
  inp.value = ''; inp.style.height = 'auto';
  hideMentionDropdown();
}

socket.on('chat', ({ name, text }) => addMsg(name, text, 'other'));

function formatMsgText(text) {
  return esc(text).replace(/@(\S+)/g, (match, name) => {
    const isMe = name === myName;
    return `<span class="mention${isMe ? ' mention-me' : ''}">${match}</span>`;
  });
}

// ============================================================
//  CODE POPUP
// ============================================================

function showCodePopup() { document.getElementById('bigCode').textContent = myRoom; document.getElementById('codePopup').classList.add('show'); }
function closePopup()    { document.getElementById('codePopup').classList.remove('show'); }
function copyCode()      { navigator.clipboard.writeText(myRoom).then(() => toast('📋 Код скопирован!', 'copy')); }
function copyLink()      { navigator.clipboard.writeText(`${location.origin}/?room=${myRoom}`).then(() => toast('🔗 Ссылка скопирована!', 'copy')); }
function shareRoom() {
  const link = `${location.origin}/?room=${myRoom}`;
  if (navigator.share) navigator.share({ title: 'КиноВместе', text: `🎬 КиноВместе\nКод: ${myRoom}\nСсылка: ${link}`, url: link });
  else navigator.clipboard.writeText(link).then(() => toast('🔗 Скопировано!', 'copy'));
}

// ============================================================
//  ХЕЛПЕРЫ
// ============================================================

function updateMembers() { document.getElementById('membersCount').textContent = `👥 ${membersN}`; }
function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 90) + 'px'; }
function stopEv(e) { e.stopPropagation(); }
function setBtn(id, dis, html) { const b = document.getElementById(id); if (!b) return; b.disabled = dis; b.innerHTML = html; }

let toastTimer;
function toast(text, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = text; el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function addMsg(name, text, type) {
  const msgs = document.getElementById('msgs');
  const div  = document.createElement('div');
  div.className = `msg ${type}`;
  const t = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    ${type === 'other' ? `<div class="msg-meta">${esc(name)}</div>` : ''}
    <div class="bubble">${formatMsgText(text)}</div>
    <div class="msg-meta">${t}</div>`;
  msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
  if (type !== 'sys') document.getElementById('msgCount').textContent = ++msgN;
}

function fmtTime(s) { s = Math.floor(s || 0); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ============================================================
//  @ УПОМИНАНИЯ
// ============================================================

const roomMembers = {};
let mentionDropdownOpen = false;

function insertMention() {
  const inp = document.getElementById('chatInp');
  inp.value += '@'; inp.focus();
  showMentionDropdown('');
}

function showMentionDropdown(filter = '') {
  const dropdown = document.getElementById('mentionDropdown');
  const names = Object.values(roomMembers).filter(n => n !== myName && n.toLowerCase().startsWith(filter.toLowerCase()));
  if (!names.length) { hideMentionDropdown(); return; }
  dropdown.innerHTML = '';
  names.forEach(name => {
    const item = document.createElement('div');
    item.className = 'mention-item';
    item.innerHTML = `<span class="mention-avatar">${name[0].toUpperCase()}</span><span>${esc(name)}</span>`;
    item.onclick = () => selectMention(name);
    dropdown.appendChild(item);
  });
  dropdown.classList.add('show');
  mentionDropdownOpen = true;
}

function hideMentionDropdown() {
  document.getElementById('mentionDropdown')?.classList.remove('show');
  mentionDropdownOpen = false;
}

function selectMention(name) {
  const inp = document.getElementById('chatInp');
  inp.value = inp.value.replace(/@\S*$/, `@${name} `);
  inp.focus(); autoResize(inp); hideMentionDropdown();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.chat-inp-area')) {
    hideMentionDropdown();
    emojiPickerOpen = false;
    document.getElementById('emojiPicker')?.classList.remove('show');
  }
});

// ============================================================
//  ЭМОДЗИ ПИКЕР
// ============================================================

const EMOJIS = [
  '😀','😂','🥹','😍','🥰','😎','🤩','😭','😡','🤔',
  '👍','👎','❤️','🔥','💯','✨','🎉','🎬','🍿','👀',
  '😴','🤣','😱','🥳','😏','🤗','😶','🫡','💀','🗿',
  '👋','🙌','🤝','💪','🫶','🙏','👏','🤌','😤','🫠',
];

let emojiPickerOpen = false;

function buildEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  if (grid.children.length) return;
  EMOJIS.forEach(e => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn'; btn.textContent = e;
    btn.onclick = () => insertEmoji(e);
    grid.appendChild(btn);
  });
}

function toggleEmojiPicker() {
  emojiPickerOpen = !emojiPickerOpen;
  buildEmojiGrid();
  document.getElementById('emojiPicker').classList.toggle('show', emojiPickerOpen);
  if (emojiPickerOpen) hideMentionDropdown();
}

function insertEmoji(emoji) {
  const inp = document.getElementById('chatInp');
  const pos = inp.selectionStart;
  inp.value = inp.value.slice(0, pos) + emoji + inp.value.slice(pos);
  inp.focus(); inp.selectionStart = inp.selectionEnd = pos + emoji.length;
  autoResize(inp);
  emojiPickerOpen = false;
  document.getElementById('emojiPicker').classList.remove('show');
}

// ============================================================
//  МИКРОФОН
// ============================================================

let micStream      = null;
let peerConns      = {};
let memberIds      = [];
let micActive      = false;
let micHoldTimer   = null;
let holdActivated  = false;
const DUCK_VOL     = 0.15;
const remoteAudios = {};

function duckVolume(yes) {
  video.volume = yes ? DUCK_VOL : 1;
  document.getElementById('volSlider').value = yes ? DUCK_VOL : 1;
  updateVolBtn();
}

function makePeerConn(remoteId) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.onicecandidate = e => { if (e.candidate) socket.emit('rtc_ice', { to: remoteId, candidate: e.candidate }); };
  pc.ontrack = e => {
    let audio = remoteAudios[remoteId];
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true; audio.playsInline = true;
      document.body.appendChild(audio);
      remoteAudios[remoteId] = audio;
    }
    audio.srcObject = e.streams[0];
    audio.play().catch(err => console.warn('audio play:', err));
  };
  if (micStream) micStream.getTracks().forEach(t => pc.addTrack(t, micStream));
  peerConns[remoteId] = pc;
  return pc;
}

async function startMicStream() {
  if (micStream) return true;
  try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); return true; }
  catch (e) { toast('❌ Нет доступа к микрофону', 'err'); return false; }
}

async function activateMic() {
  if (micActive) return;
  const ok = await startMicStream();
  if (!ok) return;
  micActive = true;
  socket.emit('mic_start');
  duckVolume(true);
  document.getElementById('micBtn').classList.add('active');
  for (const id of memberIds) {
    const pc = makePeerConn(id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('rtc_offer', { to: id, offer });
  }
}

function deactivateMic() {
  if (!micActive) return;
  micActive = false;
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  Object.values(peerConns).forEach(pc => pc.close());
  peerConns = {};
  socket.emit('mic_stop');
  duckVolume(false);
  document.getElementById('micBtn').classList.remove('active');
}

function onMicDown() {
  holdActivated = false;
  micHoldTimer = setTimeout(async () => { holdActivated = true; await activateMic(); }, 300);
}
function onMicUp(e) {
  if (e) e.preventDefault();
  clearTimeout(micHoldTimer);
  if (holdActivated) { deactivateMic(); setTimeout(() => { holdActivated = false; }, 100); }
}
function toggleMic() {
  if (holdActivated) { holdActivated = false; return; }
  if (micActive) deactivateMic(); else activateMic();
}

socket.on('rtc_offer', async ({ from, offer }) => {
  const pc = makePeerConn(from);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('rtc_answer', { to: from, answer });
  duckVolume(true);
});
socket.on('rtc_answer', async ({ from, answer }) => { if (peerConns[from]) await peerConns[from].setRemoteDescription(answer); });
socket.on('rtc_ice',    async ({ from, candidate }) => { if (peerConns[from]) await peerConns[from].addIceCandidate(candidate); });
socket.on('mic_start', ({ name }) => { toast(`🎤 ${esc(name)} говорит...`, 'info'); addLog(`🎤 ${esc(name)} включил микрофон`, 'sys'); duckVolume(true); });
socket.on('mic_stop',  () => { duckVolume(false); });

// ============================================================
//  INVITE POPUP
// ============================================================

function showInvitePopup() {
  document.getElementById('inviteLinkText').textContent = `${location.origin}/?room=${myRoom}`;
  const isOpen = roomType === 'open';
  document.getElementById('iTypeOpen').classList.toggle('active', isOpen);
  document.getElementById('iTypeClosed').classList.toggle('active', !isOpen);
  document.getElementById('inviteTypeRow').style.display  = isHost ? 'flex' : 'none';
  document.getElementById('inviteHostOnly').style.display = isHost ? 'none' : 'block';
  document.getElementById('invitePopup').classList.add('show');
}
function closeInvitePopup() { document.getElementById('invitePopup').classList.remove('show'); }
function copyInviteLink()   { navigator.clipboard.writeText(`${location.origin}/?room=${myRoom}`).then(() => toast('🔗 Ссылка скопирована!', 'copy')); }

function changeRoomType(type) {
  if (!isHost) return;
  roomType = type;
  socket.emit('change_room_type', { type });
  document.getElementById('iTypeOpen').classList.toggle('active',   type === 'open');
  document.getElementById('iTypeClosed').classList.toggle('active', type === 'closed');
  document.getElementById('topType').textContent = type === 'open' ? '🌐 Открытая' : '🔒 Закрытая';
  toast(type === 'open' ? '🌐 Комната теперь публичная' : '🔒 Комната теперь приватная', 'info');
}

socket.on('room_type_changed', ({ type, name }) => {
  roomType = type;
  document.getElementById('topType').textContent = type === 'open' ? '🌐 Открытая' : '🔒 Закрытая';
  addLog(`${name} сменил тип комнаты на ${type === 'open' ? 'публичную' : 'приватную'}`, 'sys');
});