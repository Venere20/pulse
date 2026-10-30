const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {PostgrestClient}=require('@supabase/postgrest-js');
function load(path,mocks={},extra={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>mocks[n],AbortController,...extra});return m.exports;}
const math=Object.create(Math);math.random=()=>0.5;
const recovery=load('src/utils/recovery.ts',{}, {Math:math});
(async()=>{
 assert.deepEqual(Array.from({length:8},(_,i)=>recovery.recoveryDelay(i+1)),[1000,2000,4000,8000,16000,30000,30000,30000]);
 assert.deepEqual([0,1,2,3,4,5].map(n=>recovery.gamePollDelay(n)),[5000,10000,20000,40000,60000,60000]);
 for(const random of[()=>0,()=>1])for(let i=1;i<20;i++){const d=recovery.recoveryDelay(i,1000,30000,random);assert.ok(d>=850&&d<=30000);}
 assert.equal(recovery.transientReadFailure({status:503}),true);assert.equal(recovery.transientReadFailure({message:'Failed to fetch'}),true);assert.equal(recovery.transientReadFailure({status:403,message:'network'}),false);assert.equal(recovery.transientReadFailure({name:'AbortError',message:'fetch'}),false);
 const effects=[],timers=[];let refreshes=0,health={failures:0,retryable:false,busy:false},complete;
 const data={rows:[],readHealth:()=>health,refresh:async()=>{refreshes++;if(complete===null)await new Promise(resolve=>{complete=resolve;health.busy=true;});}};
 const react={useCallback:fn=>fn,useEffect:fn=>effects.push(fn),useRef:v=>({current:v}),useState:v=>[v,()=>{}]};
 const hook=load('src/features/partnergames/usePartnerGame.ts',{'react':react,'../../state/AppData':{useAppDataFields:()=>({userId:'a'})},'../useFeatureRows':{featureRpc:async()=>({}),useFeatureRows:()=>data},'../../ui/Toast':{useToast:()=>({error(){}})},'../../hooks/useActivity':{useScreenActive:()=>true},'../../utils/recovery':recovery,'./matchUpdates':{mergePartnerMatch:()=>[]},'./usePartnerGameRealtime':{usePartnerGameRealtime:()=>{}}},{setTimeout:(fn,delay)=>{const timer={fn,delay,canceled:false};timers.push(timer);return timer;},clearTimeout:t=>{t.canceled=true;}});
 hook.usePartnerGame('connect4');const cleanup=effects.map(fn=>fn()).filter(Boolean);const tick=async()=>{const timer=timers.shift();assert.ok(timer&&!timer.canceled);timer.fn();await Promise.resolve();await Promise.resolve();};
 assert.equal(timers[0].delay,5000);health={failures:1,retryable:true,busy:false};await tick();assert.equal(refreshes,1);assert.equal(timers[0].delay,10000);
 health={failures:0,retryable:false,busy:true};await tick();assert.equal(refreshes,1,'Poll does not replace another in-flight read');assert.equal(timers[0].delay,5000);
 health.busy=false;complete=null;await tick();assert.equal(refreshes,2);assert.equal(timers.length,0,'No timer runs while refresh is awaiting recovery');health={failures:2,retryable:true,busy:false};complete();await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.equal(timers[0].delay,20000);
 health={failures:3,retryable:false,busy:false};await tick();assert.equal(timers.length,0,'Permanent errors stop automatic polling');cleanup.forEach(fn=>fn());
 // Exercise the installed PostgREST retry engine, with virtual waits but real
 // requests/Response parsing. No SDK assumption substitutes for this check.
 const realTimer=global.setTimeout;const waits=[];global.setTimeout=(fn,ms,...args)=>{waits.push(ms);return realTimer(fn,0,...args);};
 try{let calls=[];let fail=true;const fetch=async(_url,init)=>{calls.push(init.method);return new Response(JSON.stringify(fail?{message:'temporary outage'}:[]),{status:fail?503:200,headers:{'content-type':'application/json'}});};const client=new PostgrestClient('https://test.invalid/rest/v1',{fetch});
 await client.from('rows').select('*');assert.equal(calls.length,4);assert.deepEqual(waits.slice(-3),[1000,2000,4000]);
 for(const action of[()=>client.from('rows').insert({id:1}),()=>client.from('rows').update({id:2}).eq('id',1),()=>client.rpc('save_something',{p_id:1})]){calls=[];await action();assert.equal(calls.length,1,'Writes are never replayed on 503');}
 calls=[];fail=false;await client.from('rows').select('*');assert.equal(calls.length,1,'Recovered reads complete without further retries');
 }finally{global.setTimeout=realTimer;}
 console.log('PASS bounded jitter/backoff, adaptive nonoverlapping game polling, permanent-error stop, SDK GET retry 1/2/4s and recovery, POST/PATCH/RPC writes never repeated.');
})().catch(e=>{console.error(e);process.exitCode=1;});
