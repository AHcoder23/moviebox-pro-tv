// Captures the TV UI at 1920x1080 under a Tizen user agent, driven only by remote keys, into test/artifacts/screens/.
// Usage: node tools/screenshot.cjs [name-prefix ...]    e.g. node tools/screenshot.cjs 05 06
// A step that fails is captured as NN-name-FAILED.png and the run continues. Nothing here contacts the real website.
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

  async function fresh(urlPath, prefs) {
    if (page) await K.closeApp(page);
    page = await K.openApp(browser, O, { path: null, prefs });
    await page.goto(O + urlPath);
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
    await fresh('/movie/40102', { quality: 'ask' });
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
