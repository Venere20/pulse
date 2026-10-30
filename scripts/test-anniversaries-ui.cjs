const pickDate=require('./browser-date-picker.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||4189);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});try{
 const results=[];for(const width of [320,390,1280]){
  const c=await browser.newContext({viewport:{width,height:950}});await c.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  await c.addInitScript(()=>{
   localStorage.setItem('pulse-local-demo-login-v1','yes');
   document.addEventListener('DOMContentLoaded',()=>{
    const original=window.fetch;let rows=JSON.parse(localStorage.getItem('qa-anniversaries')||'[]');window.anniversarySaves=[];
    const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
    window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);
     if(url.pathname==='/rest/v1/anniversaries')return json(rows);
     if(url.pathname==='/rest/v1/rpc/save_anniversary_v2'){
      const b=JSON.parse(options.body);window.anniversarySaves.push(b);const id=b.p_id||crypto.randomUUID();const row={id,author_id:'00000000-0000-4000-8000-000000000001',title:b.p_title,first_day:b.p_first,annual:b.p_repeat==='yearly',monthly:b.p_repeat==='monthly',emoji:b.p_emoji,notify:b.p_notify};rows=[...rows.filter(r=>r.id!==id),row];localStorage.setItem('qa-anniversaries',JSON.stringify(rows));return json(id);
     }
     if(url.pathname==='/rest/v1/rpc/delete_anniversary'){const b=JSON.parse(options.body);rows=rows.filter(r=>r.id!==b.p_id);localStorage.setItem('qa-anniversaries',JSON.stringify(rows));return json(null)}
     return original(input,options);
    };
   });
  });
  const page=await c.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/ricorrenze');
  await page.getByRole('button',{name:'Mesiversario',exact:true}).click();assert.equal(await page.getByLabel('Cosa festeggiamo?',{exact:true}).inputValue(),'Il nostro mesiversario');assert.equal(await page.getByRole('button',{name:'Ogni mese',exact:true}).getAttribute('aria-pressed'),'true');
  await pickDate(page,'Data di inizio','2026-01-31');await page.getByRole('button',{name:'Salva ricorrenza',exact:true}).click();
  try{await page.getByText('Il nostro mesiversario',{exact:false}).waitFor()}catch(e){fs.writeFileSync('.feature-build/anniversaries-ui-failure.json',JSON.stringify(await page.evaluate(()=>({body:document.body.innerText,saves:window.anniversarySaves,stored:localStorage.getItem('qa-anniversaries')})),null,2));throw e}
  await page.getByRole('button',{name:'Anniversario',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Ogni anno',exact:true}).getAttribute('aria-pressed'),'true');await pickDate(page,'Data di inizio','2024-02-29');await page.getByRole('button',{name:'Salva ricorrenza',exact:true}).click();await page.getByText('Il nostro anniversario',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Aggiungi altra ricorrenza',exact:true}).click();await page.getByLabel('Cosa festeggiamo?',{exact:true}).fill('Una data scelta da noi');assert.equal(await page.getByRole('textbox',{name:'Data di inizio',exact:true}).count(),0,'Dates are selected from a calendar');
  await pickDate(page,'Data di inizio','2026-02-28');await page.getByRole('button',{name:'Una sola volta',exact:true}).click();await page.getByRole('button',{name:'Salva ricorrenza',exact:true}).click();await page.getByText('Una data scelta da noi',{exact:false}).waitFor();
  const card=page.getByText('Il nostro mesiversario',{exact:false}).locator('..');await card.getByRole('button',{name:'Modifica ricorrenza',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Ogni mese',exact:true}).getAttribute('aria-pressed'),'true');await page.getByLabel('Cosa festeggiamo?',{exact:true}).fill('Mesiversario aggiornato');await page.getByRole('button',{name:'Salva ricorrenza',exact:true}).click();await page.getByText('Mesiversario aggiornato',{exact:false}).waitFor();
  const saves=await page.evaluate(()=>window.anniversarySaves);assert.deepEqual(saves.map(b=>b.p_repeat),['monthly','yearly','once','monthly']);assert.equal(saves[3].p_first,'2026-01-31');assert.ok(saves[3].p_id);
  await page.reload();await page.getByText('Mesiversario aggiornato',{exact:false}).waitFor();await page.getByText('Il nostro anniversario',{exact:false}).waitFor();await page.getByText('Una data scelta da noi',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  const small=await page.getByRole('button',{name:'Mesiversario',exact:true}).boundingBox();assert.ok(small.height>=44);
  if(width===390)await page.screenshot({path:'.feature-build/anniversaries-390.png',fullPage:true});
  results.push({width,monthlySaved:true,annualSaved:true,manualSaved:true,invalidDateBlocked:true,monthlyEditPreserved:true,reload:true,noOverflow:true});await c.close();
 }
 fs.writeFileSync('.feature-build/anniversaries-ui-results.json',JSON.stringify(results,null,2));console.log('PASS anniversaries UI',results);
}finally{await browser.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});

