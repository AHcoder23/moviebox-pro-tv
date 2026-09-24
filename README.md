# MovieBox Pro TV for TizenBrew

An independent TV interface for the MovieBox Pro website on Samsung Tizen TVs. **Version 0.2.0** replaces the basic navigation overlay with a catalog screen, poster rows, large title artwork, a navigation rail, and a remote-operated search keyboard.

This is a TizenBrew website module, not an Android APK conversion. It launches inside TizenBrew and does not add a separate Samsung Home-screen icon.

## What changed

- Reads MovieBox's actual `li[title]` cards and clickable poster images. The previous generic link detection missed them.
- Keeps every recognized row and title from the current page, with the original section names, artwork, and available ratings.
- Adds clear directional focus, horizontal poster rows, and remembered selections when moving between rows.
- Adds an on-screen keyboard. **Search MovieBox** submits the site's existing search form, preserving native validation, login, and submit handlers. Nearby matches are explicitly labeled **Matches on this page**.
- Opens the original title, Continue watching, category, and See all controls. The TV interface closes before the original action runs.
- Keeps a Website option and a TV menu for recovery.

## Install or update

1. Open **TizenBrew > Module Manager > Add GitHub Module**.
2. Enter **`AHcoder23/moviebox-pro-tv@391dbd7`**. This exact 0.2.0 build was verified on the download CDN. Include **23**. Do not include `gh/` or a full URL.
3. Fully close and reopen TizenBrew, then launch **MovieBox Pro TV**.
4. Check that TizenBrew lists version **0.2.0**. The new interface also shows **MovieBox Pro TV 0.2** in its footer.

TizenBrew caches downloaded scripts, and jsDelivr may cache the `main` branch. To select an exact update, use `AHcoder23/moviebox-pro-tv@COMMIT_SHA`, replacing `COMMIT_SHA` with the update's commit identifier from this repository. Restart TizenBrew after changing the module. Remove the old entry once the new one works.

The repository root contains everything needed. A local ZIP, APK, or local network URL is not a GitHub module. There is no build or npm install step. TizenBrew Settings > Autolaunch can select this module after it works on your TV.

## Remote controls

| Control | TV interface | Original website |
| --- | --- | --- |
| Arrows | Browse rows, rail, and search keyboard | Focus visible page controls |
| OK / Enter | Open selection or type selected letter | Activate selection; edit selected text field |
| Back | Return from Search; open/close TV menu | Use page history when the site has not handled Back |
| Blue / Info | Open/close TV menu | Open/close TV menu |
| Media keys | Passed through | Fallback play, pause, stop, and ten-second seek for accessible HTML video |

Physical keyboards also type into TV Search; Backspace deletes. Choose **Search MovieBox** to submit. Website text fields and fullscreen player arrows/OK retain their own keyboard behavior. If added navigation conflicts with a page, turn **Website remote controls** off in the TV menu. A visible TV menu button is available on native pages for remotes without Blue or Info.

## Verified behavior and remaining limits

The redesigned catalog was checked against a sanitized, offline copy of user-supplied MovieBox homepage HTML: **10 rows and 100 titles** were recognized. No scripts from that saved website were executed. Remote row navigation, row focus memory, on-screen typing, page filtering, and handoff to original title/search controls were checked locally. Sixteen independent search checks cover native submission, validation, cancellation, missing/foreign forms, and the older-browser submit fallback.

**Samsung hardware and live playback remain unverified.** The supplied homepage did not include title-detail pages, search-result pages, or player HTML. Those pages keep the website's controls; recognized catalog markup may receive the TV interface. Search result pagination remains with the original website; **Website** is available for loading more results. This release does not claim a fully rebuilt player, a complete catalog API, or APK playback-engine support.

The module uses conservative JavaScript syntax for older TV browsers, but TV year, firmware, and site changes can still affect compatibility. If no catalog is recognized or a player is active, it leaves the website available. Login is handled by the website. TizenBrew and the regular TV browser may use different login sessions.

## Start page

The default is `https://www.movieboxpro.app/`. To configure another working HTTPS start address before publishing:

```powershell
.\configure-start-page.ps1 -StartUrl 'https://YOUR-WORKING-ADDRESS/'
```

Publish both changed files: `package.json` and `tv.js`. Controls only run on the configured hostname, allowing its `www` variant. External sign-in pages and child frames are left alone.

No saved HTML, private account data, APK, downloaded website scripts, or saved poster images are included in this repository. The module adds no analytics, credential storage, or catalog API requests. It displays image URLs already present in the live page and invokes the page's existing actions. No dependencies or install scripts are required.

## References

- [TizenBrew module format](https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md)
- [TizenBrew source](https://github.com/reisxd/TizenBrew)
- [Samsung remote-control guide](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html)
- [jsDelivr GitHub addressing](https://github.com/jsdelivr/jsdelivr#github)

MIT-licensed module code. Not affiliated with MovieBox Pro, Samsung, or TizenBrew.
