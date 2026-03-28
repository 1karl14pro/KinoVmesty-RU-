// ============================================================
<<<<<<< HEAD
//  Файл: player.js
//  Расположение: js/player.js
//  Описание: Клиентская обёртка видеоплеера. Интегрирует 
//  воспроизведение через HLS (Rutube), IFrame API (YouTube iframe фоллбек)
//  и прямой поток YouTube через серверный прокси (yt-dlp).
=======
//  player.js — видеоплеер, платформы, синхронизация
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
// ============================================================

const video = document.getElementById('videoEl');

<<<<<<< HEAD
// ─── YouTube API (фоллбек) ────────────────────────────────────
=======
// ─── YouTube API ──────────────────────────────────────────────
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a

window.onYouTubeIframeAPIReady = function () { ytReady_flag = true; };

function loadYouTubeAPI() {
  if (document.getElementById('yt-api-script')) return;
  const t = document.createElement('script');
  t.id  = 'yt-api-script';
  t.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(t);
}
loadYouTubeAPI();

// ─── Загрузка видео ───────────────────────────────────────────

async function loadVideo(videoId, videoUrl, platform) {
  currentPlatform      = platform || 'rutube';
  autoPlaylistSearched = false;
  hidePlaylistBanner();
  showLoading(true);
  document.getElementById('vidError').classList.remove('show');

  const overlay = document.getElementById('vidOverlay');
  if (overlay) overlay.style.display = '';

<<<<<<< HEAD
  const oldYtOverlay = document.getElementById('ytMobileOverlay');
  if (oldYtOverlay) oldYtOverlay.remove();

=======
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  const oldFrame = document.getElementById('embedFrame');
  if (oldFrame) oldFrame.remove();
  if (hls)      { hls.destroy(); hls = null; }
  if (ytPlayer) { try { ytPlayer.destroy(); } catch {} ytPlayer = null; }

<<<<<<< HEAD
  const pipBtn = document.getElementById('pipBtn');
  if (pipBtn) {
    pipBtn.style.display = (platform === 'rutube' || !platform) && document.pictureInPictureEnabled ? 'flex' : 'none';
  }

=======
  // Таймкод из ссылки (?t=95)
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  let startTime = 0;
  if (videoUrl) {
    const tm = videoUrl.match(/[?&]t=(\d+)/);
    if (tm) startTime = parseInt(tm[1], 10);
  }

  if      (platform === 'youtube') await loadYouTube(videoId, startTime);
  else if (platform === 'vk')      await loadVK(videoId);
  else                             await loadRutube(videoId);
}

// ─── Rutube (HLS) ─────────────────────────────────────────────

async function loadRutube(videoId) {
  video.style.display = 'block';
  let hlsUrl, videoTitle;
  try {
    const resp = await fetch(`/api/rutube-hls?id=${encodeURIComponent(videoId)}`);
    const data = await resp.json();
    if (!resp.ok || !data.hlsUrl) throw new Error(data.error || 'нет hlsUrl');
    hlsUrl     = data.hlsUrl;
    videoTitle = data.title || '';
  } catch (e) {
    showError(`Ошибка HLS: ${e.message}`);
    return;
  }

  if (videoTitle) document.getElementById('videoTitleTxt').textContent = videoTitle;

  if (Hls.isSupported()) {
    hls = new Hls({ enableWorker: true });
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      showLoading(false);
      const o = document.getElementById('vidOverlay');
      o.classList.add('force-show');
      setTimeout(() => o.classList.remove('force-show'), 2000);
      if (isHost) tryAutoPlaylist(videoId);
    });
    hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) showError('Ошибка HLS — ' + d.type); });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = hlsUrl;
    showLoading(false);
    if (isHost) tryAutoPlaylist(videoId);
  } else {
    showError('Браузер не поддерживает HLS.');
  }
}

<<<<<<< HEAD
// ─── YouTube — сначала через прокси, фоллбек на iframe ───────

async function loadYouTube(videoId, startTime) {
  // Пробуем получить прямой поток через наш серверный прокси (yt-dlp)
  // Пользователям не нужен VPN — видео идёт через наш сервер
  try {
    showLoading(true);
    const resp = await fetch(`/api/youtube-stream?id=${encodeURIComponent(videoId)}`);
    const data = await resp.json();
    if (resp.ok && data.streamUrl) {
      await loadYoutubeViaProxy(data.streamUrl, videoId, startTime);
      return;
    }
  } catch(e) {
    console.warn('[YT] прокси недоступен, переключаемся на iframe:', e.message);
  }

  // Фоллбек — стандартный iframe (для тех у кого YT работает напрямую)
  await loadYoutubeIframe(videoId, startTime);
}

