// Api, Prefs and Session tests (docs/ARCHITECTURE.md section 5.3), plus the kit's image and performance-mode helpers
// (section 6.1, 6.4). Standalone: node test/api.test.cjs
// Runs a bundle of src/00-core.js + 10-site.js + 20-api.js + 30-ui-kit.js on mock-site pages; requests are counted in
// Playwright. The page's user agent is a Tizen TV's, so performance mode 'auto' is on.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { launch, openPage, makeRunner, mockSite, root } = require('./helpers.cjs');

const FILES = ['00-core.js', '10-site.js', '20-api.js', '30-ui-kit.js'];
function bundle(origin) {
  return ['(function () {', "'use strict';", "var VERSION = 'test';", 'var START_URL = ' + JSON.stringify(origin + '/') + ';', "var CSS_TEXT = '';"]
    .concat(FILES.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')))
    .concat(['window.__data = { U: U, Site: Site, Api: Api, Prefs: Prefs, Session: Session, Store: Store, Log: Log, Kit: Kit };', '}());'])
    .join('\n');
}

const t = makeRunner('api');
let server, browser, page, origin, code;
let requests = [];

// Navigates, optionally wipes storage and runs a pre-script, then injects the bundle.
async function at(pathname, opts = {}) {
  await page.goto(origin + pathname);
  if (opts.clear !== false) await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  if (opts.pre) await page.addScriptTag({ content: opts.pre });
  page.errors.length = 0;
  requests = [];
  await page.addScriptTag({ content: code });
}

const count = re => requests.filter(u => re.test(u)).length;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Calls an Api function with a Node-style callback and resolves with {err, res, sync, calls}.
async function call(expr) {
  return page.evaluate(expr => new Promise(resolve => {
    const { Api, Site, Prefs, Session } = window.__data;
    let returned = false, calls = 0;
    const cb = (err, res) => { calls++; setTimeout(() => resolve({ err, res, sync: !returned, calls }), 60); };
    new Function('Api', 'Site', 'Prefs', 'Session', 'cb', expr)(Api, Site, Prefs, Session, cb);
    returned = true;
  }), expr);
}

t.test('fetchDoc: success returns {doc, url}, asynchronously, stamped with its URL', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => new Promise(resolve => {
    let returned = false;
    window.__data.Api.fetchDoc('/movie/40102', (err, res) => resolve({
      err, sync: !returned, url: res && res.url, title: res && res.doc.querySelector('.movie_title .name').textContent,
      stamp: res && res.doc.__mbptvUrl, liveUntouched: !!document.querySelector('.fav_nav')
    }));
    returned = true;
  }));
  assert.deepStrictEqual(r, { err: null, sync: false, url: origin + '/movie/40102', title: 'The Batman', stamp: origin + '/movie/40102', liveUntouched: true });
  assert.strictEqual(count(/\/movie\/40102$/), 1);
  assert.deepStrictEqual(page.errors, []);
});

t.test('fetchDoc: identical in-flight requests share one request and one document', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => new Promise(resolve => {
    const { Api } = window.__data, got = [];
    const done = () => { if (got.length === 2) resolve({ same: got[0].doc === got[1].doc, errs: got.map(g => g.err), shared: Api.stats().shared }); };
    Api.fetchDoc('/movie/40102', (err, res) => { got.push({ err, doc: res && res.doc }); done(); });
    Api.fetchDoc(location.origin + '/movie/40102', (err, res) => { got.push({ err, doc: res && res.doc }); done(); });
  }));
  assert.deepStrictEqual(r, { same: true, errs: [null, null], shared: 1 });
  assert.strictEqual(count(/\/movie\/40102$/), 1, 'one network request');
});

