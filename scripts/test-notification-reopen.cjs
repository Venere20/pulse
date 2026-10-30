const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,require){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require});return m.exports}
const paths=load('src/navigation/notificationPath.ts',()=>{}),receipts=load('src/navigation/notificationResponse.ts',()=>paths);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=(id,url='/canvas')=>({actionIdentifier:'default',notification:{date:1000,request:{identifier:id,content:{data:{url}}}}});
function harness(){
 let cursor=0,profile={userId:'a',refresh:async()=>{}},clears=0,registrations=0;const slots=[],effects=[],nativeListeners=new Set(),appListeners=new Set(),lookups=[],navigations=[];
 const react={
  useRef(value){const i=cursor++;return slots[i]??(slots[i]={current:value})},
  useEffect(callback,deps){const i=cursor++,prior=slots[i];if(!prior||deps.some((d,j)=>d!==prior.deps[j]))effects.push(()=>{prior?.cleanup?.();slots[i]={deps,cleanup:callback()}})}
 };
 const notifications={addNotificationResponseReceivedListener:fn=>{nativeListeners.add(fn);return{remove:()=>nativeListeners.delete(fn)}},getLastNotificationResponseAsync:()=>new Promise((resolve,reject)=>lookups.push({resolve,reject})),clearLastNotificationResponseAsync:async()=>{clears++}};
 const mocks={react,'react-native':{Platform:{OS:'android'},AppState:{addEventListener:(_event,fn)=>{appListeners.add(fn);return{remove:()=>appListeners.delete(fn)}}}},'expo-router':{router:{push:path=>navigations.push(path)}},'expo-notifications':notifications,'../state/AppData':{useAppDataFields:()=>profile},'../services/notification':{registerForPushNotificationsAsync:async()=>{registrations++},registerWebPush:async()=>{}},'./notificationPath':paths,'./notificationResponse':receipts};
 const{NotificationBridge}=load('src/navigation/NotificationBridge.tsx',name=>{if(!(name in mocks))throw Error(name);return mocks[name]});
 const render=()=>{cursor=0;NotificationBridge();while(effects.length)effects.shift()()};
 const unmount=()=>{for(const slot of slots)slot?.cleanup?.();slots.length=0};
 return{render,unmount,lookups,navigations,notifications,emit:r=>{for(const fn of nativeListeners)fn(r)},resume:()=>{for(const fn of appListeners)fn('active')},setRefresh:fn=>{profile={...profile,refresh:fn}},counts:()=>({clears,registrations,live:nativeListeners.size})};
}
(async()=>{
 const h=harness();h.render();const first=response('already-opened');h.lookups[0].resolve(first);await tick();assert.deepEqual(h.navigations,['/canvas']);assert.equal(h.counts().clears,1);
 let refreshed=0;h.setRefresh(async()=>{refreshed++});h.render();h.resume();await tick();assert.equal(refreshed,1);assert.equal(h.lookups.length,1,'Foreground refresh changes must not re-read the previous notification');assert.equal(h.navigations.length,1);
 h.emit(first);assert.equal(h.navigations.length,1,'Listener cannot replay initial lookup');h.unmount();h.render();h.lookups[1].resolve(first);await tick();assert.equal(h.navigations.length,1,'Bridge remount cannot replay already handled tap');
 h.emit(response('genuine-new-tap','/meetings'));assert.deepEqual(h.navigations,['/canvas','/meetings']);h.emit(response('unsafe','https://example.com'));assert.equal(h.navigations.length,2);h.unmount();
 const race=harness();race.render();race.emit(response('live-new','/per-noi'));race.lookups[0].resolve(response('old-cached'));await tick();assert.deepEqual(race.navigations,['/per-noi'],'Late initial lookup cannot override a newer actual tap');race.unmount();
 const disposed=harness();disposed.render();disposed.unmount();disposed.lookups[0].resolve(response('late-disposed'));await tick();assert.equal(disposed.navigations.length,0);
 const unavailable=harness();unavailable.render();unavailable.lookups[0].reject(Error('native unavailable'));await tick();assert.equal(unavailable.navigations.length,0);unavailable.unmount();
 const offline=harness();offline.notifications.clearLastNotificationResponseAsync=async()=>{throw Error('clear unavailable')};offline.render();const repeat=response('clear-failed');offline.emit(repeat);offline.emit(repeat);await tick();assert.equal(offline.navigations.length,1);offline.unmount();
 console.log('PASS actual Android NotificationBridge: foreground/refetch without stale navigation, one-time native response clear, initial/listener deduplication, remount, genuine new tap, initial-vs-live race, cleanup, invalid URLs and native API failures');
})().catch(e=>{console.error(e);process.exitCode=1});
