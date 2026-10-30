const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const moduleDraft={exports:{}};vm.runInThisContext('(function(exports,module){'+ts.transpileModule(fs.readFileSync('src/services/drafts/core.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+'})')(moduleDraft.exports,moduleDraft);
const {createDraftStore,draftKey}=moduleDraft.exports; const data=new Map();let fail=false;
const adapter={getItem:k=>data.get(k)??null,setItem(k,v){if(fail)throw Error('full');data.set(k,v);},removeItem:k=>data.delete(k)};
const store=createDraftStore(adapter,10000),a=draftKey('a','recap:2026-10','body'),b=draftKey('b','recap:2026-10','body'),next=draftKey('a','recap:2026-11','body');
store.set(a,'first');store.set(a,'latest');assert.equal(store.status('a'),'saving');store.flush();assert.equal(store.status('a'),'saved');
const restart=createDraftStore(adapter);assert.equal(restart.get(a,''),'latest');assert.equal(restart.get(b,''),'');assert.equal(restart.get(next,''),'');
store.set(a,'unsent');fail=true;store.flush();assert.equal(store.status('a'),'error');assert.equal(store.get(a,''),'unsent');assert.equal(store.status('b'),'idle');
fail=false;store.set(a,'recovered');store.flush();assert.equal(store.status('a'),'saved');store.clear(a);assert.equal(createDraftStore(adapter).get(a,''),'');
data.set(a,'{broken');assert.equal(createDraftStore(adapter).get(a,''),'');
data.set(a,JSON.stringify({v:1,key:b,at:Date.now(),value:'other account'}));assert.equal(createDraftStore(adapter).get(a,''),'');
data.set(a,JSON.stringify({v:1,key:a,at:Date.now()-31*86400000,value:'old'}));assert.equal(createDraftStore(adapter).get(a,''),'');
data.set(a,JSON.stringify({v:1,key:a,at:Date.now(),value:{invalid:'text'}}));assert.equal(createDraftStore(adapter).get(a,null),null);
const raceKey=draftKey('a','form','title');store.set(raceKey,'new typing');store.clearIfUnchanged('a','form',{title:'submitted'});assert.equal(store.get(raceKey,''),'new typing');store.clearIfUnchanged('a','form',{title:'new typing'});assert.equal(store.get(raceKey,''),'');
console.log('PASS: persistent drafts, latest write, account/month isolation, failed disk writes, recovery, malformed/expired drafts and clear.');
const moduleSave={exports:{}};vm.runInThisContext('(function(exports,module){'+ts.transpileModule(fs.readFileSync('src/services/saveState.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+'})')(moduleSave.exports,moduleSave);
const {createSaveTracker,trackResult,saveTracker}=moduleSave.exports;const tracker=createSaveTracker();tracker.setOwner('a');const first=tracker.start(),second=tracker.start();tracker.finish(second,'failed');assert.equal(tracker.snapshot('a'),'saving');tracker.finish(first,'saved');assert.equal(tracker.snapshot('a'),'failed');tracker.setOwner('b');const other=tracker.start();assert.equal(tracker.snapshot('a'),'failed');tracker.finish(other,'saved');assert.equal(tracker.snapshot('b'),'saved');
async function testTrackedResults(){saveTracker.setOwner('test');const response={data:null,error:{message:'Failed to fetch'}};assert.equal(await trackResult(()=>Promise.resolve(response)),response);assert.equal(saveTracker.snapshot('test'),'uncertain');await trackResult(()=>Promise.resolve({data:'ok',error:null}));assert.equal(saveTracker.snapshot('test'),'saved');await assert.rejects(trackResult(()=>Promise.reject(Error('constraint violation'))));assert.equal(saveTracker.snapshot('test'),'failed');console.log('PASS: concurrent writes, account isolation, uncertain delivery and preserved Supabase error/result contract.');}
testTrackedResults().catch(error=>{console.error(error);process.exitCode=1;});