t.test('fetchDoc: 404, timeout, bad URL and non-JSON error shapes', async () => {
  await at('/index/index/my_box');
  const notFound = await call("Api.fetchDoc('/no-such-page', cb)");
  assert.deepStrictEqual(notFound.err, { code: 'http-404', status: 404, url: origin + '/no-such-page' });
  assert.strictEqual(notFound.calls, 1);
  assert.strictEqual(count(/no-such-page/), 1, '4xx is not retried');

  await page.route(/\/slow-page$/, route => { setTimeout(() => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>late</p>' }).catch(() => {}), 2500); });
  await page.evaluate(() => window.__data.Api.configure({ timeout: 400 }));
  const t0 = Date.now();
  const slow = await call("Api.fetchDoc('/slow-page', cb)");
  assert.strictEqual(slow.err.code, 'timeout');
  assert.strictEqual(slow.err.url, origin + '/slow-page');
  assert.ok(Date.now() - t0 < 2000, 'timed out promptly');
  assert.strictEqual(count(/slow-page/), 1, 'timeouts are not retried');
  await page.unroute(/\/slow-page$/);
  await page.evaluate(() => window.__data.Api.configure({ timeout: 15000 }));

  const bad = await call("Api.fetchDoc('https://evil.example.com/movie/1', cb)");
  assert.strictEqual(bad.err.code, 'bad-url');
  assert.strictEqual(bad.sync, false, 'errors are asynchronous too');
  assert.strictEqual(count(/evil\.example/), 0);

  await page.route(/\/not-json$/, route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'hello' }));
  const nj = await call("Api.fetchJSON('/not-json', cb)");
  assert.strictEqual(nj.err.code, 'bad-json');
  await page.unroute(/\/not-json$/);
  const js = await call("Api.fetchJSON('/index/api/search_hot', cb)");
  assert.strictEqual(js.err, null);
  assert.strictEqual(js.res.code, 1);
  assert.deepStrictEqual(page.errors, []);
});

t.test('fetchDoc: one retry on 5xx and on network errors', async () => {
  await at('/index/index/my_box');
  await page.evaluate(() => window.__data.Api.configure({ retryDelay: 50 }));
  let n = 0;
  await page.route(/\/flaky-page$/, route => {
    n++;
    if (n === 1) return route.fulfill({ status: 503, contentType: 'text/html', body: 'busy' });
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body><div class="contents"><p id="ok">ok</p></div></body></html>' });
  });
  const r = await page.evaluate(() => new Promise(resolve => window.__data.Api.fetchDoc('/flaky-page', (err, res) => resolve({ err, ok: res && res.doc.getElementById('ok').textContent }))));
  assert.deepStrictEqual(r, { err: null, ok: 'ok' });
  assert.strictEqual(n, 2);
  let m = 0;
  await page.route(/\/dropped-page$/, route => { m++; return m === 1 ? route.abort('connectionreset') : route.fulfill({ status: 200, contentType: 'text/html', body: '<div class="contents">x</div>' }); });
  const r2 = await call("Api.fetchDoc('/dropped-page', cb)");
  assert.strictEqual(r2.err, null);
  assert.strictEqual(m, 2);
  let k = 0;
  await page.route(/\/down-page$/, route => { k++; return route.fulfill({ status: 500, body: 'no' }); });
  const r3 = await call("Api.fetchDoc('/down-page', cb)");
  assert.deepStrictEqual([r3.err.code, r3.err.status, k], ['http-500', 500, 2], 'exactly one retry');
  const stats = await page.evaluate(() => window.__data.Api.stats());
  assert.strictEqual(stats.retries, 3);
  await page.unroute(/\/flaky-page$/);
  await page.unroute(/\/dropped-page$/);
  await page.unroute(/\/down-page$/);
});

t.test('signed out: fetchDoc, home, detail and suggest report signed-out; listener fires', async () => {
  await page.goto(origin + '/__mock/signout');
  try {
    page.errors.length = 0;
    requests = [];
    await page.addScriptTag({ content: code });
    const r = await page.evaluate(() => new Promise(resolve => {
      const { Api } = window.__data, out = { heard: 0 };
      Api.onSignedOut(() => { out.heard++; });
      let left = 4;
      const done = name => (err) => { out[name] = err && err.code; if (--left === 0) setTimeout(() => resolve(out), 50); };
      Api.fetchDoc('/movie/40102', done('doc'));
      Api.home(done('home'));
      Api.detail('movie', '1', done('detail'));
      Api.suggest('bat', done('suggest'));
    }));
    assert.deepStrictEqual(r, { heard: 4, doc: 'signed-out', home: 'signed-out', detail: 'signed-out', suggest: 'signed-out' });
  } finally {
    await page.goto(origin + '/__mock/signin');
  }
  await at('/index/index/my_box');
  const ok = await call("Api.fetchDoc('/movie/40102', cb)");
  assert.strictEqual(ok.err, null, 'signed back in');
});

t.test('search: paging to page 3, no next after; type filter; recent search recorded', async () => {
  await at('/index/index/my_box');
  const p1 = await call("Api.search('batman', 'all', 1, cb)");
  assert.strictEqual(p1.err, null);
  assert.deepStrictEqual([p1.res.page, p1.res.total, p1.res.items.length, p1.res.query, p1.res.type], [1, 164, 6, 'batman', 'all']);
  assert.strictEqual(p1.res.next, origin + '/index/search?word=batman&type=all&page=2');
  const p2 = await call("Api.search('batman', 'all', 2, cb)");
  assert.strictEqual(p2.res.items.length, 6);
  assert.strictEqual(p2.res.items[0].key, 'movie:4010220', 'page 2 has its own titles');
  assert.strictEqual(p2.res.next, origin + '/index/search?word=batman&type=all&page=3');
  const p3 = await call("Api.search('batman', 'all', 3, cb)");
  assert.strictEqual(p3.res.items.length, 6);
  assert.strictEqual(p3.res.next, '');
  assert.ok(count(/\/index\/search\?word=batman&type=all&page=3$/) === 1);
  const movies = await call("Api.search('batman', 'movie', 1, cb)");
  assert.deepStrictEqual(movies.res.items.map(i => i.kind), ['movie', 'movie', 'movie', 'movie']);
  assert.strictEqual(movies.res.type, 'movie');
  const empty = await call("Api.search('   ', 'all', 1, cb)");
  assert.deepStrictEqual([empty.err, empty.res.empty, empty.res.items.length, empty.sync], [null, true, 0, false]);
  const none = await call("Api.search('zzqxjvnotatitle', 'all', 1, cb)");
  assert.deepStrictEqual([none.res.empty, none.res.total], [true, 0]);
  assert.deepStrictEqual(await page.evaluate(() => window.__data.Api.recentSearches()), ['zzqxjvnotatitle', 'batman']);
});

t.test('suggest: only the latest query is delivered, stale responses are dropped', async () => {
  await at('/index/index/my_box');
  await page.route(/autocomplate\?q=bat&/, route => { setTimeout(() => route.continue().catch(() => {}), 400); });
  const r = await page.evaluate(() => new Promise(resolve => {
    const { Api } = window.__data, calls = [];
    Api.suggest('ba', (err, list) => calls.push(['ba', err, list]));
    Api.suggest('bat', (err, list) => calls.push(['bat', err, list]));
    setTimeout(() => resolve(calls), 1500);
  }));
  assert.strictEqual(r.length, 1, JSON.stringify(r));
  assert.strictEqual(r[0][0], 'bat');
  assert.strictEqual(r[0][1], null);
  assert.ok(r[0][2].indexOf('Batman Begins') >= 0, JSON.stringify(r[0][2]));
  assert.strictEqual(count(/autocomplate\?q=ba&limit=12$/), 1, 'the stale request still ran');
  await page.unroute(/autocomplate\?q=bat&/);
  const before = count(/autocomplate/);
  const cached = await call("Api.suggest('BAT', cb)");
  assert.strictEqual(cached.err, null);
  assert.ok(cached.res.indexOf('Batman Begins') >= 0);
  assert.strictEqual(count(/autocomplate/), before, 'served from the suggestion cache');
  const blank = await call("Api.suggest('  ', cb)");
  assert.deepStrictEqual([blank.err, blank.res, blank.sync], [null, [], false]);
  const cancelled = await page.evaluate(() => new Promise(resolve => {
    const { Api } = window.__data;
    let hit = false;
    Api.suggest('bato', () => { hit = true; });
    Api.cancelSuggest();
    setTimeout(() => resolve(hit), 600);
  }));
  assert.strictEqual(cancelled, false);
});

t.test('hot: trending and recent lists', async () => {
  await at('/index/index/my_box');
  const r = await call('Api.hot(cb)');
  assert.strictEqual(r.err, null);
  assert.strictEqual(r.res.trending.length, 10);
  assert.deepStrictEqual(r.res.recent, ['batman', 'Stranger Things', 'The Dictator']);
});

t.test('home, list and library through the Api', async () => {
  await at('/index/index/my_box');
  const h = await call('Api.home(cb)');
  assert.deepStrictEqual(h.res.rows.map(r => r.items.length), [3, 4, 2, 3]);
  assert.strictEqual(h.res.url, origin + '/');
  const l = await call("Api.list('/movie?page=2', cb)");
  assert.strictEqual(l.res.items[0].key, 'movie:8313720');
  assert.strictEqual(l.res.next, origin + '/movie?page=3');
  const lib = await call('Api.library(cb)');
  assert.deepStrictEqual(lib.res.items.map(i => i.key), ['tv:705', 'movie:5776']);
});

t.test('detail: parsed model, memory cache hit, Api.meta persisted to localStorage', async () => {
  await at('/index/index/my_box');
  const first = await call("Api.detail('movie', '40102', cb)");
  assert.strictEqual(first.err, null);
  assert.deepStrictEqual([first.res.title, first.res.sources.length, first.res.key, first.sync], ['The Batman', 2, 'movie:40102', false]);
  const second = await call("Api.detail('movie', 40102, cb)");
  assert.strictEqual(second.res.title, 'The Batman');
  assert.strictEqual(second.sync, false, 'cache hits are still asynchronous');
  assert.strictEqual(count(/\/movie\/40102$/), 1, 'second call served from memory');
  const meta = await page.evaluate(() => window.__data.Api.meta('movie:40102'));
  assert.deepStrictEqual(meta, {
    title: 'The Batman', year: '2022', backdrop: origin + '/__img/tmdb/t/p/w1280/TEST_backdrop_40102.jpg',
    poster: origin + '/__img/thumb/thumb_TEST_movie_40102.png', runtime: '176 min', certification: 'PG-13', genres: ['Action', 'Crime', 'Drama'],
    ratings: { imdb: '7.8', tomato: '85%', audience: '87%' },
    overview: first.res.overview
  });
  await page.evaluate(() => window.__data.Api.flush());
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mbptv:meta:v1')));
  assert.deepStrictEqual(stored.order, ['movie:40102']);
  assert.strictEqual(stored.items['movie:40102'].title, 'The Batman');
  // A new page load reads the persisted metadata without any request.
  await at('/index/index/my_box', { clear: false });
  const again = await page.evaluate(() => window.__data.Api.meta('movie:40102'));
  assert.strictEqual(again.title, 'The Batman');
  assert.strictEqual(requests.filter(u => /movie\/40102/.test(u)).length, 0);
  assert.strictEqual(await page.evaluate(() => window.__data.Api.meta('movie:1')), null);
  // Forced refresh and TV seasons.
  await call("Api.detail('movie', '40102', cb, { force: true })");
  assert.strictEqual(count(/\/movie\/40102$/), 1);
  const tv = await call("Api.detail('tv', '556', cb, { season: 2 })");
  // The season's episode list is Site's business (test/site.test.cjs, test/episodes.test.cjs); here: season 2 was asked
  // for, parsed and cached under the show's key.
  assert.deepStrictEqual([tv.res.season, tv.res.key], [2, 'tv:556']);
  assert.ok(tv.res.episodes.length >= 3 && tv.res.episodes.every(e => +e.season === 2), 'season 2 episodes: ' + JSON.stringify(tv.res.episodes.map(e => e.season + 'x' + e.episode)));
  assert.strictEqual(count(/\/tvshow\/556\?season=2$/), 1);
  const bad = await call("Api.detail('movie', '', cb)");
  assert.strictEqual(bad.err.code, 'bad-url');
});

t.test('detail cache: 14-day TTL, 420-character overviews, remember()', async () => {
  await at('/index/index/my_box');
  await page.evaluate(() => {
    const old = Date.now() - 15 * 24 * 3600 * 1000, fresh = Date.now() - 3600 * 1000;
    localStorage.setItem('mbptv:meta:v1', JSON.stringify({ v: 1, order: ['movie:1', 'movie:2'], items: {
      'movie:1': { t: old, title: 'Old' }, 'movie:2': { t: fresh, title: 'Fresh' } } }));
  });
  await at('/index/index/my_box', { clear: false });
  const r = await page.evaluate(() => {
    const { Api } = window.__data;
    const long = new Array(200).join('word ');
    const ok = Api.remember({ key: 'movie:3', title: 'Long', overview: long });
    return { old: Api.meta('movie:1'), fresh: Api.meta('movie:2') && Api.meta('movie:2').title, ok, clipped: Api.meta('movie:3').overview, noTitle: Api.remember({ key: 'movie:4' }) };
  });
  assert.strictEqual(r.old, null, 'expired entry dropped');
  assert.strictEqual(r.fresh, 'Fresh');
  assert.strictEqual(r.ok, true);
  assert.ok(r.clipped.length <= 420 && /…$/.test(r.clipped), r.clipped.length);
  assert.strictEqual(r.noTitle, false);
});

t.test('prefetch: one request in flight, newest pending wins, cached titles skipped', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => {
    const { Api } = window.__data;
    return [Api.prefetch({ kind: 'movie', id: '111' }), Api.prefetch({ kind: 'movie', id: '222' }), Api.prefetch({ key: 'movie:333' }), Api.prefetch(null)];
  });
  assert.deepStrictEqual(r, [true, true, true, false]);
  await page.waitForFunction(() => !!window.__data.Api.meta('movie:333'), null, { timeout: 5000 });
  await sleep(300);
  assert.strictEqual(count(/\/movie\/111$/), 1);
  assert.strictEqual(count(/\/movie\/222$/), 0, 'superseded prefetch never ran');
  assert.strictEqual(count(/\/movie\/333$/), 1);
  const m = await page.evaluate(() => ({ a: window.__data.Api.meta('movie:111'), b: window.__data.Api.meta('movie:222'), again: window.__data.Api.prefetch({ kind: 'movie', id: '111' }) }));
  assert.strictEqual(m.a.title, 'The Batman');
  assert.strictEqual(m.b, null);
  assert.strictEqual(m.again, false, 'cached titles are not fetched again');
  await sleep(200);
  assert.strictEqual(count(/\/movie\/111$/), 1);
  // A user request for the title being prefetched shares the same request.
  await page.evaluate(() => window.__data.Api.prefetch({ kind: 'tv', id: '777' }));
  const shared = await call("Api.detail('tv', '777', cb)");
  assert.strictEqual(shared.res.key, 'tv:777');
  assert.strictEqual(count(/\/tvshow\/777$/), 1);
});

