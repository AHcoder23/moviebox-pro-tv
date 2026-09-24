// Builds tv.js from src/. Usage: node tools/build.cjs [--out path]
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(root, 'tv.js');
const srcDir = path.join(root, 'src');
const files = fs.readdirSync(srcDir).filter(f => /^\d\d-[\w-]+\.js$/.test(f)).sort();
const css = fs.readFileSync(path.join(srcDir, 'shell.css'), 'utf8').replace(/\r\n/g, '\n');
const lines = [
  '/* MovieBox Pro TV ' + pkg.version + ' — independent TizenBrew module. MIT license. Built from src/; do not edit by hand. */',
  '(function () {',
  "  'use strict';",
  '  var VERSION = ' + JSON.stringify(pkg.version) + ';',
  '  var START_URL = ' + JSON.stringify(pkg.websiteURL) + ';',
  '  var CSS_TEXT = ' + JSON.stringify(css) + ';'
];
for (const f of files) {
  lines.push('/* ---- ' + f + ' ---- */');
  lines.push(fs.readFileSync(path.join(srcDir, f), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, ''));
}
lines.push('}());', '');
fs.writeFileSync(out, lines.join('\n'));
console.log('Built ' + path.relative(root, out) + ' (' + fs.statSync(out).size + ' bytes) from ' + files.join(', ') + ' + shell.css');
