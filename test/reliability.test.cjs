// Reliability flows: navigation across real page loads (Session, website mode), playback edge cases, focus theft,
// old-browser keys and full storage. Same kit and rules as app.test.cjs: the built tv.js on the mock site, remote keys.
// Playback flows exercise the website's own player (the built-in player's fallback, and Settings > Built-in player
// off), so every flow runs with Prefs nativePlayer: false unless it passes {native: true}.
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
      const o = Object.assign({ path: null }, opts);
      if (!o.native) o.prefs = Object.assign({ nativePlayer: false }, o.prefs || {});
      const page = await K.openApp(browser, O, o);
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

  // ---- Playback and navigation traps found in the 0.3 review ---------------------------------------------------------

  const WAV = `(function () {
    var rate = 4000, n = rate * 120, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    function s(o, str) { for (var i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); }
    s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    s(36, 'data'); v.setUint32(40, n, true); for (var i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }())`;
  // Samples App.state().mode every 100 ms for ms milliseconds.
  async function modesFor(page, ms) {
    const out = [];
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { out.push((await state(page)).mode); await page.waitForTimeout(100); }
    return out;
  }

  flow('a website player that cannot be closed never traps the viewer: Back leaves it for good; Blue reaches its controls', {}, async page => {
    await page.goto(O + '/movie/40102');
    await K.waitScreen(page, 'detail');
    await K.waitFocus(page);
    // Markup drift: the site's player now lives outside #my_dialog and has no known close control.
    await page.evaluate(wav => {
      window.__openStuck = () => {
        let box = document.getElementById('newplayer');
        if (!box) {
          box = document.createElement('div');
          box.id = 'newplayer';
          box.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;background:#000;z-index:9998';
          box.innerHTML = '<div class="newbar"><a href="#" class="newbar-cc" style="display:inline-block;width:80px;height:40px;background:#333;color:#fff">CC</a></div>';
          const v = document.createElement('video');
          v.style.cssText = 'width:100%;height:90%';
          v.src = eval(wav);
          v.muted = true;
          box.appendChild(v);
          document.body.appendChild(box);
        }
        box.querySelector('video').play().catch(() => {});
      };
      document.addEventListener('click', e => {
        if (e.target.closest && e.target.closest('.start_app')) { e.preventDefault(); e.stopImmediatePropagation(); window.__openStuck(); }
      }, true);
    }, WAV);
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'player mode for the new player', modeIs, 'player', 8000);
    await K.back(page);
    const after = await modesFor(page, 5500);
    if (after.some(m => m !== 'shell')) await K.fail(page, 'after Back the viewer must stay out of the stuck player, modes: ' + Array.from(new Set(after)).join(' > '));
    if ((await state(page)).screen !== 'detail') await K.fail(page, 'Back should return to the detail screen');
    // Play again: the player comes back, and Blue opens its controls (scoped website mode); Back returns to the TV player.
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'player mode again', modeIs, 'player', 8000);
    await blue(page);
    await K.waitUntil(page, 'the player controls mode', () => window.__mbptv.App.state().mode === 'popup' && document.documentElement.classList.contains('mbptv-jwctl'), null, 3000);
    const ring = await page.evaluate(() => document.getElementById('mbptv-ring').classList.contains('is-visible'));
    if (!ring) await K.fail(page, 'the focus ring should mark one of the player\'s controls');
    await K.back(page);
    await K.waitUntil(page, 'back to the TV player', modeIs, 'player', 3000);
    await K.back(page);
    await K.waitUntil(page, 'the shell after Back', modeIs, 'shell', 3000);
  });

  flow('a muted, looping hero video on a title page is never taken for the player', {}, async page => {
    await page.goto(O + '/movie/40102');
    await K.waitScreen(page, 'detail');
    await K.waitFocus(page);
    await page.evaluate(wav => {
      const v = document.createElement('video');
      v.setAttribute('muted', ''); v.setAttribute('autoplay', ''); v.setAttribute('loop', ''); v.muted = true;
      v.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:70vh;z-index:1';
      v.src = eval(wav);
      document.body.appendChild(v);
      v.play().catch(() => {});
    }, WAV);
    const a = await modesFor(page, 3000);
    if (a.some(m => m !== 'shell')) await K.fail(page, 'the hero video must not open player mode: ' + Array.from(new Set(a)).join(' > '));
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'player mode for the real player', modeIs, 'player', 10000);
    await K.back(page);
    await K.waitScreen(page, 'detail', 8000);
    const b = await modesFor(page, 3000);
    if (b.some(m => m !== 'shell')) await K.fail(page, 'after Back the hero video must not reopen player mode: ' + Array.from(new Set(b)).join(' > '));
  });

  flow('a long film: Back from the player still returns to the page the viewer came from after 30+ minutes', {}, async page => {
    // A clock the test can move forward (shared by every page through sessionStorage).
    await page.context_.addInitScript({ content: `(function () {
      var D = Date;
      function off() { try { return +(sessionStorage.getItem('__e2eClock') || 0); } catch (e) { return 0; } }
      function S(a, b, c, d, e, f, g) {
        if (!(this instanceof S)) return D();
        var n = arguments.length;
        return n === 0 ? new D(D.now() + off()) : n === 1 ? new D(a) : new D(a, b, c === undefined ? 1 : c, d || 0, e || 0, f || 0, g || 0);
      }
      S.now = function () { return D.now() + off(); }; S.parse = D.parse; S.UTC = D.UTC; S.prototype = D.prototype;
      window.Date = S;
    }());` });
    await home(page);
    await K.activate(page, '[data-key="movie:40102"]');
    await K.waitScreen(page, 'detail');
    await K.activate(page, '[data-action="play"]');
    await page.waitForURL(/play=1/, { timeout: 8000 });
    await K.waitUntil(page, 'player mode', modeIs, 'player', 15000);
    await page.waitForTimeout(800);
    // 45 minutes of watching, in steps (the app refreshes its saved place about once a minute while it plays).
    for (const min of [15, 30, 45]) {
      await page.evaluate(ms => sessionStorage.setItem('__e2eClock', String(ms)), min * 60 * 1000);
      await page.waitForTimeout(1000);
    }
    await K.back(page);
    await page.waitForURL(pathIs('/'), { timeout: 8000 });
    await K.waitScreen(page, 'detail', 10000);
    const st = await state(page);
    if (st.stack.join(',') !== 'home,detail') await K.fail(page, 'expected home,detail restored after the long film, got ' + st.stack.join(','));
  });

  flow('a site popup that keeps coming back: Blue returns to the TV app for good; an !important popup still closes with Back', {}, async page => {
    await page.goto(O + '/movie/40102');
    await K.waitScreen(page, 'detail');
    await K.waitFocus(page);
    await page.addStyleTag({ content: '.vip_pay_tips.sticky { display: block !important; position: fixed; left: 30%; top: 30%; width: 40%; height: 30%; background: #333; z-index: 9999; }' });
    await page.evaluate(() => document.querySelector('.vip_pay_tips').classList.add('sticky'));
    await K.waitUntil(page, 'popup mode', modeIs, 'popup', 3000);
    await K.back(page);
    await K.waitUntil(page, 'the !important popup hidden and the shell back', () => window.__mbptv.App.state().mode === 'shell' && getComputedStyle(document.querySelector('.vip_pay_tips')).display === 'none', null, 3000);
    // Now the site re-shows it every 100 ms, so hiding never sticks.
    await page.evaluate(() => { const el = document.querySelector('.vip_pay_tips'); setInterval(() => el.style.setProperty('display', 'block', 'important'), 100); });
    await K.waitUntil(page, 'popup mode again', modeIs, 'popup', 3000);
    await blue(page);
    const m = await modesFor(page, 2500);
    if (m.slice(3).some(x => x !== 'shell')) await K.fail(page, 'Blue should return to the TV app and stay there: ' + Array.from(new Set(m)).join(' > '));
    const f0 = await K.focusInfo(page);
    await K.press(page, 'ArrowDown', 1, 200);
    const f1 = await K.focusInfo(page);
    if (!f1 || JSON.stringify(f0) === JSON.stringify(f1)) await K.fail(page, 'the remote should drive the TV app again');
  });

  flow('closing the file list sticks: the website re-opening its picker does not bring the sheet back', { prefs: { quality: 'ask' } }, async page => {
    await page.goto(O + '/movie/40102');
    await K.waitScreen(page, 'detail');
    await K.waitFocus(page);
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'the source sheet', () => !!document.querySelector('#mbptv [data-sheet="sources"] [data-source-index]'), null, 8000);
    await K.back(page);
    await page.waitForTimeout(500);
    await page.evaluate(() => { const b = document.querySelector('.sidebarbg2'); setInterval(() => { b.style.cssText = 'display:block;position:fixed;right:0;top:0;bottom:0;width:420px;background:#222;z-index:9997'; }, 700); });
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      const s = await page.evaluate(() => ({ sheet: !!document.querySelector('#mbptv [data-sheet="sources"]'), st: window.__mbptv.App.state() }));
      if (s.sheet || s.st.screen !== 'detail' || s.st.stack.join(',') !== 'home,detail') await K.fail(page, 'the closed file list came back: ' + JSON.stringify(s));
      await page.waitForTimeout(200);
    }
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'the source sheet after a new Play', () => !!document.querySelector('#mbptv [data-sheet="sources"] [data-source-index]'), null, 8000);
  });

  flow('a "no files" message after Play: Back dismisses it once, nothing is clicked again, play=1 is dropped and the message stays readable', {}, async page => {
    await page.context_.addInitScript({ content: `(function () {
      if (window.top !== window.self) return;
      window.__startClicks = 0;
      document.addEventListener('click', function (e) {
        if (!(e.target.closest && e.target.closest('.start_app'))) return;
        e.preventDefault(); e.stopImmediatePropagation();
        window.__startClicks++;
        var n = document.querySelector('.no_resource_bg');
        if (!n) { n = document.createElement('div'); n.className = 'no_resource_bg'; n.innerHTML = '<p class="close">x</p><p>No resource for this title yet</p>'; document.body.appendChild(n); }
        n.style.cssText = 'display:block;position:fixed;left:35%;top:35%;width:30%;height:20%;background:#333;color:#fff;z-index:9999';
      }, true);
    }());` });
    await page.goto(O + '/movie/40102?play=1');
    await K.waitUntil(page, 'popup mode for the message', modeIs, 'popup', 8000);
    await K.back(page);
    await page.waitForTimeout(7000);
    const r = await page.evaluate(() => ({ clicks: window.__startClicks, url: location.search, st: window.__mbptv.App.state(), toast: (document.getElementById('mbptv-toast') || {}).textContent || '' }));
    if (r.clicks !== 1) await K.fail(page, 'the play control must not be clicked again after the website answered: ' + r.clicks + ' clicks');
    if (/play=1/.test(r.url) || r.st.mode !== 'shell' || r.st.screen !== 'detail') await K.fail(page, 'expected the settled detail screen, got ' + JSON.stringify(r));
    const toasts = await page.evaluate(() => window.__mbptv.Log.entries().filter(e => e.label === 'toast').map(e => e.msg));
    if (!toasts.some(t => /No resource/.test(t)) || toasts.some(t => /Try Play again/.test(t))) await K.fail(page, 'the website\'s message should be repeated, not "Try Play again": ' + JSON.stringify(toasts));
  });

  flow('signing in from a sign-in screen shown mid-session lands on Home, not on the sign-in screen again', { allowErrors: /signed-out|sign-?in|gate|login/i }, async page => {
    await home(page);
    await page.context().addCookies([{ name: 'mockgate', value: '1', url: O + '/' }]);
    await K.activate(page, '[data-action="nav-movies"]');
    await K.waitScreen(page, 'signin', 12000);
    await K.activate(page, '[data-action="signin-qr"]');
    await page.waitForURL(/\/index\/login\/qrcode/, { timeout: 8000 });
    await K.waitScreen(page, 'native', 6000);
    await page.goto(O + '/__mock/signin');
    await K.waitScreen(page, 'home', 10000);
    const st = await state(page);
    if (st.stack.join(',') !== 'home') await K.fail(page, 'expected Home after signing in, got ' + JSON.stringify(st));
  });

  flow('Back while the play page is still loading cancels for real: the player never opens', {}, async page => {
    await page.route(/\/movie\/40102\?play=1$/, r => { if (r.request().isNavigationRequest()) setTimeout(() => r.continue().catch(() => {}), 2500); else r.continue(); });
    await home(page);
    await K.activate(page, '[data-key="movie:40102"]');
    await K.waitScreen(page, 'detail');
    await K.waitFocus(page);
    await K.navigateTo(page, '[data-action="play"]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    let bad = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 6500) {
      const s = await page.evaluate(() => ({ url: location.pathname + location.search, st: window.__mbptv && window.__mbptv.App.state() })).catch(() => null);
      if (s && (s.st && s.st.mode === 'player' || /play=1/.test(s.url))) { bad = s; break; }
      await page.waitForTimeout(150);
    }
    if (bad) await K.fail(page, 'the cancelled Play went on: ' + JSON.stringify(bad));
    const st = await state(page);
    if (st.screen !== 'detail' || st.mode !== 'shell') await K.fail(page, 'the viewer should stay on the detail screen, got ' + JSON.stringify(st));
  });

  flow('two quick Backs in website view go back one page, not two', {}, async page => {
    await page.goto(O + '/movie/316');
    await K.waitScreen(page, 'detail');
    await page.goto(O + '/');
    await K.waitScreen(page, 'home');
    await K.waitFocus(page);
    await page.route(u => new URL(u).pathname === '/', r => { if (r.request().isNavigationRequest()) setTimeout(() => r.continue().catch(() => {}), 1200); else r.continue(); });
    await K.activate(page, '[data-action="nav-search"]');
    await K.waitScreen(page, 'search');
    await page.keyboard.type('zzq', { delay: 40 });
    await K.activate(page, '[data-action="search-submit"]');
    await K.activate(page, '[data-action="open-website"]');
    await page.waitForURL(/\/index\/search/, { timeout: 8000 });
    await K.waitScreen(page, 'native', 6000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    await page.keyboard.press('Escape');
    await page.waitForURL(pathIs('/'), { timeout: 8000 });
    await K.waitScreen(page, 'search', 10000);
    await page.waitForTimeout(1500);
    if (new URL(page.url()).pathname !== '/') await K.fail(page, 'two quick Backs skipped past the page the viewer came from: ' + page.url());
  });

  flow('a page restored from the back-forward cache drops the website-mode marker, so the next Play is a normal Play', {}, async page => {
    await home(page);
    await page.evaluate(() => {
      sessionStorage.setItem('mbptv:web:v1', JSON.stringify({ t: Date.now(), origin: location.href.replace(/#.*$/, ''), kind: 'nav' }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    const key = await page.evaluate(() => sessionStorage.getItem('mbptv:web:v1'));
    if (key) await K.fail(page, 'the website-mode marker for this page should be gone, got ' + key);
    await K.activate(page, '[data-key="movie:40102"]');
    await K.waitScreen(page, 'detail');
    await K.activate(page, '[data-action="play"]');
    await page.waitForURL(/play=1/, { timeout: 8000 });
    await K.waitUntil(page, 'player mode (not website view)', modeIs, 'player', 15000);
  });

  // ---- Built-in player reliability --------------------------------------------------------------------------------

  const nativePlaying = () => {
    const p = document.getElementById('mbptv-player'), v = p && p.querySelector('video');
    return !!p && p.getAttribute('data-state') === 'playing' && !!v && v.currentTime > 0.3 && !v.paused;
  };
  const cookie = async (page, name, value) => page.context_.addCookies([{ name, value: String(value), url: O + '/' }]);
  async function movieDetail(page) {
    await home(page);
    await K.activate(page, '[data-key="movie:40102"]');
    await K.waitScreen(page, 'detail');
    await K.waitUntil(page, 'the movie detail', K.headingShows, 'The Batman', 8000);
  }

  flow('built-in player: Back while it loads cancels for good: nothing plays later and Play has focus again', { native: true }, async page => {
    await cookie(page, 'mbp_delay', 2500);
    await movieDetail(page);
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'the loading screen', () => { const p = document.getElementById('mbptv-player'); return !!p && p.getAttribute('data-state') === 'loading'; }, null, 4000);
    await K.back(page);
    await K.waitScreen(page, 'detail', 4000);
    const f = await K.waitFocus(page);
    if (f.action !== 'play') await K.fail(page, 'Back from the loading screen should focus Play again, got ' + JSON.stringify(f));
    await page.waitForTimeout(3500);
    const st = await page.evaluate(() => ({ up: !!document.getElementById('mbptv-player'), playing: Array.prototype.some.call(document.querySelectorAll('video'), v => !v.paused), mode: window.__mbptv.App.state().mode }));
    if (st.up || st.playing || st.mode !== 'shell') await K.fail(page, 'a cancelled start must never play later, got ' + JSON.stringify(st));
  });

  flow('built-in player: while it plays the watchdog leaves it alone, the page stays locked, and the hidden shell never takes focus', { native: true }, async page => {
    await movieDetail(page);
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000);
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await page.waitForTimeout(4500); // two watchdog rounds
    const st = await page.evaluate(() => ({
      mode: window.__mbptv.App.state().mode, focused: !!document.querySelector('#mbptv .is-focused'), lock: document.documentElement.classList.contains('mbptv-lock'),
      refocus: window.__mbptv.Log.entries().filter(e => e.label === 'watchdog').length, playing: !!document.querySelector('#mbptv-player video') && !document.querySelector('#mbptv-player video').paused
    }));
    if (st.mode !== 'player' || st.focused || !st.lock || st.refocus || !st.playing) await K.fail(page, 'expected player mode, no shell focus, html.mbptv-lock, no watchdog refocus, still playing; got ' + JSON.stringify(st));
    await page.keyboard.press('ArrowRight');
    await K.waitUntil(page, 'the remote still reaches the player (the OSD shows after Right)', () => document.getElementById('mbptv-player').classList.contains('is-osd'), null, 2000);
  });

  flow('built-in player: signing out mid-playback closes it and routes to sign-in', { native: true, allowErrors: /signed-out|sign-?in|gate|login/i }, async page => {
    await movieDetail(page);
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000);
    await cookie(page, 'mockgate', 1);
    await page.evaluate(() => window.__mbptv.Api.home(function () {}));
    await K.waitScreen(page, 'signin', 6000);
    const st = await page.evaluate(() => ({ up: !!document.getElementById('mbptv-player'), mode: window.__mbptv.App.state().mode, playing: Array.prototype.some.call(document.querySelectorAll('video'), v => !v.paused) }));
    if (st.up || st.mode !== 'shell' || st.playing) await K.fail(page, 'signing out must close the built-in player, got ' + JSON.stringify(st));
  });

  flow('built-in player: after watching, Home\'s Continue Watching is fetched again (and kept when it did not change)', { native: true }, async page => {
    await home(page);
    await K.activate(page, '[data-key="movie:40102"]');
    await K.waitScreen(page, 'detail');
    await K.activate(page, '[data-action="play"]');
    await K.waitUntil(page, 'the built-in player playing', nativePlaying, null, 20000);
    await page.waitForTimeout(800);
    const before = page.requests.filter(u => new URL(u).pathname === '/').length;
    await K.back(page);
    await K.waitScreen(page, 'detail', 5000);
    const t0 = Date.now();
    let after = before;
    while (after <= before && Date.now() - t0 < 5000) { await page.waitForTimeout(100); after = page.requests.filter(u => new URL(u).pathname === '/').length; }
    if (after <= before) await K.fail(page, 'closing the player should fetch Home again for Continue Watching (' + before + ' -> ' + after + ' requests for /)');
    await K.back(page);
    await K.waitScreen(page, 'home', 5000);
    const f = await K.waitFocus(page);
    if (f.key !== 'movie:40102') await K.fail(page, 'Back to Home keeps the card the viewer came from focused, got ' + JSON.stringify(f));
  });

  await run();
  await browser.close();
  await site.close();
}

main().catch(e => { console.error(e); process.exit(1); });
