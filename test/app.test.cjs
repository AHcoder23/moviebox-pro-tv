// End-to-end flows: the built tv.js on the mock site, driven only with remote keys.
// Written against docs/ARCHITECTURE.md section 6 (UX) and section 10 (DOM contract), not against implementation details.
// Standalone: node test/app.test.cjs [title filter...]
// Also exports the remote-driving kit used by tools/screenshot.cjs.
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./helpers.cjs');

const ROOT = H.root;
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const ARTIFACTS = path.join(ROOT, 'test', 'artifacts');

function decodeEntities(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Title per card key, read from the home fixture (li[title] + onclick URL), so tests do not depend on Site.
const HOME_TITLES = (() => {
  const html = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'home.html'), 'utf8');
  const out = {};
  const re = /title="([^"]+)"[^>]*>\s*<img\b[^>]*?onclick="window\.location\.href='\/(movie|tvshow)\/(\d+)/g;
  let m;
  while ((m = re.exec(html))) out[(m[2] === 'movie' ? 'movie:' : 'tv:') + m[3]] = decodeEntities(m[1]);
  return out;
})();

// Mirrors window.mockLog (the mock site's record of clicks and player events) into Node, across navigations.
const MOCK_HOOK = `(function () {
  function hook() {
    var l = window.mockLog;
    if (!l || l.__e2e) return !!l;
    l.__e2e = true;
    var push = l.push;
    l.push = function () {
      for (var i = 0; i < arguments.length; i++) { try { window.__e2eMockEvent(String(arguments[i])); } catch (e) {} }
      return push.apply(l, arguments);
    };
    return true;
  }
  var n = 0, t = setInterval(function () { if (hook() || ++n > 400) clearInterval(t); }, 25);
  document.addEventListener('DOMContentLoaded', hook, false);
}());`;

const FOCUS_ATTRS = ['data-key', 'data-action', 'data-char', 'data-type', 'data-suggestion', 'data-query', 'data-episode', 'data-season', 'data-source-index'];

// ---------------------------------------------------------------------------------------------------------------
// Kit: open pages, read shell state, wait with descriptive failures, and drive focus with arrow keys only.

async function openApp(browser, origin, opts = {}) {
  const page = await H.openPage(browser, { twice: opts.twice, viewport: opts.viewport, ua: opts.ua, tv: opts.tv });
  page.origin = origin;
  page.mock = [];
  page.requests = [];
  page.allowErrors = opts.allowErrors || null;
  page.on('request', r => page.requests.push(r.url()));
  await page.exposeFunction('__e2eMockEvent', e => { page.mock.push(String(e)); });
  await page.context_.addInitScript({ content: MOCK_HOOK });
  if (opts.prefs) {
    await page.context_.addInitScript({ content: 'try { localStorage.setItem("mbptv:prefs:v1", ' + JSON.stringify(JSON.stringify(opts.prefs)) + '); } catch (e) {}' });
  }
  if (opts.path !== null) await page.goto(origin + (opts.path || '/'));
  return page;
}

async function closeApp(page) {
  try { await page.context_.close(); } catch (e) { /* already closed */ }
}

// A one-line snapshot of the shell for failure messages.
async function shellState(page) {
  try {
    return await page.evaluate(attrs => {
      const desc = el => {
        if (!el) return 'none';
        let s = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
        for (const n of attrs) if (el.hasAttribute(n)) s += '[' + n + '=' + el.getAttribute(n) + ']';
        return s + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) + '"';
      };
      const r = document.getElementById('mbptv');
      let st = null, log = [];
      try { const m = window.__mbptv; st = m && m.App && m.App.state ? m.App.state() : 'window.__mbptv.App.state unavailable'; } catch (e) { st = 'App.state() threw ' + e.message; }
      try {
        const m = window.__mbptv;
        const entries = m && m.Log && m.Log.entries ? m.Log.entries() : JSON.parse(localStorage.getItem('mbptv:log:v1') || '[]');
        log = entries.filter(e => e.level !== 'info').slice(-4).map(e => e.level + ' ' + e.label + ': ' + String(e.msg).slice(0, 140));
      } catch (e) { /* storage unavailable */ }
      return {
        url: location.pathname + location.search,
        htmlFlag: document.documentElement.getAttribute('data-mbptv'),
        shell: !!r,
        screen: r ? r.getAttribute('data-screen') : null,
        layer: r ? r.getAttribute('data-layer') : null,
        focused: desc(document.querySelector('#mbptv .is-focused, #mbptv-pill.is-focused')),
        active: desc(document.activeElement),
        appState: st,
        log
      };
    }, FOCUS_ATTRS);
  } catch (e) {
    return { unavailable: String(e.message || e).split('\n')[0] };
  }
}

async function fail(page, message) {
  const s = await shellState(page);
  const errs = page.errors && page.errors.length ? '\n  page errors: ' + page.errors.slice(0, 3).join(' | ').replace(/\s+/g, ' ').slice(0, 700) : '';
  throw new Error(message + '\n  shell: ' + JSON.stringify(s) + errs);
}

// Polls fn(arg) in the page until it returns something truthy. Fails fast when Boot has torn the shell down.
async function waitUntil(page, what, fn, arg, timeout = 8000) {
  const t0 = Date.now();
  for (;;) {
    let ok = null, failed = false;
    try { ok = await page.evaluate(fn, arg); } catch (e) { /* navigation in progress */ }
    if (ok) return ok;
    try { failed = await page.evaluate(() => document.documentElement.getAttribute('data-mbptv') === 'failed'); } catch (e) { /* navigating */ }
    if (failed) return fail(page, 'Waiting for ' + what + ': the shell failed to boot and removed itself (html[data-mbptv="failed"]).');
    if (Date.now() - t0 > timeout) return fail(page, 'Timed out after ' + timeout + ' ms waiting for ' + what + '.');
    await page.waitForTimeout(60);
  }
}

async function waitScreen(page, name, timeout = 10000) {
  return waitUntil(page, '#mbptv[data-screen="' + name + '"]', n => {
    const r = document.getElementById('mbptv');
    return !!r && r.getAttribute('data-screen') === n;
  }, name, timeout);
}

async function focusInfo(page) {
  return page.evaluate(attrs => {
    const el = document.querySelector('#mbptv .is-focused, #mbptv-pill.is-focused');
    if (!el) return null;
    const zoneEl = el.parentElement && el.parentElement.closest('[data-zone]') || el.closest('[data-zone]');
    const r = el.getBoundingClientRect();
    const out = {
      zone: zoneEl ? zoneEl.getAttribute('data-zone') : '',
      text: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      active: el === document.activeElement,
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      index: zoneEl ? Array.prototype.indexOf.call(zoneEl.querySelectorAll('[data-f]'), el) : -1
    };
    for (const n of attrs) out[n.replace(/^data-/, '').replace(/-(\w)/g, (m, c) => c.toUpperCase())] = el.getAttribute(n) || '';
    return out;
  }, FOCUS_ATTRS);
}

// Contract: the focused control has .is-focused AND is document.activeElement.
async function waitFocus(page, timeout = 5000) {
  await waitUntil(page, 'a focused control (.is-focused that is also document.activeElement)', () => {
    const el = document.querySelector('#mbptv .is-focused, #mbptv-pill.is-focused');
    return !!el && el === document.activeElement && el.isConnected;
  }, null, timeout);
  return focusInfo(page);
}

async function press(page, key, times = 1, delay = 90) {
  for (let i = 0; i < times; i++) { await page.keyboard.press(key); await page.waitForTimeout(delay); }
}

const back = page => press(page, 'Escape', 1, 150);

function navProbe({ sel, idx }) {
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const list = Array.prototype.filter.call(document.querySelectorAll(sel), shown);
  const t = idx < 0 ? list[list.length + idx] : list[idx];
  const f = document.querySelector('#mbptv .is-focused, #mbptv-pill.is-focused');
  const same = !!f && f === window.__e2ePrevFocus;
  window.__e2ePrevFocus = f;
  if (!t) return { missing: true, count: list.length };
  if (f && (f === t || t.contains(f))) return { done: true };
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
  const id = f ? (f.getAttribute('data-key') || f.getAttribute('data-action') || f.getAttribute('data-char') || f.getAttribute('data-episode') ||
    f.getAttribute('data-source-index') || f.getAttribute('data-type') || f.tagName.toLowerCase() + ':' + (f.textContent || '').trim().slice(0, 20)) : '';
  return { f: f ? box(f) : null, t: box(t), same, id };
}

// Moves focus onto the target using arrow keys only, steering by on-screen geometry. target: selector or {selector, index} (index -1 = last).
async function navigateTo(page, target, opts = {}) {
  const sel = typeof target === 'string' ? target : target.selector;
  const idx = typeof target === 'string' ? 0 : (target.index || 0);
  const max = opts.max || 70;
  const label = sel + (idx ? ' #' + idx : '');
  let blocked = new Set(), lastDir = null, missingSince = 0, noFocusSince = 0;
  const visits = {};
  for (let step = 0; step < max; step++) {
    const s = await page.evaluate(navProbe, { sel, idx });
    if (s.done) return focusInfo(page);
    if (s.missing) {
      missingSince = missingSince || Date.now();
      if (Date.now() - missingSince > (opts.appearTimeout || 5000)) return fail(page, 'Cannot navigate to ' + label + ': no visible element matches it (' + s.count + ' visible matches).');
      await page.waitForTimeout(120); lastDir = null; step--; continue;
    }
    if (!s.f) {
      noFocusSince = noFocusSince || Date.now();
      if (Date.now() - noFocusSince > 3000) return fail(page, 'Cannot navigate to ' + label + ': nothing in the shell is focused.');
      await page.waitForTimeout(120); lastDir = null; step--; continue;
    }
    if (lastDir) { if (s.same) blocked.add(lastDir); else blocked = new Set(); }
    const posKey = s.id + '@' + Math.round(s.f.x / 20) + ',' + Math.round(s.f.y / 20);
    visits[posKey] = (visits[posKey] || 0) + (s.same ? 0 : 1);
    if (visits[posKey] > 4) return fail(page, 'Cannot navigate to ' + label + ': focus keeps returning to ' + s.id + ' (arrow navigation oscillates).');
    const dx = s.t.x - s.f.x, dy = s.t.y - s.f.y;
    const v = dy < 0 ? 'ArrowUp' : 'ArrowDown', h = dx < 0 ? 'ArrowLeft' : 'ArrowRight';
    const needV = Math.abs(dy) > Math.max(8, Math.min(s.f.h, s.t.h) / 2);
    const needH = Math.abs(dx) > Math.max(8, Math.min(s.f.w, s.t.w) / 2);
    // Take the axis with more "steps" (distance in element sizes) first; on a revisit, try the other axis first.
    const stepsH = Math.abs(dx) / Math.max(20, Math.min(s.f.w, s.t.w)), stepsV = Math.abs(dy) / Math.max(20, Math.min(s.f.h, s.t.h));
    let order = needV && needH ? (stepsH >= stepsV ? [h, v] : [v, h]) : needV ? [v] : needH ? [h] : [h, v];
    if (visits[posKey] >= 2) order = order.slice().reverse();
    for (const d of [v, h]) if (order.indexOf(d) < 0) order.push(d);
    const dir = order.find(d => !blocked.has(d));
    if (!dir) return fail(page, 'Cannot navigate to ' + label + ': focus is stuck on ' + s.id + ' (no arrow key moves it closer).');
    await page.keyboard.press(dir);
    lastDir = dir;
    await page.waitForTimeout(opts.delay || 90);
  }
  return fail(page, 'Cannot navigate to ' + label + ' within ' + max + ' arrow presses.');
}