t.test('prefetch callbacks: exactly once each — done, superseded, cached, invalid', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => new Promise(resolve => {
    const { Api } = window.__data, log = [];
    const cb = name => (err, d) => log.push([name, err && err.code, d && d.key, Date.now()]);
    let sync = true;
    Api.prefetch({ kind: 'movie', id: '501' }, cb('a'));
    Api.prefetch({ kind: 'movie', id: '501' }, cb('a2'));
    Api.prefetch({ kind: 'movie', id: '502' }, cb('b'));
    Api.prefetch({ kind: 'movie', id: '502' }, cb('b2'));
    Api.prefetch({ kind: 'movie', id: '503' }, cb('c'));
    Api.prefetch('junk', cb('bad'));
    const syncCount = log.length;
    sync = false;
    setTimeout(() => {
      Api.prefetch({ kind: 'movie', id: '503' }, cb('cached'));
      setTimeout(() => resolve({ syncCount, log: log.map(x => x.slice(0, 3)) }), 200);
    }, 1500);
  }));
  assert.strictEqual(r.syncCount, 0, 'never synchronous');
  const byName = {};
  for (const [name, code, key] of r.log) { assert.ok(!byName[name], 'called twice: ' + name); byName[name] = [code, key]; }
  assert.deepStrictEqual(byName, {
    a: [null, 'movie:501'], a2: [null, 'movie:501'], b: ['superseded', null], b2: ['superseded', null], c: [null, 'movie:503'],
    bad: ['bad-url', null], cached: [null, 'movie:503']
  });
  assert.strictEqual(count(/\/movie\/502$/), 0);
  assert.strictEqual(count(/\/movie\/501$/), 1);
  assert.strictEqual(count(/\/movie\/503$/), 1);
});

