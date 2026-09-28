// TV episode UX on the built tv.js and the mock site (docs/ARCHITECTURE.md sections 5.2 and 6.2): the watch-plan list
// merged into the season (specials as name-only cards), watched marks and the season line, season switching when focus
// rests on a pill, Down after a switch, the show's Play/Resume target, sized artwork, and the Settings rows for the
// built-in player, autoplay and performance mode. Standalone: node test/episodes.test.cjs [title filter...]
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./helpers.cjs');
const K = require('./app.test.cjs');

const ARTIFACTS = path.join(H.root, 'test', 'artifacts');
const b64u = s => Buffer.from(s, 'utf8').toString('base64url');
const unb64u = s => Buffer.from(s, 'base64url').toString('utf8');

/* The mock serves the same /tvshow page for every ?season=N (season 2). This rewrites it the way the site serves
   season N: episode cards, codes, stills, the "Season N/5" title, the active pill and the card titles (taken from the
   page's own watch-plan list). The watch-plan list itself is the same on every season's page, as on the site. */
function seasonPage(html, n) {
  if (n === 2) return html;
  const names = {};
  html.replace(new RegExp('<div class="episode" season="' + n + '" episode="(\\d+)"><p class="name">S\\d+E\\d+ - ([^<]*)</p>', 'g'), (m, e, t) => { names[+e] = t; });
  let out = html
    .replace(/tid="(\d+)" season="2" episode=/g, 'tid="$1" season="' + n + '" episode=')
    .replace(/season=2&amp;episode=/g, 'season=' + n + '&amp;episode=')
    .replace(/>S2E(\d+)</g, '>S' + n + 'E$1<')
    .replace('Season 2/5', 'Season ' + n + '/5')
    .replace('<p class="active">2</p>', '<p class="">2</p>')
    .replace(new RegExp('(<a href="/tvshow/\\d+\\?season=' + n + '"><p class=")(">' + n + '</p>)'), '$1active$2')
    .replace(/thumb_([A-Za-z0-9_-]+)\.png/g, (m, b) => {
      const p = unb64u(b);
      return /TEST_ep_\d+_2_\d+/.test(p) ? 'thumb_' + b64u(p.replace(/(TEST_ep_\d+)_2_/, '$1_' + n + '_')) + '.png' : m;
    });
  ['The Cat, the Bat and the Very Ugly', 'Riddled', 'Fire and Ice'].forEach((t, i) => {
    if (names[i + 1]) out = out.split('ellipsis;">' + t + '</p>').join('ellipsis;">' + names[i + 1] + '</p>');
  });
  return out;
}

/* Routes /tvshow/ID?season=N through seasonPage; delays[N] holds that answer back (ms). Records the seasons asked for. */
async function routeSeasons(page, delays) {
  page.seasonsAsked = [];
  await page.route(/\/tvshow\/\d+\?season=\d+$/, async r => {
    const n = +/season=(\d+)$/.exec(r.request().url())[1];
    page.seasonsAsked.push(n);
    const res = await r.fetch();
    const body = seasonPage(await res.text(), n);
    const d = delays && delays[n];
    if (d) await new Promise(ok => setTimeout(ok, d));
    await r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
  });
}

async function openShow(page, key) {
  await K.waitScreen(page, 'home');
  await K.waitFocus(page);
  await K.activate(page, '[data-key="' + (key || 'tv:556') + '"]');
  await K.waitScreen(page, 'detail');
  await K.waitUntil(page, 'the episode cards', () => document.querySelectorAll('#mbptv .mb-screen.is-current [data-episode]').length > 0, null, 10000);
}

