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

  flow('Play with quality "ask" opens [data-sheet=sources] with 2 rows; choosing one plays; Back returns to detail', { prefs: { quality: 'ask' } }, async page => {
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

  flow('preferred quality "best" auto-selects 4K; Right seeks +10 s with the OSD; OK pauses; Back returns to detail', {}, async page => {
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

  await run();
  await browser.close();
  await site.close();
}

module.exports = kit;

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
