const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>mocks[n],Date,console,setTimeout});return m.exports;}
(async()=>{
 const session=load('src/services/localReminderSession.ts');const pending=new Map();let complete;let delayed=false;let cancelled=0,dismissed=0;
 const api={setNotificationHandler(){},SchedulableTriggerInputTypes:{DATE:'date'},getAllScheduledNotificationsAsync:async()=>[...pending.values()],getPermissionsAsync:async()=>({granted:true}),
 cancelScheduledNotificationAsync:async id=>pending.delete(id),cancelAllScheduledNotificationsAsync:async()=>{cancelled++;pending.clear()},dismissAllNotificationsAsync:async()=>{dismissed++},
 scheduleNotificationAsync:async n=>{if(delayed)await new Promise(r=>complete=r);pending.set(n.identifier,n)}};
 const mocks={'expo-device':{},'expo-notifications':api,'react-native':{Platform:{OS:'ios'}},'../config/supabase':{supabase:{rpc:async()=>({error:null})}},'./gameActivity':{suppressGameNotice:()=>false},'./localReminderSession':session};
 const n=load('src/services/notification.ts',mocks);const checkin=load('src/features/checkin/reminders.ts',{'react-native':mocks['react-native'],'expo-notifications':api,'../../services/localReminderSession':session});
 const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10),visit={id:'test',title:'Test',start_date:day,end_date:day};
 session.activateLocalReminders('A');await n.scheduleVisitReminder(visit);assert.equal(pending.size,1);
 await checkin.syncCheckinReminder({due_at:new Date(Date.now()+3600000).toISOString()});assert.equal(pending.size,2);
 await n.clearPushRegistration('A');assert.equal(pending.size,0);assert.equal(cancelled,1);assert.equal(dismissed,1);
 await n.syncVisitReminders([visit],()=>[],'2000-01-01');assert.equal(pending.size,0,'Signed-out work cannot schedule');
 session.activateLocalReminders('A');delayed=true;const writing=n.scheduleVisitReminder(visit);while(!complete)await new Promise(r=>setTimeout(r,0));await n.clearPushRegistration('A');complete();await writing;assert.equal(pending.size,0,'A late schedule is cancelled after logout');
 delayed=false;session.activateLocalReminders('B');await n.scheduleVisitReminder(visit);assert.equal(pending.size,1,'A new login schedules normally');
 for(const state of [{status:'concluded'},{ended_at:new Date().toISOString()},{started_at:new Date().toISOString()}]){
  await n.syncVisitReminders([{...visit,...state}],()=>[],'2000-01-01');assert.equal(pending.size,0,'Started/concluded visit removes its old reminder');
  await n.scheduleVisitReminder({...visit,...state});assert.equal(pending.size,0,'Direct scheduling also excludes started/concluded visits');
 }
 await n.syncVisitReminders([visit],()=>[],'2000-01-01');assert.equal(pending.size,1,'Planned future visits keep reminders');
 let handler;const filters=[];const query={select(){return this},limit(){return this},gte(){return this},lt(){return this},or(value){filters.push(['or',value]);return this},is(key,value){filters.push([key,value]);return this},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/send-visit-reminders/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:{},require:url=>url.includes('supabase-js')?{createClient:()=>({from:()=>query})}:{default:{}},Deno:{env:{get:key=>key==='CRON_SECRET'?'test':undefined},serve:fn=>handler=fn},Response,Date,Intl});
 assert.equal((await handler({headers:new Headers({'x-cron-secret':'test'})})).status,200);
 assert.ok(filters.some(([k,v])=>k==='or'&&v==='status.is.null,status.neq.concluded'));
 for(const field of ['ended_at','started_at'])assert.ok(filters.some(([k,v])=>k===field&&v===null));
 console.log('PASS local reminder logout/races/account switch, check-in cleanup, removal/exclusion of started/concluded visits and normal planned reminders');
})().catch(e=>{console.error(e);process.exitCode=1});
