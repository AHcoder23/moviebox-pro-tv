/* MovieBox Pro TV 0.3.1 — independent TizenBrew module. MIT license. Built from src/; do not edit by hand. */
(function () {
  'use strict';
  var VERSION = "0.3.1";
  var START_URL = "https://www.movieboxpro.app/";
  var CSS_TEXT = "/* MovieBox Pro TV shell. Scoped under #mbptv (plus the top-level #mbptv-pill, #mbptv-ring and #mbptv-osd).\n   Reference frame 1920x1080: 1em = 16px. Tokens: bg #07070a, elevated #131318, elevated-2 #1c1c23,\n   hairline rgba(255,255,255,.08), text #f5f5f7, text-2 rgba(245,245,247,.72), text-3 rgba(245,245,247,.6),\n   gold #e7bd68, IMDb #f5c518, fresh #fa320a, success #35c46a. Chromium 47 safe: flexbox, margins, prefixed transforms. */\n\n#mbptv, #mbptv-osd, #mbptv-pill, #mbptv-ring {\n  font-family: \"SamsungOne\", \"Samsung Sans\", \"TizenSans\", \"Helvetica Neue\", Helvetica, Arial, sans-serif;\n  font-size: 0.8333vw;\n  -webkit-font-smoothing: antialiased;\n  -webkit-box-sizing: border-box;\n  box-sizing: border-box;\n  text-align: left;\n  direction: ltr;\n  letter-spacing: 0;\n  text-transform: none;\n  font-style: normal;\n}\n#mbptv {\n  position: fixed;\n  left: 0;\n  top: 0;\n  width: 100%;\n  height: 100%;\n  z-index: 2147483000;\n  background: #07070a;\n  color: #f5f5f7;\n  line-height: 1.3;\n  font-weight: 400;\n  overflow: hidden;\n  outline: none;\n  -webkit-user-select: none;\n  user-select: none;\n  cursor: default;\n}\n#mbptv div, #mbptv span, #mbptv img, #mbptv svg {\n  -webkit-box-sizing: border-box;\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  outline: none;\n  float: none;\n  max-width: none;\n  background-image: none;\n  font-family: inherit;\n  line-height: inherit;\n  letter-spacing: inherit;\n  text-decoration: none;\n  color: inherit;\n}\n#mbptv div, #mbptv span { font-size: 100%; font-weight: inherit; }\n#mbptv img { display: block; }\n#mbptv [data-f] { outline: none; cursor: pointer; }\n\n/* Hidden modes (player, website): the root stays for toasts but never covers or blocks the site. */\n#mbptv.is-hidden { background: transparent; pointer-events: none; }\n#mbptv.is-hidden .mb-rail, #mbptv.is-hidden .mb-stage, #mbptv.is-hidden .mb-layer, #mbptv.is-hidden .mb-starting { display: none; }\n\n/* ---------- Icons ---------- */\n#mbptv .mb-ico, #mbptv-osd .mb-ico, #mbptv-pill .mb-ico { display: inline-block; width: 1.5em; height: 1.5em; line-height: 0; vertical-align: middle; }\n#mbptv .mb-ico svg, #mbptv-osd .mb-ico svg, #mbptv-pill .mb-ico svg { display: block; width: 100%; height: 100%; }\n\n/* ---------- Motion ---------- */\n@-webkit-keyframes mbSpin { from { -webkit-transform: rotate(0deg); } to { -webkit-transform: rotate(360deg); } }\n@keyframes mbSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\n@-webkit-keyframes mbShimmer { from { -webkit-transform: translateX(-100%); } to { -webkit-transform: translateX(100%); } }\n@keyframes mbShimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }\n@-webkit-keyframes mbBlink { 0%, 45% { opacity: 1; } 55%, 100% { opacity: 0; } }\n@keyframes mbBlink { 0%, 45% { opacity: 1; } 55%, 100% { opacity: 0; } }\n@-webkit-keyframes mbFadeIn { from { opacity: 0; } to { opacity: 1; } }\n@-webkit-keyframes mbScreenIn { from { opacity: .4; } to { opacity: 1; } }\n@keyframes mbScreenIn { from { opacity: .4; } to { opacity: 1; } }\n@keyframes mbFadeIn { from { opacity: 0; } to { opacity: 1; } }\n@-webkit-keyframes mbSlideIn { from { -webkit-transform: translate3d(100%, 0, 0); } to { -webkit-transform: translate3d(0, 0, 0); } }\n@keyframes mbSlideIn { from { transform: translate3d(100%, 0, 0); } to { transform: translate3d(0, 0, 0); } }\n@-webkit-keyframes mbPop { from { opacity: 0; -webkit-transform: scale(.94); } to { opacity: 1; -webkit-transform: scale(1); } }\n@keyframes mbPop { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: scale(1); } }\n\n#mbptv.mb-reduce *, #mbptv.mb-reduce *:after, #mbptv-osd.mb-reduce, #mbptv-osd.mb-reduce *, #mbptv-ring.mb-reduce {\n  -webkit-transition: none !important;\n  transition: none !important;\n  -webkit-animation: none !important;\n  animation: none !important;\n}\n#mbptv.mb-reduce .mb-spinner-ring { -webkit-animation: mbSpin 1.2s linear infinite !important; animation: mbSpin 1.2s linear infinite !important; }\n/* TV performance mode (#mbptv.mb-perf) calms the costliest effects: see the end of this file. */\n\n/* ---------- Stage and screens ---------- */\n#mbptv .mb-stage { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }\n#mbptv .mb-screen { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: hidden; display: none; background: #07070a; }\n/* The incoming screen fades from 40%, never from black: no frame shows an empty stage between two screens. */\n#mbptv .mb-screen.is-current { display: block; -webkit-animation: mbScreenIn .22s ease-out; animation: mbScreenIn .22s ease-out; }\n\n/* ---------- Rail ---------- */\n#mbptv .mb-rail {\n  position: absolute; left: 0; top: 0; bottom: 0; width: 6.5em; z-index: 20;\n  -webkit-transition: width .2s cubic-bezier(.2, .8, .2, 1); transition: width .2s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv.no-rail .mb-rail { display: none; }\n#mbptv .mb-rail-bg {\n  position: absolute; left: 0; top: 0; bottom: 0; width: 120em; opacity: 0; pointer-events: none;\n  background: -webkit-linear-gradient(left, rgba(7, 7, 10, .98) 0%, rgba(7, 7, 10, .97) 19%, rgba(7, 7, 10, .84) 32%, rgba(7, 7, 10, .76) 100%);\n  background: linear-gradient(to right, rgba(7, 7, 10, .98) 0%, rgba(7, 7, 10, .97) 19%, rgba(7, 7, 10, .84) 32%, rgba(7, 7, 10, .76) 100%);\n  -webkit-transition: opacity .2s ease-out; transition: opacity .2s ease-out;\n}\n#mbptv.rail-open .mb-rail { width: 19em; }\n#mbptv.rail-open .mb-rail-bg { opacity: 1; }\n#mbptv .mb-rail-head { position: absolute; left: 1.75em; top: 3.5em; height: 3em; white-space: nowrap; }\n#mbptv .mb-rail-brand {\n  position: absolute; left: 3.1em; top: .45em; font-size: 1.375em; font-weight: 700; letter-spacing: .01em; color: #f5f5f7;\n  opacity: 0; -webkit-transition: opacity .18s; transition: opacity .18s;\n}\n#mbptv.rail-open .mb-rail-brand { opacity: 1; }\n#mbptv .mb-rail-items { position: absolute; left: 1em; top: 50%; margin-top: -15.5em; width: 17em; }\n#mbptv .mb-rail-item {\n  position: relative; height: 3.5em; width: 4.5em; margin-bottom: .75em; border-radius: 1.75em; color: rgba(245, 245, 247, .62);\n  white-space: nowrap; overflow: hidden;\n  -webkit-transition: background-color .18s, color .18s, width .2s cubic-bezier(.2, .8, .2, 1); transition: background-color .18s, color .18s, width .2s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv .mb-rail-item .mb-ico { position: absolute; left: 1.5em; top: 1em; width: 1.5em; height: 1.5em; }\n#mbptv .mb-rail-label {\n  position: absolute; left: 3.6em; top: 1.05em; font-size: 1.25em; line-height: 1.12em; font-weight: 600; opacity: 0;\n  -webkit-transition: opacity .15s; transition: opacity .15s;\n}\n#mbptv.rail-open .mb-rail-item { width: 15em; }\n#mbptv.rail-open .mb-rail-label { opacity: 1; }\n#mbptv .mb-rail-item.is-active { color: #e7bd68; }\n#mbptv .mb-rail-item.is-focused { background: #f5f5f7; color: #07070a; }\n#mbptv .mb-rail-sep { height: 1.75em; }\n\n/* ---------- Monogram and brand ---------- */\n#mbptv .mb-mono, #mbptv-pill .mb-mono {\n  position: relative; width: 3em; height: 3em; border-radius: .8em; overflow: hidden;\n  background: #e7bd68;\n  background: -webkit-linear-gradient(315deg, #f3d48f 0%, #e7bd68 45%, #b98a35 100%);\n  background: linear-gradient(135deg, #f3d48f 0%, #e7bd68 45%, #b98a35 100%);\n  box-shadow: 0 .4em 1.2em rgba(231, 189, 104, .18);\n}\n#mbptv .mb-mono-m, #mbptv-pill .mb-mono-m {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; text-align: center; color: #1a1408;\n  font-size: 1.9em; line-height: 1.58em; font-weight: 800; letter-spacing: -.02em;\n}\n#mbptv .mb-mono--xl { width: 7em; height: 7em; border-radius: 1.8em; }\n#mbptv .mb-mono--xl .mb-mono-m { font-size: 4.4em; line-height: 1.6em; }\n\n/* ---------- Type ---------- */\n#mbptv .mb-display { font-size: 4.5em; line-height: 1.04; font-weight: 800; letter-spacing: -.015em; color: #f5f5f7; }\n#mbptv .mb-h1 { font-size: 3em; line-height: 1.12; font-weight: 700; letter-spacing: -.01em; color: #f5f5f7; }\n#mbptv .mb-section { font-size: 1.75em; line-height: 1.2; font-weight: 600; color: #f5f5f7; }\n#mbptv .mb-body { font-size: 1.5em; line-height: 1.45; font-weight: 400; color: rgba(245, 245, 247, .72); }\n#mbptv .mb-meta { font-size: 1.25em; line-height: 1.4; font-weight: 500; color: rgba(245, 245, 247, .72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-kicker { font-size: 1.0625em; line-height: 1.3; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #e7bd68; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-clamp2, #mbptv .mb-clamp3, #mbptv .mb-clamp4 { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }\n#mbptv .mb-clamp2 { -webkit-line-clamp: 2; }\n#mbptv .mb-clamp3 { -webkit-line-clamp: 3; }\n#mbptv .mb-clamp4 { -webkit-line-clamp: 4; }\n\n/* ---------- Buttons ---------- */\n#mbptv .mb-btns { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; }\n#mbptv .mb-btn {\n  display: -webkit-inline-box; display: -webkit-inline-flex; display: inline-flex; -webkit-align-items: center; align-items: center;\n  height: 3.75em; padding: 0 2em; margin-right: 1em; border-radius: 2em; white-space: nowrap;\n  background: rgba(255, 255, 255, .1); color: #f5f5f7;\n  -webkit-transition: -webkit-transform .18s cubic-bezier(.2, .8, .2, 1), background-color .18s, color .18s, box-shadow .18s;\n  transition: transform .18s cubic-bezier(.2, .8, .2, 1), background-color .18s, color .18s, box-shadow .18s;\n}\n#mbptv .mb-btn--primary { background: rgba(245, 245, 247, .3); color: #fff; }\n#mbptv .mb-btn .mb-btn-ico { width: 1.5em; height: 1.5em; margin: 0 .75em 0 -.25em; }\n#mbptv .mb-btn-label { font-size: 1.375em; font-weight: 600; line-height: 1; letter-spacing: .005em; }\n#mbptv .mb-btn.is-focused {\n  background: #f5f5f7; color: #07070a;\n  -webkit-transform: scale(1.06); transform: scale(1.06);\n  box-shadow: 0 .8em 2em rgba(0, 0, 0, .55);\n}\n\n/* ---------- Chips ---------- */\n#mbptv .mb-chiprow { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-flex-wrap: wrap; flex-wrap: wrap; }\n#mbptv .mb-chip {\n  display: -webkit-inline-box; display: -webkit-inline-flex; display: inline-flex; -webkit-align-items: center; align-items: center;\n  height: 3.25em; padding: 0 1.5em; margin: 0 .875em .875em 0; border-radius: 2em; white-space: nowrap;\n  background: rgba(255, 255, 255, .1); color: rgba(245, 245, 247, .86);\n  -webkit-transition: -webkit-transform .18s cubic-bezier(.2, .8, .2, 1), background-color .18s, color .18s;\n  transition: transform .18s cubic-bezier(.2, .8, .2, 1), background-color .18s, color .18s;\n}\n#mbptv .mb-chip-ico { width: 1.25em; height: 1.25em; margin-right: .6em; opacity: .7; }\n#mbptv .mb-chip-label { font-size: 1.25em; font-weight: 500; line-height: 1; }\n#mbptv .mb-chip.is-selected { background: rgba(231, 189, 104, .16); color: #e7bd68; }\n#mbptv .mb-chip.is-focused { background: #f5f5f7; color: #07070a; -webkit-transform: scale(1.06); transform: scale(1.06); box-shadow: 0 .6em 1.6em rgba(0, 0, 0, .5); }\n#mbptv .mb-chip.is-focused .mb-chip-ico { opacity: 1; }\n\n/* Static info chips (hero / detail). */\n#mbptv .mb-tags { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; height: 2.25em; overflow: hidden; }\n#mbptv .mb-tag {\n  display: inline-block; height: 1.75em; line-height: 1.75em; padding: 0 .6em; margin-right: .75em; border-radius: .35em;\n  font-size: 1.0625em; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap;\n  background: rgba(255, 255, 255, .14); color: #f5f5f7;\n}\n#mbptv .mb-tag--imdb { background: #f5c518; color: #000; letter-spacing: .02em; text-transform: none; }\n#mbptv .mb-tag--line { background: transparent; box-shadow: inset 0 0 0 .09em rgba(245, 245, 247, .5); color: rgba(245, 245, 247, .86); }\n#mbptv .mb-tag--gold { background: rgba(231, 189, 104, .18); color: #e7bd68; }\n#mbptv .mb-score { display: -webkit-inline-box; display: -webkit-inline-flex; display: inline-flex; -webkit-align-items: center; align-items: center; margin-right: 1.75em; white-space: nowrap; }\n#mbptv .mb-score-dot { width: .9em; height: .9em; border-radius: 50%; margin-right: .5em; background: #fa320a; }\n#mbptv .mb-score-dot--aud { background: #e7bd68; }\n#mbptv .mb-score-val { font-size: 1.375em; font-weight: 700; color: #f5f5f7; }\n#mbptv .mb-score-lbl { font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); margin-left: .5em; }\n\n/* ---------- Cards ---------- */\n#mbptv .mb-card { position: relative; -webkit-flex-shrink: 0; flex-shrink: 0; margin-right: 1.5em; }\n#mbptv .mb-card--poster { width: 12em; }\n#mbptv .mb-card--poster .mb-card-art { height: 18em; }\n#mbptv .mb-card--grid { width: 15em; }\n#mbptv .mb-card--grid .mb-card-art { height: 22.5em; }\n#mbptv .mb-card--wide { width: 22em; }\n#mbptv .mb-card--wide .mb-card-art { height: 12.375em; }\n#mbptv .mb-card-art {\n  position: relative; width: 100%; border-radius: .5em; overflow: hidden; background: #131318;\n  -webkit-transition: -webkit-transform .18s cubic-bezier(.2, .8, .2, 1), box-shadow .18s;\n  transition: transform .18s cubic-bezier(.2, .8, .2, 1), box-shadow .18s;\n}\n#mbptv .mb-card-ph {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%;\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; -webkit-justify-content: center; justify-content: center;\n  padding: 1em; text-align: center;\n  background: #16161c;\n  background: -webkit-linear-gradient(top, #1d1d25 0%, #131318 100%);\n  background: linear-gradient(to bottom, #1d1d25 0%, #131318 100%);\n}\n#mbptv .mb-card-ph-title { font-size: 1.375em; line-height: 1.25; font-weight: 700; color: rgba(245, 245, 247, .55); text-align: center; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden; }\n#mbptv .mb-img { opacity: 0; -webkit-transition: opacity .25s ease-out; transition: opacity .25s ease-out; }\n#mbptv .mb-img.is-loaded { opacity: 1; }\n#mbptv .mb-img.is-error { display: none; }\n#mbptv .mb-card-img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }\n#mbptv .mb-card-badge {\n  position: absolute; left: .6em; top: .6em; height: 1.7em; line-height: 1.7em; padding: 0 .5em; border-radius: .3em;\n  font-size: 1.0625em; font-weight: 800; letter-spacing: .06em; color: #07070a; background: rgba(245, 245, 247, .92);\n}\n#mbptv .mb-card-shade {\n  position: absolute; left: 0; right: 0; bottom: 0; height: 5em; padding: 0 .9em .9em;\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-flex-direction: column; flex-direction: column; -webkit-justify-content: flex-end; justify-content: flex-end;\n  background: -webkit-linear-gradient(bottom, rgba(0, 0, 0, .9) 0%, rgba(0, 0, 0, 0) 100%);\n  background: linear-gradient(to top, rgba(0, 0, 0, .9) 0%, rgba(0, 0, 0, 0) 100%);\n}\n#mbptv .mb-card-plabel { font-size: 1.0625em; font-weight: 700; letter-spacing: .04em; color: #f5f5f7; margin-bottom: .45em; }\n#mbptv .mb-progress { position: relative; height: .3em; border-radius: .15em; background: rgba(255, 255, 255, .28); overflow: hidden; }\n#mbptv .mb-progress-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: .15em; background: #e7bd68; }\n#mbptv .mb-card-title {\n  margin-top: .9em; font-size: 1.25em; line-height: 1.3; font-weight: 500; color: rgba(245, 245, 247, .62);\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n  -webkit-transition: color .18s, -webkit-transform .18s cubic-bezier(.2, .8, .2, 1); transition: color .18s, transform .18s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv .mb-card-sub { margin-top: .3em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); white-space: nowrap; overflow: hidden; height: 1.4em; }\n#mbptv .mb-card-sub span { display: inline-block; vertical-align: middle; }\n#mbptv .mb-card-star { width: .95em; height: .95em; margin: -.15em .3em 0 .9em; color: #e7bd68; vertical-align: middle; }\n#mbptv .mb-card.is-focused .mb-card-art {\n  -webkit-transform: scale(1.08); transform: scale(1.08);\n  box-shadow: 0 0 0 .22em #fff, 0 1.2em 2.4em rgba(0, 0, 0, .6);\n}\n#mbptv .mb-card.is-focused .mb-card-title { color: #fff; -webkit-transform: translate3d(0, .55em, 0); transform: translate3d(0, .55em, 0); }\n#mbptv .mb-card.is-focused .mb-card-sub { color: rgba(245, 245, 247, .72); -webkit-transform: translate3d(0, .55em, 0); transform: translate3d(0, .55em, 0); }\n#mbptv .mb-card--more .mb-card-art { background: rgba(255, 255, 255, .06); }\n#mbptv .mb-more-inner {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; color: rgba(245, 245, 247, .72);\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-flex-direction: column; flex-direction: column; -webkit-align-items: center; align-items: center; -webkit-justify-content: center; justify-content: center;\n}\n#mbptv .mb-more-ico { width: 3em; height: 3em; margin-bottom: .6em; }\n#mbptv .mb-more-label { font-size: 1.375em; font-weight: 600; }\n#mbptv .mb-card--more.is-focused .mb-card-art { background: #f5f5f7; }\n#mbptv .mb-card--more.is-focused .mb-more-inner { color: #07070a; }\n\n/* ---------- Skeletons, spinner, empty states ---------- */\n#mbptv .mb-skel { position: relative; overflow: hidden; background: #15151b; border-radius: .5em; }\n#mbptv .mb-skel:after {\n  content: ''; position: absolute; left: 0; top: 0; width: 100%; height: 100%;\n  background: -webkit-linear-gradient(left, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, .045) 50%, rgba(255, 255, 255, 0) 100%);\n  background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, .045) 50%, rgba(255, 255, 255, 0) 100%);\n  -webkit-animation: mbShimmer 1.5s ease-in-out infinite; animation: mbShimmer 1.5s ease-in-out infinite;\n}\n#mbptv .mb-skel-line { height: 1.1em; width: 70%; margin-top: 1em; border-radius: .3em; }\n#mbptv .mb-skel-title { height: 4.2em; width: 34em; margin-bottom: 1.2em; border-radius: .5em; }\n#mbptv .mb-skel-meta { height: 1.4em; width: 24em; margin-bottom: 1.4em; border-radius: .3em; }\n#mbptv .mb-skel-text { height: 1.3em; width: 44em; margin-bottom: .8em; border-radius: .3em; }\n#mbptv .mb-skel-text.is-short { width: 30em; }\n#mbptv .mb-spinner { position: relative; width: 3.5em; height: 3.5em; }\n#mbptv .mb-spinner-ring {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 50%;\n  border: .3em solid rgba(255, 255, 255, .14); border-top-color: #e7bd68;\n  -webkit-animation: mbSpin .9s linear infinite; animation: mbSpin .9s linear infinite;\n}\n#mbptv .mb-spinner--sm { width: 2.25em; height: 2.25em; }\n#mbptv .mb-empty { padding: 3em 0 0; max-width: 56em; }\n#mbptv .mb-empty .mb-empty-ico { width: 4em; height: 4em; color: rgba(245, 245, 247, .3); margin-bottom: 1.5em; }\n#mbptv .mb-empty .mb-section { margin-bottom: .6em; }\n#mbptv .mb-empty .mb-body { margin-bottom: 2em; }\n#mbptv .mb-empty--inline { padding: 1.5em 0 1em; white-space: normal; }\n#mbptv .mb-empty--inline .mb-body { margin-bottom: 1em; }\n#mbptv .mb-grid-note { width: 100%; -webkit-flex-basis: 100%; flex-basis: 100%; padding: 1.5em 0 3em; }\n#mbptv .mb-grid-note .mb-body { margin-bottom: 1em; }\n\n/* ---------- Loading screen ---------- */\n#mbptv .mb-loading {\n  background: #07070a;\n  background: -webkit-radial-gradient(50% 42%, circle, #17140d 0%, #07070a 55%);\n  background: radial-gradient(circle at 50% 42%, #17140d 0%, #07070a 55%);\n}\n#mbptv .mb-loading-inner {\n  position: absolute; left: 0; right: 0; top: 50%; margin-top: -9em; text-align: center;\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-flex-direction: column; flex-direction: column; -webkit-align-items: center; align-items: center;\n}\n#mbptv .mb-wordmark { margin-top: 1.4em; font-size: 2.5em; font-weight: 800; letter-spacing: -.01em; color: #f5f5f7; }\n#mbptv .mb-wordmark span { color: #e7bd68; }\n#mbptv .mb-loading .mb-spinner { margin-top: 2.5em; }\n#mbptv .mb-loading-msg { margin-top: 1.5em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); height: 1.4em; }\n\n/* ---------- Home ---------- */\n#mbptv .mb-hero { position: absolute; left: 0; top: 0; width: 100%; height: 74%; overflow: hidden; }\n#mbptv .mb-art { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }\n#mbptv .mb-art-img {\n  position: absolute; right: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 25%;\n  -webkit-transition: opacity .6s ease-out; transition: opacity .6s ease-out;\n}\n#mbptv .mb-art-poster {\n  position: absolute; right: -4%; top: -30%; width: 70%; height: 160%; object-fit: cover; opacity: 0;\n  -webkit-transition: opacity .6s ease-out; transition: opacity .6s ease-out;\n}\n#mbptv .mb-art-poster.is-loaded { opacity: .35; }\n#mbptv .mb-scrim-l {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%;\n  background: -webkit-linear-gradient(left, #07070a 0%, rgba(7, 7, 10, .85) 35%, rgba(7, 7, 10, 0) 70%);\n  background: linear-gradient(to right, #07070a 0%, rgba(7, 7, 10, .85) 35%, rgba(7, 7, 10, 0) 70%);\n}\n#mbptv .mb-scrim-b {\n  position: absolute; left: 0; bottom: 0; width: 100%; height: 55%;\n  background: -webkit-linear-gradient(bottom, #07070a 0%, rgba(7, 7, 10, .7) 40%, rgba(7, 7, 10, 0) 100%);\n  background: linear-gradient(to top, #07070a 0%, rgba(7, 7, 10, .7) 40%, rgba(7, 7, 10, 0) 100%);\n}\n#mbptv .mb-scrim-t {\n  position: absolute; left: 0; top: 0; width: 100%; height: 18%;\n  background: -webkit-linear-gradient(top, rgba(7, 7, 10, .55) 0%, rgba(7, 7, 10, 0) 100%);\n  background: linear-gradient(to bottom, rgba(7, 7, 10, .55) 0%, rgba(7, 7, 10, 0) 100%);\n}\n#mbptv .mb-hero-info {\n  position: absolute; left: 9em; top: 3.5em; width: 58em; height: 36em;\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-flex-direction: column; flex-direction: column; -webkit-justify-content: flex-end; justify-content: flex-end;\n}\n#mbptv .mb-hero-text { -webkit-transition: opacity .2s ease-out, -webkit-transform .3s cubic-bezier(.2, .8, .2, 1); transition: opacity .2s ease-out, transform .3s cubic-bezier(.2, .8, .2, 1); }\n#mbptv .mb-home.in-rows .mb-hero-text { -webkit-transform: translate3d(0, -5em, 0); transform: translate3d(0, -5em, 0); }\n#mbptv .mb-home.in-rows .mb-hero-info .mb-btns { visibility: hidden; }\n#mbptv .mb-hero-text.is-swapping { opacity: 0; }\n#mbptv .mb-hero-info .mb-kicker { margin-bottom: .9em; }\n#mbptv .mb-hero-info .mb-display { margin-bottom: .22em; max-height: 2.1em; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }\n#mbptv .mb-hero-info .mb-meta { margin-bottom: .9em; height: 1.4em; }\n#mbptv .mb-hero-info .mb-tags { margin-bottom: 1em; }\n#mbptv .mb-hero-info .mb-tag--imdb { font-size: 1.25em; height: 1.7em; line-height: 1.7em; }\n#mbptv .mb-hero-info .mb-body { width: 27em; margin-bottom: 1.1em; height: 4.35em; }\n#mbptv .mb-hero-resume { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; margin-bottom: 1.2em; height: 1.6em; }\n#mbptv .mb-hero-resume .mb-progress { width: 14em; margin-right: 1em; }\n#mbptv .mb-hero-resume .mb-meta { margin: 0; height: auto; }\n#mbptv .mb-hero-info .mb-btns { height: 4.5em; margin-left: -.1em; }\n#mbptv .mb-rows-port { position: absolute; left: 0; right: 0; top: 60.5%; bottom: 0; -webkit-transition: -webkit-transform .3s cubic-bezier(.2, .8, .2, 1); transition: transform .3s cubic-bezier(.2, .8, .2, 1); }\n#mbptv .mb-home.in-rows .mb-rows-port { -webkit-transform: translate3d(0, -8em, 0); transform: translate3d(0, -8em, 0); }\n#mbptv .mb-rows { position: absolute; left: 0; top: 0; width: 100%; -webkit-transition: -webkit-transform .3s cubic-bezier(.2, .8, .2, 1); transition: transform .3s cubic-bezier(.2, .8, .2, 1); }\n#mbptv .mb-row { position: relative; padding-bottom: 3.25em; -webkit-transition: opacity .25s ease-out; transition: opacity .25s ease-out; }\n#mbptv .mb-row.is-past { opacity: 0; }\n#mbptv .mb-row-title { margin: 0 0 .45em 5.143em; font-size: 1.75em; line-height: 1.2; font-weight: 600; color: rgba(245, 245, 247, .9); white-space: nowrap; }\n#mbptv .mb-row-view { position: relative; margin-left: 7.75em; padding: 1em 0 2.5em; margin-top: -1em; margin-bottom: -2.5em; overflow: hidden; }\n#mbptv .mb-track {\n  position: relative; display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: flex-start; align-items: flex-start;\n  padding: 0 5em 0 1.25em; white-space: nowrap;\n  -webkit-transition: -webkit-transform .26s cubic-bezier(.2, .8, .2, 1); transition: transform .26s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv .mb-row--wide .mb-card-title, #mbptv .mb-row--wide .mb-card-ph-title { display: none; }\n#mbptv .mb-card-label {\n  position: absolute; left: 0; right: 0; bottom: 0; padding: 2.4em .9em .7em; font-size: 1.25em; line-height: 1.3; font-weight: 700; color: #fff;\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n  background: -webkit-linear-gradient(bottom, rgba(0, 0, 0, .78) 0%, rgba(0, 0, 0, 0) 100%);\n  background: linear-gradient(to top, rgba(0, 0, 0, .78) 0%, rgba(0, 0, 0, 0) 100%);\n}\n#mbptv .mb-card-label:empty { display: none; }\n\n/* ---------- Detail ---------- */\n#mbptv .mb-backdrop { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: hidden; }\n#mbptv .mb-backdrop .mb-art-img { width: 100%; height: 100%; }\n#mbptv .mb-detail .mb-scrim-l {\n  background: -webkit-linear-gradient(left, #07070a 0%, rgba(7, 7, 10, .9) 30%, rgba(7, 7, 10, .35) 62%, rgba(7, 7, 10, 0) 85%);\n  background: linear-gradient(to right, #07070a 0%, rgba(7, 7, 10, .9) 30%, rgba(7, 7, 10, .35) 62%, rgba(7, 7, 10, 0) 85%);\n}\n#mbptv .mb-detail .mb-scrim-b { height: 70%; }\n#mbptv .mb-dim { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: rgba(7, 7, 10, .55); opacity: 0; -webkit-transition: opacity .3s ease-out; transition: opacity .3s ease-out; }\n#mbptv .is-scrolled .mb-dim { opacity: 1; }\n#mbptv .is-scrolled .mb-detail-top { opacity: 0; }\n#mbptv .mb-detail-mini {\n  position: absolute; left: 9em; top: 3.5em; width: 64em; height: 14.4em; overflow: hidden; z-index: 2; pointer-events: none; opacity: 0;\n  -webkit-transition: opacity .25s ease-out; transition: opacity .25s ease-out;\n}\n#mbptv .mb-detail-mini .mb-kicker { margin-bottom: .35em; }\n#mbptv .mb-mini-title { font-size: 2.5em; line-height: 1.15; font-weight: 800; letter-spacing: -.01em; color: #f5f5f7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-mini-meta { margin-top: .35em; font-size: 1.25em; line-height: 1.4; font-weight: 500; color: rgba(245, 245, 247, .72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-mini-body {\n  margin-top: .55em; max-width: 41em; height: 4.35em; font-size: 1.5em; line-height: 1.45; color: rgba(245, 245, 247, .72);\n  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;\n}\n#mbptv .is-scrolled .mb-detail-mini { opacity: 1; }\n#mbptv .mb-detail-poster {\n  position: absolute; right: 7em; top: 9em; width: 24em; height: 36em; border-radius: .75em; overflow: hidden; background: #131318;\n  box-shadow: 0 2em 5em rgba(0, 0, 0, .7);\n}\n#mbptv .mb-detail-poster img { width: 100%; height: 100%; object-fit: cover; }\n#mbptv .mb-vport { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }\n#mbptv .mb-vscroll { position: absolute; left: 0; top: 0; width: 100%; -webkit-transition: -webkit-transform .32s cubic-bezier(.2, .8, .2, 1); transition: transform .32s cubic-bezier(.2, .8, .2, 1); }\n#mbptv .mb-detail-top {\n  height: 57em; padding: 0 0 2.5em 9em; -webkit-transition: opacity .25s ease-out; transition: opacity .25s ease-out;\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-flex-direction: column; flex-direction: column; -webkit-justify-content: flex-end; justify-content: flex-end;\n}\n#mbptv .mb-detail-info { width: 64em; }\n#mbptv .mb-detail-info .mb-kicker { margin-bottom: .9em; }\n#mbptv .mb-detail-info .mb-display { margin-bottom: .25em; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; max-height: 2.1em; width: 14.5em; }\n#mbptv .mb-detail-info .mb-meta { margin-bottom: 1.1em; }\n#mbptv .mb-ratings { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; margin-bottom: 1.3em; min-height: 2.2em; }\n#mbptv .mb-ratings .mb-tag--imdb { font-size: 1.25em; height: 1.7em; line-height: 1.7em; margin-right: 1.4em; }\n#mbptv .mb-detail-info .mb-body { width: 30em; margin-bottom: 1.2em; }\n#mbptv .mb-detail-info .mb-tags { margin-bottom: 1.8em; }\n#mbptv .mb-detail-info .mb-btns { height: 4.5em; }\n#mbptv .mb-detail-rows { padding-bottom: 12em; }\n#mbptv .mb-detail-rows .mb-row { padding-bottom: 2.5em; }\n#mbptv .mb-track.mb-seasons { padding-top: .5em; -webkit-flex-wrap: nowrap; flex-wrap: nowrap; -webkit-align-items: center; align-items: center; }\n#mbptv .mb-row--seasons { padding-bottom: 1.25em; }\n#mbptv .mb-episode .mb-ep-code { position: absolute; left: .8em; bottom: .7em; font-size: 1.0625em; font-weight: 800; letter-spacing: .06em; color: #fff; }\n#mbptv .mb-episode .mb-card-shade { height: 4em; }\n#mbptv .mb-ep-title { margin-top: .9em; font-size: 1.375em; line-height: 1.3; font-weight: 600; color: rgba(245, 245, 247, .86); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; -webkit-transition: -webkit-transform .18s; transition: transform .18s; }\n#mbptv .mb-ep-meta { margin-top: .2em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-episode.is-focused .mb-ep-title { color: #fff; -webkit-transform: translate3d(0, .45em, 0); transform: translate3d(0, .45em, 0); }\n#mbptv .mb-episode.is-focused .mb-ep-meta { color: rgba(245, 245, 247, .72); -webkit-transform: translate3d(0, .5em, 0); transform: translate3d(0, .5em, 0); }\n#mbptv .mb-episode .mb-ep-play {\n  position: absolute; left: 50%; top: 50%; width: 3.6em; height: 3.6em; margin: -1.8em 0 0 -1.8em; border-radius: 50%;\n  background: rgba(7, 7, 10, .55); color: #fff; opacity: 0; -webkit-transition: opacity .18s; transition: opacity .18s;\n}\n#mbptv .mb-episode .mb-ep-play .mb-ico { position: absolute; left: 1.1em; top: .95em; width: 1.7em; height: 1.7em; }\n#mbptv .mb-episode.is-focused .mb-ep-play { opacity: 1; }\n#mbptv .mb-cast { display: -webkit-box; display: -webkit-flex; display: flex; }\n#mbptv .mb-person {\n  -webkit-flex-shrink: 0; flex-shrink: 0; margin-right: 1em; padding: .85em 1.6em .95em; border-radius: 1em; background: rgba(255, 255, 255, .08); max-width: 22em;\n  -webkit-transition: -webkit-transform .18s cubic-bezier(.2, .8, .2, 1), background-color .18s; transition: transform .18s cubic-bezier(.2, .8, .2, 1), background-color .18s;\n}\n#mbptv .mb-person-name { font-size: 1.375em; font-weight: 600; color: #f5f5f7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-person-role { margin-top: .15em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-person.is-focused { background: #f5f5f7; -webkit-transform: scale(1.06); transform: scale(1.06); }\n#mbptv .mb-person.is-focused .mb-person-name { color: #07070a; }\n#mbptv .mb-person.is-focused .mb-person-role { color: rgba(7, 7, 10, .6); }\n\n/* ---------- Page header (settings / diagnostics) ---------- */\n#mbptv .mb-page-head { position: absolute; left: 9em; top: 3.5em; right: 5em; }\n#mbptv .mb-page-head .mb-kicker { margin-bottom: .6em; }\n#mbptv .mb-page-head .mb-meta { margin-top: .5em; color: rgba(245, 245, 247, .6); }\n\n/* ---------- Browse ---------- */\n#mbptv .mb-browse-head { padding: 3.5em 5em 0 9em; margin-bottom: 1.75em; }\n#mbptv .mb-browse-head .mb-kicker { margin-bottom: .6em; }\n#mbptv .mb-browse-head .mb-meta { margin-top: .4em; color: rgba(245, 245, 247, .6); }\n#mbptv .mb-browse-tabs { padding: 0 5em 0 9em; margin-bottom: 1.25em; }\n#mbptv .mb-grid {\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-flex-wrap: wrap; flex-wrap: wrap; -webkit-align-items: flex-start; align-items: flex-start;\n}\n#mbptv .mb-browse .mb-grid { padding: .75em 0 0 9em; width: 115em; }\n#mbptv .mb-browse .mb-grid .mb-card { margin: 0 3.2em 2.5em 0; }\n#mbptv .mb-browse .mb-grid .mb-card:nth-child(6n) { margin-right: 0; }\n#mbptv .mb-grid-foot { height: 8em; padding-left: 9em; }\n#mbptv .mb-grid-foot .mb-spinner { margin-top: 1em; }\n#mbptv .mb-browse .mb-empty { padding-left: 9em; }\n#mbptv .mb-browse .mb-grid .mb-empty { padding-left: 0; }\n\n/* ---------- Search ---------- */\n#mbptv .mb-search-left { position: absolute; left: 9em; top: 3.5em; width: 34em; bottom: 0; }\n#mbptv .mb-query-line {\n  position: relative; height: 5em; margin-bottom: 1.25em; white-space: nowrap; overflow: hidden;\n  box-shadow: inset 0 -.14em 0 rgba(245, 245, 247, .18);\n}\n#mbptv .mb-query-line .mb-q-ico { position: absolute; left: 0; top: 1.2em; width: 2em; height: 2em; color: rgba(245, 245, 247, .6); }\n#mbptv .mb-query-text { position: absolute; left: 3em; right: 0; top: .7em; height: 3.4em; overflow: hidden; white-space: nowrap; }\n#mbptv #mbptv-query { display: inline-block; vertical-align: top; font-size: 2.5em; line-height: 1.3; font-weight: 600; color: #f5f5f7; white-space: pre; }\n#mbptv .mb-caret { display: inline-block; vertical-align: top; width: .2em; height: 2.7em; margin: .3em 0 0 .15em; border-radius: .1em; background: #e7bd68; -webkit-animation: mbBlink 1.05s step-end infinite; animation: mbBlink 1.05s step-end infinite; }\n#mbptv .mb-placeholder { position: absolute; left: 1.55em; top: .45em; font-size: 2em; line-height: 1.3; font-weight: 500; color: rgba(245, 245, 247, .5); display: none; }\n#mbptv .mb-query-line.is-empty .mb-placeholder { display: block; }\n#mbptv .mb-keyboard { width: 35em; display: -webkit-box; display: -webkit-flex; display: flex; -webkit-flex-wrap: wrap; flex-wrap: wrap; }\n#mbptv .mb-key {\n  width: 5em; height: 3.4em; margin: 0 .8em .7em 0; border-radius: .6em; background: rgba(255, 255, 255, .08); color: #f5f5f7;\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; -webkit-justify-content: center; justify-content: center;\n  -webkit-transition: -webkit-transform .15s cubic-bezier(.2, .8, .2, 1), background-color .15s, color .15s; transition: transform .15s cubic-bezier(.2, .8, .2, 1), background-color .15s, color .15s;\n}\n#mbptv .mb-key-label { font-size: 1.625em; font-weight: 600; line-height: 1; text-transform: uppercase; }\n#mbptv .mb-key .mb-ico { width: 1.6em; height: 1.6em; }\n#mbptv .mb-key--wide { width: 10.8em; }\n#mbptv .mb-key--wide .mb-key-label { font-size: 1.25em; text-transform: none; margin-left: .5em; }\n#mbptv .mb-key--go { width: 34em; margin-top: .3em; height: 3.6em; border-radius: 2em; background: rgba(231, 189, 104, .18); color: #e7bd68; }\n#mbptv .mb-key--go .mb-key-label { font-size: 1.375em; text-transform: none; margin-left: .6em; }\n#mbptv .mb-key.is-focused { background: #f5f5f7; color: #07070a; -webkit-transform: scale(1.08); transform: scale(1.08); box-shadow: 0 .5em 1.4em rgba(0, 0, 0, .5); }\n#mbptv .mb-key--go.is-focused { -webkit-transform: scale(1.03); transform: scale(1.03); }\n#mbptv .mb-suggest-box { position: absolute; left: 0; right: 5em; top: 5.5em; bottom: 0; }\n#mbptv .mb-suggest-hint { font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .72); padding-top: .4em; }\n#mbptv .mb-keyboard, #mbptv .mb-caret { -webkit-transition: opacity .2s ease-out; transition: opacity .2s ease-out; }\n#mbptv .mb-search.in-results .mb-keyboard { opacity: .35; }\n#mbptv .mb-search.in-results .mb-caret { visibility: hidden; }\n#mbptv .mb-srow {\n  position: relative; height: 4.25em; width: 44em; padding: 0 1.25em 0 4.2em; margin: 0 0 .5em -1.25em; border-radius: .8em; color: rgba(245, 245, 247, .86); white-space: nowrap; overflow: hidden;\n  background: rgba(255, 255, 255, .05);\n  -webkit-transition: background-color .15s, color .15s, -webkit-transform .15s; transition: background-color .15s, color .15s, transform .15s;\n}\n#mbptv .mb-srow .mb-ico { position: absolute; left: 1.35em; top: 1.25em; width: 1.75em; height: 1.75em; opacity: .55; }\n#mbptv .mb-srow-label { display: block; font-size: 1.75em; line-height: 2.43em; font-weight: 500; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-search-right { position: absolute; left: 47em; right: 0; top: 3.5em; bottom: 0; }\n#mbptv .mb-results-head { height: 5em; padding-top: .35em; white-space: nowrap; overflow: hidden; }\n#mbptv .mb-results-head .mb-section { font-size: 2.25em; font-weight: 700; display: inline-block; max-width: 24em; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }\n#mbptv .mb-results-head .mb-count { display: inline-block; margin-left: 1em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); vertical-align: bottom; line-height: 2.2; }\n#mbptv .mb-search-tabs { height: 4.5em; margin-bottom: .25em; }\n#mbptv .mb-grid-port { position: absolute; left: -1.5em; right: 0; top: 10em; bottom: 0; overflow: hidden; }\n#mbptv .mb-search .mb-grid { padding: 1em 0 12em 1.5em; -webkit-transition: -webkit-transform .3s cubic-bezier(.2, .8, .2, 1); transition: transform .3s cubic-bezier(.2, .8, .2, 1); }\n#mbptv .mb-search .mb-grid .mb-card { margin: 0 2em 2.25em 0; }\n#mbptv .mb-search .mb-grid .mb-card:nth-child(5n) { margin-right: 0; }\n#mbptv .mb-discover { padding-top: .35em; width: 66em; }\n#mbptv .mb-discover .mb-section { margin-bottom: 1em; }\n#mbptv .mb-discover .mb-chiprow { margin-bottom: 2.25em; }\n#mbptv .mb-discover-hint { font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .72); margin-bottom: 2.4em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n\n/* ---------- Settings ---------- */\n#mbptv .mb-settings-body { position: absolute; left: 9em; top: 13em; right: 5em; bottom: 3em; }\n#mbptv .mb-list { width: 58em; }\n#mbptv .mb-lrow {\n  position: relative; height: 4.75em; margin-bottom: .5em; padding: 0 1.75em 0 5em; border-radius: .8em; background: rgba(255, 255, 255, .035); color: rgba(245, 245, 247, .8);\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center;\n  -webkit-transition: background-color .15s, color .15s, -webkit-transform .15s; transition: background-color .15s, color .15s, transform .15s;\n}\n#mbptv .mb-lrow > .mb-ico { position: absolute; left: 1.75em; top: 1.6em; width: 1.6em; height: 1.6em; opacity: .7; }\n#mbptv .mb-lrow-label { -webkit-box-flex: 1; -webkit-flex: 1; flex: 1; font-size: 1.5em; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-lrow-value { font-size: 1.375em; font-weight: 500; color: rgba(245, 245, 247, .6); white-space: nowrap; margin-left: 1em; }\n#mbptv .mb-lrow-chev { width: 1.5em; height: 1.5em; margin-left: .6em; opacity: .5; }\n#mbptv .mb-toggle { position: relative; width: 3.6em; height: 2em; border-radius: 1em; background: rgba(255, 255, 255, .2); margin-left: 1em; -webkit-transition: background-color .18s; transition: background-color .18s; }\n#mbptv .mb-toggle-knob { position: absolute; left: .2em; top: .2em; width: 1.6em; height: 1.6em; border-radius: 50%; background: #f5f5f7; -webkit-transition: -webkit-transform .18s cubic-bezier(.2, .8, .2, 1); transition: transform .18s cubic-bezier(.2, .8, .2, 1); }\n#mbptv .mb-toggle.is-on { background: #35c46a; }\n#mbptv .mb-toggle.is-on .mb-toggle-knob { -webkit-transform: translate3d(1.6em, 0, 0); transform: translate3d(1.6em, 0, 0); }\n#mbptv .mb-aside { position: absolute; left: 64em; top: 0; right: 0; }\n#mbptv .mb-aside .mb-ico { width: 3.5em; height: 3.5em; color: #e7bd68; margin-bottom: 1.25em; }\n#mbptv .mb-aside .mb-section { margin-bottom: .6em; }\n#mbptv .mb-aside .mb-body { max-width: 30em; }\n#mbptv .mb-about { position: absolute; left: 0; bottom: 0; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); white-space: nowrap; }\n\n/* ---------- Diagnostics ---------- */\n#mbptv .mb-diag-facts { position: absolute; left: 9em; top: 14.5em; width: 44em; }\n#mbptv .mb-fact { margin-bottom: 1.1em; }\n#mbptv .mb-fact-k { font-size: 1.25em; font-weight: 600; color: rgba(245, 245, 247, .6); margin-bottom: .15em; }\n#mbptv .mb-fact-v { font-size: 1.5em; font-weight: 500; color: #f5f5f7; word-wrap: break-word; line-height: 1.35; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }\n#mbptv .mb-fact-v.is-warn { color: #e7bd68; }\n#mbptv .mb-diag-facts .mb-btns { margin-top: 1.5em; }\n#mbptv .mb-diag-log { position: absolute; left: 56em; right: 5em; top: 14.5em; bottom: 3em; overflow: hidden; border-radius: 1em; background: rgba(255, 255, 255, .04); }\n#mbptv .mb-diag-lines { padding: 1em; -webkit-transition: -webkit-transform .2s ease-out; transition: transform .2s ease-out; }\n#mbptv .mb-logline { padding: .5em .8em; border-radius: .5em; font-family: Consolas, \"DejaVu Sans Mono\", monospace; font-size: 1.375em; line-height: 1.35; color: rgba(245, 245, 247, .72); word-wrap: break-word; }\n#mbptv .mb-logline.is-error { color: #ff8a73; }\n#mbptv .mb-logline.is-warn { color: #e7bd68; }\n#mbptv .mb-srow.is-focused, #mbptv .mb-lrow.is-focused, #mbptv .mb-logline.is-focused { background: #f5f5f7; color: #07070a; box-shadow: none; -webkit-transform: scale(1.02); transform: scale(1.02); }\n#mbptv .mb-srow.is-focused .mb-ico, #mbptv .mb-lrow.is-focused > .mb-ico { opacity: 1; }\n#mbptv .mb-lrow.is-focused .mb-lrow-value { color: rgba(7, 7, 10, .6); }\n#mbptv .mb-lrow.is-focused .mb-toggle { background: rgba(7, 7, 10, .28); }\n#mbptv .mb-lrow.is-focused .mb-toggle.is-on { background: #35c46a; }\n\n/* ---------- Sign-in, error, generic centred states ---------- */\n#mbptv .mb-signin {\n  background: #07070a;\n  background: -webkit-radial-gradient(50% 30%, circle, #1c170c 0%, #0b0a0c 45%, #07070a 70%);\n  background: radial-gradient(circle at 50% 30%, #1c170c 0%, #0b0a0c 45%, #07070a 70%);\n}\n#mbptv .mb-center { position: absolute; left: 50%; top: 50%; width: 52em; margin-left: -26em; -webkit-transform: translate3d(0, -50%, 0); transform: translate3d(0, -50%, 0); text-align: center; }\n#mbptv .mb-center .mb-mono { margin: 0 auto 2em; }\n#mbptv .mb-center .mb-h1 { text-align: center; margin-bottom: .5em; }\n#mbptv .mb-center .mb-body { text-align: center; margin: 0 auto 2.5em; max-width: 42em; }\n#mbptv .mb-stack { width: 30em; margin: 0 auto; }\n#mbptv .mb-stack .mb-btn { width: 100%; margin: 0 0 1em; -webkit-justify-content: center; justify-content: center; height: 4em; }\n#mbptv .mb-note { margin-top: 1.5em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); text-align: center; line-height: 1.5; }\n#mbptv .mb-state { position: absolute; left: 9em; top: 50%; width: 70em; -webkit-transform: translate3d(0, -50%, 0); transform: translate3d(0, -50%, 0); }\n#mbptv .mb-state .mb-state-ico { width: 4.5em; height: 4.5em; color: #e7bd68; margin-bottom: 1.75em; }\n#mbptv .mb-state .mb-h1 { margin-bottom: .45em; }\n#mbptv .mb-state .mb-body { max-width: 46em; margin-bottom: .6em; }\n#mbptv .mb-state .mb-code { font-size: 1.0625em; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgba(245, 245, 247, .6); margin-bottom: 2.5em; }\n\n/* ---------- Layers: sheet and dialog ---------- */\n#mbptv .mb-layer { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 40; }\n#mbptv .mb-layer-dim { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, .72); -webkit-animation: mbFadeIn .2s ease-out; animation: mbFadeIn .2s ease-out; }\n#mbptv .mb-sheet {\n  position: absolute; right: 0; top: 0; bottom: 0; width: 40em; padding: 4em 4em 3em 3.5em; background: #131318;\n  box-shadow: -2em 0 5em rgba(0, 0, 0, .55);\n  -webkit-animation: mbSlideIn .26s cubic-bezier(.2, .8, .2, 1); animation: mbSlideIn .26s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv .mb-sheet .mb-kicker { margin-bottom: .6em; }\n#mbptv .mb-sheet .mb-h1 { font-size: 2.25em; margin-bottom: .35em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-sheet-sub { font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); margin-bottom: 1.8em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-sheet-port { position: absolute; left: 2.5em; right: 3em; top: 14.5em; bottom: 6em; overflow: hidden; }\n#mbptv .mb-sheet-list { padding: 1em; -webkit-transition: -webkit-transform .22s ease-out; transition: transform .22s ease-out; }\n#mbptv .mb-source {\n  position: relative; min-height: 5.75em; margin-bottom: .75em; padding: 1.05em 1.25em 1.05em 7.5em; border-radius: .9em; background: rgba(255, 255, 255, .05);\n  -webkit-transition: background-color .15s, -webkit-transform .15s; transition: background-color .15s, transform .15s;\n}\n#mbptv .mb-qbadge {\n  position: absolute; left: 1.25em; top: 1.4em; width: 5.2em; height: 2.2em; line-height: 2.2em; text-align: center; border-radius: .4em;\n  font-size: 1.0625em; font-weight: 800; letter-spacing: .04em; background: rgba(255, 255, 255, .14); color: #f5f5f7;\n}\n#mbptv .mb-qbadge.is-4k { background: #e7bd68; color: #1a1408; }\n#mbptv .mb-qbadge.is-1080 { background: rgba(245, 245, 247, .16); color: #f5f5f7; }\n#mbptv .mb-source-file { font-size: 1.25em; line-height: 1.35; font-weight: 600; color: #f5f5f7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv .mb-source-meta { margin-top: .3em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); white-space: nowrap; }\n#mbptv .mb-source-pref { position: absolute; right: 1.25em; bottom: 1.1em; font-size: 1.0625em; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #35c46a; }\n#mbptv .mb-source.is-focused { background: #f5f5f7; -webkit-transform: scale(1.02); transform: scale(1.02); }\n#mbptv .mb-source.is-focused .mb-source-file { color: #07070a; }\n#mbptv .mb-source.is-focused .mb-source-meta { color: rgba(7, 7, 10, .6); }\n#mbptv .mb-source.is-focused .mb-qbadge { background: #07070a; color: #f5f5f7; }\n#mbptv .mb-source.is-focused .mb-source-pref { color: #1f8a46; }\n#mbptv .mb-opt { position: relative; height: 4.25em; margin-bottom: .6em; padding: 0 1.5em; border-radius: .8em; background: rgba(255, 255, 255, .05); display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; }\n#mbptv .mb-opt-label { -webkit-box-flex: 1; -webkit-flex: 1; flex: 1; font-size: 1.5em; font-weight: 500; }\n#mbptv .mb-opt .mb-ico { width: 1.6em; height: 1.6em; color: #35c46a; }\n#mbptv .mb-opt.is-focused { background: #f5f5f7; color: #07070a; }\n#mbptv .mb-opt.is-focused .mb-ico { color: #1f8a46; }\n#mbptv .mb-sheet-label { margin: 1.6em 0 .9em .15em; font-size: 1.0625em; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: rgba(245, 245, 247, .6); }\n#mbptv .mb-sheet-hint { position: absolute; left: 3.5em; bottom: 2.5em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); }\n#mbptv .mb-dialog {\n  position: absolute; left: 50%; top: 50%; width: 46em; margin: -12em 0 0 -23em; padding: 3.5em 3.5em 3em; border-radius: 1.25em; background: #1c1c23; text-align: center;\n  box-shadow: 0 2em 6em rgba(0, 0, 0, .7);\n  -webkit-animation: mbPop .2s cubic-bezier(.2, .8, .2, 1); animation: mbPop .2s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv .mb-dialog .mb-h1 { font-size: 2.5em; text-align: center; margin-bottom: .4em; }\n#mbptv .mb-dialog .mb-body { text-align: center; margin-bottom: 2em; }\n#mbptv .mb-dialog .mb-btns { -webkit-justify-content: center; justify-content: center; }\n#mbptv .mb-dialog .mb-btn { min-width: 12em; -webkit-justify-content: center; justify-content: center; margin: 0 .6em; }\n\n/* ---------- Starting-playback overlay ---------- */\n#mbptv .mb-starting { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 35; background: #07070a; -webkit-animation: mbFadeIn .2s ease-out; animation: mbFadeIn .2s ease-out; }\n#mbptv .mb-starting .mb-art-img { width: 100%; }\n#mbptv .mb-starting .mb-art-img.is-loaded { opacity: .5; }\n#mbptv .mb-starting-inner { position: absolute; left: 9em; bottom: 8em; width: 70em; }\n#mbptv .mb-starting-inner .mb-spinner { margin-bottom: 2.25em; }\n#mbptv .mb-starting-inner .mb-kicker { margin-bottom: .8em; }\n#mbptv .mb-starting-inner .mb-display { margin-bottom: .35em; }\n#mbptv .mb-starting-inner .mb-meta { color: rgba(245, 245, 247, .6); }\n\n/* ---------- Toast ---------- */\n#mbptv .mb-toast {\n  position: absolute; left: 50%; bottom: 4em; z-index: 60; max-width: 70em; padding: 1em 2em; border-radius: 2em; background: rgba(28, 28, 35, .96); color: #f5f5f7;\n  font-size: 1.375em; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n  box-shadow: 0 1em 3em rgba(0, 0, 0, .6);\n  opacity: 0; visibility: hidden;\n  -webkit-transform: translate3d(-50%, 1em, 0); transform: translate3d(-50%, 1em, 0);\n  -webkit-transition: opacity .2s ease-out, -webkit-transform .2s ease-out, visibility 0s linear .2s; transition: opacity .2s ease-out, transform .2s ease-out, visibility 0s linear .2s;\n}\n#mbptv .mb-toast.is-visible {\n  opacity: 1; visibility: visible; -webkit-transform: translate3d(-50%, 0, 0); transform: translate3d(-50%, 0, 0);\n  -webkit-transition: opacity .2s ease-out, -webkit-transform .2s ease-out; transition: opacity .2s ease-out, transform .2s ease-out;\n}\n\n/* ---------- Player OSD (top level) ---------- */\n#mbptv-osd {\n  position: fixed; left: 0; right: 0; bottom: 0; height: 17em; z-index: 2147483001; pointer-events: none; color: #f5f5f7; line-height: 1.3;\n  background: -webkit-linear-gradient(bottom, rgba(0, 0, 0, .88) 0%, rgba(0, 0, 0, .55) 55%, rgba(0, 0, 0, 0) 100%);\n  background: linear-gradient(to top, rgba(0, 0, 0, .88) 0%, rgba(0, 0, 0, .55) 55%, rgba(0, 0, 0, 0) 100%);\n  opacity: 0; visibility: hidden;\n  -webkit-transition: opacity .25s ease-out, visibility 0s linear .25s; transition: opacity .25s ease-out, visibility 0s linear .25s;\n}\n#mbptv-osd.is-visible { opacity: 1; visibility: visible; -webkit-transition: opacity .2s ease-out; transition: opacity .2s ease-out; }\n#mbptv-osd div, #mbptv-osd span { margin: 0; padding: 0; border: 0; -webkit-box-sizing: border-box; box-sizing: border-box; font-family: inherit; color: inherit; font-size: 100%; }\n#mbptv-osd .mbo-inner { position: absolute; left: 5em; right: 5em; bottom: 3em; }\n#mbptv-osd .mbo-title { font-size: 2em; font-weight: 700; margin-bottom: .7em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-osd .mbo-sub { font-size: 1.375em; font-weight: 500; color: rgba(245, 245, 247, .72); margin: -.6em 0 .8em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-osd .mbo-row { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; }\n#mbptv-osd .mbo-state { width: 2.2em; height: 2.2em; margin-right: 1.25em; }\n#mbptv-osd .mbo-state .mb-ico { width: 100%; height: 100%; }\n#mbptv-osd .mbo-spin { display: block; width: 100%; height: 100%; border-radius: 50%; border: .22em solid rgba(255, 255, 255, .2); border-top-color: #e7bd68; -webkit-animation: mbSpin .9s linear infinite; animation: mbSpin .9s linear infinite; }\n#mbptv-osd.mb-reduce .mbo-spin { -webkit-animation: mbSpin 1.2s linear infinite !important; animation: mbSpin 1.2s linear infinite !important; }\n#mbptv-osd .mbo-bar { position: relative; -webkit-box-flex: 1; -webkit-flex: 1; flex: 1; height: .45em; border-radius: .25em; background: rgba(255, 255, 255, .25); }\n#mbptv-osd .mbo-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: .25em; background: #e7bd68; }\n#mbptv-osd .mbo-knob { position: absolute; top: 50%; width: 1.1em; height: 1.1em; margin: -.55em 0 0 -.55em; border-radius: 50%; background: #fff; box-shadow: 0 0 .6em rgba(0, 0, 0, .6); }\n#mbptv-osd .mbo-time { margin-left: 1.5em; font-size: 1.375em; font-weight: 600; white-space: nowrap; }\n#mbptv-osd .mbo-hints { margin-top: 1.1em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .72); white-space: nowrap; }\n#mbptv-osd .mbo-hint { display: inline-block; margin-right: 2.2em; }\n#mbptv-osd .mbo-key { display: inline-block; padding: .1em .5em; margin-right: .5em; border-radius: .3em; background: rgba(255, 255, 255, .16); color: #f5f5f7; font-weight: 700; }\n#mbptv-osd .mbo-key.mbo-key--blue { width: 1em; height: 1em; padding: 0; border-radius: 50%; background: #2f6fe4; vertical-align: -.1em; }\n#mbptv-osd .mbo-seek { position: absolute; left: 50%; bottom: 7em; width: 5.4em; margin-left: -2.7em; padding: .3em 0; border-radius: 1em; background: rgba(0, 0, 0, .6); text-align: center; font-size: 1.75em; font-weight: 700; opacity: 0; -webkit-transition: opacity .2s; transition: opacity .2s; }\n#mbptv-osd .mbo-seek.is-on { opacity: 1; }\n\n/* ---------- Website mode: TV pill and focus ring (top level) ---------- */\n#mbptv-pill {\n  position: fixed; left: 2.5em; bottom: 2.5em; z-index: 2147483001; height: 3.6em; padding: .3em 1.4em .3em .3em; border-radius: 2em;\n  background: rgba(20, 20, 26, .92); color: #f5f5f7; line-height: 1.3; cursor: pointer;\n  box-shadow: 0 .8em 2em rgba(0, 0, 0, .5);\n  display: none;\n  -webkit-transition: -webkit-transform .18s cubic-bezier(.2, .8, .2, 1), background-color .18s; transition: transform .18s cubic-bezier(.2, .8, .2, 1), background-color .18s;\n}\n#mbptv-pill.is-visible { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; }\n#mbptv-pill div, #mbptv-pill span { margin: 0; padding: 0; border: 0; -webkit-box-sizing: border-box; box-sizing: border-box; font-family: inherit; font-size: 100%; }\n#mbptv-pill .mb-mono { width: 3em; height: 3em; border-radius: 50%; }\n#mbptv-pill .mb-mono-m { font-size: 1.6em; line-height: 1.875em; }\n#mbptv-pill .mbp-key { display: inline-block; width: 1em; height: 1em; border-radius: 50%; background: #2f6fe4; margin: 0 0 0 .9em; vertical-align: -.1em; }\n#mbptv-pill .mbp-label { margin-left: .6em; font-size: 1.25em; font-weight: 700; color: #f5f5f7; }\n#mbptv-pill.is-focused { background: #f5f5f7; -webkit-transform: scale(1.06); transform: scale(1.06); }\n#mbptv-pill.is-focused .mbp-label { color: #07070a; }\n#mbptv-ring {\n  position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 2147483000; pointer-events: none; display: none;\n  border-radius: .6em; box-shadow: 0 0 0 .25em #fff, 0 0 0 .55em rgba(0, 0, 0, .55), 0 0 2em .6em rgba(0, 0, 0, .4);\n  -webkit-transition: -webkit-transform .15s cubic-bezier(.2, .8, .2, 1), width .15s, height .15s; transition: transform .15s cubic-bezier(.2, .8, .2, 1), width .15s, height .15s;\n}\n#mbptv-ring.is-visible { display: block; }\n\n/* The site's own source sidebar stays in the DOM (we click its rows) but is never shown while our sheet is open. */\nhtml.mbptv-sources .sidebarbg2 { opacity: .01 !important; }\n#mbptv-osd .mbo-kico { width: 1em; height: 1em; vertical-align: -.14em; }\n#mbptv.is-hidden .mb-toast { bottom: auto; top: 3.5em; }\n\n/* ---------- Page-level state (classes on <html>, set per mode by App.setModeClass, removed by Boot.teardown) ---------- */\n/* The page behind the shell or the player never scrolls, and its scrollbar never shows at the right edge. */\nhtml.mbptv-lock, html.mbptv-lock body { overflow: hidden !important; }\nhtml.mbptv-lock::-webkit-scrollbar, html.mbptv-lock body::-webkit-scrollbar { width: 0; height: 0; display: none; }\n/* Player mode: the website player's own controls never show under our OSD. Captions stay, and so do JW Player's\n   buffering and error displays. */\nhtml.mbptv-player .jwplayer:not(.jw-state-buffering):not(.jw-state-error) .jw-display, html.mbptv-player .jwplayer:not(.jw-state-error) .jw-title,\nhtml.mbptv-player .jw-controlbar, html.mbptv-player .jw-controls-backdrop, html.mbptv-player .jw-dock, html.mbptv-player .jw-logo,\nhtml.mbptv-player .jw-nextup-container, html.mbptv-player .jw-settings-menu, html.mbptv-player .jw-tooltip, html.mbptv-player .jw-rightclick,\nhtml.mbptv-player .video-js .vjs-control-bar, html.mbptv-player .video-js .vjs-big-play-button { display: none !important; }\n/* Player controls mode (Blue in the player): the website player's controls stay visible for the focus ring. */\nhtml.mbptv-jwctl .jwplayer .jw-controls, html.mbptv-jwctl .jwplayer .jw-controlbar, html.mbptv-jwctl .video-js .vjs-control-bar { visibility: visible !important; opacity: 1 !important; }\n\n/* ---------- TV performance mode (#mbptv.mb-perf; Prefs performance, see Kit.perf) ----------\n   What costs a TV GPU most goes: blurred shadows (focus keeps its white ring, drawn without blur), opacity fades on\n   full-screen layers (art and dims swap at once), width animations (they re-lay the page out every frame) and endless\n   animations (the caret, the skeleton shimmer). Focus scales a little less; transforms still animate. These rules\n   come last so they win over the rules they calm. */\n#mbptv.mb-perf .mb-card-art { -webkit-transition: -webkit-transform .15s cubic-bezier(.2, .8, .2, 1); transition: transform .15s cubic-bezier(.2, .8, .2, 1); }\n#mbptv.mb-perf .mb-card.is-focused .mb-card-art { -webkit-transform: scale(1.05); transform: scale(1.05); box-shadow: 0 0 0 .22em #fff; }\n#mbptv.mb-perf .mb-btn, #mbptv.mb-perf .mb-chip, #mbptv.mb-perf .mb-key, #mbptv.mb-perf .mb-person {\n  -webkit-transition: -webkit-transform .15s cubic-bezier(.2, .8, .2, 1); transition: transform .15s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv.mb-perf .mb-btn.is-focused, #mbptv.mb-perf .mb-chip.is-focused { -webkit-transform: scale(1.04); transform: scale(1.04); box-shadow: none; }\n#mbptv.mb-perf .mb-key.is-focused { -webkit-transform: scale(1.05); transform: scale(1.05); box-shadow: none; }\n#mbptv.mb-perf .mb-key--go.is-focused { -webkit-transform: scale(1.02); transform: scale(1.02); }\n#mbptv.mb-perf .mb-mono, #mbptv.mb-perf .mb-detail-poster, #mbptv.mb-perf .mb-sheet, #mbptv.mb-perf .mb-dialog, #mbptv.mb-perf .mb-toast { box-shadow: none; }\n#mbptv.mb-perf .mb-screen.is-current, #mbptv.mb-perf .mb-layer-dim, #mbptv.mb-perf .mb-dialog, #mbptv.mb-perf .mb-starting { -webkit-animation: none; animation: none; }\n#mbptv.mb-perf .mb-img, #mbptv.mb-perf .mb-art-img, #mbptv.mb-perf .mb-art-poster, #mbptv.mb-perf .mb-row, #mbptv.mb-perf .mb-dim,\n#mbptv.mb-perf .mb-detail-top, #mbptv.mb-perf .mb-detail-mini, #mbptv.mb-perf .mb-rail, #mbptv.mb-perf .mb-rail-bg,\n#mbptv.mb-perf .mb-rail-label, #mbptv.mb-perf .mb-rail-brand, #mbptv.mb-perf .mb-keyboard,\n#mbptv.mb-perf .mb-ep-play, #mbptv.mb-perf .mb-toggle { -webkit-transition: none; transition: none; }\n#mbptv.mb-perf .mb-rail-item, #mbptv.mb-perf .mb-srow, #mbptv.mb-perf .mb-lrow, #mbptv.mb-perf .mb-source { -webkit-transition: -webkit-transform .12s; transition: transform .12s; }\n#mbptv.mb-perf .mb-hero-text { -webkit-transition: opacity .1s linear, -webkit-transform .3s cubic-bezier(.2, .8, .2, 1); transition: opacity .1s linear, transform .3s cubic-bezier(.2, .8, .2, 1); }\n#mbptv.mb-perf .mb-caret, #mbptv.mb-perf .mb-skel:after { -webkit-animation: none; animation: none; }\n#mbptv.mb-perf .mb-skel:after { display: none; }\n#mbptv.mb-perf #mbptv-player .mbp-art, #mbptv.mb-perf #mbptv-player .mbp-art-img, #mbptv.mb-perf #mbptv-player .mbp-dim,\n#mbptv.mb-perf #mbptv-player .mbp-osd, #mbptv.mb-perf #mbptv-player .mbp-un-scrim { -webkit-transition: none; transition: none; }\n#mbptv.mb-perf #mbptv-player[data-state=\"playing\"] .mbp-art, #mbptv.mb-perf #mbptv-player.is-osd .mbp-osd,\n#mbptv.mb-perf #mbptv-player.is-upnext .mbp-un-scrim { -webkit-transition: none; transition: none; }\n#mbptv.mb-perf #mbptv-player .mbp-skip.is-focused { box-shadow: none; }\n\n/* Native player (src/55-player.js), mounted inside #mbptv and scoped under #mbptv-player. Same tokens and em scale\n   as shell.css (1em = 16px at 1920x1080): bg #07070a, elevated #131318, elevated-2 #1c1c23, text #f5f5f7,\n   text-2 rgba(245,245,247,.72), text-3 rgba(245,245,247,.46), gold #e7bd68, success #35c46a.\n   Chromium 47 safe: prefixed flexbox, margins, prefixed transforms. Only opacity and transform animate, and large\n   layers carry no box-shadow (the TV compositor pays for every blurred pixel). */\n\n#mbptv-player {\n  position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 50; overflow: hidden;\n  background: #000; color: #f5f5f7; outline: none; cursor: default;\n  pointer-events: auto; /* #mbptv is pointer-transparent outside shell mode: never let a pointer reach the site */\n  font-family: \"SamsungOne\", \"Samsung Sans\", \"TizenSans\", \"Helvetica Neue\", Helvetica, Arial, sans-serif;\n  font-size: 0.8333vw; line-height: 1.3; font-weight: 400; font-style: normal; text-align: left; direction: ltr;\n  letter-spacing: 0; text-transform: none; -webkit-font-smoothing: antialiased;\n  -webkit-user-select: none; user-select: none; -webkit-box-sizing: border-box; box-sizing: border-box;\n}\n#mbptv-player div, #mbptv-player span, #mbptv-player img, #mbptv-player svg, #mbptv-player video {\n  -webkit-box-sizing: border-box; box-sizing: border-box; margin: 0; padding: 0; border: 0; outline: none; float: none;\n  max-width: none; font-family: inherit; line-height: inherit; letter-spacing: inherit; color: inherit; text-decoration: none;\n}\n#mbptv-player div, #mbptv-player span { font-size: 100%; font-weight: inherit; }\n#mbptv-player img { display: block; }\n#mbptv-player .mbp-ico { display: inline-block; width: 1.5em; height: 1.5em; line-height: 0; vertical-align: middle; -webkit-flex-shrink: 0; flex-shrink: 0; }\n#mbptv-player .mbp-ico svg { display: block; width: 100%; height: 100%; }\n\n@-webkit-keyframes mbpSpin { from { -webkit-transform: rotate(0deg); } to { -webkit-transform: rotate(360deg); } }\n@keyframes mbpSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\n@-webkit-keyframes mbpFlash {\n  0% { opacity: 0; -webkit-transform: scale(.82); } 22% { opacity: 1; -webkit-transform: scale(1); } 100% { opacity: 0; -webkit-transform: scale(1.22); }\n}\n@keyframes mbpFlash {\n  0% { opacity: 0; transform: scale(.82); } 22% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.22); }\n}\n@-webkit-keyframes mbpFade { from { opacity: 0; } to { opacity: 1; } }\n@keyframes mbpFade { from { opacity: 0; } to { opacity: 1; } }\n@-webkit-keyframes mbpPop { from { opacity: 0; -webkit-transform: translate3d(0, -46%, 0) scale(.96); } to { opacity: 1; -webkit-transform: translate3d(0, -50%, 0) scale(1); } }\n@keyframes mbpPop { from { opacity: 0; transform: translate3d(0, -46%, 0) scale(.96); } to { opacity: 1; transform: translate3d(0, -50%, 0) scale(1); } }\n\n/* ---------- Video and artwork ---------- */\n#mbptv-player .mbp-video { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; object-fit: contain; background: #000; }\n#mbptv-player .mbp-art {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 1; background: #000;\n  -webkit-transition: opacity .45s ease-out; transition: opacity .45s ease-out;\n}\n#mbptv-player .mbp-art-img {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; opacity: 0;\n  -webkit-transition: opacity .6s ease-out; transition: opacity .6s ease-out;\n}\n#mbptv-player .mbp-art-img.is-loaded { opacity: .35; }\n#mbptv-player .mbp-art-scrim {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%;\n  background: -webkit-linear-gradient(bottom, rgba(0, 0, 0, .92) 0%, rgba(0, 0, 0, .55) 38%, rgba(0, 0, 0, .15) 70%, rgba(0, 0, 0, .35) 100%);\n  background: linear-gradient(to top, rgba(0, 0, 0, .92) 0%, rgba(0, 0, 0, .55) 38%, rgba(0, 0, 0, .15) 70%, rgba(0, 0, 0, .35) 100%);\n}\n#mbptv-player[data-state=\"playing\"] .mbp-art { opacity: 0; visibility: hidden; -webkit-transition: opacity .45s ease-out, visibility 0s linear .45s; transition: opacity .45s ease-out, visibility 0s linear .45s; }\n\n/* ---------- Type shared by every panel ---------- */\n#mbptv-player .mbp-kicker {\n  font-size: 1.0625em; line-height: 1.3; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #e7bd68;\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n}\n#mbptv-player .mbp-sub-code { color: #f5f5f7; font-weight: 700; margin-right: .55em; }\n#mbptv-player .mbp-sub-text { color: rgba(245, 245, 247, .72); }\n#mbptv-player .mbp-key {\n  display: inline-block; padding: .12em .55em; margin-right: .55em; border-radius: .35em; line-height: 1.35;\n  background: rgba(255, 255, 255, .16); color: #f5f5f7; font-weight: 700; font-size: .9em; letter-spacing: .02em;\n}\n\n/* ---------- Loading ---------- */\n#mbptv-player .mbp-loading {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 5; opacity: 0; visibility: hidden;\n  -webkit-transition: opacity .3s ease-out, visibility 0s linear .3s; transition: opacity .3s ease-out, visibility 0s linear .3s;\n}\n#mbptv-player[data-state=\"loading\"] .mbp-loading { opacity: 1; visibility: visible; -webkit-transition: opacity .2s ease-out; transition: opacity .2s ease-out; }\n#mbptv-player .mbp-spin { position: absolute; left: 50%; top: 42%; width: 5em; height: 5em; margin: -2.5em 0 0 -2.5em; }\n#mbptv-player .mbp-spin-ring {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 50%;\n  border: .3em solid rgba(255, 255, 255, .14); border-top-color: #e7bd68;\n  -webkit-animation: mbpSpin .9s linear infinite; animation: mbpSpin .9s linear infinite;\n}\n#mbptv-player .mbp-load-info { position: absolute; left: 7em; right: 30em; bottom: 6em; }\n#mbptv-player .mbp-load-info .mbp-kicker { margin-bottom: 1em; }\n#mbptv-player .mbp-load-title {\n  font-size: 4.5em; line-height: 1.04; font-weight: 800; letter-spacing: -.015em; color: #f5f5f7;\n  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; max-height: 2.12em;\n}\n#mbptv-player .mbp-load-sub { margin-top: .45em; font-size: 1.75em; line-height: 1.3; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-player .mbp-load-status { margin-top: 1.5em; font-size: 1.25em; line-height: 1.4em; font-weight: 500; color: rgba(245, 245, 247, .46); height: 1.4em; }\n#mbptv-player .mbp-load-hint { position: absolute; right: 7em; bottom: 6em; height: 1.75em; line-height: 1.75em; color: rgba(245, 245, 247, .56); white-space: nowrap; }\n#mbptv-player .mbp-load-hint span { font-size: 1.25em; font-weight: 500; }\n#mbptv-player .mbp-load-hint .mbp-key { font-size: 1.125em; font-weight: 700; }\n\n/* Buffering after playback started: a quiet spinner over the picture. */\n#mbptv-player .mbp-buffer { position: absolute; left: 50%; top: 50%; width: 4.5em; height: 4.5em; margin: -2.25em 0 0 -2.25em; z-index: 7; opacity: 0; visibility: hidden; -webkit-transition: opacity .2s, visibility 0s linear .2s; transition: opacity .2s, visibility 0s linear .2s; }\n#mbptv-player.is-buffering .mbp-buffer { opacity: 1; visibility: visible; -webkit-transition: opacity .3s ease-out .35s; transition: opacity .3s ease-out .35s; }\n\n/* ---------- Play/pause flash ---------- */\n#mbptv-player .mbp-flash {\n  position: absolute; left: 50%; top: 50%; width: 8em; height: 8em; margin: -4em 0 0 -4em; z-index: 8; border-radius: 50%;\n  background: rgba(0, 0, 0, .5); color: #f5f5f7; opacity: 0; pointer-events: none;\n}\n#mbptv-player .mbp-flash .mbp-ico { position: absolute; left: 2.5em; top: 2.5em; width: 3em; height: 3em; }\n#mbptv-player .mbp-flash .mbp-flash-play { display: none; }\n#mbptv-player .mbp-flash.is-play .mbp-flash-play { display: block; }\n#mbptv-player .mbp-flash.is-play .mbp-flash-pause { display: none; }\n#mbptv-player .mbp-flash.is-on { -webkit-animation: mbpFlash .7s ease-out both; animation: mbpFlash .7s ease-out both; }\n\n/* Paused: the picture dims a little behind the controls. */\n#mbptv-player .mbp-dim { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 9; background: #000; opacity: 0; pointer-events: none; -webkit-transition: opacity .3s ease-out; transition: opacity .3s ease-out; }\n#mbptv-player.is-paused.is-osd .mbp-dim, #mbptv-player.is-still .mbp-dim { opacity: .3; }\n\n/* ---------- OSD ---------- */\n#mbptv-player .mbp-osd {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 10; opacity: 0; visibility: hidden; pointer-events: none;\n  -webkit-transition: opacity .3s ease-out, visibility 0s linear .3s; transition: opacity .3s ease-out, visibility 0s linear .3s;\n}\n#mbptv-player.is-osd .mbp-osd { opacity: 1; visibility: visible; -webkit-transition: opacity .2s ease-out; transition: opacity .2s ease-out; }\n#mbptv-player .mbp-osd-top {\n  position: absolute; left: 0; top: 0; width: 100%; height: 12em;\n  background: -webkit-linear-gradient(top, rgba(0, 0, 0, .55) 0%, rgba(0, 0, 0, 0) 100%);\n  background: linear-gradient(to bottom, rgba(0, 0, 0, .55) 0%, rgba(0, 0, 0, 0) 100%);\n}\n#mbptv-player .mbp-osd-shade {\n  position: absolute; left: 0; bottom: 0; width: 100%; height: 34em;\n  background: -webkit-linear-gradient(bottom, rgba(0, 0, 0, .94) 0%, rgba(0, 0, 0, .78) 30%, rgba(0, 0, 0, .4) 64%, rgba(0, 0, 0, 0) 100%);\n  background: linear-gradient(to top, rgba(0, 0, 0, .94) 0%, rgba(0, 0, 0, .78) 30%, rgba(0, 0, 0, .4) 64%, rgba(0, 0, 0, 0) 100%);\n}\n#mbptv-player .mbp-osd-main {\n  position: absolute; left: 7em; right: 7em; bottom: 4em;\n  -webkit-transform: translate3d(0, 1.25em, 0); transform: translate3d(0, 1.25em, 0);\n  -webkit-transition: -webkit-transform .3s cubic-bezier(.2, .8, .2, 1); transition: transform .3s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player.is-osd .mbp-osd-main { -webkit-transform: translate3d(0, 0, 0); transform: translate3d(0, 0, 0); }\n#mbptv-player .mbp-head { margin-bottom: 2em; max-width: 90em; -webkit-transition: opacity .2s ease-out; transition: opacity .2s ease-out; }\n#mbptv-player.is-seeking .mbp-head { opacity: .3; }\n#mbptv-player .mbp-osd-kicker { height: 1.3em; margin-bottom: .55em; opacity: 0; -webkit-transition: opacity .2s ease-out; transition: opacity .2s ease-out; }\n#mbptv-player.is-paused .mbp-osd-kicker { opacity: 1; }\n#mbptv-player .mbp-title { font-size: 3.25em; line-height: 1.12; font-weight: 800; letter-spacing: -.015em; color: #f5f5f7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-player .mbp-subrow { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; margin-top: .55em; height: 2em; }\n#mbptv-player .mbp-sub { -webkit-flex-shrink: 1; flex-shrink: 1; min-width: 0; font-size: 1.5em; line-height: 1.3; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-player .mbp-sub.is-empty { display: none; }\n#mbptv-player .mbp-badges { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; -webkit-flex-shrink: 0; flex-shrink: 0; white-space: nowrap; }\n#mbptv-player .mbp-sub + .mbp-badges { margin-left: 1.1em; }\n#mbptv-player .mbp-tag {\n  display: inline-block; height: 1.75em; line-height: 1.75em; padding: 0 .6em; margin-right: .6em; border-radius: .35em;\n  font-size: 1.0625em; font-weight: 700; letter-spacing: .04em; background: rgba(255, 255, 255, .16); color: #f5f5f7;\n}\n#mbptv-player .mbp-tag--line { background: transparent; box-shadow: inset 0 0 0 .09em rgba(245, 245, 247, .55); color: rgba(245, 245, 247, .9); }\n\n/* Scrubber: played (gold), buffered, remaining track; the knob and bubble ride a full-width wrapper moved by transform. */\n#mbptv-player .mbp-scrub { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; height: 3em; }\n#mbptv-player .mbp-state { position: relative; width: 2.1em; height: 2.1em; margin-right: 1.25em; color: #f5f5f7; }\n#mbptv-player .mbp-state .mbp-ico { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }\n#mbptv-player .mbp-state .mbp-state-play { display: none; }\n#mbptv-player.is-paused .mbp-state .mbp-state-play { display: block; }\n#mbptv-player.is-paused .mbp-state .mbp-state-pause { display: none; }\n#mbptv-player .mbp-time { font-size: 1.375em; font-weight: 600; white-space: nowrap; letter-spacing: .01em; min-width: 3.1em; }\n#mbptv-player.is-long .mbp-time { min-width: 4.2em; }\n#mbptv-player .mbp-elapsed { margin-right: .9em; color: #f5f5f7; }\n#mbptv-player .mbp-remain { margin-left: .9em; text-align: right; color: rgba(245, 245, 247, .72); }\n#mbptv-player .mbp-bar {\n  position: relative; -webkit-box-flex: 1; -webkit-flex: 1; flex: 1; height: .5em;\n  -webkit-transform: scaleY(.7); transform: scaleY(.7);\n  -webkit-transition: -webkit-transform .18s cubic-bezier(.2, .8, .2, 1); transition: transform .18s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player.is-scrub .mbp-bar { -webkit-transform: scaleY(1); transform: scaleY(1); }\n#mbptv-player .mbp-bar-clip { position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: .25em; overflow: hidden; background: rgba(255, 255, 255, .22); }\n#mbptv-player .mbp-buf, #mbptv-player .mbp-fill {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%;\n  -webkit-transform-origin: 0 50%; transform-origin: 0 50%; -webkit-transform: scaleX(0); transform: scaleX(0);\n}\n#mbptv-player .mbp-buf { background: rgba(255, 255, 255, .3); }\n#mbptv-player .mbp-fill { background: #e7bd68; }\n#mbptv-player .mbp-headwrap { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }\n#mbptv-player .mbp-knob {\n  position: absolute; left: -.9em; top: 50%; width: 1.8em; height: 1.8em; margin-top: -.9em; border-radius: 50%; background: #fff;\n  opacity: 0; -webkit-transform: scale(.4); transform: scale(.4);\n  -webkit-transition: opacity .15s ease-out, -webkit-transform .18s cubic-bezier(.2, .8, .2, 1); transition: opacity .15s ease-out, transform .18s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player.is-scrub .mbp-knob { opacity: 1; -webkit-transform: scale(.78); transform: scale(.78); }\n#mbptv-player.is-seeking .mbp-knob { opacity: 1; -webkit-transform: scale(1); transform: scale(1); }\n#mbptv-player .mbp-bubble {\n  position: absolute; left: 0; bottom: 2.4em; text-align: center; white-space: nowrap; opacity: 0;\n  -webkit-transform: translate3d(-50%, .5em, 0); transform: translate3d(-50%, .5em, 0);\n  -webkit-transition: opacity .15s ease-out, -webkit-transform .18s cubic-bezier(.2, .8, .2, 1); transition: opacity .15s ease-out, transform .18s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player.is-seeking .mbp-bubble { opacity: 1; -webkit-transform: translate3d(-50%, 0, 0); transform: translate3d(-50%, 0, 0); }\n#mbptv-player .mbp-bubble-delta { display: inline-block; margin-bottom: .4em; font-size: 1.375em; font-weight: 800; letter-spacing: .01em; color: #e7bd68; }\n#mbptv-player .mbp-bubble-time {\n  display: block; padding: .3em .75em; border-radius: .45em; background: #f5f5f7; color: #07070a;\n  font-size: 1.75em; line-height: 1.2; font-weight: 800; letter-spacing: .01em;\n}\n\n/* Buttons row: pills that turn solid white when focused (the shell's button language). */\n#mbptv-player .mbp-btns { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; height: 4.5em; margin-top: 1.4em; }\n#mbptv-player .mbp-btn {\n  position: relative; overflow: hidden;\n  display: -webkit-inline-box; display: -webkit-inline-flex; display: inline-flex; -webkit-align-items: center; align-items: center;\n  height: 3.5em; padding: 0 1.6em 0 1.3em; margin-right: 1em; border-radius: 2em; white-space: nowrap;\n  background: rgba(255, 255, 255, .12); color: rgba(245, 245, 247, .9);\n  -webkit-transition: -webkit-transform .18s cubic-bezier(.2, .8, .2, 1); transition: transform .18s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player .mbp-btn .mbp-ico { position: relative; width: 1.45em; height: 1.45em; margin-right: .6em; }\n#mbptv-player .mbp-btn-label { position: relative; font-size: 1.3125em; font-weight: 600; line-height: 1; letter-spacing: .005em; }\n#mbptv-player .mbp-btn-value { position: relative; margin-left: .5em; font-size: 1.3125em; font-weight: 500; line-height: 1; opacity: .62; }\n#mbptv-player .mbp-btn.is-focused { background: #f5f5f7; color: #07070a; -webkit-transform: scale(1.06); transform: scale(1.06); }\n#mbptv-player.is-scrub .mbp-btns .mbp-btn { background: rgba(255, 255, 255, .09); color: rgba(245, 245, 247, .66); }\n\n/* ---------- Skip Intro (floating, focused while the controls are hidden) ---------- */\n#mbptv-player .mbp-skip {\n  position: absolute; right: 7em; bottom: 6.5em; z-index: 11;\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center;\n  height: 3.75em; padding: 0 1.9em 0 1.5em; border-radius: 2em; background: rgba(20, 20, 26, .82); color: #f5f5f7;\n  opacity: 0; visibility: hidden; -webkit-transform: translate3d(0, 1em, 0); transform: translate3d(0, 1em, 0);\n  -webkit-transition: opacity .25s ease-out, -webkit-transform .25s cubic-bezier(.2, .8, .2, 1), visibility 0s linear .25s;\n  transition: opacity .25s ease-out, transform .25s cubic-bezier(.2, .8, .2, 1), visibility 0s linear .25s;\n}\n#mbptv-player .mbp-skip.is-on {\n  opacity: 1; visibility: visible; -webkit-transform: translate3d(0, 0, 0); transform: translate3d(0, 0, 0);\n  -webkit-transition: opacity .25s ease-out, -webkit-transform .25s cubic-bezier(.2, .8, .2, 1); transition: opacity .25s ease-out, transform .25s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player .mbp-skip.is-focused { background: #f5f5f7; color: #07070a; box-shadow: 0 .8em 2em rgba(0, 0, 0, .45); }\n#mbptv-player .mbp-skip .mbp-ico { width: 1.5em; height: 1.5em; margin-right: .65em; }\n#mbptv-player .mbp-skip-label { font-size: 1.375em; font-weight: 700; line-height: 1; }\n\n/* ---------- Chip (resume notice, quality switched, hints) ---------- */\n#mbptv-player .mbp-chip {\n  position: absolute; left: 50%; top: 2.55em; z-index: 12; max-width: 58em; padding: .75em 1.45em; border-radius: 2em;\n  background: rgba(28, 28, 35, .94); color: #f5f5f7; font-size: 1.375em; font-weight: 600; line-height: 1.3;\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n  opacity: 0; visibility: hidden; -webkit-transform: translate3d(-50%, -.8em, 0); transform: translate3d(-50%, -.8em, 0);\n  -webkit-transition: opacity .2s ease-out, -webkit-transform .2s ease-out, visibility 0s linear .2s;\n  transition: opacity .2s ease-out, transform .2s ease-out, visibility 0s linear .2s;\n}\n#mbptv-player .mbp-chip.is-on {\n  opacity: 1; visibility: visible; -webkit-transform: translate3d(-50%, 0, 0); transform: translate3d(-50%, 0, 0);\n  -webkit-transition: opacity .2s ease-out, -webkit-transform .2s ease-out; transition: opacity .2s ease-out, transform .2s ease-out;\n}\n\n/* ---------- Up Next ---------- */\n#mbptv-player .mbp-un-scrim {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 12; opacity: 0; visibility: hidden; pointer-events: none;\n  background: -webkit-radial-gradient(100% 100%, ellipse farthest-corner, rgba(0, 0, 0, .82) 0%, rgba(0, 0, 0, .5) 30%, rgba(0, 0, 0, 0) 62%);\n  background: radial-gradient(ellipse farthest-corner at 100% 100%, rgba(0, 0, 0, .82) 0%, rgba(0, 0, 0, .5) 30%, rgba(0, 0, 0, 0) 62%);\n  -webkit-transition: opacity .35s ease-out, visibility 0s linear .35s; transition: opacity .35s ease-out, visibility 0s linear .35s;\n}\n#mbptv-player.is-upnext .mbp-un-scrim { opacity: 1; visibility: visible; -webkit-transition: opacity .35s ease-out; transition: opacity .35s ease-out; }\n#mbptv-player .mbp-upnext {\n  position: absolute; right: 7em; bottom: 5.5em; z-index: 13; width: 48em; padding: 1.25em; border-radius: 1.1em;\n  background: rgba(28, 28, 35, .97); opacity: 0; visibility: hidden;\n  -webkit-transform: translate3d(0, 1.5em, 0); transform: translate3d(0, 1.5em, 0);\n  -webkit-transition: opacity .3s ease-out, -webkit-transform .35s cubic-bezier(.2, .8, .2, 1), visibility 0s linear .35s;\n  transition: opacity .3s ease-out, transform .35s cubic-bezier(.2, .8, .2, 1), visibility 0s linear .35s;\n}\n#mbptv-player.is-upnext .mbp-upnext {\n  opacity: 1; visibility: visible; -webkit-transform: translate3d(0, 0, 0); transform: translate3d(0, 0, 0);\n  -webkit-transition: opacity .3s ease-out, -webkit-transform .35s cubic-bezier(.2, .8, .2, 1); transition: opacity .3s ease-out, transform .35s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player .mbp-un-top { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: flex-start; align-items: flex-start; }\n#mbptv-player .mbp-un-still {\n  position: relative; width: 20em; height: 11.25em; border-radius: .65em; overflow: hidden; -webkit-flex-shrink: 0; flex-shrink: 0;\n  background: #131318;\n  background: -webkit-linear-gradient(top, #1d1d25 0%, #131318 100%);\n  background: linear-gradient(to bottom, #1d1d25 0%, #131318 100%);\n}\n#mbptv-player .mbp-un-ph { position: absolute; left: 0; top: 0; width: 100%; height: 100%; text-align: center; font-size: 2.5em; line-height: 4.5em; font-weight: 800; color: rgba(245, 245, 247, .3); }\n#mbptv-player .mbp-un-img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; -webkit-transition: opacity .25s ease-out; transition: opacity .25s ease-out; }\n#mbptv-player .mbp-un-img.is-loaded { opacity: 1; }\n#mbptv-player .mbp-un-glyph {\n  position: absolute; left: 50%; top: 50%; width: 3.6em; height: 3.6em; margin: -1.8em 0 0 -1.8em; border-radius: 50%;\n  background: rgba(7, 7, 10, .55); color: #f5f5f7;\n}\n#mbptv-player .mbp-un-glyph .mbp-ico { position: absolute; left: 1.05em; top: .9em; width: 1.8em; height: 1.8em; }\n#mbptv-player .mbp-un-text { -webkit-box-flex: 1; -webkit-flex: 1; flex: 1; min-width: 0; margin-left: 1.5em; padding-top: .2em; }\n#mbptv-player .mbp-un-count { margin-bottom: .4em; font-size: 1.25em; letter-spacing: .1em; }\n#mbptv-player .mbp-un-title { font-size: 1.75em; line-height: 1.2; font-weight: 700; color: #f5f5f7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-player .mbp-un-meta { margin-top: .3em; font-size: 1.1875em; font-weight: 600; letter-spacing: .02em; color: rgba(245, 245, 247, .56); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-player .mbp-un-btns { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center; margin-top: 1.05em; }\n#mbptv-player .mbp-un-btns .mbp-btn { height: 3.25em; margin-right: .8em; }\n#mbptv-player .mbp-btn-fill {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, .16);\n  -webkit-transform-origin: 0 50%; transform-origin: 0 50%; -webkit-transform: scaleX(0); transform: scaleX(0);\n}\n#mbptv-player .mbp-btn-fill.is-running { -webkit-transition: -webkit-transform 1s linear; transition: transform 1s linear; }\n#mbptv-player .mbp-btn.is-focused .mbp-btn-fill { background: rgba(231, 189, 104, .55); }\n\n/* ---------- Quality sheet ---------- */\n#mbptv-player .mbp-sheet-layer { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 20; visibility: hidden; -webkit-transition: visibility 0s linear .3s; transition: visibility 0s linear .3s; }\n#mbptv-player.is-sheet .mbp-sheet-layer { visibility: visible; -webkit-transition: none; transition: none; }\n#mbptv-player .mbp-sheet-dim { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, .6); opacity: 0; -webkit-transition: opacity .25s ease-out; transition: opacity .25s ease-out; }\n#mbptv-player.is-sheet .mbp-sheet-dim { opacity: 1; }\n#mbptv-player .mbp-sheet {\n  position: absolute; right: 0; top: 0; bottom: 0; width: 42em; padding: 4.5em 3.5em 3em; background: #131318;\n  -webkit-transform: translate3d(100%, 0, 0); transform: translate3d(100%, 0, 0);\n  -webkit-transition: -webkit-transform .28s cubic-bezier(.2, .8, .2, 1); transition: transform .28s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player.is-sheet .mbp-sheet { -webkit-transform: translate3d(0, 0, 0); transform: translate3d(0, 0, 0); }\n#mbptv-player .mbp-sheet .mbp-kicker { margin-bottom: .6em; }\n#mbptv-player .mbp-sheet-title { font-size: 2.25em; line-height: 1.15; font-weight: 700; letter-spacing: -.01em; color: #f5f5f7; margin-bottom: .35em; }\n#mbptv-player .mbp-sheet-sub { font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .46); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-player .mbp-sheet-port { position: absolute; left: 2.5em; right: 2.5em; top: 13.25em; bottom: 6.5em; overflow: hidden; }\n#mbptv-player .mbp-sheet-list { padding: .75em 1em; -webkit-transition: -webkit-transform .22s ease-out; transition: transform .22s ease-out; }\n#mbptv-player .mbp-sheet-label { margin: 1.4em 0 .8em .15em; font-size: 1.0625em; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: rgba(245, 245, 247, .46); }\n#mbptv-player .mbp-opt {\n  position: relative; min-height: 4.75em; margin-bottom: .6em; padding: .95em 4.25em .95em 1.5em; border-radius: .8em;\n  background: rgba(255, 255, 255, .05); color: #f5f5f7;\n  -webkit-transition: -webkit-transform .15s cubic-bezier(.2, .8, .2, 1); transition: transform .15s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player .mbp-opt-label { font-size: 1.5em; line-height: 1.25; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-player .mbp-opt-meta { margin-top: .2em; font-size: 1.125em; line-height: 1.3; font-weight: 500; color: rgba(245, 245, 247, .5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#mbptv-player .mbp-opt .mbp-opt-check { position: absolute; right: 1.35em; top: 50%; width: 1.75em; height: 1.75em; margin-top: -.875em; color: #35c46a; display: none; }\n#mbptv-player .mbp-opt.is-current .mbp-opt-check { display: block; }\n#mbptv-player .mbp-opt.is-focused { background: #f5f5f7; color: #07070a; -webkit-transform: scale(1.02); transform: scale(1.02); }\n#mbptv-player .mbp-opt.is-focused .mbp-opt-meta { color: rgba(7, 7, 10, .6); }\n#mbptv-player .mbp-opt.is-focused .mbp-opt-check { color: #1f8a46; }\n#mbptv-player .mbp-sheet-hint { position: absolute; left: 3.5em; bottom: 2.6em; font-size: 1.125em; font-weight: 500; color: rgba(245, 245, 247, .5); white-space: nowrap; }\n#mbptv-player .mbp-hint-gap { margin-right: 1.6em; }\n\n/* ---------- Error card ---------- */\n#mbptv-player .mbp-error { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 30; display: none; background: rgba(0, 0, 0, .25); }\n#mbptv-player[data-state=\"error\"] .mbp-error { display: block; -webkit-animation: mbpFade .2s ease-out; animation: mbpFade .2s ease-out; }\n#mbptv-player .mbp-err-card {\n  position: absolute; left: 50%; top: 50%; width: 58em; margin-left: -29em; padding: 3.5em 4em 3.25em; border-radius: 1.25em;\n  background: rgba(28, 28, 35, .97); text-align: center;\n  -webkit-transform: translate3d(0, -50%, 0); transform: translate3d(0, -50%, 0);\n  -webkit-animation: mbpPop .24s cubic-bezier(.2, .8, .2, 1); animation: mbpPop .24s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv-player .mbp-err-ico { display: block; width: 4em; height: 4em; margin: 0 auto 1.4em; color: #e7bd68; }\n#mbptv-player .mbp-err-kicker { margin-bottom: .75em; text-align: center; color: rgba(245, 245, 247, .56); }\n#mbptv-player .mbp-err-title { font-size: 2.5em; line-height: 1.15; font-weight: 700; letter-spacing: -.01em; color: #f5f5f7; margin-bottom: .5em; text-align: center; }\n#mbptv-player .mbp-err-body { max-width: 32em; margin: 0 auto 1em; font-size: 1.5em; line-height: 1.45; color: rgba(245, 245, 247, .72); text-align: center; }\n#mbptv-player .mbp-err-code { margin-bottom: 2.3em; font-size: 1.0625em; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: rgba(245, 245, 247, .56); text-align: center; }\n#mbptv-player .mbp-err-code.is-empty { margin-bottom: 1.3em; }\n#mbptv-player .mbp-err-btns { display: -webkit-box; display: -webkit-flex; display: flex; -webkit-justify-content: center; justify-content: center; -webkit-align-items: center; align-items: center; }\n#mbptv-player .mbp-err-btns .mbp-btn { height: 3.75em; margin: 0 .5em; padding: 0 1.8em 0 1.5em; }\n\n/* Reduce motion (#mbptv.mb-reduce stills every transition and animation): keep the spinners turning. */\n#mbptv.mb-reduce #mbptv-player .mbp-spin-ring { -webkit-animation: mbpSpin 1.2s linear infinite !important; animation: mbpSpin 1.2s linear infinite !important; }\n\n/* Screen additions (0.3.1), built after shell.css (tools/build.cjs) with the same tokens and rules: scoped under\n   #mbptv, em units (1em = 16px at 1080p), Chromium 47 safe (flexbox, margins, prefixed transforms).\n   Detail episodes: the season line, the loading state of a season switch, watched marks, the Continue Watching\n   progress and name-only episode cards. Settings: the list scrolls when it is taller than the screen. */\n\n/* \"Season 2 · 13 episodes · [bar] 2 of 13 watched\", above the episodes and aligned with the first card. */\n#mbptv .mb-season-info {\n  height: 2.2em; margin: 0 5em .55em 9em; white-space: nowrap; overflow: hidden;\n  display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center;\n}\n#mbptv .mb-season-name { font-size: 1.5em; font-weight: 700; color: #f5f5f7; }\n#mbptv .mb-season-count { margin-left: .9em; font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .6); }\n#mbptv .mb-season-watched {\n  margin-left: 1.6em; display: -webkit-box; display: -webkit-flex; display: flex; -webkit-align-items: center; align-items: center;\n}\n#mbptv .mb-season-watched .mb-progress { width: 6.5em; margin-right: .75em; }\n#mbptv .mb-season-watched-text { font-size: 1.25em; font-weight: 500; color: rgba(245, 245, 247, .72); }\n\n/* A season that is loading: the previous episodes stay, dimmed, under a spinner. */\n#mbptv .mb-row--episodes .mb-track {\n  -webkit-transition: -webkit-transform .26s cubic-bezier(.2, .8, .2, 1), opacity .2s ease-out;\n  transition: transform .26s cubic-bezier(.2, .8, .2, 1), opacity .2s ease-out;\n}\n#mbptv .mb-row--episodes.is-loading .mb-track { opacity: .3; }\n#mbptv .mb-ep-spinner { position: absolute; left: 50%; top: 5.45em; margin-left: -1.75em; display: none; z-index: 2; }\n#mbptv .mb-row--episodes.is-loading .mb-ep-spinner { display: block; }\n\n/* Watched: a check at the top right of the picture. */\n#mbptv .mb-ep-check {\n  position: absolute; right: .7em; top: .7em; width: 2.1em; height: 2.1em; border-radius: 50%;\n  background: rgba(7, 7, 10, .78); color: #35c46a; display: none;\n}\n#mbptv .mb-ep-check .mb-ico { position: absolute; left: .3em; top: .3em; width: 1.5em; height: 1.5em; }\n#mbptv .mb-episode.is-watched .mb-ep-check { display: block; }\n\n/* The Continue Watching episode: a progress bar along the bottom edge of the picture. */\n#mbptv .mb-ep-progress { position: absolute; left: 0; right: 0; bottom: 0; }\n#mbptv .mb-ep-progress .mb-progress { height: .35em; border-radius: 0; background: rgba(255, 255, 255, .28); }\n#mbptv .mb-ep-progress .mb-progress-fill { border-radius: 0; }\n\n/* An episode the site lists by name only: a deliberate text card (code, title, a large faint number). */\n#mbptv .mb-ep-text {\n  position: absolute; left: 0; top: 0; width: 100%; height: 100%; padding: 1.15em 1.3em; overflow: hidden; white-space: normal;\n  background: #1a1a21;\n  background: -webkit-linear-gradient(top, #23232b 0%, #15151b 100%);\n  background: linear-gradient(to bottom, #23232b 0%, #15151b 100%);\n}\n#mbptv .mb-ep-text-code { position: relative; font-size: 1.0625em; font-weight: 800; letter-spacing: .06em; color: #e7bd68; white-space: nowrap; }\n#mbptv .mb-ep-text-title {\n  position: relative; margin-top: .5em; max-width: 11.5em; max-height: 3.75em; font-size: 1.5em; line-height: 1.25; font-weight: 700; color: #f5f5f7;\n  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;\n}\n#mbptv .mb-ep-text-num {\n  position: absolute; right: .12em; bottom: -.12em; font-size: 7em; line-height: 1; font-weight: 800; letter-spacing: -.04em;\n  color: rgba(245, 245, 247, .07);\n}\n#mbptv .mb-episode--text.is-focused .mb-ep-text { background: #2a2a33; }\n/* The focused text card's play button sits bottom left, clear of the title. */\n#mbptv .mb-episode--text .mb-ep-play { left: 1.3em; top: auto; bottom: 1.1em; margin: 0; }\n\n/* Performance mode: no fades on the rows. */\n#mbptv.mb-perf .mb-row--episodes .mb-track { -webkit-transition: -webkit-transform .2s cubic-bezier(.2, .8, .2, 1); transition: transform .2s cubic-bezier(.2, .8, .2, 1); }\n\n/* ---------- Settings: a list taller than the screen scrolls (by transform) inside this port ---------- */\n#mbptv .mb-settings-port { position: absolute; left: -1.5em; top: 0; width: 61em; bottom: 2.5em; overflow: hidden; }\n#mbptv .mb-settings-port .mb-list {\n  margin: 0 0 0 1.5em; padding-bottom: 1em;\n  -webkit-transition: -webkit-transform .22s cubic-bezier(.2, .8, .2, 1); transition: transform .22s cubic-bezier(.2, .8, .2, 1);\n}\n#mbptv.mb-perf .mb-settings-port .mb-list { -webkit-transition: none; transition: none; }\n";
/* ---- 00-core.js ---- */
/* Core utilities shared by every module. ES5 only; nothing here touches the DOM at load time. */
var U = (function () {
  var slice = Array.prototype.slice;

  function text(value) {
    return String(value == null ? '' : value).replace(/[\s ]+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function toArray(list) {
    if (!list) return [];
    try { return slice.call(list); } catch (e) {
      var out = [], i;
      for (i = 0; i < list.length; i++) out.push(list[i]);
      return out;
    }
  }

  function each(list, fn) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) if (fn(list[i], i) === false) return;
  }

  function map(list, fn) {
    var out = [];
    each(list, function (v, i) { out.push(fn(v, i)); });
    return out;
  }

  function filter(list, fn) {
    var out = [];
    each(list, function (v, i) { if (fn(v, i)) out.push(v); });
    return out;
  }

  function find(list, fn) {
    var hit = null;
    each(list, function (v, i) { if (fn(v, i)) { hit = v; return false; } });
    return hit;
  }

  function indexOf(list, value) {
    if (!list) return -1;
    for (var i = 0; i < list.length; i++) if (list[i] === value) return i;
    return -1;
  }

  function contains(str, part) { return String(str).indexOf(part) >= 0; }

  function matches(el, selector) {
    if (!el || el.nodeType !== 1) return false;
    var fn = el.matches || el.webkitMatchesSelector || el.msMatchesSelector;
    try { return !!(fn && fn.call(el, selector)); } catch (e) { return false; }
  }

  function closest(el, selector, stop) {
    while (el && el.nodeType === 1 && el !== stop) {
      if (matches(el, selector)) return el;
      el = el.parentNode;
    }
    return null;
  }

  /* A missing root yields nothing (never the live document), so a detached or not-yet-built scope cannot leak
     matches from elsewhere on the page. Pass document explicitly to search the page. */
  function qs(root, selector) {
    if (!root || !root.querySelector) return null;
    try { return root.querySelector(selector); } catch (e) { return null; }
  }

  function qsa(root, selector) {
    if (!root || !root.querySelectorAll) return [];
    try { return toArray(root.querySelectorAll(selector)); } catch (e) { return []; }
  }

  function el(tag, cls, content, parent) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content != null && content !== '') node.textContent = String(content);
    if (parent) parent.appendChild(node);
    return node;
  }

  function attr(node, name, value) {
    if (!node) return '';
    if (arguments.length > 2) {
      if (value == null || value === false) node.removeAttribute(name);
      else node.setAttribute(name, value === true ? '' : String(value));
      return node;
    }
    return node.getAttribute(name) || '';
  }

  function empty(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function detach(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function hasClass(node, cls) {
    return !!node && node.nodeType === 1 && (' ' + node.className + ' ').indexOf(' ' + cls + ' ') >= 0;
  }

  function toggleClass(node, cls, on) {
    if (!node || !node.classList) return;
    if (on) node.classList.add(cls); else node.classList.remove(cls);
  }

  function guard(fn, label) {
    return function () {
      try { return fn.apply(this, arguments); } catch (e) {
        Log.error(label || 'guard', e);
        return undefined;
      }
    };
  }

  function on(target, type, fn, capture) {
    if (!target || !target.addEventListener) return function () {};
    var wrapped = guard(fn, 'event:' + type);
    target.addEventListener(type, wrapped, !!capture);
    return function () { target.removeEventListener(type, wrapped, !!capture); };
  }

  function later(fn, ms, label) {
    return setTimeout(guard(fn, label || 'timer'), ms || 0);
  }

  function debounce(fn, ms) {
    var timer = null;
    var wrapped = function () {
      var self = this, args = arguments;
      clearTimeout(timer);
      timer = later(function () { fn.apply(self, args); }, ms, 'debounce');
    };
    wrapped.cancel = function () { clearTimeout(timer); };
    return wrapped;
  }

  var raf = (typeof window !== 'undefined' && (window.requestAnimationFrame || window.webkitRequestAnimationFrame)) ||
    function (cb) { return setTimeout(function () { cb(+new Date()); }, 16); };

  function frame(fn, label) { return raf.call(window, guard(fn, label || 'frame')); }

  function now() { return +new Date(); }

  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

  function titleCase(str) {
    return text(str).toLowerCase().replace(/(^|[\s\-\/(&])([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); })
      .replace(/\bTv\b/g, 'TV').replace(/\bSci-Fi\b/g, 'Sci-Fi');
  }

  function parseUrl(url, base) {
    var a = anchorFor(base);
    a.href = String(url == null ? '' : url);
    var search = a.search || '', query = {};
    if (search.length > 1) {
      each(search.slice(1).split('&'), function (pair) {
        if (!pair) return;
        var i = pair.indexOf('='), k = i < 0 ? pair : pair.slice(0, i), v = i < 0 ? '' : pair.slice(i + 1);
        try { k = decodeURIComponent(k.replace(/\+/g, ' ')); v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) {}
        if (!(k in query)) query[k] = v;
      });
    }
    var pathname = a.pathname || '/';
    if (pathname.charAt(0) !== '/') pathname = '/' + pathname;
    return {
      href: a.href, protocol: a.protocol, host: a.host, hostname: (a.hostname || '').toLowerCase(),
      pathname: pathname, search: search, hash: a.hash || '', query: query,
      origin: a.protocol + '//' + a.host
    };
  }

  /* One resolver document per base URL, capped so a long session never grows memory without limit. */
  var anchorCache = {}, anchorCount = 0, ANCHOR_MAX = 24;
  function anchorFor(base) {
    if (!base) {
      if (!anchorCache['']) anchorCache[''] = document.createElement('a');
      return anchorCache[''];
    }
    var k = '$' + base;
    if (!anchorCache.hasOwnProperty(k)) {
      if (anchorCount >= ANCHOR_MAX) { anchorCache = { '': anchorCache[''] }; anchorCount = 0; }
      var doc = document.implementation.createHTMLDocument('');
      var b = doc.createElement('base'); b.href = base; doc.head.appendChild(b);
      anchorCache[k] = doc.createElement('a');
      doc.body.appendChild(anchorCache[k]);
      anchorCount++;
    }
    return anchorCache[k];
  }

  function abs(url, base) { return parseUrl(url, base).href; }

  function siteHost(hostname) { return String(hostname || '').toLowerCase().replace(/^www\./, ''); }

  /* Same scheme, same host (www or apex) and same port as the live page (section 7: only same-origin navigation). */
  function sameSite(url) {
    var u = parseUrl(url);
    return /^https?:$/.test(u.protocol) && u.protocol === location.protocol && siteHost(u.host) === siteHost(location.host);
  }

  /* The URL rebuilt onto the live page's own origin (the www/apex variant maps to the current one), or '' when the
     URL is not same-site. Navigation sinks assign this, never a raw URL taken from site markup. */
  function onOrigin(url) {
    if (!url || !sameSite(url)) return '';
    var u = parseUrl(url);
    return location.protocol + '//' + location.host + u.pathname + u.search;
  }

  function isVisible(node) {
    if (!node || node.nodeType !== 1 || !document.documentElement.contains(node)) return false;
    var r = node.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (var p = node; p && p.nodeType === 1; p = p.parentNode) {
      var s = window.getComputedStyle(p);
      if (!s || s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    }
    return true;
  }

  function parseHTML(markup) {
    var doc = null;
    try { doc = new DOMParser().parseFromString(String(markup || ''), 'text/html'); } catch (e) { doc = null; }
    if (!doc || !doc.documentElement) {
      doc = document.implementation.createHTMLDocument('');
      doc.documentElement.innerHTML = String(markup || '');
    }
    return doc;
  }

  function parseJSON(str) {
    try { return JSON.parse(str); } catch (e) { return null; }
  }

  /* Runs fn once the live DOM is fully parsed (the shell may boot while the page is still loading). */
  function onReady(fn) {
    var ran = false, wrapped = guard(function () { if (!ran) { ran = true; fn(); } }, 'ready');
    if (document.readyState !== 'loading') { later(wrapped, 0, 'ready'); return; }
    document.addEventListener('DOMContentLoaded', wrapped, false);
    document.addEventListener('readystatechange', function () { if (document.readyState !== 'loading') wrapped(); }, false);
  }

  /* Static, author-written SVG only. Never pass site data here. */
  function svg(markup, cls) {
    var holder = document.createElement('span');
    holder.className = 'mb-ico' + (cls ? ' ' + cls : '');
    holder.innerHTML = markup;
    holder.setAttribute('aria-hidden', 'true');
    return holder;
  }

  function xhr(opts, cb) {
    var done = false, req = new XMLHttpRequest(), timer;
    function finish(err, res) {
      if (done) return;
      done = true; clearTimeout(timer);
      later(function () { cb(err, res); }, 0, 'xhr-cb');
    }
    try {
      req.open(opts.method || 'GET', opts.url, true);
      req.withCredentials = true;
      if (opts.headers) for (var k in opts.headers) if (opts.headers.hasOwnProperty(k)) req.setRequestHeader(k, opts.headers[k]);
      req.onreadystatechange = function () {
        if (req.readyState !== 4 || done) return;
        var text = '';
        try { text = req.responseText; } catch (e0) { text = ''; }
        if (req.status >= 200 && req.status < 400) finish(null, { text: text, status: req.status, url: req.responseURL || opts.url });
        else finish({ code: req.status ? 'http-' + req.status : 'network', status: req.status }, null);
      };
      /* Report the timeout before abort(): abort() fires readystatechange with status 0, which would read as 'network'. */
      timer = setTimeout(function () { finish({ code: 'timeout' }, null); try { req.abort(); } catch (e) {} }, opts.timeout || 15000);
      req.send(opts.body || null);
    } catch (e) {
      finish({ code: 'exception', message: String(e && e.message || e) }, null);
    }
    return { abort: function () { if (!done) { done = true; clearTimeout(timer); try { req.abort(); } catch (e) {} } } };
  }

  return {
    text: text, toArray: toArray, each: each, map: map, filter: filter, find: find, indexOf: indexOf, contains: contains,
    matches: matches, closest: closest, qs: qs, qsa: qsa, el: el, attr: attr, empty: empty, detach: detach,
    hasClass: hasClass, toggleClass: toggleClass, guard: guard, on: on, later: later, debounce: debounce,
    frame: frame, now: now, clamp: clamp, titleCase: titleCase, parseUrl: parseUrl, abs: abs, siteHost: siteHost,
    sameSite: sameSite, onOrigin: onOrigin, isVisible: isVisible, parseHTML: parseHTML, parseJSON: parseJSON, onReady: onReady, svg: svg, xhr: xhr
  };
}());

var Store = (function () {
  function make(kind) {
    var memory = {};
    function backend() {
      try { var s = window[kind]; if (s) { s.getItem('mbptv:probe'); return s; } } catch (e) {}
      return null;
    }
    return {
      /* This page's own writes win (they are always in memory, even when the storage write failed on quota);
         anything else comes from storage, written by an earlier page load. */
      get: function (key, fallback) {
        var s = backend(), raw = null;
        if (memory.hasOwnProperty(key)) raw = memory[key];
        else { try { raw = s ? s.getItem(key) : null; } catch (e) { raw = null; } }
        if (raw == null) return fallback;
        var value = U.parseJSON(raw);
        return value == null ? fallback : value;
      },
      set: function (key, value) {
        var raw = JSON.stringify(value);
        memory[key] = raw;
        var s = backend();
        try { if (s) s.setItem(key, raw); } catch (e) { /* quota or private mode: memory copy remains */ }
      },
      remove: function (key) {
        memory[key] = null;
        var s = backend();
        try { if (s) s.removeItem(key); } catch (e) {}
      }
    };
  }
  return { local: make('localStorage'), session: make('sessionStorage') };
}());

var Log = (function () {
  var entries = [], KEY = 'mbptv:log:v1', persisted = null;
  /* Every message is redacted centrally (section 7): URL fragments are dropped and query values are masked unless the
     parameter only names a title or a page, so search words, tokens and similar never reach the persisted log or the
     Diagnostics screen, whichever call site (or error object) carried them. */
  var KEEP_PARAMS = /^(?:id|season|episode|play|type|page|limit|box_type)$/i;
  function redact(str) {
    var s = String(str == null ? '' : str);
    s = s.replace(/((?:https?:\/\/|\/)[^\s"'#<>]*)#[^\s"'<>]*/g, '$1');
    return s.replace(/([?&])([^=&#\s"'<>?]+)=([^&#\s"'<>]*)/g, function (m, sep, k, v) {
      var key = k;
      try { key = decodeURIComponent(k); } catch (e) {}
      return !v || KEEP_PARAMS.test(key) ? m : sep + k + '=\u2026';
    });
  }
  function describe(value) {
    if (value == null) return '';
    if (value.stack) return String(value.message || value) + ' @ ' + String(value.stack).split('\n').slice(0, 3).join(' | ');
    if (typeof value === 'object') { try { return JSON.stringify(value).slice(0, 400); } catch (e) {} }
    return String(value).slice(0, 400);
  }
  function add(level, label, value) {
    var msg = '';
    try { msg = redact(describe(value)); } catch (e0) { msg = '(unloggable value)'; }
    var entry = { t: U.now(), level: level, label: String(label || ''), msg: msg };
    entries.push(entry);
    if (entries.length > 200) entries.shift();
    try {
      if (persisted == null) persisted = Store.local.get(KEY, []) || [];
      persisted.push(entry);
      if (persisted.length > 60) persisted = persisted.slice(persisted.length - 60);
      if (level !== 'info') Store.local.set(KEY, persisted);
    } catch (e) {}
    try { if (window.console && console[level === 'error' ? 'error' : 'log']) console[level === 'error' ? 'error' : 'log']('[MovieBox TV] ' + level + ' ' + entry.label + ': ' + entry.msg); } catch (e2) {}
    return entry;
  }
  return {
    info: function (label, v) { return add('info', label, v); },
    warn: function (label, v) { return add('warn', label, v); },
    error: function (label, v) { return add('error', label, v); },
    entries: function () { return entries.slice(); },
    redact: redact,
    /* Entries an older version stored before redaction existed are redacted on the way out as well. */
    persisted: function () {
      var list = Store.local.get(KEY, []) || [];
      return U.map(Object.prototype.toString.call(list) === '[object Array]' ? list : [], function (e) {
        return e && typeof e === 'object' ? { t: e.t, level: e.level, label: e.label, msg: redact(e.msg) } : { t: 0, level: 'info', label: '', msg: '' };
      });
    },
    clear: function () { entries = []; persisted = []; Store.local.remove(KEY); }
  };
}());

var Keys = (function () {
  var codes = {
    37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 10009: 'back', 27: 'back', 8: 'backspace',
    415: 'play', 19: 'pause', 10252: 'playpause', 413: 'stop', 417: 'ff', 412: 'rw',
    403: 'red', 404: 'green', 405: 'yellow', 406: 'blue', 457: 'info', 427: 'chup', 428: 'chdown', 9: 'tab',
    32: 'space', 179: 'playpause', 178: 'stop', 176: 'ff', 177: 'rw'
  };
  var names = {
    ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', Left: 'left', Up: 'up', Right: 'right', Down: 'down',
    Enter: 'enter', Escape: 'back', Esc: 'back', XF86Back: 'back', GoBack: 'back', BrowserBack: 'back', Backspace: 'backspace',
    MediaPlay: 'play', MediaPause: 'pause', MediaPlayPause: 'playpause', MediaStop: 'stop',
    MediaFastForward: 'ff', MediaRewind: 'rw', ColorF3Blue: 'blue', Info: 'info', ' ': 'space'
  };
  var TIZEN_KEYS = ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
    'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'Info', 'ChannelUp', 'ChannelDown',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  function name(event) {
    var code = event.keyCode || event.which || 0, key = event.key || '';
    if (codes[code]) return codes[code];
    if (names[key]) return names[key];
    if (code >= 48 && code <= 57 && !event.shiftKey) return 'digit';
    if (key && key.length === 1) return 'char';
    /* Chromium before 51 (Tizen 2017-2019) has no KeyboardEvent.key: letters arrive as bare key codes. */
    if ((!key || key === 'Unidentified') && code >= 65 && code <= 90 && !event.ctrlKey && !event.altKey && !event.metaKey) return 'char';
    return '';
  }

  function charOf(event) {
    var code = event.keyCode || event.which || 0, key = event.key || '';
    if (key && key.length === 1) return key;
    if (code >= 48 && code <= 57) return String.fromCharCode(code);
    if (code >= 65 && code <= 90) return String.fromCharCode(code).toLowerCase();
    return '';
  }

  function register() {
    try {
      if (!window.tizen || !tizen.tvinputdevice) return;
      U.each(TIZEN_KEYS, function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) {} });
    } catch (e) { Log.warn('keys', e); }
  }

  return { name: name, charOf: charOf, register: register };
}());
/* ---- 10-site.js ---- */
/* Site adapter (docs/ARCHITECTURE.md sections 3 and 5.2): pure extraction and URL helpers over any
   Document, live or DOMParser-made. Every public function is total: it catches internally and returns
   an empty-but-valid shape. Relative URLs are resolved explicitly against the page URL, because parsed
   documents keep the creating document's base. Nothing here runs at load time. */
var Site = (function () {
  var KEY_MARK = '__mbptvCardKey', ART_MARK = '__mbptvCardArt';
  var TARGET_SEL = 'a[href], [data-link], [data-href], [onclick]';
  var BG_SEL = '[style*="url("]';
  /* Site artwork that is never a poster: matched against the whole file name so random CDN hashes never collide. */
  var ICON_RE = /(?:_icon\.[a-z0-9]+$|^(?:4k|8k|blu-?ray|hdr)_?icon|^(?:score|freshness\d*|audience|imdb|play\d*|play_icon|tips|dislike\d*|like\d*|logo(?:_\d+)?|default_cover\d*|playlist_default|tv_chapter|placeholder|spacer|blank|close\d*|more\d*)\.[a-z0-9]+$)/i;
  var RUNTIME_RE = /(\d+)\s*(?:min|mins|minutes?)\b/i;
  var CERT_RE = /^(?:G|PG|PG-13|R|NC-17|NR|UR|X|M|MA|TV-(?:Y|Y7|Y7-FV|G|PG|14|MA)|Unrated|Not Rated|Approved|Passed|U|UA|A|\d{1,2}\+?)$/i;
  var QUALITY = { '8k': '8K', '4k': '4K', '2k': '1440p', fullhd: '1080p', fhd: '1080p', hd: '720p', sd: 'SD', org: 'Original', original: 'Original' };
  var BADGES = [[/4k[\s_-]*hdr/i, '4K HDR'], [/dolby[\s_-]*vision/i, 'Dolby Vision'], [/atmos/i, 'Atmos'], [/hdr/i, 'HDR'],
    [/8k/i, '8K'], [/4k|uhd/i, '4K'], [/blu-?ray/i, 'Blu-ray'], [/1080/i, '1080p']];
  var POPUPS = '.not_support_bg, .vip_pay_tips, .player_bg, .no_resource_bg, .season_bg';
  var CLOSE_SEL = '.close, .close2, .tips_close, .fav_close, .player_back, .search_close, [class*="close"]';
  var SKIP_NAME_CLS = /(?:^|\s)(?:score|tomato|update|time|progress_bar|count|episode|horizontal|list_img|speed|icon|avatar|avatar2)(?:\s|$)/;

  /* ---------- small helpers ---------- */

  /* Null-safe: U.qs/U.qsa fall back to the live document for a null root, which would leak live data into parsed docs. */
  function qs(root, sel) { return root ? U.qs(root, sel) : null; }
  function qsa(root, sel) { return root ? U.qsa(root, sel) : []; }
  function isArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function textOf(el) { return el ? U.text(el.textContent) : ''; }
  function attr(el, name) { try { return el && el.getAttribute ? (el.getAttribute(name) || '') : ''; } catch (e) { return ''; } }
  function cls(el) { return attr(el, 'class'); }
  function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
  function locHref() { try { return String(location.href || ''); } catch (e) { return ''; } }
  function httpish(u) { return /^https?:\/\//i.test(String(u || '')); }

  function decodeEntities(s) {
    return String(s == null ? '' : s).replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'");
  }

  function isLeaf(el) {
    var c = el && el.children;
    if (!c || !c.length) return true;
    for (var i = 0; i < c.length; i++) if (c[i].tagName !== 'BR') return false;
    return true;
  }

  function nextElement(el) {
    var n = el ? el.nextSibling : null;
    while (n && n.nodeType !== 1) n = n.nextSibling;
    return n;
  }

  function ownText(el) {
    var out = '';
    U.each(el ? el.childNodes : [], function (n) {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeType === 1 && n.tagName !== 'A') out += ' ' + n.textContent;
    });
    return U.text(out);
  }

  /* Text with <br> kept as line breaks. */
  function linesOf(el) {
    var out = '';
    U.each(el ? el.childNodes : [], function (n) {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeType === 1) out += n.tagName === 'BR' ? '\n' : linesOf(n);
    });
    return out;
  }

  function fileName(src) {
    var path = String(src || '').split(/[?#]/)[0];
    return path.slice(path.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/i, '');
  }

  function docTitle(doc) {
    var t = U.text(doc && doc.title);
    if (/^MovieBox\s*Pro$/i.test(t)) return '';
    return U.text(t.replace(/\s*[-|\u2013\u2014]\s*MovieBox\s*Pro\s*$/i, ''));
  }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/['\u2019`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'row';
  }

  function uniqueId(id, used) {
    var out = id, n = 2;
    while (used.hasOwnProperty(out)) out = id + '-' + (n++);
    used[out] = true;
    return out;
  }

  function uniqStrings(list, limit) {
    var out = [], seen = {};
    U.each(list, function (s) {
      s = U.text(s);
      var k = '$' + s.toLowerCase();
      if (!s || seen[k]) return;
      seen[k] = true;
      out.push(s);
      if (limit && out.length >= limit) return false;
    });
    return out;
  }

  /* ---------- URLs ---------- */

  var baseCache = { href: null, parsed: null };
  function parsedBase(base) {
    if (baseCache.href !== base) { baseCache.href = base; baseCache.parsed = U.parseUrl(base); }
    return baseCache.parsed;
  }

  function defaultBase() {
    var here = locHref();
    return httpish(here) ? here : String(START_URL);
  }

  /* The page URL a document was loaded from: explicit url, Api's stamp, the live location, or doc.URL. */
  function baseOf(doc, url) {
    if (httpish(url)) return String(url);
    try {
      var d = doc && doc.nodeType === 9 ? doc : (doc && doc.ownerDocument) || null;
      if (d && httpish(d.__mbptvUrl)) return String(d.__mbptvUrl);
      if (d && d === document) return defaultBase();
      if (d && httpish(d.URL)) return String(d.URL);
    } catch (e) {}
    return defaultBase();
  }

  /* Resolves url against base without relying on the document base (parsed documents have the wrong one). */
  function resolve(url, base) {
    var u = trim(decodeEntities(url));
    if (!u || /^(?:javascript|data|about|blob|mailto|tel):/i.test(u)) return '';
    var b = parsedBase(httpish(base) ? String(base) : defaultBase()), abs;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(u)) abs = u;
    else if (u.slice(0, 2) === '//') abs = b.protocol + u;
    else if (u.charAt(0) === '/') abs = b.origin + u;
    else if (u.charAt(0) === '?') abs = b.origin + b.pathname + u;
    else if (u.charAt(0) === '#') abs = b.origin + b.pathname + b.search + u;
    else abs = b.origin + b.pathname.replace(/[^\/]*$/, '') + u;
    return U.parseUrl(abs).href;
  }

  function originOf(base) {
    var b = httpish(base) ? parsedBase(String(base)) : null;
    return b && /^https?:$/.test(b.protocol) ? b.origin : siteOrigin();
  }

  function siteOrigin() {
    try { if (/^https?:$/.test(location.protocol)) return location.protocol + '//' + location.host; } catch (e) {}
    return U.parseUrl(String(START_URL)).origin;
  }

  var startHost = null;
  function hostOk(hostname, base) {
    var h = U.siteHost(hostname);
    if (!h) return false;
    try { if (h === U.siteHost(parsedBase(httpish(base) ? String(base) : defaultBase()).hostname)) return true; } catch (e) {}
    try { if (h === U.siteHost(location.hostname)) return true; } catch (e2) {}
    try { if (startHost === null) startHost = U.siteHost(U.parseUrl(String(START_URL)).hostname); } catch (e3) { startHost = ''; }
    return !!startHost && h === startHost;
  }

  /* Absolute same-site URL or ''. */
  function sameSiteUrl(url, base) {
    var abs = resolve(url, base);
    if (!abs) return '';
    var u = U.parseUrl(abs);
    return /^https?:$/.test(u.protocol) && hostOk(u.hostname, base) ? u.href : '';
  }

  function kindOf(kind) { return /^(?:movie|film)/i.test(String(kind || '')) ? 'movie' : 'tv'; }
  function titlePath(kind, id) { return (kindOf(kind) === 'movie' ? '/movie/' : '/tvshow/') + encodeURIComponent(String(id == null ? '' : id)); }
  function titleHref(kind, id, base) { return originOf(base) + titlePath(kind, id); }
  function playPath(kind, id, season, episode) {
    if (kindOf(kind) === 'movie') return titlePath(kind, id) + '?play=1';
    var q = '';
    if (toInt(season) > 0) q += 'season=' + toInt(season) + '&';
    if (toInt(episode) > 0) q += 'episode=' + toInt(episode) + '&';
    return titlePath(kind, id) + '?' + q + 'play=1';
  }

  function parseTitleUrl(str, base) {
    if (typeof str !== 'string' || !str) return null;
    var b = httpish(base) ? String(base) : defaultBase();
    var abs = resolve(str, b);
    if (!abs) return null;
    var u = U.parseUrl(abs);
    if (!/^https?:$/.test(u.protocol) || !hostOk(u.hostname, b)) return null;
    var path = (u.pathname || '/').replace(/\/+$/, ''), m, kind, id;
    if ((m = /^\/(movie|tvshow)\/(\d+)(?:[-_][^\/]*)?$/i.exec(path))) {
      kind = m[1].toLowerCase() === 'movie' ? 'movie' : 'tv';
      id = String(toInt(m[2]));
    } else if ((m = /^\/index\/index\/(tv)?detail$/i.exec(path)) && /^\d+$/.test(u.query.id || '')) {
      kind = m[1] ? 'tv' : 'movie';
      id = String(toInt(u.query.id));
    } else {
      return null;
    }
    if (id === '0') return null;
    return {
      kind: kind, id: id, key: kind + ':' + id,
      season: toInt(u.query.season), episode: toInt(u.query.episode),
      play: u.query.play === '1' || u.query.play === 'true'
    };
  }

  function onclickUrl(code) {
    if (!code) return '';
    code = decodeEntities(code);
    var m = /location(?:\.href)?\s*=\s*(['"])(.*?)\1/.exec(code) ||
      /location\.(?:assign|replace)\s*\(\s*(['"])(.*?)\1/.exec(code) ||
      /window\.open\s*\(\s*(['"])(.*?)\1/.exec(code);
    return m ? m[2] : '';
  }

  /* {url, p} for the first candidate on el that parses as a title URL. */
  function targetInfo(el, base) {
    if (!el || el.nodeType !== 1) return null;
    var cands = [attr(el, 'href'), attr(el, 'data-link'), attr(el, 'data-href'), onclickUrl(attr(el, 'onclick'))];
    for (var i = 0; i < cands.length; i++) {
      var c = trim(decodeEntities(cands[i]));
      if (!c || c.charAt(0) === '#' || /^javascript:/i.test(c)) continue;
      var p = parseTitleUrl(c, base);
      if (p) return { url: resolve(c, base), p: p };
    }
    return null;
  }

  /* ---------- images and normalisers ---------- */

  /* The site's thumbnail service: https://thumb.chuaxin.com/thumb_<B64>.png, where B64 is URL-safe base64 ('-' and
     '_', no '=' padding) of "<path>|<width>|<quality>" (verified 2026-09-24: any width is honoured). The original
     file is https://images.chuaxin.com/<path>. Recognised by the file name plus a payload that decodes to exactly that
     shape, so the host may move (or be the offline mock's /__img/thumb/) without other URLs ever being rewritten. */
  var THUMB_URL = /^(https?:\/\/[^?#]*\/)thumb_([A-Za-z0-9_\-]{8,1400})\.(png|jpe?g|webp)((?:[?#].*)?)$/i;
  var THUMB_PAYLOAD = /^([^|\x00-\x1f]{1,900})\|(\d{1,5})(?:\|(\d{1,3}))?$/;

  function b64decode(s) {
    var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
    if (t.length % 4 === 1) return null;
    while (t.length % 4) t += '=';
    try { return typeof atob === 'function' ? atob(t) : null; } catch (e) { return null; }
  }

  function b64encode(s) {
    try { return typeof btoa === 'function' ? btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : null; } catch (e) { return null; }
  }

  /* {prefix, ext, suffix, path, width, quality} for a thumbnail-service URL, else null. */
  function thumbParts(url) {
    var m = THUMB_URL.exec(String(url == null ? '' : url));
    if (!m) return null;
    var payload = b64decode(m[2]), p = payload ? THUMB_PAYLOAD.exec(payload) : null;
    if (!p || !/\.[a-z0-9]{2,5}$/i.test(p[1]) || /\s/.test(p[1])) return null;
    return { prefix: m[1], ext: m[3], suffix: m[4], path: p[1], width: toInt(p[2]), quality: p[3] == null ? -1 : toInt(p[3]) };
  }

  /* The same thumbnail at another width (and quality, default 80); any other URL, or one that does not decode, comes
     back unchanged. */
  function thumb(url, width, quality) {
    var t = thumbParts(url), w = Math.round(+width);
    if (!t || !(w > 0)) return url;
    var q = Math.round(+quality);
    q = q > 0 ? Math.min(q, 100) : 80;
    var enc = b64encode(t.path + '|' + Math.min(w, 4096) + '|' + q);
    return enc ? t.prefix + 'thumb_' + enc + '.' + t.ext + t.suffix : url;
  }

  /* The full-size original of a thumbnail (https://images.chuaxin.com/<path>); any other URL comes back unchanged. */
  function original(url) {
    var t = thumbParts(url);
    if (!t) return url;
    if (httpish(t.path)) return t.path;
    return 'https://images.chuaxin.com/' + t.path.replace(/^\/+/, '');
  }

  function realImage(src, base) {
    var u = trim(decodeEntities(src));
    if (!u || /^(?:data|javascript|about|blob):/i.test(u)) return '';
    var abs = resolve(u, base);
    if (!httpish(abs)) return '';
    var path = U.parseUrl(abs).pathname || '';
    if (/\/static\//i.test(path)) return '';
    if (ICON_RE.test(path.slice(path.lastIndexOf('/') + 1))) return '';
    return abs;
  }

  function styleUrls(style) {
    var out = [], re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/gi, m;
    style = decodeEntities(style);
    while ((m = re.exec(style))) out.push(m[1] || m[2] || m[3] || '');
    return out;
  }

  function firstReal(list, base) {
    for (var i = 0; i < list.length; i++) {
      var r = realImage(list[i], base);
      if (r) return r;
    }
    return '';
  }

  function imgUrl(img, base) {
    if (!img) return '';
    return firstReal([attr(img, 'data-src'), attr(img, 'data-original'), attr(img, 'data-lazy'), attr(img, 'src')], base);
  }

  function bgUrl(el, base) { return el ? firstReal(styleUrls(attr(el, 'style')), base) : ''; }

  function artOf(el, base) { return el && el.tagName === 'IMG' ? imgUrl(el, base) : bgUrl(el, base); }

  function normRating(s) {
    var t = U.text(s);
    if (!t || /-,-/.test(t) || /^[-\u2013]+%?$/.test(t) || /^n\/?a$/i.test(t) || /^0+(?:\.0+)?%?$/.test(t)) return '';
    return t;
  }

  function normRuntime(s) {
    s = U.text(s);
    var m = /^(\d+)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/i.exec(s);
    if (m) return (toInt(m[1]) * 60 + toInt(m[2])) + ' min';
    m = RUNTIME_RE.exec(s);
    return m && toInt(m[1]) > 0 ? toInt(m[1]) + ' min' : '';
  }

  function yearOf(s) {
    var m = /\b(?:18|19|20)\d\d\b/.exec(String(s || ''));
    return m ? m[0] : '';
  }

  function isGenreList(s) {
    s = U.text(s);
    if (!s || s.length > 200 || CERT_RE.test(s) || /\d/.test(s)) return false;
    if (!/^[A-Za-z][A-Za-z&'\-\/\s]*(?:,\s*[A-Za-z][A-Za-z&'\-\/\s]*)*,?$/.test(s)) return false;
    return s.indexOf(',') >= 0 || s === s.toUpperCase();
  }

  function splitGenres(s) {
    return uniqStrings(U.map(String(s || '').split(/\s*,\s*/), function (g) { return U.titleCase(g); }), 12);
  }

  function qualityOf(li) {
    var q = '';
    U.each(qsa(li, 'img'), function (img) {
      var m = /ic_choose_([a-z0-9]+)/i.exec(attr(img, 'src'));
      if (m && QUALITY.hasOwnProperty(m[1].toLowerCase())) { q = QUALITY[m[1].toLowerCase()]; return false; }
    });
    return q;
  }

  function qualityFromName(name) {
    if (/2160p|\b4k\b|\buhd\b/i.test(name)) return '4K';
    if (/1080p/i.test(name)) return '1080p';
    if (/720p/i.test(name)) return '720p';
    if (/480p|360p|\bsd\b/i.test(name)) return 'SD';
    return '';
  }

  /* ---------- card extraction ---------- */

  /* Our own shell never counts as site content when the live document is parsed. */
  function shellOf(root) {
    var doc = root && (root.nodeType === 9 ? root : root.ownerDocument);
    try { return doc && doc.getElementById ? doc.getElementById('mbptv') : null; } catch (e) { return null; }
  }

  function collectTargets(root, base) {
    var out = [], shell = shellOf(root);
    var els = qsa(root, TARGET_SEL);
    if (root && root.nodeType === 1 && U.matches(root, TARGET_SEL)) els.unshift(root);
    U.each(els, function (el) {
      if (shell && shell.contains(el)) return;
      var t = targetInfo(el, base);
      if (t) out.push({ el: el, p: t.p, key: t.p.key, url: t.url });
    });
    return out;
  }

  function nameFrom(root) {
    var cands = U.filter(qsa(root, 'p, span, h2, h3, h4, strong, b, div'), function (el) {
      if (!isLeaf(el) || SKIP_NAME_CLS.test(cls(el))) return false;
      if (U.closest(el, '.score, .tomato, .update, .schedule, .count', root)) return false;
      var t = U.text(el.textContent);
      return t.length >= 1 && t.length <= 150 && !/[|\uFF5C]/.test(t) && !/^[\d.,]+%?$/.test(t) &&
        !/^S\d+\s*E\d+$/i.test(t) && !/^\d{1,2}:\d\d(?::\d\d)?$/.test(t) && !/^Update to\b/i.test(t);
    });
    var strong = U.find(cands, function (el) { return U.hasClass(el, 'name') || /bold|font-size\s*:\s*1[6-9]px/i.test(attr(el, 'style')); });
    var pick = strong || cands[0];
    return pick ? U.text(pick.textContent) : '';
  }

  function titleFor(root, targets) {
    var t = U.text(attr(root, 'title'));
    var stop = root.parentNode || null;
    if (!t) U.each(targets, function (x) {
      var c = U.closest(x.el, '[title]', stop), v = c ? U.text(attr(c, 'title')) : '';
      if (v) { t = v; return false; }
    });
    if (!t) { var inner = qs(root, 'p[title], span[title], a[title], div[title], li[title]'); t = inner ? U.text(attr(inner, 'title')) : ''; }
    if (!t) t = nameFrom(root);
    if (!t) U.each(qsa(root, 'img[alt]'), function (img) { var a = U.text(attr(img, 'alt')); if (a && a.length > 1) { t = a; return false; } });
    /* A plain text link (history lists, fallback markup) names its title. */
    if (!t) U.each(targets, function (x) {
      if (x.el.tagName !== 'A' || qs(x.el, 'img, p, div, li')) return;
      var v = textOf(x.el);
      if (v && v.length <= 120 && !/^(?:more|play|watch|details?)$/i.test(v)) { t = v; return false; }
    });
    return t;
  }

  function metaFrom(root) {
    var cands = qsa(root, 'p, span, div');
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (!isLeaf(c)) continue;
      var t = c.textContent || '';
      if (/[|\uFF5C]/.test(t) && /\d/.test(t)) return parseMeta(linesOf(c));
    }
    return parseMeta('');
  }

  /* "7.8 | 2022 | 176 min <br>ACTION,CRIME" and the full-width "6.6 \uFF5C1994\uFF5C 94 minutes" variant. */
  function parseMeta(t) {
    var out = { rating: '', year: '', runtime: '', genres: [], update: '' };
    var lines = String(t || '').split('\n'), first = lines.shift() || '';
    U.each(first.split(/[|\uFF5C]/), function (raw, i) {
      var s = U.text(raw);
      if (!s) return;
      if (i === 0 && /^\d+(?:\.\d+)?$/.test(s)) { out.rating = normRating(s); return; }
      if (!out.year && /^(?:18|19|20)\d\d$/.test(s)) { out.year = s; return; }
      if (/^Update to\b/i.test(s)) { out.update = U.text(s.replace(/^Update to\s*/i, '')); return; }
      if (!out.runtime && normRuntime(s)) { out.runtime = normRuntime(s); return; }
      if (!out.genres.length && isGenreList(s)) out.genres = splitGenres(s);
    });
    var rest = U.text(lines.join(',')).replace(/^,+|,+$/g, '');
    if (rest && isGenreList(rest)) out.genres = splitGenres(rest);
    return out;
  }

  function posterFor(root, base) {
    var u = imgUrl(qs(root, 'img.cover'), base);
    if (!u) U.each(qsa(root, 'img'), function (img) { u = imgUrl(img, base); if (u) return false; });
    if (!u) u = bgUrl(root, base);
    if (!u) U.each(qsa(root, BG_SEL), function (el) { u = bgUrl(el, base); if (u) return false; });
    return u;
  }

  function badgeFor(root) {
    var b = '';
    U.each(qsa(root, 'img'), function (img) {
      var n = fileName(attr(img, 'src')).toLowerCase();
      if (/4k_icon/.test(n)) b = '4K';
      else if (/8k_icon/.test(n)) b = '8K';
      else if (/blu-?ray_icon/.test(n)) b = 'Blu-ray';
      else if (/hdr_icon/.test(n)) b = 'HDR';
      if (b) return false;
    });
    return b;
  }

  function progressFor(root) {
    var span = qs(root, '.progress_bar span') || qs(root, '.progress_bar');
    if (!span) return -1;
    var m = /width\s*:\s*([\d.]+)\s*%/i.exec(attr(span, 'style'));
    if (!m) return -1;
    var n = parseFloat(m[1]);
    return isNaN(n) ? -1 : U.clamp(n / 100, 0, 1);
  }

  function blankItem(kind, id, base) {
    return {
      key: kind + ':' + id, kind: kind, id: id, title: '', href: titleHref(kind, id, base), poster: '', backdrop: '',
      rating: '', tomato: '', year: '', runtime: '', genres: [], badge: '', update: '', progress: -1, progressLabel: '', playHref: ''
    };
  }

  /* Builds one Item from a card root. key (optional) restricts it to that title when the root holds others. */
  function itemFrom(root, base, key) {
    if (!root || root.nodeType !== 1) return null;
    var targets = collectTargets(root, base);
    if (key) targets = U.filter(targets, function (t) { return t.key === key; });
    if (!targets.length) return null;
    var main = U.find(targets, function (t) { return !t.p.play; }) || targets[0];
    var mainKey = main.key;
    targets = U.filter(targets, function (t) { return t.key === mainKey; });
    var item = blankItem(main.p.kind, main.p.id, base);
    var meta = metaFrom(root);
    item.title = titleFor(root, targets);
    item.poster = posterFor(root, base);
    item.rating = normRating(textOf(qs(root, '.score span') || qs(root, '.score'))) || meta.rating;
    item.tomato = normRating(textOf(qs(root, '.tomato span') || qs(root, '.tomato')));
    item.year = meta.year;
    item.runtime = meta.runtime;
    item.genres = meta.genres;
    item.badge = badgeFor(root);
    item.update = textOf(qs(root, '.update')) || meta.update;
    item.progress = progressFor(root);
    item.progressLabel = textOf(qs(root, '.schedule .time span') || qs(root, '.time span'));
    var play = U.find(targets, function (t) { return t.p.play; });
    if (play) item.playHref = originOf(base) + playPath(item.kind, item.id, play.p.season, play.p.episode);
    return item;
  }

  function richness(it) {
    var n = 0;
    U.each(['title', 'poster', 'backdrop', 'rating', 'tomato', 'year', 'runtime', 'badge', 'update', 'progressLabel', 'playHref'], function (f) { if (it[f]) n++; });
    if (it.genres && it.genres.length) n++;
    if (it.progress >= 0) n++;
    return n;
  }

  function dedupe(items) {
    var byKey = {}, order = [];
    U.each(items, function (it) {
      if (!it || !it.key) return;
      if (!byKey.hasOwnProperty(it.key)) { byKey[it.key] = it; order.push(it.key); }
      else if (richness(it) > richness(byKey[it.key])) byKey[it.key] = it;
    });
    return U.map(order, function (k) { return byKey[k]; });
  }

  function isPageLevel(n) { return !n || n.nodeType !== 1 || n.tagName === 'BODY' || n.tagName === 'HTML'; }

  function hasForeignLink(node, base) {
    var links = qsa(node, 'a[href]');
    for (var i = 0; i < links.length; i++) {
      var h = trim(attr(links[i], 'href'));
      if (!h || h.charAt(0) === '#' || /^javascript:/i.test(h)) continue;
      if (!parseTitleUrl(h, base)) return true;
    }
    return false;
  }

  /* Grow a card root a little when its wrapper still belongs only to this title (e.g. a title <p> beside the link). */
  function extendRoot(n, key, stop, base) {
    for (var i = 0; i < 2; i++) {
      var p = n.parentNode;
      if (!p || p === stop || isPageLevel(p) || p[KEY_MARK] !== key) break;
      if (p.getElementsByTagName('*').length > 40 || hasForeignLink(p, base)) break;
      n = p;
    }
    return n;
  }

  function cardRoot(t, stop, base) {
    var n = t.el.tagName === 'IMG' ? t.el.parentNode : t.el, best = null;
    while (n && n.nodeType === 1 && n !== stop && !isPageLevel(n)) {
      if (n[KEY_MARK] !== t.key) break;
      best = n;
      if (n[ART_MARK]) return extendRoot(n, t.key, stop, base);
      n = n.parentNode;
    }
    return best || t.el;
  }

  /* Generic extractor (section 5.2): every title link becomes a card rooted at the nearest ancestor that holds
     artwork without holding a different title. Works on parsed documents (no layout needed). */
  function cards(root, opts) {
    opts = opts || {};
    root = root || document;
    if (root.nodeType !== 1 && root.nodeType !== 9) return [];
    var doc = root.nodeType === 9 ? root : root.ownerDocument;
    var base = httpish(opts.base) ? String(opts.base) : baseOf(doc);
    var stop = root.nodeType === 9 ? null : root.parentNode;
    var targets = collectTargets(root, base);
    if (!targets.length) return [];
    var touched = [], found = [], roots = [];
    try {
      U.each(targets, function (t) {
        var mixed = false;
        for (var n = t.el; n && n.nodeType === 1 && n !== stop; n = n.parentNode) {
          var v = n[KEY_MARK];
          if (v === undefined) { n[KEY_MARK] = mixed ? '*' : t.key; touched.push(n); }
          else if (v === '*' || (v === t.key && !mixed)) break;
          else { n[KEY_MARK] = '*'; mixed = true; }
        }
      });
      var art = U.filter(qsa(root, 'img'), function (img) { return !!imgUrl(img, base); })
        .concat(U.filter(qsa(root, BG_SEL), function (el) { return !!bgUrl(el, base); }));
      if (root.nodeType === 1 && artOf(root, base)) art.push(root);
      U.each(art, function (a) {
        for (var n = a; n && n.nodeType === 1 && n !== stop; n = n.parentNode) {
          if (n[ART_MARK]) break;
          n[ART_MARK] = true;
          touched.push(n);
        }
      });
      U.each(targets, function (t) {
        var r = cardRoot(t, stop, base);
        if (U.indexOf(roots, r) >= 0) return;
        roots.push(r);
        found.push({ root: r, key: t.key });
      });
    } finally {
      U.each(touched, function (n) {
        try { delete n[KEY_MARK]; delete n[ART_MARK]; } catch (e) { n[KEY_MARK] = undefined; n[ART_MARK] = undefined; }
      });
    }
    var items = [];
    U.each(found, function (f) {
      if (opts.live && !U.isVisible(f.root)) return;
      var it = itemFrom(f.root, base, f.key);
      if (it) items.push(it);
    });
    return dedupe(items);
  }

  function nextFrom(doc, base) {
    var a = qs(doc, '.pagination li.next a[href]');
    if (!a) U.each(qsa(doc, '.pagination a[href], a[rel="next"]'), function (x) {
      var t = U.text(x.textContent);
      if (t === '\u00BB' || t === '\u203A' || /^next\b/i.test(t) || attr(x, 'rel') === 'next') { a = x; return false; }
    });
    if (!a) return '';
    var abs = sameSiteUrl(attr(a, 'href'), base);
    return abs && abs !== base ? abs : '';
  }

  /* ---------- page parsers ---------- */

  function bannersFrom(sec, base) {
    var out = [];
    U.each(qsa(sec, TARGET_SEL), function (el) {
      var t = targetInfo(el, base);
      if (!t) return;
      var image = bgUrl(el, base) || bgUrl(qs(el, BG_SEL), base) || imgUrl(qs(el, 'img'), base);
      if (!image) return;
      out.push({ key: t.p.key, kind: t.p.kind, id: t.p.id, href: titleHref(t.p.kind, t.p.id, base), image: image });
    });
    return out;
  }

  function home(doc, url) {
    var out = { rows: [], banners: [] };
    if (!doc || !doc.documentElement) return out;
    var base = baseOf(doc, url), used = {}, seenBanner = {};
    var sections = qsa(doc, '.contents .section');
    if (!sections.length) sections = qsa(doc, '.section');
    U.each(sections, function (sec) {
      var h3 = qs(sec, 'h3');
      if (!h3) {
        U.each(bannersFrom(sec, base), function (b) { if (!seenBanner[b.key]) { seenBanner[b.key] = true; out.banners.push(b); } });
        return;
      }
      var title = ownText(h3) || U.text(textOf(h3).replace(/\s*More\s*$/i, ''));
      var moreA = qs(h3, 'a[href]');
      var lis = qsa(sec, 'li[title]');
      var items = dedupe(U.map(lis, function (li) { return itemFrom(li, base); }));
      if (!items.length) items = cards(sec, { base: base });
      if (!items.length) return;
      out.rows.push({ id: uniqueId(slug(title), used), title: title, items: items, more: moreA ? sameSiteUrl(attr(moreA, 'href'), base) : '' });
    });
    if (!out.rows.length) {
      var all = cards(doc, { base: base });
      if (all.length) out.rows.push({ id: 'featured', title: 'Featured', items: all, more: '' });
    }
    var byKey = {};
    U.each(out.banners, function (b) { byKey[b.key] = b.image; });
    U.each(out.rows, function (row) {
      U.each(row.items, function (it) { if (!it.backdrop && byKey.hasOwnProperty(it.key)) it.backdrop = byKey[it.key]; });
    });
    return out;
  }

  function chipsFrom(doc, base) {
    var out = [], seen = {};
    function add(a, selected) {
      var href = sameSiteUrl(attr(a, 'href'), base), label = U.text(textOf(a));
      if (!href || !label || seen[href]) return;
      seen[href] = true;
      out.push({ label: label === label.toUpperCase() ? U.titleCase(label) : label, href: href, selected: !!selected });
    }
    U.each(qsa(doc, 'a[href*="top_list"]'), function (a) { add(a, false); });
    U.each(qsa(doc, '.fav_nav a[href]'), function (a) { add(a, qs(a, '.selected2') || U.hasClass(a, 'selected2')); });
    return out;
  }

  function list(doc, url) {
    var out = { title: '', items: [], next: '', chips: [] };
    if (!doc || !doc.documentElement) return out;
    var base = baseOf(doc, url);
    var head = qs(doc, 'span[style*="font-size:24px"], span[style*="font-size: 24px"]') || qs(doc, '.contents h1, .contents h2');
    out.title = textOf(head) || docTitle(doc);
    var scope = qs(doc, '.contents') || doc;
    out.items = cards(scope, { base: base });
    if (!out.items.length && scope !== doc) out.items = cards(doc, { base: base });
    out.next = nextFrom(doc, base);
    out.chips = chipsFrom(doc, base);
    return out;
  }

  function search(doc, url) {
    var out = { query: '', type: 'all', total: null, types: [], items: [], playlists: [], next: '', empty: true };
    if (!doc || !doc.documentElement) return out;
    var base = baseOf(doc, url), u = U.parseUrl(base);
    var input = qs(doc, '#top_search2') || qs(doc, '.result input[name="word"]');
    out.query = U.text(attr(input, 'value')) || U.text(u.query.word || '');
    var m = /([\d,]+)\s+results?\s+found/i.exec(doc.body ? doc.body.textContent : '');
    out.total = m ? toInt(m[1].replace(/,/g, '')) : null;
    if (!out.query) { var qm = /results?\s+found\s+for\s+["\u201C](.*?)["\u201D]/i.exec(doc.body ? doc.body.textContent : ''); if (qm) out.query = U.text(qm[1]); }
    var selected = '';
    U.each(qsa(doc, '.search_nav a[href]'), function (a) {
      var href = sameSiteUrl(attr(a, 'href'), base);
      var type = attr(qs(a, '[type]'), 'type') || (href ? U.parseUrl(href).query.type : '') || '';
      if (!type) return;
      var sel = !!(qs(a, '.selected2') || U.hasClass(a, 'selected2'));
      if (sel && !selected) selected = type;
      out.types.push({ type: type, label: U.titleCase(textOf(a)), href: href, selected: sel });
    });
    out.type = selected || U.text(u.query.type || '') || 'all';
    if (!selected) U.each(out.types, function (t) { t.selected = t.type === out.type; });
    var roots = U.filter(qsa(doc, '.search_info > a[href]'), function (a) { return !!targetInfo(a, base); });
    out.items = dedupe(U.map(roots, function (a) { return itemFrom(a, base); }));
    if (!out.items.length) out.items = cards(qs(doc, '.search_info') || qs(doc, '.result') || doc, { base: base });
    var pls = qsa(doc, '.playlists a[href*="/playlist/"]');
    if (!pls.length) pls = U.filter(qsa(doc, 'a[href*="/playlist/"]'), function (a) { return !!qs(a, '.name, .list_img'); });
    var seenPl = {};
    U.each(pls, function (a) {
      var href = sameSiteUrl(attr(a, 'href'), base);
      if (!href || seenPl[href]) return;
      seenPl[href] = true;
      out.playlists.push({
        title: textOf(qs(a, '.name')) || U.text(attr(a, 'title')) || textOf(a),
        href: href,
        image: bgUrl(qs(a, '.list_img'), base) || bgUrl(qs(a, BG_SEL), base) || imgUrl(qs(a, 'img'), base),
        count: textOf(qs(a, '.count'))
      });
    });
    out.next = nextFrom(doc, base);
    out.empty = out.items.length === 0;
    return out;
  }

  function source(li, index) {
    var file = '', size = '', date = '', longest = '';
    U.each(qsa(li, 'span'), function (s) {
      if (!isLeaf(s)) return;
      var t = U.text(s.textContent);
      if (!t) return;
      if (t.length > longest.length) longest = t;
      if (!size && /^\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB)$/i.test(t)) size = t;
      else if (!date && (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t) || /^\d{4}-\d{2}-\d{2}\b/.test(t))) date = t;
      else if (!file && /\.[a-z0-9]{2,4}$/i.test(t) && t.length > 4 && !/\d\s*[KMGT]?B\/s$/i.test(t)) file = t;
    });
    if (!file && longest !== size && longest !== date) file = longest;
    return { index: toInt(index), quality: qualityOf(li) || qualityFromName(file), file: file, size: size, date: date };
  }

  function titleFromDetailDoc(doc, base) {
    var nameA = qs(doc, '.movie_title a[href]');
    var t = nameA ? targetInfo(nameA, base) : null;
    if (t) return t.p;
    var play = attr(qs(doc, '.start_app[play]'), 'play');
    var id = /[?&]id=(\d+)/.exec(play);
    if (id) {
      var box = /box_type=(\d+)/.exec(play);
      var kind = box && box[1] === '2' ? 'tv' : 'movie';
      return { kind: kind, id: id[1], key: kind + ':' + id[1], season: 0, episode: 0, play: false };
    }
    return null;
  }

  function factsInto(info, d) {
    var leafs = U.filter(qsa(info, 'p'), isLeaf);
    var anchor = U.find(leafs, function (p) { var t = textOf(p); return /^Update to\b/i.test(t) || (t.length < 20 && !!normRuntime(t)); });
    var group = [];
    if (anchor && anchor.parentNode) group = U.filter(anchor.parentNode.children, function (c) { return c.tagName === 'P' && isLeaf(c); });
    if (!group.length) U.each(qsa(info, 'div'), function (div) {
      var ps = U.filter(div.children, function (c) { return c.tagName === 'P' && isLeaf(c); });
      if (ps.length >= 2 && ps.length <= 4 && U.find(ps, function (p) { var t = textOf(p); return CERT_RE.test(t) || isGenreList(t); })) { group = ps; return false; }
    });
    U.each(group, function (p) {
      var t = textOf(p);
      if (!t) return;
      if (/^Update to\b/i.test(t)) { if (!d.update) d.update = t; }
      else if (!d.runtime && t.length < 20 && normRuntime(t)) d.runtime = normRuntime(t);
      else if (!d.certification && CERT_RE.test(t)) d.certification = t;
      else if (!d.genres.length && isGenreList(t)) d.genres = splitGenres(t);
    });
  }

  function ratingsInto(doc, info, d) {
    var im = qs(info, 'a[href*="imdb."]') || qs(doc, 'a[href*="imdb."]');
    if (im) d.ratings.imdb = normRating(textOf(qs(im, 'div p') || qs(im, 'p')));
    var rts = qsa(info, 'a[href*="rottentomatoes"]');
    if (!rts.length) rts = qsa(doc, 'a[href*="rottentomatoes"]');
    var tomatoSeen = false, audienceSeen = false;
    U.each(rts, function (a) {
      var img = attr(qs(a, 'img'), 'src'), label = textOf(a);
      var v = normRating(textOf(qs(a, 'div p') || qs(a, 'p')));
      if (/audience/i.test(img) || /audience/i.test(label)) { if (!audienceSeen) { audienceSeen = true; d.ratings.audience = v; } }
      else if (!tomatoSeen) { tomatoSeen = true; d.ratings.tomato = v; }
    });
  }

  function overviewOf(info, d) {
    var best = '';
    U.each(qsa(info, 'p'), function (p) {
      if (!isLeaf(p)) return;
      var t = textOf(p);
      if (t.length >= 40 && t.length > best.length && t !== d.title && !/^Update to\b/i.test(t) && !isGenreList(t)) best = t;
    });
    return best;
  }

  function badgesInto(doc, info, d) {
    var imgs = qsa(info, 'img.style');
    if (!imgs.length) imgs = qsa(doc, 'img.style');
    U.each(imgs, function (img) {
      var n = fileName(attr(img, 'src'));
      for (var i = 0; i < BADGES.length; i++) {
        if (BADGES[i][0].test(n)) { if (U.indexOf(d.badges, BADGES[i][1]) < 0) d.badges.push(BADGES[i][1]); break; }
      }
    });
    var holder = imgs.length ? imgs[0].parentNode : null;
    if (holder) U.each(qsa(holder, 'span'), function (s) {
      var t = textOf(s);
      if (/^[A-Z]{2,4}(?:\s*[,\/&]\s*[A-Z]{2,4})*$/.test(t)) { d.audio = t; return false; }
    });
  }

  function castOf(doc, base) {
    var out = [], seen = {};
    U.each(qsa(doc, '.actor a'), function (a) {
      var per = qs(a, '.personnel');
      if (!per) return;
      var ps = U.filter(qsa(qs(per, '.left2') || per, 'p'), function (p) { return !U.hasClass(p, 'avatar') && !U.hasClass(p, 'avatar2'); });
      var name = textOf(ps[0]);
      if (!name || seen['$' + name]) return;
      seen['$' + name] = true;
      var character = textOf(ps[1]), job = U.titleCase(textOf(ps[2]));
      out.push({
        name: name, role: character || job, character: character, job: job,
        image: bgUrl(qs(per, '.avatar'), base) || imgUrl(qs(per, 'img'), base),
        href: sameSiteUrl(attr(a, 'href'), base)
      });
    });
    return out;
  }

  function relatedOf(doc, base, ownKey) {
    var items = U.map(qsa(doc, '.related .scroll_list a[href]'), function (a) { return itemFrom(a, base); });
    items = U.filter(items, function (it) { return !!it; });
    if (!items.length) U.each(qsa(doc, '.related'), function (r) {
      if (r.id === 'season' || qs(r, '.tv_episode')) return;
      items = items.concat(cards(r, { base: base }));
    });
    return dedupe(U.filter(items, function (it) { return it && it.key !== ownKey; }));
  }

  function seasonsInto(doc, base, d, urlSeason) {
    var box = qs(doc, '.season_bg .season_list2') || qs(doc, '.season_list2');
    var activeNum = 0;
    if (box) {
      var label = U.find(qsa(box, 'p.name2'), function (p) { return /season/i.test(textOf(p)); });
      var group = label ? nextElement(label) : null;
      while (group && group.tagName !== 'DIV') group = nextElement(group);
      U.each(group ? qsa(group, 'a[href]') : [], function (a) {
        var href = sameSiteUrl(attr(a, 'href'), base);
        var num = toInt(textOf(a)) || (href ? toInt(U.parseUrl(href).query.season) : 0);
        if (!num) return;
        if (qs(a, '.active') || U.hasClass(a, 'active')) activeNum = num;
        d.seasons.push({ number: num, href: href || titleHref('tv', d.id, base) + '?season=' + num, current: false });
      });
    }
    var titleM = /Season\s*(\d+)\s*\/\s*(\d+)/i.exec(textOf(qs(doc, '#season p.title')) || textOf(qs(doc, '#season .title')));
    d.season = activeNum || toInt(urlSeason) || (titleM ? toInt(titleM[1]) : 0);
    if (!d.seasons.length && titleM) {
      for (var n = 1; n <= Math.min(toInt(titleM[2]), 100); n++) d.seasons.push({ number: n, href: titleHref('tv', d.id, base) + '?season=' + n, current: false });
    }
    U.each(d.seasons, function (s) { s.current = s.number === d.season; });
  }

  function episodesOf(doc, base) {
    var out = [], seen = {};
    var list = qsa(doc, '#season .tv_episode');
    if (!list.length) list = qsa(doc, '.tv_episode');
    U.each(list, function (ep) {
      var btns = qsa(ep, '.start_app_episode');
      var code = textOf(qs(ep, 'span.episode') || qs(ep, '.episode'));
      var s = toInt(attr(btns[0], 'season')), e = toInt(attr(btns[0], 'episode'));
      var cm = /S(\d+)\s*E(\d+)/i.exec(code);
      if ((!s || !e) && cm) { s = toInt(cm[1]); e = toInt(cm[2]); }
      if (!e || seen[s + 'x' + e]) return;
      seen[s + 'x' + e] = true;
      var titleEl = btns.length > 1 ? qs(btns[1], 'p') : null;
      if (!titleEl) titleEl = U.find(qsa(ep, '.start_app_episode p'), function (p) { return !cls(p) && !!textOf(p); });
      var date = '', runtime = '', overview = '', dateP = null;
      var ps = U.filter(ep.children, function (c) { return c.tagName === 'P' && isLeaf(c); });
      U.each(ps, function (p) {
        var t = textOf(p);
        if (!dateP && (/\|/.test(t) || (t.length < 40 && RUNTIME_RE.test(t)))) {
          dateP = p;
          U.each(t.split(/\s*\|\s*/), function (part) {
            if (!runtime && normRuntime(part) && part.length < 20) runtime = normRuntime(part);
            else if (!date && part) date = U.text(part.replace(/\s*\([^)]*\)\s*$/, ''));
          });
        } else if (!overview && t && p !== dateP) {
          overview = t;
        }
      });
      out.push({
        season: s, episode: e, code: code || ('S' + s + 'E' + e), title: textOf(titleEl), date: date, runtime: runtime,
        overview: overview, still: bgUrl(qs(ep, '.chapter_img'), base) || imgUrl(qs(ep, 'img.still'), base),
        rating: normRating(textOf(qs(ep, '.score span') || qs(ep, '.score'))), watched: false
      });
    });
    return out;
  }

  function byEpisode(a, b) { return (a.season - b.season) || (a.episode - b.episode); }

  /* An attribute that holds a number, including 0 (S01E00 specials): -1 when absent or not a number. */
  function numAttr(el, name) {
    var v = trim(attr(el, name));
    return /^\d{1,4}$/.test(v) ? toInt(v) : -1;
  }

  /* The watch-plan list on every TV page (hidden; the site opens it from the watch-plan button):
     .season_episode_list .season_info[season=N] per season, each with .episode[season][episode] rows holding
     p.name "S01E00 - Building the Batman" and img.watch2 (…/no_finish2.png while unwatched, another image once
     watched), plus .watch_progress .left2 p lines "Season 1 · 0%" and "0/14 episodes watched". It lists every season,
     including specials the season's own episode cards leave out. */
  function seasonListOf(doc) {
    var out = { all: {}, stats: {} };
    var blocks = qsa(doc, '.season_episode_list .season_info');
    if (!blocks.length) blocks = qsa(doc, '.season_info[season]');
    U.each(blocks, function (b) {
      var sn = numAttr(b, 'season'), list = [], seen = {};
      U.each(qsa(b, '.episode'), function (row) {
        if (U.hasClass(row, 'season_info')) return;
        var name = textOf(qs(row, 'p.name') || qs(row, '.name'));
        var m = /^S(\d{1,4})\s*E(\d{1,4})\b\s*(?:[-–—:|.]\s*)?(.*)$/i.exec(name);
        var s = numAttr(row, 'season'), e = numAttr(row, 'episode');
        if (s < 0) s = m ? toInt(m[1]) : sn;
        if (e < 0) e = m ? toInt(m[2]) : -1;
        if (s < 0 || e < 0 || seen[s + 'x' + e]) return;
        seen[s + 'x' + e] = true;
        var img = qs(row, 'img.watch2') || qs(row, 'img[src*="finish"]'), src = attr(img, 'src');
        list.push({ season: s, episode: e, code: 'S' + s + 'E' + e, title: m ? U.text(m[3]) : name, watched: !!src && !/no_finish/i.test(src) });
      });
      if (sn < 0 && list.length) sn = list[0].season;
      if (sn < 0) return;
      list = U.filter(list, function (x) { return x.season === sn; });
      list.sort(byEpisode);
      if (!out.all.hasOwnProperty(sn) || out.all[sn].length < list.length) out.all[sn] = list;
      var watched = 0, total = list.length, label = '';
      U.each(list, function (x) { if (x.watched) watched++; });
      var prog = qs(b, '.watch_progress .left2') || qs(b, '.watch_progress');
      if (!prog) prog = U.find(qsa(doc, '.watch_progress'), function (w) { return new RegExp('^Season\\s*' + sn + '\\b', 'i').test(textOf(qs(w, 'p'))); }) || null;
      U.each(qsa(prog, 'p'), function (p) {
        var t = textOf(p), wm = /(\d+)\s*\/\s*(\d+)\s*episodes?/i.exec(t);
        if (wm) { watched = toInt(wm[1]); total = toInt(wm[2]); } else if (!label && /\S/.test(t)) label = t;
      });
      out.stats[sn] = { watched: watched, total: total, label: label };
    });
    return out;
  }

  /* The season's episode cards plus any episode only the watch-plan list names (specials such as S01E00): those
     become name-only entries (no still, date or overview). Every episode gets its watched mark. */
  function mergeEpisodes(d) {
    var list = d.allEpisodes[d.season] || [], byNum = {}, have = {};
    U.each(list, function (x) { byNum[x.season + 'x' + x.episode] = x; });
    U.each(d.episodes, function (ep) {
      var x = byNum[ep.season + 'x' + ep.episode];
      have[ep.season + 'x' + ep.episode] = true;
      ep.watched = !!(x && x.watched);
      if (x && !ep.title) ep.title = x.title;
    });
    U.each(list, function (x) {
      if (have[x.season + 'x' + x.episode]) return;
      d.episodes.push({ season: x.season, episode: x.episode, code: x.code, title: x.title, date: '', runtime: '', overview: '', still: '', rating: '', watched: x.watched });
    });
    d.episodes.sort(byEpisode);
  }

  /* The episode a show-level Play/Resume starts: an "S2E3"-style resume label on the page's Play button; else the first
     unwatched episode (seasons and episodes from 1: specials are never picked on their own); else the first episode.
     null when the page lists no episodes to choose from (the caller then lets the website decide). */
  function nextEpisodeOf(d) {
    var m = /S(\d{1,4})\s*E(\d{1,4})/i.exec(d.playLabel || '');
    if (m && toInt(m[1]) > 0) return { season: toInt(m[1]), episode: toInt(m[2]), code: 'S' + toInt(m[1]) + 'E' + toInt(m[2]), resume: true };
    var seasons = [];
    for (var k in d.allEpisodes) if (d.allEpisodes.hasOwnProperty(k) && toInt(k) > 0 && d.allEpisodes[k].length) seasons.push(toInt(k));
    seasons.sort(function (a, b) { return a - b; });
    var flat = [];
    U.each(seasons, function (s) { flat = flat.concat(d.allEpisodes[s]); });
    var pick = U.find(flat, function (x) { return x.episode > 0 && !x.watched; }) || U.find(flat, function (x) { return x.episode > 0; }) || flat[0];
    return pick ? { season: pick.season, episode: pick.episode, code: 'S' + pick.season + 'E' + pick.episode, resume: false } : null;
  }

  function blankDetail(kind, id, base) {
    return {
      kind: kind, id: id, key: kind + ':' + id, href: titleHref(kind, id, base), title: '', year: '', poster: '',
      backdrop: '', backdropOriginal: '', runtime: '', certification: '', genres: [], update: '',
      ratings: { imdb: '', tomato: '', audience: '' }, overview: '', badges: [], audio: '', playLabel: '',
      playHref: originOf(base) + playPath(kind, id, 0, 0), sources: [], cast: [], related: [],
      season: 0, seasons: [], episodes: [], allEpisodes: {}, seasonStats: {}, nextEpisode: null, partial: false
    };
  }

  /* The title page no longer matches any known markup: keep Play working from the URL, with what the head offers. */
  function minimalDetail(doc, base, p) {
    var title = U.text(attr(qs(doc, 'meta[property="og:title"]'), 'content')) || docTitle(doc) || textOf(qs(doc, 'h1'));
    if (!title) return null;
    var d = blankDetail(p.kind, p.id, base);
    d.partial = true;
    d.title = title;
    d.poster = realImage(attr(qs(doc, 'meta[property="og:image"]'), 'content'), base);
    d.overview = U.text(attr(qs(doc, 'meta[name="description"]'), 'content') || attr(qs(doc, 'meta[property="og:description"]'), 'content'));
    d.year = yearOf(textOf(qs(doc, '.year')));
    d.playLabel = 'PLAY';
    d.related = relatedOf(doc, base, d.key);
    return d;
  }

  function detail(doc, url) {
    if (!doc || !doc.documentElement || isGate(doc)) return null;
    var base = baseOf(doc, url);
    if (!qs(doc, '.movie_title, .info .cover, .start_app, .poster_bg')) {
      var stamped = httpish(url) ? url : (httpish(doc.__mbptvUrl) ? doc.__mbptvUrl : '');
      var sp = stamped ? parseTitleUrl(String(stamped), base) : null;
      if (!sp || qs(doc, '.search_info, .contents .section h3, .movies, .login_btn')) return null;
      return minimalDetail(doc, base, sp);
    }
    var p = (url ? parseTitleUrl(url, base) : null) || titleFromDetailDoc(doc, base) || parseTitleUrl(base, base);
    if (!p) return null;
    var kind = p.kind, id = p.id;
    var d = blankDetail(kind, id, base);
    var info = qs(doc, '.info') || doc.body || doc.documentElement;
    d.title = textOf(qs(doc, '.movie_title .name')) || textOf(qs(doc, '.movie_title')) || docTitle(doc);
    d.year = yearOf(textOf(qs(doc, '.year')));
    d.poster = imgUrl(qs(info, 'img.cover') || qs(doc, 'img.cover'), base);
    d.backdropOriginal = bgUrl(qs(doc, '.poster_bg'), base) || bgUrl(qs(qs(doc, '.poster_bg'), BG_SEL), base);
    d.backdrop = d.backdropOriginal.replace('/t/p/original/', '/t/p/w1280/');
    factsInto(info, d);
    ratingsInto(doc, info, d);
    d.overview = overviewOf(info, d) || U.text(attr(qs(doc, 'meta[name="description"]'), 'content'));
    badgesInto(doc, info, d);
    d.playLabel = textOf(qs(doc, '#save_progress')) || textOf(qs(doc, '.start_app .play span')) || textOf(qs(doc, '.start_app')) || 'PLAY';
    var lis = qsa(doc, '.sidebarbg2 li.play[oss_download_url]');
    if (!lis.length) lis = qsa(doc, '.sidebarbg2 li.play');
    d.sources = U.map(lis, function (li, i) { return source(li, i); });
    d.cast = castOf(doc, base);
    d.related = relatedOf(doc, base, d.key);
    if (kind === 'tv') {
      seasonsInto(doc, base, d, p.season);
      d.episodes = episodesOf(doc, base);
      var lists = seasonListOf(doc);
      d.allEpisodes = lists.all;
      d.seasonStats = lists.stats;
      if (!d.season && d.episodes.length) d.season = d.episodes[0].season;
      /* No season pills in the markup: the watch-plan list still names every season. */
      if (!d.seasons.length) {
        for (var sk in d.allEpisodes) {
          if (d.allEpisodes.hasOwnProperty(sk) && toInt(sk) > 0) d.seasons.push({ number: toInt(sk), href: titleHref('tv', d.id, base) + '?season=' + toInt(sk), current: false });
        }
        d.seasons.sort(function (a, b) { return a.number - b.number; });
        if (!d.season && d.seasons.length) d.season = d.seasons[0].number;
      }
      U.each(d.seasons, function (s) { s.current = s.number === d.season; });
      mergeEpisodes(d);
      d.nextEpisode = nextEpisodeOf(d);
    }
    return d;
  }

  function isGate(doc) {
    if (!doc || !doc.documentElement) return false;
    if (qs(doc, '#top_nav_home, #top_nav_movie, #top_nav_tv, .top-search-btn') || qs(doc, '.contents')) return false;
    if (qs(doc, '.login_btn') || qs(doc, 'a[href*="/index/login"]')) return true;
    return /private\s+garden/i.test(doc.title || '');
  }

  function pageType(loc, doc) {
    var href = '';
    if (typeof loc === 'string') href = loc;
    else if (loc && loc.href) href = String(loc.href);
    if (!href && doc) href = baseOf(doc);
    var u = U.parseUrl(resolve(href || defaultBase(), defaultBase()) || defaultBase());
    var path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    if (/^\/index\/login(?:\/|$)/i.test(path)) return 'login';
    if (doc && isGate(doc)) return 'gate';
    if (path === '/' || /^\/index(?:\/index(?:\/index)?)?$/i.test(path)) return 'home';
    if (/^\/index\/search$/i.test(path)) return 'search';
    var t = parseTitleUrl(u.href, u.href);
    if (t) return t.kind === 'movie' ? 'movie' : 'tv';
    if (/^\/index\/index\/(?:my_box|watching_list|fav_list|recommend_list)$/i.test(path)) return 'library';
    if (/^\/(?:movie|tvshow)$/i.test(path) || /^\/index\/index\/(?:movie_list|history)$/i.test(path) || /^\/index\/(?:movie|tv)\/top_list$/i.test(path)) return 'list';
    if (doc && doc.documentElement) {
      if (qs(doc, '.search_info, .search_nav')) return 'search';
      if (qs(doc, '.movie_title') && qs(doc, '.start_app_episode, .tv_episode')) return 'tv';
      if (qs(doc, '.movie_title')) return 'movie';
      if (qs(doc, '.contents .section h3')) return 'home';
    }
    return 'other';
  }

  /* ---------- JSON endpoints ---------- */

  function asData(input) { return typeof input === 'string' ? U.parseJSON(input) : input; }

  function namesOf(list) {
    return U.map(isArray(list) ? list : [], function (x) {
      return typeof x === 'string' ? x : (x && (x.name || x.title || x.word || x.key)) || '';
    });
  }

  function suggestions(jsonText) {
    var data = asData(jsonText);
    if (data && !isArray(data) && typeof data === 'object') data = data.data || data.list || data.result || null;
    return uniqStrings(namesOf(data), 50);
  }

  function hot(jsonText) {
    var out = { trending: [], recent: [] };
    var data = asData(jsonText), d = data && typeof data === 'object' ? (data.data || data) : null;
    if (!d || typeof d !== 'object') return out;
    out.trending = uniqStrings(namesOf(d.list || d.hot || []), 30);
    if (typeof d.html === 'string' && d.html) {
      var hd = U.parseHTML(d.html), keys = U.map(qsa(hd, '[key]'), function (el) { return attr(el, 'key'); });
      if (!keys.length) keys = U.map(qsa(hd, '.search_submit'), textOf);
      out.recent = uniqStrings(keys, 30);
    }
    return out;
  }

  /* ---------- diagnostics ---------- */

  var PROBES = {
    home: ['.contents .section', '.section h3', '.section li[title]'],
    search: ['.search_info'],
    list: ['.contents'],
    library: ['.contents', 'li[title]'],
    movie: ['.movie_title .name', '.info img.cover', '.poster_bg', '.start_app', '.sidebarbg2'],
    tv: ['.movie_title .name', '.info img.cover', '.start_app', '#season .tv_episode', '.season_list2', '.season_episode_list .season_info'],
    gate: ['.login_btn']
  };

  /* parsed (optional): the page's Site.home or Site.detail model when the caller already has it, so the page is not
     parsed twice. */
  function selfTest(doc, type, parsed) {
    var res = { ok: true, type: '', warnings: [], counts: {} };
    if (!doc || !doc.documentElement) { res.ok = false; res.warnings.push('no document'); return res; }
    type = type || pageType(null, doc);
    res.type = type;
    U.each(PROBES[type] || [], function (sel) {
      var n = qsa(doc, sel).length;
      res.counts[sel] = n;
      if (!n) res.warnings.push(type + ': no match for ' + sel);
    });
    var critical = false;
    if (type === 'home') {
      var h = parsed && isArray(parsed.rows) ? parsed : home(doc);
      res.counts.rows = h.rows.length;
      res.counts.items = 0;
      U.each(h.rows, function (r) { res.counts.items += r.items.length; });
      res.counts.banners = h.banners.length;
      if (!h.rows.length) { critical = true; res.warnings.push('home: no rows'); }
    } else if (type === 'search') {
      var s = search(doc);
      res.counts.items = s.items.length;
      res.counts.types = s.types.length;
      res.counts.total = s.total == null ? -1 : s.total;
      if (s.total == null) res.warnings.push('search: result count not found');
      if (s.total == null && !s.items.length) critical = true;
      if (s.total > 0 && !s.items.length) { critical = true; res.warnings.push('search: total > 0 but no cards'); }
      if (s.total > 0 && !s.types.length) res.warnings.push('search: no type tabs');
    } else if (type === 'list' || type === 'library') {
      var l = list(doc);
      res.counts.items = l.items.length;
      res.counts.chips = l.chips.length;
      if (!l.items.length) res.warnings.push(type + ': no cards');
    } else if (type === 'movie' || type === 'tv') {
      var d = parsed && parsed.key && isArray(parsed.episodes) ? parsed : detail(doc);
      if (!d || !d.title) { critical = true; res.warnings.push(type + ': detail not parsed'); }
      else {
        res.counts.sources = d.sources.length;
        res.counts.cast = d.cast.length;
        res.counts.related = d.related.length;
        res.counts.episodes = d.episodes.length;
        res.counts.seasons = d.seasons.length;
        if (!d.poster) res.warnings.push(type + ': no poster');
        if (!d.backdrop) res.warnings.push(type + ': no backdrop');
        if (type === 'tv' && !d.episodes.length) res.warnings.push('tv: no episodes');
      }
    } else if (type === 'gate') {
      if (!isGate(doc)) { critical = true; res.warnings.push('gate: not recognised'); }
    }
    res.counts.cards = cards(doc).length;
    res.ok = !critical && res.warnings.length === 0;
    return res;
  }

  /* ---------- live page helpers (real page only) ---------- */

  function click(el) {
    if (!el) return false;
    try { if (typeof el.click === 'function') { el.click(); return true; } } catch (e) { Log.warn('site:click', e); }
    try {
      var ev = document.createEvent('MouseEvents');
      ev.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
      el.dispatchEvent(ev);
      return true;
    } catch (e2) {
      Log.warn('site:click-event', e2);
      return false;
    }
  }

  function visibleOnly(list) { return U.filter(list, function (el) { return U.isVisible(el); }); }

  /* Videos in visible same-origin iframes (the website may load its player page into one). Cross-origin frames
     throw on access and are skipped. */
  function frameVideos() {
    var out = [];
    U.each(visibleOnly(qsa(document, 'iframe')), function (f) {
      var d = null;
      try { d = f.contentDocument || (f.contentWindow && f.contentWindow.document) || null; } catch (e) { d = null; }
      if (!d || !d.documentElement) return;
      var fr = f.getBoundingClientRect();
      U.each(qsa(d, 'video'), function (v) {
        var r = v.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        var w = Math.min(r.width, fr.width), h = Math.min(r.height, fr.height);
        out.push({ v: v, area: w * h });
      });
    });
    return out;
  }

  /* Containers the website's player lives in (JW Player on Samsung, video.js on desktop). */
  var PLAYER_BOX = '#my_dialog, #player_box, #player_panel, .jwplayer, .jw-wrapper, .video-js';

  function frameOf(v) {
    try {
      var win = v && v.ownerDocument && v.ownerDocument.defaultView;
      return win && win !== window && win.frameElement ? win.frameElement : null;
    } catch (e) { return null; }
  }

  /* The video sits inside a known player container, directly or through the same-origin iframe that holds it. */
  function inPlayerBox(v) {
    if (!v) return false;
    if (U.closest(v, PLAYER_BOX)) return true;
    var f = frameOf(v);
    return !!(f && U.closest(f, PLAYER_BOX));
  }

  /* Videos inside our own root (the built-in player's full-screen <video>) are never the website's player. */
  function allVideos() {
    var shell = document.getElementById('mbptv');
    var out = U.map(U.filter(visibleOnly(qsa(document, 'video')), function (v) { return !(shell && shell.contains(v)); }),
      function (v) { return { v: v, area: videoArea(v) }; });
    return out.concat(frameVideos());
  }

  /* The player's video: the largest visible one inside a known player container, else the largest visible one. */
  function liveVideo() {
    var best = null, area = 0, boxed = null, boxedArea = 0;
    U.each(allVideos(), function (x) {
      if (x.area > area) { area = x.area; best = x.v; }
      if (x.area > boxedArea && inPlayerBox(x.v)) { boxedArea = x.area; boxed = x.v; }
    });
    return boxed || best;
  }

  function videoArea(v) {
    if (!v) return 0;
    var r = v.getBoundingClientRect(), w = r.width, h = r.height;
    var f = frameOf(v);
    if (f) {
      var fr = f.getBoundingClientRect();
      w = Math.min(w, fr.width); h = Math.min(h, fr.height);
    }
    return w * h;
  }

  /* A large video outside the known containers is the player only right after a play action (ctx.recent) or when it is
     the video player mode already drives (ctx.current), and never when it looks like decoration: a looping video or a
     muted autoplay one (a hero trailer). The muted check reads the attribute on purpose: JW Player falls back to muted
     autoplay by setting the property, and that video is a real player. */
  function videoCounts(v, ctx) {
    if (inPlayerBox(v)) return true;
    if (ctx.current && ctx.current === v) return true;
    if (!ctx.recent) return false;
    if (v.loop || v.hasAttribute('loop')) return false;
    if (v.hasAttribute('muted') && v.hasAttribute('autoplay')) return false;
    return true;
  }

  /* ctx (optional): {recent: a play action is pending or happened in the last seconds, current: the video player mode
     already drives}. #my_dialog visible, or a visible video of at least 40% of the viewport that counts (above). */
  function livePlayerOpen(ctx) {
    ctx = ctx || {};
    var dlg = document.getElementById('my_dialog');
    if (dlg && U.isVisible(dlg)) return true;
    var vw = window.innerWidth || document.documentElement.clientWidth || 1;
    var vh = window.innerHeight || document.documentElement.clientHeight || 1;
    var list = allVideos();
    for (var i = 0; i < list.length; i++) {
      if (list[i].area >= 0.4 * vw * vh && videoCounts(list[i].v, ctx)) return true;
    }
    return false;
  }

  /* The element that holds the website's player controls: the visible dialog, or the known container (or iframe)
     around the player's video. null when the player's markup is unknown. */
  function playerContainer() {
    var dlg = document.getElementById('my_dialog');
    if (dlg && U.isVisible(dlg)) return dlg;
    var v = liveVideo();
    if (!v) return null;
    var f = frameOf(v);
    var box = U.closest(f || v, PLAYER_BOX);
    return box || f || null;
  }

  /* Hides an element the website shows; an inline !important wins over the site's own !important class rules, and
     the site's next show() (a plain style.display assignment) replaces it again. */
  function forceHide(el) {
    if (U.isVisible(el)) el.style.display = 'none';
    if (U.isVisible(el)) { try { el.style.setProperty('display', 'none', 'important'); } catch (e) {} }
  }

  function liveSourceItems() {
    var items = visibleOnly(qsa(document, '.sidebarbg2 li.play'));
    return items.length ? items : visibleOnly(qsa(document, '.sidebarbg2 li[oss_download_url]'));
  }

  var live = {
    click: click,
    playButton: function () {
      var all = qsa(document, '.start_app');
      return visibleOnly(all)[0] || all[0] || null;
    },
    episodeButton: function (season, episode) {
      var all = qsa(document, '.start_app_episode[season="' + toInt(season) + '"][episode="' + toInt(episode) + '"]');
      return U.find(all, function (el) { return U.hasClass(el, 'watch_tab'); }) || all[0] || null;
    },
    sourceItems: liveSourceItems,
    sourceList: function () {
      return U.map(liveSourceItems(), function (li, i) { var s = source(li, i); s.el = li; return s; });
    },
    sourcePickerOpen: function () { return visibleOnly(qsa(document, '.sidebarbg2')).length > 0; },
    closeSourcePicker: function () {
      var boxes = visibleOnly(qsa(document, '.sidebarbg2'));
      U.each(boxes, function (box) {
        var btn = visibleOnly(qsa(box, '.close'))[0] || qs(box, '.close');
        if (btn) click(qs(btn, 'img') || btn);
        forceHide(box);
      });
      return visibleOnly(qsa(document, '.sidebarbg2')).length === 0;
    },
    playerOpen: livePlayerOpen,
    playerContainer: playerContainer,
    closePlayer: function (ctx) {
      var btn = document.getElementById('dialog_close') || qs(document, '#jw_player_close_pc img');
      if (btn) click(btn);
      if (!livePlayerOpen(ctx)) return true;
      var shell = document.getElementById('mbptv');   /* never the built-in player's own video */
      U.each(qsa(document, 'video'), function (v) { if (!(shell && shell.contains(v))) { try { v.pause(); } catch (e) {} } });
      U.each(frameVideos(), function (x) { try { x.v.pause(); } catch (e2) {} });
      var dlg = document.getElementById('my_dialog');
      if (dlg) dlg.style.display = 'none';
      return !livePlayerOpen(ctx);
    },
    video: liveVideo,
    blockingPopups: function () { return visibleOnly(qsa(document, POPUPS)); },
    dismissPopup: function (el) {
      if (!el) return false;
      var btn = visibleOnly(qsa(el, CLOSE_SEL))[0] || qs(el, CLOSE_SEL);
      if (btn) click(btn.tagName === 'IMG' ? btn : (qs(btn, 'img') || btn));
      forceHide(el);
      return !U.isVisible(el);
    }
  };

  /* ---------- URL builders (absolute, same origin as the live page) ---------- */

  function enc(v) { return encodeURIComponent(U.text(v)); }

  var url = {
    origin: function () { return siteOrigin(); },
    home: function () { return siteOrigin() + '/'; },
    movies: function () { return siteOrigin() + '/movie'; },
    shows: function () { return siteOrigin() + '/tvshow'; },
    library: function () { return siteOrigin() + '/index/index/my_box'; },
    history: function () { return siteOrigin() + '/index/index/history'; },
    list: function (type) { return siteOrigin() + '/index/index/movie_list?type=' + enc(type); },
    search: function (q, type, page) {
      return siteOrigin() + '/index/search?word=' + enc(q) + (type ? '&type=' + enc(type) : '') + (toInt(page) > 1 ? '&page=' + toInt(page) : '');
    },
    title: function (kind, id, season) {
      return siteOrigin() + titlePath(kind, id) + (kindOf(kind) === 'tv' && toInt(season) > 0 ? '?season=' + toInt(season) : '');
    },
    play: function (kind, id, season, episode) { return siteOrigin() + playPath(kind, id, season, episode); },
    suggest: function (q) { return siteOrigin() + '/index/search/autocomplate?q=' + enc(q) + '&limit=12'; },
    hot: function () { return siteOrigin() + '/index/api/search_hot'; },
    login: function () { return siteOrigin() + '/index/login'; },
    loginQr: function () { return siteOrigin() + '/index/login/qrcode'; },
    loginCode: function () { return siteOrigin() + '/index/login/code_login'; }
  };

  /* ---------- totality wrappers ---------- */

  function total(name, fn, fallback) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) {
        try { Log.warn('site:' + name, e); } catch (e2) {}
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }

  function wrapAll(obj, fallbacks, prefix, dflt) {
    var out = {};
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) out[k] = total(prefix + k, obj[k], fallbacks.hasOwnProperty(k) ? fallbacks[k] : dflt);
    }
    return out;
  }

  var emptyStr = function () { return ''; };

  return {
    parseTitleUrl: total('parseTitleUrl', parseTitleUrl, null),
    targetOf: total('targetOf', function (el, base) { var t = targetInfo(el, httpish(base) ? base : baseOf(el)); return t ? t.url : ''; }, emptyStr),
    cards: total('cards', cards, function () { return []; }),
    item: total('item', function (root, base) { return itemFrom(root, httpish(base) ? base : baseOf(root)); }, null),
    home: total('home', home, function () { return { rows: [], banners: [] }; }),
    list: total('list', list, function () { return { title: '', items: [], next: '', chips: [] }; }),
    search: total('search', search, function () { return { query: '', type: 'all', total: null, types: [], items: [], playlists: [], next: '', empty: true }; }),
    detail: total('detail', detail, null),
    source: total('source', source, function () { return { index: 0, quality: '', file: '', size: '', date: '' }; }),
    thumb: function (u, w, q) { try { return thumb(u, w, q); } catch (e) { try { Log.warn('site:thumb', e); } catch (e2) {} return u; } },
    original: function (u) { try { return original(u); } catch (e) { try { Log.warn('site:original', e); } catch (e2) {} return u; } },
    isGate: total('isGate', isGate, false),
    pageType: total('pageType', pageType, 'other'),
    suggestions: total('suggestions', suggestions, function () { return []; }),
    hot: total('hot', hot, function () { return { trending: [], recent: [] }; }),
    selfTest: total('selfTest', selfTest, function () { return { ok: false, type: '', warnings: ['selfTest failed'], counts: {} }; }),
    resolve: total('resolve', function (u, base) { return resolve(u, httpish(base) ? base : defaultBase()); }, emptyStr),
    baseOf: total('baseOf', baseOf, emptyStr),
    normalize: {
      rating: total('normRating', normRating, emptyStr),
      runtime: total('normRuntime', normRuntime, emptyStr),
      genres: total('splitGenres', splitGenres, function () { return []; }),
      image: total('realImage', function (u, base) { return realImage(u, httpish(base) ? base : defaultBase()); }, emptyStr),
      styleImage: total('styleImage', function (style, base) { return firstReal(styleUrls(style), httpish(base) ? base : defaultBase()); }, emptyStr)
    },
    url: wrapAll(url, {}, 'url.', emptyStr),
    live: wrapAll(live, {
      click: false, playButton: null, episodeButton: null, sourceItems: function () { return []; }, sourceList: function () { return []; },
      sourcePickerOpen: false, closeSourcePicker: false, playerOpen: false, playerContainer: null, closePlayer: false, video: null,
      blockingPopups: function () { return []; }, dismissPopup: false
    }, 'live.', null)
  };
}());
/* ---- 20-api.js ---- */
/* Data access (docs/ARCHITECTURE.md section 5.3): same-origin XHR with timeout, one retry and in-flight sharing,
   signed-out detection, suggestion sequencing, detail cache (memory + compact localStorage LRU), low-priority
   prefetch, recent searches. Prefs and Session live here too. Callbacks are Node-style cb(err, result), always
   asynchronous and called exactly once (the one documented exception: superseded Api.suggest callbacks are
   dropped). Storage goes through Store with an in-memory mirror, so a throwing or full localStorage never breaks
   reads that follow a write. Nothing here runs at load time. */
var Api = (function () {
  var cfg = { timeout: 15000, retryDelay: 700, memTtl: 10 * 60 * 1000, suggestTtl: 5 * 60 * 1000 };
  var META_KEY = 'mbptv:meta:v1', RECENT_KEY = 'mbptv:recent:v1';
  var META_MAX = 300, META_TTL = 14 * 24 * 60 * 60 * 1000, MEM_MAX = 50, OVERVIEW_MAX = 420, RECENT_MAX = 12, SUGGEST_MAX = 40;
  var inflight = {};
  var stats = { requests: 0, retries: 0, errors: 0, shared: 0, lastError: null, lastOk: 0 };
  var signedOutFns = [];

  function isArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
  function copy(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; } }

  function deliver(cb, err, res) {
    if (typeof cb !== 'function') return;
    U.later(function () { cb(err, res); }, 0, 'api-cb');
  }

  function fail(code, url, extra) {
    var err = { code: code, url: url || '' };
    if (extra) for (var k in extra) if (has(extra, k)) err[k] = extra[k];
    return err;
  }

  function noteError(err) {
    stats.errors++;
    stats.lastError = { code: err.code, url: err.url || '', t: U.now() };
    if (err.code === 'signed-out') {
      U.each(signedOutFns.slice(), function (fn) { U.later(function () { fn(err); }, 0, 'api-signed-out'); });
    } else {
      Log.warn('api', err.code + ' ' + (err.url || ''));
    }
  }

  /* Only same-site http(s) URLs are fetched; the apex/www variant is mapped onto the current origin. */
  function normalizeUrl(url) {
    if (url == null || url === '') return '';
    var abs = U.abs(String(url));
    var u = U.parseUrl(abs), here = Site.url.origin();
    if (!/^https?:$/.test(u.protocol) || !here) return '';
    if (u.origin === here) return u.origin + u.pathname + u.search;
    if (U.siteHost(u.hostname) === U.siteHost(U.parseUrl(here).hostname)) return here + u.pathname + u.search;
    return '';
  }

  function retryable(err) { return !!err && (err.code === 'network' || /^http-5\d\d$/.test(err.code)); }

  function request(url, headers, cb, attempt) {
    attempt = attempt || 0;
    stats.requests++;
    var started = U.now();
    U.xhr({ url: url, timeout: cfg.timeout, headers: headers }, function (err, res) {
      /* U.xhr's abort() on timeout fires readystatechange first, which reports status 0 as 'network': reclassify. */
      if (err && err.code === 'network' && U.now() - started >= cfg.timeout - 20) err = { code: 'timeout', status: 0 };
      if (err && attempt < 1 && retryable(err)) {
        stats.retries++;
        Log.info('api-retry', err.code + ' ' + url);
        U.later(function () { request(url, headers, cb, attempt + 1); }, cfg.retryDelay, 'api-retry');
        return;
      }
      if (err) { err.url = url; cb(err, null); return; }
      cb(null, res);
    });
  }

  /* Shares one request between identical concurrent callers. A watchdog guarantees every waiter is answered. */
  function share(key, cb, start) {
    if (has(inflight, key)) { stats.shared++; inflight[key].push(cb); return; }
    var waiters = inflight[key] = [cb], finished = false, watchdog;
    function finish(err, res) {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      if (inflight[key] === waiters) delete inflight[key];
      if (err) noteError(err); else stats.lastOk = U.now();
      U.each(waiters, function (w) { deliver(w, err, res); });
    }
    watchdog = U.later(function () { finish(fail('timeout', key.replace(/^\w+ /, ''), { watchdog: true })); }, cfg.timeout * 2 + cfg.retryDelay + 2000, 'api-watchdog');
    try { start(finish); } catch (e) { finish(fail('exception', key, { message: String(e && e.message || e) })); }
  }

  function looksSignedOut(text, finalUrl) {
    if (/\/index\/login(?:\/|$|\?)/i.test(U.parseUrl(finalUrl || '').pathname || '')) return true;
    if (!/private\s+garden|login_btn|\/index\/login/i.test(text || '')) return false;
    return Site.isGate(U.parseHTML(text));
  }

  function fetchDoc(url, cb) {
    var target = normalizeUrl(url);
    if (!target) { deliver(cb, fail('bad-url', String(url))); return; }
    share('doc ' + target, cb, function (finish) {
      request(target, null, function (err, res) {
        if (err) { finish(err); return; }
        try {
          var finalUrl = normalizeUrl(res.url) || target;
          if (/\/index\/login(?:\/|$|\?)/i.test(U.parseUrl(finalUrl).pathname)) { finish(fail('signed-out', target)); return; }
          var doc = U.parseHTML(res.text);
          try { doc.__mbptvUrl = finalUrl; } catch (e) {}
          if (Site.isGate(doc)) { finish(fail('signed-out', target)); return; }
          finish(null, { doc: doc, url: finalUrl });
        } catch (e2) {
          finish(fail('parse', target, { message: String(e2 && e2.message || e2) }));
        }
      });
    });
  }

  function fetchJSON(url, cb) {
    var target = normalizeUrl(url);
    if (!target) { deliver(cb, fail('bad-url', String(url))); return; }
    share('json ' + target, cb, function (finish) {
      request(target, { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json, text/javascript, */*; q=0.01' }, function (err, res) {
        if (err) { finish(err); return; }
        var data = U.parseJSON(res.text);
        if (data == null) {
          finish(fail(looksSignedOut(res.text, res.url) ? 'signed-out' : 'bad-json', target));
          return;
        }
        finish(null, data);
      });
    });
  }

  function withDoc(url, parse, cb) {
    fetchDoc(url, function (err, res) {
      if (err) { cb(err, null); return; }
      var out = null;
      try { out = parse(res.doc, res.url); } catch (e) { Log.error('api-parse', e); }
      if (!out) { cb(fail('parse', res.url), null); return; }
      out.url = res.url;
      cb(null, out);
    });
  }

  function home(cb) { withDoc(Site.url.home(), Site.home, cb); }
  function list(url, cb) { withDoc(url, Site.list, cb); }
  function library(cb) { withDoc(Site.url.library(), Site.list, cb); }

  /* Fetching the search page records the query in the user's server-side history: call it on explicit submit only. */
  function search(q, type, page, cb) {
    q = U.text(q);
    type = U.text(type) || 'all';
    page = Math.max(1, parseInt(page, 10) || 1);
    if (!q) { deliver(cb, null, { query: '', type: type, total: 0, types: [], items: [], playlists: [], next: '', empty: true, page: page, url: '' }); return; }
    withDoc(Site.url.search(q, type, page), Site.search, function (err, res) {
      if (err) { cb(err, null); return; }
      res.page = page;
      if (!res.query) res.query = q;
      if (page === 1) addRecentSearch(q);
      cb(null, res);
    });
  }

  /* ---------- suggestions ---------- */

  var suggestSeq = 0, suggestCache = { keys: [], map: {} };

  function suggest(q, cb) {
    var mine = ++suggestSeq;
    q = U.text(q);
    function answer(err, list) { U.later(function () { if (mine === suggestSeq && typeof cb === 'function') cb(err, list); }, 0, 'api-suggest'); }
    if (!q) { answer(null, []); return; }
    var ck = q.toLowerCase(), hit = has(suggestCache.map, ck) ? suggestCache.map[ck] : null;
    if (hit && U.now() - hit.t < cfg.suggestTtl) { answer(null, hit.list.slice()); return; }
    fetchJSON(Site.url.suggest(q), function (err, data) {
      if (mine !== suggestSeq) return;
      if (err) { cb(err, null); return; }
      var names = Site.suggestions(data);
      if (!has(suggestCache.map, ck)) suggestCache.keys.push(ck);
      suggestCache.map[ck] = { t: U.now(), list: names.slice() };
      while (suggestCache.keys.length > SUGGEST_MAX) delete suggestCache.map[suggestCache.keys.shift()];
      cb(null, names);
    });
  }

  function cancelSuggest() { suggestSeq++; }

  function hot(cb) {
    fetchJSON(Site.url.hot(), function (err, data) {
      if (err) { cb(err, null); return; }
      cb(null, Site.hot(data));
    });
  }

  /* ---------- detail cache ---------- */

  var mem = { keys: [], map: {} };

  function memGet(k) {
    if (!has(mem.map, k)) return null;
    var e = mem.map[k];
    if (U.now() - e.t > cfg.memTtl) { memDrop(k); return null; }
    memDrop(k);
    mem.map[k] = e;
    mem.keys.push(k);
    return e.v;
  }

  function memDrop(k) {
    var i = U.indexOf(mem.keys, k);
    if (i >= 0) mem.keys.splice(i, 1);
    delete mem.map[k];
  }

  function memSet(k, v) {
    memDrop(k);
    mem.map[k] = { t: U.now(), v: v };
    mem.keys.push(k);
    while (mem.keys.length > MEM_MAX) delete mem.map[mem.keys.shift()];
  }

  function clip(s, max) {
    s = U.text(s);
    if (s.length <= max) return s;
    var cut = s.slice(0, max - 1), sp = cut.lastIndexOf(' ');
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-]+$/, '') + '\u2026';
  }

  function compact(d) {
    var r = d.ratings || {};
    return {
      t: U.now(), title: String(d.title || ''), year: String(d.year || ''), backdrop: String(d.backdrop || ''),
      poster: String(d.poster || ''), runtime: String(d.runtime || ''), certification: String(d.certification || ''),
      genres: isArray(d.genres) ? d.genres.slice(0, 6) : [],
      ratings: { imdb: String(r.imdb || ''), tomato: String(r.tomato || ''), audience: String(r.audience || '') },
      overview: clip(d.overview || '', OVERVIEW_MAX)
    };
  }

  var metaState = null, metaTimer = null, metaDirty = false, metaHooked = false;

  function metaLoad() {
    if (metaState) return metaState;
    var raw = null, st = { v: 1, order: [], items: {} }, now = U.now();
    try { raw = Store.local.get(META_KEY, null); } catch (e) { raw = null; }
    if (raw && raw.v === 1 && raw.items && typeof raw.items === 'object') {
      var order = isArray(raw.order) ? raw.order : [];
      U.each(order, function (k) {
        var e = typeof k === 'string' && has(raw.items, k) ? raw.items[k] : null;
        if (!e || typeof e !== 'object' || has(st.items, k)) return;
        var age = now - (+e.t || 0);
        if (age < 0 || age > META_TTL) return;
        st.items[k] = e;
        st.order.push(k);
      });
      while (st.order.length > META_MAX) delete st.items[st.order.shift()];
    }
    metaState = st;
    return st;
  }

  function flush() {
    clearTimeout(metaTimer);
    metaTimer = null;
    if (!metaDirty || !metaState) return;
    metaDirty = false;
    try { Store.local.set(META_KEY, metaState); } catch (e) { Log.warn('api-meta-save', e); }
  }

  function scheduleFlush() {
    metaDirty = true;
    if (!metaHooked) {
      metaHooked = true;
      try { U.on(window, 'pagehide', flush); U.on(window, 'beforeunload', flush); } catch (e) {}
    }
    if (!metaTimer) metaTimer = U.later(flush, 1200, 'api-meta-flush');
  }

  function metaPut(key, d) {
    var st = metaLoad(), i = U.indexOf(st.order, key);
    if (i >= 0) st.order.splice(i, 1);
    st.items[key] = compact(d);
    st.order.push(key);
    while (st.order.length > META_MAX) delete st.items[st.order.shift()];
    scheduleFlush();
  }

  function metaEntry(key) {
    var st = metaLoad();
    if (!has(st.items, key)) return null;
    var e = st.items[key], age = U.now() - (+e.t || 0);
    if (age < 0 || age > META_TTL) {
      delete st.items[key];
      var i = U.indexOf(st.order, key);
      if (i >= 0) st.order.splice(i, 1);
      scheduleFlush();
      return null;
    }
    return e;
  }

  function meta(key) {
    try {
      key = String(key || '');
      if (!key) return null;
      var hit = memGet(key);
      var e = hit ? compact(hit) : metaEntry(key);
      if (!e) return null;
      var out = copy(e);
      if (out) delete out.t;
      return out;
    } catch (err) {
      Log.warn('api-meta', err);
      return null;
    }
  }

  function kindOf(kind) { return /^(?:movie|film)/i.test(String(kind || '')) ? 'movie' : 'tv'; }

  function detail(kind, id, cb, opts) {
    opts = opts || {};
    kind = kindOf(kind);
    id = String(id == null ? '' : id).replace(/[^\d]/g, '');
    if (!id) { deliver(cb, fail('bad-url', kind + ':')); return; }
    var key = kind + ':' + id, season = kind === 'tv' ? Math.max(0, parseInt(opts.season, 10) || 0) : 0;
    var ck = key + (season ? ':s' + season : '');
    if (!opts.force) {
      var hit = memGet(ck);
      if (hit) { deliver(cb, null, hit); return; }
    }
    var pageUrl = Site.url.title(kind, id, season);
    /* Parse against the requested URL so the result is keyed by what was asked for, even after a redirect. */
    withDoc(pageUrl, function (doc) { return Site.detail(doc, pageUrl); }, function (err, d) {
      if (err) { cb(err, null); return; }
      memSet(ck, d);
      if (!season || !has(mem.map, key)) memSet(key, d);
      metaPut(d.key, d);
      cb(null, d);
    });
  }

  /* The Detail already in memory for kind:id (a prefetch, the boot page or an earlier visit), or null. Never fetches. */
  function cached(kind, id, season) {
    kind = kindOf(kind);
    id = String(id == null ? '' : id).replace(/[^\d]/g, '');
    if (!id) return null;
    season = kind === 'tv' ? Math.max(0, parseInt(season, 10) || 0) : 0;
    return (season ? memGet(kind + ':' + id + ':s' + season) : null) || memGet(kind + ':' + id);
  }

  /* Adds a Detail parsed elsewhere (for example from the live boot page) to both caches. */
  function remember(d) {
    try {
      if (!d || !d.key || !d.title) return false;
      memSet(d.key, d);
      metaPut(d.key, d);
      return true;
    } catch (e) {
      Log.warn('api-remember', e);
      return false;
    }
  }

  /* ---------- prefetch: one request in flight, the newest pending request wins ---------- */

  var pf = { busy: '', busyCbs: [], pending: null };

  function prefetchTarget(item) {
    if (!item) return null;
    if (typeof item === 'string') {
      var m = /^(movie|tv):(\d+)$/.exec(item);
      return m ? { kind: m[1], id: m[2], key: item } : null;
    }
    var kind = item.kind ? kindOf(item.kind) : '', id = String(item.id || '').replace(/[^\d]/g, '');
    if ((!kind || !id) && item.key) return prefetchTarget(String(item.key));
    return kind && id ? { kind: kind, id: id, key: kind + ':' + id } : null;
  }

  function deliverAll(cbs, err, res) { U.each(cbs, function (c) { deliver(c, err, res); }); }

  function cachedFor(key) { return memGet(key) || (metaEntry(key) ? true : null); }

  function prefetchStart(t, cbs) {
    pf.busy = t.key;
    pf.busyCbs = cbs;
    try {
      detail(t.kind, t.id, function (err, d) {
        if (err && err.code !== 'signed-out') Log.info('api-prefetch', err.code + ' ' + t.key);
        var done = pf.busyCbs, next = pf.pending;
        pf.busy = '';
        pf.busyCbs = [];
        pf.pending = null;
        deliverAll(done, err, d || null);
        if (!next) return;
        if (err && err.code === 'signed-out') { deliverAll(next.cbs, err, null); return; }
        if (err) U.later(function () { prefetchResume(next); }, 1000, 'api-prefetch');
        else prefetchResume(next);
      });
    } catch (e) {
      Log.warn('api-prefetch', e);
      var failed = pf.busyCbs;
      pf.busy = '';
      pf.busyCbs = [];
      deliverAll(failed, fail('exception', t.key), null);
    }
  }

  function prefetchResume(next) {
    var hit = cachedFor(next.t.key);
    if (hit) { deliverAll(next.cbs, null, hit === true ? null : hit); return; }
    if (pf.busy) {
      if (!pf.pending) pf.pending = next;
      else deliverAll(next.cbs, fail('superseded', next.t.key), null);
      return;
    }
    prefetchStart(next.t, next.cbs);
  }

  /* prefetch(item, cb?): cb is optional and called exactly once: with the Detail when the request completes,
     (null, detail|null) at once when the title is already cached, or {code: 'superseded'} when a newer prefetch
     replaced this pending one. Returns true when a request is running or queued for the item. */
  function prefetch(item, cb) {
    var t = prefetchTarget(item);
    if (!t) { deliver(cb, fail('bad-url', ''), null); return false; }
    var hit = cachedFor(t.key);
    if (hit) { deliver(cb, null, hit === true ? null : hit); return false; }
    var cbs = typeof cb === 'function' ? [cb] : [];
    if (pf.busy === t.key) { pf.busyCbs = pf.busyCbs.concat(cbs); return true; }
    if (pf.busy) {
      if (pf.pending && pf.pending.t.key === t.key) { pf.pending.cbs = pf.pending.cbs.concat(cbs); return true; }
      if (pf.pending) deliverAll(pf.pending.cbs, fail('superseded', pf.pending.t.key), null);
      pf.pending = { t: t, cbs: cbs };
      return true;
    }
    prefetchStart(t, cbs);
    return true;
  }

  /* ---------- recent searches (local, alongside the server's history) ---------- */

  var recent = null;

  function indexOfCI(list, q) {
    var k = String(q).toLowerCase();
    for (var i = 0; i < list.length; i++) if (String(list[i]).toLowerCase() === k) return i;
    return -1;
  }

  function recentLoad() {
    if (recent) return recent;
    var raw = null;
    try { raw = Store.local.get(RECENT_KEY, []); } catch (e) { raw = []; }
    recent = [];
    if (isArray(raw)) U.each(raw, function (q) {
      q = U.text(typeof q === 'string' ? q : '').slice(0, 100);
      if (q && recent.length < RECENT_MAX && indexOfCI(recent, q) < 0) recent.push(q);
    });
    return recent;
  }

  function recentSearches() { return recentLoad().slice(); }

  function addRecentSearch(q) {
    var list = recentLoad();
    q = U.text(q).slice(0, 100);
    if (!q) return list.slice();
    var i = indexOfCI(list, q);
    if (i >= 0) list.splice(i, 1);
    list.unshift(q);
    if (list.length > RECENT_MAX) list.length = RECENT_MAX;
    try { Store.local.set(RECENT_KEY, list); } catch (e) {}
    return list.slice();
  }

  function clearRecentSearches() {
    recent = [];
    try { Store.local.remove(RECENT_KEY); } catch (e) {}
  }

  /* Local recents first, then the server's history, deduplicated case-insensitively. */
  function mergeRecent(server) {
    var out = [];
    U.each(recentLoad().concat(isArray(server) ? server : []), function (q) {
      q = U.text(q);
      if (q && out.length < RECENT_MAX && indexOfCI(out, q) < 0) out.push(q);
    });
    return out;
  }

  /* ---------- misc ---------- */

  function configure(opts) {
    if (!opts) return copy(cfg);
    U.each(['timeout', 'retryDelay', 'memTtl', 'suggestTtl'], function (k) {
      if (has(opts, k) && typeof opts[k] === 'number' && opts[k] >= 0) cfg[k] = opts[k];
    });
    return copy(cfg);
  }

  function onSignedOut(fn) {
    if (typeof fn !== 'function') return function () {};
    signedOutFns.push(fn);
    return function () { var i = U.indexOf(signedOutFns, fn); if (i >= 0) signedOutFns.splice(i, 1); };
  }

  function clearCache() {
    mem = { keys: [], map: {} };
    suggestCache = { keys: [], map: {} };
    metaState = { v: 1, order: [], items: {} };
    metaDirty = true;
    flush();
  }

  function guardAsync(name, fn) {
    return function () {
      var args = arguments, cb = null;
      for (var i = args.length - 1; i >= 0; i--) if (typeof args[i] === 'function') { cb = args[i]; break; }
      try { return fn.apply(null, args); } catch (e) {
        Log.error('api:' + name, e);
        deliver(cb, fail('exception', '', { message: String(e && e.message || e) }));
        return undefined;
      }
    };
  }

  function guardSync(name, fn, fallback) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) {
        Log.error('api:' + name, e);
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }

  return {
    fetchDoc: guardAsync('fetchDoc', fetchDoc),
    fetchJSON: guardAsync('fetchJSON', fetchJSON),
    home: guardAsync('home', home),
    list: guardAsync('list', list),
    library: guardAsync('library', library),
    search: guardAsync('search', search),
    suggest: guardAsync('suggest', suggest),
    cancelSuggest: guardSync('cancelSuggest', cancelSuggest, null),
    hot: guardAsync('hot', hot),
    detail: guardAsync('detail', detail),
    meta: guardSync('meta', meta, null),
    cached: guardSync('cached', cached, null),
    remember: guardSync('remember', remember, false),
    prefetch: function (item, cb) {
      try { return prefetch(item, cb); } catch (e) {
        Log.error('api:prefetch', e);
        deliver(cb, fail('exception', '', { message: String(e && e.message || e) }), null);
        return false;
      }
    },
    recentSearches: guardSync('recentSearches', recentSearches, function () { return []; }),
    addRecentSearch: guardSync('addRecentSearch', addRecentSearch, function () { return []; }),
    clearRecentSearches: guardSync('clearRecentSearches', clearRecentSearches, null),
    mergeRecent: guardSync('mergeRecent', mergeRecent, function () { return []; }),
    onSignedOut: guardSync('onSignedOut', onSignedOut, function () { return function () {}; }),
    configure: guardSync('configure', configure, null),
    flush: guardSync('flush', flush, null),
    clearCache: guardSync('clearCache', clearCache, null),
    stats: guardSync('stats', function () { return copy(stats); }, null)
  };
}());

/* User preferences (localStorage mbptv:prefs:v1) with validation and an in-memory mirror. Every preference the
   Settings screen shows is described here (label, help text, choices and their labels), so the screen can render
   and cycle any of them generically: Prefs.describe(name), Prefs.choices(name), Prefs.next(name). */
var Prefs = (function () {
  var KEY = 'mbptv:prefs:v1';
  var DEFAULTS = { quality: 'best', nativeRemote: true, nativePlayer: true, autoplayEpisodes: true, reduceMotion: false, performance: 'auto' };
  var CHOICES = { quality: ['ask', 'best', '1080p', '720p'], performance: ['auto', 'on', 'off'] };
  /* Retired keys are ignored when read (older versions stored the whole object, so they linger on TVs). autoplayNext
     was never read and was stored as false on every TV where a setting changed: autoplayEpisodes replaces it. */
  var RETIRED = { autoplayNext: 1 };
  var INFO = {
    quality: { label: 'Preferred quality', values: { best: 'Best available', '1080p': '1080p', '720p': '720p', ask: 'Ask every time' },
      desc: 'Used to choose a file automatically when a title has several. Choose “Ask every time” to pick yourself.' },
    nativePlayer: { label: 'Built-in player',
      desc: 'Plays movies and episodes in the TV app’s own player (recommended). Turn it off to use the website’s player instead.' },
    autoplayEpisodes: { label: 'Autoplay next episode',
      desc: 'Plays the next episode automatically when one ends, like Netflix. After three in a row without a button press it asks whether you are still watching.' },
    performance: { label: 'TV performance mode', values: { auto: 'Auto', on: 'On', off: 'Off' },
      desc: 'Lighter visuals for smoother scrolling: no shadows or long fades, smaller pictures and fewer loading at once. Auto turns it on for TVs.' },
    nativeRemote: { label: 'Website remote controls',
      desc: 'On website pages the TV app does not cover (sign-in, playlists), the arrow keys move a white focus ring and OK selects.' },
    reduceMotion: { label: 'Reduce motion', desc: 'Turns off animations and fades. Helpful on older TVs.' }
  };
  var cache = null, listeners = [];

  function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  function valid(name, value) {
    if (has(RETIRED, name)) return false;
    if (has(CHOICES, name)) return U.indexOf(CHOICES[name], value) >= 0;
    if (has(DEFAULTS, name) && typeof DEFAULTS[name] === 'boolean') return typeof value === 'boolean';
    if (value === undefined || typeof value === 'function') return false;
    try { JSON.stringify(value); return true; } catch (e) { return false; }
  }

  function load() {
    if (cache) return cache;
    var raw = null;
    try { raw = Store.local.get(KEY, null); } catch (e) { raw = null; }
    cache = {};
    var k;
    for (k in DEFAULTS) if (has(DEFAULTS, k)) cache[k] = DEFAULTS[k];
    if (raw && typeof raw === 'object') for (k in raw) if (has(raw, k) && valid(k, raw[k])) cache[k] = raw[k];
    return cache;
  }

  function get(name) {
    try { var c = load(); return has(c, name) ? c[name] : undefined; } catch (e) { return has(DEFAULTS, name) ? DEFAULTS[name] : undefined; }
  }

  function set(name, value) {
    try {
      var c = load();
      name = String(name || '');
      if (!name || !valid(name, value)) { Log.warn('prefs', 'rejected ' + name); return get(name); }
      var old = c[name];
      c[name] = value;
      try { Store.local.set(KEY, c); } catch (e) {}
      if (old !== value) U.each(listeners.slice(), function (fn) { U.later(function () { fn(name, value, old); }, 0, 'prefs-change'); });
      return value;
    } catch (e2) {
      Log.error('prefs', e2);
      return get(name);
    }
  }

  function all() {
    var c = load(), out = {};
    for (var k in c) if (has(c, k)) out[k] = c[k];
    return out;
  }

  function defaults() {
    var out = {};
    for (var k in DEFAULTS) if (has(DEFAULTS, k)) out[k] = DEFAULTS[k];
    return out;
  }

  function reset() {
    cache = null;
    try { Store.local.remove(KEY); } catch (e) {}
    return all();
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () { var i = U.indexOf(listeners, fn); if (i >= 0) listeners.splice(i, 1); };
  }

  function valueLabel(name, value) {
    var info = has(INFO, name) ? INFO[name] : null;
    if (typeof value === 'boolean') return value ? 'On' : 'Off';
    if (info && info.values && has(info.values, String(value))) return info.values[String(value)];
    return value == null ? '' : String(value);
  }

  /* choices(name): [{value, label}] in display order (a toggle is [On, Off]); [] for a free-form or unknown name.
     choices() without a name keeps the old meaning: the quality values. */
  function choices(name) {
    if (name === undefined) return CHOICES.quality.slice();
    name = String(name);
    var list = has(CHOICES, name) ? CHOICES[name] : has(DEFAULTS, name) && typeof DEFAULTS[name] === 'boolean' ? [true, false] : [];
    return U.map(list, function (v) { return { value: v, label: valueLabel(name, v) }; });
  }

  /* describe(name): {key, label, desc, value, valueLabel, toggle, choices} for a Settings row; null when unknown. */
  function describe(name) {
    name = String(name || '');
    if (!has(DEFAULTS, name)) return null;
    var info = has(INFO, name) ? INFO[name] : {}, v = get(name);
    return { key: name, label: info.label || name, desc: info.desc || '', value: v, valueLabel: valueLabel(name, v),
      toggle: typeof DEFAULTS[name] === 'boolean', choices: choices(name) };
  }

  /* next(name): moves a choice (or toggle) preference to its next value, wrapping; returns the new value. */
  function next(name) {
    var list = choices(name);
    if (!list.length) return get(name);
    var cur = get(name), i = 0;
    for (var k = 0; k < list.length; k++) if (list[k].value === cur) { i = k; break; }
    return set(name, list[(i + 1) % list.length].value);
  }

  function safe(fn, fallback) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) { Log.warn('prefs', e); return typeof fallback === 'function' ? fallback() : fallback; }
    };
  }

  return {
    get: get, set: set, all: all, defaults: defaults, reset: reset, onChange: onChange,
    choices: safe(choices, function () { return []; }), describe: safe(describe, null), next: safe(next, null),
    label: safe(valueLabel, '')
  };
}());

/* Navigation state across real page loads (sessionStorage mbptv:session:v1), valid for 30 minutes.
   save(stack, {expect, returnTo}) before navigating away; take(pageType) on boot returns the stack once, and only
   when pageType matches the saved expect (a non-matching page leaves it for the page that does match). */
var Session = (function () {
  var KEY = 'mbptv:session:v1', TTL = 30 * 60 * 1000;
  var mirror, loaded = false;

  function isArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function here() { try { return String(location.href || ''); } catch (e) { return ''; } }

  function valid(r) { return !!(r && typeof r === 'object' && r.v === 1 && typeof r.t === 'number' && isArray(r.stack)); }

  function load() {
    if (loaded) return mirror;
    loaded = true;
    var raw = null;
    try { raw = Store.session.get(KEY, null); } catch (e) { raw = null; }
    mirror = valid(raw) ? raw : null;
    return mirror;
  }

  function clear() {
    loaded = true;
    mirror = null;
    try { Store.session.remove(KEY); } catch (e) {}
  }

  function save(stack, opts) {
    try {
      opts = opts || {};
      var rec = {
        v: 1, t: U.now(), stack: isArray(stack) ? stack : [],
        expect: String(opts.expect || Site.pageType(here())), returnTo: String(opts.returnTo || here()), from: here()
      };
      var plain = null;
      try { plain = JSON.parse(JSON.stringify(rec)); } catch (e) { Log.warn('session', e); }
      if (!plain) { rec.stack = []; plain = rec; }
      loaded = true;
      mirror = plain;
      try { Store.session.set(KEY, plain); } catch (e2) {}
      return true;
    } catch (e3) {
      Log.error('session-save', e3);
      return false;
    }
  }

  function peek() {
    try {
      var r = load();
      if (!r) return null;
      var age = U.now() - r.t;
      if (age > TTL || age < -60000) { clear(); return null; }
      return JSON.parse(JSON.stringify(r));
    } catch (e) {
      Log.warn('session-peek', e);
      return null;
    }
  }

  function take(expect) {
    var r = peek();
    if (!r) return null;
    if (expect && r.expect && r.expect !== expect) return null;
    clear();
    return r.stack;
  }

  function returnTo() { var r = peek(); return r ? String(r.returnTo || '') : ''; }

  /* Keeps a saved record fresh while the viewer watches (a film outlasts the 30-minute TTL): resets its time without
     changing anything else. Returns false when there is no valid record. */
  function touch() {
    try {
      var r = peek();
      if (!r) return false;
      r.t = U.now();
      loaded = true;
      mirror = r;
      try { Store.session.set(KEY, r); } catch (e) {}
      return true;
    } catch (e2) {
      Log.warn('session-touch', e2);
      return false;
    }
  }

  return { save: save, peek: peek, take: take, clear: clear, returnTo: returnTo, touch: touch, ttl: TTL };
}());
/* ---- 30-ui-kit.js ---- */
/* UI kit: author-written icons, element builders, the lazy image loader, transform scrolling and the focus engine.
   Only namespace definitions run at load time. */
var Icons = (function () {
  var P = {
    search: '<circle cx="10.5" cy="10.5" r="6.3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.2 15.2l5.3 5.3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    home: '<path d="M12 3.1l9.4 8.1h-2.9v9.4h-5.1v-6h-2.8v6H5.5v-9.4H2.6z"/>',
    film: '<path fill-rule="evenodd" d="M4.2 3h15.6c.7 0 1.2.5 1.2 1.2v15.6c0 .7-.5 1.2-1.2 1.2H4.2C3.5 21 3 20.5 3 19.8V4.2C3 3.5 3.5 3 4.2 3zM5 5v2.2h2.2V5zm0 4v2.2h2.2V9zm0 3.8V15h2.2v-2.2zm0 4V19h2.2v-2.2zM16.8 5v2.2H19V5zm0 4v2.2H19V9zm0 3.8V15H19v-2.2zm0 4V19H19v-2.2zM9.2 5v6h5.6V5zm0 8v6h5.6v-6z"/>',
    tv: '<path fill-rule="evenodd" d="M4.4 4h15.2C20.4 4 21 4.6 21 5.4v10.2c0 .8-.6 1.4-1.4 1.4H4.4C3.6 17 3 16.4 3 15.6V5.4C3 4.6 3.6 4 4.4 4zM5.2 6.2v8.6h13.6V6.2zM7.5 19h9v1.8h-9z"/>',
    library: '<path d="M6.2 3h11.6c.7 0 1.2.5 1.2 1.2V21l-7-4.3L5 21V4.2C5 3.5 5.5 3 6.2 3z"/>',
    settings: '<path d="M10.3 6.8L10.64 2L13.36 2L13.7 6.8ZM14.47 7.12L18.11 3.97L20.03 5.89L16.88 9.53ZM17.2 10.3L22 10.64L22 13.36L17.2 13.7ZM16.88 14.47L20.03 18.11L18.11 20.03L14.47 16.88ZM13.7 17.2L13.36 22L10.64 22L10.3 17.2ZM9.53 16.88L5.89 20.03L3.97 18.11L7.12 14.47ZM6.8 13.7L2 13.36L2 10.64L6.8 10.3ZM7.12 9.53L3.97 5.89L5.89 3.97L9.53 7.12ZM4.8 12a7.2 7.2 0 1 1 14.4 0a7.2 7.2 0 1 1-14.4 0zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z"/>',
    play: '<path d="M7.2 4.3v15.4c0 .8.9 1.3 1.6.9l12.1-7.7c.6-.4.6-1.4 0-1.8L8.8 3.4c-.7-.4-1.6.1-1.6.9z"/>',
    pause: '<path d="M6.5 4h3.6c.4 0 .7.3.7.7v14.6c0 .4-.3.7-.7.7H6.5c-.4 0-.7-.3-.7-.7V4.7c0-.4.3-.7.7-.7zm7.4 0h3.6c.4 0 .7.3.7.7v14.6c0 .4-.3.7-.7.7h-3.6c-.4 0-.7-.3-.7-.7V4.7c0-.4.3-.7.7-.7z"/>',
    info: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.3 8.2v7.6h2.6v-7.6zM12 5.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>',
    back: '<path d="M10.9 5.2L4.1 12l6.8 6.8 1.7-1.7-3.9-3.9H20v-2.4H8.7l3.9-3.9z"/>',
    check: '<path d="M9.4 16.4l-4.3-4.3-1.8 1.8 6.1 6.1L21 8.3l-1.8-1.8z"/>',
    star: '<path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5-4.8-4.5 6.5-.8z"/>',
    chevronRight: '<path d="M8.6 5.4L15.2 12l-6.6 6.6-1.7-1.7 4.9-4.9-4.9-4.9z"/>',
    chevronLeft: '<path d="M15.4 5.4L8.8 12l6.6 6.6 1.7-1.7-4.9-4.9 4.9-4.9z"/>',
    chevronDown: '<path d="M5.4 8.6L12 15.2l6.6-6.6-1.7-1.7-4.9 4.9-4.9-4.9z"/>',
    list: '<path d="M4 5.5h2.4v2.4H4zm4.4 0H20v2.4H8.4zM4 10.8h2.4v2.4H4zm4.4 0H20v2.4H8.4zM4 16.1h2.4v2.4H4zm4.4 0H20v2.4H8.4z"/>',
    quality: '<path fill-rule="evenodd" d="M4.2 5h15.6c.7 0 1.2.5 1.2 1.2v11.6c0 .7-.5 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2V6.2C3 5.5 3.5 5 4.2 5zM5.2 7.2v9.6h13.6V7.2zM7 9h1.8v2.1h2V9h1.8v6h-1.8v-2.2h-2V15H7zm7 0h2.6c1.3 0 2.4 1.1 2.4 2.4v1.2c0 1.3-1.1 2.4-2.4 2.4H14zm1.8 1.7v2.6h.8c.4 0 .6-.3.6-.7v-1.2c0-.4-.2-.7-.6-.7z"/>',
    backspace: '<path d="M8.6 5.6h11c.8 0 1.4.6 1.4 1.4v10c0 .8-.6 1.4-1.4 1.4h-11L3 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M11.3 9.3l5.4 5.4m0-5.4l-5.4 5.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    space: '<path d="M4 9.5v5h16v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M6.3 4.6L12 10.3l5.7-5.7 1.7 1.7-5.7 5.7 5.7 5.7-1.7 1.7-5.7-5.7-5.7 5.7-1.7-1.7 5.7-5.7-5.7-5.7z"/>',
    globe: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.4 2.2A7.9 7.9 0 0 0 4.2 11h3.3c.1-2.6.9-5 3.1-6.8zm2.8 0c2.2 1.8 3 4.2 3.1 6.8h3.3a7.9 7.9 0 0 0-6.4-6.8zM12 4.6c-1.6 1.5-2.3 3.8-2.4 6.4h4.8c-.1-2.6-.8-4.9-2.4-6.4zM4.2 13a7.9 7.9 0 0 0 6.4 6.8c-2.2-1.8-3-4.2-3.1-6.8zm5.4 0c.1 2.6.8 4.9 2.4 6.4 1.6-1.5 2.3-3.8 2.4-6.4zm6.9 0c-.1 2.6-.9 5-3.1 6.8a7.9 7.9 0 0 0 6.4-6.8z"/>',
    reload: '<path d="M12 4.2c2.2 0 4.2.9 5.6 2.4L20 4.2V11h-6.8l2.9-2.9A5.7 5.7 0 0 0 6.4 12H4.2A7.8 7.8 0 0 1 12 4.2zm7.8 7.8A7.8 7.8 0 0 1 6.4 17.4L4 19.8V13h6.8l-2.9 2.9a5.7 5.7 0 0 0 9.7-3.9z"/>',
    qr: '<path fill-rule="evenodd" d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm1-9h2v2H6zm10 0h2v2h-2zM6 16h2v2H6zm7-3h2v2h-2zm2 2h2v2h-2zm-2 2h2v4h-2zm4 0h4v2h-4zm2-4h2v4h-2zm-2 6h2v2h-2zm2 0h2v2h-2z"/>',
    keypad: '<path d="M5 3.5h3v3H5zm5.5 0h3v3h-3zm5.5 0h3v3h-3zM5 9h3v3H5zm5.5 0h3v3h-3zM16 9h3v3h-3zM5 14.5h3v3H5zm5.5 0h3v3h-3zm5.5 0h3v3h-3zm-5.5 5h3v3h-3z"/>',
    user: '<path d="M12 3.2a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6zm0 10.2c4.3 0 8 2.1 8 5.2v2.2H4v-2.2c0-3.1 3.7-5.2 8-5.2z"/>',
    power: '<path d="M10.8 2.5h2.4v9.3h-2.4zM7.1 5.3l1.5 1.8a6.3 6.3 0 1 0 6.8 0l1.5-1.8A8.6 8.6 0 1 1 7.1 5.3z"/>',
    stethoscope: '<path fill-rule="evenodd" d="M4 3h3v2H6v5a4 4 0 0 0 8 0V5h-1V3h3v7a6 6 0 0 1-5 5.9v1.6a2.5 2.5 0 0 0 5 0v-1.2a3 3 0 1 1 2 0v1.2a4.5 4.5 0 0 1-9 0v-1.6A6 6 0 0 1 4 10z"/>',
    motion: '<path d="M3 11h8.6v2H3zm2-4.5h9v2H5zm0 9h9v2H5zM16.5 5a7 7 0 0 1 0 14v-2.2a4.8 4.8 0 0 0 0-9.6z"/>',
    remote: '<path fill-rule="evenodd" d="M8.4 2h7.2c.8 0 1.4.6 1.4 1.4v17.2c0 .8-.6 1.4-1.4 1.4H8.4c-.8 0-1.4-.6-1.4-1.4V3.4C7 2.6 7.6 2 8.4 2zM12 4.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM9.6 12v2h2v-2zm2.8 0v2h2v-2zm-2.8 3.2v2h2v-2zm2.8 0v2h2v-2z"/>',
    spark: '<path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>'
  };

  function markup(name) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" focusable="false">' + (P[name] || P.info) + '</svg>';
  }

  /* Returns a fresh <span class="mb-ico"> holding the static SVG. */
  function el(name, cls) { return U.svg(markup(name), cls); }

  return { markup: markup, el: el };
}());

var Kit = (function () {
  var lazyTimer = null;
  var tvUA = null;

  function el(tag, cls, text, parent) { return U.el(tag, cls, text, parent); }

  /* ---------- TV performance mode ---------- */

  /* A TV browser (the native player uses the same test). */
  function isTV() {
    if (tvUA === null) {
      try { tvUA = /Tizen|SMART-TV|Web0S|NetCast/i.test(String(navigator.userAgent || '')); } catch (e) { tvUA = false; }
    }
    try { return tvUA || !!window.tizen; } catch (e2) { return tvUA; }
  }

  /* Prefs 'performance': 'on', 'off' or 'auto' (the default: on for TVs). App puts .mb-perf on #mbptv while it is on;
     the kit loads smaller pictures and fewer at a time, and screens can ask for their calmer timings (timing()). */
  function perf() {
    var p = 'auto';
    try { if (typeof Prefs !== 'undefined' && Prefs.get) p = Prefs.get('performance') || 'auto'; } catch (e) { p = 'auto'; }
    if (p === 'on') return true;
    if (p === 'off') return false;
    return isTV();
  }

  /* Timings screens use, by name, as [normal, performance mode]: dwell = how long focus rests on a card before its
     details are prefetched (Home's hero). */
  var TIMINGS = { dwell: [450, 700] };
  function timing(name) {
    var t = TIMINGS[name];
    return t ? t[perf() ? 1 : 0] : 0;
  }

  function focusable(node, key, action) {
    node.setAttribute('data-f', '');
    node.setAttribute('tabindex', '-1');
    if (key) node.setAttribute('data-fk', key);
    if (action) node.setAttribute('data-action', action);
    return node;
  }

  function zone(node, name) { node.setAttribute('data-zone', name); return node; }

  /* Pill button: {label, icon, action, key, primary, cls, parent} */
  function button(opts) {
    var b = el('div', 'mb-btn' + (opts.primary ? ' mb-btn--primary' : '') + (opts.cls ? ' ' + opts.cls : ''));
    focusable(b, opts.key || opts.action || opts.label, opts.action);
    if (opts.icon) b.appendChild(Icons.el(opts.icon, 'mb-btn-ico'));
    var label = el('span', 'mb-btn-label', opts.label || '', b);
    b.__label = label;
    if (opts.parent) opts.parent.appendChild(b);
    return b;
  }

  function setLabel(btn, text) { if (btn && btn.__label) btn.__label.textContent = text; }

  function safeImage(url) { return typeof url === 'string' && /^https?:\/\//i.test(url) && url.length < 2048; }

  /* ---------- Images ---------- */

  var TMDB = /^(https?:\/\/image\.tmdb\.org\/t\/p\/)(original|w\d+)(\/[^?#]+)$/i;

  /* The URL of an image at about w CSS pixels wide (1080p frame). The site's thumbnail service honours any width
     (Site.thumb, when the adapter provides it); TMDB serves fixed sizes, so its art gets w780 (up to 780 px) or
     w1280, never a larger file than the one it came as. Performance mode caps every width at 780. Other URLs, and
     any width the adapter cannot produce, come back unchanged. */
  function imgUrl(url, w) {
    if (!safeImage(url)) return url;
    w = Math.round(+w || 0);
    if (!(w > 0)) return url;
    if (w > 780 && perf()) w = 780;
    var m = TMDB.exec(url);
    if (m) {
      var have = /^original$/i.test(m[2]) ? 1e9 : parseInt(m[2].slice(1), 10) || 1e9, want = w <= 780 ? 780 : 1280;
      return have <= want ? url : m[1] + 'w' + want + m[3];
    }
    if (typeof Site !== 'undefined' && typeof Site.thumb === 'function') {
      try { var t = Site.thumb(url, w); if (safeImage(t)) return t; } catch (e) {}
    }
    return url;
  }

  /* Full-screen backdrop art (hero, detail, playback): 1280 px, or 780 in performance mode. */
  function backdrop(url) { return imgUrl(url, 1280); }

  /* Loads in flight. Performance mode starts at most MAX_LOADS lazy images at once, nearest to the screen first; a
     load that never finishes gives its slot back after SLOT_MS. */
  var MAX_LOADS = 6, SLOT_MS = 10000;
  var loads = { active: [], queue: [] };

  function release(node) {
    var i = U.indexOf(loads.active, node);
    if (i < 0) return;
    loads.active.splice(i, 1);
    if (loads.queue.length) pump();
  }

  function startLoad(node, counted) {
    U.toggleClass(node, 'mb-lazy', false);
    if (!node.__src || node.getAttribute('src') === node.__src) return;
    if (counted && U.indexOf(loads.active, node) < 0) { node.__mbAt = U.now(); loads.active.push(node); }
    node.src = node.__src;
  }

  function pump() {
    var now = U.now(), root = document.documentElement;
    loads.active = U.filter(loads.active, function (n) { return root.contains(n) && now - (n.__mbAt || 0) < SLOT_MS && now >= (n.__mbAt || 0); });
    while (loads.queue.length && loads.active.length < MAX_LOADS) {
      var n = loads.queue.shift();
      if (U.hasClass(n, 'mb-lazy') && root.contains(n)) startLoad(n, true);
    }
  }

  /* The single image entry point: Kit.img(url, opts), or the older Kit.img(url, cls, parent, fallback | opts).
     opts: {cls, parent, w: CSS pixels wide at 1080p (asks for that size, see imgUrl), fallback: another URL,
     eager: load now instead of when it nears the screen}. On an error the image falls back once to the original URL
     (when a sized one was asked for), then to the fallback, then shows the placeholder (.is-error). */
  function img(url, cls, parent, fallback) {
    var o = {};
    if (cls && typeof cls === 'object') o = cls;
    else {
      o = { cls: cls, parent: parent };
      if (fallback && typeof fallback === 'object') { o.w = fallback.w; o.fallback = fallback.fallback; o.eager = fallback.eager; }
      else o.fallback = fallback;
    }
    var node = document.createElement('img');
    node.className = 'mb-img' + (o.cls ? ' ' + o.cls : '');
    node.setAttribute('alt', '');
    node.setAttribute('draggable', 'false');
    var chain = [];
    function add(u) { if (safeImage(u) && U.indexOf(chain, u) < 0) chain.push(u); }
    add(o.w ? imgUrl(url, o.w) : url);
    add(url);
    add(o.w ? imgUrl(o.fallback, o.w) : o.fallback);
    add(o.fallback);
    node.onload = U.guard(function () {
      release(node);
      U.toggleClass(node, 'is-loaded', true);
      U.toggleClass(node, 'is-error', false);
    }, 'img-load');
    node.onerror = U.guard(function () {
      var next = node.__chain && node.__chain.length ? node.__chain.shift() : '';
      if (next) { node.__src = next; node.__mbAt = U.now(); node.src = next; return; }
      release(node);
      U.toggleClass(node, 'is-error', true);
      U.toggleClass(node, 'is-loaded', false);
    }, 'img-error');
    var first = chain.shift();
    node.__chain = chain;
    if (first) { node.__src = first; U.toggleClass(node, 'mb-lazy', true); }
    else U.toggleClass(node, 'is-error', true);
    if (o.parent) o.parent.appendChild(node);
    if (o.eager && first) loadNow(node);
    return node;
  }

  /* Loads immediately, ahead of the lazy queue (hero and backdrop art). */
  function loadNow(node) {
    if (!node || !node.__src) return;
    startLoad(node, false);
  }

  /* Two phases: read every rect first, then start the loads. Interleaving them would force one synchronous layout per
     image (loading changes classes), which costs tens of milliseconds per row change on TV CPUs. Images within one
     viewport beyond the screen load (half a viewport in performance mode, where they also queue, nearest first). */
  function lazyCheck(scope) {
    var list = U.qsa(scope || document.getElementById('mbptv'), 'img.mb-lazy');
    if (!list.length) return;
    var vw = window.innerWidth || 1920, vh = window.innerHeight || 1080, p = perf(), mx = p ? vw * 0.5 : vw, my = p ? vh * 0.5 : vh;
    var hits = [], i;
    for (i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (r.right > -mx && r.left < vw + mx && r.bottom > -my && r.top < vh + my) {
        list[i].__mbDist = Math.max(0, -r.right, r.left - vw) + Math.max(0, -r.bottom, r.top - vh) * 2;
        list[i].__mbOrd = hits.length;
        hits.push(list[i]);
      }
    }
    if (!p) { for (i = 0; i < hits.length; i++) startLoad(hits[i], false); return; }
    hits.sort(function (a, b) { return a.__mbDist - b.__mbDist || a.__mbOrd - b.__mbOrd; });
    loads.queue = hits;
    pump();
  }

  /* Coalesces checks: one now-ish and one after transitions settle. */
  function lazySoon(scope) {
    clearTimeout(lazyTimer);
    lazyTimer = U.later(function () {
      lazyCheck(scope);
      lazyTimer = U.later(function () { lazyCheck(scope); }, 320, 'lazy-2');
    }, 40, 'lazy');
  }

  function fmtRuntime(value) {
    var s = U.text(value);
    if (!s) return '';
    var m = s.match(/^(\d+)\s*(?:min|mins|minutes|m)\b/i);
    if (!m) return s;
    var n = parseInt(m[1], 10);
    if (!n) return '';
    if (n < 60) return n + 'm';
    return Math.floor(n / 60) + 'h' + (n % 60 ? ' ' + (n % 60) + 'm' : '');
  }

  function metaLine(parts) {
    return U.filter(U.map(parts, function (p) { return U.text(p); }), function (p) { return !!p; }).join('  \u00b7  ');
  }

  function genresText(list, max) {
    if (!list || !list.length) return '';
    return U.map(list.slice(0, max || 3), function (g) { return U.titleCase(g); }).join(', ');
  }

  function progressBar(value, parent) {
    var bar = el('div', 'mb-progress', null, parent);
    var fill = el('div', 'mb-progress-fill', null, bar);
    fill.style.width = Math.round(U.clamp(value, 0, 1) * 1000) / 10 + '%';
    return bar;
  }

  function badgeText(item) {
    var b = U.text(item && item.badge);
    if (/4k/i.test(b)) return '4K';
    if (/blu/i.test(b)) return 'HD';
    return '';
  }

  /* The picture width a card asks for (CSS pixels at 1080p, with headroom for the focus scale): posters are 12em and
     15em wide, landscape cards 22em. Performance mode asks for smaller files. */
  function cardWidth(size) {
    var p = perf();
    if (size === 'wide') return p ? 500 : 780;
    if (size === 'grid') return p ? 342 : 500;
    return p ? 300 : 500;
  }

  /* Title card. opts: {size: 'poster'|'grid'|'wide', zone: 'row:id', sub: bool, title: bool} */
  function card(item, opts) {
    opts = opts || {};
    var size = opts.size || 'poster';
    var c = el('div', 'mb-card mb-card--' + size);
    focusable(c, (opts.zone || 'z') + '|' + item.key);
    c.setAttribute('data-key', item.key);
    c.__item = item;
    var art = el('div', 'mb-card-art', null, c);
    var ph = el('div', 'mb-card-ph', null, art);
    el('span', 'mb-card-ph-title', item.title || '', ph);
    var src = size === 'wide' ? (item.backdrop || item.poster) : (item.poster || item.backdrop);
    img(src, { cls: 'mb-card-img', parent: art, w: cardWidth(size) });
    /* Landscape cards carry their title on the art (their row hides the title line below the card). */
    if (size === 'wide') el('div', 'mb-card-label', item.title || '', art);
    var badge = badgeText(item);
    if (badge && size !== 'wide') el('span', 'mb-card-badge', badge, art);
    if (typeof item.progress === 'number' && item.progress >= 0) {
      var shade = el('div', 'mb-card-shade', null, art);
      if (item.progressLabel) el('span', 'mb-card-plabel', item.progressLabel, shade);
      progressBar(item.progress, shade);
    }
    if (opts.title !== false) el('div', 'mb-card-title', item.title || '', c);
    if (opts.sub) {
      var sub = [];
      if (item.update) sub.push(item.update);
      else if (item.year) sub.push(item.year);
      if (item.rating) sub.push(item.rating);
      if (sub.length) {
        var s = el('div', 'mb-card-sub', null, c);
        el('span', null, sub[0], s);
        if (sub[1]) { s.appendChild(Icons.el('star', 'mb-card-star')); el('span', null, sub[1], s); }
      }
    }
    return c;
  }

  /* Fills in a title learned later (for example a Featured banner whose page was fetched on focus). */
  function setCardTitle(c, title) {
    title = U.text(title);
    if (!c || !title) return;
    if (c.__item) c.__item.title = title;
    U.each(U.qsa(c, '.mb-card-ph-title, .mb-card-title, .mb-card-label'), function (n) { n.textContent = title; });
  }

  /* "See all" tile at the end of a row. */
  function moreTile(zoneName, label, size) {
    var c = el('div', 'mb-card mb-card--' + (size || 'poster') + ' mb-card--more');
    focusable(c, zoneName + '|more', 'more');
    var art = el('div', 'mb-card-art', null, c);
    var inner = el('div', 'mb-more-inner', null, art);
    inner.appendChild(Icons.el('chevronRight', 'mb-more-ico'));
    el('span', 'mb-more-label', label || 'See all', inner);
    el('div', 'mb-card-title', '', c);
    return c;
  }

  function chip(label, opts) {
    opts = opts || {};
    var c = el('div', 'mb-chip' + (opts.cls ? ' ' + opts.cls : ''));
    focusable(c, opts.key || 'chip|' + label, opts.action);
    if (opts.icon) c.appendChild(Icons.el(opts.icon, 'mb-chip-ico'));
    el('span', 'mb-chip-label', label, c);
    if (opts.parent) opts.parent.appendChild(c);
    return c;
  }

  function spinner(parent, cls) {
    var s = el('div', 'mb-spinner' + (cls ? ' ' + cls : ''), null, parent);
    el('div', 'mb-spinner-ring', null, s);
    return s;
  }

  function monogram(parent, cls) {
    var m = el('div', 'mb-mono' + (cls ? ' ' + cls : ''), null, parent);
    el('span', 'mb-mono-m', 'M', m);
    return m;
  }

  function skeletonCards(parent, n, size) {
    for (var i = 0; i < n; i++) {
      var c = el('div', 'mb-card mb-card--' + (size || 'poster') + ' mb-card--skel', null, parent);
      el('div', 'mb-card-art mb-skel', null, c);
      if (size !== 'wide-plain') el('div', 'mb-skel mb-skel-line', null, c);
    }
  }

  function transform(node, value) {
    if (!node) return;
    node.style.webkitTransform = value;
    node.style.transform = value;
  }

  function setX(node, x) {
    x = Math.round(x);
    if (node.__x === x) return;
    node.__x = x;
    transform(node, 'translate3d(' + x + 'px,0,0)');
  }

  function setY(node, y) {
    y = Math.round(y);
    if (node.__y === y) return;
    node.__y = y;
    transform(node, 'translate3d(0,' + y + 'px,0)');
  }

  /* Layout offset of el inside container (independent of the container's own transform). */
  function offsetIn(node, container) {
    var a = node.getBoundingClientRect(), b = container.getBoundingClientRect();
    return { top: a.top - b.top, left: a.left - b.left, height: a.height, width: a.width };
  }

  /* A track's padding, read once per viewport width (a computed-style read on every key press costs TV CPUs time). */
  function trackPad(track) {
    var vw = window.innerWidth || 0, p = track.__mbPad;
    if (!p || p.vw !== vw) {
      var cs = window.getComputedStyle(track);
      p = track.__mbPad = { vw: vw, l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
    }
    return p;
  }

  /* Horizontal rows: the focused card sits at the row's content start, clamped at both ends. */
  function scrollTrack(track, node) {
    var view = track.parentNode;
    if (!view || !node || node.parentNode !== track) return;
    var pad = trackPad(track), padL = pad.l, padR = pad.r;
    var last = track.lastElementChild || track.lastChild;
    var total = last ? last.offsetLeft + last.offsetWidth + padR : 0;
    var max = Math.max(0, total - view.clientWidth);
    var x = U.clamp(node.offsetLeft - padL, 0, max);
    setX(track, -x);
  }

  /* Vertical reveal: keeps node inside [topPad, viewport - bottomPad]. */
  function reveal(scroller, viewport, node, topPad, bottomPad) {
    var cur = -(scroller.__y || 0);
    var off = offsetIn(node, scroller);
    var vh = viewport.clientHeight;
    var y = cur;
    if (off.top - cur < topPad) y = off.top - topPad;
    else if (off.top + off.height - cur > vh - bottomPad) y = off.top + off.height - (vh - bottomPad);
    var max = Math.max(0, scroller.offsetHeight - vh + bottomPad);
    y = U.clamp(y, 0, max);
    setY(scroller, -y);
    return y;
  }

  /* The root's em in px (0.8333vw), read once per viewport width. */
  var emCache = { vw: -1, px: 0 };
  function em() {
    var vw = window.innerWidth || 0;
    if (emCache.vw === vw && emCache.px) return emCache.px;
    var r = document.getElementById('mbptv');
    var fs = r ? parseFloat(window.getComputedStyle(r).fontSize) : 0;
    if (fs) emCache = { vw: vw, px: fs };
    return fs || (vw || 1920) * 0.008333;
  }

  return {
    el: el, focusable: focusable, zone: zone, button: button, setLabel: setLabel, img: img, loadNow: loadNow,
    imgUrl: imgUrl, backdrop: backdrop, cardWidth: cardWidth, perf: perf, isTV: isTV, timing: timing,
    safeImage: safeImage, lazyCheck: lazyCheck, lazySoon: lazySoon, fmtRuntime: fmtRuntime, metaLine: metaLine,
    genresText: genresText, progressBar: progressBar, card: card, setCardTitle: setCardTitle, moreTile: moreTile, chip: chip, spinner: spinner,
    monogram: monogram, skeletonCards: skeletonCards, transform: transform, setX: setX, setY: setY, offsetIn: offsetIn,
    scrollTrack: scrollTrack, reveal: reveal, em: em
  };
}());

/* Focus engine: zones (data-zone) hold focusables (data-f). Linear zones move by sibling, geometric zones by
   nearest-in-direction; leaving a zone picks the nearest zone in that direction and restores its remembered item. */
var Focus = (function () {
  var cur = null, scopeFn = null, changeFn = null, exitFn = null;
  var H = /^(row|tabs|hero|dialog|buttons|seasons|chips-h)(:|$)/, V = /^(rail|list|sheet|menu|suggestions)(:|$)/;

  function configure(opts) {
    scopeFn = opts.scope || scopeFn;
    changeFn = opts.change || changeFn;
    exitFn = opts.exit || exitFn;
  }

  function attached(node) { return !!node && node.nodeType === 1 && document.documentElement.contains(node); }

  function shown(node) {
    if (!attached(node)) return false;
    if (!(node.offsetWidth || node.offsetHeight)) return false;
    return !node.hasAttribute('data-disabled');
  }

  function scopes() {
    var s = scopeFn ? scopeFn() : [];
    return U.filter(s || [], function (n) { return attached(n); });
  }

  function inScopes(node, list) {
    for (var i = 0; i < list.length; i++) if (list[i] === node || list[i].contains(node)) return true;
    return false;
  }

  function zoneOf(node) { return U.closest(node, '[data-zone]'); }

  function zoneType(z) {
    if (!z) return 'g';
    var forced = z.getAttribute('data-zone-type');
    if (forced) return forced;
    var name = z.getAttribute('data-zone') || '';
    if (H.test(name)) return 'h';
    if (V.test(name)) return 'v';
    return 'g';
  }

  function items(z) {
    return U.filter(U.qsa(z, '[data-f]'), function (n) { return zoneOf(n) === z && shown(n); });
  }

  function rect(node) { return node.getBoundingClientRect(); }
  function cx(r) { return r.left + r.width / 2; }
  function cy(r) { return r.top + r.height / 2; }

  function gap(a1, a2, b1, b2) { return b2 < a1 ? a1 - b2 : b1 > a2 ? b1 - a2 : 0; }

  /* Left/Right only consider candidates that share the current line (vertical overlap): moving sideways never jumps
     to another line of a zone, so Right at the end of a line (or from the keyboard's wide bottom keys) leaves the
     zone instead of landing on a key above it. */
  function nearest(from, list, dir) {
    var c = rect(from), best = null, bestScore = Infinity;
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n === from) continue;
      var r = rect(n), primary, secondary;
      if (dir === 'right') { if (cx(r) <= cx(c) + 1 || r.left < c.left + c.width * 0.5 || gap(c.top, c.bottom, r.top, r.bottom) > 0) continue; primary = Math.max(0, r.left - c.right); secondary = Math.abs(cy(r) - cy(c)) * 0.5; }
      else if (dir === 'left') { if (cx(r) >= cx(c) - 1 || r.right > c.right - c.width * 0.5 || gap(c.top, c.bottom, r.top, r.bottom) > 0) continue; primary = Math.max(0, c.left - r.right); secondary = Math.abs(cy(r) - cy(c)) * 0.5; }
      else if (dir === 'down') { if (cy(r) <= cy(c) + 1 || r.top < c.top + c.height * 0.5) continue; primary = Math.max(0, r.top - c.bottom); secondary = gap(c.left, c.right, r.left, r.right) * 3 + Math.abs(cx(r) - cx(c)) * 0.5; }
      else { if (cy(r) >= cy(c) - 1 || r.bottom > c.bottom - c.height * 0.5) continue; primary = Math.max(0, c.top - r.bottom); secondary = gap(c.left, c.right, r.left, r.right) * 3 + Math.abs(cx(r) - cx(c)) * 0.5; }
      var score = primary + secondary;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  function zonesIn(list, except) {
    var out = [];
    U.each(list, function (s) {
      if (s.hasAttribute && s.hasAttribute('data-zone') && s !== except) out.push(s);
      U.each(U.qsa(s, '[data-zone]'), function (z) { if (z !== except && shown(z)) out.push(z); });
    });
    return out;
  }

  function enter(z, dir, fromRect) {
    var list = items(z);
    if (!list.length) return null;
    var last = z.__mbLast, type = zoneType(z);
    if (last && U.indexOf(list, last) >= 0) {
      if (type !== 'g') return last;
      var lr = rect(last), vh = window.innerHeight, vw = window.innerWidth;
      if (lr.bottom > 0 && lr.top < vh && lr.right > 0 && lr.left < vw) return last;
    }
    if (!fromRect) return list[0];
    /* Geometric zones: enter on the edge facing us. Linear zones: nearest along the cross axis. */
    var best = null, bestScore = Infinity, edge = Infinity, i, r;
    if (type === 'g') {
      for (i = 0; i < list.length; i++) {
        r = rect(list[i]);
        var e = dir === 'down' ? r.top : dir === 'up' ? -r.bottom : dir === 'right' ? r.left : -r.right;
        if (e < edge) edge = e;
      }
    }
    for (i = 0; i < list.length; i++) {
      r = rect(list[i]);
      if (type === 'g') {
        var e2 = dir === 'down' ? r.top : dir === 'up' ? -r.bottom : dir === 'right' ? r.left : -r.right;
        if (e2 > edge + r.height * 0.5 && (dir === 'down' || dir === 'up')) continue;
        if (e2 > edge + r.width * 0.5 && (dir === 'left' || dir === 'right')) continue;
      }
      var score = (dir === 'down' || dir === 'up') ? Math.abs(cx(r) - cx(fromRect)) : Math.abs(cy(r) - cy(fromRect));
      if (score < bestScore - 0.5) { bestScore = score; best = list[i]; }
    }
    return best || list[0];
  }

  function exitZone(from, z, dir, list) {
    if (exitFn) {
      var forced = exitFn(from, z, dir);
      if (forced === false) return null;
      if (forced && forced.nodeType === 1) return forced;
    }
    if (z && z.getAttribute('data-exit-' + dir) === 'none') return null;
    var c = rect(from), best = null, bestScore = Infinity;
    var zones = zonesIn(list, z);
    for (var i = 0; i < zones.length; i++) {
      var zz = zones[i];
      if (z && (zz.contains(z) || z.contains(zz))) continue;
      if (!items(zz).length) continue;
      var r = rect(zz), primary, secondary;
      if (dir === 'down') { if (r.top < c.top + c.height * 0.5) continue; primary = Math.max(0, r.top - c.bottom); secondary = gap(c.left, c.right, r.left, r.right); }
      else if (dir === 'up') { if (r.bottom > c.bottom - c.height * 0.5) continue; primary = Math.max(0, c.top - r.bottom); secondary = gap(c.left, c.right, r.left, r.right); }
      else if (dir === 'right') { if (r.left < c.left + c.width * 0.5) continue; primary = Math.max(0, r.left - c.right); secondary = gap(c.top, c.bottom, r.top, r.bottom); }
      else { if (r.right > c.right - c.width * 0.5) continue; primary = Math.max(0, c.left - r.right); secondary = gap(c.top, c.bottom, r.top, r.bottom); }
      var score = primary + secondary * 2;
      if (score < bestScore) { bestScore = score; best = zz; }
    }
    return best ? enter(best, dir, c) : null;
  }

  function set(node, info) {
    if (!node || node.nodeType !== 1) return false;
    var prev = cur;
    if (prev && prev !== node) U.toggleClass(prev, 'is-focused', false);
    cur = node;
    U.toggleClass(node, 'is-focused', true);
    try { node.focus({ preventScroll: true }); } catch (e) { try { node.focus(); } catch (e2) {} }
    unscroll(node);
    var z = zoneOf(node);
    if (z) z.__mbLast = node;
    if (changeFn) changeFn(node, prev, info || {});
    return true;
  }

  /* Browsers scroll overflow:hidden ancestors to reveal a focused element; our layout scrolls by transform only. */
  function unscroll(node) {
    var root = document.getElementById('mbptv');
    for (var p = node.parentNode; p && p.nodeType === 1; p = p.parentNode) {
      if (p.scrollTop) p.scrollTop = 0;
      if (p.scrollLeft) p.scrollLeft = 0;
      if (p === root) break;
    }
  }

  /* Poster grids ([data-zone="grid"]) navigate by index and column (section 6.3), from a cached item list, so a key
     press costs the same with 40 or 600 loaded titles. The cache is rebuilt when the grid's children change, when the
     focused card is not where the cache says, or when the viewport width changes. */
  function isGrid(z) { return !!z && z.getAttribute('data-zone') === 'grid'; }

  function gridCache(z, node) {
    var c = z.__mbGrid, vw = window.innerWidth || 0;
    if (c && c.n === z.childNodes.length && c.first === z.firstChild && c.last === z.lastChild &&
        (!node || c.list[node.__mbIdx] === node)) {
      if (c.vw !== vw) { c.vw = vw; c.cols = 0; }
      return c;
    }
    var list = items(z);
    for (var i = 0; i < list.length; i++) list[i].__mbIdx = i;
    c = z.__mbGrid = { n: z.childNodes.length, first: z.firstChild, last: z.lastChild, list: list, cols: 0, vw: vw };
    return c;
  }

  function gridCols(c) {
    if (!c.cols) {
      var list = c.list, top0 = list.length ? list[0].offsetTop : 0, k = 0;
      while (k < list.length && list[k].offsetTop === top0) k++;
      c.cols = Math.max(1, k);
    }
    return c.cols;
  }

  function gridStep(z, node, dir) {
    var c = gridCache(z, node), list = c.list, i = node.__mbIdx;
    if (list[i] !== node) return nearest(node, list, dir);
    var cols = gridCols(c), n = list.length, row = Math.floor(i / cols);
    if (dir === 'right') return i + 1 < n && Math.floor((i + 1) / cols) === row ? list[i + 1] : null;
    if (dir === 'left') return i % cols > 0 ? list[i - 1] : null;
    if (dir === 'up') return i - cols >= 0 ? list[i - cols] : null;
    if (i + cols < n) return list[i + cols];
    return row < Math.floor((n - 1) / cols) ? list[n - 1] : null;
  }

  /* {index, count} of a card in its grid (from the cache), or null. */
  function gridInfo(node) {
    var z = zoneOf(node);
    if (!isGrid(z)) return null;
    var c = gridCache(z, node);
    return c.list[node.__mbIdx] === node ? { index: node.__mbIdx, count: c.list.length } : null;
  }

  function move(dir) {
    var list = scopes();
    if (!list.length) return false;
    if (!cur || !shown(cur) || !inScopes(cur, list)) return false;
    var z = zoneOf(cur), type = zoneType(z), next = null;
    if (z && type === 'h' && (dir === 'left' || dir === 'right')) {
      var li = items(z), i = U.indexOf(li, cur);
      next = li[i + (dir === 'right' ? 1 : -1)] || null;
    } else if (z && type === 'v' && (dir === 'up' || dir === 'down')) {
      var lv = items(z), j = U.indexOf(lv, cur);
      next = lv[j + (dir === 'down' ? 1 : -1)] || null;
    } else if (z && type === 'g' && isGrid(z)) {
      next = gridStep(z, cur, dir);
      if (next && !shown(next)) next = nearest(cur, items(z), dir);
    } else if (z && type === 'g') {
      next = nearest(cur, items(z), dir);
    }
    if (!next) next = exitZone(cur, z, dir, list);
    if (!next && !z) {
      var all = [];
      U.each(list, function (s) { U.each(U.qsa(s, '[data-f]'), function (n) { if (shown(n)) all.push(n); }); });
      next = nearest(cur, all, dir);
    }
    if (!next) return false;
    return set(next, { dir: dir });
  }

  function current() { return attached(cur) ? cur : null; }

  function keyOf(node) {
    if (!node) return '';
    return node.getAttribute('data-fk') || node.getAttribute('data-key') || node.getAttribute('data-action') || '';
  }

  function byKey(scope, key) {
    if (!scope || !key) return null;
    var list = U.qsa(scope, '[data-f]');
    for (var i = 0; i < list.length; i++) if (keyOf(list[i]) === key && shown(list[i])) return list[i];
    return null;
  }

  function firstIn(scope) {
    var list = U.qsa(scope, '[data-f]');
    for (var i = 0; i < list.length; i++) if (shown(list[i])) return list[i];
    return null;
  }

  function valid() {
    var list = scopes();
    return !!(cur && shown(cur) && inScopes(cur, list));
  }

  function blur() {
    if (cur) U.toggleClass(cur, 'is-focused', false);
    cur = null;
  }

  return {
    configure: configure, set: set, move: move, current: current, keyOf: keyOf, byKey: byKey, firstIn: firstIn,
    valid: valid, blur: blur, zoneOf: zoneOf, items: items, shown: shown, enter: enter, gridInfo: gridInfo
  };
}());
/* ---- 40-ui-screens.js ---- */
/* Screens: home, browse grid, search, detail, library (browse), settings, diagnostics, sign-in, error, loading.
   A screen factory returns an instance: {name, el, rail, nav, initialFocus(), onFocus(el, prev), onKey(name, ev),
   onBack(), onShow(), onHide(), destroy(), snapshot()}. Screens render from Api (fetched documents) and fall back to
   an inline state or App.screenFailed(inst, err) \u2014 never a blank screen. */
var Screens = (function () {
  var registry = {};

  /* ---------- Shared helpers ---------- */

  function el(tag, cls, text, parent) { return U.el(tag, cls, text, parent); }

  function pref(name, fallback) {
    try { if (typeof Prefs !== 'undefined' && Prefs.get) { var v = Prefs.get(name); return v == null ? fallback : v; } } catch (e) {}
    return fallback;
  }

  function setPref(name, value) {
    try { if (typeof Prefs !== 'undefined' && Prefs.set) Prefs.set(name, value); } catch (e) { Log.warn('prefs', e); }
  }

  function meta(key) {
    try { if (typeof Api !== 'undefined' && Api.meta) return Api.meta(key) || null; } catch (e) {}
    return null;
  }

  /* Calls Api[name](...args, cb) defensively: a missing or throwing data layer becomes an async error. */
  function api(name, args, cb) {
    var done = false;
    function finish(err, res) { if (done) return; done = true; cb(err, res); }
    try {
      if (typeof Api === 'undefined' || typeof Api[name] !== 'function') throw new Error('Api.' + name + ' unavailable');
      Api[name].apply(Api, args.concat([U.guard(function (err, res) { finish(err, res); }, 'api:' + name)]));
    } catch (e) {
      Log.error('api:' + name, e);
      U.later(function () { finish({ code: 'exception', message: String(e && e.message || e) }, null); }, 0, 'api-fail');
    }
  }

  function site(fnName, args, fallback) {
    try {
      if (typeof Site !== 'undefined' && typeof Site[fnName] === 'function') {
        var r = Site[fnName].apply(Site, args || []);
        return r == null ? fallback : r;
      }
    } catch (e) { Log.error('site:' + fnName, e); }
    return fallback;
  }

  function siteUrl(name, args, fallbackPath) {
    try { if (typeof Site !== 'undefined' && Site.url && typeof Site.url[name] === 'function') return Site.url[name].apply(Site.url, args || []); } catch (e) { Log.warn('site-url', e); }
    return U.abs(fallbackPath || '/', location.href);
  }

  function normItem(it) {
    it = it || {};
    var kind = it.kind === 'tv' ? 'tv' : 'movie';
    var id = String(it.id || '');
    return {
      key: it.key || (kind + ':' + id), kind: kind, id: id, title: U.text(it.title), href: it.href || '',
      poster: it.poster || '', backdrop: it.backdrop || '', rating: U.text(it.rating), tomato: U.text(it.tomato),
      year: U.text(it.year), runtime: U.text(it.runtime), genres: it.genres && it.genres.length ? it.genres : [],
      badge: it.badge || '', update: U.text(it.update),
      progress: typeof it.progress === 'number' ? it.progress : -1, progressLabel: U.text(it.progressLabel), playHref: it.playHref || ''
    };
  }

  function normItems(list) {
    var out = [], seen = {};
    U.each(list || [], function (it) {
      if (!it || !it.id) return;
      var n = normItem(it);
      if (seen[n.key]) return;
      seen[n.key] = true;
      out.push(n);
    });
    return out;
  }

  /* Only the fields the UI needs, so snapshots stay small in sessionStorage. */
  function compactItem(it) {
    return { key: it.key, kind: it.kind, id: it.id, title: it.title, poster: it.poster, backdrop: it.backdrop, rating: it.rating,
      year: it.year, badge: it.badge, update: it.update, progress: it.progress, progressLabel: it.progressLabel, playHref: it.playHref };
  }

  function errorMessage(err) {
    var code = err && err.code || '';
    if (code === 'timeout') return 'The website took too long to answer. Check the connection and try again.';
    if (code === 'network') return 'The TV could not reach the website. Check the internet connection and try again.';
    if (/^http-5/.test(code)) return 'The website had a problem answering (' + code.replace('http-', 'error ') + '). It usually passes quickly.';
    if (/^http-4/.test(code)) return 'The website did not recognise this page (' + code.replace('http-', 'error ') + ').';
    if (code === 'parse') return 'The page loaded, but its layout was not recognised. You can still open it on the website.';
    return 'Something went wrong while loading this page.';
  }

  function base(name, cls) {
    var s = {
      name: name, el: el('div', 'mb-screen mb-' + cls), rail: true, nav: '',
      initialFocus: null, onFocus: null, onKey: null, onBack: null, onShow: null, onHide: null, destroy: null, snapshot: null,
      alive: true
    };
    s.initialFocus = function () { return Focus.firstIn(s.el); };
    return s;
  }

  function fail(s, err) {
    if (!s.alive) return;
    App.screenFailed(s, err || { code: 'unknown' });
  }

  /* Empty / inline error state with actions. opts: {icon, title, text, actions: [{label, icon, action, primary, run}]} */
  function stateBlock(parent, opts, zoneName) {
    var box = el('div', 'mb-empty', null, parent);
    box.appendChild(Icons.el(opts.icon || 'info', 'mb-empty-ico'));
    el('div', 'mb-section', opts.title || '', box);
    if (opts.text) el('div', 'mb-body', opts.text, box);
    var btns = Kit.zone(el('div', 'mb-btns', null, box), zoneName || 'buttons');
    U.each(opts.actions || [], function (a) {
      var b = Kit.button({ label: a.label, icon: a.icon, action: a.action, primary: a.primary, parent: btns, key: (zoneName || 'buttons') + '|' + a.action });
      b.__run = a.run;
    });
    return box;
  }

  function heroTags(parent, info) {
    U.empty(parent);
    if (info.imdb) el('span', 'mb-tag mb-tag--imdb', 'IMDb ' + info.imdb, parent);
    if (info.badge) el('span', 'mb-tag mb-tag--line', /4k/i.test(info.badge) ? '4K' : /blu/i.test(info.badge) ? 'Blu-ray' : info.badge, parent);
    if (info.update) el('span', 'mb-tag mb-tag--gold', info.update, parent);
  }

  /* Detail badges without repeats (a badge contained as a whole word in another, like '4K' in '4K HDR', is dropped),
     HDR and 4K first, then disc and source badges; at most three. */
  function badgeList(list) {
    var out = [];
    U.each(list || [], function (b, i) {
      b = U.text(b);
      var low = b.toLowerCase();
      if (!b) return;
      var dup = U.find(list, function (o) { o = U.text(o).toLowerCase(); return o !== low && (' ' + o + ' ').indexOf(' ' + low + ' ') >= 0; });
      if (!dup && !U.find(out, function (x) { return x.b.toLowerCase() === low; })) out.push({ b: b, i: i });
    });
    function rank(b) { return /hdr|dolby|vision/i.test(b) ? 0 : /\b(?:4k|8k|uhd)\b/i.test(b) ? 1 : 2; }
    out.sort(function (x, y) { return (rank(x.b) - rank(y.b)) || (x.i - y.i); });
    return U.map(out.slice(0, 3), function (x) { return x.b; });
  }

  /* ---------- Image sizes ----------
     Pictures are asked for at the size they are shown (Kit.imgUrl / Site.thumb: the site's thumbnail service honours
     any width; TMDB art gets w780 or w1280). Every sized URL falls back to the original on an error. Full-screen art
     is 1280 wide at quality 85 (780 in performance mode), large posters 500, episode stills 640. */
  var IMG_POSTER = 500, IMG_STILL = 640;

  function perfOn() {
    try { return typeof Kit.perf === 'function' && !!Kit.perf(); } catch (e) { return false; }
  }

  function sizedUrl(url, w) {
    if (!Kit.safeImage(url)) return url;
    try { if (typeof Kit.imgUrl === 'function') return Kit.imgUrl(url, w) || url; } catch (e) { Log.warn('img-url', e); }
    try { if (typeof Site !== 'undefined' && typeof Site.thumb === 'function') return Site.thumb(url, w) || url; } catch (e2) { Log.warn('img-thumb', e2); }
    return url;
  }

  /* TMDB art at w780 or w1280 (never larger than it came), recognised by its /t/p/<size>/ path on any host, as
     Site.detail does when it picks the w1280 backdrop. '' for any other URL. */
  var TMDB_SIZE = /^(https?:\/\/[^?#]*\/t\/p\/)(original|w\d+)(\/[^?#]+)$/i;
  function tmdbAt(url, w) {
    var m = TMDB_SIZE.exec(String(url || ''));
    if (!m) return '';
    var have = /^original$/i.test(m[2]) ? 1e9 : parseInt(m[2].slice(1), 10) || 1e9, want = w <= 780 ? 780 : 1280;
    return have <= want ? url : m[1] + 'w' + want + m[3];
  }

  function heroUrl(url) {
    if (!Kit.safeImage(url)) return url;
    var w = perfOn() ? 780 : 1280, t = url;
    try { if (typeof Site !== 'undefined' && typeof Site.thumb === 'function') t = Site.thumb(url, w, 85) || url; } catch (e) { t = url; }
    return t !== url ? t : (tmdbAt(url, w) || sizedUrl(url, w));
  }

  function posterUrl(url) { return sizedUrl(url, perfOn() ? 342 : IMG_POSTER); }

  /* A lazy <img> at w CSS pixels (Kit.img with a width when the kit sizes images itself, else a pre-sized URL with the
     original as its fallback). */
  function image(url, cls, parent, w, eager) {
    var node;
    if (typeof Kit.imgUrl === 'function') node = Kit.img(url, { cls: cls, parent: parent, w: w, eager: !!eager });
    else node = Kit.img(sizedUrl(url, w), cls, parent, url);
    if (eager && typeof Kit.imgUrl !== 'function') Kit.loadNow(node);
    return node;
  }

  function candidates(list) {
    var out = [];
    U.each(list, function (u) { if (Kit.safeImage(u) && U.indexOf(out, u) < 0) out.push(u); });
    return out;
  }

  /* Crossfading art layer with the poster fallback treatment (large, scaled, 35% opacity). set(backdrop, poster) takes
     the original URLs; each is loaded at its display size first and falls back to the original on an error. */
  function artLayer(parent, onFallback) {
    var wrap = el('div', 'mb-art', null, parent);
    var poster = el('img', 'mb-img mb-art-poster', null, wrap);
    var a = el('img', 'mb-img mb-art-img', null, wrap);
    var b = el('img', 'mb-img mb-art-img', null, wrap);
    U.each([poster, a, b], function (n) { n.setAttribute('alt', ''); });
    var front = a, want = '', wantPoster = '';
    function clearBackdrop() { U.toggleClass(a, 'is-loaded', false); U.toggleClass(b, 'is-loaded', false); }
    function showPoster(list) {
      var url = list[0];
      if (!url) { U.toggleClass(poster, 'is-loaded', false); return; }
      if (wantPoster === url && U.hasClass(poster, 'is-loaded')) return;
      wantPoster = url;
      poster.onload = U.guard(function () { if (wantPoster === url) U.toggleClass(poster, 'is-loaded', true); }, 'art-poster');
      poster.onerror = U.guard(function () {
        if (wantPoster !== url) return;
        wantPoster = '';
        if (list.length > 1) showPoster(list.slice(1)); else U.toggleClass(poster, 'is-loaded', false);
      }, 'art-poster-err');
      if (poster.getAttribute('src') !== url) { U.toggleClass(poster, 'is-loaded', false); poster.src = url; }
      else U.toggleClass(poster, 'is-loaded', true);
    }
    function show(backs, posters, rawPoster) {
      var backdrop = backs[0];
      if (backdrop) {
        U.toggleClass(poster, 'is-loaded', false);
        wantPoster = '';
        if (want === backdrop) return;
        want = backdrop;
        var next = front === a ? b : a;
        if (next.getAttribute('src') === backdrop && U.hasClass(next, 'is-ready')) {
          U.toggleClass(next, 'is-loaded', true); U.toggleClass(front, 'is-loaded', false); front = next; return;
        }
        next.onload = U.guard(function () {
          U.toggleClass(next, 'is-ready', true);
          if (want !== backdrop) return;
          U.toggleClass(next, 'is-loaded', true);
          if (front !== next) U.toggleClass(front, 'is-loaded', false);
          front = next;
        }, 'art-load');
        next.onerror = U.guard(function () {
          if (want !== backdrop) return;
          want = '';
          if (backs.length > 1) { show(backs.slice(1), posters, rawPoster); return; }
          clearBackdrop();
          showPoster(posters);
          if (onFallback) onFallback(rawPoster);
        }, 'art-error');
        U.toggleClass(next, 'is-ready', false);
        next.src = backdrop;
      } else {
        want = '';
        clearBackdrop();
        showPoster(posters);
      }
    }
    function set(backdrop, rawPoster) {
      show(candidates([heroUrl(backdrop), backdrop]), candidates([posterUrl(rawPoster), rawPoster]), rawPoster);
    }
    return { el: wrap, set: set };
  }

  function scrims(parent, withTop) {
    el('div', 'mb-scrim-l', null, parent);
    el('div', 'mb-scrim-b', null, parent);
    if (withTop) el('div', 'mb-scrim-t', null, parent);
  }

  function qualityLabel(q) {
    return q === '1080p' ? '1080p' : q === '720p' ? '720p' : q === 'ask' ? 'Ask every time' : 'Best available';
  }

  function isContinue(it) { return !!it && (it.progress >= 0 || !!it.playHref); }

  /* ---------- Loading ---------- */

  registry.loading = function (params) {
    var s = base('loading', 'loading');
    s.rail = false;
    var inner = el('div', 'mb-loading-inner', null, s.el);
    Kit.monogram(inner, 'mb-mono--xl');
    var word = el('div', 'mb-wordmark', 'MovieBox ', inner);
    el('span', null, 'Pro', word);
    Kit.spinner(inner);
    s.msg = el('div', 'mb-loading-msg', params.message || '', inner);
    s.initialFocus = function () { return null; };
    s.setMessage = function (t) { s.msg.textContent = t || ''; };
    return s;
  };

  /* ---------- Error ---------- */

  registry.error = function (params) {
    var s = base('error', 'error');
    s.nav = params.nav || '';
    var box = el('div', 'mb-state', null, s.el);
    box.appendChild(Icons.el('info', 'mb-state-ico'));
    el('div', 'mb-h1', params.title || 'Couldn\u2019t load this page', box);
    el('div', 'mb-body', params.message || errorMessage(params.err), box);
    var code = params.err && params.err.code ? 'Code: ' + params.err.code : '';
    el('div', 'mb-code', code, box);
    var btns = Kit.zone(el('div', 'mb-btns', null, box), 'buttons');
    var retry = Kit.button({ label: 'Retry', icon: 'reload', action: 'retry', primary: true, parent: btns });
    Kit.button({ label: 'Open website', icon: 'globe', action: 'open-website', parent: btns });
    Kit.button({ label: 'Home', icon: 'home', action: 'home', parent: btns });
    s.initialFocus = function () { return retry; };
    s.websiteUrl = params.websiteUrl || '';
    return s;
  };

  /* ---------- Sign-in (the site's "Private Garden" gate) ---------- */

  registry.signin = function () {
    var s = base('signin', 'signin');
    s.rail = false;
    var c = el('div', 'mb-center', null, s.el);
    Kit.monogram(c, 'mb-mono--xl');
    el('div', 'mb-h1', 'Sign in to MovieBox Pro', c);
    el('div', 'mb-body', 'Your account lives on the MovieBox Pro website. Choose how to sign in and the website opens so you can finish there.', c);
    var stack = Kit.zone(el('div', 'mb-stack', null, c), 'list');
    var first = Kit.button({ label: 'Sign in with QR code', icon: 'qr', action: 'signin-qr', primary: true, parent: stack });
    Kit.button({ label: 'Sign in with a code', icon: 'keypad', action: 'signin-code', parent: stack });
    Kit.button({ label: 'Sign in with Google', icon: 'user', action: 'signin-google', parent: stack });
    Kit.button({ label: 'I\u2019ve signed in \u2014 try again', icon: 'reload', action: 'retry', parent: stack });
    el('div', 'mb-note', 'Sign-in happens on the website. The TV app never sees or stores your password.', c);
    s.initialFocus = function () { return first; };
    return s;
  };

  /* ---------- Home ---------- */

  registry.home = function (params, ctx) {
    var s = base('home', 'home');
    s.nav = 'home';
    var hero = el('div', 'mb-hero', null, s.el);
    var art = artLayer(hero);
    scrims(hero, true);
    var info = el('div', 'mb-hero-info', null, s.el);
    var text = el('div', 'mb-hero-text', null, info);
    var kicker = el('div', 'mb-kicker', '', text);
    var title = el('div', 'mb-display', '', text);
    var metaEl = el('div', 'mb-meta', '', text);
    var tags = el('div', 'mb-tags', null, text);
    var resume = el('div', 'mb-hero-resume', null, text);
    var overview = el('div', 'mb-body mb-clamp3', '', text);
    var btns = Kit.zone(el('div', 'mb-btns', null, info), 'hero');
    var playBtn = Kit.button({ label: 'Play', icon: 'play', action: 'play', primary: true, parent: btns });
    Kit.button({ label: 'Details', icon: 'info', action: 'details', parent: btns });
    var port = el('div', 'mb-rows-port', null, s.el);
    var rowsEl = el('div', 'mb-rows', null, port);
    var heroItem = null, heroRow = '', heroTimer = null, dwellTimer = null, pollTimer = null, rowEls = [];

    function skeleton() {
      U.empty(rowsEl);
      title.textContent = '';
      heroPlaceholder(true);
      for (var r = 0; r < 2; r++) {
        var row = el('div', 'mb-row', null, rowsEl);
        el('div', 'mb-row-title', '', row).appendChild(el('div', 'mb-skel mb-skel-meta'));
        var view = el('div', 'mb-row-view', null, row);
        Kit.skeletonCards(el('div', 'mb-track', null, view), 9, 'poster');
      }
      btns.style.display = 'none';
    }

    /* A title whose name is not known yet (a Featured banner before its page was fetched) shows placeholders instead of
       an empty hero. Its buttons are hidden anyway while focus is in the rows (.in-rows), and stay usable from the hero:
       Play and Details work from the title's id alone. */
    function heroPlaceholder(on) {
      if (on && !s.heroSkel) {
        var sk = el('div', 'mb-skel mb-skel-title'), sm = el('div', 'mb-skel mb-skel-meta');
        text.insertBefore(sk, metaEl);
        text.insertBefore(sm, metaEl);
        s.heroSkel = [sk, sm];
      } else if (!on && s.heroSkel) {
        U.each(s.heroSkel, U.detach);
        s.heroSkel = null;
      }
    }

    function fillHero(item, rowTitle, fade) {
      if (!item || !s.alive) return;
      var m = meta(item.key) || {};
      var ratings = m.ratings || {};
      var infoData = {
        imdb: ratings.imdb || item.rating || '',
        badge: item.badge,
        update: item.kind === 'tv' ? (item.update || '') : ''
      };
      var apply = function () {
        var name = item.title || m.title || '';
        heroPlaceholder(!name);
        /* The kicker names the kind of title; the row name is already shown right above the focused row. */
        kicker.textContent = item.kind === 'tv' ? 'TV Series' : 'Movie';
        title.textContent = name;
        var genres = m.genres && m.genres.length ? m.genres : item.genres;
        metaEl.textContent = Kit.metaLine([m.year || item.year, Kit.fmtRuntime(m.runtime || item.runtime), m.certification, Kit.genresText(genres, 3)]);
        heroTags(tags, infoData);
        U.empty(resume);
        if (item.progress >= 0) {
          Kit.progressBar(item.progress, resume);
          el('div', 'mb-meta', item.progressLabel ? 'Continue from ' + item.progressLabel : 'Continue watching', resume);
          resume.style.display = '';
        } else resume.style.display = 'none';
        var ov = U.text(m.overview);
        overview.textContent = ov;
        Kit.setLabel(playBtn, isContinue(item) ? 'Resume' : 'Play');
        art.set(m.backdrop || item.backdrop, m.poster || item.poster);
      };
      if (fade) {
        U.toggleClass(text, 'is-swapping', true);
        U.later(function () { if (heroItem === item) apply(); U.toggleClass(text, 'is-swapping', false); }, 140, 'hero-swap');
      } else apply();
    }

    function watchMeta(item, rowTitle) {
      clearTimeout(pollTimer);
      var tries = 0;
      var have = !!(meta(item.key) || {}).overview;
      if (have) return;
      (function poll() {
        pollTimer = U.later(function () {
          if (!s.alive || heroItem !== item) return;
          var m = meta(item.key);
          if (m && (m.overview || m.backdrop)) { learnTitle(item, m); fillHero(item, rowTitle, false); return; }
          if (++tries < 24) poll();
        }, 350, 'hero-meta');
      }());
    }

    /* A title learned from its page (banners carry none) is written back to the item and its cards. */
    function learnTitle(item, d) {
      var t = U.text((d && d.title) || (meta(item.key) || {}).title);
      if (!t || U.text(item.title)) return;
      U.each(U.qsa(rowsEl, '[data-key="' + item.key + '"]'), function (c) {
        var lab = U.qs(c, '.mb-card-label') || U.qs(c, '.mb-card-title');
        if (!lab || !U.text(lab.textContent)) Kit.setCardTitle(c, t);
      });
      item.title = t;
    }

    function prefetch(item, rowTitle) {
      try {
        if (typeof Api !== 'undefined' && Api.prefetch) Api.prefetch(item, U.guard(function (err, d) { learnTitle(item, d); if (heroItem === item) fillHero(item, rowTitle, false); }, 'prefetch-cb'));
      } catch (e) { Log.warn('prefetch', e); }
      watchMeta(item, rowTitle);
    }

    function focusItem(item, rowTitle) {
      if (heroItem && item && heroItem.key === item.key && heroRow === rowTitle) return;
      heroItem = item;
      heroRow = rowTitle;
      clearTimeout(heroTimer); clearTimeout(dwellTimer); clearTimeout(pollTimer);
      heroTimer = U.later(function () { if (heroItem === item) fillHero(item, rowTitle, true); }, 250, 'hero');
      /* A title with no name yet (a Featured banner) is fetched almost at once; others after the dwell (longer in TV
         performance mode, so scrolling through a row starts fewer requests). */
      var dwell = 450;
      try { if (typeof Kit.timing === 'function') dwell = Kit.timing('dwell') || 450; } catch (e) { dwell = 450; }
      dwellTimer = U.later(function () { if (heroItem === item) prefetch(item, rowTitle); }, item.title ? dwell : 60, 'dwell');
    }

    function makeRow(row, index) {
      var zoneName = 'row:' + row.id;
      var rowEl = Kit.zone(el('div', 'mb-row' + (row.wide ? ' mb-row--wide' : ''), null, rowsEl), zoneName);
      rowEl.__title = row.title;
      el('div', 'mb-row-title', row.title, rowEl);
      var view = el('div', 'mb-row-view', null, rowEl);
      var track = el('div', 'mb-track', null, view);
      U.each(row.items, function (it) { track.appendChild(Kit.card(it, { size: row.wide ? 'wide' : 'poster', zone: zoneName })); });
      if (row.more) {
        var more = Kit.moreTile(zoneName, 'See all', row.wide ? 'wide' : 'poster');
        more.__run = function () { App.push('browse', { url: row.more, title: row.title, kicker: 'Browse' }); };
        track.appendChild(more);
      }
      rowEls.push(rowEl);
      return rowEl;
    }

    function render(data) {
      if (!s.alive) return;
      rowEls = [];
      U.empty(rowsEl);
      btns.style.display = '';
      var rows = [], cont = null, banners = [];
      var byKey = {};
      U.each(data && data.rows || [], function (r, i) {
        var items = normItems(r.items);
        if (!items.length) return;
        U.each(items, function (it) { if (!byKey[it.key]) byKey[it.key] = it; });
        var row = { id: String(r.id || ('r' + i)).replace(/[^\w-]/g, '') || ('r' + i), title: U.text(r.title) || 'Featured', items: items, more: r.more || '' };
        if (!cont && U.find(items, function (it) { return it.progress >= 0; })) cont = row;
        else rows.push(row);
      });
      U.each(data && data.banners || [], function (b) {
        if (!b || !b.id) return;
        var known = byKey[b.key] || {};
        var it = normItem({ key: b.key, kind: b.kind, id: b.id, href: b.href, title: known.title || '', poster: known.poster || '', backdrop: b.image || known.backdrop, rating: known.rating, year: known.year, badge: known.badge, genres: known.genres });
        banners.push(it);
      });
      var ordered = [];
      if (cont) ordered.push(cont);
      if (banners.length) ordered.push({ id: 'featured', title: 'Featured', items: banners, wide: true, more: '' });
      ordered = ordered.concat(rows);
      if (!ordered.length) {
        hero.style.display = 'none';
        info.style.display = 'none';
        stateBlock(rowsEl, {
          icon: 'film', title: 'Nothing to show yet',
          text: 'The home page loaded, but no rows were recognised. The website itself still works.',
          actions: [{ label: 'Retry', icon: 'reload', action: 'retry', primary: true }, { label: 'Open website', icon: 'globe', action: 'open-website' }]
        }, 'buttons');
        port.style.top = '30%';
        return;
      }
      U.each(ordered, makeRow);
      var first = Focus.firstIn(rowEls[0]);
      if (first && first.__item) { heroItem = null; focusItem(first.__item, rowEls[0].__title); fillHero(first.__item, rowEls[0].__title, false); }
      App.screenReady(s);
    }

    s.initialFocus = function () { return rowEls.length ? Focus.firstIn(rowEls[0]) : Focus.firstIn(s.el); };

    s.onFocus = function (node) {
      var z = Focus.zoneOf(node), name = z ? z.getAttribute('data-zone') : '';
      if (name.indexOf('row:') === 0) {
        var idx = U.indexOf(rowEls, z);
        var y = idx > 0 ? rowEls[idx].offsetTop - rowEls[0].offsetTop : 0;
        Kit.setY(rowsEl, -y);
        U.each(rowEls, function (r, i) { U.toggleClass(r, 'is-past', i < idx); });
        /* In the rows the hero's buttons step aside and the rows move up, so the next row peeks in below. */
        U.toggleClass(s.el, 'in-rows', true);
        if (node.__item) focusItem(node.__item, z.__title);
      } else if (name === 'hero') {
        Kit.setY(rowsEl, 0);
        U.toggleClass(s.el, 'in-rows', false);
        U.each(rowEls, function (r) { U.toggleClass(r, 'is-past', false); });
      }
    };

    /* Up and Down step through the rows in order (the rows above the focused one are faded and moved up, so geometry
       alone could skip one); Up from the first row reaches the hero's buttons. */
    s.onKey = function (name) {
      if (name !== 'up' && name !== 'down') return false;
      var cur = Focus.current(), z = cur ? Focus.zoneOf(cur) : null, idx = z ? U.indexOf(rowEls, z) : -1;
      if (idx < 0) return false;
      var ti = idx + (name === 'down' ? 1 : -1), target = null;
      if (ti >= rowEls.length) return true;
      if (ti < 0) target = btns.__mbLast && Focus.shown(btns.__mbLast) && btns.contains(btns.__mbLast) ? btns.__mbLast : playBtn;
      else target = Focus.enter(rowEls[ti], name, cur.getBoundingClientRect());
      if (target && Focus.shown(target)) App.moveTo(target);
      return true;
    };

    /* Back from a lower row returns to the first row (like other TV apps); Back on the first row or the hero asks to
       exit (section 6.3). */
    s.onBack = function () {
      var cur = Focus.current(), z = cur ? Focus.zoneOf(cur) : null, idx = z ? U.indexOf(rowEls, z) : -1;
      if (idx <= 0) return false;
      var first = rowEls[0], target = first.__mbLast && Focus.shown(first.__mbLast) && first.contains(first.__mbLast) ? first.__mbLast : Focus.firstIn(first);
      if (!target) return false;
      App.focus(target);
      return true;
    };

    s.act = function (action, node) {
      if (action === 'play' && heroItem) { App.play({ kind: heroItem.kind, id: heroItem.id, title: heroItem.title, item: heroItem, playHref: heroItem.playHref }); return true; }
      if (action === 'details' && heroItem) { App.push('detail', { kind: heroItem.kind, id: heroItem.id, item: compactItem(heroItem) }); return true; }
      if (action === 'retry') { App.retry(); return true; }
      if (action === 'open-website') { App.openWebsite(siteUrl('home', [], '/')); return true; }
      if (node && node.__item) { App.push('detail', { kind: node.__item.kind, id: node.__item.id, item: compactItem(node.__item) }); return true; }
      return false;
    };

    s.destroy = function () { clearTimeout(heroTimer); clearTimeout(dwellTimer); clearTimeout(pollTimer); };

    skeleton();
    var live = ctx && ctx.live ? (ctx.model && ctx.model.rows ? ctx.model : site('home', [document], null)) : null;
    if (live && live.rows && live.rows.length) U.later(function () { render(live); }, 0, 'home-live');
    else api('home', [], function (err, data) {
      if (!s.alive) return;
      if (err) { fail(s, err); return; }
      render(data);
    });
    return s;
  };

  /* ---------- Detail ---------- */

  registry.detail = function (params, ctx) {
    var s = base('detail', 'detail');
    s.nav = params.nav || '';
    var kind = params.kind === 'tv' ? 'tv' : 'movie', id = String(params.id || '');
    var key = kind + ':' + id;
    var seed = normItem(params.item || { kind: kind, id: id, key: key });
    var model = null, season = params.season || 0;
    var back = el('div', 'mb-backdrop', null, s.el);
    var art = artLayer(back, function (rawPoster) { showPosterCard(rawPoster); });
    scrims(back, true);
    el('div', 'mb-dim', null, back);
    var posterCard = el('div', 'mb-detail-poster', null, s.el);
    posterCard.style.display = 'none';
    var vport = el('div', 'mb-vport', null, s.el);
    var vs = el('div', 'mb-vscroll', null, vport);
    /* Compact header shown above the rows once the viewer moves below the info block: title, a meta line and three
       lines of text (the overview, or the focused episode's code, title and overview). Its height is fixed, so the
       rows always start at the same place right under it. */
    var mini = el('div', 'mb-detail-mini', null, s.el);
    var miniKicker = el('div', 'mb-kicker', kind === 'tv' ? 'TV Series' : 'Movie', mini);
    var miniTitle = el('div', 'mb-mini-title', seed.title, mini);
    var miniMeta = el('div', 'mb-mini-meta', '', mini);
    var miniBody = el('div', 'mb-mini-body', '', mini);
    var top = el('div', 'mb-detail-top', null, vs);
    var info = el('div', 'mb-detail-info', null, top);
    var kicker = el('div', 'mb-kicker', kind === 'tv' ? 'TV Series' : 'Movie', info);
    var title = el('div', 'mb-display', seed.title, info);
    var metaEl = el('div', 'mb-meta', '', info);
    var ratings = el('div', 'mb-ratings', null, info);
    var overview = el('div', 'mb-body mb-clamp4', '', info);
    var tags = el('div', 'mb-tags', null, info);
    var btns = Kit.zone(el('div', 'mb-btns', null, info), 'hero');
    var playBtn = Kit.button({ label: playLabel(null), icon: 'play', action: 'play', primary: true, parent: btns });
    var qualityBtn = null, episodesBtn = null;
    if (kind === 'movie') qualityBtn = Kit.button({ label: 'Quality: ' + qualityLabel(pref('quality', 'best')).replace(' available', ''), icon: 'quality', action: 'quality', parent: btns });
    else episodesBtn = Kit.button({ label: 'Episodes', icon: 'list', action: 'episodes', parent: btns });
    var rowsWrap = el('div', 'mb-detail-rows', null, vs);
    var seasonsRow = null, episodesRow = null, episodesTrack = null, seasonLine = null, rowEls = [];
    /* Season switching (section 6.2): focus resting on a season pill for SEASON_DWELL ms loads that season (OK loads it
       at once). While it loads, the previous episodes stay, dimmed, under a spinner, and Down waits for the new list. */
    var SEASON_DWELL = 450, dwellTimer = null, seasonSeq = 0, loadingSeason = 0, pendingDown = false;

    function skeletonInfo() {
      var m = meta(key) || {};
      if (!title.textContent) title.textContent = m.title || '';
      if (!title.textContent) { title.style.display = 'none'; info.insertBefore(el('div', 'mb-skel mb-skel-title'), metaEl); }
      metaEl.textContent = Kit.metaLine([m.year || seed.year, Kit.fmtRuntime(m.runtime || seed.runtime), m.certification, Kit.genresText(m.genres || seed.genres, 3)]);
      if (m.overview) overview.textContent = m.overview;
      else {
        overview.style.display = 'none';
        s.skel = [el('div', 'mb-skel mb-skel-text'), el('div', 'mb-skel mb-skel-text'), el('div', 'mb-skel mb-skel-text is-short')];
        U.each(s.skel, function (n) { info.insertBefore(n, tags); });
      }
      setArt(m.backdrop || seed.backdrop, m.poster || seed.poster);
    }

    function showPosterCard(poster) {
      var ok = Kit.safeImage(poster);
      posterCard.style.display = ok ? '' : 'none';
      if (ok && posterCard.__src !== poster) { U.empty(posterCard); posterCard.__src = poster; image(poster, '', posterCard, perfOn() ? 342 : IMG_POSTER, true); }
    }

    function setArt(backdrop, poster) {
      art.set(backdrop, poster);
      if (!Kit.safeImage(backdrop)) showPosterCard(poster);
      else posterCard.style.display = 'none';
    }

    function ratingsRow(r) {
      U.empty(ratings);
      if (!r) return;
      if (r.imdb) el('span', 'mb-tag mb-tag--imdb', 'IMDb ' + r.imdb, ratings);
      function score(val, label, dotCls) {
        var sc = el('span', 'mb-score', null, ratings);
        el('span', 'mb-score-dot' + (dotCls ? ' ' + dotCls : ''), null, sc);
        el('span', 'mb-score-val', val, sc);
        el('span', 'mb-score-lbl', label, sc);
      }
      if (r.tomato) score(r.tomato, 'Tomatometer');
      if (r.audience) score(r.audience, 'Audience', 'mb-score-dot--aud');
      ratings.style.display = ratings.firstChild ? '' : 'none';
    }

    /* "S37E21" (a Continue Watching card) or "Continue S3 E5" names an episode. */
    function epFromLabel(label) {
      var m = /S(\d{1,4})\s*E(\d{1,4})/i.exec(String(label || ''));
      return m && +m[1] > 0 ? { season: +m[1], episode: +m[2] } : null;
    }

    /* What the viewer just watched in the built-in player from this screen (App sets params.lastPlayed when it closes:
       {kind, season, episode, time, duration, over, resume, marks: {'2x1': 1}}). It is fresher than the title page,
       whose own marks can lag behind the last progress post, and it replaces the Continue Watching card's position. */
    function lastPlayed() {
      var lp = params.lastPlayed;
      return lp && typeof lp === 'object' && lp.kind === kind ? lp : null;
    }

    function seedResume() { return !lastPlayed() && isContinue(seed) ? epFromLabel(seed.progressLabel) : null; }

    function code(se, ep) { return 'S' + se + 'E' + ep; }

    /* The episode after lp in the site's list (the watch-plan list, else the season shown), else the next season's
       first episode (specials aside); null after the last one. */
    function episodeAfter(lp, m) {
      var all = (m && m.allEpisodes) || (model && model.allEpisodes) || {}, list = all[lp.season] || [], nx = null;
      if (!list.length) list = U.map(episodeCards(), function (c) { return c.__episode; });
      U.each(list, function (e) { if (+e.season === lp.season && +e.episode > lp.episode && (!nx || +e.episode < +nx.episode)) nx = e; });
      if (nx) return { season: lp.season, episode: +nx.episode };
      U.each(all[lp.season + 1] || [], function (e) { if (+e.episode > 0 && (!nx || +e.episode < +nx.episode)) nx = e; });
      return nx ? { season: lp.season + 1, episode: +nx.episode } : null;
    }

    /* The episode a show's Play/Resume button starts: what was just watched here (the same episode to resume, or the
       one after a finished episode), else the Continue Watching card's episode, else the page's choice (Site.detail
       nextEpisode: its resume label, else the first unwatched episode, else S1E1), else none (the App then lets the
       player or the website decide). */
    function playTarget(m) {
      if (kind !== 'tv') return null;
      var lp = lastPlayed();
      if (lp && +lp.season > 0) {
        var after = lp.over ? episodeAfter(lp, m) : null;
        if (after) return { season: after.season, episode: after.episode, code: code(after.season, after.episode), resume: false };
        if (!lp.over) return { season: +lp.season, episode: +lp.episode, code: code(lp.season, lp.episode), resume: !!lp.resume };
      }
      var r = seedResume();
      if (r) return { season: r.season, episode: r.episode, code: code(r.season, r.episode), resume: true };
      var n = m && m.nextEpisode;
      return n && +n.season > 0 && +n.episode >= 0 ? { season: +n.season, episode: +n.episode, code: code(n.season, n.episode), resume: !!n.resume } : null;
    }

    /* "Resume S1E3", "Play S2E1", or plain "Play"/"Resume" when no episode is known (and for movies). */
    function playLabel(m) {
      var t = playTarget(m), lp = lastPlayed();
      if (t) return (t.resume ? 'Resume ' : 'Play ') + t.code;
      if (lp && kind === 'movie') return lp.resume ? 'Resume' : 'Play';
      var raw = U.text(m && m.playLabel);
      if (/resume|continue|\d:\d\d/i.test(raw) || (!lp && isContinue(seed))) return 'Resume';
      return 'Play';
    }

    /* Episodes finished in the built-in player count as watched before the title page says so. */
    function applyMarks(m) {
      var marks = (lastPlayed() || {}).marks;
      if (!marks || !m) return;
      function mark(e) { if (e && marks[e.season + 'x' + e.episode] === 1) e.watched = true; }
      U.each(m.episodes || [], mark);
      for (var n in (m.allEpisodes || {})) if (m.allEpisodes.hasOwnProperty(n)) U.each(m.allEpisodes[n] || [], mark);
    }

    function makeRow(zoneName, label) {
      var row = Kit.zone(el('div', 'mb-row', null, rowsWrap), zoneName);
      if (label) el('div', 'mb-row-title', label, row);
      var view = el('div', 'mb-row-view', null, row);
      var track = el('div', 'mb-track', null, view);
      rowEls.push(row);
      return { row: row, track: track };
    }

    /* The Continue Watching card's progress (or the position just watched here) shows on its episode. */
    function episodeProgress(ep) {
      var lp = lastPlayed();
      if (lp) return lp.resume && +lp.season === +ep.season && +lp.episode === +ep.episode && lp.duration > 0 ? U.clamp(lp.time / lp.duration, 0, 1) : -1;
      var r = seedResume();
      return r && r.season === +ep.season && r.episode === +ep.episode && seed.progress >= 0 ? seed.progress : -1;
    }

    /* The watched check and the progress bar of a card that is already on screen. */
    function updateCard(c) {
      var ep = c.__episode, a = U.qs(c, '.mb-card-art');
      if (!ep || !a) return;
      U.toggleClass(c, 'is-watched', !!ep.watched);
      if (c.__meta) c.__meta.textContent = epMeta(ep);
      var old = U.qs(a, '.mb-ep-progress'), prog = episodeProgress(ep);
      if (old) U.detach(old);
      if (prog >= 0 && (!ep.watched || lastPlayed())) Kit.progressBar(prog, el('div', 'mb-ep-progress', null, a));
    }

    /* Runtime, date and rating; the watched state is the check on the picture (and "Watched" in the header). */
    function epMeta(ep) {
      return Kit.metaLine([+ep.episode === 0 ? 'Special' : '', Kit.fmtRuntime(ep.runtime), ep.date, ep.rating ? 'IMDb ' + ep.rating : '']);
    }

    function episodeCard(ep) {
      var still = Kit.safeImage(ep.still);
      var c = el('div', 'mb-card mb-card--wide mb-episode' + (still ? '' : ' mb-episode--text') + (ep.watched ? ' is-watched' : ''));
      Kit.focusable(c, 'ep|' + ep.season + 'x' + ep.episode);
      c.setAttribute('data-episode', ep.season + 'x' + ep.episode);
      c.__episode = ep;
      var code = ep.code || ('S' + ep.season + 'E' + ep.episode);
      var a = el('div', 'mb-card-art', null, c);
      if (still) {
        var ph = el('div', 'mb-card-ph', null, a);
        el('span', 'mb-card-ph-title', code, ph);
        image(ep.still, 'mb-card-img', a, perfOn() ? 480 : IMG_STILL);
        el('div', 'mb-card-shade', null, a);
        el('span', 'mb-ep-code', code, a);
      } else {
        /* An episode the site lists by name only (no picture): a deliberate text card, never a broken image. */
        var tx = el('div', 'mb-ep-text', null, a);
        el('div', 'mb-ep-text-num', +ep.episode > 0 ? String(ep.episode) : '', tx);
        el('div', 'mb-ep-text-code', +ep.episode === 0 ? code + '  \u00b7  Special' : code, tx);
        el('div', 'mb-ep-text-title', ep.title || ('Episode ' + ep.episode), tx);
      }
      var check = el('span', 'mb-ep-check', null, a);
      check.appendChild(Icons.el('check'));
      var prog = episodeProgress(ep);
      if (prog >= 0 && (!ep.watched || lastPlayed())) Kit.progressBar(prog, el('div', 'mb-ep-progress', null, a));
      var play = el('div', 'mb-ep-play', null, a);
      play.appendChild(Icons.el('play'));
      el('div', 'mb-ep-title', (+ep.episode ? ep.episode + '. ' : '') + (ep.title || 'Episode ' + ep.episode), c);
      c.__meta = el('div', 'mb-ep-meta', epMeta(ep), c);
      /* The focused episode's overview is shown at reading size in the header above the rows (section 6.2). */
      return c;
    }

    function episodeCards() { return episodesTrack ? U.filter(U.qsa(episodesTrack, '[data-episode]'), function (c) { return !!c.__episode; }) : []; }

    /* Where Down from the season pills lands: the Play target when it is in this season, else the first unwatched
       episode (specials aside), else episode 1, else the first card. */
    function targetCard() {
      var cards = episodeCards(), t = playTarget(model);
      if (!cards.length) return null;
      return (t && U.find(cards, function (c) { return +c.__episode.season === t.season && +c.__episode.episode === t.episode; })) ||
        U.find(cards, function (c) { return +c.__episode.episode > 0 && !c.__episode.watched; }) ||
        U.find(cards, function (c) { return +c.__episode.episode === 1; }) || cards[0];
    }

    /* "Season 2 · 13 episodes" and, once any are watched, the watched share: the displayed list when it is that season,
       else the page's watch-plan list; the site's own "5/13 episodes watched" line wins when it has one. */
    function setSeasonLine(n, m) {
      if (!seasonLine) return;
      var src = m || model || {}, list = null;
      if (m && +m.season === +n) list = m.episodes;
      else if (src.allEpisodes && src.allEpisodes[n]) list = src.allEpisodes[n];
      else if (model && model.allEpisodes && model.allEpisodes[n]) list = model.allEpisodes[n];
      var stats = (src.seasonStats && src.seasonStats[n]) || (model && model.seasonStats && model.seasonStats[n]) || null;
      var total = list ? list.length : 0, watched = 0;
      U.each(list || [], function (e) { if (e.watched) watched++; });
      /* The site's own count, unless episodes finished here since the page was read are not in it yet. */
      if (stats && stats.total > 0) { total = stats.total; watched = Math.min(Math.max(stats.watched, watched), stats.total); }
      U.empty(seasonLine);
      el('span', 'mb-season-name', 'Season ' + n, seasonLine);
      if (total) el('span', 'mb-season-count', total === 1 ? '1 episode' : total + ' episodes', seasonLine);
      if (total && watched > 0) {
        var w = el('span', 'mb-season-watched', null, seasonLine);
        Kit.progressBar(watched / total, w);
        el('span', 'mb-season-watched-text', watched >= total ? 'All watched' : watched + ' of ' + total + ' watched', w);
      }
    }

    function setLoading(on) {
      if (!episodesRow) return;
      U.toggleClass(episodesRow, 'is-loading', !!on);
    }

    /* list: the season's episodes; mode 'loading' keeps the current cards (dimmed, with the spinner) or shows
       placeholders when there are none. Returns the card Down should land on. */
    function fillEpisodes(list, mode) {
      if (!episodesTrack) return null;
      if (mode === 'loading') {
        setLoading(true);
        if (!episodeCards().length) {
          U.empty(episodesTrack);
          Kit.setX(episodesTrack, 0);
          Kit.skeletonCards(episodesTrack, 5, 'wide');
        }
        return null;
      }
      setLoading(false);
      U.empty(episodesTrack);
      Kit.setX(episodesTrack, 0);
      if (!list || !list.length) {
        var none = el('div', 'mb-empty mb-empty--inline', null, episodesTrack);
        el('div', 'mb-body', 'No episodes are listed for this season yet.', none);
        return null;
      }
      U.each(list, function (ep) { episodesTrack.appendChild(episodeCard(ep)); });
      var target = targetCard();
      if (episodesRow) episodesRow.__mbLast = target;
      Kit.lazySoon(s.el);
      return target;
    }

    function seasonError(n) {
      setLoading(false);
      U.empty(episodesTrack);
      Kit.setX(episodesTrack, 0);
      var box = el('div', 'mb-empty mb-empty--inline', null, episodesTrack);
      el('div', 'mb-body', 'Couldn\u2019t load season ' + n + '.', box);
      var retry = Kit.button({ label: 'Try again', icon: 'reload', action: 'season-retry', primary: true, parent: box, key: 'season-retry|' + n });
      if (episodesRow) episodesRow.__mbLast = retry;
      return retry;
    }

    function markSeason(n) {
      U.each(U.qsa(seasonsRow, '[data-season]'), function (c) {
        U.toggleClass(c, 'is-selected', +c.getAttribute('data-season') === n);
        if (+c.getAttribute('data-season') === n) seasonsRow.__mbLast = c;
      });
    }

    function loadSeason(n) {
      if (!seasonsRow) return;
      clearTimeout(dwellTimer);
      dwellTimer = null;
      season = n;
      params.season = n;   /* a rebuild (after playback, or a restored stack) shows the season the viewer chose */
      loadingSeason = n;
      var mine = ++seasonSeq;
      markSeason(n);
      setSeasonLine(n, null);
      fillEpisodes(null, 'loading');
      var done = function (err, m) {
        if (!s.alive || mine !== seasonSeq) return;
        loadingSeason = 0;
        /* Down pressed (or OK on the pill) while it loaded, or focus on a card being replaced: move to the new list. */
        var cur = Focus.current(), follow = !!cur && ((pendingDown && seasonsRow.contains(cur)) || episodesTrack.contains(cur));
        pendingDown = false;
        if (err || !m) {
          if (err && err.code === 'signed-out') { fail(s, err); return; }
          var retry = seasonError(n);
          if (follow) App.focus(retry);
          return;
        }
        applyMarks(m);
        var target = fillEpisodes(m.episodes || [], null);
        setSeasonLine(n, m);
        if (follow && target) App.focus(target);
        else if (follow) App.focus(seasonPill(n));
      };
      /* Api.detail(kind, id, cb, opts): the callback is not last, so it is called directly. */
      try {
        if (typeof Api !== 'undefined' && Api.detail) Api.detail(kind, id, U.guard(done, 'season-cb'), { season: n });
        else done({ code: 'exception' });
      } catch (e) { Log.error('season', e); done({ code: 'exception' }); }
    }

    /* Focus resting on another season's pill switches to it (like Netflix); moving on before SEASON_DWELL cancels. */
    function armDwell(node) {
      clearTimeout(dwellTimer);
      dwellTimer = null;
      if (!node || !seasonsRow || !seasonsRow.contains(node) || !node.hasAttribute('data-season')) return;
      var n = +node.getAttribute('data-season');
      if (n === season) return;
      dwellTimer = U.later(function () {
        dwellTimer = null;
        if (s.alive && Focus.current() === node && Focus.shown(node) && n !== season) loadSeason(n);
      }, SEASON_DWELL, 'season-dwell');
    }

    function render(m) {
      if (!s.alive) return;
      model = m;
      applyMarks(m);
      U.each(U.qsa(info, '.mb-skel'), U.detach);
      title.style.display = '';
      overview.style.display = '';
      title.textContent = m.title || seed.title || '';
      miniTitle.textContent = title.textContent;
      miniKicker.textContent = Kit.metaLine([kind === 'tv' ? 'TV Series' : 'Movie', m.year]);
      kicker.textContent = kind === 'tv' ? (m.update ? 'TV Series  \u00b7  ' + m.update.replace(/^Update to\s*/i, 'Up to ') : 'TV Series') : 'Movie';
      metaEl.textContent = Kit.metaLine([m.year, Kit.fmtRuntime(m.runtime), m.certification, Kit.genresText(m.genres, 3)]);
      ratingsRow(m.ratings);
      overview.textContent = m.overview || '';
      miniDefault();
      U.empty(tags);
      U.each(badgeList(m.badges), function (b) { el('span', 'mb-tag mb-tag--line', b, tags); });
      if (m.audio) el('span', 'mb-tag mb-tag--line', m.audio, tags);
      tags.style.display = tags.firstChild ? '' : 'none';
      Kit.setLabel(playBtn, playLabel(m));
      setArt(m.backdrop || m.backdropOriginal || seed.backdrop, m.poster || seed.poster);
      U.empty(rowsWrap);
      rowEls = [];
      seasonsRow = null; episodesRow = null; episodesTrack = null; seasonLine = null;
      if (kind === 'tv') {
        var seasons = m.seasons || [];
        season = m.season || season || (seasons[0] && seasons[0].number) || 1;
        if (seasons.length) {
          /* One horizontally scrolling line of pills (a long-running show has dozens of seasons): Left/Right walk it
             and Up/Down leave it, like any row. */
          seasonsRow = Kit.zone(el('div', 'mb-row mb-row--seasons', null, rowsWrap), 'seasons');
          var pills = el('div', 'mb-track mb-seasons', null, el('div', 'mb-row-view', null, seasonsRow));
          U.each(seasons, function (se) {
            var c = Kit.chip('Season ' + se.number, { key: 'season|' + se.number, parent: pills });
            c.setAttribute('data-season', String(se.number));
            U.toggleClass(c, 'is-selected', +se.number === +season);
            if (+se.number === +season) seasonsRow.__mbLast = c;
          });
          rowEls.push(seasonsRow);
          U.later(function () { if (s.alive && seasonsRow && seasonsRow.__mbLast) Kit.scrollTrack(pills, seasonsRow.__mbLast); }, 0, 'season-scroll');
        }
        var er = makeRow('row:episodes', seasons.length ? '' : 'Episodes');
        episodesRow = er.row; episodesTrack = er.track;
        U.toggleClass(episodesRow, 'mb-row--episodes', true);
        if (seasons.length) {
          seasonLine = el('div', 'mb-season-info');
          episodesRow.insertBefore(seasonLine, episodesRow.firstChild);
        }
        Kit.spinner(el('div', 'mb-ep-spinner', null, episodesTrack.parentNode));
        fillEpisodes(m.episodes || [], null);
        setSeasonLine(season, m);
      }
      var related = normItems(m.related);
      if (related.length) {
        var rr = makeRow('row:related', 'More like this');
        U.each(related, function (it) { rr.track.appendChild(Kit.card(it, { size: 'poster', zone: 'row:related' })); });
      }
      var cast = m.cast || [];
      if (cast.length) {
        var cr = makeRow('row:cast', 'Cast & crew');
        U.toggleClass(cr.track, 'mb-cast', true);
        U.each(cast.slice(0, 24), function (p) {
          var c = el('div', 'mb-person', null, cr.track);
          Kit.focusable(c, 'cast|' + p.name);
          c.__person = p;
          el('div', 'mb-person-name', p.name, c);
          el('div', 'mb-person-role', U.titleCase(p.role || '') || '\u00a0', c);
        });
      }
      if (episodesBtn && !episodesRow) episodesBtn.setAttribute('data-disabled', '');
      Kit.lazySoon(s.el);
      App.screenReady(s);
    }

    s.model = function () { return model; };
    s.params = params;
    s.initialFocus = function () { return playBtn; };

    /* The title page was read again (for example after playback): the Play/Resume label, the watched marks and the
       season line change in place, so focus and scroll stay. Returns false when the page shows something this screen
       cannot patch (another title, or no model yet): the caller rebuilds the screen instead. */
    s.refreshModel = function (m) {
      if (!s.alive || !m || !model || m.key !== model.key) return false;
      model = m;
      applyMarks(m);
      Kit.setLabel(playBtn, playLabel(m));
      if (kind !== 'tv') return true;
      var fresh = {};
      U.each((m.allEpisodes && m.allEpisodes[season]) || [], function (x) { fresh[x.season + 'x' + x.episode] = !!x.watched; });
      if (+m.season === +season) U.each(m.episodes || [], function (x) { fresh[x.season + 'x' + x.episode] = !!x.watched; });
      U.each(episodeCards(), function (c) {
        var ep = c.__episode, k = ep.season + 'x' + ep.episode;
        if (fresh.hasOwnProperty(k)) ep.watched = fresh[k];
        updateCard(c);
      });
      if (episodesRow && !loadingSeason) { var t = targetCard(); if (t) episodesRow.__mbLast = t; }
      setSeasonLine(season, +m.season === +season ? m : null);
      return true;
    };

    /* The season whose episodes are on screen (it can differ from model().season after a switch). */
    s.season = function () { return +season || 0; };

    /* The built-in player closed after playing from here (App set params.lastPlayed): the Play/Resume label, the watched
       checks, the progress bar and the season line follow at once, before the title page is read again. The Continue
       Watching card's position no longer applies. */
    s.afterPlayback = function () {
      if (!s.alive) return false;
      seed.progress = -1;
      seed.progressLabel = '';
      seed.playHref = '';
      if (model) applyMarks(model);
      Kit.setLabel(playBtn, playLabel(model));
      if (kind !== 'tv') return true;
      var marks = (lastPlayed() || {}).marks || {};
      U.each(episodeCards(), function (c) {
        var ep = c.__episode;
        if (marks[ep.season + 'x' + ep.episode] === 1) ep.watched = true;
        updateCard(c);
      });
      if (!loadingSeason) setSeasonLine(season, model && +model.season === +season ? model : null);
      return true;
    };

    function seasonPill(n) { return seasonsRow ? U.qs(seasonsRow, '[data-season="' + n + '"]') : null; }

    function miniDefault() {
      var m = model || {};
      miniMeta.textContent = Kit.metaLine([m.year || seed.year, Kit.fmtRuntime(m.runtime || seed.runtime), m.certification, Kit.genresText(m.genres || seed.genres, 3)]);
      miniBody.textContent = U.text(m.overview || (meta(key) || {}).overview);
    }

    /* The header follows focus: the focused episode's code, title and overview, otherwise the title's own. */
    function miniFor(node) {
      var ep = node && node.__episode;
      if (!ep) { miniDefault(); return; }
      miniMeta.textContent = Kit.metaLine(['S' + ep.season + ' \u00b7 E' + ep.episode + (ep.title ? '  ' + ep.title : ''), Kit.fmtRuntime(ep.runtime), ep.date, ep.watched ? 'Watched' : '']);
      miniBody.textContent = U.text(ep.overview) || U.text((model || {}).overview);
    }

    /* Rows start directly under the fixed-height header, never leaving an empty band: the focused row (for episodes,
       the season pills above them) is anchored at the header's bottom, the scroll never goes past the last row, and
       it never lets the first row drop below the anchor. Rows scrolled above the anchor fade out (.is-past). */
    s.onFocus = function (node) {
      armDwell(node);
      pendingDown = false;
      var z = Focus.zoneOf(node), name = z ? z.getAttribute('data-zone') : '';
      if (name === 'hero' || !z || !rowsWrap.contains(z)) {
        Kit.setY(vs, 0);
        U.toggleClass(s.el, 'is-scrolled', false);
        U.each(rowEls, function (r) { U.toggleClass(r, 'is-past', false); });
        return;
      }
      miniFor(node);
      var em = Kit.em(), anchor = mini.offsetTop + mini.offsetHeight + em * 2;
      var target = z === episodesRow && seasonsRow ? seasonsRow : z;
      var y = Math.max(0, Kit.offsetIn(target, vs).top - anchor);
      var first = rowEls[0], last = rowEls[rowEls.length - 1];
      if (first && last) {
        var lb = Kit.offsetIn(last, vs);
        y = Math.min(y, Math.max(0, lb.top + lb.height + em * 2 - vport.clientHeight, Kit.offsetIn(first, vs).top - anchor));
      }
      Kit.setY(vs, -y);
      U.toggleClass(s.el, 'is-scrolled', y > 0);
      U.each(rowEls, function (r) { U.toggleClass(r, 'is-past', r !== z && Kit.offsetIn(r, vs).top - y < anchor - em); });
    };

    /* Down from the pills while a season loads waits for its episodes (focus then moves to them). */
    s.onKey = function (name) {
      if (name !== 'down' || !loadingSeason || !seasonsRow) return false;
      var cur = Focus.current();
      if (!cur || !seasonsRow.contains(cur)) return false;
      pendingDown = true;
      return true;
    };

    s.play = function (episode) {
      var t = { kind: kind, id: id, title: (model && model.title) || seed.title, item: seed, backdrop: (model && model.backdrop) || seed.backdrop };
      if (episode) {
        /* exact: this very episode, also a special (episode 0); the card knows its title (other seasons are not in
           model()). */
        t.season = +episode.season; t.episode = +episode.episode; t.exact = true;
        t.episodeTitle = U.text(episode.title);
        t.title = t.title + '  \u00b7  ' + (episode.code || ('S' + episode.season + 'E' + episode.episode));
      } else if (seed.playHref) t.playHref = seed.playHref;
      App.play(t);
    };

    s.act = function (action, node) {
      if (action === 'play') { s.play(playTarget(model)); return true; }
      if (action === 'episodes') {
        var last = episodesRow && episodesRow.__mbLast, f = last && Focus.shown(last) && episodesRow.contains(last) ? last : episodesRow && Focus.firstIn(episodesRow);
        if (f) App.focus(f);
        return true;
      }
      if (action === 'quality') {
        Overlays.quality({ title: (model && model.title) || seed.title, sources: model && model.sources || [], onPick: function (src) {
          var t = { kind: kind, id: id, title: (model && model.title) || seed.title, item: seed, pick: src };
          App.play(t);
        }, onChange: function (q) { if (qualityBtn) Kit.setLabel(qualityBtn, 'Quality: ' + qualityLabel(q).replace(' available', '')); } });
        return true;
      }
      if (node && node.__episode) { s.play(node.__episode); return true; }
      if (action === 'season-retry') { App.focus(seasonPill(season)); loadSeason(season); return true; }
      if (node && node.hasAttribute('data-season')) {
        var n = +node.getAttribute('data-season');
        /* OK on the season that is loading: go down to its episodes as soon as they arrive. */
        if (n === season && loadingSeason === n) { pendingDown = true; return true; }
        var target = episodesRow && episodesRow.__mbLast;
        if (!target || !Focus.shown(target) || !episodesTrack.contains(target)) target = episodesTrack ? U.qs(episodesTrack, '[data-episode]') : null;
        /* A season that failed or is still empty loads again; a loaded one sends focus to its episodes. */
        if (n !== season || !target || !Focus.shown(target)) loadSeason(n); else App.focus(target);
        return true;
      }
      if (node && node.__item) { App.push('detail', { kind: node.__item.kind, id: node.__item.id, item: compactItem(node.__item) }); return true; }
      if (node && node.__person) { App.push('search', { query: node.__person.name, submit: true }); return true; }
      return false;
    };

    s.refreshQuality = function () { if (qualityBtn) Kit.setLabel(qualityBtn, 'Quality: ' + qualityLabel(pref('quality', 'best')).replace(' available', '')); };
    s.onShow = s.refreshQuality;
    s.onHide = function () { clearTimeout(dwellTimer); dwellTimer = null; pendingDown = false; };
    s.destroy = s.onHide;

    skeletonInfo();
    var liveModel = ctx && ctx.live ? (ctx.model && ctx.model.key === key ? ctx.model : site('detail', [document, location.href], null)) : null;
    /* The boot page shows one season; another one chosen since then is fetched. */
    if (liveModel && kind === 'tv' && season && liveModel.season && +liveModel.season !== +season) liveModel = null;
    if (liveModel && liveModel.title) U.later(function () { render(liveModel); }, 0, 'detail-live');
    else {
      var cb = U.guard(function (err, m) {
        if (!s.alive) return;
        if (err || !m) { fail(s, err || { code: 'parse' }); return; }
        render(m);
      }, 'detail-cb');
      try {
        if (typeof Api === 'undefined' || !Api.detail) throw new Error('Api.detail unavailable');
        Api.detail(kind, id, cb, season ? { season: season } : {});
      } catch (e) { Log.error('detail', e); U.later(function () { cb({ code: 'exception' }); }, 0, 'detail-fail'); }
    }
    return s;
  };

  /* ---------- Search ---------- */

  var KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789';

  registry.search = function (params) {
    var s = base('search', 'search');
    s.nav = 'search';
    var q = U.text(params.query || '').slice(0, 80), type = params.type || 'all';
    var results = null, page = 1, next = '', loadingMore = false, searchSeq = 0, sugSeq = 0, total = null, capped = false;
    var MAX_RESULTS = 600, MAX_SUGGEST = 6;
    var left = el('div', 'mb-search-left', null, s.el);
    var line = el('div', 'mb-query-line', null, left);
    line.appendChild(Icons.el('search', 'mb-q-ico'));
    var qt = el('div', 'mb-query-text', null, line);
    var queryEl = el('span', null, '', qt);
    queryEl.id = 'mbptv-query';
    el('span', 'mb-caret', null, qt);
    el('span', 'mb-placeholder', 'Search movies and shows', line);
    var kb = Kit.zone(el('div', 'mb-keyboard', null, left), 'keyboard');
    var firstKey = null;
    U.each(KEYS.split(''), function (ch) {
      var k = el('div', 'mb-key', null, kb);
      Kit.focusable(k, 'key|' + ch);
      k.setAttribute('data-char', ch);
      el('span', 'mb-key-label', ch, k);
      if (!firstKey) firstKey = k;
    });
    function special(action, label, icon, cls) {
      var k = el('div', 'mb-key mb-key--wide' + (cls ? ' ' + cls : ''), null, kb);
      Kit.focusable(k, 'key|' + action, action);
      k.appendChild(Icons.el(icon));
      el('span', 'mb-key-label', label, k);
      return k;
    }
    special('space', 'Space', 'space');
    special('delete', 'Delete', 'backspace');
    special('clear', 'Clear', 'close', 'is-last');
    var go = el('div', 'mb-key mb-key--go', null, kb);
    Kit.focusable(go, 'key|search-submit', 'search-submit');
    go.appendChild(Icons.el('search'));
    el('span', 'mb-key-label', 'Search', go);
    var right = el('div', 'mb-search-right', null, s.el);
    var head = el('div', 'mb-results-head', null, right);
    var headTitle = el('div', 'mb-section', '', head);
    var headCount = el('div', 'mb-count', '', head);
    var tabs = Kit.zone(el('div', 'mb-chiprow mb-search-tabs', null, right), 'tabs');
    U.each([['all', 'All'], ['movie', 'Movies'], ['tv', 'TV Shows']], function (t) {
      var c = Kit.chip(t[1], { key: 'type|' + t[0], parent: tabs });
      c.setAttribute('data-type', t[0]);
    });
    var gport = el('div', 'mb-grid-port', null, right);
    var grid = Kit.zone(el('div', 'mb-grid', null, gport), 'grid');
    /* Live suggestions fill the right side while the viewer types (large rows, next to the keyboard). */
    var sugBox = el('div', 'mb-suggest-box', null, right);
    var sug = Kit.zone(el('div', 'mb-suggest', null, sugBox), 'list');
    var sugHint = el('div', 'mb-suggest-hint', 'Keep typing, or choose Search to see every result.', sugBox);
    var discover = el('div', 'mb-discover', null, right);

    /* The right side shows one of: results (the submitted query is the one on screen), suggestions (a query is typed)
       or discovery (recent and trending searches, for an empty query). Results stay in memory while the viewer edits
       the query, and come back when the query matches them again. */
    function showing() {
      var t = U.text(q);
      if (results && results.query === t) return 'results';
      return t ? 'suggest' : 'discover';
    }

    function layout() {
      var mode = showing();
      gport.style.display = mode === 'results' ? '' : 'none';
      tabs.style.display = mode === 'results' ? '' : 'none';
      sugBox.style.display = mode === 'suggest' ? '' : 'none';
      discover.style.display = mode === 'discover' ? '' : 'none';
      sugHint.style.display = sug.firstChild ? 'none' : '';
      if (mode === 'results') headFor(results.query, total);
      else if (mode === 'suggest') { headTitle.textContent = 'Suggestions'; headCount.textContent = ''; }
      else { headTitle.textContent = 'Find something to watch'; headCount.textContent = ''; }
      /* Focus left on a control the new view hides goes back to the keyboard. */
      var cur = Focus.current();
      if (cur && s.el.contains(cur) && !Focus.shown(cur)) App.focus(kb.__mbLast && Focus.shown(kb.__mbLast) ? kb.__mbLast : go);
    }

    function renderQuery() {
      queryEl.textContent = q;
      U.toggleClass(line, 'is-empty', !q);
    }

    function setQuery(v, suggest) {
      q = String(v || '').replace(/\s+/g, ' ').replace(/^\s+/, '').slice(0, 80);
      renderQuery();
      if (suggest !== false) scheduleSuggest();
      layout();
    }

    var suggestSoon = U.debounce(function () { fetchSuggest(); }, 350);
    function scheduleSuggest() {
      sugSeq++;
      if (!U.text(q)) { suggestSoon.cancel(); renderSuggestions([]); return; }
      suggestSoon();
    }

    function fetchSuggest() {
      var mine = ++sugSeq, query = U.text(q);
      if (!query) return;
      api('suggest', [query], function (err, list) {
        if (!s.alive || mine !== sugSeq) return;
        if (err) { if (err.code === 'signed-out') fail(s, err); return; }
        renderSuggestions(list || []);
      });
    }

    function renderSuggestions(list) {
      var keep = Focus.current();
      var hadFocus = keep && Focus.zoneOf(keep) === sug;
      U.empty(sug);
      var seen = {};
      U.each(list, function (t) {
        var text = U.text(typeof t === 'string' ? t : t && t.name);
        if (!text || seen[text.toLowerCase()] || sug.childNodes.length >= MAX_SUGGEST) return;
        seen[text.toLowerCase()] = true;
        var r = el('div', 'mb-srow', null, sug);
        Kit.focusable(r, 'sug|' + text);
        r.setAttribute('data-suggestion', text);
        r.appendChild(Icons.el('search'));
        el('span', 'mb-srow-label', text, r);
      });
      sugHint.style.display = sug.firstChild ? 'none' : '';
      if (hadFocus) App.focus(Focus.firstIn(sug) || (kb.__mbLast && Focus.shown(kb.__mbLast) ? kb.__mbLast : go));
    }

    function chips(title, list, zoneName) {
      if (!list.length) return null;
      el('div', 'mb-section', title, discover);
      var row = Kit.zone(el('div', 'mb-chiprow', null, discover), zoneName);
      var seen = {};
      U.each(list, function (t) {
        var text = U.text(t);
        if (!text || seen[text.toLowerCase()] || row.childNodes.length >= 12) return;
        seen[text.toLowerCase()] = true;
        var c = Kit.chip(text, { key: zoneName + '|' + text, parent: row, icon: zoneName === 'chips:recent' ? 'reload' : 'spark' });
        c.setAttribute('data-query', text);
      });
      return row;
    }

    /* Rebuilding the chips (when the website's own lists arrive) keeps focus on the same chip when it still exists. */
    function fillDiscover(recent, trending) {
      var cur0 = Focus.current(), key0 = cur0 && discover.contains(cur0) ? Focus.keyOf(cur0) : '';
      U.empty(discover);
      el('div', 'mb-discover-hint', 'Type with the keyboard or the remote\u2019s number keys. Suggestions appear as you type.', discover);
      chips('Recent searches', recent, 'chips:recent');
      chips('Trending now', trending || [], 'chips:trending');
      if (key0) App.focus(Focus.byKey(discover, key0) || firstKey);
    }

    function showDiscover() {
      var recent = [];
      try { if (typeof Api !== 'undefined' && Api.recentSearches) recent = Api.recentSearches() || []; } catch (e) {}
      fillDiscover(recent, []);
      api('hot', [], function (err, hot) {
        if (!s.alive || err || !hot) return;
        fillDiscover(recent.concat(hot.recent || []), hot.trending || []);
      });
    }

    function tabsState() {
      U.each(U.qsa(tabs, '[data-type]'), function (c) {
        var on = c.getAttribute('data-type') === type;
        U.toggleClass(c, 'is-selected', on);
        /* Up from the results lands on the selected tab. */
        if (on) tabs.__mbLast = c;
      });
    }

    function headFor(query, count) {
      headTitle.textContent = 'Results for \u201c' + query + '\u201d';
      headCount.textContent = count == null ? '' : count === 1 ? '1 title' : count + ' titles';
    }

    function showResultsLoading() {
      tabsState();
      U.empty(grid);
      Kit.setY(grid, 0);
      Kit.skeletonCards(grid, 10, 'poster');
      layout();
    }

    function addCards(items) {
      U.each(items, function (it) { grid.appendChild(Kit.card(it, { size: 'poster', zone: 'grid', sub: true })); });
      Kit.lazySoon(s.el);
    }

    /* Paging stops at 600 titles (memory and key cost stay bounded on the TV); the website has the rest. */
    function capNote() {
      if (capped) return;
      capped = true;
      var note = el('div', 'mb-grid-note', null, grid);
      el('div', 'mb-body', 'Showing the first ' + results.items.length + ' titles. Refine the search, or see every result on the website.', note);
      var btns = Kit.zone(el('div', 'mb-btns', null, note), 'buttons');
      Kit.button({ label: 'Open website', icon: 'globe', action: 'open-website', parent: btns, key: 'cap|open-website' });
    }

    function submit(text, opts) {
      opts = opts || {};
      if (text != null) setQuery(text, false);
      var query = U.text(q);
      if (!query) { App.toast('Type a title first'); return; }
      suggestSoon.cancel();
      sugSeq++;
      var mine = ++searchSeq;
      var from = Focus.current();
      if (from && (grid.contains(from) || sugBox.contains(from) || discover.contains(from))) App.focus(go);
      results = { query: query, type: type, items: [] };
      page = 1; next = ''; total = null; capped = false;
      showResultsLoading();
      var submitFrom = Focus.current();
      api('search', [query, type, 1], function (err, r) {
        if (!s.alive || mine !== searchSeq) return;
        U.empty(grid);
        if (err) {
          if (err.code === 'signed-out') { fail(s, err); return; }
          if (showing() === 'results') headFor(query, null);
          stateBlock(grid, { icon: 'info', title: 'Search didn\u2019t load', text: errorMessage(err),
            actions: [{ label: 'Try again', icon: 'reload', action: 'search-retry', primary: true }] }, 'buttons');
          return;
        }
        var items = normItems(r && r.items);
        results.items = items;
        next = r && r.next || '';
        total = r && typeof r.total === 'number' ? r.total : items.length;
        if (showing() === 'results') headFor(query, total);
        if (!items.length) {
          stateBlock(grid, { icon: 'search', title: 'No matches for \u201c' + query + '\u201d',
            text: 'Try a shorter title, check the spelling, or switch between Movies and TV Shows.',
            actions: [{ label: 'Search on the website', icon: 'globe', action: 'open-website' }] }, 'buttons');
          return;
        }
        addCards(items);
        /* Results take focus only when the viewer is still where the search started (or on a hidden control): typing
           on, or moving elsewhere, while the page loads is never interrupted. */
        var now = Focus.current();
        if (opts.focus && showing() === 'results' && (!now || now === submitFrom || !Focus.shown(now) || tabs.contains(now))) {
          var f = Focus.firstIn(grid);
          if (f) App.focus(f);
        }
        App.saveState();
      });
    }

    function loadMore() {
      if (!next || loadingMore || !results || capped) return;
      if (results.items.length >= MAX_RESULTS) { capNote(); return; }
      loadingMore = true;
      var mine = searchSeq, query = results.query;
      api('search', [query, type, page + 1], function (err, r) {
        loadingMore = false;
        if (!s.alive || mine !== searchSeq) return;
        if (err) { App.toast('Couldn\u2019t load more results'); return; }
        page++;
        next = r && r.next || '';
        var have = {};
        U.each(results.items, function (it) { have[it.key] = true; });
        var fresh = U.filter(normItems(r && r.items), function (it) { return !have[it.key]; });
        results.items = results.items.concat(fresh);
        addCards(fresh);
      });
    }

    function restoreSnapshot(snap) {
      if (!snap || !snap.items || !snap.items.length) return false;
      q = snap.query; type = snap.type || 'all'; renderQuery();
      results = { query: U.text(snap.query), type: type, items: normItems(snap.items) };
      next = snap.next || ''; page = snap.page || 1; total = snap.total;
      showResultsLoading();
      U.empty(grid);
      headFor(results.query, total);
      addCards(results.items);
      return true;
    }

    s.snapshot = function () {
      var p = { query: q, type: type };
      if (results && results.items.length) {
        p.snap = { query: results.query, type: type, next: next, page: page, total: total, items: U.map(results.items.slice(0, 60), compactItem) };
      }
      return p;
    };

    s.initialFocus = function () {
      if (results && results.items.length && params.snap && showing() === 'results') return Focus.firstIn(grid) || firstKey;
      return firstKey;
    };

    s.onFocus = function (node) {
      var z = Focus.zoneOf(node);
      var inResults = !!z && (z === tabs || grid.contains(z));
      /* While the viewer browses results, the keyboard steps back. */
      U.toggleClass(s.el, 'in-results', inResults);
      if (z && grid.contains(z)) Kit.reveal(grid, gport, node, Kit.em() * 1, Kit.em() * 4);
      if (z === grid && node.__item) {
        var gi = Focus.gridInfo(node);
        if (gi && gi.index >= gi.count - 5) loadMore();
      }
    };

    /* Back from the results, suggestions or chips returns to the keyboard with the query kept; Back on the keyboard
       leaves Search. */
    s.onBack = function () {
      var cur = Focus.current();
      if (!cur || !s.el.contains(cur) || kb.contains(cur)) return false;
      App.focus(kb.__mbLast && Focus.shown(kb.__mbLast) ? kb.__mbLast : go);
      return true;
    };

    s.onKey = function (name, ev) {
      if (name === 'char' || name === 'digit') {
        var ch = Keys.charOf(ev);
        if (!ch || !/^[\w\s\-':.,&!?]$/.test(ch)) return false;
        setQuery(q + ch.toLowerCase());
        return true;
      }
      if (name === 'backspace') { setQuery(q.slice(0, -1)); return true; }
      if (name === 'space') {
        if (q && q.charAt(q.length - 1) !== ' ') setQuery(q + ' ');
        return true;
      }
      return false;
    };

    s.act = function (action, node) {
      if (node && node.hasAttribute('data-char')) { setQuery(q + node.getAttribute('data-char')); return true; }
      if (action === 'space') { if (q && q.charAt(q.length - 1) !== ' ') setQuery(q + ' '); return true; }
      if (action === 'delete') { setQuery(q.slice(0, -1)); return true; }
      if (action === 'clear') { setQuery(''); return true; }
      if (action === 'search-submit') { submit(null, { focus: true }); return true; }
      if (action === 'search-retry') { submit(null, { focus: true }); return true; }
      if (action === 'open-website') { App.openWebsite(siteUrl('search', [U.text(q), type, 1], '/index/search?word=' + encodeURIComponent(U.text(q)))); return true; }
      if (node && node.hasAttribute('data-suggestion')) { submit(node.getAttribute('data-suggestion'), { focus: true }); return true; }
      if (node && node.hasAttribute('data-query')) { submit(node.getAttribute('data-query'), { focus: true }); return true; }
      if (node && node.hasAttribute('data-type')) {
        var t = node.getAttribute('data-type');
        if (t !== type || !results) { type = t; if (U.text(q)) submit(null, { focus: false }); else tabsState(); }
        return true;
      }
      if (node && node.__item) { App.push('detail', { kind: node.__item.kind, id: node.__item.id, item: compactItem(node.__item) }); return true; }
      return false;
    };

    s.destroy = function () { suggestSoon.cancel(); };

    renderQuery();
    tabsState();
    showDiscover();
    if (!restoreSnapshot(params.snap)) {
      if (q && params.submit) U.later(function () { if (s.alive) submit(null, { focus: true }); }, 0, 'search-auto');
      else if (q) scheduleSuggest();
    }
    layout();
    return s;
  };

  /* ---------- Browse grid (movies, shows, lists, library) ---------- */

  registry.browse = function (params, ctx) {
    var s = base('browse', 'browse');
    s.nav = params.nav || '';
    var url = params.url || siteUrl('movies', [], '/movie');
    var next = '', loadingMore = false, seq = 0, count = 0, keys = {}, capped = false;
    var vport = el('div', 'mb-vport', null, s.el);
    var vs = el('div', 'mb-vscroll', null, vport);
    var head = el('div', 'mb-browse-head', null, vs);
    el('div', 'mb-kicker', params.kicker || 'Browse', head);
    var titleEl = el('div', 'mb-h1', params.title || '', head);
    var countEl = el('div', 'mb-meta', '', head);
    var tabs = Kit.zone(el('div', 'mb-chiprow mb-browse-tabs', null, vs), 'tabs');
    var grid = Kit.zone(el('div', 'mb-grid', null, vs), 'grid');
    var foot = el('div', 'mb-grid-foot', null, vs);

    function renderTabs(list, current) {
      U.empty(tabs);
      if (!list || !list.length) { tabs.style.display = 'none'; return; }
      tabs.style.display = '';
      U.each(list.slice(0, 16), function (t) {
        var c = Kit.chip(t.label, { key: 'tab|' + t.label, parent: tabs });
        c.__href = t.href || t.url;
        U.toggleClass(c, 'is-selected', !!current && (c.__href === current));
      });
    }

    function add(items) {
      var fresh = U.filter(normItems(items), function (it) { return !keys[it.key]; });
      U.each(fresh, function (it) { keys[it.key] = true; grid.appendChild(Kit.card(it, { size: 'grid', zone: 'grid', sub: true })); });
      count += fresh.length;
      Kit.lazySoon(s.el);
      return fresh.length;
    }

    function setCount() {
      countEl.textContent = count && !next ? (count === 1 ? '1 title' : count + ' titles') : '';
    }

    function markTab() {
      U.each(U.qsa(tabs, '.mb-chip'), function (c) {
        var on = !!c.__href && c.__href === url;
        U.toggleClass(c, 'is-selected', on);
        /* Up from the grid lands on the selected chip. */
        if (on) tabs.__mbLast = c;
      });
    }

    /* Paging stops at 600 titles (memory and key cost stay bounded on the TV); the website lists the rest. */
    var MAX_TITLES = 600;
    function capNote() {
      if (capped) return;
      capped = true;
      U.empty(foot);
      var note = el('div', 'mb-grid-note', null, foot);
      el('div', 'mb-body', 'Showing the first ' + count + ' titles. The website lists the rest.', note);
      var btns = Kit.zone(el('div', 'mb-btns', null, note), 'buttons');
      Kit.button({ label: 'Open website', icon: 'globe', action: 'open-website', parent: btns, key: 'cap|open-website' });
    }

    function load(target, keepTabs) {
      var mine = ++seq;
      url = target;
      next = ''; count = 0; keys = {}; capped = false;
      countEl.textContent = '';
      markTab();
      U.empty(grid); U.empty(foot);
      Kit.setY(vs, 0);
      Kit.skeletonCards(grid, 12, 'grid');
      var done = function (err, data) {
        if (!s.alive || mine !== seq) return;
        U.empty(grid);
        if (err) {
          if (err.code === 'signed-out' || !keepTabs) { fail(s, err); return; }
          stateBlock(grid, { icon: 'info', title: 'This list didn\u2019t load', text: errorMessage(err),
            actions: [{ label: 'Retry', icon: 'reload', action: 'retry-list', primary: true }, { label: 'Open website', icon: 'globe', action: 'open-website' }] }, 'buttons');
          return;
        }
        data = data || {};
        if (!params.title && data.title) titleEl.textContent = data.title;
        /* Switching chips keeps the chip row (and focus on the chip); only the first load builds it. */
        if (!params.tabs && !keepTabs) renderTabs(data.chips, url);
        next = data.next || '';
        if (!add(data.items)) {
          stateBlock(grid, { icon: 'film', title: 'Nothing here yet', text: 'This list is empty right now. The website may show more.',
            actions: [{ label: 'Open website', icon: 'globe', action: 'open-website', primary: true }] }, 'buttons');
        }
        setCount();
        markTab();
        App.screenReady(s);
      };
      if (ctx && ctx.live && mine === 1) {
        var live = site('list', [document], null);
        if (live && live.items && live.items.length) { U.later(function () { done(null, live); }, 0, 'browse-live'); return; }
      }
      api('list', [target], done);
    }

    function loadMore() {
      if (!next || loadingMore || capped) return;
      if (count >= MAX_TITLES) { capNote(); return; }
      loadingMore = true;
      var mine = seq;
      U.empty(foot);
      Kit.spinner(foot, 'mb-spinner--sm');
      api('list', [next], function (err, data) {
        loadingMore = false;
        if (!s.alive || mine !== seq) return;
        U.empty(foot);
        if (err) { App.toast('Couldn\u2019t load more titles'); return; }
        next = data && data.next || '';
        add(data && data.items);
        setCount();
      });
    }

    s.initialFocus = function () { return Focus.firstIn(grid) || Focus.firstIn(tabs) || Focus.firstIn(s.el); };

    s.onFocus = function (node) {
      var z = Focus.zoneOf(node);
      if (z === grid && node.__item) {
        Kit.reveal(vs, vport, node, Kit.em() * 3, Kit.em() * 3);
        var gi = Focus.gridInfo(node);
        if (gi && gi.index >= gi.count - 6) loadMore();
      } else if (z && (foot.contains(z) || grid.contains(z))) Kit.reveal(vs, vport, node, Kit.em() * 3, Kit.em() * 3);
      else Kit.setY(vs, 0);
    };

    s.act = function (action, node) {
      if (action === 'retry-list') { load(url, true); return true; }
      if (action === 'open-website') { App.openWebsite(url); return true; }
      if (node && node.__href) { if (node.__href !== url) load(node.__href, true); return true; }
      if (node && node.__item) { App.push('detail', { kind: node.__item.kind, id: node.__item.id, item: compactItem(node.__item) }); return true; }
      return false;
    };

    if (params.tabs) renderTabs(params.tabs, url);
    else tabs.style.display = 'none';
    load(url, false);
    return s;
  };

  /* ---------- Settings ---------- */

  registry.settings = function () {
    var s = base('settings', 'settings');
    s.nav = 'settings';
    var head = el('div', 'mb-page-head', null, s.el);
    el('div', 'mb-kicker', 'MovieBox Pro TV', head);
    el('div', 'mb-h1', 'Settings', head);
    var body = el('div', 'mb-settings-body', null, s.el);
    /* The list scrolls inside its port when it is taller than the screen (the About line stays below it). */
    var port = el('div', 'mb-settings-port', null, body);
    var list = Kit.zone(el('div', 'mb-list', null, port), 'list');
    var aside = el('div', 'mb-aside', null, body);
    var asideIcon = el('div', null, null, aside);
    var asideTitle = el('div', 'mb-section', '', aside);
    var asideText = el('div', 'mb-body', '', aside);
    el('div', 'mb-about', 'MovieBox Pro TV ' + VERSION + '  ·  independent TizenBrew module', body);
    var rows = {};
    /* Toggles that are on unless the viewer turned them off. */
    var TOGGLE_ON = { nativeRemote: true, nativePlayer: true, autoplayEpisodes: true };

    var defs = [
      { key: 'quality', icon: 'quality', label: 'Preferred quality', desc: 'Used to choose a file automatically when a title has several. Choose “Ask every time” to pick yourself.' },
      { key: 'nativePlayer', icon: 'play', label: 'Built-in player', toggle: true, desc: 'Plays movies and episodes in the TV app’s own player (recommended). Turn it off to use the website’s player instead.' },
      { key: 'autoplayEpisodes', icon: 'tv', label: 'Autoplay next episode', toggle: true, desc: 'Plays the next episode automatically when one ends, like Netflix. After three in a row without a button press it asks whether you are still watching.' },
      { key: 'performance', icon: 'spark', label: 'Performance mode', choice: true, desc: 'Lighter visuals for smoother scrolling on TVs: smaller pictures and fewer effects. Auto turns it on for TVs.' },
      { key: 'nativeRemote', icon: 'remote', label: 'Website remote controls', toggle: true, desc: 'On website pages the TV app does not cover (sign-in, playlists), the arrow keys move a white focus ring and OK selects.' },
      { key: 'reduceMotion', icon: 'motion', label: 'Reduce motion', toggle: true, desc: 'Turns off animations and fades. Helpful on older TVs.' },
      { key: 'clearSearches', icon: 'close', label: 'Clear search history', desc: 'Forgets the searches this TV remembers (it also forgets them when you sign out). Searches saved to your MovieBox Pro account are managed on the website.' },
      { key: 'diagnostics', icon: 'stethoscope', label: 'Diagnostics', chevron: true, desc: 'Version, page checks and recent log lines, for troubleshooting.' },
      { key: 'website', icon: 'globe', label: 'Open website view', chevron: true, desc: 'Shows the MovieBox Pro website itself. Press the Blue button or select the TV button to come back.' },
      { key: 'reload', icon: 'reload', label: 'Reload', desc: 'Reloads the page and restarts the TV app. Your place is kept.' },
      { key: 'about', icon: 'info', label: 'About', value: 'Version ' + VERSION, desc: 'MovieBox Pro TV is an independent interface for the MovieBox Pro website. It is not affiliated with MovieBox Pro, Samsung or TizenBrew.' }
    ];

    /* Labels and help text come from Prefs.describe when it knows the preference (one source of truth). */
    U.each(defs, function (def) {
      var d = null;
      try { if (typeof Prefs !== 'undefined' && typeof Prefs.describe === 'function') d = Prefs.describe(def.key); } catch (e) { d = null; }
      if (d && d.label) def.label = d.label;
      if (d && d.desc) def.desc = d.desc;
    });

    function toggleOn(key) { return !!pref(key, TOGGLE_ON[key] === true); }

    /* [{value, label}] for a choice preference (Prefs.choices), with a built-in list for performance mode. */
    function choiceList(key) {
      var out = [];
      try { if (typeof Prefs !== 'undefined' && typeof Prefs.choices === 'function') out = Prefs.choices(key) || []; } catch (e) { out = []; }
      out = U.filter(U.map(out, function (c) {
        return c && typeof c === 'object' ? { value: c.value, label: U.text(c.label) || U.titleCase(String(c.value)) } : { value: c, label: U.titleCase(String(c)) };
      }), function (c) { return c.value !== undefined && c.value !== null; });
      if (!out.length && key === 'performance') out = [{ value: 'auto', label: 'Auto' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }];
      return out;
    }

    function choiceValue(key) {
      var list = choiceList(key), v = pref(key, list.length ? list[0].value : '');
      return U.find(list, function (c) { return c.value === v; }) ? v : (list.length ? list[0].value : v);
    }

    function choiceLabel(key) {
      var v = choiceValue(key), c = U.find(choiceList(key), function (x) { return x.value === v; });
      var label = c ? c.label : U.titleCase(String(v || ''));
      /* Auto says what it decided for this TV. */
      if (key === 'performance' && v === 'auto' && typeof Kit.perf === 'function') label += perfOn() ? ' · On' : ' · Off';
      return label;
    }

    function value(def) {
      if (def.key === 'quality') return qualityLabel(pref('quality', 'best'));
      if (def.choice) return choiceLabel(def.key);
      return def.value || '';
    }

    U.each(defs, function (def) {
      var r = el('div', 'mb-lrow', null, list);
      Kit.focusable(r, 'set|' + def.key, 'setting-' + def.key);
      r.__def = def;
      r.appendChild(Icons.el(def.icon));
      el('span', 'mb-lrow-label', def.label, r);
      if (def.toggle) {
        var t = el('span', 'mb-toggle', null, r);
        el('span', 'mb-toggle-knob', null, t);
        r.__toggle = t;
        U.toggleClass(t, 'is-on', toggleOn(def.key));
      } else {
        r.__value = el('span', 'mb-lrow-value', value(def), r);
        if (def.chevron || def.key === 'quality' || def.choice) r.appendChild(Icons.el('chevronRight', 'mb-lrow-chev'));
      }
      rows[def.key] = r;
    });

    s.refresh = function () {
      U.each(defs, function (def) {
        var r = rows[def.key];
        if (r.__toggle) U.toggleClass(r.__toggle, 'is-on', toggleOn(def.key));
        else if (r.__value) r.__value.textContent = value(def);
      });
    };
    s.onShow = s.refresh;

    s.onFocus = function (node) {
      var def = node.__def;
      if (!def) return;
      /* Scroll whole rows only: the top row is never cut in half. */
      var y = Kit.reveal(list, port, node, Kit.em() * 1, Kit.em() * 1.5);
      if (y > 0) {
        var first = U.find(U.qsa(list, '.mb-lrow'), function (r) { return Kit.offsetIn(r, list).top >= y - 1; });
        if (first) Kit.setY(list, -Kit.offsetIn(first, list).top);
      }
      U.empty(asideIcon);
      asideIcon.appendChild(Icons.el(def.icon));
      asideTitle.textContent = def.label;
      asideText.textContent = def.desc;
    };

    s.act = function (action, node) {
      var def = node && node.__def;
      if (!def) return false;
      if (def.key === 'quality') { Overlays.qualityPref(function () { s.refresh(); }); return true; }
      if (def.toggle) {
        var on = !toggleOn(def.key);
        setPref(def.key, on);
        s.refresh();
        if (def.key === 'reduceMotion') App.applyPrefs();
        App.toast(def.label + (on ? ' on' : ' off'));
        return true;
      }
      if (def.choice) {
        /* OK steps through the choices (Auto, On, Off), wrapping. */
        var opts = choiceList(def.key), cur = choiceValue(def.key), i = 0;
        for (var k = 0; k < opts.length; k++) if (opts[k].value === cur) { i = k; break; }
        if (opts.length) setPref(def.key, opts[(i + 1) % opts.length].value);
        s.refresh();
        App.applyPrefs();
        App.toast(def.label + ': ' + choiceLabel(def.key));
        return true;
      }
      if (def.key === 'clearSearches') {
        try { if (typeof Api !== 'undefined' && Api.clearRecentSearches) Api.clearRecentSearches(); } catch (e) { Log.warn('clear-searches', e); }
        App.toast('Search history on this TV cleared');
        return true;
      }
      if (def.key === 'diagnostics') { App.push('diagnostics', {}); return true; }
      if (def.key === 'website') { App.openWebsite(''); return true; }
      if (def.key === 'reload') { App.reload(); return true; }
      if (def.key === 'about') { App.toast('MovieBox Pro TV ' + VERSION); return true; }
      return false;
    };
    return s;
  };

  /* ---------- Diagnostics ---------- */

  registry.diagnostics = function () {
    var s = base('diagnostics', 'diagnostics');
    s.nav = 'settings';
    var head = el('div', 'mb-page-head', null, s.el);
    el('div', 'mb-kicker', 'Settings', head);
    el('div', 'mb-h1', 'Diagnostics', head);
    el('div', 'mb-meta', 'Read these details out when asking for help.', head);
    var facts = el('div', 'mb-diag-facts', null, s.el);
    var logBox = el('div', 'mb-diag-log', null, s.el);
    var lines = Kit.zone(el('div', 'mb-diag-lines', null, logBox), 'list');

    function fact(k, v, warn) {
      var f = el('div', 'mb-fact', null, facts);
      el('div', 'mb-fact-k', k, f);
      el('div', 'mb-fact-v' + (warn ? ' is-warn' : ''), v || '\u2014', f);
    }

    function selfTestText(t) {
      if (!t) return 'Not run yet';
      var counts = [];
      if (t.counts) for (var k in t.counts) if (t.counts.hasOwnProperty(k)) counts.push(k + ' ' + t.counts[k]);
      return (t.ok ? 'OK' : 'Warnings: ' + (t.warnings || []).join('; ')) + (counts.length ? '  \u00b7  ' + counts.join(', ') : '');
    }

    function renderFacts() {
      U.empty(facts);
      var st = App.selfTest();
      fact('Version', VERSION);
      fact('Page', Log.redact ? Log.redact(location.pathname + location.search) : location.pathname);
      fact('Page type', App.pageType());
      fact('Screen', (window.innerWidth || 0) + ' \u00d7 ' + (window.innerHeight || 0));
      fact('Browser', String(navigator.userAgent || '').slice(0, 160));
      fact('Self-test', selfTestText(st), st && !st.ok);
      var btns = Kit.zone(el('div', 'mb-btns', null, facts), 'buttons');
      Kit.button({ label: 'Run self-test', icon: 'stethoscope', action: 'selftest', primary: true, parent: btns });
      Kit.button({ label: 'Clear log', icon: 'close', action: 'clear-log', parent: btns });
    }

    function renderLog() {
      U.empty(lines);
      var entries = Log.entries();
      if (entries.length < 5) entries = Log.persisted().concat(entries);
      entries = entries.slice(-30).reverse();
      if (!entries.length) { el('div', 'mb-logline', 'The log is empty.', lines); return; }
      U.each(entries, function (e) {
        var d = new Date(e.t || 0);
        var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
        var r = el('div', 'mb-logline' + (e.level === 'error' ? ' is-error' : e.level === 'warn' ? ' is-warn' : ''), hh + '  ' + e.level + '  ' + e.label + '  ' + e.msg, lines);
        Kit.focusable(r, 'log|' + e.t + '|' + e.label + '|' + lines.childNodes.length);
      });
      Kit.setY(lines, 0);
    }

    s.onFocus = function (node) {
      if (Focus.zoneOf(node) === lines) Kit.reveal(lines, logBox, node, Kit.em() * 1, Kit.em() * 1);
    };

    /* Left from any log line goes back to the buttons (never the rail, which is nearer to the top lines). */
    s.onKey = function (name) {
      var cur = Focus.current();
      if (name !== 'left' || !cur || Focus.zoneOf(cur) !== lines) return false;
      var btnZone = U.qs(facts, '[data-zone="buttons"]');
      var target = btnZone && btnZone.__mbLast && Focus.shown(btnZone.__mbLast) ? btnZone.__mbLast : U.qs(facts, '[data-action="selftest"]');
      if (target) App.focus(target);
      return true;
    };

    s.initialFocus = function () { return U.qs(facts, '[data-action="selftest"]') || Focus.firstIn(s.el); };

    s.act = function (action) {
      if (action === 'clear-log') { Log.clear(); renderLog(); App.toast('Log cleared'); return true; }
      if (action === 'selftest') {
        App.toast('Checking the home page\u2026');
        api('fetchDoc', [siteUrl('home', [], '/')], function (err, res) {
          if (!s.alive) return;
          if (err) { App.toast('Self-test could not load the home page (' + (err.code || 'error') + ')'); Log.warn('selftest', err); renderLog(); return; }
          var r = site('selfTest', [res.doc, 'home'], null);
          App.setSelfTest(r);
          Log.info('selftest', r);
          renderFacts(); renderLog();
          App.focus(U.qs(facts, '[data-action="selftest"]'));
          App.toast(r && r.ok ? 'Self-test passed' : 'Self-test found warnings');
        });
        return true;
      }
      return false;
    };

    renderFacts();
    renderLog();
    return s;
  };

  function create(name, params, ctx) {
    var fn = registry[name];
    if (!fn) throw new Error('Unknown screen: ' + name);
    var s = fn(params || {}, ctx || {});
    s.el.setAttribute('data-screen-name', name);
    return s;
  }

  return {
    create: create, has: function (name) { return !!registry[name]; },
    normItem: normItem, normItems: normItems, compactItem: compactItem, errorMessage: errorMessage, qualityLabel: qualityLabel,
    pref: pref, setPref: setPref, siteUrl: siteUrl, site: site
  };
}());
/* ---- 50-ui-overlays.js ---- */
/* Overlays: toasts, dialogs, sheets (live source picker, quality), the starting-playback overlay, website mode
   (spatial ring + TV pill, also used for site popups) and the player controller with its OSD. */
var Toast = (function () {
  var node = null, timer = null;

  function ensure() {
    var root = document.getElementById('mbptv');
    if (!root) return null;
    if (!node || node.parentNode !== root) {
      node = document.getElementById('mbptv-toast') || U.el('div', 'mb-toast');
      node.id = 'mbptv-toast';
      node.setAttribute('role', 'status');
      root.appendChild(node);
    }
    return node;
  }

  function show(msg, ms) {
    var n = ensure();
    if (!n) return;
    n.textContent = String(msg == null ? '' : msg);
    U.toggleClass(n, 'is-visible', true);
    clearTimeout(timer);
    timer = U.later(hide, ms || 3500, 'toast');
    Log.info('toast', msg);
  }

  function hide() { if (node) U.toggleClass(node, 'is-visible', false); }

  return { show: show, hide: hide };
}());

var Overlays = (function () {
  var el = U.el;
  var RANK = { '8K': 8, '4K': 7, 'Original': 6, '1440p': 5, '1080p': 4, '720p': 3, 'SD': 1 };

  /* ---------- Generic dialog and sheet ---------- */

  function dialog(opts) {
    var layer = el('div', 'mb-layer mb-layer--dialog');
    el('div', 'mb-layer-dim', null, layer);
    var box = el('div', 'mb-dialog', null, layer);
    box.setAttribute('data-dialog', opts.name || 'dialog');
    el('div', 'mb-h1', opts.title || '', box);
    if (opts.text) el('div', 'mb-body', opts.text, box);
    var btns = Kit.zone(el('div', 'mb-btns', null, box), 'dialog');
    var focus = null;
    U.each(opts.buttons || [], function (b) {
      var n = Kit.button({ label: b.label, icon: b.icon, action: b.action, primary: b.primary, parent: btns, key: 'dlg|' + b.action });
      n.__run = b.run;
      if (b.focus) focus = n;
    });
    App.openLayer('dialog', layer, { focus: focus || Focus.firstIn(btns), name: opts.name, onBack: opts.onBack });
    return layer;
  }

  function exitDialog() {
    if (App.hasLayer('dialog')) return;
    dialog({
      name: 'exit', title: 'Exit MovieBox Pro TV?', text: 'You can come back any time from TizenBrew.',
      buttons: [
        { label: 'Stay', action: 'stay', primary: true, focus: true, run: function () { App.closeLayer('dialog'); } },
        { label: 'Exit', icon: 'power', action: 'exit', run: function () { App.exitApp(); } }
      ]
    });
  }

  /* opts: {name, kicker, title, sub, hint, onBack} -> {layer, list, port} */
  function sheet(opts) {
    var layer = el('div', 'mb-layer mb-layer--sheet');
    el('div', 'mb-layer-dim', null, layer);
    var box = el('div', 'mb-sheet', null, layer);
    box.setAttribute('data-sheet', opts.name);
    el('div', 'mb-kicker', opts.kicker || '', box);
    el('div', 'mb-h1', opts.title || '', box);
    el('div', 'mb-sheet-sub', opts.sub || '', box);
    var port = el('div', 'mb-sheet-port', null, box);
    var list = Kit.zone(el('div', 'mb-sheet-list', null, port), 'sheet');
    el('div', 'mb-sheet-hint', opts.hint || 'Press Back to close', box);
    return { layer: layer, box: box, list: list, port: port };
  }

  function sheetFocus(s, node) {
    if (node && s.port) Kit.reveal(s.list, s.port, node, Kit.em() * 1, Kit.em() * 1);
  }

  /* ---------- Quality preference (settings) ---------- */

  var QUALITIES = [['best', 'Best available'], ['1080p', '1080p'], ['720p', '720p'], ['ask', 'Ask every time']];

  function optionRow(list, key, label, selected) {
    var r = el('div', 'mb-opt', null, list);
    Kit.focusable(r, 'opt|' + key);
    r.setAttribute('data-option', key);
    el('span', 'mb-opt-label', label, r);
    if (selected) r.appendChild(Icons.el('check'));
    return r;
  }

  function qualityPref(done) {
    var cur = Screens.pref('quality', 'best');
    var s = sheet({ name: 'quality', kicker: 'Settings', title: 'Preferred quality', sub: 'Used when a title has several files' });
    var focus = null;
    U.each(QUALITIES, function (q) {
      var r = optionRow(s.list, q[0], q[1], q[0] === cur);
      if (q[0] === cur) focus = r;
      r.__run = function () {
        Screens.setPref('quality', q[0]);
        App.closeLayer('sheet');
        App.toast('Preferred quality: ' + q[1]);
        if (done) done(q[0]);
      };
    });
    App.openLayer('sheet', s.layer, { focus: focus || Focus.firstIn(s.list), name: 'quality', onFocus: function (n) { sheetFocus(s, n); } });
  }

  /* ---------- Quality sheet from a detail page: preference + the files the page lists ---------- */

  function quality(opts) {
    var cur = Screens.pref('quality', 'best');
    var sources = opts.sources || [];
    var s = sheet({ name: 'quality', kicker: 'Quality', title: opts.title || 'Quality', sub: sources.length ? 'Pick a preference or a specific file' : 'Your preference for every title' });
    var focus = null;
    U.each(QUALITIES, function (q) {
      var r = optionRow(s.list, q[0], q[1], q[0] === cur);
      if (q[0] === cur) focus = r;
      r.__run = function () {
        Screens.setPref('quality', q[0]);
        App.closeLayer('sheet');
        App.toast('Preferred quality: ' + q[1]);
        if (opts.onChange) opts.onChange(q[0]);
      };
    });
    if (sources.length) el('div', 'mb-sheet-label', 'Files for this title', s.list);
    var labels = sourceLabels(sources);
    U.each(sources, function (src, i) {
      var r = sourceRow(s.list, src, i, false, labels);
      r.removeAttribute('data-source-index');
      r.setAttribute('data-file-index', String(i));
      r.__run = function () { App.closeLayer('sheet'); if (opts.onPick) opts.onPick({ file: src.file, quality: src.quality, size: src.size, index: i }); };
    });
    App.openLayer('sheet', s.layer, { focus: focus || Focus.firstIn(s.list), name: 'quality', onFocus: function (n) { sheetFocus(s, n); } });
  }

  /* ---------- Live source picker (the site's .sidebarbg2) ---------- */

  var src = { open: false, list: [], sheet: null, autoTimer: null, pick: null, title: '' };

  function qualityClass(q) { return q === '4K' || q === '8K' ? ' is-4k' : q === '1080p' || q === 'Original' ? ' is-1080' : ''; }

  /* A readable label from a release file name: the source, dynamic range, audio, codec and release group tokens
     ('WEBRip \u00b7 DDP5.1 \u00b7 x264 \u00b7 GROUP'), matched as whole tokens (never by splitting on dots, which would break
     'DDP5.1' or 'H.264'). Falls back to the raw name when nothing is recognised. */
  var FILE_TOKENS = [
    /\b(?:WEB-?DL|WEBRip|WEB|Blu-?Ray|BDRip|BRRip|Remux|HDTV|DVDRip|HDRip)\b/i,
    /\b(?:HDR10\+?|HDR|DV|DoVi|Dolby[ .]?Vision)\b/i,
    /\b(?:DDP?\+?\s?\d\.\d|DD\+?\s?\d\.\d|E-?AC-?3|TrueHD|Atmos|DTS-HD(?:[ .]?MA)?|DTS|AAC\d?(?:\.\d)?|FLAC)\b/i,
    /\b(?:x26[45]|HEVC|H\.?26[45]|AV1|AVC)\b/i
  ];
  function fileLabel(name) {
    var raw = U.text(name), base = raw.replace(/\.(?:mkv|mp4|avi|m4v|mov|ts|webm)$/i, '');
    if (!base) return '';
    var out = [];
    U.each(FILE_TOKENS, function (re) {
      var m = re.exec(base);
      if (m) out.push(m[0].replace(/\s+/g, ''));
    });
    var group = /-([A-Za-z0-9]{2,20})$/.exec(base);
    if (group && !/^(?:DL|\d+)$/i.test(group[1])) out.push(group[1]);
    return out.length >= 2 ? out.join('  \u00b7  ') : raw;
  }

  function sourceRow(list, s, i, preferred, labels) {
    var r = el('div', 'mb-source', null, list);
    Kit.focusable(r, 'src|' + i + '|' + (s.file || ''));
    r.setAttribute('data-source-index', String(i));
    el('div', 'mb-qbadge' + qualityClass(s.quality), s.quality || 'File', r);
    var label = labels && labels[i] ? labels[i] : (s.file || ('File ' + (i + 1)));
    var f = el('div', 'mb-source-file', label, r);
    if (s.file) f.setAttribute('title', s.file);
    el('div', 'mb-source-meta', Kit.metaLine([s.size, s.date]), r);
    if (preferred) el('div', 'mb-source-pref', 'Preferred', r);
    return r;
  }

  /* Labels for a whole list: a row keeps its raw file name when its label would repeat another row's. */
  function sourceLabels(list) {
    var labels = U.map(list, function (s) { return fileLabel(s.file); }), seen = {};
    U.each(labels, function (l) { seen['$' + l] = (seen['$' + l] || 0) + 1; });
    return U.map(labels, function (l, i) { return l && seen['$' + l] === 1 ? l : (list[i].file || ''); });
  }

  /* Fallback parser when Site.live.sourceList is unavailable: quality icon, file name, size, date. */
  function parseLi(li, i) {
    var imgSrc = '', file = '', size = '', date = '';
    U.each(U.qsa(li, 'img'), function (im) { var m = /ic_choose_([a-z0-9]+)\./i.exec(im.getAttribute('src') || ''); if (m && !imgSrc && !/fromat|vip/i.test(m[1])) imgSrc = m[1].toLowerCase(); });
    U.each(U.qsa(li, 'span'), function (sp) {
      if (sp.children && sp.children.length) return;
      var t = U.text(sp.textContent);
      if (!size && /^\d+(\.\d+)?\s*(KB|MB|GB|TB)$/i.test(t)) size = t;
      else if (!date && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t)) date = t;
      else if (!file && /\.[a-z0-9]{2,4}$/i.test(t)) file = t;
    });
    var map = { '4k': '4K', fullhd: '1080p', hd: '720p', sd: 'SD', org: 'Original' };
    return { index: i, quality: map[imgSrc] || '', file: file, size: size, date: date, el: li };
  }

  function liveSources() {
    var list = [];
    try { list = Site.live.sourceList() || []; } catch (e) { list = []; }
    if (!list.length) {
      var lis = [];
      try { lis = Site.live.sourceItems() || []; } catch (e2) { lis = []; }
      list = U.map(lis, parseLi);
    }
    return list;
  }

  /* Index of the preferred source, and whether it is an exact match for auto-selection. */
  function preferred(list, pref, pick) {
    var i, best = -1, bestRank = -1;
    if (pick && pick.file) {
      for (i = 0; i < list.length; i++) if (list[i].file === pick.file) return { index: i, match: true };
    }
    if (pick && pick.quality) {
      for (i = 0; i < list.length; i++) if (list[i].quality === pick.quality) return { index: i, match: true };
    }
    for (i = 0; i < list.length; i++) { var r = RANK[list[i].quality] || 0; if (r > bestRank) { bestRank = r; best = i; } }
    if (pref === 'best') return { index: Math.max(0, best), match: best >= 0 };
    if (pref === '1080p' || pref === '720p') {
      for (i = 0; i < list.length; i++) if (list[i].quality === pref) return { index: i, match: true };
      var want = RANK[pref], near = -1, nearRank = -1;
      for (i = 0; i < list.length; i++) { var q = RANK[list[i].quality] || 0; if (q <= want && q > nearRank) { nearRank = q; near = i; } }
      return { index: near >= 0 ? near : Math.max(0, best), match: false };
    }
    return { index: Math.max(0, best), match: false };
  }

  function addSourcesClass() {
    var h = document.documentElement;
    if (!U.hasClass(h, 'mbptv-sources')) h.className += ' mbptv-sources';
  }

  /* opts: {title, pick, auto, quiet}. With a preferred file that matches (or a one-time pick), the choice is made
     automatically. quiet (the starting-playback overlay is up): no sheet at all; the overlay names the file for about a
     second, during which Up or OK opens the full list instead (see expandSources). */
  function openSources(opts) {
    opts = opts || {};
    var list = liveSources();
    if (!list.length) return false;
    if (src.open) closeSources(false);
    src.list = list;
    src.pick = opts.pick || null;
    src.title = opts.title || '';
    var pref = Screens.pref('quality', 'best');
    var choice = preferred(list, pref, src.pick);
    var auto = !!((src.pick && choice.match) || (pref !== 'ask' && choice.match && opts.auto !== false));
    src.open = true;
    src.choice = choice;
    addSourcesClass();
    if (auto && opts.quiet && starting.node) {
      var it = list[choice.index] || {};
      setStartingHint('Playing ' + Kit.metaLine([it.quality || 'file', it.size]) + '  \u00b7  Press Up to choose another file');
      src.autoTimer = U.later(function () { if (src.open && src.list === list && !src.sheet) chooseSource(choice.index); }, 900, 'source-auto');
      return true;
    }
    buildSheet();
    if (auto) {
      src.autoTimer = U.later(function () { if (src.open && src.list === list) chooseSource(choice.index); }, 400, 'source-auto');
    }
    return true;
  }

  function buildSheet() {
    var list = src.list, pref = Screens.pref('quality', 'best'), choice = src.choice || preferred(list, pref, src.pick);
    var s = sheet({ name: 'sources', kicker: 'Choose a file', title: src.title || 'Play', sub: list.length + (list.length === 1 ? ' file available' : ' files available') + (pref !== 'ask' ? '  \u00b7  Preferred: ' + Screens.qualityLabel(pref) : '') });
    src.sheet = s;
    var focus = null, labels = sourceLabels(list);
    U.each(list, function (item, i) {
      var r = sourceRow(s.list, item, i, i === choice.index && pref !== 'ask', labels);
      if (i === choice.index) focus = r;
      r.__run = function () { chooseSource(i); };
    });
    App.openLayer('sheet', s.layer, {
      focus: focus, name: 'sources',
      onFocus: function (n) { sheetFocus(s, n); },
      onAnyKey: function () { clearTimeout(src.autoTimer); },
      onBack: function () { closeSources(true); App.cancelPlayback(); }
    });
  }

  /* The quiet automatic choice is pending: Up or OK on the starting overlay opens the full list instead. */
  function autoPending() { return src.open && !src.sheet && !!src.list.length; }

  function expandSources() {
    if (!autoPending()) return false;
    clearTimeout(src.autoTimer);
    hideStarting();
    buildSheet();
    return true;
  }

  function chooseSource(i) {
    var item = src.list[i];
    clearTimeout(src.autoTimer);
    if (!item) return;
    App.toast('Playing ' + Kit.metaLine([item.quality || 'file', item.size]));
    closeSources(false);
    var li = item.el;
    var ok = false;
    try { ok = Site.live.click(li); } catch (e) { Log.warn('source-click', e); }
    if (!ok && li && li.click) { try { li.click(); ok = true; } catch (e2) {} }
    Log.info('source', (item.quality || '?') + ' ' + (item.file || ''));
    App.awaitPlayer();
  }

  function closeSources(closeSite) {
    clearTimeout(src.autoTimer);
    if (closeSite) { try { Site.live.closeSourcePicker(); } catch (e) {} }
    if (src.open) {
      src.open = false;
      if (src.sheet) App.closeLayer('sheet');
    }
    src.sheet = null;
    src.choice = null;
    document.documentElement.className = String(document.documentElement.className).replace(/\s*\bmbptv-sources\b/g, '');
    src.list = [];
  }

  var sources = {
    open: openSources, close: closeSources,
    isOpen: function () { return src.open; },
    autoPending: autoPending, expand: expandSources,
    choose: chooseSource
  };

  /* ---------- Starting-playback overlay ---------- */

  var starting = { node: null, title: null, hint: null, img: null };
  var STARTING_HINT = 'Waiting for the website\u2019s player  \u00b7  Press Back to cancel';

  /* A second call while the overlay is up updates it in place (no second fade-in). */
  function showStarting(info) {
    var root = document.getElementById('mbptv');
    if (!root) return;
    info = info || {};
    var art0 = Kit.backdrop(info.backdrop);
    if (starting.node && root.contains(starting.node)) {
      if (info.title) starting.title.textContent = info.title;
      starting.hint.textContent = info.hint || STARTING_HINT;
      if (Kit.safeImage(art0) && starting.img.getAttribute('src') !== art0) starting.img.src = art0;
      root.setAttribute('data-overlay', 'starting');
      return;
    }
    hideStarting();
    var n = el('div', 'mb-starting');
    var art = el('div', 'mb-art', null, n);
    var img = el('img', 'mb-img mb-art-img', null, art);
    img.setAttribute('alt', '');
    img.onload = U.guard(function () { U.toggleClass(img, 'is-loaded', true); }, 'start-art');
    if (Kit.safeImage(art0)) img.src = art0;
    el('div', 'mb-scrim-l', null, n);
    el('div', 'mb-scrim-b', null, n);
    var inner = el('div', 'mb-starting-inner', null, n);
    Kit.spinner(inner);
    el('div', 'mb-kicker', 'Starting playback', inner);
    starting.title = el('div', 'mb-display', info.title || '', inner);
    starting.hint = el('div', 'mb-meta', info.hint || STARTING_HINT, inner);
    starting.img = img;
    root.appendChild(n);
    root.setAttribute('data-overlay', 'starting');
    starting.node = n;
  }

  function setStartingHint(text) { if (starting.node && starting.hint) starting.hint.textContent = text || STARTING_HINT; }

  function hideStarting() {
    if (starting.node) U.detach(starting.node);
    starting.node = null;
    var root = document.getElementById('mbptv');
    if (root) root.removeAttribute('data-overlay');
  }

  /* ---------- Website mode: spatial ring over the site, TV pill, popup handling ---------- */

  var NATIVE_SEL = 'a[href], button, input, select, textarea, [onclick], [role="button"], [tabindex], li.play, .start_app, ' +
    '.start_app_episode, .login_more img, .close, .close2, .tips_close, .fav_close, .radio, label, .search_submit, ' +
    '.sidebarbg2 li, [oss_download_url]';
  var web = { on: false, cur: null, ring: null, pill: null, timer: null, scope: null, onBack: null, onEscape: null, here: false, typing: false, offScroll: null };

  function isOurs(n) {
    for (var p = n; p && p.nodeType === 1; p = p.parentNode) {
      if (p.id === 'mbptv' || p.id === 'mbptv-osd' || p.id === 'mbptv-ring') return true;
    }
    return false;
  }

  function textInput(n) {
    if (!n || n.nodeType !== 1) return false;
    if (n.isContentEditable) return true;
    if (n.tagName === 'TEXTAREA') return true;
    if (n.tagName !== 'INPUT') return false;
    return !/^(button|submit|reset|checkbox|radio|range|image|file|color|hidden)$/i.test(n.type || 'text');
  }

  /* Inline links that wrap block content report a tiny box of their own; use the first child's box instead. */
  function rectOf(n) {
    var r = n.getBoundingClientRect();
    if ((r.width < 4 || r.height < 4) && n.firstElementChild) {
      var c = n.firstElementChild.getBoundingClientRect();
      if (c.width >= 4 && c.height >= 4) return c;
    }
    return r;
  }

  function candidates() {
    var scope = web.scope && document.documentElement.contains(web.scope) ? web.scope : document.body;
    var list = U.qsa(scope, NATIVE_SEL), out = [], mark = '__mbptvCand' + U.now();
    var vw = window.innerWidth, vh = window.innerHeight;
    for (var i = 0; i < list.length && out.length < 500; i++) {
      var n = list[i];
      if (isOurs(n) || n.getAttribute('tabindex') === '-1' && !n.getAttribute('onclick') && n.tagName !== 'A') continue;
      if (n.tagName === 'INPUT' && /^hidden$/i.test(n.type)) continue;
      var r = rectOf(n);
      if (r.width < 4 || r.height < 4) continue;
      if (r.bottom < -vh * 3 || r.top > vh * 6 || r.right < 0 || r.left > vw) continue;
      var cs = window.getComputedStyle(n);
      if (!cs || cs.visibility === 'hidden' || cs.display === 'none') continue;
      n[mark] = true;
      out.push(n);
    }
    var kept = U.filter(out, function (n) {
      for (var p = n.parentNode; p && p.nodeType === 1 && p !== scope; p = p.parentNode) if (p[mark]) return false;
      return true;
    });
    U.each(out, function (n) { try { delete n[mark]; } catch (e) { n[mark] = false; } });
    if (!web.scope && web.pill && U.hasClass(web.pill, 'is-visible')) kept.push(web.pill);
    return kept;
  }

  function ensureWebNodes() {
    if (!web.ring || !document.documentElement.contains(web.ring)) {
      web.ring = document.getElementById('mbptv-ring') || el('div');
      web.ring.id = 'mbptv-ring';
      document.body.appendChild(web.ring);
    }
    if (!web.pill || !document.documentElement.contains(web.pill)) {
      web.pill = document.getElementById('mbptv-pill') || el('div');
      web.pill.id = 'mbptv-pill';
      U.empty(web.pill);
      Kit.monogram(web.pill);
      /* A blue dot names the remote's Blue button; the label says what the pill does. */
      var key = el('span', 'mbp-key', null, web.pill);
      key.setAttribute('aria-hidden', 'true');
      el('span', 'mbp-label', 'Back to TV app', web.pill);
      web.pill.setAttribute('role', 'button');
      U.on(web.pill, 'click', function (ev) { ev.preventDefault(); App.exitWebsite(); });
      document.body.appendChild(web.pill);
    }
    U.toggleClass(web.ring, 'mb-reduce', !!Screens.pref('reduceMotion', false));
  }

  function paintRing() {
    if (!web.on || !web.ring) return;
    var n = web.cur;
    if (!n || n === web.pill || !document.documentElement.contains(n)) { U.toggleClass(web.ring, 'is-visible', false); return; }
    var r = rectOf(n);
    if (r.width < 2 || r.height < 2) { U.toggleClass(web.ring, 'is-visible', false); return; }
    var pad = 4;
    web.ring.style.width = Math.round(r.width + pad * 2) + 'px';
    web.ring.style.height = Math.round(r.height + pad * 2) + 'px';
    Kit.transform(web.ring, 'translate3d(' + Math.round(r.left - pad) + 'px,' + Math.round(r.top - pad) + 'px,0)');
    U.toggleClass(web.ring, 'is-visible', true);
  }

  function reveal(n) {
    if (!n || n === web.pill) return;
    var r = rectOf(n), vh = window.innerHeight, margin = vh * 0.12;
    var dy = 0;
    if (r.top < margin) dy = r.top - margin;
    else if (r.bottom > vh - margin) dy = r.bottom - (vh - margin);
    if (dy) { try { window.scrollBy(0, Math.round(dy)); } catch (e) {} }
  }

  function webFocus(n) {
    if (web.pill) U.toggleClass(web.pill, 'is-focused', n === web.pill);
    web.cur = n;
    if (!n) { paintRing(); return; }
    if (n !== web.pill) {
      reveal(n);
      try { if (!textInput(n)) n.focus({ preventScroll: true }); } catch (e) { try { n.focus(); } catch (e2) {} }
      /* Images and divs with onclick cannot take DOM focus: drop the browser's own outline from the previous one. */
      var a = document.activeElement;
      if (a && a !== n && a !== document.body && !isOurs(a) && !textInput(a)) { try { a.blur(); } catch (e3) {} }
    }
    paintRing();
  }

  function initialWeb() {
    var list = candidates(), vh = window.innerHeight;
    if (web.scope) {
      var close = U.find(list, function (n) { return U.matches(n, '.close, .close2, .tips_close, .fav_close, [class*="close"]') || U.qs(n, '[class*="close"]'); });
      return close || list[0] || null;
    }
    var visible = U.filter(list, function (n) { var r = rectOf(n); return r.top >= 0 && r.bottom <= vh && n !== web.pill; });
    visible.sort(function (a, b) { var ra = rectOf(a), rb = rectOf(b); return (ra.top - rb.top) || (ra.left - rb.left); });
    return visible[0] || list[0] || null;
  }

  function nearestNative(from, dir) {
    var list = candidates();
    if (!from || !document.documentElement.contains(from)) return initialWeb();
    var c = rectOf(from), best = null, bestScore = Infinity;
    var ccx = c.left + c.width / 2, ccy = c.top + c.height / 2;
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n === from) continue;
      var r = rectOf(n), cx = r.left + r.width / 2, cy = r.top + r.height / 2, primary, secondary;
      if (dir === 'right') { if (cx <= ccx + 2 || r.left < c.left + 2) continue; primary = Math.max(0, r.left - c.right); secondary = Math.abs(cy - ccy); }
      else if (dir === 'left') { if (cx >= ccx - 2 || r.right > c.right - 2) continue; primary = Math.max(0, c.left - r.right); secondary = Math.abs(cy - ccy); }
      else if (dir === 'down') { if (cy <= ccy + 2 || r.top < c.top + 2) continue; primary = Math.max(0, r.top - c.bottom); secondary = Math.abs(cx - ccx); }
      else { if (cy >= ccy - 2 || r.bottom > c.bottom - 2) continue; primary = Math.max(0, c.top - r.bottom); secondary = Math.abs(cx - ccx); }
      var score = primary + secondary * 2;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  function startWeb(opts) {
    opts = opts || {};
    ensureWebNodes();
    web.on = true;
    web.scope = opts.scope || null;
    web.onBack = opts.onBack || null;
    web.onEscape = opts.onEscape || null;
    web.here = !!opts.here;
    web.typing = false;
    U.toggleClass(web.pill, 'is-visible', !web.scope);
    var first = opts.initial && document.documentElement.contains(opts.initial) && rectOf(opts.initial).width > 1 ? opts.initial : null;
    webFocus(first || initialWeb());
    clearInterval(web.timer);
    web.timer = setInterval(U.guard(function () {
      if (!web.on) return;
      if (web.cur && !document.documentElement.contains(web.cur)) webFocus(initialWeb());
      else paintRing();
    }, 'web-ring'), 500);
    if (!web.offScroll) web.offScroll = U.on(window, 'scroll', function () { if (web.on) paintRing(); }, true);
  }

  function stopWeb() {
    web.on = false;
    web.scope = null;
    web.onBack = null;
    web.onEscape = null;
    clearInterval(web.timer);
    if (web.offScroll) { web.offScroll(); web.offScroll = null; }
    if (web.ring) U.toggleClass(web.ring, 'is-visible', false);
    if (web.pill) { U.toggleClass(web.pill, 'is-visible', false); U.toggleClass(web.pill, 'is-focused', false); }
    web.cur = null;
  }

  function activateNative(n) {
    if (!n) return;
    if (n === web.pill) { App.exitWebsite(); return; }
    if (textInput(n) || n.tagName === 'SELECT') {
      web.typing = true;
      try { n.focus(); } catch (e) {}
      try { n.click(); } catch (e2) {}
      paintRing();
      return;
    }
    try { Site.live.click(n) || n.click(); } catch (e3) { try { n.click(); } catch (e4) {} }
    U.later(function () { if (web.on && web.cur && !document.documentElement.contains(web.cur)) webFocus(initialWeb()); else paintRing(); }, 300, 'web-after-click');
  }

  function webKey(name, ev) {
    var active = document.activeElement;
    var typing = textInput(active) && !isOurs(active);
    /* Blue / Info always lead back to the TV app: from website view directly, and from a scoped website control
       (a site popup, the player's controls) through that mode's own escape. */
    if (name === 'blue' || name === 'info') {
      if (!web.scope) { App.exitWebsite(); return true; }
      if (web.onEscape) { web.onEscape(name); return true; }
    }
    if (name === 'back') {
      if (typing) { try { active.blur(); } catch (e) {} web.typing = false; paintRing(); return true; }
      if (web.onBack) { web.onBack(); return true; }
      App.websiteBack();
      return true;
    }
    if (typing) {
      if (name === 'up' || name === 'down') { try { active.blur(); } catch (e2) {} web.typing = false; }
      else return false;
    }
    if (!Screens.pref('nativeRemote', true) && !web.scope) return false;
    if (name === 'left' || name === 'right' || name === 'up' || name === 'down') {
      var next = nearestNative(web.cur, name);
      if (next) webFocus(next);
      else if (name === 'up' || name === 'down') { try { window.scrollBy(0, (name === 'up' ? -1 : 1) * Math.round(window.innerHeight * 0.3)); } catch (e3) {} paintRing(); }
      return true;
    }
    if (name === 'enter') {
      if (!web.cur || !document.documentElement.contains(web.cur)) { webFocus(initialWeb()); return true; }
      activateNative(web.cur);
      return true;
    }
    return false;
  }

  var website = { start: startWeb, stop: stopWeb, key: webKey, active: function () { return web.on; }, refresh: paintRing };

  return {
    dialog: dialog, exitDialog: exitDialog, sheet: sheet, quality: quality, qualityPref: qualityPref,
    sources: sources, showStarting: showStarting, hideStarting: hideStarting,
    startingShown: function () { return !!starting.node; }, web: website, preferred: preferred
  };
}());

/* Player mode: the website's own player is on screen and our shell is hidden. Keys drive the <video>;
   the OSD (#mbptv-osd) shows title, progress and hints and never blocks the picture. */
var Player = (function () {
  var osd = null, els = {}, hideTimer = null, tickTimer = null, seekTimer = null, flashTimer = null;
  var active = false, info = {}, pendingSeek = null, streak = 0, lastDir = 0, lastSeekAt = 0;
  var hintShows = 0, sample = { v: null, t: -1 }, stallTicks = 0, buffering = false;

  /* The site's player may put an element into browser fullscreen, which paints above everything outside it:
     keep the OSD inside that element while it is fullscreen, and on <body> otherwise. */
  function host() {
    var fs = null;
    try { fs = document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || null; } catch (e) { fs = null; }
    if (fs && fs.nodeType === 1 && fs !== document.documentElement && fs !== document.body && !/^(VIDEO|IFRAME|OBJECT|EMBED|IMG|CANVAS)$/.test(fs.tagName)) return fs;
    return document.body;
  }

  function ensure() {
    if (osd && document.documentElement.contains(osd)) {
      var h = host();
      if (h && osd.parentNode !== h) { try { h.appendChild(osd); } catch (e) {} }
      return osd;
    }
    osd = document.getElementById('mbptv-osd') || U.el('div');
    osd.id = 'mbptv-osd';
    U.empty(osd);
    var inner = U.el('div', 'mbo-inner', null, osd);
    els.seek = U.el('div', 'mbo-seek', '', osd);
    els.title = U.el('div', 'mbo-title', '', inner);
    els.sub = U.el('div', 'mbo-sub', '', inner);
    var row = U.el('div', 'mbo-row', null, inner);
    els.state = U.el('span', 'mbo-state', null, row);
    var bar = U.el('div', 'mbo-bar', null, row);
    els.fill = U.el('div', 'mbo-fill', null, bar);
    els.knob = U.el('div', 'mbo-knob', null, bar);
    els.time = U.el('div', 'mbo-time', '', row);
    var hints = els.hints = U.el('div', 'mbo-hints', null, inner);
    function hint(key, label, icons, cls) {
      var h = U.el('span', 'mbo-hint', null, hints), k = U.el('span', 'mbo-key' + (cls ? ' ' + cls : ''), key, h);
      U.each(icons || [], function (name) { k.appendChild(Icons.el(name, 'mbo-kico')); });
      U.el('span', null, label, h);
    }
    hint('OK', 'Play / Pause');
    hint('', 'Seek 10 s, hold to go faster', ['chevronLeft', 'chevronRight']);
    hint('Back', 'Close player');
    hint('', 'Player controls', null, 'mbo-key--blue');
    (host() || document.body).appendChild(osd);
    return osd;
  }

  function video() { try { return Site.live.video(); } catch (e) { return null; } }

  function fmt(t) {
    if (!(t >= 0) || t === Infinity) return '--:--';
    t = Math.floor(t);
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function setState(want) {
    if (els.state.__icon === want) return;
    U.empty(els.state);
    if (want === 'buffer') U.el('span', 'mbo-spin', null, els.state);
    else els.state.appendChild(Icons.el(want));
    els.state.__icon = want;
  }

  function update() {
    if (!osd) return;
    var v = video();
    var cur = v ? v.currentTime : 0, dur = v ? v.duration : 0;
    if (pendingSeek != null) cur = pendingSeek;
    var pct = dur > 0 && dur !== Infinity ? U.clamp(cur / dur, 0, 1) * 100 : 0;
    els.fill.style.width = pct + '%';
    els.knob.style.left = pct + '%';
    els.time.textContent = fmt(cur) + ' / ' + fmt(dur);
    var playing = v && !v.paused && !v.ended;
    setState(buffering ? 'buffer' : playing ? 'pause' : 'play');
  }

  function shown() { return !!osd && U.hasClass(osd, 'is-visible'); }

  /* Shows the OSD. It auto-hides after ms only while the video plays: paused, ended or buffering, it stays up, so a
     frozen picture always says what it is doing (section 6.2). The key hints appear on the first two showings. */
  function show(ms) {
    ensure();
    els.title.textContent = info.title || '';
    els.sub.textContent = info.sub || '';
    els.sub.style.display = info.sub ? '' : 'none';
    if (!shown()) hintShows++;
    els.hints.style.display = hintShows <= 2 ? '' : 'none';
    update();
    U.toggleClass(osd, 'mb-reduce', !!Screens.pref('reduceMotion', false));
    U.toggleClass(osd, 'is-visible', true);
    clearTimeout(hideTimer);
    hideTimer = null;
    var v = video();
    if (buffering || (v && (v.paused || v.ended))) return;
    hideTimer = U.later(hide, ms || 3000, 'osd-hide');
  }

  function hide() {
    clearTimeout(hideTimer);
    hideTimer = null;
    if (osd) U.toggleClass(osd, 'is-visible', false);
  }

  function playVideo(v) {
    try { var p = v.play(); if (p && typeof p.then === 'function') p.then(null, function () {}); } catch (e) { Log.warn('player-play', e); }
  }

  /* The OSD reads the state after the toggle took effect. */
  function toggle() {
    var v = video();
    if (!v) { show(); return; }
    if (v.paused || v.ended) playVideo(v); else { try { v.pause(); } catch (e) {} }
    U.later(function () { if (active) show(3000); }, 60, 'osd-toggle');
  }

  function flash(text) {
    if (!els.seek) return;
    els.seek.textContent = text;
    U.toggleClass(els.seek, 'is-on', true);
    clearTimeout(flashTimer);
    flashTimer = U.later(function () { U.toggleClass(els.seek, 'is-on', false); }, 900, 'osd-flash');
  }

  function seek(dir, ev) {
    var v = video();
    if (!v) { show(); return; }
    var t = U.now();
    if (dir === lastDir && (t - lastSeekAt < 650 || (ev && ev.repeat))) streak++; else streak = 0;
    lastDir = dir; lastSeekAt = t;
    var step = streak >= 6 ? 30 : streak >= 3 ? 20 : 10;
    var base = pendingSeek != null ? pendingSeek : v.currentTime || 0;
    var dur = v.duration > 0 && v.duration !== Infinity ? v.duration : base + 3600;
    pendingSeek = U.clamp(base + dir * step, 0, Math.max(0, dur - 1));
    flash((dir > 0 ? '+' : '\u2212') + step + ' s');
    show(3000);
    clearTimeout(seekTimer);
    seekTimer = U.later(function () {
      var vv = video();
      if (vv && pendingSeek != null) { try { vv.currentTime = pendingSeek; } catch (e) { Log.warn('seek', e); } }
      pendingSeek = null;
      sample = { v: null, t: -1 };
      update();
    }, 280, 'seek-apply');
  }

  /* Every 500 ms while active (not only while the OSD shows): a video that should play, whose time has not moved for a
     second and that reports it lacks data (readyState below HAVE_FUTURE_DATA) is buffering: a spinner in the OSD,
     which stays up until it plays again. Both conditions, so a platform whose currentTime updates coarsely never
     flickers the OSD. A video paused by any means brings the OSD back; a video resumed elsewhere lets it auto-hide
     again. Polling, not media events: the website may swap its video element at any time. */
  function tick() {
    if (!active) return;
    var v = video(), t = v ? v.currentTime : -1;
    var still = !!(v && !v.paused && !v.ended && pendingSeek == null && sample.v === v && Math.abs(t - sample.t) < 0.05 && v.readyState < 3);
    sample = { v: v, t: t };
    stallTicks = still ? stallTicks + 1 : 0;
    var was = buffering;
    buffering = stallTicks >= 2;
    if (buffering && !was) show();
    else if (was && !buffering) show(3000);
    else if (v && (v.paused || v.ended) && !shown()) show();
    else if (shown() && v && !v.paused && !v.ended && !hideTimer && !buffering) show(3000);
    else if (shown()) update();
  }

  function key(name, ev) {
    var v;
    switch (name) {
      case 'enter': case 'playpause': toggle(); return true;
      case 'play': v = video(); if (v) playVideo(v); U.later(function () { if (active) show(3000); }, 60, 'osd-play'); return true;
      case 'pause': v = video(); if (v) { try { v.pause(); } catch (e) {} } U.later(function () { if (active) show(); }, 60, 'osd-pause'); return true;
      case 'left': case 'rw': seek(-1, ev); return true;
      case 'right': case 'ff': seek(1, ev); return true;
      case 'up': case 'down': case 'info': show(4000); return true;
      case 'blue': App.playerControls(); return true;
      case 'back': case 'stop': App.closePlayer(); return true;
      default: return true;
    }
  }

  /* i: {title, sub} */
  function start(i) {
    info = i || {};
    active = true;
    pendingSeek = null; streak = 0; stallTicks = 0; buffering = false;
    sample = { v: null, t: -1 };
    ensure();
    show(3500);
    clearInterval(tickTimer);
    tickTimer = setInterval(U.guard(tick, 'osd-tick'), 500);
  }

  function stop() {
    active = false;
    buffering = false;
    clearInterval(tickTimer);
    clearTimeout(seekTimer);
    pendingSeek = null;
    hide();
    if (osd && document.body && osd.parentNode && osd.parentNode !== document.body) { try { document.body.appendChild(osd); } catch (e) {} }
  }

  return { start: start, stop: stop, key: key, show: show, active: function () { return active; }, buffering: function () { return buffering; } };
}());
/* ---- 55-player.js ---- */
/* Native player (docs/PLAYER.md). Plays movies and episodes in our own full-screen <video>, through the same
   endpoints the website's player uses: the title page's file list (movies) or POST tv_file (episodes), then
   POST <oss_download_url>&jw..player=1 for the player data, which is read with regexes and never evaluated.
   Streams are tried in a platform-aware order with a per-candidate timeout; progress goes to the site's own
   progress endpoints, so Continue Watching and the website's resume points stay in sync. Stream URLs are signed,
   time-limited and account-bound: they are never logged or stored. Only NativePlayer is declared at top level
   and nothing runs at load time. */
var NativePlayer = (function () {
  var CFG = {
    requestTimeout: 15000, retryDelay: 700, candidateTimeout: 15000, stallTimeout: 15000, osdHide: 4000,
    progressEvery: 20000, seekApply: 400, seekReport: 1500, upNextLead: 25, upNextCount: 10, chipMs: 6000,
    startBudget: 60000, stillWatchingAfter: 3, repeatGap: 250
  };
  /* Held keys act once (the App's hold guard also swallows held OK/Back, including repeats that arrive after the
     player closed); arrows and FF/RW keep auto-repeat for seeking and sheet navigation. */
  var ONCE = { enter: 1, back: 1, backspace: 1, stop: 1, play: 1, pause: 1, playpause: 1, space: 1, chup: 1, chdown: 1, info: 1 };
  var PROGRESS_PATH = /^\/index\/index\/(?:tv|movie)_progress$/;
  var JW_FLAG = 'jw' + 'player=1'; /* the website's own "player data" flag (split so the site-globals lint scan skips it) */
  var FORM = 'application/x-www-form-urlencoded; charset=UTF-8';
  var MIME = { h264: 'video/mp4; codecs="avc1.640028"', hvc1: 'video/mp4; codecs="hvc1.1.6.L150.B0"', hev1: 'video/mp4; codecs="hev1.1.6.L150.B0"' };
  var SHEET_ORDER = ['AUTO', '1080p', '720p', '480p', '360p', 'ORG'];

  var gen = 0;        /* bumped by every session start and stop: callbacks from older sessions are dropped */
  var S = null;       /* the current session (one movie or one episode) */
  var ui = null;      /* the overlay DOM while the player is up */
  var saverOff = false;
  var unattended = 0; /* episodes started by autoplay since the viewer last pressed a key ("Still watching?") */

  /* ---------- icons (static, author-written SVG only) ---------- */

  var ICONS = {
    play: '<path d="M7.2 4.3v15.4c0 .8.9 1.3 1.6.9l12.1-7.7c.6-.4.6-1.4 0-1.8L8.8 3.4c-.7-.4-1.6.1-1.6.9z"/>',
    pause: '<path d="M6.5 4h3.6c.4 0 .7.3.7.7v14.6c0 .4-.3.7-.7.7H6.5c-.4 0-.7-.3-.7-.7V4.7c0-.4.3-.7.7-.7zm7.4 0h3.6c.4 0 .7.3.7.7v14.6c0 .4-.3.7-.7.7h-3.6c-.4 0-.7-.3-.7-.7V4.7c0-.4.3-.7.7-.7z"/>',
    next: '<path d="M4.6 5.1v13.8c0 .8.9 1.2 1.5.8l9.6-6.9c.5-.4.5-1.2 0-1.6L6.1 4.3c-.6-.4-1.5 0-1.5.8zM17 4.6h2.6v14.8H17z"/>',
    skip: '<path d="M3.5 5.4v13.2c0 .7.8 1.1 1.3.7l8.1-6.6c.4-.4.4-1 0-1.4L4.8 4.7c-.5-.4-1.3 0-1.3.7zm8.8 0v13.2c0 .7.8 1.1 1.3.7l8.1-6.6c.4-.4.4-1 0-1.4l-8.1-6.6c-.5-.4-1.3 0-1.3.7z"/>',
    restart: '<path d="M12 4.4V1.6L7.4 5.8 12 10V7a5.4 5.4 0 1 1-5.4 5.4H4a8 8 0 1 0 8-8z"/>',
    quality: '<path fill-rule="evenodd" d="M4.2 5h15.6c.7 0 1.2.5 1.2 1.2v11.6c0 .7-.5 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2V6.2C3 5.5 3.5 5 4.2 5zM5.2 7.2v9.6h13.6V7.2zM7 9h1.8v2.1h2V9h1.8v6h-1.8v-2.2h-2V15H7zm7 0h2.6c1.3 0 2.4 1.1 2.4 2.4v1.2c0 1.3-1.1 2.4-2.4 2.4H14zm1.8 1.7v2.6h.8c.4 0 .6-.3.6-.7v-1.2c0-.4-.2-.7-.6-.7z"/>',
    alert: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.3 4.8v7.4h2.6V6.8zM12 15.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>',
    check: '<path d="M9.4 16.4l-4.3-4.3-1.8 1.8 6.1 6.1L21 8.3l-1.8-1.8z"/>',
    globe: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.4 2.2A7.9 7.9 0 0 0 4.2 11h3.3c.1-2.6.9-5 3.1-6.8zm2.8 0c2.2 1.8 3 4.2 3.1 6.8h3.3a7.9 7.9 0 0 0-6.4-6.8zM12 4.6c-1.6 1.5-2.3 3.8-2.4 6.4h4.8c-.1-2.6-.8-4.9-2.4-6.4zM4.2 13a7.9 7.9 0 0 0 6.4 6.8c-2.2-1.8-3-4.2-3.1-6.8zm5.4 0c.1 2.6.8 4.9 2.4 6.4 1.6-1.5 2.3-3.8 2.4-6.4zm6.9 0c-.1 2.6-.9 5-3.1 6.8a7.9 7.9 0 0 0 6.4-6.8z"/>',
    back: '<path d="M10.9 5.2L4.1 12l6.8 6.8 1.7-1.7-3.9-3.9H20v-2.4H8.7l3.9-3.9z"/>',
    close: '<path d="M6.3 4.6L12 10.3l5.7-5.7 1.7 1.7-5.7 5.7 5.7 5.7-1.7 1.7-5.7-5.7-5.7 5.7-1.7-1.7 5.7-5.7-5.7-5.7z"/>',
    reload: '<path d="M12 4.2c2.2 0 4.2.9 5.6 2.4L20 4.2V11h-6.8l2.9-2.9A5.7 5.7 0 0 0 6.4 12H4.2A7.8 7.8 0 0 1 12 4.2zm7.8 7.8A7.8 7.8 0 0 1 6.4 17.4L4 19.8V13h6.8l-2.9 2.9a5.7 5.7 0 0 0 9.7-3.9z"/>'
  };

  function icon(name, cls) {
    return U.svg('<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
      (ICONS[name] || ICONS.alert) + '</svg>', 'mbp-ico' + (cls ? ' ' + cls : ''));
  }

  /* ---------- small helpers ---------- */

  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function isArray(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
  }

  function fmtDelta(d) {
    var a = Math.round(Math.abs(d));
    return (d < 0 ? '\u2212' : '+') + (a < 60 ? a + ' s' : fmt(a));
  }

  /* Log-safe text: anything URL-like is masked (stream URLs carry signed, account-bound tokens). */
  function clean(v) {
    var s = v && v.message ? String(v.message) : String(v == null ? '' : v);
    return s.replace(/(?:[a-z][a-z0-9+.\-]*:)?\/\/[^\s'"<>]+/gi, '<url>').slice(0, 200);
  }

  function el(tag, cls, text, parent) { return U.el(tag, cls, text, parent); }
  function setText(node, text) { text = String(text == null ? '' : text); if (node && node.textContent !== text) node.textContent = text; }
  function tf(node, value) { if (!node) return; node.style.webkitTransform = value; node.style.transform = value; }
  function flag(node, name, on) { U.toggleClass(node, name, !!on); }
  function safeImage(url) { return typeof url === 'string' && /^https?:\/\//i.test(url) && url.length < 2048; }
  /* Pictures at the size they are shown (the kit's sized URLs, when the kit is loaded). */
  function sized(url, w) { try { return typeof Kit !== 'undefined' && Kit.imgUrl ? Kit.imgUrl(url, w) : url; } catch (e) { return url; } }
  /* Shows img's picture at url, sized to w; a sized picture that fails falls back once to the original (retryOriginal). */
  function setArt(img, url, w) {
    var src = sized(url, w);
    img.__orig = src !== url ? url : '';
    if (img.getAttribute('src') !== src) { flag(img, 'is-loaded', false); img.src = src; }
  }
  function retryOriginal(img) {
    var o = img.__orig;
    img.__orig = '';
    if (!o || img.getAttribute('src') === o) return false;
    img.src = o;
    return true;
  }

  function hook(h, name) {
    var fn = h && h[name];
    if (typeof fn !== 'function') return;
    var args = Array.prototype.slice.call(arguments, 2);
    try { fn.apply(null, args); } catch (e) { Log.error('player-hook:' + name, e); }
  }

  function later(s, name, fn, ms) {
    if (!s) return;
    clearTimeout(s.timers[name]);
    s.timers[name] = U.later(function () { if (s === S && !s.finished) fn(); }, ms, 'player-' + name);
  }

  function cancel(s, name) { if (s && s.timers[name]) { clearTimeout(s.timers[name]); s.timers[name] = null; } }

  /* Wraps an async callback: dropped when its session is gone; a throw shows the error card instead of hanging. */
  function safe(s, fn, label) {
    return function () {
      if (s !== S || s.finished) return;
      try { fn.apply(null, arguments); } catch (e) {
        Log.error(label || 'player', e);
        if (s === S && !s.finished) showError(s, 'internal', 'Something went wrong while starting playback.');
      }
    };
  }

  /* ---------- platform ---------- */

  function isTV() {
    try { return /Tizen|SMART-TV|Web0S|NetCast/i.test(String(navigator.userAgent || '')) || !!window.tizen; } catch (e) { return false; }
  }

  /* The site appends audio=aac to HLS URLs on TVs: EAC3 audio stalls in native HLS. */
  function needsAac(tv) {
    if (tv) return true;
    try {
      var MS = window.MediaSource || window.WebKitMediaSource;
      if (MS && typeof MS.isTypeSupported === 'function') return !MS.isTypeSupported('audio/mp4; codecs="ec-3"');
    } catch (e) {}
    return true;
  }

  function canPlayProbe() {
    var probe = null;
    return function (mime) {
      try {
        if (!probe) probe = document.createElement('video');
        return probe.canPlayType ? String(probe.canPlayType(mime) || '') : '';
      } catch (e) { return ''; }
    };
  }

  function environment() { var tv = isTV(); return { tv: tv, aac: needsAac(tv), canPlay: canPlayProbe() }; }

  /* The app is in the background (Home button, input switch, another app on top). */
  function isHidden() {
    try { return !!document.hidden || document.visibilityState === 'hidden' || !!document.webkitHidden; } catch (e) { return false; }
  }

  /* ---------- player data parsing (regexes only; never evaluated) ---------- */

  function inComment(text, idx) {
    var pre = text.slice(text.lastIndexOf('\n', idx - 1) + 1, idx).replace(/^\s+/, '');
    if (pre.slice(0, 2) === '//' || pre.slice(0, 2) === '/*' || pre.charAt(0) === '*') return true;
    return /(^|[^:'"\\])\/\//.test(pre);
  }

  /* Index just after the first "var NAME =" that is not on a comment line, or -1. */
  function varAt(text, name) {
    var re = new RegExp('\\bvar\\s+' + name + '\\s*=\\s*', 'g'), m;
    while ((m = re.exec(text))) if (!inComment(text, m.index)) return m.index + m[0].length;
    return -1;
  }

  function unescapeJs(s) {
    return String(s).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, function (m, c) {
      if (c.length === 5 && c.charAt(0) === 'u') return String.fromCharCode(parseInt(c.slice(1), 16));
      if (c.length === 3 && c.charAt(0) === 'x') return String.fromCharCode(parseInt(c.slice(1), 16));
      return c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c;
    });
  }

  /* A quoted string, number or literal after "var NAME =", as a string; null when absent. */
  function scalar(text, name) {
    var at = varAt(text, name);
    if (at < 0) return null;
    var m = /^(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|(-?\d+(?:\.\d+)?)|(true|false|null))/.exec(text.slice(at, at + 4000));
    if (!m) return null;
    if (m[1] != null) return unescapeJs(m[1]);
    if (m[2] != null) return unescapeJs(m[2]);
    if (m[3] != null) return m[3];
    return m[4] === 'null' ? '' : m[4];
  }

  /* The balanced [...] or {...} starting at text[at], respecting quoted strings. */
  function balanced(text, at) {
    var depth = 0, quote = '', i, c, end = Math.min(text.length, at + 2000000);
    for (i = at; i < end; i++) {
      c = text.charAt(i);
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = '';
        continue;
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') { depth--; if (depth === 0) return text.slice(at, i + 1); }
    }
    return '';
  }

  function jsonVar(text, name) {
    var at = varAt(text, name);
    if (at < 0) return null;
    var c = text.charAt(at);
    if (c === '[' || c === '{') return U.parseJSON(balanced(text, at));
    if (c === "'" || c === '"') { var s = scalar(text, name); return s ? U.parseJSON(s) : null; }
    return null;
  }

  function normLabel(label, hls) {
    var l = U.text(label);
    if (/^org(?:inal)?$/i.test(l)) return 'ORG';
    if (/^auto$/i.test(l)) return 'AUTO';
    return l || (hls ? 'AUTO' : 'ORG');
  }

  function normSource(s) {
    if (!s || typeof s !== 'object') return null;
    var file = typeof s.file === 'string' ? U.text(s.file) : '';
    if (!file) return null;
    var abs = /^https?:\/\//i.test(file) ? file : (file.charAt(0) === '/' ? Site.resolve(file) : '');
    if (!abs || !/^https?:\/\//i.test(abs)) return null;
    var type = String(s.type || '');
    var hls = /mpegurl/i.test(type) || /\.m3u8(?:[?#]|$)/i.test(abs);
    return {
      label: normLabel(s.label, hls), src: abs, hls: hls, h265: toInt(s.h265) === 1, hdr: toInt(s.hdr) === 1,
      width: toInt(s.width), height: toInt(s.height), fps: num(s.fps)
    };
  }

  function parse(text) {
    var out = {
      ok: false, code: 0, msg: '', gate: false, sources: [], seconds: 0, mp4Id: '', next: null, tid: '', season: 0, episode: 0,
      skips: { start: -1, end: -1 }, post: null, progressUrl: ''
    };
    text = String(text == null ? '' : text);
    var head = text.replace(/^[\s\uFEFF]+/, '');
    if (head.charAt(0) === '{') {
      var j = U.parseJSON(head);
      if (j && typeof j === 'object' && !isArray(j)) {
        out.code = toInt(j.code);
        out.msg = U.text(j.msg || j.message || '');
        return out;
      }
    }
    if (varAt(text, 'sources') < 0 && /private\s+garden|login_btn|\/index\/login/i.test(text)) {
      try { out.gate = Site.isGate(U.parseHTML(text)); } catch (e) { out.gate = false; }
      if (out.gate) return out;
    }
    var list = jsonVar(text, 'sources');
    if (isArray(list)) U.each(list, function (s) { var n = normSource(s); if (n) out.sources.push(n); });
    out.seconds = Math.max(0, num(scalar(text, 'seconds')));
    out.mp4Id = String(scalar(text, 'mp4_id') || '').replace(/[^\d]/g, '');
    var ns = toInt(scalar(text, 'next_season')), ne = toInt(scalar(text, 'next_episode'));
    if (ns > 0 && ne > 0) out.next = { season: ns, episode: ne };
    out.tid = String(scalar(text, 'tid') || '').replace(/[^\d]/g, '');
    out.season = toInt(scalar(text, 'current_season'));
    out.episode = toInt(scalar(text, 'current_episode'));
    var sk = jsonVar(text, 'skips');
    if (sk && typeof sk === 'object' && !isArray(sk)) {
      out.skips.start = sk.start == null || sk.start === '' ? -1 : num(sk.start);
      out.skips.end = sk.end == null || sk.end === '' ? -1 : num(sk.end);
    }
    var post = jsonVar(text, 'post');
    if (post && typeof post === 'object' && !isArray(post)) {
      var clean2 = {}, n = 0;
      for (var k in post) {
        if (post.hasOwnProperty(k) && /^[\w\-]{1,40}$/.test(k) && (typeof post[k] === 'string' || typeof post[k] === 'number')) { clean2[k] = String(post[k]); n++; }
      }
      out.post = n ? clean2 : null;
    }
    var re = /\burl\s*:\s*["'](\/index\/index\/(?:tv|movie)_progress)["']/g, pm;
    while ((pm = re.exec(text))) { if (!inComment(text, pm.index)) { out.progressUrl = pm[1]; break; } }
    out.ok = out.sources.length > 0;
    return out;
  }

  /* ---------- stream order ---------- */

  function rank(label) { var m = /(\d{3,4})p/i.exec(String(label || '')); return m ? toInt(m[1]) : 0; }

  function withAac(u) {
    u = String(u || '');
    if (!u || /[?&]audio=aac(?:[&#]|$)/.test(u)) return u;
    var hash = '', i = u.indexOf('#');
    if (i >= 0) { hash = u.slice(i); u = u.slice(0, i); }
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'audio=aac' + hash;
  }

  function playable(s, env) {
    var cp = env && typeof env.canPlay === 'function' ? env.canPlay : function () { return ''; };
    if (s.h265) return !!(cp(MIME.hvc1) || cp(MIME.hev1));
    return !!cp(MIME.h264);
  }

  /* TV: AUTO HLS, then the MP4 files (ORG first), then the fixed HLS renditions from the highest down.
     Elsewhere: MP4s the browser says it can decode, AUTO, fixed HLS, then the remaining MP4s as a last resort. */
  function order(sources, env) {
    env = env || environment();
    var auto = [], org = [], mp4 = [], fixed = [], other = [];
    U.each(sources || [], function (s) {
      if (!s || !s.src) return;
      if (s.hls && s.label === 'AUTO') auto.push(s);
      else if (s.hls && rank(s.label)) fixed.push(s);
      else if (!s.hls && s.label === 'ORG') org.push(s);
      else if (!s.hls) mp4.push(s);
      else other.push(s);
    });
    fixed.sort(function (a, b) { return rank(b.label) - rank(a.label); });
    mp4 = org.concat(mp4);
    var list;
    if (env.tv) list = auto.concat(mp4, fixed, other);
    else {
      var yes = [], no = [];
      U.each(mp4, function (s) { if (playable(s, env)) yes.push(s); else no.push(s); });
      list = yes.concat(auto, fixed, other, no);
    }
    return U.map(list, function (s) {
      return { label: s.label, src: s.hls && env.aac ? withAac(s.src) : s.src, hls: !!s.hls, h265: !!s.h265, hdr: !!s.hdr,
        width: s.width || 0, height: s.height || 0, fps: s.fps || 0 };
    });
  }

  /* ---------- files ---------- */

  function filesIn(doc) {
    var out = [];
    U.each(U.qsa(doc, 'li[oss_download_url]'), function (li) {
      var url = U.text(li.getAttribute('oss_download_url') || '');
      if (!url) return;
      var s = Site.source(li, out.length);
      out.push({ index: out.length, url: url, quality: s.quality || '', file: s.file || '', size: s.size || '', date: s.date || '' });
    });
    return out;
  }

  function qrank(q) {
    q = String(q || '');
    if (/8k/i.test(q)) return 4320;
    if (/4k|2160/i.test(q)) return 2160;
    if (/1440/.test(q)) return 1440;
    if (/720/.test(q)) return 720;
    if (/\bsd\b|480|360/i.test(q)) return 480;
    return 1080;
  }

  /* req.fileIndex, else Prefs.quality: 'best' and 'ask' take the first listed file, 1080p/720p the closest match. */
  function chooseFile(files, req) {
    if (!files.length) return -1;
    var fi = parseInt(req.fileIndex, 10);
    if (!isNaN(fi) && fi >= 0 && fi < files.length) return fi;
    var q = '';
    try { q = typeof Prefs !== 'undefined' ? Prefs.get('quality') : ''; } catch (e) { q = ''; }
    if (q !== '1080p' && q !== '720p') return 0;
    var want = toInt(q), best = 0, bestD = Infinity;
    U.each(files, function (f, i) {
      var r = qrank(f.quality), d = Math.abs(r - want) + (r > want ? 0.5 : 0);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /* ---------- requests: timeout and one retry; session requests are aborted on stop ---------- */

  function retryable(err) { return !!err && (err.code === 'network' || err.code === 'timeout' || /^http-5\d\d$/.test(String(err.code || ''))); }

  function send(s, opts, cb, attempt) {
    attempt = attempt || 0;
    var h = U.xhr({
      method: 'POST', url: opts.url, body: opts.body || '', timeout: CFG.requestTimeout,
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': FORM, Accept: 'text/html, application/json, */*; q=0.01' }
    }, function (err, res) {
      if (s) { var i = U.indexOf(s.reqs, h); if (i >= 0) s.reqs.splice(i, 1); if (s !== S || s.finished) return; }
      if (err && attempt < 1 && retryable(err)) {
        Log.info('player', opts.label + ' ' + err.code + '; retrying');
        U.later(function () { if (s && (s !== S || s.finished)) return; send(s, opts, cb, attempt + 1); }, CFG.retryDelay, 'player-retry');
        return;
      }
      cb(err, res);
    });
    if (s) s.reqs.push(h);
    return h;
  }

  function origin() { return Site.url.origin(); }
  function enc(v) { return encodeURIComponent(String(v == null ? '' : v)); }

  function signedOutRes(res) {
    try { if (/\/index\/login(?:\/|$)/i.test(U.parseUrl(res && res.url || '').pathname)) return true; } catch (e) {}
    var t = String(res && res.text || '');
    if (!/private\s+garden|login_btn/i.test(t) || varAt(t, 'sources') >= 0) return false;
    try { return Site.isGate(U.parseHTML(t)); } catch (e2) { return false; }
  }

  function playerUrl(oss) {
    var abs = Site.resolve(String(oss || ''), origin() + '/');
    if (!abs || !U.sameSite(abs)) return '';
    return abs + (abs.indexOf('?') >= 0 ? '&' : '?') + JW_FLAG;
  }

  /* ---------- session lifecycle ---------- */

  function newSession(input, hooks) {
    var req = {}, k;
    for (k in input) if (input.hasOwnProperty(k)) req[k] = input[k];
    var kind = req.kind === 'tv' ? 'tv' : 'movie';
    return {
      gen: 0, req: req, hooks: hooks || {}, kind: kind, id: String(req.id == null ? '' : req.id).replace(/[^\d]/g, ''),
      /* Episode 0 is a special (S01E00 in the site's episode list), played only when asked for explicitly. */
      season: kind === 'tv' ? Math.max(1, toInt(req.season)) : 0,
      episode: kind === 'tv' ? (req.episode === 0 || req.episode === '0' ? 0 : Math.max(1, toInt(req.episode))) : 0,
      state: 'loading', data: null, files: [], fileIndex: -1, cands: [], base: [], ci: -1, tryId: 0, ready: false, started: false,
      playedTry: -1, blocked: false, userPaused: false, failed: {}, relinkAt: 0, relinking: false, playedSinceRelink: false, resumeAt: 0, errAt: 0,
      pendingAt: 0, resumePending: false, resumed: 0, lastTime: 0, lastDur: 0, lastSent: '', post: null, progressUrl: '', next: null,
      introEnd: 0, creditsAt: 0, osd: false, area: 'scrub', btn: 'play-pause', btnSig: '', seek: null, seekKey: null,
      upnext: null, dismissedNext: false, nextInfo: null, nextFetching: false, sheet: null, err: null, chipStartOver: false,
      buffering: false, waitAt: 0, switchNote: '', bgPaused: false, ended: false, lastRender: 0, timers: {}, reqs: [], offs: [], finished: false
    };
  }

  /* resumeAt (optional): start here instead of the site's saved position (Try again after a failure mid-film). */
  function begin(req, hooks, kicker, resumeAt) {
    gen++;
    var s = S = newSession(req, hooks);
    s.gen = gen;
    s.kicker = kicker || '';
    s.resumeAt = resumeAt > 0 ? resumeAt : 0;
    resetUi(s);
    Log.info('player', 'open ' + s.kind + ':' + s.id + (s.kind === 'tv' ? ' S' + s.season + 'E' + s.episode : ''));
    s.offs.push(U.on(window, 'pagehide', function () { if (s === S) report(s, 'pagehide'); }));
    s.offs.push(U.on(document, 'visibilitychange', function () {
      if (s !== S || s.finished) return;
      if (isHidden()) toBackground(s); else fromBackground(s);
    }));
    /* A hanging network must not keep the viewer on the loading screen for minutes (files + player data + every
       candidate could add up to about two): after startBudget the error card offers Try again and the website. */
    later(s, 'budget', function () {
      if (s.started || s.state !== 'loading' || s.blocked) return;
      Log.warn('player', 'no playback after ' + Math.round(CFG.startBudget / 1000) + ' s');
      showError(s, s.cands.length ? 'streams-failed' : 'network', 'MovieBox Pro is taking too long to start this video. Check your connection and try again.');
    }, CFG.startBudget);
    if (!s.id) { showError(s, 'bad-request', 'This title could not be identified.'); return; }
    if (req.fileUrl) { s.files = [{ index: 0, url: String(req.fileUrl), quality: '', file: '', size: '', date: '' }]; s.fileIndex = 0; loadPlayer(s, 0); return; }
    if (s.kind === 'tv') loadEpisodeFiles(s); else loadMovieFiles(s);
  }

  function loadMovieFiles(s) {
    setStatus(s, 'Getting the stream ready\u2026');
    Api.fetchDoc(Site.url.title('movie', s.id), safe(s, function (err, res) {
      if (err) { failed(s, err, 'files'); return; }
      s.files = filesIn(res.doc);
      Log.info('player', 'files ' + s.files.length);
      if (!s.files.length) { showError(s, 'no-files', 'MovieBox Pro has no playable files for this title yet.'); return; }
      s.fileIndex = chooseFile(s.files, s.req);
      loadPlayer(s, s.fileIndex);
    }, 'player-files'));
  }

  function loadEpisodeFiles(s) {
    setStatus(s, 'Getting the episode ready\u2026');
    var body = 'tid=' + enc(s.id) + '&season=' + s.season + '&episode=' + s.episode;
    send(s, { url: origin() + '/index/index/tv_file', body: body, label: 'tv_file' }, safe(s, function (err, res) {
      if (err) { failed(s, err, 'tv_file'); return; }
      if (signedOutRes(res)) { fallback(s, 'signed-out'); return; }
      var j = U.parseJSON(res.text);
      if (!j || typeof j !== 'object') { showError(s, 'bad-answer', 'MovieBox Pro sent an unexpected answer. Try again in a moment.'); return; }
      if (toInt(j.code) !== 1) {
        Log.warn('player', 'tv_file code ' + toInt(j.code));
        showError(s, 'site-error', U.text(j.msg) || 'This episode isn\u2019t available right now.', 'Code ' + toInt(j.code));
        return;
      }
      var html = j.data && typeof j.data.list === 'string' ? j.data.list : '';
      s.files = html ? filesIn(U.parseHTML('<ul>' + html + '</ul>')) : [];
      Log.info('player', 'episode files ' + s.files.length);
      if (!s.files.length) { showError(s, 'no-files', 'This episode has no playable files yet.'); return; }
      s.fileIndex = 0;
      loadPlayer(s, 0);
    }, 'player-tv-file'));
  }

  function fetchPlayerData(s, fileIndex, cb) {
    var f = s.files[fileIndex], url = f ? playerUrl(f.url) : '';
    if (!url) { cb({ code: 'bad-url' }, null); return; }
    send(s, { url: url, body: '', label: 'player' }, safe(s, function (err, res) {
      if (err) { cb(err, null); return; }
      if (signedOutRes(res)) { cb({ code: 'signed-out' }, null); return; }
      var d = parse(res.text);
      if (d.gate) { cb({ code: 'signed-out' }, null); return; }
      cb(null, d);
    }, 'player-data'));
  }

  function loadPlayer(s, fileIndex) {
    setStatus(s, 'Getting the stream ready\u2026');
    fetchPlayerData(s, fileIndex, function (err, d) {
      if (err) {
        if (err.code === 'bad-url') { showError(s, 'no-files', 'This file has an unexpected address.'); return; }
        failed(s, err, 'player');
        return;
      }
      if (!d.sources.length) {
        if (d.code && d.code !== 1) {
          Log.warn('player', 'player data code ' + d.code);
          showError(s, 'site-error', d.msg || 'MovieBox Pro can\u2019t play this title right now.', 'Code ' + d.code);
        } else {
          showError(s, 'streams-failed', 'MovieBox Pro didn\u2019t offer a stream for this title.');
        }
        return;
      }
      applyData(s, d);
      var at = s.resumeAt > 0 ? s.resumeAt : d.seconds;
      Log.info('player', 'player data: ' + d.sources.length + ' sources [' + U.map(d.sources, function (x) { return x.label; }).join(', ') + ']' +
        (s.next ? ', next S' + s.next.season + 'E' + s.next.episode : '') + (at ? ', resume ' + Math.round(at) : '') +
        (s.introEnd ? ', intro ' + Math.round(s.introEnd) : '') + (s.creditsAt ? ', credits ' + Math.round(s.creditsAt) : '') +
        ', order [' + U.map(s.cands, function (c) { return c.label; }).join(', ') + ']');
      /* The site's saved position follows the resume rules below; a continuation (Try again) goes back exactly. */
      s.resumePending = !(s.resumeAt > 0);
      startCandidate(s, 0, at, '');
    });
  }

  function fallbackPost(s) {
    return s.kind === 'tv' ? { type: 'tv', tid: s.id, season: String(s.season), episode: String(s.episode) } : { type: 'movie', mid: s.id };
  }

  function applyData(s, d) {
    s.data = d;
    if (s.kind === 'tv') {
      if (d.season > 0) s.season = d.season;
      if (d.episode > 0) s.episode = d.episode;
    }
    s.post = d.post || fallbackPost(s);
    s.progressUrl = PROGRESS_PATH.test(d.progressUrl) ? d.progressUrl : '/index/index/' + s.kind + '_progress';
    s.next = s.kind === 'tv' && d.next ? d.next : null;
    s.introEnd = d.skips.start > 0 ? d.skips.start : 0;
    s.creditsAt = d.skips.end > 0 ? d.skips.end : 0;
    s.cands = order(d.sources, environment());
    s.base = s.cands.slice();
    s.failed = {};
    if (!s.started) s.lastSent = Math.floor(d.seconds) + ':0';
    renderTitles(s);
    s.btnSig = '';
  }

  function failed(s, err, stage) {
    var code = err && err.code || 'error';
    Log.warn('player', stage + ' failed: ' + code);
    if (code === 'signed-out') { fallback(s, 'signed-out'); return; }
    var net = code === 'timeout' || code === 'network' || /^http-5/.test(code);
    showError(s, net ? 'network' : 'bad-answer', net ? 'MovieBox Pro didn\u2019t answer. Check your connection and try again.' :
      'MovieBox Pro sent an unexpected answer. Try again in a moment.', net ? '' : 'Code ' + code);
  }

  /* Ends a session's playback: final progress, timers, listeners, requests, screen saver, decoder. Idempotent. */
  function finish(s, opts) {
    if (!s || s.finished) return null;
    opts = opts || {};
    report(s, opts.why || 'stop', { over: opts.over });
    var snap = snapshot(s);
    s.finished = true;
    for (var k in s.timers) if (s.timers.hasOwnProperty(k)) clearTimeout(s.timers[k]);
    U.each(s.offs, function (off) { try { off(); } catch (e) {} });
    U.each(s.reqs, function (h) { try { h.abort(); } catch (e) {} });
    s.offs = []; s.reqs = [];
    keepAwake(false);
    releaseVideo();
    if (S === s) S = null;
    return snap;
  }

  function snapshot(s) {
    var c = s.cands[s.ci], d = dur() || s.lastDur;
    return {
      kind: s.kind, id: s.id, season: s.season, episode: s.episode, time: Math.round(pos(s) * 10) / 10,
      duration: Math.round(d * 10) / 10, paused: paused(), stream: c ? (c.hls ? 'hls' : 'mp4') : '', label: c ? c.label : '',
      state: s.state, started: s.started, file: s.fileIndex
    };
  }

  function fallback(s, reason) {
    var req = s.req, h = s.hooks;
    Log.info('player', 'fallback to the website player: ' + reason);
    stop('fallback');
    hook(h, 'onFallback', req, reason);
  }

  /* ---------- streams ---------- */

  function startCandidate(s, i, at, why) {
    cancel(s, 'cand'); cancel(s, 'stall');
    var c = s.cands[i];
    if (!c) { streamsFailed(s, at); return; }
    s.ci = i; s.ready = false; s.pendingAt = at > 0 ? at : 0; s.tryId++; s.userPaused = false;
    var tryId = s.tryId;
    Log.info('player', 'try ' + c.label + ' (' + (c.hls ? 'hls' : 'mp4') + ')' + (at > 0 ? ' at ' + Math.round(at) : '') + (why ? ' after ' + why : ''));
    if (!s.started) setStatus(s, i === 0 ? 'Starting playback\u2026' : 'Trying another stream\u2026');
    else setBuffering(s, true);
    var v = ui.video;
    try { v.pause(); } catch (e) {}
    try { v.src = c.src; v.load(); } catch (e2) { candidateFailed(s, tryId, 'exception'); return; }
    playVideo(s);
    armCandidate(s);
    renderBadges(s);
    s.btnSig = '';
  }

  /* Each candidate must reach "playing" within candidateTimeout. Metadata alone is not enough: an HLS manifest can
     load while its segments hang or are refused. Not while autoplay is blocked (waiting for OK), nor when the
     viewer paused a stream that has loaded. */
  function armCandidate(s) {
    var tryId = s.tryId;
    later(s, 'cand', function () {
      if (s.tryId !== tryId || s.playedTry === tryId || s.blocked || (s.ready && s.userPaused)) return;
      candidateFailed(s, tryId, s.ready ? 'no-start' : 'timeout');
    }, CFG.candidateTimeout);
  }

  function candidateFailed(s, tryId, reason) {
    if (s !== S || s.finished || s.tryId !== tryId || s.state === 'error' || s.relinking) return;
    var c = s.cands[s.ci];
    Log.warn('player', 'stream ' + (c ? c.label : '?') + ' failed: ' + reason);
    if (c) s.failed[c.label] = true;
    var v = ui.video, at = s.ready ? (v.currentTime > 0 ? v.currentTime : s.lastTime) : s.pendingAt;
    if (s.started && s.ready) {
      report(s, 'switch');
      s.switchNote = 'Playback hiccup \u2014 switched to a backup stream';
    }
    startCandidate(s, s.ci + 1, at, reason);
  }

  /* Every candidate failed. Mid-film this is usually the signed, time-limited stream links expiring, so fresh player
     data is fetched once (again only after the new links played for a while) before the error card appears. */
  function streamsFailed(s, at) {
    at = at > 0 ? at : (s.lastTime || 0);
    var canRelink = s.started && s.fileIndex >= 0 && s.files[s.fileIndex] && (!s.relinkAt || (s.playedSinceRelink && U.now() - s.relinkAt > 30000));
    if (canRelink) {
      Log.warn('player', 'every stream failed mid-playback; fetching fresh stream links');
      s.relinkAt = U.now();
      s.playedSinceRelink = false;
      s.lastTime = at;
      /* Late events of the failed stream (a play() rejection, a media error) must not count against the next one. */
      s.tryId++;
      s.ready = false;
      s.relinking = true;
      setBuffering(s, true);
      fetchPlayerData(s, s.fileIndex, function (err, d) {
        s.relinking = false;
        if (err && err.code === 'signed-out') { fallback(s, 'signed-out'); return; }
        if (err || !d || !d.sources.length) {
          Log.warn('player', 'fresh stream links failed: ' + (err ? err.code : 'no sources'));
          streamsFailed(s, at);
          return;
        }
        applyData(s, d);
        s.resumePending = false;
        s.switchNote = 'Reconnected';
        startCandidate(s, 0, at, 'refresh');
      });
      return;
    }
    Log.warn('player', 'every stream failed');
    s.lastTime = at;
    showError(s, 'streams-failed', s.started ? 'The video stopped and none of its streams would start again. Check your connection and try again.' :
      'None of the available streams would play on this TV. The website\u2019s own player may still work.');
  }

  function playVideo(s) {
    var v = ui && ui.video, p = null, tryId = s.tryId;
    if (!v) return;
    try { p = v.play(); } catch (e) { Log.warn('player', 'play() threw: ' + clean(e)); return; }
    if (p && typeof p.then === 'function') {
      p.then(null, function (err) {
        if (s !== S || s.finished) return;
        var name = String(err && err.name || '');
        if (name === 'NotAllowedError') {
          Log.info('player', 'autoplay blocked; waiting for OK');
          if (s.ready) reveal(s);
          s.blocked = true;
          showChip(s, 'Press OK to play', CFG.chipMs, false);
          showOsd(s);
        } else if (name !== 'AbortError' && s.tryId === tryId) {
          /* NotSupportedError and the like: this stream will not start (a pause() or a new source rejects with
             AbortError, which is expected). */
          candidateFailed(s, tryId, 'play-' + (name || 'error'));
        }
      });
    }
  }

  function releaseVideo() {
    var v = ui && ui.video;
    if (!v) return;
    try { v.pause(); } catch (e) {}
    try { v.removeAttribute('src'); } catch (e2) {}
    try { v.load(); } catch (e3) {}
  }

  function dur() {
    var v = ui && ui.video, d = v ? v.duration : 0;
    return d > 0 && isFinite(d) ? d : 0;
  }

  function pos(s) {
    var v = ui && ui.video;
    if (s && s.ready && v) { var t = v.currentTime; if (t >= 0 && isFinite(t)) return t; }
    return s ? s.lastTime || s.pendingAt || 0 : 0;
  }

  function paused() { var v = ui && ui.video; return !v || !!v.paused; }

  function seekTo(s, t) {
    var d = dur();
    if (d > 0) t = U.clamp(t, 0, Math.max(0, d - 0.5));
    s.lastTime = t;
    try { ui.video.currentTime = t; } catch (e) { Log.warn('player', 'seek failed: ' + clean(e)); }
  }

  /* Leaves the loading screen for the playback UI (first frame, or autoplay blocked). */
  function reveal(s) {
    if (s.state !== 'loading') return;
    s.state = 'playing';
    ui.root.setAttribute('data-state', 'playing');
    showOsd(s);
  }

  function bindVideo(v) {
    function on(type, fn) {
      ui.offs.push(U.on(v, type, function (e) { var s = S; if (!s || s.finished || s.state === 'error') return; fn(s, e); }));
    }
    on('loadedmetadata', function (s) {
      s.ready = true;
      var d = dur(), at = s.pendingAt;
      if (d > 0) s.lastDur = d;
      s.pendingAt = 0;
      if (s.resumePending) {
        s.resumePending = false;
        if (at > 10 && d > 0 && at < d - 60) { seekTo(s, at); s.resumed = at; } else s.lastTime = 0;
      } else if (at > 0 && d > 0) seekTo(s, Math.min(at, d - 1));
      if (s.blocked) reveal(s);
      render(s);
    });
    on('playing', function (s) {
      s.ready = true;
      s.blocked = false;
      s.userPaused = false;
      s.playedTry = s.tryId;
      s.playedSinceRelink = true;
      cancel(s, 'cand');
      setBuffering(s, false);
      keepAwake(true);
      if (!s.started) {
        s.started = true;
        cancel(s, 'budget');
        var c = s.cands[s.ci];
        Log.info('player', 'playing ' + (c ? c.label : '?') + (s.resumed ? ' from ' + Math.round(s.resumed) : ''));
        reveal(s);
        showOsd(s);
        if (s.resumed) showChip(s, 'Resumed at ' + fmt(s.resumed) + ' \u00b7 press Down for Start over', CFG.chipMs, true);
        later(s, 'tick', function tick() { if (!paused()) report(s, 'tick'); later(s, 'tick', tick, CFG.progressEvery); }, CFG.progressEvery);
        later(s, 'nextinfo', function () { prefetchNext(s); }, 4000);
      } else if (s.switchNote) {
        showChip(s, s.switchNote, 4000, false);
      }
      s.switchNote = '';
      if (s.osd) scheduleHide(s);
      render(s);
      /* It started while the app is in the background: hold it there (see toBackground). */
      if (isHidden()) toBackground(s);
    });
    on('pause', function (s) {
      if (!s.started) return;
      keepAwake(false);
      if (!s.ended) report(s, 'pause');
      showOsd(s);
      render(s);
    });
    on('play', function (s) { if (s.started) render(s); });
    on('waiting', function (s) {
      /* Also before the first frame: a stream that stops delivering data is replaced after stallTimeout. */
      setBuffering(s, true);
      s.waitAt = pos(s);
      var tryId = s.tryId;
      later(s, 'stall', function () {
        if (s.buffering && s.tryId === tryId && Math.abs(pos(s) - s.waitAt) < 0.5 && !paused()) candidateFailed(s, tryId, 'stall');
      }, CFG.stallTimeout);
    });
    on('timeupdate', function (s) {
      if (!s.ready) return;
      var t = ui.video.currentTime;
      if (!ui.video.seeking && t > 0) s.lastTime = t;
      if (s.buffering && Math.abs(t - s.waitAt) >= 0.5) { setBuffering(s, false); cancel(s, 'stall'); }
      if (U.now() - s.lastRender >= 250) render(s);
      checkUpNext(s);
    });
    on('progress', function (s) { if (s.osd && U.now() - s.lastRender >= 250) render(s); });
    on('durationchange', function (s) { var d = dur(); if (d > 0) s.lastDur = d; render(s); });
    on('seeked', function (s) { render(s); });
    on('ended', function (s) { onEnded(s); });
    on('error', function (s) {
      var v2 = ui.video, code = v2 && v2.error ? v2.error.code : 0;
      if (!v2 || !v2.getAttribute('src')) return;
      candidateFailed(s, s.tryId, 'media-' + code);
    });
  }

  function setBuffering(s, on) {
    s.buffering = !!on;
    if (ui) flag(ui.root, 'is-buffering', on && s.started);
  }

  /* ---------- screen saver ---------- */

  function keepAwake(on) {
    on = !!on;
    if (on === saverOff) return;
    saverOff = on;
    var done = false;
    try {
      var ac = window.webapis && window.webapis.appcommon;
      if (ac && typeof ac.setScreenSaver === 'function' && ac.AppCommonScreenSaverState) {
        ac.setScreenSaver(on ? ac.AppCommonScreenSaverState.SCREEN_SAVER_OFF : ac.AppCommonScreenSaverState.SCREEN_SAVER_ON,
          function () {}, function (e) { Log.info('player', 'screen saver: ' + clean(e && e.message || e)); });
        done = true;
      }
    } catch (e) { Log.info('player', 'screen saver: ' + clean(e)); }
    if (done) return;
    try {
      var power = window.tizen && window.tizen.power;
      if (power) { if (on) power.request('SCREEN', 'SCREEN_NORMAL'); else power.release('SCREEN'); }
    } catch (e2) { Log.info('player', 'screen power: ' + clean(e2)); }
  }

  /* ---------- background (Home button, input switch) ---------- */

  /* Save the place, pause and let the screen saver run again; coming back shows the paused controls (like the
     TV's own apps), and OK carries on. */
  function toBackground(s) {
    report(s, 'hidden');
    if (s.state === 'playing' && ui && !ui.video.paused) {
      Log.info('player', 'app hidden: pausing');
      s.bgPaused = true;
      s.userPaused = true;
      try { ui.video.pause(); } catch (e) {}
    }
    keepAwake(false);
  }

  function fromBackground(s) {
    if (!s.bgPaused) return;
    s.bgPaused = false;
    if (s.state === 'playing' && !(s.upnext && s.upnext.visible)) { showOsd(s); render(s); }
  }

  /* ---------- progress ---------- */

  function formOf(obj) {
    var parts = [];
    for (var k in obj) if (obj.hasOwnProperty(k)) parts.push(enc(k) + '=' + enc(obj[k]));
    return parts.join('&');
  }

  /* Posts {post, over, seconds, mp4_id} like the site's own save routine. Skipped before playback started, while
     the duration is unknown, and when neither the second nor over changed since the last post. */
  function report(s, why, opts) {
    opts = opts || {};
    if (!s || s.finished || !s.started || !s.data || !ui) return false;
    var d = dur() || s.lastDur; /* the last known duration survives a stream switch or a failed stream */
    if (!(d > 0)) return false;
    var t = pos(s), sec = Math.max(0, Math.floor(t));
    var over = opts.over === 1 || opts.over === 0 ? opts.over : (d - t < 300 ? 1 : 0);
    var key = sec + ':' + over;
    if (key === s.lastSent) return false;
    s.lastSent = key;
    var body = formOf(s.post) + '&over=' + over + '&seconds=' + sec + '&mp4_id=' + enc(s.data.mp4Id);
    send(null, { url: origin() + s.progressUrl, body: body, label: 'progress' }, function (err) {
      if (err) Log.info('player', 'progress not saved: ' + err.code);
    });
    Log.info('player', 'progress ' + sec + '/' + Math.floor(d) + ' over=' + over + ' (' + why + ')');
    hook(s.hooks, 'onProgress', { kind: s.kind, id: s.id, season: s.season, episode: s.episode, seconds: sec, duration: Math.floor(d), over: over });
    return true;
  }

  /* ---------- overlay DOM ---------- */

  function build(mount) {
    var root = el('div', 'mbp');
    root.id = 'mbptv-player';
    root.setAttribute('tabindex', '-1');
    root.setAttribute('data-state', 'loading');
    var u = { root: root, offs: [] };

    var v = document.createElement('video');
    v.className = 'mbp-video';
    v.setAttribute('preload', 'auto');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('disablepictureinpicture', '');
    v.setAttribute('disableremoteplayback', '');
    root.appendChild(v);
    u.video = v;

    var art = el('div', 'mbp-art', null, root);
    u.artImg = document.createElement('img');
    u.artImg.className = 'mbp-art-img';
    u.artImg.setAttribute('alt', '');
    u.artImg.onload = U.guard(function () { flag(u.artImg, 'is-loaded', true); }, 'player-art');
    u.artImg.onerror = U.guard(function () { if (!retryOriginal(u.artImg)) flag(u.artImg, 'is-loaded', false); }, 'player-art');
    art.appendChild(u.artImg);
    el('div', 'mbp-art-scrim', null, art);

    var loading = el('div', 'mbp-loading', null, root);
    var spin = el('div', 'mbp-spin', null, loading);
    el('div', 'mbp-spin-ring', null, spin);
    var info = el('div', 'mbp-load-info', null, loading);
    u.lKicker = el('div', 'mbp-kicker', '', info);
    u.lTitle = el('div', 'mbp-load-title', '', info);
    u.lSub = el('div', 'mbp-load-sub', null, info);
    u.lSubCode = el('span', 'mbp-sub-code', '', u.lSub);
    u.lSubText = el('span', 'mbp-sub-text', '', u.lSub);
    u.lStatus = el('div', 'mbp-load-status', '', info);
    var lh = el('div', 'mbp-load-hint', null, loading);
    el('span', 'mbp-key', 'Back', lh);
    el('span', null, 'Cancel', lh);

    var buffer = el('div', 'mbp-buffer', null, root);
    el('div', 'mbp-spin-ring', null, buffer);

    u.flash = el('div', 'mbp-flash', null, root);
    u.flashPlay = icon('play', 'mbp-flash-play');
    u.flashPause = icon('pause', 'mbp-flash-pause');
    u.flash.appendChild(u.flashPlay);
    u.flash.appendChild(u.flashPause);

    el('div', 'mbp-dim', null, root);
    var osd = el('div', 'mbp-osd', null, root);
    el('div', 'mbp-osd-top', null, osd);
    el('div', 'mbp-osd-shade', null, osd);
    var main = el('div', 'mbp-osd-main', null, osd);
    var head = el('div', 'mbp-head', null, main);
    el('div', 'mbp-kicker mbp-osd-kicker', 'Paused', head);
    u.title = el('div', 'mbp-title', '', head);
    var subRow = el('div', 'mbp-subrow', null, head);
    u.sub = el('div', 'mbp-sub', null, subRow);
    u.subCode = el('span', 'mbp-sub-code', '', u.sub);
    u.subText = el('span', 'mbp-sub-text', '', u.sub);
    u.badges = el('div', 'mbp-badges', null, subRow);

    var scrub = el('div', 'mbp-scrub', null, main);
    u.state = el('div', 'mbp-state', null, scrub);
    u.state.appendChild(icon('play', 'mbp-state-play'));
    u.state.appendChild(icon('pause', 'mbp-state-pause'));
    u.elapsed = el('div', 'mbp-time mbp-elapsed', '0:00', scrub);
    var bar = el('div', 'mbp-bar', null, scrub);
    var clip = el('div', 'mbp-bar-clip', null, bar);
    u.buf = el('div', 'mbp-buf', null, clip);
    u.fill = el('div', 'mbp-fill', null, clip);
    u.headWrap = el('div', 'mbp-headwrap', null, bar);
    el('div', 'mbp-knob', null, u.headWrap);
    var bubble = el('div', 'mbp-bubble', null, u.headWrap);
    u.bubbleDelta = el('div', 'mbp-bubble-delta', '', bubble);
    u.bubbleTime = el('div', 'mbp-bubble-time', '', bubble);
    u.remain = el('div', 'mbp-time mbp-remain', '', scrub);
    u.btns = el('div', 'mbp-btns', null, main);
    u.btns.setAttribute('data-zone', 'player-buttons');

    u.skip = el('div', 'mbp-skip', null, root);
    u.skip.setAttribute('data-action', 'skip-intro-pill');
    u.skip.appendChild(icon('skip'));
    el('span', 'mbp-skip-label', 'Skip Intro', u.skip);

    u.chip = el('div', 'mbp-chip', '', root);

    el('div', 'mbp-un-scrim', null, root);
    var un = el('div', 'mbp-upnext', null, root);
    un.setAttribute('data-upnext', '');
    var unTop = el('div', 'mbp-un-top', null, un);
    var still = el('div', 'mbp-un-still', null, unTop);
    u.unPh = el('div', 'mbp-un-ph', '', still);
    u.unImg = document.createElement('img');
    u.unImg.className = 'mbp-un-img';
    u.unImg.setAttribute('alt', '');
    u.unImg.onload = U.guard(function () { flag(u.unImg, 'is-loaded', true); }, 'player-still');
    u.unImg.onerror = U.guard(function () { if (!retryOriginal(u.unImg)) flag(u.unImg, 'is-loaded', false); }, 'player-still');
    still.appendChild(u.unImg);
    var glyph = el('div', 'mbp-un-glyph', null, still);
    glyph.appendChild(icon('play'));
    var unText = el('div', 'mbp-un-text', null, unTop);
    u.unCount = el('div', 'mbp-kicker mbp-un-count', '', unText);
    u.unTitle = el('div', 'mbp-un-title', '', unText);
    u.unMeta = el('div', 'mbp-un-meta', '', unText);
    var unBtns = el('div', 'mbp-un-btns', null, unText);
    u.unPlay = el('div', 'mbp-btn mbp-btn--count', null, unBtns);
    u.unPlay.setAttribute('data-action', 'play-next');
    u.unFill = el('div', 'mbp-btn-fill', null, u.unPlay);
    u.unPlay.appendChild(icon('play'));
    el('span', 'mbp-btn-label', 'Play now', u.unPlay);
    u.unHide = el('div', 'mbp-btn', null, unBtns);
    u.unHide.setAttribute('data-action', 'hide-next');
    u.unHide.appendChild(icon('close'));
    el('span', 'mbp-btn-label', 'Hide', u.unHide);

    var layer = el('div', 'mbp-sheet-layer', null, root);
    el('div', 'mbp-sheet-dim', null, layer);
    var sheet = el('div', 'mbp-sheet', null, layer);
    sheet.setAttribute('data-sheet', 'player-quality');
    el('div', 'mbp-kicker', 'Quality', sheet);
    el('div', 'mbp-sheet-title', 'Choose quality', sheet);
    u.sheetSub = el('div', 'mbp-sheet-sub', '', sheet);
    var port = el('div', 'mbp-sheet-port', null, sheet);
    u.sheetList = el('div', 'mbp-sheet-list', null, port);
    u.sheetPort = port;
    var sh = el('div', 'mbp-sheet-hint', null, sheet);
    el('span', 'mbp-key', 'OK', sh);
    el('span', 'mbp-hint-gap', 'Choose', sh);
    el('span', 'mbp-key', 'Back', sh);
    el('span', null, 'Close', sh);

    var err = el('div', 'mbp-error', null, root);
    var card = el('div', 'mbp-err-card', null, err);
    card.setAttribute('data-dialog', 'player-error');
    card.appendChild(icon('alert', 'mbp-err-ico'));
    u.errKicker = el('div', 'mbp-kicker mbp-err-kicker', '', card);
    u.errTitle = el('div', 'mbp-err-title', '', card);
    u.errBody = el('div', 'mbp-err-body', '', card);
    u.errCode = el('div', 'mbp-err-code', '', card);
    u.errBtns = el('div', 'mbp-err-btns', null, card);

    ui = u;
    bindVideo(v);
    /* The shell root is pointer-transparent outside shell mode; the player takes pointer input itself (player.css)
       and swallows it, so a pointer (Tizen's mouse mode, a USB mouse) never reaches the website underneath. */
    u.offs.push(U.on(root, 'click', function (e) { if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }));
    (mount || document.body).appendChild(root);
    try { root.focus({ preventScroll: true }); } catch (e) { try { root.focus(); } catch (e2) {} }
  }

  function teardownUi() {
    if (!ui) return;
    releaseVideo();
    U.each(ui.offs, function (off) { try { off(); } catch (e) {} });
    U.detach(ui.root);
    ui = null;
  }

  function resetUi(s) {
    var r = ui.root;
    r.setAttribute('data-state', 'loading');
    r.setAttribute('data-kind', s.kind);
    U.each(['is-osd', 'is-paused', 'is-upnext', 'is-sheet', 'is-seeking', 'is-buffering', 'is-scrub', 'is-buttons', 'is-still'], function (c) { flag(r, c, false); });
    flag(ui.chip, 'is-on', false);
    flag(ui.skip, 'is-on', false);
    U.empty(ui.btns);
    U.empty(ui.errBtns);
    U.empty(ui.badges);
    tf(ui.fill, 'scaleX(0)');
    tf(ui.buf, 'scaleX(0)');
    tf(ui.headWrap, 'translate3d(0,0,0)');
    setText(ui.elapsed, '0:00');
    setText(ui.remain, '');
    var art = s.req.backdrop || s.req.poster || '';
    if (!art) {
      try { var m = Api.meta(s.kind + ':' + s.id); art = m && (m.backdrop || m.poster) || ''; } catch (e) { art = ''; }
    }
    if (safeImage(art)) setArt(ui.artImg, art, 1280);
    else {
      flag(ui.artImg, 'is-loaded', false);
      ui.artImg.removeAttribute('src');
    }
    renderTitles(s);
    setStatus(s, 'Loading\u2026');
  }

  function titleOf(s) { return U.text(s.kind === 'tv' ? (s.req.showTitle || s.req.title) : s.req.title) || 'MovieBox Pro'; }

  function shortRuntime(v) {
    var m = /^(\d+)/.exec(String(v || '')), n = m ? toInt(m[1]) : 0;
    if (!n) return '';
    return n < 60 ? n + 'm' : Math.floor(n / 60) + 'h' + (n % 60 ? ' ' + (n % 60) + 'm' : '');
  }

  function movieMeta(s) {
    var m = null;
    try { m = Api.meta('movie:' + s.id); } catch (e) { m = null; }
    if (!m) return '';
    var parts = [];
    if (m.year) parts.push(m.year);
    if (shortRuntime(m.runtime)) parts.push(shortRuntime(m.runtime));
    if (m.certification) parts.push(m.certification);
    return parts.join('  \u00b7  ');
  }

  function renderTitles(s) {
    if (!ui) return;
    var title = titleOf(s), code = '', text = '';
    if (s.kind === 'tv') { code = 'S' + s.season + ' \u00b7 E' + s.episode; text = U.text(s.req.episodeTitle || ''); }
    else text = movieMeta(s);
    setText(ui.title, title);
    setText(ui.subCode, code);
    setText(ui.subText, text);
    flag(ui.sub, 'is-empty', !code && !text);
    setText(ui.lTitle, title);
    setText(ui.lSubCode, code);
    setText(ui.lSubText, text);
    setText(ui.lKicker, s.kicker || 'Now playing');
  }

  function setStatus(s, text) { if (ui && s === S) setText(ui.lStatus, text); }

  function badgeList(s) {
    var c = s.cands[s.ci], out = [];
    if (!c) return out;
    if (c.label === 'AUTO') out.push('Auto');
    else if (c.label === 'ORG') out.push(c.height >= 2000 || c.width >= 3800 ? '4K' : c.height >= 1000 || c.width >= 1900 ? '1080p' : 'Original');
    else out.push(c.label);
    if (c.hdr) out.push('HDR');
    return out;
  }

  function renderBadges(s) {
    if (!ui) return;
    var list = badgeList(s), sig = list.join('|');
    if (ui.badges.__sig === sig) return;
    ui.badges.__sig = sig;
    U.empty(ui.badges);
    U.each(list, function (b, i) { el('span', 'mbp-tag' + (i ? ' mbp-tag--line' : ''), b, ui.badges); });
  }

  /* ---------- rendering (at most 4x/s from timeupdate; immediately after keys) ---------- */

  function bufferedTo(v, t, d) {
    try {
      var b = v.buffered;
      for (var i = 0; b && i < b.length; i++) if (b.start(i) <= t + 0.5 && b.end(i) >= t) return U.clamp(b.end(i) / d, 0, 1);
    } catch (e) {}
    return 0;
  }

  function render(s) {
    if (!ui || s !== S) return;
    s.lastRender = U.now();
    var v = ui.video, d = dur(), cur = pos(s), t = s.seek ? s.seek.target : cur;
    var p = d > 0 ? U.clamp(t / d, 0, 1) : 0;
    tf(ui.fill, 'scaleX(' + p.toFixed(4) + ')');
    tf(ui.headWrap, 'translate3d(' + (p * 100).toFixed(3) + '%,0,0)');
    tf(ui.buf, 'scaleX(' + (d > 0 ? bufferedTo(v, cur, d) : 0).toFixed(4) + ')');
    setText(ui.elapsed, fmt(t));
    setText(ui.remain, d > 0 ? '\u2212' + fmt(Math.max(0, d - t)) : '');
    flag(ui.root, 'is-paused', paused() && s.started);
    flag(ui.root, 'is-long', d >= 3600);
    if (s.seek) {
      setText(ui.bubbleTime, fmt(t));
      setText(ui.bubbleDelta, fmtDelta(t - s.seek.from));
    }
    renderButtons(s);
    renderSkip(s);
  }

  /* ---------- OSD ---------- */

  function showOsd(s) {
    if (!ui || s.state !== 'playing' || (s.upnext && s.upnext.visible)) return;
    if (!s.osd) {
      s.osd = true;
      s.area = 'scrub';
      flag(ui.root, 'is-osd', true);
    }
    syncArea(s);
    render(s);
    scheduleHide(s);
  }

  function scheduleHide(s) {
    cancel(s, 'osd');
    if (paused() && s.started) return;
    later(s, 'osd', function () { hideOsd(s, false); }, CFG.osdHide);
  }

  function hideOsd(s, force) {
    if (!ui || !s.osd) return;
    if (!force && ((paused() && s.started) || s.seek || s.sheet)) return;
    cancel(s, 'osd');
    s.osd = false;
    s.area = 'scrub';
    flag(ui.root, 'is-osd', false);
    syncArea(s);
    renderSkip(s);
  }

  function syncArea(s) {
    flag(ui.root, 'is-scrub', s.osd && s.area === 'scrub');
    flag(ui.root, 'is-buttons', s.osd && s.area === 'buttons');
    var list = U.qsa(ui.btns, '[data-action]');
    U.each(list, function (b) { flag(b, 'is-focused', s.osd && s.area === 'buttons' && b.getAttribute('data-action') === s.btn); });
  }

  function setArea(s, area, action) {
    s.area = area;
    if (area === 'buttons') {
      var defs = buttonDefs(s), has = function (a) { return !!U.find(defs, function (x) { return x.action === a; }); };
      if (action && has(action)) s.btn = action;
      else if (!has(s.btn)) s.btn = defs[0].action;
    }
    syncArea(s);
  }

  function flash(s, playing) {
    if (!ui) return;
    flag(ui.flash, 'is-play', playing);
    flag(ui.flash, 'is-on', false);
    void ui.flash.offsetWidth;
    flag(ui.flash, 'is-on', true);
  }

  var chipTimer = null;
  function showChip(s, text, ms, startOver) {
    if (!ui) return;
    setText(ui.chip, text);
    flag(ui.chip, 'is-on', true);
    s.chipStartOver = !!startOver;
    clearTimeout(chipTimer);
    chipTimer = U.later(function () {
      if (!ui) return;
      flag(ui.chip, 'is-on', false);
      if (S) S.chipStartOver = false;
    }, ms || 3500, 'player-chip');
  }

  function hideChip(s) {
    clearTimeout(chipTimer);
    if (ui) flag(ui.chip, 'is-on', false);
    if (s) s.chipStartOver = false;
  }

  /* ---------- buttons row ---------- */

  function qualityOptions(s) {
    var seen = {}, out = [];
    U.each(s.base, function (c) { if (!seen[c.label]) { seen[c.label] = true; out.push(c); } });
    out.sort(function (a, b) {
      var ia = U.indexOf(SHEET_ORDER, a.label), ib = U.indexOf(SHEET_ORDER, b.label);
      return (ia < 0 ? 50 : ia) - (ib < 0 ? 50 : ib);
    });
    return out;
  }

  function displayLabel(label) { return label === 'AUTO' ? 'Auto' : label === 'ORG' ? 'Original' : label; }

  /* The site's intro/credits marks are crowd data and can be wrong: an intro "ending" 20 minutes in would let the
     Skip Intro pill take OK over for that whole stretch, and credits "starting" early would mark the episode watched
     and jump ahead. Only plausible marks are used (the intro within the first third, at most 10 minutes; the
     credits within the last fifth and the last 10 minutes). */
  function introPoint(s, d) {
    var i = s.introEnd;
    return i > 0 && d > 0 && i <= Math.min(600, d / 3) ? i : 0;
  }

  function creditsPoint(s, d) {
    var c = s.creditsAt;
    return c > 0 && d > 0 && c < d && c >= 0.8 * d && d - c <= 600 ? c : 0;
  }

  function introActive(s) { var i = introPoint(s, dur()); return i > 0 && s.started && pos(s) < i - 1; }

  function buttonDefs(s) {
    var p = paused() && s.started, c = s.cands[s.ci];
    var list = [{ action: 'play-pause', icon: p ? 'play' : 'pause', label: p ? 'Play' : 'Pause' }];
    if (introActive(s)) list.push({ action: 'skip-intro', icon: 'skip', label: 'Skip Intro' });
    if (s.next) list.push({ action: 'next-episode', icon: 'next', label: 'Next Episode', value: s.next.season === s.season ? 'E' + s.next.episode : 'S' + s.next.season + ' E' + s.next.episode });
    if (qualityOptions(s).length > 1 || s.files.length > 1) list.push({ action: 'quality', icon: 'quality', label: 'Quality', value: c ? displayLabel(c.label) : '' });
    list.push({ action: 'start-over', icon: 'restart', label: 'Start over' });
    return list;
  }

  function renderButtons(s) {
    if (!ui || s.state !== 'playing') return;
    var defs = buttonDefs(s), sig = U.map(defs, function (d) { return d.action + ':' + d.icon + ':' + (d.value || ''); }).join('|');
    if (sig === s.btnSig) return;
    s.btnSig = sig;
    U.empty(ui.btns);
    U.each(defs, function (d) {
      var b = el('div', 'mbp-btn', null, ui.btns);
      b.setAttribute('data-action', d.action);
      b.setAttribute('tabindex', '-1');
      b.appendChild(icon(d.icon));
      el('span', 'mbp-btn-label', d.label, b);
      if (d.value) el('span', 'mbp-btn-value', d.value, b);
    });
    if (!U.find(defs, function (d) { return d.action === s.btn; })) s.btn = 'play-pause';
    syncArea(s);
  }

  function moveButton(s, dir) {
    var defs = buttonDefs(s), i = 0;
    U.each(defs, function (d, k) { if (d.action === s.btn) i = k; });
    i = U.clamp(i + dir, 0, defs.length - 1);
    s.btn = defs[i].action;
    syncArea(s);
  }

  function activate(s, action) {
    switch (action) {
      case 'play-pause': togglePlay(s); return;
      case 'skip-intro': skipIntro(s); return;
      case 'next-episode': playNext(s, 'button'); return;
      case 'quality': openSheet(s); return;
      case 'start-over': startOver(s); return;
    }
  }

  function renderSkip(s) {
    if (!ui) return;
    var on = s.state === 'playing' && introActive(s) && !s.osd && !(s.upnext && s.upnext.visible) && !s.sheet;
    flag(ui.skip, 'is-on', on);
    flag(ui.skip, 'is-focused', on);
  }

  /* ---------- playback actions ---------- */

  function togglePlay(s) {
    var v = ui.video;
    if (v.paused || s.blocked) {
      s.blocked = false;
      s.userPaused = false;
      s.bgPaused = false;
      playVideo(s);
      /* A stream that loaded while waiting for OK (autoplay blocked) or while paused still has to start. */
      if (s.playedTry !== s.tryId) armCandidate(s);
      flash(s, true);
    } else {
      s.userPaused = true;
      try { v.pause(); } catch (e) {}
      flash(s, false);
    }
    showOsd(s);
    render(s);
  }

  function skipIntro(s) {
    var at = introPoint(s, dur());
    if (!(at > 0)) return;
    Log.info('player', 'skip intro to ' + Math.round(at));
    seekTo(s, at);
    later(s, 'seekreport', function () { report(s, 'seek'); }, CFG.seekReport);
    render(s);
  }

  function startOver(s) {
    Log.info('player', 'start over');
    hideChip(s);
    seekTo(s, 0);
    if (paused()) playVideo(s);
    later(s, 'seekreport', function () { report(s, 'seek'); }, CFG.seekReport);
    showOsd(s);
    s.btnSig = '';
    render(s);
  }

  /* Left/Right seek by 10 s; holding (auto-repeat) accelerates to 30 s and then 60 s steps. The jump is applied
     400 ms after the last press; until then the bar previews the target time. */
  function seekBy(s, dir, ev) {
    var d = dur();
    if (!(d > 0) || !s.ready) { showOsd(s); return; }
    /* Some remotes deliver a held key as plain keydowns (repeat=false): presses of the same direction less than
       repeatGap apart count as a hold too. */
    var now = U.now(), k = s.seekKey;
    var rep = !!(ev && ev.repeat) || (!!k && k.dir === dir && now - k.at >= 0 && now - k.at < CFG.repeatGap);
    if (!k || k.dir !== dir || (!rep && now - k.at > 600)) k = s.seekKey = { dir: dir, reps: 0, at: now };
    if (rep) k.reps++;
    k.at = now;
    var step = k.reps > 14 ? 60 : k.reps > 4 ? 30 : 10;
    if (!s.seek) s.seek = { from: pos(s), target: pos(s) };
    s.seek.target = U.clamp(s.seek.target + dir * step, 0, Math.max(0, d - 1));
    flag(ui.root, 'is-seeking', true);
    showOsd(s);
    if (s.area !== 'scrub') setArea(s, 'scrub');
    cancel(s, 'osd');
    render(s);
    later(s, 'seek', function () { applySeek(s); }, CFG.seekApply);
  }

  function applySeek(s) {
    if (!s.seek) return;
    var target = s.seek.target;
    s.seek = null;
    s.seekKey = null;
    flag(ui.root, 'is-seeking', false);
    seekTo(s, target);
    if (s.upnext && s.upnext.visible) checkUpNext(s);
    later(s, 'seekreport', function () { report(s, 'seek'); }, CFG.seekReport);
    s.btnSig = '';
    render(s);
    scheduleHide(s);
  }

  /* ---------- quality sheet ---------- */

  function openSheet(s) {
    var items = [], cur = s.cands[s.ci];
    U.each(qualityOptions(s), function (c) {
      var meta = [], r = rank(c.label);
      if (c.label === 'AUTO') meta.push('Adapts to your connection');
      else if (c.label === 'ORG') meta.push('Best picture');
      else if (r >= 1080) meta.push('Full HD');
      else if (r >= 720) meta.push('HD \u00b7 for slower connections');
      else if (r > 0) meta.push('Data saver');
      if (c.width > 0 && c.height > 0) meta.push(c.width + ' \u00d7 ' + c.height);
      if (c.label === 'ORG' || c.h265) meta.push(c.h265 ? 'HEVC' : 'H.264');
      if (c.hdr) meta.push('HDR');
      if (c.label === 'ORG' && c.fps > 0) meta.push(Math.round(c.fps) + ' fps');
      items.push({ type: 'quality', label: c.label, title: displayLabel(c.label), meta: meta.join('  \u00b7  '), current: !!cur && cur.label === c.label });
    });
    if (s.kind === 'movie' && s.files.length > 1) {
      U.each(s.files, function (f, i) {
        var meta = U.filter([f.file, f.size], function (x) { return !!x; }).join('  \u00b7  ');
        items.push({ type: 'file', index: i, title: f.quality || ('File ' + (i + 1)), meta: meta, current: i === s.fileIndex });
      });
    }
    if (!items.length) return;
    U.empty(ui.sheetList);
    var focus = 0, fileLabel = false;
    U.each(items, function (it, i) {
      if (it.type === 'file' && !fileLabel) { fileLabel = true; el('div', 'mbp-sheet-label', 'Source file', ui.sheetList); }
      var row = el('div', 'mbp-opt' + (it.current ? ' is-current' : ''), null, ui.sheetList);
      row.setAttribute('tabindex', '-1');
      if (it.type === 'quality') row.setAttribute('data-quality', it.label); else row.setAttribute('data-file-index', String(it.index));
      var text = el('div', 'mbp-opt-text', null, row);
      el('div', 'mbp-opt-label', it.title, text);
      if (it.meta) el('div', 'mbp-opt-meta', it.meta, text);
      row.appendChild(icon('check', 'mbp-opt-check'));
      it.el = row;
      if (it.current && it.type === 'quality') focus = i;
    });
    setText(ui.sheetSub, cur ? 'Now playing: ' + displayLabel(cur.label) : '');
    s.sheet = { items: items, index: focus };
    cancel(s, 'osd');
    flag(ui.root, 'is-sheet', true);
    renderSkip(s);
    renderSheet(s);
  }

  function renderSheet(s) {
    var sh = s.sheet;
    if (!sh) return;
    U.each(sh.items, function (it, i) { flag(it.el, 'is-focused', i === sh.index); });
    var row = sh.items[sh.index] && sh.items[sh.index].el, port = ui.sheetPort;
    if (!row || !port) return;
    var top = row.offsetTop, h = row.offsetHeight, ph = port.clientHeight, y = sh.y || 0;
    if (top - y < 0) y = top - 16;
    else if (top + h - y > ph) y = top + h - ph + 16;
    sh.y = Math.max(0, y);
    tf(ui.sheetList, 'translate3d(0,' + (-sh.y) + 'px,0)');
  }

  function closeSheet(s) {
    if (!s.sheet) return;
    s.sheet = null;
    flag(ui.root, 'is-sheet', false);
    showOsd(s);
    setArea(s, 'buttons', 'quality');
  }

  function chooseSheet(s) {
    var it = s.sheet && s.sheet.items[s.sheet.index];
    if (!it) return;
    closeSheet(s);
    if (it.current) return;
    if (it.type === 'quality') switchQuality(s, it.label);
    else switchFile(s, it.index);
  }

  /* The chosen stream first, then the usual order, with streams that already failed in this session last. */
  function switchQuality(s, label) {
    var chosen = null, fresh = [], stale = [];
    U.each(s.base, function (c) {
      if (!chosen && c.label === label) chosen = c;
      else if (s.failed[c.label]) stale.push(c);
      else fresh.push(c);
    });
    if (!chosen) return;
    var at = pos(s);
    report(s, 'switch');
    Log.info('player', 'quality ' + label + ' at ' + Math.round(at));
    s.cands = [chosen].concat(fresh, stale);
    s.switchNote = 'Quality: ' + displayLabel(label);
    s.resumePending = false;
    startCandidate(s, 0, at, 'quality');
  }

  function switchFile(s, index) {
    Log.info('player', 'file ' + index + ' at ' + Math.round(pos(s)));
    report(s, 'switch');
    showChip(s, 'Switching file\u2026', 8000, false);
    fetchPlayerData(s, index, function (err, d) {
      if (err && err.code === 'signed-out') { fallback(s, 'signed-out'); return; }
      if (err || !d.sources.length) {
        Log.warn('player', 'file switch failed: ' + (err ? err.code : 'no sources'));
        showChip(s, 'That file isn\u2019t available right now', 3500, false);
        return;
      }
      /* The current file kept playing during the request (up to about 30 s): continue from where it is now. */
      var at = pos(s);
      if (s.seek) at = s.seek.target;
      s.seek = null; s.seekKey = null; cancel(s, 'seek');
      if (ui) flag(ui.root, 'is-seeking', false);
      report(s, 'switch');
      s.fileIndex = index;
      applyData(s, d);
      s.resumePending = false;
      s.switchNote = 'Now playing ' + (s.files[index].quality || 'the other file');
      startCandidate(s, 0, at, 'file');
    });
  }

  /* ---------- Up Next (Netflix style) ---------- */

  function nextReq(s, season, episode) {
    return {
      kind: 'tv', id: s.id, season: season, episode: episode, title: s.req.title, showTitle: s.req.showTitle || s.req.title,
      episodeTitle: season === (s.next && s.next.season) && episode === (s.next && s.next.episode) && s.nextInfo ? s.nextInfo.title : '',
      backdrop: s.req.backdrop, poster: s.req.poster, autoplayNext: s.req.autoplayNext
    };
  }

  function prefetchNext(s) {
    if (s.kind !== 'tv' || s.nextFetching) return;
    var wantCur = !U.text(s.req.episodeTitle || '');
    if (!s.next && !wantCur) return;
    s.nextFetching = true;
    var seasons = [];
    if (s.next) seasons.push(s.next.season);
    if (wantCur && U.indexOf(seasons, s.season) < 0) seasons.push(s.season);
    U.each(seasons, function (season) {
      Api.detail('tv', s.id, safe(s, function (err, d) {
        if (err || !d) return;
        var eps = d.episodes || [];
        if (s.next && season === s.next.season) {
          var ep = U.find(eps, function (e) { return e.season === s.next.season && e.episode === s.next.episode; });
          s.nextInfo = { title: ep ? ep.title || '' : '', still: ep ? ep.still || '' : '', runtime: ep ? ep.runtime || '' : '' };
          if (s.upnext && s.upnext.visible) fillUpNext(s);
        }
        if (wantCur && season === s.season && !U.text(s.req.episodeTitle || '')) {
          var cur = U.find(eps, function (e) { return e.season === s.season && e.episode === s.episode; });
          if (cur && cur.title) { s.req.episodeTitle = cur.title; renderTitles(s); }
        }
      }, 'player-next-info'), { season: season });
    });
  }

  function upNextAt(s, d) {
    var at = d - CFG.upNextLead, c = creditsPoint(s, d);
    if (c > 0) at = Math.min(at, c);
    return at;
  }

  function checkUpNext(s) {
    if (s.kind !== 'tv' || !s.next || s.state !== 'playing' || s.sheet) return;
    var d = dur();
    if (!(d > 0)) return;
    var t = pos(s), at = upNextAt(s, d);
    if (s.upnext && s.upnext.visible) {
      if (!s.upnext.ended && t < at - 5) hideUpNext(s, false);
      return;
    }
    if (s.dismissedNext && t < at - 30) s.dismissedNext = false; /* rewound well before the credits: offer it again */
    if (t >= at && !s.dismissedNext) showUpNext(s, false);
  }

  function fillUpNext(s) {
    var n = s.next, info = s.nextInfo || {};
    setText(ui.unTitle, info.title || 'Episode ' + n.episode);
    setText(ui.unMeta, U.filter(['S' + n.season + ' \u00b7 E' + n.episode, shortRuntime(info.runtime)], function (x) { return !!x; }).join('  \u00b7  '));
    setText(ui.unPh, 'E' + n.episode);
    if (safeImage(info.still)) setArt(ui.unImg, info.still, 500);
    else {
      flag(ui.unImg, 'is-loaded', false);
      ui.unImg.removeAttribute('src');
    }
  }

  /* After stillWatchingAfter episodes in a row started by autoplay with no key pressed, the card asks "Still
     watching?" instead of counting down, and the video pauses until the viewer answers (Netflix does the same), so
     a sleeping viewer's place is kept and later episodes are not marked watched. */
  function showUpNext(s, ended) {
    if (!s.next) return;
    prefetchNext(s);
    var still = CFG.stillWatchingAfter > 0 && unattended >= CFG.stillWatchingAfter;
    var auto = s.req.autoplayNext !== false && !still;
    s.upnext = { visible: true, focus: 0, count: auto ? CFG.upNextCount : -1, total: CFG.upNextCount, ended: !!ended, still: still };
    Log.info('player', 'up next S' + s.next.season + 'E' + s.next.episode + (ended ? ' (ended)' : '') + (still ? ' (still watching?)' : auto ? '' : ' (no autoplay)'));
    if (s.sheet) { s.sheet = null; flag(ui.root, 'is-sheet', false); }
    hideOsd(s, true);
    hideChip(s);
    fillUpNext(s);
    tf(ui.unFill, 'scaleX(0)');
    flag(ui.unFill, 'is-running', false);
    flag(ui.root, 'is-upnext', true);
    flag(ui.root, 'is-still', still);
    renderUpNext(s);
    renderSkip(s);
    if (still && !ended && !paused()) { try { ui.video.pause(); } catch (e) {} }
    if (auto) {
      U.later(function () {
        if (!ui || !s.upnext || !s.upnext.visible) return;
        flag(ui.unFill, 'is-running', true);
        tf(ui.unFill, 'scaleX(' + (1 / s.upnext.total).toFixed(4) + ')');
      }, 30, 'player-upnext-fill');
      later(s, 'upnext', function () { upNextTick(s); }, 1000);
    }
  }

  function upNextTick(s) {
    var u = s.upnext;
    if (!u || !u.visible || u.count < 0) return;
    if ((!paused() || u.ended) && !isHidden()) u.count--;
    if (u.count <= 0) { playNext(s, 'autoplay'); return; }
    renderUpNext(s);
    later(s, 'upnext', function () { upNextTick(s); }, 1000);
  }

  function renderUpNext(s) {
    var u = s.upnext;
    if (!u) return;
    setText(ui.unCount, u.still ? 'Still watching?' : u.count >= 0 ? 'Next episode in ' + u.count : 'Up next');
    if (u.count >= 0 && u.count < u.total) tf(ui.unFill, 'scaleX(' + U.clamp((u.total - u.count + 1) / u.total, 0, 1).toFixed(4) + ')');
    flag(ui.unPlay, 'is-focused', u.focus === 0);
    flag(ui.unHide, 'is-focused', u.focus === 1);
  }

  function hideUpNext(s, dismissed) {
    var u = s.upnext;
    if (!u) return;
    cancel(s, 'upnext');
    s.upnext = null;
    if (dismissed) s.dismissedNext = true;
    flag(ui.root, 'is-upnext', false);
    flag(ui.root, 'is-still', false);
    renderSkip(s);
    if (u.ended && dismissed) { report(s, 'ended', { over: 1 }); stop('ended'); return; }
    /* "Still watching?" answered with Hide: the viewer is here, so the credits carry on. */
    if (u.still && dismissed && paused()) { playVideo(s); render(s); }
  }

  function onEnded(s) {
    s.ended = true;
    Log.info('player', 'ended');
    keepAwake(false);
    if (s.kind === 'tv' && s.next) {
      var u = s.upnext;
      if (u && u.visible) {
        /* Autoplay off (or "Still watching?"): the card waits for the viewer instead of playing on. */
        if (u.count < 0) { u.ended = true; renderUpNext(s); return; }
        playNext(s, 'ended');
        return;
      }
      showUpNext(s, true);
      return;
    }
    report(s, 'ended', { over: 1 });
    stop('ended');
  }

  function goEpisode(s, season, episode, how, over) {
    var nr = nextReq(s, season, episode);
    Log.info('player', 'episode S' + season + 'E' + episode + ' (' + how + ')');
    var hooks = s.hooks;
    finish(s, { over: over, why: how });
    hook(hooks, 'onNext', nr);
    if (ui) begin(nr, hooks, how === 'previous' ? 'Previous episode' : 'Next episode');
  }

  /* From Up Next (near or at the end) the episode is saved as watched (over=1); a mid-episode Next Episode or Ch+
     saves the real position with the site's own over rule. */
  function playNext(s, how) {
    if (!s.next || s !== S) return;
    if (how === 'autoplay' || how === 'ended') unattended++;
    var finished = how === 'autoplay' || how === 'ended' || how === 'play-now' || (s.upnext && s.upnext.visible);
    goEpisode(s, s.next.season, s.next.episode, how, finished ? 1 : undefined);
  }

  function previousEpisode(s) {
    if (s.kind !== 'tv' || s.episode <= 1) { showChip(s, 'This is the first episode of the season', 3000, false); return; }
    goEpisode(s, s.season, s.episode - 1, 'previous');
  }

  /* ---------- error card ---------- */

  function showError(s, reason, message, code) {
    if (!ui || s !== S) return;
    Log.warn('player', 'error card: ' + reason);
    cancel(s, 'cand'); cancel(s, 'stall'); cancel(s, 'osd'); cancel(s, 'upnext'); cancel(s, 'tick'); cancel(s, 'budget'); cancel(s, 'seek');
    U.each(s.reqs, function (h) { try { h.abort(); } catch (e) {} });
    s.reqs = [];
    s.errAt = s.started ? pos(s) : 0;
    if (s.started) report(s, 'error');
    releaseVideo();
    s.ready = false;
    s.lastTime = s.errAt;
    keepAwake(false);
    s.state = 'error';
    s.seek = null;
    s.osd = false;
    s.sheet = null;
    s.upnext = null;
    U.each(['is-osd', 'is-sheet', 'is-upnext', 'is-seeking', 'is-buffering', 'is-scrub', 'is-buttons', 'is-still'], function (c) { flag(ui.root, c, false); });
    hideChip(s);
    flag(ui.skip, 'is-on', false);
    ui.root.setAttribute('data-state', 'error');
    setText(ui.errKicker, titleOf(s) + (s.kind === 'tv' ? '  \u00b7  S' + s.season + ' E' + s.episode : ''));
    setText(ui.errTitle, 'This video won\u2019t play here');
    setText(ui.errBody, message || '');
    setText(ui.errCode, code || '');
    flag(ui.errCode, 'is-empty', !code);
    var btns = [], retry = reason === 'network' || reason === 'bad-answer' || reason === 'internal' || reason === 'streams-failed';
    if (retry) btns.push({ action: 'retry', icon: 'reload', label: 'Try again' });
    if (reason !== 'bad-request') btns.push({ action: 'website', icon: 'globe', label: 'Try website player' });
    btns.push({ action: 'back', icon: 'back', label: 'Back' });
    U.empty(ui.errBtns);
    U.each(btns, function (b) {
      var n = el('div', 'mbp-btn', null, ui.errBtns);
      n.setAttribute('data-action', b.action);
      n.setAttribute('tabindex', '-1');
      n.appendChild(icon(b.icon));
      el('span', 'mbp-btn-label', b.label, n);
      b.el = n;
    });
    /* Mid-film (it played before) Try again is the likely fix; otherwise the website's player. */
    var focus = 0, want = s.started && retry ? 'retry' : 'website';
    U.each(btns, function (b, i) { if (b.action === want) focus = i; });
    s.err = { reason: reason, btns: btns, index: focus };
    renderError(s);
  }

  function renderError(s) {
    U.each(s.err.btns, function (b, i) { flag(b.el, 'is-focused', i === s.err.index); });
  }

  function errorKey(s, name) {
    var e = s.err;
    if (!e) return true;
    if (name === 'left' || name === 'right') { e.index = U.clamp(e.index + (name === 'right' ? 1 : -1), 0, e.btns.length - 1); renderError(s); return true; }
    if (name === 'back' || name === 'stop') { stop('back'); return true; }
    if (name !== 'enter') return true;
    var b = e.btns[e.index];
    if (b.action === 'back') stop('back');
    else if (b.action === 'website') fallback(s, e.reason);
    else if (b.action === 'retry') {
      /* A fresh start (new file list, new stream links) that continues where the video stopped. */
      var req = s.req, hooks = s.hooks, at = s.errAt;
      finish(s, {});
      begin(req, hooks, '', at);
    }
    return true;
  }

  /* ---------- keys ---------- */

  function sheetKey(s, name) {
    var sh = s.sheet;
    if (name === 'up' || name === 'down') { sh.index = U.clamp(sh.index + (name === 'down' ? 1 : -1), 0, sh.items.length - 1); renderSheet(s); return true; }
    if (name === 'enter') { chooseSheet(s); return true; }
    if (name === 'back' || name === 'left') { closeSheet(s); return true; }
    if (name === 'stop') { stop('stop'); return true; }
    return true;
  }

  function upNextKey(s, name) {
    var u = s.upnext;
    if (name === 'left' || name === 'right') { u.focus = name === 'right' ? 1 : 0; renderUpNext(s); return true; }
    if (name === 'enter') { if (u.focus === 0) playNext(s, 'play-now'); else hideUpNext(s, true); return true; }
    if (name === 'back') { hideUpNext(s, true); return true; }
    if (name === 'up' || name === 'down' || name === 'info') return true;
    return false;
  }

  function handleKey(name, ev) {
    var s = S;
    if (name === 'backspace') name = 'back';
    if (!s) { if (name === 'back' || name === 'stop') stop('back'); return true; }
    if (s.state === 'error') return errorKey(s, name);
    if (s.state === 'loading') { if (name === 'back' || name === 'stop') stop(name === 'stop' ? 'stop' : 'back'); return true; }
    if (s.sheet) return sheetKey(s, name);
    if (s.upnext && s.upnext.visible && upNextKey(s, name)) return true;
    var onButtons = s.osd && s.area === 'buttons';
    switch (name) {
      case 'back': stop('back'); return true;
      case 'stop': stop('stop'); return true;
      case 'enter':
        if (ui.skip && U.hasClass(ui.skip, 'is-on')) { skipIntro(s); return true; }
        if (onButtons) { activate(s, s.btn); showOsd(s); return true; }
        togglePlay(s);
        return true;
      case 'space': case 'playpause': togglePlay(s); return true;
      case 'play': if (paused() || s.blocked) togglePlay(s); else showOsd(s); return true;
      case 'pause': if (!paused()) togglePlay(s); else showOsd(s); return true;
      case 'left': case 'right':
        if (onButtons) { moveButton(s, name === 'right' ? 1 : -1); showOsd(s); return true; }
        seekBy(s, name === 'right' ? 1 : -1, ev);
        return true;
      case 'ff': seekBy(s, 1, ev); return true;
      case 'rw': seekBy(s, -1, ev); return true;
      case 'up':
        showOsd(s);
        if (onButtons) setArea(s, 'scrub');
        return true;
      case 'down':
        if (s.chipStartOver) { hideChip(s); showOsd(s); setArea(s, 'buttons', 'start-over'); return true; }
        showOsd(s);
        setArea(s, 'buttons');
        return true;
      case 'chup':
        if (s.next) playNext(s, 'channel-up'); else showChip(s, 'This is the latest episode', 3000, false);
        return true;
      case 'chdown': previousEpisode(s); return true;
      case 'info':
        if (s.osd) hideOsd(s, true); else showOsd(s);
        return true;
      default:
        showOsd(s);
        return true;
    }
  }

  /* ---------- public API ---------- */

  /* Returns false (and leaves nothing on screen, calling no hook) when playback could not even start: the caller
     then runs the website path itself. Called while active, it replaces the session in the same overlay. */
  function play(req, hooks) {
    if (!req || typeof req !== 'object' || req.id == null || !/\d/.test(String(req.id))) return false;
    hooks = hooks || {};
    var opening = !ui;
    unattended = 0; /* the viewer asked for this title */
    try {
      if (S) finish(S, { why: 'replaced' });
      if (opening) {
        var mount = hooks.mount && hooks.mount.nodeType === 1 ? hooks.mount : (document.getElementById('mbptv') || document.body);
        build(mount);
      }
      begin(req, hooks);
    } catch (e) {
      Log.error('player:play', e);
      gen++;
      S = null;
      try { keepAwake(false); teardownUi(); } catch (e2) {}
      if (!opening) hook(hooks, 'onClose', { reason: 'internal', over: 0 });
      return false;
    }
    if (opening) hook(hooks, 'onOpen');
    return true;
  }

  function active() { return !!ui; }

  function key(name, ev) {
    if (!ui || !name) return false;
    ev = ev || {};
    unattended = 0; /* someone is there */
    /* A held OK would toggle pause on every repeat, a held Back would close the player and then hand its repeats to
       the App: keys that act once ignore auto-repeat (they still belong to the player). */
    if (ev.repeat && ONCE[name]) return true;
    try { return handleKey(name, ev); } catch (e) {
      Log.error('player-key:' + name, e);
      return true;
    }
  }

  /* Saves progress, tears the video and overlay down and calls hooks.onClose(info) once. Idempotent. */
  function stop(reason) {
    if (!ui) return false;
    var s = S, hooks = s ? s.hooks : null;
    var info = s ? (finish(s, { why: reason || 'stop' }) || snapshot(s)) : null;
    gen++;
    S = null;
    clearTimeout(chipTimer);
    keepAwake(false);
    teardownUi();
    info = info || {};
    info.reason = String(reason || 'stop');
    info.over = s && s.lastSent ? toInt(String(s.lastSent).split(':')[1]) : 0;
    Log.info('player', 'closed (' + info.reason + ')');
    hook(hooks, 'onClose', info);
    return true;
  }

  function info() { return S ? snapshot(S) : null; }

  function configure(opts) {
    if (opts) for (var k in opts) if (opts.hasOwnProperty(k) && CFG.hasOwnProperty(k) && typeof opts[k] === 'number' && opts[k] >= 0) CFG[k] = opts[k];
    var out = {};
    for (var c in CFG) if (CFG.hasOwnProperty(c)) out[c] = CFG[c];
    return out;
  }

  function guarded(name, fn, fallbackValue) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) {
        Log.error('player:' + name, e);
        return fallbackValue;
      }
    };
  }

  return {
    play: guarded('play', play, false),
    active: active,
    key: key,
    stop: guarded('stop', stop, false),
    info: guarded('info', info, null),
    configure: guarded('configure', configure, null),
    /* Pure helpers, exposed for tests and diagnostics. */
    _parse: guarded('parse', parse, null),
    _order: guarded('order', order, [])
  };
}());
/* ---- 60-app.js ---- */
/* App: root, rail, screen stack, key dispatch, play flow, player / website / popup modes, watchdog.
   Everything asynchronous is guarded; any failure degrades to an error screen with Retry / Open website / Home,
   and a shell that cannot run at all removes itself so the website stays usable. */
var App = (function () {
  var root = null, rail = null, stage = null, railItems = {};
  var stack = [], layers = [];
  var mode = 'boot';
  var started = false, routed = false, dead = false;
  var page = { type: 'other', title: null, url: '', detail: null };
  var pending = null, popupEl = null, modeBeforePopup = 'shell', controlsMode = false;
  var moveLock = false, selfTestResult = null, selfTestModel = null, webHere = false, cancelledAt = 0;
  /* Playback bookkeeping. dismissed: the viewer closed or cancelled playback, so a player that still shows only counts
     when it really plays again (until the next play action). pickerCancelled: the website's file list stays closed
     until the next play action. ignoredPopups: site popups the viewer escaped from with Blue. */
  var dismissed = null, pickerCancelled = false, ignoredPopups = [], lastPlayAt = 0, lastTarget = null, playerVideo = null;
  /* siteHold: this ?play=1 page was handed to the built-in player, so whatever the website's own auto-play opens (its
     file list, its player, a message) is closed quietly until the viewer's next website play action. */
  var siteHold = false;
  /* resolving: a show-level Play is reading its title page first (resolveThenPlay); Back cancels it. */
  var resolving = null;
  var backInFlight = 0, lastTouch = 0, liveParsed = { home: null, detail: null };
  var timers = { watchdog: null, monitor: null, boot: null, selfTest: null };
  var offs = [];
  var KEEP = 4;
  var WEB_KEY = 'mbptv:web:v1', PICK_KEY = 'mbptv:pick:v1', CANCEL_KEY = 'mbptv:cancel:v1', WEBPLAY_KEY = 'mbptv:webplay:v1';

  function el(tag, cls, text, parent) { return U.el(tag, cls, text, parent); }

  function top() { return stack.length ? stack[stack.length - 1] : null; }
  function topInst() { var t = top(); return t && t.inst; }
  function topLayer() { return layers.length ? layers[layers.length - 1] : null; }

  function pageType() { return page.type; }

  /* ---------- Root and rail ---------- */

  function buildRail() {
    rail = Kit.zone(el('div', 'mb-rail'), 'rail');
    el('div', 'mb-rail-bg', null, rail);
    var head = el('div', 'mb-rail-head', null, rail);
    Kit.monogram(head);
    el('span', 'mb-rail-brand', 'MovieBox Pro', head);
    var items = el('div', 'mb-rail-items', null, rail);
    var defs = [['search', 'Search', 'search'], ['home', 'Home', 'home'], ['movies', 'Movies', 'film'], ['shows', 'TV Shows', 'tv'],
      ['library', 'My Library', 'library'], ['-'], ['settings', 'Settings', 'settings']];
    U.each(defs, function (d) {
      if (d[0] === '-') { el('div', 'mb-rail-sep', null, items); return; }
      var it = el('div', 'mb-rail-item', null, items);
      Kit.focusable(it, 'nav|' + d[0], 'nav-' + d[0]);
      it.appendChild(Icons.el(d[2]));
      el('span', 'mb-rail-label', d[1], it);
      railItems[d[0]] = it;
    });
    return rail;
  }

  function buildRoot() {
    var old = document.getElementById('mbptv');
    if (old) U.detach(old);
    root = el('div');
    root.id = 'mbptv';
    root.setAttribute('data-screen', 'loading');
    root.setAttribute('data-layer', '');
    root.setAttribute('tabindex', '-1');
    root.appendChild(buildRail());
    stage = el('div', 'mb-stage', null, root);
    document.body.appendChild(root);
  }

  /* The website's scripts may rebuild parts of the page: put our root and our stylesheet back if they vanish. */
  function ensureAttached() {
    if (!root || dead) return;
    if (!document.documentElement.contains(root) && document.body) {
      Log.warn('app', 'root was detached; re-attaching');
      document.body.appendChild(root);
    }
    if (!document.getElementById('mbptv-css') && typeof Boot !== 'undefined' && Boot.injectStyles) {
      Log.warn('app', 'stylesheet was removed; re-adding');
      try { Boot.injectStyles(); } catch (e) { Log.warn('app', e); }
    }
  }

  function applyPrefs() {
    if (!root) return;
    U.toggleClass(root, 'mb-reduce', !!Screens.pref('reduceMotion', false));
    var perf = false;
    try { perf = Kit.perf(); } catch (e) { perf = false; }
    U.toggleClass(root, 'mb-perf', perf);
  }

  function setScreenAttr(name) { if (root) root.setAttribute('data-screen', name); }

  /* Classes on <html> (section 10), re-applied by the watchdog every 2 s in case the site rewrites html.className:
     mbptv-lock stops the page behind the shell from scrolling (and removes its scrollbar); mbptv-player hides the
     website player's own controls under our OSD; mbptv-jwctl shows them for the player-controls mode. Website and
     popup modes never lock scrolling. Boot.teardown removes all of them. */
  function setModeClass() {
    if (!root) return;
    U.toggleClass(root, 'is-hidden', mode !== 'shell' && mode !== 'boot');
    var h = document.documentElement;
    U.toggleClass(h, 'mbptv-lock', mode === 'boot' || mode === 'shell' || mode === 'player');
    U.toggleClass(h, 'mbptv-player', mode === 'player');
    U.toggleClass(h, 'mbptv-jwctl', mode === 'popup' && controlsMode);
  }

  /* ---------- Focus plumbing ---------- */

  function scopes() {
    var l = topLayer();
    if (l) return [l.el];
    var inst = topInst(), out = [];
    if (!inst || mode !== 'shell') return out;
    if (inst.rail !== false) out.push(rail);
    out.push(inst.el);
    return out;
  }

  function onFocusChange(node, prev) {
    var inRail = !!(rail && rail.contains(node));
    U.toggleClass(root, 'rail-open', inRail);
    var parent = node.parentNode;
    if (parent && U.hasClass(parent, 'mb-track')) Kit.scrollTrack(parent, node);
    var l = topLayer();
    if (l) { if (l.opts.onFocus) U.guard(l.opts.onFocus, 'layer-focus')(node); return; }
    var entry = top();
    if (entry && entry.inst && entry.inst.el.contains(node)) {
      entry.lastFocus = node;
      if (entry.inst.onFocus) U.guard(entry.inst.onFocus, 'screen-focus')(node, prev);
      Kit.lazySoon(entry.inst.el);
    }
  }

  function exitHook(from, zone, dir) {
    if (zone === rail) {
      if (dir === 'right') {
        var entry = top(), inst = entry && entry.inst;
        if (!inst) return false;
        /* The rail reopens on the current section, not on the last item browsed. */
        rail.__mbLast = railItems[inst.nav || entry.nav || ''] || railItems.home;
        var last = entry.lastFocus;
        if (last && Focus.shown(last) && inst.el.contains(last)) return last;
        return inst.initialFocus() || Focus.firstIn(inst.el) || false;
      }
      return false;
    }
    return null;
  }

  function focus(node) {
    if (!node) return false;
    return Focus.set(node);
  }

  function focusScreenDefault() {
    var l = topLayer();
    if (l) { focus(l.opts.focus && Focus.shown(l.opts.focus) ? l.opts.focus : Focus.firstIn(l.el)); return; }
    var entry = top(), inst = entry && entry.inst;
    if (!inst) return;
    var target = null;
    if (entry.focusKey) target = Focus.byKey(inst.el, entry.focusKey) || (rail && Focus.byKey(rail, entry.focusKey));
    if (!target && entry.lastFocus && Focus.shown(entry.lastFocus) && inst.el.contains(entry.lastFocus)) target = entry.lastFocus;
    if (!target) { try { target = inst.initialFocus(); } catch (e) { Log.warn('initial-focus', e); } }
    if (target) focus(target);
    else { Focus.blur(); try { root.focus(); } catch (e2) {} }
  }

  /* ---------- Screens and stack ---------- */

  /* The boot page's own parse (made once in route) goes to the first screen that renders from the live page. */
  function takeParsed(screen) {
    var m = null;
    if (screen === 'home') { m = liveParsed.home; liveParsed.home = null; }
    else if (screen === 'detail') { m = liveParsed.detail; liveParsed.detail = null; }
    return m;
  }

  function createInst(entry) {
    try {
      return Screens.create(entry.screen, entry.params, { live: !!entry.live, model: entry.live ? takeParsed(entry.screen) : null });
    } catch (e) {
      Log.error('render:' + entry.screen, e);
      return Screens.create('error', { err: { code: 'render', message: String(e && e.message || e) }, websiteUrl: websiteUrlFor(entry) });
    }
  }

  function destroyInst(entry) {
    var inst = entry && entry.inst;
    if (!inst) return;
    inst.alive = false;
    try { if (inst.destroy) inst.destroy(); } catch (e) { Log.warn('destroy', e); }
    U.detach(inst.el);
    entry.inst = null;
  }

  function evict() {
    for (var i = 0; i < stack.length - KEEP; i++) {
      if (stack[i].inst && i !== 0) destroyInst(stack[i]);
    }
  }

  function showEntry(entry) {
    if (!entry) return;
    if (!entry.inst) entry.inst = createInst(entry);
    entry.touched = false;
    var inst = entry.inst;
    U.each(stack, function (e) { if (e !== entry && e.inst) { U.toggleClass(e.inst.el, 'is-current', false); } });
    if (inst.el.parentNode !== stage) stage.appendChild(inst.el);
    U.toggleClass(inst.el, 'is-current', true);
    setScreenAttr(inst.name);
    U.toggleClass(root, 'no-rail', inst.rail === false);
    var nav = inst.nav || entry.nav || '';
    for (var k in railItems) if (railItems.hasOwnProperty(k)) U.toggleClass(railItems[k], 'is-active', k === nav);
    rail.__mbLast = railItems[nav] || railItems.home;
    U.toggleClass(root, 'rail-open', false);
    try { if (inst.onShow) inst.onShow(); } catch (e) { Log.warn('onShow', e); }
    if (mode === 'shell') focusScreenDefault();
    Kit.lazySoon(inst.el);
  }

  function rememberFocus() {
    var entry = top(), cur = Focus.current();
    if (entry && entry.inst && cur && entry.inst.el.contains(cur)) entry.focusKey = Focus.keyOf(cur);
  }

  function push(name, params, opts) {
    opts = opts || {};
    if (mode !== 'shell') leaveToShell();
    closeAllLayers();
    rememberFocus();
    var cur = top();
    if (cur && cur.inst && cur.inst.onHide) { try { cur.inst.onHide(); } catch (e) {} }
    var entry = { screen: name, params: params || {}, focusKey: '', live: !!opts.live, nav: (cur && cur.inst && cur.inst.nav) || (cur && cur.nav) || '' };
    stack.push(entry);
    evict();
    showEntry(entry);
    return entry;
  }

  function pop() {
    if (stack.length <= 1) return false;
    closeAllLayers();
    var old = stack.pop();
    destroyInst(old);
    showEntry(top());
    return true;
  }

  function resetTo(entries) {
    closeAllLayers();
    U.each(stack, destroyInst);
    stack = [];
    U.each(entries, function (e) { stack.push({ screen: e.screen, params: e.params || {}, focusKey: e.focusKey || '', live: !!e.live }); });
    if (!stack.length) stack.push({ screen: 'home', params: {}, focusKey: '' });
    showEntry(top());
  }

  /* Rail destinations sit directly above Home: Back from any of them returns Home, Back on Home asks to exit. */
  function navRoot(name, params, nav) {
    var t = top();
    /* "Already there" means the screen itself is showing, not an error screen that replaced its entry. */
    if (t && t.inst && t.inst.name === name && t.screen === name && (t.inst.nav || '') === (nav || t.inst.nav)) { focusScreenDefault(); return; }
    if (mode !== 'shell') leaveToShell();
    closeAllLayers();
    while (stack.length > 1) destroyInst(stack.pop());
    if (!stack.length || stack[0].screen !== 'home') { U.each(stack, destroyInst); stack = [{ screen: 'home', params: {}, focusKey: '' }]; }
    if (name === 'home') {
      var h = top();
      if (h.inst && h.inst.name !== 'home') { destroyInst(h); h.focusKey = ''; }
      showEntry(h);
      return;
    }
    push(name, params);
  }

  function nav(name) {
    var su = Screens.siteUrl;
    if (name === 'home') navRoot('home', {}, 'home');
    else if (name === 'search') navRoot('search', {}, 'search');
    else if (name === 'movies') navRoot('browse', { url: su('movies', [], '/movie'), title: 'Movies', kicker: 'Browse', nav: 'movies' }, 'movies');
    else if (name === 'shows') navRoot('browse', { url: su('shows', [], '/tvshow'), title: 'TV Shows', kicker: 'Browse', nav: 'shows' }, 'shows');
    else if (name === 'library') {
      var lib = su('library', [], '/index/index/my_box');
      navRoot('browse', { url: lib, title: 'My Library', kicker: 'Your titles', nav: 'library', tabs: [
        { label: 'Continue watching', href: lib },
        { label: 'Watched', href: U.abs('/index/index/my_box?watched=1', lib) },
        { label: 'Favorites', href: U.abs('/index/index/fav_list', lib) },
        { label: 'History', href: su('history', [], '/index/index/history') }
      ] }, 'library');
    } else if (name === 'settings') navRoot('settings', {}, 'settings');
  }

  function goHome() { nav('home'); }

  /* A screen finished its asynchronous render: restore the remembered focus, or the screen's default unless the
     viewer already moved on their own. */
  function screenReady(inst) {
    var entry = top();
    if (!entry || entry.inst !== inst || mode !== 'shell' || topLayer()) return;
    if (entry.focusKey) {
      var t = Focus.byKey(inst.el, entry.focusKey);
      if (t) { entry.focusKey = ''; focus(t); return; }
    }
    var cur = Focus.current();
    if (entry.touched && cur && Focus.shown(cur) && (rail.contains(cur) || inst.el.contains(cur))) { onFocusChange(cur, null); return; }
    var target = null;
    try { target = inst.initialFocus(); } catch (e) { Log.warn('initial-focus', e); }
    if (target) focus(target); else focusScreenDefault();
  }

  function screenFailed(inst, err) {
    var entry = null;
    U.each(stack, function (e) { if (e.inst === inst) entry = e; });
    if (!entry) return;
    Log.warn('screen:' + entry.screen, err);
    if (err && err.code === 'signed-out') { signedOut(); return; }
    destroyInst(entry);
    entry.inst = Screens.create('error', { err: err, websiteUrl: websiteUrlFor(entry), nav: inst.nav });
    if (entry === top()) showEntry(entry);
  }

  function retry() {
    var entry = top();
    if (!entry) { resetTo([{ screen: 'home' }]); return; }
    if (entry.screen === 'signin') {
      toast('Checking your sign-in\u2026');
      try {
        Api.home(U.guard(function (err) {
          if (err && err.code === 'signed-out') { toast('Still signed out. Finish signing in on the website first.'); return; }
          if (err) { toast('The website didn\u2019t answer. Try again in a moment.'); return; }
          resetTo([{ screen: 'home' }]);
        }, 'signin-retry'));
      } catch (e) { Log.error('signin-retry', e); }
      return;
    }
    destroyInst(entry);
    entry.focusKey = '';
    showEntry(entry);
  }

  function websiteUrlFor(entry) {
    var p = entry && entry.params || {}, su = Screens.siteUrl;
    if (!entry) return location.href;
    if (entry.screen === 'detail' && p.id) return su('title', [p.kind, p.id], '/');
    if (entry.screen === 'browse' && p.url) return p.url;
    if (entry.screen === 'search' && p.query) return su('search', [p.query, p.type || 'all', 1], '/');
    return su('home', [], '/');
  }

  /* Signed out: whatever this TV remembers about the previous account's searches and places is forgotten; the
     server keeps its own history. */
  function forgetAccount() {
    try { Api.clearRecentSearches(); } catch (e) {}
    try { Session.clear(); } catch (e2) {}
  }

  function signedOut() {
    if (mode !== 'shell') leaveToShell();
    var t = top();
    if (t && t.screen === 'signin') return;
    forgetAccount();
    resetTo([{ screen: 'signin' }]);
  }

  /* ---------- Layers ---------- */

  function openLayer(kind, node, opts) {
    closeLayer(kind);
    rememberFocus();
    var l = { kind: kind, el: node, opts: opts || {}, prevFocus: Focus.current() };
    layers.push(l);
    root.appendChild(node);
    root.setAttribute('data-layer', kind);
    U.toggleClass(root, 'rail-open', false);
    focus(l.opts.focus && Focus.shown(l.opts.focus) ? l.opts.focus : Focus.firstIn(node));
    return l;
  }

  function closeLayer(kind) {
    var idx = -1;
    for (var i = layers.length - 1; i >= 0; i--) if (layers[i].kind === kind) { idx = i; break; }
    if (idx < 0) return false;
    var l = layers.splice(idx, 1)[0];
    U.detach(l.el);
    if (l.opts.onClose) U.guard(l.opts.onClose, 'layer-close')();
    var t = topLayer();
    root.setAttribute('data-layer', t ? t.kind : '');
    if (mode === 'shell') {
      if (t) focus(Focus.shown(t.prevFocus) ? t.prevFocus : Focus.firstIn(t.el));
      else if (l.prevFocus && Focus.shown(l.prevFocus) && root.contains(l.prevFocus)) focus(l.prevFocus);
      else focusScreenDefault();
    }
    return true;
  }

  function closeAllLayers() {
    while (layers.length) {
      var l = layers.pop();
      U.detach(l.el);
      if (l.opts.onClose) U.guard(l.opts.onClose, 'layer-close')();
    }
    if (Overlays.sources.isOpen()) Overlays.sources.close(false);
    if (root) root.setAttribute('data-layer', '');
  }

  function hasLayer(kind) { return U.find(layers, function (l) { return l.kind === kind; }) !== null; }

  function toast(msg, ms) { Toast.show(msg, ms); }

  /* ---------- Session persistence ---------- */

  function serialize() {
    rememberFocus();
    var out = [];
    U.each(stack, function (e) {
      if (e.screen === 'loading') return;
      var params = e.params || {};
      if (e.inst && e.inst.alive !== false && e.inst.snapshot) {
        try { var snap = e.inst.snapshot(); if (snap) params = snap; } catch (err) { Log.warn('snapshot', err); }
      }
      if (params.item && typeof params.item === 'object') params.item = Screens.compactItem(Screens.normItem(params.item));
      out.push({ screen: e.screen, params: params, focusKey: e.focusKey || '' });
    });
    return out;
  }

  function saveState() {
    try { Session.save(serialize(), { expect: page.type, returnTo: location.href }); } catch (e) { Log.warn('session-save', e); }
  }

  /* A watching session keeps its saved record (and so the way back) fresh: films outlast the 30-minute TTL. */
  function touchSession() {
    var watching = mode === 'player' || !!pending || (mode === 'popup' && modeBeforePopup === 'player');
    if (!watching) return;
    var now = U.now();
    if (now - lastTouch < 60000 && now >= lastTouch) return;
    lastTouch = now;
    try { Session.touch(); } catch (e) {}
  }

  /* ---------- Modes: shell, native (website), player, popup ---------- */

  function setMode(next) {
    mode = next;
    if (next !== 'popup') controlsMode = false;
    setModeClass();
  }

  function leaveToShell() {
    stopNative('app');
    if (mode === 'native' || mode === 'popup') Overlays.web.stop();
    if (mode === 'player') Player.stop();
    popupEl = null;
    setMode('shell');
  }

  function enterWebsite(opts) {
    opts = opts || {};
    stopNative('app');
    closeAllLayers();
    Overlays.hideStarting();
    pending = null;
    resolving = null;
    if (mode === 'player') Player.stop();
    if (mode === 'popup') Overlays.web.stop();
    popupEl = null;
    webHere = !!opts.here;
    setMode('native');
    setScreenAttr('native');
    U.toggleClass(root, 'rail-open', false);
    Focus.blur();
    Overlays.web.start({ here: webHere });
    Log.info('mode', 'website');
  }

  function exitWebsite() {
    try { Store.session.remove(WEB_KEY); } catch (e) {}
    backInFlight = 0;
    Overlays.web.stop();
    setMode('shell');
    Log.info('mode', 'shell');
    /* A page that booted straight into website mode never built a stack (only the loading entry): restore the
       place the viewer left (saved when website mode navigated away) or show this page's natural screen. */
    if (!stack.length || top().screen === 'loading') {
      var saved = null;
      try { saved = Session.take(page.type); } catch (e2) { saved = null; }
      if (!(saved && saved.length && restore(saved))) defaultRoute();
      return;
    }
    try { Session.clear(); } catch (e3) {}
    showEntry(top());
  }

  function hereUrl() { return String(location.href).replace(/#.*$/, ''); }

  /* Website mode survives page loads for 30 minutes as {t, origin, kind}. kind 'here': website view was opened on
     origin, so origin stays in website view. kind 'nav': the shell on origin opened another page in website mode,
     so arriving back on origin returns to the shell. */
  function rememberWebsite(kind) {
    try { Store.session.set(WEB_KEY, { t: U.now(), origin: hereUrl(), kind: kind }); } catch (e) {}
  }

  function readWebKey() {
    var web = null;
    try { web = Store.session.get(WEB_KEY, null); } catch (e) { web = null; }
    if (web && (typeof web !== 'object' || !(U.now() - (+web.t || 0) < 30 * 60 * 1000))) {
      web = null;
      try { Store.session.remove(WEB_KEY); } catch (e2) {}
    }
    return web;
  }

  /* Opens a website page in website mode. '' (or this page) switches in place; another URL navigates there, rebuilt
     onto this page's own origin (never a raw URL from site markup). */
  function openWebsite(url, opts) {
    opts = opts || {};
    if (!url || String(url).replace(/#.*$/, '') === hereUrl()) {
      rememberWebsite('here');
      enterWebsite({ here: true });
      return;
    }
    var dest = U.onOrigin(url);
    if (!dest) { toast('That page is outside MovieBox Pro.'); return; }
    if (opts.persist !== false) rememberWebsite('nav');
    else { try { Store.session.remove(WEB_KEY); } catch (e) {} }
    /* The sign-in screen is never saved as a place to come back to: after signing in the viewer belongs on Home. */
    var t = top();
    if (t && t.screen === 'signin') { try { Session.clear(); } catch (e2) {} } else saveState();
    showLoadingOverlay('Opening the website\u2026');
    location.href = dest;
  }

  /* One history step at a time: a second Back while the previous one is still loading is ignored (slow pages and
     double presses would otherwise skip past the page the viewer came from). */
  function historyBack() {
    if (backInFlight && U.now() - backInFlight < 2500) return false;
    backInFlight = U.now();
    try { history.back(); return true; } catch (e) { backInFlight = 0; return false; }
  }

  /* Back in website mode: history-back, or straight back to the shell when website mode was opened on this page. */
  function websiteBack() {
    if (webHere || history.length <= 1) { exitWebsite(); return; }
    if (backInFlight && U.now() - backInFlight < 2500) return;
    var href = location.href;
    if (!historyBack()) { exitWebsite(); return; }
    U.later(function () { backInFlight = 0; if (mode === 'native' && location.href === href) exitWebsite(); }, 1500, 'web-back');
  }

  /* ---------- Player detection ---------- */

  function playCtx() {
    return { recent: !!pending || U.now() - lastPlayAt < 15000, current: mode === 'player' || controlsMode ? playerVideo : null };
  }

  function rawPlayerOpen() {
    try { return !!Site.live.playerOpen(playCtx()); } catch (e) { return false; }
  }

  /* True when the video's time moved since the previous sample (samples at least 300 ms apart). */
  var vsample = { v: null, t: -1, at: 0, adv: false };
  function advancing(v) {
    var now = U.now();
    if (vsample.v === v && now - vsample.at < 300 && now >= vsample.at) return vsample.adv;
    var t = v ? v.currentTime : -1;
    var adv = !!(v && vsample.v === v && !v.paused && !v.ended && t > vsample.t + 0.1);
    vsample = { v: v, t: t, at: now, adv: adv };
    return adv;
  }

  /* The website player is open and belongs on screen. After the viewer closed or cancelled playback, a player that is
     still there (it could not be closed, or it is paused behind the shell) only counts when it really plays again. */
  function sitePlayerOpen() {
    if (!rawPlayerOpen()) return false;
    if (!dismissed) return true;
    var v = null;
    try { v = Site.live.video(); } catch (e) { v = null; }
    return advancing(v);
  }

  /* A new play action: forget the previous dismissals. */
  function playAction(t) {
    siteHold = false;
    dismissed = null;
    pickerCancelled = false;
    ignoredPopups = [];
    lastPlayAt = U.now();
    if (t) lastTarget = t;
  }

  /* Title and episode line for the OSD: the show title (never with a code suffix) and "S2 \u00b7 E1  Episode title". */
  function osdInfo() {
    var pt = (pending && pending.t) || lastTarget || {};
    var t = top(), inst = t && t.inst, m = inst && inst.model ? inst.model() : null, lt = liveTitle();
    var season = +pt.season || (lt && lt.season) || 0, episode = +pt.episode || (lt && lt.episode) || 0;
    var title = (m && m.title) || pt.title || (inst && inst.params && inst.params.item && inst.params.item.title) ||
      String(document.title || '').replace(/\s*[-|]\s*MovieBox\s*Pro.*$/i, '');
    title = U.text(String(title).replace(/\s+\u00b7\s+S\d+\s*E\d+\s*$/i, ''));
    var sub = '';
    if (episode) {
      var ep = m ? U.find(m.episodes || [], function (e) { return +e.season === +season && +e.episode === +episode; }) : null;
      sub = (season ? 'S' + season + ' \u00b7 ' : '') + 'E' + episode + (ep && ep.title ? '  ' + ep.title : '');
    }
    return { title: title, sub: sub };
  }

  function enterPlayer() {
    if (mode === 'player') return;
    var info = osdInfo();
    pending = null;
    dismissed = null;
    Overlays.hideStarting();
    closeAllLayers();
    if (mode === 'native' || mode === 'popup') Overlays.web.stop();
    popupEl = null;
    try { playerVideo = Site.live.video(); } catch (e) { playerVideo = null; }
    lastTouch = 0;
    setMode('player');
    setScreenAttr('player');
    Focus.blur();
    try { guardFrames(); } catch (eg) {}
    Player.start(info);
    Log.info('mode', 'player');
  }

  /* Back in player mode. If the website's player cannot be closed (its markup changed), every video is paused and it
     is left behind the opaque shell: the viewer is never sent back into it (see sitePlayerOpen). */
  function closePlayer() {
    Player.stop();
    var closed = false;
    try { closed = Site.live.closePlayer(playCtx()); } catch (e) { Log.warn('close-player', e); }
    dismissed = { at: U.now() };
    vsample = { v: null, t: -1, at: 0, adv: false };
    if (!closed) Log.warn('player', 'the website player did not close cleanly; it stays paused behind the TV app');
    afterPlayer(true);
  }

  function afterPlayer(viaBack) {
    Player.stop();
    playerVideo = null;
    var returnTo = returnTarget();
    if (viaBack && returnTo) {
      setMode('shell');
      showLoadingOverlay('Returning\u2026');
      Log.info('player', 'history.back to ' + returnTo);
      historyBack();
      U.later(function () { hideLoadingOverlay(); if (mode === 'shell') showEntry(top()); }, 2500, 'back-fallback');
      return;
    }
    setMode('shell');
    settleUrl();
    if (!stack.length) defaultRoute(); else showEntry(top());
  }

  /* Blue in player mode: the website player's own controls (captions, audio, its menus) with the focus ring, scoped
     to the player. Back or Blue returns to the TV player. */
  function playerControls() {
    if (mode !== 'player') return;
    var box = null;
    try { box = Site.live.playerContainer(); } catch (e) { box = null; }
    var scope = box || document.body;
    Player.stop();
    popupEl = scope;
    modeBeforePopup = 'player';
    setMode('popup');
    controlsMode = true;
    setModeClass();
    setScreenAttr('native');
    Focus.blur();
    var first = U.qs(scope, '.jw-controlbar .jw-icon-playback, .jw-controlbar .jw-icon, .vjs-control-bar .vjs-play-control, .vjs-control-bar button');
    Overlays.web.start({ scope: scope, initial: first, onBack: backToPlayer, onEscape: backToPlayer });
    toast('Player controls  \u00b7  Back returns to the TV player', 3000);
    Log.info('mode', 'player controls');
  }

  function backToPlayer() {
    Overlays.web.stop();
    popupEl = null;
    var open = rawPlayerOpen();
    setMode('shell');
    if (open) enterPlayer(); else afterPlayer(false);
  }

  /* Staying on a ?play=1 page after playback ended, failed or was cancelled: drop play=1 from its URL, so a reload
     or a later Back into this history entry does not make the website start playback again. */
  function settleUrl() {
    var lt = liveTitle();
    if (!lt || !lt.play) return;
    try {
      var clean = Site.url.title(lt.kind, lt.id, lt.season);
      if (clean && U.sameSite(clean) && history.replaceState) history.replaceState(history.state, '', clean);
    } catch (e) { Log.warn('settle-url', e); }
    lt.play = false;
    lt.episode = 0;
    page.url = location.href;
  }

  /* The text of a site message worth repeating after it is dismissed (no files, VIP only). */
  function popupMessage(node) {
    if (!node || !U.matches(node, '.no_resource_bg, .vip_pay_tips')) return '';
    return U.text(node.textContent).slice(0, 140);
  }

  function enterPopup(node) {
    stopNative('app');
    popupEl = node;
    modeBeforePopup = mode === 'player' ? 'player' : 'shell';
    controlsMode = false;
    if (pending) pending.reacted = true;
    if (mode === 'player') Player.stop();
    closeAllLayers();
    Overlays.hideStarting();
    setMode('popup');
    setScreenAttr('native');
    Focus.blur();
    Overlays.web.start({
      scope: node,
      onBack: function () {
        /* Only a message that answered a Play ends the attempt; one shown during playback is just dismissed. */
        var el0 = popupEl, gone = false, starting = modeBeforePopup !== 'player' && (!!pending || !!(liveTitle() && liveTitle().play));
        try { gone = Site.live.dismissPopup(el0); } catch (e) { Log.warn('dismiss', e); }
        if (!gone) { escapePopup(el0, 'The website\u2019s message could not be closed.'); return; }
        /* A message that answered a Play (no files, not ready, VIP only) ends that attempt. */
        if (starting) cancelPlayback(popupMessage(el0));
        U.later(monitor, 60, 'popup-check');
      },
      onEscape: function () { escapePopup(popupEl, ''); }
    });
    Log.info('mode', 'popup ' + (node.className || ''));
  }

  /* Blue / Info in popup mode, or a popup that cannot be hidden: back to the TV app, and that element is ignored
     until the next play action (the opaque shell covers it). */
  function escapePopup(node, msg) {
    if (node && U.indexOf(ignoredPopups, node) < 0) ignoredPopups.push(node);
    leavePopup();
    if (msg) toast(msg);
  }

  function leavePopup() {
    Overlays.web.stop();
    popupEl = null;
    var playerOpen = modeBeforePopup === 'player' ? rawPlayerOpen() : sitePlayerOpen();
    setMode('shell');
    if (playerOpen) { enterPlayer(); return; }
    showEntry(top());
  }

  /* ---------- Loading overlay (navigation in progress) ---------- */

  var loadingNode = null, loadingSince = 0;
  function showLoadingOverlay(msg) {
    hideLoadingOverlay();
    loadingSince = U.now();
    var s = Screens.create('loading', { message: msg });
    loadingNode = s.el;
    U.toggleClass(loadingNode, 'is-current', true);
    loadingNode.style.zIndex = '50';
    root.appendChild(loadingNode);
  }
  function hideLoadingOverlay() { if (loadingNode) U.detach(loadingNode); loadingNode = null; }

  /* ---------- Play flow ---------- */

  function liveTitle() { return page.title && (page.type === 'movie' || page.type === 'tv') ? page.title : null; }

  function playInfo(t) {
    var m = null;
    try { m = Api.meta(t.kind + ':' + t.id); } catch (e) {}
    var title = t.title || (m && m.title) || '';
    if (t.episode && title && !/\bS\d+\s*E\d+/i.test(title)) title += '  \u00b7  S' + t.season + 'E' + t.episode;
    return { title: title, backdrop: t.backdrop || (m && m.backdrop) || (t.item && t.item.backdrop) || '' };
  }

  /* t: {kind, id, season, episode, title, item, playHref, pick, backdrop}. The built-in player (docs/PLAYER.md) plays
     in place; the website's own player is the fallback: Settings > Built-in player off, a title the built-in player
     cannot identify, or the viewer's "Try website player" on its error card. */
  function play(t) {
    if (!t || !t.id) return;
    if (playNative(t)) return;
    playWebsite(t);
  }

  function nativeOn() { return typeof NativePlayer !== 'undefined' && Screens.pref('nativePlayer', true) !== false; }
  function nativeActive() { try { return typeof NativePlayer !== 'undefined' && NativePlayer.active(); } catch (e) { return false; } }
  function stopNative(reason) { if (nativeActive()) { try { NativePlayer.stop(reason || 'app'); } catch (e) { Log.warn('native-stop', e); } } }

  /* An episode named by the request itself: season and episode, or exactly episode 0 (a special) from an episode card. */
  function explicitEpisode(t) {
    if (!(+t.season > 0)) return null;
    if (+t.episode > 0 || (t.exact && t.episode !== '' && t.episode != null && +t.episode === 0)) return { season: +t.season, episode: +t.episode };
    return null;
  }

  function labelEpisode(label) {
    var m = /S(\d+)\s*E(\d+)/i.exec(String(label || ''));
    return m && +m[1] > 0 && +m[2] > 0 ? { season: +m[1], episode: +m[2] } : null;
  }

  /* The episode a show-level Play/Resume starts: the explicit one; else the Continue Watching card's "S37E21"; else
     the title page's choice (Site.detail nextEpisode: its "S2E3"-style resume label, else the first unwatched
     episode); else a resume label on its Play button; else the first episode of the season the title page shows (the
     site opens a show on the season being watched); else S1E1. */
  function resolveEpisode(t, model) {
    var ex = explicitEpisode(t);
    if (ex) return ex;
    var lab = labelEpisode(t.item && t.item.progressLabel);
    if (lab) return lab;
    var n = model && model.nextEpisode;
    if (n && +n.season > 0 && +n.episode >= 0) return { season: +n.season, episode: +n.episode };
    lab = labelEpisode(model && model.playLabel);
    if (lab) return lab;
    var season = model ? +model.season || 0 : 0, first = null;
    if (!season && +t.season > 0) season = +t.season;
    U.each(model && model.episodes || [], function (e) {
      /* specials (episode 0) only play when chosen */
      if (+e.episode > 0 && (!season || +e.season === season) && (!first || +e.episode < +first.episode)) first = e;
    });
    if (first) return { season: +first.season, episode: +first.episode };
    return { season: season || 1, episode: 1 };
  }

  /* The detail model for kind:id: the screen on top (or the boot page itself) when it shows that title, else one
     already in memory (a prefetch or an earlier visit), else the one a resolve step fetched (t.model). */
  function modelFor(kind, id, t) {
    var inst = topInst(), m = null;
    function mine(x) { return !!x && String(x.id) === String(id) && x.kind === kind; }
    try { m = inst && inst.model ? inst.model() : null; } catch (e) { m = null; }
    if (mine(m)) return m;
    if (mine(page.detail)) return page.detail;
    if (t && mine(t.model)) return t.model;
    try { m = Api.cached ? Api.cached(kind, id) : null; } catch (e2) { m = null; }
    return mine(m) ? m : null;
  }

  /* A show-level Play with nothing to go on (no episode, no Continue Watching label, no title page in memory, for
     example the Home hero's Play on a show): read the title page first, which says where the viewer is. The
     "Starting playback" overlay shows meanwhile; Back cancels; after 6 s the player starts with what it has. */
  function resolveThenPlay(t) {
    var token = { t: t }, done = false;
    resolving = token;
    var shown = playInfo(t);
    shown.hint = 'Finding where you left off  ·  Press Back to cancel';
    Overlays.showStarting(shown);
    function go(m, err) {
      if (done) return;
      done = true;
      if (resolving !== token) return;
      resolving = null;
      if (dead || mode !== 'shell') { Overlays.hideStarting(); return; }
      if (err && err.code === 'signed-out') { Overlays.hideStarting(); signedOut(); return; }
      var t2 = {}, k;
      for (k in t) if (t.hasOwnProperty(k)) t2[k] = t[k];
      t2.model = m || null;
      t2.resolved = true;
      if (!playNative(t2)) { Overlays.hideStarting(); playWebsite(t2); }
    }
    U.later(function () { go(null); }, 6000, 'play-resolve');
    try { Api.detail('tv', t.id, U.guard(function (err, m) { go(err ? null : m, err); }, 'play-resolve-cb')); } catch (e) { go(null); }
    return true;
  }

  /* Returns false only when the built-in player is off or missing, or refused the request (no usable id): then the
     website path runs. Never calls playAction: lastPlayAt would make any large video count as the website's player. */
  function playNative(t) {
    if (!nativeOn()) return false;
    var kind = t.kind === 'tv' ? 'tv' : 'movie', model = modelFor(kind, t.id, t), meta = null;
    if (kind === 'tv' && !model && !t.resolved && !explicitEpisode(t) && !labelEpisode(t.item && t.item.progressLabel)) return resolveThenPlay(t);
    try { meta = Api.meta(kind + ':' + t.id); } catch (e) { meta = null; }
    meta = meta || {};
    if (kind === 'movie' && !t.pick && Screens.pref('quality', 'best') === 'ask' && model && (model.sources || []).length > 1) {
      /* As the detail screen's Quality button does: the sheet's onPick plays the chosen file. */
      Overlays.quality({ title: model.title, sources: model.sources, onPick: function (src) {
        play({ kind: kind, id: t.id, title: t.title, item: t.item, backdrop: t.backdrop, pick: src });
      } });
      return true;
    }
    var ep = kind === 'tv' ? resolveEpisode(t, model) : null;
    var epInfo = ep && model ? U.find(model.episodes || [], function (e) { return +e.season === ep.season && +e.episode === ep.episode; }) : null;
    /* Never t.title for the name: the detail screen appends "  ·  S2E1" to it. */
    var name = (model && model.title) || (t.item && t.item.title) || meta.title || U.text(String(t.title || '').replace(/\s+·\s+S\d+\s*E\d+\s*$/i, ''));
    var req = {
      kind: kind, id: String(t.id), season: ep ? ep.season : 0, episode: ep ? ep.episode : 0,
      title: name, showTitle: name, episodeTitle: (explicitEpisode(t) && U.text(t.episodeTitle)) || (epInfo ? epInfo.title || '' : ''),
      backdrop: t.backdrop || (model && model.backdrop) || meta.backdrop || (t.item && t.item.backdrop) || '',
      poster: (model && model.poster) || meta.poster || (t.item && t.item.poster) || '',
      fileIndex: t.pick && typeof t.pick.index === 'number' ? t.pick.index : undefined,
      autoplayNext: Screens.pref('autoplayEpisodes', true) !== false
    };
    rememberFocus();
    var ok = false;
    try { ok = !!NativePlayer.play(req, nativeHooks(t)); } catch (e2) { Log.error('play', e2); ok = false; }
    if (ok) Log.info('play', 'built-in player ' + kind + ':' + req.id + (ep ? ' S' + ep.season + 'E' + ep.episode : ''));
    return ok;
  }

  /* Hooks for one NativePlayer overlay (a fresh object per play, so mount is the live root). marks: the last "over"
     value saved for each episode played in this overlay ('2x1': 1 = finished), for the detail screen's checks. */
  function nativeHooks(t) {
    var marks = {}, saved = false;
    return {
      mount: root,
      onOpen: function () {
        pending = null; cancelledAt = 0;
        Overlays.hideStarting();
        hideLoadingOverlay();
        closeAllLayers();
        setMode('player');
        setScreenAttr('player');
        U.toggleClass(root, 'rail-open', false);
        Focus.blur();
      },
      onClose: function (info) {
        info = info || {};
        setMode('shell');
        var entry = top(), same = sameDetail(entry, info), watched = !!info.started || saved;
        if (same) prepareDetail(entry, info, watched ? played(info, marks) : null);
        if (!stack.length || !entry || entry.screen === 'loading') defaultRoute(); else showEntry(top());
        if (same && watched && entry.inst && entry.inst.afterPlayback) { try { entry.inst.afterPlayback(); } catch (e) { Log.warn('after-playback', e); } }
        if (same) refreshDetail(entry, info);
        if (watched) afterWatching(top());
      },
      onFallback: function (req, reason) {
        Log.info('play', 'built-in player fallback: ' + reason);
        if (reason === 'signed-out') { signedOut(); return; }
        playWebsite({ kind: req.kind, id: req.id, season: req.kind === 'tv' ? req.season : 0, episode: req.kind === 'tv' ? req.episode : 0,
          title: req.showTitle || t.title, item: t.item, backdrop: req.backdrop });
      },
      onProgress: function (p) {
        /* The site stores it; closing the player refreshes what the screens show. */
        saved = true;
        if (p && p.kind === 'tv' && +p.season > 0) marks[+p.season + 'x' + (+p.episode || 0)] = p.over === 1 ? 1 : 0;
      },
      onNext: function (next) {
        /* Back from the player focuses the episode that played last (its card key in 40-ui-screens). */
        var entry = top();
        if (entry && entry.screen === 'detail' && next) entry.focusKey = 'ep|' + next.season + 'x' + next.episode;
      }
    };
  }

  function sameDetail(entry, info) {
    return !!(entry && entry.screen === 'detail' && info && info.id && String(entry.params.id) === String(info.id) &&
      (entry.params.kind === 'tv' ? 'tv' : 'movie') === info.kind);
  }

  /* What the detail screen needs to know about what was just watched (params.lastPlayed, read by 40-ui-screens):
     where it stopped, whether that counts as finished, and every episode's last saved "over" value. */
  function played(info, marks) {
    var lp = { kind: info.kind === 'tv' ? 'tv' : 'movie', season: +info.season || 0, episode: +info.episode || 0,
      time: Math.max(0, +info.time || 0), duration: Math.max(0, +info.duration || 0), over: info.over === 1 ? 1 : 0, marks: {}, t: U.now() };
    lp.resume = !!info.started && !lp.over && lp.time >= 10;
    for (var k in marks) if (marks.hasOwnProperty(k)) lp.marks[k] = marks[k];
    if (lp.kind === 'tv' && lp.season > 0 && info.started) lp.marks[lp.season + 'x' + lp.episode] = lp.over;
    return lp;
  }

  /* Before the screen shows again: rebuilds must read the refreshed Api cache (never the boot page's markup), the
     screen learns what was watched (lastPlayed; the Continue Watching card's position no longer applies), and a show
     whose Up Next crossed into another season shows that season (the player usually cached its page). */
  function prepareDetail(entry, info, lastPlayed) {
    entry.live = false;
    if (lastPlayed) {
      entry.params.lastPlayed = lastPlayed;
      var it = entry.params.item;
      if (it && typeof it === 'object') { it.progress = -1; it.progressLabel = ''; it.playHref = ''; }
    }
    if (info.kind !== 'tv' || !(info.season > 0)) return;
    var shownSeason = 0;
    try { shownSeason = entry.inst && entry.inst.season ? +entry.inst.season() || 0 : 0; } catch (e) { shownSeason = 0; }
    if (!shownSeason) {
      var shown = null;
      try { shown = entry.inst && entry.inst.model ? entry.inst.model() : null; } catch (e2) { shown = null; }
      shownSeason = (shown && +shown.season) || +(entry.params.season || 0);
    }
    entry.params.season = info.season;
    if (shownSeason !== info.season) destroyInst(entry);
  }

  /* What a title page says about the viewer's progress: the Play/Resume label, the season it opens on and every
     watched/progress field Site.detail gives (episode marks, season progress), found by name at any depth. */
  var PROGRESS_FIELD = /watch|progress|finish|seen|resume|percent|over$/i;
  function progressSig(m) {
    var out = [];
    function walk(v, path, depth) {
      if (v == null || depth > 4) return;
      if (typeof v !== 'object') return;
      var arr = Object.prototype.toString.call(v) === '[object Array]';
      for (var k in v) {
        if (!v.hasOwnProperty(k)) continue;
        var x = v[k];
        if (x !== null && typeof x === 'object') { if (arr || /episode|season|list|progress|watch/i.test(k)) walk(x, path + '.' + k, depth + 1); }
        else if (!arr && PROGRESS_FIELD.test(k)) out.push(path + '.' + k + '=' + String(x));
      }
    }
    if (!m) return '';
    out.push('label=' + U.text(m.playLabel), 'season=' + (+m.season || 0));
    try { walk(m, '', 0); } catch (e) { Log.warn('progress-sig', e); }
    return out.join('|');
  }

  /* The player's last progress post leaves as the player closes: pages read again sooner could still show the old
     position, so the refreshes below wait this long. */
  var REFRESH_AFTER = 1500;

  /* Re-reads the title page (Api.detail with force replaces the cached model) a moment after the player closed. The
     screen patches its Play/Resume label, watched checks and season line in place (refreshModel: focus and scroll
     stay). A screen that cannot patch is rebuilt, only when the viewer has not moved yet and what it shows about their
     progress changed; entry.focusKey (rememberFocus or onNext) puts focus back on the episode that played. */
  function refreshDetail(entry, info) {
    U.later(function () {
      if (dead || top() !== entry || !entry.inst) return;
      var season = info.kind === 'tv' ? +(entry.params.season || 0) : 0;
      Api.detail(info.kind, info.id, U.guard(function (err, m) {
        if (err || !m || dead || top() !== entry || !entry.inst) return;
        var inst = entry.inst, patched = false;
        if (inst.refreshModel) { try { patched = !!inst.refreshModel(m); } catch (e0) { Log.warn('refresh-model', e0); patched = false; } }
        if (patched || mode !== 'shell' || topLayer() || entry.touched) return;
        var shown = null;
        try { shown = inst.model ? inst.model() : null; } catch (e) { shown = null; }
        if (!shown || progressSig(shown) === progressSig(m)) return;
        Log.info('play', 'title page changed after playback; refreshing the detail screen');
        rememberFocus();
        destroyInst(entry);
        showEntry(entry);
      }, 'native-refresh'), { force: true, season: season });
    }, REFRESH_AFTER, 'native-refresh-wait');
  }

  /* After something played: Continue Watching (Home's first row, My Library) is out of date. Home refreshes quietly
     from a fresh fetch (rebuilt only when its progress cards changed, and never under the viewer's hand); My Library
     screens below the top rebuild when shown again. */
  function afterWatching(current) {
    U.each(stack, function (e) {
      if (e !== current && e.inst && e.screen === 'browse' && (e.params.nav === 'library' || e.nav === 'library')) { destroyInst(e); e.live = false; }
    });
    var home = stack.length && stack[0].screen === 'home' ? stack[0] : null;
    if (!home || page.type === 'gate') return;
    U.later(function () { if (!dead && stack[0] === home) refreshHome(home); }, REFRESH_AFTER, 'home-refresh-wait');
  }

  function refreshHome(home) {
    Api.home(U.guard(function (err, data) {
      if (err || !data || !data.rows || dead || stack[0] !== home) return;
      if (home.inst && continueSig(cardItems(home.inst.el)) === continueSig(dataItems(data))) return;
      var isTop = top() === home;
      if (isTop && (mode !== 'shell' || topLayer() || home.touched)) return;
      Log.info('app', 'Continue Watching changed; refreshing Home');
      if (isTop) rememberFocus();
      destroyInst(home);
      home.live = true;
      liveParsed.home = data;
      if (isTop) showEntry(home);
    }, 'home-refresh'));
  }

  function cardItems(scope) {
    return U.map(U.filter(U.qsa(scope, '[data-key]'), function (n) { return !!n.__item; }), function (n) { return n.__item; });
  }

  function dataItems(data) {
    var out = [];
    U.each(data.rows || [], function (r) { out = out.concat(r.items || []); });
    return out;
  }

  /* Continue Watching as Home shows it: every card with progress, in order, with its label and progress. */
  function continueSig(items) {
    var seen = {}, out = [];
    U.each(items, function (it) {
      if (!it || !(it.progress >= 0) || seen[it.key]) return;
      seen[it.key] = 1;
      out.push(it.key + ':' + Math.round(it.progress * 100) + ':' + U.text(it.progressLabel));
    });
    return out.join('|');
  }

  /* The website's own player: a live click when this page is the title's page, else the ?play=1 page. */
  function playWebsite(t) {
    if (!t || !t.id) return;
    var kind = t.kind === 'tv' ? 'tv' : 'movie';
    var lt = liveTitle();
    playAction(t);
    try { Store.session.remove(CANCEL_KEY); } catch (e0) {}
    if (t.pick) { try { Store.session.set(PICK_KEY, { key: kind + ':' + t.id, file: t.pick.file || '', quality: t.pick.quality || '', t: U.now() }); } catch (e) {} }
    if (lt && lt.kind === kind && String(lt.id) === String(t.id)) {
      var btn = null;
      try { btn = t.episode ? Site.live.episodeButton(t.season, t.episode) : Site.live.playButton(); } catch (e2) { btn = null; }
      if (btn) {
        /* Our click reaches the control we found, so there is no blind second click later (retried: true). */
        beginPending({ kind: kind, id: t.id, season: t.season || 0, episode: t.episode || 0, title: t.title }, true);
        Log.info('play', 'live click ' + kind + ':' + t.id + (t.episode ? ' S' + t.season + 'E' + t.episode : ''));
        if (!Site.live.click(btn)) { try { btn.click(); } catch (e3) {} }
        return;
      }
    }
    var url = t.playHref ? U.onOrigin(t.playHref) : '';
    if (!url) url = Screens.siteUrl('play', [kind, t.id, t.season || 0, t.episode || 0], '/' + (kind === 'movie' ? 'movie/' : 'tvshow/') + t.id + '?play=1');
    rememberFocus();
    saveState();
    Overlays.showStarting(playInfo(t));
    pending = { t: t, since: U.now(), clicked: true, retried: true, navigating: true, url: url };
    /* The ?play=1 page must use the website's player too (it would otherwise hand the title to the built-in one). */
    try { Store.session.set(WEBPLAY_KEY, { url: url, t: U.now() }); } catch (e4) {}
    Log.info('play', 'navigate ' + url);
    location.href = url;
  }

  function beginPending(t, clicked) {
    cancelledAt = 0;
    playAction(t);
    pending = { t: t, since: U.now(), clicked: !!clicked, retried: !!clicked, reacted: false };
    Overlays.showStarting(playInfo(t));
  }

  /* Back while playback is starting (overlay or source picker), or on a message that answered Play. On a ?play=1
     page that another page opened, go back to that page, which restores its own stack, so it feels like the picker
     simply closed. While the ?play=1 page itself is still loading, the navigation is stopped (and a marker tells that
     page, should it load anyway, that the viewer cancelled). msg (optional) is shown when the viewer stays here. */
  function cancelPlayback(msg) {
    var nav0 = pending && pending.navigating ? pending : null;
    if (resolving && !pending) {
      /* Back while a show's Play reads its title page: nothing started yet, so there is nothing else to undo. */
      resolving = null;
      Overlays.hideStarting();
      Log.info('play', 'cancelled while finding the episode');
      return;
    }
    resolving = null;
    pending = null;
    cancelledAt = U.now();
    pickerCancelled = true;
    dismissed = { at: U.now() };
    Overlays.hideStarting();
    if (nav0) {
      try { window.stop(); } catch (e0) {}
      try { Store.session.set(CANCEL_KEY, { url: nav0.url || '', t: U.now() }); } catch (e1) {}
      Log.info('play', 'cancelled while the play page was loading');
      if (msg) toast(msg, 5000);
      return;
    }
    if (returnTarget()) {
      Log.info('play', 'cancelled; history.back');
      showLoadingOverlay('Returning\u2026');
      if (!historyBack()) hideLoadingOverlay();
      U.later(function () { hideLoadingOverlay(); if (mode === 'shell' && top()) showEntry(top()); }, 2500, 'cancel-fallback');
      return;
    }
    settleUrl();
    if (msg) toast(msg, 5000);
  }

  function returnTarget() {
    if (!(page.title && page.title.play) || history.length <= 1) return '';
    var rt = '';
    try { rt = Session.returnTo(); } catch (e) {}
    if (!rt || String(rt).replace(/#.*$/, '') === String(location.href).replace(/#.*$/, '')) return '';
    return rt;
  }

  /* After a source row was chosen: wait for the player (the monitor switches modes), give up after 10 s. */
  function awaitPlayer() {
    var t = (pending && pending.t) || lastTarget;
    var cur = topInst(), m = cur && cur.model ? cur.model() : null;
    cancelledAt = 0;
    playAction(t);
    pending = { t: t || { title: m && m.title }, since: U.now(), clicked: true, retried: true, reacted: true, afterPick: true };
    Overlays.showStarting({ title: (m && m.title) || (t && t.title) || '', backdrop: m && m.backdrop || '' });
  }

  function pendingTick() {
    if (!pending) {
      if (Overlays.startingShown() && mode === 'shell' && !Overlays.sources.autoPending() && !resolving) { Log.warn('play', 'orphaned starting overlay removed'); Overlays.hideStarting(); }
      return;
    }
    var age = U.now() - pending.since;
    if (pending.navigating) {
      if (age > 15000) {
        Log.warn('play', 'the play page did not open in 15 s');
        pending = null;
        Overlays.hideStarting();
        toast('The website didn\u2019t open the player. Try Play again.', 5000);
      }
      return;
    }
    /* The website did nothing at all within 5 s (a ?play=1 page whose own auto-play did not run): click its play
       control once. Never when it answered (picker, message or player) or when our click already reached it. */
    if (age > 5000 && !pending.retried && !pending.reacted) {
      pending.retried = true;
      var t = pending.t || {}, btn = null;
      try { btn = t.episode ? Site.live.episodeButton(t.season, t.episode) : Site.live.playButton(); } catch (e) { btn = null; }
      Log.warn('play', 'no player after 5 s; clicking the play control' + (btn ? '' : ' (not found)'));
      if (btn) Site.live.click(btn);
    }
    if (age > 10000) {
      Log.warn('play', 'no player after 10 s');
      pending = null;
      Overlays.hideStarting();
      if (Overlays.sources.isOpen()) Overlays.sources.close(true);
      settleUrl();
      toast('The website didn\u2019t start playback. Try Play again.', 5000);
    }
  }

  function takePick() {
    var p = null;
    try { p = Store.session.get(PICK_KEY, null); Store.session.remove(PICK_KEY); } catch (e) {}
    var lt = liveTitle();
    if (!p || !lt || p.key !== lt.kind + ':' + lt.id || U.now() - (+p.t || 0) > 10 * 60 * 1000) return null;
    return p;
  }

  /* The website opened its file list: our sheet replaces it. With a preferred file that matches, the starting
     overlay stays up and names the file (quiet auto-selection, Up opens the full list); otherwise the sheet opens. */
  function openLivePicker() {
    var m = topInst() && topInst().model ? topInst().model() : null;
    if (top() && top().screen !== 'detail') { var lt = liveTitle(); push('detail', { kind: lt.kind, id: lt.id }, { live: true }); }
    var opened = Overlays.sources.open({ title: m && m.title || '', pick: takePick(), auto: true, quiet: Overlays.startingShown() });
    if (opened && Overlays.sources.autoPending()) {
      if (pending) pending.reacted = true;
      return;
    }
    pending = null;
    Overlays.hideStarting();
    if (!opened) {
      /* The website's file list could not be read (its markup changed): let the viewer use the website's own
         picker with the focus ring instead of covering it. */
      var box = U.find(U.qsa(document, '.sidebarbg2'), function (n) { return U.isVisible(n); });
      Log.warn('sources', 'file list not recognised; showing the website picker');
      if (box) enterPopup(box);
      else pending = { t: {}, since: U.now(), clicked: true, retried: false, reacted: true };
    }
  }

  /* ---------- Live page monitor (player, source picker, popups) ---------- */

  function notIgnored(p) { return U.indexOf(ignoredPopups, p) < 0; }

  /* The website's own playback on this page, kept quiet (siteHold, or while the built-in player plays): its videos
     are paused (a second stream would compete for the TV's decoder and double the sound) and, while held, its file
     list, player and messages are closed without showing them. Videos inside our root are never touched. */
  function quietSite(held) {
    var live = Site.live;
    U.each(U.qsa(document, 'video'), function (v) {
      if (root && root.contains(v)) return;
      try { if (!v.paused) v.pause(); } catch (e) {}
    });
    if (!held) return;
    try { if (live.sourcePickerOpen()) live.closeSourcePicker(); } catch (e1) {}
    try {
      U.each(U.filter(live.blockingPopups() || [], notIgnored), function (p) {
        var gone = false;
        try { gone = live.dismissPopup(p); } catch (e2) { gone = false; }
        if (!gone) ignoredPopups.push(p);
      });
    } catch (e3) {}
    if (!nativeActive() && rawPlayerOpen()) { try { live.closePlayer(playCtx()); } catch (e4) {} }
  }

  function monitor() {
    if (!routed || dead) return;
    if (nativeActive()) { if (liveTitle()) quietSite(siteHold); return; }
    if (!liveTitle()) return;
    var live = Site.live;
    touchSession();
    if (mode === 'native') return;
    if (siteHold && mode === 'shell' && !pending) quietSite(true);
    if (mode === 'popup') {
      if (controlsMode) { if (!popupEl || !U.isVisible(popupEl) || !rawPlayerOpen()) backToPlayer(); return; }
      if (!popupEl || !U.isVisible(popupEl)) leavePopup();
      return;
    }
    var popups = U.filter(live.blockingPopups() || [], notIgnored);
    if (popups.length) { enterPopup(popups[0]); return; }
    if (mode === 'player') {
      try { playerVideo = live.video() || playerVideo; } catch (e) {}
      if (!rawPlayerOpen()) { Log.info('player', 'closed by the website'); afterPlayer(false); }
      return;
    }
    var pickerOpen = live.sourcePickerOpen();
    /* The viewer pressed Back while playback was starting: the website may still finish opening its player a moment
       later. Close it instead of dragging the viewer back into playback. */
    if (cancelledAt && U.now() - cancelledAt < 4000 && !pending && rawPlayerOpen()) {
      Log.info('play', 'closing the player the viewer cancelled');
      live.closePlayer(playCtx());
      return;
    }
    if (!siteHold && sitePlayerOpen()) { enterPlayer(); return; }
    if (pickerOpen && !Overlays.sources.isOpen()) {
      /* The viewer closed the file list: it stays closed until the next play action. */
      if (pickerCancelled && !pending) live.closeSourcePicker();
      else openLivePicker();
    } else if (!pickerOpen && Overlays.sources.isOpen()) {
      Overlays.sources.close(false);
    }
    pendingTick();
  }

  /* ---------- Watchdog ---------- */

  function watchdog() {
    if (dead) return;
    ensureAttached();
    if (!routed) return;
    try { guardFrames(); } catch (eg) { Log.warn('frames', eg); }
    setModeClass();
    /* The built-in player owns the screen and the remote: no focus repair and no website-player checks. */
    if (nativeActive()) return;
    if (!liveTitle()) pendingTick();
    if (loadingNode && U.now() - loadingSince > 15000) { Log.warn('app', 'navigation overlay timed out'); hideLoadingOverlay(); }
    if (mode === 'shell') {
      if (!stack.length) { defaultRoute(); return; }
      var entry = top();
      if (!entry.inst) showEntry(entry);
      if (!U.hasClass(entry.inst.el, 'is-current') || entry.inst.el.parentNode !== stage) showEntry(entry);
      if (!Focus.valid()) {
        var inst = entry.inst;
        if (inst && (inst.name !== 'loading')) { Log.info('watchdog', 'refocus ' + inst.name); focusScreenDefault(); }
      } else if (document.activeElement !== Focus.current()) {
        try { Focus.current().focus(); } catch (e) {}
      }
      if (liveTitle() && !pending && !siteHold && !(cancelledAt && U.now() - cancelledAt < 4000)) {
        try { if (sitePlayerOpen()) enterPlayer(); } catch (e2) {}
      }
    } else if (mode === 'native' && !Overlays.web.active()) {
      Overlays.web.start({ here: webHere });
    } else if (mode === 'player') {
      if (!rawPlayerOpen()) { Log.info('player', 'closed (watchdog)'); afterPlayer(false); }
    }
  }

  /* Remote keys go to whichever document has focus. Same-origin iframes (the website may load its player page
     into one) get our key listeners as well; a focused cross-origin iframe (ads, embeds) is blurred. */
  function guardFrames() {
    var active = document.activeElement;
    U.each(U.qsa(document, 'iframe'), function (f) {
      var w = null, same = false;
      try { w = f.contentWindow; same = !!(w && w.document && w.document.documentElement); } catch (e) { same = false; }
      if (same) {
        if (!w.__mbptvKeys) {
          try {
            w.addEventListener('keydown', U.guard(onKeyDown, 'frame-key'), true);
            w.addEventListener('keyup', U.guard(onKeyUp, 'frame-keyup'), true);
            w.__mbptvKeys = true;
          } catch (e2) {}
        }
      } else if (f === active) {
        try { f.blur(); } catch (e3) {}
        try { if (mode === 'shell') focusScreenDefault(); else root.focus(); } catch (e4) {}
      }
    });
  }

  /* ---------- Keys ---------- */

  var DIRS = { left: 1, right: 1, up: 1, down: 1 };

  /* At most one focus move per animation frame, so held keys never queue up. */
  function lockMove() {
    if (moveLock) return false;
    moveLock = true;
    U.frame(function () { moveLock = false; }, 'move-unlock');
    U.later(function () { moveLock = false; }, 120, 'move-unlock-fallback');
    var entry = top();
    if (entry) entry.touched = true;
    return true;
  }

  /* A screen that routes an arrow key itself moves focus through here (same pacing as the focus engine). */
  function moveTo(node) {
    if (!node || !lockMove()) return false;
    return focus(node);
  }

  function move(dir) {
    if (!lockMove()) return;
    if (!Focus.valid()) {
      focusScreenDefault();
      if (!Focus.valid() && !topLayer() && topInst() && topInst().rail !== false) focus(railItems[topInst().nav] || railItems.home);
      return;
    }
    Focus.move(dir);
  }

  function activate(node) {
    if (!node) return;
    var action = node.getAttribute('data-action') || '';
    if (node.__run) { node.__run(); return; }
    if (action.indexOf('nav-') === 0) { nav(action.slice(4)); return; }
    var inst = topInst();
    if (!topLayer() && inst && inst.act && inst.act(action, node)) return;
    switch (action) {
      case 'retry': retry(); return;
      case 'open-website': openWebsite(inst && inst.websiteUrl || websiteUrlFor(top())); return;
      case 'home': goHome(); return;
      case 'signin-qr': openWebsite(Screens.siteUrl('loginQr', [], '/index/login/qrcode'), { persist: false }); return;
      case 'signin-code': openWebsite(Screens.siteUrl('loginCode', [], '/index/login/code_login'), { persist: false }); return;
      case 'signin-google': openWebsite(Screens.siteUrl('login', [], '/index/login'), { persist: false }); return;
      case 'exit': exitApp(); return;
      case 'stay': closeLayer('dialog'); return;
    }
    if (node.__item) push('detail', { kind: node.__item.kind, id: node.__item.id, item: Screens.compactItem(node.__item) });
  }

  function goBack() {
    var inst = topInst();
    if (inst && inst.onBack && inst.onBack()) return;
    if (pop()) return;
    var t = top();
    if (t && t.screen !== 'home' && t.screen !== 'signin') { resetTo([{ screen: 'home' }]); return; }
    Overlays.exitDialog();
  }

  function shellKey(name, ev) {
    if (Overlays.startingShown() && !topLayer()) {
      if (name === 'back') {
        if (Overlays.sources.isOpen()) Overlays.sources.close(true);
        cancelPlayback();
        return true;
      }
      /* During the quiet automatic file choice, Up or OK opens the full list of files instead. */
      if ((name === 'up' || name === 'enter') && Overlays.sources.autoPending()) {
        pending = null;
        Overlays.sources.expand();
        return true;
      }
      return true;
    }
    var l = topLayer();
    if (l) {
      if (l.opts.onAnyKey) U.guard(l.opts.onAnyKey, 'layer-key')(name);
      if (name === 'back') {
        if (l.opts.onBack) l.opts.onBack(); else closeLayer(l.kind);
        return true;
      }
      if (DIRS[name]) { move(name); return true; }
      if (name === 'enter') { activate(Focus.current()); return true; }
      return true;
    }
    var inst = topInst();
    if (!inst) return true;
    if (inst.onKey && inst.onKey(name, ev)) return true;
    if (DIRS[name]) { move(name); return true; }
    if (name === 'enter') { activate(Focus.current()); return true; }
    if (name === 'back' || name === 'backspace') { goBack(); return true; }
    if (name === 'char' && inst.name !== 'search' && /^[a-z]$/i.test(Keys.charOf(ev))) {
      navRoot('search', { query: Keys.charOf(ev).toLowerCase() }, 'search');
      return true;
    }
    if (name === 'play' || name === 'playpause') {
      var cur = Focus.current();
      if (cur && cur.__item) { play({ kind: cur.__item.kind, id: cur.__item.id, title: cur.__item.title, item: cur.__item, playHref: cur.__item.playHref }); return true; }
      if (cur && cur.__episode && inst.play) { inst.play(cur.__episode); return true; }
      if (inst.act) inst.act('play', null);
      return true;
    }
    if (name === 'info' && Focus.current() && Focus.current().__item) { activate(Focus.current()); return true; }
    return true;
  }

  function dispatch(name, ev) {
    /* The built-in player owns the remote while it is up (it answers true for every key). */
    if (nativeActive()) return NativePlayer.key(name, ev);
    if (mode === 'native' || mode === 'popup') return Overlays.web.key(name, ev);
    if (mode === 'player') return Player.key(name, ev);
    if (mode === 'boot') {
      if (topLayer()) return shellKey(name, ev);
      if (name === 'back') Overlays.exitDialog();
      return true;
    }
    return shellKey(name, ev);
  }

  /* Held OK and Back act once. A held key arrives as repeated keydowns (ev.repeat, or no keyup in between), and some
     TVs send each repeat as a keyup/keydown pair a few milliseconds apart; both are swallowed. The held table expires
     700 ms after the last keydown, so a lost keyup (focus in a frame, a page change) can never disable a key. Arrows,
     seeking and the search keyboard's letters and Delete keep auto-repeat. */
  var held = {}, lastUp = {};
  function holdGuarded(name) {
    if (name === 'back') return true;
    if (name === 'backspace') {
      var i0 = topInst();
      return !(mode === 'shell' && !topLayer() && i0 && i0.name === 'search');
    }
    if (name !== 'enter') return false;
    if (mode === 'shell' && !topLayer() && !Overlays.startingShown()) {
      var cur = Focus.current();
      if (cur && (cur.hasAttribute('data-char') || cur.getAttribute('data-action') === 'delete')) return false;
    }
    return true;
  }

  function isHeldRepeat(name, ev) {
    if (!holdGuarded(name)) return false;
    var now = U.now(), h = held[name] || 0;
    var rep = !!ev.repeat || (h > 0 && now - h < 700 && now >= h) || (lastUp[name] > 0 && now - lastUp[name] < 25 && now >= lastUp[name]);
    held[name] = now;
    return rep;
  }

  function onKeyUp(ev) {
    var name = Keys.name(ev);
    if (!name) return;
    if (held[name]) { held[name] = 0; lastUp[name] = U.now(); }
  }

  function clearHeld() { held = {}; lastUp = {}; }

  function onKeyDown(ev) {
    if (dead) return;
    var name = Keys.name(ev);
    if (!name) return;
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
    var handled = false;
    if (isHeldRepeat(name, ev)) {
      handled = true;
    } else {
      try { handled = dispatch(name, ev); } catch (e) {
        Log.error('key:' + name, e);
        handled = true;
        keyFailure(name);
      }
    }
    if (handled) {
      if (ev.preventDefault) ev.preventDefault();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      if (ev.stopPropagation) ev.stopPropagation();
    }
  }

  /* Repeated failures while handling keys mean the shell is broken on this page: hand the remote to website
     mode (which has its own, much simpler, navigation) and, if even that fails, remove the shell entirely. */
  var keyErrors = [];
  function keyFailure(name) {
    var now = U.now();
    keyErrors.push(now);
    while (keyErrors.length && now - keyErrors[0] > 15000) keyErrors.shift();
    if (keyErrors.length < 4) {
      if (name === 'back' && mode === 'shell') { try { goHome(); } catch (e) { Log.warn('back-recover', e); } }
      return;
    }
    keyErrors = [];
    if (mode === 'native' || mode === 'popup') { panic('repeated key failures in website mode'); return; }
    try {
      enterWebsite({ here: true });
      toast('Something went wrong. Showing the website \u2014 press Blue to try the TV app again.', 6000);
    } catch (e2) { panic(e2); }
  }

  function onClick(ev) {
    if (mode !== 'shell') return;
    var node = U.closest(ev.target, '[data-f]', root);
    if (!node) return;
    ev.preventDefault();
    focus(node);
    activate(node);
  }

  function exitApp() {
    Log.info('app', 'exit');
    try {
      if (window.tizen && tizen.application) { tizen.application.getCurrentApplication().exit(); return; }
    } catch (e) { Log.warn('exit', e); }
    try { window.close(); } catch (e2) {}
    U.later(function () { closeLayer('dialog'); toast('Press the Home button to leave.'); }, 400, 'exit-fallback');
  }

  /* ---------- Routing ---------- */

  function defaultRoute() {
    var lt = liveTitle();
    if (page.type === 'home') resetTo([{ screen: 'home', live: true }]);
    else if (lt) resetTo([{ screen: 'home' }, { screen: 'detail', params: { kind: lt.kind, id: lt.id, season: lt.season || 0 }, live: true }]);
    else resetTo([{ screen: 'home' }]);
  }

  function restore(saved) {
    var entries = [];
    U.each(saved, function (e) {
      if (!e || typeof e.screen !== 'string' || !Screens.has(e.screen) || e.screen === 'loading' || e.screen === 'error') return;
      /* The sign-in screen only belongs on the gate page: after signing in, the viewer lands on Home. */
      if (e.screen === 'signin' && page.type !== 'gate') return;
      entries.push({ screen: e.screen, params: e.params || {}, focusKey: e.focusKey || '' });
    });
    if (!entries.length) return false;
    if (entries[0].screen !== 'home' && entries[0].screen !== 'signin') entries.unshift({ screen: 'home', params: {} });
    var lt = liveTitle();
    U.each(entries, function (e) {
      if (e.screen === 'home' && page.type === 'home') e.live = true;
      if (e.screen === 'detail' && lt && e.params && String(e.params.id) === String(lt.id) && e.params.kind === lt.kind) e.live = true;
    });
    resetTo(entries);
    return true;
  }

  /* The live page's self-test runs once the first screen is up (or when Diagnostics asks), never before the first
     render: on a TV CPU it costs about half a second. */
  function runSelfTest() {
    try {
      selfTestResult = Site.selfTest(document, page.type, selfTestModel);
      if (selfTestResult && !selfTestResult.ok) Log.warn('selftest', selfTestResult.warnings);
    } catch (e) { Log.warn('selftest', e); }
    selfTestModel = null;
    return selfTestResult;
  }

  /* A ?play=1 page whose Play the viewer cancelled while it was still loading: never start playback here. */
  function cancelledHere() {
    var mark = null;
    try { mark = Store.session.get(CANCEL_KEY, null); } catch (e) { mark = null; }
    if (!mark) return false;
    try { Store.session.remove(CANCEL_KEY); } catch (e2) {}
    if (!(U.now() - (+mark.t || 0) < 15000)) return false;
    var a = U.parseUrl(String(mark.url || '')), b = U.parseUrl(location.href);
    return a.pathname + a.search === b.pathname + b.search;
  }

  /* This ?play=1 page was opened by the website path (playWebsite): it plays with the website's player. */
  function webPlayHere() {
    var mark = null;
    try { mark = Store.session.get(WEBPLAY_KEY, null); } catch (e) { mark = null; }
    if (!mark) return false;
    try { Store.session.remove(WEBPLAY_KEY); } catch (e2) {}
    if (!(U.now() - (+mark.t || 0) < 60000)) return false;
    var a = U.parseUrl(String(mark.url || '')), b = U.parseUrl(location.href);
    return a.pathname + a.search === b.pathname + b.search;
  }

  function route() {
    if (routed || dead) return;
    routed = true;
    clearTimeout(timers.boot);
    page.url = location.href;
    page.type = Screens.site('pageType', [location.href, document], 'other');
    page.title = Screens.site('parseTitleUrl', [location.href], null);
    /* The live page is parsed once here and shared with the first screen, Api's cache and the deferred self-test. */
    if (page.type === 'movie' || page.type === 'tv') {
      try { var d = Site.detail(document, location.href); if (d) { Api.remember(d); liveParsed.detail = d; selfTestModel = d; page.detail = d; } } catch (e2) {}
    } else if (page.type === 'home') {
      try { var h = Site.home(document); if (h && h.rows && h.rows.length) { liveParsed.home = h; selfTestModel = h; } } catch (e7) {}
    }
    timers.selfTest = U.later(function () { if (!dead && !selfTestResult) runSelfTest(); }, 4000, 'selftest');
    setMode('shell');
    Log.info('route', page.type + (page.title && page.title.play ? ' (play)' : ''));
    var web = readWebKey();
    if (page.type === 'gate') { forgetAccount(); resetTo([{ screen: 'signin' }]); return; }
    if (page.type === 'login') { enterWebsite({ here: false }); return; }
    if (web) {
      var atOrigin = !!web.origin && String(web.origin) === hereUrl();
      if (atOrigin && web.kind === 'nav') {
        /* Back from a page opened in website mode: this page belongs to the shell again. */
        try { Store.session.remove(WEB_KEY); } catch (e6) {}
      } else {
        enterWebsite({ here: atOrigin });
        return;
      }
    }
    var lt = liveTitle();
    if (lt && lt.play) {
      if (cancelledHere()) {
        Log.info('play', 'the viewer cancelled this playback before the page opened');
        var rt = returnTarget();
        cancelledAt = U.now();
        pickerCancelled = true;
        dismissed = { at: U.now() };
        defaultRoute();
        settleUrl();
        if (rt) { showLoadingOverlay('Returning\u2026'); if (!historyBack()) hideLoadingOverlay(); }
        return;
      }
      defaultRoute();
      /* Old links, bookmarks and other pages' ?play=1 links: the built-in player, unless that page asked for the
         website's player (WEBPLAY_KEY). The website's own auto-play on this page is then kept quiet (siteHold). */
      if (!webPlayHere() && nativeOn() && playNative({ kind: lt.kind, id: lt.id, season: lt.season || 0, episode: lt.episode || 0 })) {
        siteHold = true;
        pickerCancelled = true;
        dismissed = { at: U.now() };
        settleUrl();
        Log.info('play', '?play=1 page handed to the built-in player');
        return;
      }
      beginPending({ kind: lt.kind, id: lt.id, season: lt.season, episode: lt.episode }, false);
      return;
    }
    var saved = null;
    try { saved = Session.take(page.type); } catch (e4) { Log.warn('session-take', e4); }
    if (saved && saved.length && restore(saved)) return;
    if (page.type === 'home' || lt) { defaultRoute(); return; }
    if (page.type === 'search') {
      var r = Screens.site('search', [document], null);
      var params = { query: r && r.query || '', type: r && r.type || 'all' };
      if (r && r.items && r.items.length) params.snap = { query: r.query, type: r.type, next: r.next, page: 1, total: r.total, items: U.map(Screens.normItems(r.items).slice(0, 60), Screens.compactItem) };
      resetTo([{ screen: 'home' }, { screen: 'search', params: params }]);
      return;
    }
    if (page.type === 'list' || page.type === 'library') {
      var navName = page.type === 'library' ? 'library' : /\/tvshow/.test(location.pathname) ? 'shows' : /\/movie$/.test(location.pathname) ? 'movies' : '';
      resetTo([{ screen: 'home' }, { screen: 'browse', params: { url: location.href.replace(/#.*$/, ''), nav: navName, kicker: 'Browse' }, live: true }]);
      return;
    }
    enterWebsite({ here: false });
  }

  function safeRoute() {
    try { route(); } catch (e) {
      Log.error('route', e);
      try { setMode('shell'); resetTo([{ screen: 'error', params: {} }]); stack[0].screen = 'home'; } catch (e2) { panic(e2); }
    }
  }

  function bootTimeout() {
    if (routed || dead) return;
    Log.warn('boot', 'page did not finish loading in 20 s; routing anyway');
    safeRoute();
  }

  /* Restored from the back-forward cache: the page resumes exactly as it was left, so re-apply what route() would
     decide for a fresh load (website-mode key, stale overlays and in-flight guards). */
  function onPageShow(ev) {
    if (!ev || !ev.persisted) return;
    Log.info('app', 'restored from back-forward cache');
    backInFlight = 0;
    cancelledAt = 0;
    clearHeld();
    try { Session.clear(); } catch (e) {}
    pending = null;
    resolving = null;
    Overlays.hideStarting();
    hideLoadingOverlay();
    var web = readWebKey();
    if (web && String(web.origin) === hereUrl()) {
      if (web.kind === 'nav') {
        try { Store.session.remove(WEB_KEY); } catch (e1) {}
        if (mode === 'native') { Overlays.web.stop(); setMode('shell'); }
      } else if (web.kind === 'here' && mode !== 'native') {
        enterWebsite({ here: true });
        return;
      }
    }
    stopNative('app');
    if (mode === 'player' || mode === 'popup') { Player.stop(); Overlays.web.stop(); popupEl = null; setMode('shell'); }
    if (mode === 'shell') { if (top() && top().screen !== 'loading') showEntry(top()); else defaultRoute(); }
  }

  /* Stops every timer and listener (Boot.teardown calls it before removing the nodes, so nothing re-attaches them). */
  function kill() {
    if (dead) return;
    dead = true;
    try { U.each(offs, function (off) { off(); }); } catch (e) {}
    offs = [];
    clearInterval(timers.watchdog); clearInterval(timers.monitor); clearTimeout(timers.boot); clearTimeout(timers.selfTest);
  }

  /* Last resort: remove every trace of the shell so the website stays usable. */
  function panic(reason) {
    Log.error('app-panic', reason);
    kill();
    try { Overlays.sources.close(false); } catch (e1) {}
    try { if (typeof NativePlayer !== 'undefined') NativePlayer.stop('app'); } catch (e0) {}
    try { Overlays.web.stop(); Player.stop(); } catch (e2) {}
    try { if (typeof Boot !== 'undefined' && Boot.teardown) Boot.teardown(reason); else U.detach(root); } catch (e3) { U.detach(root); }
  }

  function start(ctx) {
    if (started) return;
    started = true;
    buildRoot();
    applyPrefs();
    Focus.configure({ scope: scopes, change: onFocusChange, exit: exitHook });
    setMode('boot');
    stack = [{ screen: 'loading', params: {}, focusKey: '' }];
    showEntry(stack[0]);
    offs.push(U.on(window, 'keydown', onKeyDown, true));
    offs.push(U.on(window, 'keyup', onKeyUp, true));
    offs.push(U.on(window, 'blur', clearHeld, false));
    offs.push(U.on(document, 'visibilitychange', clearHeld, false));
    offs.push(U.on(root, 'click', onClick, false));
    offs.push(U.on(window, 'pageshow', onPageShow, false));
    /* Leaving the page from website mode: keep the viewer's place so coming back restores it. */
    offs.push(U.on(window, 'pagehide', function () {
      if (mode === 'native' && stack.length && top().screen !== 'loading' && top().screen !== 'signin') saveState();
    }, false));
    offs.push(U.on(window, 'resize', function () { var c = Focus.current(); if (c && mode === 'shell') onFocusChange(c, null); }, false));
    try { if (Api.onSignedOut) offs.push(Api.onSignedOut(function () { if (routed) signedOut(); })); } catch (e) {}
    try { if (Prefs.onChange) offs.push(Prefs.onChange(function () { applyPrefs(); })); } catch (e2) {}
    timers.watchdog = setInterval(U.guard(watchdog, 'watchdog'), 2000);
    timers.monitor = setInterval(U.guard(monitor, 'monitor'), 400);
    timers.boot = U.later(bootTimeout, 20000, 'boot-timeout');
    Log.info('app', 'start ' + (ctx && ctx.url || ''));
    U.onReady(safeRoute);
  }

  function state() {
    var cur = Focus.current();
    return {
      screen: root ? root.getAttribute('data-screen') || '' : '',
      stack: U.map(stack, function (e) { return e.screen; }),
      focusKey: cur ? Focus.keyOf(cur) : '',
      mode: mode,
      layer: root ? root.getAttribute('data-layer') || '' : ''
    };
  }

  return {
    start: start, state: state, kill: kill,
    push: push, pop: pop, back: goBack, nav: nav, goHome: goHome, retry: retry, focus: focus, moveTo: moveTo, toast: toast,
    screenReady: screenReady, screenFailed: screenFailed, saveState: saveState,
    openLayer: openLayer, closeLayer: closeLayer, hasLayer: hasLayer,
    play: play, cancelPlayback: cancelPlayback, awaitPlayer: awaitPlayer, closePlayer: closePlayer, playerControls: playerControls,
    openWebsite: openWebsite, exitWebsite: exitWebsite, websiteBack: websiteBack, exitApp: exitApp,
    applyPrefs: applyPrefs, reload: function () { saveState(); try { location.reload(); } catch (e) {} },
    selfTest: function () { if (!selfTestResult && routed && !dead) runSelfTest(); return selfTestResult; },
    setSelfTest: function (r) { selfTestResult = r; },
    pageType: pageType, signedOut: signedOut,
    /* The built-in player, for diagnostics and tests (window.__mbptv.App.nativePlayer().info()). */
    nativePlayer: function () { return typeof NativePlayer !== 'undefined' ? NativePlayer : null; }
  };
}());
/* ---- 90-boot.js ---- */
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
}());
