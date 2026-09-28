// Native player tests (docs/PLAYER.md "Testing"). Standalone: node test/player.test.cjs
// Runs NativePlayer from a bundle of src/00-core.js, 10-site.js, 20-api.js and 55-player.js (+ shell.css and
// player.css as CSS_TEXT) on a blank mock page with a stub #mbptv root, against the mock routes in
// tools/mock-extra.cjs (local silent WAV "streams", a failing HLS URL, progress recording). Keys are real keyboard
// events routed the way App routes them: Keys.name(event) -> NativePlayer.key(name, event).
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { launch, openPage, makeRunner, mockSite, root } = require('./helpers.cjs');

const FILES = ['00-core.js', '10-site.js', '20-api.js', '55-player.js'];
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function cssText() {
  return ['shell.css', 'player.css'].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
}

// Stub root + the App's key routing + recorded hooks.
const HARNESS = `
  var style = document.createElement('style');
  style.id = 'mbptv-css';
  style.appendChild(document.createTextNode(CSS_TEXT));
  document.head.appendChild(style);
  var mbRoot = document.getElementById('mbptv');
  var events = [];
  var hooks = {
    mount: mbRoot,
    onOpen: function () { events.push({ type: 'open' }); mbRoot.setAttribute('data-screen', 'player'); },
    onClose: function (info) { events.push({ type: 'close', info: info }); mbRoot.setAttribute('data-screen', 'detail'); },
    onFallback: function (req, reason) { events.push({ type: 'fallback', req: req, reason: reason }); },
    onProgress: function (info) { events.push({ type: 'progress', info: info }); },
    onNext: function (req) { events.push({ type: 'next', req: req }); }
  };
  window.addEventListener('keydown', function (e) {
    var name = Keys.name(e);
    if (!name || !NativePlayer.active()) return;
    if (NativePlayer.key(name, e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  window.__p = { NativePlayer: NativePlayer, Log: Log, Api: Api, Prefs: Prefs, Site: Site, U: U, Keys: Keys, events: events, hooks: hooks,
    play: function (req) { return NativePlayer.play(req, hooks); } };
`;

