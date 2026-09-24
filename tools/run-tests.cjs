// Runs every test/*.test.cjs sequentially. Each test file is standalone (node test/x.test.cjs).
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const only = process.argv.slice(2);
const build = spawnSync(process.execPath, [path.join(__dirname, 'build.cjs')], { stdio: 'inherit' });
if (build.status) process.exit(build.status);
const lint = spawnSync(process.execPath, [path.join(__dirname, 'lint.cjs')], { stdio: 'inherit' });
if (lint.status) process.exit(lint.status);
const tests = fs.readdirSync(path.join(root, 'test')).filter(f => /\.test\.cjs$/.test(f)).filter(f => !only.length || only.some(o => f.indexOf(o) >= 0)).sort();
let failed = 0;
for (const t of tests) {
  console.log('\n== ' + t);
  const r = spawnSync(process.execPath, [path.join(root, 'test', t)], { stdio: 'inherit' });
  if (r.status) { failed++; console.log('FAILED: ' + t); }
}
console.log(`\n${tests.length - failed}/${tests.length} test files passed.`);
process.exit(failed ? 1 : 0);
