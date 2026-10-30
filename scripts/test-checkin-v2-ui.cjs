// Real exported UI with isolated local fixtures; no production requests.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {chromium,webkit}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A='00000000-0000-4000-8000-000000000001';
const shared=process.argv.includes('--shared');
async function main(){
 const file=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
 m._compile(fs.readFileSync(file,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(path.resolve(process.argv.includes('--fixes')?'.feature-build/checkin-four-fixes-web':process.argv.includes('--future')?'.feature-build/checkin-future-web':process.argv.includes('--favorites')?'.feature-build/checkin-favorites-web':(shared||process.argv.includes('--v22'))?'.feature-build/checkin-v22-web':'.feature-build/checkin-v2-web'))),file);
 const server=m.exports;await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==='chromium'?{executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe',headless:true}:{});
 try{for(const width of name==='chromium'?[320,390]:[390]){
 const context=await browser.newContext({viewport:{width,height:844},timezoneId:'Europe/Rome',hasTouch:true,isMobile:true});
 await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await context.routeWebSocket('**/*',ws=>ws.close());
 await context.addInitScript(({A})=>{
 localStorage.setItem('pulse-local-demo-login-v1','yes');localStorage.setItem('pulse-draft:release-notes:'+A,'2026-10-27-checkin-four-fixes');
 document.addEventListener('DOMContentLoaded',()=>{
 const original=window.fetch,json=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
 window.__routes=[];window.__checkins=[];window.__calls=[];
 window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href),b=JSON.parse(options.body||'{}');
 if(url.pathname==='/rest/v1/checkin_routes')return json(window.__routes);
 if(url.pathname==='/rest/v1/feature_preferences')return json([{user_id:A,checkin_grace_minutes:30}]);
 if(url.pathname==='/rest/v1/safe_checkins')return json(window.__checkins);
 if(url.pathname==='/rest/v1/rpc/checkin_partner_reachable')return json(true);
 if(url.pathname==='/rest/v1/rpc/save_checkin_route'){window.__calls.push({name:'save',b});const id=b.p_id||crypto.randomUUID();window.__routes=window.__routes.filter(r=>r.id!==id).concat({...b.p_route,id,user_id:A,created_at:new Date().toISOString()});return json(id);}
 if(url.pathname==='/rest/v1/rpc/start_checkin_v2'){window.__calls.push({name:'start',b});window.__checkins=[{id:crypto.randomUUID(),user_id:A,label:b.p_label,note:b.p_note,origin:b.p_origin,departed_at:b.p_departed_at,due_at:new Date(Date.parse(b.p_departed_at)+b.p_minutes*60000).toISOString(),grace_minutes:b.p_grace,flow_version:2,status:'active',extensions:0,created_at:new Date().toISOString()}];return json(window.__checkins[0].id);}
 if(url.pathname==='/rest/v1/rpc/update_checkin_v2'){window.__calls.push({name:'update',b});const c=window.__checkins.find(c=>c.id===b.p_id);if(b.p_action==='arrived')c.status='arrived';if(b.p_action==='extend'){c.due_at=new Date(Date.parse(c.due_at)+b.p_minutes*60000).toISOString();c.extensions++;}return json(null);}
 return original(input,options);};});},{A});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 const button=t=>page.getByRole('button',{name:t,exact:true});
 await page.goto(base+'/checkin');await button('Nuovo tragitto o viaggio singolo').click();if(process.argv.includes('--fixes'))assert.equal(await button('30 min').last().getAttribute('aria-pressed'),'true');
 await page.getByLabel('Destinazione',{exact:true}).fill('Napoli Centrale');
 await button('45 min').count();await page.getByLabel(shared?'Oppure inserisci i minuti (5–720)':'Durata abituale in minuti (5–720)',{exact:true}).fill('45');
 await button('15 min').last().click();
 await button(shared?'Modifica':'Modifica la partenza').click();await page.getByLabel(shared?'Ora di partenza (HH:MM)':'Ora di partenza (HH:MM, ora del dispositivo)').waitFor();await button(shared?'Usa ora attuale':'Usa l’ora attuale').click();
 await button('Salva o modifica le preferenze').click();if(!shared) await page.getByLabel('Nome del tragitto',{exact:true}).fill('Verso Napoli');await page.getByLabel('Partenza facoltativa',{exact:true}).fill('Ischia');
 await button('Avvio con riepilogo').click();await button('Aggiungi ai preferiti').click();await button('Salva tragitto').click();if(shared&&!process.argv.includes('--favorites')&&!process.argv.includes('--future')&&!process.argv.includes('--fixes')){if(await button('Chiudi preparazione').count()) await button('Chiudi preparazione').click();if(!await button('Parti ora').count()) await button('I tuoi tragitti (1)').click();}await button('Parti ora').waitFor();
 assert.equal(await page.evaluate(()=>window.__routes[0].minutes),45);assert.equal(await page.evaluate(()=>window.__routes[0].grace_minutes),15);if(shared){assert.equal(await page.evaluate(()=>window.__routes[0].name),'Napoli Centrale');assert.equal(await page.evaluate(()=>window.__routes[0].favorite),true);}
 await page.screenshot({path:'.feature-build/checkin-v2-'+name+'-'+width+'-routes.png',fullPage:true});
 await button('Parti ora').click();await button('Sono arrivato/a').waitFor();
 const call=await page.evaluate(()=>window.__calls.find(c=>c.name==='start').b);assert.equal(call.p_minutes,45);assert.ok(Math.abs(Date.now()-Date.parse(call.p_departed_at))<10000);
 await button('+15 min').click();await page.waitForFunction(()=>window.__calls.some(c=>c.name==='update'&&c.b.p_action==='extend'));
 await button('Sono arrivato/a').click();await button('Parti ora').waitFor();
 // Existing route is immutable unless explicitly saved.
 await button('Modifica').click();await page.getByLabel(shared?'Oppure inserisci i minuti (5–720)':'Durata abituale in minuti (5–720)').fill('60');await button('Avvia questo viaggio').click();await button('Sono arrivato/a').waitFor();assert.equal(await page.evaluate(()=>window.__routes[0].minutes),45);
 if(shared){const foot=await button('Sono arrivato/a').boundingBox();assert.ok(foot.y>=0&&foot.y+foot.height<=844);await page.setViewportSize({width,height:480});const reduced=await button('Sono arrivato/a').boundingBox();assert.ok(reduced.y>=0&&reduced.y+reduced.height<=480);await page.setViewportSize({width,height:844});}
 await page.screenshot({path:'.feature-build/checkin-v2-'+name+'-'+width+'-active.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(process.argv.includes('--future')){
 await page.clock.setFixedTime(new Date('2026-10-27T17:53:00.000Z'));await page.reload();await button('Nuovo tragitto o viaggio singolo').click();
 await page.getByLabel('Destinazione',{exact:true}).fill('accompagno fratm');await page.getByLabel('Oppure inserisci i minuti (5–720)').fill('85');await button('Modifica').click();await page.getByLabel('Ora di partenza (HH:MM)',{exact:true}).fill('19:10');
 await page.getByText('20:35',{exact:true}).waitFor();await button('Avvia questo viaggio').click();await button('Sono arrivato/a').waitFor();await page.getByText('◷ PARTENZA PREVISTA',{exact:true}).waitFor();
 const scheduled=await page.evaluate(()=>window.__calls.find(c=>c.name==='start').b);assert.equal(scheduled.p_departed_at,'2026-10-27T18:10:00.000Z');assert.equal(scheduled.p_minutes,85);
 assert.equal(await page.evaluate(()=>window.__checkins[0].due_at),'2026-10-27T19:35:00.000Z');await page.screenshot({path:'.feature-build/checkin-future-'+name+'-'+width+'.png'});
 }
 assert.deepEqual(errors,[]);await context.close();console.log('PASS',name,width,'route save, defaults, quick start, extensions, arrival, journey-only override and layout');
 }}finally{await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
