# MovieBox Pro TV for TizenBrew

A remote-friendly TV interface for the MovieBox Pro website on Samsung Tizen TVs. It turns the website you already subscribe to into a 10-foot app: poster rows, a full-screen hero, detail pages with seasons and episodes, search with live suggestions, and its own full-screen player with resume, Skip Intro and Netflix-style Up Next.

**This is a TizenBrew module, not an APK.** TizenBrew opens the MovieBox Pro website in its own TV app window and loads this module's script (`tv.js`) into it. Nothing is installed on the TV outside TizenBrew, and there is no separate icon on the Samsung Home screen. You need your own MovieBox Pro account.

## Contents

- [What's new in 0.3.1](#whats-new-in-031)
- [Features](#features)
- [Install and update](#install-and-update)
- [Sign in](#sign-in)
- [Remote controls](#remote-controls)
- [Settings](#settings)
- [Troubleshooting](#troubleshooting)
- [Privacy](#privacy)
- [Status and verification](#status-and-verification)
- [Development](#development)
- [References](#references)

## What's new in 0.3.1

Version 0.3.1 answers the feedback from testing 0.3.0 on a Samsung TV.

- **Movies and episodes play on the TV.** In 0.3.0, Play could end with "The website didn't start playback", because the TV's browser could not run the website's own player page. 0.3.1 has a **built-in player**. It asks the website for the same files and streams the website's player uses and plays them in its own full-screen player, without loading the website's player page.
  - **Resume:** it continues where you stopped, with a **Start over** option.
  - **Progress sync:** your position is saved to your MovieBox Pro account as you watch, so Continue Watching, the website and other devices stay in step.
  - **Skip Intro** appears while an intro plays, when the website knows where the intro ends.
  - **Up Next:** near the end of an episode a card counts down to the next one, like Netflix. It carries on into the next season, and after three episodes in a row without a button press it asks whether you are still watching.
  - **Quality menu:** Auto, 1080p, 720p, 360p or Original, and a movie's other files. Your position is kept when you switch.
  - The player tries another stream on its own when one fails. If none plays, **Try website player** hands the title to the website's player.
- **TV performance mode.** It is on by default on TVs and makes scrolling smoother on TV hardware: no blurred shadows or long fades, smaller pictures, and fewer pictures loading at once. Change it under **Settings > TV performance mode** (Auto, On or Off).
- **Better episodes.**
  - A season shows every episode the website lists, including specials such as S01E00. Episodes without a picture appear as text cards.
  - Watched episodes get a check. The season line shows how many you have watched, and the episode you are in the middle of shows its progress.
  - Resting on a season for a moment opens it.
  - The Play button names the episode it will start, such as **Resume S2E4** or **Play S3E1**.
  - After you watch, the page shows your progress at once and Back takes you to the episode you watched last.
- **Settings.** New rows: **Built-in player**, **Autoplay next episode** and **TV performance mode**.
- **Navigation.** Smaller fixes throughout.

## Features

- **Premium TV interface.** A dark, full-screen layout sized for a 3 m viewing distance. The focused title's artwork fills the top of Home, poster rows sit below, and a slim menu rail on the left expands when you move onto it (Search, Home, Movies, TV Shows, My Library, Settings). Focus is always obvious: the focused card grows and gets a white ring.
- **Search that works with a remote.** An on-screen keyboard (A–Z, 0–9, Space, Delete, Clear), live suggestions as you type, recent and trending searches, results in a poster grid with **All / Movies / TV Shows** tabs, and more results as you scroll down. The number keys on the remote and a USB or Bluetooth keyboard type too.
- **Detail pages.** Backdrop, year, runtime, rating, genres, IMDb, Tomatometer and audience scores, the overview, and quality badges. Shows get a season picker and an episode row with stills, titles, runtimes and descriptions. Movies get **More like this** and the cast.
- **Quality picker with a preferred quality.** Choose Best, 1080p, 720p or Ask every time. When your preferred quality is available, playback starts with it automatically, and a message confirms what is playing (for example "Playing 1080p · 6.71 GB"). Otherwise a list of the available files opens.
- **Built-in player.** Movies and episodes play full screen in the module's own player. It uses the same files and streams as the website's player, and saves your progress to your account as you watch.
  - It resumes where you stopped.
  - The OSD shows the title, the episode, a progress bar with the remaining time, and a row of buttons: Play/Pause, Skip Intro, Next Episode, Quality and Start over.
  - Near the end of an episode, the **Up Next** card counts down to the next one. Turn this off under **Settings > Autoplay next episode**, and the card then waits for you.
  - Turning off **Settings > Built-in player** uses the website's own player instead, with the TV interface's OSD over it. With the website's player, **Blue** opens its own controls (captions, audio and its menus).
- **Continue watching.** The website's "Waiting to Watch" row appears on Home with progress bars and the episode or time where you stopped, and titles you have started offer **Resume**. It updates after you watch something.
- **TV performance mode.** On by default on TVs: lighter effects and smaller pictures, for smooth scrolling.
- **Reliability.**
  - The module starts only on MovieBox pages and only once, even when TizenBrew injects the script several times. It never runs inside frames or on other sites such as Google sign-in.
  - If the TV interface fails to start, it removes itself completely and leaves the website usable.
  - Every network request has a time limit and one automatic retry. A page that cannot load shows **Retry**, **Open website** and **Home** instead of a blank screen.
  - An expired login takes you to the sign-in screen.
  - A watchdog puts focus back on screen if it is ever lost, and the remote keeps working even when a website frame (an ad, or the website's player page) takes focus.
  - Playback never loops or traps you: Back while playback is starting cancels it (even while the play page is still loading), and going back to a title page never restarts playback. If the website's player cannot be closed, Back still returns you to the TV interface and it does not come back unless it really plays again. A website message that keeps reappearing can always be left with **Blue**. If the website changes its list of files, the website's own list appears with the focus ring instead.
  - Holding OK or Back acts once, so a long press never starts playback by accident or skips several screens.
  - After a long film, Back still returns to the screen you started from.
  - If the website changes its layout, the module falls back to generic title detection, and the Diagnostics screen reports what changed.
  - The code is written for the oldest Tizen browsers (Chromium 47, 2017 TVs) and avoids newer JavaScript and CSS features.

## Install and update

1. Install [TizenBrew](https://github.com/reisxd/TizenBrew) on the TV if you have not already.
2. Open **TizenBrew > Module Manager > Add GitHub Module**.
3. Enter exactly:

   ```
   AHcoder23/moviebox-pro-tv@v0.3.1
   ```

   Include the **23** and the **@v0.3.1**. Do not add `gh/` or a full URL.
4. **Fully close TizenBrew and open it again**, then launch **MovieBox Pro TV**. TizenBrew only loads a new or changed module when it restarts.
5. Check the version under **Settings > About**. It should show **0.3.1**.

**Updating from 0.3.0:** add `AHcoder23/moviebox-pro-tv@v0.3.1` as above, restart TizenBrew, check that **Settings > About** shows 0.3.1, then remove the old `@v0.3.0` entry.

**Why the `@v0.3.1` tag matters.** TizenBrew downloads `tv.js` through the jsDelivr CDN (`cdn.jsdelivr.net/gh/AHcoder23/moviebox-pro-tv@<version>/tv.js`). A version tag always serves the same files, so the module keeps behaving the same way until you choose to update. A branch such as `@main` can change at any time, and the CDN may serve an older cached copy of it for a while.

**To update**, add the new tag the same way (for example `AHcoder23/moviebox-pro-tv@v0.3.2` when it is released), restart TizenBrew, and remove the old entry once the new one works. **To roll back**, add the previous tag again. TizenBrew keeps the downloaded script in memory until it restarts, so always restart TizenBrew after changing the module. After it works, you can select the module in **TizenBrew Settings > Autolaunch**.

## Sign in

When the website asks you to log in, the module shows **Sign in to MovieBox Pro** with three choices:

- **Sign in with QR code.** The website shows a QR code to scan with your phone.
- **Sign in with a code.** Follow the website's code instructions.
- **Sign in with Google.**

Each choice opens the website's own login page in website view. Login happens on the website, and the module never sees or stores your password. After the website signs you in and returns to its home page, the TV interface opens again on Home. If it does not, press **Blue** or **Info**, or select the **Back to TV app** button in the bottom-left corner.

TizenBrew and the TV's regular web browser keep separate logins, so sign in inside TizenBrew even if the TV browser is already signed in.

## Remote controls

| Button | Browsing | Player | Website view |
| --- | --- | --- | --- |
| Arrows | Move focus. Left from the first item opens the menu rail. | Left and Right skip 10 s (hold to skip faster). Up shows the OSD; Down moves to its buttons (Play/Pause, Skip Intro, Next Episode, Quality, Start over), and Left and Right move between them. | Move a white focus ring between the website's controls. |
| OK | Open or select. On the keyboard, type the letter. | Play or pause, or press the focused button. On the Up Next card, **Play now**. | Click the focused control. |
| Back | Go back one screen, or close a list or dialog. In Search, from the results back to the keyboard. On Home, from a lower row back to the first row, then **Exit MovieBox Pro TV?** with **Stay** selected. | Close a menu or the Up Next card, otherwise close the player and return to the title (on a show, to the episode you watched last). | Go back one page in the website's history. On the page where you opened website view, return to the TV interface. |
| 0–9 | Type into Search. | | |
| Play, Pause, Play/Pause, Stop, Rewind, Fast-forward | On a title, Play starts it. | Control playback. | |
| Channel Up / Down | | Next or previous episode. | |
| Blue | | With the website's player (Built-in player off): open its own controls (captions, audio). Back or Blue returns. | Return to the TV interface. The **Back to TV app** button in the bottom-left corner does the same. |
| Info | | Show the OSD. | Return to the TV interface. |

A USB or Bluetooth keyboard also types into Search, and Backspace deletes. Pop-ups that the website shows during playback get a focused close button, and Back dismisses them.

## Settings

- **Preferred quality:** Best, 1080p, 720p or Ask every time. It is used when you press Play. The **Quality** button on a movie's page always opens the full list.
- **Built-in player** (on by default, recommended): plays movies and episodes in the module's own player. Turn it off to use the website's own player instead.
- **Autoplay next episode** (on by default): the Up Next card counts down and plays the next episode. When it is off, the card waits for you to choose **Play now**.
- **TV performance mode:** Auto (the default: on for TVs), On or Off. It trades shadows, fades and picture size for smoother scrolling. **Auto** shows what it chose, for example **Auto · On**.
- **Website remote controls:** turns the focus ring and OK clicks on or off in website view. Turn it off if a website page handles the remote itself and the two conflict.
- **Reduce motion:** turns off zoom and slide animations.
- **Clear search history:** forgets the searches this TV remembers. Signing out forgets them too. Searches saved to your MovieBox Pro account are managed on the website.
- **Diagnostics:** shows technical details for problem reports (see below).
- **Open website view:** shows the plain website with remote navigation, for pages the TV interface does not cover, such as account settings or playlists. Website view stays on while you follow links on the website, until you press **Blue** or **Info** or select the **Back to TV app** button, which brings back the screen you left.
- **Reload:** reloads the page and the TV interface.
- **About:** the module version.

## Troubleshooting

- **A page will not load.** Choose **Retry**. If it keeps failing, choose **Open website** to check whether the website itself is working, or **Home**.
- **Playback does not start.** The built-in player tries every stream the website offers. If none plays, it shows **Try again**, **Try website player** and **Back**. A message from the website, such as a VIP-only title, appears on the same card. **Try website player** opens the title in the website's own player. If you use the website's player (Built-in player off) and it has not started after about 10 seconds, the module returns to the title and shows "The website didn't start playback. Try Play again." In either case, **Quality** can pick another file, and setting **Preferred quality** to **Ask every time** lets you choose the file every time. If the website changes its list of files so that the module cannot read it, the website's own list appears instead, with the white focus ring. Choose a file with OK, or press Back to close it.
- **Playback stutters, or the TV reports an unsupported format.** In the player, press Down, choose **Quality** and pick **Auto**, **1080p** or **720p**. **Original** can be a 4K HEVC or HDR file that some TVs cannot decode smoothly.
- **Scrolling feels slow.** Check that **Settings > TV performance mode** shows **On** (or **Auto · On**).
- **Something looks wrong or stops responding to the remote.** Press **Back**. In website view, or on a website message that will not close, press **Blue** or **Info** to return to the TV interface. **Settings > Reload** restarts the interface.
- **Captions or audio language.** The built-in player plays the file's default audio track and has no caption menu yet. For captions or another audio language, turn off **Settings > Built-in player** and, during playback, press **Blue** to reach the website player's own controls. Press Back to return to the TV player.
- **Diagnostics.** **Settings > Diagnostics** shows the module version, the TV's browser version (user agent), the page type, the last website self-test and the last 30 log lines. Include a photo of this screen when you report a problem. Search words and similar details are masked in the log and on this screen.
- **The website's own controls conflict with the remote.** Turn off **Settings > Website remote controls**.
- **The TV interface does not appear, or an update did not take effect.** In TizenBrew's Module Manager, check that the module entry names an exact tag such as `AHcoder23/moviebox-pro-tv@v0.3.1`. Remove the entry, add it again with the tag, and fully restart TizenBrew. If a newer version misbehaves, re-pin the previous tag.
- **The website changed.** The module keeps working with generic title detection, but some details may be missing. The Diagnostics self-test lists what it could not find. Report it so the adapter can be updated.

## Privacy

- The module has **no analytics, tracking or advertising**, and it sends nothing to the module's authors.
- It only talks to the MovieBox Pro website you opened, on that same website, using your existing website session. It loads the website's pages, search suggestions and trending searches. When you press Play, it asks for the same player data the website's player asks for, and it saves your watching progress the same way the website does. Posters and backdrops load from the image servers the website already uses, and video from the stream servers the website's player uses. Stream addresses are never written to the log.
- **jsDelivr** (`cdn.jsdelivr.net`) serves the `tv.js` file to TizenBrew. Like any download, that request is visible to the CDN.
- Typing in Search only fetches suggestions. Running a search (the **Search** key, a suggestion, or a recent or trending chip) performs a normal website search, which MovieBox Pro adds to your search history as the website does. Opening a title's page does not add it to your watch history, but playing does, as on the website.
- The module stores only these items in TizenBrew's local storage on the TV: your settings, a cache of title details for faster artwork (up to 300 titles, kept for 14 days), your last 12 searches, and a short diagnostic log (up to 60 lines). It does not read or store passwords, and it does not handle payment details.
- **Settings > Clear search history** removes the remembered searches at any time, and signing out of the website removes them (and the screen the TV would return to) automatically, so the next person to sign in on a shared TV does not see them.
- The diagnostic log masks what you type and other page details: search words, URL fragments and any address parameter that does not just name a title or a page are replaced with "…" before anything is stored or shown.
- The module starts only on MovieBox Pro's own domain, or on a page that carries the website's own signature. It never starts on a page with a password field or on other sites' sign-in pages, and it only ever navigates within the MovieBox Pro website you opened.

## Status and verification

Version 0.3.0 was a rewrite. Its interface was tried on a Samsung TV, where the website's own player failed to start. Version 0.3.1 adds the built-in player, which uses the website's own endpoints. Those endpoints were checked on the live website, and the player was verified in desktop Chromium, where the original MP4 streams play.

Both versions were verified with an automated test suite in desktop Chromium (Microsoft Edge), emulating a Tizen TV's user agent and remote key codes at 1920×1080 and 1280×720. The tests also run with the browser features that 2017 TVs lack removed, with storage that fails, and with a slow website. They run against an offline copy of the website built from sanitized captures of its real page structure, with generated test streams.

**Playback of real streams by the built-in player on a Samsung TV is still unverified.** TVs play the website's adaptive (HLS) streams, which desktop Chromium does not. If you try it on a TV, please report the model, the Tizen version and what worked.

## Development

The TV runs only `tv.js`. Everything else is development tooling.

```
cd tools
npm ci                        # acorn and playwright-core, for development only
cd ..
node tools/build.cjs          # src/ -> tv.js (commit both)
node tools/lint.cjs           # ES5 syntax check plus banned APIs and CSS for old Tizen browsers
node tools/preview.cjs        # offline mock website with tv.js at http://127.0.0.1:8940/, rebuilds when src/ changes
node tools/screenshot.cjs     # PNGs of every screen in test/artifacts/screens/
node tools/run-tests.cjs      # build, lint and every test/*.test.cjs; pass a name to run one: node tools/run-tests.cjs boot
```

On Windows the tests use the installed Microsoft Edge or Google Chrome. Elsewhere, run `npx playwright-core install chromium` in `tools/` and set `PW_CHANNEL=chromium`, as CI does. The preview and tests never contact the real website. The mock server in `tools/mock-site.cjs` serves the fixtures and imitates the website's search, suggestions, sign-in gate, source list and player.

| Path | Contents |
| --- | --- |
| `docs/ARCHITECTURE.md` | The binding contract: file ownership, data shapes, UX specification, reliability rules, the DOM hooks tests rely on, and banned APIs. Read it before changing code. |
| `src/00-core.js` | Shared utilities (`U`), storage, log and key names. |
| `src/10-site.js` | `Site`: reads the website's pages (home rows, lists, search, detail, episodes, sources) with generic fallbacks. |
| `src/20-api.js` | `Api`, `Prefs`, `Session`: requests, caching, search, suggestions, settings and saved navigation. |
| `src/30-ui-kit.js` | Focus engine, element builders, icons and the image loader. |
| `src/40-ui-screens.js` | Home, browse, search, detail, library, settings, sign-in and diagnostics screens. |
| `src/50-ui-overlays.js` | Source picker, the website player's controls and OSD, exit dialog, messages and website view. |
| `src/55-player.js` | `NativePlayer`: the built-in player (streams, resume, progress, Skip Intro, Up Next, quality). See `docs/PLAYER.md`. |
| `src/60-app.js` | `App`: routing, the screen stack, restoring state, key handling and the play flow (built-in or website player). |
| `src/90-boot.js` | `Boot`: start-up guards, error isolation and tear-down. |
| `src/shell.css`, `src/player.css`, `src/screens.css` | All styles, scoped under `#mbptv` (the player's under `#mbptv-player`), with the TV performance mode rules. |
| `docs/PLAYER.md` | The built-in player: the website endpoints it uses, its contract and behaviour, and how the app wires it in. |
| `tools/` | Build, lint, preview, screenshots, the mock website and the test runner. |
| `test/` | Browser tests. `test/fixtures/` holds sanitized structural copies of real website pages. |

Rules that keep the module working on every supported TV:

- Runtime code in `src/` is ES5 only (no arrow functions, `let` or `const`, classes, template literals, `Promise` or `fetch`) and avoids the CSS features listed in `docs/ARCHITECTURE.md` section 9. `tools/lint.cjs` enforces this.
- Never build HTML from website data. Use `textContent` and attributes.
- `tv.js` is generated. Edit `src/`, run `node tools/build.cjs`, and commit `src/` and `tv.js` together. CI fails when the committed `tv.js` does not match `src/`.
- Fixtures are sanitized structural copies. **Never commit real account data**: cookies, tokens, user IDs, HAR files, full page saves or screenshots of your account. Keep private captures in `.private/`, which Git ignores.

**Release checklist.** Update `version` in `package.json` and the install tag in this README. Then run `node tools/run-tests.cjs` and commit `src/`, `tv.js`, `package.json` and `README.md` together. Wait for CI to pass, then tag the release and push the tag (`git tag v0.3.1` and `git push origin v0.3.1`). Finally, confirm that `https://cdn.jsdelivr.net/gh/AHcoder23/moviebox-pro-tv@v0.3.1/tv.js` starts with the new version number. Never move or delete a published tag, because TVs pinned to it depend on it.

**Start page.** The module opens `https://www.movieboxpro.app/`. To use another working HTTPS address, run the following in PowerShell, which needs Node.js:

```powershell
.\configure-start-page.ps1 -StartUrl 'https://YOUR-WORKING-ADDRESS/'
```

It updates `websiteURL` in `package.json` and rebuilds `tv.js`. If the rebuild fails, both files are restored. Commit both files and publish a new tag. The module runs on the configured host and its `www` variant.

## References

- [TizenBrew module format](https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md)
- [TizenBrew source](https://github.com/reisxd/TizenBrew)
- [jsDelivr GitHub addressing and version tags](https://github.com/jsdelivr/jsdelivr#github)
- [Samsung remote control guide](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html)

## License

MIT, see [LICENSE](LICENSE). This is an independent project and is not affiliated with or endorsed by MovieBox Pro, Samsung or TizenBrew. It does not host or provide any content. It is an interface for a website you already have access to.
