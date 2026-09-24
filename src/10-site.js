/* Site adapter (docs/ARCHITECTURE.md sections 3 and 5.2): pure extraction and URL helpers over any
   Document, live or DOMParser-made. Every public function is total: it catches internally and returns
   an empty-but-valid shape. Relative URLs are resolved explicitly against the page URL, because parsed
   documents keep the creating document's base. Nothing here runs at load time. */
var Site = (function () {
  var KEY_MARK = '__mbptvCardKey', ART_MARK = '__mbptvCardArt';
  var TARGET_SEL = 'a[href], [data-link], [data-href], [onclick]';
  var BG_SEL = '[style*="url("]';
  /* Site artwork that is never a poster: matched against the whole file name so random CDN hashes never collide. */
  var ICON_RE = /(?:_icon\.[a-z0-9]+$|^(?:4k|8k|blu-?ray|hdr)_?icon|^(?:score|freshness\d*|audience|imdb|play\d*|play_icon|tips|dislike\d*|like\d*|logo(?:_\d+)?|default_cover\d*|playlist_default|tv_chapter|placeholder|spacer|blank|close\d*|more\d*)\.[a-z0-9]+$)/i;
  var RUNTIME_RE = /(\d+)\s*(?:min|mins|minutes?)\b/i;
  var CERT_RE = /^(?:G|PG|PG-13|R|NC-17|NR|UR|X|M|MA|TV-(?:Y|Y7|Y7-FV|G|PG|14|MA)|Unrated|Not Rated|Approved|Passed|U|UA|A|\d{1,2}\+?)$/i;
  var QUALITY = { '8k': '8K', '4k': '4K', '2k': '1440p', fullhd: '1080p', fhd: '1080p', hd: '720p', sd: 'SD', org: 'Original', original: 'Original' };
  var BADGES = [[/4k[\s_-]*hdr/i, '4K HDR'], [/dolby[\s_-]*vision/i, 'Dolby Vision'], [/atmos/i, 'Atmos'], [/hdr/i, 'HDR'],
    [/8k/i, '8K'], [/4k|uhd/i, '4K'], [/blu-?ray/i, 'Blu-ray'], [/1080/i, '1080p']];
  var POPUPS = '.not_support_bg, .vip_pay_tips, .player_bg, .no_resource_bg, .season_bg';
  var CLOSE_SEL = '.close, .close2, .tips_close, .fav_close, .player_back, .search_close, [class*="close"]';
  var SKIP_NAME_CLS = /(?:^|\s)(?:score|tomato|update|time|progress_bar|count|episode|horizontal|list_img|speed|icon|avatar|avatar2)(?:\s|$)/;

  /* ---------- small helpers ---------- */

  /* Null-safe: U.qs/U.qsa fall back to the live document for a null root, which would leak live data into parsed docs. */
  function qs(root, sel) { return root ? U.qs(root, sel) : null; }
  function qsa(root, sel) { return root ? U.qsa(root, sel) : []; }
  function isArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function textOf(el) { return el ? U.text(el.textContent) : ''; }
  function attr(el, name) { try { return el && el.getAttribute ? (el.getAttribute(name) || '') : ''; } catch (e) { return ''; } }
  function cls(el) { return attr(el, 'class'); }
  function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
  function locHref() { try { return String(location.href || ''); } catch (e) { return ''; } }
  function httpish(u) { return /^https?:\/\//i.test(String(u || '')); }

  function decodeEntities(s) {
    return String(s == null ? '' : s).replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'");
  }

  function isLeaf(el) {
    var c = el && el.children;
    if (!c || !c.length) return true;
    for (var i = 0; i < c.length; i++) if (c[i].tagName !== 'BR') return false;
    return true;
  }

  function nextElement(el) {
    var n = el ? el.nextSibling : null;
    while (n && n.nodeType !== 1) n = n.nextSibling;
    return n;
  }

  function ownText(el) {
    var out = '';
    U.each(el ? el.childNodes : [], function (n) {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeType === 1 && n.tagName !== 'A') out += ' ' + n.textContent;
    });
    return U.text(out);
  }

  /* Text with <br> kept as line breaks. */
  function linesOf(el) {
    var out = '';
    U.each(el ? el.childNodes : [], function (n) {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeType === 1) out += n.tagName === 'BR' ? '\n' : linesOf(n);
    });
    return out;
  }

  function fileName(src) {
    var path = String(src || '').split(/[?#]/)[0];
    return path.slice(path.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/i, '');
  }

  function docTitle(doc) {
    var t = U.text(doc && doc.title);
    if (/^MovieBox\s*Pro$/i.test(t)) return '';
    return U.text(t.replace(/\s*[-|\u2013\u2014]\s*MovieBox\s*Pro\s*$/i, ''));
  }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/['\u2019`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'row';
  }

  function uniqueId(id, used) {
    var out = id, n = 2;
    while (used.hasOwnProperty(out)) out = id + '-' + (n++);
    used[out] = true;
    return out;
  }

  function uniqStrings(list, limit) {
    var out = [], seen = {};
    U.each(list, function (s) {
      s = U.text(s);
      var k = '$' + s.toLowerCase();
      if (!s || seen[k]) return;
      seen[k] = true;
      out.push(s);
      if (limit && out.length >= limit) return false;
    });
    return out;
  }

  /* ---------- URLs ---------- */

  var baseCache = { href: null, parsed: null };
  function parsedBase(base) {
    if (baseCache.href !== base) { baseCache.href = base; baseCache.parsed = U.parseUrl(base); }
    return baseCache.parsed;
  }

  function defaultBase() {
    var here = locHref();
    return httpish(here) ? here : String(START_URL);
  }

  /* The page URL a document was loaded from: explicit url, Api's stamp, the live location, or doc.URL. */
  function baseOf(doc, url) {
    if (httpish(url)) return String(url);
    try {
      var d = doc && doc.nodeType === 9 ? doc : (doc && doc.ownerDocument) || null;
      if (d && httpish(d.__mbptvUrl)) return String(d.__mbptvUrl);
      if (d && d === document) return defaultBase();
      if (d && httpish(d.URL)) return String(d.URL);
    } catch (e) {}
    return defaultBase();
  }

  /* Resolves url against base without relying on the document base (parsed documents have the wrong one). */
  function resolve(url, base) {
    var u = trim(decodeEntities(url));
    if (!u || /^(?:javascript|data|about|blob|mailto|tel):/i.test(u)) return '';
    var b = parsedBase(httpish(base) ? String(base) : defaultBase()), abs;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(u)) abs = u;
    else if (u.slice(0, 2) === '//') abs = b.protocol + u;
    else if (u.charAt(0) === '/') abs = b.origin + u;
    else if (u.charAt(0) === '?') abs = b.origin + b.pathname + u;
    else if (u.charAt(0) === '#') abs = b.origin + b.pathname + b.search + u;
    else abs = b.origin + b.pathname.replace(/[^\/]*$/, '') + u;
    return U.parseUrl(abs).href;
  }

  function originOf(base) {
    var b = httpish(base) ? parsedBase(String(base)) : null;
    return b && /^https?:$/.test(b.protocol) ? b.origin : siteOrigin();
  }

  function siteOrigin() {
    try { if (/^https?:$/.test(location.protocol)) return location.protocol + '//' + location.host; } catch (e) {}
    return U.parseUrl(String(START_URL)).origin;
  }

  var startHost = null;
  function hostOk(hostname, base) {
    var h = U.siteHost(hostname);
    if (!h) return false;
    try { if (h === U.siteHost(parsedBase(httpish(base) ? String(base) : defaultBase()).hostname)) return true; } catch (e) {}
    try { if (h === U.siteHost(location.hostname)) return true; } catch (e2) {}
    try { if (startHost === null) startHost = U.siteHost(U.parseUrl(String(START_URL)).hostname); } catch (e3) { startHost = ''; }
    return !!startHost && h === startHost;
  }

  /* Absolute same-site URL or ''. */
  function sameSiteUrl(url, base) {
    var abs = resolve(url, base);
    if (!abs) return '';
    var u = U.parseUrl(abs);
    return /^https?:$/.test(u.protocol) && hostOk(u.hostname, base) ? u.href : '';
  }

  function kindOf(kind) { return /^(?:movie|film)/i.test(String(kind || '')) ? 'movie' : 'tv'; }
  function titlePath(kind, id) { return (kindOf(kind) === 'movie' ? '/movie/' : '/tvshow/') + encodeURIComponent(String(id == null ? '' : id)); }
  function titleHref(kind, id, base) { return originOf(base) + titlePath(kind, id); }
  function playPath(kind, id, season, episode) {
    if (kindOf(kind) === 'movie') return titlePath(kind, id) + '?play=1';
    var q = '';
    if (toInt(season) > 0) q += 'season=' + toInt(season) + '&';
    if (toInt(episode) > 0) q += 'episode=' + toInt(episode) + '&';
    return titlePath(kind, id) + '?' + q + 'play=1';
  }

  function parseTitleUrl(str, base) {
    if (typeof str !== 'string' || !str) return null;
    var b = httpish(base) ? String(base) : defaultBase();
    var abs = resolve(str, b);
    if (!abs) return null;
    var u = U.parseUrl(abs);
    if (!/^https?:$/.test(u.protocol) || !hostOk(u.hostname, b)) return null;
    var path = (u.pathname || '/').replace(/\/+$/, ''), m, kind, id;
    if ((m = /^\/(movie|tvshow)\/(\d+)(?:[-_][^\/]*)?$/i.exec(path))) {
      kind = m[1].toLowerCase() === 'movie' ? 'movie' : 'tv';
      id = String(toInt(m[2]));
    } else if ((m = /^\/index\/index\/(tv)?detail$/i.exec(path)) && /^\d+$/.test(u.query.id || '')) {
      kind = m[1] ? 'tv' : 'movie';
      id = String(toInt(u.query.id));
    } else {
      return null;
    }
    if (id === '0') return null;
    return {
      kind: kind, id: id, key: kind + ':' + id,
      season: toInt(u.query.season), episode: toInt(u.query.episode),
      play: u.query.play === '1' || u.query.play === 'true'
    };
  }

  function onclickUrl(code) {
    if (!code) return '';
    code = decodeEntities(code);
    var m = /location(?:\.href)?\s*=\s*(['"])(.*?)\1/.exec(code) ||
      /location\.(?:assign|replace)\s*\(\s*(['"])(.*?)\1/.exec(code) ||
      /window\.open\s*\(\s*(['"])(.*?)\1/.exec(code);
    return m ? m[2] : '';
  }

  /* {url, p} for the first candidate on el that parses as a title URL. */
  function targetInfo(el, base) {
    if (!el || el.nodeType !== 1) return null;
    var cands = [attr(el, 'href'), attr(el, 'data-link'), attr(el, 'data-href'), onclickUrl(attr(el, 'onclick'))];
    for (var i = 0; i < cands.length; i++) {
      var c = trim(decodeEntities(cands[i]));
      if (!c || c.charAt(0) === '#' || /^javascript:/i.test(c)) continue;
      var p = parseTitleUrl(c, base);
      if (p) return { url: resolve(c, base), p: p };
    }
    return null;
  }

  /* ---------- images and normalisers ---------- */

  function realImage(src, base) {
    var u = trim(decodeEntities(src));
    if (!u || /^(?:data|javascript|about|blob):/i.test(u)) return '';
    var abs = resolve(u, base);
    if (!httpish(abs)) return '';
    var path = U.parseUrl(abs).pathname || '';
    if (/\/static\//i.test(path)) return '';
    if (ICON_RE.test(path.slice(path.lastIndexOf('/') + 1))) return '';
    return abs;
  }

  function styleUrls(style) {
    var out = [], re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/gi, m;
    style = decodeEntities(style);
    while ((m = re.exec(style))) out.push(m[1] || m[2] || m[3] || '');
    return out;
  }

  function firstReal(list, base) {
    for (var i = 0; i < list.length; i++) {
      var r = realImage(list[i], base);
      if (r) return r;
    }
    return '';
  }

  function imgUrl(img, base) {
    if (!img) return '';
    return firstReal([attr(img, 'data-src'), attr(img, 'data-original'), attr(img, 'data-lazy'), attr(img, 'src')], base);
  }

  function bgUrl(el, base) { return el ? firstReal(styleUrls(attr(el, 'style')), base) : ''; }

  function artOf(el, base) { return el && el.tagName === 'IMG' ? imgUrl(el, base) : bgUrl(el, base); }

  function normRating(s) {
    var t = U.text(s);
    if (!t || /-,-/.test(t) || /^[-\u2013]+%?$/.test(t) || /^n\/?a$/i.test(t) || /^0+(?:\.0+)?%?$/.test(t)) return '';
    return t;
  }

  function normRuntime(s) {
    s = U.text(s);
    var m = /^(\d+)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/i.exec(s);
    if (m) return (toInt(m[1]) * 60 + toInt(m[2])) + ' min';
    m = RUNTIME_RE.exec(s);
    return m && toInt(m[1]) > 0 ? toInt(m[1]) + ' min' : '';
  }

  function yearOf(s) {
    var m = /\b(?:18|19|20)\d\d\b/.exec(String(s || ''));
    return m ? m[0] : '';
  }

  function isGenreList(s) {
    s = U.text(s);
    if (!s || s.length > 200 || CERT_RE.test(s) || /\d/.test(s)) return false;
    if (!/^[A-Za-z][A-Za-z&'\-\/\s]*(?:,\s*[A-Za-z][A-Za-z&'\-\/\s]*)*,?$/.test(s)) return false;
    return s.indexOf(',') >= 0 || s === s.toUpperCase();
  }

  function splitGenres(s) {
    return uniqStrings(U.map(String(s || '').split(/\s*,\s*/), function (g) { return U.titleCase(g); }), 12);
  }

  function qualityOf(li) {
    var q = '';
    U.each(qsa(li, 'img'), function (img) {
      var m = /ic_choose_([a-z0-9]+)/i.exec(attr(img, 'src'));
      if (m && QUALITY.hasOwnProperty(m[1].toLowerCase())) { q = QUALITY[m[1].toLowerCase()]; return false; }
    });
    return q;
  }

  function qualityFromName(name) {
    if (/2160p|\b4k\b|\buhd\b/i.test(name)) return '4K';
    if (/1080p/i.test(name)) return '1080p';
    if (/720p/i.test(name)) return '720p';
    if (/480p|360p|\bsd\b/i.test(name)) return 'SD';
    return '';
  }

  /* ---------- card extraction ---------- */

  /* Our own shell never counts as site content when the live document is parsed. */
  function shellOf(root) {
    var doc = root && (root.nodeType === 9 ? root : root.ownerDocument);
    try { return doc && doc.getElementById ? doc.getElementById('mbptv') : null; } catch (e) { return null; }
  }

  function collectTargets(root, base) {
    var out = [], shell = shellOf(root);
    var els = qsa(root, TARGET_SEL);
    if (root && root.nodeType === 1 && U.matches(root, TARGET_SEL)) els.unshift(root);
    U.each(els, function (el) {
      if (shell && shell.contains(el)) return;
      var t = targetInfo(el, base);
      if (t) out.push({ el: el, p: t.p, key: t.p.key, url: t.url });
    });
    return out;
  }

  function nameFrom(root) {
    var cands = U.filter(qsa(root, 'p, span, h2, h3, h4, strong, b, div'), function (el) {
      if (!isLeaf(el) || SKIP_NAME_CLS.test(cls(el))) return false;
      if (U.closest(el, '.score, .tomato, .update, .schedule, .count', root)) return false;
      var t = U.text(el.textContent);
      return t.length >= 1 && t.length <= 150 && !/[|\uFF5C]/.test(t) && !/^[\d.,]+%?$/.test(t) &&
        !/^S\d+\s*E\d+$/i.test(t) && !/^\d{1,2}:\d\d(?::\d\d)?$/.test(t) && !/^Update to\b/i.test(t);
    });
    var strong = U.find(cands, function (el) { return U.hasClass(el, 'name') || /bold|font-size\s*:\s*1[6-9]px/i.test(attr(el, 'style')); });
    var pick = strong || cands[0];
    return pick ? U.text(pick.textContent) : '';
  }

  function titleFor(root, targets) {
    var t = U.text(attr(root, 'title'));
    var stop = root.parentNode || null;
    if (!t) U.each(targets, function (x) {
      var c = U.closest(x.el, '[title]', stop), v = c ? U.text(attr(c, 'title')) : '';
      if (v) { t = v; return false; }
    });
    if (!t) { var inner = qs(root, 'p[title], span[title], a[title], div[title], li[title]'); t = inner ? U.text(attr(inner, 'title')) : ''; }
    if (!t) t = nameFrom(root);
    if (!t) U.each(qsa(root, 'img[alt]'), function (img) { var a = U.text(attr(img, 'alt')); if (a && a.length > 1) { t = a; return false; } });
    /* A plain text link (history lists, fallback markup) names its title. */
    if (!t) U.each(targets, function (x) {
      if (x.el.tagName !== 'A' || qs(x.el, 'img, p, div, li')) return;
      var v = textOf(x.el);
      if (v && v.length <= 120 && !/^(?:more|play|watch|details?)$/i.test(v)) { t = v; return false; }
    });
    return t;
  }

  function metaFrom(root) {
    var cands = qsa(root, 'p, span, div');
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (!isLeaf(c)) continue;
      var t = c.textContent || '';
      if (/[|\uFF5C]/.test(t) && /\d/.test(t)) return parseMeta(linesOf(c));
    }
    return parseMeta('');
  }

  /* "7.8 | 2022 | 176 min <br>ACTION,CRIME" and the full-width "6.6 \uFF5C1994\uFF5C 94 minutes" variant. */
  function parseMeta(t) {
    var out = { rating: '', year: '', runtime: '', genres: [], update: '' };
    var lines = String(t || '').split('\n'), first = lines.shift() || '';
    U.each(first.split(/[|\uFF5C]/), function (raw, i) {
      var s = U.text(raw);
      if (!s) return;
      if (i === 0 && /^\d+(?:\.\d+)?$/.test(s)) { out.rating = normRating(s); return; }
      if (!out.year && /^(?:18|19|20)\d\d$/.test(s)) { out.year = s; return; }
      if (/^Update to\b/i.test(s)) { out.update = U.text(s.replace(/^Update to\s*/i, '')); return; }
      if (!out.runtime && normRuntime(s)) { out.runtime = normRuntime(s); return; }
      if (!out.genres.length && isGenreList(s)) out.genres = splitGenres(s);
    });
    var rest = U.text(lines.join(',')).replace(/^,+|,+$/g, '');
    if (rest && isGenreList(rest)) out.genres = splitGenres(rest);
    return out;
  }

  function posterFor(root, base) {
    var u = imgUrl(qs(root, 'img.cover'), base);
    if (!u) U.each(qsa(root, 'img'), function (img) { u = imgUrl(img, base); if (u) return false; });
    if (!u) u = bgUrl(root, base);
    if (!u) U.each(qsa(root, BG_SEL), function (el) { u = bgUrl(el, base); if (u) return false; });
    return u;
  }

  function badgeFor(root) {
    var b = '';
    U.each(qsa(root, 'img'), function (img) {
      var n = fileName(attr(img, 'src')).toLowerCase();
      if (/4k_icon/.test(n)) b = '4K';
      else if (/8k_icon/.test(n)) b = '8K';
      else if (/blu-?ray_icon/.test(n)) b = 'Blu-ray';
      else if (/hdr_icon/.test(n)) b = 'HDR';
      if (b) return false;
    });
    return b;
  }

  function progressFor(root) {
    var span = qs(root, '.progress_bar span') || qs(root, '.progress_bar');
    if (!span) return -1;
    var m = /width\s*:\s*([\d.]+)\s*%/i.exec(attr(span, 'style'));
    if (!m) return -1;
    var n = parseFloat(m[1]);
    return isNaN(n) ? -1 : U.clamp(n / 100, 0, 1);
  }

  function blankItem(kind, id, base) {
    return {
      key: kind + ':' + id, kind: kind, id: id, title: '', href: titleHref(kind, id, base), poster: '', backdrop: '',
      rating: '', tomato: '', year: '', runtime: '', genres: [], badge: '', update: '', progress: -1, progressLabel: '', playHref: ''
    };
  }

  /* Builds one Item from a card root. key (optional) restricts it to that title when the root holds others. */
  function itemFrom(root, base, key) {
    if (!root || root.nodeType !== 1) return null;
    var targets = collectTargets(root, base);
    if (key) targets = U.filter(targets, function (t) { return t.key === key; });
    if (!targets.length) return null;
    var main = U.find(targets, function (t) { return !t.p.play; }) || targets[0];
    var mainKey = main.key;
    targets = U.filter(targets, function (t) { return t.key === mainKey; });
    var item = blankItem(main.p.kind, main.p.id, base);
    var meta = metaFrom(root);
    item.title = titleFor(root, targets);
    item.poster = posterFor(root, base);
    item.rating = normRating(textOf(qs(root, '.score span') || qs(root, '.score'))) || meta.rating;
    item.tomato = normRating(textOf(qs(root, '.tomato span') || qs(root, '.tomato')));
    item.year = meta.year;
    item.runtime = meta.runtime;
    item.genres = meta.genres;
    item.badge = badgeFor(root);
    item.update = textOf(qs(root, '.update')) || meta.update;
    item.progress = progressFor(root);
    item.progressLabel = textOf(qs(root, '.schedule .time span') || qs(root, '.time span'));
    var play = U.find(targets, function (t) { return t.p.play; });
    if (play) item.playHref = originOf(base) + playPath(item.kind, item.id, play.p.season, play.p.episode);
    return item;
  }

  function richness(it) {
    var n = 0;
    U.each(['title', 'poster', 'backdrop', 'rating', 'tomato', 'year', 'runtime', 'badge', 'update', 'progressLabel', 'playHref'], function (f) { if (it[f]) n++; });
    if (it.genres && it.genres.length) n++;
    if (it.progress >= 0) n++;
    return n;
  }

  function dedupe(items) {
    var byKey = {}, order = [];
    U.each(items, function (it) {
      if (!it || !it.key) return;
      if (!byKey.hasOwnProperty(it.key)) { byKey[it.key] = it; order.push(it.key); }
      else if (richness(it) > richness(byKey[it.key])) byKey[it.key] = it;
    });
    return U.map(order, function (k) { return byKey[k]; });
  }

  function isPageLevel(n) { return !n || n.nodeType !== 1 || n.tagName === 'BODY' || n.tagName === 'HTML'; }

  function hasForeignLink(node, base) {
    var links = qsa(node, 'a[href]');
    for (var i = 0; i < links.length; i++) {
      var h = trim(attr(links[i], 'href'));
      if (!h || h.charAt(0) === '#' || /^javascript:/i.test(h)) continue;
      if (!parseTitleUrl(h, base)) return true;
    }
    return false;
  }

  /* Grow a card root a little when its wrapper still belongs only to this title (e.g. a title <p> beside the link). */
  function extendRoot(n, key, stop, base) {
    for (var i = 0; i < 2; i++) {
      var p = n.parentNode;
      if (!p || p === stop || isPageLevel(p) || p[KEY_MARK] !== key) break;
      if (p.getElementsByTagName('*').length > 40 || hasForeignLink(p, base)) break;
      n = p;
    }
    return n;
  }

  function cardRoot(t, stop, base) {
    var n = t.el.tagName === 'IMG' ? t.el.parentNode : t.el, best = null;
    while (n && n.nodeType === 1 && n !== stop && !isPageLevel(n)) {
      if (n[KEY_MARK] !== t.key) break;
      best = n;
      if (n[ART_MARK]) return extendRoot(n, t.key, stop, base);
      n = n.parentNode;
    }
    return best || t.el;
  }

  /* Generic extractor (section 5.2): every title link becomes a card rooted at the nearest ancestor that holds
     artwork without holding a different title. Works on parsed documents (no layout needed). */
  function cards(root, opts) {
    opts = opts || {};
    root = root || document;
    if (root.nodeType !== 1 && root.nodeType !== 9) return [];
    var doc = root.nodeType === 9 ? root : root.ownerDocument;
    var base = httpish(opts.base) ? String(opts.base) : baseOf(doc);
    var stop = root.nodeType === 9 ? null : root.parentNode;
    var targets = collectTargets(root, base);
    if (!targets.length) return [];
    var touched = [], found = [], roots = [];
    try {
      U.each(targets, function (t) {
        var mixed = false;
        for (var n = t.el; n && n.nodeType === 1 && n !== stop; n = n.parentNode) {
          var v = n[KEY_MARK];
          if (v === undefined) { n[KEY_MARK] = mixed ? '*' : t.key; touched.push(n); }
          else if (v === '*' || (v === t.key && !mixed)) break;
          else { n[KEY_MARK] = '*'; mixed = true; }
        }
      });
      var art = U.filter(qsa(root, 'img'), function (img) { return !!imgUrl(img, base); })
        .concat(U.filter(qsa(root, BG_SEL), function (el) { return !!bgUrl(el, base); }));
      if (root.nodeType === 1 && artOf(root, base)) art.push(root);
      U.each(art, function (a) {
        for (var n = a; n && n.nodeType === 1 && n !== stop; n = n.parentNode) {
          if (n[ART_MARK]) break;
          n[ART_MARK] = true;
          touched.push(n);
        }
      });
      U.each(targets, function (t) {
        var r = cardRoot(t, stop, base);
        if (U.indexOf(roots, r) >= 0) return;
        roots.push(r);
        found.push({ root: r, key: t.key });
      });
    } finally {
      U.each(touched, function (n) {
        try { delete n[KEY_MARK]; delete n[ART_MARK]; } catch (e) { n[KEY_MARK] = undefined; n[ART_MARK] = undefined; }
      });
    }
    var items = [];
    U.each(found, function (f) {
      if (opts.live && !U.isVisible(f.root)) return;
      var it = itemFrom(f.root, base, f.key);
      if (it) items.push(it);
    });
    return dedupe(items);
  }

  function nextFrom(doc, base) {
    var a = qs(doc, '.pagination li.next a[href]');
    if (!a) U.each(qsa(doc, '.pagination a[href], a[rel="next"]'), function (x) {
      var t = U.text(x.textContent);
      if (t === '\u00BB' || t === '\u203A' || /^next\b/i.test(t) || attr(x, 'rel') === 'next') { a = x; return false; }
    });
    if (!a) return '';
    var abs = sameSiteUrl(attr(a, 'href'), base);
    return abs && abs !== base ? abs : '';
  }

  /* ---------- page parsers ---------- */

  function bannersFrom(sec, base) {
    var out = [];
    U.each(qsa(sec, TARGET_SEL), function (el) {
      var t = targetInfo(el, base);
      if (!t) return;
      var image = bgUrl(el, base) || bgUrl(qs(el, BG_SEL), base) || imgUrl(qs(el, 'img'), base);
      if (!image) return;
      out.push({ key: t.p.key, kind: t.p.kind, id: t.p.id, href: titleHref(t.p.kind, t.p.id, base), image: image });
    });
    return out;
  }

  function home(doc, url) {
    var out = { rows: [], banners: [] };
    if (!doc || !doc.documentElement) return out;
    var base = baseOf(doc, url), used = {}, seenBanner = {};
    var sections = qsa(doc, '.contents .section');
    if (!sections.length) sections = qsa(doc, '.section');
    U.each(sections, function (sec) {
      var h3 = qs(sec, 'h3');
      if (!h3) {
        U.each(bannersFrom(sec, base), function (b) { if (!seenBanner[b.key]) { seenBanner[b.key] = true; out.banners.push(b); } });
        return;
      }
      var title = ownText(h3) || U.text(textOf(h3).replace(/\s*More\s*$/i, ''));
      var moreA = qs(h3, 'a[href]');
      var lis = qsa(sec, 'li[title]');
      var items = dedupe(U.map(lis, function (li) { return itemFrom(li, base); }));
      if (!items.length) items = cards(sec, { base: base });
      if (!items.length) return;
      out.rows.push({ id: uniqueId(slug(title), used), title: title, items: items, more: moreA ? sameSiteUrl(attr(moreA, 'href'), base) : '' });
    });
    if (!out.rows.length) {
      var all = cards(doc, { base: base });
      if (all.length) out.rows.push({ id: 'featured', title: 'Featured', items: all, more: '' });
    }
    var byKey = {};
    U.each(out.banners, function (b) { byKey[b.key] = b.image; });
    U.each(out.rows, function (row) {
      U.each(row.items, function (it) { if (!it.backdrop && byKey.hasOwnProperty(it.key)) it.backdrop = byKey[it.key]; });
    });
    return out;
  }

  function chipsFrom(doc, base) {
    var out = [], seen = {};
    function add(a, selected) {
      var href = sameSiteUrl(attr(a, 'href'), base), label = U.text(textOf(a));
      if (!href || !label || seen[href]) return;
      seen[href] = true;
      out.push({ label: label === label.toUpperCase() ? U.titleCase(label) : label, href: href, selected: !!selected });
    }
    U.each(qsa(doc, 'a[href*="top_list"]'), function (a) { add(a, false); });
    U.each(qsa(doc, '.fav_nav a[href]'), function (a) { add(a, qs(a, '.selected2') || U.hasClass(a, 'selected2')); });
    return out;
  }

  function list(doc, url) {
    var out = { title: '', items: [], next: '', chips: [] };
    if (!doc || !doc.documentElement) return out;
    var base = baseOf(doc, url);
    var head = qs(doc, 'span[style*="font-size:24px"], span[style*="font-size: 24px"]') || qs(doc, '.contents h1, .contents h2');
    out.title = textOf(head) || docTitle(doc);
    var scope = qs(doc, '.contents') || doc;
    out.items = cards(scope, { base: base });
    if (!out.items.length && scope !== doc) out.items = cards(doc, { base: base });
    out.next = nextFrom(doc, base);
    out.chips = chipsFrom(doc, base);
    return out;
  }

  function search(doc, url) {
    var out = { query: '', type: 'all', total: null, types: [], items: [], playlists: [], next: '', empty: true };
    if (!doc || !doc.documentElement) return out;
    var base = baseOf(doc, url), u = U.parseUrl(base);
    var input = qs(doc, '#top_search2') || qs(doc, '.result input[name="word"]');
    out.query = U.text(attr(input, 'value')) || U.text(u.query.word || '');
    var m = /([\d,]+)\s+results?\s+found/i.exec(doc.body ? doc.body.textContent : '');
    out.total = m ? toInt(m[1].replace(/,/g, '')) : null;
    if (!out.query) { var qm = /results?\s+found\s+for\s+["\u201C](.*?)["\u201D]/i.exec(doc.body ? doc.body.textContent : ''); if (qm) out.query = U.text(qm[1]); }
    var selected = '';
    U.each(qsa(doc, '.search_nav a[href]'), function (a) {
      var href = sameSiteUrl(attr(a, 'href'), base);
      var type = attr(qs(a, '[type]'), 'type') || (href ? U.parseUrl(href).query.type : '') || '';
      if (!type) return;
      var sel = !!(qs(a, '.selected2') || U.hasClass(a, 'selected2'));
      if (sel && !selected) selected = type;
      out.types.push({ type: type, label: U.titleCase(textOf(a)), href: href, selected: sel });
    });
    out.type = selected || U.text(u.query.type || '') || 'all';
    if (!selected) U.each(out.types, function (t) { t.selected = t.type === out.type; });
    var roots = U.filter(qsa(doc, '.search_info > a[href]'), function (a) { return !!targetInfo(a, base); });
    out.items = dedupe(U.map(roots, function (a) { return itemFrom(a, base); }));
    if (!out.items.length) out.items = cards(qs(doc, '.search_info') || qs(doc, '.result') || doc, { base: base });
    var pls = qsa(doc, '.playlists a[href*="/playlist/"]');
    if (!pls.length) pls = U.filter(qsa(doc, 'a[href*="/playlist/"]'), function (a) { return !!qs(a, '.name, .list_img'); });
    var seenPl = {};
    U.each(pls, function (a) {
      var href = sameSiteUrl(attr(a, 'href'), base);
      if (!href || seenPl[href]) return;
      seenPl[href] = true;
      out.playlists.push({
        title: textOf(qs(a, '.name')) || U.text(attr(a, 'title')) || textOf(a),
        href: href,
        image: bgUrl(qs(a, '.list_img'), base) || bgUrl(qs(a, BG_SEL), base) || imgUrl(qs(a, 'img'), base),
        count: textOf(qs(a, '.count'))
      });
    });
    out.next = nextFrom(doc, base);
    out.empty = out.items.length === 0;
    return out;
  }

  function source(li, index) {
    var file = '', size = '', date = '', longest = '';
    U.each(qsa(li, 'span'), function (s) {
      if (!isLeaf(s)) return;
      var t = U.text(s.textContent);
      if (!t) return;
      if (t.length > longest.length) longest = t;
      if (!size && /^\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB)$/i.test(t)) size = t;
      else if (!date && (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t) || /^\d{4}-\d{2}-\d{2}\b/.test(t))) date = t;
      else if (!file && /\.[a-z0-9]{2,4}$/i.test(t) && t.length > 4 && !/\d\s*[KMGT]?B\/s$/i.test(t)) file = t;
    });
    if (!file && longest !== size && longest !== date) file = longest;
    return { index: toInt(index), quality: qualityOf(li) || qualityFromName(file), file: file, size: size, date: date };
  }

  function titleFromDetailDoc(doc, base) {
    var nameA = qs(doc, '.movie_title a[href]');
    var t = nameA ? targetInfo(nameA, base) : null;
    if (t) return t.p;
    var play = attr(qs(doc, '.start_app[play]'), 'play');
    var id = /[?&]id=(\d+)/.exec(play);
    if (id) {
      var box = /box_type=(\d+)/.exec(play);
      var kind = box && box[1] === '2' ? 'tv' : 'movie';
      return { kind: kind, id: id[1], key: kind + ':' + id[1], season: 0, episode: 0, play: false };
    }
    return null;
  }

  function factsInto(info, d) {
    var leafs = U.filter(qsa(info, 'p'), isLeaf);
    var anchor = U.find(leafs, function (p) { var t = textOf(p); return /^Update to\b/i.test(t) || (t.length < 20 && !!normRuntime(t)); });
    var group = [];
    if (anchor && anchor.parentNode) group = U.filter(anchor.parentNode.children, function (c) { return c.tagName === 'P' && isLeaf(c); });
    if (!group.length) U.each(qsa(info, 'div'), function (div) {
      var ps = U.filter(div.children, function (c) { return c.tagName === 'P' && isLeaf(c); });
      if (ps.length >= 2 && ps.length <= 4 && U.find(ps, function (p) { var t = textOf(p); return CERT_RE.test(t) || isGenreList(t); })) { group = ps; return false; }
    });
    U.each(group, function (p) {
      var t = textOf(p);
      if (!t) return;
      if (/^Update to\b/i.test(t)) { if (!d.update) d.update = t; }
      else if (!d.runtime && t.length < 20 && normRuntime(t)) d.runtime = normRuntime(t);
      else if (!d.certification && CERT_RE.test(t)) d.certification = t;
      else if (!d.genres.length && isGenreList(t)) d.genres = splitGenres(t);
    });
  }

  function ratingsInto(doc, info, d) {
    var im = qs(info, 'a[href*="imdb."]') || qs(doc, 'a[href*="imdb."]');
    if (im) d.ratings.imdb = normRating(textOf(qs(im, 'div p') || qs(im, 'p')));
    var rts = qsa(info, 'a[href*="rottentomatoes"]');
    if (!rts.length) rts = qsa(doc, 'a[href*="rottentomatoes"]');
    var tomatoSeen = false, audienceSeen = false;
    U.each(rts, function (a) {
      var img = attr(qs(a, 'img'), 'src'), label = textOf(a);
      var v = normRating(textOf(qs(a, 'div p') || qs(a, 'p')));
      if (/audience/i.test(img) || /audience/i.test(label)) { if (!audienceSeen) { audienceSeen = true; d.ratings.audience = v; } }
      else if (!tomatoSeen) { tomatoSeen = true; d.ratings.tomato = v; }
    });
  }

  function overviewOf(info, d) {
    var best = '';
    U.each(qsa(info, 'p'), function (p) {
      if (!isLeaf(p)) return;
      var t = textOf(p);
      if (t.length >= 40 && t.length > best.length && t !== d.title && !/^Update to\b/i.test(t) && !isGenreList(t)) best = t;
    });
    return best;
  }

  function badgesInto(doc, info, d) {
    var imgs = qsa(info, 'img.style');
    if (!imgs.length) imgs = qsa(doc, 'img.style');
    U.each(imgs, function (img) {
      var n = fileName(attr(img, 'src'));
      for (var i = 0; i < BADGES.length; i++) {
        if (BADGES[i][0].test(n)) { if (U.indexOf(d.badges, BADGES[i][1]) < 0) d.badges.push(BADGES[i][1]); break; }
      }
    });
    var holder = imgs.length ? imgs[0].parentNode : null;
    if (holder) U.each(qsa(holder, 'span'), function (s) {
      var t = textOf(s);
      if (/^[A-Z]{2,4}(?:\s*[,\/&]\s*[A-Z]{2,4})*$/.test(t)) { d.audio = t; return false; }
    });
  }

  function castOf(doc, base) {
    var out = [], seen = {};
    U.each(qsa(doc, '.actor a'), function (a) {
      var per = qs(a, '.personnel');
      if (!per) return;
      var ps = U.filter(qsa(qs(per, '.left2') || per, 'p'), function (p) { return !U.hasClass(p, 'avatar') && !U.hasClass(p, 'avatar2'); });
      var name = textOf(ps[0]);
      if (!name || seen['$' + name]) return;
      seen['$' + name] = true;
      var character = textOf(ps[1]), job = U.titleCase(textOf(ps[2]));
      out.push({
        name: name, role: character || job, character: character, job: job,
        image: bgUrl(qs(per, '.avatar'), base) || imgUrl(qs(per, 'img'), base),
        href: sameSiteUrl(attr(a, 'href'), base)
      });
    });
    return out;
  }

  function relatedOf(doc, base, ownKey) {
    var items = U.map(qsa(doc, '.related .scroll_list a[href]'), function (a) { return itemFrom(a, base); });
    items = U.filter(items, function (it) { return !!it; });
    if (!items.length) U.each(qsa(doc, '.related'), function (r) {
      if (r.id === 'season' || qs(r, '.tv_episode')) return;
      items = items.concat(cards(r, { base: base }));
    });
    return dedupe(U.filter(items, function (it) { return it && it.key !== ownKey; }));
  }

  function seasonsInto(doc, base, d, urlSeason) {
    var box = qs(doc, '.season_bg .season_list2') || qs(doc, '.season_list2');
    var activeNum = 0;
    if (box) {
      var label = U.find(qsa(box, 'p.name2'), function (p) { return /season/i.test(textOf(p)); });
      var group = label ? nextElement(label) : null;
      while (group && group.tagName !== 'DIV') group = nextElement(group);
      U.each(group ? qsa(group, 'a[href]') : [], function (a) {
        var href = sameSiteUrl(attr(a, 'href'), base);
        var num = toInt(textOf(a)) || (href ? toInt(U.parseUrl(href).query.season) : 0);
        if (!num) return;
        if (qs(a, '.active') || U.hasClass(a, 'active')) activeNum = num;
        d.seasons.push({ number: num, href: href || titleHref('tv', d.id, base) + '?season=' + num, current: false });
      });
    }
    var titleM = /Season\s*(\d+)\s*\/\s*(\d+)/i.exec(textOf(qs(doc, '#season p.title')) || textOf(qs(doc, '#season .title')));
    d.season = activeNum || toInt(urlSeason) || (titleM ? toInt(titleM[1]) : 0);
    if (!d.seasons.length && titleM) {
      for (var n = 1; n <= Math.min(toInt(titleM[2]), 100); n++) d.seasons.push({ number: n, href: titleHref('tv', d.id, base) + '?season=' + n, current: false });
    }
    U.each(d.seasons, function (s) { s.current = s.number === d.season; });
  }

  function episodesOf(doc, base) {
    var out = [], seen = {};
    var list = qsa(doc, '#season .tv_episode');
    if (!list.length) list = qsa(doc, '.tv_episode');
    U.each(list, function (ep) {
      var btns = qsa(ep, '.start_app_episode');
      var code = textOf(qs(ep, 'span.episode') || qs(ep, '.episode'));
      var s = toInt(attr(btns[0], 'season')), e = toInt(attr(btns[0], 'episode'));
      var cm = /S(\d+)\s*E(\d+)/i.exec(code);
      if ((!s || !e) && cm) { s = toInt(cm[1]); e = toInt(cm[2]); }
      if (!e || seen[s + 'x' + e]) return;
      seen[s + 'x' + e] = true;
      var titleEl = btns.length > 1 ? qs(btns[1], 'p') : null;
      if (!titleEl) titleEl = U.find(qsa(ep, '.start_app_episode p'), function (p) { return !cls(p) && !!textOf(p); });
      var date = '', runtime = '', overview = '', dateP = null;
      var ps = U.filter(ep.children, function (c) { return c.tagName === 'P' && isLeaf(c); });
      U.each(ps, function (p) {
        var t = textOf(p);
        if (!dateP && (/\|/.test(t) || (t.length < 40 && RUNTIME_RE.test(t)))) {
          dateP = p;
          U.each(t.split(/\s*\|\s*/), function (part) {
            if (!runtime && normRuntime(part) && part.length < 20) runtime = normRuntime(part);
            else if (!date && part) date = U.text(part.replace(/\s*\([^)]*\)\s*$/, ''));
          });
        } else if (!overview && t && p !== dateP) {
          overview = t;
        }
      });
      out.push({
        season: s, episode: e, code: code || ('S' + s + 'E' + e), title: textOf(titleEl), date: date, runtime: runtime,
        overview: overview, still: bgUrl(qs(ep, '.chapter_img'), base) || imgUrl(qs(ep, 'img.still'), base),
        rating: normRating(textOf(qs(ep, '.score span') || qs(ep, '.score')))
      });
    });
    return out;
  }

  function blankDetail(kind, id, base) {
    return {
      kind: kind, id: id, key: kind + ':' + id, href: titleHref(kind, id, base), title: '', year: '', poster: '',
      backdrop: '', backdropOriginal: '', runtime: '', certification: '', genres: [], update: '',
      ratings: { imdb: '', tomato: '', audience: '' }, overview: '', badges: [], audio: '', playLabel: '',
      playHref: originOf(base) + playPath(kind, id, 0, 0), sources: [], cast: [], related: [],
      season: 0, seasons: [], episodes: [], partial: false
    };
  }

  /* The title page no longer matches any known markup: keep Play working from the URL, with what the head offers. */
  function minimalDetail(doc, base, p) {
    var title = U.text(attr(qs(doc, 'meta[property="og:title"]'), 'content')) || docTitle(doc) || textOf(qs(doc, 'h1'));
    if (!title) return null;
    var d = blankDetail(p.kind, p.id, base);
    d.partial = true;
    d.title = title;
    d.poster = realImage(attr(qs(doc, 'meta[property="og:image"]'), 'content'), base);
    d.overview = U.text(attr(qs(doc, 'meta[name="description"]'), 'content') || attr(qs(doc, 'meta[property="og:description"]'), 'content'));
    d.year = yearOf(textOf(qs(doc, '.year')));
    d.playLabel = 'PLAY';
    d.related = relatedOf(doc, base, d.key);
    return d;
  }

  function detail(doc, url) {
    if (!doc || !doc.documentElement || isGate(doc)) return null;
    var base = baseOf(doc, url);
    if (!qs(doc, '.movie_title, .info .cover, .start_app, .poster_bg')) {
      var stamped = httpish(url) ? url : (httpish(doc.__mbptvUrl) ? doc.__mbptvUrl : '');
      var sp = stamped ? parseTitleUrl(String(stamped), base) : null;
      if (!sp || qs(doc, '.search_info, .contents .section h3, .movies, .login_btn')) return null;
      return minimalDetail(doc, base, sp);
    }
    var p = (url ? parseTitleUrl(url, base) : null) || titleFromDetailDoc(doc, base) || parseTitleUrl(base, base);
    if (!p) return null;
    var kind = p.kind, id = p.id;
    var d = blankDetail(kind, id, base);
    var info = qs(doc, '.info') || doc.body || doc.documentElement;
    d.title = textOf(qs(doc, '.movie_title .name')) || textOf(qs(doc, '.movie_title')) || docTitle(doc);
    d.year = yearOf(textOf(qs(doc, '.year')));
    d.poster = imgUrl(qs(info, 'img.cover') || qs(doc, 'img.cover'), base);
    d.backdropOriginal = bgUrl(qs(doc, '.poster_bg'), base) || bgUrl(qs(qs(doc, '.poster_bg'), BG_SEL), base);
    d.backdrop = d.backdropOriginal.replace('/t/p/original/', '/t/p/w1280/');
    factsInto(info, d);
    ratingsInto(doc, info, d);
    d.overview = overviewOf(info, d) || U.text(attr(qs(doc, 'meta[name="description"]'), 'content'));
    badgesInto(doc, info, d);
    d.playLabel = textOf(qs(doc, '#save_progress')) || textOf(qs(doc, '.start_app .play span')) || textOf(qs(doc, '.start_app')) || 'PLAY';
    var lis = qsa(doc, '.sidebarbg2 li.play[oss_download_url]');
    if (!lis.length) lis = qsa(doc, '.sidebarbg2 li.play');
    d.sources = U.map(lis, function (li, i) { return source(li, i); });
    d.cast = castOf(doc, base);
    d.related = relatedOf(doc, base, d.key);
    if (kind === 'tv') {
      seasonsInto(doc, base, d, p.season);
      d.episodes = episodesOf(doc, base);
      if (!d.season && d.episodes.length) {
        d.season = d.episodes[0].season;
        U.each(d.seasons, function (s) { s.current = s.number === d.season; });
      }
    }
    return d;
  }

  function isGate(doc) {
    if (!doc || !doc.documentElement) return false;
    if (qs(doc, '#top_nav_home, #top_nav_movie, #top_nav_tv, .top-search-btn') || qs(doc, '.contents')) return false;
    if (qs(doc, '.login_btn') || qs(doc, 'a[href*="/index/login"]')) return true;
    return /private\s+garden/i.test(doc.title || '');
  }

  function pageType(loc, doc) {
    var href = '';
    if (typeof loc === 'string') href = loc;
    else if (loc && loc.href) href = String(loc.href);
    if (!href && doc) href = baseOf(doc);
    var u = U.parseUrl(resolve(href || defaultBase(), defaultBase()) || defaultBase());
    var path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    if (/^\/index\/login(?:\/|$)/i.test(path)) return 'login';
    if (doc && isGate(doc)) return 'gate';
    if (path === '/' || /^\/index(?:\/index(?:\/index)?)?$/i.test(path)) return 'home';
    if (/^\/index\/search$/i.test(path)) return 'search';
    var t = parseTitleUrl(u.href, u.href);
    if (t) return t.kind === 'movie' ? 'movie' : 'tv';
    if (/^\/index\/index\/(?:my_box|watching_list|fav_list|recommend_list)$/i.test(path)) return 'library';
    if (/^\/(?:movie|tvshow)$/i.test(path) || /^\/index\/index\/(?:movie_list|history)$/i.test(path) || /^\/index\/(?:movie|tv)\/top_list$/i.test(path)) return 'list';
    if (doc && doc.documentElement) {
      if (qs(doc, '.search_info, .search_nav')) return 'search';
      if (qs(doc, '.movie_title') && qs(doc, '.start_app_episode, .tv_episode')) return 'tv';
      if (qs(doc, '.movie_title')) return 'movie';
      if (qs(doc, '.contents .section h3')) return 'home';
    }
    return 'other';
  }

  /* ---------- JSON endpoints ---------- */

  function asData(input) { return typeof input === 'string' ? U.parseJSON(input) : input; }

  function namesOf(list) {
    return U.map(isArray(list) ? list : [], function (x) {
      return typeof x === 'string' ? x : (x && (x.name || x.title || x.word || x.key)) || '';
    });
  }

  function suggestions(jsonText) {
    var data = asData(jsonText);
    if (data && !isArray(data) && typeof data === 'object') data = data.data || data.list || data.result || null;
    return uniqStrings(namesOf(data), 50);
  }

  function hot(jsonText) {
    var out = { trending: [], recent: [] };
    var data = asData(jsonText), d = data && typeof data === 'object' ? (data.data || data) : null;
    if (!d || typeof d !== 'object') return out;
    out.trending = uniqStrings(namesOf(d.list || d.hot || []), 30);
    if (typeof d.html === 'string' && d.html) {
      var hd = U.parseHTML(d.html), keys = U.map(qsa(hd, '[key]'), function (el) { return attr(el, 'key'); });
      if (!keys.length) keys = U.map(qsa(hd, '.search_submit'), textOf);
      out.recent = uniqStrings(keys, 30);
    }
    return out;
  }

  /* ---------- diagnostics ---------- */

  var PROBES = {
    home: ['.contents .section', '.section h3', '.section li[title]'],
    search: ['.search_info'],
    list: ['.contents'],
    library: ['.contents', 'li[title]'],
    movie: ['.movie_title .name', '.info img.cover', '.poster_bg', '.start_app', '.sidebarbg2'],
    tv: ['.movie_title .name', '.info img.cover', '.start_app', '#season .tv_episode', '.season_list2'],
    gate: ['.login_btn']
  };

  function selfTest(doc, type) {
    var res = { ok: true, type: '', warnings: [], counts: {} };
    if (!doc || !doc.documentElement) { res.ok = false; res.warnings.push('no document'); return res; }
    type = type || pageType(null, doc);
    res.type = type;
    U.each(PROBES[type] || [], function (sel) {
      var n = qsa(doc, sel).length;
      res.counts[sel] = n;
      if (!n) res.warnings.push(type + ': no match for ' + sel);
    });
    var critical = false;
    if (type === 'home') {
      var h = home(doc);
      res.counts.rows = h.rows.length;
      res.counts.items = 0;
      U.each(h.rows, function (r) { res.counts.items += r.items.length; });
      res.counts.banners = h.banners.length;
      if (!h.rows.length) { critical = true; res.warnings.push('home: no rows'); }
    } else if (type === 'search') {
      var s = search(doc);
      res.counts.items = s.items.length;
      res.counts.types = s.types.length;
      res.counts.total = s.total == null ? -1 : s.total;
      if (s.total == null) res.warnings.push('search: result count not found');
      if (s.total == null && !s.items.length) critical = true;
      if (s.total > 0 && !s.items.length) { critical = true; res.warnings.push('search: total > 0 but no cards'); }
      if (s.total > 0 && !s.types.length) res.warnings.push('search: no type tabs');
    } else if (type === 'list' || type === 'library') {
      var l = list(doc);
      res.counts.items = l.items.length;
      res.counts.chips = l.chips.length;
      if (!l.items.length) res.warnings.push(type + ': no cards');
    } else if (type === 'movie' || type === 'tv') {
      var d = detail(doc);
      if (!d || !d.title) { critical = true; res.warnings.push(type + ': detail not parsed'); }
      else {
        res.counts.sources = d.sources.length;
        res.counts.cast = d.cast.length;
        res.counts.related = d.related.length;
        res.counts.episodes = d.episodes.length;
        res.counts.seasons = d.seasons.length;
        if (!d.poster) res.warnings.push(type + ': no poster');
        if (!d.backdrop) res.warnings.push(type + ': no backdrop');
        if (type === 'tv' && !d.episodes.length) res.warnings.push('tv: no episodes');
      }
    } else if (type === 'gate') {
      if (!isGate(doc)) { critical = true; res.warnings.push('gate: not recognised'); }
    }
    res.counts.cards = cards(doc).length;
    res.ok = !critical && res.warnings.length === 0;
    return res;
  }

  /* ---------- live page helpers (real page only) ---------- */

  function click(el) {
    if (!el) return false;
    try { if (typeof el.click === 'function') { el.click(); return true; } } catch (e) { Log.warn('site:click', e); }
    try {
      var ev = document.createEvent('MouseEvents');
      ev.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
      el.dispatchEvent(ev);
      return true;
    } catch (e2) {
      Log.warn('site:click-event', e2);
      return false;
    }
  }

  function visibleOnly(list) { return U.filter(list, function (el) { return U.isVisible(el); }); }

  /* Videos in visible same-origin iframes (the website may load its player page into one). Cross-origin frames
     throw on access and are skipped. */
  function frameVideos() {
    var out = [];
    U.each(visibleOnly(qsa(document, 'iframe')), function (f) {
      var d = null;
      try { d = f.contentDocument || (f.contentWindow && f.contentWindow.document) || null; } catch (e) { d = null; }
      if (!d || !d.documentElement) return;
      var fr = f.getBoundingClientRect();
      U.each(qsa(d, 'video'), function (v) {
        var r = v.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        var w = Math.min(r.width, fr.width), h = Math.min(r.height, fr.height);
        out.push({ v: v, area: w * h });
      });
    });
    return out;
  }

  function liveVideo() {
    var best = null, area = 0;
    U.each(visibleOnly(qsa(document, 'video')), function (v) {
      var r = v.getBoundingClientRect(), a = r.width * r.height;
      if (a > area) { area = a; best = v; }
    });
    U.each(frameVideos(), function (x) { if (x.area > area) { area = x.area; best = x.v; } });
    return best;
  }

  function videoArea(v) {
    if (!v) return 0;
    var r = v.getBoundingClientRect(), w = r.width, h = r.height;
    var win = v.ownerDocument && v.ownerDocument.defaultView;
    if (win && win !== window && win.frameElement) {
      var fr = win.frameElement.getBoundingClientRect();
      w = Math.min(w, fr.width); h = Math.min(h, fr.height);
    }
    return w * h;
  }

  function livePlayerOpen() {
    var dlg = document.getElementById('my_dialog');
    if (dlg && U.isVisible(dlg)) return true;
    var v = liveVideo();
    if (!v) return false;
    var vw = window.innerWidth || document.documentElement.clientWidth || 1;
    var vh = window.innerHeight || document.documentElement.clientHeight || 1;
    return videoArea(v) >= 0.4 * vw * vh;
  }

  function liveSourceItems() {
    var items = visibleOnly(qsa(document, '.sidebarbg2 li.play'));
    return items.length ? items : visibleOnly(qsa(document, '.sidebarbg2 li[oss_download_url]'));
  }

  var live = {
    click: click,
    playButton: function () {
      var all = qsa(document, '.start_app');
      return visibleOnly(all)[0] || all[0] || null;
    },
    episodeButton: function (season, episode) {
      var all = qsa(document, '.start_app_episode[season="' + toInt(season) + '"][episode="' + toInt(episode) + '"]');
      return U.find(all, function (el) { return U.hasClass(el, 'watch_tab'); }) || all[0] || null;
    },
    sourceItems: liveSourceItems,
    sourceList: function () {
      return U.map(liveSourceItems(), function (li, i) { var s = source(li, i); s.el = li; return s; });
    },
    sourcePickerOpen: function () { return visibleOnly(qsa(document, '.sidebarbg2')).length > 0; },
    closeSourcePicker: function () {
      var boxes = visibleOnly(qsa(document, '.sidebarbg2'));
      U.each(boxes, function (box) {
        var btn = visibleOnly(qsa(box, '.close'))[0] || qs(box, '.close');
        if (btn) click(qs(btn, 'img') || btn);
        if (U.isVisible(box)) box.style.display = 'none';
      });
      return visibleOnly(qsa(document, '.sidebarbg2')).length === 0;
    },
    playerOpen: livePlayerOpen,
    closePlayer: function () {
      var btn = document.getElementById('dialog_close') || qs(document, '#jw_player_close_pc img');
      if (btn) click(btn);
      if (!livePlayerOpen()) return true;
      U.each(qsa(document, 'video'), function (v) { try { v.pause(); } catch (e) {} });
      U.each(frameVideos(), function (x) { try { x.v.pause(); } catch (e2) {} });
      var dlg = document.getElementById('my_dialog');
      if (dlg) dlg.style.display = 'none';
      return !livePlayerOpen();
    },
    video: liveVideo,
    blockingPopups: function () { return visibleOnly(qsa(document, POPUPS)); },
    dismissPopup: function (el) {
      if (!el) return false;
      var btn = visibleOnly(qsa(el, CLOSE_SEL))[0] || qs(el, CLOSE_SEL);
      if (btn) click(btn.tagName === 'IMG' ? btn : (qs(btn, 'img') || btn));
      if (U.isVisible(el)) el.style.display = 'none';
      return !U.isVisible(el);
    }
  };

  /* ---------- URL builders (absolute, same origin as the live page) ---------- */

  function enc(v) { return encodeURIComponent(U.text(v)); }

  var url = {
    origin: function () { return siteOrigin(); },
    home: function () { return siteOrigin() + '/'; },
    movies: function () { return siteOrigin() + '/movie'; },
    shows: function () { return siteOrigin() + '/tvshow'; },
    library: function () { return siteOrigin() + '/index/index/my_box'; },
    history: function () { return siteOrigin() + '/index/index/history'; },
    list: function (type) { return siteOrigin() + '/index/index/movie_list?type=' + enc(type); },
    search: function (q, type, page) {
      return siteOrigin() + '/index/search?word=' + enc(q) + (type ? '&type=' + enc(type) : '') + (toInt(page) > 1 ? '&page=' + toInt(page) : '');
    },
    title: function (kind, id, season) {
      return siteOrigin() + titlePath(kind, id) + (kindOf(kind) === 'tv' && toInt(season) > 0 ? '?season=' + toInt(season) : '');
    },
    play: function (kind, id, season, episode) { return siteOrigin() + playPath(kind, id, season, episode); },
    suggest: function (q) { return siteOrigin() + '/index/search/autocomplate?q=' + enc(q) + '&limit=12'; },
    hot: function () { return siteOrigin() + '/index/api/search_hot'; },
    login: function () { return siteOrigin() + '/index/login'; },
    loginQr: function () { return siteOrigin() + '/index/login/qrcode'; },
    loginCode: function () { return siteOrigin() + '/index/login/code_login'; }
  };

  /* ---------- totality wrappers ---------- */

  function total(name, fn, fallback) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) {
        try { Log.warn('site:' + name, e); } catch (e2) {}
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }

  function wrapAll(obj, fallbacks, prefix, dflt) {
    var out = {};
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) out[k] = total(prefix + k, obj[k], fallbacks.hasOwnProperty(k) ? fallbacks[k] : dflt);
    }
    return out;
  }

  var emptyStr = function () { return ''; };

  return {
    parseTitleUrl: total('parseTitleUrl', parseTitleUrl, null),
    targetOf: total('targetOf', function (el, base) { var t = targetInfo(el, httpish(base) ? base : baseOf(el)); return t ? t.url : ''; }, emptyStr),
    cards: total('cards', cards, function () { return []; }),
    item: total('item', function (root, base) { return itemFrom(root, httpish(base) ? base : baseOf(root)); }, null),
    home: total('home', home, function () { return { rows: [], banners: [] }; }),
    list: total('list', list, function () { return { title: '', items: [], next: '', chips: [] }; }),
    search: total('search', search, function () { return { query: '', type: 'all', total: null, types: [], items: [], playlists: [], next: '', empty: true }; }),
    detail: total('detail', detail, null),
    source: total('source', source, function () { return { index: 0, quality: '', file: '', size: '', date: '' }; }),
    isGate: total('isGate', isGate, false),
    pageType: total('pageType', pageType, 'other'),
    suggestions: total('suggestions', suggestions, function () { return []; }),
    hot: total('hot', hot, function () { return { trending: [], recent: [] }; }),
    selfTest: total('selfTest', selfTest, function () { return { ok: false, type: '', warnings: ['selfTest failed'], counts: {} }; }),
    resolve: total('resolve', function (u, base) { return resolve(u, httpish(base) ? base : defaultBase()); }, emptyStr),
    baseOf: total('baseOf', baseOf, emptyStr),
    normalize: {
      rating: total('normRating', normRating, emptyStr),
      runtime: total('normRuntime', normRuntime, emptyStr),
      genres: total('splitGenres', splitGenres, function () { return []; }),
      image: total('realImage', function (u, base) { return realImage(u, httpish(base) ? base : defaultBase()); }, emptyStr),
      styleImage: total('styleImage', function (style, base) { return firstReal(styleUrls(style), httpish(base) ? base : defaultBase()); }, emptyStr)
    },
    url: wrapAll(url, {}, 'url.', emptyStr),
    live: wrapAll(live, {
      click: false, playButton: null, episodeButton: null, sourceItems: function () { return []; }, sourceList: function () { return []; },
      sourcePickerOpen: false, closeSourcePicker: false, playerOpen: false, closePlayer: false, video: null,
      blockingPopups: function () { return []; }, dismissPopup: false
    }, 'live.', null)
  };
}());
