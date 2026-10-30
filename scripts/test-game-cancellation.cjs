const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports });
  return module.exports;
}
const { computeTrisStats, winningLine, isFull } = load('src/utils/tris.ts');
const { mergeTrisRows } = load('src/state/gameRows.ts');
const match = (id, status, board, winner = null) => ({ id, game: 'tris', player_x: 'a', player_o: 'b', turn: 'a', status, board, winner, created_at: `2026-10-16T12:00:0${id}Z` });
const history = [match('1', 'draw', 'XOXXOOOXX'), match('2', 'won', 'XXXOO----', 'a'), match('3', 'won', 'OOOXX----', 'b')];
const playing = match('4', 'playing', 'XO-------');
const before = computeTrisStats([...history, playing], 'a', 'b');
const cancelled = { ...playing, status: 'cancelled' };
const rows = mergeTrisRows([...history, playing], cancelled, ['a', 'b']);
assert.equal(rows[0].id, playing.id, 'Cancelled match remains the most recent instead of revealing a previous draw');
assert.equal(rows[0].status, 'cancelled');
assert.deepEqual(JSON.parse(JSON.stringify(computeTrisStats(rows, 'a', 'b'))), JSON.parse(JSON.stringify(before)), 'Cancellation changes no score');
assert.equal(before.draws, 1, 'Actual draws remain counted');
assert.equal(before.myWins, 1); assert.equal(before.partnerWins, 1);
assert.equal(mergeTrisRows(rows, playing, ['a', 'b']), rows, 'Stale playing event cannot reopen a cancelled match');
assert.equal(isFull(history[0].board), true); assert.equal(winningLine(history[0].board), null);
console.log('PASS cancellation: retained latest state, no win/draw awarded, real draws and wins preserved, stale realtime update ignored.');
