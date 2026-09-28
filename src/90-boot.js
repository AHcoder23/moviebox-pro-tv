/* Boot: survive early, repeated and foreign-world injection; never leave the website covered by a broken shell. */
var Boot = (function () {
  var started = false, waited = 0, pollTimer = null;

  function isTopFrame() {
    try { return window.top === window.self; } catch (e) { return false; }
  }

  /* Section 7. A movieboxpro.<tld> host (www or apex) or the configured start host always boots. Any other host (the
     site moved to a new domain, or the offline mock) boots only with the site's own signature, and never on a page
     with a password field or on a known third-party login host: the site's top navigation, the "Private Garden" gate
     (its login button plus a QR-code or code-login link), or a page title that ends with the site name. The check
     runs as soon as <body> exists, when only the head is certain to be parsed, so the title is the usual signal. */
  function looksLikeMovieBox() {
    var host = String(location.hostname || '').toLowerCase();
    if (/(^|\.)movieboxpro\.[a-z]{2,}$/.test(host)) return true;
    try {
      if (U.siteHost(host) === U.siteHost(U.parseUrl(START_URL).hostname)) return true;
    } catch (e) {}
    if (/(^|\.)(google|googleusercontent|gstatic|apple|facebook|microsoft|live|twitter|x)\.[a-z.]+$/.test(host)) return false;
    if (U.qs(document, 'input[type="password"]')) return false;
    if (document.getElementById('top_nav_home')) return true;
    if (U.qs(document, '.login_btn') && U.qs(document, 'a[href*="/index/login/qrcode"], a[href*="/index/login/code_login"]')) return true;
    return /(^|[|\-\u2013\u2014]\s*)MovieBox\s*Pro\s*$/i.test(U.text(document.title || ''));
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

  /* Removes every trace of the shell: its nodes (and stylesheet), the mbptv-* classes on <html> and <body> (the scroll
     lock, player and source-picker states) and any scroll lock, so the website is fully usable again. The flag
     html[data-mbptv=failed] stays, so no other injection retries on this page. */
  function teardown(reason) {
    Log.error('boot', reason);
    try { if (typeof App !== 'undefined' && App && App.kill) App.kill(); } catch (e0) {}
    try {
      var root = document.getElementById('mbptv');
      if (root) U.detach(root);
      U.each(U.qsa(document, '[id^="mbptv-"]'), function (n) { U.detach(n); });
      var h = document.documentElement;
      h.setAttribute('data-mbptv', 'failed');
      U.each([h, document.body], function (n) {
        if (!n || typeof n.className !== 'string') return;
        n.className = n.className.replace(/(^|\s)mbptv-[\w-]+/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
      });
      if (document.body) document.body.style.overflow = '';
      if (h.style && h.style.overflow === 'hidden') h.style.overflow = '';
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
