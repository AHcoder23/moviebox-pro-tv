/* Overlays: toasts, dialogs, sheets (live source picker, quality), the starting-playback overlay, website mode
   (spatial ring + TV pill, also used for site popups) and the player controller with its OSD. */
var Toast = (function () {
  var node = null, timer = null;

  function ensure() {
    var root = document.getElementById('mbptv');
    if (!root) return null;
    if (!node || node.parentNode !== root) {
      node = document.getElementById('mbptv-toast') || U.el('div', 'mb-toast');
      node.id = 'mbptv-toast';
      node.setAttribute('role', 'status');
      root.appendChild(node);
    }
    return node;
  }

  function show(msg, ms) {
    var n = ensure();
    if (!n) return;
    n.textContent = String(msg == null ? '' : msg);
    U.toggleClass(n, 'is-visible', true);
    clearTimeout(timer);
    timer = U.later(hide, ms || 3500, 'toast');
    Log.info('toast', msg);
  }

  function hide() { if (node) U.toggleClass(node, 'is-visible', false); }

  return { show: show, hide: hide };
}());

var Overlays = (function () {
  var el = U.el;
  var RANK = { '8K': 8, '4K': 7, 'Original': 6, '1440p': 5, '1080p': 4, '720p': 3, 'SD': 1 };

  /* ---------- Generic dialog and sheet ---------- */

  function dialog(opts) {
    var layer = el('div', 'mb-layer mb-layer--dialog');
    el('div', 'mb-layer-dim', null, layer);
    var box = el('div', 'mb-dialog', null, layer);
    box.setAttribute('data-dialog', opts.name || 'dialog');
    el('div', 'mb-h1', opts.title || '', box);
    if (opts.text) el('div', 'mb-body', opts.text, box);
    var btns = Kit.zone(el('div', 'mb-btns', null, box), 'dialog');
    var focus = null;
    U.each(opts.buttons || [], function (b) {
      var n = Kit.button({ label: b.label, icon: b.icon, action: b.action, primary: b.primary, parent: btns, key: 'dlg|' + b.action });
      n.__run = b.run;
      if (b.focus) focus = n;
    });
    App.openLayer('dialog', layer, { focus: focus || Focus.firstIn(btns), name: opts.name, onBack: opts.onBack });
    return layer;
  }

  function exitDialog() {
    if (App.hasLayer('dialog')) return;
    dialog({
      name: 'exit', title: 'Exit MovieBox Pro TV?', text: 'You can come back any time from TizenBrew.',
      buttons: [
        { label: 'Stay', action: 'stay', primary: true, focus: true, run: function () { App.closeLayer('dialog'); } },
        { label: 'Exit', icon: 'power', action: 'exit', run: function () { App.exitApp(); } }
      ]
    });
  }

  /* opts: {name, kicker, title, sub, hint, onBack} -> {layer, list, port} */
  function sheet(opts) {
    var layer = el('div', 'mb-layer mb-layer--sheet');
    el('div', 'mb-layer-dim', null, layer);
    var box = el('div', 'mb-sheet', null, layer);
    box.setAttribute('data-sheet', opts.name);
    el('div', 'mb-kicker', opts.kicker || '', box);
    el('div', 'mb-h1', opts.title || '', box);
    el('div', 'mb-sheet-sub', opts.sub || '', box);
    var port = el('div', 'mb-sheet-port', null, box);
    var list = Kit.zone(el('div', 'mb-sheet-list', null, port), 'sheet');
    el('div', 'mb-sheet-hint', opts.hint || 'Press Back to close', box);
    return { layer: layer, box: box, list: list, port: port };
  }

  function sheetFocus(s, node) {
    if (node && s.port) Kit.reveal(s.list, s.port, node, Kit.em() * 1, Kit.em() * 1);
  }

  /* ---------- Quality preference (settings) ---------- */

  var QUALITIES = [['best', 'Best available'], ['1080p', '1080p'], ['720p', '720p'], ['ask', 'Ask every time']];

  function optionRow(list, key, label, selected) {
    var r = el('div', 'mb-opt', null, list);
    Kit.focusable(r, 'opt|' + key);
    r.setAttribute('data-option', key);
    el('span', 'mb-opt-label', label, r);
    if (selected) r.appendChild(Icons.el('check'));
    return r;
  }

  function qualityPref(done) {
    var cur = Screens.pref('quality', 'best');
    var s = sheet({ name: 'quality', kicker: 'Settings', title: 'Preferred quality', sub: 'Used when a title has several files' });
    var focus = null;
    U.each(QUALITIES, function (q) {
      var r = optionRow(s.list, q[0], q[1], q[0] === cur);
      if (q[0] === cur) focus = r;
      r.__run = function () {
        Screens.setPref('quality', q[0]);
        App.closeLayer('sheet');
        App.toast('Preferred quality: ' + q[1]);
        if (done) done(q[0]);
      };
    });
    App.openLayer('sheet', s.layer, { focus: focus || Focus.firstIn(s.list), name: 'quality', onFocus: function (n) { sheetFocus(s, n); } });
  }

  /* ---------- Quality sheet from a detail page: preference + the files the page lists ---------- */

  function quality(opts) {
    var cur = Screens.pref('quality', 'best');
    var sources = opts.sources || [];
    var s = sheet({ name: 'quality', kicker: 'Quality', title: opts.title || 'Quality', sub: sources.length ? 'Pick a preference or a specific file' : 'Your preference for every title' });
    var focus = null;
    U.each(QUALITIES, function (q) {
      var r = optionRow(s.list, q[0], q[1], q[0] === cur);
      if (q[0] === cur) focus = r;
      r.__run = function () {
        Screens.setPref('quality', q[0]);
        App.closeLayer('sheet');
        App.toast('Preferred quality: ' + q[1]);
        if (opts.onChange) opts.onChange(q[0]);
      };
    });
    if (sources.length) el('div', 'mb-sheet-label', 'Files for this title', s.list);
    U.each(sources, function (src, i) {
      var r = sourceRow(s.list, src, i, false);
      r.removeAttribute('data-source-index');
      r.setAttribute('data-file-index', String(i));
      r.__run = function () { App.closeLayer('sheet'); if (opts.onPick) opts.onPick({ file: src.file, quality: src.quality, size: src.size, index: i }); };
    });
    App.openLayer('sheet', s.layer, { focus: focus || Focus.firstIn(s.list), name: 'quality', onFocus: function (n) { sheetFocus(s, n); } });
  }

  /* ---------- Live source picker (the site's .sidebarbg2) ---------- */

  var src = { open: false, list: [], sheet: null, autoTimer: null, pick: null, title: '' };

  function qualityClass(q) { return q === '4K' || q === '8K' ? ' is-4k' : q === '1080p' || q === 'Original' ? ' is-1080' : ''; }

  function sourceRow(list, s, i, preferred) {
    var r = el('div', 'mb-source', null, list);
    Kit.focusable(r, 'src|' + i + '|' + (s.file || ''));
    r.setAttribute('data-source-index', String(i));
    el('div', 'mb-qbadge' + qualityClass(s.quality), s.quality || 'File', r);
    el('div', 'mb-source-file', s.file || ('File ' + (i + 1)), r);
    el('div', 'mb-source-meta', Kit.metaLine([s.size, s.date]), r);
    if (preferred) el('div', 'mb-source-pref', 'Preferred', r);
    return r;
  }

  /* Fallback parser when Site.live.sourceList is unavailable: quality icon, file name, size, date. */
  function parseLi(li, i) {
    var imgSrc = '', file = '', size = '', date = '';
    U.each(U.qsa(li, 'img'), function (im) { var m = /ic_choose_([a-z0-9]+)\./i.exec(im.getAttribute('src') || ''); if (m && !imgSrc && !/fromat|vip/i.test(m[1])) imgSrc = m[1].toLowerCase(); });
    U.each(U.qsa(li, 'span'), function (sp) {
      if (sp.children && sp.children.length) return;
      var t = U.text(sp.textContent);
      if (!size && /^\d+(\.\d+)?\s*(KB|MB|GB|TB)$/i.test(t)) size = t;
      else if (!date && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t)) date = t;
      else if (!file && /\.[a-z0-9]{2,4}$/i.test(t)) file = t;
    });
    var map = { '4k': '4K', fullhd: '1080p', hd: '720p', sd: 'SD', org: 'Original' };
    return { index: i, quality: map[imgSrc] || '', file: file, size: size, date: date, el: li };
  }

  function liveSources() {
    var list = [];
    try { list = Site.live.sourceList() || []; } catch (e) { list = []; }
    if (!list.length) {
      var lis = [];
      try { lis = Site.live.sourceItems() || []; } catch (e2) { lis = []; }
      list = U.map(lis, parseLi);
    }
    return list;
  }

  /* Index of the preferred source, and whether it is an exact match for auto-selection. */
  function preferred(list, pref, pick) {
    var i, best = -1, bestRank = -1;
    if (pick && pick.file) {
      for (i = 0; i < list.length; i++) if (list[i].file === pick.file) return { index: i, match: true };
    }
    if (pick && pick.quality) {
      for (i = 0; i < list.length; i++) if (list[i].quality === pick.quality) return { index: i, match: true };
    }
    for (i = 0; i < list.length; i++) { var r = RANK[list[i].quality] || 0; if (r > bestRank) { bestRank = r; best = i; } }
    if (pref === 'best') return { index: Math.max(0, best), match: best >= 0 };
    if (pref === '1080p' || pref === '720p') {
      for (i = 0; i < list.length; i++) if (list[i].quality === pref) return { index: i, match: true };
      var want = RANK[pref], near = -1, nearRank = -1;
      for (i = 0; i < list.length; i++) { var q = RANK[list[i].quality] || 0; if (q <= want && q > nearRank) { nearRank = q; near = i; } }
      return { index: near >= 0 ? near : Math.max(0, best), match: false };
    }
    return { index: Math.max(0, best), match: false };
  }

  function openSources(opts) {
    opts = opts || {};
    var list = liveSources();
    if (!list.length) return false;
    if (src.open) closeSources(false);
    src.list = list;
    src.pick = opts.pick || null;
    var pref = Screens.pref('quality', 'best');
    var choice = preferred(list, pref, src.pick);
    var s = sheet({ name: 'sources', kicker: 'Choose a file', title: opts.title || 'Play', sub: list.length + (list.length === 1 ? ' file available' : ' files available') + (pref !== 'ask' ? '  \u00b7  Preferred: ' + Screens.qualityLabel(pref) : '') });
    src.sheet = s;
    var focus = null;
    U.each(list, function (item, i) {
      var r = sourceRow(s.list, item, i, i === choice.index && pref !== 'ask');
      if (i === choice.index) focus = r;
      r.__run = function () { chooseSource(i); };
    });
    src.open = true;
    document.documentElement.className += ' mbptv-sources';
    App.openLayer('sheet', s.layer, {
      focus: focus, name: 'sources',
      onFocus: function (n) { sheetFocus(s, n); },
      onAnyKey: function () { clearTimeout(src.autoTimer); },
      onBack: function () { closeSources(true); App.cancelPlayback(); }
    });
    var auto = (src.pick && choice.match) || (pref !== 'ask' && choice.match && opts.auto !== false);
    if (auto) {
      src.autoTimer = U.later(function () { if (src.open && src.list === list) chooseSource(choice.index); }, 400, 'source-auto');
    }
    return true;
  }

  function chooseSource(i) {
    var item = src.list[i];
    clearTimeout(src.autoTimer);
    if (!item) return;
    App.toast('Playing ' + Kit.metaLine([item.quality || 'file', item.size]));
    closeSources(false);
    var li = item.el;
    var ok = false;
    try { ok = Site.live.click(li); } catch (e) { Log.warn('source-click', e); }
    if (!ok && li && li.click) { try { li.click(); ok = true; } catch (e2) {} }
    Log.info('source', (item.quality || '?') + ' ' + (item.file || ''));
    App.awaitPlayer();
  }

  function closeSources(closeSite) {
    clearTimeout(src.autoTimer);
    if (closeSite) { try { Site.live.closeSourcePicker(); } catch (e) {} }
    if (src.open) {
      src.open = false;
      App.closeLayer('sheet');
    }
    document.documentElement.className = String(document.documentElement.className).replace(/\s*\bmbptv-sources\b/g, '');
    src.list = [];
  }

  var sources = {
    open: openSources, close: closeSources,
    isOpen: function () { return src.open; },
    choose: chooseSource
  };

  /* ---------- Starting-playback overlay ---------- */

  var starting = { node: null };

  function showStarting(info) {
    var root = document.getElementById('mbptv');
    if (!root) return;
    hideStarting();
    info = info || {};
    var n = el('div', 'mb-starting');
    var art = el('div', 'mb-art', null, n);
    var img = el('img', 'mb-img mb-art-img', null, art);
    img.setAttribute('alt', '');
    if (Kit.safeImage(info.backdrop)) {
      img.onload = U.guard(function () { U.toggleClass(img, 'is-loaded', true); }, 'start-art');
      img.src = info.backdrop;
    }
    el('div', 'mb-scrim-l', null, n);
    el('div', 'mb-scrim-b', null, n);
    var inner = el('div', 'mb-starting-inner', null, n);
    Kit.spinner(inner);
    el('div', 'mb-kicker', 'Starting playback', inner);
    el('div', 'mb-display', info.title || '', inner);
    el('div', 'mb-meta', info.hint || 'Waiting for the website\u2019s player  \u00b7  Press Back to cancel', inner);
    root.appendChild(n);
    root.setAttribute('data-overlay', 'starting');
    starting.node = n;
  }

  function hideStarting() {
    if (starting.node) U.detach(starting.node);
    starting.node = null;
    var root = document.getElementById('mbptv');
    if (root) root.removeAttribute('data-overlay');
  }

  /* ---------- Website mode: spatial ring over the site, TV pill, popup handling ---------- */

  var NATIVE_SEL = 'a[href], button, input, select, textarea, [onclick], [role="button"], [tabindex], li.play, .start_app, ' +
    '.start_app_episode, .login_more img, .close, .close2, .tips_close, .fav_close, .radio, label, .search_submit, ' +
    '.sidebarbg2 li, [oss_download_url]';
  var web = { on: false, cur: null, ring: null, pill: null, timer: null, scope: null, onBack: null, here: false, typing: false, offScroll: null };

  function isOurs(n) {
    for (var p = n; p && p.nodeType === 1; p = p.parentNode) {
      if (p.id === 'mbptv' || p.id === 'mbptv-osd' || p.id === 'mbptv-ring') return true;
    }
    return false;
  }

  function textInput(n) {
    if (!n || n.nodeType !== 1) return false;
    if (n.isContentEditable) return true;
    if (n.tagName === 'TEXTAREA') return true;
    if (n.tagName !== 'INPUT') return false;
    return !/^(button|submit|reset|checkbox|radio|range|image|file|color|hidden)$/i.test(n.type || 'text');
  }

  /* Inline links that wrap block content report a tiny box of their own; use the first child's box instead. */
  function rectOf(n) {
    var r = n.getBoundingClientRect();
    if ((r.width < 4 || r.height < 4) && n.firstElementChild) {
      var c = n.firstElementChild.getBoundingClientRect();
      if (c.width >= 4 && c.height >= 4) return c;
    }
    return r;
  }

  function candidates() {
    var scope = web.scope && document.documentElement.contains(web.scope) ? web.scope : document.body;
    var list = U.qsa(scope, NATIVE_SEL), out = [], mark = '__mbptvCand' + U.now();
    var vw = window.innerWidth, vh = window.innerHeight;
    for (var i = 0; i < list.length && out.length < 500; i++) {
      var n = list[i];
      if (isOurs(n) || n.getAttribute('tabindex') === '-1' && !n.getAttribute('onclick') && n.tagName !== 'A') continue;
      if (n.tagName === 'INPUT' && /^hidden$/i.test(n.type)) continue;
      var r = rectOf(n);
      if (r.width < 4 || r.height < 4) continue;
      if (r.bottom < -vh * 3 || r.top > vh * 6 || r.right < 0 || r.left > vw) continue;
      var cs = window.getComputedStyle(n);
      if (!cs || cs.visibility === 'hidden' || cs.display === 'none') continue;
      n[mark] = true;
      out.push(n);
    }
    var kept = U.filter(out, function (n) {
      for (var p = n.parentNode; p && p.nodeType === 1 && p !== scope; p = p.parentNode) if (p[mark]) return false;
      return true;
    });
    U.each(out, function (n) { try { delete n[mark]; } catch (e) { n[mark] = false; } });
    if (!web.scope && web.pill && U.hasClass(web.pill, 'is-visible')) kept.push(web.pill);
    return kept;
  }

  function ensureWebNodes() {
    if (!web.ring || !document.documentElement.contains(web.ring)) {
      web.ring = document.getElementById('mbptv-ring') || el('div');
      web.ring.id = 'mbptv-ring';
      document.body.appendChild(web.ring);
    }
    if (!web.pill || !document.documentElement.contains(web.pill)) {
      web.pill = document.getElementById('mbptv-pill') || el('div');
      web.pill.id = 'mbptv-pill';
      U.empty(web.pill);
      Kit.monogram(web.pill);
      el('span', 'mbp-label', 'TV app', web.pill);
      el('span', 'mbp-hint', 'Blue', web.pill);
      web.pill.setAttribute('role', 'button');
      U.on(web.pill, 'click', function (ev) { ev.preventDefault(); App.exitWebsite(); });
      document.body.appendChild(web.pill);
    }
    U.toggleClass(web.ring, 'mb-reduce', !!Screens.pref('reduceMotion', false));
  }

  function paintRing() {
    if (!web.on || !web.ring) return;
    var n = web.cur;
    if (!n || n === web.pill || !document.documentElement.contains(n)) { U.toggleClass(web.ring, 'is-visible', false); return; }
    var r = rectOf(n);
    if (r.width < 2 || r.height < 2) { U.toggleClass(web.ring, 'is-visible', false); return; }
    var pad = 4;
    web.ring.style.width = Math.round(r.width + pad * 2) + 'px';
    web.ring.style.height = Math.round(r.height + pad * 2) + 'px';
    Kit.transform(web.ring, 'translate3d(' + Math.round(r.left - pad) + 'px,' + Math.round(r.top - pad) + 'px,0)');
    U.toggleClass(web.ring, 'is-visible', true);
  }

  function reveal(n) {
    if (!n || n === web.pill) return;
    var r = rectOf(n), vh = window.innerHeight, margin = vh * 0.12;
    var dy = 0;
    if (r.top < margin) dy = r.top - margin;
    else if (r.bottom > vh - margin) dy = r.bottom - (vh - margin);
    if (dy) { try { window.scrollBy(0, Math.round(dy)); } catch (e) {} }
  }

  function webFocus(n) {
    if (web.pill) U.toggleClass(web.pill, 'is-focused', n === web.pill);
    web.cur = n;
    if (!n) { paintRing(); return; }
    if (n !== web.pill) {
      reveal(n);
      try { if (!textInput(n)) n.focus({ preventScroll: true }); } catch (e) { try { n.focus(); } catch (e2) {} }
      /* Images and divs with onclick cannot take DOM focus: drop the browser's own outline from the previous one. */
      var a = document.activeElement;
      if (a && a !== n && a !== document.body && !isOurs(a) && !textInput(a)) { try { a.blur(); } catch (e3) {} }
    }
    paintRing();
  }

  function initialWeb() {
    var list = candidates(), vh = window.innerHeight;
    if (web.scope) {
      var close = U.find(list, function (n) { return U.matches(n, '.close, .close2, .tips_close, .fav_close, [class*="close"]') || U.qs(n, '[class*="close"]'); });
      return close || list[0] || null;
    }
    var visible = U.filter(list, function (n) { var r = rectOf(n); return r.top >= 0 && r.bottom <= vh && n !== web.pill; });
    visible.sort(function (a, b) { var ra = rectOf(a), rb = rectOf(b); return (ra.top - rb.top) || (ra.left - rb.left); });
    return visible[0] || list[0] || null;
  }

  function nearestNative(from, dir) {
    var list = candidates();
    if (!from || !document.documentElement.contains(from)) return initialWeb();
    var c = rectOf(from), best = null, bestScore = Infinity;
    var ccx = c.left + c.width / 2, ccy = c.top + c.height / 2;
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n === from) continue;
      var r = rectOf(n), cx = r.left + r.width / 2, cy = r.top + r.height / 2, primary, secondary;
      if (dir === 'right') { if (cx <= ccx + 2 || r.left < c.left + 2) continue; primary = Math.max(0, r.left - c.right); secondary = Math.abs(cy - ccy); }
      else if (dir === 'left') { if (cx >= ccx - 2 || r.right > c.right - 2) continue; primary = Math.max(0, c.left - r.right); secondary = Math.abs(cy - ccy); }
      else if (dir === 'down') { if (cy <= ccy + 2 || r.top < c.top + 2) continue; primary = Math.max(0, r.top - c.bottom); secondary = Math.abs(cx - ccx); }
      else { if (cy >= ccy - 2 || r.bottom > c.bottom - 2) continue; primary = Math.max(0, c.top - r.bottom); secondary = Math.abs(cx - ccx); }
      var score = primary + secondary * 2;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  function startWeb(opts) {
    opts = opts || {};
    ensureWebNodes();
    web.on = true;
    web.scope = opts.scope || null;
    web.onBack = opts.onBack || null;
    web.here = !!opts.here;
    web.typing = false;
    U.toggleClass(web.pill, 'is-visible', !web.scope);
    webFocus(initialWeb());
    clearInterval(web.timer);
    web.timer = setInterval(U.guard(function () {
      if (!web.on) return;
      if (web.cur && !document.documentElement.contains(web.cur)) webFocus(initialWeb());
      else paintRing();
    }, 'web-ring'), 500);
    if (!web.offScroll) web.offScroll = U.on(window, 'scroll', function () { if (web.on) paintRing(); }, true);
  }

  function stopWeb() {
    web.on = false;
    web.scope = null;
    web.onBack = null;
    clearInterval(web.timer);
    if (web.offScroll) { web.offScroll(); web.offScroll = null; }
    if (web.ring) U.toggleClass(web.ring, 'is-visible', false);
    if (web.pill) { U.toggleClass(web.pill, 'is-visible', false); U.toggleClass(web.pill, 'is-focused', false); }
    web.cur = null;
  }

  function activateNative(n) {
    if (!n) return;
    if (n === web.pill) { App.exitWebsite(); return; }
    if (textInput(n) || n.tagName === 'SELECT') {
      web.typing = true;
      try { n.focus(); } catch (e) {}
      try { n.click(); } catch (e2) {}
      paintRing();
      return;
    }
    try { Site.live.click(n) || n.click(); } catch (e3) { try { n.click(); } catch (e4) {} }
    U.later(function () { if (web.on && web.cur && !document.documentElement.contains(web.cur)) webFocus(initialWeb()); else paintRing(); }, 300, 'web-after-click');
  }

  function webKey(name, ev) {
    var active = document.activeElement;
    var typing = textInput(active) && !isOurs(active);
    if (name === 'blue' || name === 'info') { if (!web.scope) { App.exitWebsite(); return true; } }
    if (name === 'back') {
      if (typing) { try { active.blur(); } catch (e) {} web.typing = false; paintRing(); return true; }
      if (web.onBack) { web.onBack(); return true; }
      App.websiteBack();
      return true;
    }
    if (typing) {
      if (name === 'up' || name === 'down') { try { active.blur(); } catch (e2) {} web.typing = false; }
      else return false;
    }
    if (!Screens.pref('nativeRemote', true) && !web.scope) return false;
    if (name === 'left' || name === 'right' || name === 'up' || name === 'down') {
      var next = nearestNative(web.cur, name);
      if (next) webFocus(next);
      else if (name === 'up' || name === 'down') { try { window.scrollBy(0, (name === 'up' ? -1 : 1) * Math.round(window.innerHeight * 0.3)); } catch (e3) {} paintRing(); }
      return true;
    }
    if (name === 'enter') {
      if (!web.cur || !document.documentElement.contains(web.cur)) { webFocus(initialWeb()); return true; }
      activateNative(web.cur);
      return true;
    }
    return false;
  }

  var website = { start: startWeb, stop: stopWeb, key: webKey, active: function () { return web.on; }, refresh: paintRing };

  return {
    dialog: dialog, exitDialog: exitDialog, sheet: sheet, quality: quality, qualityPref: qualityPref,
    sources: sources, showStarting: showStarting, hideStarting: hideStarting,
    startingShown: function () { return !!starting.node; }, web: website, preferred: preferred
  };
}());

