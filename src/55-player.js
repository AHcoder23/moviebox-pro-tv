/* Native player (docs/PLAYER.md). Plays movies and episodes in our own full-screen <video>, through the same
   endpoints the website's player uses: the title page's file list (movies) or POST tv_file (episodes), then
   POST <oss_download_url>&jw..player=1 for the player data, which is read with regexes and never evaluated.
   Streams are tried in a platform-aware order with a per-candidate timeout; progress goes to the site's own
   progress endpoints, so Continue Watching and the website's resume points stay in sync. Stream URLs are signed,
   time-limited and account-bound: they are never logged or stored. Only NativePlayer is declared at top level
   and nothing runs at load time. */
var NativePlayer = (function () {
  var CFG = {
    requestTimeout: 15000, retryDelay: 700, candidateTimeout: 15000, stallTimeout: 15000, osdHide: 4000,
    progressEvery: 20000, seekApply: 400, seekReport: 1500, upNextLead: 25, upNextCount: 10, chipMs: 6000,
    startBudget: 60000, stillWatchingAfter: 3, repeatGap: 250
  };
  /* Held keys act once (the App's hold guard also swallows held OK/Back, including repeats that arrive after the
     player closed); arrows and FF/RW keep auto-repeat for seeking and sheet navigation. */
  var ONCE = { enter: 1, back: 1, backspace: 1, stop: 1, play: 1, pause: 1, playpause: 1, space: 1, chup: 1, chdown: 1, info: 1 };
  var PROGRESS_PATH = /^\/index\/index\/(?:tv|movie)_progress$/;
  var JW_FLAG = 'jw' + 'player=1'; /* the website's own "player data" flag (split so the site-globals lint scan skips it) */
  var FORM = 'application/x-www-form-urlencoded; charset=UTF-8';
  var MIME = { h264: 'video/mp4; codecs="avc1.640028"', hvc1: 'video/mp4; codecs="hvc1.1.6.L150.B0"', hev1: 'video/mp4; codecs="hev1.1.6.L150.B0"' };
  var SHEET_ORDER = ['AUTO', '1080p', '720p', '480p', '360p', 'ORG'];

  var gen = 0;        /* bumped by every session start and stop: callbacks from older sessions are dropped */
  var S = null;       /* the current session (one movie or one episode) */
  var ui = null;      /* the overlay DOM while the player is up */
  var saverOff = false;
  var unattended = 0; /* episodes started by autoplay since the viewer last pressed a key ("Still watching?") */

  /* ---------- icons (static, author-written SVG only) ---------- */

  var ICONS = {
    play: '<path d="M7.2 4.3v15.4c0 .8.9 1.3 1.6.9l12.1-7.7c.6-.4.6-1.4 0-1.8L8.8 3.4c-.7-.4-1.6.1-1.6.9z"/>',
    pause: '<path d="M6.5 4h3.6c.4 0 .7.3.7.7v14.6c0 .4-.3.7-.7.7H6.5c-.4 0-.7-.3-.7-.7V4.7c0-.4.3-.7.7-.7zm7.4 0h3.6c.4 0 .7.3.7.7v14.6c0 .4-.3.7-.7.7h-3.6c-.4 0-.7-.3-.7-.7V4.7c0-.4.3-.7.7-.7z"/>',
    next: '<path d="M4.6 5.1v13.8c0 .8.9 1.2 1.5.8l9.6-6.9c.5-.4.5-1.2 0-1.6L6.1 4.3c-.6-.4-1.5 0-1.5.8zM17 4.6h2.6v14.8H17z"/>',
    skip: '<path d="M3.5 5.4v13.2c0 .7.8 1.1 1.3.7l8.1-6.6c.4-.4.4-1 0-1.4L4.8 4.7c-.5-.4-1.3 0-1.3.7zm8.8 0v13.2c0 .7.8 1.1 1.3.7l8.1-6.6c.4-.4.4-1 0-1.4l-8.1-6.6c-.5-.4-1.3 0-1.3.7z"/>',
    restart: '<path d="M12 4.4V1.6L7.4 5.8 12 10V7a5.4 5.4 0 1 1-5.4 5.4H4a8 8 0 1 0 8-8z"/>',
    quality: '<path fill-rule="evenodd" d="M4.2 5h15.6c.7 0 1.2.5 1.2 1.2v11.6c0 .7-.5 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2V6.2C3 5.5 3.5 5 4.2 5zM5.2 7.2v9.6h13.6V7.2zM7 9h1.8v2.1h2V9h1.8v6h-1.8v-2.2h-2V15H7zm7 0h2.6c1.3 0 2.4 1.1 2.4 2.4v1.2c0 1.3-1.1 2.4-2.4 2.4H14zm1.8 1.7v2.6h.8c.4 0 .6-.3.6-.7v-1.2c0-.4-.2-.7-.6-.7z"/>',
    alert: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.3 4.8v7.4h2.6V6.8zM12 15.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>',
    check: '<path d="M9.4 16.4l-4.3-4.3-1.8 1.8 6.1 6.1L21 8.3l-1.8-1.8z"/>',
    globe: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.4 2.2A7.9 7.9 0 0 0 4.2 11h3.3c.1-2.6.9-5 3.1-6.8zm2.8 0c2.2 1.8 3 4.2 3.1 6.8h3.3a7.9 7.9 0 0 0-6.4-6.8zM12 4.6c-1.6 1.5-2.3 3.8-2.4 6.4h4.8c-.1-2.6-.8-4.9-2.4-6.4zM4.2 13a7.9 7.9 0 0 0 6.4 6.8c-2.2-1.8-3-4.2-3.1-6.8zm5.4 0c.1 2.6.8 4.9 2.4 6.4 1.6-1.5 2.3-3.8 2.4-6.4zm6.9 0c-.1 2.6-.9 5-3.1 6.8a7.9 7.9 0 0 0 6.4-6.8z"/>',
    back: '<path d="M10.9 5.2L4.1 12l6.8 6.8 1.7-1.7-3.9-3.9H20v-2.4H8.7l3.9-3.9z"/>',
    close: '<path d="M6.3 4.6L12 10.3l5.7-5.7 1.7 1.7-5.7 5.7 5.7 5.7-1.7 1.7-5.7-5.7-5.7 5.7-1.7-1.7 5.7-5.7-5.7-5.7z"/>',
    reload: '<path d="M12 4.2c2.2 0 4.2.9 5.6 2.4L20 4.2V11h-6.8l2.9-2.9A5.7 5.7 0 0 0 6.4 12H4.2A7.8 7.8 0 0 1 12 4.2zm7.8 7.8A7.8 7.8 0 0 1 6.4 17.4L4 19.8V13h6.8l-2.9 2.9a5.7 5.7 0 0 0 9.7-3.9z"/>'
  };

  function icon(name, cls) {
    return U.svg('<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
      (ICONS[name] || ICONS.alert) + '</svg>', 'mbp-ico' + (cls ? ' ' + cls : ''));
  }

  /* ---------- small helpers ---------- */

  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function isArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
  }

  function fmtDelta(d) {
    var a = Math.round(Math.abs(d));
    return (d < 0 ? '\u2212' : '+') + (a < 60 ? a + ' s' : fmt(a));
  }

  /* Log-safe text: anything URL-like is masked (stream URLs carry signed, account-bound tokens). */
  function clean(v) {
    var s = v && v.message ? String(v.message) : String(v == null ? '' : v);
    return s.replace(/(?:[a-z][a-z0-9+.\-]*:)?\/\/[^\s'"<>]+/gi, '<url>').slice(0, 200);
  }

  function el(tag, cls, text, parent) { return U.el(tag, cls, text, parent); }
  function setText(node, text) { text = String(text == null ? '' : text); if (node && node.textContent !== text) node.textContent = text; }
  function tf(node, value) { if (!node) return; node.style.webkitTransform = value; node.style.transform = value; }
  function flag(node, name, on) { U.toggleClass(node, name, !!on); }
  function safeImage(url) { return typeof url === 'string' && /^https?:\/\//i.test(url) && url.length < 2048; }
  /* Pictures at the size they are shown (the kit's sized URLs, when the kit is loaded). */
  function sized(url, w) { try { return typeof Kit !== 'undefined' && Kit.imgUrl ? Kit.imgUrl(url, w) : url; } catch (e) { return url; } }
  /* Shows img's picture at url, sized to w; a sized picture that fails falls back once to the original (retryOriginal). */
  function setArt(img, url, w) {
    var src = sized(url, w);
    img.__orig = src !== url ? url : '';
    if (img.getAttribute('src') !== src) { flag(img, 'is-loaded', false); img.src = src; }
  }
  function retryOriginal(img) {
    var o = img.__orig;
    img.__orig = '';
    if (!o || img.getAttribute('src') === o) return false;
    img.src = o;
    return true;
  }

  function hook(h, name) {
    var fn = h && h[name];
    if (typeof fn !== 'function') return;
    var args = Array.prototype.slice.call(arguments, 2);
    try { fn.apply(null, args); } catch (e) { Log.error('player-hook:' + name, e); }
  }

  function later(s, name, fn, ms) {
    if (!s) return;
    clearTimeout(s.timers[name]);
    s.timers[name] = U.later(function () { if (s === S && !s.finished) fn(); }, ms, 'player-' + name);
  }

  function cancel(s, name) { if (s && s.timers[name]) { clearTimeout(s.timers[name]); s.timers[name] = null; } }

  /* Wraps an async callback: dropped when its session is gone; a throw shows the error card instead of hanging. */
  function safe(s, fn, label) {
    return function () {
      if (s !== S || s.finished) return;
      try { fn.apply(null, arguments); } catch (e) {
        Log.error(label || 'player', e);
        if (s === S && !s.finished) showError(s, 'internal', 'Something went wrong while starting playback.');
      }
    };
  }

  /* ---------- platform ---------- */

  function isTV() {
    try { return /Tizen|SMART-TV|Web0S|NetCast/i.test(String(navigator.userAgent || '')) || !!window.tizen; } catch (e) { return false; }
  }

  /* The site appends audio=aac to HLS URLs on TVs: EAC3 audio stalls in native HLS. */
  function needsAac(tv) {
    if (tv) return true;
    try {
      var MS = window.MediaSource || window.WebKitMediaSource;
      if (MS && typeof MS.isTypeSupported === 'function') return !MS.isTypeSupported('audio/mp4; codecs="ec-3"');
    } catch (e) {}
    return true;
  }

  function canPlayProbe() {
    var probe = null;
    return function (mime) {
      try {
        if (!probe) probe = document.createElement('video');
        return probe.canPlayType ? String(probe.canPlayType(mime) || '') : '';
      } catch (e) { return ''; }
    };
  }

  function environment() { var tv = isTV(); return { tv: tv, aac: needsAac(tv), canPlay: canPlayProbe() }; }

  /* The app is in the background (Home button, input switch, another app on top). */
  function isHidden() {
    try { return !!document.hidden || document.visibilityState === 'hidden' || !!document.webkitHidden; } catch (e) { return false; }
  }

  /* ---------- player data parsing (regexes only; never evaluated) ---------- */

  function inComment(text, idx) {
    var pre = text.slice(text.lastIndexOf('\n', idx - 1) + 1, idx).replace(/^\s+/, '');
    if (pre.slice(0, 2) === '//' || pre.slice(0, 2) === '/*' || pre.charAt(0) === '*') return true;
    return /(^|[^:'"\\])\/\//.test(pre);
  }

  /* Index just after the first "var NAME =" that is not on a comment line, or -1. */
  function varAt(text, name) {
    var re = new RegExp('\\bvar\\s+' + name + '\\s*=\\s*', 'g'), m;
    while ((m = re.exec(text))) if (!inComment(text, m.index)) return m.index + m[0].length;
    return -1;
  }

  function unescapeJs(s) {
    return String(s).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, function (m, c) {
      if (c.length === 5 && c.charAt(0) === 'u') return String.fromCharCode(parseInt(c.slice(1), 16));
      if (c.length === 3 && c.charAt(0) === 'x') return String.fromCharCode(parseInt(c.slice(1), 16));
      return c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c;
    });
  }

  /* A quoted string, number or literal after "var NAME =", as a string; null when absent. */
  function scalar(text, name) {
    var at = varAt(text, name);
    if (at < 0) return null;
    var m = /^(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|(-?\d+(?:\.\d+)?)|(true|false|null))/.exec(text.slice(at, at + 4000));
    if (!m) return null;
    if (m[1] != null) return unescapeJs(m[1]);
    if (m[2] != null) return unescapeJs(m[2]);
    if (m[3] != null) return m[3];
    return m[4] === 'null' ? '' : m[4];
  }

  /* The balanced [...] or {...} starting at text[at], respecting quoted strings. */
  function balanced(text, at) {
    var depth = 0, quote = '', i, c, end = Math.min(text.length, at + 2000000);
    for (i = at; i < end; i++) {
      c = text.charAt(i);
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = '';
        continue;
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') { depth--; if (depth === 0) return text.slice(at, i + 1); }
    }
    return '';
  }

  function jsonVar(text, name) {
    var at = varAt(text, name);
    if (at < 0) return null;
    var c = text.charAt(at);
    if (c === '[' || c === '{') return U.parseJSON(balanced(text, at));
    if (c === "'" || c === '"') { var s = scalar(text, name); return s ? U.parseJSON(s) : null; }
    return null;
  }

  function normLabel(label, hls) {
    var l = U.text(label);
    if (/^org(?:inal)?$/i.test(l)) return 'ORG';
    if (/^auto$/i.test(l)) return 'AUTO';
    return l || (hls ? 'AUTO' : 'ORG');
  }

  function normSource(s) {
    if (!s || typeof s !== 'object') return null;
    var file = typeof s.file === 'string' ? U.text(s.file) : '';
    if (!file) return null;
    var abs = /^https?:\/\//i.test(file) ? file : (file.charAt(0) === '/' ? Site.resolve(file) : '');
    if (!abs || !/^https?:\/\//i.test(abs)) return null;
    var type = String(s.type || '');
    var hls = /mpegurl/i.test(type) || /\.m3u8(?:[?#]|$)/i.test(abs);
    return {
      label: normLabel(s.label, hls), src: abs, hls: hls, h265: toInt(s.h265) === 1, hdr: toInt(s.hdr) === 1,
      width: toInt(s.width), height: toInt(s.height), fps: num(s.fps)
    };
  }

  function parse(text) {
    var out = {
      ok: false, code: 0, msg: '', gate: false, sources: [], seconds: 0, mp4Id: '', next: null, tid: '', season: 0, episode: 0,
      skips: { start: -1, end: -1 }, post: null, progressUrl: ''
    };
    text = String(text == null ? '' : text);
    var head = text.replace(/^[\s\uFEFF]+/, '');
    if (head.charAt(0) === '{') {
      var j = U.parseJSON(head);
      if (j && typeof j === 'object' && !isArray(j)) {
        out.code = toInt(j.code);
        out.msg = U.text(j.msg || j.message || '');
        return out;
      }
    }
    if (varAt(text, 'sources') < 0 && /private\s+garden|login_btn|\/index\/login/i.test(text)) {
      try { out.gate = Site.isGate(U.parseHTML(text)); } catch (e) { out.gate = false; }
      if (out.gate) return out;
    }
    var list = jsonVar(text, 'sources');
    if (isArray(list)) U.each(list, function (s) { var n = normSource(s); if (n) out.sources.push(n); });
    out.seconds = Math.max(0, num(scalar(text, 'seconds')));
    out.mp4Id = String(scalar(text, 'mp4_id') || '').replace(/[^\d]/g, '');
    var ns = toInt(scalar(text, 'next_season')), ne = toInt(scalar(text, 'next_episode'));
    if (ns > 0 && ne > 0) out.next = { season: ns, episode: ne };
    out.tid = String(scalar(text, 'tid') || '').replace(/[^\d]/g, '');
    out.season = toInt(scalar(text, 'current_season'));
    out.episode = toInt(scalar(text, 'current_episode'));
    var sk = jsonVar(text, 'skips');
    if (sk && typeof sk === 'object' && !isArray(sk)) {
      out.skips.start = sk.start == null || sk.start === '' ? -1 : num(sk.start);
      out.skips.end = sk.end == null || sk.end === '' ? -1 : num(sk.end);
    }
    var post = jsonVar(text, 'post');
    if (post && typeof post === 'object' && !isArray(post)) {
      var clean2 = {}, n = 0;
      for (var k in post) {
        if (post.hasOwnProperty(k) && /^[\w\-]{1,40}$/.test(k) && (typeof post[k] === 'string' || typeof post[k] === 'number')) { clean2[k] = String(post[k]); n++; }
      }
      out.post = n ? clean2 : null;
    }
    var re = /\burl\s*:\s*["'](\/index\/index\/(?:tv|movie)_progress)["']/g, pm;
    while ((pm = re.exec(text))) { if (!inComment(text, pm.index)) { out.progressUrl = pm[1]; break; } }
    out.ok = out.sources.length > 0;
    return out;
  }

  /* ---------- stream order ---------- */

  function rank(label) { var m = /(\d{3,4})p/i.exec(String(label || '')); return m ? toInt(m[1]) : 0; }

  function withAac(u) {
    u = String(u || '');
    if (!u || /[?&]audio=aac(?:[&#]|$)/.test(u)) return u;
    var hash = '', i = u.indexOf('#');
    if (i >= 0) { hash = u.slice(i); u = u.slice(0, i); }
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'audio=aac' + hash;
  }

  function playable(s, env) {
    var cp = env && typeof env.canPlay === 'function' ? env.canPlay : function () { return ''; };
    if (s.h265) return !!(cp(MIME.hvc1) || cp(MIME.hev1));
    return !!cp(MIME.h264);
  }

  /* TV: AUTO HLS, then the MP4 files (ORG first), then the fixed HLS renditions from the highest down.
     Elsewhere: MP4s the browser says it can decode, AUTO, fixed HLS, then the remaining MP4s as a last resort. */
  function order(sources, env) {
    env = env || environment();
    var auto = [], org = [], mp4 = [], fixed = [], other = [];
    U.each(sources || [], function (s) {
      if (!s || !s.src) return;
      if (s.hls && s.label === 'AUTO') auto.push(s);
      else if (s.hls && rank(s.label)) fixed.push(s);
      else if (!s.hls && s.label === 'ORG') org.push(s);
      else if (!s.hls) mp4.push(s);
      else other.push(s);
    });
    fixed.sort(function (a, b) { return rank(b.label) - rank(a.label); });
    mp4 = org.concat(mp4);
    var list;
    if (env.tv) list = auto.concat(mp4, fixed, other);
    else {
      var yes = [], no = [];
      U.each(mp4, function (s) { if (playable(s, env)) yes.push(s); else no.push(s); });
      list = yes.concat(auto, fixed, other, no);
    }
    return U.map(list, function (s) {
      return { label: s.label, src: s.hls && env.aac ? withAac(s.src) : s.src, hls: !!s.hls, h265: !!s.h265, hdr: !!s.hdr,
        width: s.width || 0, height: s.height || 0, fps: s.fps || 0 };
    });
  }

  /* ---------- files ---------- */

  function filesIn(doc) {
    var out = [];
    U.each(U.qsa(doc, 'li[oss_download_url]'), function (li) {
      var url = U.text(li.getAttribute('oss_download_url') || '');
      if (!url) return;
      var s = Site.source(li, out.length);
      out.push({ index: out.length, url: url, quality: s.quality || '', file: s.file || '', size: s.size || '', date: s.date || '' });
    });
    return out;
  }

  function qrank(q) {
    q = String(q || '');
    if (/8k/i.test(q)) return 4320;
    if (/4k|2160/i.test(q)) return 2160;
    if (/1440/.test(q)) return 1440;
    if (/720/.test(q)) return 720;
    if (/\bsd\b|480|360/i.test(q)) return 480;
    return 1080;
  }

  /* req.fileIndex, else Prefs.quality: 'best' and 'ask' take the first listed file, 1080p/720p the closest match. */
  function chooseFile(files, req) {
    if (!files.length) return -1;
    var fi = parseInt(req.fileIndex, 10);
    if (!isNaN(fi) && fi >= 0 && fi < files.length) return fi;
    var q = '';
    try { q = typeof Prefs !== 'undefined' ? Prefs.get('quality') : ''; } catch (e) { q = ''; }
    if (q !== '1080p' && q !== '720p') return 0;
    var want = toInt(q), best = 0, bestD = Infinity;
    U.each(files, function (f, i) {
      var r = qrank(f.quality), d = Math.abs(r - want) + (r > want ? 0.5 : 0);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /* ---------- requests: timeout and one retry; session requests are aborted on stop ---------- */

  function retryable(err) { return !!err && (err.code === 'network' || err.code === 'timeout' || /^http-5\d\d$/.test(String(err.code || ''))); }

  function send(s, opts, cb, attempt) {
    attempt = attempt || 0;
    var h = U.xhr({
      method: 'POST', url: opts.url, body: opts.body || '', timeout: CFG.requestTimeout,
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': FORM, Accept: 'text/html, application/json, */*; q=0.01' }
    }, function (err, res) {
      if (s) { var i = U.indexOf(s.reqs, h); if (i >= 0) s.reqs.splice(i, 1); if (s !== S || s.finished) return; }
      if (err && attempt < 1 && retryable(err)) {
        Log.info('player', opts.label + ' ' + err.code + '; retrying');
        U.later(function () { if (s && (s !== S || s.finished)) return; send(s, opts, cb, attempt + 1); }, CFG.retryDelay, 'player-retry');
        return;
      }
      cb(err, res);
    });
    if (s) s.reqs.push(h);
    return h;
  }

  function origin() { return Site.url.origin(); }
  function enc(v) { return encodeURIComponent(String(v == null ? '' : v)); }

  function signedOutRes(res) {
    try { if (/\/index\/login(?:\/|$)/i.test(U.parseUrl(res && res.url || '').pathname)) return true; } catch (e) {}
    var t = String(res && res.text || '');
    if (!/private\s+garden|login_btn/i.test(t) || varAt(t, 'sources') >= 0) return false;
    try { return Site.isGate(U.parseHTML(t)); } catch (e2) { return false; }
  }

  function playerUrl(oss) {
    var abs = Site.resolve(String(oss || ''), origin() + '/');
    if (!abs || !U.sameSite(abs)) return '';
    return abs + (abs.indexOf('?') >= 0 ? '&' : '?') + JW_FLAG;
  }

  /* ---------- session lifecycle ---------- */

  function newSession(input, hooks) {
    var req = {}, k;
    for (k in input) if (input.hasOwnProperty(k)) req[k] = input[k];
    var kind = req.kind === 'tv' ? 'tv' : 'movie';
    return {
      gen: 0, req: req, hooks: hooks || {}, kind: kind, id: String(req.id == null ? '' : req.id).replace(/[^\d]/g, ''),
      /* Episode 0 is a special (S01E00 in the site's episode list), played only when asked for explicitly. */
      season: kind === 'tv' ? Math.max(1, toInt(req.season)) : 0,
      episode: kind === 'tv' ? (req.episode === 0 || req.episode === '0' ? 0 : Math.max(1, toInt(req.episode))) : 0,
      state: 'loading', data: null, files: [], fileIndex: -1, cands: [], base: [], ci: -1, tryId: 0, ready: false, started: false,
      playedTry: -1, blocked: false, userPaused: false, failed: {}, relinkAt: 0, relinking: false, playedSinceRelink: false, resumeAt: 0, errAt: 0,
      pendingAt: 0, resumePending: false, resumed: 0, lastTime: 0, lastDur: 0, lastSent: '', post: null, progressUrl: '', next: null,
      introEnd: 0, creditsAt: 0, osd: false, area: 'scrub', btn: 'play-pause', btnSig: '', seek: null, seekKey: null,
      upnext: null, dismissedNext: false, nextInfo: null, nextFetching: false, sheet: null, err: null, chipStartOver: false,
      buffering: false, waitAt: 0, switchNote: '', bgPaused: false, ended: false, lastRender: 0, timers: {}, reqs: [], offs: [], finished: false
    };
  }

  /* resumeAt (optional): start here instead of the site's saved position (Try again after a failure mid-film). */
  function begin(req, hooks, kicker, resumeAt) {
    gen++;
    var s = S = newSession(req, hooks);
    s.gen = gen;
    s.kicker = kicker || '';
    s.resumeAt = resumeAt > 0 ? resumeAt : 0;
    resetUi(s);
    Log.info('player', 'open ' + s.kind + ':' + s.id + (s.kind === 'tv' ? ' S' + s.season + 'E' + s.episode : ''));
    s.offs.push(U.on(window, 'pagehide', function () { if (s === S) report(s, 'pagehide'); }));
    s.offs.push(U.on(document, 'visibilitychange', function () {
      if (s !== S || s.finished) return;
      if (isHidden()) toBackground(s); else fromBackground(s);
    }));
    /* A hanging network must not keep the viewer on the loading screen for minutes (files + player data + every
       candidate could add up to about two): after startBudget the error card offers Try again and the website. */
    later(s, 'budget', function () {
      if (s.started || s.state !== 'loading' || s.blocked) return;
      Log.warn('player', 'no playback after ' + Math.round(CFG.startBudget / 1000) + ' s');
      showError(s, s.cands.length ? 'streams-failed' : 'network', 'MovieBox Pro is taking too long to start this video. Check your connection and try again.');
    }, CFG.startBudget);
    if (!s.id) { showError(s, 'bad-request', 'This title could not be identified.'); return; }
    if (req.fileUrl) { s.files = [{ index: 0, url: String(req.fileUrl), quality: '', file: '', size: '', date: '' }]; s.fileIndex = 0; loadPlayer(s, 0); return; }
    if (s.kind === 'tv') loadEpisodeFiles(s); else loadMovieFiles(s);
  }

  function loadMovieFiles(s) {
    setStatus(s, 'Getting the stream ready\u2026');
    Api.fetchDoc(Site.url.title('movie', s.id), safe(s, function (err, res) {
      if (err) { failed(s, err, 'files'); return; }
      s.files = filesIn(res.doc);
      Log.info('player', 'files ' + s.files.length);
      if (!s.files.length) { showError(s, 'no-files', 'MovieBox Pro has no playable files for this title yet.'); return; }
      s.fileIndex = chooseFile(s.files, s.req);
      loadPlayer(s, s.fileIndex);
    }, 'player-files'));
  }

  function loadEpisodeFiles(s) {
    setStatus(s, 'Getting the episode ready\u2026');
    var body = 'tid=' + enc(s.id) + '&season=' + s.season + '&episode=' + s.episode;
    send(s, { url: origin() + '/index/index/tv_file', body: body, label: 'tv_file' }, safe(s, function (err, res) {
      if (err) { failed(s, err, 'tv_file'); return; }
      if (signedOutRes(res)) { fallback(s, 'signed-out'); return; }
      var j = U.parseJSON(res.text);
      if (!j || typeof j !== 'object') { showError(s, 'bad-answer', 'MovieBox Pro sent an unexpected answer. Try again in a moment.'); return; }
      if (toInt(j.code) !== 1) {
        Log.warn('player', 'tv_file code ' + toInt(j.code));
        showError(s, 'site-error', U.text(j.msg) || 'This episode isn\u2019t available right now.', 'Code ' + toInt(j.code));
        return;
      }
      var html = j.data && typeof j.data.list === 'string' ? j.data.list : '';
      s.files = html ? filesIn(U.parseHTML('<ul>' + html + '</ul>')) : [];
      Log.info('player', 'episode files ' + s.files.length);
      if (!s.files.length) { showError(s, 'no-files', 'This episode has no playable files yet.'); return; }
      s.fileIndex = 0;
      loadPlayer(s, 0);
    }, 'player-tv-file'));
  }

  function fetchPlayerData(s, fileIndex, cb) {
    var f = s.files[fileIndex], url = f ? playerUrl(f.url) : '';
    if (!url) { cb({ code: 'bad-url' }, null); return; }
    send(s, { url: url, body: '', label: 'player' }, safe(s, function (err, res) {
      if (err) { cb(err, null); return; }
      if (signedOutRes(res)) { cb({ code: 'signed-out' }, null); return; }
      var d = parse(res.text);
      if (d.gate) { cb({ code: 'signed-out' }, null); return; }
      cb(null, d);
    }, 'player-data'));
  }

  function loadPlayer(s, fileIndex) {
    setStatus(s, 'Getting the stream ready\u2026');
    fetchPlayerData(s, fileIndex, function (err, d) {
      if (err) {
        if (err.code === 'bad-url') { showError(s, 'no-files', 'This file has an unexpected address.'); return; }
        failed(s, err, 'player');
        return;
      }
      if (!d.sources.length) {
        if (d.code && d.code !== 1) {
          Log.warn('player', 'player data code ' + d.code);
          showError(s, 'site-error', d.msg || 'MovieBox Pro can\u2019t play this title right now.', 'Code ' + d.code);
        } else {
          showError(s, 'streams-failed', 'MovieBox Pro didn\u2019t offer a stream for this title.');
        }
        return;
      }
      applyData(s, d);
      var at = s.resumeAt > 0 ? s.resumeAt : d.seconds;
      Log.info('player', 'player data: ' + d.sources.length + ' sources [' + U.map(d.sources, function (x) { return x.label; }).join(', ') + ']' +
        (s.next ? ', next S' + s.next.season + 'E' + s.next.episode : '') + (at ? ', resume ' + Math.round(at) : '') +
        (s.introEnd ? ', intro ' + Math.round(s.introEnd) : '') + (s.creditsAt ? ', credits ' + Math.round(s.creditsAt) : '') +
        ', order [' + U.map(s.cands, function (c) { return c.label; }).join(', ') + ']');
      /* The site's saved position follows the resume rules below; a continuation (Try again) goes back exactly. */
      s.resumePending = !(s.resumeAt > 0);
      startCandidate(s, 0, at, '');
    });
  }

  function fallbackPost(s) {
    return s.kind === 'tv' ? { type: 'tv', tid: s.id, season: String(s.season), episode: String(s.episode) } : { type: 'movie', mid: s.id };
  }

  function applyData(s, d) {
    s.data = d;
    if (s.kind === 'tv') {
      if (d.season > 0) s.season = d.season;
      if (d.episode > 0) s.episode = d.episode;
    }
    s.post = d.post || fallbackPost(s);
    s.progressUrl = PROGRESS_PATH.test(d.progressUrl) ? d.progressUrl : '/index/index/' + s.kind + '_progress';
    s.next = s.kind === 'tv' && d.next ? d.next : null;
    s.introEnd = d.skips.start > 0 ? d.skips.start : 0;
    s.creditsAt = d.skips.end > 0 ? d.skips.end : 0;
    s.cands = order(d.sources, environment());
    s.base = s.cands.slice();
    s.failed = {};
    if (!s.started) s.lastSent = Math.floor(d.seconds) + ':0';
    renderTitles(s);
    s.btnSig = '';
  }

  function failed(s, err, stage) {
    var code = err && err.code || 'error';
    Log.warn('player', stage + ' failed: ' + code);
    if (code === 'signed-out') { fallback(s, 'signed-out'); return; }
    var net = code === 'timeout' || code === 'network' || /^http-5/.test(code);
    showError(s, net ? 'network' : 'bad-answer', net ? 'MovieBox Pro didn\u2019t answer. Check your connection and try again.' :
      'MovieBox Pro sent an unexpected answer. Try again in a moment.', net ? '' : 'Code ' + code);
  }

  /* Ends a session's playback: final progress, timers, listeners, requests, screen saver, decoder. Idempotent. */
  function finish(s, opts) {
    if (!s || s.finished) return null;
    opts = opts || {};
    report(s, opts.why || 'stop', { over: opts.over });
    var snap = snapshot(s);
    s.finished = true;
    for (var k in s.timers) if (s.timers.hasOwnProperty(k)) clearTimeout(s.timers[k]);
    U.each(s.offs, function (off) { try { off(); } catch (e) {} });
    U.each(s.reqs, function (h) { try { h.abort(); } catch (e) {} });
    s.offs = []; s.reqs = [];
    keepAwake(false);
    releaseVideo();
    if (S === s) S = null;
    return snap;
  }

  function snapshot(s) {
    var c = s.cands[s.ci], d = dur() || s.lastDur;
    return {
      kind: s.kind, id: s.id, season: s.season, episode: s.episode, time: Math.round(pos(s) * 10) / 10,
      duration: Math.round(d * 10) / 10, paused: paused(), stream: c ? (c.hls ? 'hls' : 'mp4') : '', label: c ? c.label : '',
      state: s.state, started: s.started, file: s.fileIndex
    };
  }

  function fallback(s, reason) {
    var req = s.req, h = s.hooks;
    Log.info('player', 'fallback to the website player: ' + reason);
    stop('fallback');
    hook(h, 'onFallback', req, reason);
  }

  /* ---------- streams ---------- */

  function startCandidate(s, i, at, why) {
    cancel(s, 'cand'); cancel(s, 'stall');
    var c = s.cands[i];
    if (!c) { streamsFailed(s, at); return; }
    s.ci = i; s.ready = false; s.pendingAt = at > 0 ? at : 0; s.tryId++; s.userPaused = false;
    var tryId = s.tryId;
    Log.info('player', 'try ' + c.label + ' (' + (c.hls ? 'hls' : 'mp4') + ')' + (at > 0 ? ' at ' + Math.round(at) : '') + (why ? ' after ' + why : ''));
    if (!s.started) setStatus(s, i === 0 ? 'Starting playback\u2026' : 'Trying another stream\u2026');
    else setBuffering(s, true);
    var v = ui.video;
    try { v.pause(); } catch (e) {}
    try { v.src = c.src; v.load(); } catch (e2) { candidateFailed(s, tryId, 'exception'); return; }
    playVideo(s);
    armCandidate(s);
    renderBadges(s);
    s.btnSig = '';
  }

  /* Each candidate must reach "playing" within candidateTimeout. Metadata alone is not enough: an HLS manifest can
     load while its segments hang or are refused. Not while autoplay is blocked (waiting for OK), nor when the
     viewer paused a stream that has loaded. */
  function armCandidate(s) {
    var tryId = s.tryId;
    later(s, 'cand', function () {
      if (s.tryId !== tryId || s.playedTry === tryId || s.blocked || (s.ready && s.userPaused)) return;
      candidateFailed(s, tryId, s.ready ? 'no-start' : 'timeout');
    }, CFG.candidateTimeout);
  }

  function candidateFailed(s, tryId, reason) {
    if (s !== S || s.finished || s.tryId !== tryId || s.state === 'error' || s.relinking) return;
    var c = s.cands[s.ci];
    Log.warn('player', 'stream ' + (c ? c.label : '?') + ' failed: ' + reason);
    if (c) s.failed[c.label] = true;
    var v = ui.video, at = s.ready ? (v.currentTime > 0 ? v.currentTime : s.lastTime) : s.pendingAt;
    if (s.started && s.ready) {
      report(s, 'switch');
      s.switchNote = 'Playback hiccup \u2014 switched to a backup stream';
    }
    startCandidate(s, s.ci + 1, at, reason);
  }

  /* Every candidate failed. Mid-film this is usually the signed, time-limited stream links expiring, so fresh player
     data is fetched once (again only after the new links played for a while) before the error card appears. */
  function streamsFailed(s, at) {
    at = at > 0 ? at : (s.lastTime || 0);
    var canRelink = s.started && s.fileIndex >= 0 && s.files[s.fileIndex] && (!s.relinkAt || (s.playedSinceRelink && U.now() - s.relinkAt > 30000));
    if (canRelink) {
      Log.warn('player', 'every stream failed mid-playback; fetching fresh stream links');
      s.relinkAt = U.now();
      s.playedSinceRelink = false;
      s.lastTime = at;
      /* Late events of the failed stream (a play() rejection, a media error) must not count against the next one. */
      s.tryId++;
      s.ready = false;
      s.relinking = true;
      setBuffering(s, true);
      fetchPlayerData(s, s.fileIndex, function (err, d) {
        s.relinking = false;
        if (err && err.code === 'signed-out') { fallback(s, 'signed-out'); return; }
        if (err || !d || !d.sources.length) {
          Log.warn('player', 'fresh stream links failed: ' + (err ? err.code : 'no sources'));
          streamsFailed(s, at);
          return;
        }
        applyData(s, d);
        s.resumePending = false;
        s.switchNote = 'Reconnected';
        startCandidate(s, 0, at, 'refresh');
      });
      return;
    }
    Log.warn('player', 'every stream failed');
    s.lastTime = at;
    showError(s, 'streams-failed', s.started ? 'The video stopped and none of its streams would start again. Check your connection and try again.' :
      'None of the available streams would play on this TV. The website\u2019s own player may still work.');
  }

  function playVideo(s) {
    var v = ui && ui.video, p = null, tryId = s.tryId;
    if (!v) return;
    try { p = v.play(); } catch (e) { Log.warn('player', 'play() threw: ' + clean(e)); return; }
    if (p && typeof p.then === 'function') {
      p.then(null, function (err) {
        if (s !== S || s.finished) return;
        var name = String(err && err.name || '');
        if (name === 'NotAllowedError') {
          Log.info('player', 'autoplay blocked; waiting for OK');
          if (s.ready) reveal(s);
          s.blocked = true;
          showChip(s, 'Press OK to play', CFG.chipMs, false);
          showOsd(s);
        } else if (name !== 'AbortError' && s.tryId === tryId) {
          /* NotSupportedError and the like: this stream will not start (a pause() or a new source rejects with
             AbortError, which is expected). */
          candidateFailed(s, tryId, 'play-' + (name || 'error'));
        }
      });
    }
  }

  function releaseVideo() {
    var v = ui && ui.video;
    if (!v) return;
    try { v.pause(); } catch (e) {}
    try { v.removeAttribute('src'); } catch (e2) {}
    try { v.load(); } catch (e3) {}
  }

  function dur() {
    var v = ui && ui.video, d = v ? v.duration : 0;
    return d > 0 && isFinite(d) ? d : 0;
  }

  function pos(s) {
    var v = ui && ui.video;
    if (s && s.ready && v) { var t = v.currentTime; if (t >= 0 && isFinite(t)) return t; }
    return s ? s.lastTime || s.pendingAt || 0 : 0;
  }

  function paused() { var v = ui && ui.video; return !v || !!v.paused; }

  function seekTo(s, t) {
    var d = dur();
    if (d > 0) t = U.clamp(t, 0, Math.max(0, d - 0.5));
    s.lastTime = t;
    try { ui.video.currentTime = t; } catch (e) { Log.warn('player', 'seek failed: ' + clean(e)); }
  }

  /* Leaves the loading screen for the playback UI (first frame, or autoplay blocked). */
  function reveal(s) {
    if (s.state !== 'loading') return;
    s.state = 'playing';
    ui.root.setAttribute('data-state', 'playing');
    showOsd(s);
  }

  function bindVideo(v) {
    function on(type, fn) {
      ui.offs.push(U.on(v, type, function (e) { var s = S; if (!s || s.finished || s.state === 'error') return; fn(s, e); }));
    }
    on('loadedmetadata', function (s) {
      s.ready = true;
      var d = dur(), at = s.pendingAt;
      if (d > 0) s.lastDur = d;
      s.pendingAt = 0;
      if (s.resumePending) {
        s.resumePending = false;
        if (at > 10 && d > 0 && at < d - 60) { seekTo(s, at); s.resumed = at; } else s.lastTime = 0;
      } else if (at > 0 && d > 0) seekTo(s, Math.min(at, d - 1));
      if (s.blocked) reveal(s);
      render(s);
    });
    on('playing', function (s) {
      s.ready = true;
      s.blocked = false;
      s.userPaused = false;
      s.playedTry = s.tryId;
      s.playedSinceRelink = true;
      cancel(s, 'cand');
      setBuffering(s, false);
      keepAwake(true);
      if (!s.started) {
        s.started = true;
        cancel(s, 'budget');
        var c = s.cands[s.ci];
        Log.info('player', 'playing ' + (c ? c.label : '?') + (s.resumed ? ' from ' + Math.round(s.resumed) : ''));
        reveal(s);
        showOsd(s);
        if (s.resumed) showChip(s, 'Resumed at ' + fmt(s.resumed) + ' \u00b7 press Down for Start over', CFG.chipMs, true);
        later(s, 'tick', function tick() { if (!paused()) report(s, 'tick'); later(s, 'tick', tick, CFG.progressEvery); }, CFG.progressEvery);
        later(s, 'nextinfo', function () { prefetchNext(s); }, 4000);
      } else if (s.switchNote) {
        showChip(s, s.switchNote, 4000, false);
      }
      s.switchNote = '';
      if (s.osd) scheduleHide(s);
      render(s);
      /* It started while the app is in the background: hold it there (see toBackground). */
      if (isHidden()) toBackground(s);
    });
    on('pause', function (s) {
      if (!s.started) return;
      keepAwake(false);
      if (!s.ended) report(s, 'pause');
      showOsd(s);
      render(s);
    });
    on('play', function (s) { if (s.started) render(s); });
    on('waiting', function (s) {
      /* Also before the first frame: a stream that stops delivering data is replaced after stallTimeout. */
      setBuffering(s, true);
      s.waitAt = pos(s);
      var tryId = s.tryId;
      later(s, 'stall', function () {
        if (s.buffering && s.tryId === tryId && Math.abs(pos(s) - s.waitAt) < 0.5 && !paused()) candidateFailed(s, tryId, 'stall');
      }, CFG.stallTimeout);
    });
    on('timeupdate', function (s) {
      if (!s.ready) return;
      var t = ui.video.currentTime;
      if (!ui.video.seeking && t > 0) s.lastTime = t;
      if (s.buffering && Math.abs(t - s.waitAt) >= 0.5) { setBuffering(s, false); cancel(s, 'stall'); }
      if (U.now() - s.lastRender >= 250) render(s);
      checkUpNext(s);
    });
    on('progress', function (s) { if (s.osd && U.now() - s.lastRender >= 250) render(s); });
    on('durationchange', function (s) { var d = dur(); if (d > 0) s.lastDur = d; render(s); });
    on('seeked', function (s) { render(s); });
    on('ended', function (s) { onEnded(s); });
    on('error', function (s) {
      var v2 = ui.video, code = v2 && v2.error ? v2.error.code : 0;
      if (!v2 || !v2.getAttribute('src')) return;
      candidateFailed(s, s.tryId, 'media-' + code);
    });
  }

  function setBuffering(s, on) {
    s.buffering = !!on;
    if (ui) flag(ui.root, 'is-buffering', on && s.started);
  }

  /* ---------- screen saver ---------- */

  function keepAwake(on) {
    on = !!on;
    if (on === saverOff) return;
    saverOff = on;
    var done = false;
    try {
      var ac = window.webapis && window.webapis.appcommon;
      if (ac && typeof ac.setScreenSaver === 'function' && ac.AppCommonScreenSaverState) {
        ac.setScreenSaver(on ? ac.AppCommonScreenSaverState.SCREEN_SAVER_OFF : ac.AppCommonScreenSaverState.SCREEN_SAVER_ON,
          function () {}, function (e) { Log.info('player', 'screen saver: ' + clean(e && e.message || e)); });
        done = true;
      }
    } catch (e) { Log.info('player', 'screen saver: ' + clean(e)); }
    if (done) return;
    try {
      var power = window.tizen && window.tizen.power;
      if (power) { if (on) power.request('SCREEN', 'SCREEN_NORMAL'); else power.release('SCREEN'); }
    } catch (e2) { Log.info('player', 'screen power: ' + clean(e2)); }
  }

  /* ---------- background (Home button, input switch) ---------- */

  /* Save the place, pause and let the screen saver run again; coming back shows the paused controls (like the
     TV's own apps), and OK carries on. */
  function toBackground(s) {
    report(s, 'hidden');
    if (s.state === 'playing' && ui && !ui.video.paused) {
      Log.info('player', 'app hidden: pausing');
      s.bgPaused = true;
      s.userPaused = true;
      try { ui.video.pause(); } catch (e) {}
    }
    keepAwake(false);
  }

  function fromBackground(s) {
    if (!s.bgPaused) return;
    s.bgPaused = false;
    if (s.state === 'playing' && !(s.upnext && s.upnext.visible)) { showOsd(s); render(s); }
  }

  /* ---------- progress ---------- */

  function formOf(obj) {
    var parts = [];
    for (var k in obj) if (obj.hasOwnProperty(k)) parts.push(enc(k) + '=' + enc(obj[k]));
    return parts.join('&');
  }

  /* Posts {post, over, seconds, mp4_id} like the site's own save routine. Skipped before playback started, while
     the duration is unknown, and when neither the second nor over changed since the last post. */
  function report(s, why, opts) {
    opts = opts || {};
    if (!s || s.finished || !s.started || !s.data || !ui) return false;
    var d = dur() || s.lastDur; /* the last known duration survives a stream switch or a failed stream */
    if (!(d > 0)) return false;
    var t = pos(s), sec = Math.max(0, Math.floor(t));
    var over = opts.over === 1 || opts.over === 0 ? opts.over : (d - t < 300 ? 1 : 0);
    var key = sec + ':' + over;
    if (key === s.lastSent) return false;
    s.lastSent = key;
    var body = formOf(s.post) + '&over=' + over + '&seconds=' + sec + '&mp4_id=' + enc(s.data.mp4Id);
    send(null, { url: origin() + s.progressUrl, body: body, label: 'progress' }, function (err) {
      if (err) Log.info('player', 'progress not saved: ' + err.code);
    });
    Log.info('player', 'progress ' + sec + '/' + Math.floor(d) + ' over=' + over + ' (' + why + ')');
    hook(s.hooks, 'onProgress', { kind: s.kind, id: s.id, season: s.season, episode: s.episode, seconds: sec, duration: Math.floor(d), over: over });
    return true;
  }

  /* ---------- overlay DOM ---------- */

  function build(mount) {
    var root = el('div', 'mbp');
    root.id = 'mbptv-player';
    root.setAttribute('tabindex', '-1');
    root.setAttribute('data-state', 'loading');
    var u = { root: root, offs: [] };

    var v = document.createElement('video');
    v.className = 'mbp-video';
    v.setAttribute('preload', 'auto');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('disablepictureinpicture', '');
    v.setAttribute('disableremoteplayback', '');
    root.appendChild(v);
    u.video = v;

    var art = el('div', 'mbp-art', null, root);
    u.artImg = document.createElement('img');
    u.artImg.className = 'mbp-art-img';
    u.artImg.setAttribute('alt', '');
    u.artImg.onload = U.guard(function () { flag(u.artImg, 'is-loaded', true); }, 'player-art');
    u.artImg.onerror = U.guard(function () { if (!retryOriginal(u.artImg)) flag(u.artImg, 'is-loaded', false); }, 'player-art');
    art.appendChild(u.artImg);
    el('div', 'mbp-art-scrim', null, art);

    var loading = el('div', 'mbp-loading', null, root);
    var spin = el('div', 'mbp-spin', null, loading);
    el('div', 'mbp-spin-ring', null, spin);
    var info = el('div', 'mbp-load-info', null, loading);
    u.lKicker = el('div', 'mbp-kicker', '', info);
    u.lTitle = el('div', 'mbp-load-title', '', info);
    u.lSub = el('div', 'mbp-load-sub', null, info);
    u.lSubCode = el('span', 'mbp-sub-code', '', u.lSub);
    u.lSubText = el('span', 'mbp-sub-text', '', u.lSub);
    u.lStatus = el('div', 'mbp-load-status', '', info);
    var lh = el('div', 'mbp-load-hint', null, loading);
    el('span', 'mbp-key', 'Back', lh);
    el('span', null, 'Cancel', lh);

    var buffer = el('div', 'mbp-buffer', null, root);
    el('div', 'mbp-spin-ring', null, buffer);

    u.flash = el('div', 'mbp-flash', null, root);
    u.flashPlay = icon('play', 'mbp-flash-play');
    u.flashPause = icon('pause', 'mbp-flash-pause');
    u.flash.appendChild(u.flashPlay);
    u.flash.appendChild(u.flashPause);

    el('div', 'mbp-dim', null, root);
    var osd = el('div', 'mbp-osd', null, root);
    el('div', 'mbp-osd-top', null, osd);
    el('div', 'mbp-osd-shade', null, osd);
    var main = el('div', 'mbp-osd-main', null, osd);
    var head = el('div', 'mbp-head', null, main);
    el('div', 'mbp-kicker mbp-osd-kicker', 'Paused', head);
    u.title = el('div', 'mbp-title', '', head);
    var subRow = el('div', 'mbp-subrow', null, head);
    u.sub = el('div', 'mbp-sub', null, subRow);
    u.subCode = el('span', 'mbp-sub-code', '', u.sub);
    u.subText = el('span', 'mbp-sub-text', '', u.sub);
    u.badges = el('div', 'mbp-badges', null, subRow);

    var scrub = el('div', 'mbp-scrub', null, main);
    u.state = el('div', 'mbp-state', null, scrub);
    u.state.appendChild(icon('play', 'mbp-state-play'));
    u.state.appendChild(icon('pause', 'mbp-state-pause'));
    u.elapsed = el('div', 'mbp-time mbp-elapsed', '0:00', scrub);
    var bar = el('div', 'mbp-bar', null, scrub);
    var clip = el('div', 'mbp-bar-clip', null, bar);
    u.buf = el('div', 'mbp-buf', null, clip);
    u.fill = el('div', 'mbp-fill', null, clip);
    u.headWrap = el('div', 'mbp-headwrap', null, bar);
    el('div', 'mbp-knob', null, u.headWrap);
    var bubble = el('div', 'mbp-bubble', null, u.headWrap);
    u.bubbleDelta = el('div', 'mbp-bubble-delta', '', bubble);
    u.bubbleTime = el('div', 'mbp-bubble-time', '', bubble);
    u.remain = el('div', 'mbp-time mbp-remain', '', scrub);
    u.btns = el('div', 'mbp-btns', null, main);
    u.btns.setAttribute('data-zone', 'player-buttons');

    u.skip = el('div', 'mbp-skip', null, root);
    u.skip.setAttribute('data-action', 'skip-intro-pill');
    u.skip.appendChild(icon('skip'));
    el('span', 'mbp-skip-label', 'Skip Intro', u.skip);

    u.chip = el('div', 'mbp-chip', '', root);

    el('div', 'mbp-un-scrim', null, root);
    var un = el('div', 'mbp-upnext', null, root);
    un.setAttribute('data-upnext', '');
    var unTop = el('div', 'mbp-un-top', null, un);
    var still = el('div', 'mbp-un-still', null, unTop);
    u.unPh = el('div', 'mbp-un-ph', '', still);
    u.unImg = document.createElement('img');
    u.unImg.className = 'mbp-un-img';
    u.unImg.setAttribute('alt', '');
    u.unImg.onload = U.guard(function () { flag(u.unImg, 'is-loaded', true); }, 'player-still');
    u.unImg.onerror = U.guard(function () { if (!retryOriginal(u.unImg)) flag(u.unImg, 'is-loaded', false); }, 'player-still');
    still.appendChild(u.unImg);
    var glyph = el('div', 'mbp-un-glyph', null, still);
    glyph.appendChild(icon('play'));
    var unText = el('div', 'mbp-un-text', null, unTop);
    u.unCount = el('div', 'mbp-kicker mbp-un-count', '', unText);
    u.unTitle = el('div', 'mbp-un-title', '', unText);
    u.unMeta = el('div', 'mbp-un-meta', '', unText);
    var unBtns = el('div', 'mbp-un-btns', null, unText);
    u.unPlay = el('div', 'mbp-btn mbp-btn--count', null, unBtns);
    u.unPlay.setAttribute('data-action', 'play-next');
    u.unFill = el('div', 'mbp-btn-fill', null, u.unPlay);
    u.unPlay.appendChild(icon('play'));
    el('span', 'mbp-btn-label', 'Play now', u.unPlay);
    u.unHide = el('div', 'mbp-btn', null, unBtns);
    u.unHide.setAttribute('data-action', 'hide-next');
    u.unHide.appendChild(icon('close'));
    el('span', 'mbp-btn-label', 'Hide', u.unHide);

    var layer = el('div', 'mbp-sheet-layer', null, root);
    el('div', 'mbp-sheet-dim', null, layer);
    var sheet = el('div', 'mbp-sheet', null, layer);
    sheet.setAttribute('data-sheet', 'player-quality');
    el('div', 'mbp-kicker', 'Quality', sheet);
    el('div', 'mbp-sheet-title', 'Choose quality', sheet);
    u.sheetSub = el('div', 'mbp-sheet-sub', '', sheet);
    var port = el('div', 'mbp-sheet-port', null, sheet);
    u.sheetList = el('div', 'mbp-sheet-list', null, port);
    u.sheetPort = port;
    var sh = el('div', 'mbp-sheet-hint', null, sheet);
    el('span', 'mbp-key', 'OK', sh);
    el('span', 'mbp-hint-gap', 'Choose', sh);
    el('span', 'mbp-key', 'Back', sh);
    el('span', null, 'Close', sh);

    var err = el('div', 'mbp-error', null, root);
    var card = el('div', 'mbp-err-card', null, err);
    card.setAttribute('data-dialog', 'player-error');
    card.appendChild(icon('alert', 'mbp-err-ico'));
    u.errKicker = el('div', 'mbp-kicker mbp-err-kicker', '', card);
    u.errTitle = el('div', 'mbp-err-title', '', card);
    u.errBody = el('div', 'mbp-err-body', '', card);
    u.errCode = el('div', 'mbp-err-code', '', card);
    u.errBtns = el('div', 'mbp-err-btns', null, card);

    ui = u;
    bindVideo(v);
    /* The shell root is pointer-transparent outside shell mode; the player takes pointer input itself (player.css)
       and swallows it, so a pointer (Tizen's mouse mode, a USB mouse) never reaches the website underneath. */
    u.offs.push(U.on(root, 'click', function (e) { if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }));
    (mount || document.body).appendChild(root);
    try { root.focus({ preventScroll: true }); } catch (e) { try { root.focus(); } catch (e2) {} }
  }

  function teardownUi() {
    if (!ui) return;
    releaseVideo();
    U.each(ui.offs, function (off) { try { off(); } catch (e) {} });
    U.detach(ui.root);
    ui = null;
  }

  function resetUi(s) {
    var r = ui.root;
    r.setAttribute('data-state', 'loading');
    r.setAttribute('data-kind', s.kind);
    U.each(['is-osd', 'is-paused', 'is-upnext', 'is-sheet', 'is-seeking', 'is-buffering', 'is-scrub', 'is-buttons', 'is-still'], function (c) { flag(r, c, false); });
    flag(ui.chip, 'is-on', false);
    flag(ui.skip, 'is-on', false);
    U.empty(ui.btns);
    U.empty(ui.errBtns);
    U.empty(ui.badges);
    tf(ui.fill, 'scaleX(0)');
    tf(ui.buf, 'scaleX(0)');
    tf(ui.headWrap, 'translate3d(0,0,0)');
    setText(ui.elapsed, '0:00');
    setText(ui.remain, '');
    var art = s.req.backdrop || s.req.poster || '';
    if (!art) {
      try { var m = Api.meta(s.kind + ':' + s.id); art = m && (m.backdrop || m.poster) || ''; } catch (e) { art = ''; }
    }
    if (safeImage(art)) setArt(ui.artImg, art, 1280);
    else {
      flag(ui.artImg, 'is-loaded', false);
      ui.artImg.removeAttribute('src');
    }
    renderTitles(s);
    setStatus(s, 'Loading\u2026');
  }

  function titleOf(s) { return U.text(s.kind === 'tv' ? (s.req.showTitle || s.req.title) : s.req.title) || 'MovieBox Pro'; }

  function shortRuntime(v) {
    var m = /^(\d+)/.exec(String(v || '')), n = m ? toInt(m[1]) : 0;
    if (!n) return '';
    return n < 60 ? n + 'm' : Math.floor(n / 60) + 'h' + (n % 60 ? ' ' + (n % 60) + 'm' : '');
  }

  function movieMeta(s) {
    var m = null;
    try { m = Api.meta('movie:' + s.id); } catch (e) { m = null; }
    if (!m) return '';
    var parts = [];
    if (m.year) parts.push(m.year);
    if (shortRuntime(m.runtime)) parts.push(shortRuntime(m.runtime));
    if (m.certification) parts.push(m.certification);
    return parts.join('  \u00b7  ');
  }

  function renderTitles(s) {
    if (!ui) return;
    var title = titleOf(s), code = '', text = '';
    if (s.kind === 'tv') { code = 'S' + s.season + ' \u00b7 E' + s.episode; text = U.text(s.req.episodeTitle || ''); }
    else text = movieMeta(s);
    setText(ui.title, title);
    setText(ui.subCode, code);
    setText(ui.subText, text);
    flag(ui.sub, 'is-empty', !code && !text);
    setText(ui.lTitle, title);
    setText(ui.lSubCode, code);
    setText(ui.lSubText, text);
    setText(ui.lKicker, s.kicker || 'Now playing');
  }

  function setStatus(s, text) { if (ui && s === S) setText(ui.lStatus, text); }

  function badgeList(s) {
    var c = s.cands[s.ci], out = [];
    if (!c) return out;
    if (c.label === 'AUTO') out.push('Auto');
    else if (c.label === 'ORG') out.push(c.height >= 2000 || c.width >= 3800 ? '4K' : c.height >= 1000 || c.width >= 1900 ? '1080p' : 'Original');
    else out.push(c.label);
    if (c.hdr) out.push('HDR');
    return out;
  }

  function renderBadges(s) {
    if (!ui) return;
    var list = badgeList(s), sig = list.join('|');
    if (ui.badges.__sig === sig) return;
    ui.badges.__sig = sig;
    U.empty(ui.badges);
    U.each(list, function (b, i) { el('span', 'mbp-tag' + (i ? ' mbp-tag--line' : ''), b, ui.badges); });
  }

  /* ---------- rendering (at most 4x/s from timeupdate; immediately after keys) ---------- */

  function bufferedTo(v, t, d) {
    try {
      var b = v.buffered;
      for (var i = 0; b && i < b.length; i++) if (b.start(i) <= t + 0.5 && b.end(i) >= t) return U.clamp(b.end(i) / d, 0, 1);
    } catch (e) {}
    return 0;
  }

  function render(s) {
    if (!ui || s !== S) return;
    s.lastRender = U.now();
    var v = ui.video, d = dur(), cur = pos(s), t = s.seek ? s.seek.target : cur;
    var p = d > 0 ? U.clamp(t / d, 0, 1) : 0;
    tf(ui.fill, 'scaleX(' + p.toFixed(4) + ')');
    tf(ui.headWrap, 'translate3d(' + (p * 100).toFixed(3) + '%,0,0)');
    tf(ui.buf, 'scaleX(' + (d > 0 ? bufferedTo(v, cur, d) : 0).toFixed(4) + ')');
    setText(ui.elapsed, fmt(t));
    setText(ui.remain, d > 0 ? '\u2212' + fmt(Math.max(0, d - t)) : '');
    flag(ui.root, 'is-paused', paused() && s.started);
    flag(ui.root, 'is-long', d >= 3600);
    if (s.seek) {
      setText(ui.bubbleTime, fmt(t));
      setText(ui.bubbleDelta, fmtDelta(t - s.seek.from));
    }
    renderButtons(s);
    renderSkip(s);
  }

  /* ---------- OSD ---------- */

  function showOsd(s) {
    if (!ui || s.state !== 'playing' || (s.upnext && s.upnext.visible)) return;
    if (!s.osd) {
      s.osd = true;
      s.area = 'scrub';
      flag(ui.root, 'is-osd', true);
    }
    syncArea(s);
    render(s);
    scheduleHide(s);
  }

  function scheduleHide(s) {
    cancel(s, 'osd');
    if (paused() && s.started) return;
    later(s, 'osd', function () { hideOsd(s, false); }, CFG.osdHide);
  }

  function hideOsd(s, force) {
    if (!ui || !s.osd) return;
    if (!force && ((paused() && s.started) || s.seek || s.sheet)) return;
    cancel(s, 'osd');
    s.osd = false;
    s.area = 'scrub';
    flag(ui.root, 'is-osd', false);
    syncArea(s);
    renderSkip(s);
  }

  function syncArea(s) {
    flag(ui.root, 'is-scrub', s.osd && s.area === 'scrub');
    flag(ui.root, 'is-buttons', s.osd && s.area === 'buttons');
    var list = U.qsa(ui.btns, '[data-action]');
    U.each(list, function (b) { flag(b, 'is-focused', s.osd && s.area === 'buttons' && b.getAttribute('data-action') === s.btn); });
  }

  function setArea(s, area, action) {
    s.area = area;
    if (area === 'buttons') {
      var defs = buttonDefs(s), has = function (a) { return !!U.find(defs, function (x) { return x.action === a; }); };
      if (action && has(action)) s.btn = action;
      else if (!has(s.btn)) s.btn = defs[0].action;
    }
    syncArea(s);
  }

  function flash(s, playing) {
    if (!ui) return;
    flag(ui.flash, 'is-play', playing);
    flag(ui.flash, 'is-on', false);
    void ui.flash.offsetWidth;
    flag(ui.flash, 'is-on', true);
  }

  var chipTimer = null;
  function showChip(s, text, ms, startOver) {
    if (!ui) return;
    setText(ui.chip, text);
    flag(ui.chip, 'is-on', true);
    s.chipStartOver = !!startOver;
    clearTimeout(chipTimer);
    chipTimer = U.later(function () {
      if (!ui) return;
      flag(ui.chip, 'is-on', false);
      if (S) S.chipStartOver = false;
    }, ms || 3500, 'player-chip');
  }

  function hideChip(s) {
    clearTimeout(chipTimer);
    if (ui) flag(ui.chip, 'is-on', false);
    if (s) s.chipStartOver = false;
  }

  /* ---------- buttons row ---------- */

  function qualityOptions(s) {
    var seen = {}, out = [];
    U.each(s.base, function (c) { if (!seen[c.label]) { seen[c.label] = true; out.push(c); } });
    out.sort(function (a, b) {
      var ia = U.indexOf(SHEET_ORDER, a.label), ib = U.indexOf(SHEET_ORDER, b.label);
      return (ia < 0 ? 50 : ia) - (ib < 0 ? 50 : ib);
    });
    return out;
  }

  function displayLabel(label) { return label === 'AUTO' ? 'Auto' : label === 'ORG' ? 'Original' : label; }

  /* The site's intro/credits marks are crowd data and can be wrong: an intro "ending" 20 minutes in would let the
     Skip Intro pill take OK over for that whole stretch, and credits "starting" early would mark the episode watched
     and jump ahead. Only plausible marks are used (the intro within the first third, at most 10 minutes; the
     credits within the last fifth and the last 10 minutes). */
  function introPoint(s, d) {
    var i = s.introEnd;
    return i > 0 && d > 0 && i <= Math.min(600, d / 3) ? i : 0;
  }

  function creditsPoint(s, d) {
    var c = s.creditsAt;
    return c > 0 && d > 0 && c < d && c >= 0.8 * d && d - c <= 600 ? c : 0;
  }

  function introActive(s) { var i = introPoint(s, dur()); return i > 0 && s.started && pos(s) < i - 1; }

  function buttonDefs(s) {
    var p = paused() && s.started, c = s.cands[s.ci];
    var list = [{ action: 'play-pause', icon: p ? 'play' : 'pause', label: p ? 'Play' : 'Pause' }];
    if (introActive(s)) list.push({ action: 'skip-intro', icon: 'skip', label: 'Skip Intro' });
    if (s.next) list.push({ action: 'next-episode', icon: 'next', label: 'Next Episode', value: s.next.season === s.season ? 'E' + s.next.episode : 'S' + s.next.season + ' E' + s.next.episode });
    if (qualityOptions(s).length > 1 || s.files.length > 1) list.push({ action: 'quality', icon: 'quality', label: 'Quality', value: c ? displayLabel(c.label) : '' });
    list.push({ action: 'start-over', icon: 'restart', label: 'Start over' });
    return list;
  }

  function renderButtons(s) {
    if (!ui || s.state !== 'playing') return;
    var defs = buttonDefs(s), sig = U.map(defs, function (d) { return d.action + ':' + d.icon + ':' + (d.value || ''); }).join('|');
    if (sig === s.btnSig) return;
    s.btnSig = sig;
    U.empty(ui.btns);
    U.each(defs, function (d) {
      var b = el('div', 'mbp-btn', null, ui.btns);
      b.setAttribute('data-action', d.action);
      b.setAttribute('tabindex', '-1');
      b.appendChild(icon(d.icon));
      el('span', 'mbp-btn-label', d.label, b);
      if (d.value) el('span', 'mbp-btn-value', d.value, b);
    });
    if (!U.find(defs, function (d) { return d.action === s.btn; })) s.btn = 'play-pause';
    syncArea(s);
  }

  function moveButton(s, dir) {
    var defs = buttonDefs(s), i = 0;
    U.each(defs, function (d, k) { if (d.action === s.btn) i = k; });
    i = U.clamp(i + dir, 0, defs.length - 1);
    s.btn = defs[i].action;
    syncArea(s);
  }

  function activate(s, action) {
    switch (action) {
      case 'play-pause': togglePlay(s); return;
      case 'skip-intro': skipIntro(s); return;
      case 'next-episode': playNext(s, 'button'); return;
      case 'quality': openSheet(s); return;
      case 'start-over': startOver(s); return;
    }
  }

  function renderSkip(s) {
    if (!ui) return;
    var on = s.state === 'playing' && introActive(s) && !s.osd && !(s.upnext && s.upnext.visible) && !s.sheet;
    flag(ui.skip, 'is-on', on);
    flag(ui.skip, 'is-focused', on);
  }

  /* ---------- playback actions ---------- */

  function togglePlay(s) {
    var v = ui.video;
    if (v.paused || s.blocked) {
      s.blocked = false;
      s.userPaused = false;
      s.bgPaused = false;
      playVideo(s);
      /* A stream that loaded while waiting for OK (autoplay blocked) or while paused still has to start. */
      if (s.playedTry !== s.tryId) armCandidate(s);
      flash(s, true);
    } else {
      s.userPaused = true;
      try { v.pause(); } catch (e) {}
      flash(s, false);
    }
    showOsd(s);
    render(s);
  }

  function skipIntro(s) {
    var at = introPoint(s, dur());
    if (!(at > 0)) return;
    Log.info('player', 'skip intro to ' + Math.round(at));
    seekTo(s, at);
    later(s, 'seekreport', function () { report(s, 'seek'); }, CFG.seekReport);
    render(s);
  }

  function startOver(s) {
    Log.info('player', 'start over');
    hideChip(s);
    seekTo(s, 0);
    if (paused()) playVideo(s);
    later(s, 'seekreport', function () { report(s, 'seek'); }, CFG.seekReport);
    showOsd(s);
    s.btnSig = '';
    render(s);
  }

  /* Left/Right seek by 10 s; holding (auto-repeat) accelerates to 30 s and then 60 s steps. The jump is applied
     400 ms after the last press; until then the bar previews the target time. */
  function seekBy(s, dir, ev) {
    var d = dur();
    if (!(d > 0) || !s.ready) { showOsd(s); return; }
    /* Some remotes deliver a held key as plain keydowns (repeat=false): presses of the same direction less than
       repeatGap apart count as a hold too. */
    var now = U.now(), k = s.seekKey;
    var rep = !!(ev && ev.repeat) || (!!k && k.dir === dir && now - k.at >= 0 && now - k.at < CFG.repeatGap);
    if (!k || k.dir !== dir || (!rep && now - k.at > 600)) k = s.seekKey = { dir: dir, reps: 0, at: now };
    if (rep) k.reps++;
    k.at = now;
    var step = k.reps > 14 ? 60 : k.reps > 4 ? 30 : 10;
    if (!s.seek) s.seek = { from: pos(s), target: pos(s) };
    s.seek.target = U.clamp(s.seek.target + dir * step, 0, Math.max(0, d - 1));
    flag(ui.root, 'is-seeking', true);
    showOsd(s);
    if (s.area !== 'scrub') setArea(s, 'scrub');
    cancel(s, 'osd');
    render(s);
    later(s, 'seek', function () { applySeek(s); }, CFG.seekApply);
  }

  function applySeek(s) {
    if (!s.seek) return;
    var target = s.seek.target;
    s.seek = null;
    s.seekKey = null;
    flag(ui.root, 'is-seeking', false);
    seekTo(s, target);
    if (s.upnext && s.upnext.visible) checkUpNext(s);
    later(s, 'seekreport', function () { report(s, 'seek'); }, CFG.seekReport);
    s.btnSig = '';
    render(s);
    scheduleHide(s);
  }

  /* ---------- quality sheet ---------- */

  function openSheet(s) {
    var items = [], cur = s.cands[s.ci];
    U.each(qualityOptions(s), function (c) {
      var meta = [], r = rank(c.label);
      if (c.label === 'AUTO') meta.push('Adapts to your connection');
      else if (c.label === 'ORG') meta.push('Best picture');
      else if (r >= 1080) meta.push('Full HD');
      else if (r >= 720) meta.push('HD \u00b7 for slower connections');
      else if (r > 0) meta.push('Data saver');
      if (c.width > 0 && c.height > 0) meta.push(c.width + ' \u00d7 ' + c.height);
      if (c.label === 'ORG' || c.h265) meta.push(c.h265 ? 'HEVC' : 'H.264');
      if (c.hdr) meta.push('HDR');
      if (c.label === 'ORG' && c.fps > 0) meta.push(Math.round(c.fps) + ' fps');
      items.push({ type: 'quality', label: c.label, title: displayLabel(c.label), meta: meta.join('  \u00b7  '), current: !!cur && cur.label === c.label });
    });
    if (s.kind === 'movie' && s.files.length > 1) {
      U.each(s.files, function (f, i) {
        var meta = U.filter([f.file, f.size], function (x) { return !!x; }).join('  \u00b7  ');
        items.push({ type: 'file', index: i, title: f.quality || ('File ' + (i + 1)), meta: meta, current: i === s.fileIndex });
      });
    }
    if (!items.length) return;
    U.empty(ui.sheetList);
    var focus = 0, fileLabel = false;
    U.each(items, function (it, i) {
      if (it.type === 'file' && !fileLabel) { fileLabel = true; el('div', 'mbp-sheet-label', 'Source file', ui.sheetList); }
      var row = el('div', 'mbp-opt' + (it.current ? ' is-current' : ''), null, ui.sheetList);
      row.setAttribute('tabindex', '-1');
      if (it.type === 'quality') row.setAttribute('data-quality', it.label); else row.setAttribute('data-file-index', String(it.index));
      var text = el('div', 'mbp-opt-text', null, row);
      el('div', 'mbp-opt-label', it.title, text);
      if (it.meta) el('div', 'mbp-opt-meta', it.meta, text);
      row.appendChild(icon('check', 'mbp-opt-check'));
      it.el = row;
      if (it.current && it.type === 'quality') focus = i;
    });
    setText(ui.sheetSub, cur ? 'Now playing: ' + displayLabel(cur.label) : '');
    s.sheet = { items: items, index: focus };
    cancel(s, 'osd');
    flag(ui.root, 'is-sheet', true);
    renderSkip(s);
    renderSheet(s);
  }

  function renderSheet(s) {
    var sh = s.sheet;
    if (!sh) return;
    U.each(sh.items, function (it, i) { flag(it.el, 'is-focused', i === sh.index); });
    var row = sh.items[sh.index] && sh.items[sh.index].el, port = ui.sheetPort;
    if (!row || !port) return;
    var top = row.offsetTop, h = row.offsetHeight, ph = port.clientHeight, y = sh.y || 0;
    if (top - y < 0) y = top - 16;
    else if (top + h - y > ph) y = top + h - ph + 16;
    sh.y = Math.max(0, y);
    tf(ui.sheetList, 'translate3d(0,' + (-sh.y) + 'px,0)');
  }

  function closeSheet(s) {
    if (!s.sheet) return;
    s.sheet = null;
    flag(ui.root, 'is-sheet', false);
    showOsd(s);
    setArea(s, 'buttons', 'quality');
  }

  function chooseSheet(s) {
    var it = s.sheet && s.sheet.items[s.sheet.index];
    if (!it) return;
    closeSheet(s);
    if (it.current) return;
    if (it.type === 'quality') switchQuality(s, it.label);
    else switchFile(s, it.index);
  }

  /* The chosen stream first, then the usual order, with streams that already failed in this session last. */
  function switchQuality(s, label) {
    var chosen = null, fresh = [], stale = [];
    U.each(s.base, function (c) {
      if (!chosen && c.label === label) chosen = c;
      else if (s.failed[c.label]) stale.push(c);
      else fresh.push(c);
    });
    if (!chosen) return;
    var at = pos(s);
    report(s, 'switch');
    Log.info('player', 'quality ' + label + ' at ' + Math.round(at));
    s.cands = [chosen].concat(fresh, stale);
    s.switchNote = 'Quality: ' + displayLabel(label);
    s.resumePending = false;
    startCandidate(s, 0, at, 'quality');
  }

  function switchFile(s, index) {
    Log.info('player', 'file ' + index + ' at ' + Math.round(pos(s)));
    report(s, 'switch');
    showChip(s, 'Switching file\u2026', 8000, false);
    fetchPlayerData(s, index, function (err, d) {
      if (err && err.code === 'signed-out') { fallback(s, 'signed-out'); return; }
      if (err || !d.sources.length) {
        Log.warn('player', 'file switch failed: ' + (err ? err.code : 'no sources'));
        showChip(s, 'That file isn\u2019t available right now', 3500, false);
        return;
      }
      /* The current file kept playing during the request (up to about 30 s): continue from where it is now. */
      var at = pos(s);
      if (s.seek) at = s.seek.target;
      s.seek = null; s.seekKey = null; cancel(s, 'seek');
      if (ui) flag(ui.root, 'is-seeking', false);
      report(s, 'switch');
      s.fileIndex = index;
      applyData(s, d);
      s.resumePending = false;
      s.switchNote = 'Now playing ' + (s.files[index].quality || 'the other file');
      startCandidate(s, 0, at, 'file');
    });
  }

  /* ---------- Up Next (Netflix style) ---------- */

  function nextReq(s, season, episode) {
    return {
      kind: 'tv', id: s.id, season: season, episode: episode, title: s.req.title, showTitle: s.req.showTitle || s.req.title,
      episodeTitle: season === (s.next && s.next.season) && episode === (s.next && s.next.episode) && s.nextInfo ? s.nextInfo.title : '',
      backdrop: s.req.backdrop, poster: s.req.poster, autoplayNext: s.req.autoplayNext
    };
  }

  function prefetchNext(s) {
    if (s.kind !== 'tv' || s.nextFetching) return;
    var wantCur = !U.text(s.req.episodeTitle || '');
    if (!s.next && !wantCur) return;
    s.nextFetching = true;
    var seasons = [];
    if (s.next) seasons.push(s.next.season);
    if (wantCur && U.indexOf(seasons, s.season) < 0) seasons.push(s.season);
    U.each(seasons, function (season) {
      Api.detail('tv', s.id, safe(s, function (err, d) {
        if (err || !d) return;
        var eps = d.episodes || [];
        if (s.next && season === s.next.season) {
          var ep = U.find(eps, function (e) { return e.season === s.next.season && e.episode === s.next.episode; });
          s.nextInfo = { title: ep ? ep.title || '' : '', still: ep ? ep.still || '' : '', runtime: ep ? ep.runtime || '' : '' };
          if (s.upnext && s.upnext.visible) fillUpNext(s);
        }
        if (wantCur && season === s.season && !U.text(s.req.episodeTitle || '')) {
          var cur = U.find(eps, function (e) { return e.season === s.season && e.episode === s.episode; });
          if (cur && cur.title) { s.req.episodeTitle = cur.title; renderTitles(s); }
        }
      }, 'player-next-info'), { season: season });
    });
  }

  function upNextAt(s, d) {
    var at = d - CFG.upNextLead, c = creditsPoint(s, d);
    if (c > 0) at = Math.min(at, c);
    return at;
  }

  function checkUpNext(s) {
    if (s.kind !== 'tv' || !s.next || s.state !== 'playing' || s.sheet) return;
    var d = dur();
    if (!(d > 0)) return;
    var t = pos(s), at = upNextAt(s, d);
    if (s.upnext && s.upnext.visible) {
      if (!s.upnext.ended && t < at - 5) hideUpNext(s, false);
      return;
    }
    if (s.dismissedNext && t < at - 30) s.dismissedNext = false; /* rewound well before the credits: offer it again */
    if (t >= at && !s.dismissedNext) showUpNext(s, false);
  }

  function fillUpNext(s) {
    var n = s.next, info = s.nextInfo || {};
    setText(ui.unTitle, info.title || 'Episode ' + n.episode);
    setText(ui.unMeta, U.filter(['S' + n.season + ' \u00b7 E' + n.episode, shortRuntime(info.runtime)], function (x) { return !!x; }).join('  \u00b7  '));
    setText(ui.unPh, 'E' + n.episode);
    if (safeImage(info.still)) setArt(ui.unImg, info.still, 500);
    else {
      flag(ui.unImg, 'is-loaded', false);
      ui.unImg.removeAttribute('src');
    }
  }

  /* After stillWatchingAfter episodes in a row started by autoplay with no key pressed, the card asks "Still
     watching?" instead of counting down, and the video pauses until the viewer answers (Netflix does the same), so
     a sleeping viewer's place is kept and later episodes are not marked watched. */
  function showUpNext(s, ended) {
    if (!s.next) return;
    prefetchNext(s);
    var still = CFG.stillWatchingAfter > 0 && unattended >= CFG.stillWatchingAfter;
    var auto = s.req.autoplayNext !== false && !still;
    s.upnext = { visible: true, focus: 0, count: auto ? CFG.upNextCount : -1, total: CFG.upNextCount, ended: !!ended, still: still };
    Log.info('player', 'up next S' + s.next.season + 'E' + s.next.episode + (ended ? ' (ended)' : '') + (still ? ' (still watching?)' : auto ? '' : ' (no autoplay)'));
    if (s.sheet) { s.sheet = null; flag(ui.root, 'is-sheet', false); }
    hideOsd(s, true);
    hideChip(s);
    fillUpNext(s);
    tf(ui.unFill, 'scaleX(0)');
    flag(ui.unFill, 'is-running', false);
    flag(ui.root, 'is-upnext', true);
    flag(ui.root, 'is-still', still);
    renderUpNext(s);
    renderSkip(s);
    if (still && !ended && !paused()) { try { ui.video.pause(); } catch (e) {} }
    if (auto) {
      U.later(function () {
        if (!ui || !s.upnext || !s.upnext.visible) return;
        flag(ui.unFill, 'is-running', true);
        tf(ui.unFill, 'scaleX(' + (1 / s.upnext.total).toFixed(4) + ')');
      }, 30, 'player-upnext-fill');
      later(s, 'upnext', function () { upNextTick(s); }, 1000);
    }
  }

  function upNextTick(s) {
    var u = s.upnext;
    if (!u || !u.visible || u.count < 0) return;
    if ((!paused() || u.ended) && !isHidden()) u.count--;
    if (u.count <= 0) { playNext(s, 'autoplay'); return; }
    renderUpNext(s);
    later(s, 'upnext', function () { upNextTick(s); }, 1000);
  }

  function renderUpNext(s) {
    var u = s.upnext;
    if (!u) return;
    setText(ui.unCount, u.still ? 'Still watching?' : u.count >= 0 ? 'Next episode in ' + u.count : 'Up next');
    if (u.count >= 0 && u.count < u.total) tf(ui.unFill, 'scaleX(' + U.clamp((u.total - u.count + 1) / u.total, 0, 1).toFixed(4) + ')');
    flag(ui.unPlay, 'is-focused', u.focus === 0);
    flag(ui.unHide, 'is-focused', u.focus === 1);
  }

  function hideUpNext(s, dismissed) {
    var u = s.upnext;
    if (!u) return;
    cancel(s, 'upnext');
    s.upnext = null;
    if (dismissed) s.dismissedNext = true;
    flag(ui.root, 'is-upnext', false);
    flag(ui.root, 'is-still', false);
    renderSkip(s);
    if (u.ended && dismissed) { report(s, 'ended', { over: 1 }); stop('ended'); return; }
    /* "Still watching?" answered with Hide: the viewer is here, so the credits carry on. */
    if (u.still && dismissed && paused()) { playVideo(s); render(s); }
  }

  function onEnded(s) {
    s.ended = true;
    Log.info('player', 'ended');
    keepAwake(false);
    if (s.kind === 'tv' && s.next) {
      var u = s.upnext;
      if (u && u.visible) {
        /* Autoplay off (or "Still watching?"): the card waits for the viewer instead of playing on. */
        if (u.count < 0) { u.ended = true; renderUpNext(s); return; }
        playNext(s, 'ended');
        return;
      }
      showUpNext(s, true);
      return;
    }
    report(s, 'ended', { over: 1 });
    stop('ended');
  }

  function goEpisode(s, season, episode, how, over) {
    var nr = nextReq(s, season, episode);
    Log.info('player', 'episode S' + season + 'E' + episode + ' (' + how + ')');
    var hooks = s.hooks;
    finish(s, { over: over, why: how });
    hook(hooks, 'onNext', nr);
    if (ui) begin(nr, hooks, how === 'previous' ? 'Previous episode' : 'Next episode');
  }

  /* From Up Next (near or at the end) the episode is saved as watched (over=1); a mid-episode Next Episode or Ch+
     saves the real position with the site's own over rule. */
  function playNext(s, how) {
    if (!s.next || s !== S) return;
    if (how === 'autoplay' || how === 'ended') unattended++;
    var finished = how === 'autoplay' || how === 'ended' || how === 'play-now' || (s.upnext && s.upnext.visible);
    goEpisode(s, s.next.season, s.next.episode, how, finished ? 1 : undefined);
  }

  function previousEpisode(s) {
    if (s.kind !== 'tv' || s.episode <= 1) { showChip(s, 'This is the first episode of the season', 3000, false); return; }
    goEpisode(s, s.season, s.episode - 1, 'previous');
  }

  /* ---------- error card ---------- */

  function showError(s, reason, message, code) {
    if (!ui || s !== S) return;
    Log.warn('player', 'error card: ' + reason);
    cancel(s, 'cand'); cancel(s, 'stall'); cancel(s, 'osd'); cancel(s, 'upnext'); cancel(s, 'tick'); cancel(s, 'budget'); cancel(s, 'seek');
    U.each(s.reqs, function (h) { try { h.abort(); } catch (e) {} });
    s.reqs = [];
    s.errAt = s.started ? pos(s) : 0;
    if (s.started) report(s, 'error');
    releaseVideo();
    s.ready = false;
    s.lastTime = s.errAt;
    keepAwake(false);
    s.state = 'error';
    s.seek = null;
    s.osd = false;
    s.sheet = null;
    s.upnext = null;
    U.each(['is-osd', 'is-sheet', 'is-upnext', 'is-seeking', 'is-buffering', 'is-scrub', 'is-buttons', 'is-still'], function (c) { flag(ui.root, c, false); });
    hideChip(s);
    flag(ui.skip, 'is-on', false);
    ui.root.setAttribute('data-state', 'error');
    setText(ui.errKicker, titleOf(s) + (s.kind === 'tv' ? '  \u00b7  S' + s.season + ' E' + s.episode : ''));
    setText(ui.errTitle, 'This video won\u2019t play here');
    setText(ui.errBody, message || '');
    setText(ui.errCode, code || '');
    flag(ui.errCode, 'is-empty', !code);
    var btns = [], retry = reason === 'network' || reason === 'bad-answer' || reason === 'internal' || reason === 'streams-failed';
    if (retry) btns.push({ action: 'retry', icon: 'reload', label: 'Try again' });
    if (reason !== 'bad-request') btns.push({ action: 'website', icon: 'globe', label: 'Try website player' });
    btns.push({ action: 'back', icon: 'back', label: 'Back' });
    U.empty(ui.errBtns);
    U.each(btns, function (b) {
      var n = el('div', 'mbp-btn', null, ui.errBtns);
      n.setAttribute('data-action', b.action);
      n.setAttribute('tabindex', '-1');
      n.appendChild(icon(b.icon));
      el('span', 'mbp-btn-label', b.label, n);
      b.el = n;
    });
    /* Mid-film (it played before) Try again is the likely fix; otherwise the website's player. */
    var focus = 0, want = s.started && retry ? 'retry' : 'website';
    U.each(btns, function (b, i) { if (b.action === want) focus = i; });
    s.err = { reason: reason, btns: btns, index: focus };
    renderError(s);
  }

  function renderError(s) {
    U.each(s.err.btns, function (b, i) { flag(b.el, 'is-focused', i === s.err.index); });
  }

  function errorKey(s, name) {
    var e = s.err;
    if (!e) return true;
    if (name === 'left' || name === 'right') { e.index = U.clamp(e.index + (name === 'right' ? 1 : -1), 0, e.btns.length - 1); renderError(s); return true; }
    if (name === 'back' || name === 'stop') { stop('back'); return true; }
    if (name !== 'enter') return true;
    var b = e.btns[e.index];
    if (b.action === 'back') stop('back');
    else if (b.action === 'website') fallback(s, e.reason);
    else if (b.action === 'retry') {
      /* A fresh start (new file list, new stream links) that continues where the video stopped. */
      var req = s.req, hooks = s.hooks, at = s.errAt;
      finish(s, {});
      begin(req, hooks, '', at);
    }
    return true;
  }

  /* ---------- keys ---------- */

  function sheetKey(s, name) {
    var sh = s.sheet;
    if (name === 'up' || name === 'down') { sh.index = U.clamp(sh.index + (name === 'down' ? 1 : -1), 0, sh.items.length - 1); renderSheet(s); return true; }
    if (name === 'enter') { chooseSheet(s); return true; }
    if (name === 'back' || name === 'left') { closeSheet(s); return true; }
    if (name === 'stop') { stop('stop'); return true; }
    return true;
  }

  function upNextKey(s, name) {
    var u = s.upnext;
    if (name === 'left' || name === 'right') { u.focus = name === 'right' ? 1 : 0; renderUpNext(s); return true; }
    if (name === 'enter') { if (u.focus === 0) playNext(s, 'play-now'); else hideUpNext(s, true); return true; }
    if (name === 'back') { hideUpNext(s, true); return true; }
    if (name === 'up' || name === 'down' || name === 'info') return true;
    return false;
  }

  function handleKey(name, ev) {
    var s = S;
    if (name === 'backspace') name = 'back';
    if (!s) { if (name === 'back' || name === 'stop') stop('back'); return true; }
    if (s.state === 'error') return errorKey(s, name);
    if (s.state === 'loading') { if (name === 'back' || name === 'stop') stop(name === 'stop' ? 'stop' : 'back'); return true; }
    if (s.sheet) return sheetKey(s, name);
    if (s.upnext && s.upnext.visible && upNextKey(s, name)) return true;
    var onButtons = s.osd && s.area === 'buttons';
    switch (name) {
      case 'back': stop('back'); return true;
      case 'stop': stop('stop'); return true;
      case 'enter':
        if (ui.skip && U.hasClass(ui.skip, 'is-on')) { skipIntro(s); return true; }
        if (onButtons) { activate(s, s.btn); showOsd(s); return true; }
        togglePlay(s);
        return true;
      case 'space': case 'playpause': togglePlay(s); return true;
      case 'play': if (paused() || s.blocked) togglePlay(s); else showOsd(s); return true;
      case 'pause': if (!paused()) togglePlay(s); else showOsd(s); return true;
      case 'left': case 'right':
        if (onButtons) { moveButton(s, name === 'right' ? 1 : -1); showOsd(s); return true; }
        seekBy(s, name === 'right' ? 1 : -1, ev);
        return true;
      case 'ff': seekBy(s, 1, ev); return true;
      case 'rw': seekBy(s, -1, ev); return true;
      case 'up':
        showOsd(s);
        if (onButtons) setArea(s, 'scrub');
        return true;
      case 'down':
        if (s.chipStartOver) { hideChip(s); showOsd(s); setArea(s, 'buttons', 'start-over'); return true; }
        showOsd(s);
        setArea(s, 'buttons');
        return true;
      case 'chup':
        if (s.next) playNext(s, 'channel-up'); else showChip(s, 'This is the latest episode', 3000, false);
        return true;
      case 'chdown': previousEpisode(s); return true;
      case 'info':
        if (s.osd) hideOsd(s, true); else showOsd(s);
        return true;
      default:
        showOsd(s);
        return true;
    }
  }

  /* ---------- public API ---------- */

  /* Returns false (and leaves nothing on screen, calling no hook) when playback could not even start: the caller
     then runs the website path itself. Called while active, it replaces the session in the same overlay. */
  function play(req, hooks) {
    if (!req || typeof req !== 'object' || req.id == null || !/\d/.test(String(req.id))) return false;
    hooks = hooks || {};
    var opening = !ui;
    unattended = 0; /* the viewer asked for this title */
    try {
      if (S) finish(S, { why: 'replaced' });
      if (opening) {
        var mount = hooks.mount && hooks.mount.nodeType === 1 ? hooks.mount : (document.getElementById('mbptv') || document.body);
        build(mount);
      }
      begin(req, hooks);
    } catch (e) {
      Log.error('player:play', e);
      gen++;
      S = null;
      try { keepAwake(false); teardownUi(); } catch (e2) {}
      if (!opening) hook(hooks, 'onClose', { reason: 'internal', over: 0 });
      return false;
    }
    if (opening) hook(hooks, 'onOpen');
    return true;
  }

  function active() { return !!ui; }

  function key(name, ev) {
    if (!ui || !name) return false;
    ev = ev || {};
    unattended = 0; /* someone is there */
    /* A held OK would toggle pause on every repeat, a held Back would close the player and then hand its repeats to
       the App: keys that act once ignore auto-repeat (they still belong to the player). */
    if (ev.repeat && ONCE[name]) return true;
    try { return handleKey(name, ev); } catch (e) {
      Log.error('player-key:' + name, e);
      return true;
    }
  }

  /* Saves progress, tears the video and overlay down and calls hooks.onClose(info) once. Idempotent. */
  function stop(reason) {
    if (!ui) return false;
    var s = S, hooks = s ? s.hooks : null;
    var info = s ? (finish(s, { why: reason || 'stop' }) || snapshot(s)) : null;
    gen++;
    S = null;
    clearTimeout(chipTimer);
    keepAwake(false);
    teardownUi();
    info = info || {};
    info.reason = String(reason || 'stop');
    info.over = s && s.lastSent ? toInt(String(s.lastSent).split(':')[1]) : 0;
    Log.info('player', 'closed (' + info.reason + ')');
    hook(hooks, 'onClose', info);
    return true;
  }

  function info() { return S ? snapshot(S) : null; }

  function configure(opts) {
    if (opts) for (var k in opts) if (opts.hasOwnProperty(k) && CFG.hasOwnProperty(k) && typeof opts[k] === 'number' && opts[k] >= 0) CFG[k] = opts[k];
    var out = {};
    for (var c in CFG) if (CFG.hasOwnProperty(c)) out[c] = CFG[c];
    return out;
  }

  function guarded(name, fn, fallbackValue) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) {
        Log.error('player:' + name, e);
        return fallbackValue;
      }
    };
  }

  return {
    play: guarded('play', play, false),
    active: active,
    key: key,
    stop: guarded('stop', stop, false),
    info: guarded('info', info, null),
    configure: guarded('configure', configure, null),
    /* Pure helpers, exposed for tests and diagnostics. */
    _parse: guarded('parse', parse, null),
    _order: guarded('order', order, [])
  };
}());
