// ES5 + Tizen-compat lint for the built module and CSS. Usage: node tools/lint.cjs [tv.js]
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require(path.join(__dirname, 'node_modules', 'acorn'));
const root = path.resolve(__dirname, '..');
const file = path.resolve(process.argv[2] || path.join(root, 'tv.js'));
const code = fs.readFileSync(file, 'utf8');
const problems = [];
try {
  acorn.parse(code, { ecmaVersion: 5, sourceType: 'script' });
} catch (e) {
  problems.push('ES5 syntax: ' + e.message);
}
// Strip strings/comments crudely for token scans: scan source files individually instead.
const srcDir = path.join(root, 'src');
const jsBans = [
  [/\bfetch\s*\(/, 'fetch()'], [/\bPromise\b/, 'Promise'], [/Object\.assign\b/, 'Object.assign'], [/Array\.from\b/, 'Array.from'],
  [/\.includes\s*\(/, '.includes()'], [/\.startsWith\s*\(/, '.startsWith()'], [/\.endsWith\s*\(/, '.endsWith()'],
  [/\.padStart\s*\(/, '.padStart()'], [/\.repeat\s*\(/, '.repeat()'], [/(?<!\bU)\.find\s*\(/, '.find() (use U.find)'], [/\.findIndex\s*\(/, '.findIndex()'],
  [/(?<!\bU)\.closest\s*\(/, 'Element.closest (use U.closest)'], [/\.forEach\s*\(/, '.forEach (use U.each)'],
  [/\.(?:append|prepend)\s*\(/, 'append/prepend'], [/\bIntersectionObserver\b/, 'IntersectionObserver'], [/\brequestIdleCallback\b/, 'requestIdleCallback'],
  [/\bnew\s+URL\s*\(/, 'URL constructor'], [/\bURLSearchParams\b/, 'URLSearchParams'], [/\bnew\s+(?:Map|Set|WeakMap|WeakSet)\b/, 'Map/Set'],
  [/\bSymbol\b/, 'Symbol'], [/\?\./, 'optional chaining'], [/\?\?/, 'nullish coalescing'], [/\beval\s*\(/, 'eval'], [/\bnew\s+Function\b/, 'new Function'],
  [/\.toggle\s*\([^,)]+,/, 'classList.toggle(x, force)'], [/\.remove\s*\(\s*\)/, 'Element.remove()'],
  // Missing in Chromium 47 (Tizen 3): these would throw on 2017 TVs.
  [/\bObject\.(?:values|entries|fromEntries|getOwnPropertyDescriptors)\b/, 'Object.values/entries/fromEntries'],
  [/\.at\s*\(/, '.at()'], [/\.flat(?:Map)?\s*\(/, '.flat()/.flatMap()'], [/\.trim(?:Start|End)\s*\(/, '.trimStart()/.trimEnd()'],
  [/\.replaceAll\s*\(/, '.replaceAll()'], [/\.padEnd\s*\(/, '.padEnd()'], [/\.findLast(?:Index)?\s*\(/, '.findLast()'],
  [/\.isConnected\b/, 'Node.isConnected'], [/\.getAttributeNames\s*\(/, 'getAttributeNames()'], [/\bstructuredClone\b/, 'structuredClone'],
  [/\bqueueMicrotask\b/, 'queueMicrotask'], [/\bglobalThis\b/, 'globalThis'], [/\bAbortController\b/, 'AbortController'],
  [/\bResizeObserver\b/, 'ResizeObserver'], [/\.scrollIntoView\s*\(/, 'scrollIntoView (layout scrolls by transform only)'],
  [/\bnew\s+(?:CustomEvent|KeyboardEvent|MouseEvent|Event)\s*\(/, 'event constructors (use document.createEvent)'],
  // The module may run in an isolated world: never depend on the site's own JS (section 7).
  [/\bjQuery\b|\$\s*\(|\bjwplayer\b|\binit_player\b/, 'site JS globals (interact through the DOM only)']
];
for (const f of fs.readdirSync(srcDir).filter(f => /\.js$/.test(f))) {
  const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    const bare = line.replace(/\/\/.*$/, '').replace(/'(?:[^'\]|\.)*'/g, "''").replace(/"(?:[^"\]|\.)*"/g, '""').replace(/\/(?:[^\/\\n]|\.)+\/[gimy]*/g, '/re/');
    for (const [re, label] of jsBans) if (re.test(bare)) problems.push(`${f}:${i + 1}: banned ${label}: ${line.trim().slice(0, 120)}`);
    if (/\binnerHTML\s*=/.test(bare) && !/U\.svg|holder\.innerHTML = markup|doc\.documentElement\.innerHTML/.test(line)) problems.push(`${f}:${i + 1}: innerHTML assignment (only static SVG or DOMParser fallback allowed)`);
  });
}
const cssFile = path.join(srcDir, 'shell.css');
if (fs.existsSync(cssFile)) {
  const css = fs.readFileSync(cssFile, 'utf8');
  const cssBans = [[/var\(/, 'var()'], [/(^|[;{\s])gap\s*:/, 'gap'], [/display\s*:\s*grid/, 'display:grid'], [/(^|[;{\s])inset\s*:/, 'inset'],
    [/position\s*:\s*sticky/, 'sticky'], [/backdrop-filter/, 'backdrop-filter'], [/filter\s*:\s*blur/, 'filter:blur'], [/aspect-ratio/, 'aspect-ratio'],
    [/:focus-visible/, ':focus-visible'], [/:is\(/, ':is()'], [/:where\(/, ':where()'], [/clamp\(/, 'clamp()'], [/[^-\w]min\(/, 'min()'], [/[^-\w]max\(/, 'max()'], [/@supports/, '@supports'], [/(^|[^-\w])rem\b/, 'rem units']];
  css.split(/\r?\n/).forEach((line, i) => { for (const [re, label] of cssBans) if (re.test(line)) problems.push(`shell.css:${i + 1}: banned ${label}: ${line.trim().slice(0, 120)}`); });
}
if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} lint problem(s).`); process.exit(1); }
console.log('Lint OK: ' + path.relative(root, file) + ' is ES5 and uses no banned APIs.');