function bundle(origin) {
  return ['(function () {', "'use strict';", "var VERSION = 'test';", 'var START_URL = ' + JSON.stringify(origin + '/') + ';',
    'var CSS_TEXT = ' + JSON.stringify(cssText()) + ';']
    .concat(FILES.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')))
    .concat([HARNESS, '}());'])
    .join('\n');
}

const fixture = name => fs.readFileSync(path.join(root, 'test', 'fixtures', name), 'utf8');

const t = makeRunner('player');
let server, browser, origin, code;
const pages = [];

async function open(cookies = {}, opts = {}) {
  const page = await openPage(browser, { tv: false, ua: opts.ua });
  pages.push(page);
  const list = Object.keys(cookies).map(name => ({ name, value: String(cookies[name]), url: origin }));
  if (list.length) await page.context_.addCookies(list);
  await page.goto(origin + '/__player/blank');
  await page.addScriptTag({ content: code });
  await page.evaluate(() => Promise.all([fetch('/__mock/progress-log?reset=1'), fetch('/__mock/player-log?reset=1')]));
  if (opts.config) await page.evaluate(c => window.__p.NativePlayer.configure(c), opts.config);
  if (opts.saver) {
    await page.evaluate(() => {
      window.__saver = [];
      window.webapis = { appcommon: { AppCommonScreenSaverState: { SCREEN_SAVER_OFF: 0, SCREEN_SAVER_ON: 1 },
        setScreenSaver: function (state) { window.__saver.push(state); } } };
    });
  }
  return page;
}

async function done(page) {
  // Never log stream URLs; never throw.
  const entries = await page.evaluate(() => window.__p.Log.entries().concat(window.__p.Log.persisted()).map(e => e.label + ' ' + e.msg).join('\n'));
  assert.ok(!/__media|\.m3u8|\.wav|\.mp4|sign=|REDACTED/.test(entries), 'a stream URL reached the log:\n' + entries);
  assert.deepStrictEqual(page.errors, [], 'page errors');
  await page.context_.close();
}

const MOVIE = { kind: 'movie', id: '40102', title: 'The Batman' };
const EPISODE = { kind: 'tv', id: '17417', season: 1, episode: 1, title: 'Putin: A Russian Spy Story', showTitle: 'Putin: A Russian Spy Story', episodeTitle: 'The Rise of Putin' };

const play = (page, req) => page.evaluate(r => window.__p.play(r), req);
const info = page => page.evaluate(() => window.__p.NativePlayer.info());
const events = (page, type) => page.evaluate(ty => window.__p.events.filter(e => !ty || e.type === ty), type);
const video = page => page.evaluate(() => { const v = document.querySelector('#mbptv-player video'); return v ? { t: v.currentTime, paused: v.paused, d: v.duration } : null; });
const setTime = (page, s) => page.evaluate(x => { document.querySelector('#mbptv-player video').currentTime = x; }, s);
const progressLog = page => page.evaluate(() => fetch('/__mock/progress-log').then(r => r.json()));
const playerLog = page => page.evaluate(() => fetch('/__mock/player-log').then(r => r.json()));
const rootClass = page => page.evaluate(() => { const r = document.getElementById('mbptv-player'); return r ? ' ' + r.className + ' ' : ''; });
const state = page => page.evaluate(() => { const r = document.getElementById('mbptv-player'); return r ? r.getAttribute('data-state') : ''; });
const text = (page, sel) => page.evaluate(s => { const n = document.querySelector(s); return n ? n.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
const focusedAction = page => page.evaluate(() => { const n = document.querySelector('#mbptv-player .mbp-btns .is-focused'); return n ? n.getAttribute('data-action') : ''; });
const key = (page, name) => page.evaluate(n => window.__p.NativePlayer.key(n, {}), name);

async function waitPlaying(page, extra, timeout = 20000) {
  await page.waitForFunction(x => {
    const i = window.__p.NativePlayer.info();
    const v = document.querySelector('#mbptv-player video');
    if (!i || i.state !== 'playing' || !i.started || !v || v.paused) return false;
    for (const k in (x || {})) if (i[k] !== x[k]) return false;
    return true;
  }, extra || null, { timeout });
}

async function waitTime(page, min, timeout = 20000) {
  await page.waitForFunction(m => { const v = document.querySelector('#mbptv-player video'); return v && v.currentTime >= m; }, min, { timeout });
}

async function waitClass(page, cls, on = true, timeout = 10000) {
  await page.waitForFunction(([c, o]) => {
    const r = document.getElementById('mbptv-player');
    return !!r && (' ' + r.className + ' ').indexOf(' ' + c + ' ') >= 0 === o;
  }, [cls, on], { timeout });
}

async function waitPosts(page, n, timeout = 8000) {
  const until = Date.now() + timeout;
  for (;;) {
    const list = await progressLog(page);
    if (list.length >= n) return list;
    if (Date.now() > until) throw new Error(`expected ${n} progress posts, got ${list.length}: ` + JSON.stringify(list.map(p => p.body)));
    await page.waitForTimeout(100);
  }
}

function near(actual, expected, tol, label) {
  assert.ok(Math.abs(actual - expected) <= tol, `${label || 'value'}: ${actual} not within ${tol} of ${expected}`);
}

/* ---------- pure helpers ---------- */

t.test('parser reads the player data with regexes, skipping the commented sources line and never evaluating', async () => {
  const page = await open();
  const out = await page.evaluate(([tv, movie]) => {
    const P = window.__p.NativePlayer;
    const evil = 'var sources = [{"type":"video/mp4","file":"https://x.example/a.mp4","label":"ORG"}]; window.__evil = 1;\nvar seconds = 5;';
    const commentedFirst = '  //var sources = [{"type":"video/mp4","file":"https://decoy.example/d.mp4","label":"ORG"}];\n' +
      '  var sources = [{"type":"application\\/x-mpegURL","file":"https:\\/\\/real.example\\/r.m3u8","label":"AUTO"}];';
    return { tv: P._parse(tv), movie: P._parse(movie), vip: P._parse('{"code":-1,"msg":"VIP only"}'), evil: P._parse(evil), evilRan: !!window.__evil,
      commented: P._parse(commentedFirst), empty: P._parse(''), garbage: P._parse('<html><body>nothing</body></html>') };
  }, [fixture('player-tv.txt'), fixture('player-movie.txt')]);
  const tv = out.tv;
  assert.deepStrictEqual(tv.sources.map(s => s.label), ['ORG', 'AUTO', '1080p', '720p', '360p']);
  assert.ok(tv.sources.every(s => /^https:\/\/(usa7-as01|hls)\.shegu\.net\//.test(s.src)), 'the commented //var sources line was used');
  assert.deepStrictEqual(tv.sources.map(s => s.hls), [false, true, true, true, true]);
  assert.strictEqual(tv.sources[0].width, 1920);
  assert.strictEqual(tv.seconds, 31);
  assert.strictEqual(tv.mp4Id, '886357');
  assert.deepStrictEqual(tv.next, { season: 1, episode: 2 });
  assert.strictEqual(tv.tid, '17417');
  assert.strictEqual(tv.season, 1);
  assert.strictEqual(tv.episode, 1);
  assert.deepStrictEqual(tv.skips, { start: -1, end: -1 });
  assert.deepStrictEqual(tv.post, { type: 'tv', tid: '17417', season: '1', episode: '1' });
  assert.strictEqual(tv.progressUrl, '/index/index/tv_progress');
  assert.strictEqual(tv.ok, true);
  const mv = out.movie;
  assert.strictEqual(mv.sources[0].h265, true);
  assert.strictEqual(mv.next, null);
  assert.strictEqual(mv.seconds, 3);
  assert.deepStrictEqual(mv.post, { type: 'movie', mid: '1831' });
  assert.strictEqual(mv.progressUrl, '/index/index/movie_progress');
  assert.strictEqual(out.vip.code, -1);
  assert.strictEqual(out.vip.msg, 'VIP only');
  assert.strictEqual(out.vip.sources.length, 0);
  assert.strictEqual(out.evilRan, false, 'player data must never be evaluated');
  assert.strictEqual(out.evil.sources.length, 1);
  assert.deepStrictEqual(out.commented.sources.map(s => s.src), ['https://real.example/r.m3u8']);
  assert.strictEqual(out.empty.ok, false);
  assert.strictEqual(out.garbage.sources.length, 0);
  await done(page);
});

t.test('stream order: TV tries AUTO HLS (+audio=aac) first; elsewhere a decodable ORG MP4 comes first', async () => {
  const page = await open();
  const out = await page.evaluate(src => {
    const P = window.__p.NativePlayer, sources = P._parse(src).sources;
    const hevc = sources.map(s => Object.assign({}, s, s.label === 'ORG' ? { h265: true } : {}));
    const h264Only = mime => /avc1/.test(mime) ? 'probably' : '';
    const labels = list => list.map(c => c.label);
    return {
      tv: P._order(sources, { tv: true, aac: true, canPlay: () => '' }),
      desk: labels(P._order(sources, { tv: false, aac: false, canPlay: h264Only })),
      deskAac: P._order(sources, { tv: false, aac: true, canPlay: h264Only }),
      deskHevc: labels(P._order(hevc, { tv: false, aac: false, canPlay: h264Only })),
      deskHevcOk: labels(P._order(hevc, { tv: false, aac: false, canPlay: () => 'maybe' }))
    };
  }, fixture('player-tv.txt'));
  assert.deepStrictEqual(out.tv.map(c => c.label), ['AUTO', 'ORG', '1080p', '720p', '360p']);
  assert.ok(/[?&]audio=aac$/.test(out.tv[0].src), 'AUTO carries audio=aac on TV');
  assert.ok(out.tv.filter(c => c.hls).every(c => /audio=aac/.test(c.src)), 'every HLS URL carries audio=aac on TV');
  assert.ok(!/audio=aac/.test(out.tv[1].src), 'the MP4 is untouched');
  assert.deepStrictEqual(out.desk, ['ORG', 'AUTO', '1080p', '720p', '360p']);
  assert.ok(out.deskAac.filter(c => c.hls).every(c => /audio=aac/.test(c.src)), 'aac when EAC3 is unsupported');
  assert.deepStrictEqual(out.deskHevc, ['AUTO', '1080p', '720p', '360p', 'ORG'], 'undecodable HEVC ORG goes last');
  assert.deepStrictEqual(out.deskHevcOk, ['ORG', 'AUTO', '1080p', '720p', '360p']);
  await done(page);
});

/* ---------- playback ---------- */

t.test('movie: loading screen at once, AUTO HLS fails, the ORG MP4 plays (TV rules: audio=aac, POST jwplayer=1)', async () => {
  const page = await open({ mbp_len: 300 });
  assert.strictEqual(await play(page, Object.assign({ backdrop: origin + '/__img/tmdb/t/p/w1280/TEST_backdrop_40102.jpg' }, MOVIE)), true);
  assert.strictEqual(await state(page), 'loading');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-load-title'), 'The Batman');
  assert.strictEqual(await page.evaluate(() => document.getElementById('mbptv').contains(document.getElementById('mbptv-player'))), true, 'mounted in #mbptv');
  assert.strictEqual(await page.evaluate(() => window.__p.NativePlayer.active()), true);
  assert.deepStrictEqual((await events(page, 'open')).length, 1);
  await waitPlaying(page);
  const i = await info(page);
  assert.strictEqual(i.label, 'ORG');
  assert.strictEqual(i.stream, 'mp4');
  assert.strictEqual(i.kind, 'movie');
  assert.strictEqual(i.id, '40102');
  near(i.duration, 300, 1, 'duration');
  const log = await playerLog(page);
  const player = log.filter(e => e.kind === 'player');
  assert.strictEqual(player.length, 1);
  assert.strictEqual(player[0].method, 'POST');
  assert.strictEqual(player[0].query.mfid, '2176222', 'Prefs quality "best" plays the first listed file');
  assert.strictEqual(player[0].query.jwplayer, '1');
  assert.strictEqual(player[0].xrw, 'XMLHttpRequest');
  const media = log.filter(e => e.kind === 'media');
  assert.ok(/^\/__media\/bad-auto\.m3u8$/.test(media[0].path), 'AUTO HLS is tried first on a TV: ' + media[0].path);
  assert.strictEqual(media[0].query.audio, 'aac');
  assert.ok(media.some(m => m.path === '/__media/ep.wav' && m.query.q === 'org'), 'then the ORG MP4');
  const entries = await page.evaluate(() => window.__p.Log.entries().map(e => e.msg).join('\n'));
  assert.ok(/stream AUTO failed: media-\d/.test(entries), entries);
  assert.ok(/playing ORG/.test(entries));
  assert.strictEqual(await text(page, '#mbptv-player .mbp-title'), 'The Batman');
  await done(page);
});

t.test('desktop browsers play a decodable ORG MP4 first (no HLS attempt)', async () => {
  const page = await open({ mbp_len: 120 }, { ua: DESKTOP_UA });
  await play(page, MOVIE);
  await waitPlaying(page);
  assert.strictEqual((await info(page)).label, 'ORG');
  const media = (await playerLog(page)).filter(e => e.kind === 'media');
  assert.ok(media.length && media.every(m => m.path === '/__media/ep.wav'), JSON.stringify(media.map(m => m.path)));
  await done(page);
});

t.test('resume at var seconds, with the chip; Down then OK starts over', async () => {
  const page = await open({ mbp_len: 300, mbp_seconds: 95 });
  await play(page, MOVIE);
  await waitPlaying(page);
  near((await video(page)).t, 95, 2.5, 'resumed position');
  await page.waitForFunction(() => document.querySelector('#mbptv-player .mbp-chip.is-on'));
  assert.strictEqual(await text(page, '#mbptv-player .mbp-chip'), 'Resumed at 1:35 · press Down for Start over');
  await page.keyboard.press('ArrowDown');
  assert.ok((await rootClass(page)).indexOf(' is-osd ') >= 0);
  assert.strictEqual(await focusedAction(page), 'start-over');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#mbptv-player video').currentTime < 5);
  assert.strictEqual((await video(page)).paused, false);
  await done(page);
});

t.test('no resume when seconds is at most 10 or within the last minute', async () => {
  for (const [secs, len] of [[8, 300], [250, 300]]) {
    const page = await open({ mbp_len: len, mbp_seconds: secs });
    await play(page, MOVIE);
    await waitPlaying(page);
    assert.ok((await video(page)).t < 5, `seconds=${secs} must not resume`);
    assert.strictEqual(await page.evaluate(() => !!document.querySelector('#mbptv-player .mbp-chip.is-on')), false);
    await done(page);
  }
});

t.test('OSD appears on any key, hides after 4 s while playing and stays while paused; OK pauses and plays', async () => {
  const page = await open({ mbp_len: 300 });
  await play(page, MOVIE);
  await waitPlaying(page);
  await waitClass(page, 'is-osd', false, 7000);
  await page.keyboard.press('ArrowUp');
  assert.ok((await rootClass(page)).indexOf(' is-osd ') >= 0, 'Up shows the OSD');
  const shownAt = Date.now();
  await waitClass(page, 'is-osd', false, 7000);
  near(Date.now() - shownAt, 4000, 900, 'auto-hide delay (ms)');
  await page.keyboard.press('Enter');
  assert.strictEqual((await video(page)).paused, true, 'OK pauses');
  assert.ok((await rootClass(page)).indexOf(' is-paused ') >= 0);
  assert.ok((await rootClass(page)).indexOf(' is-osd ') >= 0);
  await page.waitForTimeout(5000);
  assert.ok((await rootClass(page)).indexOf(' is-osd ') >= 0, 'the OSD stays while paused');
  await page.keyboard.press('Enter');
  assert.strictEqual((await video(page)).paused, false, 'OK plays');
  await waitClass(page, 'is-osd', false, 7000);
  await done(page);
});

t.test('progress posts the site payload to movie_progress (pause, seek, periodic) and reports onProgress', async () => {
  // 1200 s of media, so over = (runtime - time < 300) is 0 early on, as in a real film.
  const page = await open({ mbp_len: 1200 }, { config: { seekReport: 300 } });
  await play(page, MOVIE);
  await waitPlaying(page);
  await waitTime(page, 2.2);
  assert.strictEqual((await progressLog(page)).length, 0, 'nothing posted before a reason to');
  await page.keyboard.press('Enter');
  await waitPosts(page, 1);
  const first = (await progressLog(page))[0];
  assert.strictEqual(first.path, '/index/index/movie_progress');
  assert.strictEqual(first.method, 'POST');
  assert.strictEqual(first.xrw, 'XMLHttpRequest');
  assert.ok(/application\/x-www-form-urlencoded/.test(first.type));
  assert.deepStrictEqual(Object.keys(first.body), ['type', 'mid', 'over', 'seconds', 'mp4_id']);
  assert.strictEqual(first.body.type, 'movie');
  assert.strictEqual(first.body.mid, '40102');
  assert.strictEqual(first.body.over, '0');
  assert.strictEqual(first.body.mp4_id, '886357');
  assert.ok(/^\d+$/.test(first.body.seconds) && +first.body.seconds >= 2, 'integer seconds: ' + first.body.seconds);
  const ev = (await events(page, 'progress')).map(e => e.info);
  assert.deepStrictEqual(Object.keys(ev[0]).sort(), ['duration', 'episode', 'id', 'kind', 'over', 'season', 'seconds']);
  assert.strictEqual(ev[0].kind, 'movie');
  assert.strictEqual(ev[0].seconds, +first.body.seconds);
  assert.strictEqual(ev[0].duration, 1200);
  await page.waitForTimeout(1500);
  assert.strictEqual((await progressLog(page)).length, 1, 'no duplicate post while paused');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await waitPosts(page, 2, 5000);
  const seek = (await progressLog(page))[1];
  assert.ok(+seek.body.seconds >= 12, 'a seek posts the new position: ' + seek.body.seconds);
  await done(page);

  // Periodic posts while playing (every 20 s by default; 1.2 s here), each at a new second.
  const page2 = await open({ mbp_len: 1200 }, { config: { progressEvery: 1200 } });
  await play(page2, MOVIE);
  await waitPlaying(page2);
  await waitPosts(page2, 2, 8000);
  const ticks = (await progressLog(page2)).map(p => +p.body.seconds);
  assert.ok(ticks[1] > ticks[0], 'ticks advance: ' + ticks.join(', '));
  await done(page2);
});

t.test('Left/Right seek by 10 s after 400 ms; holding accelerates to 30 s and 60 s steps with a bubble', async () => {
  const page = await open({ mbp_len: 1200 });
  await play(page, MOVIE);
  await waitPlaying(page);
  await waitTime(page, 1);
  let t0 = (await video(page)).t;
  await page.keyboard.press('ArrowRight');
  assert.ok((await rootClass(page)).indexOf(' is-seeking ') >= 0, 'bubble shown while the seek is pending');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-bubble-delta'), '+10 s');
  assert.ok((await video(page)).t < t0 + 3, 'not applied before 400 ms');
  await page.waitForTimeout(700);
  near((await video(page)).t, t0 + 10, 1.5, 'after Right');
  assert.ok((await rootClass(page)).indexOf(' is-seeking ') < 0);
  t0 = (await video(page)).t;
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(700);
  near((await video(page)).t, t0 - 10, 1.5, 'after Left');
  // Hold Right: 1 press + 19 auto-repeats = 10 + 4x10 + 10x30 + 5x60 = 650 s.
  t0 = (await video(page)).t;
  for (let i = 0; i < 20; i++) await page.keyboard.down('ArrowRight');
  await page.keyboard.up('ArrowRight');
  const bubble = await text(page, '#mbptv-player .mbp-bubble-delta');
  assert.ok(/^\+\d+:\d\d$/.test(bubble), 'bubble shows the jump: ' + bubble);
  await page.waitForTimeout(800);
  const jumped = (await video(page)).t - t0;
  assert.ok(jumped > 600 && jumped < 700, 'hold acceleration reached 60 s steps: jumped ' + jumped);
  await done(page);
});

t.test('quality sheet lists Auto/1080p/720p/360p/Original (+ files) and switching keeps the position', async () => {
  const page = await open({ mbp_len: 300, mbp_seconds: 60 });
  await play(page, MOVIE);
  await waitPlaying(page);
  // The resume chip is up, so Down lands on Start over; Quality sits just left of it.
  await page.keyboard.press('ArrowDown');
  assert.strictEqual(await focusedAction(page), 'start-over');
  await page.keyboard.press('ArrowLeft');
  assert.strictEqual(await focusedAction(page), 'quality');
  assert.strictEqual(await text(page, '#mbptv-player [data-action="quality"] .mbp-btn-value'), 'Original');
  await page.keyboard.press('Enter');
  await waitClass(page, 'is-sheet');
  const rows = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#mbptv-player [data-quality]'), r => ({
    q: r.getAttribute('data-quality'), cur: r.classList.contains('is-current'), focus: r.classList.contains('is-focused'), meta: (r.querySelector('.mbp-opt-meta') || {}).textContent || '' })));
  assert.deepStrictEqual(rows.map(r => r.q), ['AUTO', '1080p', '720p', '360p', 'ORG']);
  assert.deepStrictEqual(rows.filter(r => r.cur).map(r => r.q), ['ORG']);
  assert.deepStrictEqual(rows.filter(r => r.focus).map(r => r.q), ['ORG']);
  assert.ok(/1920 × 1080/.test(rows[4].meta) && /H\.264/.test(rows[4].meta), rows[4].meta);
  assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#mbptv-player [data-file-index]').length), 2, 'both movie files listed');
  const before = (await video(page)).t;
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await waitClass(page, 'is-sheet', false);
  await waitPlaying(page, { label: '720p' });
  await waitTime(page, before - 3, 8000);
  near((await video(page)).t, before, 3, 'position after the switch');
  const media = (await playerLog(page)).filter(e => e.kind === 'media' && e.query.q === '720p');
  assert.ok(media.length && media[0].query.audio === 'aac', '720p HLS requested with audio=aac');
  await done(page);
});

t.test('Skip Intro: floating pill and button while currentTime < skips.start; OK skips to the intro end', async () => {
  const page = await open({ mbp_len: 300, mbp_skips: '40,-1' }, { config: { osdHide: 1200 } });
  await play(page, MOVIE);
  await waitPlaying(page);
  await waitClass(page, 'is-osd', false);
  await page.waitForFunction(() => document.querySelector('#mbptv-player .mbp-skip.is-on.is-focused'));
  await page.keyboard.press('ArrowDown');
  assert.strictEqual(await page.evaluate(() => !!document.querySelector('#mbptv-player .mbp-btns [data-action="skip-intro"]')), true, 'Skip Intro in the buttons row');
  assert.strictEqual(await page.evaluate(() => !!document.querySelector('#mbptv-player .mbp-skip.is-on')), false, 'the pill hides while the OSD shows');
  await waitClass(page, 'is-osd', false);
  await page.waitForFunction(() => document.querySelector('#mbptv-player .mbp-skip.is-on'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#mbptv-player video').currentTime >= 40);
  assert.strictEqual((await video(page)).paused, false, 'OK on the pill skips instead of pausing');
  await page.waitForFunction(() => !document.querySelector('#mbptv-player .mbp-skip.is-on'));
  await page.keyboard.press('ArrowDown');
  assert.strictEqual(await page.evaluate(() => !!document.querySelector('#mbptv-player .mbp-btns [data-action="skip-intro"]')), false);
  await done(page);
});

t.test('Up Next near the end counts down and autoplays S1E2 in the same player (Netflix style)', async () => {
  const page = await open({ mbp_len: 60 }, { config: { upNextCount: 3 } });
  await play(page, EPISODE);
  await waitPlaying(page);
  assert.strictEqual(await text(page, '#mbptv-player .mbp-title'), 'Putin: A Russian Spy Story');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-sub-code'), 'S1 · E1');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-sub-text'), 'The Rise of Putin');
  await page.keyboard.press('ArrowDown');
  assert.ok(await page.evaluate(() => !!document.querySelector('#mbptv-player .mbp-btns [data-action="next-episode"]')), 'Next Episode button');
  await setTime(page, 34);
  await waitClass(page, 'is-upnext');
  assert.ok(/^Next episode in [123]$/.test(await text(page, '#mbptv-player .mbp-un-count')));
  assert.strictEqual(await text(page, '#mbptv-player .mbp-un-title'), 'Episode 2', 'no title known for S1E2 in the mock season page');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-un-meta'), 'S1 · E2');
  assert.strictEqual(await page.evaluate(() => document.querySelector('#mbptv-player [data-action="play-next"]').classList.contains('is-focused')), true);
  await page.waitForFunction(() => window.__p.events.some(e => e.type === 'next'), null, { timeout: 8000 });
  const next = (await events(page, 'next'))[0].req;
  assert.strictEqual(next.kind, 'tv');
  assert.strictEqual(next.id, '17417');
  assert.strictEqual(next.season, 1);
  assert.strictEqual(next.episode, 2);
  assert.strictEqual(await page.evaluate(() => window.__p.NativePlayer.active()), true, 'the same player continues');
  await waitPlaying(page, { episode: 2 });
  assert.strictEqual(await text(page, '#mbptv-player .mbp-sub-code'), 'S1 · E2');
  const log = await playerLog(page);
  assert.deepStrictEqual(log.filter(e => e.kind === 'tv_file').map(e => e.body), [
    { tid: '17417', season: '1', episode: '1' }, { tid: '17417', season: '1', episode: '2' }]);
  assert.deepStrictEqual(log.filter(e => e.kind === 'player').map(e => e.query.tfid), ['174170101', '174170102']);
  const posts = await progressLog(page);
  const e1 = posts.filter(p => p.body.episode === '1');
  assert.ok(e1.length, 'progress for E1');
  const lastE1 = e1[e1.length - 1];
  assert.strictEqual(lastE1.path, '/index/index/tv_progress');
  assert.deepStrictEqual(Object.keys(lastE1.body), ['type', 'tid', 'season', 'episode', 'over', 'seconds', 'mp4_id']);
  assert.strictEqual(lastE1.body.type, 'tv');
  assert.strictEqual(lastE1.body.tid, '17417');
  assert.strictEqual(lastE1.body.over, '1', 'E1 is saved as watched');
  assert.strictEqual((await events(page, 'close')).length, 0, 'no onClose between episodes');
  await done(page);
});

t.test('Up Next: Hide dismisses and keeps watching; at the end it returns and Back exits with over=1', async () => {
  const page = await open({ mbp_len: 60 });
  await play(page, EPISODE);
  await waitPlaying(page);
  await setTime(page, 36);
  await waitClass(page, 'is-upnext');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-un-count'), 'Next episode in 10');
  await page.keyboard.press('ArrowRight');
  assert.strictEqual(await page.evaluate(() => document.querySelector('#mbptv-player [data-action="hide-next"]').classList.contains('is-focused')), true);
  await page.keyboard.press('Enter');
  await waitClass(page, 'is-upnext', false);
  await page.waitForTimeout(1500);
  assert.ok((await rootClass(page)).indexOf(' is-upnext ') < 0, 'stays dismissed');
  const i = await info(page);
  assert.strictEqual(i.episode, 1);
  assert.strictEqual(i.state, 'playing');
  assert.strictEqual((await video(page)).paused, false, 'keeps watching the credits');
  await setTime(page, 58);
  await waitClass(page, 'is-upnext', true, 8000);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__p.NativePlayer.active());
  const close = (await events(page, 'close'))[0].info;
  assert.strictEqual(close.reason, 'ended');
  assert.strictEqual(close.over, 1);
  assert.strictEqual((await events(page, 'next')).length, 0);
  const last = (await progressLog(page)).pop();
  assert.strictEqual(last.body.over, '1');
  await done(page);
});

