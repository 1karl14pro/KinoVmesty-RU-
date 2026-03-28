// ============================================================
<<<<<<< HEAD
//  Файл: playlist.js
//  Расположение: lib/playlist.js
//  Описание: Поиск серий и генерация автоплейлиста (сервер).
//  Содержит парсинг названий видео, обращение к Rutube API 
//  для поиска следующих серий сезона и REST-роуты.
=======
//  lib/playlist.js — поиск серий, автоплейлист (сервер)
//  Исправления:
//    - console.log с данными пользователей заменён на debug-логгер (БАГ 14)
//    - debug-логи выключаются в продакшне через NODE_ENV
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
// ============================================================

const { httpsGet } = require('./proxy');

// БАГ 14: в продакшне console.log засорял stdout и раскрывал данные
const DEBUG = process.env.NODE_ENV !== 'production';
const log   = (...args) => { if (DEBUG) console.log(...args); };

// ─── Парсинг серии из заголовка ──────────────────────────────

function parseEpisode(title) {
  if (!title) return null;
  let m;

  m = title.match(/^(.+?)\s+(\d+)\s*сезон[а]?\s+(\d+)\s*сери[ея]/i);
  if (m) return { showName: m[1].trim(), season: +m[2], episode: +m[3] };

  m = title.match(/сезон[а]?\s+(\d+)\s+сери[ея]\s+(\d+)/i);
  if (m) {
    const showName = title.replace(/сезон[а]?\s+\d+\s+сери[ея]\s+\d+/i, '').trim();
    return { showName, season: +m[1], episode: +m[2] };
  }

  // Без сезона: "Название M серия" → сезон 1
  m = title.match(/^(.+?)\s+(\d+)\s*сери[ея]/i);
  if (m) {
    let showName = m[1].trim();
    const si = showName.indexOf('/');
    if (si > 0) showName = showName.slice(0, si).trim();
    showName = showName.replace(/[\s\-–—]+$/, '').trim();
    if (!showName) return null;
    return { showName, season: 1, episode: +m[2], noSeasonInTitle: true };
  }

  return null;
}

// ─── Поиск через Rutube Search API ───────────────────────────

async function searchRutube(query, pages = 3) {
  const all = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const url = `https://rutube.ru/api/search/video/?query=${encodeURIComponent(query)}&format=json&pageSize=20&page=${page}`;
      const { body } = await httpsGet(url);
      const data    = JSON.parse(body.toString());
      const results = data?.results || [];
      all.push(...results);
      if (!data?.next || results.length < 20) break;
    } catch (e) {
      log(`[SEARCH] стр.${page}:`, e.message);
      break;
    }
  }
  return all;
}

// ─── Сбор всех вариантов серий ───────────────────────────────

function collectEpisodeVariants(results, showName, season) {
  const showLower = showName.toLowerCase();
  const map       = new Map();

  for (const v of results) {
    if (!v.title || !v.id) continue;
    const parsed = parseEpisode(v.title);
    if (!parsed || parsed.season !== season) continue;
    const pl = parsed.showName.toLowerCase();
    if (!pl.includes(showLower) && !showLower.includes(pl)) continue;
    const ep = parsed.episode;
    if (!map.has(ep)) map.set(ep, []);
    map.get(ep).push({
      episode:       ep,
      id:            v.id,
      title:         v.title,
      videoUrl:      `https://rutube.ru/video/${v.id}/`,
      platform:      'rutube',
      authorId:      v.author?.id,
      sourceChannel: v.author?.name || null,
    });
  }

  return map;
}

function pickBestVariant(candidates, preferredAuthorId) {
  return candidates.find(c => c.authorId === preferredAuthorId) || candidates[0];
}

function buildSeasonList(variantsMap, preferredAuthorId) {
  const episodes = [];
  for (const [, candidates] of variantsMap) {
    const best = pickBestVariant(candidates, preferredAuthorId);
    if (best) episodes.push(best);
  }
  return episodes.sort((a, b) => a.episode - b.episode);
}

// ─── Поиск серий одного сезона ───────────────────────────────

async function findSeasonEpisodes(showName, season, preferredAuthorId, noSeasonInTitle = false) {
  const query = noSeasonInTitle ? `${showName} серия` : `${showName} ${season} сезон`;
  log(`[SEARCH] "${query}", автор: ${preferredAuthorId}`);

  let results     = await searchRutube(query, 3);
  let variantsMap = collectEpisodeVariants(results, showName, season);

  if (variantsMap.size < 3) {
    const short = showName.split(' ').slice(0, 2).join(' ');
    if (short !== showName) {
      const q2 = noSeasonInTitle ? `${short} серия` : `${short} ${season} сезон`;
      const r2  = await searchRutube(q2, 2);
      const m2  = collectEpisodeVariants(r2, showName, season);
      for (const [ep, cands] of m2) {
        if (!variantsMap.has(ep)) {
          variantsMap.set(ep, cands);
        } else {
          const ex  = variantsMap.get(ep);
          const ids = new Set(ex.map(c => c.id));
          for (const c of cands) if (!ids.has(c.id)) ex.push(c);
        }
      }
    }
  }

  const episodes = buildSeasonList(variantsMap, preferredAuthorId);

<<<<<<< HEAD
=======
  // БАГ 14: логи только в dev-режиме
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
  episodes.forEach(e => {
    const src = e.authorId === preferredAuthorId ? '✅' : `⚠️(${e.authorId})`;
    log(`  s${season}e${e.episode}: ${src} ${e.title}`);
  });

  return episodes;
}

