// Local preview: builds tv.js, serves the offline mock MovieBox site with tv.js injected, and rebuilds when src/ changes.
// Usage: node tools/preview.cjs [port]   (default 8940). Open the printed URL in Edge or Chrome and use the arrow keys,
// Enter (OK), Escape (Back) and Backspace. Nothing here contacts the real website.
'use strict';
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawnSync } = require('child_process');
const mockSite = require('./mock-site.cjs');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const port = parseInt(process.argv.slice(2).find(a => /^\d+$/.test(a)) || process.env.PORT || '8940', 10);

function stamp() { return new Date().toTimeString().slice(0, 8); }

// Builds and lints; prints a one-line result (full output only on failure). Returns true when tv.js was rebuilt.
function rebuild(reason) {
  const build = spawnSync(process.execPath, [path.join(__dirname, 'build.cjs')], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) {
    console.log(`[${stamp()}] BUILD FAILED (${reason}); the server keeps serving the previous tv.js.\n${build.stdout}${build.stderr}`);
    return false;
  }
  const lint = spawnSync(process.execPath, [path.join(__dirname, 'lint.cjs')], { cwd: root, encoding: 'utf8' });
  const lintMsg = lint.status === 0 ? 'lint OK' : 'LINT PROBLEMS (fix before committing):\n' + (lint.stdout + lint.stderr).trim();
  console.log(`[${stamp()}] ${build.stdout.trim()} (${reason}); ${lintMsg}`);
  return true;
}

function portFree(p) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(p, '127.0.0.1');
  });
}

function watch() {
  let timer = null, pending = [];
  const schedule = what => {
    pending.push(what);
    clearTimeout(timer);
    timer = setTimeout(() => { const why = Array.from(new Set(pending)).join(', '); pending = []; rebuild(why + ' changed'); }, 200);
  };
  try {
    fs.watch(srcDir, (event, file) => { if (file && /\.(js|css)$/.test(file)) schedule('src/' + file); });
  } catch (e) {
    console.log('Could not watch src/ (' + e.message + '); restart the preview after edits.');
  }
  try { fs.watch(path.join(root, 'package.json'), () => schedule('package.json')); } catch (e) { /* optional */ }
}

(async () => {
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('Port must be 1-65535.'); process.exit(1); }
  if (!(await portFree(port))) {
    console.error(`Port ${port} is already in use. Stop the other preview or run: node tools/preview.cjs ${port + 1}`);
    process.exit(1);
  }
  rebuild('startup');
  const site = await mockSite.start({ port, inject: true });
  watch();
  console.log([
    '',
    'MovieBox Pro TV preview (offline mock site, tv.js injected): ' + site.origin + '/',
    '  Keys: arrows move, Enter = OK, Escape = Back, Backspace deletes, digits and letters type in Search.',
    '  Pages: ' + site.origin + '/movie/40102  ' + site.origin + '/tvshow/556  ' + site.origin + '/movie/40102?play=1',
    '  Signed-out gate: ' + site.origin + '/__mock/signout   (restore: /__mock/signin)',
    '  For the TV look, use DevTools device emulation at 1920x1080. Edits in src/ rebuild automatically; reload the page.',
    '  Ctrl+C stops the server.',
    ''
  ].join('\n'));
  const stop = () => { site.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch(e => { console.error(e); process.exit(1); });
