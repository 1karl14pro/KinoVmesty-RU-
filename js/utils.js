// ============================================================
<<<<<<< HEAD
//  Файл: utils.js
//  Расположение: js/utils.js
//  Описание: Общие утилиты фронтенда. Включает экранирование текста,
//  форматирование времени, управление всплывающими уведомлениями (toast),
//  работу с куки, сессиями и звуковыми оповещениями.
=======
//  utils.js — утилиты
//  Исправления:
//    - toast(): убран лишний класс 'toast' которого нет в CSS (БАГ 8)
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
// ============================================================

function esc(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtTime(s) {
  s = Math.floor(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function stopEv(e) { e.stopPropagation(); }

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 90) + 'px';
}

function setBtn(id, dis, html) {
  const b = document.getElementById(id);
  if (!b) return;
  b.disabled = dis;
  b.innerHTML = html;
}

// ─── Toast ────────────────────────────────────────────────────
// БАГ 8: раньше было el.className = `toast show ${type}`
//  Класс 'toast' не существует в CSS, элемент стилизуется по #toast
//  Лишний класс убран — оставлены только нужные: show + тип
var toastTimer;
function toast(text, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.className = `show ${type}`; // исправлено: убран лишний класс 'toast'
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ─── Куки ────────────────────────────────────────────────────
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name, value, days = 30) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

// ─── Сессия ──────────────────────────────────────────────────
async function initSession(name) {
  const resp = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getCookie('kv_session'), name }),
  });
  const data = await resp.json();
  setCookie('kv_session', data.sessionId);
  return data;
}

// ─── Иконки и утилиты ────────────────────────────────────────
function platformIcon(p) {
  return { rutube: '🔴', youtube: '▶️', vk: '💙' }[p] || '🎬';
}

function trimUrl(url) {
  try {
    const u = new URL(url);
    const p = u.pathname.slice(0, 30);
    return u.hostname.replace('www.', '') + p + (u.pathname.length > 30 ? '…' : '');
  } catch {
    return url.slice(0, 45);
  }
}

// ─── Звук уведомлений ────────────────────────────────────────
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playNotificationSound() {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

// Разблокировка AudioContext по первому взаимодействию
document.addEventListener('click',      () => getAudioCtx(), { once: true });
document.addEventListener('touchstart', () => getAudioCtx(), { once: true });

// ─── Мигание вкладки ─────────────────────────────────────────
var originalTitle      = document.title;
var titleBlinkInterval = null;

function blinkTitle(text) {
  if (document.visibilityState === 'visible') return;
  let b = false;
  clearInterval(titleBlinkInterval);
  titleBlinkInterval = setInterval(() => {
    document.title = b ? text : originalTitle;
    b = !b;
  }, 1000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    clearInterval(titleBlinkInterval);
    document.title = originalTitle;
  }
});