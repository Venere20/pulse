// Isolated Edge Function contract tests. No Supabase or Google requests leave this process.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const id='11111111-1111-4111-8111-111111111111';
function service(options={}){
 let handler;const calls=[],rpcs=[];
 const context=options.context??{me:id,mine:{city:'Ischia',modes:['Aliscafo','Metro','Cammino']},partner:{city:'San Marcellino',modes:['Treno','Cammino']}};
 const source=fs.readFileSync('supabase/functions/journey-midpoint/index.ts','utf8').replace(/^import .*?;\r?\n/,'');
 const output=ts.transpileModule(source,{compilerOptions:{target:9,module:1},reportDiagnostics:true});
 assert.equal(output.diagnostics.length,0);
 vm.runInNewContext(output.outputText,{URL,Response,Request,Date,AbortSignal,console,
  Deno:{env:{get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture',GOOGLE_ROUTES_API_KEY:options.noKey?'':'server-secret'})[key]},serve:fn=>handler=fn},
  createClient:()=>({auth:{getUser:async()=>({data:{user:options.badAuth?null:{id}},error:options.badAuth?{}:null})},rpc:async(name,args)=>{rpcs.push({name,args});return {data:context,error:options.denied?{}:null}}}),
  fetch:async(url,init)=>{calls.push({url:String(url),init});if(options.unavailable)return Response.json({routes:[]});
   if(String(url).includes('geocode')){const q=new URL(url).searchParams.get('address');return Response.json({results:[{formatted_address:q??'Punto centrale',geometry:{location:{lat:q==='Roma'?41.9:40.8,lng:14.2}}}]});}
   return Response.json({routes:[{distanceMeters:12000,duration:'1800s'}]});}
 });
 return {calls,rpcs,send:(body={visitId:id},token='Bearer fixture',method='POST')=>handler(new Request('https://edge.fixture/journey-midpoint',{method,headers:{authorization:token,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})}))};
}
(async()=>{
 let s=service();assert.equal((await s.send({},'')).status,401);assert.equal(s.rpcs.length+s.calls.length,0);
 s=service({badAuth:true});assert.equal((await s.send()).status,401);assert.equal(s.rpcs.length+s.calls.length,0);
 s=service();assert.equal((await s.send({visitId:'invalid'})).status,400);assert.equal(s.rpcs.length+s.calls.length,0);
 s=service({denied:true});assert.equal((await s.send()).status,403);assert.equal(s.calls.length,0);
 s=service({noKey:true});assert.equal((await s.send()).status,503);assert.equal(s.calls.length,0);
 s=service();let response=await s.send(),body=await response.json();assert.equal(response.status,200);assert.equal(s.rpcs.length,1);assert.equal(s.rpcs[0].name,'get_journey_context');assert.equal(body.candidates.length,3);assert.ok(s.calls.length<=6);
 assert.equal(body.candidates[0].mine.meters,33000);assert.equal(body.candidates[0].mine.minutes,45);assert.equal(body.candidates[1].mine.meters,45000);
 assert.ok(!JSON.stringify(body).includes('server-secret'));
 assert.ok(s.calls.every(c=>c.url==='https://routes.googleapis.com/directions/v2:computeRoutes'));
 const routes=s.calls.map(c=>JSON.parse(c.init.body));assert.ok(routes.some(r=>r.transitPreferences.allowedTravelModes.includes('SUBWAY')));assert.ok(routes.some(r=>r.transitPreferences.allowedTravelModes.includes('TRAIN')));
 s=service({unavailable:true});body=await(await s.send()).json();assert.equal(body.candidates.length,0,'Missing routes never become fake distance estimates');
 s=service({context:{me:id,mine:{city:'Roma',modes:['Cammino']},partner:{city:'Napoli',modes:['Auto']}}});body=await(await s.send()).json();assert.equal(body.candidates.length,3);assert.equal(s.calls.filter(c=>c.url.includes('geocode')).length,3);assert.equal(s.calls.filter(c=>c.url.includes('computeRoutes')).length,6);
 assert.ok(s.calls.every(c=>['maps.googleapis.com','routes.googleapis.com'].includes(new URL(c.url).hostname)));
 s=service({context:{me:id,mine:{city:'Ischia',modes:['Aereo']},partner:{city:'Napoli',modes:['Treno']}}});body=await(await s.send()).json();assert.equal(body.candidates.length,0);
 console.log('PASS midpoint Edge contract: authentication, membership, missing configuration, one context RPC, bounded API calls, ferry reference, mode preferences, unsupported/no-result routes and server secret isolation. All responses mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
