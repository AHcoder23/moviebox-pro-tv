// Compatibility: module manifest, Tizen user agents and viewports, real Tizen key codes, an older-Chromium API
// surface, storage that throws, and a slow website. Standalone: node test/compat.test.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./helpers.cjs');
const K = require('./app.test.cjs');

const ROOT = H.root;
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const TIZEN3_UA = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 3.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/3.0 TV Safari/538.1';

// Runtime APIs that Chromium 47 (Tizen 3, 2017) does not have. Removing them before tv.js runs catches uses the lint cannot see.
const OLD_CHROMIUM = `(function () {
  function drop(obj, names) { names.forEach(function (n) { try { delete obj[n]; } catch (e) {} try { if (n in obj) Object.defineProperty(obj, n, { value: undefined, configurable: true, writable: true }); } catch (e) {} }); }
  drop(NodeList.prototype, ['forEach']);
  [Element.prototype, Document.prototype, DocumentFragment.prototype].forEach(function (p) { drop(p, ['append', 'prepend', 'replaceChildren']); });
  drop(Element.prototype, ['before', 'after', 'replaceWith', 'toggleAttribute', 'getAttributeNames']);
  drop(CharacterData.prototype, ['before', 'after', 'replaceWith']);
  drop(String.prototype, ['padStart', 'padEnd', 'trimStart', 'trimEnd', 'matchAll', 'replaceAll', 'at']);
  drop(Array.prototype, ['flat', 'flatMap', 'at', 'findLast', 'findLastIndex']);
  drop(Object, ['values', 'fromEntries', 'getOwnPropertyDescriptors', 'hasOwn']); /* Object.entries stays: Playwright's evaluate serializer needs it */
  drop(Promise.prototype, ['finally']);
  drop(window, ['URLSearchParams', 'IntersectionObserver', 'ResizeObserver']);
  window.__oldChromium = true;
}());`;

const THROWING_STORAGE = `(function () {
  ['localStorage', 'sessionStorage'].forEach(function (name) {
    try { Object.defineProperty(window, name, { configurable: true, get: function () { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); } catch (e) {}
  });
  window.__storageBlocked = (function () { try { window.localStorage; return false; } catch (e) { return true; } }());
}());`;

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function openWith(browser, origin, opts) {
  const page = await H.openPage(browser, { tv: false, ua: opts.ua, viewport: opts.viewport });
  page.mock = []; page.requests = []; page.origin = origin;
  for (const code of opts.before || []) await page.context_.addInitScript({ content: code });
  await page.context_.addInitScript({ content: H.tvScript() });
  for (const code of opts.after || []) await page.context_.addInitScript({ content: code });
  return page;
}

async function noErrors(page) {
  if (page.errors.length) await K.fail(page, 'uncaught page errors or Log.error output:\n    ' + page.errors.slice(0, 4).join('\n    '));
}

async function bootSmoke(page) {
  await K.waitScreen(page, 'home', 12000);
  await K.waitFocus(page);
  const m = await page.evaluate(() => {
    const r = document.getElementById('mbptv'), b = r.getBoundingClientRect();
    const f = document.querySelector('#mbptv .is-focused'), fb = f.getBoundingClientRect();
    return {
      vw: innerWidth, vh: innerHeight, font: parseFloat(getComputedStyle(r).fontSize),
      covers: b.left <= 0 && b.top <= 0 && b.right >= innerWidth && b.bottom >= innerHeight,
      focusOnScreen: fb.width > 0 && fb.left >= 0 && fb.top >= 0 && fb.right <= innerWidth && fb.bottom <= innerHeight
    };
  });
  const want = m.vw * 0.008333;
  if (Math.abs(m.font - want) > 0.6) await K.fail(page, '#mbptv font-size should be 0.8333vw (' + want.toFixed(2) + 'px at ' + m.vw + 'px wide), got ' + m.font + 'px');
  if (!m.covers) await K.fail(page, 'the home screen should cover the whole ' + m.vw + 'x' + m.vh + ' viewport');
  if (!m.focusOnScreen) await K.fail(page, 'the initially focused control should be fully on screen');
  const before = await K.focusInfo(page);
  await K.press(page, 'ArrowDown');
  const after = await K.focusInfo(page);
  if (!after || JSON.stringify(after.rect) === JSON.stringify(before.rect) && after.key === before.key && after.action === before.action) await K.fail(page, 'ArrowDown should move focus');
  return m;
}