// ─── YouTube через прокси (как Rutube) ───────────────────────

async function loadYoutubeViaProxy(streamUrl, videoId, startTime) {
  video.style.display = 'block';

  const overlay = document.getElementById('vidOverlay');
  if (overlay) overlay.style.display = '';

  video.src = streamUrl;
  video.currentTime = startTime || 0;

  // Показываем оверлей с управлением
  const o = document.getElementById('vidOverlay');
  if (o) {
    o.classList.add('force-show');
    setTimeout(() => o.classList.remove('force-show'), 2000);
  }

  showLoading(false);

  video.addEventListener('error', () => {
    console.warn('[YT proxy] ошибка видео, переключаемся на iframe');
    loadYoutubeIframe(videoId, startTime);
  }, { once: true });
}

// ─── YouTube iframe (фоллбек) ─────────────────────────────────

function loadYoutubeIframe(videoId, startTime) {
=======
// ─── YouTube (IFrame API) ─────────────────────────────────────

function loadYouTube(videoId, startTime) {
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  return new Promise(resolve => {
    video.style.display = 'none';

    const overlay = document.getElementById('vidOverlay');
    if (overlay) overlay.style.display = 'none';

<<<<<<< HEAD
    // Фиксируем высоту враппера — на мобиле без этого схлопывается в 0
    const wrap = document.getElementById('videoWrap');
    if (wrap) {
      const h = wrap.offsetHeight;
      if (h > 0) wrap.style.minHeight = h + 'px';
    }

=======
    const wrap = document.getElementById('videoWrap');
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
    const div  = document.createElement('div');
    div.id = 'embedFrame';
    div.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;';
    wrap.appendChild(div);

    let si = null;

    const tryCreate = () => {
      ytPlayer = new YT.Player('embedFrame', {
        videoId,
        playerVars: {
          autoplay: 0, controls: 1, rel: 0,
          modestbranding: 1, playsinline: 1,
          fs: 1, start: startTime || 0,
          iv_load_policy: 3,
<<<<<<< HEAD
          origin: location.origin,
=======
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
        },
        events: {
          onReady: () => {
            showLoading(false);
            resolve();
<<<<<<< HEAD

            const iframe = document.getElementById('embedFrame');
=======
            const iframe = document.querySelector('#embedFrame iframe');
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
            if (iframe) {
              iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
              iframe.allowFullscreen = true;
              iframe.setAttribute('allowfullscreen', '');
              iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
<<<<<<< HEAD
              iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;z-index:1;';
            }

            _showYtMobileOverlay('▶', 'rgba(0,0,0,.55)', null);

            setTimeout(() => {
              if (ytOk() && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                _removeYtOverlay();
              }
            }, 800);
          },

          onError: e => { showError('YouTube: видео недоступно (' + e.data + ')'); resolve(); },

          onStateChange: e => {
            if (e.data === YT.PlayerState.PLAYING) {
              _removeYtOverlay();
            }

=======
              iframe.style.cssText = 'width:100%;height:100%;border:none;';
            }
          },
          onError: e => { showError('YouTube: видео недоступно (' + e.data + ')'); resolve(); },
          onStateChange: e => {
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
            if (isHost && e.data === YT.PlayerState.PLAYING) {
              if (si) clearInterval(si);
              si = setInterval(() => {
                if (ytPlayer && isHost) socket.emit('time_update', { time: ytPlayer.getCurrentTime() });
              }, 1000);
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              if (si) { clearInterval(si); si = null; }
            }
<<<<<<< HEAD

=======
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
            if (e.data === YT.PlayerState.ENDED && isHost && queueItems.length > 0) {
              toast('⏭ Следующее видео через 2 сек…', 'info');
              setTimeout(() => socket.emit('queue_next'), 2000);
            }
          },
        },
      });
    };

    if (ytReady_flag && typeof YT !== 'undefined') tryCreate();
    else window.onYouTubeIframeAPIReady = () => { ytReady_flag = true; tryCreate(); };
  });
}

