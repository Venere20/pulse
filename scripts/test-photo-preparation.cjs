const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
function load(path, mocks, extra = {}) {
  const mod = { exports: {} }; const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module: mod, exports: mod.exports, require: name => { if (!(name in mocks)) throw new Error('Unexpected import ' + name); return mocks[name]; }, ...extra }); return mod.exports;
}
(async () => {
  let calls = 0;
  const generic = load('src/services/photoPreparation.ts', { './photoCodec': { async encodePhoto(_uri, bytes, mime) { calls++; return { bytes, mime, width: 48, height: 32 }; } } }, { fetch: async uri => ({ ok: true, headers: new Headers({ 'content-type': uri.includes('gif') ? 'image/gif' : 'image/jpeg' }), arrayBuffer: async () => new ArrayBuffer(50) }) });
  assert.deepEqual(JSON.parse(JSON.stringify(generic.photoDimensions(4000, 3000, 2048))), { width: 2048, height: 1536 });
  assert.throws(() => generic.photoDimensions(0, 20, 2048));
  const small = await generic.preparePhoto({ uri: 'photo' }, 100); assert.equal(small.extension, 'jpg');
  await assert.rejects(() => generic.preparePhoto({ uri: 'gif' }, 100), /Formato/); assert.equal(calls, 1);
  await assert.rejects(() => generic.preparePhoto({ uri: 'photo', fileSize: 33 * 1024 * 1024 }, 100), /32 MB/);
  await assert.rejects(() => generic.preparePhoto({ uri: 'photo' }, 1), /limite/);
  // Native bridge contract: decode dimensions, resize, matching encoding, release
  // both native images/context and remove only the generated cache file.
  for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
    const events = []; let dimensions = { width: 3200, height: 2400 };
    const context = { resize(size) { dimensions = size; events.push(['resize', size.width, size.height]); }, async renderAsync() { return { ...dimensions, release() { events.push(['image-release']); }, async saveAsync(options) { events.push(['save', options.format, options.compress]); return { uri: 'file:///cache/generated', ...dimensions }; } }; }, release() { events.push(['context-release']); } };
    const native = load('src/services/photoCodec.ts', { './photoPreparation': generic, 'expo-image-manipulator': { ImageManipulator: { manipulate: uri => { assert.equal(uri, 'file:///picked/original'); return context; } }, SaveFormat: { JPEG: 'jpeg', PNG: 'png' } }, 'expo-file-system': { File: class { constructor(uri) { assert.equal(uri, 'file:///cache/generated'); } async arrayBuffer() { return new ArrayBuffer(100); } delete() { events.push(['cache-delete']); } } } });
    const result = await native.encodePhoto('file:///picked/original', new ArrayBuffer(500000), mime, 1600);
    assert.equal(result.width, 1600); assert.equal(result.height, 1200); assert.equal(result.bytes.byteLength, 100);
    assert.equal(result.mime, mime === 'image/jpeg' ? 'image/jpeg' : 'image/png');
    assert.deepEqual(events.filter(x => x[0] === 'save'), [['save', mime === 'image/jpeg' ? 'jpeg' : 'png', 0.82]]);
    assert.equal(events.filter(x => x[0] === 'image-release').length, 2); assert.ok(events.some(x => x[0] === 'context-release')); assert.ok(events.some(x => x[0] === 'cache-delete'));
  }
  console.log('PASS photo preparation validation, bounds and native bridge lifecycle/encoding/cache cleanup (native APIs mocked; device decode covered separately by device QA).');
})().catch(e => { console.error(e); process.exitCode = 1; });
