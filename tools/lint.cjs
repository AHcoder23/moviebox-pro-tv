// ES5 + Tizen-compat lint for the built module and CSS. Usage: node tools/lint.cjs [tv.js] [srcDir]
//  1. tv.js must parse as ES5 (acorn, ecmaVersion 5).
//  2. Banned APIs (docs/ARCHITECTURE.md section 9) are scanned per src/*.js file on code only: strings, regular
//     expressions and comments are blanked out with acorn's tokenizer first, so a URL string or a regex never hides
//     or fakes a match.
//  3. HTML-injection sinks are checked on the syntax tree (section 7: never inject HTML strings built from site data).
//  4. Banned CSS features are scanned in src/*.css.
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require(path.join(__dirname, 'node_modules', 'acorn'));
const root = path.resolve(__dirname, '..');
const file = path.resolve(process.argv[2] || path.join(root, 'tv.js'));
const srcDir = path.resolve(process.argv[3] || path.join(root, 'src'));
const problems = [];

try {
  acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 5, sourceType: 'script' });
} catch (e) {
  problems.push('ES5 syntax: ' + e.message);
}

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

/* Source with every string, regex and comment replaced by spaces (newlines kept, so line numbers stay). */
function codeOnly(src) {
  const chars = src.split('');
  const blank = (a, b) => { for (let i = a; i < b; i++) if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' '; };
  const tokens = acorn.tokenizer(src, { ecmaVersion: 5, onComment: (block, text, start, end) => blank(start, end) });
  for (const t of tokens) {
    const label = t.type.label;
    if (label === 'string') blank(t.start + 1, t.end - 1);
    else if (label === 'regexp') blank(t.start, t.end);
  }
  return chars.join('');
}

/* Minimal recursive walker over an ESTree tree with an ancestor stack. */
function walk(node, visit, ancestors) {
  if (!node || typeof node.type !== 'string') return;
  ancestors = ancestors || [];
  visit(node, ancestors);
  ancestors.push(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, visit, ancestors); }
    else if (v && typeof v.type === 'string') walk(v, visit, ancestors);
  }
  ancestors.pop();
}

function propName(m) {
  if (!m || m.type !== 'MemberExpression') return '';
  if (!m.computed && m.property.type === 'Identifier') return m.property.name;
  if (m.computed && m.property.type === 'Literal') return String(m.property.value);
  return '';
}

function enclosingFunction(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i];
    if (a.type === 'FunctionDeclaration' && a.id) return a.id.name;
    if (a.type === 'FunctionExpression') return a.id ? a.id.name : '(anonymous)';
  }
  return '';
}

// innerHTML is allowed only for author-written SVG (U.svg) and the DOMParser fallback (U.parseHTML); setAttribute with
// a computed name only in the U.attr helper, whose callers pass fixed names.
const HTML_ALLOW = { '00-core.js': ['svg', 'parseHTML'] };
const ATTR_ALLOW = { '00-core.js': ['attr'] };
const HTML_CALLS = /^(?:insertAdjacentHTML|write|writeln|createContextualFragment)$/;

function sinkChecks(f, src) {
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 5, sourceType: 'script', locations: true }); } catch (e) { problems.push(`${f}: ES5 syntax: ${e.message}`); return; }
  walk(ast, (n, anc) => {
    const at = n.loc ? `${f}:${n.loc.start.line}` : f;
    if (n.type === 'AssignmentExpression' && /^(?:innerHTML|outerHTML)$/.test(propName(n.left))) {
      if ((HTML_ALLOW[f] || []).indexOf(enclosingFunction(anc)) < 0) problems.push(`${at}: ${propName(n.left)} assignment (only static SVG in U.svg or the U.parseHTML fallback)`);
    }
    if (n.type === 'CallExpression' && HTML_CALLS.test(propName(n.callee))) problems.push(`${at}: HTML sink ${propName(n.callee)}()`);
    if (n.type === 'CallExpression' && propName(n.callee) === 'setAttribute') {
      const a0 = n.arguments[0];
      if (!a0 || a0.type !== 'Literal') {
        if ((ATTR_ALLOW[f] || []).indexOf(enclosingFunction(anc)) < 0) problems.push(`${at}: setAttribute with a computed attribute name`);
      } else if (/^on/i.test(String(a0.value)) || /^srcdoc$/i.test(String(a0.value))) problems.push(`${at}: setAttribute('${a0.value}') (event handler or srcdoc)`);
    }
    if (n.type === 'Literal' && typeof n.value === 'string' && !n.regex && /^\s*javascript:/i.test(n.value)) problems.push(`${at}: javascript: URL string`);
  });
}

for (const f of fs.readdirSync(srcDir).filter(f => /\.js$/.test(f))) {
  const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
  let bare;
  try { bare = codeOnly(src); } catch (e) { problems.push(`${f}: tokenizer: ${e.message}`); continue; }
  const lines = src.split(/\r?\n/);
  bare.split(/\r?\n/).forEach((line, i) => {
    for (const [re, label] of jsBans) if (re.test(line)) problems.push(`${f}:${i + 1}: banned ${label}: ${lines[i].trim().slice(0, 120)}`);
  });
  sinkChecks(f, src);
}

for (const cssName of fs.readdirSync(srcDir).filter(f => /\.css$/.test(f))) {
  const css = fs.readFileSync(path.join(srcDir, cssName), 'utf8');
  const cssBans = [[/var\(/, 'var()'], [/(^|[;{\s])gap\s*:/, 'gap'], [/display\s*:\s*grid/, 'display:grid'], [/(^|[;{\s])inset\s*:/, 'inset'],
    [/position\s*:\s*sticky/, 'sticky'], [/backdrop-filter/, 'backdrop-filter'], [/filter\s*:\s*blur/, 'filter:blur'], [/aspect-ratio/, 'aspect-ratio'],
    [/:focus-visible/, ':focus-visible'], [/:is\(/, ':is()'], [/:where\(/, ':where()'], [/clamp\(/, 'clamp()'], [/[^-\w]min\(/, 'min()'], [/[^-\w]max\(/, 'max()'], [/@supports/, '@supports'], [/(^|[^-\w])rem\b/, 'rem units']];
  css.split(/\r?\n/).forEach((line, i) => { for (const [re, label] of cssBans) if (re.test(line)) problems.push(`${cssName}:${i + 1}: banned ${label}: ${line.trim().slice(0, 120)}`); });
}

if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} lint problem(s).`); process.exit(1); }
console.log('Lint OK: ' + path.relative(root, file) + ' is ES5, uses no banned APIs and has no HTML-injection sinks.');