/* Player mode: the website's own player is on screen and our shell is hidden. Keys drive the <video>;
   the OSD (#mbptv-osd) shows title, progress and hints and never blocks the picture. */
var Player = (function () {
  var osd = null, els = {}, hideTimer = null, tickTimer = null, seekTimer = null, flashTimer = null;
  var active = false, info = {}, pendingSeek = null, streak = 0, lastDir = 0, lastSeekAt = 0;

  /* The site's player may put an element into browser fullscreen, which paints above everything outside it:
     keep the OSD inside that element while it is fullscreen, and on <body> otherwise. */
  function host() {
    var fs = null;
    try { fs = document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || null; } catch (e) { fs = null; }
    if (fs && fs.nodeType === 1 && fs !== document.documentElement && fs !== document.body && !/^(VIDEO|IFRAME|OBJECT|EMBED|IMG|CANVAS)$/.test(fs.tagName)) return fs;
    return document.body;
  }

  function ensure() {
    if (osd && document.documentElement.contains(osd)) {
      var h = host();
      if (h && osd.parentNode !== h) { try { h.appendChild(osd); } catch (e) {} }
      return osd;
    }
    osd = document.getElementById('mbptv-osd') || U.el('div');
    osd.id = 'mbptv-osd';
    U.empty(osd);
    var inner = U.el('div', 'mbo-inner', null, osd);
    els.seek = U.el('div', 'mbo-seek', '', osd);
    els.title = U.el('div', 'mbo-title', '', inner);
    var row = U.el('div', 'mbo-row', null, inner);
    els.state = U.el('span', 'mbo-state', null, row);
    var bar = U.el('div', 'mbo-bar', null, row);
    els.fill = U.el('div', 'mbo-fill', null, bar);
    els.knob = U.el('div', 'mbo-knob', null, bar);
    els.time = U.el('div', 'mbo-time', '', row);
    var hints = U.el('div', 'mbo-hints', null, inner);
    function hint(key, label, icons) {
      var h = U.el('span', 'mbo-hint', null, hints), k = U.el('span', 'mbo-key', key, h);
      U.each(icons || [], function (name) { k.appendChild(Icons.el(name, 'mbo-kico')); });
      U.el('span', null, label, h);
    }
    hint('OK', 'Play / Pause');
    hint('', 'Seek 10 s, hold to go faster', ['chevronLeft', 'chevronRight']);
    hint('Back', 'Close player');
    (host() || document.body).appendChild(osd);
    return osd;
  }

  function video() { try { return Site.live.video(); } catch (e) { return null; } }

  function fmt(t) {
    if (!(t >= 0) || t === Infinity) return '--:--';
    t = Math.floor(t);
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function update() {
    if (!osd) return;
    var v = video();
    var cur = v ? v.currentTime : 0, dur = v ? v.duration : 0;
    if (pendingSeek != null) cur = pendingSeek;
    var pct = dur > 0 && dur !== Infinity ? U.clamp(cur / dur, 0, 1) * 100 : 0;
    els.fill.style.width = pct + '%';
    els.knob.style.left = pct + '%';
    els.time.textContent = fmt(cur) + ' / ' + fmt(dur);
    var playing = v && !v.paused && !v.ended;
    var want = playing ? 'pause' : 'play';
    if (els.state.__icon !== want) { U.empty(els.state); els.state.appendChild(Icons.el(want)); els.state.__icon = want; }
  }

  function show(ms) {
    ensure();
    els.title.textContent = info.title || '';
    update();
    U.toggleClass(osd, 'mb-reduce', !!Screens.pref('reduceMotion', false));
    U.toggleClass(osd, 'is-visible', true);
    clearTimeout(hideTimer);
    hideTimer = U.later(hide, ms || 3000, 'osd-hide');
  }

  function hide() { if (osd) U.toggleClass(osd, 'is-visible', false); }

  function playVideo(v) {
    try { var p = v.play(); if (p && typeof p.then === 'function') p.then(null, function () {}); } catch (e) { Log.warn('player-play', e); }
  }

  function toggle() {
    var v = video();
    if (!v) { show(); return; }
    if (v.paused || v.ended) playVideo(v); else { try { v.pause(); } catch (e) {} }
    U.later(update, 60, 'osd-update');
    show(v.paused ? 3000 : 3000);
  }

  function flash(text) {
    if (!els.seek) return;
    els.seek.textContent = text;
    U.toggleClass(els.seek, 'is-on', true);
    clearTimeout(flashTimer);
    flashTimer = U.later(function () { U.toggleClass(els.seek, 'is-on', false); }, 900, 'osd-flash');
  }

  function seek(dir, ev) {
    var v = video();
    if (!v) { show(); return; }
    var t = U.now();
    if (dir === lastDir && (t - lastSeekAt < 650 || (ev && ev.repeat))) streak++; else streak = 0;
    lastDir = dir; lastSeekAt = t;
    var step = streak >= 6 ? 30 : streak >= 3 ? 20 : 10;
    var base = pendingSeek != null ? pendingSeek : v.currentTime || 0;
    var dur = v.duration > 0 && v.duration !== Infinity ? v.duration : base + 3600;
    pendingSeek = U.clamp(base + dir * step, 0, Math.max(0, dur - 1));
    flash((dir > 0 ? '+' : '\u2212') + step + ' s');
    show(3000);
    clearTimeout(seekTimer);
    seekTimer = U.later(function () {
      var vv = video();
      if (vv && pendingSeek != null) { try { vv.currentTime = pendingSeek; } catch (e) { Log.warn('seek', e); } }
      pendingSeek = null;
      update();
    }, 280, 'seek-apply');
  }

  function key(name, ev) {
    var v;
    switch (name) {
      case 'enter': case 'playpause': toggle(); return true;
      case 'play': v = video(); if (v) playVideo(v); show(); return true;
      case 'pause': v = video(); if (v) { try { v.pause(); } catch (e) {} } show(); return true;
      case 'left': case 'rw': seek(-1, ev); return true;
      case 'right': case 'ff': seek(1, ev); return true;
      case 'up': case 'down': case 'info': show(4000); return true;
      case 'back': case 'stop': App.closePlayer(); return true;
      default: return true;
    }
  }

  function start(i) {
    info = i || {};
    active = true;
    pendingSeek = null; streak = 0;
    ensure();
    show(3500);
    clearInterval(tickTimer);
    tickTimer = setInterval(U.guard(function () { if (active && osd && U.hasClass(osd, 'is-visible')) update(); }, 'osd-tick'), 500);
  }

  function stop() {
    active = false;
    clearInterval(tickTimer);
    clearTimeout(seekTimer);
    pendingSeek = null;
    hide();
    if (osd && document.body && osd.parentNode && osd.parentNode !== document.body) { try { document.body.appendChild(osd); } catch (e) {} }
  }

  return { start: start, stop: stop, key: key, show: show, active: function () { return active; } };
}());