t.test('Prefs: defaults, validation, persistence and change events', async () => {
  await at('/index/index/my_box');
  const d = await page.evaluate(() => window.__data.Prefs.all());
  assert.deepStrictEqual(d, { quality: 'best', nativeRemote: true, nativePlayer: true, autoplayEpisodes: true, reduceMotion: false, performance: 'auto' });
  const r = await page.evaluate(() => new Promise(resolve => {
    const { Prefs } = window.__data, events = [];
    Prefs.onChange((name, value, old) => events.push([name, value, old]));
    const out = {
      setQ: Prefs.set('quality', '1080p'), bogus: Prefs.set('quality', '4320p'), setB: Prefs.set('reduceMotion', true), badBool: Prefs.set('nativeRemote', 'yes'),
      custom: Prefs.set('lastTab', 'movies'), fn: Prefs.set('x', function () {})
    };
    out.get = [Prefs.get('quality'), Prefs.get('reduceMotion'), Prefs.get('nativeRemote'), Prefs.get('lastTab'), Prefs.get('missing')];
    out.stored = JSON.parse(localStorage.getItem('mbptv:prefs:v1'));
    setTimeout(() => { out.events = events; resolve(out); }, 50);
  }));
  assert.deepStrictEqual([r.setQ, r.bogus, r.setB, r.badBool, r.custom], ['1080p', '1080p', true, true, 'movies']);
  assert.deepStrictEqual(r.get, ['1080p', true, true, 'movies', undefined]);
  assert.deepStrictEqual(r.stored, { quality: '1080p', nativeRemote: true, nativePlayer: true, autoplayEpisodes: true, reduceMotion: true, performance: 'auto', lastTab: 'movies' });
  assert.deepStrictEqual(r.events, [['quality', '1080p', 'best'], ['reduceMotion', true, false], ['lastTab', 'movies', undefined]]);
  await at('/index/index/my_box', { clear: false });
  assert.deepStrictEqual(await page.evaluate(() => [window.__data.Prefs.get('quality'), window.__data.Prefs.get('reduceMotion')]), ['1080p', true]);
  await page.evaluate(() => localStorage.setItem('mbptv:prefs:v1', '{"quality":"8k","nativePlayer":"no","performance":"max","autoplayEpisodes":1}'));
  await at('/index/index/my_box', { clear: false });
  assert.deepStrictEqual(await page.evaluate(() => window.__data.Prefs.all()), { quality: 'best', nativeRemote: true, nativePlayer: true, autoplayEpisodes: true, reduceMotion: false, performance: 'auto' }, 'invalid stored values fall back to defaults');
  // A TV where any setting changed before 0.3.1 stored the retired autoplayNext: false. It is ignored (and dropped on
  // the next write), so it can never switch episode autoplay off.
  await page.evaluate(() => localStorage.setItem('mbptv:prefs:v1', '{"quality":"720p","nativeRemote":true,"autoplayNext":false,"reduceMotion":false}'));
  await at('/index/index/my_box', { clear: false });
  const old = await page.evaluate(() => {
    const { Prefs } = window.__data;
    const out = { all: Prefs.all(), set: Prefs.set('autoplayNext', true) };
    Prefs.set('reduceMotion', true);
    out.stored = JSON.parse(localStorage.getItem('mbptv:prefs:v1'));
    return out;
  });
  assert.deepStrictEqual(old.all, { quality: '720p', nativeRemote: true, nativePlayer: true, autoplayEpisodes: true, reduceMotion: false, performance: 'auto' });
  assert.strictEqual(old.set, undefined, 'the retired key cannot be set again');
  assert.ok(!('autoplayNext' in old.stored), 'the retired key is dropped on the next write: ' + JSON.stringify(old.stored));
  await page.evaluate(() => localStorage.setItem('mbptv:prefs:v1', 'not json'));
  await at('/index/index/my_box', { clear: false });
  assert.strictEqual(await page.evaluate(() => window.__data.Prefs.get('quality')), 'best');
});

