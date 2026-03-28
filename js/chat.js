// ============================================================
<<<<<<< HEAD
//  Файл: chat.js
//  Расположение: js/chat.js
//  Описание: Клиентская логика текстового чата. Включает отправку
//  сообщений, систему упоминаний пользователей (@), панель выбора 
//  эмодзи и дублирование логики для чата в полноэкранном режиме плеера.
=======
//  chat.js — чат, упоминания, эмодзи, фуллскрин-чат
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
// ============================================================

// ─── Сообщения ───────────────────────────────────────────────

function formatMsgText(text) {
  return esc(text).replace(/@(\S+)/g, (m, n) =>
    `<span class="mention${n===myName ? ' mention-me' : ''}">${m}</span>`
  );
}

function addMsg(name, text, type) {
  const msgs = document.getElementById('msgs');
  const div  = document.createElement('div');
  div.className = `msg ${type}`;
  const t = new Date().toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' });
  div.innerHTML = `${type==='other' ? `<div class="msg-meta">${esc(name)}</div>` : ''}
    <div class="bubble">${formatMsgText(text)}</div>
    <div class="msg-meta">${t}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  if (type !== 'sys') document.getElementById('msgCount').textContent = ++msgN;
}

function addLog(text, type = 'sys') {
  const b = document.getElementById('logsBody');
  const d = document.createElement('div');
  d.className = `log-entry log-${type}`;
  const t = new Date().toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  d.innerHTML = `<span class="log-time">${t}</span>${text}`;
  b.appendChild(d);
  b.scrollTop = b.scrollHeight;
}

// ─── Отправка сообщения ───────────────────────────────────────

function sendMsg() {
  const i = document.getElementById('chatInp');
  const t = i.value.trim().slice(0, 500);
  if (!t) return;
  addMsg(myName, t, 'me');
  socket.emit('chat', { text: t });
  i.value = ''; i.style.height = 'auto';
  hideMentionDropdown();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
}

// ─── Socket: входящие сообщения ───────────────────────────────

socket.on('chat', ({ name, text }) => {
  addMsg(name, text, 'other');
  addFcMsg(name, text, 'other');
  playNotificationSound();
  blinkTitle(`💬 ${esc(name)}`);
});

// ─── @ Упоминания ─────────────────────────────────────────────

function insertMention() {
  const i = document.getElementById('chatInp');
  i.value += '@'; i.focus();
  showMentionDropdown('');
}

function showMentionDropdown(f = '') {
  const dd    = document.getElementById('mentionDropdown');
  // Фильтруем по socket.id (свой ID), а не по строке 'me'
  const names = Object.entries(roomMembers)
    .filter(([id, n]) => id !== socket.id && n.toLowerCase().startsWith(f.toLowerCase()))
    .map(([, n]) => n);

  if (!names.length) { hideMentionDropdown(); return; }
  dd.innerHTML = '';
  names.forEach(name => {
    const item = document.createElement('div');
    item.className = 'mention-item';
    item.innerHTML = `<span class="mention-avatar">${name[0].toUpperCase()}</span><span>${esc(name)}</span>`;
    item.onclick = () => selectMention(name);
    dd.appendChild(item);
  });
  dd.classList.add('show');
  mentionDropdownOpen = true;
}

function hideMentionDropdown() {
  document.getElementById('mentionDropdown')?.classList.remove('show');
  mentionDropdownOpen = false;
}

function selectMention(name) {
  const i = document.getElementById('chatInp');
  i.value = i.value.replace(/@\S*$/, `@${name} `);
  i.focus(); autoResize(i); hideMentionDropdown();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.chat-inp-area')) {
    hideMentionDropdown();
    emojiPickerOpen = false;
    document.getElementById('emojiPicker')?.classList.remove('show');
  }
});

// ─── Эмодзи ──────────────────────────────────────────────────

function buildEmojiGrid() {
  const g = document.getElementById('emojiGrid');
  if (g.children.length) return;
  EMOJIS.forEach(e => {
    const b = document.createElement('button');
    b.className = 'emoji-btn'; b.textContent = e;
    b.onclick = () => insertEmoji(e);
    g.appendChild(b);
  });
}

function toggleEmojiPicker() {
  emojiPickerOpen = !emojiPickerOpen;
  buildEmojiGrid();
  document.getElementById('emojiPicker').classList.toggle('show', emojiPickerOpen);
  if (emojiPickerOpen) hideMentionDropdown();
}

function insertEmoji(e) {
  const i = document.getElementById('chatInp');
  const p = i.selectionStart;
  i.value = i.value.slice(0, p) + e + i.value.slice(p);
  i.focus(); i.selectionStart = i.selectionEnd = p + e.length;
  autoResize(i);
  emojiPickerOpen = false;
  document.getElementById('emojiPicker').classList.remove('show');
}

// ─── Чат в фуллскрине ────────────────────────────────────────

function toggleFsChat() {
  fsChatOpen = !fsChatOpen;
  const panel = document.getElementById('fullscreenChat');
  const btn   = document.getElementById('fsChatBtn');
  if (panel) panel.classList.toggle('show', fsChatOpen);
  if (btn)   btn.classList.toggle('active', fsChatOpen);
  if (fsChatOpen) {
    syncFsChat();
    const fc = document.getElementById('fcMsgs');
    if (fc) fc.scrollTop = fc.scrollHeight;
  }
}

function syncFsChat() {
  const fc  = document.getElementById('fcMsgs');
  const src = document.getElementById('msgs');
  if (!fc || !src) return;
  fc.innerHTML = src.innerHTML;
  fc.scrollTop = fc.scrollHeight;
}

function addFcMsg(name, text, type) {
  const fc = document.getElementById('fcMsgs');
  if (!fc) return;
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  const t = new Date().toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' });
  div.innerHTML = `${type==='other' ? `<div class="msg-meta">${esc(name)}</div>` : ''}
    <div class="bubble">${formatMsgText(text)}</div>
    <div class="msg-meta">${t}</div>`;
  fc.appendChild(div);
  fc.scrollTop = fc.scrollHeight;
  const cnt = document.getElementById('fcMsgCount');
  if (cnt && type !== 'sys') cnt.textContent = parseInt(cnt.textContent || '0') + 1;
}

function sendFcMsg() {
  const inp  = document.getElementById('fcInp');
  const text = inp?.value.trim().slice(0, 500);
  if (!text) return;
  addMsg(myName, text, 'me');
  addFcMsg(myName, text, 'me');
  socket.emit('chat', { text });
  inp.value = ''; inp.style.height = 'auto';
}

function handleFcKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFcMsg(); }
}