(async () => {
  const site = await H.mockSite.start();
  const browser = await H.launch();
  const O = site.origin;
  const { test, run } = H.makeRunner('compat');
  const pages = [];
  const tracked = async opts => { const p = await openWith(browser, O, opts); pages.push(p); return p; };

  test('package.json is a valid TizenBrew mods manifest and tv.js matches it', async () => {
    assert(PKG.packageType === 'mods', 'packageType must be "mods", got ' + PKG.packageType);
    assert(PKG.main === 'tv.js' && fs.existsSync(path.join(ROOT, 'tv.js')), 'main must be tv.js and the file must exist');
    assert(/^https:\/\/[a-z0-9.-]+(:\d+)?\/[^\s@]*$/i.test(PKG.websiteURL), 'websiteURL must be an absolute https URL without login details, got ' + PKG.websiteURL);
    assert(PKG.evaluateScriptOnDocumentStart === false, 'evaluateScriptOnDocumentStart must be false (docs/ARCHITECTURE.md section 2)');
    assert(typeof PKG.appName === 'string' && PKG.appName.trim(), 'appName is required');
    assert(/^\d+\.\d+\.\d+$/.test(PKG.version), 'version must be x.y.z, got ' + PKG.version);
    assert(Array.isArray(PKG.keys) && PKG.keys.length && PKG.keys.every(k => typeof k === 'string'), 'keys must be an array of key names');
    assert(new Set(PKG.keys).size === PKG.keys.length, 'keys must be unique');
    for (const k of ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'ColorF3Blue', 'Info']) assert(PKG.keys.indexOf(k) >= 0, 'keys must register ' + k);
    for (const f of ['tv.js', 'README.md', 'LICENSE']) assert((PKG.files || []).indexOf(f) >= 0 && fs.existsSync(path.join(ROOT, f)), 'files must list and ship ' + f);
    const tv = fs.readFileSync(path.join(ROOT, 'tv.js'), 'utf8');
    const starts = tv.match(/^  var START_URL = (.*);$/mg) || [];
    assert(starts.length === 1, 'tv.js must contain exactly one "  var START_URL = ...;" line, found ' + starts.length);
    assert(JSON.parse(starts[0].replace(/^  var START_URL = |;$/g, '')) === PKG.websiteURL, 'tv.js START_URL must equal package.json websiteURL (rebuild with node tools/build.cjs)');
    const ver = tv.match(/^  var VERSION = (.*);$/m);
    assert(ver && JSON.parse(ver[1]) === PKG.version, 'tv.js VERSION must equal package.json version (rebuild with node tools/build.cjs)');
    assert(tv.length < 700 * 1024, 'tv.js should stay small for TV download and parse (' + Math.round(tv.length / 1024) + ' KB)');
    assert(!/^\s*debugger\s*;?\s*$/m.test(tv), 'tv.js must not contain debugger statements');
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    assert(readme.indexOf('AHcoder23/moviebox-pro-tv@v' + PKG.version) >= 0, 'README install instructions must name the current tag AHcoder23/moviebox-pro-tv@v' + PKG.version);
  });

  for (const v of [
    { name: 'Tizen 6 UA at 1920x1080', ua: H.TIZEN_UA, viewport: { width: 1920, height: 1080 } },
    { name: 'Tizen 6 UA at 1280x720', ua: H.TIZEN_UA, viewport: { width: 1280, height: 720 } },
    { name: 'Tizen 3 UA at 1920x1080', ua: TIZEN3_UA, viewport: { width: 1920, height: 1080 } }
  ]) {
    test('boot smoke: ' + v.name + ' (home, focus on screen, 1em = viewport/120, no errors)', async () => {
      const page = await tracked({ ua: v.ua, viewport: v.viewport });
      await page.goto(O + '/');
      await bootSmoke(page);
      await noErrors(page);
    });
  }

  test('real Tizen key codes (Back 10009, arrows) work through CDP key events', async () => {
    const page = await tracked({});
    await page.goto(O + '/');
    await K.waitScreen(page, 'home');
    await K.waitFocus(page);
    const cdp = await page.context().newCDPSession(page);
    const tvKey = async (code, key) => {
      for (const type of ['rawKeyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key, code: '' });
      await page.waitForTimeout(150);
    };
    const f0 = await K.focusInfo(page);
    await tvKey(40, 'ArrowDown');
    const f1 = await K.focusInfo(page);
    if (JSON.stringify(f0) === JSON.stringify(f1)) await K.fail(page, 'keyCode 40 (remote Down) should move focus');
    await tvKey(10009, 'XF86Back');
    await K.waitUntil(page, '[data-dialog="exit"] after keyCode 10009 (remote Back)', () => !!document.querySelector('#mbptv [data-dialog="exit"]'), null, 3000);
    await tvKey(10009, 'XF86Back');
    await K.waitUntil(page, 'the exit dialog to close after a second 10009', () => { const d = document.querySelector('#mbptv [data-dialog="exit"]'); return !d || d.getBoundingClientRect().height === 0; }, null, 3000);
    await noErrors(page);
  });

  test('works with post-Chromium-47 runtime APIs removed (NodeList.forEach, append, padStart, Object.values, URLSearchParams...)', async () => {
    const page = await tracked({ before: [OLD_CHROMIUM] });
    await page.goto(O + '/');
    const flag = await page.evaluate(() => window.__oldChromium === true && typeof NodeList.prototype.forEach !== 'function' && typeof Element.prototype.append !== 'function');
    assert(flag, 'the API removal shim did not apply');
    await bootSmoke(page);
    await K.activate(page, '[data-action="nav-search"]');
    await K.waitScreen(page, 'search');
    await page.keyboard.type('ba', { delay: 60 });
    await K.waitUntil(page, '[data-suggestion] rows', () => document.querySelectorAll('#mbptv [data-suggestion]').length > 0, null, 5000);
    await K.activate(page, '[data-action="search-submit"]');
    await K.waitUntil(page, 'result cards', () => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length > 0, null, 8000);
    await noErrors(page);
  });

  test('works when localStorage and sessionStorage throw (Tizen private mode / quota)', async () => {
    const page = await tracked({ before: [THROWING_STORAGE] });
    await page.goto(O + '/');
    assert(await page.evaluate(() => window.__storageBlocked === true), 'the storage-blocking shim did not apply');
    await bootSmoke(page);
    await K.activate(page, '[data-key="movie:40102"]');
    await K.waitScreen(page, 'detail');
    await K.back(page);
    await K.waitScreen(page, 'home');
    await noErrors(page);
  });

  test('slow website (800 ms per request): the shell shows loading or content, never a blank, and reaches home and browse', async () => {
    const slow = await H.mockSite.start({ delayMs: 800 });
    let page = null;
    try {
      const SAMPLER = `(function () {
        if (window.top !== window.self) return;
        var s = window.__e2eSamples = [];
        var t = setInterval(function () {
          var r = document.getElementById('mbptv'), shown = false;
          if (r) { var all = r.querySelectorAll('*'); for (var i = 0; i < all.length && !shown; i++) { var b = all[i].getBoundingClientRect(); shown = b.width > 0 && b.height > 0; } }
          s.push(r ? (r.getAttribute('data-screen') || '(no data-screen)') + (shown ? '' : ':blank') : '-');
          if (s.length > 3000) clearInterval(t);
        }, 40);
      }());`;
      page = await openWith(browser, slow.origin, { after: [SAMPLER] });
      page.origin = slow.origin;
      await page.goto(slow.origin + '/', { waitUntil: 'commit' });
      await K.waitScreen(page, 'home', 20000);
      await K.waitFocus(page);
      const check = async (allowed, phase) => {
        const samples = await page.evaluate(() => { const s = window.__e2eSamples.slice(); window.__e2eSamples.length = 0; return s; });
        const shown = samples.filter(x => x !== '-');
        const bad = shown.filter(x => allowed.indexOf(x) < 0);
        if (bad.length) await K.fail(page, phase + ': the shell showed ' + JSON.stringify(Array.from(new Set(bad))) + ' (allowed ' + allowed.join('/') + '); sequence: ' + shown.filter((x, i) => shown[i - 1] !== x).join(' > '));
        return shown;
      };
      await check(['loading', 'home'], 'boot');
      await K.activate(page, '[data-action="nav-movies"]');
      await K.waitUntil(page, 'browse cards on the slow site', () => {
        const r = document.getElementById('mbptv');
        return r && r.getAttribute('data-screen') === 'browse' && document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length > 0;
      }, null, 20000);
      await check(['home', 'loading', 'browse'], 'opening Movies');
      await noErrors(page);
    } finally {
      if (page) await page.context_.close().catch(() => {});
      await slow.close();
    }
  });

  await run();
  for (const p of pages) await p.context_.close().catch(() => {});
  await browser.close();
  await site.close();
})().catch(e => { console.error(e); process.exit(1); });