t.test('Prefs: choices, labels and describe() let Settings render any preference; next() cycles it', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => new Promise(resolve => {
    const { Prefs } = window.__data, events = [];
    Prefs.onChange((name, value, old) => events.push([name, value, old]));
    const out = {
      legacy: Prefs.choices(),
      quality: Prefs.choices('quality'),
      performance: Prefs.choices('performance'),
      nativePlayer: Prefs.choices('nativePlayer'),
      autoplay: Prefs.choices('autoplayEpisodes'),
      unknown: Prefs.choices('lastTab'),
      dPerf: Prefs.describe('performance'),
      dNative: Prefs.describe('nativePlayer'),
      dAuto: Prefs.describe('autoplayEpisodes'),
      dUnknown: Prefs.describe('nope'),
      label: [Prefs.label('performance', 'on'), Prefs.label('quality', 'ask'), Prefs.label('nativePlayer', false)]
    };
    out.cycle = [Prefs.next('performance'), Prefs.next('performance'), Prefs.next('performance'), Prefs.next('nativePlayer'), Prefs.next('nativePlayer')];
    out.after = Prefs.describe('performance');
    setTimeout(() => { out.events = events; resolve(out); }, 50);
  }));
  assert.deepStrictEqual(r.legacy, ['ask', 'best', '1080p', '720p'], 'choices() without a name keeps returning the quality values');
  assert.deepStrictEqual(r.quality.map(c => c.value), ['ask', 'best', '1080p', '720p']);
  assert.deepStrictEqual(r.quality.map(c => c.label), ['Ask every time', 'Best available', '1080p', '720p']);
  assert.deepStrictEqual(r.performance, [{ value: 'auto', label: 'Auto' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]);
  assert.deepStrictEqual(r.nativePlayer, [{ value: true, label: 'On' }, { value: false, label: 'Off' }]);
  assert.deepStrictEqual(r.autoplay, [{ value: true, label: 'On' }, { value: false, label: 'Off' }]);
  assert.deepStrictEqual(r.unknown, []);
  assert.strictEqual(r.dPerf.label, 'TV performance mode');
  assert.strictEqual(r.dPerf.value, 'auto');
  assert.strictEqual(r.dPerf.valueLabel, 'Auto');
  assert.strictEqual(r.dPerf.toggle, false);
  assert.ok(/TV/.test(r.dPerf.desc), r.dPerf.desc);
  assert.strictEqual(r.dNative.label, 'Built-in player');
  assert.strictEqual(r.dNative.toggle, true);
  assert.strictEqual(r.dNative.value, true);
  assert.strictEqual(r.dNative.valueLabel, 'On');
  assert.strictEqual(r.dAuto.label, 'Autoplay next episode');
  assert.strictEqual(r.dAuto.toggle, true);
  assert.strictEqual(r.dUnknown, null);
  assert.deepStrictEqual(r.label, ['On', 'Ask every time', 'Off']);
  assert.deepStrictEqual(r.cycle, ['on', 'off', 'auto', false, true]);
  assert.strictEqual(r.after.valueLabel, 'Auto');
  assert.deepStrictEqual(r.events, [['performance', 'on', 'auto'], ['performance', 'off', 'on'], ['performance', 'auto', 'off'], ['nativePlayer', false, true], ['nativePlayer', true, false]]);
  assert.deepStrictEqual(page.errors, []);
});

t.test('Session: save/take across a reload, expect matching, single use, 30-minute expiry', async () => {
  await at('/index/index/my_box');
  const saved = await page.evaluate(() => {
    const { Session } = window.__data;
    Session.save([{ screen: 'home' }, { screen: 'detail', params: { key: 'movie:1' } }], { expect: 'home', returnTo: location.origin + '/' });
    return Session.peek();
  });
  assert.deepStrictEqual([saved.expect, saved.returnTo, saved.stack.length], ['home', origin + '/', 2]);
  await at('/movie/1?play=1', { clear: false });
  const onPlay = await page.evaluate(() => ({ take: window.__data.Session.take('movie'), returnTo: window.__data.Session.returnTo() }));
  assert.deepStrictEqual(onPlay, { take: null, returnTo: origin + '/' }, 'a non-matching page leaves the session in place');
  await at('/', { clear: false });
  const onHome = await page.evaluate(() => ({ first: window.__data.Session.take('home'), second: window.__data.Session.take('home') }));
  assert.deepStrictEqual(onHome, { first: [{ screen: 'home' }, { screen: 'detail', params: { key: 'movie:1' } }], second: null });
  await at('/', { clear: false });
  assert.strictEqual(await page.evaluate(() => window.__data.Session.take('home')), null, 'single use survives reloads');
  // Default expect is the current page type.
  const dflt = await page.evaluate(() => { window.__data.Session.save(['x']); return window.__data.Session.peek().expect; });
  assert.strictEqual(dflt, 'home');
  // Expiry.
  await page.evaluate(() => sessionStorage.setItem('mbptv:session:v1', JSON.stringify({ v: 1, t: Date.now() - 31 * 60 * 1000, stack: ['old'], expect: 'home' })));
  await at('/', { clear: false });
  assert.deepStrictEqual(await page.evaluate(() => [window.__data.Session.take('home'), sessionStorage.getItem('mbptv:session:v1')]), [null, null]);
  await page.evaluate(() => sessionStorage.setItem('mbptv:session:v1', JSON.stringify({ v: 1, t: Date.now() - 29 * 60 * 1000, stack: ['recent'], expect: 'home' })));
  await at('/', { clear: false });
  assert.deepStrictEqual(await page.evaluate(() => window.__data.Session.take('home')), ['recent']);
  await page.evaluate(() => sessionStorage.setItem('mbptv:session:v1', '{"v":1,"t":"garbage"}'));
  await at('/', { clear: false });
  assert.strictEqual(await page.evaluate(() => window.__data.Session.take()), null);
  const circular = await page.evaluate(() => { const a = {}; a.self = a; const ok = window.__data.Session.save([a]); return [ok, window.__data.Session.peek().stack]; });
  assert.deepStrictEqual(circular, [true, []], 'unserialisable stacks degrade to empty');
});