// ─── Главная функция автоплейлиста ───────────────────────────

async function buildEpisodePlaylist(videoId) {
  try {
    const { body } = await httpsGet(`https://rutube.ru/api/video/${videoId}/?format=json`);
    const meta     = JSON.parse(body.toString());
    const parsed   = parseEpisode(meta.title);

    if (!parsed) return { found: false, reason: 'Не похоже на сериал', title: meta.title };

    const { showName, season, episode, noSeasonInTitle = false } = parsed;
    const authorId = meta.author?.id;

    log(`\n[PLAYLIST] "${showName}" s${season}e${episode} | ${meta.author?.name} (${authorId})`);

    const currentSeasonEps = await findSeasonEpisodes(showName, season, authorId, noSeasonInTitle);
    if (currentSeasonEps.length === 0) return { found: false, reason: 'Серии не найдены', parsed };

    const afterCurrent = currentSeasonEps.filter(e => e.episode > episode);
    const epNums       = currentSeasonEps.map(e => e.episode).sort((a, b) => a - b);
    const maxFoundEp   = epNums[epNums.length - 1] || episode;

    let gaps = 0;
    for (let i = 1; i < epNums.length; i++) if (epNums[i] - epNums[i - 1] > 1) gaps++;
    log(`[PLAYLIST] s${season}: найдено=${epNums.length}, макс=e${maxFoundEp}, пропусков=${gaps}`);

    let nextSeasonEps = [];
    if (episode >= maxFoundEp || afterCurrent.length <= 1) {
      const ns = season + 1;
      const r  = await findSeasonEpisodes(showName, ns, authorId, noSeasonInTitle);
      if (r.length > 0) {
        log(`[PLAYLIST] s${ns}: ${r.length} серий ✅`);
        nextSeasonEps = r;
      }
    }

    const nextEpisodes = [...afterCurrent, ...nextSeasonEps];
    if (!nextEpisodes.length) {
      return {
        found:  false,
        reason: afterCurrent.length === 0 ? 'Финал сезона' : 'Нет серий после текущей',
        parsed,
      };
    }

    log(`[PLAYLIST] В очередь: ${nextEpisodes.length} серий`);
    return {
      found:          true,
      showName,
      season,
      currentEp:      episode,
      totalFound:     epNums.length,
      nextEpisodes,
      hasNextSeason:  nextSeasonEps.length > 0,
      nextSeason:     nextSeasonEps.length > 0 ? season + 1 : null,
    };
  } catch (e) {
    console.error('[PLAYLIST] Ошибка:', e.message);
    return { found: false, reason: e.message };
  }
}

// ─── Роуты ───────────────────────────────────────────────────

function registerRoutes(app) {
  app.get('/api/episode-playlist', async (req, res) => {
<<<<<<< HEAD
    try {
      const id = String(req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!id) return res.status(400).json({ found: false, reason: 'no id' });
      res.json(await buildEpisodePlaylist(id));
    } catch (error) {
      res.status(500).json({ found: false, reason: 'Internal server error' });
    }
  });

  app.get('/api/episode-debug', async (req, res) => {
    try {
      const id = String(req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!id) return res.status(400).json({ error: 'no id' });
      
=======
    const id = String(req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) return res.status(400).json({ found: false, reason: 'no id' });
    res.json(await buildEpisodePlaylist(id));
  });

  app.get('/api/episode-debug', async (req, res) => {
    const id = String(req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) return res.status(400).json({ error: 'no id' });
    try {
>>>>>>> 8aa985c0fce826614df3eaecd62e54070ebb984a
      const { body } = await httpsGet(`https://rutube.ru/api/video/${id}/?format=json`);
      const meta     = JSON.parse(body.toString());
      const parsed   = parseEpisode(meta.title);
      if (!parsed) return res.json({ parsed: null, title: meta.title });

      const results  = await searchRutube(`${parsed.showName} ${parsed.season} сезон`, 3);
      const variants = collectEpisodeVariants(results, parsed.showName, parsed.season);
      const summary  = {};
      for (const [ep, cands] of variants) {
        summary[ep] = cands.map(c => ({ id: c.id, title: c.title, authorId: c.authorId }));
      }

      res.json({
        title:          meta.title,
        parsed,
        authorId:       meta.author?.id,
        authorName:     meta.author?.name,
        searchTotal:    results.length,
        episodeVariants: summary,
        bestChoice:     buildSeasonList(variants, meta.author?.id).map(e => ({
          ep:           e.episode,
          authorId:     e.authorId,
          fromOriginal: e.authorId === meta.author?.id,
          title:        e.title,
        })),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { parseEpisode, buildEpisodePlaylist, registerRoutes };