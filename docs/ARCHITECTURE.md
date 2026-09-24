# MovieBox Pro TV 0.3 — architecture and contracts

This is the build contract for the TizenBrew module. Every source file, test and tool follows it. If code and this document disagree, fix one of them in the same change.

## 1. Goals, in priority order

1. **Reliable for years.** It never leaves the TV stuck. Every site-dependent step has a fallback, and every failure is logged and recoverable with the remote.
2. **Search works.** Remote typing, live suggestions, real results in a TV grid, type tabs and paging. It never depends on the page's own search form.
3. **Premium 10-foot UI.** It should feel like Apple TV+ or Netflix, not a website overlay.
4. **Plays through the website's own player.** No stream scraping and no private APIs beyond what the website itself calls.

## 2. Runtime environment facts (verified 2026-09-24)

- TizenBrew runs the site in its own Tizen web-app window and injects `tv.js`. With `evaluateScriptOnDocumentStart: false` it calls CDP `Runtime.evaluate` on **every** `Runtime.executionContextCreated`. The script can therefore run:
  - before `document.documentElement` or `document.body` exists (cached, fast evaluation);
  - more than once per page (isolated worlds or extension contexts), sharing one DOM but **not** JS globals;
  - in iframes, where it must exit immediately.
- The script is fetched from `https://cdn.jsdelivr.net/gh/AHcoder23/moviebox-pro-tv@<ref>/tv.js` and cached in memory until TizenBrew restarts.
- Samsung browsers range from Chromium 47 (Tizen 3, 2017) to Chromium 120+. **Runtime code must be ES5.** See §9 for banned APIs and CSS.
- The website (`https://www.movieboxpro.app/`, also served on the apex host) is a jQuery 1.7 PHP site. Without a login every page is the "Private Garden" gate. The site sniffs Samsung user agents and uses JW Player for them.
- Remote keys: arrows 37–40, OK 13, Back 10009 (Esc 27 on desktop), Play 415, Pause 19, Play/Pause 10252, Stop 413, FF 417, RW 412, Red 403, Green 404, Yellow 405, Blue 406, Info 457, Ch+ 427, Ch− 428, digits 48–57. Media and colour keys must be registered with `tizen.tvinputdevice.registerKey` in a try/catch.

## 3. Website facts the adapter relies on

The fixture pages in `test/fixtures/` are sanitized copies of real markup. Each page type lists its primary selectors; the adapter must also run a generic fallback (§5.2).