<<<<<<< HEAD
// ─── Хелперы мобильного оверлея (для iframe фоллбека) ────────

function _removeYtOverlay() {
  const o = document.getElementById('ytMobileOverlay');
  if (o) o.remove();
}

function _showYtMobileOverlay(icon, bgColor, message) {
  _removeYtOverlay();

  const wrap = document.getElementById('videoWrap');
  if (!wrap) return;

  const overlay = document.createElement('div');
  overlay.id = 'ytMobileOverlay';
  overlay.style.cssText = [
    'position:absolute', 'inset:0', 'z-index:20',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'cursor:pointer',
    'background:' + (message ? 'rgba(0,0,0,.4)' : 'rgba(0,0,0,.02)'),
    '-webkit-tap-highlight-color:transparent',
  ].join(';');

  overlay.innerHTML = `
    <div style="
      width:88px; height:88px; border-radius:50%;
      background:${bgColor};
      border:3px solid rgba(255,255,255,.6);
      display:flex; align-items:center; justify-content:center;
      font-size:2.2rem; pointer-events:none;
    ">${icon}</div>
    ${message ? `<div style="
      margin-top:14px; color:#fff; font-size:.9rem; font-weight:700;
      text-shadow:0 1px 4px rgba(0,0,0,.9); pointer-events:none;
      text-align:center; padding:0 20px;
    ">${message}</div>` : ''}
  `;

  // playVideo() ОБЯЗАН вызываться СИНХРОННО — без setTimeout/async
  const doPlay = () => {
    try {
      if (ytPlayer && ytPlayer.playVideo) {
        ytPlayer.playVideo();
        document.getElementById('bigPlay').textContent = '⏸';
        if (isHost) socket.emit('player_action', { action: 'play', time: platformGetTime() });
      }
    } catch(e) { console.warn('ytPlay:', e); }
    _removeYtOverlay();
  };

  overlay.addEventListener('click', doPlay);
  overlay.addEventListener('touchend', (e) => {
    e.preventDefault();
    doPlay();
  }, { passive: false });

  wrap.appendChild(overlay);
}

=======
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
// ─── VK Видео ─────────────────────────────────────────────────

function loadVK(videoId) {
  return new Promise(resolve => {
    video.style.display = 'none';
    const [oid, id] = videoId.split('_');
    const iframe    = document.createElement('iframe');
    iframe.id       = 'embedFrame';
    iframe.src      = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&autoplay=0&js_api=1`;
    iframe.style.cssText  = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
    iframe.allow          = 'autoplay; fullscreen';
    iframe.allowFullscreen = true;
    iframe.onload  = () => { showLoading(false); resolve(); };
    iframe.onerror = () => { showError('VK: не удалось загрузить видео'); resolve(); };
    document.getElementById('videoWrap').appendChild(iframe);
  });
}

// ─── Платформенные функции ────────────────────────────────────

function ytOk()              { return ytPlayer && typeof ytPlayer.playVideo === 'function'; }
<<<<<<< HEAD
function platformPlay()      {
  if (currentPlatform === 'youtube') {
    if (ytPlayer) { if (ytOk()) ytPlayer.playVideo(); }
    else video.play().catch(() => {});
  } else if (currentPlatform === 'vk') {
    sendVKCmd('play');
  } else {
    video.play().catch(() => {});
  }
}
function platformPause()     {
  if (currentPlatform === 'youtube') {
    if (ytPlayer) { if (ytOk()) ytPlayer.pauseVideo(); }
    else video.pause();
  } else if (currentPlatform === 'vk') {
    sendVKCmd('pause');
  } else {
    video.pause();
  }
}
function platformSeek(t)     {
  if (currentPlatform === 'youtube') {
    if (ytPlayer) { if (ytOk()) ytPlayer.seekTo(t, true); }
    else video.currentTime = t;
  } else if (currentPlatform !== 'vk') {
    video.currentTime = t;
  }
}
function platformGetTime()   {
  if (currentPlatform === 'youtube') {
    if (ytPlayer) { try { return ytPlayer?.getCurrentTime() || 0; } catch { return 0; } }
    return video.currentTime || 0;
  }
  return video.currentTime || 0;
}
function platformIsPlaying() {
  if (currentPlatform === 'youtube') {
    if (ytPlayer) { try { return ytPlayer?.getPlayerState() === YT.PlayerState.PLAYING; } catch { return false; } }
    return !video.paused;
  }
  return !video.paused;
}
function sendVKCmd(cmd) {
  const f = document.getElementById('embedFrame');
  if (f?.contentWindow) f.contentWindow.postMessage(JSON.stringify({ method: cmd }), '*');
}
=======
function platformPlay()      { if (currentPlatform==='youtube') { if (ytOk()) ytPlayer.playVideo(); }   else if (currentPlatform==='vk') sendVKCmd('play');  else video.play().catch(()=>{}); }
function platformPause()     { if (currentPlatform==='youtube') { if (ytOk()) ytPlayer.pauseVideo(); }  else if (currentPlatform==='vk') sendVKCmd('pause'); else video.pause(); }
function platformSeek(t)     { if (currentPlatform==='youtube') { if (ytOk()) ytPlayer.seekTo(t,true); } else if (currentPlatform!=='vk') video.currentTime = t; }
function platformGetTime()   { if (currentPlatform==='youtube') { try { return ytPlayer?.getCurrentTime()||0; } catch { return 0; } } return video.currentTime||0; }
function platformIsPlaying() { if (currentPlatform==='youtube') { try { return ytPlayer?.getPlayerState()===YT.PlayerState.PLAYING; } catch { return false; } } return !video.paused; }
function sendVKCmd(cmd)      { const f=document.getElementById('embedFrame'); if (f?.contentWindow) f.contentWindow.postMessage(JSON.stringify({method:cmd}),'*'); }
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a

