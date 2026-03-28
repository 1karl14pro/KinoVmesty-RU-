<<<<<<< HEAD
const https  = require('https');
const http   = require('http');
const urlMod = require('url');
const { execFile } = require('child_process');
=======
// ============================================================
//  lib/proxy.js — HLS прокси, Rutube API, YouTube oEmbed
// ============================================================

const https  = require('https');
const urlMod = require('url');
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a

function httpsGet(url, extra = {}) {
  return new Promise((resolve, reject) => {
    const p = new urlMod.URL(url);
<<<<<<< HEAD
    const transport = p.protocol === 'http:' ? http : https;
    transport.get({
      hostname: p.hostname,
      port:     p.port || undefined,
=======
    https.get({
      hostname: p.hostname,
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
      path:     p.pathname + p.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer':    'https://rutube.ru/',
        'Accept':     'application/json',
        ...extra,
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function fetchVideoTitle(platform, videoId) {
  try {
    if (platform === 'rutube') {
      const { body } = await httpsGet(`https://rutube.ru/api/video/${videoId}/?format=json`);
      return JSON.parse(body.toString())?.title || null;
    }
    if (platform === 'youtube') {
      const { body } = await httpsGet(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      return JSON.parse(body.toString())?.title || null;
    }
    return null;
  } catch { return null; }
}

function extractVideo(url) {
  if (!url) return null;
  let m;

  m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) return { platform: 'youtube', id: m[1] };

  m = url.match(/vkvideo\.ru\/(?:playlist\/[^/]+\/)?video(-?\d+)_(\d+)/) ||
      url.match(/vk\.com\/(?:playlist\/[^/]+\/)?video(-?\d+)_(\d+)/);
  if (m) return { platform: 'vk', id: `${m[1]}_${m[2]}` };

  m = url.match(/rutube\.ru\/(?:video|play\/embed)\/([a-zA-Z0-9_-]+)/);
  if (m) return { platform: 'rutube', id: m[1] };

  return null;
}

<<<<<<< HEAD
// ─── YouTube через yt-dlp ─────────────────────────────────────

// Кэш ссылок — yt-dlp запрос занимает ~2-3 секунды
const ytStreamCache = new Map();
const YT_CACHE_TTL  = 4 * 60 * 60 * 1000; // 4 часа (ссылки живут ~6ч)

function getYoutubeStream(videoId) {
  return new Promise((resolve, reject) => {
    // Проверяем кэш
    const cached = ytStreamCache.get(videoId);
    if (cached && Date.now() - cached.ts < YT_CACHE_TTL) {
      return resolve(cached.url);
    }

    execFile('yt-dlp', [
      '--no-playlist',
      '--no-warnings',
      '-f', 'best[ext=mp4][height<=720]/best[ext=mp4]/best',
      '--get-url',
      `https://www.youtube.com/watch?v=${videoId}`,
    ], { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      const url = stdout.trim().split('\n')[0];
      if (!url || !url.startsWith('http')) return reject(new Error('yt-dlp вернул пустой URL'));
      // Сохраняем в кэш
      ytStreamCache.set(videoId, { url, ts: Date.now() });
      resolve(url);
    });
  });
}

function registerRoutes(app) {

  // ─── Rutube HLS ───────────────────────────────────────────
=======
function registerRoutes(app) {
  // Получение HLS URL для Rutube
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  app.get('/api/rutube-hls', async (req, res) => {
    const id = String(req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) return res.status(400).json({ error: 'no id' });
    try {
<<<<<<< HEAD
      const { body } = await httpsGet(`http://localhost:3099/rutube?id=${id}`);
      const data   = JSON.parse(body.toString());
      const hlsUrl = data?.video_balancer?.m3u8 || null;
      if (!hlsUrl) return res.status(404).json({ error: 'HLS не найден' });
=======
      const { body } = await httpsGet(
        `https://rutube.ru/api/play/options/${id}/?no_404=true&referer=https%3A%2F%2Frutube.ru&format=json`
      );
      const data   = JSON.parse(body.toString());
      const hlsUrl = data?.video_balancer?.m3u8 || null;
      if (!hlsUrl) return res.status(404).json({ error: 'HLS не найден. Ключи: ' + JSON.stringify(Object.keys(data || {})) });
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
      res.json({ hlsUrl: `/api/hls-proxy?u=${encodeURIComponent(hlsUrl)}`, title: data?.title || '' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

<<<<<<< HEAD
  // ─── HLS прокси (Rutube) ──────────────────────────────────
=======
  // Прокси HLS сегментов
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  app.get('/api/hls-proxy', async (req, res) => {
    const targetUrl = req.query.u;
    if (!targetUrl) return res.status(400).send('no url');
    let parsed;
    try { parsed = new urlMod.URL(targetUrl); } catch { return res.status(400).send('bad url'); }

    const allowed = ['rutube.ru', 'cdnvideo.ru', 'rtbcdn.ru', 'video.rutube.ru', 'bl.rutube.ru'];
<<<<<<< HEAD
    if (!allowed.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
      return res.status(403).send('forbidden domain');
    }

    try {
      if (targetUrl.includes('.m3u8') || targetUrl.includes('mpegurl')) {
        const { status, body } = await httpsGet(targetUrl);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=30');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

=======
    if (!allowed.some(d => parsed.hostname.endsWith(d))) return res.status(403).send('forbidden domain');

    try {
      const { status, headers, body } = await httpsGet(targetUrl);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=30');

      if (targetUrl.includes('.m3u8') || (headers['content-type'] || '').includes('mpegurl')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
        const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const text = body.toString('utf8').split('\n').map(line => {
          const l = line.trim();
          if (!l || l.startsWith('#')) return l;
          const abs = l.startsWith('http') ? l : base + l;
          return `/api/hls-proxy?u=${encodeURIComponent(abs)}`;
        }).join('\n');
<<<<<<< HEAD

        return res.status(status).send(text);
      }

      https.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          'Referer': 'https://rutube.ru/'
        }
      }, proxyRes => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'video/mp2t');
        res.status(proxyRes.statusCode);
        proxyRes.pipe(res);
      }).on('error', e => res.status(500).send(e.message));

=======
        return res.send(text);
      }

      res.setHeader('Content-Type', headers['content-type'] || 'video/mp2t');
      res.status(status).send(body);
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
    } catch (e) {
      res.status(500).send(e.message);
    }
  });
<<<<<<< HEAD

  // ─── YouTube stream через yt-dlp ──────────────────────────
  app.get('/api/youtube-stream', async (req, res) => {
    const id = String(req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) return res.status(400).json({ error: 'no id' });

    try {
      const streamUrl = await getYoutubeStream(id);
      res.json({
        streamUrl: `/api/yt-proxy?id=${id}&u=${encodeURIComponent(streamUrl)}`,
      });
    } catch(e) {
      console.error('[YT-DLP]', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ─── YouTube видео прокси ─────────────────────────────────
  app.get('/api/yt-proxy', async (req, res) => {
    const targetUrl = req.query.u;
    if (!targetUrl) return res.status(400).send('no url');

    let parsed;
    try { parsed = new urlMod.URL(targetUrl); } catch { return res.status(400).send('bad url'); }

    // Разрешаем только googlevideo.com
    if (!parsed.hostname.endsWith('.googlevideo.com')) {
      return res.status(403).send('forbidden domain');
    }

    const range = req.headers.range;
    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Referer': 'https://www.youtube.com/',
    };
    if (range) reqHeaders['Range'] = range;

    try {
      const proxyReq = https.request({
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        headers:  reqHeaders,
        method:   'GET',
      }, proxyRes => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'video/mp4');
        if (proxyRes.headers['content-length'])
          res.setHeader('Content-Length', proxyRes.headers['content-length']);
        if (proxyRes.headers['content-range'])
          res.setHeader('Content-Range', proxyRes.headers['content-range']);
        res.status(proxyRes.statusCode);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', e => {
        if (!res.headersSent) res.status(500).send(e.message);
      });
      proxyReq.end();
    } catch (e) {
      if (!res.headersSent) res.status(500).send(e.message);
    }
  });

}

async function fetchThumbnail(platform, videoId) {
  try {
    if (platform === 'youtube') {
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
    if (platform === 'rutube') {
      const { body } = await httpsGet(`https://rutube.ru/api/video/${videoId}/?format=json`);
      return JSON.parse(body.toString())?.thumbnail_url || null;
    }
    return null;
  } catch { return null; }
}

module.exports = { httpsGet, fetchVideoTitle, fetchThumbnail, extractVideo, registerRoutes };
=======
}

module.exports = { httpsGet, fetchVideoTitle, extractVideo, registerRoutes };
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
