const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
function load(file, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {module,exports:module.exports,require:name=>mocks[name],URL,Date,setTimeout,clearTimeout});
  return module.exports;
}
(async () => {
  const paths = load('src/services/memoryPhotoPaths.ts');
  const origin = 'https://db.test', base = origin + '/storage/v1/object/public/meetings/';
  assert.equal(paths.meetingPhotoPath(base + 'visit/photo.jpg',origin),'visit/photo.jpg');
  assert.equal(paths.meetingPhotoPath(base + 'visit/photo.jpg?download=1',origin),'visit/photo.jpg');
  for (const bad of [base+'../x.jpg',base+'visit/%2e%2e/x.jpg',base+'visit/%252e%252e/x.jpg',base+'visit/%5cx.jpg',base+'visit/%00x.jpg',base+'visit//x.jpg',base+'visit/%3Fx.jpg','https://db.test.evil/storage/v1/object/public/meetings/v/x.jpg','https://evil.test/x.jpg','javascript:alert(1)']) {
    assert.equal(paths.meetingPhotoPath(bad,origin),null,bad);
  }
  const { isMapPointMessage } = load('src/utils/mapMessages.ts');
  assert.ok(isMapPointMessage({type:'POINT_SELECTED',lat:41,lon:12}));
  for (const data of [null,[],{type:'POINT_SELECTED',lat:NaN,lon:12},{type:'POINT_SELECTED',lat:41,lon:Infinity},{type:'POINT_SELECTED',lat:91,lon:12},{type:'POINT_SELECTED',lat:41,lon:181},{type:'POINT_SELECTED',lat:'1;alert(1)',lon:12}]) assert.equal(isMapPointMessage(data),false);
  const cache = load('src/services/signedUrlCache.ts');
  const calls=[];
  const { signedImages } = load('src/services/signedImages.ts',{'./signedUrlCache':cache,'../config/supabase':{supabase:{storage:{from:bucket=>({createSignedUrl:async(path,seconds)=>{calls.push({bucket,path,seconds});return{data:{signedUrl:'https://db.test/signed'},error:null}}})}}}});
  await signedImages.get('a','meetings','v/p.jpg'); await signedImages.get('a','meetings','v/p.jpg');
  assert.equal(calls.length,1); assert.equal(calls[0].seconds,300);
  await signedImages.get('b','meetings','v/p.jpg');assert.equal(calls.length,2);
  signedImages.clear(); await signedImages.get('a','meetings','v/p.jpg');assert.equal(calls.length,3);
  const events={},opened=[];
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{URL,self:{location:{origin:'https://pulse.test'},addEventListener:(name,fn)=>events[name]=fn},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}});
  for(const [url,wanted] of [['javascript:alert(1)','/'],['https://evil.test/path','/'],['//evil.test/path','/'],['https://pulse.test/play/tris','/play/tris'],['/#/play/tris','/#/play/tris']]){
    let work;events.notificationclick({notification:{data:{url},close(){}},waitUntil:p=>{work=p}});await work;assert.equal(opened.at(-1),wanted);
  }
  console.log('PASS security inputs: strict Storage origins/paths, traversal and scheme rejection, finite map coordinates, signed URL TTL/account cache, notification navigation restricted to Pulse.');
})().catch(e=>{console.error(e);process.exitCode=1;});