| Page | URL | Key markup |
|---|---|---|
| Home | `/` | `.contents .section`: the first section has no `h3` and holds landscape banners `a[href=/movie|tvshow/ID] p[style*=background-image]`. Other sections have `h3` (the title's text node, with a "More" `a[href]` inside) and cards `li[title]` holding `img[onclick="window.location.href='/movie/ID?from=home'"]`, `.score span`, `.tomato span`, `.update`, `img.icon` (`4k_icon`/`blu-ray_icon`). The "Waiting to Watch" cards add `img.play[onclick=...play=1]`, `.schedule .time span` (S37E21 or 01:02:09) and `.progress_bar span[style=width:NN%]`. |
| Search | `/index/search?word=Q&type=all|movie|tv|actor&page=N` | Count text `"164 results found for “batman”."`. `.search_nav a` type tabs (`.selected2` marks the current one). `.search_info > a[href=/movie|tvshow/ID][title]` cards: poster `img` (not `.icon`), `.score span`, `.update`, name `p`, meta `p` like `"7.8 | 2022 | 176 min <br>ACTION,CRIME"`. `.playlists .lists a[href=/playlist/ID]`. `.pagination` holds numbered links plus a `»` next link. **Each fetch of this URL adds the query to the user's server-side search history**, so fetch it only on an explicit submit. |
| Lists | `/index/index/movie_list?type=X`, `/movie`, `/tvshow`, `/index/movie/top_list?id=X`, `/index/tv/top_list?id=X` | Cards are `a[href=/movie|tvshow/ID]` with the poster either as an `img` or as `p[style*=background-image:url(POSTER),url(default)]`. The title comes from `a[title]` or the bold name `p`. Headings: `span[style*="font-size:24px"]`. Paging: `.pagination li.next a` or `a` with text `»`. `/movie` and `/tvshow` start with category chips `a[href*=top_list]`. |
| Library | `/index/index/my_box` | `li[title]` with `img.cover[data-id]`, `img.play[data-link=/movie/ID?play=1]`, `.schedule .time span`, `.progress_bar span`. |
| History | `/index/index/history` | `.history_movie a[href=/index/index/detail?id=ID]` (legacy movie URL) or `/index/index/tvdetail?id=ID` (legacy TV URL). |
| Movie | `/movie/ID` | `.poster_bg[style*=url(TMDB original)]` backdrop. `.info img.cover` poster. `.movie_title .name` title, `.year`, and facts `.info div > div > p` (`176 minutes`, `PG-13`, `ACTION, CRIME, DRAMA`). IMDb, Tomatometer and Audience values are the `p` inside `a[href*=imdb]` / `a[href*=rottentomatoes]` (Tomatometer uses `freshness*.png`, Audience uses `audience.png`). The overview is the long `p`. Quality badges are `img.style`. `a.start_app` (with `#save_progress` label) plays. Cast: `.actor a .personnel .left2 p`. Related: `.related .scroll_list a[title]`. Sources: `.sidebarbg2 ul li.play[oss_download_url]` (quality from `ic_choose_{4k,fullhd,hd,sd,org}.png`, file name span, size and date). Player: `#my_dialog` (display toggled), close `#dialog_close`, `#player_box` (JW) or `video#my-video`. Popups that can appear: `.sidebarbg2`, `.not_support_bg`, `.vip_pay_tips`, `.player_bg`, `.no_resource_bg`. |
| TV show | `/tvshow/ID?season=S` | Same info block (the title is `.movie_title span.name`; the first fact is "Update to S05 E13"). Episodes: `#season .tv_episode`, where `a.start_app_episode.watch_tab[season][episode]` holds the still in `p.chapter_img` background, `.score span`, the code `span.episode` ("S2E1"), the title in the second `a.start_app_episode p`, the date and runtime `p` ("May 14, 2005 (United States) \| 21 minutes") and the overview `p`. Season list: `.season_bg .season_list2` first `div` after `p.name2` "SEASON": `a[href=/tvshow/ID?season=N] p(.active)`. `#season p.title` reads "Season 2/5". |
| Gate | any URL when signed out | Title "Private Garden", `.login_btn`, links `/index/login`, `/index/login/qrcode`, `/index/login/code_login`. |

JSON endpoints (same-origin GET, cookies included):
- `/index/search/autocomplate?q=Q&limit=12` returns `[{"name": "..."}]`. It does not record history. Use it for live suggestions.
- `/index/api/search_hot` returns `{code:1,data:{list:[trending strings], html:"<div class=search_history>... <p class=search_submit key=K data-id=N>K<img></p>..."}}`. Parse `data.html` with DOMParser and read `[key]` for recent searches.

Playback URLs (the website itself implements these):
- Movie: `/movie/ID?play=1` clicks `.start_app` once the page is ready. With one source the player starts; with several, `.sidebarbg2` opens.
- Episode: `/tvshow/ID?season=S&episode=E&play=1` clicks that episode.
- Show "resume": `/tvshow/ID?play=1`.

Loading a movie or TV page does **not** record watch history (verified), so detail prefetching is safe. Playback does.

## 4. Source layout and build

```
src/00-core.js      U (utilities), Log, Store, Keys   — no DOM work at load time
src/10-site.js      Site (pure extraction and URL helpers over a Document)
src/20-api.js       Api (XHR, caching, search, suggestions, detail metadata), Prefs, Session
src/30-ui-kit.js    Focus engine, element builders, icons (inline SVG strings), image loader
src/40-ui-screens.js  Screens: home, browse grid, search, detail, library, settings, sign-in, diagnostics
src/50-ui-overlays.js Source picker, player controller + OSD, exit dialog, toasts, native-page mode
src/60-app.js       App: router, screen stack, state restore, key dispatch
src/90-boot.js      Boot: guards, wait-for-DOM, CSS injection, error isolation, App.start
src/shell.css       All styles, scoped under #mbptv
tools/build.cjs     Concatenates into tv.js; injects VERSION, START_URL, CSS
tools/lint.cjs      ES5 syntax check (acorn ecmaVersion 5) + banned API/CSS scan
tools/preview.cjs   Local preview server: fixtures + mock site behaviour + built tv.js (rebuilds on src/ changes)
tools/mock-site.cjs Offline stand-in for the website built from test/fixtures (JSON endpoints, paging, gate cookie,
                    ?play=1, a jQuery subset for inline page scripts, mock player). Never contacts the real site.
tools/screenshot.cjs Renders every UI state to test/artifacts/shots/ for visual review
tools/run-tests.cjs Runs every test/*.test.cjs with Playwright (system Edge/Chrome)
```

`tools/build.cjs` emits exactly:

```
/* MovieBox Pro TV <VERSION> — independent TizenBrew module. MIT license. */
(function () {
  'use strict';
  var VERSION = "<VERSION from package.json>";
  var START_URL = "<websiteURL from package.json>";
  var CSS_TEXT = <JSON string of src/shell.css>;
<each src/*.js file in name order, verbatim>
}());
```

The `  var START_URL = ...;` line must keep two-space indentation and stay unique (`test/compat.test.cjs` checks it). `configure-start-page.ps1` changes `websiteURL` in `package.json` and rebuilds, restoring both files if anything fails. `tv.js` is committed (TizenBrew serves the committed file through jsDelivr) and CI fails when it does not match `src/`. Every source file may declare **only** its namespace `var`s at top level (listed per file above). Nothing runs at load time except namespace definitions; `90-boot.js` calls `Boot.start()` as its last statement.

## 5. Data contracts

### 5.1 Item (a title card)

```js
{
  key: 'movie:40102',          // kind + ':' + id — stable identity
  kind: 'movie' | 'tv',
  id: '40102',
  title: 'The Batman',
  href: 'https://www.movieboxpro.app/movie/40102',   // absolute, same-origin, no query
  poster: 'https://thumb.chuaxin.com/thumb_...png', // '' if none; never a /static/ placeholder
  backdrop: '',                // landscape art when known (home banners, detail cache)
  rating: '7.8',               // '' if missing or '0'
  tomato: '85%',               // ''
  year: '2022',                // ''
  runtime: '176 min',          // ''
  genres: ['Action', 'Crime'], // title-cased, may be []
  badge: '4K' | 'Blu-ray' | '',
  update: 'S05 E13',           // latest-episode label for shows, ''
  progress: 0.0625,            // 0..1 for continue-watching cards, else -1
  progressLabel: 'S37E21',     // or '01:02:09', ''
  playHref: 'https://.../movie/1831?play=1'  // continue/play link when the page provides one, else ''
}
```

### 5.2 `Site` API (src/10-site.js). Pure functions; `doc` is any Document (live or DOMParser-made).

- `Site.parseTitleUrl(str, base)` returns `{kind, id, season, episode, play}` or `null`. It accepts `/movie/ID`, `/tvshow/ID`, `/index/index/detail?id=ID` (movie), `/index/index/tvdetail?id=ID` (tv), relative or absolute, same host only (either host variant: www or apex), and ignores `from=`.
- `Site.targetOf(el)` returns the title URL from `href`, `data-link`, `data-href` or an `onclick` of the form `(window.)location.href='...'` (quotes of either kind, `&amp;` decoded), or `''`.
- `Site.cards(root, opts)` is the **generic extractor**: every element whose `targetOf` parses as a title becomes a card. The card root is the nearest ancestor (or self) that contains artwork without containing a different title. Fields are filled per §5.1. Dedupe by key, keeping the richest record. Works without layout (DOMParser docs); when `opts.live`, drop hidden cards.
- `Site.home(doc)` returns `{rows: [Row], banners: [{key, kind, id, href, image}]}`, where `Row = {id, title, items: [Item], more: url|''}`. Rows come from `.section h3` (strip the "More" link text). The fallback is one row from `Site.cards(doc)`. Banner images also fill `backdrop` on matching items.
- `Site.list(doc)` returns `{title, items, next: url|'', chips: [{label, href}]}`.
- `Site.search(doc)` returns `{query, type, total: number|null, types: [{type, label, href, selected}], items, playlists: [{title, href, image, count}], next: url|'', empty: bool}`.
- `Site.detail(doc, url)` returns `null` or:

```js
{ kind, id, key, href, title, year, poster, backdrop /* TMDB w1280 variant */, backdropOriginal,
  runtime: '176 min', certification: 'PG-13', genres: [], update: 'Update to S05 E13',
  ratings: {imdb: '7.8', tomato: '85%', audience: '87%'},   // '' when missing or '-,-%'
  overview, badges: ['4K HDR', '4K', 'Blu-ray'], audio: 'ENG', playLabel: 'PLAY',
  sources: [{index, quality: '4K'|'1080p'|'720p'|'SD'|'Original', file, size, date}],
  cast: [{name, role, image}], related: [Item],
  season: 2, seasons: [{number, href, current}],
  episodes: [{season, episode, code: 'S2E1', title, date, runtime, overview, still, rating}] }
```

- `Site.isGate(doc)` returns true for the "Private Garden" gate: a `.login_btn` or `/index/login` link, with no nav and no `.contents`.
- `Site.pageType(locationLike, doc)` returns one of `home | search | list | library | movie | tv | gate | login | other`.
- `Site.url` builds absolute same-origin URLs: `search(q, type, page)`, `title(kind, id, season)`, `play(kind, id, season, episode)`, `home()`, `movies()`, `shows()`, `library()`.
- `Site.live` holds live-DOM helpers, used only on the real page: `playButton()`, `episodeButton(season, episode)`, `sourceItems()` (visible `.sidebarbg2 li.play`), `sourcePickerOpen()`, `closeSourcePicker()`, `playerOpen()` (`#my_dialog` visible **or** a visible `video` at least 40% of the viewport; videos inside visible same-origin iframes count), `closePlayer()` (click `#dialog_close`, else hide `#my_dialog` and pause videos), `video()` (largest visible `video`), `blockingPopups()` (visible `.not_support_bg`, `.vip_pay_tips`, `.player_bg`, `.no_resource_bg`, `.season_bg`), `dismissPopup(el)` (click its close control, else hide it).
- `Site.suggestions(jsonText)` returns `[string]`. `Site.hot(jsonText)` returns `{trending: [string], recent: [string]}`.
- `Site.selfTest(doc, type)` returns `{ok, warnings: [string], counts}` for diagnostics.

Every Site function must be total: it catches internally and returns an empty-but-valid structure, never throws.

### 5.3 `Api` (src/20-api.js)

All callbacks are Node-style `cb(err, result)` and are called exactly once, asynchronously.

- `Api.fetchDoc(url, cb)` uses a same-origin XHR GET with `withCredentials`, a 15 s timeout and one retry on network error or 5xx, then parses with `DOMParser` (falling back to `document.implementation.createHTMLDocument`). If `Site.isGate` is true the error is `{code: 'signed-out'}`. It returns `{doc, url: responseURL || url}`. Identical in-flight requests are shared.
- `Api.fetchJSON(url, cb)`.
- `Api.home(cb)`, `Api.list(url, cb)`, `Api.search(q, type, page, cb)` (fetches the search page and runs `Site.search`), `Api.suggest(q, cb)` (autocomplete; the caller debounces by 350 ms, and stale responses are dropped by sequence number), `Api.hot(cb)`.
- `Api.detail(kind, id, cb, opts)` returns the Detail model. Results are cached in memory (50) and a compact metadata copy goes into localStorage `mbptv:meta:v1` (LRU 300 entries, 14-day TTL, fields: title, year, backdrop, poster, runtime, certification, genres, ratings, overview ≤ 420 chars). `Api.meta(key)` synchronously returns cached metadata or null. `Api.prefetch(item)` is low priority, holds at most one request in flight, and a newer prefetch replaces an older one.
- `Prefs`: `get(name)` and `set(name, value)` on localStorage `mbptv:prefs:v1`. Defaults: `{quality: 'ask'|'best'|'1080p'|'720p', nativeRemote: true, autoplayNext: false, reduceMotion: false}`, with `quality` defaulting to `'best'`.
- `Session` (sessionStorage `mbptv:session:v1`): `save(stack, {expect, returnTo})` before any navigation away (defaults: the current page type and URL), `take(pageType)` on boot returns the saved stack once (valid for 30 min and only if the page type matches `expect`; a non-matching page leaves it for the page that matches). Also `peek()`, `returnTo()` and `clear()`.
- Additions used by the UI: `Api.prefetch(item, cb?)` (cb once: the Detail, `null` when already cached, or `{code:'superseded'}`), `Api.remember(detail)` (seed the caches from the live page), `Api.onSignedOut(fn)`, `Api.cancelSuggest()`, `Prefs.onChange(fn)`. Superseded `Api.suggest` callbacks are never called (the one exception to "exactly once").
- `Api.recentSearches()` and `Api.addRecentSearch(q)` keep a local list of 12 alongside the server's history.

Storage wrappers must survive `localStorage` throwing (Tizen private mode, quota) and fall back to memory. `Store` keeps every value this page wrote in memory and reads it back first, so a failed (full) write never returns an older stored value.

## 6. UX specification

Reference frame: 1920×1080. `#mbptv { font-size: 0.8333vw }`, so **1em = 16px at 1080p**. All sizes use `em`, never `rem` (the site sets the html font size).

### 6.1 Visual system

- Colours: bg `#07070a`; elevated `#131318`; elevated-2 `#1c1c23`; hairline `rgba(255,255,255,.08)`; text `#f5f5f7`; text-2 `rgba(245,245,247,.72)`; text-3 `rgba(245,245,247,.46)`; brand gold `#e7bd68`; IMDb chip `#f5c518` with black text; fresh `#fa320a`; success `#35c46a`.
- Type: `"SamsungOne", "Samsung Sans", "TizenSans", "Helvetica Neue", Helvetica, Arial, sans-serif`. Display 4.5em/800 (hero title), H1 3em/700, section 1.75em/600, body 1.5em/400 (24px minimum for reading text), meta 1.25em/500, micro 1.0625em/600 in caps with letter-spacing .06em (badges only).
- Safe area: 3.5em top, 5em right, 3em bottom. Content starts at left 9em (rail collapsed).
- Surfaces use no borders; depth comes from tone and shadow. Radius: cards .5em, buttons 2em (pill), sheets 1em.
- Focus is unmistakable at 3 m. Cards scale 1.08 with a `0 0 0 .22em #fff` ring and a `0 1.2em 2.4em rgba(0,0,0,.6)` shadow, and their titles brighten. Buttons turn solid white with black text. List rows get a white 12% background and white text. Motion: `transform .18s cubic-bezier(.2,.8,.2,1)`. Everything is still with `reduceMotion`.
- No emoji (Tizen fonts lack them). Icons are inline SVG with `fill="currentColor"`.
- Images fade in (opacity .25s). Placeholder cards show an elevated tone with the title text centred, so a missing poster still looks deliberate.

### 6.2 Layout

- **Rail** (left, 6.5em collapsed): gold monogram at top; icons Search, Home, Movies, TV Shows, My Library, Settings. When it gains focus it expands to 19em over a left gradient and shows labels. The current screen's icon is gold.
- **Home**: a full-bleed hero (the top 62% of the screen) shows the focused title's backdrop, taken from the metadata cache or a banner; otherwise the poster, blurred-looking via a large scaled image at 35% opacity (no CSS blur). Gradients run left→right `#07070a 0% → rgba(7,7,10,.85) 35% → transparent 70%` and bottom→top. Left column: title (display, 2 lines max), meta line `2022 · 2h 56m · PG-13 · Action, Crime`, chips `IMDb 7.8` and `4K`, overview clamped to 3 lines, then buttons **Play**/**Resume** (primary) and **Details**. Below the hero, rows of posters (12em × 18em) with the row title above. Continue-watching cards show a progress bar and label. Moving between rows slides the page vertically so the focused row sits just under the hero; the hero stays pinned and updates 250 ms after focus settles. Details are prefetched after a 450 ms dwell.
- **Detail**: a full-bleed backdrop with strong left and bottom gradients. Left 56%: title, meta, ratings (IMDb chip, Tomatometer %, Audience %), overview (4 lines), badges, buttons **Play**/**Resume** · **Quality: Best** (opens the picker for movies) · for shows **Episodes**. Below: shows get a season pill row and an episode row (16:9 stills 22em wide with code, title, runtime and 2-line overview); movies get **More like this** (related) and **Cast** (name and role text chips). Back returns to the previous screen with focus restored.
- **Search**: left panel 34em holds the query line (2.5em type, blinking caret, placeholder "Search movies and shows"), a keyboard grid of 6 columns (A–Z, 0–9) and a final row of **Space**, **Delete** and **Clear**, and under it up to 6 suggestions as full-width text rows. The right area shows results for "Q" · N titles, tabs **All / Movies / TV Shows**, and a poster grid of 5 columns; reaching the last row loads the next page. With an empty query the right area shows **Recent** chips (local plus server) and **Trending** chips. OK on a suggestion or chip runs the search; **Search** runs it explicitly; typing does not fetch results, only suggestions. Digit keys and a physical keyboard type into the query. Backspace deletes.
- **Browse grid** (Movies, TV Shows, list pages, library): header title, a chip row where the page has one, a 6-column poster grid and infinite paging.
- **Settings**: Preferred quality (Best / 1080p / 720p / Ask every time), Website remote controls on/off, Reduce motion, Diagnostics, Open website view, Reload, About (version).
- **Diagnostics**: version, UA, page type, last self-test, last 30 log lines. It exists to read out over the phone.
- **Sign-in** (gate): a centred card "Sign in to MovieBox Pro" with **Sign in with QR code**, **Sign in with a code** and **Sign in with Google**, each opening the site's page in website mode, plus a note that login happens on the website.
- **Source picker** (sheet from the right, 40em): rows showing a quality badge, file name (ellipsized), size and date. The preferred quality is pre-focused. With `quality != 'ask'` and a match, it auto-selects within 400 ms and shows a toast "Playing 1080p · 6.71 GB". Back closes it and restores the detail view.
- **Player mode** (the site player is visible): our UI hides. Keys: OK toggles play/pause, Left/Right seek ∓10 s (holding accelerates to 30 s), Up/Down show the OSD, Back closes the player (`Site.live.closePlayer()`) and returns to the detail screen, and media keys work. The OSD is a bottom gradient with the title, a progress bar, `elapsed / duration` and hints. It auto-hides after 3 s and never blocks the video. Site popups that appear during playback get TV handling: the focused close button, and Back dismisses.
- **Exit dialog**: Back on the Home root opens "Exit MovieBox Pro TV?" with **Stay** focused and **Exit** next to it. Exit calls `tizen.application.getCurrentApplication().exit()` and falls back to `window.close()`.
- **Toasts**: a bottom-centre pill that auto-hides after 3.5 s; at most one at a time.
- **Website mode** (`native`): used for pages the shell does not model (login, settings pages, playlists). The site is visible. The existing spatial navigation (a white ring around the focused native control), OK clicks, Back is history-back, and a small floating "TV" pill bottom-left reopens the shell (Blue or Info also reopens it).

### 6.3 Navigation model

- `App` keeps a stack of `{screen, params, focusKey, scroll}`. Back pops; an empty stack on Home opens the exit dialog.
- Screens render from **fetched** documents (`Api.*`), so moving around the catalogue never reloads the page. The one exception: when the boot page itself is the needed page (for example boot on `/` for Home, or on `/movie/ID` for that detail), it uses the live DOM directly.
- **Play**:
  1. If the live page is this title's detail page, click the live control (`Site.live.playButton()` or `episodeButton`).
  2. Otherwise save the stack in `Session` with `returnTo` set to the current URL, then set `location.href = Site.url.play(...)`.
  3. On a `play=1` page the shell boots into a "Starting playback" overlay (backdrop, title and spinner). The source picker or player then takes over. If after 5 s neither `playerOpen()` nor `sourcePickerOpen()` is true, it clicks the live play control itself. If still nothing after 10 s it shows the detail screen with a toast "The website didn't start playback. Try Play again."
  4. When the player closes via Back: if `Session` has `returnTo` and `history.length > 1`, call `history.back()`; the previous page restores its stack from `Session` (or bfcache `pageshow`). Otherwise show the live detail screen.
- Focus engine: every focusable element has `data-f` and lives inside a **zone** element (`data-zone="rail|hero|row:ID|grid|keyboard|tabs|list|sheet|dialog"`). Left/Right inside a `row`/`tabs` zone moves to siblings (Left at index 0 goes to the rail); Up/Down between zones restores the zone's remembered index, clamped to the nearest by x-position; grids navigate by column; anything else uses geometric nearest-in-direction within the active layer. The topmost layer (dialog > sheet > screen) owns input. Scrolling uses CSS transforms on the zone track (horizontal) and on the screen body (vertical), never `scrollIntoView`.
- Key repeat: honour auto-repeat but render at most one focus move per animation frame; seek repeats accelerate.

## 7. Reliability requirements

- **Boot guard**: wait (poll every 30 ms up to 20 s, plus `DOMContentLoaded` and `readystatechange`) until `document.body` exists. Exit if `window.top !== window.self`. Exit if `document.getElementById('mbptv')` or `documentElement[data-mbptv]` already exists (an injection in another world). Run on hosts matching `movieboxpro` **or** pages whose DOM looks like MovieBox (`#top_nav_home`, `.start_app`, `.login_btn`, or a title containing "MovieBoxPro"). Never run on third-party login hosts.
- **Error isolation**: every event handler and timer callback is wrapped with `U.guard(fn, label)`, which catches, logs and continues. If a screen render throws, show the fallback screen for that route ("Couldn't load this page" with **Retry** / **Open website** / **Home**). If the shell itself fails to boot, remove it entirely and leave the website usable. The website must never be left covered by a broken overlay.
- **Watchdog**: every 2 s, if the shell is in a visible mode but has no focused element, or the focused element is detached, re-focus the screen's default element. If the player is detected while the shell is visible, switch to player mode.
- **Network**: every request has a timeout, a retry and a user-visible outcome. A signed-out response routes to the sign-in screen.
- **Adapters degrade**: primary selectors first, then the generic `Site.cards`. Empty results show an empty state with **Open website**, never a blank screen. `Site.selfTest` warnings go to `Log`.
- **No site JS globals**: interact only through the DOM (clicks, events), URLs and same-origin HTTP, because the module may run in an isolated world. Never call `jQuery`, `jwplayer` or `init_player`.
- **Security**: never inject HTML strings built from site data. Use `textContent` and attribute setters. Only same-origin URLs are navigated to, and only `http(s)` images from any host are displayed. There is no `eval` or `new Function`.
- **Diagnostics**: `Log` holds a ring buffer of 200 entries (time, level, label, message), mirrored to localStorage `mbptv:log:v1` (last 60).
- **Remote keys never get lost**: one capture-phase `keydown` listener on `window`, also added to every same-origin `iframe` window (the website may load its player page into one). The watchdog puts DOM focus back on the `.is-focused` control when anything else (a site input, an ad or embed `iframe`) holds it, and blurs a focused cross-origin `iframe` in every mode. Key handlers that throw 4 times in 15 s switch to website mode; if that also fails, the shell removes itself.
- **Playback never traps the viewer**: Back during "Starting playback" cancels, and for 4 s afterwards a website picker or player that still opens is closed again. A `?play=1` page the viewer stays on (playback ended, failed or was cancelled) drops `play=1` from its URL with `history.replaceState`, so a reload or a later Back into it never starts playback again. If the website's file list cannot be read (markup changed), the website's own picker is shown with the focus ring (popup mode) instead of being covered. If the website's player uses browser fullscreen, the OSD moves inside the fullscreen element.
- **Website mode survives page loads** (sessionStorage `mbptv:web:v1` = `{t, origin, kind}`, 30 min): `kind: 'here'` (Settings, Open website view) keeps website view while the viewer browses the site; `kind: 'nav'` (Open website on a screen) returns to the shell when the viewer comes back to `origin`. Leaving a page in website mode saves the shell stack to `Session`, so Blue / the TV pill restores the viewer's place.
- **No unbounded growth**: every cache is capped (screens kept: 4, detail memory 50, metadata 300, suggestions 40, URL resolvers 24, log 200).

## 8. Testing

- `tools/lint.cjs` parses `tv.js` with acorn (`ecmaVersion: 5`) and fails on banned tokens (§9).
- `test/site.test.cjs` loads each fixture into a page (network aborted) and asserts `Site.*` outputs (counts, fields and edge cases such as a `0` rating, `-,-%` ratings, legacy URLs, `&amp;` in onclick).
- `test/boot.test.cjs` covers injection timing and repetition (document start, every execution context, after load, iframes), foreign hosts, and the teardown when `App.start` throws.
- `test/api.test.cjs` covers requests (timeouts, retry, sharing, signed-out), caches, prefetch, `Prefs`, `Session`, recent searches and failing storage.
- `test/reliability.test.cjs` covers navigation across real page loads (Session restore after `history.back()`, website mode persistence), `?play=1` URL settling, cancel-while-starting, the website-picker fallback, a player inside a same-origin iframe, focus theft by an iframe, letter keys without `KeyboardEvent.key`, a full storage quota and library tabs.
- `test/app.test.cjs` serves fixtures through a mock same-origin server that implements the JSON endpoints, `/index/search`, `?play=1` behaviour (showing `.sidebarbg2` or a fake `#my_dialog` with a `video`), and drives the built `tv.js` with keyboard events: boot, home render, focus movement, search typing, suggestions, submit, results, detail, play handoff, player keys, Back chain, exit dialog, signed-out routing, and double injection (evaluate `tv.js` twice leaves one shell).
- `test/compat.test.cjs` runs the same boot smoke test with the user agent and viewport of a Tizen TV (1920×1080, 1280×720, Tizen 3), real Tizen key codes, post-Chromium-47 APIs removed, throwing storage and an 800 ms slow site, and checks the TizenBrew manifest.
- Before a release also run `node tools/screenshot.cjs` and look at every image, then verify on a TV (see README).

## 9. Banned in runtime code

JS: `=>`, `let`, `const`, `class`, template literals, spread/rest, destructuring, default params, `async`/`await`, `Promise` (avoid; use callbacks), `fetch`, `Object.assign`, `Array.from`, `Array.prototype.includes`/`find`/`findIndex`, `String.prototype.includes`/`startsWith`/`endsWith`/`repeat`/`padStart`, `NodeList.prototype.forEach`, `Element.closest` (write `U.closest`), `Element.prototype.append`/`prepend`/`remove` (use `removeChild`), `classList.toggle(x, force)` second arg, `IntersectionObserver` without a fallback, `requestIdleCallback`, `URL`/`URLSearchParams` (parse with an `<a>` element), `Symbol`, `Map`/`Set`, optional chaining, `??`, `Object.values`/`entries`/`fromEntries`, `.at()`, `.flat()`/`.flatMap()`, `.trimStart()`/`.trimEnd()`, `.replaceAll()`, `.padEnd()`, `.findLast()`, `Node.isConnected`, `getAttributeNames`, `structuredClone`, `queueMicrotask`, `globalThis`, `AbortController`, `ResizeObserver`, `scrollIntoView`, event constructors (`new Event(...)`; use `document.createEvent`), and the site's globals (`jQuery`, `$`, `jwplayer`, `init_player`). `KeyboardEvent.key` is missing before Chromium 51: read `keyCode` first (`Keys.name` does). `U.qs`/`U.qsa` with a missing root return `null`/`[]`; pass `document` explicitly.

CSS: `var(`, `gap:` on flex (use margins), `display: grid`, `inset:`, `position: sticky`, `backdrop-filter`, `filter: blur`, `aspect-ratio`, `:focus-visible`, `:is(`, `:where(`, `clamp(`, `min(`, `max(`, `@supports`. `-webkit-line-clamp` with `display:-webkit-box` is allowed.

## 10. DOM contract for tests and diagnostics

The UI must expose these hooks; `test/app.test.cjs` depends on them.

- Root `div#mbptv` (the only top-level element we add besides `style#mbptv-css`, `#mbptv-pill`, `#mbptv-ring` and `#mbptv-osd`). Attributes: `data-screen` = `loading | home | search | detail | browse | settings | diagnostics | signin | error | native | player`; `data-layer` = `'' | sheet | dialog`.
- The focused control has class `is-focused` **and** is `document.activeElement` (call `.focus()` on it; every focusable has `tabindex="-1"`).
- Title cards: `[data-key="movie:40102"]`. Rows: `[data-zone="row:<rowId>"]`. Grids: `[data-zone="grid"]`.
- Buttons: `[data-action]`, for example `play`, `details`, `episodes`, `quality`, `search-submit`, `retry`, `open-website`, `exit`, `stay`, `nav-home`, `nav-search`, `nav-movies`, `nav-shows`, `nav-library`, `nav-settings`.
- Keyboard: letter and digit keys `[data-char="a"]` (lowercase), special keys `[data-action="space" | "delete" | "clear"]`. Query text: `#mbptv-query`.
- Suggestions `[data-suggestion]`, recent/trending chips `[data-query]`, type tabs `[data-type="all|movie|tv"]`.
- Episodes `[data-episode="2x1"]`; seasons `[data-season="2"]`.
- Source picker rows `[data-source-index="0"]` inside `[data-sheet="sources"]`.
- Dialogs `[data-dialog="exit"]`. Toast `#mbptv-toast` (its textContent is the message). Player OSD `#mbptv-osd` (class `is-visible` while shown).
- `window.__mbptv` is set by Boot: `{version, App, Site, Api, Log, U}`. `App.state()` returns `{screen, stack: [screen names], focusKey, mode: 'boot'|'shell'|'native'|'popup'|'player', layer}`.
- Also exposed: `#mbptv[data-overlay="starting"]` while the "Starting playback" overlay shows; the quality sheet `[data-sheet="quality"]` with `[data-option="best|1080p|720p|ask"]` rows and, on a movie, `[data-file-index]` rows for its files; the error screen's `[data-action="home"]`; settings rows `[data-action="setting-<key>"]` (`quality`, `nativeRemote`, `reduceMotion`, `diagnostics`, `website`, `reload`, `about`); diagnostics `[data-action="selftest"]` and `[data-action="clear-log"]`; `html.mbptv-sources` while our source sheet covers the website's picker.
- sessionStorage keys besides `mbptv:session:v1`: `mbptv:web:v1` (website mode across page loads, §7) and `mbptv:pick:v1` (a one-time file choice from the quality sheet, consumed by the next source picker for that title within 10 minutes).