t.test('recent searches: most recent first, case-insensitive dedupe, cap 12, merge with server', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => {
    const { Api } = window.__data;
    for (let i = 1; i <= 14; i++) Api.addRecentSearch('q' + i);
    Api.addRecentSearch('batman');
    Api.addRecentSearch('  BATMAN  ');
    Api.addRecentSearch('');
    return { list: Api.recentSearches(), merged: Api.mergeRecent(['Stranger Things', 'batman']), stored: JSON.parse(localStorage.getItem('mbptv:recent:v1')) };
  });
  assert.strictEqual(r.list.length, 12);
  assert.deepStrictEqual(r.list.slice(0, 3), ['BATMAN', 'q14', 'q13']);
  assert.deepStrictEqual(r.stored, r.list);
  assert.strictEqual(r.merged.length, 12);
  assert.deepStrictEqual(r.merged.slice(0, 2), ['BATMAN', 'q14']);
  await at('/index/index/my_box', { clear: false });
  assert.strictEqual(await page.evaluate(() => window.__data.Api.recentSearches()[0]), 'BATMAN');
  const merged = await page.evaluate(() => { window.__data.Api.clearRecentSearches(); window.__data.Api.addRecentSearch('local'); return window.__data.Api.mergeRecent(['server', 'LOCAL']); });
  assert.deepStrictEqual(merged, ['local', 'server']);
});

t.test('storage failures: throwing localStorage/sessionStorage and a full quota fall back to memory', async () => {
  const deny = `(function () {
    function boom() { throw new Error('SecurityError: storage disabled'); }
    Object.defineProperty(window, 'localStorage', { configurable: true, get: boom });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: boom });
  }());`;
  await at('/index/index/my_box', { pre: deny });
  const r = await page.evaluate(() => new Promise(resolve => {
    const { Api, Prefs, Session } = window.__data;
    const out = { prefs: Prefs.set('quality', '720p'), get: Prefs.get('quality'), recent: Api.addRecentSearch('offline'), session: Session.save(['a']) };
    out.take = Session.take(Session.peek().expect);
    Api.detail('movie', '40102', err => { out.err = err; Api.flush(); out.meta = Api.meta('movie:40102') && Api.meta('movie:40102').title; resolve(out); });
  }));
  assert.deepStrictEqual(r, { prefs: '720p', get: '720p', recent: ['offline'], session: true, take: ['a'], err: null, meta: 'The Batman' });
  assert.deepStrictEqual(page.errors, []);
  const quota = `(function () {
    Storage.prototype.setItem = function () { var e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; };
  }());`;
  await at('/index/index/my_box', { pre: quota });
  const q = await page.evaluate(() => {
    const { Api, Prefs, Session } = window.__data;
    Prefs.set('quality', 'ask');
    Prefs.set('quality', '1080p');
    Session.save(['s1'], { expect: 'library' });
    return { quality: Prefs.get('quality'), recent: Api.addRecentSearch('full disk'), recent2: Api.recentSearches(), take: Session.take('library') };
  });
  assert.deepStrictEqual(q, { quality: '1080p', recent: ['full disk'], recent2: ['full disk'], take: ['s1'] });
  assert.deepStrictEqual(page.errors, []);
});

t.test('guards: callbacks run exactly once even when they throw; bad input never throws', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => new Promise(resolve => {
    const { Api } = window.__data;
    let calls = 0;
    Api.fetchDoc('/movie/40102', () => { calls++; throw new Error('consumer bug'); });
    const results = [Api.meta(null), Api.meta({}), Api.prefetch('nonsense'), Api.prefetch({ kind: 'movie' }), Api.remember(null), Api.mergeRecent(null), Api.recentSearches().length];
    let threw = false;
    try { Api.fetchDoc(null, () => {}); Api.detail(null, null, () => {}); Api.search(null, null, null, () => {}); Api.suggest(null, () => {}); Api.list(undefined, () => {}); } catch (e) { threw = String(e); }
    setTimeout(() => resolve({ calls, results, threw }), 400);
  }));
  assert.deepStrictEqual(r, { calls: 1, results: [null, null, false, false, false, [], 0], threw: false });
  assert.strictEqual(page.errors.length, 1, 'the consumer exception is logged, not swallowed silently');
  assert.ok(/consumer bug/.test(page.errors[0]));
});

