// ============================================================
//  queue.js — очередь видео
// ============================================================

function toggleQueue() {
  queuePanelOpen = !queuePanelOpen;
  document.getElementById('queuePanel').classList.toggle('show', queuePanelOpen);
  document.getElementById('queueTopbarBtn').classList.toggle('active', queuePanelOpen);
  if (queuePanelOpen) renderQueue();
}

function addToQueueFromInput() {
  const inp = document.getElementById('queueUrlInp');
  const url = inp.value.trim();
  if (!url) { toast('Вставь ссылку на видео', 'info'); return; }
  socket.emit('queue_add', { videoUrl: url });
  inp.value = '';
}

async function pasteQueueUrl() {
  try {
    document.getElementById('queueUrlInp').value = (await navigator.clipboard.readText()).trim();
    toast('📋 Вставлено!', 'copy');
  } catch {
    toast('Вставь вручную', 'info');
  }
}

function removeQueueItem(id)      { socket.emit('queue_remove',    { itemId: id }); }
function moveQueueItem(id, dir)   { socket.emit('queue_move',      { itemId: id, direction: dir }); }
function playQueueItem(id)        { socket.emit('queue_play_item', { itemId: id }); }
function skipToNext()             { if (isHost) socket.emit('queue_next'); }
function clearQueue()             { if (isHost) socket.emit('queue_clear'); }

// ─── Кнопки ⏮⏭ в плеере ─────────────────────────────────────

function updatePlayerNav() {
  const hasNext = isHost && queueItems.length > 0;
  const nextBtn = document.getElementById('nextEpBtn');
  const prevBtn = document.getElementById('prevEpBtn');
  if (nextBtn) nextBtn.style.display = hasNext ? 'flex' : 'none';
  if (prevBtn) prevBtn.style.display = 'none';
}

function playPrevEpisode() { toast('Предыдущая серия недоступна', 'info'); }

// ─── Рендер очереди ──────────────────────────────────────────

function renderQueue() {
  const list     = document.getElementById('queueList');
  const badge    = document.getElementById('queueBadge');
  const count    = document.getElementById('queueCount');
  const skipBtn  = document.getElementById('queueSkipBtn');
  const clearBtn = document.getElementById('queueClearBtn');

  if (queueItems.length > 0) { badge.textContent = queueItems.length; badge.style.display = 'inline-flex'; }
  else badge.style.display = 'none';

  if (count)    count.textContent = queueItems.length;
  if (skipBtn)  skipBtn.style.display  = (isHost && queueItems.length > 0) ? 'flex' : 'none';
  if (clearBtn) clearBtn.style.display = (isHost && queueItems.length > 0) ? 'flex' : 'none';

  updatePlayerNav();

  if (!list) return;

  if (!queueItems.length) {
    list.innerHTML = `<div class="queue-empty">
      <div class="queue-empty-icon">📭</div>
      <div class="queue-empty-text">Очередь пуста</div>
      <div class="queue-empty-hint">Вставь ссылку выше или включи видео-сериал</div>
    </div>`;
    return;
  }

  list.innerHTML = '';

  queueItems.forEach((item, idx) => {
    const canRemove   = isHost || item.addedById === socket.id;
    const displayName = item.title || trimUrl(item.videoUrl);

    const metaWho  = item.auto
      ? '<span class="qi-auto-label">🤖 Система</span>'
      : 'добавил <b>' + esc(item.addedBy) + '</b>';
    const metaChan = item.sourceChannel
      ? '<span class="qi-channel">&nbsp;· ' + esc(item.sourceChannel) + '</span>'
      : '';

    let actionsHtml = '';
    if (isHost) {
      actionsHtml += '<button class="qi-btn qi-play" data-action="play" data-id="' + item.id + '" title="Запустить">▶</button>';
      actionsHtml += '<div class="qi-arrows">';
      actionsHtml += '<button class="qi-btn qi-arr" data-action="up"   data-id="' + item.id + '"' + (idx === 0 ? ' disabled' : '') + '>↑</button>';
      actionsHtml += '<button class="qi-btn qi-arr" data-action="down" data-id="' + item.id + '"' + (idx === queueItems.length - 1 ? ' disabled' : '') + '>↓</button>';
      actionsHtml += '</div>';
    }
    if (canRemove) actionsHtml += '<button class="qi-btn qi-del" data-action="del" data-id="' + item.id + '" title="Удалить">✕</button>';

    const div = document.createElement('div');
    div.className  = 'queue-item';
    div.dataset.id = item.id;
    div.innerHTML  =
      '<div class="queue-item-left">' +
        '<div class="queue-item-num">'      + (idx + 1) + '</div>' +
        '<div class="queue-item-platform">' + platformIcon(item.platform) + '</div>' +
      '</div>' +
      '<div class="queue-item-info">' +
        '<div class="queue-item-url' + (!item.title ? ' queue-item-loading' : '') + '">' + esc(displayName) + '</div>' +
        '<div class="queue-item-meta">' + metaWho + metaChan + '</div>' +
      '</div>' +
      '<div class="queue-item-actions">' + actionsHtml + '</div>';

    div.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id, action = btn.dataset.action;
        if (action === 'play') playQueueItem(id);
        if (action === 'up')   moveQueueItem(id, 'up');
        if (action === 'down') moveQueueItem(id, 'down');
        if (action === 'del')  removeQueueItem(id);
      });
    });

    list.appendChild(div);
  });
}

// ─── Socket события очереди ───────────────────────────────────

socket.on('queue_update',    ({ queue }) => { queueItems = queue; renderQueue(); });
socket.on('queue_play_item', ({ item })  => {
  loadVideo(item.videoId, item.videoUrl, item.platform);
  addLog(`▶ Из очереди: ${esc(item.title || trimUrl(item.videoUrl))}`, 'play');
  toast('▶ Следующее видео', 'play');
});
socket.on('queue_next', ({ item, queue }) => {
  queueItems = queue; renderQueue();
  loadVideo(item.videoId, item.videoUrl, item.platform);
  addLog('▶ Авто-переход из очереди', 'play');
  toast('▶ Следующее видео из очереди', 'play');
});