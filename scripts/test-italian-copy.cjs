const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const m = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/italian.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: m, exports: m.exports });
const { countLabel } = m.exports;
assert.equal(countLabel(0, 'incontro', 'incontri'), '0 incontri');
assert.equal(countLabel(1, 'incontro', 'incontri'), '1 incontro');
assert.equal(countLabel(2, 'incontro', 'incontri'), '2 incontri');
assert.equal(countLabel(1, 'minuto rimanente', 'minuti rimanenti'), '1 minuto rimanente');
assert.equal(countLabel(1.5, 'ora', 'ore'), '1,5 ore');
assert.equal(countLabel(10000, 'desiderio', 'desideri'), '10.000 desideri');
assert.equal(countLabel(-1, 'punto', 'punti'), '-1 punto');
console.log('PASS accordi singolare/plurale e numeri italiani');
