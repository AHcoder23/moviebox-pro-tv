// Shared Playwright helpers. Tests emulate TizenBrew: tv.js is evaluated at document start via addInitScript.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('../tools/node_modules/playwright-core');
const mockSite = require('../tools/mock-site.cjs');

const root = path.resolve(__dirname, '..');
const TIZEN_UA = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36';
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));

async function launch() {
  const opts = { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] };
  if (process.env.PW_CHANNEL) opts.channel = process.env.PW_CHANNEL; else if (EDGE) opts.executablePath = EDGE;
  return chromium.launch(opts);
}

function tvScript() { return fs.readFileSync(path.join(root, 'tv.js'), 'utf8'); }

// opts: { tv: true, twice: false, ua: TIZEN_UA, viewport }
async function openPage(browser, opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 1920, height: 1080 }, userAgent: opts.ua || TIZEN_UA, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e && e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' && /MovieBox TV/.test(m.text())) page.errors.push(m.text()); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  if (opts.tv !== false) {
    const code = tvScript();
    await context.addInitScript({ content: code });
    if (opts.twice) await context.addInitScript({ content: code });
  }
  page.context_ = context;
  return page;
}

async function press(page, key, times = 1, delay = 40) {
  for (let i = 0; i < times; i++) { await page.keyboard.press(key); await page.waitForTimeout(delay); }
}

// Remote Back is keyCode 10009 on Tizen; Escape maps to it on desktop.
async function back(page) { await press(page, 'Escape'); }

async function focused(page) {
  return page.evaluate(() => {
    const el = document.querySelector('#mbptv .is-focused') || document.activeElement;
    if (!el) return null;
    return { text: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80), key: el.getAttribute('data-key') || '', zone: (el.closest('[data-zone]') || {}).getAttribute ? el.closest('[data-zone]').getAttribute('data-zone') : '' };
  });
}

async function screen(page) {
  return page.evaluate(() => { const r = document.getElementById('mbptv'); return r ? r.getAttribute('data-screen') || '' : ''; });
}

function makeRunner(name) {
  const cases = [];
  let passed = 0, failed = 0;
  return {
    test: (title, fn) => cases.push({ title, fn }),
    run: async () => {
      for (const c of cases) {
        const t0 = Date.now();
        try { await c.fn(); passed++; console.log(`  ok   ${c.title} (${Date.now() - t0}ms)`); }
        catch (e) { failed++; console.log(`  FAIL ${c.title}\n       ${String(e && e.stack || e).split('\n').slice(0, 6).join('\n       ')}`); }
      }
      console.log(`${name}: ${passed} passed, ${failed} failed`);
      if (failed) process.exitCode = 1;
    }
  };
}

module.exports = { launch, openPage, press, back, focused, screen, makeRunner, mockSite, tvScript, TIZEN_UA, root };