t.test('Up Next: Back dismisses the card without leaving the player', async () => {
  const page = await open({ mbp_len: 60 });
  await play(page, EPISODE);
  await waitPlaying(page);
  await setTime(page, 36);
  await waitClass(page, 'is-upnext');
  await page.keyboard.press('Escape');
  await waitClass(page, 'is-upnext', false);
  assert.strictEqual(await page.evaluate(() => window.__p.NativePlayer.active()), true);
  assert.strictEqual((await events(page, 'close')).length, 0);
  await done(page);
});

t.test('Ch- plays the previous episode and Ch+ the next one', async () => {
  const page = await open({ mbp_len: 60 });
  await play(page, Object.assign({}, EPISODE, { episode: 2, episodeTitle: '' }));
  await waitPlaying(page, { episode: 2 });
  assert.strictEqual(await key(page, 'chdown'), true);
  await waitPlaying(page, { episode: 1 });
  assert.strictEqual(await key(page, 'chup'), true);
  await waitPlaying(page, { episode: 2 });
  assert.deepStrictEqual((await events(page, 'next')).map(e => e.req.episode), [1, 2]);
  await done(page);
});

t.test('Back exits: onClose info, a final progress post with the right over, screen saver restored', async () => {
  const page = await open({ mbp_len: 600 }, { saver: true });
  await play(page, MOVIE);
  await waitPlaying(page);
  await waitTime(page, 3.2);
  await page.keyboard.press('Escape');
  assert.strictEqual(await page.evaluate(() => window.__p.NativePlayer.active()), false);
  assert.strictEqual(await page.evaluate(() => !!document.getElementById('mbptv-player')), false, 'overlay removed');
  const close = await events(page, 'close');
  assert.strictEqual(close.length, 1);
  assert.strictEqual(close[0].info.reason, 'back');
  assert.strictEqual(close[0].info.kind, 'movie');
  assert.strictEqual(close[0].info.over, 0);
  assert.ok(close[0].info.time >= 3, 'time ' + close[0].info.time);
  await waitPosts(page, 1);
  const last = (await progressLog(page)).pop();
  assert.strictEqual(last.body.over, '0');
  assert.ok(+last.body.seconds >= 3);
  assert.deepStrictEqual(await page.evaluate(() => window.__saver), [0, 1], 'SCREEN_SAVER_OFF while playing, ON after exit');
  await done(page);
});

