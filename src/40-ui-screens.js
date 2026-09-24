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

  /* Crossfading art layer with the poster fallback treatment (large, scaled, 35% opacity). */
  function artLayer(parent, onFallback) {
    var wrap = el('div', 'mb-art', null, parent);
    var poster = el('img', 'mb-img mb-art-poster', null, wrap);
    var a = el('img', 'mb-img mb-art-img', null, wrap);
    var b = el('img', 'mb-img mb-art-img', null, wrap);
    U.each([poster, a, b], function (n) { n.setAttribute('alt', ''); });
    var front = a, want = '', wantPoster = '';
    function clearBackdrop() { U.toggleClass(a, 'is-loaded', false); U.toggleClass(b, 'is-loaded', false); }
    function showPoster(url) {
      if (!Kit.safeImage(url)) { U.toggleClass(poster, 'is-loaded', false); return; }
      if (wantPoster === url && U.hasClass(poster, 'is-loaded')) return;
      wantPoster = url;
      poster.onload = U.guard(function () { if (wantPoster === url) U.toggleClass(poster, 'is-loaded', true); }, 'art-poster');
      poster.onerror = U.guard(function () { U.toggleClass(poster, 'is-loaded', false); }, 'art-poster-err');
      if (poster.getAttribute('src') !== url) { U.toggleClass(poster, 'is-loaded', false); poster.src = url; }
      else U.toggleClass(poster, 'is-loaded', true);
    }
    function set(backdrop, posterUrl) {
      if (Kit.safeImage(backdrop)) {
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
          clearBackdrop();
          showPoster(posterUrl);
          if (onFallback) onFallback(posterUrl);
        }, 'art-error');
        U.toggleClass(next, 'is-ready', false);
        next.src = backdrop;
      } else {
        want = '';
        clearBackdrop();
        showPoster(posterUrl);
      }
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
      var sk = el('div', 'mb-skel mb-skel-title', null, null);
      text.insertBefore(sk, metaEl);
      s.heroSkel = sk;
      for (var r = 0; r < 2; r++) {
        var row = el('div', 'mb-row', null, rowsEl);
        el('div', 'mb-row-title', '', row).appendChild(el('div', 'mb-skel mb-skel-meta'));
        var view = el('div', 'mb-row-view', null, row);
        Kit.skeletonCards(el('div', 'mb-track', null, view), 9, 'poster');
      }
      btns.style.display = 'none';
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
        if (s.heroSkel) { U.detach(s.heroSkel); s.heroSkel = null; }
        kicker.textContent = rowTitle || (item.kind === 'tv' ? 'TV Series' : 'Movie');
        title.textContent = item.title || m.title || '';
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
          if (m && (m.overview || m.backdrop)) { fillHero(item, rowTitle, false); return; }
          if (++tries < 24) poll();
        }, 350, 'hero-meta');
      }());
    }

    function prefetch(item, rowTitle) {
      try {
        if (typeof Api !== 'undefined' && Api.prefetch) Api.prefetch(item, U.guard(function () { if (heroItem === item) fillHero(item, rowTitle, false); }, 'prefetch-cb'));
      } catch (e) { Log.warn('prefetch', e); }
      watchMeta(item, rowTitle);
    }

    function focusItem(item, rowTitle) {
      if (heroItem && item && heroItem.key === item.key && heroRow === rowTitle) return;
      heroItem = item;
      heroRow = rowTitle;
      clearTimeout(heroTimer); clearTimeout(dwellTimer); clearTimeout(pollTimer);
      heroTimer = U.later(function () { if (heroItem === item) fillHero(item, rowTitle, true); }, 250, 'hero');
      dwellTimer = U.later(function () { if (heroItem === item) prefetch(item, rowTitle); }, item.title ? 450 : 60, 'dwell');
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
        if (node.__item) focusItem(node.__item, z.__title);
      } else if (name === 'hero') {
        Kit.setY(rowsEl, 0);
        U.each(rowEls, function (r) { U.toggleClass(r, 'is-past', false); });
      }
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
    var live = ctx && ctx.live ? site('home', [document], null) : null;
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
    var art = artLayer(back, function (posterUrl) { showPosterCard(posterUrl); });
    scrims(back, true);
    el('div', 'mb-dim', null, back);
    var posterCard = el('div', 'mb-detail-poster', null, s.el);
    posterCard.style.display = 'none';
    var vport = el('div', 'mb-vport', null, s.el);
    var vs = el('div', 'mb-vscroll', null, vport);
    /* Compact title shown above the rows once the viewer scrolls below the info block. */
    var mini = el('div', 'mb-detail-mini', null, s.el);
    var miniKicker = el('div', 'mb-kicker', kind === 'tv' ? 'TV Series' : 'Movie', mini);
    var miniTitle = el('div', 'mb-mini-title', seed.title, mini);
    var top = el('div', 'mb-detail-top', null, vs);
    var info = el('div', 'mb-detail-info', null, top);
    var kicker = el('div', 'mb-kicker', kind === 'tv' ? 'TV Series' : 'Movie', info);
    var title = el('div', 'mb-display', seed.title, info);
    var metaEl = el('div', 'mb-meta', '', info);
    var ratings = el('div', 'mb-ratings', null, info);
    var overview = el('div', 'mb-body mb-clamp4', '', info);
    var tags = el('div', 'mb-tags', null, info);
    var btns = Kit.zone(el('div', 'mb-btns', null, info), 'hero');
    var playBtn = Kit.button({ label: isContinue(seed) ? 'Resume' : 'Play', icon: 'play', action: 'play', primary: true, parent: btns });
    var qualityBtn = null, episodesBtn = null;
    if (kind === 'movie') qualityBtn = Kit.button({ label: 'Quality: ' + qualityLabel(pref('quality', 'best')).replace(' available', ''), icon: 'quality', action: 'quality', parent: btns });
    else episodesBtn = Kit.button({ label: 'Episodes', icon: 'list', action: 'episodes', parent: btns });
    var rowsWrap = el('div', 'mb-detail-rows', null, vs);
    var seasonsRow = null, episodesRow = null, episodesTrack = null, rowEls = [];

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
      if (ok && posterCard.__src !== poster) { U.empty(posterCard); posterCard.__src = poster; Kit.loadNow(Kit.img(poster, '', posterCard)); }
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

    function playLabel(m) {
      var raw = U.text(m && m.playLabel);
      if (/resume|continue|\d:\d\d/i.test(raw) || isContinue(seed)) return 'Resume';
      return 'Play';
    }

    function makeRow(zoneName, label) {
      var row = Kit.zone(el('div', 'mb-row', null, rowsWrap), zoneName);
      if (label) el('div', 'mb-row-title', label, row);
      var view = el('div', 'mb-row-view', null, row);
      var track = el('div', 'mb-track', null, view);
      rowEls.push(row);
      return { row: row, track: track };
    }

    function episodeCard(ep) {
      var c = el('div', 'mb-card mb-card--wide mb-episode');
      Kit.focusable(c, 'ep|' + ep.season + 'x' + ep.episode);
      c.setAttribute('data-episode', ep.season + 'x' + ep.episode);
      c.__episode = ep;
      var a = el('div', 'mb-card-art', null, c);
      var ph = el('div', 'mb-card-ph', null, a);
      el('span', 'mb-card-ph-title', ep.code || ('S' + ep.season + 'E' + ep.episode), ph);
      Kit.img(ep.still, 'mb-card-img', a);
      el('div', 'mb-card-shade', null, a);
      el('span', 'mb-ep-code', ep.code || ('S' + ep.season + ' E' + ep.episode), a);
      var play = el('div', 'mb-ep-play', null, a);
      play.appendChild(Icons.el('play'));
      el('div', 'mb-ep-title', (ep.episode ? ep.episode + '. ' : '') + (ep.title || 'Episode ' + ep.episode), c);
      el('div', 'mb-ep-meta', Kit.metaLine([Kit.fmtRuntime(ep.runtime), ep.date, ep.rating ? 'IMDb ' + ep.rating : '']), c);
      el('div', 'mb-ep-over', ep.overview || '', c);
      return c;
    }

    function fillEpisodes(list, loading) {
      if (!episodesTrack) return;
      U.empty(episodesTrack);
      Kit.setX(episodesTrack, 0);
      if (loading) { Kit.skeletonCards(episodesTrack, 5, 'wide'); return; }
      if (!list || !list.length) {
        var none = el('div', 'mb-empty', null, episodesTrack);
        el('div', 'mb-body', 'No episodes are listed for this season yet.', none);
        return;
      }
      U.each(list, function (ep) { episodesTrack.appendChild(episodeCard(ep)); });
      Kit.lazySoon(s.el);
    }

    function loadSeason(n) {
      if (!seasonsRow) return;
      season = n;
      U.each(U.qsa(seasonsRow, '[data-season]'), function (c) {
        U.toggleClass(c, 'is-selected', +c.getAttribute('data-season') === n);
        if (+c.getAttribute('data-season') === n) seasonsRow.__mbLast = c;
      });
      fillEpisodes(null, true);
      var want = n;
      var done = function (err, m) {
        if (!s.alive || season !== want) return;
        if (err || !m) {
          if (err && err.code === 'signed-out') { fail(s, err); return; }
          U.empty(episodesTrack);
          var box = el('div', 'mb-empty', null, episodesTrack);
          el('div', 'mb-body', 'Couldn\u2019t load season ' + want + '. Select the season again to retry.', box);
          return;
        }
        fillEpisodes(m.episodes || [], false);
      };
      /* Api.detail(kind, id, cb, opts): the callback is not last, so it is called directly. */
      try {
        if (typeof Api !== 'undefined' && Api.detail) Api.detail(kind, id, U.guard(done, 'season-cb'), { season: n });
        else done({ code: 'exception' });
      } catch (e) { Log.error('season', e); done({ code: 'exception' }); }
    }

    function render(m) {
      if (!s.alive) return;
      model = m;
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
      U.empty(tags);
      U.each((m.badges || []).slice(0, 4), function (b) { el('span', 'mb-tag mb-tag--line', b, tags); });
      if (m.audio) el('span', 'mb-tag mb-tag--line', m.audio, tags);
      tags.style.display = tags.firstChild ? '' : 'none';
      Kit.setLabel(playBtn, playLabel(m));
      setArt(m.backdrop || m.backdropOriginal || seed.backdrop, m.poster || seed.poster);
      U.empty(rowsWrap);
      rowEls = [];
      seasonsRow = null; episodesRow = null; episodesTrack = null;
      if (kind === 'tv') {
        var seasons = m.seasons || [];
        season = m.season || season || (seasons[0] && seasons[0].number) || 1;
        if (seasons.length) {
          seasonsRow = Kit.zone(el('div', 'mb-row mb-row--seasons', null, rowsWrap), 'seasons');
          var pills = el('div', 'mb-seasons', null, seasonsRow);
          U.each(seasons, function (se) {
            var c = Kit.chip('Season ' + se.number, { key: 'season|' + se.number, parent: pills });
            c.setAttribute('data-season', String(se.number));
            U.toggleClass(c, 'is-selected', +se.number === +season);
            if (+se.number === +season) seasonsRow.__mbLast = c;
          });
          rowEls.push(seasonsRow);
        }
        var er = makeRow('row:episodes', seasons.length ? '' : 'Episodes');
        episodesRow = er.row; episodesTrack = er.track;
        fillEpisodes(m.episodes || [], false);
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

    s.onFocus = function (node) {
      var z = Focus.zoneOf(node), name = z ? z.getAttribute('data-zone') : '';
      if (name === 'hero' || !z) { Kit.setY(vs, 0); U.toggleClass(s.el, 'is-scrolled', false); return; }
      var em = Kit.em(), anchor = em * 9.5;
      var y = Math.max(0, Kit.offsetIn(z, vs).top - anchor);
      /* Never scroll past the last row: the rows fill the lower screen instead of leaving it empty. */
      var last = rowEls[rowEls.length - 1];
      if (last) {
        var lb = Kit.offsetIn(last, vs);
        y = Math.min(y, Math.max(0, lb.top + lb.height + em * 2 - vport.clientHeight));
      }
      Kit.setY(vs, -y);
      U.toggleClass(s.el, 'is-scrolled', y > 0);
    };

    s.play = function (episode) {
      var t = { kind: kind, id: id, title: (model && model.title) || seed.title, item: seed, backdrop: (model && model.backdrop) || seed.backdrop };
      if (episode) { t.season = episode.season; t.episode = episode.episode; t.title = t.title + '  \u00b7  ' + (episode.code || ('S' + episode.season + 'E' + episode.episode)); }
      else if (seed.playHref) t.playHref = seed.playHref;
      App.play(t);
    };

    s.act = function (action, node) {
      if (action === 'play') { s.play(null); return true; }
      if (action === 'episodes') { var f = episodesRow && Focus.firstIn(episodesRow); if (f) App.focus(f); return true; }
      if (action === 'quality') {
        Overlays.quality({ title: (model && model.title) || seed.title, sources: model && model.sources || [], onPick: function (src) {
          var t = { kind: kind, id: id, title: (model && model.title) || seed.title, item: seed, pick: src };
          App.play(t);
        }, onChange: function (q) { if (qualityBtn) Kit.setLabel(qualityBtn, 'Quality: ' + qualityLabel(q).replace(' available', '')); } });
        return true;
      }
      if (node && node.__episode) { s.play(node.__episode); return true; }
      if (node && node.hasAttribute('data-season')) { var n = +node.getAttribute('data-season'); if (n !== season || !episodesTrack || !episodesTrack.firstChild) loadSeason(n); else { var fe = Focus.firstIn(episodesRow); if (fe) App.focus(fe); } return true; }
      if (node && node.__item) { App.push('detail', { kind: node.__item.kind, id: node.__item.id, item: compactItem(node.__item) }); return true; }
      if (node && node.__person) { App.push('search', { query: node.__person.name, submit: true }); return true; }
      return false;
    };

    s.refreshQuality = function () { if (qualityBtn) Kit.setLabel(qualityBtn, 'Quality: ' + qualityLabel(pref('quality', 'best')).replace(' available', '')); };
    s.onShow = s.refreshQuality;

    skeletonInfo();
    var liveModel = ctx && ctx.live ? site('detail', [document, location.href], null) : null;
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
    var results = null, page = 1, next = '', loadingMore = false, searchSeq = 0, sugSeq = 0, total = null, focusResults = false;
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
    var sug = Kit.zone(el('div', 'mb-suggest', null, left), 'list');
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
    var discover = el('div', 'mb-discover', null, right);

    function renderQuery() {
      queryEl.textContent = q;
      U.toggleClass(line, 'is-empty', !q);
    }

    function setQuery(v, suggest) {
      q = String(v || '').replace(/\s+/g, ' ').replace(/^\s+/, '').slice(0, 80);
      renderQuery();
      if (suggest !== false) scheduleSuggest();
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
        if (!text || seen[text.toLowerCase()] || sug.childNodes.length >= 6) return;
        seen[text.toLowerCase()] = true;
        var r = el('div', 'mb-srow', null, sug);
        Kit.focusable(r, 'sug|' + text);
        r.setAttribute('data-suggestion', text);
        r.appendChild(Icons.el('search'));
        el('span', 'mb-srow-label', text, r);
      });
      if (hadFocus) App.focus(Focus.firstIn(sug) || U.qs(kb, '[data-f]'));
    }

    function showDiscover() {
      U.empty(discover);
      discover.style.display = '';
      gport.style.display = 'none';
      tabs.style.display = 'none';
      headTitle.textContent = 'Find something to watch';
      headCount.textContent = '';
      el('div', 'mb-discover-hint', 'Type with the keyboard or the remote\u2019s number keys. Suggestions appear as you type; choose Search for full results.', discover);
      var recent = [];
      try { if (typeof Api !== 'undefined' && Api.recentSearches) recent = Api.recentSearches() || []; } catch (e) {}
      var recentZone = null, trendZone = null;
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
      recentZone = chips('Recent searches', recent, 'chips:recent');
      api('hot', [], function (err, hot) {
        if (!s.alive || results) return;
        if (err || !hot) return;
        var merged = recent.concat(hot.recent || []);
        if (recentZone) { U.detach(recentZone.previousSibling); U.detach(recentZone); }
        var keep = Focus.current();
        U.each(U.qsa(discover, '.mb-section, .mb-chiprow'), U.detach);
        recentZone = chips('Recent searches', merged, 'chips:recent');
        trendZone = chips('Trending now', hot.trending || [], 'chips:trending');
        if (keep && !Focus.shown(keep)) App.focus(firstKey);
      });
    }

    function tabsState() {
      U.each(U.qsa(tabs, '[data-type]'), function (c) { U.toggleClass(c, 'is-selected', c.getAttribute('data-type') === type); });
    }

    function headFor(query, count) {
      headTitle.textContent = 'Results for \u201c' + query + '\u201d';
      headCount.textContent = count == null ? '' : count === 1 ? '1 title' : count + ' titles';
    }

    function showResultsLoading(query) {
      discover.style.display = 'none';
      gport.style.display = '';
      tabs.style.display = '';
      tabsState();
      headFor(query, null);
      U.empty(grid);
      Kit.setY(grid, 0);
      Kit.skeletonCards(grid, 10, 'poster');
    }

    function addCards(items) {
      U.each(items, function (it) { grid.appendChild(Kit.card(it, { size: 'poster', zone: 'grid', sub: true })); });
      Kit.lazySoon(s.el);
    }

    function submit(text, opts) {
      opts = opts || {};
      if (text != null) setQuery(text, false);
      var query = U.text(q);
      if (!query) { App.toast('Type a title first'); return; }
      suggestSoon.cancel();
      sugSeq++;
      var mine = ++searchSeq;
      results = { query: query, type: type, items: [] };
      page = 1; next = ''; total = null; focusResults = !!opts.focus;
      showResultsLoading(query);
      api('search', [query, type, 1], function (err, r) {
        if (!s.alive || mine !== searchSeq) return;
        U.empty(grid);
        if (err) {
          if (err.code === 'signed-out') { fail(s, err); return; }
          headFor(query, null);
          stateBlock(grid, { icon: 'info', title: 'Search didn\u2019t load', text: errorMessage(err),
            actions: [{ label: 'Try again', icon: 'reload', action: 'search-retry', primary: true }] }, 'buttons');
          return;
        }
        var items = normItems(r && r.items);
        results.items = items;
        next = r && r.next || '';
        total = r && typeof r.total === 'number' ? r.total : items.length;
        headFor(query, total);
        if (!items.length) {
          stateBlock(grid, { icon: 'search', title: 'No matches for \u201c' + query + '\u201d',
            text: 'Try a shorter title, check the spelling, or switch between Movies and TV Shows.',
            actions: [{ label: 'Search on the website', icon: 'globe', action: 'open-website' }] }, 'buttons');
          return;
        }
        addCards(items);
        if (focusResults) { var f = Focus.firstIn(grid); if (f) App.focus(f); }
        App.saveState();
      });
    }

    function loadMore() {
      if (!next || loadingMore || !results) return;
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
      results = { query: snap.query, type: type, items: normItems(snap.items) };
      next = snap.next || ''; page = snap.page || 1; total = snap.total;
      showResultsLoading(snap.query);
      U.empty(grid);
      headFor(snap.query, total);
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
      if (results && results.items.length && params.snap) return Focus.firstIn(grid) || firstKey;
      return firstKey;
    };

    s.onFocus = function (node) {
      var z = Focus.zoneOf(node);
      if (z === grid && node.__item) {
        Kit.reveal(grid, gport, node, Kit.em() * 1, Kit.em() * 4);
        var cards = U.qsa(grid, '.mb-card[data-key]');
        var i = U.indexOf(cards, node);
        if (i >= cards.length - 5) loadMore();
      }
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
    if (!restoreSnapshot(params.snap)) {
      showDiscover();
      if (q && params.submit) U.later(function () { if (s.alive) submit(null, { focus: true }); }, 0, 'search-auto');
      else if (q) scheduleSuggest();
    }
    return s;
  };

  /* ---------- Browse grid (movies, shows, lists, library) ---------- */

  registry.browse = function (params, ctx) {
    var s = base('browse', 'browse');
    s.nav = params.nav || '';
    var url = params.url || siteUrl('movies', [], '/movie');
    var next = '', loadingMore = false, seq = 0, count = 0, keys = {};
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
      U.each(U.qsa(tabs, '.mb-chip'), function (c) { U.toggleClass(c, 'is-selected', !!c.__href && c.__href === url); });
    }

    function load(target, keepTabs) {
      var mine = ++seq;
      url = target;
      next = ''; count = 0; keys = {};
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
        if (!params.tabs) renderTabs(data.chips, url);
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
      if (!next || loadingMore) return;
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
        var cards = U.qsa(grid, '.mb-card[data-key]');
        if (U.indexOf(cards, node) >= cards.length - 6) loadMore();
      } else Kit.setY(vs, 0);
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
    var list = Kit.zone(el('div', 'mb-list', null, body), 'list');
    var aside = el('div', 'mb-aside', null, body);
    var asideIcon = el('div', null, null, aside);
    var asideTitle = el('div', 'mb-section', '', aside);
    var asideText = el('div', 'mb-body', '', aside);
    el('div', 'mb-about', 'MovieBox Pro TV ' + VERSION + '  \u00b7  independent TizenBrew module', body);
    var rows = {};

    var defs = [
      { key: 'quality', icon: 'quality', label: 'Preferred quality', desc: 'Used to choose a file automatically when a title has several. Choose \u201cAsk every time\u201d to pick yourself.' },
      { key: 'nativeRemote', icon: 'remote', label: 'Website remote controls', toggle: true, desc: 'On website pages the TV app does not cover (sign-in, playlists), the arrow keys move a white focus ring and OK selects.' },
      { key: 'reduceMotion', icon: 'motion', label: 'Reduce motion', toggle: true, desc: 'Turns off animations and fades. Helpful on older TVs.' },
      { key: 'diagnostics', icon: 'stethoscope', label: 'Diagnostics', chevron: true, desc: 'Version, page checks and recent log lines, for troubleshooting.' },
      { key: 'website', icon: 'globe', label: 'Open website view', chevron: true, desc: 'Shows the MovieBox Pro website itself. Press the Blue button or select the TV button to come back.' },
      { key: 'reload', icon: 'reload', label: 'Reload', desc: 'Reloads the page and restarts the TV app. Your place is kept.' },
      { key: 'about', icon: 'info', label: 'About', value: 'Version ' + VERSION, desc: 'MovieBox Pro TV is an independent interface for the MovieBox Pro website. It is not affiliated with MovieBox Pro, Samsung or TizenBrew.' }
    ];

    function value(def) {
      if (def.key === 'quality') return qualityLabel(pref('quality', 'best'));
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
        U.toggleClass(t, 'is-on', !!pref(def.key, def.key === 'nativeRemote'));
      } else {
        r.__value = el('span', 'mb-lrow-value', value(def), r);
        if (def.chevron || def.key === 'quality') r.appendChild(Icons.el('chevronRight', 'mb-lrow-chev'));
      }
      rows[def.key] = r;
    });

    s.refresh = function () {
      U.each(defs, function (def) {
        var r = rows[def.key];
        if (r.__toggle) U.toggleClass(r.__toggle, 'is-on', !!pref(def.key, def.key === 'nativeRemote'));
        else if (r.__value) r.__value.textContent = value(def);
      });
    };
    s.onShow = s.refresh;

    s.onFocus = function (node) {
      var def = node.__def;
      if (!def) return;
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
        var on = !pref(def.key, def.key === 'nativeRemote');
        setPref(def.key, on);
        s.refresh();
        if (def.key === 'reduceMotion') App.applyPrefs();
        App.toast(def.label + (on ? ' on' : ' off'));
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
      fact('Page', location.pathname + location.search);
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
