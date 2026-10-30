const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const timers = new Set(), channels = [], invalidations = [];
const flush = () => { const pending = [...timers]; timers.clear(); pending.forEach(fn => fn()); };
const client = {
  channel() {
    const ch = { handlers: {}, removed: false,
      on(_kind, filter, callback) { ch.handlers[filter.table] = callback; return ch; },
      subscribe(callback) { ch.status = callback; return ch; },
    }; channels.push(ch); return ch;
  },
  removeChannel(ch) { ch.removed = true; },
};
const m = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/realtimeRefreshRegistry.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: m, exports: m.exports, setTimeout(fn) { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn) });
const registry = m.exports.createRealtimeRefreshRegistry(client, (owner, table) => invalidations.push([owner, table]));
const a = [], b = [], healthA = [], healthB = [];
const stopA = registry.subscribe('one', ['visits', 'pulse_logs', 'visits'], names => a.push([...names]), connected => healthA.push(connected));
const stopB = registry.subscribe('one', ['pulse_logs', 'visits'], names => b.push([...names]), connected => healthB.push(connected));
assert.equal(channels.length, 1, 'Same owner and canonical table set share one channel');
assert.deepEqual(healthA, [false]); assert.deepEqual(healthB, [false]);
const ch = channels[0];
ch.handlers.pulse_logs(); ch.handlers.visits(); ch.handlers.pulse_logs();
assert.equal(timers.size, 1); flush();
assert.deepEqual(a, [['pulse_logs', 'visits']]); assert.deepEqual(a, b);
assert.deepEqual(invalidations, [['one', 'pulse_logs'], ['one', 'visits']], 'One invalidation per table before notifying both readers');
ch.status('SUBSCRIBED'); flush();
assert.equal(a.length, 2); assert.equal(b.length, 2);
assert.deepEqual(healthA, [false, true]);
const late = [], lateHealth = [];
const stopLate = registry.subscribe('one', ['visits', 'pulse_logs'], names => late.push([...names]), value => lateHealth.push(value));
assert.deepEqual(lateHealth, [true]); assert.equal(timers.size, 0, 'Joining a healthy channel does not trigger another full read');
ch.status('CHANNEL_ERROR'); assert.equal(healthA.at(-1), false);
ch.status('SUBSCRIBED'); flush();
assert.deepEqual(late, [['pulse_logs', 'visits']], 'Reconnect revalidates all tables for all remaining readers');
stopA(); assert.equal(ch.removed, false); ch.handlers.visits(); flush();
assert.equal(a.length, 3); assert.equal(b.length, 4);
stopB(); ch.handlers.visits(); stopLate();
assert.equal(ch.removed, true); assert.equal(timers.size, 0);
ch.handlers.visits(); ch.status('SUBSCRIBED'); assert.equal(timers.size, 0, 'Late callbacks after final cleanup are ignored');
const resumedHealth = [];
const stopResumed = registry.subscribe('one', ['visits', 'pulse_logs'], () => {}, value => resumedHealth.push(value));
assert.deepEqual(resumedHealth, [false], 'Resume starts disconnected until a fresh acknowledgement');
const stopOther = registry.subscribe('two', ['visits', 'pulse_logs'], () => {}, () => {});
const stopSubset = registry.subscribe('one', ['visits'], () => {}, () => {});
assert.equal(channels.length, 4, 'Accounts and different table sets remain isolated');
registry.subscribe('', ['visits'], () => {}, () => {})(); registry.subscribe('one', [], () => {}, () => {})();
assert.equal(channels.length, 4);
stopResumed(); stopOther(); stopSubset();
assert.ok(channels.every(channel => channel.removed));
console.log('PASS shared realtime: canonical groups, single invalidation, burst batching, connection health, reconnect recovery, late join, account isolation, partial/final cleanup and resume.');
