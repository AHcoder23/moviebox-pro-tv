/* Screens: home, browse grid, search, detail, library (browse), settings, diagnostics, sign-in, error, loading.
   A screen factory returns an instance: {name, el, rail, nav, initialFocus(), onFocus(el, prev), onKey(name, ev),
   onBack(), onShow(), onHide(), destroy(), snapshot()}. Screens render from Api (fetched documents) and fall back to
   an inline state or App.screenFailed(inst, err) \u2014 never a blank screen. */
var Screens = (function () {
  var registry = {};

  /* ---------- Shared helpers ---------- */

  function el(tag, cls, text, parent) { return U.el(tag, cls, text, parent); }

  function pref(name, fallback) {
    try { if (typeof Prefs !== 'undefined' && Prefs.get) { var v = Prefs.get(name); return v == null ? fallback : v; } } catch (e) {}
    return fallback;
  }

  function setPref(name, value) {
    try { if (typeof Prefs !== 'undefined' && Prefs.set) Prefs.set(name, value); } catch (e) { Log.warn('prefs', e); }
  }

  function meta(key) {
    try { if (typeof Api !== 'undefined' && Api.meta) return Api.meta(key) || null; } catch (e) {}
    return null;
  }

  /* Calls Api[name](...args, cb) defensively: a missing or throwing data layer becomes an async error. */
  function api(name, args, cb) {
    var done = false;
    function finish(err, res) { if (done) return; done = true; cb(err, res); }
    try {
      if (typeof Api === 'undefined' || typeof Api[name] !== 'function') throw new Error('Api.' + name + ' unavailable');
      Api[name].apply(Api, args.concat([U.guard(function (err, res) { finish(err, res); }, 'api:' + name)]));
    } catch (e) {
      Log.error('api:' + name, e);
      U.later(function () { finish({ code: 'exception', message: String(e && e.message || e) }, null); }, 0, 'api-fail');
    }
  }

  function site(fnName, args, fallback) {
    try {
      if (typeof Site !== 'undefined' && typeof Site[fnName] === 'function') {
        var r = Site[fnName].apply(Site, args || []);
        return r == null ? fallback : r;
      }
    } catch (e) { Log.error('site:' + fnName, e); }
    return fallback;
  }

  function siteUrl(name, args, fallbackPath) {
    try { if (typeof Site !== 'undefined' && Site.url && typeof Site.url[name] === 'function') return Site.url[name].apply(Site.url, args || []); } catch (e) { Log.warn('site-url', e); }
    return U.abs(fallbackPath || '/', location.href);
  }

  function normItem(it) {
    it = it || {};
    var kind = it.kind === 'tv' ? 'tv' : 'movie';
    var id = String(it.id || '');
    return {
      key: it.key || (kind + ':' + id), kind: kind, id: id, title: U.text(it.title), href: it.href || '',
      poster: it.poster || '', backdrop: it.backdrop || '', rating: U.text(it.rating), tomato: U.text(it.tomato),
      year: U.text(it.year), runtime: U.text(it.runtime), genres: it.genres && it.genres.length ? it.genres : [],
      badge: it.badge || '', update: U.text(it.update),
      progress: typeof it.progress === 'number' ? it.progress : -1, progressLabel: U.text(it.progressLabel), playHref: it.playHref || ''
    };
  }

  function normItems(list) {
    var out = [], seen = {};
    U.each(list || [], function (it) {
      if (!it || !it.id) return;
      var n = normItem(it);
      if (seen[n.key]) return;
      seen[n.key] = true;
      out.push(n);
    });
    return out;
  }

  /* Only the fields the UI needs, so snapshots stay small in sessionStorage. */
  function compactItem(it) {
    return { key: it.key, kind: it.kind, id: it.id, title: it.title, poster: it.poster, backdrop: it.backdrop, rating: it.rating,
      year: it.year, badge: it.badge, update: it.update, progress: it.progress, progressLabel: it.progressLabel, playHref: it.playHref };
  }

  function errorMessage(err) {
    var code = err && err.code || '';
    if (code === 'timeout') return 'The website took too long to answer. Check the connection and try again.';
    if (code === 'network') return 'The TV could not reach the website. Check the internet connection and try again.';
    if (/^http-5/.test(code)) return 'The website had a problem answering (' + code.replace('http-', 'error ') + '). It usually passes quickly.';
    if (/^http-4/.test(code)) return 'The website did not recognise this page (' + code.replace('http-', 'error ') + ').';
    if (code === 'parse') return 'The page loaded, but its layout was not recognised. You can still open it on the website.';
    return 'Something went wrong while loading this page.';
  }

  function base(name, cls) {
    var s = {
      name: name, el: el('div', 'mb-screen mb-' + cls), rail: true, nav: '',
      initialFocus: null, onFocus: null, onKey: null, onBack: null, onShow: null, onHide: null, destroy: null, snapshot: null,
      alive: true
    };
    s.initialFocus = function () { return Focus.firstIn(s.el); };
    return s;
  }

  function fail(s, err) {
    if (!s.alive) return;
    App.screenFailed(s, err || { code: 'unknown' });
  }

  /* Empty / inline error state with actions. opts: {icon, title, text, actions: [{label, icon, action, primary, run}]} */
  function stateBlock(parent, opts, zoneName) {
    var box = el('div', 'mb-empty', null, parent);
    box.appendChild(Icons.el(opts.icon || 'info', 'mb-empty-ico'));
    el('div', 'mb-section', opts.title || '', box);
    if (opts.text) el('div', 'mb-body', opts.text, box);
    var btns = Kit.zone(el('div', 'mb-btns', null, box), zoneName || 'buttons');
    U.each(opts.actions || [], function (a) {
      var b = Kit.button({ label: a.label, icon: a.icon, action: a.action, primary: a.primary, parent: btns, key: (zoneName || 'buttons') + '|' + a.action });
      b.__run = a.run;
    });
    return box;
  }

  function heroTags(parent, info) {
    U.empty(parent);
    if (info.imdb) el('span', 'mb-tag mb-tag--imdb', 'IMDb ' + info.imdb, parent);
    if (info.badge) el('span', 'mb-tag mb-tag--line', /4k/i.test(info.badge) ? '4K' : /blu/i.test(info.badge) ? 'Blu-ray' : info.badge, parent);
    if (info.update) el('span', 'mb-tag mb-tag--gold', info.update, parent);
  }

  /* Detail badges without repeats (a badge contained as a whole word in another, like '4K' in '4K HDR', is dropped),
     HDR and 4K first, then disc and source badges; at most three. */
  function badgeList(list) {
    var out = [];
    U.each(list || [], function (b, i) {
      b = U.text(b);
      var low = b.toLowerCase();
      if (!b) return;
      var dup = U.find(list, function (o) { o = U.text(o).toLowerCase(); return o !== low && (' ' + o + ' ').indexOf(' ' + low + ' ') >= 0; });
      if (!dup && !U.find(out, function (x) { return x.b.toLowerCase() === low; })) out.push({ b: b, i: i });
    });
    function rank(b) { return /hdr|dolby|vision/i.test(b) ? 0 : /\b(?:4k|8k|uhd)\b/i.test(b) ? 1 : 2; }
    out.sort(function (x, y) { return (rank(x.b) - rank(y.b)) || (x.i - y.i); });
    return U.map(out.slice(0, 3), function (x) { return x.b; });
  }

  /* ---------- Image sizes ----------
     Pictures are asked for at the size they are shown (Kit.imgUrl / Site.thumb: the site's thumbnail service honours
     any width; TMDB art gets w780 or w1280). Every sized URL falls back to the original on an error. Full-screen art
     is 1280 wide at quality 85 (780 in performance mode), large posters 500, episode stills 640. */
  var IMG_POSTER = 500, IMG_STILL = 640;

  function perfOn() {
    try { return typeof Kit.perf === 'function' && !!Kit.perf(); } catch (e) { return false; }
  }

  function sizedUrl(url, w) {
    if (!Kit.safeImage(url)) return url;
    try { if (typeof Kit.imgUrl === 'function') return Kit.imgUrl(url, w) || url; } catch (e) { Log.warn('img-url', e); }
    try { if (typeof Site !== 'undefined' && typeof Site.thumb === 'function') return Site.thumb(url, w) || url; } catch (e2) { Log.warn('img-thumb', e2); }
    return url;
  }

  /* TMDB art at w780 or w1280 (never larger than it came), recognised by its /t/p/<size>/ path on any host, as
     Site.detail does when it picks the w1280 backdrop. '' for any other URL. */
  var TMDB_SIZE = /^(https?:\/\/[^?#]*\/t\/p\/)(original|w\d+)(\/[^?#]+)$/i;
  function tmdbAt(url, w) {
    var m = TMDB_SIZE.exec(String(url || ''));
    if (!m) return '';
    var have = /^original$/i.test(m[2]) ? 1e9 : parseInt(m[2].slice(1), 10) || 1e9, want = w <= 780 ? 780 : 1280;
    return have <= want ? url : m[1] + 'w' + want + m[3];
  }

  function heroUrl(url) {
    if (!Kit.safeImage(url)) return url;
    var w = perfOn() ? 780 : 1280, t = url;
    try { if (typeof Site !== 'undefined' && typeof Site.thumb === 'function') t = Site.thumb(url, w, 85) || url; } catch (e) { t = url; }
    return t !== url ? t : (tmdbAt(url, w) || sizedUrl(url, w));
  }

  function posterUrl(url) { return sizedUrl(url, perfOn() ? 342 : IMG_POSTER); }

  /* A lazy <img> at w CSS pixels (Kit.img with a width when the kit sizes images itself, else a pre-sized URL with the
     original as its fallback). */
  function image(url, cls, parent, w, eager) {
    var node;
    if (typeof Kit.imgUrl === 'function') node = Kit.img(url, { cls: cls, parent: parent, w: w, eager: !!eager });
    else node = Kit.img(sizedUrl(url, w), cls, parent, url);
    if (eager && typeof Kit.imgUrl !== 'function') Kit.loadNow(node);
    return node;
  }

  function candidates(list) {
    var out = [];
    U.each(list, function (u) { if (Kit.safeImage(u) && U.indexOf(out, u) < 0) out.push(u); });
    return out;
  }

  /* Crossfading art layer with the poster fallback treatment (large, scaled, 35% opacity). set(backdrop, poster) takes
     the original URLs; each is loaded at its display size first and falls back to the original on an error. */
  function artLayer(parent, onFallback) {
    var wrap = el('div', 'mb-art', null, parent);
    var poster = el('img', 'mb-img mb-art-poster', null, wrap);
    var a = el('img', 'mb-img mb-art-img', null, wrap);
    var b = el('img', 'mb-img mb-art-img', null, wrap);
    U.each([poster, a, b], function (n) { n.setAttribute('alt', ''); });
    var front = a, want = '', wantPoster = '';
    function clearBackdrop() { U.toggleClass(a, 'is-loaded', false); U.toggleClass(b, 'is-loaded', false); }
    function showPoster(list) {
      var url = list[0];
      if (!url) { U.toggleClass(poster, 'is-loaded', false); return; }
      if (wantPoster === url && U.hasClass(poster, 'is-loaded')) return;
      wantPoster = url;
      poster.onload = U.guard(function () { if (wantPoster === url) U.toggleClass(poster, 'is-loaded', true); }, 'art-poster');
      poster.onerror = U.guard(function () {
        if (wantPoster !== url) return;
        wantPoster = '';
        if (list.length > 1) showPoster(list.slice(1)); else U.toggleClass(poster, 'is-loaded', false);
      }, 'art-poster-err');
      if (poster.getAttribute('src') !== url) { U.toggleClass(poster, 'is-loaded', false); poster.src = url; }
      else U.toggleClass(poster, 'is-loaded', true);
    }
    function show(backs, posters, rawPoster) {
      var backdrop = backs[0];
      if (backdrop) {
        U.toggleClass(poster, 'is-loaded', false);
        wantPoster = '';
        if (want === backdrop) return;
        want = backdrop;
        var next = front === a ? b : a;
        if (next.getAttribute('src') === backdrop && U.hasClass(next, 'is-ready')) {
          U.toggleClass(next, 'is-loaded', true); U.toggleClass(front, 'is-loaded', false); front = next; return;
        }
        next.onload = U.guard(function () {
          U.toggleClass(next, 'is-ready', true);
          if (want !== backdrop) return;
          U.toggleClass(next, 'is-loaded', true);
          if (front !== next) U.toggleClass(front, 'is-loaded', false);
          front = next;
        }, 'art-load');
        next.onerror = U.guard(function () {
          if (want !== backdrop) return;
          want = '';
          if (backs.length > 1) { show(backs.slice(1), posters, rawPoster); return; }
          clearBackdrop();
          showPoster(posters);
          if (onFallback) onFallback(rawPoster);
        }, 'art-error');
        U.toggleClass(next, 'is-ready', false);
        next.src = backdrop;
      } else {
        want = '';
        clearBackdrop();
        showPoster(posters);
      }
    }
    function set(backdrop, rawPoster) {
      show(candidates([heroUrl(backdrop), backdrop]), candidates([posterUrl(rawPoster), rawPoster]), rawPoster);
    }
    return { el: wrap, set: set };
  }

  function scrims(parent, withTop) {
    el('div', 'mb-scrim-l', null, parent);
    el('div', 'mb-scrim-b', null, parent);
    if (withTop) el('div', 'mb-scrim-t', null, parent);
  }

  function qualityLabel(q) {
    return q === '1080p' ? '1080p' : q === '720p' ? '720p' : q === 'ask' ? 'Ask every time' : 'Best available';
  }

  function isContinue(it) { return !!it && (it.progress >= 0 || !!it.playHref); }

  /* ---------- Loading ---------- */

  registry.loading = function (params) {
    var s = base('loading', 'loading');
    s.rail = false;
    var inner = el('div', 'mb-loading-inner', null, s.el);
    Kit.monogram(inner, 'mb-mono--xl');
    var word = el('div', 'mb-wordmark', 'MovieBox ', inner);
    el('span', null, 'Pro', word);
    Kit.spinner(inner);
    s.msg = el('div', 'mb-loading-msg', params.message || '', inner);
    s.initialFocus = function () { return null; };
    s.setMessage = function (t) { s.msg.textContent = t || ''; };
    return s;
  };

  /* ---------- Error ---------- */

  registry.error = function (params) {
    var s = base('error', 'error');
    s.nav = params.nav || '';
    var box = el('div', 'mb-state', null, s.el);
    box.appendChild(Icons.el('info', 'mb-state-ico'));
    el('div', 'mb-h1', params.title || 'Couldn\u2019t load this page', box);
    el('div', 'mb-body', params.message || errorMessage(params.err), box);
    var code = params.err && params.err.code ? 'Code: ' + params.err.code : '';
    el('div', 'mb-code', code, box);
    var btns = Kit.zone(el('div', 'mb-btns', null, box), 'buttons');
    var retry = Kit.button({ label: 'Retry', icon: 'reload', action: 'retry', primary: true, parent: btns });
    Kit.button({ label: 'Open website', icon: 'globe', action: 'open-website', parent: btns });
    Kit.button({ label: 'Home', icon: 'home', action: 'home', parent: btns });
    s.initialFocus = function () { return retry; };
    s.websiteUrl = params.websiteUrl || '';
    return s;
  };

  /* ---------- Sign-in (the site's "Private Garden" gate) ---------- */

  registry.signin = function () {
    var s = base('signin', 'signin');
    s.rail = false;
    var c = el('div', 'mb-center', null, s.el);
    Kit.monogram(c, 'mb-mono--xl');
    el('div', 'mb-h1', 'Sign in to MovieBox Pro', c);
    el('div', 'mb-body', 'Your account lives on the MovieBox Pro website. Choose how to sign in and the website opens so you can finish there.', c);
    var stack = Kit.zone(el('div', 'mb-stack', null, c), 'list');
    var first = Kit.button({ label: 'Sign in with QR code', icon: 'qr', action: 'signin-qr', primary: true, parent: stack });
    Kit.button({ label: 'Sign in with a code', icon: 'keypad', action: 'signin-code', parent: stack });
    Kit.button({ label: 'Sign in with Google', icon: 'user', action: 'signin-google', parent: stack });
    Kit.button({ label: 'I\u2019ve signed in \u2014 try again', icon: 'reload', action: 'retry', parent: stack });
    el('div', 'mb-note', 'Sign-in happens on the website. The TV app never sees or stores your password.', c);
    s.initialFocus = function () { return first; };
    return s;
  };

  /* ---------- Home ---------- */

  registry.home = function (params, ctx) {
    var s = base('home', 'home');
    s.nav = 'home';
    var hero = el('div', 'mb-hero', null, s.el);
    var art = artLayer(hero);
    scrims(hero, true);
    var info = el('div', 'mb-hero-info', null, s.el);
    var text = el('div', 'mb-hero-text', null, info);
    var kicker = el('div', 'mb-kicker', '', text);
    var title = el('div', 'mb-display', '', text);
    var metaEl = el('div', 'mb-meta', '', text);
    var tags = el('div', 'mb-tags', null, text);
    var resume = el('div', 'mb-hero-resume', null, text);
    var overview = el('div', 'mb-body mb-clamp3', '', text);
    var btns = Kit.zone(el('div', 'mb-btns', null, info), 'hero');
    var playBtn = Kit.button({ label: 'Play', icon: 'play', action: 'play', primary: true, parent: btns });
    Kit.button({ label: 'Details', icon: 'info', action: 'details', parent: btns });
    var port = el('div', 'mb-rows-port', null, s.el);
    var rowsEl = el('div', 'mb-rows', null, port);
    var heroItem = null, heroRow = '', heroTimer = null, dwellTimer = null, pollTimer = null, rowEls = [];

    function skeleton() {
      U.empty(rowsEl);
      title.textContent = '';
      heroPlaceholder(true);
      for (var r = 0; r < 2; r++) {
        var row = el('div', 'mb-row', null, rowsEl);
        el('div', 'mb-row-title', '', row).appendChild(el('div', 'mb-skel mb-skel-meta'));
        var view = el('div', 'mb-row-view', null, row);
        Kit.skeletonCards(el('div', 'mb-track', null, view), 9, 'poster');
      }
      btns.style.display = 'none';
    }

    /* A title whose name is not known yet (a Featured banner before its page was fetched) shows placeholders instead of
       an empty hero. Its buttons are hidden anyway while focus is in the rows (.in-rows), and stay usable from the hero:
       Play and Details work from the title's id alone. */
    function heroPlaceholder(on) {
      if (on && !s.heroSkel) {
        var sk = el('div', 'mb-skel mb-skel-title'), sm = el('div', 'mb-skel mb-skel-meta');
        text.insertBefore(sk, metaEl);
        text.insertBefore(sm, metaEl);
        s.heroSkel = [sk, sm];
      } else if (!on && s.heroSkel) {
        U.each(s.heroSkel, U.detach);
        s.heroSkel = null;
      }
    }

    function fillHero(item, rowTitle, fade) {
      if (!item || !s.alive) return;
      var m = meta(item.key) || {};
      var ratings = m.ratings || {};
      var infoData = {
        imdb: ratings.imdb || item.rating || '',
        badge: item.badge,
        update: item.kind === 'tv' ? (item.update || '') : ''
      };
      var apply = function () {
        var name = item.title || m.title || '';
        heroPlaceholder(!name);
        /* The kicker names the kind of title; the row name is already shown right above the focused row. */
        kicker.textContent = item.kind === 'tv' ? 'TV Series' : 'Movie';
        title.textContent = name;
        var genres = m.genres && m.genres.length ? m.genres : item.genres;
        metaEl.textContent = Kit.metaLine([m.year || item.year, Kit.fmtRuntime(m.runtime || item.runtime), m.certification, Kit.genresText(genres, 3)]);
        heroTags(tags, infoData);
        U.empty(resume);
        if (item.progress >= 0) {
          Kit.progressBar(item.progress, resume);
          el('div', 'mb-meta', item.progressLabel ? 'Continue from ' + item.progressLabel : 'Continue watching', resume);
          resume.style.display = '';
        } else resume.style.display = 'none';
        var ov = U.text(m.overview);
        overview.textContent = ov;
        Kit.setLabel(playBtn, isContinue(item) ? 'Resume' : 'Play');
        art.set(m.backdrop || item.backdrop, m.poster || item.poster);
      };
      if (fade) {
        U.toggleClass(text, 'is-swapping', true);
        U.later(function () { if (heroItem === item) apply(); U.toggleClass(text, 'is-swapping', false); }, 140, 'hero-swap');
      } else apply();
    }

    function watchMeta(item, rowTitle) {
      clearTimeout(pollTimer);
      var tries = 0;
      var have = !!(meta(item.key) || {}).overview;
      if (have) return;
      (function poll() {
        pollTimer = U.later(function () {
          if (!s.alive || heroItem !== item) return;
          var m = meta(item.key);
          if (m && (m.overview || m.backdrop)) { learnTitle(item, m); fillHero(item, rowTitle, false); return; }
          if (++tries < 24) poll();
        }, 350, 'hero-meta');
      }());
    }

    /* A title learned from its page (banners carry none) is written back to the item and its cards. */
    function learnTitle(item, d) {
      var t = U.text((d && d.title) || (meta(item.key) || {}).title);
      if (!t || U.text(item.title)) return;
      U.each(U.qsa(rowsEl, '[data-key="' + item.key + '"]'), function (c) {
        var lab = U.qs(c, '.mb-card-label') || U.qs(c, '.mb-card-title');
        if (!lab || !U.text(lab.textContent)) Kit.setCardTitle(c, t);
      });
      item.title = t;
    }

    function prefetch(item, rowTitle) {
      try {
        if (typeof Api !== 'undefined' && Api.prefetch) Api.prefetch(item, U.guard(function (err, d) { learnTitle(item, d); if (heroItem === item) fillHero(item, rowTitle, false); }, 'prefetch-cb'));
      } catch (e) { Log.warn('prefetch', e); }
      watchMeta(item, rowTitle);
    }

    function focusItem(item, rowTitle) {
      if (heroItem && item && heroItem.key === item.key && heroRow === rowTitle) return;
      heroItem = item;
      heroRow = rowTitle;
      clearTimeout(heroTimer); clearTimeout(dwellTimer); clearTimeout(pollTimer);
      heroTimer = U.later(function () { if (heroItem === item) fillHero(item, rowTitle, true); }, 250, 'hero');
      /* A title with no name yet (a Featured banner) is fetched almost at once; others after the dwell (longer in TV
         performance mode, so scrolling through a row starts fewer requests). */
      var dwell = 450;
      try { if (typeof Kit.timing === 'function') dwell = Kit.timing('dwell') || 450; } catch (e) { dwell = 450; }
      dwellTimer = U.later(function () { if (heroItem === item) prefetch(item, rowTitle); }, item.title ? dwell : 60, 'dwell');
    }

    function makeRow(row, index) {
      var zoneName = 'row:' + row.id;
      var rowEl = Kit.zone(el('div', 'mb-row' + (row.wide ? ' mb-row--wide' : ''), null, rowsEl), zoneName);
      rowEl.__title = row.title;
      el('div', 'mb-row-title', row.title, rowEl);
      var view = el('div', 'mb-row-view', null, rowEl);
      var track = el('div', 'mb-track', null, view);
      U.each(row.items, function (it) { track.appendChild(Kit.card(it, { size: row.wide ? 'wide' : 'poster', zone: zoneName })); });
      if (row.more) {
        var more = Kit.moreTile(zoneName, 'See all', row.wide ? 'wide' : 'poster');
        more.__run = function () { App.push('browse', { url: row.more, title: row.title, kicker: 'Browse' }); };
        track.appendChild(more);
      }
      rowEls.push(rowEl);
      return rowEl;
    }

    function render(data) {
      if (!s.alive) return;
      rowEls = [];
      U.empty(rowsEl);
      btns.style.display = '';
      var rows = [], cont = null, banners = [];
      var byKey = {};
      U.each(data && data.rows || [], function (r, i) {
        var items = normItems(r.items);
        if (!items.length) return;
        U.each(items, function (it) { if (!byKey[it.key]) byKey[it.key] = it; });
        var row = { id: String(r.id || ('r' + i)).replace(/[^\w-]/g, '') || ('r' + i), title: U.text(r.title) || 'Featured', items: items, more: r.more || '' };
        if (!cont && U.find(items, function (it) { return it.progress >= 0; })) cont = row;
        else rows.push(row);
      });
      U.each(data && data.banners || [], function (b) {
        if (!b || !b.id) return;
        var known = byKey[b.key] || {};
        var it = normItem({ key: b.key, kind: b.kind, id: b.id, href: b.href, title: known.title || '', poster: known.poster || '', backdrop: b.image || known.backdrop, rating: known.rating, year: known.year, badge: known.badge, genres: known.genres });
        banners.push(it);
      });
      var ordered = [];
      if (cont) ordered.push(cont);
      if (banners.length) ordered.push({ id: 'featured', title: 'Featured', items: banners, wide: true, more: '' });
      ordered = ordered.concat(rows);
      if (!ordered.length) {
        hero.style.display = 'none';
        info.style.display = 'none';
        stateBlock(rowsEl, {
          icon: 'film', title: 'Nothing to show yet',
          text: 'The home page loaded, but no rows were recognised. The website itself still works.',
          actions: [{ label: 'Retry', icon: 'reload', action: 'retry', primary: true }, { label: 'Open website', icon: 'globe', action: 'open-website' }]
        }, 'buttons');
        port.style.top = '30%';
        return;
      }
      U.each(ordered, makeRow);
      var first = Focus.firstIn(rowEls[0]);
      if (first && first.__item) { heroItem = null; focusItem(first.__item, rowEls[0].__title); fillHero(first.__item, rowEls[0].__title, false); }
      App.screenReady(s);
    }

    s.initialFocus = function () { return rowEls.length ? Focus.firstIn(rowEls[0]) : Focus.firstIn(s.el); };

    s.onFocus = function (node) {
      var z = Focus.zoneOf(node), name = z ? z.getAttribute('data-zone') : '';
      if (name.indexOf('row:') === 0) {
        var idx = U.indexOf(rowEls, z);
        var y = idx > 0 ? rowEls[idx].offsetTop - rowEls[0].offsetTop : 0;
        Kit.setY(rowsEl, -y);
        U.each(rowEls, function (r, i) { U.toggleClass(r, 'is-past', i < idx); });
        /* In the rows the hero's buttons step aside and the rows move up, so the next row peeks in below. */
        U.toggleClass(s.el, 'in-rows', true);
        if (node.__item) focusItem(node.__item, z.__title);
      } else if (name === 'hero') {
        Kit.setY(rowsEl, 0);
        U.toggleClass(s.el, 'in-rows', false);
        U.each(rowEls, function (r) { U.toggleClass(r, 'is-past', false); });
      }
    };

    /* Up and Down step through the rows in order (the rows above the focused one are faded and moved up, so geometry
       alone could skip one); Up from the first row reaches the hero's buttons. */
    s.onKey = function (name) {
      if (name !== 'up' && name !== 'down') return false;
      var cur = Focus.current(), z = cur ? Focus.zoneOf(cur) : null, idx = z ? U.indexOf(rowEls, z) : -1;
      if (idx < 0) return false;
      var ti = idx + (name === 'down' ? 1 : -1), target = null;
      if (ti >= rowEls.length) return true;
      if (ti < 0) target = btns.__mbLast && Focus.shown(btns.__mbLast) && btns.contains(btns.__mbLast) ? btns.__mbLast : playBtn;
      else target = Focus.enter(rowEls[ti], name, cur.getBoundingClientRect());
      if (target && Focus.shown(target)) App.moveTo(target);
      return true;
    };

    /* Back from a lower row returns to the first row (like other TV apps); Back on the first row or the hero asks to
       exit (section 6.3). */
    s.onBack = function () {
      var cur = Focus.current(), z = cur ? Focus.zoneOf(cur) : null, idx = z ? U.indexOf(rowEls, z) : -1;
      if (idx <= 0) return false;
      var first = rowEls[0], target = first.__mbLast && Focus.shown(first.__mbLast) && first.contains(first.__mbLast) ? first.__mbLast : Focus.firstIn(first);
      if (!target) return false;
      App.focus(target);
      return true;
    };

    s.act = function (action, node) {
      if (action === 'play' && heroItem) { App.play({ kind: heroItem.kind, id: heroItem.id, title: heroItem.title, item: heroItem, playHref: heroItem.playHref }); return true; }
      if (action === 'details' && heroItem) { App.push('detail', { kind: heroItem.kind, id: heroItem.id, item: compactItem(heroItem) }); return true; }
      if (action === 'retry') { App.retry(); return true; }
      if (action === 'open-website') { App.openWebsite(siteUrl('home', [], '/')); return true; }
      if (node && node.__item) { App.push('detail', { kind: node.__item.kind, id: node.__item.id, item: compactItem(node.__item) }); return true; }
      return false;
    };

    s.destroy = function () { clearTimeout(heroTimer); clearTimeout(dwellTimer); clearTimeout(pollTimer); };

    skeleton();
    var live = ctx && ctx.live ? (ctx.model && ctx.model.rows ? ctx.model : site('home', [document], null)) : null;
    if (live && live.rows && live.rows.length) U.later(function () { render(live); }, 0, 'home-live');
    else api('home', [], function (err, data) {
      if (!s.alive) return;
      if (err) { fail(s, err); return; }
      render(data);
    });
    return s;
  };

  /* ---------- Detail ---------- */

  registry.detail = function (params, ctx) {
    var s = base('detail', 'detail');
    s.nav = params.nav || '';
    var kind = params.kind === 'tv' ? 'tv' : 'movie', id = String(params.id || '');
    var key = kind + ':' + id;
    var seed = normItem(params.item || { kind: kind, id: id, key: key });
    var model = null, season = params.season || 0;
    var back = el('div', 'mb-backdrop', null, s.el);
    var art = artLayer(back, function (rawPoster) { showPosterCard(rawPoster); });
    scrims(back, true);
    el('div', 'mb-dim', null, back);
    var posterCard = el('div', 'mb-detail-poster', null, s.el);
    posterCard.style.display = 'none';
    var vport = el('div', 'mb-vport', null, s.el);
    var vs = el('div', 'mb-vscroll', null, vport);
    /* Compact header shown above the rows once the viewer moves below the info block: title, a meta line and three
       lines of text (the overview, or the focused episode's code, title and overview). Its height is fixed, so the
       rows always start at the same place right under it. */
    var mini = el('div', 'mb-detail-mini', null, s.el);
    var miniKicker = el('div', 'mb-kicker', kind === 'tv' ? 'TV Series' : 'Movie', mini);
    var miniTitle = el('div', 'mb-mini-title', seed.title, mini);
    var miniMeta = el('div', 'mb-mini-meta', '', mini);
    var miniBody = el('div', 'mb-mini-body', '', mini);
    var top = el('div', 'mb-detail-top', null, vs);
    var info = el('div', 'mb-detail-info', null, top);
    var kicker = el('div', 'mb-kicker', kind === 'tv' ? 'TV Series' : 'Movie', info);
    var title = el('div', 'mb-display', seed.title, info);
    var metaEl = el('div', 'mb-meta', '', info);
    var ratings = el('div', 'mb-ratings', null, info);
    var overview = el('div', 'mb-body mb-clamp4', '', info);
    var tags = el('div', 'mb-tags', null, info);
    var btns = Kit.zone(el('div', 'mb-btns', null, info), 'hero');
    var playBtn = Kit.button({ label: playLabel(null), icon: 'play', action: 'play', primary: true, parent: btns });
    var qualityBtn = null, episodesBtn = null;
    if (kind === 'movie') qualityBtn = Kit.button({ label: 'Quality: ' + qualityLabel(pref('quality', 'best')).replace(' available', ''), icon: 'quality', action: 'quality', parent: btns });
    else episodesBtn = Kit.button({ label: 'Episodes', icon: 'list', action: 'episodes', parent: btns });
    var rowsWrap = el('div', 'mb-detail-rows', null, vs);
    var seasonsRow = null, episodesRow = null, episodesTrack = null, seasonLine = null, rowEls = [];
    /* Season switching (section 6.2): focus resting on a season pill for SEASON_DWELL ms loads that season (OK loads it
       at once). While it loads, the previous episodes stay, dimmed, under a spinner, and Down waits for the new list. */
    var SEASON_DWELL = 450, dwellTimer = null, seasonSeq = 0, loadingSeason = 0, pendingDown = false;

    function skeletonInfo() {
      var m = meta(key) || {};
      if (!title.textContent) title.textContent = m.title || '';
      if (!title.textContent) { title.style.display = 'none'; info.insertBefore(el('div', 'mb-skel mb-skel-title'), metaEl); }
      metaEl.textContent = Kit.metaLine([m.year || seed.year, Kit.fmtRuntime(m.runtime || seed.runtime), m.certification, Kit.genresText(m.genres || seed.genres, 3)]);
      if (m.overview) overview.textContent = m.overview;
      else {
        overview.style.display = 'none';
        s.skel = [el('div', 'mb-skel mb-skel-text'), el('div', 'mb-skel mb-skel-text'), el('div', 'mb-skel mb-skel-text is-short')];
        U.each(s.skel, function (n) { info.insertBefore(n, tags); });
      }
      setArt(m.backdrop || seed.backdrop, m.poster || seed.poster);
    }

    function showPosterCard(poster) {
      var ok = Kit.safeImage(poster);
      posterCard.style.display = ok ? '' : 'none';
      if (ok && posterCard.__src !== poster) { U.empty(posterCard); posterCard.__src = poster; image(poster, '', posterCard, perfOn() ? 342 : IMG_POSTER, true); }
    }

    function setArt(backdrop, poster) {
      art.set(backdrop, poster);
      if (!Kit.safeImage(backdrop)) showPosterCard(poster);
      else posterCard.style.display = 'none';
    }

    function ratingsRow(r) {
      U.empty(ratings);
      if (!r) return;
      if (r.imdb) el('span', 'mb-tag mb-tag--imdb', 'IMDb ' + r.imdb, ratings);
      function score(val, label, dotCls) {
        var sc = el('span', 'mb-score', null, ratings);
        el('span', 'mb-score-dot' + (dotCls ? ' ' + dotCls : ''), null, sc);
        el('span', 'mb-score-val', val, sc);
        el('span', 'mb-score-lbl', label, sc);
      }
      if (r.tomato) score(r.tomato, 'Tomatometer');
      if (r.audience) score(r.audience, 'Audience', 'mb-score-dot--aud');
      ratings.style.display = ratings.firstChild ? '' : 'none';
    }

    /* "S37E21" (a Continue Watching card) or "Continue S3 E5" names an episode. */
    function epFromLabel(label) {
      var m = /S(\d{1,4})\s*E(\d{1,4})/i.exec(String(label || ''));
      return m && +m[1] > 0 ? { season: +m[1], episode: +m[2] } : null;
    }

    /* What the viewer just watched in the built-in player from this screen (App sets params.lastPlayed when it closes:
       {kind, season, episode, time, duration, over, resume, marks: {'2x1': 1}}). It is fresher than the title page,
       whose own marks can lag behind the last progress post, and it replaces the Continue Watching card's position. */
    function lastPlayed() {
      var lp = params.lastPlayed;
      return lp && typeof lp === 'object' && lp.kind === kind ? lp : null;
    }

    function seedResume() { return !lastPlayed() && isContinue(seed) ? epFromLabel(seed.progressLabel) : null; }

    function code(se, ep) { return 'S' + se + 'E' + ep; }

    /* The episode after lp in the site's list (the watch-plan list, else the season shown), else the next season's
       first episode (specials aside); null after the last one. */
    function episodeAfter(lp, m) {
      var all = (m && m.allEpisodes) || (model && model.allEpisodes) || {}, list = all[lp.season] || [], nx = null;
      if (!list.length) list = U.map(episodeCards(), function (c) { return c.__episode; });
      U.each(list, function (e) { if (+e.season === lp.season && +e.episode > lp.episode && (!nx || +e.episode < +nx.episode)) nx = e; });
      if (nx) return { season: lp.season, episode: +nx.episode };
      U.each(all[lp.season + 1] || [], function (e) { if (+e.episode > 0 && (!nx || +e.episode < +nx.episode)) nx = e; });
      return nx ? { season: lp.season + 1, episode: +nx.episode } : null;
    }

    /* The episode a show's Play/Resume button starts: what was just watched here (the same episode to resume, or the
       one after a finished episode), else the Continue Watching card's episode, else the page's choice (Site.detail
       nextEpisode: its resume label, else the first unwatched episode, else S1E1), else none (the App then lets the
       player or the website decide). */
    function playTarget(m) {
      if (kind !== 'tv') return null;
      var lp = lastPlayed();
      if (lp && +lp.season > 0) {
        var after = lp.over ? episodeAfter(lp, m) : null;
        if (after) return { season: after.season, episode: after.episode, code: code(after.season, after.episode), resume: false };
        if (!lp.over) return { season: +lp.season, episode: +lp.episode, code: code(lp.season, lp.episode), resume: !!lp.resume };
      }
      var r = seedResume();
      if (r) return { season: r.season, episode: r.episode, code: code(r.season, r.episode), resume: true };
      var n = m && m.nextEpisode;
      return n && +n.season > 0 && +n.episode >= 0 ? { season: +n.season, episode: +n.episode, code: code(n.season, n.episode), resume: !!n.resume } : null;
    }

    /* "Resume S1E3", "Play S2E1", or plain "Play"/"Resume" when no episode is known (and for movies). */
    function playLabel(m) {
      var t = playTarget(m), lp = lastPlayed();
      if (t) return (t.resume ? 'Resume ' : 'Play ') + t.code;
      if (lp && kind === 'movie') return lp.resume ? 'Resume' : 'Play';
      var raw = U.text(m && m.playLabel);
      if (/resume|continue|\d:\d\d/i.test(raw) || (!lp && isContinue(seed))) return 'Resume';
      return 'Play';
    }

    /* Episodes finished in the built-in player count as watched before the title page says so. */
    function applyMarks(m) {
      var marks = (lastPlayed() || {}).marks;
      if (!marks || !m) return;
      function mark(e) { if (e && marks[e.season + 'x' + e.episode] === 1) e.watched = true; }
      U.each(m.episodes || [], mark);
      for (var n in (m.allEpisodes || {})) if (m.allEpisodes.hasOwnProperty(n)) U.each(m.allEpisodes[n] || [], mark);
    }

    function makeRow(zoneName, label) {
      var row = Kit.zone(el('div', 'mb-row', null, rowsWrap), zoneName);
      if (label) el('div', 'mb-row-title', label, row);
      var view = el('div', 'mb-row-view', null, row);
      var track = el('div', 'mb-track', null, view);
      rowEls.push(row);
      return { row: row, track: track };
    }

    /* The Continue Watching card's progress (or the position just watched here) shows on its episode. */
    function episodeProgress(ep) {
      var lp = lastPlayed();
      if (lp) return lp.resume && +lp.season === +ep.season && +lp.episode === +ep.episode && lp.duration > 0 ? U.clamp(lp.time / lp.duration, 0, 1) : -1;
      var r = seedResume();
      return r && r.season === +ep.season && r.episode === +ep.episode && seed.progress >= 0 ? seed.progress : -1;
    }

    /* The watched check and the progress bar of a card that is already on screen. */
    function updateCard(c) {
      var ep = c.__episode, a = U.qs(c, '.mb-card-art');
      if (!ep || !a) return;
      U.toggleClass(c, 'is-watched', !!ep.watched);
      if (c.__meta) c.__meta.textContent = epMeta(ep);
      var old = U.qs(a, '.mb-ep-progress'), prog = episodeProgress(ep);
      if (old) U.detach(old);
      if (prog >= 0 && (!ep.watched || lastPlayed())) Kit.progressBar(prog, el('div', 'mb-ep-progress', null, a));
    }

    /* Runtime, date and rating; the watched state is the check on the picture (and "Watched" in the header). */
    function epMeta(ep) {
      return Kit.metaLine([+ep.episode === 0 ? 'Special' : '', Kit.fmtRuntime(ep.runtime), ep.date, ep.rating ? 'IMDb ' + ep.rating : '']);
    }

    function episodeCard(ep) {
      var still = Kit.safeImage(ep.still);
      var c = el('div', 'mb-card mb-card--wide mb-episode' + (still ? '' : ' mb-episode--text') + (ep.watched ? ' is-watched' : ''));
      Kit.focusable(c, 'ep|' + ep.season + 'x' + ep.episode);
      c.setAttribute('data-episode', ep.season + 'x' + ep.episode);
      c.__episode = ep;
      var code = ep.code || ('S' + ep.season + 'E' + ep.episode);
      var a = el('div', 'mb-card-art', null, c);
      if (still) {
        var ph = el('div', 'mb-card-ph', null, a);
        el('span', 'mb-card-ph-title', code, ph);
        image(ep.still, 'mb-card-img', a, perfOn() ? 480 : IMG_STILL);
        el('div', 'mb-card-shade', null, a);
        el('span', 'mb-ep-code', code, a);
      } else {
        /* An episode the site lists by name only (no picture): a deliberate text card, never a broken image. */
        var tx = el('div', 'mb-ep-text', null, a);
        el('div', 'mb-ep-text-num', +ep.episode > 0 ? String(ep.episode) : '', tx);
        el('div', 'mb-ep-text-code', +ep.episode === 0 ? code + '  \u00b7  Special' : code, tx);
        el('div', 'mb-ep-text-title', ep.title || ('Episode ' + ep.episode), tx);
      }
      var check = el('span', 'mb-ep-check', null, a);
      check.appendChild(Icons.el('check'));
      var prog = episodeProgress(ep);
      if (prog >= 0 && (!ep.watched || lastPlayed())) Kit.progressBar(prog, el('div', 'mb-ep-progress', null, a));
      var play = el('div', 'mb-ep-play', null, a);
      play.appendChild(Icons.el('play'));
      el('div', 'mb-ep-title', (+ep.episode ? ep.episode + '. ' : '') + (ep.title || 'Episode ' + ep.episode), c);
      c.__meta = el('div', 'mb-ep-meta', epMeta(ep), c);
      /* The focused episode's overview is shown at reading size in the header above the rows (section 6.2). */
      return c;
    }

    function episodeCards() { return episodesTrack ? U.filter(U.qsa(episodesTrack, '[data-episode]'), function (c) { return !!c.__episode; }) : []; }

    /* Where Down from the season pills lands: the Play target when it is in this season, else the first unwatched
       episode (specials aside), else episode 1, else the first card. */
    function targetCard() {
      var cards = episodeCards(), t = playTarget(model);
      if (!cards.length) return null;
      return (t && U.find(cards, function (c) { return +c.__episode.season === t.season && +c.__episode.episode === t.episode; })) ||
        U.find(cards, function (c) { return +c.__episode.episode > 0 && !c.__episode.watched; }) ||
        U.find(cards, function (c) { return +c.__episode.episode === 1; }) || cards[0];
    }

    /* "Season 2 · 13 episodes" and, once any are watched, the watched share: the displayed list when it is that season,
       else the page's watch-plan list; the site's own "5/13 episodes watched" line wins when it has one. */
    function setSeasonLine(n, m) {
      if (!seasonLine) return;
      var src = m || model || {}, list = null;
      if (m && +m.season === +n) list = m.episodes;
      else if (src.allEpisodes && src.allEpisodes[n]) list = src.allEpisodes[n];
      else if (model && model.allEpisodes && model.allEpisodes[n]) list = model.allEpisodes[n];
      var stats = (src.seasonStats && src.seasonStats[n]) || (model && model.seasonStats && model.seasonStats[n]) || null;
      var total = list ? list.length : 0, watched = 0;
      U.each(list || [], function (e) { if (e.watched) watched++; });
      /* The site's own count, unless episodes finished here since the page was read are not in it yet. */
      if (stats && stats.total > 0) { total = stats.total; watched = Math.min(Math.max(stats.watched, watched), stats.total); }
      U.empty(seasonLine);
      el('span', 'mb-season-name', 'Season ' + n, seasonLine);
      if (total) el('span', 'mb-season-count', total === 1 ? '1 episode' : total + ' episodes', seasonLine);
      if (total && watched > 0) {
        var w = el('span', 'mb-season-watched', null, seasonLine);
        Kit.progressBar(watched / total, w);
        el('span', 'mb-season-watched-text', watched >= total ? 'All watched' : watched + ' of ' + total + ' watched', w);
      }
    }

    function setLoading(on) {
      if (!episodesRow) return;
      U.toggleClass(episodesRow, 'is-loading', !!on);
    }

    /* list: the season's episodes; mode 'loading' keeps the current cards (dimmed, with the spinner) or shows
       placeholders when there are none. Returns the card Down should land on. */
    function fillEpisodes(list, mode) {
      if (!episodesTrack) return null;
      if (mode === 'loading') {
        setLoading(true);
        if (!episodeCards().length) {
          U.empty(episodesTrack);
          Kit.setX(episodesTrack, 0);
          Kit.skeletonCards(episodesTrack, 5, 'wide');
        }
        return null;
      }
      setLoading(false);
      U.empty(episodesTrack);
      Kit.setX(episodesTrack, 0);
      if (!list || !list.length) {
        var none = el('div', 'mb-empty mb-empty--inline', null, episodesTrack);
        el('div', 'mb-body', 'No episodes are listed for this season yet.', none);
        return null;
      }
      U.each(list, function (ep) { episodesTrack.appendChild(episodeCard(ep)); });
      var target = targetCard();
      if (episodesRow) episodesRow.__mbLast = target;
      Kit.lazySoon(s.el);
      return target;
    }

    function seasonError(n) {
      setLoading(false);
      U.empty(episodesTrack);
      Kit.setX(episodesTrack, 0);
      var box = el('div', 'mb-empty mb-empty--inline', null, episodesTrack);
      el('div', 'mb-body', 'Couldn\u2019t load season ' + n + '.', box);
      var retry = Kit.button({ label: 'Try again', icon: 'reload', action: 'season-retry', primary: true, parent: box, key: 'season-retry|' + n });
      if (episodesRow) episodesRow.__mbLast = retry;
      return retry;
    }

    function markSeason(n) {
      U.each(U.qsa(seasonsRow, '[data-season]'), function (c) {
        U.toggleClass(c, 'is-selected', +c.getAttribute('data-season') === n);
        if (+c.getAttribute('data-season') === n) seasonsRow.__mbLast = c;
      });
    }

    function loadSeason(n) {
      if (!seasonsRow) return;
      clearTimeout(dwellTimer);
      dwellTimer = null;
      season = n;
      params.season = n;   /* a rebuild (after playback, or a restored stack) shows the season the viewer chose */
      loadingSeason = n;
      var mine = ++seasonSeq;
      markSeason(n);
      setSeasonLine(n, null);
      fillEpisodes(null, 'loading');
      var done = function (err, m) {
        if (!s.alive || mine !== seasonSeq) return;
        loadingSeason = 0;
        /* Down pressed (or OK on the pill) while it loaded, or focus on a card being replaced: move to the new list. */
        var cur = Focus.current(), follow = !!cur && ((pendingDown && seasonsRow.contains(cur)) || episodesTrack.contains(cur));
        pendingDown = false;
        if (err || !m) {
          if (err && err.code === 'signed-out') { fail(s, err); return; }
          var retry = seasonError(n);
          if (follow) App.focus(retry);
          return;
        }
        applyMarks(m);
        var target = fillEpisodes(m.episodes || [], null);
        setSeasonLine(n, m);
        if (follow && target) App.focus(target);
        else if (follow) App.focus(seasonPill(n));
      };
      /* Api.detail(kind, id, cb, opts): the callback is not last, so it is called directly. */
      try {
        if (typeof Api !== 'undefined' && Api.detail) Api.detail(kind, id, U.guard(done, 'season-cb'), { season: n });
        else done({ code: 'exception' });
      } catch (e) { Log.error('season', e); done({ code: 'exception' }); }
    }

    /* Focus resting on another season's pill switches to it (like Netflix); moving on before SEASON_DWELL cancels. */
    function armDwell(node) {
      clearTimeout(dwellTimer);
      dwellTimer = null;
      if (!node || !seasonsRow || !seasonsRow.contains(node) || !node.hasAttribute('data-season')) return;
      var n = +node.getAttribute('data-season');
      if (n === season) return;
      dwellTimer = U.later(function () {
        dwellTimer = null;
        if (s.alive && Focus.current() === node && Focus.shown(node) && n !== season) loadSeason(n);
      }, SEASON_DWELL, 'season-dwell');
    }

    function render(m) {
      if (!s.alive) return;
      model = m;
      applyMarks(m);
      U.each(U.qsa(info, '.mb-skel'), U.detach);
      title.style.display = '';
      overview.style.display = '';
      title.textContent = m.title || seed.title || '';
      miniTitle.textContent = title.textContent;
      miniKicker.textContent = Kit.metaLine([kind === 'tv' ? 'TV Series' : 'Movie', m.year]);
      kicker.textContent = kind === 'tv' ? (m.update ? 'TV Series  \u00b7  ' + m.update.replace(/^Update to\s*/i, 'Up to ') : 'TV Series') : 'Movie';
      metaEl.textContent = Kit.metaLine([m.year, Kit.fmtRuntime(m.runtime), m.certification, Kit.genresText(m.genres, 3)]);
      ratingsRow(m.ratings);
      overview.textContent = m.overview || '';
      miniDefault();
      U.empty(tags);
      U.each(badgeList(m.badges), function (b) { el('span', 'mb-tag mb-tag--line', b, tags); });
      if (m.audio) el('span', 'mb-tag mb-tag--line', m.audio, tags);
      tags.style.display = tags.firstChild ? '' : 'none';
      Kit.setLabel(playBtn, playLabel(m));
      setArt(m.backdrop || m.backdropOriginal || seed.backdrop, m.poster || seed.poster);
      U.empty(rowsWrap);
      rowEls = [];
      seasonsRow = null; episodesRow = null; episodesTrack = null; seasonLine = null;
      if (kind === 'tv') {
        var seasons = m.seasons || [];
        season = m.season || season || (seasons[0] && seasons[0].number) || 1;
        if (seasons.length) {
          /* One horizontally scrolling line of pills (a long-running show has dozens of seasons): Left/Right walk it
             and Up/Down leave it, like any row. */
          seasonsRow = Kit.zone(el('div', 'mb-row mb-row--seasons', null, rowsWrap), 'seasons');
          var pills = el('div', 'mb-track mb-seasons', null, el('div', 'mb-row-view', null, seasonsRow));
          U.each(seasons, function (se) {
            var c = Kit.chip('Season ' + se.number, { key: 'season|' + se.number, parent: pills });
            c.setAttribute('data-season', String(se.number));
            U.toggleClass(c, 'is-selected', +se.number === +season);
            if (+se.number === +season) seasonsRow.__mbLast = c;
          });
          rowEls.push(seasonsRow);
          U.later(function () { if (s.alive && seasonsRow && seasonsRow.__mbLast) Kit.scrollTrack(pills, seasonsRow.__mbLast); }, 0, 'season-scroll');
        }
        var er = makeRow('row:episodes', seasons.length ? '' : 'Episodes');
        episodesRow = er.row; episodesTrack = er.track;
        U.toggleClass(episodesRow, 'mb-row--episodes', true);
        if (seasons.length) {
          seasonLine = el('div', 'mb-season-info');
          episodesRow.insertBefore(seasonLine, episodesRow.firstChild);
        }
        Kit.spinner(el('div', 'mb-ep-spinner', null, episodesTrack.parentNode));
        fillEpisodes(m.episodes || [], null);
        setSeasonLine(season, m);
      }
      var related = normItems(m.related);
      if (related.length) {
        var rr = makeRow('row:related', 'More like this');
        U.each(related, function (it) { rr.track.appendChild(Kit.card(it, { size: 'poster', zone: 'row:related' })); });
      }
      var cast = m.cast || [];
      if (cast.length) {
        var cr = makeRow('row:cast', 'Cast & crew');
        U.toggleClass(cr.track, 'mb-cast', true);
        U.each(cast.slice(0, 24), function (p) {
          var c = el('div', 'mb-person', null, cr.track);
          Kit.focusable(c, 'cast|' + p.name);
          c.__person = p;
          el('div', 'mb-person-name', p.name, c);
          el('div', 'mb-person-role', U.titleCase(p.role || '') || '\u00a0', c);
        });
      }
      if (episodesBtn && !episodesRow) episodesBtn.setAttribute('data-disabled', '');
      Kit.lazySoon(s.el);
      App.screenReady(s);
    }

    s.model = function () { return model; };
    s.params = params;
    s.initialFocus = function () { return playBtn; };

    /* The title page was read again (for example after playback): the Play/Resume label, the watched marks and the
       season line change in place, so focus and scroll stay. Returns false when the page shows something this screen
       cannot patch (another title, or no model yet): the caller rebuilds the screen instead. */
    s.refreshModel = function (m) {
      if (!s.alive || !m || !model || m.key !== model.key) return false;
      model = m;
      applyMarks(m);
      Kit.setLabel(playBtn, playLabel(m));
      if (kind !== 'tv') return true;
      var fresh = {};
      U.each((m.allEpisodes && m.allEpisodes[season]) || [], function (x) { fresh[x.season + 'x' + x.episode] = !!x.watched; });
      if (+m.season === +season) U.each(m.episodes || [], function (x) { fresh[x.season + 'x' + x.episode] = !!x.watched; });
      U.each(episodeCards(), function (c) {
        var ep = c.__episode, k = ep.season + 'x' + ep.episode;
        if (fresh.hasOwnProperty(k)) ep.watched = fresh[k];
        updateCard(c);
      });
      if (episodesRow && !loadingSeason) { var t = targetCard(); if (t) episodesRow.__mbLast = t; }
      setSeasonLine(season, +m.season === +season ? m : null);
      return true;
    };

    /* The season whose episodes are on screen (it can differ from model().season after a switch). */
    s.season = function () { return +season || 0; };

    /* The built-in player closed after playing from here (App set params.lastPlayed): the Play/Resume label, the watched
       checks, the progress bar and the season line follow at once, before the title page is read again. The Continue
       Watching card's position no longer applies. */
    s.afterPlayback = function () {
      if (!s.alive) return false;
      seed.progress = -1;
      seed.progressLabel = '';
      seed.playHref = '';
      if (model) applyMarks(model);
      Kit.setLabel(playBtn, playLabel(model));
      if (kind !== 'tv') return true;
      var marks = (lastPlayed() || {}).marks || {};
      U.each(episodeCards(), function (c) {
        var ep = c.__episode;
        if (marks[ep.season + 'x' + ep.episode] === 1) ep.watched = true;
        updateCard(c);
      });
      if (!loadingSeason) setSeasonLine(season, model && +model.season === +season ? model : null);
      return true;
    };

    function seasonPill(n) { return seasonsRow ? U.qs(seasonsRow, '[data-season="' + n + '"]') : null; }

    function miniDefault() {
      var m = model || {};
      miniMeta.textContent = Kit.metaLine([m.year || seed.year, Kit.fmtRuntime(m.runtime || seed.runtime), m.certification, Kit.genresText(m.genres || seed.genres, 3)]);
      miniBody.textContent = U.text(m.overview || (meta(key) || {}).overview);
    }

    /* The header follows focus: the focused episode's code, title and overview, otherwise the title's own. */
    function miniFor(node) {
      var ep = node && node.__episode;
      if (!ep) { miniDefault(); return; }
      miniMeta.textContent = Kit.metaLine(['S' + ep.season + ' \u00b7 E' + ep.episode + (ep.title ? '  ' + ep.title : ''), Kit.fmtRuntime(ep.runtime), ep.date, ep.watched ? 'Watched' : '']);
      miniBody.textContent = U.text(ep.overview) || U.text((model || {}).overview);
    }

    /* Rows start directly under the fixed-height header, never leaving an empty band: the focused row (for episodes,
       the season pills above them) is anchored at the header's bottom, the scroll never goes past the last row, and
       it never lets the first row drop below the anchor. Rows scrolled above the anchor fade out (.is-past). */
    s.onFocus = function (node) {
      armDwell(node);
      pendingDown = false;
      var z = Focus.zoneOf(node), name = z ? z.getAttribute('data-zone') : '';
      if (name === 'hero' || !z || !rowsWrap.contains(z)) {
        Kit.setY(vs, 0);
        U.toggleClass(s.el, 'is-scrolled', false);
        U.each(rowEls, function (r) { U.toggleClass(r, 'is-past', false); });
        return;
      }
      miniFor(node);
      var em = Kit.em(), anchor = mini.offsetTop + mini.offsetHeight + em * 2;
      var target = z === episodesRow && seasonsRow ? seasonsRow : z;
      var y = Math.max(0, Kit.offsetIn(target, vs).top - anchor);
      var first = rowEls[0], last = rowEls[rowEls.length - 1];
      if (first && last) {
        var lb = Kit.offsetIn(last, vs);
        y = Math.min(y, Math.max(0, lb.top + lb.height + em * 2 - vport.clientHeight, Kit.offsetIn(first, vs).top - anchor));
      }
      Kit.setY(vs, -y);
      U.toggleClass(s.el, 'is-scrolled', y > 0);
      U.each(rowEls, function (r) { U.toggleClass(r, 'is-past', r !== z && Kit.offsetIn(r, vs).top - y < anchor - em); });
    };

    /* Down from the pills while a season loads waits for its episodes (focus then moves to them). */
    s.onKey = function (name) {
      if (name !== 'down' || !loadingSeason || !seasonsRow) return false;
      var cur = Focus.current();
      if (!cur || !seasonsRow.contains(cur)) return false;
      pendingDown = true;
      return true;
    };

    s.play = function (episode) {
      var t = { kind: kind, id: id, title: (model && model.title) || seed.title, item: seed, backdrop: (model && model.backdrop) || seed.backdrop };
      if (episode) {
        /* exact: this very episode, also a special (episode 0); the card knows its title (other seasons are not in
           model()). */
        t.season = +episode.season; t.episode = +episode.episode; t.exact = true;
        t.episodeTitle = U.text(episode.title);
        t.title = t.title + '  \u00b7  ' + (episode.code || ('S' + episode.season + 'E' + episode.episode));
      } else if (seed.playHref) t.playHref = seed.playHref;
      App.play(t);
    };

    s.act = function (action, node) {
      if (action === 'play') { s.play(playTarget(model)); return true; }
      if (action === 'episodes') {
        var last = episodesRow && episodesRow.__mbLast, f = last && Focus.shown(last) && episodesRow.contains(last) ? last : episodesRow && Focus.firstIn(episodesRow);
        if (f) App.focus(f);
        return true;
      }
      if (action === 'quality') {
        Overlays.quality({ title: (model && model.title) || seed.title, sources: model && model.sources || [], onPick: function (src) {
          var t = { kind: kind, id: id, title: (model && model.title) || seed.title, item: seed, pick: src };
          App.play(t);
        }, onChange: function (q) { if (qualityBtn) Kit.setLabel(qualityBtn, 'Quality: ' + qualityLabel(q).replace(' available', '')); } });
        return true;
      }
      if (node && node.__episode) { s.play(node.__episode); return true; }
      if (action === 'season-retry') { App.focus(seasonPill(season)); loadSeason(season); return true; }
      if (node && node.hasAttribute('data-season')) {
        var n = +node.getAttribute('data-season');
        /* OK on the season that is loading: go down to its episodes as soon as they arrive. */
        if (n === season && loadingSeason === n) { pendingDown = true; return true; }
        var target = episodesRow && episodesRow.__mbLast;
        if (!target || !Focus.shown(target) || !episodesTrack.contains(target)) target = episodesTrack ? U.qs(episodesTrack, '[data-episode]') : null;
        /* A season that failed or is still empty loads again; a loaded one sends focus to its episodes. */
        if (n !== season || !target || !Focus.shown(target)) loadSeason(n); else App.focus(target);
        return true;
      }
      if (node && node.__item) { App.push('detail', { kind: node.__item.kind, id: node.__item.id, item: compactItem(node.__item) }); return true; }
      if (node && node.__person) { App.push('search', { query: node.__person.name, submit: true }); return true; }
      return false;
    };

    s.refreshQuality = function () { if (qualityBtn) Kit.setLabel(qualityBtn, 'Quality: ' + qualityLabel(pref('quality', 'best')).replace(' available', '')); };
    s.onShow = s.refreshQuality;
    s.onHide = function () { clearTimeout(dwellTimer); dwellTimer = null; pendingDown = false; };
    s.destroy = s.onHide;

    skeletonInfo();
    var liveModel = ctx && ctx.live ? (ctx.model && ctx.model.key === key ? ctx.model : site('detail', [document, location.href], null)) : null;
    /* The boot page shows one season; another one chosen since then is fetched. */
    if (liveModel && kind === 'tv' && season && liveModel.season && +liveModel.season !== +season) liveModel = null;
    if (liveModel && liveModel.title) U.later(function () { render(liveModel); }, 0, 'detail-live');
    else {
      var cb = U.guard(function (err, m) {
        if (!s.alive) return;
        if (err || !m) { fail(s, err || { code: 'parse' }); return; }
        render(m);
      }, 'detail-cb');
      try {
        if (typeof Api === 'undefined' || !Api.detail) throw new Error('Api.detail unavailable');
        Api.detail(kind, id, cb, season ? { season: season } : {});
      } catch (e) { Log.error('detail', e); U.later(function () { cb({ code: 'exception' }); }, 0, 'detail-fail'); }
    }
    return s;
  };

  /* ---------- Search ---------- */

  var KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789';

  registry.search = function (params) {
    var s = base('search', 'search');
    s.nav = 'search';
    var q = U.text(params.query || '').slice(0, 80), type = params.type || 'all';
    var results = null, page = 1, next = '', loadingMore = false, searchSeq = 0, sugSeq = 0, total = null, capped = false;
    var MAX_RESULTS = 600, MAX_SUGGEST = 6;
    var left = el('div', 'mb-search-left', null, s.el);
    var line = el('div', 'mb-query-line', null, left);
    line.appendChild(Icons.el('search', 'mb-q-ico'));
    var qt = el('div', 'mb-query-text', null, line);
    var queryEl = el('span', null, '', qt);
    queryEl.id = 'mbptv-query';
    el('span', 'mb-caret', null, qt);
    el('span', 'mb-placeholder', 'Search movies and shows', line);
    var kb = Kit.zone(el('div', 'mb-keyboard', null, left), 'keyboard');
    var firstKey = null;
    U.each(KEYS.split(''), function (ch) {
      var k = el('div', 'mb-key', null, kb);
      Kit.focusable(k, 'key|' + ch);
      k.setAttribute('data-char', ch);
      el('span', 'mb-key-label', ch, k);
      if (!firstKey) firstKey = k;
    });
    function special(action, label, icon, cls) {
      var k = el('div', 'mb-key mb-key--wide' + (cls ? ' ' + cls : ''), null, kb);
      Kit.focusable(k, 'key|' + action, action);
      k.appendChild(Icons.el(icon));
      el('span', 'mb-key-label', label, k);
      return k;
    }
    special('space', 'Space', 'space');
    special('delete', 'Delete', 'backspace');
    special('clear', 'Clear', 'close', 'is-last');
    var go = el('div', 'mb-key mb-key--go', null, kb);
    Kit.focusable(go, 'key|search-submit', 'search-submit');
    go.appendChild(Icons.el('search'));
    el('span', 'mb-key-label', 'Search', go);
    var right = el('div', 'mb-search-right', null, s.el);
    var head = el('div', 'mb-results-head', null, right);
    var headTitle = el('div', 'mb-section', '', head);
    var headCount = el('div', 'mb-count', '', head);
    var tabs = Kit.zone(el('div', 'mb-chiprow mb-search-tabs', null, right), 'tabs');
    U.each([['all', 'All'], ['movie', 'Movies'], ['tv', 'TV Shows']], function (t) {
      var c = Kit.chip(t[1], { key: 'type|' + t[0], parent: tabs });
      c.setAttribute('data-type', t[0]);
    });
    var gport = el('div', 'mb-grid-port', null, right);
    var grid = Kit.zone(el('div', 'mb-grid', null, gport), 'grid');
    /* Live suggestions fill the right side while the viewer types (large rows, next to the keyboard). */
    var sugBox = el('div', 'mb-suggest-box', null, right);
    var sug = Kit.zone(el('div', 'mb-suggest', null, sugBox), 'list');
    var sugHint = el('div', 'mb-suggest-hint', 'Keep typing, or choose Search to see every result.', sugBox);
    var discover = el('div', 'mb-discover', null, right);

    /* The right side shows one of: results (the submitted query is the one on screen), suggestions (a query is typed)
       or discovery (recent and trending searches, for an empty query). Results stay in memory while the viewer edits
       the query, and come back when the query matches them again. */
    function showing() {
      var t = U.text(q);
      if (results && results.query === t) return 'results';
      return t ? 'suggest' : 'discover';
    }

    function layout() {
      var mode = showing();
      gport.style.display = mode === 'results' ? '' : 'none';
      tabs.style.display = mode === 'results' ? '' : 'none';
      sugBox.style.display = mode === 'suggest' ? '' : 'none';
      discover.style.display = mode === 'discover' ? '' : 'none';
      sugHint.style.display = sug.firstChild ? 'none' : '';
      if (mode === 'results') headFor(results.query, total);
      else if (mode === 'suggest') { headTitle.textContent = 'Suggestions'; headCount.textContent = ''; }
      else { headTitle.textContent = 'Find something to watch'; headCount.textContent = ''; }
      /* Focus left on a control the new view hides goes back to the keyboard. */
      var cur = Focus.current();
      if (cur && s.el.contains(cur) && !Focus.shown(cur)) App.focus(kb.__mbLast && Focus.shown(kb.__mbLast) ? kb.__mbLast : go);
    }

    function renderQuery() {
      queryEl.textContent = q;
      U.toggleClass(line, 'is-empty', !q);
    }

    function setQuery(v, suggest) {
      q = String(v || '').replace(/\s+/g, ' ').replace(/^\s+/, '').slice(0, 80);
      renderQuery();
      if (suggest !== false) scheduleSuggest();
      layout();
    }

    var suggestSoon = U.debounce(function () { fetchSuggest(); }, 350);
    function scheduleSuggest() {
      sugSeq++;
      if (!U.text(q)) { suggestSoon.cancel(); renderSuggestions([]); return; }
      suggestSoon();
    }

    function fetchSuggest() {
      var mine = ++sugSeq, query = U.text(q);
      if (!query) return;
      api('suggest', [query], function (err, list) {
        if (!s.alive || mine !== sugSeq) return;
        if (err) { if (err.code === 'signed-out') fail(s, err); return; }
        renderSuggestions(list || []);
      });
    }

    function renderSuggestions(list) {
      var keep = Focus.current();
      var hadFocus = keep && Focus.zoneOf(keep) === sug;
      U.empty(sug);
      var seen = {};
      U.each(list, function (t) {
        var text = U.text(typeof t === 'string' ? t : t && t.name);
        if (!text || seen[text.toLowerCase()] || sug.childNodes.length >= MAX_SUGGEST) return;
        seen[text.toLowerCase()] = true;
        var r = el('div', 'mb-srow', null, sug);
        Kit.focusable(r, 'sug|' + text);
        r.setAttribute('data-suggestion', text);
        r.appendChild(Icons.el('search'));
        el('span', 'mb-srow-label', text, r);
      });
      sugHint.style.display = sug.firstChild ? 'none' : '';
      if (hadFocus) App.focus(Focus.firstIn(sug) || (kb.__mbLast && Focus.shown(kb.__mbLast) ? kb.__mbLast : go));
    }

    function chips(title, list, zoneName) {
      if (!list.length) return null;
      el('div', 'mb-section', title, discover);
      var row = Kit.zone(el('div', 'mb-chiprow', null, discover), zoneName);
      var seen = {};
      U.each(list, function (t) {
        var text = U.text(t);
        if (!text || seen[text.toLowerCase()] || row.childNodes.length >= 12) return;
        seen[text.toLowerCase()] = true;
        var c = Kit.chip(text, { key: zoneName + '|' + text, parent: row, icon: zoneName === 'chips:recent' ? 'reload' : 'spark' });
        c.setAttribute('data-query', text);
      });
      return row;
    }

    /* Rebuilding the chips (when the website's own lists arrive) keeps focus on the same chip when it still exists. */
    function fillDiscover(recent, trending) {
      var cur0 = Focus.current(), key0 = cur0 && discover.contains(cur0) ? Focus.keyOf(cur0) : '';
      U.empty(discover);
      el('div', 'mb-discover-hint', 'Type with the keyboard or the remote\u2019s number keys. Suggestions appear as you type.', discover);
      chips('Recent searches', recent, 'chips:recent');
      chips('Trending now', trending || [], 'chips:trending');
      if (key0) App.focus(Focus.byKey(discover, key0) || firstKey);
    }

    function showDiscover() {
      var recent = [];
      try { if (typeof Api !== 'undefined' && Api.recentSearches) recent = Api.recentSearches() || []; } catch (e) {}
      fillDiscover(recent, []);
      api('hot', [], function (err, hot) {
        if (!s.alive || err || !hot) return;
        fillDiscover(recent.concat(hot.recent || []), hot.trending || []);
      });
    }

    function tabsState() {
      U.each(U.qsa(tabs, '[data-type]'), function (c) {
        var on = c.getAttribute('data-type') === type;
        U.toggleClass(c, 'is-selected', on);
        /* Up from the results lands on the selected tab. */
        if (on) tabs.__mbLast = c;
      });
    }

    function headFor(query, count) {
      headTitle.textContent = 'Results for \u201c' + query + '\u201d';
      headCount.textContent = count == null ? '' : count === 1 ? '1 title' : count + ' titles';
    }

    function showResultsLoading() {
      tabsState();
      U.empty(grid);
      Kit.setY(grid, 0);
      Kit.skeletonCards(grid, 10, 'poster');
      layout();
    }

    function addCards(items) {
      U.each(items, function (it) { grid.appendChild(Kit.card(it, { size: 'poster', zone: 'grid', sub: true })); });
      Kit.lazySoon(s.el);
    }

    /* Paging stops at 600 titles (memory and key cost stay bounded on the TV); the website has the rest. */
    function capNote() {
      if (capped) return;
      capped = true;
      var note = el('div', 'mb-grid-note', null, grid);
      el('div', 'mb-body', 'Showing the first ' + results.items.length + ' titles. Refine the search, or see every result on the website.', note);
      var btns = Kit.zone(el('div', 'mb-btns', null, note), 'buttons');
      Kit.button({ label: 'Open website', icon: 'globe', action: 'open-website', parent: btns, key: 'cap|open-website' });
    }

    function submit(text, opts) {
      opts = opts || {};
      if (text != null) setQuery(text, false);
      var query = U.text(q);
      if (!query) { App.toast('Type a title first'); return; }
      suggestSoon.cancel();
      sugSeq++;
      var mine = ++searchSeq;
      var from = Focus.current();
      if (from && (grid.contains(from) || sugBox.contains(from) || discover.contains(from))) App.focus(go);
      results = { query: query, type: type, items: [] };
      page = 1; next = ''; total = null; capped = false;
      showResultsLoading();
      var submitFrom = Focus.current();
      api('search', [query, type, 1], function (err, r) {
        if (!s.alive || mine !== searchSeq) return;
        U.empty(grid);
        if (err) {
          if (err.code === 'signed-out') { fail(s, err); return; }
          if (showing() === 'results') headFor(query, null);
          stateBlock(grid, { icon: 'info', title: 'Search didn\u2019t load', text: errorMessage(err),
            actions: [{ label: 'Try again', icon: 'reload', action: 'search-retry', primary: true }] }, 'buttons');
          return;
        }
        var items = normItems(r && r.items);
        results.items = items;
        next = r && r.next || '';
        total = r && typeof r.total === 'number' ? r.total : items.length;
        if (showing() === 'results') headFor(query, total);
        if (!items.length) {
          stateBlock(grid, { icon: 'search', title: 'No matches for \u201c' + query + '\u201d',
            text: 'Try a shorter title, check the spelling, or switch between Movies and TV Shows.',
            actions: [{ label: 'Search on the website', icon: 'globe', action: 'open-website' }] }, 'buttons');
          return;
        }
        addCards(items);
        /* Results take focus only when the viewer is still where the search started (or on a hidden control): typing
           on, or moving elsewhere, while the page loads is never interrupted. */
        var now = Focus.current();
        if (opts.focus && showing() === 'results' && (!now || now === submitFrom || !Focus.shown(now) || tabs.contains(now))) {
          var f = Focus.firstIn(grid);
          if (f) App.focus(f);
        }
        App.saveState();
      });
    }

    function loadMore() {
      if (!next || loadingMore || !results || capped) return;
      if (results.items.length >= MAX_RESULTS) { capNote(); return; }
      loadingMore = true;
      var mine = searchSeq, query = results.query;
      api('search', [query, type, page + 1], function (err, r) {
        loadingMore = false;
        if (!s.alive || mine !== searchSeq) return;
        if (err) { App.toast('Couldn\u2019t load more results'); return; }
        page++;
        next = r && r.next || '';
        var have = {};
        U.each(results.items, function (it) { have[it.key] = true; });
        var fresh = U.filter(normItems(r && r.items), function (it) { return !have[it.key]; });
        results.items = results.items.concat(fresh);
        addCards(fresh);
      });
    }

    function restoreSnapshot(snap) {
      if (!snap || !snap.items || !snap.items.length) return false;
      q = snap.query; type = snap.type || 'all'; renderQuery();
      results = { query: U.text(snap.query), type: type, items: normItems(snap.items) };
      next = snap.next || ''; page = snap.page || 1; total = snap.total;
      showResultsLoading();
      U.empty(grid);
      headFor(results.query, total);
      addCards(results.items);
      return true;
    }

    s.snapshot = function () {
      var p = { query: q, type: type };
      if (results && results.items.length) {
        p.snap = { query: results.query, type: type, next: next, page: page, total: total, items: U.map(results.items.slice(0, 60), compactItem) };
      }
      return p;
    };

    s.initialFocus = function () {
      if (results && results.items.length && params.snap && showing() === 'results') return Focus.firstIn(grid) || firstKey;
      return firstKey;
    };

    s.onFocus = function (node) {
      var z = Focus.zoneOf(node);
      var inResults = !!z && (z === tabs || grid.contains(z));
      /* While the viewer browses results, the keyboard steps back. */
      U.toggleClass(s.el, 'in-results', inResults);
      if (z && grid.contains(z)) Kit.reveal(grid, gport, node, Kit.em() * 1, Kit.em() * 4);
      if (z === grid && node.__item) {
        var gi = Focus.gridInfo(node);
        if (gi && gi.index >= gi.count - 5) loadMore();
      }
    };

    /* Back from the results, suggestions or chips returns to the keyboard with the query kept; Back on the keyboard
       leaves Search. */
    s.onBack = function () {
      var cur = Focus.current();
      if (!cur || !s.el.contains(cur) || kb.contains(cur)) return false;
      App.focus(kb.__mbLast && Focus.shown(kb.__mbLast) ? kb.__mbLast : go);
      return true;
    };

    s.onKey = function (name, ev) {
      if (name === 'char' || name === 'digit') {
        var ch = Keys.charOf(ev);
        if (!ch || !/^[\w\s\-':.,&!?]$/.test(ch)) return false;
        setQuery(q + ch.toLowerCase());
        return true;
      }
      if (name === 'backspace') { setQuery(q.slice(0, -1)); return true; }
      if (name === 'space') {
        if (q && q.charAt(q.length - 1) !== ' ') setQuery(q + ' ');
        return true;
      }
      return false;
    };

    s.act = function (action, node) {
      if (node && node.hasAttribute('data-char')) { setQuery(q + node.getAttribute('data-char')); return true; }
      if (action === 'space') { if (q && q.charAt(q.length - 1) !== ' ') setQuery(q + ' '); return true; }
      if (action === 'delete') { setQuery(q.slice(0, -1)); return true; }
      if (action === 'clear') { setQuery(''); return true; }
      if (action === 'search-submit') { submit(null, { focus: true }); return true; }
      if (action === 'search-retry') { submit(null, { focus: true }); return true; }
      if (action === 'open-website') { App.openWebsite(siteUrl('search', [U.text(q), type, 1], '/index/search?word=' + encodeURIComponent(U.text(q)))); return true; }
      if (node && node.hasAttribute('data-suggestion')) { submit(node.getAttribute('data-suggestion'), { focus: true }); return true; }
      if (node && node.hasAttribute('data-query')) { submit(node.getAttribute('data-query'), { focus: true }); return true; }
      if (node && node.hasAttribute('data-type')) {
        var t = node.getAttribute('data-type');
        if (t !== type || !results) { type = t; if (U.text(q)) submit(null, { focus: false }); else tabsState(); }
        return true;
      }
      if (node && node.__item) { App.push('detail', { kind: node.__item.kind, id: node.__item.id, item: compactItem(node.__item) }); return true; }
      return false;
    };

    s.destroy = function () { suggestSoon.cancel(); };

    renderQuery();
    tabsState();
    showDiscover();
    if (!restoreSnapshot(params.snap)) {
      if (q && params.submit) U.later(function () { if (s.alive) submit(null, { focus: true }); }, 0, 'search-auto');
      else if (q) scheduleSuggest();
    }
    layout();
    return s;
  };

  /* ---------- Browse grid (movies, shows, lists, library) ---------- */

  registry.browse = function (params, ctx) {
    var s = base('browse', 'browse');
    s.nav = params.nav || '';
    var url = params.url || siteUrl('movies', [], '/movie');
    var next = '', loadingMore = false, seq = 0, count = 0, keys = {}, capped = false;
    var vport = el('div', 'mb-vport', null, s.el);
    var vs = el('div', 'mb-vscroll', null, vport);
    var head = el('div', 'mb-browse-head', null, vs);
    el('div', 'mb-kicker', params.kicker || 'Browse', head);
    var titleEl = el('div', 'mb-h1', params.title || '', head);
    var countEl = el('div', 'mb-meta', '', head);
    var tabs = Kit.zone(el('div', 'mb-chiprow mb-browse-tabs', null, vs), 'tabs');
    var grid = Kit.zone(el('div', 'mb-grid', null, vs), 'grid');
    var foot = el('div', 'mb-grid-foot', null, vs);

    function renderTabs(list, current) {
      U.empty(tabs);
      if (!list || !list.length) { tabs.style.display = 'none'; return; }
      tabs.style.display = '';
      U.each(list.slice(0, 16), function (t) {
        var c = Kit.chip(t.label, { key: 'tab|' + t.label, parent: tabs });
        c.__href = t.href || t.url;
        U.toggleClass(c, 'is-selected', !!current && (c.__href === current));
      });
    }

    function add(items) {
      var fresh = U.filter(normItems(items), function (it) { return !keys[it.key]; });
      U.each(fresh, function (it) { keys[it.key] = true; grid.appendChild(Kit.card(it, { size: 'grid', zone: 'grid', sub: true })); });
      count += fresh.length;
      Kit.lazySoon(s.el);
      return fresh.length;
    }

    function setCount() {
      countEl.textContent = count && !next ? (count === 1 ? '1 title' : count + ' titles') : '';
    }

    function markTab() {
      U.each(U.qsa(tabs, '.mb-chip'), function (c) {
        var on = !!c.__href && c.__href === url;
        U.toggleClass(c, 'is-selected', on);
        /* Up from the grid lands on the selected chip. */
        if (on) tabs.__mbLast = c;
      });
    }

    /* Paging stops at 600 titles (memory and key cost stay bounded on the TV); the website lists the rest. */
    var MAX_TITLES = 600;
    function capNote() {
      if (capped) return;
      capped = true;
      U.empty(foot);
      var note = el('div', 'mb-grid-note', null, foot);
      el('div', 'mb-body', 'Showing the first ' + count + ' titles. The website lists the rest.', note);
      var btns = Kit.zone(el('div', 'mb-btns', null, note), 'buttons');
      Kit.button({ label: 'Open website', icon: 'globe', action: 'open-website', parent: btns, key: 'cap|open-website' });
    }

    function load(target, keepTabs) {
      var mine = ++seq;
      url = target;
      next = ''; count = 0; keys = {}; capped = false;
      countEl.textContent = '';
      markTab();
      U.empty(grid); U.empty(foot);
      Kit.setY(vs, 0);
      Kit.skeletonCards(grid, 12, 'grid');
      var done = function (err, data) {
        if (!s.alive || mine !== seq) return;
        U.empty(grid);
        if (err) {
          if (err.code === 'signed-out' || !keepTabs) { fail(s, err); return; }
          stateBlock(grid, { icon: 'info', title: 'This list didn\u2019t load', text: errorMessage(err),
            actions: [{ label: 'Retry', icon: 'reload', action: 'retry-list', primary: true }, { label: 'Open website', icon: 'globe', action: 'open-website' }] }, 'buttons');
          return;
        }
        data = data || {};
        if (!params.title && data.title) titleEl.textContent = data.title;
        /* Switching chips keeps the chip row (and focus on the chip); only the first load builds it. */
        if (!params.tabs && !keepTabs) renderTabs(data.chips, url);
        next = data.next || '';
        if (!add(data.items)) {
          stateBlock(grid, { icon: 'film', title: 'Nothing here yet', text: 'This list is empty right now. The website may show more.',
            actions: [{ label: 'Open website', icon: 'globe', action: 'open-website', primary: true }] }, 'buttons');
        }
        setCount();
        markTab();
        App.screenReady(s);
      };
      if (ctx && ctx.live && mine === 1) {
        var live = site('list', [document], null);
        if (live && live.items && live.items.length) { U.later(function () { done(null, live); }, 0, 'browse-live'); return; }
      }
      api('list', [target], done);
    }

    function loadMore() {
      if (!next || loadingMore || capped) return;
      if (count >= MAX_TITLES) { capNote(); return; }
      loadingMore = true;
      var mine = seq;
      U.empty(foot);
      Kit.spinner(foot, 'mb-spinner--sm');
      api('list', [next], function (err, data) {
        loadingMore = false;
        if (!s.alive || mine !== seq) return;
        U.empty(foot);
        if (err) { App.toast('Couldn\u2019t load more titles'); return; }
        next = data && data.next || '';
        add(data && data.items);
        setCount();
      });
    }

    s.initialFocus = function () { return Focus.firstIn(grid) || Focus.firstIn(tabs) || Focus.firstIn(s.el); };

    s.onFocus = function (node) {
      var z = Focus.zoneOf(node);
      if (z === grid && node.__item) {
        Kit.reveal(vs, vport, node, Kit.em() * 3, Kit.em() * 3);
        var gi = Focus.gridInfo(node);
        if (gi && gi.index >= gi.count - 6) loadMore();
      } else if (z && (foot.contains(z) || grid.contains(z))) Kit.reveal(vs, vport, node, Kit.em() * 3, Kit.em() * 3);
      else Kit.setY(vs, 0);
    };

    s.act = function (action, node) {
      if (action === 'retry-list') { load(url, true); return true; }
      if (action === 'open-website') { App.openWebsite(url); return true; }
      if (node && node.__href) { if (node.__href !== url) load(node.__href, true); return true; }
      if (node && node.__item) { App.push('detail', { kind: node.__item.kind, id: node.__item.id, item: compactItem(node.__item) }); return true; }
      return false;
    };

    if (params.tabs) renderTabs(params.tabs, url);
    else tabs.style.display = 'none';
    load(url, false);
    return s;
  };

  /* ---------- Settings ---------- */

  registry.settings = function () {
    var s = base('settings', 'settings');
    s.nav = 'settings';
    var head = el('div', 'mb-page-head', null, s.el);
    el('div', 'mb-kicker', 'MovieBox Pro TV', head);
    el('div', 'mb-h1', 'Settings', head);
    var body = el('div', 'mb-settings-body', null, s.el);
    /* The list scrolls inside its port when it is taller than the screen (the About line stays below it). */
    var port = el('div', 'mb-settings-port', null, body);
    var list = Kit.zone(el('div', 'mb-list', null, port), 'list');
    var aside = el('div', 'mb-aside', null, body);
    var asideIcon = el('div', null, null, aside);
    var asideTitle = el('div', 'mb-section', '', aside);
    var asideText = el('div', 'mb-body', '', aside);
    el('div', 'mb-about', 'MovieBox Pro TV ' + VERSION + '  ·  independent TizenBrew module', body);
    var rows = {};
    /* Toggles that are on unless the viewer turned them off. */
    var TOGGLE_ON = { nativeRemote: true, nativePlayer: true, autoplayEpisodes: true };

    var defs = [
      { key: 'quality', icon: 'quality', label: 'Preferred quality', desc: 'Used to choose a file automatically when a title has several. Choose “Ask every time” to pick yourself.' },
      { key: 'nativePlayer', icon: 'play', label: 'Built-in player', toggle: true, desc: 'Plays movies and episodes in the TV app’s own player (recommended). Turn it off to use the website’s player instead.' },
      { key: 'autoplayEpisodes', icon: 'tv', label: 'Autoplay next episode', toggle: true, desc: 'Plays the next episode automatically when one ends, like Netflix. After three in a row without a button press it asks whether you are still watching.' },
      { key: 'performance', icon: 'spark', label: 'Performance mode', choice: true, desc: 'Lighter visuals for smoother scrolling on TVs: smaller pictures and fewer effects. Auto turns it on for TVs.' },
      { key: 'nativeRemote', icon: 'remote', label: 'Website remote controls', toggle: true, desc: 'On website pages the TV app does not cover (sign-in, playlists), the arrow keys move a white focus ring and OK selects.' },
      { key: 'reduceMotion', icon: 'motion', label: 'Reduce motion', toggle: true, desc: 'Turns off animations and fades. Helpful on older TVs.' },
      { key: 'clearSearches', icon: 'close', label: 'Clear search history', desc: 'Forgets the searches this TV remembers (it also forgets them when you sign out). Searches saved to your MovieBox Pro account are managed on the website.' },
      { key: 'diagnostics', icon: 'stethoscope', label: 'Diagnostics', chevron: true, desc: 'Version, page checks and recent log lines, for troubleshooting.' },
      { key: 'website', icon: 'globe', label: 'Open website view', chevron: true, desc: 'Shows the MovieBox Pro website itself. Press the Blue button or select the TV button to come back.' },
      { key: 'reload', icon: 'reload', label: 'Reload', desc: 'Reloads the page and restarts the TV app. Your place is kept.' },
      { key: 'about', icon: 'info', label: 'About', value: 'Version ' + VERSION, desc: 'MovieBox Pro TV is an independent interface for the MovieBox Pro website. It is not affiliated with MovieBox Pro, Samsung or TizenBrew.' }
    ];

    /* Labels and help text come from Prefs.describe when it knows the preference (one source of truth). */
    U.each(defs, function (def) {
      var d = null;
      try { if (typeof Prefs !== 'undefined' && typeof Prefs.describe === 'function') d = Prefs.describe(def.key); } catch (e) { d = null; }
      if (d && d.label) def.label = d.label;
      if (d && d.desc) def.desc = d.desc;
    });

    function toggleOn(key) { return !!pref(key, TOGGLE_ON[key] === true); }

    /* [{value, label}] for a choice preference (Prefs.choices), with a built-in list for performance mode. */
    function choiceList(key) {
      var out = [];
      try { if (typeof Prefs !== 'undefined' && typeof Prefs.choices === 'function') out = Prefs.choices(key) || []; } catch (e) { out = []; }
      out = U.filter(U.map(out, function (c) {
        return c && typeof c === 'object' ? { value: c.value, label: U.text(c.label) || U.titleCase(String(c.value)) } : { value: c, label: U.titleCase(String(c)) };
      }), function (c) { return c.value !== undefined && c.value !== null; });
      if (!out.length && key === 'performance') out = [{ value: 'auto', label: 'Auto' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }];
      return out;
    }

    function choiceValue(key) {
      var list = choiceList(key), v = pref(key, list.length ? list[0].value : '');
      return U.find(list, function (c) { return c.value === v; }) ? v : (list.length ? list[0].value : v);
    }

    function choiceLabel(key) {
      var v = choiceValue(key), c = U.find(choiceList(key), function (x) { return x.value === v; });
      var label = c ? c.label : U.titleCase(String(v || ''));
      /* Auto says what it decided for this TV. */
      if (key === 'performance' && v === 'auto' && typeof Kit.perf === 'function') label += perfOn() ? ' · On' : ' · Off';
      return label;
    }

    function value(def) {
      if (def.key === 'quality') return qualityLabel(pref('quality', 'best'));
      if (def.choice) return choiceLabel(def.key);
      return def.value || '';
    }

    U.each(defs, function (def) {
      var r = el('div', 'mb-lrow', null, list);
      Kit.focusable(r, 'set|' + def.key, 'setting-' + def.key);
      r.__def = def;
      r.appendChild(Icons.el(def.icon));
      el('span', 'mb-lrow-label', def.label, r);
      if (def.toggle) {
        var t = el('span', 'mb-toggle', null, r);
        el('span', 'mb-toggle-knob', null, t);
        r.__toggle = t;
        U.toggleClass(t, 'is-on', toggleOn(def.key));
      } else {
        r.__value = el('span', 'mb-lrow-value', value(def), r);
        if (def.chevron || def.key === 'quality' || def.choice) r.appendChild(Icons.el('chevronRight', 'mb-lrow-chev'));
      }
      rows[def.key] = r;
    });

    s.refresh = function () {
      U.each(defs, function (def) {
        var r = rows[def.key];
        if (r.__toggle) U.toggleClass(r.__toggle, 'is-on', toggleOn(def.key));
        else if (r.__value) r.__value.textContent = value(def);
      });
    };
    s.onShow = s.refresh;

    s.onFocus = function (node) {
      var def = node.__def;
      if (!def) return;
      /* Scroll whole rows only: the top row is never cut in half. */
      var y = Kit.reveal(list, port, node, Kit.em() * 1, Kit.em() * 1.5);
      if (y > 0) {
        var first = U.find(U.qsa(list, '.mb-lrow'), function (r) { return Kit.offsetIn(r, list).top >= y - 1; });
        if (first) Kit.setY(list, -Kit.offsetIn(first, list).top);
      }
      U.empty(asideIcon);
      asideIcon.appendChild(Icons.el(def.icon));
      asideTitle.textContent = def.label;
      asideText.textContent = def.desc;
    };

    s.act = function (action, node) {
      var def = node && node.__def;
      if (!def) return false;
      if (def.key === 'quality') { Overlays.qualityPref(function () { s.refresh(); }); return true; }
      if (def.toggle) {
        var on = !toggleOn(def.key);
        setPref(def.key, on);
        s.refresh();
        if (def.key === 'reduceMotion') App.applyPrefs();
        App.toast(def.label + (on ? ' on' : ' off'));
        return true;
      }
      if (def.choice) {
        /* OK steps through the choices (Auto, On, Off), wrapping. */
        var opts = choiceList(def.key), cur = choiceValue(def.key), i = 0;
        for (var k = 0; k < opts.length; k++) if (opts[k].value === cur) { i = k; break; }
        if (opts.length) setPref(def.key, opts[(i + 1) % opts.length].value);
        s.refresh();
        App.applyPrefs();
        App.toast(def.label + ': ' + choiceLabel(def.key));
        return true;
      }
      if (def.key === 'clearSearches') {
        try { if (typeof Api !== 'undefined' && Api.clearRecentSearches) Api.clearRecentSearches(); } catch (e) { Log.warn('clear-searches', e); }
        App.toast('Search history on this TV cleared');
        return true;
      }
      if (def.key === 'diagnostics') { App.push('diagnostics', {}); return true; }
      if (def.key === 'website') { App.openWebsite(''); return true; }
      if (def.key === 'reload') { App.reload(); return true; }
      if (def.key === 'about') { App.toast('MovieBox Pro TV ' + VERSION); return true; }
      return false;
    };
    return s;
  };

  /* ---------- Diagnostics ---------- */

  registry.diagnostics = function () {
    var s = base('diagnostics', 'diagnostics');
    s.nav = 'settings';
    var head = el('div', 'mb-page-head', null, s.el);
    el('div', 'mb-kicker', 'Settings', head);
    el('div', 'mb-h1', 'Diagnostics', head);
    el('div', 'mb-meta', 'Read these details out when asking for help.', head);
    var facts = el('div', 'mb-diag-facts', null, s.el);
    var logBox = el('div', 'mb-diag-log', null, s.el);
    var lines = Kit.zone(el('div', 'mb-diag-lines', null, logBox), 'list');

    function fact(k, v, warn) {
      var f = el('div', 'mb-fact', null, facts);
      el('div', 'mb-fact-k', k, f);
      el('div', 'mb-fact-v' + (warn ? ' is-warn' : ''), v || '\u2014', f);
    }

    function selfTestText(t) {
      if (!t) return 'Not run yet';
      var counts = [];
      if (t.counts) for (var k in t.counts) if (t.counts.hasOwnProperty(k)) counts.push(k + ' ' + t.counts[k]);
      return (t.ok ? 'OK' : 'Warnings: ' + (t.warnings || []).join('; ')) + (counts.length ? '  \u00b7  ' + counts.join(', ') : '');
    }

    function renderFacts() {
      U.empty(facts);
      var st = App.selfTest();
      fact('Version', VERSION);
      fact('Page', Log.redact ? Log.redact(location.pathname + location.search) : location.pathname);
      fact('Page type', App.pageType());
      fact('Screen', (window.innerWidth || 0) + ' \u00d7 ' + (window.innerHeight || 0));
      fact('Browser', String(navigator.userAgent || '').slice(0, 160));
      fact('Self-test', selfTestText(st), st && !st.ok);
      var btns = Kit.zone(el('div', 'mb-btns', null, facts), 'buttons');
      Kit.button({ label: 'Run self-test', icon: 'stethoscope', action: 'selftest', primary: true, parent: btns });
      Kit.button({ label: 'Clear log', icon: 'close', action: 'clear-log', parent: btns });
    }

    function renderLog() {
      U.empty(lines);
      var entries = Log.entries();
      if (entries.length < 5) entries = Log.persisted().concat(entries);
      entries = entries.slice(-30).reverse();
      if (!entries.length) { el('div', 'mb-logline', 'The log is empty.', lines); return; }
      U.each(entries, function (e) {
        var d = new Date(e.t || 0);
        var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
        var r = el('div', 'mb-logline' + (e.level === 'error' ? ' is-error' : e.level === 'warn' ? ' is-warn' : ''), hh + '  ' + e.level + '  ' + e.label + '  ' + e.msg, lines);
        Kit.focusable(r, 'log|' + e.t + '|' + e.label + '|' + lines.childNodes.length);
      });
      Kit.setY(lines, 0);
    }

    s.onFocus = function (node) {
      if (Focus.zoneOf(node) === lines) Kit.reveal(lines, logBox, node, Kit.em() * 1, Kit.em() * 1);
    };

    /* Left from any log line goes back to the buttons (never the rail, which is nearer to the top lines). */
    s.onKey = function (name) {
      var cur = Focus.current();
      if (name !== 'left' || !cur || Focus.zoneOf(cur) !== lines) return false;
      var btnZone = U.qs(facts, '[data-zone="buttons"]');
      var target = btnZone && btnZone.__mbLast && Focus.shown(btnZone.__mbLast) ? btnZone.__mbLast : U.qs(facts, '[data-action="selftest"]');
      if (target) App.focus(target);
      return true;
    };

    s.initialFocus = function () { return U.qs(facts, '[data-action="selftest"]') || Focus.firstIn(s.el); };

    s.act = function (action) {
      if (action === 'clear-log') { Log.clear(); renderLog(); App.toast('Log cleared'); return true; }
      if (action === 'selftest') {
        App.toast('Checking the home page\u2026');
        api('fetchDoc', [siteUrl('home', [], '/')], function (err, res) {
          if (!s.alive) return;
          if (err) { App.toast('Self-test could not load the home page (' + (err.code || 'error') + ')'); Log.warn('selftest', err); renderLog(); return; }
          var r = site('selfTest', [res.doc, 'home'], null);
          App.setSelfTest(r);
          Log.info('selftest', r);
          renderFacts(); renderLog();
          App.focus(U.qs(facts, '[data-action="selftest"]'));
          App.toast(r && r.ok ? 'Self-test passed' : 'Self-test found warnings');
        });
        return true;
      }
      return false;
    };

    renderFacts();
    renderLog();
    return s;
  };

  function create(name, params, ctx) {
    var fn = registry[name];
    if (!fn) throw new Error('Unknown screen: ' + name);
    var s = fn(params || {}, ctx || {});
    s.el.setAttribute('data-screen-name', name);
    return s;
  }

  return {
    create: create, has: function (name) { return !!registry[name]; },
    normItem: normItem, normItems: normItems, compactItem: compactItem, errorMessage: errorMessage, qualityLabel: qualityLabel,
    pref: pref, setPref: setPref, siteUrl: siteUrl, site: site
  };
}());
