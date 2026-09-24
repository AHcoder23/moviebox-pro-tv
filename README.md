# MovieBox Pro TV for TizenBrew

An independent, experimental module that opens the MovieBox Pro website inside TizenBrew and adds TV remote controls. Uses the site's existing catalog, login, and player. Version 0.1.0.

**Status: local controls tested; real website and Samsung TV testing still needed.** This is a website enhancement, not a conversion of the Android app. It launches from TizenBrew; it does not create a separate Samsung Home-screen app icon.

## What it adds

- Directional navigation between ordinary links, buttons, and form controls, with a gold focus outline.
- OK to activate a selection; text entry stays with the TV's native keyboard.
- A TV menu with Home, play/pause, ten-second seek buttons, fullscreen, reload, and close.
- Media-key support for accessible HTML video players.
- A switch to turn off the added navigation if the site already handles the remote.

The website's layout stays in place. Custom controls, cross-origin embedded players, sign-in flows, and changes to the website may need additional adaptation. Downloads and the APK's native VLC/IJK playback engine are not included.

## Start page

The default is `https://www.movieboxpro.app/`. If the address you already use is different, configure the exact HTTPS address before publishing:

```powershell
.\configure-start-page.ps1 -StartUrl 'https://YOUR-WORKING-ADDRESS/'
```

This updates `websiteURL` in `package.json` and `START_URL` in `tv.js`. The module only adds controls on that hostname (with or without `www`); it leaves external sign-in pages and child frames untouched. You may need to sign in again because the TV browser and TizenBrew may use different sessions.

## Install with your existing TizenBrew

TizenBrew's current module loader downloads files through jsDelivr from public GitHub or npm packages. A local ZIP, APK, or LAN URL cannot be entered as a GitHub module.

1. On the TV, open **TizenBrew → Module Manager → Add GitHub Module**.
2. Enter **`AHcoder23/moviebox-pro-tv@main`**. Do not add a full URL or a `gh/` prefix.
3. Return to TizenBrew's module list and open **MovieBox Pro TV**.
4. Sign in through the website if asked, then try browsing, search, and playback.

Source: [AHcoder23/moviebox-pro-tv](https://github.com/AHcoder23/moviebox-pro-tv). No build or npm install is needed. To publish your own customized version, place `package.json` and `tv.js` at the root of a public repository and use its owner/repository name. The Android APK is not part of this module.

For updates, using `OWNER/REPOSITORY@COMMIT_SHA` avoids an older cached branch version. Restart TizenBrew to clear its in-memory module script cache. Remove the old module entry after verifying the new one.

After it works on your TV, TizenBrew **Settings → Autolaunch** can select this module so opening TizenBrew takes you directly into it. The exact menu wording can vary by version or language.

## Remote controls

| Control | Action |
| --- | --- |
| Arrows | Move between controls |
| OK / Enter | Activate; start editing a selected field |
| Back | Leave text entry, close the TV menu, leave fullscreen, or go back a page |
| Blue / Info | Open or close the TV menu |
| Play / Pause / Play-Pause | Control a visible HTML video |
| Rewind / Fast-forward | Seek ten seconds within the available seek range |
| Stop | Pause and reset a finite-duration video |
| Keyboard M | Open the menu, except while typing |

Fullscreen arrows and OK are left to the website player, preserving its settings and subtitle controls. Dedicated media keys still work for accessible HTML video. If the remote has no Blue or Info key, use the on-screen **TV menu** button. **Close app** uses the Tizen API when available; otherwise hold Back to close and reopen TizenBrew.

## Testing and limitations

31 local browser checks passed for focus movement, hidden controls, forms, menu scrolling and recovery, media-key handling with a mock video, seek limits, fullscreen event preservation, navigation disable/enable, and duplicate injection. Syntax was checked with Node.js. An independent code review was performed.

These checks do not prove compatibility with MovieBox Pro's live HTML, login, real media, or Samsung hardware. The browser tool's site-safety policy prevented live-site inspection during development. The APK was inspected statically only: version 13.1 (123), package `com.movieboxpro.androidtv`, native Android TV UI and playback libraries.

This module adds no analytics, custom login form, credential storage, or network fetches of its own. The website and TizenBrew continue to make their normal network requests. The module has no dependencies or install scripts.

## References

- [TizenBrew module format](https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md)
- [TizenBrew source](https://github.com/reisxd/TizenBrew/tree/14760a371fa5132e6f93200f3045c5bbc5a9d1ca)
- [Samsung remote-control guide](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html)
- [jsDelivr GitHub package addressing](https://github.com/jsdelivr/jsdelivr#github)

MIT-licensed module code. Not affiliated with MovieBox Pro, Samsung, or TizenBrew.
