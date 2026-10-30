const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/checkin/model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,Date});
const {arrivalAt,validateJourney,sortedRoutes,defaultCheckinGrace,canExtendCheckin}=mod.exports;
assert.equal(defaultCheckinGrace(),10);assert.equal(defaultCheckinGrace(15),15);assert.equal(defaultCheckinGrace(30),30);assert.equal(defaultCheckinGrace(2),5);
const start=Date.parse('2026-10-27T18:10:00+01:00');
assert.equal(arrivalAt(start,45).toISOString(),'2026-10-27T17:55:00.000Z');
assert.equal(arrivalAt(start-10*60000,45).toISOString(),'2026-10-27T17:45:00.000Z');
assert.equal(arrivalAt(Date.parse('2026-10-27T23:45:00+01:00'),45).toISOString(),'2026-10-27T23:30:00.000Z'); // 00:30 Italian time, next day
validateJourney(45,10,start,start);
for(const args of [[0,10,start,start],[721,10,start,start],[30,31,start,start],[30,4,start,start],[30,10,NaN,start],[30,10,start+25*3600000,start],[30,10,start-3600000,start]]) assert.throws(()=>validateJourney(...args));
const exampleNow=Date.parse('2026-10-27T18:53:00+01:00'),exampleDeparture=Date.parse('2026-10-27T19:10:00+01:00');
validateJourney(85,10,exampleDeparture,exampleNow);
assert.equal(arrivalAt(exampleDeparture,85).toISOString(),'2026-10-27T19:35:00.000Z'); // 20:35 in Italy
validateJourney(30,10,start+24*3600000,start);
const trip={status:'active',extensions:0,departed_at:new Date(start).toISOString(),created_at:new Date(start).toISOString(),due_at:new Date(start+12*3600000).toISOString()};
assert.equal(canExtendCheckin(trip,15,start),false);
trip.due_at=new Date(start+(11*60+40)*60000).toISOString();assert.equal(canExtendCheckin(trip,15,start),true);assert.equal(canExtendCheckin(trip,30,start),false);assert.equal(canExtendCheckin(trip,60,start),false);
trip.extensions=5;assert.equal(canExtendCheckin(trip,15,start),false);
assert.deepEqual(Array.from(sortedRoutes([{name:'B',position:0,favorite:false},{name:'A',position:2,favorite:true},{name:'C',position:1,favorite:true}]),r=>r.name),['C','A','B']);
// V2 reminder must cancel old native schedules without creating another one.
async function reminder(platform,version){const calls=[];const m={exports:{}};const reactNative={Platform:{OS:platform}};const notifications={cancelScheduledNotificationAsync:async()=>calls.push('cancel'),getPermissionsAsync:async()=>({granted:true}),scheduleNotificationAsync:async()=>calls.push('schedule'),SchedulableTriggerInputTypes:{DATE:'date'}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/checkin/reminders.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:name=>name==='react-native'?reactNative:name==='expo-notifications'?notifications:{reminderSession:()=>1,reminderSessionCurrent:()=>true},Date,console});
await m.exports.syncCheckinReminder({due_at:new Date(Date.now()+600000).toISOString(),flow_version:version});return calls;}
(async()=>{assert.deepEqual(await reminder('android',2),['cancel']);assert.deepEqual(await reminder('android',1),['cancel','schedule']);assert.deepEqual(await reminder('web',2),[]);console.log('Check-in V2: time arithmetic, validation, favorites and no duplicate native reminders OK');})().catch(e=>{console.error(e);process.exitCode=1;});
