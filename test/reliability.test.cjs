// Reliability flows: navigation across real page loads (Session, website mode), playback edge cases, focus theft,
// old-browser keys and full storage. Same kit and rules as app.test.cjs: the built tv.js on the mock site, remote keys.
// Standalone: node test/reliability.test.cjs [title filter...]
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./helpers.cjs');
const K = require('./app.test.cjs');

const ARTIFACTS = path.join(H.root, 'test', 'artifacts');

async function main() {
  const filters = process.argv.slice(2).map(s => s.toLowerCase());
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  for (const f of fs.readdirSync(ARTIFACTS)) if (/^rel-FAIL-.*\.png$/.test(f)) fs.unlinkSync(path.join(ARTIFACTS, f));
  const site = await H.mockSite.start();
  const browser = await H.launch();
  const O = site.origin;
  const { test, run } = H.makeRunner('reliability');

  function flow(title, opts, fn) {
    if (filters.length && !filters.some(f => title.toLowerCase().indexOf(f) >= 0)) return;
    test(title, async () => {
      const page = await K.openApp(browser, O, Object.assign({ path: null }, opts));
      try {
        await fn(page);
        await page.waitForTimeout(100);
        const errs = (page.errors || []).filter(e => !(page.allowErrors && page.allowErrors.test(e)));
        if (errs.length) await K.fail(page, 'Uncaught page errors or Log.error output during the flow:\n    ' + errs.slice(0, 4).join('\n    '));
      } catch (e) {
        const file = await K.snap(page, path.join(ARTIFACTS, 'rel-FAIL-' + title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 70) + '.png'));
        if (file) e.message += '\n  screenshot: ' + path.relative(H.root, file);
        throw e;
      } finally {
        await K.closeApp(page);
      }
    });
  }

  const state = page => page.evaluate(() => window.__mbptv.App.state());
  const modeIs = m => { try { return window.__mbptv.App.state().mode === m; } catch (e) { return false; } };
  const pathIs = p => u => new URL(u).pathname === p;
  async function blue(page) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 406, nativeVirtualKeyCode: 406, key: 'ColorF3Blue', code: '' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 406, nativeVirtualKeyCode: 406, key: 'ColorF3Blue', code: '' });
  }
  async function home(page) {
    await page.goto(O + '/');
    await K.waitScreen(page, 'home');
    await K.waitFocus(page);
  }

  flow('episode play navigates to ?play=1; Back returns to the previous page with the stack and focus restored', {}, async page => {
    await home(page);
    await K.activate(page, '[data-key="tv:556"]');
    await K.waitScreen(page, 'detail');
    await K.activate(page, '[data-episode="2x2"]');
    await K.waitUntil(page, 'player mode', modeIs, 'player', 15000);
    if (!/[?&]play=1/.test(page.url())) await K.fail(page, 'expected the ?play=1 page, at ' + page.url());
    await K.back(page);
    await page.waitForURL(pathIs('/'), { timeout: 8000 });
    await K.waitScreen(page, 'detail', 10000);
    const f = await K.waitFocus(page);
    const st = await state(page);
    if (st.stack.join(',') !== 'home,detail') await K.fail(page, 'expected the stack home,detail restored, got ' + st.stack.join(','));
    if (f.episode !== '2x2') await K.fail(page, 'expected focus back on episode 2x2, got ' + JSON.stringify(f));
    await K.back(page);
    const h = await K.waitFocus(page);
    if (h.key !== 'tv:556') await K.fail(page, 'Back should reach home with tv:556 focused, got ' + JSON.stringify(h.key));
  });

  flow('a ?play=1 page drops play=1 once playback ends; returning to it never starts playback again', {}, async page => {
    await page.goto(O + '/movie/40102?play=1');
    await K.waitUntil(page, 'player mode', modeIs, 'player', 10000);
    await K.back(page);
    await K.waitScreen(page, 'detail', 8000);
    await K.waitUntil(page, 'the URL without play=1', () => !/play=1/.test(location.search), null, 3000);
    await K.navigateTo(page, '#mbptv [data-zone="row:related"] [data-key]');
    await K.press(page, 'Enter', 1, 300);
    await K.waitScreen(page, 'detail');
    await K.waitUntil(page, 'the related title loaded', () => !document.querySelector('#mbptv .mb-screen.is-current .mb-detail-info .mb-skel'), null, 8000);
    await K.activate(page, '[data-action="play"]');
    await page.waitForURL(/play=1/, { timeout: 8000 });
    await K.waitUntil(page, 'player mode for the related title', modeIs, 'player', 10000);
    const clicks = page.mock.filter(e => e === 'click:start_app').length;
    await K.back(page);
    await page.waitForURL(pathIs('/movie/40102'), { timeout: 8000 });
    await K.waitScreen(page, 'detail', 8000);
    await page.waitForTimeout(1200);
    const st = await state(page);
    if (page.mock.filter(e => e === 'click:start_app').length !== clicks || st.mode !== 'shell') await K.fail(page, 'returning to the first title started playback again: ' + page.mock.join(','));
    if (st.stack.join(',') !== 'home,detail,detail') await K.fail(page, 'expected home,detail,detail restored, got ' + st.stack.join(','));
  });

  flow('Back while playback is starting cancels, even when the website opens its picker a moment later', { prefs: { quality: 'ask' } }, async page => {
    await page.goto(O + '/movie/40102?play=1');
    await K.waitUntil(page, 'the starting-playback overlay', () => { const r = document.getElementById('mbptv'); return !!r && r.getAttribute('data-overlay') === 'starting'; }, null, 4000);
    await K.back(page);
    await page.waitForTimeout(2000);
    const st = await state(page);
    const siteSidebar = await page.evaluate(() => getComputedStyle(document.querySelector('.sidebarbg2')).display);
    const sheet = await page.evaluate(() => !!document.querySelector('#mbptv [data-sheet="sources"]'));
    if (st.mode !== 'shell' || st.screen !== 'detail' || sheet || siteSidebar !== 'none') await K.fail(page, 'the cancel did not stick: ' + JSON.stringify({ st, siteSidebar, sheet }));
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'the source sheet after Play', () => !!document.querySelector('#mbptv [data-sheet="sources"] [data-source-index]'), null, 8000);
  });

  flow('a website file list the adapter cannot read falls back to the website picker with the focus ring', { prefs: { quality: 'ask' } }, async page => {
    await page.route(/\/movie\/40102(\?.*)?$/, async r => {
      const res = await r.fetch();
      const body = (await res.text()).replace(/<li class="play" oss_download_url=/g, '<li class="row" data-x=');
      r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    });
    page.allowErrors = /file list not recognised/;
    await page.goto(O + '/movie/40102?play=1');
    await K.waitUntil(page, 'popup mode on the website picker', modeIs, 'popup', 8000);
    const ring = await page.evaluate(() => { const r = document.getElementById('mbptv-ring'); return !!r && r.classList.contains('is-visible'); });
    if (!ring) await K.fail(page, 'the focus ring should mark a control of the website picker');
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => { const a = document.activeElement; return !!(a && a.closest && a.closest('.sidebarbg2 li')); })) break;
      await K.press(page, 'ArrowDown', 1, 120);
    }
    await K.press(page, 'Enter', 1, 300);
    await K.waitUntil(page, 'player mode after choosing a row', modeIs, 'player', 6000);
    await K.back(page);
    await K.waitScreen(page, 'detail', 8000);
  });

  flow('website view from Settings stays on across links; Blue restores the Settings screen', {}, async page => {
    await home(page);
    await K.activate(page, '[data-action="nav-settings"]');
    await K.waitScreen(page, 'settings');
    await K.activate(page, '[data-action="setting-website"]');
    await K.waitScreen(page, 'native');
    await page.evaluate(() => document.querySelector('a[href^="/movie/"]').click());
    await page.waitForURL(/\/movie\/\d+$/, { timeout: 8000 });
    await K.waitScreen(page, 'native', 6000);
    await K.back(page);
    await page.waitForURL(pathIs('/'), { timeout: 8000 });
    await K.waitScreen(page, 'native', 6000);
    await blue(page);
    await K.waitScreen(page, 'settings', 6000);
    await K.waitFocus(page);
    const st = await state(page);
    if (st.stack.join(',') !== 'home,settings') await K.fail(page, 'expected home,settings restored, got ' + st.stack.join(','));
  });

  flow('Open website on a screen, then Back, returns to that screen', {}, async page => {
    await home(page);
    await K.activate(page, '[data-action="nav-search"]');
    await K.waitScreen(page, 'search');
    await page.keyboard.type('zzq', { delay: 40 });
    await K.activate(page, '[data-action="search-submit"]');
    await K.activate(page, '[data-action="open-website"]');
    await page.waitForURL(/\/index\/search/, { timeout: 8000 });
    await K.waitScreen(page, 'native', 6000);
    await K.back(page);
    await page.waitForURL(pathIs('/'), { timeout: 8000 });
    await K.waitScreen(page, 'search', 8000);
    await K.waitFocus(page);
    const q = await K.queryText(page);
    if (q !== 'zzq') await K.fail(page, 'the search screen should come back with its query, got ' + JSON.stringify(q));
  });

  flow('an iframe that steals focus cannot take the remote away', {}, async page => {
    await home(page);
    await page.evaluate(() => {
      const f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:0;top:0;width:10px;height:10px';
      document.body.appendChild(f);
      f.contentWindow.focus();
      f.focus();
    });
    await K.waitUntil(page, 'the watchdog to bring focus back to the shell', () => { const el = document.querySelector('#mbptv .is-focused'); return !!el && el === document.activeElement; }, null, 4500);
    const a = await K.focusInfo(page);
    await K.press(page, 'ArrowRight', 1, 200);
    const b = await K.focusInfo(page);
    if (a.key === b.key && a.action === b.action) await K.fail(page, 'ArrowRight did not move focus after the iframe released it');
  });

  flow('letter keys without KeyboardEvent.key (Chromium 47) open Search and type', {}, async page => {
    await home(page);
    const cdp = await page.context().newCDPSession(page);
    for (const code of [66, 65, 84]) {
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: '', code: '' });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: '', code: '' });
      await page.waitForTimeout(120);
    }
    await K.waitScreen(page, 'search');
    const q = await K.queryText(page);
    if (q !== 'bat') await K.fail(page, 'expected "bat" in #mbptv-query, got ' + JSON.stringify(q));
  });

  flow('a full storage quota never breaks preferences', {}, async page => {
    await page.context_.addInitScript({ content: 'Storage.prototype.setItem = function () { var e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; };' });
    await home(page);
    await K.activate(page, '[data-key="movie:40102"]');
    await K.waitScreen(page, 'detail');
    await K.activate(page, '[data-action="quality"]');
    await K.activate(page, '[data-option="ask"]');
    const label = await page.evaluate(() => document.querySelector('#mbptv [data-action="quality"]').textContent);
    if (!/Ask/.test(label)) await K.fail(page, 'the Quality button should read "Ask every time", got ' + JSON.stringify(label));
  });

  flow('My Library tabs: History (legacy detail links) loads, and the selected tab follows', {}, async page => {
    await home(page);
    await K.activate(page, '[data-action="nav-library"]');
    await K.waitScreen(page, 'browse');
    await K.waitUntil(page, 'library cards', () => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length > 0, null, 8000);
    await K.navigateTo(page, { selector: '#mbptv .mb-browse-tabs [data-f]', index: 3 });
    await K.press(page, 'Enter', 1, 200);
    const keys = await K.waitUntil(page, 'history cards (movie:81314)', () => {
      const k = Array.prototype.map.call(document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]'), e => e.getAttribute('data-key'));
      return k.indexOf('movie:81314') >= 0 ? k : null;
    }, null, 8000);
    const sel = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#mbptv .mb-browse-tabs .is-selected'), e => e.textContent.trim()));
    if (sel.join('|') !== 'History') await K.fail(page, 'only the History tab should be selected, got ' + JSON.stringify(sel) + ' with ' + keys.join(','));
  });

  flow('a player inside a same-origin iframe still gets remote keys: seek, pause and Back', {}, async page => {
    await page.goto(O + '/movie/40102');
    await K.waitScreen(page, 'detail');
    await K.waitFocus(page);
    await page.evaluate(() => {
      const rate = 4000, n = rate * 120, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
      const s = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
      s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
      v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
      s(36, 'data'); v.setUint32(40, n, true); for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
      const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
      const dlg = document.getElementById('my_dialog');
      dlg.style.cssText = 'display:block;position:fixed;left:0;top:0;width:100%;height:100%;background:#000;z-index:9998;';
      const panel = document.getElementById('player_panel');
      panel.innerHTML = '';
      const f = document.createElement('iframe');
      f.id = 'player-frame';
      f.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;border:0';
      panel.appendChild(f);
      const d = f.contentDocument;
      d.open(); d.write('<!doctype html><body style="margin:0;background:#111"><video id="fv" muted style="width:100%;height:100vh"></video></body>'); d.close();
      const fv = d.getElementById('fv');
      fv.src = url;
      fv.play().catch(() => {});
      f.contentWindow.focus();
    });
    await K.waitUntil(page, 'player mode for the iframe player', modeIs, 'player', 5000);
    await K.waitUntil(page, 'the iframe video to be ready', () => { const v = document.getElementById('player-frame').contentDocument.getElementById('fv'); return v.readyState >= 1; }, null, 5000);
    await page.waitForTimeout(2200); // one watchdog tick hooks the frame's key listener
    const t0 = await page.evaluate(() => document.getElementById('player-frame').contentDocument.getElementById('fv').currentTime);
    await page.frameLocator('#player-frame').locator('body').press('ArrowRight');
    await K.waitUntil(page, 'currentTime to jump about 10 s (keys pressed inside the iframe)', t => document.getElementById('player-frame').contentDocument.getElementById('fv').currentTime >= t + 7, t0, 3000);
    await page.frameLocator('#player-frame').locator('body').press('Escape');
    await K.waitUntil(page, 'Back inside the iframe to close the player', () => getComputedStyle(document.getElementById('my_dialog')).display === 'none', null, 4000);
    await K.waitScreen(page, 'detail', 6000);
  });

  await run();
  await browser.close();
  await site.close();
}

main().catch(e => { console.error(e); process.exit(1); });