t.test('Session.touch keeps a saved record valid while the viewer watches past the 30-minute TTL', async () => {
  await at('/index/index/my_box');
  // A record saved 29 minutes ago is still valid; touch() makes it fresh, so it survives another 29 minutes.
  await page.evaluate(() => sessionStorage.setItem('mbptv:session:v1', JSON.stringify({ v: 1, t: Date.now() - 29 * 60 * 1000, stack: ['home', 'search'], expect: 'home', returnTo: location.origin + '/' })));
  await at('/movie/1?play=1', { clear: false });
  const touched = await page.evaluate(() => { const { Session } = window.__data; const ok = Session.touch(); return { ok, age: Date.now() - JSON.parse(sessionStorage.getItem('mbptv:session:v1')).t, rt: Session.returnTo() }; });
  assert.strictEqual(touched.ok, true);
  assert.ok(touched.age < 5000, 'touch() resets the record time, got an age of ' + touched.age + ' ms');
  assert.strictEqual(touched.rt, origin + '/', 'returnTo is unchanged');
  // Without a record, or with an expired one, touch() does nothing.
  await page.evaluate(() => sessionStorage.setItem('mbptv:session:v1', JSON.stringify({ v: 1, t: Date.now() - 31 * 60 * 1000, stack: ['old'], expect: 'home' })));
  await at('/movie/1?play=1', { clear: false });
  assert.deepStrictEqual(await page.evaluate(() => [window.__data.Session.touch(), sessionStorage.getItem('mbptv:session:v1')]), [false, null]);
});

t.test('Log redacts search words, tokens and URL fragments centrally; entries stored by older versions too', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => {
    const { Log } = window.__data;
    Log.clear();
    Log.info('app', 'start https://www.movieboxpro.app/index/search?word=my+private+query&ref=abc123#frag-token');
    Log.info('boot', '0.3.0 on /index/search?word=secret&type=movie&page=2');
    Log.warn('api', { code: 'http-404', url: 'https://www.movieboxpro.app/index/search/autocomplate?q=my%20private%20query&limit=12' });
    Log.warn('player', 'history.back to https://www.movieboxpro.app/tvshow/556?season=2&episode=1&play=1&token=XYZ');
    return { text: JSON.stringify(Log.entries().map(e => e.msg)), stored: localStorage.getItem('mbptv:log:v1') };
  });
  for (const secret of ['my+private+query', 'my%20private%20query', 'abc123', 'frag-token', 'secret', 'XYZ']) {
    assert.ok(r.text.indexOf(secret) < 0, 'the log must not hold "' + secret + '": ' + r.text);
    assert.ok(r.stored.indexOf(secret) < 0, 'the persisted log must not hold "' + secret + '"');
  }
  for (const kept of ['type=movie', 'page=2', 'limit=12', 'season=2', 'episode=1', 'play=1', '/tvshow/556', 'http-404']) assert.ok(r.text.indexOf(kept) >= 0, 'the log should keep "' + kept + '": ' + r.text);
  // An entry an older version stored unredacted is redacted when read back (the Diagnostics screen shows these).
  await page.evaluate(() => localStorage.setItem('mbptv:log:v1', JSON.stringify([{ t: 1, level: 'warn', label: 'old', msg: 'GET /index/search?word=leaked#x' }])));
  await at('/index/index/my_box', { clear: false });
  assert.deepStrictEqual(await page.evaluate(() => window.__data.Log.persisted().map(e => e.msg)), ['GET /index/search?word=…']);
});

t.test('U.sameSite requires the page scheme, host (www or apex) and port; U.onOrigin rebuilds onto this origin', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => {
    const { U } = window.__data, o = location.origin, port = location.port;
    const other = 'http://127.0.0.1:' + (+port + 1) + '/movie';
    return {
      same: U.sameSite(o + '/movie/1'), rel: U.sameSite('/movie/1'), otherPort: U.sameSite(other),
      https: U.sameSite('https://127.0.0.1:' + port + '/movie'), js: U.sameSite('javascript:alert(1)'),
      onOrigin: U.onOrigin('/movie/1?play=1#x'), onOther: U.onOrigin(other)
    };
  });
  assert.deepStrictEqual(r, { same: true, rel: true, otherPort: false, https: false, js: false, onOrigin: origin + '/movie/1?play=1', onOther: '' });
});

t.test('Kit images: sized URLs (Site.thumb, TMDB sizes), the performance-mode cap and switch, and timings', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => {
    const { Kit, Prefs, Site } = window.__data, out = {};
    const had = Site.thumb;
    const tmdb = 'https://image.tmdb.org/t/p/original/abc.jpg', small = 'https://image.tmdb.org/t/p/w300/abc.jpg';
    out.autoPerf = Kit.perf();
    Prefs.set('performance', 'off');
    out.off = { perf: Kit.perf(), orig: Kit.imgUrl(tmdb, 1280), w780: Kit.imgUrl(tmdb, 500), small: Kit.imgUrl(small, 1280), backdrop: Kit.backdrop(tmdb), dwell: Kit.timing('dwell'), card: [Kit.cardWidth('poster'), Kit.cardWidth('grid'), Kit.cardWidth('wide')] };
    Prefs.set('performance', 'on');
    out.on = { perf: Kit.perf(), backdrop: Kit.backdrop(tmdb), dwell: Kit.timing('dwell'), card: [Kit.cardWidth('poster'), Kit.cardWidth('grid'), Kit.cardWidth('wide')] };
    Site.thumb = function (url, w) { return url.replace(/\.png$/, '') + '_w' + w + '.png'; };
    out.thumb = Kit.imgUrl('https://thumb.chuaxin.com/thumb_X.png', 1280);
    Prefs.set('performance', 'off');
    out.thumbOff = Kit.imgUrl('https://thumb.chuaxin.com/thumb_X.png', 1280);
    Site.thumb = function () { throw new Error('boom'); };
    out.thumbThrows = Kit.imgUrl('https://thumb.chuaxin.com/thumb_X.png', 300);
    Site.thumb = function () { return 'javascript:alert(1)'; };
    out.thumbBad = Kit.imgUrl('https://thumb.chuaxin.com/thumb_X.png', 300);
    Site.thumb = had;
    out.unsafe = [Kit.imgUrl('javascript:alert(1)', 300), Kit.imgUrl('', 300), Kit.imgUrl('https://x.test/a.png', 0)];
    Prefs.set('performance', 'auto');
    return out;
  });
  assert.strictEqual(r.autoPerf, true, 'auto is on for a Tizen user agent');
  assert.deepStrictEqual(r.off, { perf: false, orig: 'https://image.tmdb.org/t/p/w1280/abc.jpg', w780: 'https://image.tmdb.org/t/p/w780/abc.jpg', small: 'https://image.tmdb.org/t/p/w300/abc.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/abc.jpg', dwell: 450, card: [500, 500, 780] });
  assert.deepStrictEqual(r.on, { perf: true, backdrop: 'https://image.tmdb.org/t/p/w780/abc.jpg', dwell: 700, card: [300, 342, 500] });
  assert.strictEqual(r.thumb, 'https://thumb.chuaxin.com/thumb_X_w780.png', 'performance mode caps widths at 780');
  assert.strictEqual(r.thumbOff, 'https://thumb.chuaxin.com/thumb_X_w1280.png');
  assert.strictEqual(r.thumbThrows, 'https://thumb.chuaxin.com/thumb_X.png');
  assert.strictEqual(r.thumbBad, 'https://thumb.chuaxin.com/thumb_X.png');
  assert.deepStrictEqual(r.unsafe, ['javascript:alert(1)', '', 'https://x.test/a.png']);
  assert.deepStrictEqual(page.errors, []);
});

