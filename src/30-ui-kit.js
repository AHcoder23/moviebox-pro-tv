/* UI kit: author-written icons, element builders, the lazy image loader, transform scrolling and the focus engine.
   Only namespace definitions run at load time. */
var Icons = (function () {
  var P = {
    search: '<circle cx="10.5" cy="10.5" r="6.3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.2 15.2l5.3 5.3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    home: '<path d="M12 3.1l9.4 8.1h-2.9v9.4h-5.1v-6h-2.8v6H5.5v-9.4H2.6z"/>',
    film: '<path fill-rule="evenodd" d="M4.2 3h15.6c.7 0 1.2.5 1.2 1.2v15.6c0 .7-.5 1.2-1.2 1.2H4.2C3.5 21 3 20.5 3 19.8V4.2C3 3.5 3.5 3 4.2 3zM5 5v2.2h2.2V5zm0 4v2.2h2.2V9zm0 3.8V15h2.2v-2.2zm0 4V19h2.2v-2.2zM16.8 5v2.2H19V5zm0 4v2.2H19V9zm0 3.8V15H19v-2.2zm0 4V19H19v-2.2zM9.2 5v6h5.6V5zm0 8v6h5.6v-6z"/>',
    tv: '<path fill-rule="evenodd" d="M4.4 4h15.2C20.4 4 21 4.6 21 5.4v10.2c0 .8-.6 1.4-1.4 1.4H4.4C3.6 17 3 16.4 3 15.6V5.4C3 4.6 3.6 4 4.4 4zM5.2 6.2v8.6h13.6V6.2zM7.5 19h9v1.8h-9z"/>',
    library: '<path d="M6.2 3h11.6c.7 0 1.2.5 1.2 1.2V21l-7-4.3L5 21V4.2C5 3.5 5.5 3 6.2 3z"/>',
    settings: '<path d="M10.3 6.8L10.64 2L13.36 2L13.7 6.8ZM14.47 7.12L18.11 3.97L20.03 5.89L16.88 9.53ZM17.2 10.3L22 10.64L22 13.36L17.2 13.7ZM16.88 14.47L20.03 18.11L18.11 20.03L14.47 16.88ZM13.7 17.2L13.36 22L10.64 22L10.3 17.2ZM9.53 16.88L5.89 20.03L3.97 18.11L7.12 14.47ZM6.8 13.7L2 13.36L2 10.64L6.8 10.3ZM7.12 9.53L3.97 5.89L5.89 3.97L9.53 7.12ZM4.8 12a7.2 7.2 0 1 1 14.4 0a7.2 7.2 0 1 1-14.4 0zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z"/>',
    play: '<path d="M7.2 4.3v15.4c0 .8.9 1.3 1.6.9l12.1-7.7c.6-.4.6-1.4 0-1.8L8.8 3.4c-.7-.4-1.6.1-1.6.9z"/>',
    pause: '<path d="M6.5 4h3.6c.4 0 .7.3.7.7v14.6c0 .4-.3.7-.7.7H6.5c-.4 0-.7-.3-.7-.7V4.7c0-.4.3-.7.7-.7zm7.4 0h3.6c.4 0 .7.3.7.7v14.6c0 .4-.3.7-.7.7h-3.6c-.4 0-.7-.3-.7-.7V4.7c0-.4.3-.7.7-.7z"/>',
    info: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.3 8.2v7.6h2.6v-7.6zM12 5.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>',
    back: '<path d="M10.9 5.2L4.1 12l6.8 6.8 1.7-1.7-3.9-3.9H20v-2.4H8.7l3.9-3.9z"/>',
    check: '<path d="M9.4 16.4l-4.3-4.3-1.8 1.8 6.1 6.1L21 8.3l-1.8-1.8z"/>',
    star: '<path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5-4.8-4.5 6.5-.8z"/>',
    chevronRight: '<path d="M8.6 5.4L15.2 12l-6.6 6.6-1.7-1.7 4.9-4.9-4.9-4.9z"/>',
    chevronLeft: '<path d="M15.4 5.4L8.8 12l6.6 6.6 1.7-1.7-4.9-4.9 4.9-4.9z"/>',
    chevronDown: '<path d="M5.4 8.6L12 15.2l6.6-6.6-1.7-1.7-4.9 4.9-4.9-4.9z"/>',
    list: '<path d="M4 5.5h2.4v2.4H4zm4.4 0H20v2.4H8.4zM4 10.8h2.4v2.4H4zm4.4 0H20v2.4H8.4zM4 16.1h2.4v2.4H4zm4.4 0H20v2.4H8.4z"/>',
    quality: '<path fill-rule="evenodd" d="M4.2 5h15.6c.7 0 1.2.5 1.2 1.2v11.6c0 .7-.5 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2V6.2C3 5.5 3.5 5 4.2 5zM5.2 7.2v9.6h13.6V7.2zM7 9h1.8v2.1h2V9h1.8v6h-1.8v-2.2h-2V15H7zm7 0h2.6c1.3 0 2.4 1.1 2.4 2.4v1.2c0 1.3-1.1 2.4-2.4 2.4H14zm1.8 1.7v2.6h.8c.4 0 .6-.3.6-.7v-1.2c0-.4-.2-.7-.6-.7z"/>',
    backspace: '<path d="M8.6 5.6h11c.8 0 1.4.6 1.4 1.4v10c0 .8-.6 1.4-1.4 1.4h-11L3 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M11.3 9.3l5.4 5.4m0-5.4l-5.4 5.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    space: '<path d="M4 9.5v5h16v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M6.3 4.6L12 10.3l5.7-5.7 1.7 1.7-5.7 5.7 5.7 5.7-1.7 1.7-5.7-5.7-5.7 5.7-1.7-1.7 5.7-5.7-5.7-5.7z"/>',
    globe: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.4 2.2A7.9 7.9 0 0 0 4.2 11h3.3c.1-2.6.9-5 3.1-6.8zm2.8 0c2.2 1.8 3 4.2 3.1 6.8h3.3a7.9 7.9 0 0 0-6.4-6.8zM12 4.6c-1.6 1.5-2.3 3.8-2.4 6.4h4.8c-.1-2.6-.8-4.9-2.4-6.4zM4.2 13a7.9 7.9 0 0 0 6.4 6.8c-2.2-1.8-3-4.2-3.1-6.8zm5.4 0c.1 2.6.8 4.9 2.4 6.4 1.6-1.5 2.3-3.8 2.4-6.4zm6.9 0c-.1 2.6-.9 5-3.1 6.8a7.9 7.9 0 0 0 6.4-6.8z"/>',
    reload: '<path d="M12 4.2c2.2 0 4.2.9 5.6 2.4L20 4.2V11h-6.8l2.9-2.9A5.7 5.7 0 0 0 6.4 12H4.2A7.8 7.8 0 0 1 12 4.2zm7.8 7.8A7.8 7.8 0 0 1 6.4 17.4L4 19.8V13h6.8l-2.9 2.9a5.7 5.7 0 0 0 9.7-3.9z"/>',
    qr: '<path fill-rule="evenodd" d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm1-9h2v2H6zm10 0h2v2h-2zM6 16h2v2H6zm7-3h2v2h-2zm2 2h2v2h-2zm-2 2h2v4h-2zm4 0h4v2h-4zm2-4h2v4h-2zm-2 6h2v2h-2zm2 0h2v2h-2z"/>',
    keypad: '<path d="M5 3.5h3v3H5zm5.5 0h3v3h-3zm5.5 0h3v3h-3zM5 9h3v3H5zm5.5 0h3v3h-3zM16 9h3v3h-3zM5 14.5h3v3H5zm5.5 0h3v3h-3zm5.5 0h3v3h-3zm-5.5 5h3v3h-3z"/>',
    user: '<path d="M12 3.2a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6zm0 10.2c4.3 0 8 2.1 8 5.2v2.2H4v-2.2c0-3.1 3.7-5.2 8-5.2z"/>',
    power: '<path d="M10.8 2.5h2.4v9.3h-2.4zM7.1 5.3l1.5 1.8a6.3 6.3 0 1 0 6.8 0l1.5-1.8A8.6 8.6 0 1 1 7.1 5.3z"/>',
    stethoscope: '<path fill-rule="evenodd" d="M4 3h3v2H6v5a4 4 0 0 0 8 0V5h-1V3h3v7a6 6 0 0 1-5 5.9v1.6a2.5 2.5 0 0 0 5 0v-1.2a3 3 0 1 1 2 0v1.2a4.5 4.5 0 0 1-9 0v-1.6A6 6 0 0 1 4 10z"/>',
    motion: '<path d="M3 11h8.6v2H3zm2-4.5h9v2H5zm0 9h9v2H5zM16.5 5a7 7 0 0 1 0 14v-2.2a4.8 4.8 0 0 0 0-9.6z"/>',
    remote: '<path fill-rule="evenodd" d="M8.4 2h7.2c.8 0 1.4.6 1.4 1.4v17.2c0 .8-.6 1.4-1.4 1.4H8.4c-.8 0-1.4-.6-1.4-1.4V3.4C7 2.6 7.6 2 8.4 2zM12 4.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM9.6 12v2h2v-2zm2.8 0v2h2v-2zm-2.8 3.2v2h2v-2zm2.8 0v2h2v-2z"/>',
    spark: '<path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>'
  };

  function markup(name) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" focusable="false">' + (P[name] || P.info) + '</svg>';
  }

  /* Returns a fresh <span class="mb-ico"> holding the static SVG. */
  function el(name, cls) { return U.svg(markup(name), cls); }

  return { markup: markup, el: el };
}());

