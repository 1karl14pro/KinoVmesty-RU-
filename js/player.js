// ============================================================
//  player.js — видеоплеер, платформы, синхронизация
// ============================================================

const video = document.getElementById('videoEl');

// ─── YouTube API ──────────────────────────────────────────────

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

  const oldFrame = document.getElementById('embedFrame');
  if (oldFrame) oldFrame.remove();
  if (hls)      { hls.destroy(); hls = null; }
  if (ytPlayer) { try { ytPlayer.destroy(); } catch {} ytPlayer = null; }

  // Таймкод из ссылки (?t=95)
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

// ─── YouTube (IFrame API) ─────────────────────────────────────

function loadYouTube(videoId, startTime) {
  return new Promise(resolve => {
    video.style.display = 'none';

    const overlay = document.getElementById('vidOverlay');
    if (overlay) overlay.style.display = 'none';

    const wrap = document.getElementById('videoWrap');
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
        },
        events: {
          onReady: () => {
            showLoading(false);
            resolve();
            const iframe = document.querySelector('#embedFrame iframe');
            if (iframe) {
              iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
              iframe.allowFullscreen = true;
              iframe.setAttribute('allowfullscreen', '');
              iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
              iframe.style.cssText = 'width:100%;height:100%;border:none;';
            }
          },
          onError: e => { showError('YouTube: видео недоступно (' + e.data + ')'); resolve(); },
          onStateChange: e => {
            if (isHost && e.data === YT.PlayerState.PLAYING) {
              if (si) clearInterval(si);
              si = setInterval(() => {
                if (ytPlayer && isHost) socket.emit('time_update', { time: ytPlayer.getCurrentTime() });
              }, 1000);
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              if (si) { clearInterval(si); si = null; }
            }
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
function platformPlay()      { if (currentPlatform==='youtube') { if (ytOk()) ytPlayer.playVideo(); }   else if (currentPlatform==='vk') sendVKCmd('play');  else video.play().catch(()=>{}); }
function platformPause()     { if (currentPlatform==='youtube') { if (ytOk()) ytPlayer.pauseVideo(); }  else if (currentPlatform==='vk') sendVKCmd('pause'); else video.pause(); }
function platformSeek(t)     { if (currentPlatform==='youtube') { if (ytOk()) ytPlayer.seekTo(t,true); } else if (currentPlatform!=='vk') video.currentTime = t; }
function platformGetTime()   { if (currentPlatform==='youtube') { try { return ytPlayer?.getCurrentTime()||0; } catch { return 0; } } return video.currentTime||0; }
function platformIsPlaying() { if (currentPlatform==='youtube') { try { return ytPlayer?.getPlayerState()===YT.PlayerState.PLAYING; } catch { return false; } } return !video.paused; }
function sendVKCmd(cmd)      { const f=document.getElementById('embedFrame'); if (f?.contentWindow) f.contentWindow.postMessage(JSON.stringify({method:cmd}),'*'); }

// ─── Управление плеером ───────────────────────────────────────

function togglePlay() { if (platformIsPlaying()) playerAction('pause'); else playerAction('play'); }

function playerAction(action) {
  if (action==='play')  { platformPlay();  document.getElementById('bigPlay').textContent='⏸'; addLog('▶ Ты запустил видео','play'); }
  if (action==='pause') { platformPause(); document.getElementById('bigPlay').textContent='▶'; addLog('⏸ Ты поставил паузу','pause'); }
  socket.emit('player_action', { action, time: platformGetTime() });
}

function onSeekInput(el) {
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
  addLog(`🔄 Перемотка на ${fmtTime(t)}`, 'seek');
}

// ─── События видеоэлемента ────────────────────────────────────

video.addEventListener('timeupdate', () => {
  if (isSeeking || currentPlatform !== 'rutube') return;
  const cur = video.currentTime, dur = video.duration || 0;
  if (dur > 0) {
    document.getElementById('vidProgress').value        = (cur/dur)*100;
    document.getElementById('vidTime').textContent      = `${fmtTime(cur)} / ${fmtTime(dur)}`;
  }
  if (isHost && Math.floor(cur) !== Math.floor(cur - 0.25)) socket.emit('time_update', { time: cur });
});
video.addEventListener('waiting', () => showLoading(true));
video.addEventListener('playing', () => showLoading(false));
video.addEventListener('canplay', () => showLoading(false));
video.addEventListener('ended',   () => {
  addLog('⏹ Видео закончилось', 'sys');
  if (isHost && queueItems.length > 0) {
    toast('⏭ Следующее видео через 2 сек…', 'info');
    setTimeout(() => socket.emit('queue_next'), 2000);
  }
});

// ─── Синхронизация ────────────────────────────────────────────

socket.on('player_action', ({ action, time, name }) => {
  if (action==='play')  { platformPlay();  document.getElementById('bigPlay').textContent='⏸'; toast(`▶ ${esc(name)} запустил`,'play');  addLog(`▶ ${esc(name)} запустил`,'play'); }
  if (action==='pause') { platformPause(); document.getElementById('bigPlay').textContent='▶'; toast(`⏸ ${esc(name)} пауза`,'pause');   addLog(`⏸ ${esc(name)} пауза`,'pause'); }
  if (action==='seek')  { platformSeek(time); platformPlay(); document.getElementById('bigPlay').textContent='⏸'; toast(`🔄 ${esc(name)} перемотал на ${fmtTime(time)}`,'info'); addLog(`🔄 ${esc(name)} перемотал`,'seek'); }
  if (action!=='seek' && typeof time==='number') { const diff=Math.abs(platformGetTime()-time); if(diff>0.5) platformSeek(time); }
});

socket.on('sync_time', ({ time, state, force }) => {
  if (isHost) return;
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
});

// ─── Громкость ────────────────────────────────────────────────

function onVolumeChange(el) { video.volume = parseFloat(el.value); video.muted = video.volume===0; updateVolBtn(); }
function toggleMute()       { video.muted = !video.muted; document.getElementById('volSlider').value = video.muted ? 0 : video.volume; updateVolBtn(); }
function updateVolBtn() {
  const b = document.getElementById('volBtn');
  if      (video.muted || video.volume===0) b.textContent = '🔇';
  else if (video.volume < 0.5)              b.textContent = '🔉';
  else                                      b.textContent = '🔊';
}

// ─── Фуллскрин ────────────────────────────────────────────────

function toggleFullscreen() {
  const w  = document.getElementById('videoWrap');
  const el = document.fullscreenElement || document.webkitFullscreenElement;
  if (!el) { const r = w.requestFullscreen || w.webkitRequestFullscreen; if (r) r.call(w); }
  else     { const x = document.exitFullscreen || document.webkitExitFullscreen; if (x) x.call(document); }
}

document.addEventListener('fullscreenchange',       updateFsBtn);
document.addEventListener('webkitfullscreenchange', updateFsBtn);

function updateFsBtn() {
  const btn     = document.querySelector('.fs-btn');
  const chatBtn = document.getElementById('fsChatBtn');
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
}