t.test('code -1 from the player endpoint shows its msg; Try website player calls onFallback', async () => {
  const page = await open();
  await play(page, Object.assign({ fileUrl: '/index/index/player?mfid=999' }, MOVIE));
  await page.waitForFunction(() => document.getElementById('mbptv-player').getAttribute('data-state') === 'error');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-err-body'), 'VIP only');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-err-title'), 'This video won’t play here');
  assert.strictEqual(await page.evaluate(() => document.querySelector('#mbptv-player .mbp-err-btns .is-focused').getAttribute('data-action')), 'website');
  await page.keyboard.press('Enter');
  assert.strictEqual(await page.evaluate(() => window.__p.NativePlayer.active()), false);
  const ev = await events(page);
  assert.deepStrictEqual(ev.map(e => e.type), ['open', 'close', 'fallback']);
  assert.strictEqual(ev[1].info.reason, 'fallback');
  assert.strictEqual(ev[2].reason, 'site-error');
  assert.strictEqual(ev[2].req.id, '40102');
  await done(page);
});

t.test('every stream failing shows "This video won’t play here" (streams-failed); Back closes', async () => {
  const page = await open({ mbp_all: 'bad' });
  await play(page, MOVIE);
  await page.waitForFunction(() => document.getElementById('mbptv-player').getAttribute('data-state') === 'error', null, { timeout: 15000 });
  const tried = (await playerLog(page)).filter(e => e.kind === 'media').map(e => e.path);
  assert.strictEqual(tried.length, 5, 'all five candidates tried: ' + tried.join(', '));
  await page.keyboard.press('ArrowRight');
  assert.strictEqual(await page.evaluate(() => document.querySelector('#mbptv-player .mbp-err-btns .is-focused').getAttribute('data-action')), 'back');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  const fb = await events(page, 'fallback');
  assert.strictEqual(fb[0].reason, 'streams-failed');
  const page2 = await open({ mbp_all: 'bad' });
  await play(page2, MOVIE);
  await page2.waitForFunction(() => document.getElementById('mbptv-player').getAttribute('data-state') === 'error', null, { timeout: 15000 });
  await page2.keyboard.press('Escape');
  assert.strictEqual(await page2.evaluate(() => window.__p.NativePlayer.active()), false);
  assert.strictEqual((await events(page2, 'fallback')).length, 0);
  await done(page);
  await done(page2);
});

