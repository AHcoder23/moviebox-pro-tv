/* App: root, rail, screen stack, key dispatch, play flow, player / website / popup modes, watchdog.
   Everything asynchronous is guarded; any failure degrades to an error screen with Retry / Open website / Home,
   and a shell that cannot run at all removes itself so the website stays usable. */
var App = (function () {
  var root = null, rail = null, stage = null, railItems = {};
  var stack = [], layers = [];
  var mode = 'boot';
  var started = false, routed = false, dead = false;
  var page = { type: 'other', title: null, url: '', detail: null };
  var pending = null, popupEl = null, modeBeforePopup = 'shell', controlsMode = false;
  var moveLock = false, selfTestResult = null, selfTestModel = null, webHere = false, cancelledAt = 0;
  /* Playback bookkeeping. dismissed: the viewer closed or cancelled playback, so a player that still shows only counts
     when it really plays again (until the next play action). pickerCancelled: the website's file list stays closed
     until the next play action. ignoredPopups: site popups the viewer escaped from with Blue. */
  var dismissed = null, pickerCancelled = false, ignoredPopups = [], lastPlayAt = 0, lastTarget = null, playerVideo = null;
  /* siteHold: this ?play=1 page was handed to the built-in player, so whatever the website's own auto-play opens (its
     file list, its player, a message) is closed quietly until the viewer's next website play action. */
  var siteHold = false;
  /* resolving: a show-level Play is reading its title page first (resolveThenPlay); Back cancels it. */
  var resolving = null;
  var backInFlight = 0, lastTouch = 0, liveParsed = { home: null, detail: null };
  var timers = { watchdog: null, monitor: null, boot: null, selfTest: null };
  var offs = [];
  var KEEP = 4;
  var WEB_KEY = 'mbptv:web:v1', PICK_KEY = 'mbptv:pick:v1', CANCEL_KEY = 'mbptv:cancel:v1', WEBPLAY_KEY = 'mbptv:webplay:v1';

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
    var perf = false;
    try { perf = Kit.perf(); } catch (e) { perf = false; }
    U.toggleClass(root, 'mb-perf', perf);
  }

  function setScreenAttr(name) { if (root) root.setAttribute('data-screen', name); }

  /* Classes on <html> (section 10), re-applied by the watchdog every 2 s in case the site rewrites html.className:
     mbptv-lock stops the page behind the shell from scrolling (and removes its scrollbar); mbptv-player hides the
     website player's own controls under our OSD; mbptv-jwctl shows them for the player-controls mode. Website and
     popup modes never lock scrolling. Boot.teardown removes all of them. */
  function setModeClass() {
    if (!root) return;
    U.toggleClass(root, 'is-hidden', mode !== 'shell' && mode !== 'boot');
    var h = document.documentElement;
    U.toggleClass(h, 'mbptv-lock', mode === 'boot' || mode === 'shell' || mode === 'player');
    U.toggleClass(h, 'mbptv-player', mode === 'player');
    U.toggleClass(h, 'mbptv-jwctl', mode === 'popup' && controlsMode);
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
        /* The rail reopens on the current section, not on the last item browsed. */
        rail.__mbLast = railItems[inst.nav || entry.nav || ''] || railItems.home;
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

  /* The boot page's own parse (made once in route) goes to the first screen that renders from the live page. */
  function takeParsed(screen) {
    var m = null;
    if (screen === 'home') { m = liveParsed.home; liveParsed.home = null; }
    else if (screen === 'detail') { m = liveParsed.detail; liveParsed.detail = null; }
    return m;
  }

  function createInst(entry) {
    try {
      return Screens.create(entry.screen, entry.params, { live: !!entry.live, model: entry.live ? takeParsed(entry.screen) : null });
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
    /* "Already there" means the screen itself is showing, not an error screen that replaced its entry. */
    if (t && t.inst && t.inst.name === name && t.screen === name && (t.inst.nav || '') === (nav || t.inst.nav)) { focusScreenDefault(); return; }
    if (mode !== 'shell') leaveToShell();
    closeAllLayers();
    while (stack.length > 1) destroyInst(stack.pop());
    if (!stack.length || stack[0].screen !== 'home') { U.each(stack, destroyInst); stack = [{ screen: 'home', params: {}, focusKey: '' }]; }
    if (name === 'home') {
      var h = top();
      if (h.inst && h.inst.name !== 'home') { destroyInst(h); h.focusKey = ''; }
      showEntry(h);
      return;
    }
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

  /* Signed out: whatever this TV remembers about the previous account's searches and places is forgotten; the
     server keeps its own history. */
  function forgetAccount() {
    try { Api.clearRecentSearches(); } catch (e) {}
    try { Session.clear(); } catch (e2) {}
  }

  function signedOut() {
    if (mode !== 'shell') leaveToShell();
    var t = top();
    if (t && t.screen === 'signin') return;
    forgetAccount();
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

  /* A watching session keeps its saved record (and so the way back) fresh: films outlast the 30-minute TTL. */
  function touchSession() {
    var watching = mode === 'player' || !!pending || (mode === 'popup' && modeBeforePopup === 'player');
    if (!watching) return;
    var now = U.now();
    if (now - lastTouch < 60000 && now >= lastTouch) return;
    lastTouch = now;
    try { Session.touch(); } catch (e) {}
  }

  /* ---------- Modes: shell, native (website), player, popup ---------- */

  function setMode(next) {
    mode = next;
    if (next !== 'popup') controlsMode = false;
    setModeClass();
  }

  function leaveToShell() {
    stopNative('app');
    if (mode === 'native' || mode === 'popup') Overlays.web.stop();
    if (mode === 'player') Player.stop();
    popupEl = null;
    setMode('shell');
  }

  function enterWebsite(opts) {
    opts = opts || {};
    stopNative('app');
    closeAllLayers();
    Overlays.hideStarting();
    pending = null;
    resolving = null;
    if (mode === 'player') Player.stop();
    if (mode === 'popup') Overlays.web.stop();
    popupEl = null;
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
    backInFlight = 0;
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

  function readWebKey() {
    var web = null;
    try { web = Store.session.get(WEB_KEY, null); } catch (e) { web = null; }
    if (web && (typeof web !== 'object' || !(U.now() - (+web.t || 0) < 30 * 60 * 1000))) {
      web = null;
      try { Store.session.remove(WEB_KEY); } catch (e2) {}
    }
    return web;
  }

  /* Opens a website page in website mode. '' (or this page) switches in place; another URL navigates there, rebuilt
     onto this page's own origin (never a raw URL from site markup). */
  function openWebsite(url, opts) {
    opts = opts || {};
    if (!url || String(url).replace(/#.*$/, '') === hereUrl()) {
      rememberWebsite('here');
      enterWebsite({ here: true });
      return;
    }
    var dest = U.onOrigin(url);
    if (!dest) { toast('That page is outside MovieBox Pro.'); return; }
    if (opts.persist !== false) rememberWebsite('nav');
    else { try { Store.session.remove(WEB_KEY); } catch (e) {} }
    /* The sign-in screen is never saved as a place to come back to: after signing in the viewer belongs on Home. */
    var t = top();
    if (t && t.screen === 'signin') { try { Session.clear(); } catch (e2) {} } else saveState();
    showLoadingOverlay('Opening the website\u2026');
    location.href = dest;
  }

  /* One history step at a time: a second Back while the previous one is still loading is ignored (slow pages and
     double presses would otherwise skip past the page the viewer came from). */
  function historyBack() {
    if (backInFlight && U.now() - backInFlight < 2500) return false;
    backInFlight = U.now();
    try { history.back(); return true; } catch (e) { backInFlight = 0; return false; }
  }

  /* Back in website mode: history-back, or straight back to the shell when website mode was opened on this page. */
  function websiteBack() {
    if (webHere || history.length <= 1) { exitWebsite(); return; }
    if (backInFlight && U.now() - backInFlight < 2500) return;
    var href = location.href;
    if (!historyBack()) { exitWebsite(); return; }
    U.later(function () { backInFlight = 0; if (mode === 'native' && location.href === href) exitWebsite(); }, 1500, 'web-back');
  }

  /* ---------- Player detection ---------- */

  function playCtx() {
    return { recent: !!pending || U.now() - lastPlayAt < 15000, current: mode === 'player' || controlsMode ? playerVideo : null };
  }

  function rawPlayerOpen() {
    try { return !!Site.live.playerOpen(playCtx()); } catch (e) { return false; }
  }

  /* True when the video's time moved since the previous sample (samples at least 300 ms apart). */
  var vsample = { v: null, t: -1, at: 0, adv: false };
  function advancing(v) {
    var now = U.now();
    if (vsample.v === v && now - vsample.at < 300 && now >= vsample.at) return vsample.adv;
    var t = v ? v.currentTime : -1;
    var adv = !!(v && vsample.v === v && !v.paused && !v.ended && t > vsample.t + 0.1);
    vsample = { v: v, t: t, at: now, adv: adv };
    return adv;
  }

  /* The website player is open and belongs on screen. After the viewer closed or cancelled playback, a player that is
     still there (it could not be closed, or it is paused behind the shell) only counts when it really plays again. */
  function sitePlayerOpen() {
    if (!rawPlayerOpen()) return false;
    if (!dismissed) return true;
    var v = null;
    try { v = Site.live.video(); } catch (e) { v = null; }
    return advancing(v);
  }

  /* A new play action: forget the previous dismissals. */
  function playAction(t) {
    siteHold = false;
    dismissed = null;
    pickerCancelled = false;
    ignoredPopups = [];
    lastPlayAt = U.now();
    if (t) lastTarget = t;
  }

  /* Title and episode line for the OSD: the show title (never with a code suffix) and "S2 \u00b7 E1  Episode title". */
  function osdInfo() {
    var pt = (pending && pending.t) || lastTarget || {};
    var t = top(), inst = t && t.inst, m = inst && inst.model ? inst.model() : null, lt = liveTitle();
    var season = +pt.season || (lt && lt.season) || 0, episode = +pt.episode || (lt && lt.episode) || 0;
    var title = (m && m.title) || pt.title || (inst && inst.params && inst.params.item && inst.params.item.title) ||
      String(document.title || '').replace(/\s*[-|]\s*MovieBox\s*Pro.*$/i, '');
    title = U.text(String(title).replace(/\s+\u00b7\s+S\d+\s*E\d+\s*$/i, ''));
    var sub = '';
    if (episode) {
      var ep = m ? U.find(m.episodes || [], function (e) { return +e.season === +season && +e.episode === +episode; }) : null;
      sub = (season ? 'S' + season + ' \u00b7 ' : '') + 'E' + episode + (ep && ep.title ? '  ' + ep.title : '');
    }
    return { title: title, sub: sub };
  }

  function enterPlayer() {
    if (mode === 'player') return;
    var info = osdInfo();
    pending = null;
    dismissed = null;
    Overlays.hideStarting();
    closeAllLayers();
    if (mode === 'native' || mode === 'popup') Overlays.web.stop();
    popupEl = null;
    try { playerVideo = Site.live.video(); } catch (e) { playerVideo = null; }
    lastTouch = 0;
    setMode('player');
    setScreenAttr('player');
    Focus.blur();
    try { guardFrames(); } catch (eg) {}
    Player.start(info);
    Log.info('mode', 'player');
  }

  /* Back in player mode. If the website's player cannot be closed (its markup changed), every video is paused and it
     is left behind the opaque shell: the viewer is never sent back into it (see sitePlayerOpen). */
  function closePlayer() {
    Player.stop();
    var closed = false;
    try { closed = Site.live.closePlayer(playCtx()); } catch (e) { Log.warn('close-player', e); }
    dismissed = { at: U.now() };
    vsample = { v: null, t: -1, at: 0, adv: false };
    if (!closed) Log.warn('player', 'the website player did not close cleanly; it stays paused behind the TV app');
    afterPlayer(true);
  }

  function afterPlayer(viaBack) {
    Player.stop();
    playerVideo = null;
    var returnTo = returnTarget();
    if (viaBack && returnTo) {
      setMode('shell');
      showLoadingOverlay('Returning\u2026');
      Log.info('player', 'history.back to ' + returnTo);
      historyBack();
      U.later(function () { hideLoadingOverlay(); if (mode === 'shell') showEntry(top()); }, 2500, 'back-fallback');
      return;
    }
    setMode('shell');
    settleUrl();
    if (!stack.length) defaultRoute(); else showEntry(top());
  }

  /* Blue in player mode: the website player's own controls (captions, audio, its menus) with the focus ring, scoped
     to the player. Back or Blue returns to the TV player. */
  function playerControls() {
    if (mode !== 'player') return;
    var box = null;
    try { box = Site.live.playerContainer(); } catch (e) { box = null; }
    var scope = box || document.body;
    Player.stop();
    popupEl = scope;
    modeBeforePopup = 'player';
    setMode('popup');
    controlsMode = true;
    setModeClass();
    setScreenAttr('native');
    Focus.blur();
    var first = U.qs(scope, '.jw-controlbar .jw-icon-playback, .jw-controlbar .jw-icon, .vjs-control-bar .vjs-play-control, .vjs-control-bar button');
    Overlays.web.start({ scope: scope, initial: first, onBack: backToPlayer, onEscape: backToPlayer });
    toast('Player controls  \u00b7  Back returns to the TV player', 3000);
    Log.info('mode', 'player controls');
  }

  function backToPlayer() {
    Overlays.web.stop();
    popupEl = null;
    var open = rawPlayerOpen();
    setMode('shell');
    if (open) enterPlayer(); else afterPlayer(false);
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

  /* The text of a site message worth repeating after it is dismissed (no files, VIP only). */
  function popupMessage(node) {
    if (!node || !U.matches(node, '.no_resource_bg, .vip_pay_tips')) return '';
    return U.text(node.textContent).slice(0, 140);
  }

  function enterPopup(node) {
    stopNative('app');
    popupEl = node;
    modeBeforePopup = mode === 'player' ? 'player' : 'shell';
    controlsMode = false;
    if (pending) pending.reacted = true;
    if (mode === 'player') Player.stop();
    closeAllLayers();
    Overlays.hideStarting();
    setMode('popup');
    setScreenAttr('native');
    Focus.blur();
    Overlays.web.start({
      scope: node,
      onBack: function () {
        /* Only a message that answered a Play ends the attempt; one shown during playback is just dismissed. */
        var el0 = popupEl, gone = false, starting = modeBeforePopup !== 'player' && (!!pending || !!(liveTitle() && liveTitle().play));
        try { gone = Site.live.dismissPopup(el0); } catch (e) { Log.warn('dismiss', e); }
        if (!gone) { escapePopup(el0, 'The website\u2019s message could not be closed.'); return; }
        /* A message that answered a Play (no files, not ready, VIP only) ends that attempt. */
        if (starting) cancelPlayback(popupMessage(el0));
        U.later(monitor, 60, 'popup-check');
      },
      onEscape: function () { escapePopup(popupEl, ''); }
    });
    Log.info('mode', 'popup ' + (node.className || ''));
  }

  /* Blue / Info in popup mode, or a popup that cannot be hidden: back to the TV app, and that element is ignored
     until the next play action (the opaque shell covers it). */
  function escapePopup(node, msg) {
    if (node && U.indexOf(ignoredPopups, node) < 0) ignoredPopups.push(node);
    leavePopup();
    if (msg) toast(msg);
  }

  function leavePopup() {
    Overlays.web.stop();
    popupEl = null;
    var playerOpen = modeBeforePopup === 'player' ? rawPlayerOpen() : sitePlayerOpen();
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

  /* t: {kind, id, season, episode, title, item, playHref, pick, backdrop}. The built-in player (docs/PLAYER.md) plays
     in place; the website's own player is the fallback: Settings > Built-in player off, a title the built-in player
     cannot identify, or the viewer's "Try website player" on its error card. */
  function play(t) {
    if (!t || !t.id) return;
    if (playNative(t)) return;
    playWebsite(t);
  }

  function nativeOn() { return typeof NativePlayer !== 'undefined' && Screens.pref('nativePlayer', true) !== false; }
  function nativeActive() { try { return typeof NativePlayer !== 'undefined' && NativePlayer.active(); } catch (e) { return false; } }
  function stopNative(reason) { if (nativeActive()) { try { NativePlayer.stop(reason || 'app'); } catch (e) { Log.warn('native-stop', e); } } }

  /* An episode named by the request itself: season and episode, or exactly episode 0 (a special) from an episode card. */
  function explicitEpisode(t) {
    if (!(+t.season > 0)) return null;
    if (+t.episode > 0 || (t.exact && t.episode !== '' && t.episode != null && +t.episode === 0)) return { season: +t.season, episode: +t.episode };
    return null;
  }

  function labelEpisode(label) {
    var m = /S(\d+)\s*E(\d+)/i.exec(String(label || ''));
    return m && +m[1] > 0 && +m[2] > 0 ? { season: +m[1], episode: +m[2] } : null;
  }

  /* The episode a show-level Play/Resume starts: the explicit one; else the Continue Watching card's "S37E21"; else
     the title page's choice (Site.detail nextEpisode: its "S2E3"-style resume label, else the first unwatched
     episode); else a resume label on its Play button; else the first episode of the season the title page shows (the
     site opens a show on the season being watched); else S1E1. */
  function resolveEpisode(t, model) {
    var ex = explicitEpisode(t);
    if (ex) return ex;
    var lab = labelEpisode(t.item && t.item.progressLabel);
    if (lab) return lab;
    var n = model && model.nextEpisode;
    if (n && +n.season > 0 && +n.episode >= 0) return { season: +n.season, episode: +n.episode };
    lab = labelEpisode(model && model.playLabel);
    if (lab) return lab;
    var season = model ? +model.season || 0 : 0, first = null;
    if (!season && +t.season > 0) season = +t.season;
    U.each(model && model.episodes || [], function (e) {
      /* specials (episode 0) only play when chosen */
      if (+e.episode > 0 && (!season || +e.season === season) && (!first || +e.episode < +first.episode)) first = e;
    });
    if (first) return { season: +first.season, episode: +first.episode };
    return { season: season || 1, episode: 1 };
  }

  /* The detail model for kind:id: the screen on top (or the boot page itself) when it shows that title, else one
     already in memory (a prefetch or an earlier visit), else the one a resolve step fetched (t.model). */
  function modelFor(kind, id, t) {
    var inst = topInst(), m = null;
    function mine(x) { return !!x && String(x.id) === String(id) && x.kind === kind; }
    try { m = inst && inst.model ? inst.model() : null; } catch (e) { m = null; }
    if (mine(m)) return m;
    if (mine(page.detail)) return page.detail;
    if (t && mine(t.model)) return t.model;
    try { m = Api.cached ? Api.cached(kind, id) : null; } catch (e2) { m = null; }
    return mine(m) ? m : null;
  }

  /* A show-level Play with nothing to go on (no episode, no Continue Watching label, no title page in memory, for
     example the Home hero's Play on a show): read the title page first, which says where the viewer is. The
     "Starting playback" overlay shows meanwhile; Back cancels; after 6 s the player starts with what it has. */
  function resolveThenPlay(t) {
    var token = { t: t }, done = false;
    resolving = token;
    var shown = playInfo(t);
    shown.hint = 'Finding where you left off  ·  Press Back to cancel';
    Overlays.showStarting(shown);
    function go(m, err) {
      if (done) return;
      done = true;
      if (resolving !== token) return;
      resolving = null;
      if (dead || mode !== 'shell') { Overlays.hideStarting(); return; }
      if (err && err.code === 'signed-out') { Overlays.hideStarting(); signedOut(); return; }
      var t2 = {}, k;
      for (k in t) if (t.hasOwnProperty(k)) t2[k] = t[k];
      t2.model = m || null;
      t2.resolved = true;
      if (!playNative(t2)) { Overlays.hideStarting(); playWebsite(t2); }
    }
    U.later(function () { go(null); }, 6000, 'play-resolve');
    try { Api.detail('tv', t.id, U.guard(function (err, m) { go(err ? null : m, err); }, 'play-resolve-cb')); } catch (e) { go(null); }
    return true;
  }

  /* Returns false only when the built-in player is off or missing, or refused the request (no usable id): then the
     website path runs. Never calls playAction: lastPlayAt would make any large video count as the website's player. */
  function playNative(t) {
    if (!nativeOn()) return false;
    var kind = t.kind === 'tv' ? 'tv' : 'movie', model = modelFor(kind, t.id, t), meta = null;
    if (kind === 'tv' && !model && !t.resolved && !explicitEpisode(t) && !labelEpisode(t.item && t.item.progressLabel)) return resolveThenPlay(t);
    try { meta = Api.meta(kind + ':' + t.id); } catch (e) { meta = null; }
    meta = meta || {};
    if (kind === 'movie' && !t.pick && Screens.pref('quality', 'best') === 'ask' && model && (model.sources || []).length > 1) {
      /* As the detail screen's Quality button does: the sheet's onPick plays the chosen file. */
      Overlays.quality({ title: model.title, sources: model.sources, onPick: function (src) {
        play({ kind: kind, id: t.id, title: t.title, item: t.item, backdrop: t.backdrop, pick: src });
      } });
      return true;
    }
    var ep = kind === 'tv' ? resolveEpisode(t, model) : null;
    var epInfo = ep && model ? U.find(model.episodes || [], function (e) { return +e.season === ep.season && +e.episode === ep.episode; }) : null;
    /* Never t.title for the name: the detail screen appends "  ·  S2E1" to it. */
    var name = (model && model.title) || (t.item && t.item.title) || meta.title || U.text(String(t.title || '').replace(/\s+·\s+S\d+\s*E\d+\s*$/i, ''));
    var req = {
      kind: kind, id: String(t.id), season: ep ? ep.season : 0, episode: ep ? ep.episode : 0,
      title: name, showTitle: name, episodeTitle: (explicitEpisode(t) && U.text(t.episodeTitle)) || (epInfo ? epInfo.title || '' : ''),
      backdrop: t.backdrop || (model && model.backdrop) || meta.backdrop || (t.item && t.item.backdrop) || '',
      poster: (model && model.poster) || meta.poster || (t.item && t.item.poster) || '',
      fileIndex: t.pick && typeof t.pick.index === 'number' ? t.pick.index : undefined,
      autoplayNext: Screens.pref('autoplayEpisodes', true) !== false
    };
    rememberFocus();
    var ok = false;
    try { ok = !!NativePlayer.play(req, nativeHooks(t)); } catch (e2) { Log.error('play', e2); ok = false; }
    if (ok) Log.info('play', 'built-in player ' + kind + ':' + req.id + (ep ? ' S' + ep.season + 'E' + ep.episode : ''));
    return ok;
  }

  /* Hooks for one NativePlayer overlay (a fresh object per play, so mount is the live root). marks: the last "over"
     value saved for each episode played in this overlay ('2x1': 1 = finished), for the detail screen's checks. */
  function nativeHooks(t) {
    var marks = {}, saved = false;
    return {
      mount: root,
      onOpen: function () {
        pending = null; cancelledAt = 0;
        Overlays.hideStarting();
        hideLoadingOverlay();
        closeAllLayers();
        setMode('player');
        setScreenAttr('player');
        U.toggleClass(root, 'rail-open', false);
        Focus.blur();
      },
      onClose: function (info) {
        info = info || {};
        setMode('shell');
        var entry = top(), same = sameDetail(entry, info), watched = !!info.started || saved;
        if (same) prepareDetail(entry, info, watched ? played(info, marks) : null);
        if (!stack.length || !entry || entry.screen === 'loading') defaultRoute(); else showEntry(top());
        if (same && watched && entry.inst && entry.inst.afterPlayback) { try { entry.inst.afterPlayback(); } catch (e) { Log.warn('after-playback', e); } }
        if (same) refreshDetail(entry, info);
        if (watched) afterWatching(top());
      },
      onFallback: function (req, reason) {
        Log.info('play', 'built-in player fallback: ' + reason);
        if (reason === 'signed-out') { signedOut(); return; }
        playWebsite({ kind: req.kind, id: req.id, season: req.kind === 'tv' ? req.season : 0, episode: req.kind === 'tv' ? req.episode : 0,
          title: req.showTitle || t.title, item: t.item, backdrop: req.backdrop });
      },
      onProgress: function (p) {
        /* The site stores it; closing the player refreshes what the screens show. */
        saved = true;
        if (p && p.kind === 'tv' && +p.season > 0) marks[+p.season + 'x' + (+p.episode || 0)] = p.over === 1 ? 1 : 0;
      },
      onNext: function (next) {
        /* Back from the player focuses the episode that played last (its card key in 40-ui-screens). */
        var entry = top();
        if (entry && entry.screen === 'detail' && next) entry.focusKey = 'ep|' + next.season + 'x' + next.episode;
      }
    };
  }

  function sameDetail(entry, info) {
    return !!(entry && entry.screen === 'detail' && info && info.id && String(entry.params.id) === String(info.id) &&
      (entry.params.kind === 'tv' ? 'tv' : 'movie') === info.kind);
  }

  /* What the detail screen needs to know about what was just watched (params.lastPlayed, read by 40-ui-screens):
     where it stopped, whether that counts as finished, and every episode's last saved "over" value. */
  function played(info, marks) {
    var lp = { kind: info.kind === 'tv' ? 'tv' : 'movie', season: +info.season || 0, episode: +info.episode || 0,
      time: Math.max(0, +info.time || 0), duration: Math.max(0, +info.duration || 0), over: info.over === 1 ? 1 : 0, marks: {}, t: U.now() };
    lp.resume = !!info.started && !lp.over && lp.time >= 10;
    for (var k in marks) if (marks.hasOwnProperty(k)) lp.marks[k] = marks[k];
    if (lp.kind === 'tv' && lp.season > 0 && info.started) lp.marks[lp.season + 'x' + lp.episode] = lp.over;
    return lp;
  }

  /* Before the screen shows again: rebuilds must read the refreshed Api cache (never the boot page's markup), the
     screen learns what was watched (lastPlayed; the Continue Watching card's position no longer applies), and a show
     whose Up Next crossed into another season shows that season (the player usually cached its page). */
  function prepareDetail(entry, info, lastPlayed) {
    entry.live = false;
    if (lastPlayed) {
      entry.params.lastPlayed = lastPlayed;
      var it = entry.params.item;
      if (it && typeof it === 'object') { it.progress = -1; it.progressLabel = ''; it.playHref = ''; }
    }
    if (info.kind !== 'tv' || !(info.season > 0)) return;
    var shownSeason = 0;
    try { shownSeason = entry.inst && entry.inst.season ? +entry.inst.season() || 0 : 0; } catch (e) { shownSeason = 0; }
    if (!shownSeason) {
      var shown = null;
      try { shown = entry.inst && entry.inst.model ? entry.inst.model() : null; } catch (e2) { shown = null; }
      shownSeason = (shown && +shown.season) || +(entry.params.season || 0);
    }
    entry.params.season = info.season;
    if (shownSeason !== info.season) destroyInst(entry);
  }

  /* What a title page says about the viewer's progress: the Play/Resume label, the season it opens on and every
     watched/progress field Site.detail gives (episode marks, season progress), found by name at any depth. */
  var PROGRESS_FIELD = /watch|progress|finish|seen|resume|percent|over$/i;
  function progressSig(m) {
    var out = [];
    function walk(v, path, depth) {
      if (v == null || depth > 4) return;
      if (typeof v !== 'object') return;
      var arr = Object.prototype.toString.call(v) === '[object Array]';
      for (var k in v) {
        if (!v.hasOwnProperty(k)) continue;
        var x = v[k];
        if (x !== null && typeof x === 'object') { if (arr || /episode|season|list|progress|watch/i.test(k)) walk(x, path + '.' + k, depth + 1); }
        else if (!arr && PROGRESS_FIELD.test(k)) out.push(path + '.' + k + '=' + String(x));
      }
    }
    if (!m) return '';
    out.push('label=' + U.text(m.playLabel), 'season=' + (+m.season || 0));
    try { walk(m, '', 0); } catch (e) { Log.warn('progress-sig', e); }
    return out.join('|');
  }

  /* The player's last progress post leaves as the player closes: pages read again sooner could still show the old
     position, so the refreshes below wait this long. */
  var REFRESH_AFTER = 1500;

  /* Re-reads the title page (Api.detail with force replaces the cached model) a moment after the player closed. The
     screen patches its Play/Resume label, watched checks and season line in place (refreshModel: focus and scroll
     stay). A screen that cannot patch is rebuilt, only when the viewer has not moved yet and what it shows about their
     progress changed; entry.focusKey (rememberFocus or onNext) puts focus back on the episode that played. */
  function refreshDetail(entry, info) {
    U.later(function () {
      if (dead || top() !== entry || !entry.inst) return;
      var season = info.kind === 'tv' ? +(entry.params.season || 0) : 0;
      Api.detail(info.kind, info.id, U.guard(function (err, m) {
        if (err || !m || dead || top() !== entry || !entry.inst) return;
        var inst = entry.inst, patched = false;
        if (inst.refreshModel) { try { patched = !!inst.refreshModel(m); } catch (e0) { Log.warn('refresh-model', e0); patched = false; } }
        if (patched || mode !== 'shell' || topLayer() || entry.touched) return;
        var shown = null;
        try { shown = inst.model ? inst.model() : null; } catch (e) { shown = null; }
        if (!shown || progressSig(shown) === progressSig(m)) return;
        Log.info('play', 'title page changed after playback; refreshing the detail screen');
        rememberFocus();
        destroyInst(entry);
        showEntry(entry);
      }, 'native-refresh'), { force: true, season: season });
    }, REFRESH_AFTER, 'native-refresh-wait');
  }

  /* After something played: Continue Watching (Home's first row, My Library) is out of date. Home refreshes quietly
     from a fresh fetch (rebuilt only when its progress cards changed, and never under the viewer's hand); My Library
     screens below the top rebuild when shown again. */
  function afterWatching(current) {
    U.each(stack, function (e) {
      if (e !== current && e.inst && e.screen === 'browse' && (e.params.nav === 'library' || e.nav === 'library')) { destroyInst(e); e.live = false; }
    });
    var home = stack.length && stack[0].screen === 'home' ? stack[0] : null;
    if (!home || page.type === 'gate') return;
    U.later(function () { if (!dead && stack[0] === home) refreshHome(home); }, REFRESH_AFTER, 'home-refresh-wait');
  }

  function refreshHome(home) {
    Api.home(U.guard(function (err, data) {
      if (err || !data || !data.rows || dead || stack[0] !== home) return;
      if (home.inst && continueSig(cardItems(home.inst.el)) === continueSig(dataItems(data))) return;
      var isTop = top() === home;
      if (isTop && (mode !== 'shell' || topLayer() || home.touched)) return;
      Log.info('app', 'Continue Watching changed; refreshing Home');
      if (isTop) rememberFocus();
      destroyInst(home);
      home.live = true;
      liveParsed.home = data;
      if (isTop) showEntry(home);
    }, 'home-refresh'));
  }

  function cardItems(scope) {
    return U.map(U.filter(U.qsa(scope, '[data-key]'), function (n) { return !!n.__item; }), function (n) { return n.__item; });
  }

  function dataItems(data) {
    var out = [];
    U.each(data.rows || [], function (r) { out = out.concat(r.items || []); });
    return out;
  }

  /* Continue Watching as Home shows it: every card with progress, in order, with its label and progress. */
  function continueSig(items) {
    var seen = {}, out = [];
    U.each(items, function (it) {
      if (!it || !(it.progress >= 0) || seen[it.key]) return;
      seen[it.key] = 1;
      out.push(it.key + ':' + Math.round(it.progress * 100) + ':' + U.text(it.progressLabel));
    });
    return out.join('|');
  }

  /* The website's own player: a live click when this page is the title's page, else the ?play=1 page. */
  function playWebsite(t) {
    if (!t || !t.id) return;
    var kind = t.kind === 'tv' ? 'tv' : 'movie';
    var lt = liveTitle();
    playAction(t);
    try { Store.session.remove(CANCEL_KEY); } catch (e0) {}
    if (t.pick) { try { Store.session.set(PICK_KEY, { key: kind + ':' + t.id, file: t.pick.file || '', quality: t.pick.quality || '', t: U.now() }); } catch (e) {} }
    if (lt && lt.kind === kind && String(lt.id) === String(t.id)) {
      var btn = null;
      try { btn = t.episode ? Site.live.episodeButton(t.season, t.episode) : Site.live.playButton(); } catch (e2) { btn = null; }
      if (btn) {
        /* Our click reaches the control we found, so there is no blind second click later (retried: true). */
        beginPending({ kind: kind, id: t.id, season: t.season || 0, episode: t.episode || 0, title: t.title }, true);
        Log.info('play', 'live click ' + kind + ':' + t.id + (t.episode ? ' S' + t.season + 'E' + t.episode : ''));
        if (!Site.live.click(btn)) { try { btn.click(); } catch (e3) {} }
        return;
      }
    }
    var url = t.playHref ? U.onOrigin(t.playHref) : '';
    if (!url) url = Screens.siteUrl('play', [kind, t.id, t.season || 0, t.episode || 0], '/' + (kind === 'movie' ? 'movie/' : 'tvshow/') + t.id + '?play=1');
    rememberFocus();
    saveState();
    Overlays.showStarting(playInfo(t));
    pending = { t: t, since: U.now(), clicked: true, retried: true, navigating: true, url: url };
    /* The ?play=1 page must use the website's player too (it would otherwise hand the title to the built-in one). */
    try { Store.session.set(WEBPLAY_KEY, { url: url, t: U.now() }); } catch (e4) {}
    Log.info('play', 'navigate ' + url);
    location.href = url;
  }

  function beginPending(t, clicked) {
    cancelledAt = 0;
    playAction(t);
    pending = { t: t, since: U.now(), clicked: !!clicked, retried: !!clicked, reacted: false };
    Overlays.showStarting(playInfo(t));
  }

  /* Back while playback is starting (overlay or source picker), or on a message that answered Play. On a ?play=1
     page that another page opened, go back to that page, which restores its own stack, so it feels like the picker
     simply closed. While the ?play=1 page itself is still loading, the navigation is stopped (and a marker tells that
     page, should it load anyway, that the viewer cancelled). msg (optional) is shown when the viewer stays here. */
  function cancelPlayback(msg) {
    var nav0 = pending && pending.navigating ? pending : null;
    if (resolving && !pending) {
      /* Back while a show's Play reads its title page: nothing started yet, so there is nothing else to undo. */
      resolving = null;
      Overlays.hideStarting();
      Log.info('play', 'cancelled while finding the episode');
      return;
    }
    resolving = null;
    pending = null;
    cancelledAt = U.now();
    pickerCancelled = true;
    dismissed = { at: U.now() };
    Overlays.hideStarting();
    if (nav0) {
      try { window.stop(); } catch (e0) {}
      try { Store.session.set(CANCEL_KEY, { url: nav0.url || '', t: U.now() }); } catch (e1) {}
      Log.info('play', 'cancelled while the play page was loading');
      if (msg) toast(msg, 5000);
      return;
    }
    if (returnTarget()) {
      Log.info('play', 'cancelled; history.back');
      showLoadingOverlay('Returning\u2026');
      if (!historyBack()) hideLoadingOverlay();
      U.later(function () { hideLoadingOverlay(); if (mode === 'shell' && top()) showEntry(top()); }, 2500, 'cancel-fallback');
      return;
    }
    settleUrl();
    if (msg) toast(msg, 5000);
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
    var t = (pending && pending.t) || lastTarget;
    var cur = topInst(), m = cur && cur.model ? cur.model() : null;
    cancelledAt = 0;
    playAction(t);
    pending = { t: t || { title: m && m.title }, since: U.now(), clicked: true, retried: true, reacted: true, afterPick: true };
    Overlays.showStarting({ title: (m && m.title) || (t && t.title) || '', backdrop: m && m.backdrop || '' });
  }

  function pendingTick() {
    if (!pending) {
      if (Overlays.startingShown() && mode === 'shell' && !Overlays.sources.autoPending() && !resolving) { Log.warn('play', 'orphaned starting overlay removed'); Overlays.hideStarting(); }
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
    /* The website did nothing at all within 5 s (a ?play=1 page whose own auto-play did not run): click its play
       control once. Never when it answered (picker, message or player) or when our click already reached it. */
    if (age > 5000 && !pending.retried && !pending.reacted) {
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
      if (Overlays.sources.isOpen()) Overlays.sources.close(true);
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

  /* The website opened its file list: our sheet replaces it. With a preferred file that matches, the starting
     overlay stays up and names the file (quiet auto-selection, Up opens the full list); otherwise the sheet opens. */
  function openLivePicker() {
    var m = topInst() && topInst().model ? topInst().model() : null;
    if (top() && top().screen !== 'detail') { var lt = liveTitle(); push('detail', { kind: lt.kind, id: lt.id }, { live: true }); }
    var opened = Overlays.sources.open({ title: m && m.title || '', pick: takePick(), auto: true, quiet: Overlays.startingShown() });
    if (opened && Overlays.sources.autoPending()) {
      if (pending) pending.reacted = true;
      return;
    }
    pending = null;
    Overlays.hideStarting();
    if (!opened) {
      /* The website's file list could not be read (its markup changed): let the viewer use the website's own
         picker with the focus ring instead of covering it. */
      var box = U.find(U.qsa(document, '.sidebarbg2'), function (n) { return U.isVisible(n); });
      Log.warn('sources', 'file list not recognised; showing the website picker');
      if (box) enterPopup(box);
      else pending = { t: {}, since: U.now(), clicked: true, retried: false, reacted: true };
    }
  }

  /* ---------- Live page monitor (player, source picker, popups) ---------- */

  function notIgnored(p) { return U.indexOf(ignoredPopups, p) < 0; }

  /* The website's own playback on this page, kept quiet (siteHold, or while the built-in player plays): its videos
     are paused (a second stream would compete for the TV's decoder and double the sound) and, while held, its file
     list, player and messages are closed without showing them. Videos inside our root are never touched. */
  function quietSite(held) {
    var live = Site.live;
    U.each(U.qsa(document, 'video'), function (v) {
      if (root && root.contains(v)) return;
      try { if (!v.paused) v.pause(); } catch (e) {}
    });
    if (!held) return;
    try { if (live.sourcePickerOpen()) live.closeSourcePicker(); } catch (e1) {}
    try {
      U.each(U.filter(live.blockingPopups() || [], notIgnored), function (p) {
        var gone = false;
        try { gone = live.dismissPopup(p); } catch (e2) { gone = false; }
        if (!gone) ignoredPopups.push(p);
      });
    } catch (e3) {}
    if (!nativeActive() && rawPlayerOpen()) { try { live.closePlayer(playCtx()); } catch (e4) {} }
  }

  function monitor() {
    if (!routed || dead) return;
    if (nativeActive()) { if (liveTitle()) quietSite(siteHold); return; }
    if (!liveTitle()) return;
    var live = Site.live;
    touchSession();
    if (mode === 'native') return;
    if (siteHold && mode === 'shell' && !pending) quietSite(true);
    if (mode === 'popup') {
      if (controlsMode) { if (!popupEl || !U.isVisible(popupEl) || !rawPlayerOpen()) backToPlayer(); return; }
      if (!popupEl || !U.isVisible(popupEl)) leavePopup();
      return;
    }
    var popups = U.filter(live.blockingPopups() || [], notIgnored);
    if (popups.length) { enterPopup(popups[0]); return; }
    if (mode === 'player') {
      try { playerVideo = live.video() || playerVideo; } catch (e) {}
      if (!rawPlayerOpen()) { Log.info('player', 'closed by the website'); afterPlayer(false); }
      return;
    }
    var pickerOpen = live.sourcePickerOpen();
    /* The viewer pressed Back while playback was starting: the website may still finish opening its player a moment
       later. Close it instead of dragging the viewer back into playback. */
    if (cancelledAt && U.now() - cancelledAt < 4000 && !pending && rawPlayerOpen()) {
      Log.info('play', 'closing the player the viewer cancelled');
      live.closePlayer(playCtx());
      return;
    }
    if (!siteHold && sitePlayerOpen()) { enterPlayer(); return; }
    if (pickerOpen && !Overlays.sources.isOpen()) {
      /* The viewer closed the file list: it stays closed until the next play action. */
      if (pickerCancelled && !pending) live.closeSourcePicker();
      else openLivePicker();
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
    /* The built-in player owns the screen and the remote: no focus repair and no website-player checks. */
    if (nativeActive()) return;
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
      if (liveTitle() && !pending && !siteHold && !(cancelledAt && U.now() - cancelledAt < 4000)) {
        try { if (sitePlayerOpen()) enterPlayer(); } catch (e2) {}
      }
    } else if (mode === 'native' && !Overlays.web.active()) {
      Overlays.web.start({ here: webHere });
    } else if (mode === 'player') {
      if (!rawPlayerOpen()) { Log.info('player', 'closed (watchdog)'); afterPlayer(false); }
    }
  }

  /* Remote keys go to whichever document has focus. Same-origin iframes (the website may load its player page
     into one) get our key listeners as well; a focused cross-origin iframe (ads, embeds) is blurred. */
  function guardFrames() {
    var active = document.activeElement;
    U.each(U.qsa(document, 'iframe'), function (f) {
      var w = null, same = false;
      try { w = f.contentWindow; same = !!(w && w.document && w.document.documentElement); } catch (e) { same = false; }
      if (same) {
        if (!w.__mbptvKeys) {
          try {
            w.addEventListener('keydown', U.guard(onKeyDown, 'frame-key'), true);
            w.addEventListener('keyup', U.guard(onKeyUp, 'frame-keyup'), true);
            w.__mbptvKeys = true;
          } catch (e2) {}
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
  function lockMove() {
    if (moveLock) return false;
    moveLock = true;
    U.frame(function () { moveLock = false; }, 'move-unlock');
    U.later(function () { moveLock = false; }, 120, 'move-unlock-fallback');
    var entry = top();
    if (entry) entry.touched = true;
    return true;
  }

  /* A screen that routes an arrow key itself moves focus through here (same pacing as the focus engine). */
  function moveTo(node) {
    if (!node || !lockMove()) return false;
    return focus(node);
  }

  function move(dir) {
    if (!lockMove()) return;
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
      if (name === 'back') {
        if (Overlays.sources.isOpen()) Overlays.sources.close(true);
        cancelPlayback();
        return true;
      }
      /* During the quiet automatic file choice, Up or OK opens the full list of files instead. */
      if ((name === 'up' || name === 'enter') && Overlays.sources.autoPending()) {
        pending = null;
        Overlays.sources.expand();
        return true;
      }
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
    /* The built-in player owns the remote while it is up (it answers true for every key). */
    if (nativeActive()) return NativePlayer.key(name, ev);
    if (mode === 'native' || mode === 'popup') return Overlays.web.key(name, ev);
    if (mode === 'player') return Player.key(name, ev);
    if (mode === 'boot') {
      if (topLayer()) return shellKey(name, ev);
      if (name === 'back') Overlays.exitDialog();
      return true;
    }
    return shellKey(name, ev);
  }

  /* Held OK and Back act once. A held key arrives as repeated keydowns (ev.repeat, or no keyup in between), and some
     TVs send each repeat as a keyup/keydown pair a few milliseconds apart; both are swallowed. The held table expires
     700 ms after the last keydown, so a lost keyup (focus in a frame, a page change) can never disable a key. Arrows,
     seeking and the search keyboard's letters and Delete keep auto-repeat. */
  var held = {}, lastUp = {};
  function holdGuarded(name) {
    if (name === 'back') return true;
    if (name === 'backspace') {
      var i0 = topInst();
      return !(mode === 'shell' && !topLayer() && i0 && i0.name === 'search');
    }
    if (name !== 'enter') return false;
    if (mode === 'shell' && !topLayer() && !Overlays.startingShown()) {
      var cur = Focus.current();
      if (cur && (cur.hasAttribute('data-char') || cur.getAttribute('data-action') === 'delete')) return false;
    }
    return true;
  }

  function isHeldRepeat(name, ev) {
    if (!holdGuarded(name)) return false;
    var now = U.now(), h = held[name] || 0;
    var rep = !!ev.repeat || (h > 0 && now - h < 700 && now >= h) || (lastUp[name] > 0 && now - lastUp[name] < 25 && now >= lastUp[name]);
    held[name] = now;
    return rep;
  }

  function onKeyUp(ev) {
    var name = Keys.name(ev);
    if (!name) return;
    if (held[name]) { held[name] = 0; lastUp[name] = U.now(); }
  }

  function clearHeld() { held = {}; lastUp = {}; }

  function onKeyDown(ev) {
    if (dead) return;
    var name = Keys.name(ev);
    if (!name) return;
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
    var handled = false;
    if (isHeldRepeat(name, ev)) {
      handled = true;
    } else {
      try { handled = dispatch(name, ev); } catch (e) {
        Log.error('key:' + name, e);
        handled = true;
        keyFailure(name);
      }
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
      /* The sign-in screen only belongs on the gate page: after signing in, the viewer lands on Home. */
      if (e.screen === 'signin' && page.type !== 'gate') return;
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

  /* The live page's self-test runs once the first screen is up (or when Diagnostics asks), never before the first
     render: on a TV CPU it costs about half a second. */
  function runSelfTest() {
    try {
      selfTestResult = Site.selfTest(document, page.type, selfTestModel);
      if (selfTestResult && !selfTestResult.ok) Log.warn('selftest', selfTestResult.warnings);
    } catch (e) { Log.warn('selftest', e); }
    selfTestModel = null;
    return selfTestResult;
  }

  /* A ?play=1 page whose Play the viewer cancelled while it was still loading: never start playback here. */
  function cancelledHere() {
    var mark = null;
    try { mark = Store.session.get(CANCEL_KEY, null); } catch (e) { mark = null; }
    if (!mark) return false;
    try { Store.session.remove(CANCEL_KEY); } catch (e2) {}
    if (!(U.now() - (+mark.t || 0) < 15000)) return false;
    var a = U.parseUrl(String(mark.url || '')), b = U.parseUrl(location.href);
    return a.pathname + a.search === b.pathname + b.search;
  }

  /* This ?play=1 page was opened by the website path (playWebsite): it plays with the website's player. */
  function webPlayHere() {
    var mark = null;
    try { mark = Store.session.get(WEBPLAY_KEY, null); } catch (e) { mark = null; }
    if (!mark) return false;
    try { Store.session.remove(WEBPLAY_KEY); } catch (e2) {}
    if (!(U.now() - (+mark.t || 0) < 60000)) return false;
    var a = U.parseUrl(String(mark.url || '')), b = U.parseUrl(location.href);
    return a.pathname + a.search === b.pathname + b.search;
  }

  function route() {
    if (routed || dead) return;
    routed = true;
    clearTimeout(timers.boot);
    page.url = location.href;
    page.type = Screens.site('pageType', [location.href, document], 'other');
    page.title = Screens.site('parseTitleUrl', [location.href], null);
    /* The live page is parsed once here and shared with the first screen, Api's cache and the deferred self-test. */
    if (page.type === 'movie' || page.type === 'tv') {
      try { var d = Site.detail(document, location.href); if (d) { Api.remember(d); liveParsed.detail = d; selfTestModel = d; page.detail = d; } } catch (e2) {}
    } else if (page.type === 'home') {
      try { var h = Site.home(document); if (h && h.rows && h.rows.length) { liveParsed.home = h; selfTestModel = h; } } catch (e7) {}
    }
    timers.selfTest = U.later(function () { if (!dead && !selfTestResult) runSelfTest(); }, 4000, 'selftest');
    setMode('shell');
    Log.info('route', page.type + (page.title && page.title.play ? ' (play)' : ''));
    var web = readWebKey();
    if (page.type === 'gate') { forgetAccount(); resetTo([{ screen: 'signin' }]); return; }
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
      if (cancelledHere()) {
        Log.info('play', 'the viewer cancelled this playback before the page opened');
        var rt = returnTarget();
        cancelledAt = U.now();
        pickerCancelled = true;
        dismissed = { at: U.now() };
        defaultRoute();
        settleUrl();
        if (rt) { showLoadingOverlay('Returning\u2026'); if (!historyBack()) hideLoadingOverlay(); }
        return;
      }
      defaultRoute();
      /* Old links, bookmarks and other pages' ?play=1 links: the built-in player, unless that page asked for the
         website's player (WEBPLAY_KEY). The website's own auto-play on this page is then kept quiet (siteHold). */
      if (!webPlayHere() && nativeOn() && playNative({ kind: lt.kind, id: lt.id, season: lt.season || 0, episode: lt.episode || 0 })) {
        siteHold = true;
        pickerCancelled = true;
        dismissed = { at: U.now() };
        settleUrl();
        Log.info('play', '?play=1 page handed to the built-in player');
        return;
      }
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

  /* Restored from the back-forward cache: the page resumes exactly as it was left, so re-apply what route() would
     decide for a fresh load (website-mode key, stale overlays and in-flight guards). */
  function onPageShow(ev) {
    if (!ev || !ev.persisted) return;
    Log.info('app', 'restored from back-forward cache');
    backInFlight = 0;
    cancelledAt = 0;
    clearHeld();
    try { Session.clear(); } catch (e) {}
    pending = null;
    resolving = null;
    Overlays.hideStarting();
    hideLoadingOverlay();
    var web = readWebKey();
    if (web && String(web.origin) === hereUrl()) {
      if (web.kind === 'nav') {
        try { Store.session.remove(WEB_KEY); } catch (e1) {}
        if (mode === 'native') { Overlays.web.stop(); setMode('shell'); }
      } else if (web.kind === 'here' && mode !== 'native') {
        enterWebsite({ here: true });
        return;
      }
    }
    stopNative('app');
    if (mode === 'player' || mode === 'popup') { Player.stop(); Overlays.web.stop(); popupEl = null; setMode('shell'); }
    if (mode === 'shell') { if (top() && top().screen !== 'loading') showEntry(top()); else defaultRoute(); }
  }

  /* Stops every timer and listener (Boot.teardown calls it before removing the nodes, so nothing re-attaches them). */
  function kill() {
    if (dead) return;
    dead = true;
    try { U.each(offs, function (off) { off(); }); } catch (e) {}
    offs = [];
    clearInterval(timers.watchdog); clearInterval(timers.monitor); clearTimeout(timers.boot); clearTimeout(timers.selfTest);
  }

  /* Last resort: remove every trace of the shell so the website stays usable. */
  function panic(reason) {
    Log.error('app-panic', reason);
    kill();
    try { Overlays.sources.close(false); } catch (e1) {}
    try { if (typeof NativePlayer !== 'undefined') NativePlayer.stop('app'); } catch (e0) {}
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
    offs.push(U.on(window, 'keyup', onKeyUp, true));
    offs.push(U.on(window, 'blur', clearHeld, false));
    offs.push(U.on(document, 'visibilitychange', clearHeld, false));
    offs.push(U.on(root, 'click', onClick, false));
    offs.push(U.on(window, 'pageshow', onPageShow, false));
    /* Leaving the page from website mode: keep the viewer's place so coming back restores it. */
    offs.push(U.on(window, 'pagehide', function () {
      if (mode === 'native' && stack.length && top().screen !== 'loading' && top().screen !== 'signin') saveState();
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
    start: start, state: state, kill: kill,
    push: push, pop: pop, back: goBack, nav: nav, goHome: goHome, retry: retry, focus: focus, moveTo: moveTo, toast: toast,
    screenReady: screenReady, screenFailed: screenFailed, saveState: saveState,
    openLayer: openLayer, closeLayer: closeLayer, hasLayer: hasLayer,
    play: play, cancelPlayback: cancelPlayback, awaitPlayer: awaitPlayer, closePlayer: closePlayer, playerControls: playerControls,
    openWebsite: openWebsite, exitWebsite: exitWebsite, websiteBack: websiteBack, exitApp: exitApp,
    applyPrefs: applyPrefs, reload: function () { saveState(); try { location.reload(); } catch (e) {} },
    selfTest: function () { if (!selfTestResult && routed && !dead) runSelfTest(); return selfTestResult; },
    setSelfTest: function (r) { selfTestResult = r; },
    pageType: pageType, signedOut: signedOut,
    /* The built-in player, for diagnostics and tests (window.__mbptv.App.nativePlayer().info()). */
    nativePlayer: function () { return typeof NativePlayer !== 'undefined' ? NativePlayer : null; }
  };
}());