// ─── Управление плеером ───────────────────────────────────────

function togglePlay() { if (platformIsPlaying()) playerAction('pause'); else playerAction('play'); }

function playerAction(action) {
<<<<<<< HEAD
  if (action === 'play')  { platformPlay();  document.getElementById('bigPlay').textContent = '⏸'; addLog('▶ Ты запустил видео', 'play'); }
  if (action === 'pause') { platformPause(); document.getElementById('bigPlay').textContent = '▶'; addLog('⏸ Ты поставил паузу', 'pause'); }
=======
  if (action==='play')  { platformPlay();  document.getElementById('bigPlay').textContent='⏸'; addLog('▶ Ты запустил видео','play'); }
  if (action==='pause') { platformPause(); document.getElementById('bigPlay').textContent='▶'; addLog('⏸ Ты поставил паузу','pause'); }
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  socket.emit('player_action', { action, time: platformGetTime() });
}

function onSeekInput(el) {
<<<<<<< HEAD
  if (!isHost || currentPlatform !== 'rutube') return;
  isSeeking = true;
  const t = (el.value / 100) * (video.duration || 0);
  document.getElementById('vidTime').textContent = `${fmtTime(t)} / ${fmtTime(video.duration || 0)}`;
  el.style.background = `linear-gradient(to right, var(--accent) ${el.value}%, rgba(255,255,255,0.2) ${el.value}%)`;
}

function onSeekChange(el) {
  if (!isHost || currentPlatform !== 'rutube') return;
  isSeeking = false;
  const t = (el.value / 100) * (video.duration || 0);
  platformSeek(t);
  socket.emit('player_action', { action: 'seek', time: t });
=======
  if (!isHost || currentPlatform!=='rutube') return;
  isSeeking = true;
  const t = (el.value/100) * (video.duration||0);
  document.getElementById('vidTime').textContent = `${fmtTime(t)} / ${fmtTime(video.duration||0)}`;
}

function onSeekChange(el) {
  if (!isHost || currentPlatform!=='rutube') return;
  isSeeking = false;
  const t = (el.value/100) * (video.duration||0);
  platformSeek(t);
  socket.emit('player_action', { action:'seek', time:t });
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  addLog(`🔄 Перемотка на ${fmtTime(t)}`, 'seek');
}

// ─── События видеоэлемента ────────────────────────────────────