t.test('a stalled candidate times out and the next one starts at the same (resume) position', async () => {
  const page = await open({ mbp_auto: 'hang', mbp_len: 300, mbp_seconds: 95 }, { config: { candidateTimeout: 1500 } });
  await play(page, MOVIE);
  await waitPlaying(page, { label: 'ORG' });
  near((await video(page)).t, 95, 2.5, 'resume kept across the fallback');
  const entries = await page.evaluate(() => window.__p.Log.entries().map(e => e.msg).join('\n'));
  assert.ok(/stream AUTO failed: timeout/.test(entries), entries);
  await done(page);
});

t.test('signed out: routes to sign-in through onFallback(req, "signed-out")', async () => {
  for (const req of [EPISODE, MOVIE]) {
    const page = await open({ mockgate: '1' });
    await play(page, req);
    await page.waitForFunction(() => window.__p.events.some(e => e.type === 'fallback'), null, { timeout: 10000 });
    const fb = (await events(page, 'fallback'))[0];
    assert.strictEqual(fb.reason, 'signed-out', req.kind);
    assert.strictEqual(await page.evaluate(() => window.__p.NativePlayer.active()), false);
    await done(page);
  }
});

t.test('stop() is idempotent and a stopped session never calls back', async () => {
  const page = await open({ mbp_len: 300 });
  await play(page, MOVIE);
  await waitPlaying(page);
  await waitTime(page, 1.5);
  const r = await page.evaluate(() => [window.__p.NativePlayer.stop('test'), window.__p.NativePlayer.stop('test'), window.__p.NativePlayer.active(), window.__p.NativePlayer.info()]);
  assert.deepStrictEqual(r, [true, false, false, null]);
  await page.waitForTimeout(600);
  assert.strictEqual((await events(page, 'close')).length, 1);
  const posts = (await progressLog(page)).length;
  await page.waitForTimeout(1200);
  assert.strictEqual((await progressLog(page)).length, posts);
  // Back during loading cancels the pending requests; nothing plays later.
  await page.evaluate(() => fetch('/__mock/player-log?reset=1'));
  await page.context_.addCookies([{ name: 'mbp_delay', value: '1500', url: origin }]);
  await play(page, MOVIE);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
  assert.strictEqual(await page.evaluate(() => window.__p.NativePlayer.active()), false);
  assert.strictEqual((await playerLog(page)).filter(e => e.kind === 'media').length, 0, 'no stream loaded after cancel');
  assert.strictEqual((await events(page, 'close')).length, 2);
  await done(page);
});

