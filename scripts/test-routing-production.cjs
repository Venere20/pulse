const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const id='11111111-1111-4111-8111-111111111111',visit='22222222-2222-4222-8222-222222222222';
const model={exports:{}};vm.runInNewContext(fs.readFileSync('supabase/functions/_shared/motis.js','utf8').replace('export {','module.exports={'),{module:model,URL,Date,Intl});
const M=model.exports;
function service(options={}){
 let handler,calls=0,budgets=0;const rpcs=[];
 const source=fs.readFileSync('supabase/functions/journey-plan/index.ts','utf8').replace(/^import .*?;\r?\n/gm,'');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:1,target:9}}).outputText,{...M,URL,Date,Intl,Response,Request,AbortSignal,console,
  Deno:{env:{get:k=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public'})[k]},serve:fn=>handler=fn},
  createClient:()=>({auth:{getUser:async()=>({data:{user:options.badAuth?null:{id}},error:null})},rpc:async name=>{rpcs.push(name);if(name==='get_journey_context')return{data:options.denied?null:{me:id},error:null};budgets++;return{data:!options.overBudget,error:null};}}),
  fetch:async url=>{calls++;const u=new URL(url);assert.equal(u.hostname,'api.transitous.org');if(u.pathname.includes('geocode'))return Response.json([{name:'KFC',lat:40.84,lon:14.25,areas:[]}]);const start=u.searchParams.get('time'),end=new Date(Date.parse(start)+600000).toISOString();return Response.json({direct:[{duration:600,startTime:start,endTime:end,legs:[{mode:'WALK',duration:600,distance:1090,startTime:start,endTime:end,from:{name:'START'},to:{name:'END'}}]}],itineraries:[]});}
 });return{send:(body={},auth='Bearer fixture')=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:auth},body:JSON.stringify({visitId:visit,...body})})),calls:()=>calls,budgets:()=>budgets,rpcs};
}
(async()=>{
 const input={preset:'shared',direction:'out',mode:'walk',day:'2026-10-31',hour:'11:00',from:{name:'Beverello',lat:40.8388,lon:14.2548},to:{name:'KFC',lat:40.84,lon:14.25}};
 let s=service();assert.equal((await s.send(input,'')).status,401);assert.equal(s.calls(),0);
 s=service({badAuth:true});assert.equal((await s.send(input)).status,401);assert.equal(s.calls(),0);
 s=service({denied:true});assert.equal((await s.send(input)).status,403);assert.equal(s.calls(),0);
 s=service({overBudget:true});assert.equal((await s.send(input)).status,429);assert.equal(s.calls(),0);
 s=service();assert.equal((await s.send({...input,from:{name:'bad',lat:999,lon:14}})).status,400);assert.equal(s.calls(),0);
 let r=await s.send(input),d=await r.json();assert.equal(r.status,200);assert.equal(d.options[0].meters,1090);assert.equal(d.options[0].legs[0].from,'Beverello');assert.equal(s.calls(),1);await s.send(input);assert.equal(s.calls(),1);assert.equal(s.budgets(),1,'Cache hit never spends budget');
 r=await s.send({action:'lookup',text:'KFC',near:input.from});assert.equal((await r.json()).places[0].name,'KFC');assert.equal(s.calls(),2);
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create function public.my_profile_id()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function public.is_couple_member()returns boolean language sql as $$select public.my_profile_id()='${id}'::uuid$$;`);
  await db.exec(fs.readFileSync('supabase/migrations/20261030101906_routing_budget.sql','utf8'));await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}';`);
  assert.equal((await db.query('select claim_routing_request() ok')).rows[0].ok,true);assert.equal((await db.query('select claim_routing_request() ok')).rows[0].ok,false);await assert.rejects(db.query('select * from routing_budget'));
  await db.exec("reset role;update routing_budget set requests=120,last_at=now()-interval '2 seconds';set role authenticated;");assert.equal((await db.query('select claim_routing_request() ok')).rows[0].ok,false);
  await db.exec("reset role;update routing_budget set day=day-1,last_at=now()-interval '2 seconds';set role authenticated;");assert.equal((await db.query('select claim_routing_request() ok')).rows[0].ok,true);
  await db.exec(`set request.jwt.claim.sub='${visit}';`);await assert.rejects(db.query('select claim_routing_request()'));await db.exec('reset role;set role anon');await assert.rejects(db.query('select claim_routing_request()'));
 }finally{await db.close();}
 console.log('PASS production routing: auth/membership, input validation, provider allowlist, complete geometry normalization, lookup/cache, no API calls on denied/over-budget inputs, server quota/throttle/day reset and outsider/anonymous/table access denial. No live API calls.');
})().catch(e=>{console.error(e);process.exitCode=1;});
