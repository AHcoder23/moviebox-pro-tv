# MovieBox Pro TV for TizenBrew

A remote-friendly TV interface for the MovieBox Pro website on Samsung Tizen TVs. It turns the website you already subscribe to into a 10-foot app: poster rows, a full-screen hero, detail pages with seasons and episodes, search with live suggestions, a quality picker, and remote control of the website's own player.

**This is a TizenBrew module, not an APK.** TizenBrew opens the MovieBox Pro website in its own TV app window and loads this module's script (`tv.js`) into it. Nothing is installed on the TV outside TizenBrew, and there is no separate icon on the Samsung Home screen. You need your own MovieBox Pro account.

## Contents

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

## Features

- **Premium TV interface.** A dark, full-screen layout sized for a 3 m viewing distance. The focused title's artwork fills the top of Home, poster rows sit below, and a slim menu rail on the left expands when you move onto it (Search, Home, Movies, TV Shows, My Library, Settings). Focus is always obvious: the focused card grows and gets a white ring.
- **Search that works with a remote.** An on-screen keyboard (A–Z, 0–9, Space, Delete, Clear), live suggestions as you type, recent and trending searches, results in a poster grid with **All / Movies / TV Shows** tabs, and more results as you scroll down. The number keys on the remote and a USB or Bluetooth keyboard type too.
- **Detail pages.** Backdrop, year, runtime, rating, genres, IMDb, Tomatometer and audience scores, the overview, and quality badges. Shows get a season picker and an episode row with stills, titles, runtimes and descriptions. Movies get **More like this** and the cast.
- **Quality picker with a preferred quality.** Choose Best, 1080p, 720p or Ask every time. When your preferred quality is available, playback starts with it automatically, and a message confirms what is playing (for example "Playing 1080p · 6.71 GB"). Otherwise a list of the available files opens.
- **Player remote controls.** Playback uses the website's own player. OK plays and pauses, Left and Right skip 10 seconds (hold to skip faster), Up and Down show a progress overlay (OSD), media keys work, and Back closes the player and returns you to the title.
- **Continue watching.** The website's "Waiting to Watch" row appears on Home with progress bars and the episode or time where you stopped, and titles you have started offer **Resume**.
- **Reliability.**
  - The module starts only on MovieBox pages and only once, even when TizenBrew injects the script several times. It never runs inside frames or on other sites such as Google sign-in.
  - If the TV interface fails to start, it removes itself completely and leaves the website usable.
  - Every network request has a time limit and one automatic retry. A page that cannot load shows **Retry**, **Open website** and **Home** instead of a blank screen.
  - An expired login takes you to the sign-in screen.
  - A watchdog puts focus back on screen if it is ever lost, and the remote keeps working even when a website frame (an ad, or the website's player page) takes focus.
  - Playback never loops or traps you: Back while playback is starting cancels it, and going back to a title page never restarts playback. If the website changes its list of files, the website's own list appears with the focus ring instead.
  - If the website changes its layout, the module falls back to generic title detection, and the Diagnostics screen reports what changed.
  - The code is written for the oldest Tizen browsers (Chromium 47, 2017 TVs) and avoids newer JavaScript and CSS features.

## Install and update

1. Install [TizenBrew](https://github.com/reisxd/TizenBrew) on the TV if you have not already.
2. Open **TizenBrew > Module Manager > Add GitHub Module**.
3. Enter exactly:

   ```
   AHcoder23/moviebox-pro-tv@v0.3.0
   ```

   Include the **23** and the **@v0.3.0**. Do not add `gh/` or a full URL.
4. Fully close TizenBrew and open it again, then launch **MovieBox Pro TV**.
5. Check the version under **Settings > About**. It should show **0.3.0**.

**Why the `@v0.3.0` tag matters.** TizenBrew downloads `tv.js` through the jsDelivr CDN (`cdn.jsdelivr.net/gh/AHcoder23/moviebox-pro-tv@<version>/tv.js`). A version tag always serves the same files, so the module keeps behaving the same way until you choose to update. A branch such as `@main` can change at any time, and the CDN may serve an older cached copy of it for a while.

**To update**, add the new tag the same way (for example `AHcoder23/moviebox-pro-tv@v0.3.1`), restart TizenBrew, and remove the old entry once the new one works. **To roll back**, add the previous tag again. TizenBrew keeps the downloaded script in memory until it restarts, so always restart TizenBrew after changing the module. After it works, you can select the module in **TizenBrew Settings > Autolaunch**.

## Sign in

When the website asks you to log in, the module shows **Sign in to MovieBox Pro** with three choices:

- **Sign in with QR code.** The website shows a QR code to scan with your phone.
- **Sign in with a code.** Follow the website's code instructions.
- **Sign in with Google.**

Each choice opens the website's own login page in website view. Login happens on the website, and the module never sees or stores your password. After the website signs you in and returns to its home page, the TV interface opens again. If it does not, press **Blue** or **Info**, or select the **TV** button in the bottom-left corner.

TizenBrew and the TV's regular web browser keep separate logins, so sign in inside TizenBrew even if the TV browser is already signed in.

## Remote controls

| Button | Browsing | Player | Website view |
| --- | --- | --- | --- |
| Arrows | Move focus. Left from the first item opens the menu rail. | Left and Right skip 10 s (hold to skip faster). Up and Down show the OSD. | Move a white focus ring between the website's controls. |
| OK | Open or select. On the keyboard, type the letter. | Play or pause. | Click the focused control. |
| Back | Go back one screen, or close a list or dialog. On Home, asks **Exit MovieBox Pro TV?** with **Stay** selected. | Close the player and return to the title. | Go back in the website's history. On the page where you opened website view, return to the TV interface. |
| 0–9 | Type into Search. | | |
| Play, Pause, Play/Pause, Stop, Rewind, Fast-forward | | Control playback. | |
| Blue or Info | | | Return to the TV interface. The **TV** button in the bottom-left corner does the same. |

A USB or Bluetooth keyboard also types into Search, and Backspace deletes. Pop-ups that the website shows during playback get a focused close button, and Back dismisses them.

## Settings

- **Preferred quality:** Best, 1080p, 720p or Ask every time. It is used when you press Play. The **Quality** button on a movie's page always opens the full list.
- **Website remote controls:** turns the focus ring and OK clicks on or off in website view. Turn it off if a website page handles the remote itself and the two conflict.
- **Reduce motion:** turns off zoom and slide animations.
- **Diagnostics:** shows technical details for problem reports (see below).
- **Open website view:** shows the plain website with remote navigation, for pages the TV interface does not cover, such as account settings or playlists. Website view stays on while you follow links on the website, until you press **Blue** or **Info** or select the **TV** button, which brings back the screen you left.
- **Reload:** reloads the page and the TV interface.
- **About:** the module version.

## Troubleshooting

- **A page will not load.** Choose **Retry**. If it keeps failing, choose **Open website** to check whether the website itself is working, or **Home**.
- **Playback does not start.** If the website has not started playback after about 10 seconds, the module returns to the title and shows "The website didn't start playback. Try Play again." Try again, or use **Quality** to pick another file. Setting **Preferred quality** to **Ask every time** lets you choose the file every time. If the website changes its list of files so that the module cannot read it, the website's own list appears instead, with the white focus ring; choose a file with OK, or press Back to close it.
- **Something looks wrong or stops responding to the remote.** Press **Back**. In website view, press **Blue** or **Info** to return to the TV interface. **Settings > Reload** restarts the interface.
- **Diagnostics.** **Settings > Diagnostics** shows the module version, the TV's browser version (user agent), the page type, the last website self-test and the last 30 log lines. Include a photo of this screen when you report a problem.
- **The website's own controls conflict with the remote.** Turn off **Settings > Website remote controls**.
- **The TV interface does not appear, or an update did not take effect.** In TizenBrew's Module Manager, check that the module entry names an exact tag such as `AHcoder23/moviebox-pro-tv@v0.3.0`. Remove the entry, add it again with the tag, and fully restart TizenBrew. If a newer version misbehaves, re-pin the previous tag.
- **The website changed.** The module keeps working with generic title detection, but some details may be missing. The Diagnostics self-test lists what it could not find. Report it so the adapter can be updated.

## Privacy

- The module has **no analytics, tracking or advertising**, and it sends nothing to the module's authors.
- It only talks to the MovieBox Pro website you opened, on that same website, using your existing website session. It loads the website's pages, search suggestions and trending searches. Posters and backdrops load from the image servers the website already uses.
- **jsDelivr** (`cdn.jsdelivr.net`) serves the `tv.js` file to TizenBrew. Like any download, that request is visible to the CDN.
- Typing in Search only fetches suggestions. Running a search (the **Search** key, a suggestion, or a recent or trending chip) performs a normal website search, which MovieBox Pro adds to your search history as the website does. Opening a title's page does not add it to your watch history, but playing does, as on the website.
- The module stores only these items in TizenBrew's local storage on the TV: your settings, a cache of title details for faster artwork (up to 300 titles, kept for 14 days), your last 12 searches, and a short diagnostic log (up to 60 lines). It does not read or store passwords, and it does not handle payment details.

## Status and verification

Version 0.3.0 is a rewrite. It was verified with an automated test suite in desktop Chromium (Microsoft Edge), emulating a Tizen TV's user agent and remote key codes at 1920×1080 and 1280×720. The tests also run with the browser features that 2017 TVs lack removed, with storage that fails, and with a slow website. They run against an offline copy of the website built from sanitized captures of its real page structure. **Verification on Samsung TV hardware and with live playback on the real website is still pending.** If you try it on a TV, please report the model, the Tizen version and what worked.

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
| `src/50-ui-overlays.js` | Source picker, player controls and OSD, exit dialog, messages and website view. |
| `src/60-app.js` | `App`: routing, the screen stack, restoring state and key handling. |
| `src/90-boot.js` | `Boot`: start-up guards, error isolation and tear-down. |
| `src/shell.css` | All styles, scoped under `#mbptv`. |
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
