// ============================================================
//  lib/proxy.js — HLS прокси, Rutube API, YouTube oEmbed
// ============================================================

const https  = require('https');
const urlMod = require('url');

function httpsGet(url, extra = {}) {
  return new Promise((resolve, reject) => {
    const p = new urlMod.URL(url);
    https.get({
      hostname: p.hostname,
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

function registerRoutes(app) {
  // Получение HLS URL для Rutube
  app.get('/api/rutube-hls', async (req, res) => {
    const id = String(req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) return res.status(400).json({ error: 'no id' });
    try {
      const { body } = await httpsGet(
        `https://rutube.ru/api/play/options/${id}/?no_404=true&referer=https%3A%2F%2Frutube.ru&format=json`
      );
      const data   = JSON.parse(body.toString());
      const hlsUrl = data?.video_balancer?.m3u8 || null;
      if (!hlsUrl) return res.status(404).json({ error: 'HLS не найден. Ключи: ' + JSON.stringify(Object.keys(data || {})) });
      res.json({ hlsUrl: `/api/hls-proxy?u=${encodeURIComponent(hlsUrl)}`, title: data?.title || '' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Прокси HLS сегментов
  app.get('/api/hls-proxy', async (req, res) => {
    const targetUrl = req.query.u;
    if (!targetUrl) return res.status(400).send('no url');
    let parsed;
    try { parsed = new urlMod.URL(targetUrl); } catch { return res.status(400).send('bad url'); }

    const allowed = ['rutube.ru', 'cdnvideo.ru', 'rtbcdn.ru', 'video.rutube.ru', 'bl.rutube.ru'];
    if (!allowed.some(d => parsed.hostname.endsWith(d))) return res.status(403).send('forbidden domain');

    try {
      const { status, headers, body } = await httpsGet(targetUrl);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=30');

      if (targetUrl.includes('.m3u8') || (headers['content-type'] || '').includes('mpegurl')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        const text = body.toString('utf8').split('\n').map(line => {
          const l = line.trim();
          if (!l || l.startsWith('#')) return l;
          const abs = l.startsWith('http') ? l : base + l;
          return `/api/hls-proxy?u=${encodeURIComponent(abs)}`;
        }).join('\n');
        return res.send(text);
      }

      res.setHeader('Content-Type', headers['content-type'] || 'video/mp2t');
      res.status(status).send(body);
    } catch (e) {
      res.status(500).send(e.message);
    }
  });
}

module.exports = { httpsGet, fetchVideoTitle, extractVideo, registerRoutes };