// ============================================================
//  ui.js — интерфейс: сайдбар, свайп, логи, тема, микрофон
// ============================================================

// ─── Логи ────────────────────────────────────────────────────

function toggleLogs() {
  document.getElementById('logsPanel').classList.toggle('show');
  document.querySelector('.logs-toggle-btn').classList.toggle('active');
}
function clearLogs() { document.getElementById('logsBody').innerHTML = ''; }

// ─── Тема ─────────────────────────────────────────────────────

function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'light';
  document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  document.getElementById('themeBtn').textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('kv_theme', dark ? 'light' : 'dark');
}
(function () {
  const s = localStorage.getItem('kv_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', s);
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('themeBtn');
    if (b) b.textContent = s === 'light' ? '☀️' : '🌙';
  });
})();

// ─── Сайдбар ─────────────────────────────────────────────────

function toggleSidebar() {
  sidebarHidden = !sidebarHidden;
  const sidebar = document.querySelector('.sidebar');
  const btn     = document.getElementById('sidebarToggleBtn');
  sidebar.classList.toggle('sidebar-hidden', sidebarHidden);
  if (btn) {
    btn.textContent = sidebarHidden ? '›' : '‹';
    btn.title       = sidebarHidden ? 'Показать чат' : 'Скрыть чат';
  }
}

// ─── Мобильный свайп ─────────────────────────────────────────

let touchStartY = 0, touchStartX = 0;

function initSwipeGestures() {
  const content = document.querySelector('.content');
  if (!content) return;
  content.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  content.addEventListener('touchend', e => {
    const dy = touchStartY - e.changedTouches[0].clientY;
    const dx = Math.abs(touchStartX - e.changedTouches[0].clientX);
    if (dx > Math.abs(dy)) return;
    if (e.target.closest('.msgs,.queue-list,.logs-body')) return;
    if (dy > SWIPE_THRESHOLD && !chatExpanded)   expandChat();
    else if (dy < -SWIPE_THRESHOLD && chatExpanded) collapseChat();
  }, { passive: true });
}

function expandChat() {
  chatExpanded = true;
  document.querySelector('.video-side')?.classList.add('video-collapsed');
  document.querySelector('.sidebar')?.classList.add('sidebar-expanded');
  showSwipeHint('↓ Свайп вниз — показать видео');
}
function collapseChat() {
  chatExpanded = false;
  document.querySelector('.video-side')?.classList.remove('video-collapsed');
  document.querySelector('.sidebar')?.classList.remove('sidebar-expanded');
  showSwipeHint('↑ Свайп вверх — показать чат');
}

var swipeHintTimer;
function showSwipeHint(text) {
  let h = document.getElementById('swipeHint');
  if (!h) {
    h    = document.createElement('div');
    h.id = 'swipeHint';
    document.getElementById('app')?.appendChild(h);
  }
  h.textContent = text;
  h.classList.add('show');
  clearTimeout(swipeHintTimer);
  swipeHintTimer = setTimeout(() => h.classList.remove('show'), 2000);
}

// ─── Участники ────────────────────────────────────────────────

function updateMembers() {
  document.getElementById('membersCount').textContent = `👥 ${membersN}`;
}

// ─── Микрофон / WebRTC ────────────────────────────────────────

function duckVolume(yes) {
  const v = document.getElementById('videoEl');
  v.volume = yes ? DUCK_VOL : 1;
  document.getElementById('volSlider').value = yes ? DUCK_VOL : 1;
  updateVolBtn();
}

function makePeerConn(rid) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.onicecandidate = e => { if (e.candidate) socket.emit('rtc_ice', { to: rid, candidate: e.candidate }); };
  pc.ontrack = e => {
    let a = remoteAudios[rid];
    if (!a) {
      a = document.createElement('audio');
      a.autoplay    = true;
      a.playsInline = true;
      document.body.appendChild(a);
      remoteAudios[rid] = a;
    }
    a.srcObject = e.streams[0];
    a.play().catch(() => {});
  };
  if (micStream) micStream.getTracks().forEach(t => pc.addTrack(t, micStream));
  peerConns[rid] = pc;
  return pc;
}

async function startMicStream() {
  if (micStream) return true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return true;
  } catch {
    toast('❌ Нет доступа к микрофону', 'err');
    return false;
  }
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
    const pc    = makePeerConn(id);
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

function onMicDown()  { holdActivated = false; micHoldTimer = setTimeout(async () => { holdActivated = true; await activateMic(); }, 300); }
function onMicUp(e)   { if (e) e.preventDefault(); clearTimeout(micHoldTimer); if (holdActivated) { deactivateMic(); setTimeout(() => { holdActivated = false; }, 100); } }
function toggleMic()  { if (holdActivated) { holdActivated = false; return; } if (micActive) deactivateMic(); else activateMic(); }

socket.on('rtc_offer',  async ({ from, offer })     => { const pc = makePeerConn(from); await pc.setRemoteDescription(offer); const a = await pc.createAnswer(); await pc.setLocalDescription(a); socket.emit('rtc_answer', { to: from, answer: a }); duckVolume(true); });
socket.on('rtc_answer', async ({ from, answer })    => { if (peerConns[from]) await peerConns[from].setRemoteDescription(answer); });
socket.on('rtc_ice',    async ({ from, candidate }) => { if (peerConns[from]) await peerConns[from].addIceCandidate(candidate); });
socket.on('mic_start',  ({ name })                  => { toast(`🎤 ${esc(name)} говорит...`,'info'); addLog(`🎤 ${esc(name)} включил микрофон`,'sys'); duckVolume(true); });
socket.on('mic_stop',   ()                          => { duckVolume(false); });