// The lint (tools/lint.cjs) catches HTML-injection sinks and banned APIs that the old line scanner missed, and never
// flags banned tokens that only appear inside strings, regular expressions or comments. Standalone: node test/lint.test.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const { makeRunner, root } = require('./helpers.cjs');

const LINT = path.join(root, 'tools', 'lint.cjs');
const TV = path.join(root, 'tv.js');
const WORK = path.join(root, 'test', 'artifacts', 'lint-cases');

function lintWith(extra) {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  for (const f of fs.readdirSync(path.join(root, 'src'))) fs.copyFileSync(path.join(root, 'src', f), path.join(WORK, f));
  if (extra) fs.writeFileSync(path.join(WORK, '99-case.js'), extra);
  const r = spawnSync(process.execPath, [LINT, TV, WORK], { encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const t = makeRunner('lint');

t.test('the real sources pass', async () => {
  const r = lintWith('');
  assert.strictEqual(r.status, 0, r.out);
});

t.test('HTML sinks are caught wherever they hide (after a URL string, next to U.svg, as calls or attributes)', async () => {
  const cases = [
    ["var Case = {}; function a(el) { var u = 'https://example.org/'; document.body.innerHTML = String(location.hash); }", /99-case\.js:1: innerHTML assignment/],
    ["var Case = {}; function b(el) { el.insertAdjacentHTML('beforeend', String(el.title)); }", /HTML sink insertAdjacentHTML/],
    ["var Case = {}; function c(el) { el.outerHTML = el.title; U.svg(''); }", /outerHTML assignment/],
    ["var Case = {}; function d() { document.write(location.search); }", /HTML sink write/],
    ["var Case = {}; function e(el) { el.setAttribute('onclick', 'x()'); }", /setAttribute\('onclick'\)/],
    ["var Case = {}; function f(el, n) { el.setAttribute(n, 'x'); }", /setAttribute with a computed attribute name/],
    ["var Case = {}; function g(el) { el['innerHTML'] = el.title; }", /innerHTML assignment/],
    ["var Case = { href: 'javascript:void(0)' };", /javascript: URL string/]
  ];
  for (const [code, re] of cases) {
    const r = lintWith(code);
    assert.strictEqual(r.status, 1, 'expected a lint failure for: ' + code + '\n' + r.out);
    assert.ok(re.test(r.out), 'expected ' + re + ' for: ' + code + '\n' + r.out);
  }
});

t.test('banned APIs after a URL string on the same line are caught; banned words inside strings, regexes and comments are not', async () => {
  const caught = lintWith("var Case = {}; function h(l) { var u = 'https://x.example/a'; return l.includes('a'); }");
  assert.strictEqual(caught.status, 1, caught.out);
  assert.ok(/banned \.includes\(\)/.test(caught.out), caught.out);
  const clean = lintWith([
    "var Case = { a: 'abc.includes(1) and jwplayer and fetch(', b: /\\.find\\(|Promise/, c: \"$('x')\" };",
    '/* Promise, fetch(), .forEach( and jQuery in a comment are fine */',
    "// so is a line comment: new URL('x')"
  ].join('\n'));
  assert.strictEqual(clean.status, 0, clean.out);
});

t.run().then(() => fs.rmSync(WORK, { recursive: true, force: true }));