/* ---------- review fixes: stalls, held keys, autoplay rules, expiring links, background, bad site marks ---------- */

const errorState = page => page.waitForFunction(() => { const r = document.getElementById('mbptv-player'); return r && r.getAttribute('data-state') === 'error'; }, null, { timeout: 20000 });
const errButtons = page => page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#mbptv-player .mbp-err-btns [data-action]'),
  b => b.getAttribute('data-action') + (b.classList.contains('is-focused') ? '*' : '')));
const setHidden = (page, hidden) => page.evaluate(h => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  const e = document.createEvent('Event'); e.initEvent('visibilitychange', false, false); document.dispatchEvent(e);
}, hidden);
const logText = page => page.evaluate(() => window.__p.Log.entries().map(e => e.msg).join('\n'));

t.test('a stream that loads its metadata but never starts is replaced (no endless "Starting playback")', async () => {
  const page = await open({ mbp_len: 120 }, { config: { candidateTimeout: 1500 } });
  // ORG answers (metadata loads) but play() never resolves, as when HLS segments hang or an audio track is unsupported.
  await page.evaluate(() => {
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { return /q=org/.test(this.src) ? new Promise(() => {}) : orig.call(this); };
  });
  await play(page, MOVIE);
  await waitPlaying(page, { label: '1080p' });
  const entries = await logText(page);
  assert.ok(/stream AUTO failed: media-\d/.test(entries), entries);
  assert.ok(/stream ORG failed: no-start/.test(entries), entries);
  await done(page);
});

