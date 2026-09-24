// Offline stand-in for the MovieBox Pro website, built from test/fixtures.
// Used by tests and by `node tools/preview.cjs`. It never contacts the real site.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fixtures = path.join(root, 'test', 'fixtures');
const read = name => fs.readFileSync(path.join(fixtures, name), 'utf8');

// Rewrites third-party image hosts to local generated artwork so previews look real offline.
function localizeImages(html) {
  return html
    .replace(/https:\/\/thumb\.chuaxin\.com\//g, '/__img/thumb/')
    .replace(/https:\/\/images\.chuaxin\.com\//g, '/__img/images/')
    .replace(/https:\/\/image\.tmdb\.org\//g, '/__img/tmdb/')
    .replace(/https:\/\/i\.ytimg\.com\//g, '/__img/yt/');
}

const PALETTES = [['#1d2b53', '#7e2553'], ['#0f3b3a', '#c07a2c'], ['#2b1d3a', '#d0506a'], ['#12263f', '#3f8fd2'], ['#3a1f12', '#e39a3b'], ['#1b3322', '#7fbf5a'], ['#301934', '#8f6bd9'], ['#3b1414', '#e0503f']];
function hashOf(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function artwork(p) {
  const h = hashOf(p), [a, b] = PALETTES[h % PALETTES.length];
  const landscape = /tmdb|banner|ep_|yt|playlists/.test(p);
  const w = landscape ? 1280 : 500, ht = landscape ? 720 : 750;
  const cx = 120 + (h % 5) * 60, cy = 110 + (h % 7) * 40;
  const label = (p.match(/TEST_([a-z]+)_(\d+)/) || [, 'art', '']).slice(1).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${ht}" viewBox="0 0 ${w} ${ht}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>` +
    `<radialGradient id="r" cx="0.7" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/>` +
    `<circle cx="${w - cx}" cy="${cy}" r="${landscape ? 160 : 120}" fill="#fff" opacity=".08"/>` +
    `<path d="M0 ${ht * 0.72} Q ${w * 0.35} ${ht * 0.55} ${w} ${ht * 0.8} L ${w} ${ht} L 0 ${ht} Z" fill="#000" opacity=".35"/>` +
    `<text x="${w * 0.06}" y="${ht * 0.92}" fill="#fff" fill-opacity=".35" font-family="Arial" font-size="${landscape ? 36 : 30}">${label}</text></svg>`;
}

// Mock of the website's own jQuery behaviour, reduced to what the TV shell interacts with.
const SITE_SCRIPT = `
(function () {
  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function params() { var o = {}; location.search.replace(/^\\?/, '').split('&').forEach(function (p) { if (!p) return; var kv = p.split('='); o[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\\+/g, ' ')); }); return o; }
  window.mockLog = [];
  function log(e) { window.mockLog.push(e); }
  function silentWav(seconds) {
    var rate = 4000, n = rate * seconds, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    function s(o, str) { for (var i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); }
    s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    s(36, 'data'); v.setUint32(40, n, true); for (var i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function openPlayer(url) {
    log('player:' + url);
    var dlg = q('#my_dialog'); if (!dlg) return;
    dlg.style.display = 'block';
    dlg.style.cssText = 'display:block;position:fixed;left:0;top:0;width:100%;height:100%;background:#000;z-index:9998;';
    var closeBox = q('#jw_player_close_pc'); if (closeBox) closeBox.style.display = 'block';
    var panel = q('#player_panel'); panel.innerHTML = '';
    var v = document.createElement('video'); v.id = 'mock-video'; v.style.cssText = 'width:100%;height:100%;background:#111';
    v.src = silentWav(120); v.muted = true; panel.appendChild(v);
    setTimeout(function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); }, 50);
  }
  function closePlayer() {
    var dlg = q('#my_dialog'); if (!dlg) return;
    qa('video', dlg).forEach(function (v) { v.pause(); });
    dlg.style.display = 'none'; log('player:closed');
  }
  function showSources() {
    var items = qa('.sidebarbg2 ul li');
    if (items.length < 1) { alert('This video is not ready'); return; }
    if (items.length === 1) { openPlayer(items[0].getAttribute('oss_download_url')); return; }
    q('.sidebarbg2').style.cssText = 'display:block;position:fixed;right:0;top:0;bottom:0;width:420px;background:#222;z-index:9997;color:#fff';
    log('sources:shown');
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    var start = t.closest && t.closest('.start_app');
    var ep = t.closest && t.closest('.start_app_episode');
    var li = t.closest && t.closest('.sidebarbg2 ul li');
    var close = t.closest && t.closest('#dialog_close');
    var sclose = t.closest && t.closest('.sidebarbg2 .close');
    var search = t.closest && t.closest('.top-search-btn');
    if (start) { e.preventDefault(); log('click:start_app'); showSources(); }
    else if (ep) { e.preventDefault(); log('click:episode:' + ep.getAttribute('season') + 'x' + ep.getAttribute('episode')); setTimeout(showSources, 150); }
    else if (li) { e.preventDefault(); q('.sidebarbg2').style.display = 'none'; openPlayer(li.getAttribute('oss_download_url')); }
    else if (close) { e.preventDefault(); closePlayer(); }
    else if (sclose) { e.preventDefault(); q('.sidebarbg2').style.display = 'none'; }
    else if (search) { e.preventDefault(); var bg = q('.searchbg'); if (bg) bg.style.display = 'block'; var i = q('#top_search'); if (i) i.focus(); }
  }, false);
  var p = params();
  if (p.play === '1') setTimeout(function () {
    if (p.episode) { var el = q('.start_app_episode[episode="' + p.episode + '"]'); if (el) el.click(); }
    else { var s = q('.start_app'); if (s) s.click(); }
  }, 300);
}());`;

// The real pages load jQuery 1.7 and run inline `$(function () {...})` blocks (the gate page does). This is a small,
// working subset (ready, selector, click/on, show/hide, css, attr, each) so those inline scripts behave instead of
// throwing "$ is not defined". The TV shell itself never calls jQuery.
const JQUERY_STUB = `
(function () {
  function Wrap(nodes) { this.length = nodes.length; for (var i = 0; i < nodes.length; i++) this[i] = nodes[i]; }
  function each(w, fn) { for (var i = 0; i < w.length; i++) fn.call(w[i], i, w[i]); return w; }
  Wrap.prototype = {
    each: function (fn) { return each(this, fn); },
    on: function (type, fn) { return each(this, function (i, n) { n.addEventListener(String(type).split('.')[0], function (e) { if (fn.call(n, e) === false) { e.preventDefault(); e.stopPropagation(); } }, false); }); },
    click: function (fn) { return fn ? this.on('click', fn) : each(this, function (i, n) { n.click(); }); },
    hide: function () { return each(this, function (i, n) { n.style.display = 'none'; }); },
    show: function () { return each(this, function (i, n) { n.style.display = 'block'; }); },
    css: function (k, v) { if (v === undefined && typeof k === 'string') return this[0] ? getComputedStyle(this[0])[k] : undefined; return each(this, function (i, n) { if (typeof k === 'string') n.style[k] = v; else for (var p in k) n.style[p] = k[p]; }); },
    attr: function (k, v) { if (v === undefined) return this[0] ? this[0].getAttribute(k) : undefined; return each(this, function (i, n) { n.setAttribute(k, v); }); },
    addClass: function (c) { return each(this, function (i, n) { n.classList.add(c); }); },
    removeClass: function (c) { return each(this, function (i, n) { n.classList.remove(c); }); },
    find: function (s) { var out = []; each(this, function (i, n) { out = out.concat(Array.prototype.slice.call(n.querySelectorAll(s))); }); return new Wrap(out); }
  };
  function $(a) {
    if (typeof a === 'function') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { a($); }); else setTimeout(function () { a($); }, 0); return new Wrap([]); }
    if (typeof a === 'string') { try { return new Wrap(Array.prototype.slice.call(document.querySelectorAll(a))); } catch (e) { return new Wrap([]); } }
    if (a && a.nodeType) return new Wrap([a]);
    return new Wrap([]);
  }
  $.fn = Wrap.prototype;
  $.ajax = function () {};
  window.jQuery = window.$ = $;
}());`;

function pageFor(pathname, query, cookies) {
  if (cookies.mockgate === '1' && !pathname.startsWith('/index/login')) return { html: read('gate.html') };
  const page = parseInt(query.page || '1', 10) || 1;
  let m;
  if (pathname === '/' || pathname === '/index' || pathname === '/index/index') return { html: read('home.html') };
  if (pathname === '/index/search') {
    const word = query.word || '';
    if (!word.trim() || /zzq|noresult/i.test(word)) return { html: read('search-empty.html').replace(/zzqxjvnotatitle/g, escapeHtml(word)) };
    let html = read('search.html').replace(/batman/g, escapeHtml(word).replace(/&/g, '&amp;'));
    if (query.type === 'movie') html = html.replace(/<a href="\/tvshow\/[\s\S]*?<\/a>\s*/g, '');
    if (query.type === 'tv') html = html.replace(/<a href="\/movie\/[\s\S]*?<\/a>\s*/g, '');
    html = html.replace(/class="type selected2" type="all"/, 'class="type " type="all"').replace(new RegExp('class="type " type="' + (query.type || 'all') + '"'), 'class="type selected2" type="' + (query.type || 'all') + '"');
    return { html: paginate(html, page, 3) };
  }
  if ((m = pathname.match(/^\/movie\/(\d+)$/))) return { html: read('movie.html').replace(/40102/g, m[1]) };
  if ((m = pathname.match(/^\/tvshow\/(\d+)$/))) return { html: read('tvshow.html').replace(/556/g, m[1]) };
  if ((m = pathname.match(/^\/index\/index\/(tv)?detail$/))) return { redirect: (m[1] ? '/tvshow/' : '/movie/') + (query.id || '1') };
  if (pathname === '/movie' || pathname === '/tvshow' || /^\/index\/(movie|tv)\/top_list$/.test(pathname)) return { html: paginate(read('movies.html'), page, 3) };
  if (pathname === '/index/index/movie_list') return { html: paginate(read('list.html'), page, 3) };
  if (pathname === '/index/index/my_box' || /^\/index\/index\/(fav_list|recommend_list|watching_list)$/.test(pathname)) return { html: read('library.html') };
  // Watch history links use the legacy detail URLs (section 3); built from the list fixture's cards.
  if (pathname === '/index/index/history') {
    return { html: read('list.html').replace(/href="\/movie\/(\d+)"/g, 'href="/index/index/detail?id=$1"')
      .replace(/<ul class="pagination">[\s\S]*?<\/ul>/, '').replace(/Today.s Hot Movies/, 'History') };
  }
  if (pathname.startsWith('/index/login')) return { html: '<!doctype html><title>Login - MovieBoxPro</title><body style="background:#000;color:#fff"><h1>Mock login page</h1><a href="/__mock/signin">Finish sign in</a></body>' };
  return null;
}

// Makes page N distinct: title ids get a suffix and the "next" link advances until maxPage.
function paginate(html, page, maxPage) {
  if (page > 1) html = html.replace(/\/(movie|tvshow)\/(\d+)/g, (s, k, id) => `/${k}/${id}${page}0`).replace(/TEST_(movie|tv)_(\d+)/g, (s, k, id) => `TEST_${k}_${id}${page}0`);
  html = html.replace(/([?&;])page=\d+/g, (s, pre) => `${pre}page=${page + 1}`);
  if (page >= maxPage) html = html.replace(/<li(?: class="next")?><a href="[^"]*page=\d+">»<\/a><\/li>/g, '');
  return html;
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}

function start(opts = {}) {
  const tvjs = opts.tvjs || path.join(root, 'tv.js');
  const injectTag = opts.inject ? '<script src="/tv.js"></script>' : '';
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const query = Object.fromEntries(u.searchParams.entries());
    const cookies = parseCookies(req.headers.cookie);
    const send = (status, type, body, extra) => { res.writeHead(status, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store' }, extra || {})); res.end(body); };
    try {
      if (opts.delayMs && !u.pathname.startsWith('/__')) return setTimeout(() => handle(), opts.delayMs);
      return handle();
    } catch (e) { send(500, 'text/plain', String(e.stack || e)); }
    function handle() {
      if (u.pathname === '/tv.js') return send(200, 'application/javascript; charset=utf-8', fs.readFileSync(tvjs, 'utf8'));
      if (u.pathname === '/__mock/site.js') return send(200, 'application/javascript; charset=utf-8', SITE_SCRIPT);
      if (u.pathname === '/__mock/signout') return send(302, 'text/plain', '', { 'Set-Cookie': 'mockgate=1; Path=/', Location: '/' });
      if (u.pathname === '/__mock/signin') return send(302, 'text/plain', '', { 'Set-Cookie': 'mockgate=0; Path=/', Location: '/' });
      if (u.pathname.startsWith('/__img/')) return send(200, 'image/svg+xml', artwork(u.pathname));
      if (/^\/static\/js\/jquery[\w.-]*\.js$/.test(u.pathname)) return send(200, 'application/javascript', JQUERY_STUB);
      if (u.pathname.startsWith('/static/') && /.js$/.test(u.pathname)) return send(200, 'application/javascript', '/* site script omitted in mock */');
      if (u.pathname.startsWith('/static/')) return send(200, 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
      if (u.pathname === '/index/search/autocomplate') {
        if (cookies.mockgate === '1') return send(200, 'text/html; charset=utf-8', read('gate.html'));
        const q = (query.q || '').toLowerCase();
        const all = JSON.parse(read('autocomplete.json')).concat([{ name: (query.q || '') + ' Returns' }, { name: 'The ' + (query.q || '') }]);
        return send(200, 'application/json', JSON.stringify(q ? all.filter(x => x.name.toLowerCase().indexOf(q.slice(0, 2)) >= 0).slice(0, +(query.limit || 12)) : []));
      }
      if (u.pathname === '/index/api/search_hot') return send(200, 'application/json', read('search_hot.json'));
      const page = pageFor(u.pathname, query, cookies);
      if (!page) return send(404, 'text/html', '<!doctype html><title>Not found</title><body>Not found</body>');
      if (page.redirect) return send(302, 'text/plain', '', { Location: page.redirect });
      let html = localizeImages(page.html);
      html = html.replace(/<\/body>/i, '<script src="/__mock/site.js"></script></body>');
      if (injectTag) html = html.replace(/<head>/i, '<head>' + injectTag);
      return send(200, 'text/html; charset=utf-8', html);
    }
  });
  return new Promise(resolve => server.listen(opts.port || 0, '127.0.0.1', () => {
    const origin = 'http://127.0.0.1:' + server.address().port;
    resolve({ origin, server, close: () => new Promise(r => server.close(r)) });
  }));
}

module.exports = { start, artwork, localizeImages };

if (require.main === module) {
  const port = parseInt(process.argv[2] || '8940', 10);
  start({ port, inject: process.argv.indexOf('--no-inject') < 0 }).then(s => console.log('Mock MovieBox site with TV module: ' + s.origin + '/'));
}
