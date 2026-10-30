const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {chromium,webkit}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const labels=['😊 Felice','😌 Sereno/a','😴 Stanco/a','😔 Giù','😟 In ansia','🫠 Troppe cose','🥰 Amato/a','🫂 Mi sento solo/a','🤩 Entusiasta','😒 Infastidito/a','😠 Arrabbiato/a','😞 Dispiaciuto/a'];
async function serve(){const filename=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(fs.readFileSync(filename,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(path.resolve('.feature-build/emotions-v2-web'))),filename);const server=m.exports;await new Promise(r=>server.listen(0,'127.0.0.1',r));return server;}
async function run(browser,base,engine,width){
 const context=await browser.newContext({viewport:{width,height:width===320?568:844},hasTouch:true,isMobile:true,timezoneId:'Europe/Rome'});await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await context.routeWebSocket('**/*',ws=>ws.close());
 await context.addInitScript(({A,B})=>{
  localStorage.setItem('pulse-local-demo-login-v1','yes');localStorage.setItem('pulse-draft:release-notes:'+A,'2026-10-25-canvas-moods-recap');
  let hidden=false;Object.defineProperty(document,'hidden',{get:()=>hidden});Object.defineProperty(document,'visibilityState',{get:()=>hidden?'hidden':'visible'});window.__foreground=value=>{hidden=!value;document.dispatchEvent(new Event('visibilitychange'));};
  document.addEventListener('DOMContentLoaded',()=>{
   const original=window.fetch,json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
   window.__moods=JSON.parse(localStorage.getItem('test-emotions')||'null')??[{id:A,mood:'happy',note:'Nota già condivisa da me',expires_at:new Date(Date.now()+7200000).toISOString()},{id:B,mood:'calm',note:'Nota del partner '+ 'p'.repeat(110),expires_at:new Date(Date.now()+7200000).toISOString()}];window.__emotionCalls=JSON.parse(localStorage.getItem('test-emotion-calls')||'[]');
   window.fetch=async(input,options={})=>{const u=new URL(typeof input==='string'?input:input.url,location.href);
    if(u.pathname==='/rest/v1/emotional_states')return json(window.__moods);
    if(u.pathname==='/rest/v1/rpc/set_my_emotion'){
     const body=JSON.parse(options.body);window.__emotionCalls.push(body);localStorage.setItem('test-emotion-calls',JSON.stringify(window.__emotionCalls));
     window.__moods=window.__moods.filter(row=>row.id!==A);if(body.p_mood)window.__moods.push({id:A,mood:body.p_mood,note:body.p_note,expires_at:new Date(Date.now()+body.p_minutes*60000).toISOString()});localStorage.setItem('test-emotions',JSON.stringify(window.__moods));return json(null);
    }return original(input,options);
   };
  });
 },{A,B});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(12000);await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'));
 const own=()=>page.getByText('TU',{exact:true}).locator('..');
 try{
 await page.goto(base+'/umore');await page.getByText('Adesso',{exact:true}).waitFor();await own().getByText('😊 Felice',{exact:true}).waitFor();await page.getByText('Fino alle 15:00',{exact:true}).first().waitFor();
 assert.equal(await page.getByText('Nota già condivisa da me',{exact:true}).count(),0);await page.getByRole('button',{name:'Leggi le note condivise',exact:true}).click();await page.getByText('Nota già condivisa da me',{exact:true}).waitFor();assert.ok((await page.getByText(/^Nota del partner/).textContent()).endsWith('p'.repeat(110)));await page.getByRole('button',{name:'Nascondi le note condivise',exact:true}).click();
 for(const label of labels.slice(0,6))await page.getByRole('button',{name:label,exact:true}).waitFor();for(const label of labels.slice(6))assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),0);
 assert.equal(await page.getByLabel('Vuoi aggiungere una frase?').count(),0);
 await page.getByRole('button',{name:'Mostra tutte le 12 emozioni',exact:true}).click();for(const label of labels)await page.getByRole('button',{name:label,exact:true}).waitFor();await page.getByRole('button',{name:'😒 Infastidito/a',exact:true}).click();await own().getByText('😊 Felice',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__emotionCalls.length),0,'Selecting only changes the draft');
 await page.getByRole('button',{name:'Mostra meno emozioni',exact:true}).click();await page.getByRole('button',{name:'😒 Infastidito/a',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'😠 Arrabbiato/a',exact:true}).count(),0);
 await page.screenshot({path:'.feature-build/emotions-v2-'+engine+'-'+width+'.png',fullPage:true});
 await page.getByRole('button',{name:'Dettagli della condivisione',exact:true}).click();const input=page.getByLabel('Vuoi aggiungere una frase?');assert.equal(await input.getAttribute('maxlength'),'140');await input.fill('x'.repeat(141));assert.equal((await input.inputValue()).length,140);await page.getByText('140/140',{exact:true}).waitFor();
 for(const [label,minutes]of [['30 minuti',30],['2 ore',120],['8 ore',480],['1 giorno',1440]]){
  await page.getByRole('button',{name:label,exact:true}).click();const before=await page.evaluate(()=>window.__emotionCalls.length);await page.getByRole('button',{name:'Condividi come mi sento',exact:true}).click();await page.waitForFunction(before=>window.__emotionCalls.length===before+1,before);assert.deepEqual(await page.evaluate(()=>window.__emotionCalls.at(-1)),{p_mood:'annoyed',p_note:'x'.repeat(140),p_minutes:minutes,p_notify:false});await own().getByText('😒 Infastidito/a',{exact:true}).waitFor();
 }
 await page.getByRole('button',{name:'Senza notifica',exact:true}).click();await page.getByRole('button',{name:'Condividi come mi sento',exact:true}).click();await page.waitForFunction(()=>window.__emotionCalls.at(-1)?.p_notify===true);
 const partnerBefore=await page.evaluate(B=>JSON.stringify(window.__moods.find(row=>row.id===B)),B);await page.getByRole('button',{name:'Nascondi il mio umore',exact:true}).click();await own().getByText('Nessun umore condiviso',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__emotionCalls.at(-1).p_mood),null);assert.equal(await page.evaluate(()=>window.__emotionCalls.at(-1).p_note),'');assert.equal(await input.inputValue(),'x'.repeat(140));assert.equal(await page.evaluate(B=>JSON.stringify(window.__moods.find(row=>row.id===B)),B),partnerBefore);
 await page.waitForTimeout(450);await page.reload();await page.getByText('Adesso',{exact:true}).waitFor();await own().getByText('Nessun umore condiviso',{exact:true}).waitFor();await page.getByRole('button',{name:'😒 Infastidito/a',exact:true}).waitFor();await page.getByRole('button',{name:'Dettagli della condivisione',exact:true}).click();assert.equal(await input.inputValue(),'x'.repeat(140));await page.getByRole('button',{name:'Avvisa il partner ✓',exact:true}).waitFor();
 const resume=async()=>{await page.clock.setFixedTime(new Date(await page.evaluate(()=>Date.now())+1000));await page.evaluate(()=>window.__foreground(false));await page.waitForTimeout(300);await page.evaluate(()=>window.__foreground(true));};
 await page.evaluate(B=>{const row=window.__moods.find(row=>row.id===B);row.mood='angry';row.note='Nuova nota del partner';},B);await resume();await page.getByText('😠 Arrabbiato/a',{exact:true}).waitFor();await page.getByRole('button',{name:'Leggi le note condivise',exact:true}).click();await page.getByText('Nuova nota del partner',{exact:true}).waitFor();
 await page.evaluate(B=>{window.__moods.find(row=>row.id===B).expires_at=new Date(Date.now()-1000).toISOString();},B);await resume();await page.getByText('Nessuno stato attivo',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Leggi le note condivise',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const clipped=await page.evaluate(()=>[...document.querySelectorAll('[role=button]')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent));assert.deepEqual(clipped,[]);
 await page.getByRole('button',{name:'Di cosa avresti bisogno?',exact:true}).click();await page.waitForURL(u=>u.pathname==='/vicinanza');await page.getByText('Oggi mi farebbe bene…',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS '+engine+' '+width+'px: published/draft distinction, 6/12/7 choices, complete notes, 140-char limit, four RPC durations, notify/hide contract, draft reload, partner refresh/expiry, Vicinanza and no clipping/runtime errors.');
 }catch(error){await page.screenshot({path:'.feature-build/emotions-v2-failure-'+engine+'-'+width+'.png',fullPage:true});console.log('UI diagnostics',engine,width,await page.locator('body').innerText());throw error;}finally{await context.close();}
}
(async()=>{const server=await serve(),base='http://127.0.0.1:'+server.address().port;try{for(const [name,launcher,options,widths]of [['chromium',chromium,{executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'},[320,360,390]],['webkit',webkit,{},[390]]]){const browser=await launcher.launch({headless:true,...options});try{for(const width of widths)await run(browser,base,name,width);}finally{await browser.close();}}}finally{await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1});

