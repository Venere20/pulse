// Exported application UI, isolated fixtures, external network blocked.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {chromium,webkit}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',V='00000000-0000-4000-8000-000000000010';
async function serve(){const file=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(file,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(path.resolve(process.env.PULSE_TEST_WEB_ROOT||'.feature-build/bugfix-20261030-web'))),file);await new Promise(r=>m.exports.listen(0,'127.0.0.1',r));return m.exports;}
async function run(engine,width,base){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'}:{})});
 try{
  const c=await browser.newContext({viewport:{width,height:1000},hasTouch:width<500,isMobile:width<500});await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await c.routeWebSocket('**/*',ws=>ws.close());
  await c.addInitScript(({A,B,V})=>{
   localStorage.setItem('pulse-local-demo-login-v1','yes');localStorage.setItem('pulse-draft:release-notes:'+A,'2026-10-30-salvataggi-protetti');
   document.addEventListener('DOMContentLoaded',()=>{
    const original=window.fetch;window.__journeyCalls=[];
    const v={id:V,title:'Viaggio di prova',start_date:'2090-01-01',end_date:'2090-01-02',location:'Roma',meeting_point:'Napoli Centrale',meeting_lat:40.85,meeting_lon:14.27,travel_km:110,status:'planned',created_by:A,cover_source:'destination',cover_remote_url:'/__demo/photo.svg',travel_preferences:{[A]:['Aliscafo','Metro'],[B]:['Treno']}};
    const items=[{id:'item1',list_id:'list',label:'Caricatore',quantity:2,category:'other',checked:true,dismissed:false},{id:'item2',list_id:'list',label:'Passaporto',quantity:1,category:'documents',checked:false,dismissed:false}];
    window.__visit=v;
    window.fetch=async(input,options={})=>{
     const u=new URL(typeof input==='string'?input:input.url,location.href),body=JSON.parse(options.body||'{}'),json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
     if(u.pathname==='/rest/v1/visits'){
      if(options.method==='PATCH')Object.assign(v,body);
      const result=u.searchParams.get('select')==='id'?{id:V}:v;
      return json(new Headers(options.headers).get('Accept')?.includes('vnd.pgrst.object')?result:[result]);
     }
     if(u.pathname==='/rest/v1/packing_items')return json(items);
     if(u.pathname==='/rest/v1/packing_progress'||u.pathname==='/rest/v1/packing_defaults')return json([]);
     if(u.pathname.startsWith('/rest/v1/rpc/')){
      const rpc=u.pathname.split('/').pop();window.__journeyCalls.push({rpc,body});
      if(rpc==='badge_pulse_history'){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date());return json([{day,count:1,sender_ids:[A]},{day,count:0,sender_ids:[],server_day:day,server_now:new Date().toISOString(),meta_only:true}]);}
      if(rpc==='set_my_visit_transport'){v.travel_preferences[A]=body.p_modes;return json(null);}
      if(rpc==='save_visit_journey_checked'){
       v.journey_plan={version:1,counting:'shared-once',confirmed_at:new Date().toISOString(),meeting_point:v.meeting_point,legs:body.p_legs};return json(null);
      }
      if(rpc==='open_packing_list')return json('list');
      if(rpc==='update_visit_actual_times')return json(null);
      if(rpc==='packing_item_action'){const item=items.find(i=>i.id===body.p_item);if(item&&body.p_action==='check')item.checked=body.p_data.checked;return json(null);}
     }
     if(u.pathname==='/functions/v1/journey-midpoint-motis'){window.__journeyCalls.push({rpc:'midpoint'});return json({candidates:[{id:'central',name:'Napoli Centrale',lat:40.85,lon:14.27,mine:{meters:70000,minutes:80},partner:{meters:40000,minutes:55},source:'api'}]});}
     return original(input,options);
    };
   });
  },{A,B,V});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);const button=name=>p.getByRole('button',{name,exact:true});
  await p.goto(base+'/');await p.getByText('Tu: ✓ Pulse inviato',{exact:false}).waitFor();
  await p.goto(base+'/visit/'+V);await button('Ritaglia e ruota la copertina').click();await button('Ruota a destra').click();await p.getByText('Rotazione: 90°',{exact:true}).waitFor();await button('Riquadro adattivo').click();await button('Conferma foto').click();
  await p.waitForFunction(()=>window.__visit.cover_photo_settings?.rotation===90);
  await p.getByRole('tab',{name:'Viaggio',exact:true}).click();await button('Cammino').click();await button('Salva i miei mezzi').click();await p.waitForFunction(()=>window.__visit.travel_preferences['00000000-0000-4000-8000-000000000001'].includes('Cammino'));
  assert.deepEqual(await p.evaluate(()=>window.__visit.travel_preferences['00000000-0000-4000-8000-000000000002']),['Treno']);
  await button('Confronta i punti di incontro').click();await button('Usa Napoli Centrale').waitFor();await button('Distanze simili').click();assert.equal(await p.evaluate(()=>window.__journeyCalls.filter(c=>c.rpc==='midpoint').length),1);
  await button('Inserisci o correggi i chilometri').click();const fields=p.getByRole('textbox');
  // Only the six route-distance fields are mounted in this sheet.
  const labels=['Tu → punto di incontro · km','Partner → punto di incontro · km','Percorso insieme · andata · km','Tu → casa · km','Partner → casa · km','Percorso insieme · ritorno · km'];
  for(let i=0;i<6;i++)await p.getByLabel(labels[i],{exact:true}).fill(String([70,40,100,70,40,100][i]));
  await button('Salva percorso e aggiorna statistiche').click();await button('Conferma percorso').click();await p.getByText('420 km totali',{exact:true}).waitFor();
  await p.getByText('200 km percorsi insieme, contati una sola volta.',{exact:true}).waitFor();
  await p.getByRole('tab',{name:'Valigia',exact:true}).click();await p.getByText('Elettronica · 1/1 preparati',{exact:true}).waitFor();await button('Documenti (1)').click();await p.getByText('Documenti · 0/1 preparati',{exact:true}).waitFor();assert.equal(await p.getByText('Caricatore × 2',{exact:false}).count(),0);
  await button('Tutti (2)').click();await button('✅ Caricatore × 2').click();await p.getByText('Elettronica · 0/1 preparati',{exact:true}).waitFor();
  await button('Modifica inizio e fine effettivi').click();await button('Salva orari').click();await button('Annulla').and(p.locator(':not([disabled])')).click();await p.getByLabel('Ora di inizio effettivo (HH:MM)',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>window.__journeyCalls.filter(c=>c.rpc==='update_visit_actual_times').length),0,'Cancelling confirmation does not save or lose the form');
  await button('Salva orari').click();await p.getByText('Salva gli orari effettivi',{exact:true}).waitFor();await button('Salva orari').and(p.locator(':not([disabled])')).click();await p.waitForFunction(()=>window.__journeyCalls.some(c=>c.rpc==='update_visit_actual_times'));
  await p.waitForFunction(()=>document.querySelectorAll('[role="dialog"]').length===0);
  const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);assert.deepEqual(errors,[]);
  await p.screenshot({path:`.feature-build/journeys-review-${engine}-${width}.png`,fullPage:true});
  console.log(`PASS exported app ${engine} ${width}px: Home server-day streak, cover crop/rotation save, own-only modes/Cammino, midpoint criterion without another call, 420/200 km, packing groups/filter/checks, actual-time confirmation/cancel, no horizontal overflow or page errors. Mock backend only.`);
 }finally{await browser.close();}
}
(async()=>{const server=await serve();try{for(const[e,w]of [['chromium',320],['webkit',390],['chromium',1280]])await run(e,w,'http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});