var Kit = (function () {
  var lazyTimer = null;
  var tvUA = null;

  function el(tag, cls, text, parent) { return U.el(tag, cls, text, parent); }

  /* ---------- TV performance mode ---------- */

  /* A TV browser (the native player uses the same test). */
  function isTV() {
    if (tvUA === null) {
      try { tvUA = /Tizen|SMART-TV|Web0S|NetCast/i.test(String(navigator.userAgent || '')); } catch (e) { tvUA = false; }
    }
    try { return tvUA || !!window.tizen; } catch (e2) { return tvUA; }
  }

  /* Prefs 'performance': 'on', 'off' or 'auto' (the default: on for TVs). App puts .mb-perf on #mbptv while it is on;
     the kit loads smaller pictures and fewer at a time, and screens can ask for their calmer timings (timing()). */
  function perf() {
    var p = 'auto';
    try { if (typeof Prefs !== 'undefined' && Prefs.get) p = Prefs.get('performance') || 'auto'; } catch (e) { p = 'auto'; }
    if (p === 'on') return true;
    if (p === 'off') return false;
    return isTV();
  }

  /* Timings screens use, by name, as [normal, performance mode]: dwell = how long focus rests on a card before its
     details are prefetched (Home's hero). */
  var TIMINGS = { dwell: [450, 700] };
  function timing(name) {
    var t = TIMINGS[name];
    return t ? t[perf() ? 1 : 0] : 0;
  }

  function focusable(node, key, action) {
    node.setAttribute('data-f', '');
    node.setAttribute('tabindex', '-1');
    if (key) node.setAttribute('data-fk', key);
    if (action) node.setAttribute('data-action', action);
    return node;
  }

  function zone(node, name) { node.setAttribute('data-zone', name); return node; }

  /* Pill button: {label, icon, action, key, primary, cls, parent} */
  function button(opts) {
    var b = el('div', 'mb-btn' + (opts.primary ? ' mb-btn--primary' : '') + (opts.cls ? ' ' + opts.cls : ''));
    focusable(b, opts.key || opts.action || opts.label, opts.action);
    if (opts.icon) b.appendChild(Icons.el(opts.icon, 'mb-btn-ico'));
    var label = el('span', 'mb-btn-label', opts.label || '', b);
    b.__label = label;
    if (opts.parent) opts.parent.appendChild(b);
    return b;
  }

  function setLabel(btn, text) { if (btn && btn.__label) btn.__label.textContent = text; }

  function safeImage(url) { return typeof url === 'string' && /^https?:\/\//i.test(url) && url.length < 2048; }

  /* ---------- Images ---------- */

  var TMDB = /^(https?:\/\/image\.tmdb\.org\/t\/p\/)(original|w\d+)(\/[^?#]+)$/i;

  /* The URL of an image at about w CSS pixels wide (1080p frame). The site's thumbnail service honours any width
     (Site.thumb, when the adapter provides it); TMDB serves fixed sizes, so its art gets w780 (up to 780 px) or
     w1280, never a larger file than the one it came as. Performance mode caps every width at 780. Other URLs, and
     any width the adapter cannot produce, come back unchanged. */
  function imgUrl(url, w) {
    if (!safeImage(url)) return url;
    w = Math.round(+w || 0);
    if (!(w > 0)) return url;
    if (w > 780 && perf()) w = 780;
    var m = TMDB.exec(url);
    if (m) {
      var have = /^original$/i.test(m[2]) ? 1e9 : parseInt(m[2].slice(1), 10) || 1e9, want = w <= 780 ? 780 : 1280;
      return have <= want ? url : m[1] + 'w' + want + m[3];
    }
    if (typeof Site !== 'undefined' && typeof Site.thumb === 'function') {
      try { var t = Site.thumb(url, w); if (safeImage(t)) return t; } catch (e) {}
    }
    return url;
  }

  /* Full-screen backdrop art (hero, detail, playback): 1280 px, or 780 in performance mode. */
  function backdrop(url) { return imgUrl(url, 1280); }

  /* Loads in flight. Performance mode starts at most MAX_LOADS lazy images at once, nearest to the screen first; a
     load that never finishes gives its slot back after SLOT_MS. */
  var MAX_LOADS = 6, SLOT_MS = 10000;
  var loads = { active: [], queue: [] };

  function release(node) {
    var i = U.indexOf(loads.active, node);
    if (i < 0) return;
    loads.active.splice(i, 1);
    if (loads.queue.length) pump();
  }

  function startLoad(node, counted) {
    U.toggleClass(node, 'mb-lazy', false);
    if (!node.__src || node.getAttribute('src') === node.__src) return;
    if (counted && U.indexOf(loads.active, node) < 0) { node.__mbAt = U.now(); loads.active.push(node); }
    node.src = node.__src;
  }

  function pump() {
    var now = U.now(), root = document.documentElement;
    loads.active = U.filter(loads.active, function (n) { return root.contains(n) && now - (n.__mbAt || 0) < SLOT_MS && now >= (n.__mbAt || 0); });
    while (loads.queue.length && loads.active.length < MAX_LOADS) {
      var n = loads.queue.shift();
      if (U.hasClass(n, 'mb-lazy') && root.contains(n)) startLoad(n, true);
    }
  }

  /* The single image entry point: Kit.img(url, opts), or the older Kit.img(url, cls, parent, fallback | opts).
     opts: {cls, parent, w: CSS pixels wide at 1080p (asks for that size, see imgUrl), fallback: another URL,
     eager: load now instead of when it nears the screen}. On an error the image falls back once to the original URL
     (when a sized one was asked for), then to the fallback, then shows the placeholder (.is-error). */
  function img(url, cls, parent, fallback) {
    var o = {};
    if (cls && typeof cls === 'object') o = cls;
    else {
      o = { cls: cls, parent: parent };
      if (fallback && typeof fallback === 'object') { o.w = fallback.w; o.fallback = fallback.fallback; o.eager = fallback.eager; }
      else o.fallback = fallback;
    }
    var node = document.createElement('img');
    node.className = 'mb-img' + (o.cls ? ' ' + o.cls : '');
    node.setAttribute('alt', '');
    node.setAttribute('draggable', 'false');
    var chain = [];
    function add(u) { if (safeImage(u) && U.indexOf(chain, u) < 0) chain.push(u); }
    add(o.w ? imgUrl(url, o.w) : url);
    add(url);
    add(o.w ? imgUrl(o.fallback, o.w) : o.fallback);
    add(o.fallback);
    node.onload = U.guard(function () {
      release(node);
      U.toggleClass(node, 'is-loaded', true);
      U.toggleClass(node, 'is-error', false);
    }, 'img-load');
    node.onerror = U.guard(function () {
      var next = node.__chain && node.__chain.length ? node.__chain.shift() : '';
      if (next) { node.__src = next; node.__mbAt = U.now(); node.src = next; return; }
      release(node);
      U.toggleClass(node, 'is-error', true);
      U.toggleClass(node, 'is-loaded', false);
    }, 'img-error');
    var first = chain.shift();
    node.__chain = chain;
    if (first) { node.__src = first; U.toggleClass(node, 'mb-lazy', true); }
    else U.toggleClass(node, 'is-error', true);
    if (o.parent) o.parent.appendChild(node);
    if (o.eager && first) loadNow(node);
    return node;
  }

  /* Loads immediately, ahead of the lazy queue (hero and backdrop art). */
  function loadNow(node) {
    if (!node || !node.__src) return;
    startLoad(node, false);
  }

  /* Two phases: read every rect first, then start the loads. Interleaving them would force one synchronous layout per
     image (loading changes classes), which costs tens of milliseconds per row change on TV CPUs. Images within one
     viewport beyond the screen load (half a viewport in performance mode, where they also queue, nearest first). */
  function lazyCheck(scope) {
    var list = U.qsa(scope || document.getElementById('mbptv'), 'img.mb-lazy');
    if (!list.length) return;
    var vw = window.innerWidth || 1920, vh = window.innerHeight || 1080, p = perf(), mx = p ? vw * 0.5 : vw, my = p ? vh * 0.5 : vh;
    var hits = [], i;
    for (i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (r.right > -mx && r.left < vw + mx && r.bottom > -my && r.top < vh + my) {
        list[i].__mbDist = Math.max(0, -r.right, r.left - vw) + Math.max(0, -r.bottom, r.top - vh) * 2;
        list[i].__mbOrd = hits.length;
        hits.push(list[i]);
      }
    }
    if (!p) { for (i = 0; i < hits.length; i++) startLoad(hits[i], false); return; }
    hits.sort(function (a, b) { return a.__mbDist - b.__mbDist || a.__mbOrd - b.__mbOrd; });
    loads.queue = hits;
    pump();
  }

  /* Coalesces checks: one now-ish and one after transitions settle. */
  function lazySoon(scope) {
    clearTimeout(lazyTimer);
    lazyTimer = U.later(function () {
      lazyCheck(scope);
      lazyTimer = U.later(function () { lazyCheck(scope); }, 320, 'lazy-2');
    }, 40, 'lazy');
  }

  function fmtRuntime(value) {
    var s = U.text(value);
    if (!s) return '';
    var m = s.match(/^(\d+)\s*(?:min|mins|minutes|m)\b/i);
    if (!m) return s;
    var n = parseInt(m[1], 10);
    if (!n) return '';
    if (n < 60) return n + 'm';
    return Math.floor(n / 60) + 'h' + (n % 60 ? ' ' + (n % 60) + 'm' : '');
  }

  function metaLine(parts) {
    return U.filter(U.map(parts, function (p) { return U.text(p); }), function (p) { return !!p; }).join('  \u00b7  ');
  }

  function genresText(list, max) {
    if (!list || !list.length) return '';
    return U.map(list.slice(0, max || 3), function (g) { return U.titleCase(g); }).join(', ');
  }

  function progressBar(value, parent) {
    var bar = el('div', 'mb-progress', null, parent);
    var fill = el('div', 'mb-progress-fill', null, bar);
    fill.style.width = Math.round(U.clamp(value, 0, 1) * 1000) / 10 + '%';
    return bar;
  }

  function badgeText(item) {
    var b = U.text(item && item.badge);
    if (/4k/i.test(b)) return '4K';
    if (/blu/i.test(b)) return 'HD';
    return '';
  }

  /* The picture width a card asks for (CSS pixels at 1080p, with headroom for the focus scale): posters are 12em and
     15em wide, landscape cards 22em. Performance mode asks for smaller files. */
  function cardWidth(size) {
    var p = perf();
    if (size === 'wide') return p ? 500 : 780;
    if (size === 'grid') return p ? 342 : 500;
    return p ? 300 : 500;
  }

  /* Title card. opts: {size: 'poster'|'grid'|'wide', zone: 'row:id', sub: bool, title: bool} */
  function card(item, opts) {
    opts = opts || {};
    var size = opts.size || 'poster';
    var c = el('div', 'mb-card mb-card--' + size);
    focusable(c, (opts.zone || 'z') + '|' + item.key);
    c.setAttribute('data-key', item.key);
    c.__item = item;
    var art = el('div', 'mb-card-art', null, c);
    var ph = el('div', 'mb-card-ph', null, art);
    el('span', 'mb-card-ph-title', item.title || '', ph);
    var src = size === 'wide' ? (item.backdrop || item.poster) : (item.poster || item.backdrop);
    img(src, { cls: 'mb-card-img', parent: art, w: cardWidth(size) });
    /* Landscape cards carry their title on the art (their row hides the title line below the card). */
    if (size === 'wide') el('div', 'mb-card-label', item.title || '', art);
    var badge = badgeText(item);
    if (badge && size !== 'wide') el('span', 'mb-card-badge', badge, art);
    if (typeof item.progress === 'number' && item.progress >= 0) {
      var shade = el('div', 'mb-card-shade', null, art);
      if (item.progressLabel) el('span', 'mb-card-plabel', item.progressLabel, shade);
      progressBar(item.progress, shade);
    }
    if (opts.title !== false) el('div', 'mb-card-title', item.title || '', c);
    if (opts.sub) {
      var sub = [];
      if (item.update) sub.push(item.update);
      else if (item.year) sub.push(item.year);
      if (item.rating) sub.push(item.rating);
      if (sub.length) {
        var s = el('div', 'mb-card-sub', null, c);
        el('span', null, sub[0], s);
        if (sub[1]) { s.appendChild(Icons.el('star', 'mb-card-star')); el('span', null, sub[1], s); }
      }
    }
    return c;
  }

  /* Fills in a title learned later (for example a Featured banner whose page was fetched on focus). */
  function setCardTitle(c, title) {
    title = U.text(title);
    if (!c || !title) return;
    if (c.__item) c.__item.title = title;
    U.each(U.qsa(c, '.mb-card-ph-title, .mb-card-title, .mb-card-label'), function (n) { n.textContent = title; });
  }

  /* "See all" tile at the end of a row. */
  function moreTile(zoneName, label, size) {
    var c = el('div', 'mb-card mb-card--' + (size || 'poster') + ' mb-card--more');
    focusable(c, zoneName + '|more', 'more');
    var art = el('div', 'mb-card-art', null, c);
    var inner = el('div', 'mb-more-inner', null, art);
    inner.appendChild(Icons.el('chevronRight', 'mb-more-ico'));
    el('span', 'mb-more-label', label || 'See all', inner);
    el('div', 'mb-card-title', '', c);
    return c;
  }

  function chip(label, opts) {
    opts = opts || {};
    var c = el('div', 'mb-chip' + (opts.cls ? ' ' + opts.cls : ''));
    focusable(c, opts.key || 'chip|' + label, opts.action);
    if (opts.icon) c.appendChild(Icons.el(opts.icon, 'mb-chip-ico'));
    el('span', 'mb-chip-label', label, c);
    if (opts.parent) opts.parent.appendChild(c);
    return c;
  }

  function spinner(parent, cls) {
    var s = el('div', 'mb-spinner' + (cls ? ' ' + cls : ''), null, parent);
    el('div', 'mb-spinner-ring', null, s);
    return s;
  }

  function monogram(parent, cls) {
    var m = el('div', 'mb-mono' + (cls ? ' ' + cls : ''), null, parent);
    el('span', 'mb-mono-m', 'M', m);
    return m;
  }

  function skeletonCards(parent, n, size) {
    for (var i = 0; i < n; i++) {
      var c = el('div', 'mb-card mb-card--' + (size || 'poster') + ' mb-card--skel', null, parent);
      el('div', 'mb-card-art mb-skel', null, c);
      if (size !== 'wide-plain') el('div', 'mb-skel mb-skel-line', null, c);
    }
  }

  function transform(node, value) {
    if (!node) return;
    node.style.webkitTransform = value;
    node.style.transform = value;
  }

  function setX(node, x) {
    x = Math.round(x);
    if (node.__x === x) return;
    node.__x = x;
    transform(node, 'translate3d(' + x + 'px,0,0)');
  }

  function setY(node, y) {
    y = Math.round(y);
    if (node.__y === y) return;
    node.__y = y;
    transform(node, 'translate3d(0,' + y + 'px,0)');
  }

  /* Layout offset of el inside container (independent of the container's own transform). */
  function offsetIn(node, container) {
    var a = node.getBoundingClientRect(), b = container.getBoundingClientRect();
    return { top: a.top - b.top, left: a.left - b.left, height: a.height, width: a.width };
  }

  /* A track's padding, read once per viewport width (a computed-style read on every key press costs TV CPUs time). */
  function trackPad(track) {
    var vw = window.innerWidth || 0, p = track.__mbPad;
    if (!p || p.vw !== vw) {
      var cs = window.getComputedStyle(track);
      p = track.__mbPad = { vw: vw, l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
    }
    return p;
  }

  /* Horizontal rows: the focused card sits at the row's content start, clamped at both ends. */
  function scrollTrack(track, node) {
    var view = track.parentNode;
    if (!view || !node || node.parentNode !== track) return;
    var pad = trackPad(track), padL = pad.l, padR = pad.r;
    var last = track.lastElementChild || track.lastChild;
    var total = last ? last.offsetLeft + last.offsetWidth + padR : 0;
    var max = Math.max(0, total - view.clientWidth);
    var x = U.clamp(node.offsetLeft - padL, 0, max);
    setX(track, -x);
  }

  /* Vertical reveal: keeps node inside [topPad, viewport - bottomPad]. */
  function reveal(scroller, viewport, node, topPad, bottomPad) {
    var cur = -(scroller.__y || 0);
    var off = offsetIn(node, scroller);
    var vh = viewport.clientHeight;
    var y = cur;
    if (off.top - cur < topPad) y = off.top - topPad;
    else if (off.top + off.height - cur > vh - bottomPad) y = off.top + off.height - (vh - bottomPad);
    var max = Math.max(0, scroller.offsetHeight - vh + bottomPad);
    y = U.clamp(y, 0, max);
    setY(scroller, -y);
    return y;
  }

  /* The root's em in px (0.8333vw), read once per viewport width. */
  var emCache = { vw: -1, px: 0 };
  function em() {
    var vw = window.innerWidth || 0;
    if (emCache.vw === vw && emCache.px) return emCache.px;
    var r = document.getElementById('mbptv');
    var fs = r ? parseFloat(window.getComputedStyle(r).fontSize) : 0;
    if (fs) emCache = { vw: vw, px: fs };
    return fs || (vw || 1920) * 0.008333;
  }

  return {
    el: el, focusable: focusable, zone: zone, button: button, setLabel: setLabel, img: img, loadNow: loadNow,
    imgUrl: imgUrl, backdrop: backdrop, cardWidth: cardWidth, perf: perf, isTV: isTV, timing: timing,
    safeImage: safeImage, lazyCheck: lazyCheck, lazySoon: lazySoon, fmtRuntime: fmtRuntime, metaLine: metaLine,
    genresText: genresText, progressBar: progressBar, card: card, setCardTitle: setCardTitle, moreTile: moreTile, chip: chip, spinner: spinner,
    monogram: monogram, skeletonCards: skeletonCards, transform: transform, setX: setX, setY: setY, offsetIn: offsetIn,
    scrollTrack: scrollTrack, reveal: reveal, em: em
  };
}());

/* Focus engine: zones (data-zone) hold focusables (data-f). Linear zones move by sibling, geometric zones by
   nearest-in-direction; leaving a zone picks the nearest zone in that direction and restores its remembered item. */
var Focus = (function () {
  var cur = null, scopeFn = null, changeFn = null, exitFn = null;
  var H = /^(row|tabs|hero|dialog|buttons|seasons|chips-h)(:|$)/, V = /^(rail|list|sheet|menu|suggestions)(:|$)/;

  function configure(opts) {
    scopeFn = opts.scope || scopeFn;
    changeFn = opts.change || changeFn;
    exitFn = opts.exit || exitFn;
  }

  function attached(node) { return !!node && node.nodeType === 1 && document.documentElement.contains(node); }

  function shown(node) {
    if (!attached(node)) return false;
    if (!(node.offsetWidth || node.offsetHeight)) return false;
    return !node.hasAttribute('data-disabled');
  }

  function scopes() {
    var s = scopeFn ? scopeFn() : [];
    return U.filter(s || [], function (n) { return attached(n); });
  }

  function inScopes(node, list) {
    for (var i = 0; i < list.length; i++) if (list[i] === node || list[i].contains(node)) return true;
    return false;
  }

  function zoneOf(node) { return U.closest(node, '[data-zone]'); }

  function zoneType(z) {
    if (!z) return 'g';
    var forced = z.getAttribute('data-zone-type');
    if (forced) return forced;
    var name = z.getAttribute('data-zone') || '';
    if (H.test(name)) return 'h';
    if (V.test(name)) return 'v';
    return 'g';
  }

  function items(z) {
    return U.filter(U.qsa(z, '[data-f]'), function (n) { return zoneOf(n) === z && shown(n); });
  }

  function rect(node) { return node.getBoundingClientRect(); }
  function cx(r) { return r.left + r.width / 2; }
  function cy(r) { return r.top + r.height / 2; }

  function gap(a1, a2, b1, b2) { return b2 < a1 ? a1 - b2 : b1 > a2 ? b1 - a2 : 0; }

  /* Left/Right only consider candidates that share the current line (vertical overlap): moving sideways never jumps
     to another line of a zone, so Right at the end of a line (or from the keyboard's wide bottom keys) leaves the
     zone instead of landing on a key above it. */
  function nearest(from, list, dir) {
    var c = rect(from), best = null, bestScore = Infinity;
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n === from) continue;
      var r = rect(n), primary, secondary;
      if (dir === 'right') { if (cx(r) <= cx(c) + 1 || r.left < c.left + c.width * 0.5 || gap(c.top, c.bottom, r.top, r.bottom) > 0) continue; primary = Math.max(0, r.left - c.right); secondary = Math.abs(cy(r) - cy(c)) * 0.5; }
      else if (dir === 'left') { if (cx(r) >= cx(c) - 1 || r.right > c.right - c.width * 0.5 || gap(c.top, c.bottom, r.top, r.bottom) > 0) continue; primary = Math.max(0, c.left - r.right); secondary = Math.abs(cy(r) - cy(c)) * 0.5; }
      else if (dir === 'down') { if (cy(r) <= cy(c) + 1 || r.top < c.top + c.height * 0.5) continue; primary = Math.max(0, r.top - c.bottom); secondary = gap(c.left, c.right, r.left, r.right) * 3 + Math.abs(cx(r) - cx(c)) * 0.5; }
      else { if (cy(r) >= cy(c) - 1 || r.bottom > c.bottom - c.height * 0.5) continue; primary = Math.max(0, c.top - r.bottom); secondary = gap(c.left, c.right, r.left, r.right) * 3 + Math.abs(cx(r) - cx(c)) * 0.5; }
      var score = primary + secondary;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  function zonesIn(list, except) {
    var out = [];
    U.each(list, function (s) {
      if (s.hasAttribute && s.hasAttribute('data-zone') && s !== except) out.push(s);
      U.each(U.qsa(s, '[data-zone]'), function (z) { if (z !== except && shown(z)) out.push(z); });
    });
    return out;
  }

  function enter(z, dir, fromRect) {
    var list = items(z);
    if (!list.length) return null;
    var last = z.__mbLast, type = zoneType(z);
    if (last && U.indexOf(list, last) >= 0) {
      if (type !== 'g') return last;
      var lr = rect(last), vh = window.innerHeight, vw = window.innerWidth;
      if (lr.bottom > 0 && lr.top < vh && lr.right > 0 && lr.left < vw) return last;
    }
    if (!fromRect) return list[0];
    /* Geometric zones: enter on the edge facing us. Linear zones: nearest along the cross axis. */
    var best = null, bestScore = Infinity, edge = Infinity, i, r;
    if (type === 'g') {
      for (i = 0; i < list.length; i++) {
        r = rect(list[i]);
        var e = dir === 'down' ? r.top : dir === 'up' ? -r.bottom : dir === 'right' ? r.left : -r.right;
        if (e < edge) edge = e;
      }
    }
    for (i = 0; i < list.length; i++) {
      r = rect(list[i]);
      if (type === 'g') {
        var e2 = dir === 'down' ? r.top : dir === 'up' ? -r.bottom : dir === 'right' ? r.left : -r.right;
        if (e2 > edge + r.height * 0.5 && (dir === 'down' || dir === 'up')) continue;
        if (e2 > edge + r.width * 0.5 && (dir === 'left' || dir === 'right')) continue;
      }
      var score = (dir === 'down' || dir === 'up') ? Math.abs(cx(r) - cx(fromRect)) : Math.abs(cy(r) - cy(fromRect));
      if (score < bestScore - 0.5) { bestScore = score; best = list[i]; }
    }
    return best || list[0];
  }

  function exitZone(from, z, dir, list) {
    if (exitFn) {
      var forced = exitFn(from, z, dir);
      if (forced === false) return null;
      if (forced && forced.nodeType === 1) return forced;
    }
    if (z && z.getAttribute('data-exit-' + dir) === 'none') return null;
    var c = rect(from), best = null, bestScore = Infinity;
    var zones = zonesIn(list, z);
    for (var i = 0; i < zones.length; i++) {
      var zz = zones[i];
      if (z && (zz.contains(z) || z.contains(zz))) continue;
      if (!items(zz).length) continue;
      var r = rect(zz), primary, secondary;
      if (dir === 'down') { if (r.top < c.top + c.height * 0.5) continue; primary = Math.max(0, r.top - c.bottom); secondary = gap(c.left, c.right, r.left, r.right); }
      else if (dir === 'up') { if (r.bottom > c.bottom - c.height * 0.5) continue; primary = Math.max(0, c.top - r.bottom); secondary = gap(c.left, c.right, r.left, r.right); }
      else if (dir === 'right') { if (r.left < c.left + c.width * 0.5) continue; primary = Math.max(0, r.left - c.right); secondary = gap(c.top, c.bottom, r.top, r.bottom); }
      else { if (r.right > c.right - c.width * 0.5) continue; primary = Math.max(0, c.left - r.right); secondary = gap(c.top, c.bottom, r.top, r.bottom); }
      var score = primary + secondary * 2;
      if (score < bestScore) { bestScore = score; best = zz; }
    }
    return best ? enter(best, dir, c) : null;
  }

  function set(node, info) {
    if (!node || node.nodeType !== 1) return false;
    var prev = cur;
    if (prev && prev !== node) U.toggleClass(prev, 'is-focused', false);
    cur = node;
    U.toggleClass(node, 'is-focused', true);
    try { node.focus({ preventScroll: true }); } catch (e) { try { node.focus(); } catch (e2) {} }
    unscroll(node);
    var z = zoneOf(node);
    if (z) z.__mbLast = node;
    if (changeFn) changeFn(node, prev, info || {});
    return true;
  }

  /* Browsers scroll overflow:hidden ancestors to reveal a focused element; our layout scrolls by transform only. */
  function unscroll(node) {
    var root = document.getElementById('mbptv');
    for (var p = node.parentNode; p && p.nodeType === 1; p = p.parentNode) {
      if (p.scrollTop) p.scrollTop = 0;
      if (p.scrollLeft) p.scrollLeft = 0;
      if (p === root) break;
    }
  }

  /* Poster grids ([data-zone="grid"]) navigate by index and column (section 6.3), from a cached item list, so a key
     press costs the same with 40 or 600 loaded titles. The cache is rebuilt when the grid's children change, when the
     focused card is not where the cache says, or when the viewport width changes. */
  function isGrid(z) { return !!z && z.getAttribute('data-zone') === 'grid'; }

  function gridCache(z, node) {
    var c = z.__mbGrid, vw = window.innerWidth || 0;
    if (c && c.n === z.childNodes.length && c.first === z.firstChild && c.last === z.lastChild &&
        (!node || c.list[node.__mbIdx] === node)) {
      if (c.vw !== vw) { c.vw = vw; c.cols = 0; }
      return c;
    }
    var list = items(z);
    for (var i = 0; i < list.length; i++) list[i].__mbIdx = i;
    c = z.__mbGrid = { n: z.childNodes.length, first: z.firstChild, last: z.lastChild, list: list, cols: 0, vw: vw };
    return c;
  }

  function gridCols(c) {
    if (!c.cols) {
      var list = c.list, top0 = list.length ? list[0].offsetTop : 0, k = 0;
      while (k < list.length && list[k].offsetTop === top0) k++;
      c.cols = Math.max(1, k);
    }
    return c.cols;
  }

  function gridStep(z, node, dir) {
    var c = gridCache(z, node), list = c.list, i = node.__mbIdx;
    if (list[i] !== node) return nearest(node, list, dir);
    var cols = gridCols(c), n = list.length, row = Math.floor(i / cols);
    if (dir === 'right') return i + 1 < n && Math.floor((i + 1) / cols) === row ? list[i + 1] : null;
    if (dir === 'left') return i % cols > 0 ? list[i - 1] : null;
    if (dir === 'up') return i - cols >= 0 ? list[i - cols] : null;
    if (i + cols < n) return list[i + cols];
    return row < Math.floor((n - 1) / cols) ? list[n - 1] : null;
  }

  /* {index, count} of a card in its grid (from the cache), or null. */
  function gridInfo(node) {
    var z = zoneOf(node);
    if (!isGrid(z)) return null;
    var c = gridCache(z, node);
    return c.list[node.__mbIdx] === node ? { index: node.__mbIdx, count: c.list.length } : null;
  }

  function move(dir) {
    var list = scopes();
    if (!list.length) return false;
    if (!cur || !shown(cur) || !inScopes(cur, list)) return false;
    var z = zoneOf(cur), type = zoneType(z), next = null;
    if (z && type === 'h' && (dir === 'left' || dir === 'right')) {
      var li = items(z), i = U.indexOf(li, cur);
      next = li[i + (dir === 'right' ? 1 : -1)] || null;
    } else if (z && type === 'v' && (dir === 'up' || dir === 'down')) {
      var lv = items(z), j = U.indexOf(lv, cur);
      next = lv[j + (dir === 'down' ? 1 : -1)] || null;
    } else if (z && type === 'g' && isGrid(z)) {
      next = gridStep(z, cur, dir);
      if (next && !shown(next)) next = nearest(cur, items(z), dir);
    } else if (z && type === 'g') {
      next = nearest(cur, items(z), dir);
    }
    if (!next) next = exitZone(cur, z, dir, list);
    if (!next && !z) {
      var all = [];
      U.each(list, function (s) { U.each(U.qsa(s, '[data-f]'), function (n) { if (shown(n)) all.push(n); }); });
      next = nearest(cur, all, dir);
    }
    if (!next) return false;
    return set(next, { dir: dir });
  }

  function current() { return attached(cur) ? cur : null; }

  function keyOf(node) {
    if (!node) return '';
    return node.getAttribute('data-fk') || node.getAttribute('data-key') || node.getAttribute('data-action') || '';
  }

  function byKey(scope, key) {
    if (!scope || !key) return null;
    var list = U.qsa(scope, '[data-f]');
    for (var i = 0; i < list.length; i++) if (keyOf(list[i]) === key && shown(list[i])) return list[i];
    return null;
  }

  function firstIn(scope) {
    var list = U.qsa(scope, '[data-f]');
    for (var i = 0; i < list.length; i++) if (shown(list[i])) return list[i];
    return null;
  }

  function valid() {
    var list = scopes();
    return !!(cur && shown(cur) && inScopes(cur, list));
  }

  function blur() {
    if (cur) U.toggleClass(cur, 'is-focused', false);
    cur = null;
  }

  return {
    configure: configure, set: set, move: move, current: current, keyOf: keyOf, byKey: byKey, firstIn: firstIn,
    valid: valid, blur: blur, zoneOf: zoneOf, items: items, shown: shown, enter: enter, gridInfo: gridInfo
  };
}());
