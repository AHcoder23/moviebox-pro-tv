/* Data access (docs/ARCHITECTURE.md section 5.3): same-origin XHR with timeout, one retry and in-flight sharing,
   signed-out detection, suggestion sequencing, detail cache (memory + compact localStorage LRU), low-priority
   prefetch, recent searches. Prefs and Session live here too. Callbacks are Node-style cb(err, result), always
   asynchronous and called exactly once (the one documented exception: superseded Api.suggest callbacks are
   dropped). Storage goes through Store with an in-memory mirror, so a throwing or full localStorage never breaks
   reads that follow a write. Nothing here runs at load time. */
var Api = (function () {
  var cfg = { timeout: 15000, retryDelay: 700, memTtl: 10 * 60 * 1000, suggestTtl: 5 * 60 * 1000 };
  var META_KEY = 'mbptv:meta:v1', RECENT_KEY = 'mbptv:recent:v1';
  var META_MAX = 300, META_TTL = 14 * 24 * 60 * 60 * 1000, MEM_MAX = 50, OVERVIEW_MAX = 420, RECENT_MAX = 12, SUGGEST_MAX = 40;
  var inflight = {};
  var stats = { requests: 0, retries: 0, errors: 0, shared: 0, lastError: null, lastOk: 0 };
  var signedOutFns = [];

  function isArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
  function copy(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; } }

  function deliver(cb, err, res) {
    if (typeof cb !== 'function') return;
    U.later(function () { cb(err, res); }, 0, 'api-cb');
  }

  function fail(code, url, extra) {
    var err = { code: code, url: url || '' };
    if (extra) for (var k in extra) if (has(extra, k)) err[k] = extra[k];
    return err;
  }

  function noteError(err) {
    stats.errors++;
    stats.lastError = { code: err.code, url: err.url || '', t: U.now() };
    if (err.code === 'signed-out') {
      U.each(signedOutFns.slice(), function (fn) { U.later(function () { fn(err); }, 0, 'api-signed-out'); });
    } else {
      Log.warn('api', err.code + ' ' + (err.url || ''));
    }
  }

  /* Only same-site http(s) URLs are fetched; the apex/www variant is mapped onto the current origin. */
  function normalizeUrl(url) {
    if (url == null || url === '') return '';
    var abs = U.abs(String(url));
    var u = U.parseUrl(abs), here = Site.url.origin();
    if (!/^https?:$/.test(u.protocol) || !here) return '';
    if (u.origin === here) return u.origin + u.pathname + u.search;
    if (U.siteHost(u.hostname) === U.siteHost(U.parseUrl(here).hostname)) return here + u.pathname + u.search;
    return '';
  }

  function retryable(err) { return !!err && (err.code === 'network' || /^http-5\d\d$/.test(err.code)); }

  function request(url, headers, cb, attempt) {
    attempt = attempt || 0;
    stats.requests++;
    var started = U.now();
    U.xhr({ url: url, timeout: cfg.timeout, headers: headers }, function (err, res) {
      /* U.xhr's abort() on timeout fires readystatechange first, which reports status 0 as 'network': reclassify. */
      if (err && err.code === 'network' && U.now() - started >= cfg.timeout - 20) err = { code: 'timeout', status: 0 };
      if (err && attempt < 1 && retryable(err)) {
        stats.retries++;
        Log.info('api-retry', err.code + ' ' + url);
        U.later(function () { request(url, headers, cb, attempt + 1); }, cfg.retryDelay, 'api-retry');
        return;
      }
      if (err) { err.url = url; cb(err, null); return; }
      cb(null, res);
    });
  }

  /* Shares one request between identical concurrent callers. A watchdog guarantees every waiter is answered. */
  function share(key, cb, start) {
    if (has(inflight, key)) { stats.shared++; inflight[key].push(cb); return; }
    var waiters = inflight[key] = [cb], finished = false, watchdog;
    function finish(err, res) {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      if (inflight[key] === waiters) delete inflight[key];
      if (err) noteError(err); else stats.lastOk = U.now();
      U.each(waiters, function (w) { deliver(w, err, res); });
    }
    watchdog = U.later(function () { finish(fail('timeout', key.replace(/^\w+ /, ''), { watchdog: true })); }, cfg.timeout * 2 + cfg.retryDelay + 2000, 'api-watchdog');
    try { start(finish); } catch (e) { finish(fail('exception', key, { message: String(e && e.message || e) })); }
  }

  function looksSignedOut(text, finalUrl) {
    if (/\/index\/login(?:\/|$|\?)/i.test(U.parseUrl(finalUrl || '').pathname || '')) return true;
    if (!/private\s+garden|login_btn|\/index\/login/i.test(text || '')) return false;
    return Site.isGate(U.parseHTML(text));
  }

  function fetchDoc(url, cb) {
    var target = normalizeUrl(url);
    if (!target) { deliver(cb, fail('bad-url', String(url))); return; }
    share('doc ' + target, cb, function (finish) {
      request(target, null, function (err, res) {
        if (err) { finish(err); return; }
        try {
          var finalUrl = normalizeUrl(res.url) || target;
          if (/\/index\/login(?:\/|$|\?)/i.test(U.parseUrl(finalUrl).pathname)) { finish(fail('signed-out', target)); return; }
          var doc = U.parseHTML(res.text);
          try { doc.__mbptvUrl = finalUrl; } catch (e) {}
          if (Site.isGate(doc)) { finish(fail('signed-out', target)); return; }
          finish(null, { doc: doc, url: finalUrl });
        } catch (e2) {
          finish(fail('parse', target, { message: String(e2 && e2.message || e2) }));
        }
      });
    });
  }

  function fetchJSON(url, cb) {
    var target = normalizeUrl(url);
    if (!target) { deliver(cb, fail('bad-url', String(url))); return; }
    share('json ' + target, cb, function (finish) {
      request(target, { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json, text/javascript, */*; q=0.01' }, function (err, res) {
        if (err) { finish(err); return; }
        var data = U.parseJSON(res.text);
        if (data == null) {
          finish(fail(looksSignedOut(res.text, res.url) ? 'signed-out' : 'bad-json', target));
          return;
        }
        finish(null, data);
      });
    });
  }

  function withDoc(url, parse, cb) {
    fetchDoc(url, function (err, res) {
      if (err) { cb(err, null); return; }
      var out = null;
      try { out = parse(res.doc, res.url); } catch (e) { Log.error('api-parse', e); }
      if (!out) { cb(fail('parse', res.url), null); return; }
      out.url = res.url;
      cb(null, out);
    });
  }

  function home(cb) { withDoc(Site.url.home(), Site.home, cb); }
  function list(url, cb) { withDoc(url, Site.list, cb); }
  function library(cb) { withDoc(Site.url.library(), Site.list, cb); }

  /* Fetching the search page records the query in the user's server-side history: call it on explicit submit only. */
  function search(q, type, page, cb) {
    q = U.text(q);
    type = U.text(type) || 'all';
    page = Math.max(1, parseInt(page, 10) || 1);
    if (!q) { deliver(cb, null, { query: '', type: type, total: 0, types: [], items: [], playlists: [], next: '', empty: true, page: page, url: '' }); return; }
    withDoc(Site.url.search(q, type, page), Site.search, function (err, res) {
      if (err) { cb(err, null); return; }
      res.page = page;
      if (!res.query) res.query = q;
      if (page === 1) addRecentSearch(q);
      cb(null, res);
    });
  }

  /* ---------- suggestions ---------- */

  var suggestSeq = 0, suggestCache = { keys: [], map: {} };

  function suggest(q, cb) {
    var mine = ++suggestSeq;
    q = U.text(q);
    function answer(err, list) { U.later(function () { if (mine === suggestSeq && typeof cb === 'function') cb(err, list); }, 0, 'api-suggest'); }
    if (!q) { answer(null, []); return; }
    var ck = q.toLowerCase(), hit = has(suggestCache.map, ck) ? suggestCache.map[ck] : null;
    if (hit && U.now() - hit.t < cfg.suggestTtl) { answer(null, hit.list.slice()); return; }
    fetchJSON(Site.url.suggest(q), function (err, data) {
      if (mine !== suggestSeq) return;
      if (err) { cb(err, null); return; }
      var names = Site.suggestions(data);
      if (!has(suggestCache.map, ck)) suggestCache.keys.push(ck);
      suggestCache.map[ck] = { t: U.now(), list: names.slice() };
      while (suggestCache.keys.length > SUGGEST_MAX) delete suggestCache.map[suggestCache.keys.shift()];
      cb(null, names);
    });
  }

  function cancelSuggest() { suggestSeq++; }

  function hot(cb) {
    fetchJSON(Site.url.hot(), function (err, data) {
      if (err) { cb(err, null); return; }
      cb(null, Site.hot(data));
    });
  }

  /* ---------- detail cache ---------- */

  var mem = { keys: [], map: {} };

  function memGet(k) {
    if (!has(mem.map, k)) return null;
    var e = mem.map[k];
    if (U.now() - e.t > cfg.memTtl) { memDrop(k); return null; }
    memDrop(k);
    mem.map[k] = e;
    mem.keys.push(k);
    return e.v;
  }

  function memDrop(k) {
    var i = U.indexOf(mem.keys, k);
    if (i >= 0) mem.keys.splice(i, 1);
    delete mem.map[k];
  }

  function memSet(k, v) {
    memDrop(k);
    mem.map[k] = { t: U.now(), v: v };
    mem.keys.push(k);
    while (mem.keys.length > MEM_MAX) delete mem.map[mem.keys.shift()];
  }

  function clip(s, max) {
    s = U.text(s);
    if (s.length <= max) return s;
    var cut = s.slice(0, max - 1), sp = cut.lastIndexOf(' ');
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-]+$/, '') + '\u2026';
  }

  function compact(d) {
    var r = d.ratings || {};
    return {
      t: U.now(), title: String(d.title || ''), year: String(d.year || ''), backdrop: String(d.backdrop || ''),
      poster: String(d.poster || ''), runtime: String(d.runtime || ''), certification: String(d.certification || ''),
      genres: isArray(d.genres) ? d.genres.slice(0, 6) : [],
      ratings: { imdb: String(r.imdb || ''), tomato: String(r.tomato || ''), audience: String(r.audience || '') },
      overview: clip(d.overview || '', OVERVIEW_MAX)
    };
  }

  var metaState = null, metaTimer = null, metaDirty = false, metaHooked = false;

  function metaLoad() {
    if (metaState) return metaState;
    var raw = null, st = { v: 1, order: [], items: {} }, now = U.now();
    try { raw = Store.local.get(META_KEY, null); } catch (e) { raw = null; }
    if (raw && raw.v === 1 && raw.items && typeof raw.items === 'object') {
      var order = isArray(raw.order) ? raw.order : [];
      U.each(order, function (k) {
        var e = typeof k === 'string' && has(raw.items, k) ? raw.items[k] : null;
        if (!e || typeof e !== 'object' || has(st.items, k)) return;
        var age = now - (+e.t || 0);
        if (age < 0 || age > META_TTL) return;
        st.items[k] = e;
        st.order.push(k);
      });
      while (st.order.length > META_MAX) delete st.items[st.order.shift()];
    }
    metaState = st;
    return st;
  }

  function flush() {
    clearTimeout(metaTimer);
    metaTimer = null;
    if (!metaDirty || !metaState) return;
    metaDirty = false;
    try { Store.local.set(META_KEY, metaState); } catch (e) { Log.warn('api-meta-save', e); }
  }

  function scheduleFlush() {
    metaDirty = true;
    if (!metaHooked) {
      metaHooked = true;
      try { U.on(window, 'pagehide', flush); U.on(window, 'beforeunload', flush); } catch (e) {}
    }
    if (!metaTimer) metaTimer = U.later(flush, 1200, 'api-meta-flush');
  }

  function metaPut(key, d) {
    var st = metaLoad(), i = U.indexOf(st.order, key);
    if (i >= 0) st.order.splice(i, 1);
    st.items[key] = compact(d);
    st.order.push(key);
    while (st.order.length > META_MAX) delete st.items[st.order.shift()];
    scheduleFlush();
  }

  function metaEntry(key) {
    var st = metaLoad();
    if (!has(st.items, key)) return null;
    var e = st.items[key], age = U.now() - (+e.t || 0);
    if (age < 0 || age > META_TTL) {
      delete st.items[key];
      var i = U.indexOf(st.order, key);
      if (i >= 0) st.order.splice(i, 1);
      scheduleFlush();
      return null;
    }
    return e;
  }

  function meta(key) {
    try {
      key = String(key || '');
      if (!key) return null;
      var hit = memGet(key);
      var e = hit ? compact(hit) : metaEntry(key);
      if (!e) return null;
      var out = copy(e);
      if (out) delete out.t;
      return out;
    } catch (err) {
      Log.warn('api-meta', err);
      return null;
    }
  }

  function kindOf(kind) { return /^(?:movie|film)/i.test(String(kind || '')) ? 'movie' : 'tv'; }

  function detail(kind, id, cb, opts) {
    opts = opts || {};
    kind = kindOf(kind);
    id = String(id == null ? '' : id).replace(/[^\d]/g, '');
    if (!id) { deliver(cb, fail('bad-url', kind + ':')); return; }
    var key = kind + ':' + id, season = kind === 'tv' ? Math.max(0, parseInt(opts.season, 10) || 0) : 0;
    var ck = key + (season ? ':s' + season : '');
    if (!opts.force) {
      var hit = memGet(ck);
      if (hit) { deliver(cb, null, hit); return; }
    }
    var pageUrl = Site.url.title(kind, id, season);
    /* Parse against the requested URL so the result is keyed by what was asked for, even after a redirect. */
    withDoc(pageUrl, function (doc) { return Site.detail(doc, pageUrl); }, function (err, d) {
      if (err) { cb(err, null); return; }
      memSet(ck, d);
      if (!season || !has(mem.map, key)) memSet(key, d);
      metaPut(d.key, d);
      cb(null, d);
    });
  }

  /* Adds a Detail parsed elsewhere (for example from the live boot page) to both caches. */
  function remember(d) {
    try {
      if (!d || !d.key || !d.title) return false;
      memSet(d.key, d);
      metaPut(d.key, d);
      return true;
    } catch (e) {
      Log.warn('api-remember', e);
      return false;
    }
  }

  /* ---------- prefetch: one request in flight, the newest pending request wins ---------- */

  var pf = { busy: '', busyCbs: [], pending: null };

  function prefetchTarget(item) {
    if (!item) return null;
    if (typeof item === 'string') {
      var m = /^(movie|tv):(\d+)$/.exec(item);
      return m ? { kind: m[1], id: m[2], key: item } : null;
    }
    var kind = item.kind ? kindOf(item.kind) : '', id = String(item.id || '').replace(/[^\d]/g, '');
    if ((!kind || !id) && item.key) return prefetchTarget(String(item.key));
    return kind && id ? { kind: kind, id: id, key: kind + ':' + id } : null;
  }

  function deliverAll(cbs, err, res) { U.each(cbs, function (c) { deliver(c, err, res); }); }

  function cachedFor(key) { return memGet(key) || (metaEntry(key) ? true : null); }

  function prefetchStart(t, cbs) {
    pf.busy = t.key;
    pf.busyCbs = cbs;
    try {
      detail(t.kind, t.id, function (err, d) {
        if (err && err.code !== 'signed-out') Log.info('api-prefetch', err.code + ' ' + t.key);
        var done = pf.busyCbs, next = pf.pending;
        pf.busy = '';
        pf.busyCbs = [];
        pf.pending = null;
        deliverAll(done, err, d || null);
        if (!next) return;
        if (err && err.code === 'signed-out') { deliverAll(next.cbs, err, null); return; }
        if (err) U.later(function () { prefetchResume(next); }, 1000, 'api-prefetch');
        else prefetchResume(next);
      });
    } catch (e) {
      Log.warn('api-prefetch', e);
      var failed = pf.busyCbs;
      pf.busy = '';
      pf.busyCbs = [];
      deliverAll(failed, fail('exception', t.key), null);
    }
  }

  function prefetchResume(next) {
    var hit = cachedFor(next.t.key);
    if (hit) { deliverAll(next.cbs, null, hit === true ? null : hit); return; }
    if (pf.busy) {
      if (!pf.pending) pf.pending = next;
      else deliverAll(next.cbs, fail('superseded', next.t.key), null);
      return;
    }
    prefetchStart(next.t, next.cbs);
  }

  /* prefetch(item, cb?): cb is optional and called exactly once: with the Detail when the request completes,
     (null, detail|null) at once when the title is already cached, or {code: 'superseded'} when a newer prefetch
     replaced this pending one. Returns true when a request is running or queued for the item. */
  function prefetch(item, cb) {
    var t = prefetchTarget(item);
    if (!t) { deliver(cb, fail('bad-url', ''), null); return false; }
    var hit = cachedFor(t.key);
    if (hit) { deliver(cb, null, hit === true ? null : hit); return false; }
    var cbs = typeof cb === 'function' ? [cb] : [];
    if (pf.busy === t.key) { pf.busyCbs = pf.busyCbs.concat(cbs); return true; }
    if (pf.busy) {
      if (pf.pending && pf.pending.t.key === t.key) { pf.pending.cbs = pf.pending.cbs.concat(cbs); return true; }
      if (pf.pending) deliverAll(pf.pending.cbs, fail('superseded', pf.pending.t.key), null);
      pf.pending = { t: t, cbs: cbs };
      return true;
    }
    prefetchStart(t, cbs);
    return true;
  }

  /* ---------- recent searches (local, alongside the server's history) ---------- */

  var recent = null;

  function indexOfCI(list, q) {
    var k = String(q).toLowerCase();
    for (var i = 0; i < list.length; i++) if (String(list[i]).toLowerCase() === k) return i;
    return -1;
  }

  function recentLoad() {
    if (recent) return recent;
    var raw = null;
    try { raw = Store.local.get(RECENT_KEY, []); } catch (e) { raw = []; }
    recent = [];
    if (isArray(raw)) U.each(raw, function (q) {
      q = U.text(typeof q === 'string' ? q : '').slice(0, 100);
      if (q && recent.length < RECENT_MAX && indexOfCI(recent, q) < 0) recent.push(q);
    });
    return recent;
  }

  function recentSearches() { return recentLoad().slice(); }

  function addRecentSearch(q) {
    var list = recentLoad();
    q = U.text(q).slice(0, 100);
    if (!q) return list.slice();
    var i = indexOfCI(list, q);
    if (i >= 0) list.splice(i, 1);
    list.unshift(q);
    if (list.length > RECENT_MAX) list.length = RECENT_MAX;
    try { Store.local.set(RECENT_KEY, list); } catch (e) {}
    return list.slice();
  }

  function clearRecentSearches() {
    recent = [];
    try { Store.local.remove(RECENT_KEY); } catch (e) {}
  }

  /* Local recents first, then the server's history, deduplicated case-insensitively. */
  function mergeRecent(server) {
    var out = [];
    U.each(recentLoad().concat(isArray(server) ? server : []), function (q) {
      q = U.text(q);
      if (q && out.length < RECENT_MAX && indexOfCI(out, q) < 0) out.push(q);
    });
    return out;
  }

  /* ---------- misc ---------- */

  function configure(opts) {
    if (!opts) return copy(cfg);
    U.each(['timeout', 'retryDelay', 'memTtl', 'suggestTtl'], function (k) {
      if (has(opts, k) && typeof opts[k] === 'number' && opts[k] >= 0) cfg[k] = opts[k];
    });
    return copy(cfg);
  }

  function onSignedOut(fn) {
    if (typeof fn !== 'function') return function () {};
    signedOutFns.push(fn);
    return function () { var i = U.indexOf(signedOutFns, fn); if (i >= 0) signedOutFns.splice(i, 1); };
  }

  function clearCache() {
    mem = { keys: [], map: {} };
    suggestCache = { keys: [], map: {} };
    metaState = { v: 1, order: [], items: {} };
    metaDirty = true;
    flush();
  }

  function guardAsync(name, fn) {
    return function () {
      var args = arguments, cb = null;
      for (var i = args.length - 1; i >= 0; i--) if (typeof args[i] === 'function') { cb = args[i]; break; }
      try { return fn.apply(null, args); } catch (e) {
        Log.error('api:' + name, e);
        deliver(cb, fail('exception', '', { message: String(e && e.message || e) }));
        return undefined;
      }
    };
  }

  function guardSync(name, fn, fallback) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) {
        Log.error('api:' + name, e);
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }

  return {
    fetchDoc: guardAsync('fetchDoc', fetchDoc),
    fetchJSON: guardAsync('fetchJSON', fetchJSON),
    home: guardAsync('home', home),
    list: guardAsync('list', list),
    library: guardAsync('library', library),
    search: guardAsync('search', search),
    suggest: guardAsync('suggest', suggest),
    cancelSuggest: guardSync('cancelSuggest', cancelSuggest, null),
    hot: guardAsync('hot', hot),
    detail: guardAsync('detail', detail),
    meta: guardSync('meta', meta, null),
    remember: guardSync('remember', remember, false),
    prefetch: function (item, cb) {
      try { return prefetch(item, cb); } catch (e) {
        Log.error('api:prefetch', e);
        deliver(cb, fail('exception', '', { message: String(e && e.message || e) }), null);
        return false;
      }
    },
    recentSearches: guardSync('recentSearches', recentSearches, function () { return []; }),
    addRecentSearch: guardSync('addRecentSearch', addRecentSearch, function () { return []; }),
    clearRecentSearches: guardSync('clearRecentSearches', clearRecentSearches, null),
    mergeRecent: guardSync('mergeRecent', mergeRecent, function () { return []; }),
    onSignedOut: guardSync('onSignedOut', onSignedOut, function () { return function () {}; }),
    configure: guardSync('configure', configure, null),
    flush: guardSync('flush', flush, null),
    clearCache: guardSync('clearCache', clearCache, null),
    stats: guardSync('stats', function () { return copy(stats); }, null)
  };
}());

/* User preferences (localStorage mbptv:prefs:v1) with validation and an in-memory mirror. */
var Prefs = (function () {
  var KEY = 'mbptv:prefs:v1';
  var DEFAULTS = { quality: 'best', nativeRemote: true, autoplayNext: false, reduceMotion: false };
  var CHOICES = { quality: ['ask', 'best', '1080p', '720p'] };
  var cache = null, listeners = [];

  function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  function valid(name, value) {
    if (has(CHOICES, name)) return U.indexOf(CHOICES[name], value) >= 0;
    if (has(DEFAULTS, name) && typeof DEFAULTS[name] === 'boolean') return typeof value === 'boolean';
    if (value === undefined || typeof value === 'function') return false;
    try { JSON.stringify(value); return true; } catch (e) { return false; }
  }

  function load() {
    if (cache) return cache;
    var raw = null;
    try { raw = Store.local.get(KEY, null); } catch (e) { raw = null; }
    cache = {};
    var k;
    for (k in DEFAULTS) if (has(DEFAULTS, k)) cache[k] = DEFAULTS[k];
    if (raw && typeof raw === 'object') for (k in raw) if (has(raw, k) && valid(k, raw[k])) cache[k] = raw[k];
    return cache;
  }

  function get(name) {
    try { var c = load(); return has(c, name) ? c[name] : undefined; } catch (e) { return has(DEFAULTS, name) ? DEFAULTS[name] : undefined; }
  }

  function set(name, value) {
    try {
      var c = load();
      name = String(name || '');
      if (!name || !valid(name, value)) { Log.warn('prefs', 'rejected ' + name); return get(name); }
      var old = c[name];
      c[name] = value;
      try { Store.local.set(KEY, c); } catch (e) {}
      if (old !== value) U.each(listeners.slice(), function (fn) { U.later(function () { fn(name, value, old); }, 0, 'prefs-change'); });
      return value;
    } catch (e2) {
      Log.error('prefs', e2);
      return get(name);
    }
  }

  function all() {
    var c = load(), out = {};
    for (var k in c) if (has(c, k)) out[k] = c[k];
    return out;
  }

  function defaults() {
    var out = {};
    for (var k in DEFAULTS) if (has(DEFAULTS, k)) out[k] = DEFAULTS[k];
    return out;
  }

  function reset() {
    cache = null;
    try { Store.local.remove(KEY); } catch (e) {}
    return all();
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () { var i = U.indexOf(listeners, fn); if (i >= 0) listeners.splice(i, 1); };
  }

  return { get: get, set: set, all: all, defaults: defaults, reset: reset, onChange: onChange, choices: function () { return CHOICES.quality.slice(); } };
}());

/* Navigation state across real page loads (sessionStorage mbptv:session:v1), valid for 30 minutes.
   save(stack, {expect, returnTo}) before navigating away; take(pageType) on boot returns the stack once, and only
   when pageType matches the saved expect (a non-matching page leaves it for the page that does match). */
var Session = (function () {
  var KEY = 'mbptv:session:v1', TTL = 30 * 60 * 1000;
  var mirror, loaded = false;

  function isArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function here() { try { return String(location.href || ''); } catch (e) { return ''; } }

  function valid(r) { return !!(r && typeof r === 'object' && r.v === 1 && typeof r.t === 'number' && isArray(r.stack)); }

  function load() {
    if (loaded) return mirror;
    loaded = true;
    var raw = null;
    try { raw = Store.session.get(KEY, null); } catch (e) { raw = null; }
    mirror = valid(raw) ? raw : null;
    return mirror;
  }

  function clear() {
    loaded = true;
    mirror = null;
    try { Store.session.remove(KEY); } catch (e) {}
  }

  function save(stack, opts) {
    try {
      opts = opts || {};
      var rec = {
        v: 1, t: U.now(), stack: isArray(stack) ? stack : [],
        expect: String(opts.expect || Site.pageType(here())), returnTo: String(opts.returnTo || here()), from: here()
      };
      var plain = null;
      try { plain = JSON.parse(JSON.stringify(rec)); } catch (e) { Log.warn('session', e); }
      if (!plain) { rec.stack = []; plain = rec; }
      loaded = true;
      mirror = plain;
      try { Store.session.set(KEY, plain); } catch (e2) {}
      return true;
    } catch (e3) {
      Log.error('session-save', e3);
      return false;
    }
  }

  function peek() {
    try {
      var r = load();
      if (!r) return null;
      var age = U.now() - r.t;
      if (age > TTL || age < -60000) { clear(); return null; }
      return JSON.parse(JSON.stringify(r));
    } catch (e) {
      Log.warn('session-peek', e);
      return null;
    }
  }

  function take(expect) {
    var r = peek();
    if (!r) return null;
    if (expect && r.expect && r.expect !== expect) return null;
    clear();
    return r.stack;
  }

  function returnTo() { var r = peek(); return r ? String(r.returnTo || '') : ''; }

  return { save: save, peek: peek, take: take, clear: clear, returnTo: returnTo, ttl: TTL };
}());
