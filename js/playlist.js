// ============================================================
//  playlist.js — автоплейлист сериалов (клиент)
//  Исправления:
//    - toast показывает корректное число (добавляемые, не все) (БАГ 10)
//    - showPlaylistBanner реализована корректно (БАГ 9)
//    - autoPlaylistBannerActive используется согласованно (БАГ 9)
// ============================================================

async function tryAutoPlaylist(videoId) {
  if (!isHost || !autoPlaylistEnabled || autoPlaylistSearched) return;
  if (queueItems.length > 0) return; // уже есть очередь
  autoPlaylistSearched = true;

  try {
    const resp = await fetch(`/api/episode-playlist?id=${encodeURIComponent(videoId)}`);
    const data = await resp.json();

    if (!data.found || !data.nextEpisodes?.length) {
      addLog(`📺 Автоплейлист: ${data.reason || 'серии не найдены'}`, 'sys');
      return;
    }

    const { showName, season, nextEpisodes, hasNextSeason, nextSeason } = data;
    addLog(
      `📺 Найдено ${nextEpisodes.length} серий «${showName}» s${season}${hasNextSeason ? ' + s' + nextSeason : ''}`,
      'play'
    );

    const firstBatch = nextEpisodes.slice(0, 5);
    const rest       = nextEpisodes.slice(5);

    // БАГ 10: toast показываем сразу с реальным числом добавляемых серий,
    //  а не с nextEpisodes.length (который ещё не добавлен целиком)
    const totalCount = nextEpisodes.length;
    const label = hasNextSeason
      ? `📺 Загружаем ${totalCount} серий (до s${nextSeason})…`
      : `📺 Загружаем ${totalCount} серий «${showName}»…`;
    toast(label, 'play');

    // Первые 5 — сразу
    socket.emit('queue_add_playlist', { episodes: firstBatch, auto: true });

    if (!queuePanelOpen) toggleQueue();

    // Остальные — по 1 с задержкой чтобы не перегружать сервер
    if (rest.length > 0) {
      let i = 0;
      const addNext = () => {
        if (i >= rest.length) return;
        socket.emit('queue_add_playlist', { episodes: [rest[i]], auto: true });
        i++;
        setTimeout(addNext, 400);
      };
      setTimeout(addNext, 600);
    }

  } catch (e) {
    addLog(`📺 Автоплейлист ошибка: ${e.message}`, 'sys');
  }
}

function toggleAutoPlaylist() {
  autoPlaylistEnabled = !autoPlaylistEnabled;
  const btn = document.getElementById('autoPlaylistBtn');
  if (btn) {
    btn.innerHTML = autoPlaylistEnabled
      ? '🤖 <span class="btn-label">Авто</span>'
      : '🤖 <span class="btn-label">Выкл</span>';
    btn.classList.toggle('active', autoPlaylistEnabled);
  }
  toast(autoPlaylistEnabled ? '🤖 Автоплейлист включён' : '🤖 Автоплейлист выключен', 'info');
}

// ─── Баннер автоплейлиста ────────────────────────────────────
// БАГ 9: showPlaylistBanner была заглушкой, но autoPlaylistBannerActive
//  нигде не ставился в true, поэтому вся логика была мёртвой.
//  Теперь showPlaylistBanner полноценно создаёт баннер,
//  а hidePlaylistBanner его убирает.

function showPlaylistBanner(showName, nextEpisodes, hasNextSeason, nextSeason) {
  if (autoPlaylistBannerActive) return;
  autoPlaylistBannerActive = true;

  const existing = document.getElementById('playlistBanner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id        = 'playlistBanner';
  banner.className = 'playlist-banner';

  const previewText = hasNextSeason
    ? `+${nextEpisodes.length} серий, включая ${nextSeason} сезон`
    : `+${nextEpisodes.length} серий`;

  banner.innerHTML = `
    <div class="pb-info">
      <div class="pb-icon">📺</div>
      <div class="pb-text">
        <div class="pb-title">Найден сериал: ${esc(showName)}</div>
        <div class="pb-preview">${previewText}</div>
      </div>
    </div>
    <div class="pb-actions">
      <button class="pb-btn pb-yes" id="pbYesBtn">Добавить в очередь</button>
      <button class="pb-btn pb-no"  onclick="hidePlaylistBanner()">Не сейчас</button>
    </div>`;

  const videoSide = document.querySelector('.video-side');
  if (videoSide) videoSide.insertAdjacentElement('afterbegin', banner);

  document.getElementById('pbYesBtn')?.addEventListener('click', () => {
    socket.emit('queue_add_playlist', { episodes: nextEpisodes, auto: true });
    hidePlaylistBanner();
    if (!queuePanelOpen) toggleQueue();
    toast(`📺 Добавлено ${nextEpisodes.length} серий`, 'play');
  });
}

function hidePlaylistBanner() {
  const banner = document.getElementById('playlistBanner');
  if (banner) {
    banner.classList.add('hiding');
    setTimeout(() => banner.remove(), 300);
  }
  autoPlaylistBannerActive = false;
}