/* Everything tests read about the detail screen's episode row. */
function episodeState() {
  const scr = document.querySelector('#mbptv .mb-screen.is-current');
  const cards = Array.prototype.slice.call(scr.querySelectorAll('[data-episode]'));
  const row = scr.querySelector('[data-zone="row:episodes"]');
  const spin = scr.querySelector('.mb-ep-spinner');
  const f = document.querySelector('#mbptv .is-focused');
  return {
    eps: cards.map(c => c.getAttribute('data-episode')),
    watched: cards.filter(c => c.classList.contains('is-watched')).map(c => c.getAttribute('data-episode')),
    text: cards.filter(c => c.classList.contains('mb-episode--text')).map(c => c.getAttribute('data-episode')),
    imgs: cards.map(c => c.querySelectorAll('img').length),
    checksShown: cards.filter(c => { const k = c.querySelector('.mb-ep-check'); return !!k && getComputedStyle(k).display !== 'none'; }).map(c => c.getAttribute('data-episode')),
    line: (scr.querySelector('.mb-season-info') || {}).textContent || '',
    loading: !!row && row.classList.contains('is-loading'),
    spinner: !!spin && getComputedStyle(spin).display !== 'none',
    trackOpacity: row ? +getComputedStyle(row.querySelector('.mb-track')).opacity : -1,
    selected: Array.prototype.map.call(scr.querySelectorAll('[data-season].is-selected'), p => p.getAttribute('data-season')),
    play: (scr.querySelector('[data-action="play"]') || {}).textContent || '',
    focus: f ? { episode: f.getAttribute('data-episode') || '', season: f.getAttribute('data-season') || '', action: f.getAttribute('data-action') || '' } : null
  };
}

const state = page => page.evaluate(episodeState);

async function expect(page, cond, message, got) {
  if (!cond) await K.fail(page, message + (got === undefined ? '' : '; got ' + JSON.stringify(got)));
}

/* Replaces App.play so a Play press is recorded instead of starting playback. */
async function recordPlay(page) {
  await page.evaluate(() => { const A = window.__mbptv.App; window.__played = []; A.play = t => { window.__played.push(JSON.parse(JSON.stringify(t, (k, v) => (k === 'item' ? undefined : v)))); }; });
}