async function activate(page, target, opts) {
  const f = await navigateTo(page, target, opts);
  await press(page, 'Enter', 1, 150);
  return f;
}

async function queryText(page) {
  return page.evaluate(() => { const q = document.getElementById('mbptv-query'); return q ? (q.innerText || q.textContent || '').trim().toLowerCase() : null; });
}

async function typeOnScreen(page, word) {
  for (const ch of word.toLowerCase()) await activate(page, ch === ' ' ? '[data-action="space"]' : '[data-char="' + ch + '"]');
  return queryText(page);
}

// A large, visible text element outside cards/rows/rail/grid whose text is exactly the title (hero or detail heading).
function headingShows(title) {
  const want = String(title).trim().replace(/\s+/g, ' ').toLowerCase();
  const root = document.getElementById('mbptv');
  if (!root) return false;
  const all = root.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if ((el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase() !== want) continue;
    if (el.closest('[data-key], [data-zone="rail"], [data-zone^="row:"], [data-zone="grid"], [data-f]')) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (parseFloat(cs.fontSize) >= 32 && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && cs.visibility !== 'hidden' && +cs.opacity > 0) return true;
  }
  return false;
}

async function cardKeys(page, scope) {
  return page.evaluate(s => Array.prototype.map.call(document.querySelectorAll('#mbptv ' + s + ' [data-key]'), e => e.getAttribute('data-key')), scope || '');
}

async function snap(page, file) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); await page.screenshot({ path: file }); return file; } catch (e) { return ''; }
}

function unexpectedErrors(page) {
  return (page.errors || []).filter(e => !(page.allowErrors && page.allowErrors.test(e)));
}

const kit = { openApp, closeApp, shellState, fail, waitUntil, waitScreen, focusInfo, waitFocus, press, back, navigateTo, activate, queryText, typeOnScreen, headingShows, cardKeys, snap, HOME_TITLES, PKG };

// ---------------------------------------------------------------------------------------------------------------

