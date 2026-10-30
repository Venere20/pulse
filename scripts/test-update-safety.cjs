const fs = require('node:fs'), assert = require('node:assert/strict');
const esbuild = require('esbuild');
function load(file) { const code = esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code; const module = { exports: {} }; new Function('module', 'exports', 'require', code)(module, module.exports, require); return module.exports; }
const { bootIdentity, htmlBootIdentity } = load('src/features/updates/webIdentity.ts');
const { updateSafeRoute, updateCanRestart } = load('src/features/updates/updateSafety.ts');
const root = 'https://pulse.example', entry = '/_expo/static/js/web/entry-' + 'a'.repeat(32) + '.js', common = '/_expo/static/js/web/__common-' + 'b'.repeat(32) + '.js';
const expected = [common, entry].sort().join('\n');
assert.equal(bootIdentity([entry, common, root + entry, '/not-a-bundle.js'], root), expected);
assert.equal(htmlBootIdentity('<script defer src="' + entry + '"></script><script data-demo-src=\'' + common + '\'></script>', root), expected);
assert.equal(bootIdentity([common], root), null);
assert.equal(bootIdentity(['https://elsewhere.example' + entry, entry + '?x=1', entry + '#x'], root), null);
assert.equal(bootIdentity(['javascript:' + entry, '/_expo/static/js/web/entry.bundle'], root), null);
assert.equal(htmlBootIdentity('<h1>Offline</h1>', root), null);
assert.equal(htmlBootIdentity('<script src="' + entry + '"></script><script src="/_expo/static/js/web/CatchHeartsScreen-' + 'c'.repeat(32) + '.js"></script>', root), entry);
for (const path of ['/', '/meetings', '/memories/', '/per-noi', '/game', '/avvisi']) { assert.equal(updateSafeRoute(path), true); assert.equal(updateCanRestart(path, 'saved', 'saved'), true); }
for (const path of ['/play/hearts', '/play/connect4', '/canvas', '/new-visit', '/visit/123', '/bucket', '/settings', '/capsule', '/proposte']) assert.equal(updateCanRestart(path, 'idle', 'idle'), false);
for (const phase of ['saving', 'failed', 'uncertain']) assert.equal(updateCanRestart('/', phase, 'saved'), false);
for (const phase of ['saving', 'error']) assert.equal(updateCanRestart('/', 'saved', phase), false);
const protection = load('src/features/updates/updateProtection.ts').createUpdateProtection();
const first = protection.hold(), second = protection.hold(); assert.equal(protection.blocked(), true);
first(); first(); assert.equal(protection.blocked(), true); second(); assert.equal(protection.blocked(), false);
console.log('PASS update safety: boot identity, duplicate/foreign/invalid scripts, lazy chunks excluded, protected routes, pending/failed/uncertain writes and draft persistence.');