async function main() {
  const filters = process.argv.slice(2).map(s => s.toLowerCase());
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const site = await H.mockSite.start();
  const browser = await H.launch();
  const O = site.origin;
  const { test, run } = H.makeRunner('episodes');

  function flow(title, opts, fn) {
    if (filters.length && !filters.some(f => title.toLowerCase().indexOf(f) >= 0)) return;
    test(title, async () => {
      const page = await K.openApp(browser, O, opts);
      try {
        await fn(page);
        await page.waitForTimeout(100);
        if (page.errors.length) await K.fail(page, 'Uncaught page errors or Log.error output:\n    ' + page.errors.slice(0, 4).join('\n    '));
      } catch (e) {
        const file = await K.snap(page, path.join(ARTIFACTS, 'episodes-FAIL-' + title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 70) + '.png'));
        if (file) e.message += '\n  screenshot: ' + path.relative(H.root, file);
        throw e;
      } finally {
        await K.closeApp(page);
      }
    });
  }

  flow('a season lists every episode (name-only ones as text cards) with watched checks, the season line and Play S2E1', { path: '/' }, async page => {
    await openShow(page);
    const s = await state(page);
    const all = []; for (let e = 1; e <= 13; e++) all.push('2x' + e);
    await expect(page, JSON.stringify(s.eps) === JSON.stringify(all), 'season 2 should list 13 episodes in order (3 cards + 10 from the watch-plan list)', s.eps);
    await expect(page, JSON.stringify(s.watched) === '["2x2","2x3"]' && JSON.stringify(s.checksShown) === '["2x2","2x3"]', 'S2E2 and S2E3 carry the watched check', s);
    await expect(page, s.text.length === 10 && s.text[0] === '2x4', 'episodes without a picture are text cards', s.text);
    await expect(page, s.imgs.slice(3).every(n => n === 0) && s.imgs.slice(0, 3).every(n => n === 1), 'text cards have no <img> (never a broken image); picture cards have one', s.imgs);
    const card4 = await page.evaluate(() => document.querySelector('#mbptv .mb-screen.is-current [data-episode="2x4"]').textContent);
    await expect(page, /S2E4/.test(card4) && /The Laughing Bat/.test(card4), 'a text card shows its code and title', card4);
    await expect(page, /Season 2/.test(s.line) && /13 episodes/.test(s.line) && /2 of 13 watched/.test(s.line), 'the season line names the season, its size and the watched share', s.line);
    await expect(page, s.play.trim() === 'Play S2E1', 'Play targets the first unwatched episode (season 1 is watched; the S1E0 special is skipped)', s.play);
    await K.press(page, 'ArrowDown', 1, 300);
    const p = await K.focusInfo(page);
    await expect(page, p.season === '2', 'Down from the buttons lands on the selected season', p);
    await K.press(page, 'ArrowDown', 1, 300);
    const d = await K.focusInfo(page);
    await expect(page, d.episode === '2x1', 'Down from the pills lands on the first unwatched episode, S2E1', d);
    const header = await page.evaluate(() => document.querySelector('#mbptv .mb-screen.is-current .mb-mini-meta').textContent);
    await expect(page, /S2 · E1/.test(header), 'the header names the focused episode', header);
    await K.press(page, 'ArrowRight', 1, 300);
    const h2 = await page.evaluate(() => document.querySelector('#mbptv .mb-screen.is-current .mb-mini-meta').textContent);
    await expect(page, /Watched/.test(h2), 'a watched episode says so in the header', h2);
    // Play starts the target episode.
    await recordPlay(page);
    await K.activate(page, '[data-action="play"]');
    const played = await page.evaluate(() => window.__played);
    await expect(page, played.length === 1 && played[0].kind === 'tv' && String(played[0].id) === '556' && played[0].season === 2 && played[0].episode === 1, 'Play on the show starts S2E1', played);
  });

  flow('resting on a season pill switches season (spinner, previous episodes dimmed); passing over pills loads nothing; Down lands on the first unwatched', { path: '/' }, async page => {
    await routeSeasons(page, { 3: 1500 });
    await openShow(page);
    await K.press(page, 'ArrowDown', 1, 250);
    await K.press(page, 'ArrowRight', 1, 110);
    await K.press(page, 'ArrowRight', 1, 110);
    await K.press(page, 'ArrowLeft', 1, 0);
    await expect(page, (await K.focusInfo(page)).season === '3', 'focus is on Season 3');
    await page.waitForTimeout(250);
    await expect(page, page.seasonsAsked.length === 0, 'nothing loads before focus has rested on a pill', page.seasonsAsked);
    await page.waitForTimeout(450);
    const l = await state(page);
    await expect(page, JSON.stringify(page.seasonsAsked) === '[3]', 'only Season 3 (where focus rested) loads; Season 4 was passed over', page.seasonsAsked);
    await expect(page, l.loading && l.spinner && l.trackOpacity < 0.6, 'while it loads the row shows a spinner over the dimmed previous episodes', l);
    await expect(page, l.eps[0] === '2x1' && JSON.stringify(l.selected) === '["3"]', 'the previous episodes stay while Season 3 loads, and its pill is selected', l);
    await expect(page, /Season 3/.test(l.line) && /13 episodes/.test(l.line) && /2 of 13 watched/.test(l.line), 'the season line switches at once, from the watch-plan list', l.line);
    // Down while it loads waits for the new episodes, then lands on the first unwatched one (S3E1 and S3E2 are watched).
    await K.press(page, 'ArrowDown', 1, 150);
    await expect(page, (await K.focusInfo(page)).season === '3', 'Down waits on the pill while the season loads');
    const done = await K.waitUntil(page, 'season 3 episodes', () => {
      const scr = document.querySelector('#mbptv .mb-screen.is-current');
      const row = scr.querySelector('[data-zone="row:episodes"]');
      return !row.classList.contains('is-loading') && scr.querySelector('[data-episode="3x1"]') ? true : null;
    }, null, 5000);
    await expect(page, done, 'season 3 loaded');
    await page.waitForTimeout(200);
    const s = await state(page);
    await expect(page, s.eps.length === 13 && s.eps[0] === '3x1' && !s.spinner && s.trackOpacity > 0.9, 'season 3 shows its 13 episodes, undimmed', s);
    await expect(page, JSON.stringify(s.watched) === '["3x1","3x2"]', 'season 3 watched marks', s.watched);
    await expect(page, s.focus && s.focus.episode === '3x3', 'the pending Down landed on the first unwatched episode, S3E3', s.focus);
    // OK on a pill loads at once (no dwell).
    await K.press(page, 'ArrowUp', 1, 250);
    await K.press(page, 'ArrowRight', 1, 0);
    const t0 = Date.now();
    await K.press(page, 'Enter', 1, 0);
    while (page.seasonsAsked.indexOf(4) < 0 && Date.now() - t0 < 1000) await page.waitForTimeout(20);
    await expect(page, page.seasonsAsked.indexOf(4) >= 0 && Date.now() - t0 < 400, 'OK on a season pill loads it immediately', { asked: page.seasonsAsked, ms: Date.now() - t0 });
    await K.waitUntil(page, 'season 4 episodes', () => !!document.querySelector('#mbptv .mb-screen.is-current [data-episode="4x1"]'), null, 5000);
    const s4 = await state(page);
    await expect(page, /Season 4/.test(s4.line) && /13 episodes/.test(s4.line) && !/watched/.test(s4.line), 'no watched share when none are watched', s4.line);
    await K.press(page, 'ArrowDown', 1, 250);
    await expect(page, (await K.focusInfo(page)).episode === '4x1', 'nothing watched: Down lands on episode 1');
  });

  flow('season 1: the S1E00 special comes first as a text card; everything else is watched, so Down lands on episode 1', { path: '/' }, async page => {
    await routeSeasons(page, { 1: 300 });
    await openShow(page);
    await K.press(page, 'ArrowDown', 1, 250);
    await K.press(page, 'ArrowLeft', 1, 0);
    await K.waitUntil(page, 'season 1 episodes', () => !!document.querySelector('#mbptv .mb-screen.is-current [data-episode="1x0"]') &&
      !document.querySelector('#mbptv .mb-screen.is-current [data-zone="row:episodes"]').classList.contains('is-loading'), null, 5000);
    const s = await state(page);
    await expect(page, s.eps.length === 14 && s.eps[0] === '1x0' && s.eps[1] === '1x1' && s.eps[13] === '1x13', 'season 1 lists S1E0 then E1-E13', s.eps);
    await expect(page, s.text[0] === '1x0' && s.imgs[0] === 0, 'the special is a text card without an image', s);
    const special = await page.evaluate(() => document.querySelector('#mbptv .mb-screen.is-current [data-episode="1x0"]').textContent);
    await expect(page, /Building the Batman/.test(special) && /Special/.test(special) && /S1E0/.test(special), 'the special card names itself', special);
    await expect(page, s.watched.length === 13 && s.watched.indexOf('1x0') < 0, 'E1-E13 carry the watched check; the special does not', s.watched);
    await expect(page, /13 of 14 watched/.test(s.line) && /14 episodes/.test(s.line), 'the season line uses the site\'s own count', s.line);
    await K.press(page, 'ArrowDown', 1, 300);
    await expect(page, (await K.focusInfo(page)).episode === '1x1', 'all watched: Down falls back to episode 1 (not the special)');
    await K.press(page, 'ArrowLeft', 1, 300);
    await expect(page, (await K.focusInfo(page)).episode === '1x0', 'Left reaches the special');
  });

  flow('a Continue Watching show: Resume names its episode, that card shows the progress and Down lands on it', { path: null }, async page => {
    // The home page's Continue Watching card for tv:705 points at S2E1 (the mock serves the same show page for any id).
    await page.route(u => new URL(u).pathname === '/', async r => {
      const res = await r.fetch();
      const body = (await res.text()).replace(/S37E21/g, 'S2E1').replace(/season=37/g, 'season=2');
      await r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    });
    await page.goto(O + '/');
    await openShow(page, 'tv:705');
    const s = await state(page);
    await expect(page, s.play.trim() === 'Resume S2E1', 'Play says Resume and names the episode', s.play);
    const bar = await page.evaluate(() => {
      const c = document.querySelector('#mbptv .mb-screen.is-current [data-episode="2x1"] .mb-ep-progress .mb-progress-fill');
      return c ? c.style.width : '';
    });
    await expect(page, /^[\d.]+%$/.test(bar) && parseFloat(bar) > 0 && parseFloat(bar) < 100, 'the resumed episode shows its progress bar', bar);
    await K.press(page, 'ArrowDown', 2, 300);
    await expect(page, (await K.focusInfo(page)).episode === '2x1', 'Down lands on the episode to resume');
    await recordPlay(page);
    await K.activate(page, '[data-action="play"]');
    const played = await page.evaluate(() => window.__played);
    await expect(page, played.length === 1 && played[0].season === 2 && played[0].episode === 1 && String(played[0].id) === '705', 'Resume starts that episode', played);
  });

  // ---- After the built-in player (docs/PLAYER.md "Integration"): the screen follows what was watched ------------
  const cookies = (page, map) => page.context_.addCookies(Object.keys(map).map(name => ({ name, value: String(map[name]), url: O + '/' })));
  const nativeInfo = page => page.evaluate(() => { const np = window.__mbptv.App.nativePlayer(); return np ? np.info() : null; });
  const nativePlaying = () => {
    const p = document.getElementById('mbptv-player'), v = p && p.querySelector('video');
    return !!p && p.getAttribute('data-state') === 'playing' && !!v && v.currentTime > 0.3 && !v.paused;
  };

  flow('the S1E00 special plays as itself in the built-in player (tv_file asks for episode 0); Back lands on its card', { path: '/' }, async page => {
    await cookies(page, { mbp_len: 60 });
    await page.evaluate(() => fetch('/__mock/player-log?reset=1'));
    await routeSeasons(page, { 1: 200 });
    await openShow(page);
    await K.press(page, 'ArrowDown', 1, 250);
    await K.press(page, 'ArrowLeft', 1, 0);
    await K.waitUntil(page, 'season 1 episodes', () => !!document.querySelector('#mbptv .mb-screen.is-current [data-episode="1x0"]') &&
      !document.querySelector('#mbptv .mb-screen.is-current [data-zone="row:episodes"]').classList.contains('is-loading'), null, 5000);
    await K.activate(page, '[data-episode="1x0"]');
    await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000);
    const i = await nativeInfo(page);
    await expect(page, i && i.season === 1 && i.episode === 0 && i.id === '556', 'the special plays S1E0, not another episode', i);
    const log = await page.evaluate(() => fetch('/__mock/player-log').then(r => r.json()));
    const tf = log.filter(e => e.kind === 'tv_file').pop();
    await expect(page, tf && tf.body.season === '1' && tf.body.episode === '0', 'tv_file is asked for season 1 episode 0', tf);
    const line = await page.evaluate(() => document.querySelector('#mbptv-player').textContent);
    await expect(page, /Building the Batman/.test(line), 'the player names the special (its title comes from the card)', line.slice(0, 200));
    await K.back(page);
    await K.waitScreen(page, 'detail', 5000);
    const f = await K.waitFocus(page);
    await expect(page, f.episode === '1x0', 'Back lands on the special\'s card', f);
  });

  flow('after watching, the screen shows it at once: Up Next finished S2E1 (checked), S2E2 stopped past 10 s reads Resume S2E2 with its bar, and the page refresh keeps it', { path: null }, async page => {
    // tv:705's Continue Watching card points at S2E1 (the mock serves the same show page for any id).
    await page.route(u => new URL(u).pathname === '/', async r => {
      const res = await r.fetch();
      const body = (await res.text()).replace(/S37E21/g, 'S2E1').replace(/season=37/g, 'season=2');
      await r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    });
    await cookies(page, { mbp_len: 400 }); // long enough that stopping early is not "over" (the site: less than 5 min left)
    await page.goto(O + '/');
    await openShow(page, 'tv:705');
    await expect(page, (await state(page)).play.trim() === 'Resume S2E1', 'before: Resume S2E1 from the Continue Watching card');
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000);
    await page.evaluate(() => window.__mbptv.App.nativePlayer().configure({ upNextCount: 2 }));
    await page.evaluate(() => { const v = document.querySelector('#mbptv-player video'); v.currentTime = Math.max(0, v.duration - 18); });
    await K.waitUntil(page, 'S2E2 playing', () => { const x = window.__mbptv.App.nativePlayer().info(); return !!x && x.episode === 2 && x.state === 'playing'; }, null, 15000);
    await K.waitUntil(page, 'S2E2 advancing', nativePlaying, null, 10000);
    await K.press(page, 'ArrowRight', 1, 1500); // +10 s: past the resume threshold
    await K.back(page);
    await K.waitScreen(page, 'detail', 5000);
    const f = await K.waitFocus(page);
    await expect(page, f.episode === '2x2', 'Back lands on the episode that played last', f);
    const now = await state(page);
    const bars = () => page.evaluate(() => ['2x1', '2x2'].map(k => !!document.querySelector('#mbptv .mb-screen.is-current [data-episode="' + k + '"] .mb-ep-progress')));
    const b0 = await bars();
    await expect(page, now.play.trim() === 'Resume S2E2', 'at once: Resume S2E2 (the Continue Watching card no longer applies)', now.play);
    await expect(page, now.watched.indexOf('2x1') >= 0 && JSON.stringify(b0) === '[false,true]', 'at once: S2E1 is checked, S2E2 shows its progress bar (S2E1\'s old bar is gone)', { watched: now.watched, bars: b0 });
    await expect(page, /3 of 13 watched/.test(now.line), 'the season line counts the finished episode', now.line);
    await page.waitForTimeout(2600); // the title page is read again 1.5 s after the player closed (the mock's page is unchanged)
    const later = await state(page);
    await expect(page, later.play.trim() === 'Resume S2E2' && later.watched.indexOf('2x1') >= 0 && later.focus && later.focus.episode === '2x2',
      'after the page refresh the screen keeps what was watched, and focus stays', later);
  });

  async function artRequests(page) {
    const thumbs = [], tmdb = [];
    for (const u of page.requests) {
      const p = new URL(u).pathname;
      const m = /^\/__img\/thumb\/thumb_([A-Za-z0-9_-]+)\.png$/.exec(p);
      if (m) { const dec = unb64u(m[1]); if (/\|\d+\|\d+$/.test(dec) && /^[\x20-\x7e]+$/.test(dec)) thumbs.push(dec); }
      if (/^\/__img\/tmdb\//.test(p)) tmdb.push(p);
    }
    return { thumbs, tmdb };
  }

  for (const [perf, still, backdrop] of [['off', 640, 'w1280'], ['on', 480, 'w780']]) {
    flow('artwork is asked for at its display size (performance mode ' + perf + '): stills ' + still + ' wide, backdrop ' + backdrop, { path: '/', prefs: { performance: perf } }, async page => {
      await openShow(page);
      await K.press(page, 'ArrowDown', 2, 300);
      await K.press(page, 'ArrowRight', 2, 200);
      await page.waitForTimeout(900);
      const r = await artRequests(page);
      const stills = r.thumbs.filter(t => /TEST_ep_/.test(t));
      await expect(page, stills.length >= 3, 'the three episode stills load', r);
      await expect(page, stills.every(t => new RegExp('\\|' + still + '\\|80$').test(t)), 'every still is asked for at ' + still + ' px, quality 80 (never the site\'s 300 px original)', stills);
      await expect(page, r.tmdb.some(p => p.indexOf('/t/p/' + backdrop + '/TEST_backdrop_556') >= 0) && !r.tmdb.some(p => /\/t\/p\/original\//.test(p)), 'the backdrop is ' + backdrop + ', never the original', r.tmdb);
      const imgs = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#mbptv .mb-screen.is-current [data-episode] img.mb-card-img'), i => i.getAttribute('src') || ''));
      await expect(page, imgs.length === 3 && imgs.every(s => /\/__img\/thumb\/thumb_/.test(s)), 'the still <img> elements carry the sized URLs', imgs);
    });
  }

  flow('Settings: Built-in player, Autoplay next episode and Performance mode rows; the list scrolls to its last row', { path: '/' }, async page => {
    await K.waitScreen(page, 'home');
    await K.waitFocus(page);
    await K.activate(page, '[data-action="nav-settings"]');
    await K.waitScreen(page, 'settings');
    const rows = await page.evaluate(() => ['nativePlayer', 'autoplayEpisodes', 'performance'].map(k => {
      const r = document.querySelector('#mbptv [data-action="setting-' + k + '"]');
      return r ? { k, text: r.textContent, on: !!r.querySelector('.mb-toggle.is-on'), toggle: !!r.querySelector('.mb-toggle'), value: (r.querySelector('.mb-lrow-value') || {}).textContent || '' } : null;
    }));
    await expect(page, rows.every(Boolean), 'the three rows exist with data-action="setting-<key>"', rows);
    await expect(page, rows[0].toggle && rows[0].on && /Built-in player/.test(rows[0].text), 'Built-in player is a toggle, on by default', rows[0]);
    await expect(page, rows[1].toggle && rows[1].on && /Autoplay next episode/.test(rows[1].text), 'Autoplay next episode is a toggle, on by default', rows[1]);
    await expect(page, !rows[2].toggle && /^Auto/.test(rows[2].value) && /performance mode/i.test(rows[2].text), 'Performance mode shows its value (Auto by default)', rows[2]);
    await K.activate(page, '[data-action="setting-nativePlayer"]');
    const np = await page.evaluate(() => ({ pref: window.__mbptv.App && JSON.parse(localStorage.getItem('mbptv:prefs:v1') || '{}').nativePlayer, on: !!document.querySelector('#mbptv [data-action="setting-nativePlayer"] .mb-toggle.is-on') }));
    await expect(page, np.pref === false && !np.on, 'OK turns the built-in player off', np);
    const aside = await page.evaluate(() => document.querySelector('#mbptv .mb-aside').textContent);
    await expect(page, /recommended/i.test(aside), 'the help text recommends the built-in player', aside);
    await K.activate(page, '[data-action="setting-nativePlayer"]');
    const seen = [];
    for (let i = 0; i < 3; i++) {
      await K.activate(page, '[data-action="setting-performance"]');
      seen.push(await page.evaluate(() => ({ v: document.querySelector('#mbptv [data-action="setting-performance"] .mb-lrow-value').textContent, p: JSON.parse(localStorage.getItem('mbptv:prefs:v1') || '{}').performance })));
    }
    await expect(page, JSON.stringify(seen.map(x => x.p)) === '["on","off","auto"]' && seen[0].v === 'On' && seen[1].v === 'Off' && /^Auto/.test(seen[2].v), 'OK steps Performance mode through On, Off and Auto', seen);
    await K.navigateTo(page, '[data-action="setting-about"]');
    await page.waitForTimeout(400);
    const vis = await page.evaluate(() => {
      const r = document.querySelector('#mbptv [data-action="setting-about"]').getBoundingClientRect();
      const about = document.querySelector('#mbptv .mb-about').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, h: innerHeight, aboutTop: about.top };
    });
    await expect(page, vis.top >= 0 && vis.bottom <= vis.h && vis.bottom <= vis.aboutTop + 2, 'the last row scrolls fully into view, above the About line', vis);
  });

  await run();
  await browser.close();
  await site.close();
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
