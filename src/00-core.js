/* Core utilities shared by every module. ES5 only; nothing here touches the DOM at load time. */
var U = (function () {
  var slice = Array.prototype.slice;

  function text(value) {
    return String(value == null ? '' : value).replace(/[\s ]+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function toArray(list) {
    if (!list) return [];
    try { return slice.call(list); } catch (e) {
      var out = [], i;
      for (i = 0; i < list.length; i++) out.push(list[i]);
      return out;
    }
  }

  function each(list, fn) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) if (fn(list[i], i) === false) return;
  }

  function map(list, fn) {
    var out = [];
    each(list, function (v, i) { out.push(fn(v, i)); });
    return out;
  }

  function filter(list, fn) {
    var out = [];
    each(list, function (v, i) { if (fn(v, i)) out.push(v); });
    return out;
  }

  function find(list, fn) {
    var hit = null;
    each(list, function (v, i) { if (fn(v, i)) { hit = v; return false; } });
    return hit;
  }

  function indexOf(list, value) {
    if (!list) return -1;
    for (var i = 0; i < list.length; i++) if (list[i] === value) return i;
    return -1;
  }

  function contains(str, part) { return String(str).indexOf(part) >= 0; }

  function matches(el, selector) {
    if (!el || el.nodeType !== 1) return false;
    var fn = el.matches || el.webkitMatchesSelector || el.msMatchesSelector;
    try { return !!(fn && fn.call(el, selector)); } catch (e) { return false; }
  }

  function closest(el, selector, stop) {
    while (el && el.nodeType === 1 && el !== stop) {
      if (matches(el, selector)) return el;
      el = el.parentNode;
    }
    return null;
  }

  /* A missing root yields nothing (never the live document), so a detached or not-yet-built scope cannot leak
     matches from elsewhere on the page. Pass document explicitly to search the page. */
  function qs(root, selector) {
    if (!root || !root.querySelector) return null;
    try { return root.querySelector(selector); } catch (e) { return null; }
  }

  function qsa(root, selector) {
    if (!root || !root.querySelectorAll) return [];
    try { return toArray(root.querySelectorAll(selector)); } catch (e) { return []; }
  }

  function el(tag, cls, content, parent) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content != null && content !== '') node.textContent = String(content);
    if (parent) parent.appendChild(node);
    return node;
  }

  function attr(node, name, value) {
    if (!node) return '';
    if (arguments.length > 2) {
      if (value == null || value === false) node.removeAttribute(name);
      else node.setAttribute(name, value === true ? '' : String(value));
      return node;
    }
    return node.getAttribute(name) || '';
  }

  function empty(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function detach(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function hasClass(node, cls) {
    return !!node && node.nodeType === 1 && (' ' + node.className + ' ').indexOf(' ' + cls + ' ') >= 0;
  }

  function toggleClass(node, cls, on) {
    if (!node || !node.classList) return;
    if (on) node.classList.add(cls); else node.classList.remove(cls);
  }

  function guard(fn, label) {
    return function () {
      try { return fn.apply(this, arguments); } catch (e) {
        Log.error(label || 'guard', e);
        return undefined;
      }
    };
  }

  function on(target, type, fn, capture) {
    if (!target || !target.addEventListener) return function () {};
    var wrapped = guard(fn, 'event:' + type);
    target.addEventListener(type, wrapped, !!capture);
    return function () { target.removeEventListener(type, wrapped, !!capture); };
  }

  function later(fn, ms, label) {
    return setTimeout(guard(fn, label || 'timer'), ms || 0);
  }

  function debounce(fn, ms) {
    var timer = null;
    var wrapped = function () {
      var self = this, args = arguments;
      clearTimeout(timer);
      timer = later(function () { fn.apply(self, args); }, ms, 'debounce');
    };
    wrapped.cancel = function () { clearTimeout(timer); };
    return wrapped;
  }

  var raf = (typeof window !== 'undefined' && (window.requestAnimationFrame || window.webkitRequestAnimationFrame)) ||
    function (cb) { return setTimeout(function () { cb(+new Date()); }, 16); };

  function frame(fn, label) { return raf.call(window, guard(fn, label || 'frame')); }

  function now() { return +new Date(); }

  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

  function titleCase(str) {
    return text(str).toLowerCase().replace(/(^|[\s\-\/(&])([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); })
      .replace(/\bTv\b/g, 'TV').replace(/\bSci-Fi\b/g, 'Sci-Fi');
  }

  function parseUrl(url, base) {
    var a = anchorFor(base);
    a.href = String(url == null ? '' : url);
    var search = a.search || '', query = {};
    if (search.length > 1) {
      each(search.slice(1).split('&'), function (pair) {
        if (!pair) return;
        var i = pair.indexOf('='), k = i < 0 ? pair : pair.slice(0, i), v = i < 0 ? '' : pair.slice(i + 1);
        try { k = decodeURIComponent(k.replace(/\+/g, ' ')); v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) {}
        if (!(k in query)) query[k] = v;
      });
    }
    var pathname = a.pathname || '/';
    if (pathname.charAt(0) !== '/') pathname = '/' + pathname;
    return {
      href: a.href, protocol: a.protocol, host: a.host, hostname: (a.hostname || '').toLowerCase(),
      pathname: pathname, search: search, hash: a.hash || '', query: query,
      origin: a.protocol + '//' + a.host
    };
  }

  /* One resolver document per base URL, capped so a long session never grows memory without limit. */
  var anchorCache = {}, anchorCount = 0, ANCHOR_MAX = 24;
  function anchorFor(base) {
    if (!base) {
      if (!anchorCache['']) anchorCache[''] = document.createElement('a');
      return anchorCache[''];
    }
    var k = '$' + base;
    if (!anchorCache.hasOwnProperty(k)) {
      if (anchorCount >= ANCHOR_MAX) { anchorCache = { '': anchorCache[''] }; anchorCount = 0; }
      var doc = document.implementation.createHTMLDocument('');
      var b = doc.createElement('base'); b.href = base; doc.head.appendChild(b);
      anchorCache[k] = doc.createElement('a');
      doc.body.appendChild(anchorCache[k]);
      anchorCount++;
    }
    return anchorCache[k];
  }

  function abs(url, base) { return parseUrl(url, base).href; }

  function siteHost(hostname) { return String(hostname || '').toLowerCase().replace(/^www\./, ''); }

  function sameSite(url) {
    var u = parseUrl(url);
    return /^https?:$/.test(u.protocol) && siteHost(u.hostname) === siteHost(location.hostname);
  }

  function isVisible(node) {
    if (!node || node.nodeType !== 1 || !document.documentElement.contains(node)) return false;
    var r = node.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (var p = node; p && p.nodeType === 1; p = p.parentNode) {
      var s = window.getComputedStyle(p);
      if (!s || s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    }
    return true;
  }

  function parseHTML(markup) {
    var doc = null;
    try { doc = new DOMParser().parseFromString(String(markup || ''), 'text/html'); } catch (e) { doc = null; }
    if (!doc || !doc.documentElement) {
      doc = document.implementation.createHTMLDocument('');
      doc.documentElement.innerHTML = String(markup || '');
    }
    return doc;
  }

  function parseJSON(str) {
    try { return JSON.parse(str); } catch (e) { return null; }
  }

  /* Runs fn once the live DOM is fully parsed (the shell may boot while the page is still loading). */
  function onReady(fn) {
    var ran = false, wrapped = guard(function () { if (!ran) { ran = true; fn(); } }, 'ready');
    if (document.readyState !== 'loading') { later(wrapped, 0, 'ready'); return; }
    document.addEventListener('DOMContentLoaded', wrapped, false);
    document.addEventListener('readystatechange', function () { if (document.readyState !== 'loading') wrapped(); }, false);
  }

  /* Static, author-written SVG only. Never pass site data here. */
  function svg(markup, cls) {
    var holder = document.createElement('span');
    holder.className = 'mb-ico' + (cls ? ' ' + cls : '');
    holder.innerHTML = markup;
    holder.setAttribute('aria-hidden', 'true');
    return holder;
  }

  function xhr(opts, cb) {
    var done = false, req = new XMLHttpRequest(), timer;
    function finish(err, res) {
      if (done) return;
      done = true; clearTimeout(timer);
      later(function () { cb(err, res); }, 0, 'xhr-cb');
    }
    try {
      req.open(opts.method || 'GET', opts.url, true);
      req.withCredentials = true;
      if (opts.headers) for (var k in opts.headers) if (opts.headers.hasOwnProperty(k)) req.setRequestHeader(k, opts.headers[k]);
      req.onreadystatechange = function () {
        if (req.readyState !== 4 || done) return;
        var text = '';
        try { text = req.responseText; } catch (e0) { text = ''; }
        if (req.status >= 200 && req.status < 400) finish(null, { text: text, status: req.status, url: req.responseURL || opts.url });
        else finish({ code: req.status ? 'http-' + req.status : 'network', status: req.status }, null);
      };
      /* Report the timeout before abort(): abort() fires readystatechange with status 0, which would read as 'network'. */
      timer = setTimeout(function () { finish({ code: 'timeout' }, null); try { req.abort(); } catch (e) {} }, opts.timeout || 15000);
      req.send(opts.body || null);
    } catch (e) {
      finish({ code: 'exception', message: String(e && e.message || e) }, null);
    }
    return { abort: function () { if (!done) { done = true; clearTimeout(timer); try { req.abort(); } catch (e) {} } } };
  }

  return {
    text: text, toArray: toArray, each: each, map: map, filter: filter, find: find, indexOf: indexOf, contains: contains,
    matches: matches, closest: closest, qs: qs, qsa: qsa, el: el, attr: attr, empty: empty, detach: detach,
    hasClass: hasClass, toggleClass: toggleClass, guard: guard, on: on, later: later, debounce: debounce,
    frame: frame, now: now, clamp: clamp, titleCase: titleCase, parseUrl: parseUrl, abs: abs, siteHost: siteHost,
    sameSite: sameSite, isVisible: isVisible, parseHTML: parseHTML, parseJSON: parseJSON, onReady: onReady, svg: svg, xhr: xhr
  };
}());

var Store = (function () {
  function make(kind) {
    var memory = {};
    function backend() {
      try { var s = window[kind]; if (s) { s.getItem('mbptv:probe'); return s; } } catch (e) {}
      return null;
    }
    return {
      /* This page's own writes win (they are always in memory, even when the storage write failed on quota);
         anything else comes from storage, written by an earlier page load. */
      get: function (key, fallback) {
        var s = backend(), raw = null;
        if (memory.hasOwnProperty(key)) raw = memory[key];
        else { try { raw = s ? s.getItem(key) : null; } catch (e) { raw = null; } }
        if (raw == null) return fallback;
        var value = U.parseJSON(raw);
        return value == null ? fallback : value;
      },
      set: function (key, value) {
        var raw = JSON.stringify(value);
        memory[key] = raw;
        var s = backend();
        try { if (s) s.setItem(key, raw); } catch (e) { /* quota or private mode: memory copy remains */ }
      },
      remove: function (key) {
        memory[key] = null;
        var s = backend();
        try { if (s) s.removeItem(key); } catch (e) {}
      }
    };
  }
  return { local: make('localStorage'), session: make('sessionStorage') };
}());

var Log = (function () {
  var entries = [], KEY = 'mbptv:log:v1', persisted = null;
  function describe(value) {
    if (value == null) return '';
    if (value.stack) return String(value.message || value) + ' @ ' + String(value.stack).split('\n').slice(0, 3).join(' | ');
    if (typeof value === 'object') { try { return JSON.stringify(value).slice(0, 400); } catch (e) {} }
    return String(value).slice(0, 400);
  }
  function add(level, label, value) {
    var entry = { t: U.now(), level: level, label: String(label || ''), msg: describe(value) };
    entries.push(entry);
    if (entries.length > 200) entries.shift();
    try {
      if (persisted == null) persisted = Store.local.get(KEY, []) || [];
      persisted.push(entry);
      if (persisted.length > 60) persisted = persisted.slice(persisted.length - 60);
      if (level !== 'info') Store.local.set(KEY, persisted);
    } catch (e) {}
    try { if (window.console && console[level === 'error' ? 'error' : 'log']) console[level === 'error' ? 'error' : 'log']('[MovieBox TV] ' + level + ' ' + entry.label + ': ' + entry.msg); } catch (e2) {}
    return entry;
  }
  return {
    info: function (label, v) { return add('info', label, v); },
    warn: function (label, v) { return add('warn', label, v); },
    error: function (label, v) { return add('error', label, v); },
    entries: function () { return entries.slice(); },
    persisted: function () { return (Store.local.get(KEY, []) || []).slice(); },
    clear: function () { entries = []; persisted = []; Store.local.remove(KEY); }
  };
}());

var Keys = (function () {
  var codes = {
    37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 10009: 'back', 27: 'back', 8: 'backspace',
    415: 'play', 19: 'pause', 10252: 'playpause', 413: 'stop', 417: 'ff', 412: 'rw',
    403: 'red', 404: 'green', 405: 'yellow', 406: 'blue', 457: 'info', 427: 'chup', 428: 'chdown', 9: 'tab',
    32: 'space', 179: 'playpause', 178: 'stop', 176: 'ff', 177: 'rw'
  };
  var names = {
    ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', Left: 'left', Up: 'up', Right: 'right', Down: 'down',
    Enter: 'enter', Escape: 'back', Esc: 'back', XF86Back: 'back', GoBack: 'back', BrowserBack: 'back', Backspace: 'backspace',
    MediaPlay: 'play', MediaPause: 'pause', MediaPlayPause: 'playpause', MediaStop: 'stop',
    MediaFastForward: 'ff', MediaRewind: 'rw', ColorF3Blue: 'blue', Info: 'info', ' ': 'space'
  };
  var TIZEN_KEYS = ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
    'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'Info', 'ChannelUp', 'ChannelDown',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  function name(event) {
    var code = event.keyCode || event.which || 0, key = event.key || '';
    if (codes[code]) return codes[code];
    if (names[key]) return names[key];
    if (code >= 48 && code <= 57 && !event.shiftKey) return 'digit';
    if (key && key.length === 1) return 'char';
    /* Chromium before 51 (Tizen 2017-2019) has no KeyboardEvent.key: letters arrive as bare key codes. */
    if ((!key || key === 'Unidentified') && code >= 65 && code <= 90 && !event.ctrlKey && !event.altKey && !event.metaKey) return 'char';
    return '';
  }

  function charOf(event) {
    var code = event.keyCode || event.which || 0, key = event.key || '';
    if (key && key.length === 1) return key;
    if (code >= 48 && code <= 57) return String.fromCharCode(code);
    if (code >= 65 && code <= 90) return String.fromCharCode(code).toLowerCase();
    return '';
  }

  function register() {
    try {
      if (!window.tizen || !tizen.tvinputdevice) return;
      U.each(TIZEN_KEYS, function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) {} });
    } catch (e) { Log.warn('keys', e); }
  }

  return { name: name, charOf: charOf, register: register };
}());
