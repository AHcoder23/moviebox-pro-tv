// Boot robustness: src/00-core.js + src/90-boot.js with a stub App, injected the ways TizenBrew can inject it.
// Standalone: node test/boot.test.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('../tools/node_modules/playwright-core');
const { makeRunner, mockSite, TIZEN_UA, root } = require('./helpers.cjs');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const src = name => fs.readFileSync(path.join(root, 'src', name), 'utf8').replace(/\r\n/g, '\n');

// App.start variants. Each records its call in a DOM attribute so calls from every JS world are counted.
const STUB_OK = `
var App = {
  start: function () {
    var h = document.documentElement;
    h.setAttribute('data-stub-starts', String((+h.getAttribute('data-stub-starts') || 0) + 1));
    var r = document.createElement('div'); r.id = 'mbptv'; r.setAttribute('data-screen', 'home');
    document.body.appendChild(r);
  },
  state: function () { return {}; }
};`;
// Builds part of the shell, then throws: Boot must remove every trace and leave the site usable.
const STUB_THROW = `
var App = {
  start: function () {
    var h = document.documentElement;
    h.setAttribute('data-stub-starts', String((+h.getAttribute('data-stub-starts') || 0) + 1));
    var r = document.createElement('div'); r.id = 'mbptv'; r.setAttribute('data-screen', 'loading');
    r.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483000;background:#000';
    document.body.appendChild(r);
    var osd = document.createElement('div'); osd.id = 'mbptv-osd'; document.body.appendChild(osd);
    document.body.style.overflow = 'hidden';
    throw new Error('stub App.start failure');
  },
  state: function () { return {}; }
};`;
// Every other namespace (Site, Api, and whatever the other src files declare) becomes an inert stub:
// any property is callable and returns undefined, so Boot can pass them around without the real modules.
const OTHER_NAMESPACES = (() => {
  const names = new Set(['Site', 'Api']);
  for (const f of fs.readdirSync(path.join(root, 'src'))) {
    if (!/^\d\d-[\w-]+\.js$/.test(f) || f === '00-core.js' || f === '90-boot.js') continue;
    const re = /^var (\w+)\s*=/mg;
    let m;
    while ((m = re.exec(src(f)))) names.add(m[1]);
  }
  names.delete('App');
  return Array.from(names).sort();
})();
const STUB_DEPS = `
function __bootTestStub(name) {
  var target = function () { return undefined; };
  return new Proxy(target, {
    get: function (t, key) { return key === 'stub' ? true : key === Symbol.toPrimitive ? function () { return '[stub ' + name + ']'; } : __bootTestStub(name + '.' + String(key)); },
    apply: function () { return undefined; }
  });
}
${OTHER_NAMESPACES.map(n => 'var ' + n + ' = __bootTestStub(' + JSON.stringify(n) + ');').join('\n')}`;

// Same header as tools/build.cjs, so Boot sees the real VERSION / START_URL / CSS_TEXT names.
function bundle(stubApp) {
  const css = fs.readFileSync(path.join(root, 'src', 'shell.css'), 'utf8').replace(/\r\n/g, '\n');
  return [
    '/* boot test bundle */',
    '(function () {',
    "  'use strict';",
    '  var VERSION = ' + JSON.stringify(pkg.version) + ';',
    '  var START_URL = ' + JSON.stringify(pkg.websiteURL) + ';',
    '  var CSS_TEXT = ' + JSON.stringify(css) + ';',
    src('00-core.js'),
    STUB_DEPS,
    stubApp,
    src('90-boot.js'),
    '}());', ''
  ].join('\n');
}
const BUNDLE_OK = bundle(STUB_OK);
const BUNDLE_THROW = bundle(STUB_THROW);
fs.mkdirSync(path.join(root, 'test', 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'test', 'artifacts', 'boot-bundle.js'), BUNDLE_OK);

const EXE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));

// DNS is disabled for every host except 127.0.0.1, so foreign-host cases are served only by page.route and nothing leaves the machine.
async function launchOffline() {
  const opts = { headless: true, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] };
  if (process.env.PW_CHANNEL) opts.channel = process.env.PW_CHANNEL; else if (EXE) opts.executablePath = EXE;
  return chromium.launch(opts);
}

// opts: { scripts: [code...] (addInitScript, in order), probe: true }
async function open(browser, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: TIZEN_UA, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e && e.stack || e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (opts.probe !== false) {
    await context.addInitScript({ content: "try { if (window.top === window.self) window.__bodyAtInject = document.body ? 'present' : 'absent'; } catch (e) {}" });
  }
  for (const code of opts.scripts || []) await context.addInitScript({ content: code });
  return page;
}

