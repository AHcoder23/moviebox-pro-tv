// Captures the TV UI at 1920x1080 under a Tizen user agent, driven only by remote keys, into test/artifacts/screens/.
// Usage: node tools/screenshot.cjs [name-prefix ...]    e.g. node tools/screenshot.cjs 05 06
// A step that fails is captured as NN-name-FAILED.png and the run continues. Nothing here contacts the real website.
// The Tizen user agent turns TV performance mode on (Prefs performance 'auto'); steps named *-perf-off turn it off.
// Steps 09, 10, 20 and 21 show the website's own player (Settings > Built-in player off); 22-29 the built-in player.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const OUT = path.join(root, 'test', 'artifacts', 'screens');
const H = require('../test/helpers.cjs');
const K = require('../test/app.test.cjs');

const only = process.argv.slice(2);
// Page-side predicates: page.evaluate serializes the function text, so values must travel as the argument, not a closure.
const cardsIn = scope => document.querySelectorAll('#mbptv ' + scope + ' [data-key]').length > 0;
const screenIs = name => { const r = document.getElementById('mbptv'); return !!r && r.getAttribute('data-screen') === name; };

(async () => {
  const build = spawnSync(process.execPath, [path.join(__dirname, 'build.cjs')], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) { console.error('Build failed:\n' + build.stdout + build.stderr); process.exit(1); }
  console.log(build.stdout.trim());
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/\.png$/.test(f) && (!only.length || only.some(o => f.indexOf(o) === 0))) fs.unlinkSync(path.join(OUT, f));

  const site = await H.mockSite.start();
  const browser = await H.launch();
  const O = site.origin;
  let page = null;

  async function fresh(urlPath, prefs, cookies) {
    if (page) await K.closeApp(page);
    page = await K.openApp(browser, O, { path: null, prefs });
    if (cookies) await page.context_.addCookies(Object.keys(cookies).map(name => ({ name, value: String(cookies[name]), url: O + '/' })));
    await page.goto(O + urlPath);
  }
  // The built-in player (docs/PLAYER.md): its overlay is up and its video advancing.
  const nativePlaying = () => {
    const p = document.getElementById('mbptv-player'), v = p && p.querySelector('video');
    return !!p && p.getAttribute('data-state') === 'playing' && !!v && v.currentTime > 0.3 && !v.paused;
  };
  async function nativeMovie(cookies) {
    await fresh('/movie/40102', null, Object.assign({ mbp_len: 300 }, cookies || {}));
    await K.waitScreen(page, 'detail', 12000);
    await K.waitFocus(page);
    await K.activate(page, '[data-action="play"]');
  }
  async function nativeEpisode(cookies) {
    await fresh('/', null, Object.assign({ mbp_len: 40 }, cookies || {}));
    await K.waitScreen(page, 'home');
    await K.waitFocus(page);
    await K.activate(page, '[data-key="tv:556"]');
    await K.waitScreen(page, 'detail');
    await K.waitUntil(page, 'episode 2x1', () => !!document.querySelector('#mbptv [data-episode="2x1"]'), null, 10000);
    await K.activate(page, '[data-episode="2x1"]');
    await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000);
  }
  const settle = ms => page.waitForTimeout(ms);
  async function onScreen(name) {
    try { return await page.evaluate(n => { const r = document.getElementById('mbptv'); return !!r && r.getAttribute('data-screen') === n; }, name); } catch (e) { return false; }
  }
  async function ensureHome() {
    if (!page || !(await onScreen('home'))) await fresh('/');
    await K.waitScreen(page, 'home');
    await K.waitFocus(page);
  }
  async function ensureSearch() {
    if (!page || !(await onScreen('search'))) {
      await ensureHome();
      await K.activate(page, '[data-action="nav-search"]');
      await K.waitScreen(page, 'search');
    }
    await K.waitFocus(page);
  }
  async function focusRowCard() {
    let f = await K.focusInfo(page);
    for (let i = 0; i < 8 && !(f && f.key); i++) { await K.press(page, 'ArrowDown'); f = await K.focusInfo(page); }
    if (!f || !f.key) throw new Error('ArrowDown never focused a [data-key] card');
  }
  async function openSources() {
    await fresh('/movie/40102', { quality: 'ask', nativePlayer: false });
    await K.waitScreen(page, 'detail', 12000);
    await K.waitFocus(page);
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, '[data-sheet="sources"] rows', () => document.querySelectorAll('#mbptv [data-sheet="sources"] [data-source-index]').length > 0, null, 15000);
  }

  const steps = [
    ['01-home', async () => { await fresh('/'); await K.waitScreen(page, 'home'); await K.waitFocus(page); await settle(1200); }],
    ['02-home-row-focus', async () => { await ensureHome(); await focusRowCard(); await K.press(page, 'ArrowRight', 2, 150); await settle(900); }],
    ['03-rail-expanded', async () => {
      await ensureHome();
      let f = null;
      for (let i = 0; i < 24; i++) { await K.press(page, 'ArrowLeft'); f = await K.focusInfo(page); if (f && /^nav-/.test(f.action)) break; }
      if (!f || !/^nav-/.test(f.action)) throw new Error('ArrowLeft never reached the rail');
      await settle(600);
    }],
    ['04-search-empty', async () => { await ensureHome(); await K.activate(page, '[data-action="nav-search"]'); await K.waitScreen(page, 'search'); await K.waitFocus(page); await settle(1500); }],
    ['05-search-typing', async () => {
      await ensureSearch();
      const q = await K.typeOnScreen(page, 'bat');
      if (!q || q.indexOf('bat') < 0) throw new Error('#mbptv-query reads ' + JSON.stringify(q));
      await K.waitUntil(page, '[data-suggestion] rows', () => document.querySelectorAll('#mbptv [data-suggestion]').length > 0, null, 4000);
      await settle(500);
    }],
    ['06-search-results', async () => {
      await ensureSearch();
      if (((await K.queryText(page)) || '').indexOf('bat') < 0) await page.keyboard.type('bat', { delay: 50 });
      await K.activate(page, '[data-action="search-submit"]');
      await K.waitUntil(page, 'result cards', cardsIn, '[data-zone="grid"]', 8000);
      await settle(1200);
    }],
    ['07-detail-movie', async () => { await ensureHome(); await K.activate(page, '[data-key="movie:40102"]'); await K.waitScreen(page, 'detail'); await K.waitFocus(page); await settle(1500); }],
    ['08-detail-tv', async () => {
      await fresh('/');
      await K.waitScreen(page, 'home');
      await K.waitFocus(page);
      await K.activate(page, '[data-key="tv:556"]');
      await K.waitScreen(page, 'detail');
      await K.navigateTo(page, '[data-episode]');
      await settle(1200);
    }],
    ['09-sources', async () => { await openSources(); await settle(700); }],
    ['10-player-osd', async () => {
      const sheetOpen = page && await page.evaluate(() => document.querySelectorAll('#mbptv [data-sheet="sources"] [data-source-index]').length > 0).catch(() => false);
      if (!sheetOpen) await openSources();
      await K.press(page, 'Enter', 1, 300);
      await K.waitUntil(page, 'data-screen="player"', screenIs, 'player', 10000);
      await settle(800);
      await K.press(page, 'ArrowRight', 1, 150);
      await K.waitUntil(page, '#mbptv-osd.is-visible', () => { const o = document.getElementById('mbptv-osd'); return !!o && o.classList.contains('is-visible'); }, null, 2500);
      await settle(300);
    }],
    ['11-browse-grid', async () => {
      await fresh('/');
      await K.waitScreen(page, 'home');
      await K.waitFocus(page);
      await K.activate(page, '[data-action="nav-movies"]');
      await K.waitScreen(page, 'browse');
      await K.waitUntil(page, 'grid cards', cardsIn, '[data-zone="grid"]', 8000);
      await settle(1200);
    }],
    ['12-settings', async () => { await ensureHome(); await K.activate(page, '[data-action="nav-settings"]'); await K.waitScreen(page, 'settings'); await K.waitFocus(page); await settle(700); }],
    ['13-exit-dialog', async () => {
      await fresh('/');
      await K.waitScreen(page, 'home');
      await K.waitFocus(page);
      await settle(600);
      await K.back(page);
      await K.waitUntil(page, '[data-dialog="exit"]', () => !!document.querySelector('#mbptv [data-dialog="exit"]'), null, 3000);
      await settle(500);
    }],
    ['14-signin', async () => {
      await fresh('/__mock/signout');
      try { await K.waitScreen(page, 'signin'); await K.waitFocus(page); await settle(900); } finally { await page.context().clearCookies(); }
    }],
    ['15-diagnostics', async () => {
      await fresh('/');
      await K.waitScreen(page, 'home');
      await K.waitFocus(page);
      await K.activate(page, '[data-action="nav-settings"]');
      await K.waitScreen(page, 'settings');
      const found = await page.evaluate(() => {
        const list = Array.prototype.slice.call(document.querySelectorAll('#mbptv [data-f], #mbptv [data-action]'));
        const hit = list.filter(el => el.getAttribute('data-action') === 'diagnostics')[0] || list.filter(el => /diagnostics/i.test(el.textContent || ''))[0];
        if (hit) hit.setAttribute('data-e2e-target', '');
        return !!hit;
      });
      if (!found) throw new Error('no Diagnostics control on the settings screen');
      await K.activate(page, '[data-e2e-target]');
      await K.waitScreen(page, 'diagnostics');
      await settle(700);
    }],
    ['16-home-featured', async () => {
      await fresh('/');
      await K.waitScreen(page, 'home');
      await K.waitFocus(page);
      await K.navigateTo(page, '#mbptv [data-zone="row:featured"] [data-key]');
      await K.waitUntil(page, 'the banner title', () => { const t = document.querySelector('#mbptv .mb-hero-info .mb-display'); return !!t && !!t.textContent; }, null, 8000);
      await settle(1200);
    }],
    ['17-detail-movie-rows', async () => {
      await fresh('/');
      await K.waitScreen(page, 'home');
      await K.waitFocus(page);
      await K.activate(page, '[data-key="movie:40102"]');
      await K.waitScreen(page, 'detail');
      await K.navigateTo(page, '#mbptv .mb-screen.is-current [data-zone="row:related"] [data-key]');
      await settle(1200);
    }],
    ['18-search-suggestion-focus', async () => {
      await ensureSearch();
      if (((await K.queryText(page)) || '') !== 'bat') { await K.activate(page, '[data-action="clear"]'); await page.keyboard.type('bat', { delay: 50 }); }
      await K.waitUntil(page, '[data-suggestion] rows', () => document.querySelectorAll('#mbptv [data-suggestion]').length > 0, null, 4000);
      await K.navigateTo(page, { selector: '[data-suggestion]', index: 1 });
      await settle(500);
    }],
    ['19-website-mode', async () => {
      await fresh('/');
      await K.waitScreen(page, 'home');
      await K.waitFocus(page);
      await K.activate(page, '[data-action="nav-settings"]');
      await K.waitScreen(page, 'settings');
      await K.activate(page, '[data-action="setting-website"]');
      await K.waitScreen(page, 'native');
      await settle(700);
    }],
    ['20-starting-auto', async () => {
      await fresh('/movie/40102?play=1', { nativePlayer: false });
      await K.waitUntil(page, 'the starting overlay naming the file', () => { const r = document.getElementById('mbptv'); return !!r && r.getAttribute('data-overlay') === 'starting' && /Press Up/.test(r.textContent); }, null, 8000);
      await settle(150);
    }],
    ['21-player-paused', async () => {
      await fresh('/tvshow/556?season=2&episode=1&play=1', { nativePlayer: false });
      await K.waitUntil(page, 'data-screen="player"', screenIs, 'player', 15000);
      await settle(800);
      await K.press(page, 'Enter', 1, 300);
      await settle(4000);
    }],
    ['22-native-loading', async () => {
      await nativeMovie({ mbp_delay: 2500 });
      await K.waitUntil(page, '#mbptv-player[data-state="loading"]', () => { const p = document.getElementById('mbptv-player'); return !!p && p.getAttribute('data-state') === 'loading'; }, null, 4000);
      await settle(700);
    }],
    ['23-native-osd', async () => {
      await nativeMovie();
      await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000);
      await settle(600);
      await K.press(page, 'ArrowUp', 1, 600);
    }],
    ['24-native-seek', async () => {
      if (!page || !(await page.evaluate(nativePlaying).catch(() => false))) { await nativeMovie(); await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000); }
      await K.press(page, 'ArrowRight', 3, 60);
      await settle(120);
    }],
    ['25-native-paused-buttons', async () => {
      if (!page || !(await page.evaluate(() => !!document.getElementById('mbptv-player')).catch(() => false))) { await nativeMovie(); await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000); }
      await settle(1200);
      await K.press(page, 'Enter', 1, 400);
      await K.press(page, 'ArrowDown', 1, 500);
    }],
    ['26-native-quality-sheet', async () => {
      await nativeMovie();
      await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000);
      await K.press(page, 'ArrowDown', 1, 400);
      for (let i = 0; i < 6 && !(await page.evaluate(() => { const f = document.querySelector('#mbptv-player .is-focused'); return !!f && f.getAttribute('data-action') === 'quality'; })); i++) await K.press(page, 'ArrowRight', 1, 200);
      await K.press(page, 'Enter', 1, 600);
      await K.waitUntil(page, 'the quality sheet', () => !!document.querySelector('#mbptv-player [data-sheet="player-quality"]'), null, 3000);
      await settle(400);
    }],
    ['27-native-upnext', async () => {
      await nativeEpisode();
      await page.evaluate(() => window.__mbptv.App.nativePlayer().configure({ upNextCount: 8 }));
      await K.press(page, 'ArrowRight', 2, 120);
      await K.waitUntil(page, 'the Up Next card', () => { const p = document.getElementById('mbptv-player'); return !!p && p.classList.contains('is-upnext'); }, null, 8000);
      await settle(1200);
    }],
    ['28-detail-after-watching', async () => {
      if (!page || !(await page.evaluate(() => !!document.querySelector('#mbptv-player.is-upnext')).catch(() => false))) {
        await nativeEpisode();
        await page.evaluate(() => window.__mbptv.App.nativePlayer().configure({ upNextCount: 2 }));
        await K.press(page, 'ArrowRight', 2, 120);
        await K.waitUntil(page, 'the Up Next card', () => { const p = document.getElementById('mbptv-player'); return !!p && p.classList.contains('is-upnext'); }, null, 8000);
      }
      await K.press(page, 'Enter', 1, 200); // Play now
      await K.waitUntil(page, 'S2E2 playing', () => { const i = window.__mbptv.App.nativePlayer().info(); return !!i && i.episode === 2 && i.state === 'playing' && i.time > 12; }, null, 25000);
      await K.back(page);
      await K.waitScreen(page, 'detail', 5000);
      await K.waitFocus(page);
      await settle(2500);
    }],
    ['29-native-error', async () => {
      await nativeMovie({ mbp_all: 'bad' });
      await K.waitUntil(page, 'the error card', () => !!document.querySelector('#mbptv-player [data-dialog="player-error"]') && document.getElementById('mbptv-player').getAttribute('data-state') === 'error', null, 30000);
      await settle(500);
    }],
    ['30-detail-season-loading', async () => {
      await fresh('/');
      await page.route(/\/tvshow\/\d+\?season=3$/, async r => { await new Promise(ok => setTimeout(ok, 3000)); try { await r.continue(); } catch (e) { /* page closed */ } });
      await K.waitScreen(page, 'home');
      await K.waitFocus(page);
      await K.activate(page, '[data-key="tv:556"]');
      await K.waitScreen(page, 'detail');
      await K.waitUntil(page, 'episodes', () => !!document.querySelector('#mbptv [data-episode="2x1"]'), null, 10000);
      await K.navigateTo(page, '[data-season="3"]');
      await K.waitUntil(page, 'the season loading', () => { const r = document.querySelector('#mbptv [data-zone="row:episodes"]'); return !!r && r.classList.contains('is-loading'); }, null, 3000);
      await settle(300);
    }],
    ['31-home-perf-off', async () => { await fresh('/', { performance: 'off' }); await K.waitScreen(page, 'home'); await K.waitFocus(page); await focusRowCard(); await settle(1400); }],
    ['32-detail-tv-perf-off', async () => {
      await fresh('/', { performance: 'off' });
      await K.waitScreen(page, 'home');
      await K.waitFocus(page);
      await K.activate(page, '[data-key="tv:556"]');
      await K.waitScreen(page, 'detail');
      await K.navigateTo(page, '[data-episode="2x2"]');
      await settle(1200);
    }]
  ];

  const results = [];
  for (const [name, run] of steps) {
    if (only.length && !only.some(o => name.indexOf(o) === 0)) continue;
    let error = null;
    try { await run(); } catch (e) { error = String(e && e.message || e).split('\n')[0]; }
    const file = path.join(OUT, name + (error ? '-FAILED' : '') + '.png');
    try {
      if (!page) throw new Error('no page');
      await page.screenshot({ path: file });
    } catch (e) {
      error = (error ? error + '; ' : '') + 'screenshot failed: ' + String(e.message || e).split('\n')[0];
    }
    results.push({ name, file, error });
    console.log((error ? 'FAILED ' : 'ok     ') + path.relative(root, file) + (error ? '\n       ' + error : ''));
  }

  if (page) await K.closeApp(page);
  await browser.close();
  await site.close();
  const failed = results.filter(r => r.error).length;
  console.log(`\n${results.length - failed}/${results.length} states captured cleanly in ${path.relative(root, OUT)}${path.sep}`);
  for (const r of results) if (fs.existsSync(r.file)) console.log('  ' + path.relative(root, r.file));
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
