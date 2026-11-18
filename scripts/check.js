'use strict';
/* Syntax check for all JavaScript sources (no extra tooling needed). */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const roots = ['src', 'test', 'scripts'];
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'screenshots') walk(p); }
    else if (e.name.endsWith('.js')) files.push(p);
  }
};
roots.filter((r) => fs.existsSync(r)).forEach(walk);
let failed = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (err) { failed++; console.error(`✗ ${f}\n${String(err.stderr)}`); }
}
console.log(`${files.length - failed}/${files.length} Dateien syntaktisch korrekt`);
process.exit(failed ? 1 : 0);
