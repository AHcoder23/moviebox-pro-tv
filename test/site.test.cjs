// Site adapter tests (docs/ARCHITECTURE.md section 5.2). Standalone: node test/site.test.cjs
// Every fixture is served by the mock site; Site.* runs on DOMParser documents (fetched through the mock origin)
// and on the live page, using a bundle of src/00-core.js + src/10-site.js (not the built tv.js).
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { launch, openPage, makeRunner, mockSite, root } = require('./helpers.cjs');

const FILES = ['00-core.js', '10-site.js'];
function bundle(origin) {
  return ['(function () {', "'use strict';", "var VERSION = 'test';", 'var START_URL = ' + JSON.stringify(origin + '/') + ';', "var CSS_TEXT = '';"]
    .concat(FILES.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')))
    .concat(['window.__data = { U: U, Site: Site, Api: typeof Api !== "undefined" ? Api : null, Prefs: typeof Prefs !== "undefined" ? Prefs : null,',
      '  Session: typeof Session !== "undefined" ? Session : null, Store: Store, Log: Log };', '}());'])
    .join('\n');
}
const fixture = name => fs.readFileSync(path.join(root, 'test', 'fixtures', name), 'utf8');

const t = makeRunner('site');
let server, browser, page, origin, code;

async function at(pathname) {
  await page.goto(origin + pathname);
  page.errors.length = 0; // the gate fixture's own inline $() call fails in the mock; only our errors matter
  await page.addScriptTag({ content: code });
}

// Fetches a mock page and runs Site[method](parsedDoc, url, ...extra) inside the browser.
async function parsed(pathname, method, extra) {
  return page.evaluate(async ({ p, m, extra }) => {
    const r = await fetch(p, { credentials: 'same-origin' });
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const url = new URL(p, location.href).href;
    return window.__data.Site[m].apply(null, [doc, url].concat(extra || []));
  }, { p: pathname, m: method, extra: extra || [] });
}

async function live(method) {
  return page.evaluate(m => window.__data.Site[m](document, location.href), method);
}

function noStatic(items) {
  for (const it of items) {
    assert.ok(!/\/static\//.test(it.poster), 'placeholder poster on ' + it.key + ': ' + it.poster);
    assert.ok(it.poster === '' || /^https?:\/\//.test(it.poster), 'poster not absolute on ' + it.key);
    assert.ok(/^https?:\/\/[^?]+\/(movie|tvshow)\/\d+$/.test(it.href), 'href shape on ' + it.key + ': ' + it.href);
  }
}

function checkHome(h) {
  assert.deepStrictEqual(h.rows.map(r => r.title), ['Waiting to Watch', "Today's Hot Movies", 'Movies You Might Like', "Today's Hot TV Shows"]);
  assert.deepStrictEqual(h.rows.map(r => r.items.length), [3, 4, 2, 3]);
  assert.deepStrictEqual(h.rows.map(r => r.id), ['waiting-to-watch', 'todays-hot-movies', 'movies-you-might-like', 'todays-hot-tv-shows']);
  assert.strictEqual(h.rows[0].more, origin + '/index/index/my_box');
  assert.strictEqual(h.rows[1].more, origin + '/index/index/movie_list?type=dayhot');
  assert.strictEqual(h.rows[3].more, origin + '/index/index/movie_list?type=dayhottv');
  const [snl, dictator, begins] = h.rows[0].items;
  assert.strictEqual(snl.key, 'tv:705');
  assert.strictEqual(snl.kind, 'tv');
  assert.strictEqual(snl.title, 'Saturday Night Live');
  assert.strictEqual(snl.href, origin + '/tvshow/705');
  assert.strictEqual(snl.poster, origin + '/__img/thumb/thumb_TEST_tv_705.png');
  assert.ok(Math.abs(snl.progress - 0.059444444444444) < 1e-6, 'snl progress ' + snl.progress);
  assert.strictEqual(snl.progressLabel, 'S37E21');
  assert.strictEqual(snl.playHref, origin + '/tvshow/705?season=37&play=1');
  assert.strictEqual(dictator.key, 'movie:1831');
  assert.strictEqual(dictator.badge, 'Blu-ray');
  assert.strictEqual(dictator.progress, 0.625);
  assert.strictEqual(dictator.progressLabel, '01:02:09');
  assert.strictEqual(dictator.playHref, origin + '/movie/1831?play=1');
  assert.strictEqual(begins.badge, '4K');
  assert.strictEqual(begins.progress, 0.09);
  const hot = h.rows[1].items;
  assert.deepStrictEqual(hot.map(i => i.key), ['movie:81314', 'movie:82961', 'movie:40102', 'movie:83137']);
  assert.strictEqual(hot[0].title, 'The End of Oak Street');
  assert.strictEqual(hot[0].backdrop, origin + '/__img/thumb/thumb_TEST_banner_81314.png');
  assert.strictEqual(hot[0].rating, '6.6');
  assert.strictEqual(hot[0].tomato, '86%');
  assert.strictEqual(hot[0].progress, -1);
  assert.strictEqual(hot[0].playHref, '');
  assert.strictEqual(hot[2].title, 'The Batman');
  assert.strictEqual(hot[2].rating, '7.8');
  assert.strictEqual(hot[2].tomato, '85%');
  assert.strictEqual(hot[2].badge, '4K');
  assert.strictEqual(hot[3].badge, '');
  assert.strictEqual(hot[1].backdrop, '');
  const delusion = h.rows[2].items[0];
  assert.strictEqual(delusion.title, 'Delusion');
  assert.strictEqual(delusion.rating, '', 'rating 0 is empty');
  assert.strictEqual(delusion.tomato, '', 'tomato 0% is empty');
  const tv = h.rows[3].items;
  assert.deepStrictEqual(tv.map(i => i.key), ['tv:556', 'tv:15980', 'tv:10726']);
  assert.strictEqual(tv[0].update, 'S05 E13');
  assert.strictEqual(tv[0].rating, '7.4');
  assert.strictEqual(tv[0].title, 'The Batman');
  assert.strictEqual(h.banners.length, 3);
  assert.deepStrictEqual(h.banners.map(b => b.key), ['tv:29814', 'movie:74298', 'movie:81314']);
  assert.strictEqual(h.banners[1].image, origin + '/__img/thumb/thumb_TEST_banner_74298.png');
  assert.strictEqual(h.banners[0].href, origin + '/tvshow/29814');
  for (const r of h.rows) noStatic(r.items);
}

function checkSearch(s) {
  assert.strictEqual(s.query, 'batman');
  assert.strictEqual(s.type, 'all');
  assert.strictEqual(s.total, 164);
  assert.strictEqual(s.empty, false);
  assert.strictEqual(s.items.length, 6);
  assert.deepStrictEqual(s.items.map(i => i.key), ['movie:40102', 'tv:556', 'tv:10742', 'movie:5170', 'movie:316', 'movie:1657']);
  assert.deepStrictEqual(s.types.map(x => x.type), ['all', 'movie', 'tv', 'actor']);
  assert.deepStrictEqual(s.types.map(x => x.label), ['All', 'Movies', 'TV Shows', 'Actors']);
  assert.deepStrictEqual(s.types.map(x => x.selected), [true, false, false, false]);
  assert.strictEqual(s.types[2].href, origin + '/index/search?word=batman&type=tv');
  const [m, tv] = s.items;
  assert.strictEqual(m.title, 'The Batman');
  assert.strictEqual(m.year, '2022');
  assert.strictEqual(m.runtime, '176 min');
  assert.deepStrictEqual(m.genres, ['Action', 'Crime', 'Drama']);
  assert.strictEqual(m.rating, '7.8');
  assert.strictEqual(m.badge, '4K');
  assert.strictEqual(m.poster, origin + '/__img/thumb/thumb_TEST_movie_40102.png');
  assert.strictEqual(tv.title, 'The Batman');
  assert.strictEqual(tv.update, 'S05 E13');
  assert.strictEqual(tv.year, '2004');
  assert.strictEqual(tv.runtime, '');
  assert.deepStrictEqual(tv.genres, ['Animation', 'Sci-Fi & Fantasy', 'Action & Adventure', 'Kids']);
  assert.strictEqual(tv.badge, '');
  assert.strictEqual(s.items[2].title, 'Batman: The Animated Series');
  assert.strictEqual(s.items[2].rating, '9');
  assert.strictEqual(s.items[4].badge, 'Blu-ray');
  assert.strictEqual(s.playlists.length, 2);
  assert.deepStrictEqual(s.playlists[0], {
    title: 'DC Animated Movies In Order', href: origin + '/playlist/124373',
    image: origin + '/__img/images/playlists_cover/TEST_124373.jpg', count: '52 Movies'
  });
  assert.strictEqual(s.playlists[1].title, 'BATMAN');
  assert.strictEqual(s.next, origin + '/index/search?word=batman&type=all&page=2');
  noStatic(s.items);
}

function checkMovie(d) {
  assert.ok(d, 'detail parsed');
  assert.strictEqual(d.kind, 'movie');
  assert.strictEqual(d.id, '40102');
  assert.strictEqual(d.key, 'movie:40102');
  assert.strictEqual(d.href, origin + '/movie/40102');
  assert.strictEqual(d.title, 'The Batman');
  assert.strictEqual(d.year, '2022');
  assert.strictEqual(d.poster, origin + '/__img/thumb/thumb_TEST_movie_40102.png');
  assert.strictEqual(d.backdropOriginal, origin + '/__img/tmdb/t/p/original/TEST_backdrop_40102.jpg');
  assert.strictEqual(d.backdrop, origin + '/__img/tmdb/t/p/w1280/TEST_backdrop_40102.jpg');
  assert.strictEqual(d.runtime, '176 min');
  assert.strictEqual(d.certification, 'PG-13');
  assert.deepStrictEqual(d.genres, ['Action', 'Crime', 'Drama']);
  assert.strictEqual(d.update, '');
  assert.deepStrictEqual(d.ratings, { imdb: '7.8', tomato: '85%', audience: '87%' });
  assert.ok(/^When the Riddler, a sadistic serial killer/.test(d.overview), d.overview);
  assert.ok(/family's involvement\.$/.test(d.overview));
  assert.deepStrictEqual(d.badges, ['4K HDR', '4K', 'Blu-ray']);
  assert.strictEqual(d.audio, 'ENG');
  assert.strictEqual(d.playLabel, 'PLAY');
  assert.strictEqual(d.playHref, origin + '/movie/40102?play=1');
  assert.deepStrictEqual(d.sources, [
    { index: 0, quality: '1080p', file: 'The.Batman.2022.1080p.WEBRip.DDP5.1.x264-NOGRP.mkv', size: '6.71 GB', date: '4/18/2022' },
    { index: 1, quality: '4K', file: 'The.Batman.2022.2160p.HDR.7.1.mkv', size: '14.47 GB', date: '7/13/2023' }
  ]);
  assert.deepStrictEqual(d.cast.map(c => [c.name, c.role]), [
    ['Matt Reeves', 'Director'], ['Robert Pattinson', 'Bruce Wayne / Batman'], ['Zoë Kravitz', 'Selina Kyle / Catwoman'], ['Bill Finger', 'Batman created by']]);
  assert.strictEqual(d.cast[1].image, origin + '/__img/thumb/thumb_TEST_actor_24314.png');
  assert.strictEqual(d.cast[3].image, '');
  assert.strictEqual(d.cast[0].job, 'Director');
  assert.deepStrictEqual(d.related.map(r => r.key), ['movie:42127', 'movie:4338', 'movie:41635']);
  assert.deepStrictEqual(d.related.map(r => r.title), ['The Flash', 'Let Me In', 'Uncharted']);
  assert.strictEqual(d.related[0].year, '2023');
  assert.strictEqual(d.related[0].runtime, '144 min');
  assert.strictEqual(d.related[0].badge, '4K');
  assert.strictEqual(d.related[1].badge, 'Blu-ray');
  assert.strictEqual(d.related[0].rating, '6.6');
  noStatic(d.related);
  assert.strictEqual(d.season, 0);
  assert.deepStrictEqual(d.seasons, []);
  assert.deepStrictEqual(d.episodes, []);
}

function checkShow(d, id) {
  id = id || '556';
  assert.ok(d, 'tv detail parsed');
  assert.strictEqual(d.kind, 'tv');
  assert.strictEqual(d.key, 'tv:' + id);
  assert.strictEqual(d.title, 'The Batman');
  assert.strictEqual(d.year, '2004');
  assert.strictEqual(d.update, 'Update to S05 E13');
  assert.strictEqual(d.certification, 'TV-Y7');
  assert.strictEqual(d.runtime, '');
  assert.deepStrictEqual(d.genres, ['Animation', 'Sci-Fi & Fantasy', 'Action & Adventure', 'Kids']);
  assert.deepStrictEqual(d.ratings, { imdb: '7.4', tomato: '', audience: '92%' }, '-,-% tomato is empty');
  assert.ok(/^The Batman is an American animated television series/.test(d.overview));
  assert.strictEqual(d.backdrop, origin + '/__img/tmdb/t/p/w1280/TEST_backdrop_' + id + '.jpg');
  assert.deepStrictEqual(d.badges, []);
  assert.strictEqual(d.playLabel, 'PLAY');
  assert.strictEqual(d.season, 2);
  assert.strictEqual(d.seasons.length, 5);
  assert.deepStrictEqual(d.seasons.map(s => s.number), [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(d.seasons.map(s => s.current), [false, true, false, false, false]);
  assert.strictEqual(d.seasons[2].href, origin + '/tvshow/' + id + '?season=3');
  assert.strictEqual(d.episodes.length, 3);
  assert.deepStrictEqual(d.episodes[0], {
    season: 2, episode: 1, code: 'S2E1', title: 'The Cat, the Bat and the Very Ugly', date: 'May 14, 2005', runtime: '21 min',
    overview: 'Penguin and Catwoman join forces to steal a pair of valuable gems. But when The Batman arrives to stop them, Catwoman is double-crossed by Penguin, who handcuffs her to the Dark Knight.',
    still: origin + '/__img/thumb/thumb_TEST_ep_' + id + '_2_1.png', rating: '7.4'
  });
  assert.deepStrictEqual(d.episodes.map(e => e.title), ['The Cat, the Bat and the Very Ugly', 'Riddled', 'Fire and Ice']);
  assert.deepStrictEqual(d.episodes.map(e => e.runtime), ['21 min', '21 min', '20 min']);
  assert.deepStrictEqual(d.episodes.map(e => e.code), ['S2E1', 'S2E2', 'S2E3']);
  assert.strictEqual(d.episodes[2].overview, 'Firefly and Mr. Freeze make an unlikely pair as they join forces to plunge Gotham into a permanent winter.');
  assert.deepStrictEqual(d.sources, [{ index: 0, quality: 'SD', file: 'The.Batman.S01E01.The.Bat.in.the.Belfry.NF.WEB-DL.DD+2.0.H.264-CtrlSD.mkv', size: '170.96 MB', date: '7/20/2020' }]);
  assert.deepStrictEqual(d.cast.map(c => [c.name, c.role, c.image === '']), [['Brandon Vietti', 'Director', true], ['Sam Liu', 'Director', false]]);
  assert.deepStrictEqual(d.related, []);
}

t.test('home: rows, waiting-to-watch progress, banners and backdrops (parsed + live)', async () => {
  await at('/tvshow/556');
  checkHome(await parsed('/', 'home'));
  await at('/');
  checkHome(await live('home'));
});

t.test('search: items, total, type tabs, playlists and next page (parsed + live)', async () => {
  await at('/tvshow/556');
  checkSearch(await parsed('/index/search?word=batman', 'search'));
  await at('/index/search?word=batman');
  checkSearch(await live('search'));
});

t.test('search-empty: empty, total 0, no items, no next', async () => {
  await at('/tvshow/556');
  const s = await parsed('/index/search?word=zzqxjvnotatitle', 'search');
  assert.strictEqual(s.empty, true);
  assert.strictEqual(s.total, 0);
  assert.deepStrictEqual(s.items, []);
  assert.deepStrictEqual(s.playlists, []);
  assert.strictEqual(s.next, '');
  assert.strictEqual(s.query, 'zzqxjvnotatitle');
});

t.test('search type=tv via the mock: only TV items and the TV tab selected', async () => {
  await at('/tvshow/556');
  const s = await parsed('/index/search?word=batman&type=tv', 'search');
  assert.strictEqual(s.type, 'tv');
  assert.deepStrictEqual(s.items.map(i => i.key), ['tv:556', 'tv:10742']);
  assert.ok(s.items.every(i => i.kind === 'tv'));
  assert.deepStrictEqual(s.types.filter(x => x.selected).map(x => x.type), ['tv']);
  const p3 = await parsed('/index/search?word=batman&type=all&page=3', 'search');
  assert.strictEqual(p3.next, '', 'no next on the last page');
  assert.ok(p3.items.every(i => /0$/.test(i.id)), 'page 3 ids are distinct');
});

t.test('list: curly-apostrophe title, 3 items, next page', async () => {
  await at('/tvshow/556');
  const l = await parsed('/index/index/movie_list?type=dayhot', 'list');
  assert.strictEqual(l.title, 'Today’s Hot Movies');
  assert.deepStrictEqual(l.items.map(i => i.key), ['movie:81314', 'movie:82961', 'movie:40102']);
  assert.deepStrictEqual(l.items.map(i => i.title), ['The End of Oak Street', 'Why Did I Get Married Again?', 'The Batman']);
  assert.deepStrictEqual(l.items.map(i => i.badge), ['Blu-ray', 'Blu-ray', '4K']);
  assert.strictEqual(l.items[0].tomato, '86%');
  assert.strictEqual(l.items[2].tomato, '');
  assert.strictEqual(l.next, origin + '/index/index/movie_list?type=dayhot&page=2');
  assert.deepStrictEqual(l.chips, []);
  noStatic(l.items);
});

t.test('movies (/movie): background-image posters, 3 chips, next (parsed + live)', async () => {
  const check = l => {
    assert.strictEqual(l.title, 'Movies');
    assert.deepStrictEqual(l.items.map(i => i.key), ['movie:83137', 'movie:41635', 'tv:15980']);
    assert.strictEqual(l.items[0].poster, origin + '/__img/thumb/thumb_TEST_movie_83137.png');
    assert.strictEqual(l.items[2].poster, origin + '/__img/thumb/thumb_TEST_tv_15980.png');
    assert.strictEqual(l.items[0].title, 'Picture Bride');
    assert.strictEqual(l.items[0].year, '1994');
    assert.strictEqual(l.items[0].runtime, '94 min');
    assert.strictEqual(l.items[0].badge, 'Blu-ray');
    assert.strictEqual(l.items[1].runtime, '116 min');
    assert.strictEqual(l.items[2].update, 'S03 E05');
    assert.strictEqual(l.items[2].year, '2021');
    assert.strictEqual(l.chips.length, 3);
    assert.deepStrictEqual(l.chips.map(c => c.label), ['Top Streaming Movies', 'Certified Fresh Movies', 'Popular on Netflix']);
    assert.strictEqual(l.chips[0].href, origin + '/index/movie/top_list?id=top_dvd_streaming');
    assert.strictEqual(l.next, origin + '/movie?page=2');
    noStatic(l.items);
  };
  await at('/tvshow/556');
  check(await parsed('/movie', 'list'));
  await at('/movie');
  check(await live('list'));
});

t.test('library: 2 items with play links and progress', async () => {
  await at('/tvshow/556');
  const l = await parsed('/index/index/my_box', 'list');
  assert.strictEqual(l.title, 'My Library');
  assert.deepStrictEqual(l.items.map(i => i.key), ['tv:705', 'movie:5776']);
  assert.deepStrictEqual(l.items.map(i => i.title), ['Saturday Night Live', 'The Shawshank Redemption']);
  assert.deepStrictEqual(l.items.map(i => i.playHref), [origin + '/tvshow/705?play=1', origin + '/movie/5776?play=1']);
  assert.deepStrictEqual(l.items.map(i => i.progress), [0.06, 0.34]);
  assert.deepStrictEqual(l.items.map(i => i.progressLabel), ['S37E21', '00:48:10']);
  assert.deepStrictEqual(l.items.map(i => i.badge), ['', '4K']);
  assert.strictEqual(l.items[1].poster, origin + '/__img/thumb/thumb_TEST_movie_5776.png');
  assert.deepStrictEqual(l.chips.map(c => [c.label, c.selected]), [['Waiting', true], ['Watched', false], ['Favorites', false], ['Recommended', false]]);
  noStatic(l.items);
});

t.test('movie detail: every Detail field (parsed + live)', async () => {
  await at('/tvshow/556');
  checkMovie(await parsed('/movie/40102', 'detail'));
  await at('/movie/40102');
  checkMovie(await live('detail'));
  checkMovie(await page.evaluate(() => window.__data.Site.detail(document)));
});

t.test('tv show detail: season 2 of 5, episodes, ratings (parsed + live)', async () => {
  await at('/movie/40102');
  checkShow(await parsed('/tvshow/556?season=2', 'detail'));
  checkShow(await parsed('/tvshow/99', 'detail'), '99');
  await at('/tvshow/556?season=2');
  checkShow(await live('detail'));
});

t.test('gate: isGate, pageType and empty parses when signed out', async () => {
  await page.goto(origin + '/__mock/signout');
  try {
    await page.addScriptTag({ content: code });
    const r = await page.evaluate(() => {
      const { Site } = window.__data;
      return {
        gate: Site.isGate(document), type: Site.pageType(location.href, document), home: Site.home(document),
        detail: Site.detail(document, location.origin + '/movie/1'), self: Site.selfTest(document, 'gate')
      };
    });
    assert.strictEqual(r.gate, true);
    assert.strictEqual(r.type, 'gate');
    assert.deepStrictEqual(r.home, { rows: [], banners: [] });
    assert.strictEqual(r.detail, null);
    assert.strictEqual(r.self.ok, true);
    assert.strictEqual(await parsed('/movie/40102', 'isGate'), true, 'signed-out detail page is the gate');
  } finally {
    await page.goto(origin + '/__mock/signin');
  }
  await at('/');
  const gateHtml = fixture('gate.html');
  assert.strictEqual(await page.evaluate(html => window.__data.Site.isGate(new DOMParser().parseFromString(html, 'text/html')), gateHtml), true);
  assert.strictEqual(await page.evaluate(html => window.__data.Site.pageType('/', new DOMParser().parseFromString(html, 'text/html')), gateHtml), 'gate');
  for (const p of ['/', '/index/search?word=batman', '/index/search?word=zzqxjvnotatitle', '/index/index/movie_list?type=dayhot', '/movie', '/index/index/my_box', '/movie/40102', '/tvshow/556']) {
    assert.strictEqual(await parsed(p, 'isGate'), false, 'not a gate: ' + p);
  }
});

t.test('pageType for every fixture and for bare URLs', async () => {
  await at('/tvshow/556');
  const withDocs = [['/', 'home'], ['/index/search?word=batman', 'search'], ['/index/search?word=zzqxjvnotatitle', 'search'],
    ['/index/index/movie_list?type=dayhot', 'list'], ['/movie', 'list'], ['/tvshow', 'list'], ['/index/index/my_box', 'library'],
    ['/movie/40102', 'movie'], ['/tvshow/556?season=2', 'tv']];
  for (const [p, want] of withDocs) {
    const got = await page.evaluate(async p => {
      const r = await fetch(p);
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      return window.__data.Site.pageType(new URL(p, location.href).href, doc);
    }, p);
    assert.strictEqual(got, want, p);
  }
  const bare = await page.evaluate(() => {
    const { Site } = window.__data;
    const cases = ['/movie/1?play=1', '/index/search?word=x', '/', '/index/index', '/tvshow/5?season=2&episode=3&play=1', '/index/index/detail?id=5',
      '/index/index/tvdetail?id=6', '/index/index/history', '/index/tv/top_list?id=x', '/index/login', '/index/login/qrcode', '/playlist/5',
      '/index/index/my_box?watched=1', '/some/other/page'];
    const out = {};
    for (const c of cases) out[c] = Site.pageType(location.origin + c);
    out.relative = Site.pageType('/movie/9');
    out.locationLike = Site.pageType({ href: location.origin + '/index/search?word=a' });
    out.current = Site.pageType(location);
    return out;
  });
  assert.deepStrictEqual(bare, {
    '/movie/1?play=1': 'movie', '/index/search?word=x': 'search', '/': 'home', '/index/index': 'home', '/tvshow/5?season=2&episode=3&play=1': 'tv',
    '/index/index/detail?id=5': 'movie', '/index/index/tvdetail?id=6': 'tv', '/index/index/history': 'list', '/index/tv/top_list?id=x': 'list',
    '/index/login': 'login', '/index/login/qrcode': 'login', '/playlist/5': 'other', '/index/index/my_box?watched=1': 'library',
    '/some/other/page': 'other', relative: 'movie', locationLike: 'search', current: 'tv'
  });
});

t.test('parseTitleUrl: absolute, relative, host variants, legacy URLs, from= and foreign hosts', async () => {
  await at('/movie/40102');
  const r = await page.evaluate(() => {
    const { Site } = window.__data;
    const P = (u, b) => Site.parseTitleUrl(u, b);
    return {
      abs: P(location.origin + '/movie/40102'),
      rel: P('/tvshow/556?season=2&episode=3&play=1'),
      relNoSlash: P('movie/5', location.origin + '/'),
      apex: P('https://movieboxpro.app/movie/5', 'https://www.movieboxpro.app/'),
      www: P('https://www.movieboxpro.app/tvshow/7?season=1', 'https://movieboxpro.app/index/search?word=a'),
      protoRel: P('//www.movieboxpro.app/movie/9', 'https://www.movieboxpro.app/'),
      legacyMovie: P('/index/index/detail?id=77'),
      legacyTv: P('/index/index/tvdetail?id=88&season=3'),
      from: P('/movie/1831?from=home'),
      fromPlay: P('/movie/1831?from=home&play=1'),
      amp: P('/tvshow/705?from=home&amp;season=37&amp;play=1'),
      trailing: P('/movie/12/'),
      foreign: P('https://evil.example.com/movie/1'),
      foreignForBase: P('https://www.movieboxpro.app/movie/5', location.origin + '/'),
      js: P('javascript:alert(1)'),
      playlist: P('/playlist/5'),
      notNumeric: P('/movie/abc'),
      legacyNoId: P('/index/index/detail'),
      empty: P(''),
      nul: P(null),
      obj: P({})
    };
  });
  assert.deepStrictEqual(r.abs, { kind: 'movie', id: '40102', key: 'movie:40102', season: 0, episode: 0, play: false });
  assert.deepStrictEqual(r.rel, { kind: 'tv', id: '556', key: 'tv:556', season: 2, episode: 3, play: true });
  assert.strictEqual(r.relNoSlash.key, 'movie:5');
  assert.strictEqual(r.apex.key, 'movie:5');
  assert.deepStrictEqual([r.www.key, r.www.season], ['tv:7', 1]);
  assert.strictEqual(r.protoRel.key, 'movie:9');
  assert.strictEqual(r.legacyMovie.key, 'movie:77');
  assert.deepStrictEqual([r.legacyTv.key, r.legacyTv.season], ['tv:88', 3]);
  assert.deepStrictEqual(r.from, { kind: 'movie', id: '1831', key: 'movie:1831', season: 0, episode: 0, play: false });
  assert.strictEqual(r.fromPlay.play, true);
  assert.deepStrictEqual([r.amp.key, r.amp.season, r.amp.play], ['tv:705', 37, true]);
  assert.strictEqual(r.trailing.key, 'movie:12');
  for (const k of ['foreign', 'foreignForBase', 'js', 'playlist', 'notNumeric', 'legacyNoId', 'empty', 'nul', 'obj']) assert.strictEqual(r[k], null, k);
});

t.test('targetOf: href, data-link, data-href, onclick quoting and &amp;, non-title handlers', async () => {
  await at('/movie/40102');
  const r = await page.evaluate(() => {
    const { Site } = window.__data;
    const mk = (tag, attrs) => { const el = document.createElement(tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return Site.targetOf(el); };
    return {
      href: mk('a', { href: '/movie/1' }),
      dataLink: mk('img', { 'data-link': '/tvshow/705?play=1' }),
      dataHref: mk('div', { 'data-href': '/movie/3' }),
      onclickSingle: mk('img', { onclick: "window.location.href='/tvshow/705?from=home&amp;season=37';" }),
      onclickDouble: mk('img', { onclick: 'location.href="/movie/9?from=home";' }),
      onclickSpaces: mk('div', { onclick: "document.location = '/movie/10'" }),
      jsHrefWithOnclick: mk('a', { href: 'javascript:;', onclick: "window.location.href='/movie/11'" }),
      nonTitleOnclick: mk('img', { onclick: 'showDialog(1)' }),
      playlistOnclick: mk('img', { onclick: "window.location.href='/playlist/3'" }),
      nonTitleHref: mk('a', { href: '/index/index/my_box' }),
      legacy: mk('a', { href: '/index/index/detail?id=5' }),
      foreign: mk('a', { href: 'https://evil.example.com/movie/1' }),
      none: Site.targetOf(null)
    };
  });
  assert.strictEqual(r.href, origin + '/movie/1');
  assert.strictEqual(r.dataLink, origin + '/tvshow/705?play=1');
  assert.strictEqual(r.dataHref, origin + '/movie/3');
  assert.strictEqual(r.onclickSingle, origin + '/tvshow/705?from=home&season=37');
  assert.strictEqual(r.onclickDouble, origin + '/movie/9?from=home');
  assert.strictEqual(r.onclickSpaces, origin + '/movie/10');
  assert.strictEqual(r.jsHrefWithOnclick, origin + '/movie/11');
  assert.strictEqual(r.legacy, origin + '/index/index/detail?id=5');
  for (const k of ['nonTitleOnclick', 'playlistOnclick', 'nonTitleHref', 'foreign', 'none']) assert.strictEqual(r[k], '', k);
});

t.test('suggestions and hot parsing (autocomplete.json, search_hot.json)', async () => {
  await at('/movie/40102');
  const r = await page.evaluate(([ac, hot]) => {
    const { Site } = window.__data;
    return {
      ac: Site.suggestions(ac), gate: Site.suggestions('<!doctype html><title>Private Garden</title>'),
      mixed: Site.suggestions([{ name: ' A ' }, 'B', { name: 'a' }, null, { title: 'C' }]), wrapped: Site.suggestions('{"data":[{"name":"X"}]}'),
      hot: Site.hot(hot), hotBad: Site.hot('nope'), hotNull: Site.hot(null)
    };
  }, [fixture('autocomplete.json'), fixture('search_hot.json')]);
  assert.deepStrictEqual(r.ac, ['Batman Begins', 'Battle of the Year', 'Batman Unlimited Monster Mayhem', 'Battlestar Galactica', 'Batman: Hush', 'Bato Mura']);
  assert.deepStrictEqual(r.gate, []);
  assert.deepStrictEqual(r.mixed, ['A', 'B', 'C']);
  assert.deepStrictEqual(r.wrapped, ['X']);
  assert.strictEqual(r.hot.trending.length, 10);
  assert.strictEqual(r.hot.trending[0], 'the love hypothesis');
  assert.deepStrictEqual(r.hot.recent, ['batman', 'Stranger Things', 'The Dictator']);
  assert.deepStrictEqual(r.hotBad, { trending: [], recent: [] });
  assert.deepStrictEqual(r.hotNull, { trending: [], recent: [] });
});

t.test('Site.live on the mock movie page: play, source picker, player, close', async () => {
  await at('/movie/40102');
  const L = 'window.__data.Site.live';
  const ev = src => page.evaluate(src);
  assert.deepStrictEqual(await ev(`({ btn: ${L}.playButton() && ${L}.playButton().className, picker: ${L}.sourcePickerOpen(), player: ${L}.playerOpen(), popups: ${L}.blockingPopups().length, video: ${L}.video() })`),
    { btn: 'start_app', picker: false, player: false, popups: 0, video: null });
  await ev(`${L}.click(${L}.playButton())`);
  await page.waitForFunction(() => window.__data.Site.live.sourcePickerOpen(), null, { timeout: 3000 });
  assert.strictEqual(await ev(`${L}.sourceItems().length`), 2);
  assert.deepStrictEqual(await ev(`${L}.sourceList().map(s => [s.index, s.quality, s.size, s.el.tagName])`), [[0, '1080p', '6.71 GB', 'LI'], [1, '4K', '14.47 GB', 'LI']]);
  await ev(`${L}.click(${L}.sourceItems()[1])`);
  await page.waitForFunction(() => window.__data.Site.live.playerOpen(), null, { timeout: 3000 });
  assert.strictEqual(await ev(`${L}.sourcePickerOpen()`), false);
  assert.strictEqual(await ev(`${L}.video() && ${L}.video().id`), 'mock-video');
  assert.ok((await ev('window.mockLog')).indexOf('player:/index/index/player?mfid=2215085') >= 0);
  assert.strictEqual(await ev(`${L}.closePlayer()`), true);
  assert.strictEqual(await ev(`${L}.playerOpen()`), false);
  assert.ok((await ev('window.mockLog')).indexOf('player:closed') >= 0, 'closed through the site control');
  // Source picker closes through its own control.
  await ev(`${L}.click(${L}.playButton())`);
  await page.waitForFunction(() => window.__data.Site.live.sourcePickerOpen(), null, { timeout: 3000 });
  assert.strictEqual(await ev(`${L}.closeSourcePicker()`), true);
  assert.strictEqual(await ev(`${L}.sourcePickerOpen()`), false);
  // Fallback close when the site's close control is missing: hide the dialog and pause the video.
  await ev(`${L}.click(${L}.playButton())`);
  await page.waitForFunction(() => window.__data.Site.live.sourcePickerOpen(), null, { timeout: 3000 });
  await ev(`${L}.click(${L}.sourceItems()[0])`);
  await page.waitForFunction(() => window.__data.Site.live.playerOpen(), null, { timeout: 3000 });
  await ev(`document.getElementById('jw_player_close_pc').parentNode.removeChild(document.getElementById('jw_player_close_pc'))`);
  assert.strictEqual(await ev(`${L}.closePlayer()`), true);
  assert.deepStrictEqual(await ev(`({ open: ${L}.playerOpen(), paused: document.getElementById('mock-video').paused })`), { open: false, paused: true });
  // Popups: detected when visible, dismissed (hidden) even without a site handler.
  await ev(`document.querySelector('.vip_pay_tips').style.cssText = 'display:block;position:fixed;left:0;top:0;width:400px;height:200px;background:#333'`);
  assert.strictEqual(await ev(`${L}.blockingPopups().length`), 1);
  assert.strictEqual(await ev(`${L}.dismissPopup(${L}.blockingPopups()[0])`), true);
  assert.strictEqual(await ev(`${L}.blockingPopups().length`), 0);
  assert.strictEqual(await ev(`${L}.dismissPopup(null)`), false);
  assert.deepStrictEqual(page.errors, []);
});

t.test('Site.live on the mock TV page: episode button starts playback', async () => {
  await at('/tvshow/556?season=2');
  const r = await page.evaluate(() => {
    const L = window.__data.Site.live, b = L.episodeButton(2, 2);
    return { season: b.getAttribute('season'), episode: b.getAttribute('episode'), watchTab: b.classList.contains('watch_tab'), missing: L.episodeButton(9, 9), clicked: L.click(b) };
  });
  assert.deepStrictEqual(r, { season: '2', episode: '2', watchTab: true, missing: null, clicked: true });
  await page.waitForFunction(() => window.__data.Site.live.playerOpen(), null, { timeout: 3000 });
  assert.ok((await page.evaluate('window.mockLog')).indexOf('click:episode:2x2') >= 0);
  assert.strictEqual(await page.evaluate(() => window.__data.Site.live.closePlayer()), true);
});

t.test('selfTest: every fixture passes; broken markup produces warnings', async () => {
  await at('/tvshow/556');
  const pages = [['/', 'home'], ['/index/search?word=batman', 'search'], ['/index/search?word=zzqxjvnotatitle', 'search'],
    ['/index/index/movie_list?type=dayhot', 'list'], ['/movie', 'list'], ['/index/index/my_box', 'library'], ['/movie/40102', 'movie'], ['/tvshow/556', 'tv']];
  for (const [p, type] of pages) {
    const r = await page.evaluate(async ({ p, type }) => {
      const doc = new DOMParser().parseFromString(await (await fetch(p)).text(), 'text/html');
      doc.__mbptvUrl = new URL(p, location.href).href; // what Api.fetchDoc stamps on parsed documents
      return { typed: window.__data.Site.selfTest(doc, type), auto: window.__data.Site.selfTest(doc) };
    }, { p, type });
    assert.strictEqual(r.auto.type, type, p + ' auto type');
    assert.deepStrictEqual(r.auto, r.typed);
    r.ok = r.typed.ok; r.type = r.typed.type; r.warnings = r.typed.warnings;
    assert.strictEqual(r.ok, true, p + ' ' + JSON.stringify(r.warnings));
    assert.strictEqual(r.type, type);
  }
  const auto = await page.evaluate(() => window.__data.Site.selfTest(document));
  assert.deepStrictEqual([auto.ok, auto.type, auto.counts.episodes], [true, 'tv', 3]);
  const broken = await page.evaluate(async () => {
    const html = (await (await fetch('/')).text()).replace(/class="section"/g, 'class="block"');
    return window.__data.Site.selfTest(new DOMParser().parseFromString(html, 'text/html'), 'home');
  });
  assert.strictEqual(broken.ok, false);
  assert.ok(broken.warnings.some(w => /no match for \.contents \.section/.test(w)), JSON.stringify(broken.warnings));
  assert.strictEqual(broken.counts.rows, 1, 'generic fallback row still renders');
  assert.strictEqual((await page.evaluate(() => window.__data.Site.selfTest(null))).ok, false);
});

t.test('generic fallback: renamed markup still yields cards; card roots grow to their title', async () => {
  await at('/tvshow/556');
  const r = await page.evaluate(async () => {
    const { Site } = window.__data;
    const get = async (p, fn) => new DOMParser().parseFromString(fn(await (await fetch(p)).text()), 'text/html');
    const homeDoc = await get('/', h => h.replace(/class="section"/g, 'class="block"'));
    const home = Site.home(homeDoc, location.origin + '/');
    const searchDoc = await get('/index/search?word=batman', h => h.replace(/search_info/g, 'results_grid'));
    const search = Site.search(searchDoc, location.origin + '/index/search?word=batman');
    const holder = document.createElement('div');
    holder.innerHTML = '<div class="grid">' +
      '<div class="item"><a href="/movie/9"><img src="https://img.example/p9.jpg"></a><p style="font-weight:bold">Nine</p><span class="score"><span>0</span></span></div>' +
      '<div class="item"><a href="/tvshow/8"><div style="background-image:url(\'/static/img/default.png\'),url(https://img.example/p8.jpg)"></div></a><h3>Eight</h3></div>' +
      '<div class="item" style="display:none"><a href="/movie/7" title="Seven"><img src="https://img.example/p7.jpg"></a></div>' +
      '<a href="/movie/6">Six text link</a>' +
      '</div>';
    document.body.appendChild(holder);
    const all = Site.cards(holder);
    const visible = Site.cards(holder, { live: true });
    const shell = document.createElement('div');
    shell.id = 'mbptv';
    shell.innerHTML = '<a href="/movie/424242" title="Shell card"><img src="https://img.example/shell.jpg"></a>';
    document.body.appendChild(shell);
    const liveKeys = Site.cards(document).map(i => i.key);
    const shellCard = liveKeys.indexOf('movie:424242') >= 0;
    shell.parentNode.removeChild(shell);
    const leftovers = [].slice.call(document.querySelectorAll('*')).concat([holder])
      .filter(n => '__mbptvCardKey' in n || '__mbptvCardArt' in n).length;
    holder.parentNode.removeChild(holder);
    return { rows: home.rows.map(r => [r.id, r.items.length]), homeKeys: home.rows[0] && home.rows[0].items.map(i => i.key), snl: home.rows[0] && home.rows[0].items.filter(i => i.key === 'tv:705')[0],
      searchKeys: search.items.map(i => i.key), all, visible: visible.map(i => i.key), leftovers, shellCard, liveHasSite: liveKeys.indexOf('movie:9') >= 0 };
  });
  assert.strictEqual(r.shellCard, false, 'the shell UI is never parsed as site content');
  assert.strictEqual(r.liveHasSite, true);
  assert.deepStrictEqual(r.rows, [['featured', 14]]);
  assert.ok(r.homeKeys.indexOf('movie:40102') >= 0 && r.homeKeys.indexOf('tv:29814') >= 0);
  assert.strictEqual(r.snl.title, 'Saturday Night Live');
  assert.strictEqual(r.snl.progressLabel, 'S37E21');
  assert.deepStrictEqual(r.searchKeys, ['movie:40102', 'tv:556', 'tv:10742', 'movie:5170', 'movie:316', 'movie:1657']);
  assert.deepStrictEqual(r.all.map(i => [i.key, i.title, i.poster]), [
    ['movie:9', 'Nine', 'https://img.example/p9.jpg'], ['tv:8', 'Eight', 'https://img.example/p8.jpg'],
    ['movie:7', 'Seven', 'https://img.example/p7.jpg'], ['movie:6', 'Six text link', '']]);
  assert.strictEqual(r.all[0].rating, '');
  assert.deepStrictEqual(r.visible, ['movie:9', 'tv:8', 'movie:6']);
  assert.strictEqual(r.leftovers, 0, 'temporary card marks are cleaned up');
});

t.test('history (legacy detail URLs) and a title page with unknown markup still parse', async () => {
  await at('/movie/40102');
  const r = await page.evaluate(() => {
    const { Site } = window.__data, P = h => new DOMParser().parseFromString(h, 'text/html'), o = location.origin;
    const history = P('<title>MovieBoxPro</title><div class="contents"><div style="line-height:31px;"><span style="font-size:24px;font-weight:bold;">History</span></div>' +
      '<div class="history_movie"><a href="/index/index/detail?id=40102"><img src="https://img.example/h1.jpg"><p style="font-weight:bold">The Batman</p></a></div>' +
      '<div class="history_movie"><a href="/index/index/tvdetail?id=556&amp;from=history"><img src="https://img.example/h2.jpg"><p style="font-weight:bold">The Batman (TV)</p></a></div></div>');
    const odd = P('<title>Odd Title - MovieBoxPro</title><meta property="og:image" content="https://img.example/og.jpg"><meta name="description" content="Something."><div class="new_layout"><h1>Odd Title</h1></div>');
    const search = P('<title>x - MovieBoxPro</title><div class="search_info"></div>');
    return {
      history: Site.list(history, o + '/index/index/history'),
      odd: Site.detail(odd, o + '/movie/5'), oddNoUrl: Site.detail(odd), oddSearch: Site.detail(search, o + '/movie/5'), oddHome: Site.detail(odd, o + '/')
    };
  });
  assert.strictEqual(r.history.title, 'History');
  assert.deepStrictEqual(r.history.items.map(i => [i.key, i.href, i.title]), [
    ['movie:40102', origin + '/movie/40102', 'The Batman'], ['tv:556', origin + '/tvshow/556', 'The Batman (TV)']]);
  assert.deepStrictEqual([r.odd.partial, r.odd.key, r.odd.title, r.odd.poster, r.odd.overview, r.odd.playHref, r.odd.sources.length],
    [true, 'movie:5', 'Odd Title', 'https://img.example/og.jpg', 'Something.', origin + '/movie/5?play=1', 0]);
  assert.strictEqual(r.oddNoUrl, null, 'no URL: not guessed from the host page');
  assert.strictEqual(r.oddSearch, null);
  assert.strictEqual(r.oddHome, null);
  const full = await parsed('/movie/40102', 'detail');
  assert.strictEqual(full.partial, false);
});

t.test('normalisers: genres, runtime, ratings, image lists, TMDB backdrops, URL builders', async () => {
  await at('/movie/40102');
  const r = await page.evaluate(() => {
    const { Site } = window.__data, N = Site.normalize;
    return {
      genres: N.genres('ACTION,SCI-FI & FANTASY'), genres2: N.genres('war & politics, KIDS'),
      runtimes: ['176 min', '176 minutes', '21 minutes', '1h 56m', '0 min', 'soon'].map(N.runtime),
      ratings: ['0', '', '-,-%', '0%', '0.0', '7.8', '85%', 'N/A'].map(N.rating),
      imgList: N.styleImage("background-image:url(https://x.example/a.jpg),url('/static/img/default_cover2.png?rand=1')"),
      imgListRev: N.styleImage("url('/static/img/default_cover2.png'),url(&quot;https://x.example/b.jpg&quot;)"),
      icons: ['/static/img/4k_icon.png', 'https://cdn.example/blu-ray_icon.png', 'https://cdn.example/score.png', 'data:image/png;base64,xx', '', 'https://cdn.example/thumb_logo_ok_8f3.jpg'].map(u => N.image(u)),
      rel: N.image('/__img/thumb/a.png'),
      urls: [Site.url.search('the batman', 'tv', 2), Site.url.search('x'), Site.url.title('tv', 556, 2), Site.url.title('movie', 1, 3), Site.url.play('movie', 1),
        Site.url.play('tv', 556, 2, 3), Site.url.play('tv', 556), Site.url.home(), Site.url.movies(), Site.url.shows(), Site.url.library(), Site.url.suggest('ba t'), Site.url.hot()]
    };
  });
  assert.deepStrictEqual(r.genres, ['Action', 'Sci-Fi & Fantasy']);
  assert.deepStrictEqual(r.genres2, ['War & Politics', 'Kids']);
  assert.deepStrictEqual(r.runtimes, ['176 min', '176 min', '21 min', '116 min', '', '']);
  assert.deepStrictEqual(r.ratings, ['', '', '', '', '', '7.8', '85%', '']);
  assert.strictEqual(r.imgList, 'https://x.example/a.jpg');
  assert.strictEqual(r.imgListRev, 'https://x.example/b.jpg');
  assert.deepStrictEqual(r.icons, ['', '', '', '', '', 'https://cdn.example/thumb_logo_ok_8f3.jpg']);
  assert.strictEqual(r.rel, origin + '/__img/thumb/a.png');
  const o = origin;
  assert.deepStrictEqual(r.urls, [o + '/index/search?word=the%20batman&type=tv&page=2', o + '/index/search?word=x', o + '/tvshow/556?season=2', o + '/movie/1',
    o + '/movie/1?play=1', o + '/tvshow/556?season=2&episode=3&play=1', o + '/tvshow/556?play=1', o + '/', o + '/movie', o + '/tvshow',
    o + '/index/index/my_box', o + '/index/search/autocomplate?q=ba%20t&limit=12', o + '/index/api/search_hot']);
});

t.test('totality: garbage input never throws and returns empty-but-valid shapes', async () => {
  await at('/movie/40102');
  const r = await page.evaluate(() => {
    const { Site } = window.__data;
    const out = {}, bad = [null, undefined, 0, 'x', {}, { documentElement: 1 }, document.createElement('div')];
    let threw = 0;
    const tryAll = (name, fn) => { try { out[name] = bad.map(fn); } catch (e) { threw++; out[name] = String(e); } };
    tryAll('home', b => Site.home(b));
    tryAll('list', b => Site.list(b));
    tryAll('search', b => Site.search(b).items.length);
    tryAll('detail', b => Site.detail(b));
    tryAll('isGate', b => Site.isGate(b));
    tryAll('cards', b => (b === null || b === undefined) ? 'live' : Site.cards(b).length);
    tryAll('targetOf', b => Site.targetOf(b));
    tryAll('parseTitleUrl', b => Site.parseTitleUrl(b));
    tryAll('suggestions', b => Site.suggestions(b));
    tryAll('hot', b => Site.hot(b).trending.length);
    tryAll('selfTest', b => typeof Site.selfTest(b).ok);
    tryAll('pageType', b => typeof Site.pageType(b, b));
    tryAll('live', b => [Site.live.dismissPopup(b), Site.live.episodeButton(b, b), Site.live.click(b === document.body ? null : b && b.nodeType ? b : null)]);
    tryAll('url', b => Site.url.search(b, b, b).indexOf('/index/search?word='));
    tryAll('source', b => Site.source(b, b).quality);
    return { out, threw };
  });
  assert.strictEqual(r.threw, 0);
  assert.deepStrictEqual(r.out.home.slice(0, 6), Array(6).fill({ rows: [], banners: [] }));
  assert.deepStrictEqual(r.out.list.slice(0, 6), Array(6).fill({ title: '', items: [], next: '', chips: [] }));
  assert.deepStrictEqual(r.out.detail, Array(7).fill(null));
  assert.deepStrictEqual(r.out.isGate, Array(7).fill(false));
  assert.deepStrictEqual(r.out.parseTitleUrl, Array(7).fill(null));
  assert.deepStrictEqual(r.out.targetOf, Array(7).fill(''));
  assert.deepStrictEqual(r.out.suggestions, Array(7).fill([]));
  assert.deepStrictEqual(r.out.hot, Array(7).fill(0));
  assert.deepStrictEqual(r.out.selfTest, Array(7).fill('boolean'));
  assert.deepStrictEqual(r.out.pageType, Array(7).fill('string'));
  assert.ok(r.out.url.every(i => i > 0));
  assert.deepStrictEqual(page.errors, []);
});

(async () => {
  server = await mockSite.start();
  origin = server.origin;
  code = bundle(origin);
  browser = await launch();
  page = await openPage(browser, { tv: false });
  try { await t.run(); } finally {
    await browser.close();
    await server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
