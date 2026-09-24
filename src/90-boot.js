/* Boot: survive early, repeated and foreign-world injection; never leave the website covered by a broken shell. */
var Boot = (function () {
  var started = false, waited = 0, pollTimer = null;

  function isTopFrame() {
    try { return window.top === window.self; } catch (e) { return false; }
  }

  function looksLikeMovieBox() {
    var host = String(location.hostname || '').toLowerCase();
    if (/(^|\.)movieboxpro\./.test(host)) return true;
    if (/(^|\.)(google|googleusercontent|gstatic|apple|facebook|microsoft|live|twitter|x)\.[a-z.]+$/.test(host)) return false;
    try {
      if (U.siteHost(host) === U.siteHost(U.parseUrl(START_URL).hostname)) return true;
    } catch (e) {}
    return !!(document.getElementById('top_nav_home') || U.qs(document, '.start_app, .login_btn, .contents .section') ||
      /MovieBoxPro/i.test(document.title || ''));
  }

  function alreadyRunning() {
    var root = document.documentElement;
    return !!(document.getElementById('mbptv') || (root && root.getAttribute('data-mbptv')));
  }

  function injectStyles() {
    if (document.getElementById('mbptv-css')) return;
    var style = document.createElement('style');
    style.id = 'mbptv-css';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(CSS_TEXT));
    (document.head || document.documentElement).appendChild(style);
  }

  function teardown(reason) {
    Log.error('boot', reason);
    try {
      var root = document.getElementById('mbptv');
      if (root) U.detach(root);
      U.each(U.qsa(document, '[id^="mbptv-"]'), function (n) { if (n.id !== 'mbptv-css') U.detach(n); });
      document.documentElement.setAttribute('data-mbptv', 'failed');
      if (document.body) document.body.style.overflow = '';
    } catch (e) {}
  }

  function run() {
    if (started) return;
    if (!document.body || !document.documentElement) return;
    started = true;
    clearTimeout(pollTimer);
    /* Check and claim in one synchronous block: another world's copy runs on the same thread. */
    if (alreadyRunning() || !looksLikeMovieBox()) return;
    document.documentElement.setAttribute('data-mbptv', VERSION);
    try {
      injectStyles();
      Keys.register();
      window.__mbptv = { version: VERSION, App: App, Site: Site, Api: Api, Log: Log, U: U };
      Log.info('boot', VERSION + ' on ' + location.pathname + location.search);
      App.start({ url: location.href });
    } catch (e) {
      teardown(e);
    }
  }

  function poll() {
    if (started) return;
    if (document.body) { run(); return; }
    waited += 30;
    if (waited > 20000) return;
    pollTimer = setTimeout(poll, 30);
  }

  function start() {
    if (!isTopFrame()) return;
    try {
      if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', function () { try { run(); } catch (e) { teardown(e); } }, false);
        document.addEventListener('readystatechange', function () { try { if (document.readyState !== 'loading') run(); } catch (e) { teardown(e); } }, false);
      }
      poll();
    } catch (e) {
      try { Log.error('boot-start', e); } catch (e2) {}
    }
  }

  return { start: start, teardown: teardown, injectStyles: injectStyles };
}());

Boot.start();