t.test('Kit images: a failing sized picture falls back once to the original, then to the placeholder', async () => {
  await at('/index/index/my_box');
  const r = await page.evaluate(() => new Promise(resolve => {
    const { Kit, Site } = window.__data, had = Site.thumb;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px';
    document.body.appendChild(box);
    Site.thumb = function (url, w) { return location.origin + '/missing/sized-' + w + '-' + url.split('/').pop(); };
    const good = Kit.img(location.origin + '/__img/thumb/thumb_TEST_movie_1.png', { cls: 'a', parent: box, w: 300, eager: true });
    const bad = Kit.img(location.origin + '/missing/original.png', { cls: 'b', parent: box, w: 300, eager: true, fallback: location.origin + '/missing/fallback.png' });
    const none = Kit.img('javascript:alert(1)', 'c', box);
    Site.thumb = had;
    setTimeout(() => resolve({
      good: { src: good.getAttribute('src').replace(location.origin, ''), loaded: good.classList.contains('is-loaded') },
      bad: { src: bad.getAttribute('src').replace(location.origin, ''), error: bad.classList.contains('is-error') },
      none: { src: none.getAttribute('src'), error: none.classList.contains('is-error') }
    }), 1500);
  }));
  assert.deepStrictEqual(r.good, { src: '/__img/thumb/thumb_TEST_movie_1.png', loaded: true });
  assert.deepStrictEqual(r.bad, { src: '/missing/fallback.png', error: true });
  assert.deepStrictEqual(r.none, { src: null, error: true });
  assert.strictEqual(count(/\/missing\/sized-300-thumb_TEST_movie_1\.png$/), 1, 'the sized URL was tried first');
  assert.strictEqual(count(/\/missing\/sized-300-original\.png$/), 1);
  assert.strictEqual(count(/\/missing\/original\.png$/), 1, 'then the original, once');
});

t.test('Kit images: performance mode loads at most 6 lazy pictures at once, nearest first; the rest follow as loads end', async () => {
  await at('/index/index/my_box');
  let release = null;
  const held = [];
  await page.route(/\/__hold\//, route => { held.push(route); if (release) release(); });
  const r1 = await page.evaluate(() => {
    const { Kit, Prefs } = window.__data;
    Prefs.set('performance', 'on');
    const box = document.createElement('div');
    box.id = 'kitbox';
    box.style.cssText = 'position:absolute;left:0;top:0;width:3000px';
    document.body.appendChild(box);
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.style.cssText = 'position:absolute;top:0;width:100px;height:100px;left:' + (i < 10 ? i * 110 : 5000 + i * 110) + 'px';
      box.appendChild(cell);
      Kit.img(location.origin + '/__hold/' + i + '.png', { parent: cell }).style.cssText = 'display:block;width:100px;height:100px';
    }
    Kit.lazyCheck(box);
    const started = Array.prototype.filter.call(box.querySelectorAll('img'), n => n.getAttribute('src')).map(n => n.getAttribute('src').replace(/^.*\/__hold\//, ''));
    return { started };
  });
  assert.deepStrictEqual(r1.started, ['0.png', '1.png', '2.png', '3.png', '4.png', '5.png'], 'six loads, nearest first');
  // Finish two loads: two more start, still never more than six at once; far-away pictures (beyond half a viewport) wait.
  for (let i = 0; i < 20 && held.length < 6; i++) await sleep(50);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await held.shift().fulfill({ status: 200, contentType: 'image/png', body: png });
  await held.shift().fulfill({ status: 200, contentType: 'image/png', body: png });
  await sleep(400);
  const r2 = await page.evaluate(() => {
    const box = document.getElementById('kitbox');
    const out = { started: Array.prototype.filter.call(box.querySelectorAll('img'), n => n.getAttribute('src')).length, loaded: box.querySelectorAll('img.is-loaded').length };
    window.__data.Prefs.set('performance', 'auto');
    return out;
  });
  assert.deepStrictEqual(r2, { started: 8, loaded: 2 });
  for (const h of held.splice(0)) await h.abort().catch(() => {});
  await page.unroute(/\/__hold\//);
});

(async () => {
  server = await mockSite.start();
  origin = server.origin;
  code = bundle(origin);
  browser = await launch();
  page = await openPage(browser, { tv: false });
  page.on('request', req => requests.push(req.url()));
  try { await t.run(); } finally {
    await browser.close();
    await server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
