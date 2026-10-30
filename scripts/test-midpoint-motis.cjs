const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const id='11111111-1111-4111-8111-111111111111';
function service(options={}){
 let handler;const calls=[];
 const source=fs.readFileSync('supabase/functions/journey-midpoint-motis/index.ts','utf8').replace(/^import .*?;\r?\n/gm,'');
 const context=options.context??{me:id,mine:{city:'Ischia',modes:['Aliscafo','Metro']},partner:{city:'San Marcellino',modes:['Treno']}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:1,target:9}}).outputText,{URL,Date,Intl,Response,Request,AbortSignal,console,setTimeout:fn=>{fn();return 0;},
  Deno:{env:{get:k=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public'})[k]},serve:fn=>handler=fn},
  createClient:()=>({auth:{getUser:async()=>({data:{user:options.badAuth?null:{id}},error:null})},rpc:async()=>({data:options.denied?null:context,error:null})}),
  fetch:async(url,init)=>{assert.equal(url,'https://fixture.invalid/functions/v1/journey-plan');const body=JSON.parse(init.body);calls.push(body);if(options.unavailable)return Response.json({error:'Not available'},{status:502});if(body.action==='lookup')return Response.json({places:[{name:body.text,lat:40.98,lon:14.08}]});return Response.json({options:[{meters:12000,seconds:1200,complete:true,uncertain:!!options.uncertain}]});}
 });return{send:(auth='Bearer fixture',body={visitId:id})=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:auth},body:JSON.stringify(body)})),calls};
}
(async()=>{let s=service();assert.equal((await s.send('')).status,401);assert.equal(s.calls.length,0);
 s=service({badAuth:true});assert.equal((await s.send()).status,401);s=service({denied:true});assert.equal((await s.send()).status,403);assert.equal(s.calls.length,0);
 s=service();assert.equal((await s.send('Bearer fixture',{visitId:'bad'})).status,400);
 s=service();let r=await s.send(),d=await r.json();assert.equal(r.status,200);assert.equal(d.candidates.length,3);assert.equal(d.candidates[0].mine.meters,33000);assert.equal(d.candidates[1].mine.meters,45000);assert.ok(s.calls.filter(c=>c.preset==='shared').length<=6);assert.ok(s.calls.some(c=>c.mode==='metro'));assert.ok(s.calls.some(c=>c.mode==='train'));
 s=service({uncertain:true});d=await(await s.send()).json();assert.equal(d.candidates.length,0,'No uncertain geometry is silently accepted');
 s=service({context:{me:id,mine:{city:'Roma',modes:['Auto']},partner:{city:'Napoli',modes:['Treno']}}});d=await(await s.send()).json();assert.equal(d.candidates.length,0);
 console.log('PASS MOTIS midpoint: auth/member/input validation, three bounded candidates, same quota-backed planner, exact sea reference, mode preferences, uncertain/unsupported routes omitted. No external calls.');
})().catch(e=>{console.error(e);process.exitCode=1;});
