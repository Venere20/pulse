const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>mocks[n],AbortController});return m.exports;}
const {createFeatureReadCache,readKey}=load('src/services/featureReadCache.ts',{'../state/dataStore':load('src/state/dataStore.ts'),'../utils/abort':load('src/utils/abort.ts')});
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};const spec={owner:'a',table:'notes',order:'created_at',maxRows:Infinity};
(async()=>{let now=1000;const cache=createFeatureReadCache(()=>now,2),calls=[];const fetch=signal=>new Promise((resolve,reject)=>{calls.push({signal,resolve,reject});signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});});
const a=new AbortController(),b=new AbortController();const first=cache.get(spec,fetch,a.signal),shared=cache.get(spec,fetch,b.signal);await tick();assert.equal(calls.length,1);const canceled=assert.rejects(first,e=>e.name==='AbortError');a.abort();await canceled;assert.equal(calls[0].signal.aborted,false,'Another reader still needs the fetch');calls[0].resolve([{id:'1',body:'one'}]);const rows=await shared;assert.equal(rows[0].body,'one');assert.equal(cache.peek(spec),rows);await cache.get(spec,fetch,new AbortController().signal);assert.equal(calls.length,1,'Adjacent mounts reuse a 200ms snapshot');
now+=201;const stale=cache.get(spec,fetch,new AbortController().signal);await tick();const fresh1=cache.get(spec,fetch,new AbortController().signal,true),fresh2=cache.get(spec,fetch,new AbortController().signal,true);await tick();assert.equal(calls.length,2);calls[1].resolve([{id:'1',body:'old'}]);await stale;await tick();assert.equal(calls.length,3,'One queued fresh request for both callers');calls[2].resolve([{id:'1',body:'new'}]);assert.equal((await fresh1)[0].body,'new');assert.equal(await fresh2,await fresh1);
cache.invalidate('a','notes');assert.equal(cache.peek(spec),undefined);const previous=await fresh1;const unchanged=cache.get(spec,fetch,new AbortController().signal,true);await tick();calls[3].resolve([{id:'1',body:'new'}]);const stable=await unchanged;assert.equal(stable,previous,'Unchanged rows/list retain identity after invalidation');
const ownerB=cache.get({...spec,owner:'b'},fetch,new AbortController().signal);await tick();calls[4].resolve([{id:'b'}]);await ownerB;assert.notEqual(readKey(spec),readKey({...spec,value:'x',column:'owner'}));
const sole=new AbortController();const stopped=cache.get({...spec,table:'other'},fetch,sole.signal);await tick();const check=assert.rejects(stopped,e=>e.name==='AbortError');sole.abort();await check;assert.equal(calls[5].signal.aborted,true);
const pending=cache.get({...spec,table:'pending'},fetch,new AbortController().signal);await tick();const pendingRejected=assert.rejects(pending,e=>e.name==='AbortError');cache.clear();await pendingRejected;assert.equal(cache.peek(spec),undefined);assert.equal(calls[6].signal.aborted,true);
// A transport may ignore cancellation: neither invalidation nor logout may let
// its late response repopulate the cache.
const isolated=createFeatureReadCache(()=>now,2),late=[];
const ignoresAbort=signal=>new Promise(resolve=>late.push({signal,resolve}));
const old=isolated.get(spec,ignoresAbort,new AbortController().signal);await tick();
const oldRejected=assert.rejects(old,e=>e.name==='AbortError');isolated.invalidate('a','notes');late[0].resolve([{id:'old'}]);await oldRejected;assert.equal(isolated.peek(spec),undefined);
const logout=isolated.get(spec,ignoresAbort,new AbortController().signal);await tick();const logoutRejected=assert.rejects(logout,e=>e.name==='AbortError');isolated.clear();await logoutRejected;late[1].resolve([{id:'logged-out'}]);await tick();assert.equal(isolated.peek(spec),undefined);
const variants=[spec,{...spec,column:'kind',value:'x'},{...spec,order:'updated_at'},{...spec,maxRows:20}];
assert.equal(new Set(variants.map(readKey)).size,4,'Filter, ordering and limits have distinct cache keys');
for(let i=0;i<variants.length;i++){const rows=await isolated.get(variants[i],async()=>[{id:String(i)}],new AbortController().signal);assert.equal(rows[0].id,String(i));}
assert.equal(isolated.peek(variants[0]),undefined);assert.equal(isolated.peek(variants[1]),undefined);assert.equal(isolated.peek(variants[2])[0].id,'2');assert.equal(isolated.peek(variants[3])[0].id,'3');
const events=createFeatureReadCache(()=>now),blocked=[];
const pendingSnapshot=events.get(spec,signal=>new Promise(resolve=>blocked.push({signal,resolve})),new AbortController().signal);await tick();const snapshotRejected=assert.rejects(pendingSnapshot,e=>e.name==='AbortError');
const applied=events.update(spec,()=>[{id:'event',revision:2}]);await snapshotRejected;assert.equal(blocked[0].signal.aborted,true);blocked[0].resolve([{id:'old',revision:1}]);await tick();assert.equal(events.peek(spec),applied);assert.equal(events.peek(spec)[0].id,'event');
assert.equal(events.complete(spec),false,'A row event is not a complete initial query');
const full=await events.get(spec,async()=>[{id:'history',revision:1},{id:'event',revision:2}],new AbortController().signal);assert.equal(full.length,2,'A partial warm entry must load existing history');assert.equal(events.complete(spec),true);
const same=events.update(spec,rows=>rows);assert.equal(same,full);
await events.get({...spec,column:'kind',value:'x'},async()=>[{id:'filtered'}],new AbortController().signal);
events.update(spec,()=>[{id:'event',revision:3}]);assert.equal(events.peek({...spec,column:'kind',value:'x'}),undefined,'Other filters are invalidated after server-confirmed update');
console.log('PASS shared reads: deduplicated leases, individual/last-reader abort, adjacent warm snapshots, queued fresh revalidation, stable identities, owner/filter/order/limit keys, bounded entries and late responses rejected after invalidation/logout.');
})().catch(e=>{console.error(e);process.exitCode=1;});