video.addEventListener('timeupdate', () => {
<<<<<<< HEAD
  if (isSeeking) return;
  // Для YouTube через прокси currentPlatform = 'youtube' но используем <video>
  if (currentPlatform !== 'rutube' && currentPlatform !== 'youtube') return;
  if (ytPlayer) return; // iframe режим — не трогаем прогрессбар

  const cur = video.currentTime, dur = video.duration || 0;
  if (dur > 0) {
    const percent = (cur / dur) * 100;
    const prog = document.getElementById('vidProgress');
    prog.value = percent;
    prog.style.background = `linear-gradient(to right, var(--accent) ${percent}%, rgba(255,255,255,0.2) ${percent}%)`;
    document.getElementById('vidTime').textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
  }
  if (isHost && Math.floor(cur) !== Math.floor(cur - 0.25)) {
    socket.emit('time_update', { time: cur });
  }
=======
  if (isSeeking || currentPlatform !== 'rutube') return;
  const cur = video.currentTime, dur = video.duration || 0;
  if (dur > 0) {
    document.getElementById('vidProgress').value        = (cur/dur)*100;
    document.getElementById('vidTime').textContent      = `${fmtTime(cur)} / ${fmtTime(dur)}`;
  }
  if (isHost && Math.floor(cur) !== Math.floor(cur - 0.25)) socket.emit('time_update', { time: cur });
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
});
video.addEventListener('waiting', () => showLoading(true));
video.addEventListener('playing', () => showLoading(false));
video.addEventListener('canplay', () => showLoading(false));
<<<<<<< HEAD
video.addEventListener('ended', () => {
=======
video.addEventListener('ended',   () => {
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  addLog('⏹ Видео закончилось', 'sys');
  if (isHost && queueItems.length > 0) {
    toast('⏭ Следующее видео через 2 сек…', 'info');
    setTimeout(() => socket.emit('queue_next'), 2000);
  }
});

// ─── Синхронизация ────────────────────────────────────────────

socket.on('player_action', ({ action, time, name }) => {
<<<<<<< HEAD
  if (action === 'play') {
    document.getElementById('bigPlay').textContent = '⏸';
    toast(`▶ ${esc(name)} запустил`, 'play');
    addLog(`▶ ${esc(name)} запустил`, 'play');

    // iframe режим на мобиле — показываем оверлей
    if (currentPlatform === 'youtube' && ytPlayer && !isHost && !platformIsPlaying()) {
      _showYtMobileOverlay('▶', 'rgba(232,67,147,.85)', 'Нажми чтобы смотреть вместе');
    } else {
      platformPlay();
    }
  }

  if (action === 'pause') {
    platformPause();
    _removeYtOverlay();
    document.getElementById('bigPlay').textContent = '▶';
    toast(`⏸ ${esc(name)} пауза`, 'pause');
    addLog(`⏸ ${esc(name)} пауза`, 'pause');
  }

  if (action === 'seek') {
    platformSeek(time);
    document.getElementById('bigPlay').textContent = '⏸';
    toast(`🔄 ${esc(name)} перемотал на ${fmtTime(time)}`, 'info');
    addLog(`🔄 ${esc(name)} перемотал`, 'seek');

    if (currentPlatform === 'youtube' && ytPlayer && !isHost && !platformIsPlaying()) {
      _showYtMobileOverlay('▶', 'rgba(232,67,147,.85)', 'Нажми чтобы смотреть вместе');
    } else {
      platformPlay();
    }
  }

  if (action !== 'seek' && typeof time === 'number') {
    const diff = Math.abs(platformGetTime() - time);
    if (diff > 0.5) platformSeek(time);
  }
=======
  if (action==='play')  { platformPlay();  document.getElementById('bigPlay').textContent='⏸'; toast(`▶ ${esc(name)} запустил`,'play');  addLog(`▶ ${esc(name)} запустил`,'play'); }
  if (action==='pause') { platformPause(); document.getElementById('bigPlay').textContent='▶'; toast(`⏸ ${esc(name)} пауза`,'pause');   addLog(`⏸ ${esc(name)} пауза`,'pause'); }
  if (action==='seek')  { platformSeek(time); platformPlay(); document.getElementById('bigPlay').textContent='⏸'; toast(`🔄 ${esc(name)} перемотал на ${fmtTime(time)}`,'info'); addLog(`🔄 ${esc(name)} перемотал`,'seek'); }
  if (action!=='seek' && typeof time==='number') { const diff=Math.abs(platformGetTime()-time); if(diff>0.5) platformSeek(time); }
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
});

socket.on('sync_time', ({ time, state, force }) => {
  if (isHost) return;
<<<<<<< HEAD
  if (currentPlatform === 'rutube' && (video.readyState < 2 || !video.duration)) return;

  const diff = Math.abs(platformGetTime() - time);
  const now  = Date.now();

  // Для YouTube (iframe режим) увеличиваем порог — агрессивный seek ломает воспроизведение
  const isIframeYt    = currentPlatform === 'youtube' && !!ytPlayer;
  const syncThreshold = isIframeYt ? 3 : SYNC_THRESHOLD;
  const syncCooldown  = isIframeYt ? 3000 : 300;

  if (force) {
    platformSeek(time);
    lastSyncCorrection = now;
    if (diff > 0.1) addLog(`⚡ Принудительная синхронизация (${diff.toFixed(2)}с)`, 'seek');
  } else if (diff > syncThreshold && now - lastSyncCorrection > syncCooldown) {
    platformSeek(time);
    lastSyncCorrection = now;
    addLog(`🔄 Коррекция дрейфа (${diff.toFixed(2)}с)`, 'seek');
  }

  if (state === 'playing' && !platformIsPlaying()) {
    if (isIframeYt) {
      if (!document.getElementById('ytMobileOverlay')) {
        _showYtMobileOverlay('▶', 'rgba(232,67,147,.85)', 'Нажми чтобы смотреть вместе');
      }
    } else {
      platformPlay();
      document.getElementById('bigPlay').textContent = '⏸';
    }
  } else if (state === 'paused' && platformIsPlaying() && force) {
    platformPause();
    document.getElementById('bigPlay').textContent = '▶';
  }
=======
  if (currentPlatform==='rutube' && (video.readyState < 2 || !video.duration)) return;
  const diff = Math.abs(platformGetTime() - time);
  const now  = Date.now();
  if (force) {
    platformSeek(time); lastSyncCorrection = now;
    if (diff > 0.1) addLog(`⚡ Принудительная синхронизация (${diff.toFixed(2)}с)`,'seek');
  } else if (diff > SYNC_THRESHOLD && now - lastSyncCorrection > 300) {
    platformSeek(time); lastSyncCorrection = now;
    addLog(`🔄 Коррекция дрейфа (${diff.toFixed(2)}с)`,'seek');
  }
  if (state==='playing' && !platformIsPlaying())             { platformPlay();  document.getElementById('bigPlay').textContent='⏸'; }
  else if (state==='paused' && platformIsPlaying() && force) { platformPause(); document.getElementById('bigPlay').textContent='▶'; }
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
});

// ─── Громкость ────────────────────────────────────────────────

<<<<<<< HEAD
function onVolumeChange(el) { video.volume = parseFloat(el.value); video.muted = video.volume === 0; updateVolBtn(); }
function toggleMute() { video.muted = !video.muted; document.getElementById('volSlider').value = video.muted ? 0 : video.volume; updateVolBtn(); }
function updateVolBtn() {
  const b = document.getElementById('volBtn');
  if      (video.muted || video.volume === 0) b.textContent = '🔇';
  else if (video.volume < 0.5)                b.textContent = '🔉';
  else                                        b.textContent = '🔊';
=======
function onVolumeChange(el) { video.volume = parseFloat(el.value); video.muted = video.volume===0; updateVolBtn(); }
function toggleMute()       { video.muted = !video.muted; document.getElementById('volSlider').value = video.muted ? 0 : video.volume; updateVolBtn(); }
function updateVolBtn() {
  const b = document.getElementById('volBtn');
  if      (video.muted || video.volume===0) b.textContent = '🔇';
  else if (video.volume < 0.5)              b.textContent = '🔉';
  else                                      b.textContent = '🔊';
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
}

// ─── Фуллскрин ────────────────────────────────────────────────

function toggleFullscreen() {
<<<<<<< HEAD
  const w = document.getElementById('videoWrap');

  const inFs = document.fullscreenElement
    || document.webkitFullscreenElement
    || (currentPlatform === 'rutube' && video.webkitDisplayingFullscreen);

  if (inFs) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    if (exit) exit.call(document);
    return;
  }

  if (currentPlatform === 'rutube' && video.webkitEnterFullscreen) {
    video.webkitEnterFullscreen();
    return;
  }

  const enter = w.requestFullscreen || w.webkitRequestFullscreen || w.mozRequestFullScreen || w.msRequestFullscreen;
  if (enter) {
    enter.call(w).catch(() => { if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); });
    return;
  }

  if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
=======
  const w  = document.getElementById('videoWrap');
  const el = document.fullscreenElement || document.webkitFullscreenElement;
  if (!el) { const r = w.requestFullscreen || w.webkitRequestFullscreen; if (r) r.call(w); }
  else     { const x = document.exitFullscreen || document.webkitExitFullscreen; if (x) x.call(document); }
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
}

document.addEventListener('fullscreenchange',       updateFsBtn);
document.addEventListener('webkitfullscreenchange', updateFsBtn);

function updateFsBtn() {
  const btn     = document.querySelector('.fs-btn');
  const chatBtn = document.getElementById('fsChatBtn');
<<<<<<< HEAD
  const inFs    = !!(
    document.fullscreenElement
    || document.webkitFullscreenElement
    || (currentPlatform === 'rutube' && video.webkitDisplayingFullscreen)
  );

  if (btn)     btn.textContent       = inFs ? '✕' : '⛶';
  if (chatBtn) chatBtn.style.display = inFs ? 'flex' : 'none';

  if (!inFs) {
    fsChatOpen = false;
    document.getElementById('fullscreenChat')?.classList.remove('show');
    document.getElementById('fsChatBtn')?.classList.remove('active');
    document.getElementById('fsChatBtn').style.display = 'none';
  }
}

video.addEventListener('webkitbeginfullscreen', updateFsBtn);
video.addEventListener('webkitendfullscreen',   updateFsBtn);

// ─── Загрузка / ошибка ───────────────────────────────────────

function showLoading(yes) { document.getElementById('vidLoading').classList.toggle('show', yes); }
function showError(msg) {
=======
  const inFs    = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (btn)     btn.textContent       = inFs ? '✕' : '⛶';
  if (chatBtn) chatBtn.style.display = inFs ? 'flex' : 'none';
  if (!inFs && fsChatOpen) {
    fsChatOpen = false;
    document.getElementById('fullscreenChat')?.classList.remove('show');
    document.getElementById('fsChatBtn')?.classList.remove('active');
  }
}

// ─── Загрузка / ошибка ───────────────────────────────────────

function showLoading(yes) { document.getElementById('vidLoading').classList.toggle('show', yes); }
function showError(msg)   {
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  document.getElementById('vidLoading').classList.remove('show');
  document.getElementById('vidError').classList.add('show');
  document.getElementById('vidErrorText').textContent = msg || 'Не удалось загрузить видео';
}

// ─── Выбор платформы (на экране создания) ────────────────────

function selectPlatform(platform) {
  selectedPlatform = platform;
  document.querySelectorAll('.platform-opt').forEach(el => el.classList.remove('active'));
  document.getElementById(`plt-${platform}`).classList.add('active');
  const info = PLATFORM_INFO[platform];
  document.getElementById('urlLabel').textContent     = `Ссылка на видео ${info.label}`;
  document.getElementById('urlCreate').placeholder    = info.placeholder;
  document.getElementById('platformHint').textContent = info.hint;
<<<<<<< HEAD
}

// ─── Картинка-в-картинке (PiP) ────────────────────────────────

async function togglePip() {
  if (currentPlatform !== 'rutube' && !(currentPlatform === 'youtube' && !ytPlayer)) {
    toast('PiP пока работает только для Rutube и YouTube через прокси 🥲', 'info');
    return;
  }
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
      await video.requestPictureInPicture();
    } else {
      toast('Браузер не поддерживает PiP', 'err');
    }
  } catch (error) {
    console.error('Ошибка PiP:', error);
    toast('Не удалось запустить PiP', 'err');
  }
}

video.addEventListener('enterpictureinpicture', () => { document.getElementById('pipBtn')?.classList.add('active'); });
video.addEventListener('leavepictureinpicture', () => { document.getElementById('pipBtn')?.classList.remove('active'); });

// ─── Touch оверлей для Rutube ─────────────────────────────────

(function initTouchOverlay() {
  const wrap    = document.getElementById('videoWrap');
  const overlay = document.getElementById('vidOverlay');
  let hideTimer = null;

  function showOverlayBriefly() {
    if (!overlay) return;
    overlay.classList.add('touch-show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => overlay.classList.remove('touch-show'), 3000);
  }

  wrap?.addEventListener('touchstart', () => {
    const isVisible = overlay?.classList.contains('touch-show') || overlay?.classList.contains('force-show');
    if (!isVisible) {
      showOverlayBriefly();
      overlay?.addEventListener('click', e => e.stopPropagation(), { once: true });
    } else {
      showOverlayBriefly();
    }
  }, { passive: true });
})();
=======
}
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