async function domState(target) {
  return target.evaluate(() => ({
    roots: document.querySelectorAll('#mbptv').length,
    css: document.querySelectorAll('style#mbptv-css').length,
    extras: Array.prototype.map.call(document.querySelectorAll('[id^="mbptv-"]'), n => n.id).filter(id => id !== 'mbptv-css'),
    flag: document.documentElement.getAttribute('data-mbptv'),
    starts: +(document.documentElement.getAttribute('data-stub-starts') || 0),
    bodyAtInject: window.__bodyAtInject || '',
    ready: document.readyState
  }));
}

function expect(cond, message, state) {
  if (!cond) throw new Error(message + (state ? '\n       state: ' + JSON.stringify(state) : ''));
}

async function settle(page, ms = 700) {
  await page.waitForLoadState('load');
  await page.waitForTimeout(ms);
}

(async () => {
  const site = await mockSite.start();
  const browser = await launchOffline();
  const O = site.origin;
  const { test, run } = makeRunner('boot');
  const pages = [];
  const tracked = async opts => { const p = await open(browser, opts); pages.push(p); return p; };

  test('document-start injection (before <body> exists) boots exactly once after load', async () => {
    const page = await tracked({ scripts: [BUNDLE_OK] });
    await page.goto(O + '/');
    await settle(page);
    const s = await domState(page);
    expect(s.bodyAtInject === 'absent', 'expected the script to run before document.body existed', s);
    expect(s.roots === 1, 'expected exactly one #mbptv', s);
    expect(s.starts === 1, 'expected App.start to run once', s);
    expect(s.css === 1, 'expected one style#mbptv-css', s);
    expect(s.flag === pkg.version, 'expected html[data-mbptv] to hold the version', s);
    const exposed = await page.evaluate(() => { const m = window.__mbptv; return m ? { version: m.version, keys: Object.keys(m).sort().join(',') } : null; });
    expect(exposed && exposed.version === pkg.version, 'expected window.__mbptv.version', exposed);
    expect(exposed.keys === 'Api,App,Log,Site,U,version', 'expected window.__mbptv = {version, App, Site, Api, Log, U}', exposed);
    expect(!page.errors.length, 'page errors: ' + page.errors.join(' | '));
  });

  test('double injection in the same world yields exactly one #mbptv', async () => {
    const page = await tracked({ scripts: [BUNDLE_OK, BUNDLE_OK] });
    await page.goto(O + '/');
    await settle(page);
    const s = await domState(page);
    expect(s.roots === 1 && s.starts === 1 && s.css === 1, 'expected one shell, one App.start and one stylesheet', s);
    expect(!page.errors.length, 'page errors: ' + page.errors.join(' | '));
  });

  test('TizenBrew-style CDP injection into every execution context (main world + isolated world + late) boots once', async () => {
    const page = await tracked({ scripts: [] });
    const cdp = await page.context().newCDPSession(page);
    const evaluated = [];
    cdp.on('Runtime.executionContextCreated', ev => {
      evaluated.push(ev.context.name || ev.context.auxData && ev.context.auxData.type || 'main');
      cdp.send('Runtime.evaluate', { expression: BUNDLE_OK, contextId: ev.context.id }).catch(() => {});
    });
    await cdp.send('Runtime.enable');
    await page.goto(O + '/');
    await page.waitForLoadState('load');
    const tree = await cdp.send('Page.getFrameTree');
    await cdp.send('Page.createIsolatedWorld', { frameId: tree.frameTree.frame.id, worldName: 'tizenbrew-like-world' });
    await page.waitForTimeout(900);
    const s = await domState(page);
    expect(evaluated.length >= 2, 'expected the bundle to be evaluated in at least two contexts, got ' + JSON.stringify(evaluated));
    expect(s.roots === 1 && s.starts === 1, 'expected one shell across all worlds', s);
    expect(!page.errors.length, 'page errors: ' + page.errors.join(' | '));
  });

  test('injection after the page finished loading still boots once', async () => {
    const page = await tracked({ scripts: [] });
    await page.goto(O + '/');
    await page.waitForLoadState('load');
    await page.evaluate(BUNDLE_OK);
    await page.evaluate(BUNDLE_OK);
    await page.waitForTimeout(300);
    const s = await domState(page);
    expect(s.roots === 1 && s.starts === 1, 'expected one shell after two late injections', s);
    expect(!page.errors.length, 'page errors: ' + page.errors.join(' | '));
  });

  test('iframe documents never get a shell (top frame still boots once)', async () => {
    const page = await tracked({ scripts: [BUNDLE_OK] });
    await page.route(O + '/__boot/frame-host', r => r.fulfill({
      status: 200, contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><head><title>MovieBoxPro</title></head><body><iframe id="f" src="/" style="width:800px;height:600px"></iframe></body></html>'
    }));
    await page.goto(O + '/__boot/frame-host');
    await page.waitForLoadState('load');
    const frame = page.frames().find(f => f !== page.mainFrame());
    expect(frame, 'expected the iframe to load');
    await frame.waitForLoadState('load');
    await page.waitForTimeout(700);
    const inner = await domState(frame);
    const outer = await domState(page);
    expect(inner.roots === 0 && inner.css === 0 && !inner.flag && inner.starts === 0, 'expected no shell, stylesheet or flag inside the iframe', inner);
    expect(inner.ready === 'complete', 'expected the iframe (the real home fixture) to have loaded', inner);
    expect(outer.roots === 1, 'expected the top frame to boot once', outer);
    expect(!page.errors.length, 'page errors: ' + page.errors.join(' | '));
  });

  test('non-MovieBox page on the mock origin (404 "Not found") is left untouched', async () => {
    const page = await tracked({ scripts: [BUNDLE_OK] });
    const res = await page.goto(O + '/definitely/not/a/page');
    expect(res && res.status() === 404, 'expected the mock 404 page, got ' + (res && res.status()));
    await settle(page);
    const s = await domState(page);
    expect(s.roots === 0 && s.css === 0 && s.starts === 0 && !s.flag, 'expected no shell, stylesheet, App.start or flag', s);
    expect(!page.errors.length, 'page errors: ' + page.errors.join(' | '));
  });

  test('third-party login host with MovieBox-like markup is left untouched', async () => {
    const page = await tracked({ scripts: [BUNDLE_OK] });
    await page.route('https://accounts.google.com/**', r => r.fulfill({
      status: 200, contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><head><title>Sign in to MovieBoxPro</title></head><body><div class="login_btn"><a href="/index/login">Sign in</a></div></body></html>'
    }));
    await page.goto('https://accounts.google.com/o/oauth2/auth?client=moviebox');
    await settle(page);
    const s = await domState(page);
    expect(s.roots === 0 && s.starts === 0 && !s.flag, 'expected no shell on accounts.google.com', s);
  });

  test('MovieBox hosts (www and apex) boot even when the page has no MovieBox markers', async () => {
    for (const url of ['https://www.movieboxpro.app/some/new/page', 'https://movieboxpro.app/']) {
      const page = await tracked({ scripts: [BUNDLE_OK] });
      await page.route(/^https:\/\/(www\.)?movieboxpro\.app\//, r => r.fulfill({
        status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><title>x</title></head><body><p>plain</p></body></html>'
      }));
      await page.goto(url);
      await settle(page);
      const s = await domState(page);
      expect(s.roots === 1 && s.starts === 1, 'expected one shell on ' + url, s);
    }
  });

  test('App.start throwing removes the shell, flags html[data-mbptv=failed] and leaves the site usable', async () => {
    const page = await tracked({ scripts: [BUNDLE_THROW, BUNDLE_THROW] });
    await page.goto(O + '/');
    await settle(page);
    const s = await domState(page);
    expect(s.starts === 1, 'expected exactly one boot attempt (the second injection must not retry)', s);
    expect(s.roots === 0, 'expected #mbptv to be removed', s);
    expect(s.extras.length === 0, 'expected every #mbptv-* element to be removed', s);
    expect(s.flag === 'failed', 'expected html[data-mbptv="failed"]', s);
    const usable = await page.evaluate(() => {
      const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      const btn = document.querySelector('.top-search-btn');
      if (btn) btn.click();
      const bg = document.querySelector('.searchbg');
      const log = JSON.parse(localStorage.getItem('mbptv:log:v1') || '[]');
      return {
        hitInsideShell: !!(hit && hit.closest && hit.closest('#mbptv')),
        overflow: document.body.style.overflow,
        siteClickWorked: !!(bg && bg.style.display === 'block'),
        bootErrorLogged: log.some(e => e.level === 'error' && /boot/.test(e.label) && /stub App\.start failure/.test(e.msg))
      };
    });
    expect(!usable.hitInsideShell && usable.overflow !== 'hidden', 'expected no overlay and no scroll lock', usable);
    expect(usable.siteClickWorked, "expected the website's own click handler to keep working", usable);
    expect(usable.bootErrorLogged, 'expected the failure in the persisted log (mbptv:log:v1)', usable);
    expect(!page.errors.length, 'expected the failure to be caught, but got page errors: ' + page.errors.join(' | '));
  });

  await run();
  for (const p of pages) await p.context().close().catch(() => {});
  await browser.close();
  await site.close();
})().catch(e => { console.error(e); process.exit(1); });