async function main() {
  const filters = process.argv.slice(2).map(s => s.toLowerCase());
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  for (const f of fs.readdirSync(ARTIFACTS)) if (/^app-FAIL-.*\.png$/.test(f)) fs.unlinkSync(path.join(ARTIFACTS, f));
  const site = await H.mockSite.start();
  const browser = await H.launch();
  const O = site.origin;
  const { test, run } = H.makeRunner('app');

  function flow(title, opts, fn) {
    if (filters.length && !filters.some(f => title.toLowerCase().indexOf(f) >= 0)) return;
    test(title, async () => {
      const page = await openApp(browser, O, opts);
      try {
        await fn(page);
        await page.waitForTimeout(100);
        const errs = unexpectedErrors(page);
        if (errs.length) await fail(page, 'Uncaught page errors or Log.error output during the flow:\n    ' + errs.slice(0, 4).join('\n    '));
      } catch (e) {
        const file = await snap(page, path.join(ARTIFACTS, 'app-FAIL-' + title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 70) + '.png'));
        if (file) e.message += '\n  screenshot: ' + path.relative(ROOT, file);
        throw e;
      } finally {
        await closeApp(page);
      }
    });
  }

  const notMatching = (keys, re) => keys.filter(k => !re.test(k));

  // ---- Boot and home -------------------------------------------------------------------------------------------

  flow('boot on / shows data-screen=home with a focused control and exposes window.__mbptv', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    const info = await page.evaluate(() => {
      const m = window.__mbptv;
      let st = null;
      try { st = m && m.App && m.App.state(); } catch (e) { st = { threw: String(e) }; }
      return { version: m && m.version, has: m ? ['App', 'Site', 'Api', 'Log', 'U'].filter(k => !m[k]) : null, state: st, roots: document.querySelectorAll('#mbptv').length };
    });
    if (info.version !== PKG.version) await fail(page, 'window.__mbptv.version should be "' + PKG.version + '", got ' + JSON.stringify(info.version));
    if (!info.has || info.has.length) await fail(page, 'window.__mbptv is missing: ' + JSON.stringify(info.has));
    if (!info.state || info.state.screen !== 'home' || !Array.isArray(info.state.stack)) await fail(page, 'App.state() should be {screen: "home", stack: [...], focusKey}, got ' + JSON.stringify(info.state));
    if (info.roots !== 1) await fail(page, 'expected exactly one #mbptv, got ' + info.roots);
  });

  flow('home renders rows of [data-key] title cards from the page, including movie:40102', {}, async page => {
    await waitScreen(page, 'home');
    const r = await waitUntil(page, 'at least 3 [data-zone^="row:"] rows holding [data-key] cards', () => {
      const rows = document.querySelectorAll('#mbptv [data-zone^="row:"]');
      const inRows = document.querySelectorAll('#mbptv [data-zone^="row:"] [data-key]');
      return rows.length >= 3 && inRows.length >= 8 ? { rows: rows.length, keys: Array.prototype.map.call(inRows, e => e.getAttribute('data-key')), text: document.getElementById('mbptv').textContent } : null;
    });
    for (const k of ['movie:40102', 'tv:705', 'movie:1831', 'tv:556', 'movie:41635']) {
      if (r.keys.indexOf(k) < 0) await fail(page, 'expected a card [data-key="' + k + '"] from the home fixture; row cards: ' + r.keys.join(', '));
    }
    const bad = notMatching(r.keys, /^(movie|tv):\d+$/);
    if (bad.length) await fail(page, 'card keys must be kind:id, got ' + bad.join(', '));
    for (const t of ['Waiting to Watch', "Today's Hot Movies", "Today's Hot TV Shows"]) {
      if (r.text.indexOf(t) < 0) await fail(page, 'expected the row title "' + t + '" (from .section h3)');
    }
    if (/Today's Hot MoviesMore/.test(r.text)) await fail(page, 'row titles must drop the h3 "More" link text');
  });

  flow('arrow keys move focus between cards and rows; Up restores the row position; Left at index 0 reaches the rail', {}, async page => {
    await waitScreen(page, 'home');
    let f = await waitFocus(page);
    for (let i = 0; i < 8 && !(f && f.key && /^row:/.test(f.zone)); i++) { await press(page, 'ArrowDown'); f = await focusInfo(page); }
    if (!f || !f.key || !/^row:/.test(f.zone)) await fail(page, 'ArrowDown never focused a [data-key] card inside a [data-zone^="row:"] zone');
    const first = f;
    await press(page, 'ArrowRight');
    const second = await focusInfo(page);
    if (!second || second.key === first.key || second.zone !== first.zone) await fail(page, 'ArrowRight should move to the next card in ' + first.zone + ' (was ' + first.key + ', now ' + JSON.stringify(second) + ')');
    if (!second.active) await fail(page, 'the .is-focused card must also be document.activeElement');
    await press(page, 'ArrowDown');
    const third = await focusInfo(page);
    if (!third || !third.key || third.zone === second.zone) await fail(page, 'ArrowDown should move to a card in the next row (was ' + second.zone + ', now ' + JSON.stringify(third) + ')');
    await press(page, 'ArrowUp');
    const again = await focusInfo(page);
    if (!again || again.key !== second.key) await fail(page, 'ArrowUp should restore the remembered card ' + second.key + ' in ' + second.zone + ', got ' + JSON.stringify(again && again.key));
    let rail = null;
    for (let i = 0; i < 20; i++) {
      await press(page, 'ArrowLeft');
      const g = await focusInfo(page);
      if (g && /^nav-/.test(g.action)) { rail = g; break; }
    }
    if (!rail) await fail(page, 'ArrowLeft from the first card should reach a rail [data-action^="nav-"] control');
    if (rail.zone !== 'rail') await fail(page, 'rail controls must live in [data-zone="rail"], got ' + rail.zone);
  });

  flow('hero shows the focused title and follows focus', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await navigateTo(page, '[data-key="movie:81314"]');
    await waitUntil(page, 'the hero heading "' + HOME_TITLES['movie:81314'] + '" (large text outside the rows)', headingShows, HOME_TITLES['movie:81314'], 3000);
    await press(page, 'ArrowRight');
    const f = await focusInfo(page);
    const title = HOME_TITLES[f && f.key];
    if (!title) await fail(page, 'ArrowRight should focus another home card with a known title, got ' + JSON.stringify(f));
    await waitUntil(page, 'the hero heading to follow focus to "' + title + '"', headingShows, title, 3000);
  });

  flow('Back at the home root opens the exit dialog with Stay focused; Back and Stay both close it', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    const dialogOpen = () => {
      const r = document.getElementById('mbptv'), d = document.querySelector('#mbptv [data-dialog="exit"]');
      const f = document.querySelector('#mbptv .is-focused');
      return !!(r && d && d.getBoundingClientRect().height > 0 && r.getAttribute('data-layer') === 'dialog' && f && f.getAttribute('data-action') === 'stay' && d.contains(f) && f === document.activeElement && d.querySelector('[data-action="exit"]'));
    };
    const dialogClosed = () => {
      const r = document.getElementById('mbptv'), d = document.querySelector('#mbptv [data-dialog="exit"]');
      return !!(r && r.getAttribute('data-screen') === 'home' && !(r.getAttribute('data-layer') || '') && (!d || d.getBoundingClientRect().height === 0));
    };
    await back(page);
    await waitUntil(page, '[data-dialog="exit"] with [data-action="stay"] focused, [data-action="exit"] beside it and data-layer="dialog"', dialogOpen, null, 3000);
    await back(page);
    await waitUntil(page, 'Back to close the exit dialog (data-layer="" and screen still home)', dialogClosed, null, 3000);
    await back(page);
    await waitUntil(page, 'the exit dialog to reopen', dialogOpen, null, 3000);
    await press(page, 'Enter', 1, 150);
    await waitUntil(page, 'OK on Stay to close the exit dialog', dialogClosed, null, 3000);
    await waitFocus(page);
  });

  flow('double injection (tv.js evaluated twice) gives one shell and single-step key handling', { twice: true }, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    const counts = await page.evaluate(() => ({ roots: document.querySelectorAll('#mbptv').length, css: document.querySelectorAll('style#mbptv-css').length }));
    if (counts.roots !== 1 || counts.css !== 1) await fail(page, 'expected one #mbptv and one style#mbptv-css, got ' + JSON.stringify(counts));
    let f = await focusInfo(page);
    for (let i = 0; i < 8 && !(f && f.key && /^row:/.test(f.zone)); i++) { await press(page, 'ArrowDown'); f = await focusInfo(page); }
    if (!f || !f.key) await fail(page, 'ArrowDown never focused a row card');
    await press(page, 'ArrowRight', 1, 250);
    const g = await focusInfo(page);
    if (!g || g.zone !== f.zone || g.index !== f.index + 1) await fail(page, 'one ArrowRight should move exactly one card (index ' + f.index + ' -> ' + (f.index + 1) + '), got index ' + (g && g.index) + ' in ' + (g && g.zone) + '; two copies may be handling keys');
    await back(page);
    await waitUntil(page, 'exactly one [data-dialog="exit"] after Back', () => document.querySelectorAll('[data-dialog="exit"]').length === 1, null, 3000);
  });

  flow('watchdog re-focuses the screen when focus is lost or the focused element is detached', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); document.body.focus(); });
    await waitUntil(page, 'the watchdog (every 2 s) to restore DOM focus after blur (the .is-focused control must be document.activeElement, or remote keys go elsewhere)', () => {
      const el = document.querySelector('#mbptv .is-focused');
      return !!el && el === document.activeElement;
    }, null, 4500);
    await page.evaluate(() => { const el = document.querySelector('#mbptv .is-focused'); if (el && el.parentNode) el.parentNode.removeChild(el); });
    await waitUntil(page, 'the watchdog to focus a connected element after the focused one was detached', () => {
      const el = document.activeElement;
      return !!el && el.isConnected && !!el.closest('#mbptv') && el.classList.contains('is-focused');
    }, null, 4500);
  });

  // ---- Search ----------------------------------------------------------------------------------------------------

  async function openSearch(page) {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-action="nav-search"]');
    await waitScreen(page, 'search');
    await waitFocus(page);
  }

  flow('rail opens Search; empty query shows Recent and Trending chips; the on-screen keyboard types into #mbptv-query', {}, async page => {
    await openSearch(page);
    const kb = await page.evaluate(() => ({
      chars: document.querySelectorAll('#mbptv [data-char]').length,
      specials: ['space', 'delete', 'clear', 'search-submit'].filter(a => !document.querySelector('#mbptv [data-action="' + a + '"]')),
      query: !!document.getElementById('mbptv-query')
    }));
    if (kb.chars < 36 || kb.specials.length || !kb.query) await fail(page, 'search needs 36 [data-char] keys (a-z, 0-9), Space/Delete/Clear/Search actions and #mbptv-query; got ' + JSON.stringify(kb));
    const chips = await waitUntil(page, '[data-query] chips for recent (server "batman") and trending ("Resident Evil") searches', () => {
      const q = Array.prototype.map.call(document.querySelectorAll('#mbptv [data-query]'), e => (e.getAttribute('data-query') || e.textContent || '').trim());
      return q.some(x => /^batman$/i.test(x)) && q.some(x => /^resident evil$/i.test(x)) ? q : null;
    }, null, 5000);
    if (!chips.length) await fail(page, 'no chips');
    const q = await typeOnScreen(page, 'bat');
    if (q === null || q.indexOf('bat') < 0) await fail(page, '#mbptv-query should read "bat" after typing b, a, t on the keyboard; got ' + JSON.stringify(q));
    await activate(page, '[data-action="delete"]');
    const q2 = await queryText(page);
    if (q2.indexOf('bat') >= 0 || q2.indexOf('ba') < 0) await fail(page, 'Delete should remove the last character ("ba"), got ' + JSON.stringify(q2));
    await activate(page, '[data-action="clear"]');
    const q3 = await queryText(page);
    if (q3.indexOf('ba') >= 0) await fail(page, 'Clear should empty the query, got ' + JSON.stringify(q3));
  });

  flow('typing shows debounced live suggestions without fetching results; OK on a suggestion runs that search', {}, async page => {
    await openSearch(page);
    page.requests.length = 0;
    await page.keyboard.type('bat', { delay: 60 });
    const sugg = await waitUntil(page, '[data-suggestion] rows after typing "bat" (350 ms debounce)', () => {
      const s = Array.prototype.map.call(document.querySelectorAll('#mbptv [data-suggestion]'), e => (e.getAttribute('data-suggestion') || e.textContent).trim());
      return s.length ? s : null;
    }, null, 4000);
    if (sugg.length > 6) await fail(page, 'at most 6 suggestions should show, got ' + sugg.length);
    if (sugg.some(s => !/ba/i.test(s))) await fail(page, 'suggestions should come from /index/search/autocomplate for "bat": ' + sugg.join(' | '));
    await page.waitForTimeout(500);
    const auto = page.requests.filter(u => /\/index\/search\/autocomplate\?/.test(u));
    if (!auto.length) await fail(page, 'expected a request to /index/search/autocomplate');
    if (auto.length > 2) await fail(page, 'suggestions must be debounced: ' + auto.length + ' autocomplete requests for 3 quick keystrokes:\n    ' + auto.join('\n    '));
    if (!/[?&]q=bat(&|$)/.test(auto[auto.length - 1])) await fail(page, 'the last autocomplete request should be for "bat": ' + auto[auto.length - 1]);
    const results = page.requests.filter(u => /\/index\/search\?/.test(u));
    if (results.length) await fail(page, 'typing must not fetch /index/search (each fetch is saved to the server-side search history): ' + results.join(', '));
    const q = await queryText(page);
    if (q.indexOf('bat') < 0) await fail(page, 'a physical keyboard should type into #mbptv-query, got ' + JSON.stringify(q));
    const f = await activate(page, '[data-suggestion]');
    const chosen = [f.suggestion, f.text].map(s => (s || '').trim().toLowerCase()).filter(Boolean);
    await waitUntil(page, 'result cards in [data-zone="grid"] after OK on the suggestion "' + chosen + '"', () => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length > 0, null, 8000);
    const fetched = page.requests.filter(u => /\/index\/search\?/.test(u));
    const words = fetched.map(u => (new URL(u).searchParams.get('word') || '').trim().toLowerCase());
    if (!words.some(w => chosen.indexOf(w) >= 0)) await fail(page, 'OK on a suggestion should search for it (' + JSON.stringify(chosen) + '); /index/search requests: ' + fetched.join(', '));
  });

  flow('Search (search-submit) shows result cards; the TV Shows tab filters to tv: keys', {}, async page => {
    await openSearch(page);
    await typeOnScreen(page, 'bat');
    page.requests.length = 0;
    await activate(page, '[data-action="search-submit"]');
    const keys = await waitUntil(page, 'result cards in [data-zone="grid"]', () => {
      const k = Array.prototype.map.call(document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]'), e => e.getAttribute('data-key'));
      return k.length ? k : null;
    }, null, 8000);
    if (!keys.some(k => /^movie:/.test(k)) || !keys.some(k => /^tv:/.test(k))) await fail(page, 'the All tab should show movies and shows, got ' + keys.join(', '));
    const searches = page.requests.filter(u => /\/index\/search\?/.test(u));
    if (searches.length !== 1 || !/word=bat/.test(searches[0])) await fail(page, 'one explicit submit should fetch /index/search?word=bat exactly once, got ' + JSON.stringify(searches));
    const tabs = await page.evaluate(() => ['all', 'movie', 'tv'].filter(t => !document.querySelector('#mbptv [data-type="' + t + '"]')));
    if (tabs.length) await fail(page, 'missing type tabs: ' + tabs.map(t => '[data-type="' + t + '"]').join(', '));
    await activate(page, '[data-type="tv"]');
    const tv = await waitUntil(page, 'only tv: cards after choosing the TV Shows tab', () => {
      const k = Array.prototype.map.call(document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]'), e => e.getAttribute('data-key'));
      return k.length && k.every(x => /^tv:/.test(x)) ? k : null;
    }, null, 8000);
    if (!page.requests.some(u => /\/index\/search\?.*type=tv/.test(u))) await fail(page, 'the TV tab should fetch type=tv; got ' + tv.join(','));
  });

  flow('search results page in more cards when focus reaches the last row', {}, async page => {
    await openSearch(page);
    await page.keyboard.type('bat', { delay: 40 });
    await activate(page, '[data-action="search-submit"]');
    const n0 = (await waitUntil(page, 'result cards', () => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length, null, 8000));
    await navigateTo(page, { selector: '#mbptv [data-zone="grid"] [data-key]', index: -1 });
    const n1 = await waitUntil(page, 'more than ' + n0 + ' cards after reaching the last row (page 2)', n => {
      const c = document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length;
      return c > n ? c : 0;
    }, n0, 8000);
    const keys = await cardKeys(page, '[data-zone="grid"]');
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length) await fail(page, 'paging must not duplicate cards: ' + dupes.join(', '));
    if (!page.requests.some(u => /\/index\/search\?.*page=2/.test(u))) await fail(page, 'expected a page=2 request (' + n0 + ' -> ' + n1 + ' cards)');
  });

  flow('an empty search shows an empty state with Open website, never a blank screen', {}, async page => {
    await openSearch(page);
    await page.keyboard.type('zzq', { delay: 40 });
    await activate(page, '[data-action="search-submit"]');
    await waitUntil(page, 'a visible [data-action="open-website"] in the empty state', () => {
      const b = document.querySelector('#mbptv [data-action="open-website"]');
      return !!b && b.getBoundingClientRect().height > 0;
    }, null, 8000);
    const keys = await cardKeys(page, '[data-zone="grid"]');
    if (keys.length) await fail(page, 'no result cards expected for "zzq", got ' + keys.join(', '));
  });

  // ---- Detail and playback ---------------------------------------------------------------------------------------

  flow('Enter on a movie card opens detail without reloading the page; Back restores home focus', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await page.evaluate(() => { window.__e2eNoReload = 1; });
    await activate(page, '[data-key="movie:40102"]');
    await waitScreen(page, 'detail');
    await waitUntil(page, 'the detail heading "The Batman"', headingShows, 'The Batman', 8000);
    await waitFocus(page);
    const d = await page.evaluate(() => ({ same: window.__e2eNoReload === 1, play: !!document.querySelector('#mbptv [data-action="play"]'), url: location.pathname }));
    if (!d.same) await fail(page, 'opening detail must not reload the page (screens render from fetched documents)');
    if (!d.play) await fail(page, 'movie detail needs a [data-action="play"] button');
    await back(page);
    await waitScreen(page, 'home');
    const f = await waitFocus(page);
    if (f.key !== 'movie:40102') await fail(page, 'Back should restore focus to movie:40102, got ' + JSON.stringify(f.key));
  });

  // The website's own player (Settings > Built-in player off, and the built-in player's fallback).
  flow('website player: Play with quality "ask" opens [data-sheet=sources] with 2 rows; choosing one plays; Back returns to detail', { prefs: { quality: 'ask', nativePlayer: false } }, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-key="movie:40102"]');
    await waitScreen(page, 'detail');
    await activate(page, '[data-action="play"]');
    const rows = await waitUntil(page, '[data-sheet="sources"] with [data-source-index] rows (directly or after navigating to ?play=1)', () => {
      const s = document.querySelector('#mbptv [data-sheet="sources"]');
      const r = s ? s.querySelectorAll('[data-source-index]') : [];
      return s && s.getBoundingClientRect().width > 0 && r.length ? r.length : 0;
    }, null, 15000);
    if (rows !== 2) await fail(page, 'The Batman has 2 sources (1080p, 4K); the sheet shows ' + rows);
    const f = await waitFocus(page);
    const layer = await page.evaluate(() => document.getElementById('mbptv').getAttribute('data-layer'));
    if (f.sourceIndex === '' || layer !== 'sheet') await fail(page, 'a source row should be focused with data-layer="sheet"; focused ' + JSON.stringify(f) + ', layer ' + layer);
    await press(page, 'Enter', 1, 200);
    await waitUntil(page, 'data-screen="player" after choosing a source', () => { const r = document.getElementById('mbptv'); return !!r && r.getAttribute('data-screen') === 'player'; }, null, 10000);
    if (!page.mock.some(e => /^player:\/index\/index\/player\?mfid=/.test(e))) await fail(page, 'the website player should have opened (mockLog "player:..."), mockLog: ' + page.mock.join(', '));
    await page.waitForTimeout(400);
    await back(page);
    const t0 = Date.now();
    while (!page.mock.includes('player:closed') && Date.now() - t0 < 8000) await page.waitForTimeout(100);
    if (!page.mock.includes('player:closed')) await fail(page, 'Back in the player should close it via #dialog_close (mockLog "player:closed"); mockLog: ' + page.mock.join(', '));
    await waitScreen(page, 'detail', 15000);
    await waitUntil(page, 'the detail heading "The Batman" after returning from the player', headingShows, 'The Batman', 8000);
  });

  flow('website player: preferred quality "best" auto-selects 4K; Right seeks +10 s with the OSD; OK pauses; Back returns to detail', { prefs: { nativePlayer: false } }, async page => {
    await page.goto(O + '/movie/40102?play=1');
    await waitUntil(page, 'data-screen="player" (default quality "best" auto-selects within 400 ms of the sheet)', () => { const r = document.getElementById('mbptv'); return !!r && r.getAttribute('data-screen') === 'player'; }, null, 15000);
    const opened = page.mock.filter(e => /^player:\//.test(e));
    if (!opened.length || !/mfid=2215085/.test(opened[0])) await fail(page, '"best" should pick the 4K source (mfid=2215085); player opened with: ' + JSON.stringify(opened));
    const video = () => { const v = document.querySelector('#my_dialog video'); return v ? { t: v.currentTime, paused: v.paused } : null; };
    await waitUntil(page, 'the website video element', video, null, 5000);
    const before = await page.evaluate(video);
    await press(page, 'ArrowRight', 1, 150);
    await waitUntil(page, '#mbptv-osd.is-visible after ArrowRight', () => { const o = document.getElementById('mbptv-osd'); return !!o && o.classList.contains('is-visible'); }, null, 2000);
    await waitUntil(page, 'currentTime to advance by about 10 s after ArrowRight (was ' + before.t.toFixed(1) + ')', t => { const v = document.querySelector('#my_dialog video'); return !!v && v.currentTime >= t + 7; }, before.t, 3000);
    await waitUntil(page, 'the OSD to auto-hide (about 3 s)', () => { const o = document.getElementById('mbptv-osd'); return !o || !o.classList.contains('is-visible'); }, null, 6500);
    const wasPaused = await page.evaluate(() => document.querySelector('#my_dialog video').paused);
    await press(page, 'Enter', 1, 250);
    await waitUntil(page, 'OK to toggle play/pause (video was ' + (wasPaused ? 'paused' : 'playing') + ')', p => { const v = document.querySelector('#my_dialog video'); return !!v && v.paused !== p; }, wasPaused, 2000);
    await back(page);
    const t0 = Date.now();
    while (!page.mock.includes('player:closed') && Date.now() - t0 < 8000) await page.waitForTimeout(100);
    if (!page.mock.includes('player:closed')) await fail(page, 'Back should close the website player (mockLog "player:closed"); mockLog: ' + page.mock.join(', '));
    await waitScreen(page, 'detail', 12000);
  });

  flow('TV show detail lists [data-season] pills and [data-episode] items; Enter on an episode starts playback', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-key="tv:556"]');
    await waitScreen(page, 'detail');
    const d = await waitUntil(page, '[data-episode] items and [data-season] pills', () => {
      const e = Array.prototype.map.call(document.querySelectorAll('#mbptv [data-episode]'), x => x.getAttribute('data-episode'));
      const s = Array.prototype.map.call(document.querySelectorAll('#mbptv [data-season]'), x => x.getAttribute('data-season'));
      return e.length && s.length ? { e, s } : null;
    }, null, 10000);
    for (const k of ['2x1', '2x2', '2x3']) if (d.e.indexOf(k) < 0) await fail(page, 'expected [data-episode="' + k + '"], got ' + d.e.join(', '));
    for (const k of ['1', '2', '5']) if (d.s.indexOf(k) < 0) await fail(page, 'expected [data-season="' + k + '"], got ' + d.s.join(', '));
    await activate(page, '[data-episode="2x1"]');
    const t0 = Date.now();
    let ok = false;
    while (!ok && Date.now() - t0 < 15000) {
      ok = page.mock.some(e => /^click:episode:2x1$|^player:\//.test(e)) ||
        await page.evaluate(() => { const r = document.getElementById('mbptv'); return !!r && r.getAttribute('data-screen') === 'player'; }).catch(() => false);
      if (!ok) await page.waitForTimeout(150);
    }
    if (!ok) await fail(page, 'Enter on episode 2x1 should start playback (mockLog "click:episode:2x1" or "player:..."); mockLog: ' + page.mock.join(', '));
  });

  // ---- Built-in player (docs/PLAYER.md "Integration") -------------------------------------------------------------
  // Streams come from tools/mock-extra.cjs: the AUTO HLS link fails (404), the ORG "MP4" is a silent WAV of mbp_len
  // seconds; tv_file answers any episode; progress posts are recorded at /__mock/progress-log.

  const nativeState = page => page.evaluate(() => {
    const m = window.__mbptv, p = document.getElementById('mbptv-player'), np = m.App.nativePlayer && m.App.nativePlayer(), info = np ? np.info() : null;
    return { mode: m.App.state().mode, screen: m.App.state().screen, player: p ? p.getAttribute('data-state') : '', info, url: location.pathname + location.search };
  });
  const waitNativePlaying = (page, what, timeout = 20000) => waitUntil(page, what || '#mbptv-player[data-state="playing"] with its video advancing', () => {
    const p = document.getElementById('mbptv-player'), v = p && p.querySelector('video');
    return !!p && p.getAttribute('data-state') === 'playing' && !!v && v.currentTime > 0.3 && !v.paused;
  }, null, timeout);
  const nProgress = async page => page.evaluate(() => fetch('/__mock/progress-log').then(r => r.json()));
  const nReset = async page => page.evaluate(() => Promise.all([fetch('/__mock/progress-log?reset=1'), fetch('/__mock/player-log?reset=1')]));
  const nCookies = async (page, map) => page.context_.addCookies(Object.keys(map).map(name => ({ name, value: String(map[name]), url: O + '/' })));

  flow('built-in player: movie Play opens #mbptv-player in place, plays, posts progress to movie_progress; Back returns to detail on Play', {}, async page => {
    await nReset(page);
    await waitScreen(page, 'home');
    await waitFocus(page);
    await page.evaluate(() => { window.__e2eNoReload = 1; });
    await activate(page, '[data-key="movie:40102"]');
    await waitScreen(page, 'detail');
    await waitUntil(page, 'the detail heading "The Batman"', headingShows, 'The Batman', 8000);
    await activate(page, '[data-action="play"]');
    await waitUntil(page, '#mbptv-player (the built-in player) to open', () => !!document.getElementById('mbptv-player'), null, 4000);
    await waitNativePlaying(page);
    const st = await nativeState(page);
    if (st.mode !== 'player' || st.screen !== 'player') await fail(page, 'the App should be in player mode (data-screen=player) while the built-in player is up, got ' + JSON.stringify(st));
    if (!st.info || st.info.kind !== 'movie' || st.info.id !== '40102' || st.info.label !== 'ORG' || st.info.stream !== 'mp4') await fail(page, 'expected movie:40102 on the ORG stream (the AUTO HLS link fails first), got ' + JSON.stringify(st.info));
    if (!(await page.evaluate(() => window.__e2eNoReload === 1)) || /play=1/.test(st.url) || page.requests.some(u => /[?&]play=1/.test(u))) await fail(page, 'the built-in player must not navigate to a ?play=1 page: ' + st.url);
    await page.waitForTimeout(1300);
    await back(page);
    await waitScreen(page, 'detail', 5000);
    const f = await waitFocus(page);
    if (f.action !== 'play') await fail(page, 'Back from the player should focus Play on the detail screen, got ' + JSON.stringify(f));
    const after = await nativeState(page);
    if (after.mode !== 'shell' || after.player || after.info) await fail(page, 'the player should be gone and the App back in shell mode, got ' + JSON.stringify(after));
    const posts = await waitUntil(page, 'a progress post for the movie', () => fetch('/__mock/progress-log').then(r => r.json()).then(l => l.filter(e => e.path === '/index/index/movie_progress').length ? l : null), null, 5000);
    const last = posts.filter(e => e.path === '/index/index/movie_progress').pop();
    if (last.body.type !== 'movie' || last.body.mid !== '40102' || !(+last.body.seconds >= 1) || !/^[01]$/.test(last.body.over) || last.xrw !== 'XMLHttpRequest' || last.method !== 'POST') {
      await fail(page, 'progress should be the site\'s own form post {type: movie, mid, seconds, over, mp4_id}, got ' + JSON.stringify(last));
    }
    await page.waitForTimeout(2300);
    const later = await nativeState(page);
    if (later.mode !== 'shell' || later.screen !== 'detail') await fail(page, 'nothing may take over after the player closed, got ' + JSON.stringify(later));
  });

  flow('built-in player: an episode plays; Up Next loads the next one in the same player; Back focuses that episode on the detail screen', {}, async page => {
    await nCookies(page, { mbp_len: 40 });
    await nReset(page);
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-key="tv:556"]');
    await waitScreen(page, 'detail');
    await waitUntil(page, '[data-episode="2x1"] on the detail screen', () => !!document.querySelector('#mbptv [data-episode="2x1"]'), null, 10000);
    await activate(page, '[data-episode="2x1"]');
    await waitNativePlaying(page);
    let st = await nativeState(page);
    if (!st.info || st.info.kind !== 'tv' || st.info.season !== 2 || st.info.episode !== 1) await fail(page, 'the player should play S2E1, got ' + JSON.stringify(st.info));
    await page.evaluate(() => window.__mbptv.App.nativePlayer().configure({ upNextCount: 2 }));
    // Jump to the credits: Up Next shows 25 s before the end.
    await page.evaluate(() => { const v = document.querySelector('#mbptv-player video'); v.currentTime = Math.max(0, v.duration - 18); });
    await waitUntil(page, 'the Up Next card ([data-upnext] with #mbptv-player.is-upnext)', () => {
      const p = document.getElementById('mbptv-player');
      return !!p && p.classList.contains('is-upnext') && /Next episode in/.test(p.querySelector('[data-upnext]').textContent);
    }, null, 6000);
    await waitUntil(page, 'the countdown to play S2E2 in the same player', () => {
      const i = window.__mbptv.App.nativePlayer().info();
      return !!i && i.season === 2 && i.episode === 2;
    }, null, 8000);
    await waitNativePlaying(page, 'S2E2 playing');
    const posts = await nProgress(page);
    const ep1 = posts.filter(e => e.path === '/index/index/tv_progress' && e.body.episode === '1').pop();
    if (!ep1 || ep1.body.over !== '1' || ep1.body.tid !== '556' || ep1.body.season !== '2') await fail(page, 'moving on from Up Next saves S2E1 as watched (over=1), got ' + JSON.stringify(posts.map(p => p.body)));
    await page.waitForTimeout(600);
    await back(page);
    await waitScreen(page, 'detail', 5000);
    const f = await waitFocus(page);
    if (f.episode !== '2x2') await fail(page, 'Back should land on the episode that played last ([data-episode="2x2"]), got ' + JSON.stringify(f));
    st = await nativeState(page);
    if (st.mode !== 'shell' || st.player) await fail(page, 'the player should be closed, got ' + JSON.stringify(st));
  });

  flow('built-in player: with Autoplay next episode off, Up Next waits for the viewer (no countdown)', { prefs: { autoplayEpisodes: false } }, async page => {
    await nCookies(page, { mbp_len: 40 });
    await page.goto(O + '/tvshow/556?season=2&episode=1&play=1');
    await waitNativePlaying(page);
    await page.evaluate(() => window.__mbptv.App.nativePlayer().configure({ upNextCount: 2 }));
    await page.evaluate(() => { const v = document.querySelector('#mbptv-player video'); v.currentTime = Math.max(0, v.duration - 18); });
    await waitUntil(page, 'the Up Next card without a countdown ("Up next")', () => {
      const p = document.getElementById('mbptv-player');
      return !!p && p.classList.contains('is-upnext') && /Up next/.test(p.querySelector('[data-upnext]').textContent);
    }, null, 6000);
    await page.waitForTimeout(3000);
    const i = await page.evaluate(() => window.__mbptv.App.nativePlayer().info());
    if (!i || i.episode !== 1) await fail(page, 'with autoplay off the next episode must wait for the viewer, got ' + JSON.stringify(i));
    await press(page, 'Enter', 1, 200); // Play now
    await waitUntil(page, 'Play now to start S2E2', () => { const x = window.__mbptv.App.nativePlayer().info(); return !!x && x.episode === 2; }, null, 6000);
  });

  flow('built-in player: a show\'s Play resolves the episode the title page opens on (S2E1) and plays it', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-key="tv:556"]');
    await waitScreen(page, 'detail');
    await waitUntil(page, 'the show\'s episodes', () => !!document.querySelector('#mbptv [data-episode="2x1"]'), null, 10000);
    await activate(page, '[data-action="play"]');
    await waitNativePlaying(page);
    const st = await nativeState(page);
    if (!st.info || st.info.season !== 2 || st.info.episode !== 1) await fail(page, 'a show-level Play should start S2E1 (the season the page shows, no resume label), got ' + JSON.stringify(st.info));
    const title = await page.evaluate(() => document.querySelector('#mbptv-player .mbp-title').textContent);
    if (/S\d+\s*E\d+/i.test(title)) await fail(page, 'the player title is the show name without an episode code, got ' + JSON.stringify(title));
    await hold(page, 'Escape', 6, 60); // a held Back closes the player once and leaves the detail screen on top
    await page.waitForTimeout(500);
    const after = await nativeState(page);
    if (after.mode !== 'shell' || after.screen !== 'detail' || await page.evaluate(() => !!document.querySelector('[data-dialog="exit"]'))) await fail(page, 'a held Back should close the player once and stay on the detail screen, got ' + JSON.stringify(after));
  });

  flow('built-in player: the Play key on a show nobody opened reads its title page first (Starting playback), then plays the page\'s next episode; Back while it reads cancels', {}, async page => {
    await nCookies(page, { mbp_len: 60 });
    // Hold the two shows' title pages back, so the resolve step is visible (and cancellable).
    await page.route(u => /^\/tvshow\/(15980|29814)$/.test(new URL(u).pathname), async r => { await new Promise(ok => setTimeout(ok, 1200)); try { await r.continue(); } catch (e) { /* page closed */ } });
    await waitScreen(page, 'home');
    await waitFocus(page);
    await navigateTo(page, '[data-key="tv:15980"]');
    await press(page, 'MediaPlayPause', 1, 200);
    const overlay = await page.evaluate(() => document.getElementById('mbptv').getAttribute('data-overlay'));
    if (overlay !== 'starting') await fail(page, 'while the title page is read, the "Starting playback" overlay shows, got data-overlay=' + overlay);
    await waitNativePlaying(page);
    const st = await nativeState(page);
    if (!st.info || st.info.id !== '15980' || st.info.season !== 2 || st.info.episode !== 1) await fail(page, 'the show should start its page\'s next episode (S2E1: season 1 is watched), got ' + JSON.stringify(st.info));
    await back(page);
    await waitScreen(page, 'home', 5000);
    const f = await waitFocus(page);
    if (f.key !== 'tv:15980') await fail(page, 'Back from the player returns to the card, got ' + JSON.stringify(f));
    await navigateTo(page, '[data-key="tv:29814"]');
    await press(page, 'MediaPlayPause', 1, 150);
    await back(page);
    await page.waitForTimeout(2500);
    const after = await nativeState(page);
    const overlay2 = await page.evaluate(() => document.getElementById('mbptv').getAttribute('data-overlay'));
    if (after.player || after.mode !== 'shell' || after.screen !== 'home' || overlay2) await fail(page, 'Back while the title page is read cancels: no player, Home stays, got ' + JSON.stringify({ after, overlay2 }));
  });

  flow('built-in player: a ?play=1 page plays in the built-in player, drops play=1, and keeps the website\'s own auto-play quiet', {}, async page => {
    await nCookies(page, { mbp_len: 60 });
    await page.goto(O + '/tvshow/556?season=2&episode=1&play=1');
    await waitNativePlaying(page);
    const st = await nativeState(page);
    if (/play=1/.test(st.url)) await fail(page, 'the page should drop play=1 from its URL once the built-in player took over, at ' + st.url);
    if (!st.info || st.info.season !== 2 || st.info.episode !== 1) await fail(page, 'the ?play=1 page should play S2E1, got ' + JSON.stringify(st.info));
    await page.waitForTimeout(1200); // the mock site's own auto-play clicks the episode 300 ms after load
    const site = await page.evaluate(() => {
      const vids = Array.prototype.filter.call(document.querySelectorAll('video'), v => !document.getElementById('mbptv').contains(v) && !v.paused);
      const side = document.querySelector('.sidebarbg2');
      return { playing: vids.length, picker: !!side && getComputedStyle(side).display !== 'none' && side.getBoundingClientRect().width > 0 };
    });
    if (site.playing || site.picker) await fail(page, 'the website\'s own auto-play must stay quiet behind the built-in player, got ' + JSON.stringify(site) + '; mockLog ' + page.mock.join(', '));
    await back(page);
    await waitScreen(page, 'detail', 5000);
    await page.waitForTimeout(2500);
    const after = await nativeState(page);
    if (after.mode !== 'shell' || after.screen !== 'detail') await fail(page, 'after Back the detail screen stays (the website\'s player never takes over), got ' + JSON.stringify(after));
  });

  flow('built-in player off (Prefs nativePlayer: false): Play takes the website path (?play=1 page, the website\'s player)', { prefs: { nativePlayer: false } }, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-key="movie:40102"]');
    await waitScreen(page, 'detail');
    await activate(page, '[data-action="play"]');
    await page.waitForURL(/\/movie\/40102\?play=1/, { timeout: 8000 });
    await waitUntil(page, 'the website\'s player (player mode)', () => window.__mbptv && window.__mbptv.App.state().mode === 'player', null, 15000);
    if (!page.mock.some(e => /^player:\/index\/index\/player\?mfid=/.test(e))) await fail(page, 'the website\'s player should have opened, mockLog: ' + page.mock.join(', '));
    if (await page.evaluate(() => !!document.getElementById('mbptv-player'))) await fail(page, 'the built-in player must stay closed when it is switched off');
  });

  flow('built-in player failure: the error card\'s "Try website player" plays through the website instead', {}, async page => {
    await nCookies(page, { mbp_all: 'bad' });
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-key="movie:40102"]');
    await waitScreen(page, 'detail');
    await activate(page, '[data-action="play"]');
    await waitUntil(page, 'the error card with "Try website player" focused', () => {
      const card = document.querySelector('#mbptv-player [data-dialog="player-error"]'), f = card && card.querySelector('.is-focused');
      return !!card && card.getBoundingClientRect().width > 0 && !!f && f.getAttribute('data-action') === 'website';
    }, null, 20000);
    await press(page, 'Enter', 1, 200);
    await page.waitForURL(/\/movie\/40102\?play=1/, { timeout: 8000 });
    await waitUntil(page, 'the website\'s player (player mode) on the ?play=1 page', () => window.__mbptv && window.__mbptv.App.state().mode === 'player', null, 15000);
    if (!page.mock.some(e => /^player:\/index\/index\/player\?mfid=/.test(e))) await fail(page, 'the website\'s player should have opened, mockLog: ' + page.mock.join(', '));
    if (await page.evaluate(() => !!document.getElementById('mbptv-player'))) await fail(page, 'the fallback page must use the website\'s player, not the built-in one again');
  });

  // ---- Browse, settings, sign-in, failures -----------------------------------------------------------------------

  flow('rail Movies opens a browse grid that pages in more cards', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-action="nav-movies"]');
    await waitScreen(page, 'browse');
    const n0 = await waitUntil(page, 'cards in [data-zone="grid"]', () => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length, null, 8000);
    await navigateTo(page, { selector: '#mbptv [data-zone="grid"] [data-key]', index: -1 });
    await waitUntil(page, 'more than ' + n0 + ' cards after reaching the last row', n => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length > n, n0, 8000);
  });

  flow('rail Settings opens the settings screen with version and Diagnostics', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-action="nav-settings"]');
    await waitScreen(page, 'settings');
    await waitFocus(page);
    const text = await page.evaluate(() => document.getElementById('mbptv').innerText);
    for (const t of ['Diagnostics', PKG.version]) if (text.indexOf(t) < 0) await fail(page, 'settings should show "' + t + '"');
  });

  flow('signed-out site routes to data-screen=signin; signing in again restores home', {}, async page => {
    await page.goto(O + '/__mock/signout');
    await waitScreen(page, 'signin');
    await waitFocus(page);
    const text = await page.evaluate(() => document.getElementById('mbptv').innerText);
    for (const re of [/sign in/i, /QR/i, /code/i, /Google/i]) if (!re.test(text)) await fail(page, 'the sign-in screen should mention ' + re + ' (QR code, a code, Google)');
    await page.goto(O + '/__mock/signin');
    await waitScreen(page, 'home');
  });

  flow('a session that expires mid-use routes to sign-in', { allowErrors: /signed-out|sign-?in|gate|login/i }, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await page.context().addCookies([{ name: 'mockgate', value: '1', url: O + '/' }]);
    await activate(page, '[data-action="nav-movies"]');
    await waitScreen(page, 'signin', 12000);
  });

  flow('a failed request shows Retry and Open website; Retry recovers', { allowErrors: /network|http|timeout|abort|fail|load/i }, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    const listUrl = new RegExp('^' + O.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/movie(\\?.*)?$');
    await page.route(listUrl, r => r.abort('failed'));
    await activate(page, '[data-action="nav-movies"]');
    await waitUntil(page, 'visible [data-action="retry"] and [data-action="open-website"] after the list request fails', () => {
      const shown = a => { const b = document.querySelector('#mbptv [data-action="' + a + '"]'); return !!b && b.getBoundingClientRect().height > 0; };
      return shown('retry') && shown('open-website');
    }, null, 20000);
    await page.unroute(listUrl);
    await activate(page, '[data-action="retry"]');
    await waitUntil(page, 'cards in [data-zone="grid"] after Retry', () => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length > 0, null, 10000);
  });

  // ---- Remote flows and layout checks added with the 0.3 review fixes ----------------------------------------------

  const appState = page => page.evaluate(() => window.__mbptv.App.state());
  // Holds a key: one keydown, then auto-repeat keydowns (KeyboardEvent.repeat), then the keyup.
  async function hold(page, key, repeats = 8, gap = 60) {
    await page.keyboard.down(key);
    for (let i = 0; i < repeats; i++) { await page.waitForTimeout(gap); await page.keyboard.down(key); }
    await page.keyboard.up(key);
  }
  // Some TVs report auto-repeat as keyup/keydown pairs a few milliseconds apart.
  async function pairRepeat(page, code, key, times = 8) {
    const cdp = await page.context().newCDPSession(page);
    for (let i = 0; i < times; i++) {
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key, code: '' });
      await new Promise(r => setTimeout(r, 30));
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key, code: '' });
    }
  }
  async function submitBat(page) {
    await openSearch(page);
    await page.keyboard.type('bat', { delay: 40 });
    await activate(page, '[data-action="search-submit"]');
    await waitUntil(page, 'result cards in [data-zone="grid"]', () => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length > 0, null, 8000);
    return waitFocus(page);
  }

  flow('holding OK on a card opens its detail once and never starts playback; a held Back pops one screen', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await navigateTo(page, '[data-key="movie:81314"]');
    await page.evaluate(() => { window.__e2eNoReload = 1; });
    await hold(page, 'Enter', 10, 60);
    await page.waitForTimeout(1500);
    const a = await page.evaluate(() => ({ same: window.__e2eNoReload === 1, url: location.pathname + location.search }));
    const st = await appState(page);
    if (!a.same || /play=1/.test(a.url)) await fail(page, 'a held OK must not start playback (page ' + a.url + ')');
    if (st.stack.join(',') !== 'home,detail' || st.screen !== 'detail') await fail(page, 'a held OK should open exactly one detail screen, got ' + JSON.stringify(st));
    // TVs that repeat as keyup/keydown pairs: still one activation. On Quality, one press opens the sheet; a second
    // would choose the focused option (a toast) and close it.
    await navigateTo(page, '[data-action="quality"]');
    await pairRepeat(page, 13, 'Enter', 8);
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => ({ layer: document.getElementById('mbptv').getAttribute('data-layer'), toast: (document.getElementById('mbptv-toast') || {}).textContent || '' }));
    if (b.layer !== 'sheet' || /Preferred quality/.test(b.toast)) await fail(page, 'fast keyup/keydown pairs (a TV auto-repeat) must count as one press: ' + JSON.stringify(b));
    await back(page);
    // Two screens deep, a held Back pops exactly one.
    await navigateTo(page, '#mbptv [data-zone="row:related"] [data-key]');
    await press(page, 'Enter', 1, 300);
    await waitUntil(page, 'a second detail screen', () => window.__mbptv.App.state().stack.join(',') === 'home,detail,detail', null, 5000);
    await page.waitForTimeout(300);
    await hold(page, 'Escape', 10, 60);
    await page.waitForTimeout(800);
    const c = await appState(page);
    if (c.stack.join(',') !== 'home,detail' || c.layer) await fail(page, 'a held Back should pop exactly one screen, got ' + JSON.stringify(c));
  });

  flow('holding OK on the Search key searches once; holding OK on a letter keeps typing it', {}, async page => {
    await openSearch(page);
    await page.keyboard.type('bat', { delay: 40 });
    await navigateTo(page, '[data-action="search-submit"]');
    await hold(page, 'Enter', 14, 60);
    await waitUntil(page, 'result cards', () => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length > 0, null, 8000);
    await page.waitForTimeout(1200);
    const st = await appState(page);
    if (st.screen !== 'search' || st.stack.join(',') !== 'home,search') await fail(page, 'a held OK on Search should only search, got ' + JSON.stringify(st));
    await back(page);
    await activate(page, '[data-action="clear"]');
    await navigateTo(page, '[data-char="a"]');
    await hold(page, 'Enter', 4, 80);
    const q = await queryText(page);
    if (!/^a{2,}$/.test(q)) await fail(page, 'holding OK on a letter key should repeat it, got ' + JSON.stringify(q));
  });

  flow('search: Right from the keyboard\'s bottom keys returns to the results and never lands on another key', {}, async page => {
    await submitBat(page);
    await press(page, 'ArrowDown');
    await press(page, 'ArrowLeft');
    const k = await focusInfo(page);
    if (k.zone !== 'keyboard') await fail(page, 'Left from the first result column should reach the keyboard, got ' + JSON.stringify(k));
    await press(page, 'ArrowRight');
    const g = await focusInfo(page);
    if (g.zone !== 'grid') await fail(page, 'Right from the keyboard (' + (k.action || k.char) + ') should return to the results, got ' + JSON.stringify(g));
    if ((await queryText(page)) !== 'bat') await fail(page, 'the query must be kept');
    await navigateTo(page, '[data-action="clear"]');
    await press(page, 'ArrowRight');
    const r = await focusInfo(page);
    if (r.zone === 'keyboard') await fail(page, 'Right from Clear must leave the keyboard, got ' + JSON.stringify(r));
  });

  flow('search: Back from the results returns to the keyboard with the query and results kept; a second Back goes Home', {}, async page => {
    await submitBat(page);
    await press(page, 'ArrowDown');
    await back(page);
    const f = await waitFocus(page);
    const st = await appState(page);
    if (st.screen !== 'search' || f.zone !== 'keyboard') await fail(page, 'Back from the results should focus the keyboard on the search screen, got ' + JSON.stringify({ st, f }));
    if ((await queryText(page)) !== 'bat') await fail(page, 'the query must stay "bat"');
    if (!(await cardKeys(page, '[data-zone="grid"]')).length) await fail(page, 'the results must stay on screen');
    await back(page);
    await waitScreen(page, 'home');
  });

  flow('search: slow results never take focus from a key typed meanwhile', {}, async page => {
    await page.route(/\/index\/search\?/, r => setTimeout(() => r.continue().catch(() => {}), 2500));
    await openSearch(page);
    await page.keyboard.type('bat', { delay: 40 });
    await activate(page, '[data-action="search-submit"]');
    await press(page, 'ArrowUp', 2, 120);
    const typed = await focusInfo(page);
    await press(page, 'Enter', 1, 150);
    await page.waitForTimeout(3200);
    const f = await focusInfo(page);
    if (!typed.char || f.char !== typed.char) await fail(page, 'focus should stay on the key typed while the results loaded (' + typed.char + '), got ' + JSON.stringify(f));
    if ((await queryText(page)) !== 'bat' + typed.char) await fail(page, 'the typed key should be in the query, got ' + JSON.stringify(await queryText(page)));
  });

  flow('search: the trending list arriving late keeps focus on the recent chip the viewer is on', {}, async page => {
    await page.context_.addInitScript({ content: 'try { localStorage.setItem("mbptv:recent:v1", JSON.stringify(["dune"])); } catch (e) {}' });
    await page.route(/\/index\/api\/search_hot/, r => setTimeout(() => r.continue().catch(() => {}), 2500));
    await page.reload();
    await openSearch(page);
    await navigateTo(page, '[data-query="dune"]');
    await waitUntil(page, 'the trending chips', () => !!document.querySelector('#mbptv [data-query="Resident Evil"]'), null, 6000);
    await page.waitForTimeout(300);
    const f = await waitFocus(page);
    if (f.query !== 'dune') await fail(page, 'focus should stay on the "dune" chip after the lists were rebuilt, got ' + JSON.stringify(f));
  });

  flow('tabs and chips remember the selection: Up from the results lands on the selected tab; a chosen chip keeps focus', {}, async page => {
    await submitBat(page);
    await press(page, 'ArrowRight', 3);
    await press(page, 'ArrowUp');
    const t = await focusInfo(page);
    if (t.type !== 'all') await fail(page, 'Up from the results should land on the selected "All" tab, got ' + JSON.stringify(t));
    await activate(page, '[data-action="nav-movies"]');
    await waitScreen(page, 'browse');
    await waitUntil(page, 'grid cards', () => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length > 0, null, 8000);
    await navigateTo(page, { selector: '#mbptv .mb-browse-tabs [data-f]', index: 2 });
    const chip = await focusInfo(page);
    await press(page, 'Enter', 1, 200);
    await page.waitForTimeout(1200);
    const c = await focusInfo(page);
    if (c.text !== chip.text) await fail(page, 'the chosen chip should keep focus while its list loads, got ' + JSON.stringify(c));
    await press(page, 'ArrowDown');
    await press(page, 'ArrowUp');
    const u = await focusInfo(page);
    if (u.text !== chip.text) await fail(page, 'Up from the grid should return to the selected chip "' + chip.text + '", got ' + JSON.stringify(u));
  });

  flow('the rail reopens on the current section, not on the last item browsed', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    let f = null;
    for (let i = 0; i < 12; i++) { await press(page, 'ArrowLeft'); f = await focusInfo(page); if (/^nav-/.test(f.action)) break; }
    await press(page, 'ArrowDown', 4);
    await press(page, 'ArrowRight');
    await press(page, 'ArrowLeft');
    const r = await focusInfo(page);
    if (r.action !== 'nav-home') await fail(page, 'the rail should reopen on Home, got ' + JSON.stringify(r));
  });

  flow('Up and Down step through Home rows in order; Back from a lower row returns to the first row', {}, async page => {
    await waitScreen(page, 'home');
    const f0 = await waitFocus(page);
    const zones = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#mbptv [data-zone^="row:"]'), z => z.getAttribute('data-zone')));
    const seen = [f0.zone];
    for (let i = 1; i < Math.min(4, zones.length); i++) { await press(page, 'ArrowDown', 1, 250); seen.push((await focusInfo(page)).zone); }
    if (seen.join(',') !== zones.slice(0, seen.length).join(',')) await fail(page, 'Down should visit the rows in order: ' + seen.join(',') + ' vs ' + zones.join(','));
    await press(page, 'ArrowUp', 1, 250);
    const up = await focusInfo(page);
    if (up.zone !== zones[seen.length - 2]) await fail(page, 'Up should return to the row above (' + zones[seen.length - 2] + '), got ' + up.zone);
    await back(page);
    const b = await focusInfo(page);
    if (b.zone !== zones[0]) await fail(page, 'Back from a lower row should return to the first row, got ' + b.zone);
    const layer = await page.evaluate(() => document.getElementById('mbptv').getAttribute('data-layer'));
    if (layer) await fail(page, 'no exit dialog yet');
  });

  flow('a show with 50 seasons: one line of pills, Down lands on the selected season, Left scrolls it into view', {}, async page => {
    await page.route(/\/tvshow\/556(\?.*)?$/, async r => {
      const res = await r.fetch();
      let body = await res.text();
      const pills = [];
      for (let n = 1; n <= 50; n++) pills.push('<a href="/tvshow/556?season=' + n + '"><p class="' + (n === 37 ? 'active' : '') + '">' + n + '</p></a>');
      body = body.replace(/(<p class="name2">SEASON<\/p>\s*<div>)[\s\S]*?(<\/div>)/, '$1' + pills.join(' ') + '$2');
      r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    });
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-key="tv:556"]');
    await waitScreen(page, 'detail');
    await waitUntil(page, '50 season pills', () => document.querySelectorAll('#mbptv [data-season]').length === 50, null, 8000);
    const lines = await page.evaluate(() => new Set(Array.prototype.map.call(document.querySelectorAll('#mbptv [data-season]'), p => p.offsetTop)).size);
    if (lines !== 1) await fail(page, 'the season pills should be one line, got ' + lines + ' lines');
    await press(page, 'ArrowDown', 1, 400);
    const s = await focusInfo(page);
    if (s.season !== '37') await fail(page, 'Down from the buttons should land on the selected Season 37, got ' + JSON.stringify(s));
    const onScreen = () => { const r = document.querySelector('#mbptv .is-focused').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; };
    if (!(await page.evaluate(onScreen))) await fail(page, 'the selected season pill should be on screen');
    await press(page, 'ArrowLeft', 10, 120);
    await page.waitForTimeout(400);
    const l = await focusInfo(page);
    if (l.season !== '27' || !(await page.evaluate(onScreen))) await fail(page, 'Left x10 should reach Season 27, on screen; got ' + JSON.stringify(l));
    await press(page, 'ArrowDown', 1, 300);
    if (!(await focusInfo(page)).episode) await fail(page, 'Down from the pills should reach the episodes');
  });

  flow('switching season: Down lands on the first episode; a failed season offers Try again, which reloads it', {}, async page => {
    let failures = 2; // the request and the one retry Api makes
    await page.route(/\/tvshow\/556\?season=5$/, r => { if (failures > 0) { failures--; r.abort('failed'); } else r.continue(); });
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-key="tv:556"]');
    await waitScreen(page, 'detail');
    await waitUntil(page, 'episodes', () => document.querySelectorAll('#mbptv [data-episode]').length > 0, null, 8000);
    await activate(page, '[data-season="3"]');
    await waitUntil(page, 'season 3 episodes', () => document.querySelectorAll('#mbptv [data-episode]').length > 0 && !document.querySelector('#mbptv [data-zone="row:episodes"] .mb-skel'), null, 8000);
    await press(page, 'ArrowDown', 1, 300);
    const e = await focusInfo(page);
    const firstEp = await page.evaluate(() => document.querySelector('#mbptv [data-episode]').getAttribute('data-episode'));
    if (e.episode !== firstEp) await fail(page, 'Down after switching season should land on the first episode (' + firstEp + '), got ' + JSON.stringify(e));
    await press(page, 'ArrowUp', 1, 300);
    await activate(page, '[data-season="5"]');
    await waitUntil(page, 'the season error with Try again', () => !!document.querySelector('#mbptv [data-action="season-retry"]'), null, 20000);
    await press(page, 'ArrowDown', 1, 300);
    const t = await focusInfo(page);
    if (t.action !== 'season-retry') await fail(page, 'Down from the pills should reach Try again, got ' + JSON.stringify(t));
    await press(page, 'Enter', 1, 300);
    await waitUntil(page, 'season 5 episodes after Try again', () => document.querySelectorAll('#mbptv [data-episode]').length > 0, null, 8000);
  });

  flow('detail rows start right under the header (no empty band) for a show and for a movie', {}, async page => {
    const gap = () => {
      const mini = document.querySelector('#mbptv .mb-screen.is-current .mb-detail-mini').getBoundingClientRect();
      const rows = Array.prototype.filter.call(document.querySelectorAll('#mbptv .mb-screen.is-current .mb-detail-rows > .mb-row'), r => !r.classList.contains('is-past'));
      const first = rows[0].getBoundingClientRect();
      const em = parseFloat(getComputedStyle(document.getElementById('mbptv')).fontSize);
      return { gapEm: (first.top - mini.bottom) / em, headerOpaque: +getComputedStyle(document.querySelector('#mbptv .mb-screen.is-current .mb-detail-mini')).opacity };
    };
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-key="tv:556"]');
    await waitScreen(page, 'detail');
    await navigateTo(page, '[data-episode="2x1"]');
    await page.waitForTimeout(600);
    const tv = await page.evaluate(gap);
    if (!(tv.gapEm >= 0.5 && tv.gapEm <= 3.5) || tv.headerOpaque < 0.9) await fail(page, 'show: the rows should start just under the header, got ' + JSON.stringify(tv));
    const body = await page.evaluate(() => document.querySelector('#mbptv .mb-screen.is-current .mb-mini-body').textContent);
    if (!/Penguin|Catwoman/.test(body)) await fail(page, 'the header should show the focused episode\'s overview, got ' + JSON.stringify(body));
    await back(page);
    await waitScreen(page, 'home');
    await activate(page, '[data-key="movie:40102"]');
    await waitScreen(page, 'detail');
    await waitUntil(page, 'the related row', () => !!document.querySelector('#mbptv .mb-screen.is-current [data-zone="row:related"] [data-key]'), null, 8000);
    await navigateTo(page, '#mbptv .mb-screen.is-current [data-zone="row:related"] [data-key]');
    await page.waitForTimeout(600);
    const mv = await page.evaluate(gap);
    if (!(mv.gapEm >= 0.5 && mv.gapEm <= 3.5)) await fail(page, 'movie: the rows should start just under the header, got ' + JSON.stringify(mv));
    const tags = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#mbptv .mb-screen.is-current .mb-detail-info .mb-tags .mb-tag'), t => t.textContent));
    if (tags.indexOf('4K') >= 0 || tags.indexOf('4K HDR') < 0) await fail(page, 'badges should not repeat 4K next to 4K HDR, got ' + tags.join(', '));
  });

  flow('search grid navigates by column: Right stops at the row end, Down from the last column reaches a shorter last row', {}, async page => {
    // One page of results only (6 titles: a full row of 5 and a row of 1), so paging never changes the grid mid-test.
    await page.route(/\/index\/search\?.*page=\d/, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>x - MovieBoxPro</title><body><div class="search_info"></div></body>' }));
    await submitBat(page);
    const count = await page.evaluate(() => document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]').length);
    const cols = await page.evaluate(() => { const c = document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]'); let n = 0; while (n < c.length && c[n].offsetTop === c[0].offsetTop) n++; return n; });
    await press(page, 'ArrowRight', cols + 1, 110);
    const r = await focusInfo(page);
    const idx = await page.evaluate(() => Array.prototype.indexOf.call(document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]'), document.querySelector('#mbptv .is-focused')));
    if (idx !== cols - 1) await fail(page, 'Right should stop at the end of the first row (index ' + (cols - 1) + '), got ' + idx + ' ' + JSON.stringify(r));
    await press(page, 'ArrowDown', 1, 150);
    const idx2 = await page.evaluate(() => Array.prototype.indexOf.call(document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]'), document.querySelector('#mbptv .is-focused')));
    const want = Math.min(count - 1, 2 * cols - 1);
    if (idx2 !== want) await fail(page, 'Down from the last column should reach index ' + want + ', got ' + idx2);
    await press(page, 'ArrowUp', 1, 150);
    const idx3 = await page.evaluate(() => Array.prototype.indexOf.call(document.querySelectorAll('#mbptv [data-zone="grid"] [data-key]'), document.querySelector('#mbptv .is-focused')));
    if (idx3 !== want - cols) await fail(page, 'Up should go back one row (index ' + (want - cols) + '), got ' + idx3);
  });

  flow('the page behind the shell never scrolls (no scrollbar); website view unlocks it and the TV app locks it again', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    const locked = () => ({ cls: document.documentElement.classList.contains('mbptv-lock'), html: getComputedStyle(document.documentElement).overflow, body: getComputedStyle(document.body).overflow });
    const a = await page.evaluate(locked);
    if (!a.cls || a.html !== 'hidden' || a.body !== 'hidden') await fail(page, 'the shell should lock page scrolling, got ' + JSON.stringify(a));
    await activate(page, '[data-action="nav-settings"]');
    await waitScreen(page, 'settings');
    await activate(page, '[data-action="setting-website"]');
    await waitScreen(page, 'native');
    const b = await page.evaluate(() => { const r = { cls: document.documentElement.classList.contains('mbptv-lock'), html: getComputedStyle(document.documentElement).overflow }; window.scrollTo(0, 300); r.y = window.scrollY; return r; });
    if (b.cls || b.html === 'hidden' || b.y < 100) await fail(page, 'website view must leave the page scrollable, got ' + JSON.stringify(b));
    const pill = await page.evaluate(() => document.getElementById('mbptv-pill').textContent.trim());
    if (!/Back to TV app/.test(pill)) await fail(page, 'the pill should say "Back to TV app", got ' + JSON.stringify(pill));
    await page.evaluate(() => document.getElementById('mbptv-pill').click());
    await waitScreen(page, 'settings');
    if (!(await page.evaluate(() => document.documentElement.classList.contains('mbptv-lock')))) await fail(page, 'returning to the TV app should lock scrolling again');
  });

  flow('player mode hides the website player\'s own controls (captions stay); Back restores them', { prefs: { nativePlayer: false } }, async page => {
    await page.goto(O + '/movie/40102?play=1');
    await waitUntil(page, 'player mode', () => window.__mbptv.App.state().mode === 'player', null, 15000);
    await page.evaluate(() => {
      const dlg = document.getElementById('my_dialog');
      const jw = document.createElement('div');
      jw.className = 'jwplayer jw-state-playing';
      jw.innerHTML = '<div class="jw-wrapper"><div class="jw-captions">Caption line</div><div class="jw-controls"><div class="jw-display">display</div><div class="jw-controlbar">bar</div></div><div class="jw-title">Title</div></div>';
      dlg.appendChild(jw);
    });
    const shown = () => ({ bar: getComputedStyle(document.querySelector('.jw-controlbar')).display, display: getComputedStyle(document.querySelector('.jw-display')).display, captions: getComputedStyle(document.querySelector('.jw-captions')).display, html: document.documentElement.className });
    const a = await page.evaluate(shown);
    if (a.bar !== 'none' || a.display !== 'none' || a.captions === 'none' || !/mbptv-player/.test(a.html)) await fail(page, 'in player mode JW controls must be hidden and captions shown, got ' + JSON.stringify(a));
    await page.evaluate(() => { document.querySelector('.jwplayer').className = 'jwplayer jw-state-buffering'; });
    if ((await page.evaluate(shown)).display === 'none') await fail(page, 'JW Player\'s buffering display must stay visible');
    await back(page);
    await waitScreen(page, 'detail', 12000);
    const b = await page.evaluate(() => ({ bar: getComputedStyle(document.querySelector('.jw-controlbar')).display, html: document.documentElement.className }));
    if (b.bar === 'none' || /mbptv-player/.test(b.html)) await fail(page, 'after the player closes the page must be untouched again, got ' + JSON.stringify(b));
  });

  flow('website player: the OSD names the episode and stays up while paused', { prefs: { nativePlayer: false } }, async page => {
    await page.goto(O + '/tvshow/556?season=2&episode=1&play=1');
    await waitUntil(page, 'player mode', () => window.__mbptv.App.state().mode === 'player', null, 15000);
    const osd = await waitUntil(page, 'the OSD episode line', () => { const s = document.querySelector('#mbptv-osd .mbo-sub'); return s && s.textContent ? { title: document.querySelector('#mbptv-osd .mbo-title').textContent, sub: s.textContent } : null; }, null, 4000);
    if (!/^S2 . E1\b/.test(osd.sub) || /S2E1|S\d+E\d+/.test(osd.title)) await fail(page, 'the OSD should read the show title with an "S2 · E1 ..." line, got ' + JSON.stringify(osd));
    await press(page, 'Enter', 1, 300);
    await waitUntil(page, 'the video paused', () => document.querySelector('#my_dialog video').paused, null, 3000);
    await page.waitForTimeout(4500);
    const vis = await page.evaluate(() => document.getElementById('mbptv-osd').classList.contains('is-visible'));
    if (!vis) await fail(page, 'the OSD must stay visible while the video is paused');
    await press(page, 'Enter', 1, 300);
    await waitUntil(page, 'the OSD to hide again once playing', () => !document.getElementById('mbptv-osd').classList.contains('is-visible'), null, 6000);
  });

  flow('website player: a stalled video shows a buffering spinner in the OSD until it plays again', { prefs: { nativePlayer: false } }, async page => {
    await page.route(/\/__e2e\/stall\.wav$/, () => { /* never answers */ });
    await page.goto(O + '/movie/40102?play=1');
    await waitUntil(page, 'player mode', () => window.__mbptv.App.state().mode === 'player', null, 15000);
    await waitUntil(page, 'the OSD to hide while playing', () => !document.getElementById('mbptv-osd').classList.contains('is-visible'), null, 8000);
    await page.evaluate(() => { const v = document.querySelector('#my_dialog video'); window.__e2eSrc = v.src; v.src = '/__e2e/stall.wav'; v.play().catch(() => {}); });
    await waitUntil(page, 'the OSD with a buffering spinner', () => {
      const o = document.getElementById('mbptv-osd');
      return o.classList.contains('is-visible') && !!o.querySelector('.mbo-state .mbo-spin');
    }, null, 5000);
    await page.evaluate(() => { const v = document.querySelector('#my_dialog video'); v.src = window.__e2eSrc; v.play().catch(() => {}); });
    await waitUntil(page, 'the spinner to go and the OSD to hide once playing again', () => {
      const o = document.getElementById('mbptv-osd');
      return !o.querySelector('.mbo-state .mbo-spin') && !o.classList.contains('is-visible');
    }, null, 8000);
  });

  flow('website player: a preferred file is chosen without flashing the file list; Up during the choice opens the full list', { prefs: { nativePlayer: false } }, async page => {
    await page.context_.addInitScript({ content: `(function () {
      if (window.top !== window.self) return;
      var seen = window.__e2eSheet = [];
      var t = setInterval(function () {
        var s = document.querySelector('#mbptv [data-sheet="sources"]'), r = document.getElementById('mbptv');
        seen.push((s ? 'sheet' : '-') + '/' + (r ? r.getAttribute('data-overlay') || '' : ''));
        if (seen.length > 800) clearInterval(t);
      }, 25);
    }());` });
    await page.goto(O + '/movie/40102?play=1');
    await waitUntil(page, 'player mode', () => window.__mbptv.App.state().mode === 'player', null, 15000);
    const seen = await page.evaluate(() => window.__e2eSheet.slice());
    if (seen.some(s => /^sheet/.test(s))) await fail(page, 'the file list must not flash on screen: ' + Array.from(new Set(seen)).join(' > '));
    await page.goto(O + '/movie/40102?play=1');
    await waitUntil(page, 'the starting overlay naming the file', () => { const r = document.getElementById('mbptv'); return !!r && r.getAttribute('data-overlay') === 'starting' && /Press Up/.test(r.textContent); }, null, 8000);
    await press(page, 'ArrowUp', 1, 300);
    await waitUntil(page, 'the full list of files after Up', () => document.querySelectorAll('#mbptv [data-sheet="sources"] [data-source-index]').length === 2, null, 4000);
    const label = await page.evaluate(() => document.querySelector('#mbptv [data-sheet="sources"] [data-source-index="0"] .mb-source-file').textContent);
    if (!/WEBRip\s+.\s+DDP5\.1\s+.\s+x264/.test(label)) await fail(page, 'the file row should show a readable label (source, audio, codec), got ' + JSON.stringify(label));
    await page.waitForTimeout(1500);
    if ((await appState(page)).mode === 'player') await fail(page, 'after Up the viewer chooses; nothing plays on its own');
  });

  flow('a Featured banner without a title shows placeholders, then learns its title from its page', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await navigateTo(page, '#mbptv [data-zone="row:featured"] [data-key]');
    const key = (await focusInfo(page)).key;
    await waitUntil(page, 'the banner title on the hero and on the card', k => {
      const card = document.querySelector('#mbptv [data-zone="row:featured"] [data-key="' + k + '"] .mb-card-label');
      const t = document.querySelector('#mbptv .mb-hero-info .mb-display');
      return card && card.textContent && t && t.textContent === card.textContent;
    }, key, 8000);
    const btns = await page.evaluate(() => getComputedStyle(document.querySelector('#mbptv .mb-hero-info .mb-btns')).visibility);
    if (btns !== 'hidden') await fail(page, 'in the rows the hero buttons step aside');
  });

  flow('Settings clears the search history on this TV, and signing out forgets it too', { allowErrors: /signed-out|sign-?in|gate|login/i }, async page => {
    await submitBat(page);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('mbptv:recent:v1') || '[]'));
    if (before[0] !== 'bat') await fail(page, 'the search should be remembered first, got ' + JSON.stringify(before));
    await activate(page, '[data-action="nav-settings"]');
    await waitScreen(page, 'settings');
    await activate(page, '[data-action="setting-clearSearches"]');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('mbptv:recent:v1') || '[]'));
    if (after.length) await fail(page, 'Clear search history should empty the list, got ' + JSON.stringify(after));
    await activate(page, '[data-action="nav-search"]');
    await waitScreen(page, 'search');
    await page.keyboard.type('zzq', { delay: 40 });
    await activate(page, '[data-action="search-submit"]');
    await waitUntil(page, 'the empty state', () => !!document.querySelector('#mbptv [data-action="open-website"]'), null, 8000);
    await page.context().addCookies([{ name: 'mockgate', value: '1', url: O + '/' }]);
    await activate(page, '[data-action="nav-movies"]');
    await waitScreen(page, 'signin', 12000);
    const gone = await page.evaluate(() => [JSON.parse(localStorage.getItem('mbptv:recent:v1') || '[]').length, sessionStorage.getItem('mbptv:session:v1')]);
    if (gone[0] || gone[1]) await fail(page, 'signing out should forget recent searches and the saved place, got ' + JSON.stringify(gone));
  });

  flow('Diagnostics reads at TV size, runs its self-test on demand, and Left from any log line returns to its buttons', {}, async page => {
    await waitScreen(page, 'home');
    await waitFocus(page);
    await activate(page, '[data-action="nav-settings"]');
    await waitScreen(page, 'settings');
    await activate(page, '[data-action="setting-diagnostics"]');
    await waitScreen(page, 'diagnostics');
    const facts = await page.evaluate(() => ({
      selfTest: Array.prototype.map.call(document.querySelectorAll('#mbptv .mb-fact'), f => f.textContent).filter(t => /^Self-test/.test(t))[0] || '',
      line: parseFloat(getComputedStyle(document.querySelector('#mbptv .mb-logline')).fontSize),
      value: parseFloat(getComputedStyle(document.querySelector('#mbptv .mb-fact-v')).fontSize)
    }));
    if (/Not run yet/.test(facts.selfTest)) await fail(page, 'Diagnostics should run the live self-test when it opens, got ' + JSON.stringify(facts.selfTest));
    if (facts.line < 21 || facts.value < 23) await fail(page, 'log lines and facts must be readable from 3 m (at least 22 and 24 px at 1080p), got ' + JSON.stringify(facts));
    await navigateTo(page, { selector: '#mbptv .mb-logline', index: 0 });
    await press(page, 'ArrowLeft');
    const f = await focusInfo(page);
    if (f.action !== 'selftest' && f.action !== 'clear-log') await fail(page, 'Left from the top log line should return to the Diagnostics buttons, got ' + JSON.stringify(f));
  });

  flow('Home on an error screen that replaced Home tries Home again', { allowErrors: /network|http|fail|abort|home/i }, async page => {
    const homeXhr = u => new URL(u).pathname === '/';
    await page.route(homeXhr, r => r.request().isNavigationRequest() ? r.continue() : r.abort('failed'));
    await page.goto(O + '/movie/40102');
    await waitScreen(page, 'detail');
    await waitFocus(page);
    await back(page);
    await waitScreen(page, 'error', 20000);
    await page.unroute(homeXhr);
    await activate(page, '[data-action="home"]');
    await waitScreen(page, 'home', 10000);
    await waitUntil(page, 'home rows', () => document.querySelectorAll('#mbptv [data-zone^="row:"] [data-key]').length > 0, null, 8000);
  });

  await run();
  await browser.close();
  await site.close();
}

module.exports = kit;

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
