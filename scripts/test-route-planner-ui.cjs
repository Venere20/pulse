const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {chromium,webkit}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',V='00000000-0000-4000-8000-000000000010';
async function serve(){const file=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(file,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(path.resolve('.feature-build/release-20261030-web'))),file);await new Promise(r=>m.exports.listen(0,'127.0.0.1',r));return m.exports;}
(async()=>{const server=await serve(),base='http://127.0.0.1:'+server.address().port;try{for(const[engine,width]of [['chromium',320],['webkit',390],['chromium',1280]]){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'}:{})});try{
  const c=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await c.routeWebSocket('**/*',ws=>ws.close());
  await c.addInitScript(({A,B,V})=>{localStorage.setItem('pulse-local-demo-login-v1','yes');localStorage.setItem('pulse-draft:release-notes:'+A,'2026-10-30-grande-aggiornamento');document.addEventListener('DOMContentLoaded',()=>{
   const original=window.fetch;window.__plans=[];window.__saved=[];const v={id:V,title:'Percorso di prova',start_date:'2026-10-29',end_date:'2026-10-29',location:'Roma',meeting_point:'Napoli Centrale',status:'concluded',created_by:A,journey_plan:{version:1,counting:'shared-once',legs:[{id:'personal',from:'Casa',to:'Centrale',participants:[B],direction:'out',distance_m:40000,source:'manual',mode:'Treno'}]}};
   window.fetch=async(input,options={})=>{const u=new URL(typeof input==='string'?input:input.url,location.href),body=JSON.parse(options.body||'{}'),json=v=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
    if(u.pathname==='/rest/v1/visits')return json(new Headers(options.headers).get('Accept')?.includes('vnd.pgrst.object')?v:[v]);
    if(u.pathname==='/functions/v1/journey-plan'){
     window.__plans.push(body);if(body.action==='lookup'){const kfc=body.text==='KFC';return json({places:[{name:kfc?'KFC':'Molo Beverello',lat:kfc?40.8448491:40.8388,lon:kfc?14.2492684:14.2548,subtitle:'Napoli'}]});}
     const second=body.from.name==='Molo Beverello',start=body.day+'T'+body.hour+':00+01:00',end=new Date(Date.parse(start)+(second?15:33)*60000).toISOString();return json({options:[{meters:second?1090:2365,seconds:(second?15:33)*60,start,end,complete:true,uncertain:false,legs:[{label:'Cammino'}]}]});
    }
    if(u.pathname==='/rest/v1/rpc/save_visit_journey'){window.__saved.push(body);v.journey_plan={version:1,counting:'shared-once',meeting_point:v.meeting_point,legs:body.p_legs};return json(null);}
    return original(input,options);
   };
  });},{A,B,V});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);const button=name=>p.getByRole('button',{name,exact:true});
  await p.goto(base+'/visit/'+V);await p.getByRole('tab',{name:'Viaggio',exact:true}).click();await button('Pianifica percorsi e tappe').click();
  for(const query of ['Beverello','KFC']){await p.getByLabel('Aggiungi luogo, stazione o locale',{exact:true}).fill(query);await button('Cerca luogo').click();await button((query==='KFC'?'KFC':'Molo Beverello')+' · Napoli').click();}
  await p.getByLabel('Sosta tappa 2 · minuti (0–720)',{exact:true}).fill('10');await p.getByLabel('Partenza · ora italiana (HH:MM)',{exact:true}).fill('11:00');
  await button('Calcola tutte le tappe').click();await button('Conferma e salva queste tappe').waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('[role="button"]')].some(e=>e.getAttribute('aria-label')==='Conferma e salva queste tappe'&&e.getAttribute('aria-disabled')!=='true'));
  const plans=await p.evaluate(()=>window.__plans.filter(p=>p.preset==='shared'));assert.equal(plans.length,2);assert.equal(plans[1].hour,'11:43');
  await button('Conferma e salva queste tappe').click();await button('Conferma').click();await p.waitForFunction(()=>window.__saved.length===1);
  const legs=await p.evaluate(()=>window.__saved[0].p_legs);assert.equal(legs.find(l=>l.id==='personal').distance_m,40000,'Other personal route is preserved');assert.equal(legs.filter(l=>l.participants.length===2).reduce((n,l)=>n+l.distance_m,0),3455);
  await button('Rimuovi tappa 3').click();assert.equal(await button('Conferma e salva queste tappe').isEnabled(),false);await button('Ritorno').first().click();assert.equal(await button('Conferma e salva queste tappe').isEnabled(),false);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);await p.screenshot({path:`.feature-build/route-planner-${engine}-${width}.png`,fullPage:true});console.log(`PASS app route planner ${engine} ${width}px: places/add/remove, waits and chained time, shared-once save, preservation of other legs, return invalidation and no overflow/errors.`);
 }finally{await browser.close();}}
 }finally{await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

