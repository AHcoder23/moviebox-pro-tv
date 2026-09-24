/* App: root, rail, screen stack, key dispatch, play flow, player / website / popup modes, watchdog.
   Everything asynchronous is guarded; any failure degrades to an error screen with Retry / Open website / Home,
   and a shell that cannot run at all removes itself so the website stays usable. */
var App = (function () {
  var root = null, rail = null, stage = null, railItems = {};
  var stack = [], layers = [];
  var mode = 'boot';
  var started = false, routed = false, dead = false;
  var page = { type: 'other', title: null, url: '' };
  var pending = null, popupEl = null, modeBeforePopup = 'shell';
  var moveLock = false, selfTestResult = null, webHere = false, cancelledAt = 0;
  var timers = { watchdog: null, monitor: null, boot: null };
  var offs = [];
  var KEEP = 4;
  var WEB_KEY = 'mbptv:web:v1', PICK_KEY = 'mbptv:pick:v1';

  function el(tag, cls, text, parent) { return U.el(tag, cls, text, parent); }

  function top() { return stack.length ? stack[stack.length - 1] : null; }
  function topInst() { var t = top(); return t && t.inst; }
  function topLayer() { return layers.length ? layers[layers.length - 1] : null; }

  function pageType() { return page.type; }

  /* ---------- Root and rail ---------- */

  function buildRail() {
    rail = Kit.zone(el('div', 'mb-rail'), 'rail');
    el('div', 'mb-rail-bg', null, rail);
    var head = el('div', 'mb-rail-head', null, rail);
    Kit.monogram(head);
    el('span', 'mb-rail-brand', 'MovieBox Pro', head);
    var items = el('div', 'mb-rail-items', null, rail);
    var defs = [['search', 'Search', 'search'], ['home', 'Home', 'home'], ['movies', 'Movies', 'film'], ['shows', 'TV Shows', 'tv'],
      ['library', 'My Library', 'library'], ['-'], ['settings', 'Settings', 'settings']];
    U.each(defs, function (d) {
      if (d[0] === '-') { el('div', 'mb-rail-sep', null, items); return; }
      var it = el('div', 'mb-rail-item', null, items);
      Kit.focusable(it, 'nav|' + d[0], 'nav-' + d[0]);
      it.appendChild(Icons.el(d[2]));
      el('span', 'mb-rail-label', d[1], it);
      railItems[d[0]] = it;
    });
    return rail;
  }

  function buildRoot() {
    var old = document.getElementById('mbptv');
    if (old) U.detach(old);
    root = el('div');
    root.id = 'mbptv';
    root.setAttribute('data-screen', 'loading');
    root.setAttribute('data-layer', '');
    root.setAttribute('tabindex', '-1');
    root.appendChild(buildRail());
    stage = el('div', 'mb-stage', null, root);
    document.body.appendChild(root);
  }

  /* The website's scripts may rebuild parts of the page: put our root and our stylesheet back if they vanish. */
  function ensureAttached() {
    if (!root || dead) return;
    if (!document.documentElement.contains(root) && document.body) {
      Log.warn('app', 'root was detached; re-attaching');
      document.body.appendChild(root);
    }
    if (!document.getElementById('mbptv-css') && typeof Boot !== 'undefined' && Boot.injectStyles) {
      Log.warn('app', 'stylesheet was removed; re-adding');
      try { Boot.injectStyles(); } catch (e) { Log.warn('app', e); }
    }
  }

  function applyPrefs() {
    if (!root) return;
    U.toggleClass(root, 'mb-reduce', !!Screens.pref('reduceMotion', false));
  }

  function setScreenAttr(name) { if (root) root.setAttribute('data-screen', name); }

  function setModeClass() {
    if (!root) return;
    U.toggleClass(root, 'is-hidden', mode !== 'shell' && mode !== 'boot');
  }

  /* ---------- Focus plumbing ---------- */

  function scopes() {
    var l = topLayer();
    if (l) return [l.el];
    var inst = topInst(), out = [];
    if (!inst || mode !== 'shell') return out;
    if (inst.rail !== false) out.push(rail);
    out.push(inst.el);
    return out;
  }

  function onFocusChange(node, prev) {
    var inRail = !!(rail && rail.contains(node));
    U.toggleClass(root, 'rail-open', inRail);
    var parent = node.parentNode;
    if (parent && U.hasClass(parent, 'mb-track')) Kit.scrollTrack(parent, node);
    var l = topLayer();
    if (l) { if (l.opts.onFocus) U.guard(l.opts.onFocus, 'layer-focus')(node); return; }
    var entry = top();
    if (entry && entry.inst && entry.inst.el.contains(node)) {
      entry.lastFocus = node;
      if (entry.inst.onFocus) U.guard(entry.inst.onFocus, 'screen-focus')(node, prev);
      Kit.lazySoon(entry.inst.el);
    }
  }

  function exitHook(from, zone, dir) {
    if (zone === rail) {
      if (dir === 'right') {
        var entry = top(), inst = entry && entry.inst;
        if (!inst) return false;
        var last = entry.lastFocus;
        if (last && Focus.shown(last) && inst.el.contains(last)) return last;
        return inst.initialFocus() || Focus.firstIn(inst.el) || false;
      }
      return false;
    }
    return null;
  }

  function focus(node) {
    if (!node) return false;
    return Focus.set(node);
  }

  function focusScreenDefault() {
    var l = topLayer();
    if (l) { focus(l.opts.focus && Focus.shown(l.opts.focus) ? l.opts.focus : Focus.firstIn(l.el)); return; }
    var entry = top(), inst = entry && entry.inst;
    if (!inst) return;
    var target = null;
    if (entry.focusKey) target = Focus.byKey(inst.el, entry.focusKey) || (rail && Focus.byKey(rail, entry.focusKey));
    if (!target && entry.lastFocus && Focus.shown(entry.lastFocus) && inst.el.contains(entry.lastFocus)) target = entry.lastFocus;
    if (!target) { try { target = inst.initialFocus(); } catch (e) { Log.warn('initial-focus', e); } }
    if (target) focus(target);
    else { Focus.blur(); try { root.focus(); } catch (e2) {} }
  }

  /* ---------- Screens and stack ---------- */

  function createInst(entry) {
    try {
      return Screens.create(entry.screen, entry.params, { live: !!entry.live });
    } catch (e) {
      Log.error('render:' + entry.screen, e);
      return Screens.create('error', { err: { code: 'render', message: String(e && e.message || e) }, websiteUrl: websiteUrlFor(entry) });
    }
  }

  function destroyInst(entry) {
    var inst = entry && entry.inst;
    if (!inst) return;
    inst.alive = false;
    try { if (inst.destroy) inst.destroy(); } catch (e) { Log.warn('destroy', e); }
    U.detach(inst.el);
    entry.inst = null;
  }

  function evict() {
    for (var i = 0; i < stack.length - KEEP; i++) {
      if (stack[i].inst && i !== 0) destroyInst(stack[i]);
    }
  }

  function showEntry(entry) {
    if (!entry) return;
    if (!entry.inst) entry.inst = createInst(entry);
    entry.touched = false;
    var inst = entry.inst;
    U.each(stack, function (e) { if (e !== entry && e.inst) { U.toggleClass(e.inst.el, 'is-current', false); } });
    if (inst.el.parentNode !== stage) stage.appendChild(inst.el);
    U.toggleClass(inst.el, 'is-current', true);
    setScreenAttr(inst.name);
    U.toggleClass(root, 'no-rail', inst.rail === false);
    var nav = inst.nav || entry.nav || '';
    for (var k in railItems) if (railItems.hasOwnProperty(k)) U.toggleClass(railItems[k], 'is-active', k === nav);
    rail.__mbLast = railItems[nav] || railItems.home;
    U.toggleClass(root, 'rail-open', false);
    try { if (inst.onShow) inst.onShow(); } catch (e) { Log.warn('onShow', e); }
    if (mode === 'shell') focusScreenDefault();
    Kit.lazySoon(inst.el);
  }

  function rememberFocus() {
    var entry = top(), cur = Focus.current();
    if (entry && entry.inst && cur && entry.inst.el.contains(cur)) entry.focusKey = Focus.keyOf(cur);
  }

  function push(name, params, opts) {
    opts = opts || {};
    if (mode !== 'shell') leaveToShell();
    closeAllLayers();
    rememberFocus();
    var cur = top();
    if (cur && cur.inst && cur.inst.onHide) { try { cur.inst.onHide(); } catch (e) {} }
    var entry = { screen: name, params: params || {}, focusKey: '', live: !!opts.live, nav: (cur && cur.inst && cur.inst.nav) || (cur && cur.nav) || '' };
    stack.push(entry);
    evict();
    showEntry(entry);
    return entry;
  }

  function pop() {
    if (stack.length <= 1) return false;
    closeAllLayers();
    var old = stack.pop();
    destroyInst(old);
    showEntry(top());
    return true;
  }

  function resetTo(entries) {
    closeAllLayers();
    U.each(stack, destroyInst);
    stack = [];
    U.each(entries, function (e) { stack.push({ screen: e.screen, params: e.params || {}, focusKey: e.focusKey || '', live: !!e.live }); });
    if (!stack.length) stack.push({ screen: 'home', params: {}, focusKey: '' });
    showEntry(top());
  }

  /* Rail destinations sit directly above Home: Back from any of them returns Home, Back on Home asks to exit. */
  function navRoot(name, params, nav) {
    var t = top();
    if (t && t.inst && t.screen === name && (t.inst.nav || '') === (nav || t.inst.nav)) { focusScreenDefault(); return; }
    if (mode !== 'shell') leaveToShell();
    closeAllLayers();
    while (stack.length > 1) destroyInst(stack.pop());
    if (!stack.length || stack[0].screen !== 'home') { U.each(stack, destroyInst); stack = [{ screen: 'home', params: {}, focusKey: '' }]; }
    if (name === 'home') { showEntry(top()); return; }
    push(name, params);
  }

  function nav(name) {
    var su = Screens.siteUrl;
    if (name === 'home') navRoot('home', {}, 'home');
    else if (name === 'search') navRoot('search', {}, 'search');
    else if (name === 'movies') navRoot('browse', { url: su('movies', [], '/movie'), title: 'Movies', kicker: 'Browse', nav: 'movies' }, 'movies');
    else if (name === 'shows') navRoot('browse', { url: su('shows', [], '/tvshow'), title: 'TV Shows', kicker: 'Browse', nav: 'shows' }, 'shows');
    else if (name === 'library') {
      var lib = su('library', [], '/index/index/my_box');
      navRoot('browse', { url: lib, title: 'My Library', kicker: 'Your titles', nav: 'library', tabs: [
        { label: 'Continue watching', href: lib },
        { label: 'Watched', href: U.abs('/index/index/my_box?watched=1', lib) },
        { label: 'Favorites', href: U.abs('/index/index/fav_list', lib) },
        { label: 'History', href: su('history', [], '/index/index/history') }
      ] }, 'library');
    } else if (name === 'settings') navRoot('settings', {}, 'settings');
  }

  function goHome() { nav('home'); }

  /* A screen finished its asynchronous render: restore the remembered focus, or the screen's default unless the
     viewer already moved on their own. */
  function screenReady(inst) {
    var entry = top();
    if (!entry || entry.inst !== inst || mode !== 'shell' || topLayer()) return;
    if (entry.focusKey) {
      var t = Focus.byKey(inst.el, entry.focusKey);
      if (t) { entry.focusKey = ''; focus(t); return; }
    }
    var cur = Focus.current();
    if (entry.touched && cur && Focus.shown(cur) && (rail.contains(cur) || inst.el.contains(cur))) { onFocusChange(cur, null); return; }
    var target = null;
    try { target = inst.initialFocus(); } catch (e) { Log.warn('initial-focus', e); }
    if (target) focus(target); else focusScreenDefault();
  }

  function screenFailed(inst, err) {
    var entry = null;
    U.each(stack, function (e) { if (e.inst === inst) entry = e; });
    if (!entry) return;
    Log.warn('screen:' + entry.screen, err);
    if (err && err.code === 'signed-out') { signedOut(); return; }
    destroyInst(entry);
    entry.inst = Screens.create('error', { err: err, websiteUrl: websiteUrlFor(entry), nav: inst.nav });
    if (entry === top()) showEntry(entry);
  }

  function retry() {
    var entry = top();
    if (!entry) { resetTo([{ screen: 'home' }]); return; }
    if (entry.screen === 'signin') {
      toast('Checking your sign-in\u2026');
      try {
        Api.home(U.guard(function (err) {
          if (err && err.code === 'signed-out') { toast('Still signed out. Finish signing in on the website first.'); return; }
          if (err) { toast('The website didn\u2019t answer. Try again in a moment.'); return; }
          resetTo([{ screen: 'home' }]);
        }, 'signin-retry'));
      } catch (e) { Log.error('signin-retry', e); }
      return;
    }
    destroyInst(entry);
    entry.focusKey = '';
    showEntry(entry);
  }

  function websiteUrlFor(entry) {
    var p = entry && entry.params || {}, su = Screens.siteUrl;
    if (!entry) return location.href;
    if (entry.screen === 'detail' && p.id) return su('title', [p.kind, p.id], '/');
    if (entry.screen === 'browse' && p.url) return p.url;
    if (entry.screen === 'search' && p.query) return su('search', [p.query, p.type || 'all', 1], '/');
    return su('home', [], '/');
  }

  function signedOut() {
    if (mode !== 'shell') leaveToShell();
    var t = top();
    if (t && t.screen === 'signin') return;
    resetTo([{ screen: 'signin' }]);
  }

  /* ---------- Layers ---------- */

  function openLayer(kind, node, opts) {
    closeLayer(kind);
    rememberFocus();
    var l = { kind: kind, el: node, opts: opts || {}, prevFocus: Focus.current() };
    layers.push(l);
    root.appendChild(node);
    root.setAttribute('data-layer', kind);
    U.toggleClass(root, 'rail-open', false);
    focus(l.opts.focus && Focus.shown(l.opts.focus) ? l.opts.focus : Focus.firstIn(node));
    return l;
  }

  function closeLayer(kind) {
    var idx = -1;
    for (var i = layers.length - 1; i >= 0; i--) if (layers[i].kind === kind) { idx = i; break; }
    if (idx < 0) return false;
    var l = layers.splice(idx, 1)[0];
    U.detach(l.el);
    if (l.opts.onClose) U.guard(l.opts.onClose, 'layer-close')();
    var t = topLayer();
    root.setAttribute('data-layer', t ? t.kind : '');
    if (mode === 'shell') {
      if (t) focus(Focus.shown(t.prevFocus) ? t.prevFocus : Focus.firstIn(t.el));
      else if (l.prevFocus && Focus.shown(l.prevFocus) && root.contains(l.prevFocus)) focus(l.prevFocus);
      else focusScreenDefault();
    }
    return true;
  }

  function closeAllLayers() {
    while (layers.length) {
      var l = layers.pop();
      U.detach(l.el);
      if (l.opts.onClose) U.guard(l.opts.onClose, 'layer-close')();
    }
    if (Overlays.sources.isOpen()) Overlays.sources.close(false);
    if (root) root.setAttribute('data-layer', '');
  }

  function hasLayer(kind) { return U.find(layers, function (l) { return l.kind === kind; }) !== null; }

  function toast(msg, ms) { Toast.show(msg, ms); }

  /* ---------- Session persistence ---------- */

  function serialize() {
    rememberFocus();
    var out = [];
    U.each(stack, function (e) {
      if (e.screen === 'loading') return;
      var params = e.params || {};
      if (e.inst && e.inst.alive !== false && e.inst.snapshot) {
        try { var snap = e.inst.snapshot(); if (snap) params = snap; } catch (err) { Log.warn('snapshot', err); }
      }
      if (params.item && typeof params.item === 'object') params.item = Screens.compactItem(Screens.normItem(params.item));
      out.push({ screen: e.screen, params: params, focusKey: e.focusKey || '' });
    });
    return out;
  }

  function saveState() {
    try { Session.save(serialize(), { expect: page.type, returnTo: location.href }); } catch (e) { Log.warn('session-save', e); }
  }

  /* ---------- Modes: shell, native (website), player, popup ---------- */

  function setMode(next) {
    mode = next;
    setModeClass();
  }

  function leaveToShell() {
    if (mode === 'native' || mode === 'popup') Overlays.web.stop();
    if (mode === 'player') Player.stop();
    setMode('shell');
  }

  function enterWebsite(opts) {
    opts = opts || {};
    closeAllLayers();
    Overlays.hideStarting();
    pending = null;
    if (mode === 'player') Player.stop();
    webHere = !!opts.here;
    setMode('native');
    setScreenAttr('native');
    U.toggleClass(root, 'rail-open', false);
    Focus.blur();
    Overlays.web.start({ here: webHere });
    Log.info('mode', 'website');
  }

  function exitWebsite() {
    try { Store.session.remove(WEB_KEY); } catch (e) {}
    Overlays.web.stop();
    setMode('shell');
    Log.info('mode', 'shell');
    /* A page that booted straight into website mode never built a stack (only the loading entry): restore the
       place the viewer left (saved when website mode navigated away) or show this page's natural screen. */
    if (!stack.length || top().screen === 'loading') {
      var saved = null;
      try { saved = Session.take(page.type); } catch (e2) { saved = null; }
      if (!(saved && saved.length && restore(saved))) defaultRoute();
      return;
    }
    try { Session.clear(); } catch (e3) {}
    showEntry(top());
  }

  function hereUrl() { return String(location.href).replace(/#.*$/, ''); }

  /* Website mode survives page loads for 30 minutes as {t, origin, kind}. kind 'here': website view was opened on
     origin, so origin stays in website view. kind 'nav': the shell on origin opened another page in website mode,
     so arriving back on origin returns to the shell. */
  function rememberWebsite(kind) {
    try { Store.session.set(WEB_KEY, { t: U.now(), origin: hereUrl(), kind: kind }); } catch (e) {}
  }

  /* Opens a website page in website mode. '' (or this page) switches in place; another URL navigates there. */
  function openWebsite(url, opts) {
    opts = opts || {};
    if (!url || String(url).replace(/#.*$/, '') === hereUrl()) {
      rememberWebsite('here');
      enterWebsite({ here: true });
      return;
    }
    if (!U.sameSite(url)) { toast('That page is outside MovieBox Pro.'); return; }
    if (opts.persist !== false) rememberWebsite('nav');
    else { try { Store.session.remove(WEB_KEY); } catch (e) {} }
    saveState();
    showLoadingOverlay('Opening the website\u2026');
    location.href = url;
  }

  /* Back in website mode: history-back, or straight back to the shell when website mode was opened on this page. */
  function websiteBack() {
    if (webHere || history.length <= 1) { exitWebsite(); return; }
    var href = location.href;
    try { history.back(); } catch (e) { exitWebsite(); return; }
    U.later(function () { if (mode === 'native' && location.href === href) exitWebsite(); }, 1500, 'web-back');
  }

  function enterPlayer() {
    if (mode === 'player') return;
    pending = null;
    Overlays.hideStarting();
    closeAllLayers();
    if (mode === 'native' || mode === 'popup') Overlays.web.stop();
    setMode('player');
    setScreenAttr('player');
    Focus.blur();
    try { guardFrames(); } catch (eg) {}
    var t = top(), inst = t && t.inst, m = inst && inst.model ? inst.model() : null;
    Player.start({ title: (m && m.title) || (inst && inst.params && inst.params.item && inst.params.item.title) || document.title.replace(/\s*-\s*MovieBoxPro.*$/i, '') });
    Log.info('mode', 'player');
  }

  /* Back in player mode (or the site closed its player). */
  function closePlayer() {
    Player.stop();
    var closed = false;
    try { closed = Site.live.closePlayer(); } catch (e) { Log.warn('close-player', e); }
    if (!closed) Log.warn('player', 'the website player did not close cleanly');
    afterPlayer(true);
  }

  function afterPlayer(viaBack) {
    Player.stop();
    var returnTo = returnTarget();
    if (viaBack && returnTo) {
      setMode('shell');
      showLoadingOverlay('Returning\u2026');
      Log.info('player', 'history.back to ' + returnTo);
      try { history.back(); } catch (e2) {}
      U.later(function () { hideLoadingOverlay(); if (mode === 'shell') showEntry(top()); }, 2500, 'back-fallback');
      return;
    }
    setMode('shell');
    settleUrl();
    if (!stack.length) defaultRoute(); else showEntry(top());
  }

  /* Staying on a ?play=1 page after playback ended, failed or was cancelled: drop play=1 from its URL, so a reload
     or a later Back into this history entry does not make the website start playback again. */
  function settleUrl() {
    var lt = liveTitle();
    if (!lt || !lt.play) return;
    try {
      var clean = Site.url.title(lt.kind, lt.id, lt.season);
      if (clean && U.sameSite(clean) && history.replaceState) history.replaceState(history.state, '', clean);
    } catch (e) { Log.warn('settle-url', e); }
    lt.play = false;
    lt.episode = 0;
    page.url = location.href;
  }

  function enterPopup(node) {
    popupEl = node;
    modeBeforePopup = mode === 'player' ? 'player' : 'shell';
    if (mode === 'player') Player.stop();
    closeAllLayers();
    Overlays.hideStarting();
    setMode('popup');
    setScreenAttr('native');
    Focus.blur();
    Overlays.web.start({ scope: node, onBack: function () {
      try { Site.live.dismissPopup(popupEl); } catch (e) { Log.warn('dismiss', e); }
      U.later(monitor, 60, 'popup-check');
    } });
    Log.info('mode', 'popup ' + (node.className || ''));
  }

  function leavePopup() {
    Overlays.web.stop();
    popupEl = null;
    var playerOpen = false;
    try { playerOpen = Site.live.playerOpen(); } catch (e) {}
    setMode('shell');
    if (playerOpen) { enterPlayer(); return; }
    showEntry(top());
  }

  /* ---------- Loading overlay (navigation in progress) ---------- */

  var loadingNode = null, loadingSince = 0;
  function showLoadingOverlay(msg) {
    hideLoadingOverlay();
    loadingSince = U.now();
    var s = Screens.create('loading', { message: msg });
    loadingNode = s.el;
    U.toggleClass(loadingNode, 'is-current', true);
    loadingNode.style.zIndex = '50';
    root.appendChild(loadingNode);
  }
  function hideLoadingOverlay() { if (loadingNode) U.detach(loadingNode); loadingNode = null; }

  /* ---------- Play flow ---------- */

  function liveTitle() { return page.title && (page.type === 'movie' || page.type === 'tv') ? page.title : null; }

  function playInfo(t) {
    var m = null;
    try { m = Api.meta(t.kind + ':' + t.id); } catch (e) {}
    var title = t.title || (m && m.title) || '';
    if (t.episode && title && !/\bS\d+\s*E\d+/i.test(title)) title += '  \u00b7  S' + t.season + 'E' + t.episode;
    return { title: title, backdrop: t.backdrop || (m && m.backdrop) || (t.item && t.item.backdrop) || '' };
  }

  /* t: {kind, id, season, episode, title, item, playHref, pick} */
  function play(t) {
    if (!t || !t.id) return;
    var kind = t.kind === 'tv' ? 'tv' : 'movie';
    var lt = liveTitle();
    if (t.pick) { try { Store.session.set(PICK_KEY, { key: kind + ':' + t.id, file: t.pick.file || '', quality: t.pick.quality || '', t: U.now() }); } catch (e) {} }
    if (lt && lt.kind === kind && String(lt.id) === String(t.id)) {
      var btn = null;
      try { btn = t.episode ? Site.live.episodeButton(t.season, t.episode) : Site.live.playButton(); } catch (e2) { btn = null; }
      if (btn) {
        beginPending({ kind: kind, id: t.id, season: t.season || 0, episode: t.episode || 0, title: t.title }, true);
        Log.info('play', 'live click ' + kind + ':' + t.id + (t.episode ? ' S' + t.season + 'E' + t.episode : ''));
        if (!Site.live.click(btn)) { try { btn.click(); } catch (e3) {} }
        return;
      }
    }
    var url = '';
    if (t.playHref && U.sameSite(t.playHref)) url = t.playHref;
    if (!url) url = Screens.siteUrl('play', [kind, t.id, t.season || 0, t.episode || 0], '/' + (kind === 'movie' ? 'movie/' : 'tvshow/') + t.id + '?play=1');
    rememberFocus();
    saveState();
    Overlays.showStarting(playInfo(t));
    pending = { t: t, since: U.now(), clicked: true, retried: true, navigating: true };
    Log.info('play', 'navigate ' + url);
    location.href = url;
  }

  function beginPending(t, clicked) {
    cancelledAt = 0;
    pending = { t: t, since: U.now(), clicked: !!clicked, retried: false };
    Overlays.showStarting(playInfo(t));
  }

  /* Back while playback is starting (overlay or source picker). On a ?play=1 page that another page opened,
     go back to that page, which restores its own stack, so it feels like the picker simply closed. */
  function cancelPlayback() {
    pending = null;
    cancelledAt = U.now();
    Overlays.hideStarting();
    if (returnTarget()) {
      Log.info('play', 'cancelled; history.back');
      showLoadingOverlay('Returning\u2026');
      try { history.back(); } catch (e) { hideLoadingOverlay(); }
      U.later(function () { hideLoadingOverlay(); if (mode === 'shell' && top()) showEntry(top()); }, 2500, 'cancel-fallback');
      return;
    }
    settleUrl();
  }

  function returnTarget() {
    if (!(page.title && page.title.play) || history.length <= 1) return '';
    var rt = '';
    try { rt = Session.returnTo(); } catch (e) {}
    if (!rt || String(rt).replace(/#.*$/, '') === String(location.href).replace(/#.*$/, '')) return '';
    return rt;
  }

  /* After a source row was chosen: wait for the player (the monitor switches modes), give up after 10 s. */
  function awaitPlayer() {
    var t = pending && pending.t;
    var cur = topInst(), m = cur && cur.model ? cur.model() : null;
    cancelledAt = 0;
    pending = { t: t || { title: m && m.title }, since: U.now(), clicked: true, retried: true, afterPick: true };
    Overlays.showStarting({ title: (m && m.title) || (t && t.title) || '', backdrop: m && m.backdrop || '' });
  }

  function pendingTick() {
    if (!pending) {
      if (Overlays.startingShown() && mode === 'shell') { Log.warn('play', 'orphaned starting overlay removed'); Overlays.hideStarting(); }
      return;
    }
    var age = U.now() - pending.since;
    if (pending.navigating) {
      if (age > 15000) {
        Log.warn('play', 'the play page did not open in 15 s');
        pending = null;
        Overlays.hideStarting();
        toast('The website didn\u2019t open the player. Try Play again.', 5000);
      }
      return;
    }
    if (age > 5000 && !pending.retried) {
      pending.retried = true;
      var t = pending.t || {}, btn = null;
      try { btn = t.episode ? Site.live.episodeButton(t.season, t.episode) : Site.live.playButton(); } catch (e) { btn = null; }
      Log.warn('play', 'no player after 5 s; clicking the play control' + (btn ? '' : ' (not found)'));
      if (btn) Site.live.click(btn);
    }
    if (age > 10000) {
      Log.warn('play', 'no player after 10 s');
      pending = null;
      Overlays.hideStarting();
      settleUrl();
      toast('The website didn\u2019t start playback. Try Play again.', 5000);
    }
  }

  function takePick() {
    var p = null;
    try { p = Store.session.get(PICK_KEY, null); Store.session.remove(PICK_KEY); } catch (e) {}
    var lt = liveTitle();
    if (!p || !lt || p.key !== lt.kind + ':' + lt.id || U.now() - (+p.t || 0) > 10 * 60 * 1000) return null;
    return p;
  }

  /* ---------- Live page monitor (player, source picker, popups) ---------- */

  function monitor() {
    if (!routed || dead) return;
    if (!liveTitle()) return;
    var live = Site.live;
    if (mode === 'native') return;
    if (mode === 'popup') {
      if (!popupEl || !U.isVisible(popupEl)) leavePopup();
      return;
    }
    var popups = live.blockingPopups() || [];
    if (popups.length) { enterPopup(popups[0]); return; }
    var playerOpen = live.playerOpen();
    if (mode === 'player') { if (!playerOpen) { Log.info('player', 'closed by the website'); afterPlayer(false); } return; }
    var pickerOpen = live.sourcePickerOpen();
    /* The viewer pressed Back while playback was starting: the website may still finish opening its picker or
       player a moment later. Close those instead of dragging the viewer back into playback. */
    if (cancelledAt && U.now() - cancelledAt < 4000 && !pending) {
      if (playerOpen) { Log.info('play', 'closing the player the viewer cancelled'); live.closePlayer(); return; }
      if (pickerOpen && !Overlays.sources.isOpen()) { live.closeSourcePicker(); return; }
    }
    if (playerOpen) { enterPlayer(); return; }
    if (pickerOpen && !Overlays.sources.isOpen()) {
      var m = topInst() && topInst().model ? topInst().model() : null;
      pending = null;
      Overlays.hideStarting();
      if (top() && top().screen !== 'detail') { var lt = liveTitle(); push('detail', { kind: lt.kind, id: lt.id }, { live: true }); }
      if (!Overlays.sources.open({ title: m && m.title || '', pick: takePick(), auto: true })) {
        /* The website's file list could not be read (its markup changed): let the viewer use the website's own
           picker with the focus ring instead of covering it. */
        var box = U.find(U.qsa(document, '.sidebarbg2'), function (n) { return U.isVisible(n); });
        Log.warn('sources', 'file list not recognised; showing the website picker');
        if (box) enterPopup(box);
        else pending = { t: {}, since: U.now(), clicked: true, retried: false };
      }
    } else if (!pickerOpen && Overlays.sources.isOpen()) {
      Overlays.sources.close(false);
    }
    pendingTick();
  }

  /* ---------- Watchdog ---------- */

  function watchdog() {
    if (dead) return;
    ensureAttached();
    if (!routed) return;
    try { guardFrames(); } catch (eg) { Log.warn('frames', eg); }
    setModeClass();
    if (!liveTitle()) pendingTick();
    if (loadingNode && U.now() - loadingSince > 15000) { Log.warn('app', 'navigation overlay timed out'); hideLoadingOverlay(); }
    if (mode === 'shell') {
      if (!stack.length) { defaultRoute(); return; }
      var entry = top();
      if (!entry.inst) showEntry(entry);
      if (!U.hasClass(entry.inst.el, 'is-current') || entry.inst.el.parentNode !== stage) showEntry(entry);
      if (!Focus.valid()) {
        var inst = entry.inst;
        if (inst && (inst.name !== 'loading')) { Log.info('watchdog', 'refocus ' + inst.name); focusScreenDefault(); }
      } else if (document.activeElement !== Focus.current()) {
        try { Focus.current().focus(); } catch (e) {}
      }
      if (liveTitle() && !pending && !(cancelledAt && U.now() - cancelledAt < 4000)) {
        try { if (Site.live.playerOpen()) enterPlayer(); } catch (e2) {}
      }
    } else if (mode === 'native' && !Overlays.web.active()) {
      Overlays.web.start({ here: webHere });
    } else if (mode === 'player') {
      if (!Site.live.playerOpen()) { Log.info('player', 'closed (watchdog)'); afterPlayer(false); }
    }
  }

  /* Remote keys go to whichever document has focus. Same-origin iframes (the website may load its player page
     into one) get our key listener as well; a focused cross-origin iframe (ads, embeds) is blurred. */
  function guardFrames() {
    var active = document.activeElement;
    U.each(U.qsa(document, 'iframe'), function (f) {
      var w = null, same = false;
      try { w = f.contentWindow; same = !!(w && w.document && w.document.documentElement); } catch (e) { same = false; }
      if (same) {
        if (!w.__mbptvKeys) {
          try { w.addEventListener('keydown', U.guard(onKeyDown, 'frame-key'), true); w.__mbptvKeys = true; } catch (e2) {}
        }
      } else if (f === active) {
        try { f.blur(); } catch (e3) {}
        try { if (mode === 'shell') focusScreenDefault(); else root.focus(); } catch (e4) {}
      }
    });
  }

  /* ---------- Keys ---------- */

  var DIRS = { left: 1, right: 1, up: 1, down: 1 };

  /* At most one focus move per animation frame, so held keys never queue up. */
  function move(dir) {
    if (moveLock) return;
    moveLock = true;
    U.frame(function () { moveLock = false; }, 'move-unlock');
    U.later(function () { moveLock = false; }, 120, 'move-unlock-fallback');
    var entry = top();
    if (entry) entry.touched = true;
    if (!Focus.valid()) {
      focusScreenDefault();
      if (!Focus.valid() && !topLayer() && topInst() && topInst().rail !== false) focus(railItems[topInst().nav] || railItems.home);
      return;
    }
    Focus.move(dir);
  }

  function activate(node) {
    if (!node) return;
    var action = node.getAttribute('data-action') || '';
    if (node.__run) { node.__run(); return; }
    if (action.indexOf('nav-') === 0) { nav(action.slice(4)); return; }
    var inst = topInst();
    if (!topLayer() && inst && inst.act && inst.act(action, node)) return;
    switch (action) {
      case 'retry': retry(); return;
      case 'open-website': openWebsite(inst && inst.websiteUrl || websiteUrlFor(top())); return;
      case 'home': goHome(); return;
      case 'signin-qr': openWebsite(Screens.siteUrl('loginQr', [], '/index/login/qrcode'), { persist: false }); return;
      case 'signin-code': openWebsite(Screens.siteUrl('loginCode', [], '/index/login/code_login'), { persist: false }); return;
      case 'signin-google': openWebsite(Screens.siteUrl('login', [], '/index/login'), { persist: false }); return;
      case 'exit': exitApp(); return;
      case 'stay': closeLayer('dialog'); return;
    }
    if (node.__item) push('detail', { kind: node.__item.kind, id: node.__item.id, item: Screens.compactItem(node.__item) });
  }

  function goBack() {
    var inst = topInst();
    if (inst && inst.onBack && inst.onBack()) return;
    if (pop()) return;
    var t = top();
    if (t && t.screen !== 'home' && t.screen !== 'signin') { resetTo([{ screen: 'home' }]); return; }
    Overlays.exitDialog();
  }

  function shellKey(name, ev) {
    if (Overlays.startingShown() && !topLayer()) {
      if (name === 'back') { cancelPlayback(); return true; }
      return true;
    }
    var l = topLayer();
    if (l) {
      if (l.opts.onAnyKey) U.guard(l.opts.onAnyKey, 'layer-key')(name);
      if (name === 'back') {
        if (l.opts.onBack) l.opts.onBack(); else closeLayer(l.kind);
        return true;
      }
      if (DIRS[name]) { move(name); return true; }
      if (name === 'enter') { activate(Focus.current()); return true; }
      return true;
    }
    var inst = topInst();
    if (!inst) return true;
    if (inst.onKey && inst.onKey(name, ev)) return true;
    if (DIRS[name]) { move(name); return true; }
    if (name === 'enter') { activate(Focus.current()); return true; }
    if (name === 'back' || name === 'backspace') { goBack(); return true; }
    if (name === 'char' && inst.name !== 'search' && /^[a-z]$/i.test(Keys.charOf(ev))) {
      navRoot('search', { query: Keys.charOf(ev).toLowerCase() }, 'search');
      return true;
    }
    if (name === 'play' || name === 'playpause') {
      var cur = Focus.current();
      if (cur && cur.__item) { play({ kind: cur.__item.kind, id: cur.__item.id, title: cur.__item.title, item: cur.__item, playHref: cur.__item.playHref }); return true; }
      if (cur && cur.__episode && inst.play) { inst.play(cur.__episode); return true; }
      if (inst.act) inst.act('play', null);
      return true;
    }
    if (name === 'info' && Focus.current() && Focus.current().__item) { activate(Focus.current()); return true; }
    return true;
  }

  function dispatch(name, ev) {
    if (mode === 'native' || mode === 'popup') return Overlays.web.key(name, ev);
    if (mode === 'player') return Player.key(name, ev);
    if (mode === 'boot') {
      if (topLayer()) return shellKey(name, ev);
      if (name === 'back') Overlays.exitDialog();
      return true;
    }
    return shellKey(name, ev);
  }

  function onKeyDown(ev) {
    if (dead) return;
    var name = Keys.name(ev);
    if (!name) return;
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
    var handled = false;
    try { handled = dispatch(name, ev); } catch (e) {
      Log.error('key:' + name, e);
      handled = true;
      keyFailure(name);
    }
    if (handled) {
      if (ev.preventDefault) ev.preventDefault();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      if (ev.stopPropagation) ev.stopPropagation();
    }
  }

  /* Repeated failures while handling keys mean the shell is broken on this page: hand the remote to website
     mode (which has its own, much simpler, navigation) and, if even that fails, remove the shell entirely. */
  var keyErrors = [];
  function keyFailure(name) {
    var now = U.now();
    keyErrors.push(now);
    while (keyErrors.length && now - keyErrors[0] > 15000) keyErrors.shift();
    if (keyErrors.length < 4) {
      if (name === 'back' && mode === 'shell') { try { goHome(); } catch (e) { Log.warn('back-recover', e); } }
      return;
    }
    keyErrors = [];
    if (mode === 'native' || mode === 'popup') { panic('repeated key failures in website mode'); return; }
    try {
      enterWebsite({ here: true });
      toast('Something went wrong. Showing the website \u2014 press Blue to try the TV app again.', 6000);
    } catch (e2) { panic(e2); }
  }

  function onClick(ev) {
    if (mode !== 'shell') return;
    var node = U.closest(ev.target, '[data-f]', root);
    if (!node) return;
    ev.preventDefault();
    focus(node);
    activate(node);
  }

  function exitApp() {
    Log.info('app', 'exit');
    try {
      if (window.tizen && tizen.application) { tizen.application.getCurrentApplication().exit(); return; }
    } catch (e) { Log.warn('exit', e); }
    try { window.close(); } catch (e2) {}
    U.later(function () { closeLayer('dialog'); toast('Press the Home button to leave.'); }, 400, 'exit-fallback');
  }

  /* ---------- Routing ---------- */

  function defaultRoute() {
    var lt = liveTitle();
    if (page.type === 'home') resetTo([{ screen: 'home', live: true }]);
    else if (lt) resetTo([{ screen: 'home' }, { screen: 'detail', params: { kind: lt.kind, id: lt.id, season: lt.season || 0 }, live: true }]);
    else resetTo([{ screen: 'home' }]);
  }

  function restore(saved) {
    var entries = [];
    U.each(saved, function (e) {
      if (!e || typeof e.screen !== 'string' || !Screens.has(e.screen) || e.screen === 'loading' || e.screen === 'error') return;
      entries.push({ screen: e.screen, params: e.params || {}, focusKey: e.focusKey || '' });
    });
    if (!entries.length) return false;
    if (entries[0].screen !== 'home' && entries[0].screen !== 'signin') entries.unshift({ screen: 'home', params: {} });
    var lt = liveTitle();
    U.each(entries, function (e) {
      if (e.screen === 'home' && page.type === 'home') e.live = true;
      if (e.screen === 'detail' && lt && e.params && String(e.params.id) === String(lt.id) && e.params.kind === lt.kind) e.live = true;
    });
    resetTo(entries);
    return true;
  }

  function route() {
    if (routed || dead) return;
    routed = true;
    clearTimeout(timers.boot);
    page.url = location.href;
    page.type = Screens.site('pageType', [location.href, document], 'other');
    page.title = Screens.site('parseTitleUrl', [location.href], null);
    try {
      selfTestResult = Site.selfTest(document, page.type);
      if (selfTestResult && !selfTestResult.ok) Log.warn('selftest', selfTestResult.warnings);
    } catch (e) { Log.warn('selftest', e); }
    if (page.type === 'movie' || page.type === 'tv') {
      try { var d = Site.detail(document, location.href); if (d) Api.remember(d); } catch (e2) {}
    }
    setMode('shell');
    Log.info('route', page.type + (page.title && page.title.play ? ' (play)' : ''));
    var web = null;
    try { web = Store.session.get(WEB_KEY, null); } catch (e3) {}
    if (web && (typeof web !== 'object' || !(U.now() - (+web.t || 0) < 30 * 60 * 1000))) {
      web = null;
      try { Store.session.remove(WEB_KEY); } catch (e5) {}
    }
    if (page.type === 'gate') { resetTo([{ screen: 'signin' }]); return; }
    if (page.type === 'login') { enterWebsite({ here: false }); return; }
    if (web) {
      var atOrigin = !!web.origin && String(web.origin) === hereUrl();
      if (atOrigin && web.kind === 'nav') {
        /* Back from a page opened in website mode: this page belongs to the shell again. */
        try { Store.session.remove(WEB_KEY); } catch (e6) {}
      } else {
        enterWebsite({ here: atOrigin });
        return;
      }
    }
    var lt = liveTitle();
    if (lt && lt.play) {
      defaultRoute();
      beginPending({ kind: lt.kind, id: lt.id, season: lt.season, episode: lt.episode }, false);
      return;
    }
    var saved = null;
    try { saved = Session.take(page.type); } catch (e4) { Log.warn('session-take', e4); }
    if (saved && saved.length && restore(saved)) return;
    if (page.type === 'home' || lt) { defaultRoute(); return; }
    if (page.type === 'search') {
      var r = Screens.site('search', [document], null);
      var params = { query: r && r.query || '', type: r && r.type || 'all' };
      if (r && r.items && r.items.length) params.snap = { query: r.query, type: r.type, next: r.next, page: 1, total: r.total, items: U.map(Screens.normItems(r.items).slice(0, 60), Screens.compactItem) };
      resetTo([{ screen: 'home' }, { screen: 'search', params: params }]);
      return;
    }
    if (page.type === 'list' || page.type === 'library') {
      var navName = page.type === 'library' ? 'library' : /\/tvshow/.test(location.pathname) ? 'shows' : /\/movie$/.test(location.pathname) ? 'movies' : '';
      resetTo([{ screen: 'home' }, { screen: 'browse', params: { url: location.href.replace(/#.*$/, ''), nav: navName, kicker: 'Browse' }, live: true }]);
      return;
    }
    enterWebsite({ here: false });
  }

  function safeRoute() {
    try { route(); } catch (e) {
      Log.error('route', e);
      try { setMode('shell'); resetTo([{ screen: 'error', params: {} }]); stack[0].screen = 'home'; } catch (e2) { panic(e2); }
    }
  }

  function bootTimeout() {
    if (routed || dead) return;
    Log.warn('boot', 'page did not finish loading in 20 s; routing anyway');
    safeRoute();
  }

  function onPageShow(ev) {
    if (!ev || !ev.persisted) return;
    Log.info('app', 'restored from back-forward cache');
    try { Session.clear(); } catch (e) {}
    pending = null;
    Overlays.hideStarting();
    hideLoadingOverlay();
    if (mode === 'player' || mode === 'popup') setMode('shell');
    if (mode === 'shell') { if (top()) showEntry(top()); else defaultRoute(); }
  }

  /* Last resort: remove every trace of the shell so the website stays usable. */
  function panic(reason) {
    dead = true;
    Log.error('app-panic', reason);
    try { U.each(offs, function (off) { off(); }); } catch (e) {}
    clearInterval(timers.watchdog); clearInterval(timers.monitor); clearTimeout(timers.boot);
    try { Overlays.web.stop(); Player.stop(); } catch (e2) {}
    try { if (typeof Boot !== 'undefined' && Boot.teardown) Boot.teardown(reason); else U.detach(root); } catch (e3) { U.detach(root); }
  }

  function start(ctx) {
    if (started) return;
    started = true;
    buildRoot();
    applyPrefs();
    Focus.configure({ scope: scopes, change: onFocusChange, exit: exitHook });
    setMode('boot');
    stack = [{ screen: 'loading', params: {}, focusKey: '' }];
    showEntry(stack[0]);
    offs.push(U.on(window, 'keydown', onKeyDown, true));
    offs.push(U.on(root, 'click', onClick, false));
    offs.push(U.on(window, 'pageshow', onPageShow, false));
    /* Leaving the page from website mode: keep the viewer's place so coming back restores it. */
    offs.push(U.on(window, 'pagehide', function () {
      if (mode === 'native' && stack.length && top().screen !== 'loading') saveState();
    }, false));
    offs.push(U.on(window, 'resize', function () { var c = Focus.current(); if (c && mode === 'shell') onFocusChange(c, null); }, false));
    try { if (Api.onSignedOut) offs.push(Api.onSignedOut(function () { if (routed) signedOut(); })); } catch (e) {}
    try { if (Prefs.onChange) offs.push(Prefs.onChange(function () { applyPrefs(); })); } catch (e2) {}
    timers.watchdog = setInterval(U.guard(watchdog, 'watchdog'), 2000);
    timers.monitor = setInterval(U.guard(monitor, 'monitor'), 400);
    timers.boot = U.later(bootTimeout, 20000, 'boot-timeout');
    Log.info('app', 'start ' + (ctx && ctx.url || ''));
    U.onReady(safeRoute);
  }

  function state() {
    var cur = Focus.current();
    return {
      screen: root ? root.getAttribute('data-screen') || '' : '',
      stack: U.map(stack, function (e) { return e.screen; }),
      focusKey: cur ? Focus.keyOf(cur) : '',
      mode: mode,
      layer: root ? root.getAttribute('data-layer') || '' : ''
    };
  }

  return {
    start: start, state: state,
    push: push, pop: pop, back: goBack, nav: nav, goHome: goHome, retry: retry, focus: focus, toast: toast,
    screenReady: screenReady, screenFailed: screenFailed, saveState: saveState,
    openLayer: openLayer, closeLayer: closeLayer, hasLayer: hasLayer,
    play: play, cancelPlayback: cancelPlayback, awaitPlayer: awaitPlayer, closePlayer: closePlayer,
    openWebsite: openWebsite, exitWebsite: exitWebsite, websiteBack: websiteBack, exitApp: exitApp,
    applyPrefs: applyPrefs, reload: function () { saveState(); try { location.reload(); } catch (e) {} },
    selfTest: function () { return selfTestResult; }, setSelfTest: function (r) { selfTestResult = r; },
    pageType: pageType, signedOut: signedOut
  };
}());