t.test('loading never hangs: after startBudget the error card offers Try again', async () => {
  const page = await open({ mbp_delay: 20000 }, { config: { startBudget: 1500 } });
  await play(page, MOVIE);
  await errorState(page);
  assert.deepStrictEqual(await errButtons(page), ['retry', 'website*', 'back']);
  assert.ok(/taking too long/.test(await text(page, '#mbptv-player .mbp-err-body')));
  await done(page);
});

t.test('held keys act once: OK toggles pause once, Back on Up Next only hides the card; fast taps without the repeat flag accelerate', async () => {
  const page = await open({ mbp_len: 600 });
  await play(page, MOVIE);
  await waitPlaying(page);
  await page.evaluate(() => { window.__pp = []; const v = document.querySelector('#mbptv-player video');
    v.addEventListener('pause', () => window.__pp.push('pause')); v.addEventListener('play', () => window.__pp.push('play')); });
  for (let i = 0; i < 9; i++) { await page.keyboard.down('Enter'); await page.waitForTimeout(40); }
  await page.keyboard.up('Enter');
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await page.evaluate(() => window.__pp), ['pause'], 'one toggle for a held OK');
  assert.strictEqual((await video(page)).paused, true);
  // Some remotes deliver a held key as plain keydowns: 20 Right presses 70 ms apart still accelerate.
  await page.keyboard.press('Enter');
  const t0 = (await video(page)).t;
  for (let i = 0; i < 20; i++) { await key(page, 'right'); await page.waitForTimeout(70); }
  await page.waitForTimeout(900);
  const jumped = (await video(page)).t - t0;
  assert.ok(jumped > 300, 'fast presses accelerate: jumped ' + jumped);
  await done(page);

  const page2 = await open({ mbp_len: 60 });
  await play(page2, EPISODE);
  await waitPlaying(page2);
  await setTime(page2, 36);
  await waitClass(page2, 'is-upnext');
  for (let i = 0; i < 5; i++) { await page2.keyboard.down('Escape'); await page2.waitForTimeout(40); }
  await page2.keyboard.up('Escape');
  await waitClass(page2, 'is-upnext', false);
  assert.strictEqual(await page2.evaluate(() => window.__p.NativePlayer.active()), true, 'the repeats of Back did not close the player');
  assert.strictEqual((await events(page2, 'close')).length, 0);
  await done(page2);
});

t.test('autoplay off: the Up Next card has no countdown and waits at the end; OK plays the next episode', async () => {
  const page = await open({ mbp_len: 60 });
  await play(page, Object.assign({}, EPISODE, { autoplayNext: false }));
  await waitPlaying(page);
  await setTime(page, 36);
  await waitClass(page, 'is-upnext');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-un-count'), 'Up next');
  await setTime(page, 58.5);
  await page.waitForFunction(() => document.querySelector('#mbptv-player video').ended, null, { timeout: 8000 });
  await page.waitForTimeout(2500);
  assert.strictEqual((await info(page)).episode, 1, 'no autoplay at the end');
  assert.strictEqual((await events(page, 'next')).length, 0);
  assert.ok((await rootClass(page)).indexOf(' is-upnext ') >= 0, 'the card waits');
  await page.keyboard.press('Enter');
  await waitPlaying(page, { episode: 2 });
  assert.strictEqual((await events(page, 'next')).length, 1);
  await done(page);
});

t.test('"Still watching?": after N unattended autoplays the card pauses and waits; a key resets the count', async () => {
  const page = await open({ mbp_len: 30 }, { config: { upNextCount: 1, stillWatchingAfter: 2 } });
  await play(page, EPISODE);
  await page.waitForFunction(() => / is-still /.test(' ' + (document.getElementById('mbptv-player') || {}).className + ' '), null, { timeout: 60000 });
  assert.strictEqual((await info(page)).episode, 3, 'two episodes autoplayed');
  assert.strictEqual(await text(page, '#mbptv-player .mbp-un-count'), 'Still watching?');
  await page.waitForTimeout(400);
  assert.strictEqual((await video(page)).paused, true, 'paused while asking');
  await page.waitForTimeout(2000);
  assert.strictEqual((await info(page)).episode, 3, 'no countdown');
  assert.deepStrictEqual((await events(page, 'next')).map(e => e.req.episode), [2, 3]);
  const over = (await progressLog(page)).filter(p => p.body.over === '1').map(p => p.body.episode);
  assert.ok(over.indexOf('1') >= 0 && over.indexOf('2') >= 0, 'E1 and E2 saved as watched: ' + over);
  await page.keyboard.press('Enter');
  await waitPlaying(page, { episode: 4 });
  await waitClass(page, 'is-upnext', true, 15000);
  assert.ok(/^Next episode in \d$/.test(await text(page, '#mbptv-player .mbp-un-count')), 'counting down again after a key');
  await done(page);
});

t.test('stream links expiring mid-film: fresh player data is fetched and playback continues at the same place', async () => {
  const page = await open({ mbp_len: 1800 }, { ua: DESKTOP_UA, config: { candidateTimeout: 4000, stallTimeout: 4000 } });
  await play(page, MOVIE);
  await waitPlaying(page);
  await page.waitForTimeout(1200);
  await page.evaluate(() => fetch('/__mock/expire-links'));
  await setTime(page, 1500);
  await page.waitForFunction(() => { const c = document.querySelector('#mbptv-player .mbp-chip.is-on'); return c && c.textContent === 'Reconnected'; }, null, { timeout: 20000 });
  await waitPlaying(page);
  near((await video(page)).t, 1500, 4, 'position after the new links');
  assert.strictEqual((await playerLog(page)).filter(e => e.kind === 'player').length, 2, 'one refetch of the player data');
  assert.ok((await progressLog(page)).some(p => p.body.seconds === '1500'), 'the position was saved at the switch');
  assert.ok(/fetching fresh stream links/.test(await logText(page)));
  await done(page);
});

