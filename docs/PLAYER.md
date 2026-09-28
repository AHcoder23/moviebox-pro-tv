# Native player (0.3.1)

## Why

The website's own playback path failed on the user's Samsung TV ("The website didn't start playback").

- **Old TVs:** the site's main title-page inline script (60–135 KB, holding the Play handler, `if (play)` auto-play and `init_player`) declares `let` variables in sloppy mode. Chromium < 49 (Tizen 3.0, 2017 TVs) rejects the whole script, so the Play button does nothing.
- **Newer TVs:** the page must first download and run jQuery, JW Player (261 KB), video.js (545 KB, which uses optional chaining and so throws on Chromium < 80) and hls.js (364 KB). That easily exceeds our old 10-second wait, and the flow depends on the site's page scripts.

So 0.3.1 plays video itself, in its own full-screen `<video>`, using the same endpoints the site's player uses. The website player stays as a fallback.

## Real endpoints (verified 2026-09-24 on the live site, signed in)

1. **Files for a movie:** the movie page `/movie/ID` has `.sidebarbg2 ul li.play[oss_download_url="/index/index/player?mfid=N"]`, one per file. The file name is in the `span`, and quality comes from `img[src*=ic_choose_(4k|fullhd|hd|sd|org)]`, plus size and date. There can be several (for example a 1080p WEBRip at 6.71 GB and a 2160p HDR at 14.47 GB).
2. **Files for an episode:** `POST /index/index/tv_file`, form-encoded `tid=ID&season=S&episode=E`, with header `X-Requested-With: XMLHttpRequest`. It returns `{"code":1,"msg":"success","data":{"list":"<li class=\"play\" oss_download_url=\"/index/index/player?tfid=N\" ...>...</li>"}}`. On failure it returns `code != 1` and a `msg`. Fixture: `test/fixtures/tv_file.json`.
3. **Player data:** `POST <oss_download_url>&jwplayer=1`, same header, empty body. It returns about 200 KB of HTML/JS (the site injects it into `#player_box`). A negative code comes back as JSON `{"code":-1,"msg":"..."}` (for example VIP-only or not ready). Fixtures: `test/fixtures/player-tv.txt`, `test/fixtures/player-movie.txt`. Parse with regexes, never eval:
   - `var sources = [ ... ];` is a JSON array. Use the **first occurrence that is not on a `//` comment line**; a second, commented-out `//var sources = ...` follows it. Items: `{type: 'video/mp4' | 'application/x-mpegURL', file, label: 'ORG' | 'AUTO' | '1080p' | '720p' | '360p', mp4_id, h265: 0|1, width, height, bitstream, size, hdr, fps}`.
     - `ORG` is the original MP4 (it can be HEVC or 4K HDR; see `h265`/`hdr`).
     - `AUTO` is adaptive HLS. The fixed HLS labels are H.264 transcodes.
   - Also parse:
     - `var seconds = N;` — the resume position in seconds.
     - `var mp4_id = N;`
     - `var next_season = 'S';` and `var next_episode = 'E';` — empty strings when there is no next episode.
     - `var tid = N; var current_season = S; var current_episode = E;` — TV only.
     - `var skips = '{json}';` — `{start, end, ...}`, where `-1` means unknown. Treat `start > 0` as "intro ends at start" and `end > 0` as "credits begin at end".
     - `var post = {json};` — the progress payload base, for example `{"type":"tv","tid":17417,"season":1,"episode":1}` or `{"type":"movie","mid":1831}`.
     - `url : "/index/index/(tv|movie)_progress"` — the progress endpoint.
   - **TV audio fix:** on Samsung/LG TVs the site appends `audio=aac` to every HLS URL, because EAC3 audio stalls in native HLS. Do the same when `Platform.isTV`, or when `MediaSource.isTypeSupported('audio/mp4; codecs="ec-3"')` is false.
