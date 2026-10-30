const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');

function component() {
 const hooks = [], pending = [], effects = [];
 let cursor = 0;
 const react = {
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  useState(initial) {
   const index = cursor++;
   if (!(index in hooks)) hooks[index] = initial;
   return [hooks[index], value => { hooks[index] = value; }];
  },
  useCallback(callback) { return callback; },
  useEffect(callback, deps) {
   const index = cursor++;
   const previous = hooks[index];
   if (!previous || deps.some((value, i) => value !== previous.deps[i])) effects.push(() => {
    previous?.cleanup?.();
    hooks[index] = { deps, cleanup: callback() };
   });
  },
 };
 const module = { exports: {} };
 const request = bucket => ({ createSignedUrl(path, expires) { return new Promise((resolve, reject) => pending.push({ bucket, path, expires, resolve, reject })); } });
 function loadHook(path, dependencies) {
  const m = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: m, exports: m.exports, require: name => dependencies[name], setTimeout, clearTimeout, Date });
  return m.exports;
 }
 const { createSignedUrlCache } = loadHook('src/services/signedUrlCache.ts', {});
 const signedImages = createSignedUrlCache(async (bucket, path, seconds) => {
  const result = await request(bucket).createSignedUrl(path, seconds);
  if (result.error) throw result.error;
  return result.data.signedUrl;
 });
 const signedHook = loadHook('src/hooks/useSignedImage.ts', {
  react, '../state/Auth': { useAuth: () => ({ profile: { id: 'test-account' } }) },
  './useActivity': { useScreenActive: () => true }, '../services/signedImages': { signedImages },
 });
 const source = ts.transpileModule(fs.readFileSync('src/components/VisitCover.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
 vm.runInNewContext(source, { module, exports: module.exports, require: name => {
  if (name === 'react') return react;
  if (name === '../hooks/useSignedImage') return signedHook;
  if (name === 'react-native') return { View: 'View', Image: 'Image' };
  if (name === '../config/supabase') return { supabase: { storage: { from: request } } };
  if (name === '../theme/ThemeProvider') return { useTheme: () => ({ c: {}, s: {}, r: {} }) };
  if (name === '../ui/Icon') return { Icon: 'Icon' };
  if (name === './MemoryPhotoFrame') return { MemoryPhotoFrame: 'MemoryPhotoFrame' };
  return { T: 'T' };
 } });
 return {
  pending,
  render(visit, props = {}) { cursor = 0; const tree = module.exports.VisitCover({ visit, height: 176, ...props }); effects.splice(0).forEach(effect => effect()); return tree; },
  unmount() { hooks.forEach(hook => hook?.cleanup?.()); },
 };
}
const settle = async () => { for (let i=0;i<16;i++) await Promise.resolve(); };
async function main() {
 const c = component();
 const visit = { id: 'one', title: 'Incontro', location: 'Roma', memory_photos: ['legacy.jpg'] };
 assert.equal(c.render(visit).props.uri, 'legacy.jpg');
 assert.equal(c.render({ ...visit, cover_source: 'default' }).type, 'View');
 assert.equal(c.pending.length, 0);
 assert.equal(c.render({ ...visit, cover_source: 'destination', cover_remote_url: 'destination.jpg' }).props.source.uri, 'destination.jpg');
 const destination = { ...visit, cover_source: 'destination', cover_remote_url: 'destination.jpg' };
 assert.equal(c.render(destination).props.resizeMode, 'contain');
 assert.equal(c.render(destination, { resizeMode: 'cover' }).props.resizeMode, 'cover');
 const layout={mode:'adaptive',rotation:90,crop:{x:0,y:0,width:1,height:1}};
 const cropped=c.render({...destination,cover_photo_settings:layout});
 assert.equal(cropped.type,'MemoryPhotoFrame');assert.equal(cropped.props.layout,layout);assert.equal(cropped.props.resolvedUri,'destination.jpg');
 const a = { ...visit, cover_source: 'personal', cover_storage_path: 'one/a.jpg' };
 assert.equal(c.render(a).type, 'View');
 assert.equal(c.pending[0].bucket, 'visit-covers');
 assert.equal(c.pending[0].path, 'one/a.jpg');
 assert.equal(c.pending[0].expires, 3600);
 c.pending[0].resolve({ data: { signedUrl: 'signed-a.jpg' }, error: null }); await settle();
 assert.equal(c.render(a).props.source.uri, 'signed-a.jpg');
 const privateCrop=c.render({...a,cover_photo_settings:layout});
 assert.equal(privateCrop.type,'MemoryPhotoFrame');assert.equal(privateCrop.props.uri,'visit-covers:one/a.jpg');assert.equal(privateCrop.props.resolvedUri,'signed-a.jpg');
 const b = { ...a, cover_storage_path: 'one/b.jpg' };
 assert.equal(c.render(b).type, 'View', 'Never show the old path while new URL loads');
 const other = { ...a, id: 'two', cover_storage_path: 'two/c.jpg' };
 assert.equal(c.render(other).type, 'View');
 c.pending[1].resolve({ data: { signedUrl: 'stale-b.jpg' }, error: null }); await settle();
 assert.equal(c.render(other).type, 'View', 'Late response for old cover is ignored');
 c.pending[2].resolve({ data: { signedUrl: 'signed-c.jpg' }, error: null }); await settle();
 const image = c.render(other);
 assert.equal(image.props.source.uri, 'signed-c.jpg');
 image.props.onError();
 assert.equal(c.render(other).type, 'View', 'Broken private image falls back to graphics, not memories');
 assert.equal(c.render(visit).props.uri, 'legacy.jpg', 'Failure does not poison another image');
 const d = { ...a, cover_storage_path: 'one/d.jpg' };
 c.render(d); c.pending.find(r => r.path === 'one/d.jpg').reject(new Error('offline')); await settle();
 assert.equal(c.render(d).type, 'View');
 c.render({ ...a, cover_storage_path: 'one/e.jpg' });
 c.unmount(); c.pending.find(r => r.path === 'one/e.jpg').resolve({ data: { signedUrl: 'after-unmount.jpg' }, error: null }); await settle();
 assert.equal(visit.memory_photos[0], 'legacy.jpg');
 console.log('PASS: legacy/default/destination/private covers, 1h signed URLs, stale responses, failures, path changes, unmount and preserved memories.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
