// Native player routes for the offline mock site (docs/PLAYER.md "Testing"). Loaded by tools/mock-site.cjs, which
// calls handle() before its own routes; handle() returns true when it served the request. Never contacts the real
// site: stream URLs point at generated local media.
//
// Routes
//   POST /index/index/tv_file                tv_file.json shape for any episode, tfid = tid*10000 + season*100 + episode
//   POST /index/index/player?mfid|tfid=N     the player fixture text with stream URLs rewritten to local media
//   POST /index/index/(tv|movie)_progress    records the form body, answers {"code":1}
//   GET  /__mock/progress-log[?reset=1]      recorded progress posts (JSON)
//   GET  /__mock/player-log[?reset=1]        recorded tv_file / player / media requests (JSON)
//   GET  /__mock/expire-links                every stream link issued so far answers 403 from now on
//   GET  /__media/ep.wav?len=S               a silent WAV of S seconds (Range supported, so <video> can seek)
//   GET  /__media/bad*.m3u8                  404 (a failing HLS stream)
//   GET  /__media/hang.m3u8                  never answers (candidate timeout)
//   GET  /__player/blank                     an empty page with a #mbptv root, for player tests and screenshots
//
// Cookies (per test): mbp_seconds=N (resume position), mbp_len=S (media length, default 60),
// mbp_skips=START,END (intro end / credits start; -1 = unknown), mbp_next=0 (no next episode),
// mbp_auto=bad|ok|hang (AUTO HLS; default bad), mbp_org=ok|bad|hang (ORG MP4; default ok), mbp_all=bad (every
// stream fails), mbp_delay=MS (delay the player answer), mbp_tvfile=fail (tv_file answers code 0),
// mbp_mid=ID (movie id in the progress payload, default 40102), mbp_eps=N (episodes per season, default 10),
// mbp_seasons=N (seasons, default 3: the last episode of a season is followed by E1 of the next one),
// mockgate=1 (signed out).
// Special ids: mfid=999 / tfid=999 answer {"code":-1,"msg":"VIP only"}.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fixture = name => fs.readFileSync(path.join(root, 'test', 'fixtures', name), 'utf8');

const LOG_MAX = 500;
const progressLog = [];
const playerLog = [];
function remember(list, entry) { list.push(entry); if (list.length > LOG_MAX) list.shift(); }

function intIn(v, dflt, lo, hi) { const n = parseInt(v, 10); return isNaN(n) ? dflt : Math.max(lo, Math.min(hi, n)); }

function parseForm(body) {
  const out = {};
  String(body || '').split('&').forEach(p => {
    if (!p) return;
    const i = p.indexOf('='), k = i < 0 ? p : p.slice(0, i), v = i < 0 ? '' : p.slice(i + 1);
    try { out[decodeURIComponent(k.replace(/\+/g, ' '))] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { out[k] = v; }
  });
  return out;
}

function readBody(req, cb) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
  req.on('end', () => cb(data));
  req.on('error', () => cb(data));
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

// ---------- media ----------

const wavCache = {};
function wav(seconds) {
  seconds = intIn(seconds, 60, 1, 1800);
  if (wavCache[seconds]) return wavCache[seconds];
  const rate = 4000, n = rate * seconds, buf = Buffer.alloc(44 + n, 128);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8, 'ascii'); buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write('data', 36, 'ascii'); buf.writeUInt32LE(n, 40);
  if (Object.keys(wavCache).length > 8) for (const k of Object.keys(wavCache)) delete wavCache[k];
  wavCache[seconds] = buf;
  return buf;
}