t.test('every stream failing mid-film: progress kept (with the duration), Try again focused and continuing there', async () => {
  const page = await open({ mbp_len: 1800 }, { ua: DESKTOP_UA, config: { candidateTimeout: 4000, stallTimeout: 4000 } });
  await play(page, MOVIE);
  await waitPlaying(page);
  await page.waitForTimeout(1200);
  await page.context_.addCookies([{ name: 'mbp_all', value: 'bad', url: origin }]);
  await page.evaluate(() => fetch('/__mock/expire-links'));
  await setTime(page, 1500);
  await errorState(page);
  assert.deepStrictEqual(await errButtons(page), ['retry*', 'website', 'back']);
  assert.strictEqual((await playerLog(page)).filter(e => e.kind === 'player').length, 2, 'fresh links were tried once');
  const posts = await progressLog(page);
  assert.ok(posts.some(p => p.body.seconds === '1500' && p.body.over === '0'), 'saved at 1500: ' + JSON.stringify(posts.map(p => p.body.seconds)));
  await page.context_.addCookies([{ name: 'mbp_all', value: 'ok', url: origin }]);
  await page.keyboard.press('Enter');
  await waitPlaying(page);
  near((await video(page)).t, 1500, 4, 'Try again continues where it stopped');
  assert.strictEqual((await events(page, 'close')).length, 0);
  await page.keyboard.press('Escape');
  const close = (await events(page, 'close'))[0].info;
  near(close.duration, 1800, 1, 'onClose duration');
  await done(page);
});

t.test('the app going to the background pauses, saves and lets the screen saver run; coming back shows the paused controls', async () => {
  const page = await open({ mbp_len: 600 }, { saver: true });
  await play(page, MOVIE);
  await waitPlaying(page);
  await waitTime(page, 1.5);
  await setHidden(page, true);
  const t0 = (await video(page)).t;
  await page.waitForTimeout(1200);
  const v = await video(page);
  assert.strictEqual(v.paused, true);
  near(v.t, t0, 0.3, 'no playback while hidden');
  assert.deepStrictEqual(await page.evaluate(() => window.__saver), [0, 1]);
  assert.strictEqual((await progressLog(page)).length, 1, 'the place is saved');
  await setHidden(page, false);
  const cls = await rootClass(page);
  assert.ok(cls.indexOf(' is-osd ') >= 0 && cls.indexOf(' is-paused ') >= 0, cls);
  await page.keyboard.press('Enter');
  assert.strictEqual((await video(page)).paused, false, 'OK carries on');
  await done(page);
});

t.test('implausible intro/credits marks from the site are ignored', async () => {
  const page = await open({ mbp_len: 1500, mbp_skips: '-1,200' });
  await play(page, EPISODE);
  await waitPlaying(page);
  await setTime(page, 201);
  await page.waitForTimeout(2000);
  assert.ok((await rootClass(page)).indexOf(' is-upnext ') < 0, 'no Up Next 20 minutes before the end');
  assert.strictEqual((await events(page, 'next')).length, 0);
  assert.ok(!(await progressLog(page)).some(p => p.body.over === '1'), 'not marked watched');
  await done(page);

  const page2 = await open({ mbp_len: 1500, mbp_skips: '1400,-1' }, { config: { osdHide: 800 } });
  await play(page2, EPISODE);
  await waitPlaying(page2);
  await waitClass(page2, 'is-osd', false);
  assert.strictEqual(await page2.evaluate(() => !!document.querySelector('#mbptv-player .mbp-skip.is-on')), false, 'no Skip Intro pill');
  await page2.keyboard.press('Enter');
  assert.strictEqual((await video(page2)).paused, true, 'OK pauses as usual');
  await page2.keyboard.press('ArrowDown');
  assert.strictEqual(await page2.evaluate(() => !!document.querySelector('#mbptv-player [data-action="skip-intro"]')), false);
  await done(page2);
});

t.test('play() while active replaces the session in the same overlay (no onOpen/onClose; the old one is saved)', async () => {
  const page = await open({ mbp_len: 600 });
  await play(page, MOVIE);
  await waitPlaying(page);
  await waitTime(page, 2.2);
  await page.evaluate(() => { window.__root = document.getElementById('mbptv-player'); });
  assert.strictEqual(await play(page, EPISODE), true);
  await waitPlaying(page, { kind: 'tv', episode: 1 });
  assert.strictEqual(await page.evaluate(() => window.__root === document.getElementById('mbptv-player')), true, 'same overlay');
  assert.deepStrictEqual((await events(page)).filter(e => e.type === 'open' || e.type === 'close').map(e => e.type), ['open']);
  const movie = (await progressLog(page)).filter(p => p.kind === 'movie');
  assert.ok(movie.length && +movie[movie.length - 1].body.seconds >= 2, 'the movie position was saved');
  await page.keyboard.press('Escape');
  const close = await events(page, 'close');
  assert.strictEqual(close.length, 1);
  assert.strictEqual(close[0].info.kind, 'tv');
  await done(page);
});

t.test('Next Episode crosses into the next season (S1E10 -> S2E1)', async () => {
  const page = await open({ mbp_len: 60, mbp_eps: 10 });
  await play(page, Object.assign({}, EPISODE, { episode: 10, episodeTitle: '' }));
  await waitPlaying(page, { episode: 10 });
  await page.keyboard.press('ArrowDown');
  assert.strictEqual(await text(page, '#mbptv-player [data-action="next-episode"] .mbp-btn-value'), 'S2 E1');
  assert.strictEqual(await key(page, 'chup'), true);
  await waitPlaying(page, { season: 2, episode: 1 });
  assert.strictEqual(await text(page, '#mbptv-player .mbp-sub-code'), 'S2 · E1');
  const log = await playerLog(page);
  assert.deepStrictEqual(log.filter(e => e.kind === 'tv_file').map(e => e.body.season + 'x' + e.body.episode), ['1x10', '2x1']);
  assert.deepStrictEqual(log.filter(e => e.kind === 'player').map(e => e.query.tfid), ['174170110', '174170201']);
  await done(page);
});

t.test('pointer input stays in the player (never reaches the website underneath)', async () => {
  const page = await open({ mbp_len: 120 });
  await page.evaluate(() => { document.getElementById('mbptv').className = 'is-hidden'; window.__clicks = 0; document.addEventListener('click', () => { window.__clicks++; }); });
  await play(page, MOVIE);
  await waitPlaying(page);
  assert.strictEqual(await page.evaluate(() => !!document.elementFromPoint(960, 540).closest('#mbptv-player')), true, 'the player takes pointer hits');
  await page.mouse.click(960, 540);
  assert.strictEqual(await page.evaluate(() => window.__clicks), 0);
  assert.strictEqual((await video(page)).paused, false);
  await done(page);
});

async function main() {
  const extra = path.join(root, 'tools', 'mock-extra.cjs');
  assert.ok(fs.existsSync(extra), 'tools/mock-extra.cjs is required');
  server = await mockSite.start();
  origin = server.origin;
  code = bundle(origin);
  browser = await launch();
  try { await t.run(); } finally {
    for (const p of pages) { try { await p.context_.close(); } catch (e) {} }
    await browser.close();
    await server.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