4. **Progress:** `POST /index/index/tv_progress` (TV) or `/index/index/movie_progress` (movie), form-encoded as the `post` object plus `over` (`runtime - time < 300 ? 1 : 0`), `seconds` (integer current time) and `mp4_id`, with header `X-Requested-With: XMLHttpRequest`. The site sends it periodically and on stop. Skip it when the time hasn't changed, when duration is unknown, or when playback never started. This keeps Continue Watching and the site's resume points in sync.
5. **Stream behaviour:**
   - **Desktop Chromium:** the ORG MP4 (H.264) plays directly in `<video>`; first frame arrived in about 3.5 s. Native HLS reports `canPlayType('application/vnd.apple.mpegurl') === 'maybe'`, but the AUTO m3u8 failed with `MEDIA_ERR_SRC_NOT_SUPPORTED` (4).
   - **Samsung TVs:** they play HLS natively in `<video>` through the platform player (the site's JW Player path depends on it).
   - Stream URLs carry signed, time-limited, account- and IP-bound tokens: **never log or persist them**.

Loading `/movie/ID` or `/tvshow/ID` pages records nothing. Calling the player endpoint and posting progress are exactly what the site does when the user presses Play; that is expected.

## Contract: `src/55-player.js` defines `var NativePlayer` (plus private helpers inside its IIFE) and `src/player.css`

```js
NativePlayer.play(req, hooks)
// req:   {kind: 'movie' | 'tv', id, season, episode, title, showTitle, episodeTitle, backdrop, poster,
//         fileIndex /* optional movie file choice */, fileUrl /* optional oss_download_url */,
//         autoplayNext /* optional; false = the Up Next card has no countdown and waits for the viewer */}
//         season/episode: a missing or invalid value means 1; episode 0 (a special such as S01E00) only when passed as 0
// hooks: {mount: HTMLElement /* #mbptv root */, onOpen(), onClose(info), onFallback(req, reason),
//         onProgress(info), onNext(nextReq)}
// Returns true when the overlay is up (loading has begun), false when it could not start at all (no usable id,
// or an internal failure while building): then nothing is on screen, no hook was called, and the caller runs the
// website path itself. Called while active, it replaces the session in the same overlay (no onOpen/onClose).
NativePlayer.active()          // true while the player overlay is up (loading, playing, error or up-next)
NativePlayer.key(name, event)  // name from Keys.name(event); returns true for every key while active (the player
                               // owns the remote), false when not active. Auto-repeats (event.repeat) of keys that
                               // act once (OK, Back, Backspace, Stop, Play, Pause, Play/Pause, Space, Ch+/-, Info)
                               // are swallowed; arrows and FF/RW keep repeating (seek, sheet)
NativePlayer.stop(reason)      // saves progress, tears down the video and overlay, calls hooks.onClose(info) once;
                               // returns true, or false when nothing was open (idempotent)
NativePlayer.info()            // {kind, id, season, episode, time, duration, paused, stream: 'hls' | 'mp4', label,
                               //  state: 'loading' | 'playing' | 'error', started, file} or null when not active;
                               // for diagnostics, never URLs
NativePlayer.configure(opts)   // test/diagnostic tuning of the timings below; returns the current values
NativePlayer._parse(text)      // pure: player-endpoint text -> {code, msg, gate, sources, seconds, mp4Id, next,
                               //  tid, season, episode, skips, post, progressUrl, ok}
NativePlayer._order(sources, env) // pure: env {tv, aac, canPlay(mime)} -> candidates in try order
```

Hook semantics (as implemented):

- `onOpen()` once, right after the overlay is mounted and loading has begun.
- `onClose(info)` exactly once per overlay: the `play()` that opened it (returned true while the player was not active) gets one `onClose` when the overlay goes away. A `play()` while the player is active replaces the session inside the same overlay with no `onOpen`/`onClose` for the switch (only if building the replacement fails does the overlay close, with `onClose` reason `'internal'`). The overlay goes away on Back/Stop (`reason` `'back'`/`'stop'`), the end of a movie or of a last episode (`'ended'`), `stop(reason)`, and also **before** `onFallback` (`'fallback'`). `info` = the `info()` fields plus `reason` and `over` (0/1, the last value saved to the site).
- `onFallback(req, reason)` right after that `onClose`, when the viewer chose **Try website player** or the site answered signed-out. `req` is the request of the episode that failed (after Up Next it is the later episode). Reasons: `'signed-out'` (no card; route to sign-in), `'streams-failed'`, `'site-error'` (code < 0 or tv_file code != 1, e.g. VIP only), `'no-files'`, `'network'`, `'bad-answer'`, `'internal'`.
- `onProgress({kind, id, season, episode, seconds, duration, over})` each time a progress post is sent.
- `onNext(nextReq)` whenever the player moves to another episode in the same overlay (Up Next countdown or Play now, the Next Episode button, Ch+/Ch−, `ended`). `nextReq` has the `req` shape (`kind: 'tv'`, same `id`, new `season`/`episode`). The previous episode's progress is saved first (`over=1` when it came from Up Next or `ended`).

Timings (`configure`): `requestTimeout` 15000, `retryDelay` 700, `candidateTimeout` 15000, `stallTimeout` 15000, `osdHide` 4000, `progressEvery` 20000, `seekApply` 400, `seekReport` 1500, `upNextLead` 25, `upNextCount` 10, `chipMs` 6000, `startBudget` 60000 (the longest the loading screen waits for a first frame before the error card), `stillWatchingAfter` 3 (episodes autoplayed in a row without a key press before "Still watching?"; 0 turns it off), `repeatGap` 250 (same-direction seek presses closer than this count as a hold).

DOM (for tests and diagnostics): `#mbptv-player[data-state=loading|playing|error][data-kind]`, classes `is-osd`, `is-paused`, `is-seeking`, `is-buffering`, `is-upnext` (plus `is-still` while it asks "Still watching?"), `is-sheet`, `is-scrub`/`is-buttons` (which OSD row has focus). Buttons row `[data-action=play-pause|skip-intro|next-episode|quality|start-over]`, floating `.mbp-skip`, quality sheet `[data-sheet=player-quality]` with `[data-quality=AUTO|1080p|720p|360p|ORG]` and (movies with several files) `[data-file-index]`, Up Next `[data-upnext]` with `[data-action=play-next|hide-next]`, error card `[data-dialog=player-error]` with `[data-action=retry|website|back]` (retry for `network`, `bad-answer`, `internal` and `streams-failed`), resume/notice chip `.mbp-chip`. The focused control has `is-focused`.

`App` (in `60-app.js`) calls `NativePlayer.play` from its Play action and routes keys to `NativePlayer.key` while it is active, as the "Integration" section below describes (keep it accurate). `App.nativePlayer()` returns `NativePlayer` for diagnostics and tests. When `Kit` is loaded, the player's artwork goes through `Kit.imgUrl` (backdrop 1280 px, Up Next still 500 px, smaller in TV performance mode) and falls back once to the original URL.

## Behaviour

- **Loading screen:** show immediately over the shell. Black, the backdrop at 35% opacity, the title, the episode line ("S1 · E1 The Rise of Putin"), and a spinner. Back cancels at any time.
- **Source selection.** Movies use `req.fileIndex`, else `Prefs.quality` (`'best'` = the first listed file, `'1080p'`/`'720p'` = the closest match, `'ask'` = the first file; the detail screen's quality sheet handles "ask"). Episodes use the `tv_file` list, first entry.
- **Stream order.**
  - TV (`Platform.isTV` = UA matches `Tizen|SMART-TV|Web0S|NetCast`, or `window.tizen` exists): AUTO HLS (+aac), then ORG MP4, then 1080p/720p HLS.
  - Elsewhere: ORG MP4 if `canPlayType` accepts its codec (HEVC when `h265 == 1`), then AUTO HLS, then fixed HLS.
  - Each candidate gets 15 s to reach `playing`. Metadata alone is not enough: an HLS manifest can load while its segments hang or are refused. A `play()` rejection other than `NotAllowedError` (autoplay blocked: wait for OK) or `AbortError` (a new source or a pause) fails the candidate at once, and a `waiting` stall of 15 s counts before the first frame too. On an error or stall, try the next candidate at the same position.
  - When every candidate fails before playback started, show the error card "This video won't play here" with **Try again**, **Try website player** (focused; `hooks.onFallback(req, 'streams-failed')`) and **Back**.
  - When every candidate fails **mid-playback**, the signed stream links have usually expired: fetch the player data again once (again only after the new links played and 30 s passed) and continue at the same position with a "Reconnected" chip. If that fails too, the error card focuses **Try again**, which starts a fresh session that continues exactly where the video stopped. The position is saved first; `report()` keeps the last known duration across source swaps.
  - The loading screen never waits longer than `startBudget` (60 s) for a first frame: then the error card (Try again, Try website player, Back) says the video is taking too long.
- **Resume:** start at `seconds` if it is greater than 10 and less than `duration - 60`, and show a small toast-like chip "Resumed at 12:34 · press Down for Start over". Set `currentTime` after `loadedmetadata`.
- **Playback UI** (all inside our root, above everything, `#mbptv-player`):
  - Full-bleed video with `object-fit: contain` on black.
  - **OSD:** a bottom gradient with the show title (large), the episode line, a progress bar (played and buffered), elapsed time, remaining time, and a play/pause state icon. It appears on any key and auto-hides after 4 s while playing; while paused it stays visible.
  - **Buttons row** (Down from the progress area; Left/Right move between buttons; Up returns to the scrubber): **Play/Pause**, **Skip Intro** (only while `currentTime < skips.start`), **Next Episode** (TV, when a next episode exists), **Episodes** (optional, may be omitted), **Quality** (a sheet listing Auto, 1080p, 720p, 360p and Original with the width and HEVC/HDR info; choosing one switches stream at the current time), **Start over**.
  - **Keys:**
    - OK: play/pause (when no button is focused).
    - Left/Right: seek ∓10 s. Holding Left/Right (repeat) accelerates to 30 s and then 60 s steps, with a "+30 s" bubble. The seek is applied 400 ms after the last press, with a thumbnail-free time preview on the bar.
    - Up/Down: show the OSD and move between the scrubber and buttons.
    - Media keys play/pause/stop/FF/RW. Ch+/Ch− for next/previous episode.
    - Back: when a sheet is open, close it; otherwise stop, save progress and exit (`hooks.onClose`).
  - **Up Next** (Netflix style, TV only, when a next episode exists):
    - When `skips.end > 0` and `currentTime >= skips.end` (a plausible credits mark only: within the last fifth and the last 10 minutes), or 25 s before the end (or at the `ended` event), show a card at bottom right. It has the next episode's still and title (fetch the season page via `Api.detail('tv', id, {season})` or `Api.fetchDoc(Site.url.title('tv', id, season))`), "Next episode in 10", **Play now** (focused) and **Hide**.
    - The countdown runs to 0, then plays the next episode (`hooks.onNext(nextReq)`, then continue in the same player: stop progress for the current episode with `over=1` and load the next one). Back or Hide dismisses it and keeps watching the credits.
    - With `req.autoplayNext === false` the card has no countdown ("Up next"), and at the `ended` event it waits for the viewer (Play now or Hide/Back) instead of playing on.
    - **Still watching?** After `stillWatchingAfter` (3) episodes in a row started by autoplay with no key pressed, the card reads "Still watching?" without a countdown and the video pauses (the picture dims) until the viewer answers: **Play now** plays the next episode, **Hide**/Back resumes the credits. Any key resets the count, and so does a new `play()`.
    - At the `ended` event with no next episode, save `over=1` and exit to detail.
- **Progress:** report every 20 s while playing, and on pause, on seek (debounced), on stream switch (chosen or automatic), on stop/exit, on an error card, on `ended` and on `pagehide`/`visibilitychange` hidden. Send `hooks.onProgress({kind, id, season, episode, seconds, duration})` so the app can update Continue Watching.
- **Screen saver:** while playing, try `webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF)` and restore it on pause/exit, each in try/catch. If that is unavailable, try `tizen.power.request('SCREEN', 'SCREEN_NORMAL')` and `tizen.power.release('SCREEN')`.
- **Background:** when the app is hidden (Home button, input switch), save progress, pause, and let the screen saver run again. A stream that starts while hidden is paused at once, and the Up Next countdown does not run. Coming back shows the paused controls; OK carries on.
- **Pointer:** `#mbptv-player` takes pointer input (`pointer-events: auto`; the shell root is pointer-transparent outside shell mode) and swallows clicks, so a pointer never reaches the website underneath.
- **Errors:** `code < 0` JSON from the player endpoint shows its `msg` on the error card (for example VIP-only), with **Try website player** and **Back**. A signed-out gate response routes to the sign-in flow via `hooks.onFallback(req, 'signed-out')`.
- **Reliability:**
  - Every handler goes through `U.guard`.
  - Every request has a timeout and one retry.
  - A generation counter drops stale callbacks after stop/next.
  - `stop()` is idempotent.
  - Remove `src` and call `load()` to release the decoder.
  - No site JS globals.
  - No `innerHTML` with site data.
  - Never log stream URLs (log labels and codes only).
- **Performance:** a single `<video>`. The OSD updates at most 4×/s (`timeupdate` throttled). Transitions animate only opacity or transform. No box-shadows on large layers.
- **Implementation details worth knowing** (0.3.1):
  - Down while the resume chip is up focuses **Start over** (OK then restarts); otherwise Down opens the buttons row on Play/Pause.
  - While the controls are hidden and `currentTime < skips.start`, a focused **Skip Intro** pill floats bottom right: OK skips instead of pausing. With the controls up, Skip Intro is a button in the row. Only a plausible intro mark is used (within the first third of the video, at most 10 minutes), so bad site data cannot take OK over for a long stretch.
  - Seek: taps are 10 s; a hold (`event.repeat`, or same-direction presses less than `repeatGap` 250 ms apart, for remotes that send held keys without the flag) steps 10 s for the first 4 repeats, then 30 s, then 60 s after 14. The bubble shows the jump (`+10 s`, `+4:20`) above the target time; the title block dims while seeking.
  - The Up Next countdown pauses while the video is paused. **Hide**/Back dismisses it until the viewer rewinds more than 30 s before the credits point. At `ended` the card comes back (counting down again); Hide or Back there closes the player (`onClose` reason `'ended'`, `over=1`). `req.autoplayNext === false` (and "Still watching?") show the card without a countdown, and it then waits at `ended` too.
  - Next Episode (button) and Ch+ mid-episode save the real position with the site's `over` rule; from Up Next or `ended` the episode is saved with `over=1`. Ch− goes to `episode − 1` in the same season (a chip says so at E1).
  - A mid-playback stream error or a 15 s stall saves progress and switches to the next candidate at the current position with a "switched to a backup stream" chip. When every candidate fails, fresh links are fetched once (see Stream order), then the error card appears.
  - Choosing a quality tries the chosen stream first, then the others with those that already failed in this session last. Switching files continues from the position when the new file's data arrives (the old file keeps playing meanwhile).
  - The quality sheet also lists the movie's files (Source file) when the title page has several; choosing one fetches that file's player data and continues at the same time.
  - The OSD shows a quality badge next to the episode line (Auto, 1080p, 4K, HDR), "Paused" above the title while paused (the picture dims slightly), and remaining time as `−9:24`.
  - The loading screen's kicker reads "Now playing", or "Next episode"/"Previous episode" after an in-player episode change.

## Testing (`test/player.test.cjs`, mock routes in `tools/mock-extra.cjs`)

- `tools/mock-extra.cjs` exports `handle(u, query, cookies, req, res, send, helpers)` and returns true when it handled the route. It provides:
  - `/index/index/tv_file`, which returns the `tv_file.json` shape for any episode, with `tfid = tid*10000 + season*100 + episode` (seasons and episodes up to 99). The next episode is E+1 up to `mbp_eps` (default 10), then E1 of the next season up to `mbp_seasons` (default 3).
  - `/index/index/player?mfid|tfid`, which returns the fixture text with stream URLs rewritten to local media. It includes a failing "HLS" URL (`/__media/bad.m3u8` returns 404) so fallback is exercised, and an ORG MP4-like source `/__media/ep.wav?len=60`, a generated silent WAV that `<video>` can play and seek. Make `var seconds` configurable via a cookie.
  - `/index/index/(tv|movie)_progress`, which records each POST body in memory and returns `{"code":1}`.
  - `/__mock/progress-log`, which returns the recorded posts as JSON; `?reset=1` clears them.
  - A special id (for example `mfid=999`) that returns `{"code":-1,"msg":"VIP only"}`.
- Tests build a bundle of `src/00-core.js`, `10-site.js`, `20-api.js` and `55-player.js` (+ `CSS_TEXT` from `player.css`) with a stub root, as `test/site.test.cjs` does, then drive `NativePlayer` with key events. Cover:
  - movie play with stream fallback (HLS fails, then ORG succeeds);
  - resume at `seconds`;
  - OSD show/hide;
  - OK pause/play;
  - seek ±10 and hold acceleration;
  - progress posts (payload fields and endpoint);
  - quality switch keeps the position;
  - Skip Intro visibility with skips;
  - Up Next appears near the end, counts down and loads the next episode (a new `tv_file` + player request, S1E2);
  - Hide dismisses it;
  - Back exits with an `onClose` info and a final progress post (`over` correct);
  - error card for `code -1`, and "Try website player" calls `onFallback`;
  - `stop()` is idempotent;
  - no stream URL appears in `Log.entries()`;
  - no page errors.
- As implemented, the mock also serves `/__media/bad-<q>.m3u8|mp4` (404), `/__media/hang.m3u8` (never answers), `/__mock/player-log` (tv_file, player and media requests; `?reset=1`), `/__mock/expire-links` (every stream link issued so far answers 403, like expired signed tokens; links in later player-data answers work) and `/__player/blank` (an empty page with a `#mbptv` root). Per-test cookies: `mbp_seconds`, `mbp_len`, `mbp_skips=START,END`, `mbp_next=0`, `mbp_auto=bad|ok|hang`, `mbp_org=ok|bad|hang`, `mbp_all=bad`, `mbp_delay=MS`, `mbp_tvfile=fail`, `mbp_mid`, `mbp_eps`, `mbp_seasons`, and the existing `mockgate=1`. `test/player.test.cjs` also covers the parser and stream order as pure functions, the desktop order, no resume near the ends, periodic and seek progress, the candidate timeout, every stream failing, signed-out routing, Ch+/Ch−, Up Next Back, and the screen saver calls. Since the review fixes, also: a stream that loads its metadata but never plays, the loading budget, held OK/Back and seek acceleration without the repeat flag, autoplay off waiting at the end, "Still watching?", stream links expiring mid-film (refetch and continue; and the error card with Try again continuing there), the app going to the background, implausible intro/credits marks, `play()` replacing an active session, Next Episode across seasons, and pointer input.

## Integration (for the integrator; keep this section accurate)

The build already appends `src/player.css` to `CSS_TEXT` after `shell.css` (`tools/build.cjs` takes every `src/*.css`), and `55-player.js` sorts between the overlays and `60-app.js`, so `NativePlayer` exists before `App` runs. Steps 1–7 are in `src/60-app.js`; steps 8–10 touch `src/20-api.js`, `src/40-ui-screens.js` and `src/10-site.js`; step 11 is tests and docs.

**Status (0.3.1):** every step is wired. The code differs from the sketches below in these ways, and the code is what counts:
- `playNative` finds the title's model on the screen on top, on the boot page itself (`page.detail`, parsed in `route()`), in memory (`Api.cached`), or in `t.model`. A show-level Play with no episode, no Continue Watching label and no model reads the title page first (`resolveThenPlay`, behind the "Starting playback" overlay; Back cancels; after 6 s it plays with what it has).
- `resolveEpisode` also uses the page's `nextEpisode` (Site.detail: its resume label, else the first unwatched episode) right after the Continue Watching label. An episode card passes `exact: true`, so a special (episode 0) plays as itself (`NativePlayer` accepts episode 0 only when asked for exactly), and `episodeTitle`.
- The hooks collect every progress post's `over` per episode (`onProgress`). On close, the detail screen gets `params.lastPlayed` (where it stopped, `over`, `resume`, and the finished episodes) and `afterPlayback()` shows it at once: the Play label ("Resume S2E2", or the episode after a finished one), watched checks, the progress bar and the season line. The Continue Watching card's position is cleared.
- `refreshDetail` waits 1.5 s (the player's last progress post leaves as it closes), re-reads the title page and patches the screen in place with `refreshModel(m)`. Only a screen that cannot patch is rebuilt, and then only when a progress signature (the Play label, the season and every watched/progress field `Site.detail` gives, found by name) changed and the viewer has not moved.
- After anything played, Home re-fetches Continue Watching 1.5 s later (`afterWatching`).
- The watchdog returns after re-applying the `<html>` classes. While the player is up, the monitor pauses every website video outside `#mbptv`.
- `?play=1` pages use the built-in player (step 7).
- Steps 9 and 10 are in `40-ui-screens.js` and `10-site.js`. The settings rows take their labels and help text from `Prefs.describe(name)`, and TV performance mode is a third row. `Site.live.closePlayer` also leaves videos inside `#mbptv` alone.

1. **Split the play path.** Rename the current body of `play(t)` to `playWebsite(t)` (unchanged: live click, or `?play=1` navigation with the "Starting playback" overlay). The new `play(t)` is:

   ```js
   function play(t) {
     if (!t || !t.id) return;
     if (playNative(t)) return;
     playWebsite(t);
   }
   ```

2. **`playNative(t)`** returns false only when the built-in player is switched off or missing, or `NativePlayer.play` refused (no usable id). Then the website path runs. A show-level **Play**/**Resume** never falls back to the website player (that is the path that fails on the user's TV). The detail screen's Play passes no episode, and the Home hero passes only the card's `item`, so an episode is resolved first:

   ```js
   /* The episode a show-level Play/Resume starts: the explicit one; else a resume label (the Continue Watching
      card's "S37E21", or an "S2E3"-style label on the title page's Play button); else the first episode of the
      season the title page shows (the site opens a show on the season being watched); else S1E1. */
   function resolveEpisode(t, model) {
     if (+t.season > 0 && +t.episode > 0) return { season: +t.season, episode: +t.episode };
     var labels = [t.item && t.item.progressLabel, model && model.playLabel];
     for (var i = 0; i < labels.length; i++) {
       var m = /S(\d+)\s*E(\d+)/i.exec(String(labels[i] || ''));
       if (m && +m[1] > 0 && +m[2] > 0) return { season: +m[1], episode: +m[2] };
     }
     var season = model ? +model.season || 0 : 0, first = null;
     U.each(model && model.episodes || [], function (e) {
       if ((!season || +e.season === season) && (!first || +e.episode < +first.episode)) first = e;
     });
     if (first) return { season: +first.season, episode: +first.episode };
     return { season: season || 1, episode: 1 };
   }

   function playNative(t) {
     if (typeof NativePlayer === 'undefined' || Prefs.get('nativePlayer') === false) return false;
     var kind = t.kind === 'tv' ? 'tv' : 'movie';
     var inst = topInst(), model = inst && inst.model ? inst.model() : null, meta = Api.meta(kind + ':' + t.id) || {};
     if (model && (String(model.id) !== String(t.id) || model.kind !== kind)) model = null;
     if (kind === 'movie' && !t.pick && Prefs.get('quality') === 'ask' && model && (model.sources || []).length > 1) {
       /* As the detail screen's Quality button does: the sheet's onPick plays the chosen file. */
       Overlays.quality({ title: model.title, sources: model.sources, onPick: function (src) {
         play({ kind: kind, id: t.id, title: t.title, item: t.item, backdrop: t.backdrop, pick: src });
       } });
       return true;
     }
     var ep = kind === 'tv' ? resolveEpisode(t, model) : null;
     var epInfo = ep && model ? U.find(model.episodes || [], function (e) { return +e.season === ep.season && +e.episode === ep.episode; }) : null;
     /* Never t.title for the name: the detail screen appends "  ·  S2E1" to it. */
     var name = (model && model.title) || (t.item && t.item.title) || meta.title || U.text(String(t.title || '').replace(/\s+\u00b7\s+S\d+\s*E\d+\s*$/i, ''));
     var req = {
       kind: kind, id: String(t.id), season: ep ? ep.season : 0, episode: ep ? ep.episode : 0,
       title: name, showTitle: name, episodeTitle: epInfo ? epInfo.title : '',
       backdrop: t.backdrop || (model && model.backdrop) || meta.backdrop || (t.item && t.item.backdrop) || '',
       poster: (model && model.poster) || meta.poster || (t.item && t.item.poster) || '',
       fileIndex: t.pick && typeof t.pick.index === 'number' ? t.pick.index : undefined,
       autoplayNext: Prefs.get('autoplayEpisodes') !== false
     };
     rememberFocus();
     return NativePlayer.play(req, nativeHooks(t));
   }
   ```

   Do **not** call `playAction(t)` on this path: `lastPlayAt` makes `playCtx().recent` true for 15 s, which lets website-player detection count any large video (step 10 closes that hole as well).

3. **Hooks.** Use a fresh object per call, so `mount` is the live root. After the viewer closes the player, the detail screen shows where they are. It keeps its screen instance (no re-render and no focus jump) unless the title page changed in a way the screen shows. Only the Play/Resume label and the season shown can change, because episode cards carry no progress:

   ```js
   function nativeHooks(t) {
     return {
       mount: root,
       onOpen: function () {
         pending = null; cancelledAt = 0;
         Overlays.hideStarting(); closeAllLayers();
         setMode('player'); setScreenAttr('player');
         U.toggleClass(root, 'rail-open', false);
         Focus.blur();
       },
       onClose: function (info) {
         setMode('shell');
         var entry = top(), same = sameDetail(entry, info);
         if (same) prepareDetail(entry, info);
         if (!stack.length) defaultRoute(); else showEntry(top());
         if (same) refreshDetail(entry, info);
       },
       onFallback: function (req, reason) {
         Log.info('play', 'native player fallback: ' + reason);
         if (reason === 'signed-out') { signedOut(); return; }
         playWebsite({ kind: req.kind, id: req.id, season: req.kind === 'tv' ? req.season : 0, episode: req.kind === 'tv' ? req.episode : 0,
           title: req.showTitle || t.title, item: t.item, backdrop: req.backdrop });
       },
       onProgress: function () { /* nothing required: the site stores it; the detail refresh on close shows it */ },
       onNext: function (next) {
         var entry = top();
         if (entry && entry.screen === 'detail' && next) entry.focusKey = 'ep|' + next.season + 'x' + next.episode;   /* episode card key (40-ui-screens) */
       }
     };
   }

   function sameDetail(entry, info) {
     return !!(entry && entry.screen === 'detail' && info && info.id && String(entry.params.id) === String(info.id) &&
       (entry.params.kind === 'tv' ? 'tv' : 'movie') === info.kind);
   }

   /* Before the screen shows again: rebuilds must read the refreshed Api cache (never the boot page's markup), and
      a show whose Up Next crossed into another season shows that season (the player usually cached its page). */
   function prepareDetail(entry, info) {
     entry.live = false;
     if (info.kind !== 'tv' || !(info.season > 0)) return;
     var shown = entry.inst && entry.inst.model ? entry.inst.model() : null;
     var shownSeason = (shown && +shown.season) || +(entry.params.season || 0);
     entry.params.season = info.season;            /* the screen and refreshDetail now use the same Api cache key */
     if (shownSeason !== info.season) destroyInst(entry);
   }

   /* Re-read the title page (Api.detail with force replaces the cached model), then rebuild only when the viewer has
      not moved yet and the Play/Resume label or the season differs; entry.focusKey (rememberFocus / onNext) puts
      focus back on the played episode. */
   function refreshDetail(entry, info) {
     var season = info.kind === 'tv' ? +(entry.params.season || 0) : 0;
     Api.detail(info.kind, info.id, U.guard(function (err, m) {
       if (err || !m || mode !== 'shell' || top() !== entry || topLayer() || !entry.inst || entry.touched) return;
       var shown = entry.inst.model ? entry.inst.model() : null;
       if (!shown) return;   /* still loading: its own request reads the fresh page */
       if (U.text(shown.playLabel) === U.text(m.playLabel) && +shown.season === +m.season) return;
       rememberFocus();
       destroyInst(entry);
       showEntry(entry);
     }, 'native-refresh'), { force: true, season: season });
   }
   ```

   `onClose` always runs before `onFallback`, so `playWebsite` starts from shell mode with the detail screen on top. `onClose` fires once per overlay. A `play()` while the player is up (it never happens from the App, because the player owns the remote) replaces the session without `onOpen`/`onClose`.

4. **Keys.** First line of `dispatch(name, ev)`:
   `if (typeof NativePlayer !== 'undefined' && NativePlayer.active()) return NativePlayer.key(name, ev);`
   It returns true for every key while active, so `onKeyDown` prevents the default and the website never sees the remote. Keep `isHeldRepeat` in `onKeyDown` **before** `dispatch`, as it is today. It swallows a held OK or Back in every mode, including Back repeats that arrive after the first press closed the player (they would otherwise pop the detail screen and open the Exit dialog). The player also ignores auto-repeat of OK, Back, media keys, Ch+/− and Info itself.

5. **Watchdog and monitor.** In `watchdog()`, right after `guardFrames()` and `setModeClass()` (so the scroll lock stays applied), add `if (NativePlayer.active()) return;`. This means no focus repair, no `Site.live.playerOpen()` checks, and `afterPlayer(false)` never runs for the native player. The first line of `monitor()` is `if (typeof NativePlayer !== 'undefined' && NativePlayer.active()) return;`. `pendingTick` is harmless because `onOpen` clears `pending`.

6. **Leaving the player from app code.** In `leaveToShell()`, `enterWebsite()`, `enterPopup()`, `panic()` and `onPageShow()` (bfcache restore), first call `if (NativePlayer.active()) NativePlayer.stop('app');`. An example is `Api.onSignedOut` → `signedOut()` → `leaveToShell()` while a video plays. `stop` calls `onClose`, which sets shell mode, and the caller then continues as today (`leaveToShell` must not reach `Player.stop()` for it).

7. **`?play=1` pages** (legacy links, bookmarks, pages opened elsewhere) play in the built-in player: `route()` builds the page's stack (`defaultRoute`), passes `liveTitle()` to `playNative({kind, id, season, episode})` and, when it opened, calls `settleUrl()`. A show without an episode resolves through `resolveEpisode` (the boot page's own model gives the Play label and season). The website's own auto-play on that page still runs (it read `play=1` at load), so `siteHold` keeps it quiet: its file list, player and messages close without showing and its videos stay paused, until the viewer's next website play action. A `?play=1` page opened by the website path (`playWebsite`, including **Try website player**) carries sessionStorage `mbptv:webplay:v1` (`{url, t}`, 60 s) and keeps the website's player, so a failing title never loops between the two.

8. **Prefs (`20-api.js`).** Add `nativePlayer: true` and `autoplayEpisodes: true` to `DEFAULTS`, and **remove** `autoplayNext` (done: it is also ignored when read and dropped on the next write, and `Prefs.describe`/`choices`/`next` describe every preference for Settings). Do not reuse `autoplayNext`: nothing reads it today, but `Prefs.set` stores the whole preference object, so every TV where the viewer changed any setting already has `autoplayNext: false` saved. Flipping its default would leave autoplay off exactly there. Update the defaults assertions in `test/api.test.cjs` (3 places) and `docs/ARCHITECTURE.md` §5.3.

9. **Settings rows (`40-ui-screens.js`).** Add two toggles after "Preferred quality":

   ```js
   { key: 'nativePlayer', icon: 'play', label: 'Built-in player', toggle: true, desc: 'Plays movies and episodes in the TV app\u2019s own player (recommended). Turn it off to use the website\u2019s player instead.' },
   { key: 'autoplayEpisodes', icon: 'tv', label: 'Autoplay next episode', toggle: true, desc: 'Plays the next episode automatically when one ends, like Netflix. After three in a row without a button press it asks whether you are still watching.' },
   ```

   The toggle code falls back to `pref(def.key, def.key === 'nativeRemote')` in three places. Make that fallback true for the new keys too, for example `var TOGGLE_ON = { nativeRemote: true, nativePlayer: true, autoplayEpisodes: true };` with `pref(def.key, TOGGLE_ON[def.key] === true)`. Add `setting-nativePlayer` and `setting-autoplayEpisodes` to ARCHITECTURE.md §10. Optionally show `NativePlayer.info()` on the Diagnostics screen (it has no URLs).

10. **Website-player detection (`10-site.js`).** `allVideos()` must skip videos inside our root, so that `Site.live.playerOpen()` and `Site.live.video()` never count the built-in player's full-screen `<video>` as the website player. Steps 4–5 guard the App's own checks while the player is up; this guards every other caller and the moments around open and close:

    ```js
    function allVideos() {
      var shell = document.getElementById('mbptv');
      var mine = function (v) { return !!shell && shell.contains(v); };
      var out = U.map(U.filter(visibleOnly(qsa(document, 'video')), function (v) { return !mine(v); }), function (v) { return { v: v, area: videoArea(v) }; });
      return out.concat(frameVideos());
    }
    ```

    Add a `test/site.test.cjs` case: a large visible video inside `#mbptv` is neither `playerOpen({recent: true})` nor `video()`.

11. **Tests and docs.** `test/player.test.cjs` needs no App. After wiring, extend `test/app.test.cjs` with these cases:
    - Play on a movie detail opens `#mbptv-player` (not `?play=1`), and Back returns to the detail screen with focus on Play.
    - An episode card plays that episode.
    - Play on a show's detail screen (no episode) opens the player on the resolved episode (the fixture show 556 has no resume label, so the first episode of the season shown: S2E1).
    - Holding Back in the player closes it once and leaves the detail screen on top.
    - After Up Next moved to another episode, closing the player focuses that episode's card.
    - `Prefs.set('nativePlayer', false)` restores the old path.

    The mock routes in `tools/mock-extra.cjs` already serve the player endpoints for any page. In `docs/ARCHITECTURE.md`, update:
    - §1 goal 4, which should now read as playing through the website's own endpoints (see "Why" above);
    - §4, with `55-player.js` (`NativePlayer`) and `player.css`;
    - §6.2 "Player mode" and Settings;
    - §10.