function serveBuffer(req, res, buf, type) {
  const total = buf.length, m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (m) {
    let start, end;
    if (m[1] === '') { start = Math.max(0, total - parseInt(m[2] || '0', 10)); end = total - 1; }
    else { start = parseInt(m[1], 10); end = m[2] === '' ? total - 1 : Math.min(parseInt(m[2], 10), total - 1); }
    if (isNaN(start) || start >= total || start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + total }); return res.end(); }
    res.writeHead(206, Object.assign(head, { 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${total}` }));
    return req.method === 'HEAD' ? res.end() : res.end(buf.subarray(start, end + 1));
  }
  res.writeHead(200, Object.assign(head, { 'Content-Length': total }));
  return req.method === 'HEAD' ? res.end() : res.end(buf);
}

// ---------- player data ----------

function skipsJson(cookie) {
  const [a, b] = String(cookie || '').split(',');
  const start = a === undefined || a === '' ? -1 : Number(a), end = b === undefined || b === '' ? -1 : Number(b);
  return JSON.stringify({ start: isNaN(start) ? -1 : start, start_type: 'other', start_is_multi: 0, end: isNaN(end) ? -1 : end, end_type: 'other', end_is_multi: 0, start_top_list: [], end_top_list: [] });
}

// Stream links carry a token like the site's signed ones; /__mock/expire-links makes every link issued so far answer
// 403 (the tokens "expired"), while links from later player-data answers work again.
let tokenSeq = 0, expiredUpTo = 0;

function sourcesFor(host, query, cookies) {
  const origin = 'http://' + host, len = intIn(cookies.mbp_len, 60, 5, 1800), tok = ++tokenSeq;
  const hevc = query.mfid === '2215085';
  const good = q => `${origin}/__media/ep.wav?len=${len}&q=${q}&sign=REDACTED&t=1700000000&tok=${tok}`;
  const bad = q => `${origin}/__media/bad-${q}.${q === 'org' ? 'mp4' : 'm3u8'}?sign=REDACTED&t=1700000000&client=mbp`;
  const hang = `${origin}/__media/hang.m3u8?sign=REDACTED`;
  const pick = (mode, q) => cookies.mbp_all === 'bad' ? bad(q) : mode === 'ok' ? good(q) : mode === 'hang' ? hang : bad(q);
  const autoMode = cookies.mbp_auto || 'bad', orgMode = cookies.mbp_org || 'ok';
  const org = { type: 'video/mp4', file: pick(orgMode, 'org'), label: 'ORG', mp4_id: 886357, h265: hevc ? 1 : 0,
    width: hevc ? 3840 : 1920, height: hevc ? 2160 : 1080, bitstream: 8484, size: 2, hdr: hevc ? 1 : 0, fps: hevc ? 24 : 25 };
  const hls = (label, q, w, h) => ({ type: 'application/x-mpegURL', file: pick(label === 'AUTO' ? autoMode : 'ok', q), label, mp4_id: 2353127, h265: 0,
    width: w, height: h, bitstream: w ? 8484 : 0, size: w ? 2 : 0, hdr: 0, fps: w ? 25 : 0 });
  return [org, hls('AUTO', 'auto', 0, 0), hls('1080p', '1080p', 1920, 1080), hls('720p', '720p', 0, 0), hls('360p', '360p', 0, 0)];
}

// tfid = tid*10000 + season*100 + episode (seasons and episodes up to 99).
function tfidOf(tid, season, episode) { return tid * 10000 + season * 100 + episode; }
function tfidParts(v) {
  const n = parseInt(v, 10) || 0;
  return { tid: Math.floor(n / 10000), season: Math.floor(n / 100) % 100, episode: n % 100 };
}

// The next episode the site would name: E+1 in the season, else E1 of the next season, else none.
function nextEpisode(season, episode, cookies) {
  if (cookies.mbp_next === '0') return null;
  const eps = intIn(cookies.mbp_eps, 10, 1, 99), seasons = intIn(cookies.mbp_seasons, 3, 1, 99);
  if (episode < eps) return { season, episode: episode + 1 };
  if (season < seasons) return { season: season + 1, episode: 1 };
  return null;
}

function playerText(host, query, cookies) {
  const tv = !!query.tfid;
  let text = fixture(tv ? 'player-tv.txt' : 'player-movie.txt');
  // The live (first, uncommented) sources line; the commented //var sources line stays as a decoy.
  const srcJson = JSON.stringify(sourcesFor(host, query, cookies)).replace(/\//g, '\\/');
  text = text.replace(/^(\s*)var sources = \[.*\];\s*$/m, (s, ind) => `${ind}var sources = ${srcJson};`);
  text = text.replace(/var seconds = \d+;/, `var seconds = ${intIn(cookies.mbp_seconds, 0, 0, 100000)};`);
  text = text.replace(/var skips = '[^']*';/, `var skips = '${skipsJson(cookies.mbp_skips)}';`);
  if (tv) {
    const { tid, season, episode } = tfidParts(query.tfid);
    const next = nextEpisode(season, episode, cookies);
    text = text.replace(/var next_season = '[^']*';/, `var next_season = '${next ? next.season : ''}';`)
      .replace(/var next_episode = '[^']*';/, `var next_episode = '${next ? next.episode : ''}';`)
      .replace(/var tid = \d+;/, `var tid = ${tid};`)
      .replace(/var current_season = \d+;/, `var current_season = ${season};`)
      .replace(/var current_episode = \d+;/, `var current_episode = ${episode};`)
      .replace(/var post = \{[^}]*\};/, `var post = ${JSON.stringify({ type: 'tv', tid, season, episode })};`);
  } else {
    const mid = /^\d+$/.test(cookies.mbp_mid || '') ? cookies.mbp_mid : '40102';
    text = text.replace(/var post = \{[^}]*\};/, `var post = {"type":"movie","mid":${mid}};`);
  }
  return text;
}

function tvFileJson(body) {
  const f = parseForm(body), tid = intIn(f.tid, 0, 0, 1e7), season = intIn(f.season, 1, 0, 99), episode = intIn(f.episode, 1, 0, 99);
  const tfid = tfidOf(tid, season, episode);
  const code = 'S' + String(season).padStart(2, '0') + 'E' + String(episode).padStart(2, '0');
  const raw = fixture('tv_file.json').replace(/tfid=\d+/, 'tfid=' + tfid).replace(/S01E01/g, code)
    .replace(/id=17417/g, 'id=' + tid).replace(/season=1&episode=1/g, `season=${season}&episode=${episode}`);
  return raw;
}

// ---------- routes ----------

function handle(u, query, cookies, req, res, send, helpers) {
  const p = u.pathname;
  const signedOut = cookies.mockgate === '1';
  const gate = () => send(200, 'text/html; charset=utf-8', helpers && helpers.read ? helpers.read('gate.html') : '<title>Private Garden</title><a class="login_btn" href="/index/login">Login</a>');

  if (p === '/__player/blank') {
    send(200, 'text/html; charset=utf-8', '<!doctype html><html><head><meta charset="utf-8"><title>MovieBoxPro</title></head>' +
      '<body style="margin:0;background:#07070a"><div id="mbptv" data-screen="detail"></div></body></html>');
    return true;
  }

  if (p.startsWith('/__media/')) {
    remember(playerLog, { t: Date.now(), kind: 'media', path: p, query });
    if (query.tok && +query.tok <= expiredUpTo) { send(403, 'text/plain', 'expired'); return true; }
    if (p === '/__media/ep.wav') { serveBuffer(req, res, wav(query.len), 'audio/wav'); return true; }
    if (p === '/__media/hang.m3u8') { const timer = setTimeout(() => { try { res.destroy(); } catch (e) {} }, 30000); req.on('close', () => clearTimeout(timer)); return true; }
    send(404, 'text/plain', 'not found');
    return true;
  }

  if (p === '/__mock/progress-log') {
    const list = progressLog.slice();
    if (query.reset === '1') progressLog.length = 0;
    json(res, 200, list);
    return true;
  }
  if (p === '/__mock/expire-links') {
    expiredUpTo = tokenSeq;
    json(res, 200, { expiredUpTo });
    return true;
  }
  if (p === '/__mock/player-log') {
    const list = playerLog.slice();
    if (query.reset === '1') playerLog.length = 0;
    json(res, 200, list);
    return true;
  }

  if (p === '/index/index/tv_file') {
    readBody(req, body => {
      remember(playerLog, { t: Date.now(), kind: 'tv_file', path: p, method: req.method, body: parseForm(body), xrw: req.headers['x-requested-with'] || '' });
      if (signedOut) return gate();
      if (cookies.mbp_tvfile === 'fail') return json(res, 200, { code: 0, msg: 'This episode is not ready yet' });
      send(200, 'application/json; charset=utf-8', tvFileJson(body));
    });
    return true;
  }

  if (p === '/index/index/player') {
    readBody(req, body => {
      remember(playerLog, { t: Date.now(), kind: 'player', path: p, method: req.method, query, body, xrw: req.headers['x-requested-with'] || '' });
      const answer = () => {
        if (signedOut) return gate();
        if (query.mfid === '999' || query.tfid === '999') return json(res, 200, { code: -1, msg: 'VIP only' });
        send(200, 'text/html; charset=utf-8', playerText(req.headers.host, query, cookies));
      };
      const delay = intIn(cookies.mbp_delay, 0, 0, 120000);
      if (delay) setTimeout(answer, delay); else answer();
    });
    return true;
  }

  const pm = /^\/index\/index\/(tv|movie)_progress$/.exec(p);
  if (pm) {
    readBody(req, body => {
      if (signedOut) return gate();
      remember(progressLog, { t: Date.now(), path: p, kind: pm[1], method: req.method, body: parseForm(body), raw: body,
        xrw: req.headers['x-requested-with'] || '', type: req.headers['content-type'] || '' });
      json(res, 200, { code: 1, msg: 'success' });
    });
    return true;
  }

  return false;
}

module.exports = { handle, wav, playerText, tvFileJson, tfidOf, tfidParts, nextEpisode };
