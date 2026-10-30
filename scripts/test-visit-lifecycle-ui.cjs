const fs=require('node:fs'),assert=require('node:assert/strict');
const{chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||4192);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});try{
 for(const width of [320,390,1280]){
  const c=await browser.newContext({viewport:{width,height:950}});await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{localStorage.setItem('pulse-local-demo-login-v1','yes');document.addEventListener('DOMContentLoaded',()=>{
   const original=window.fetch,json=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});let override=null,knownVisits=[];window.lifecycleActions=[];
   window.fetch=async(input,options={})=>{const u=new URL(typeof input==='string'?input:input.url,location.href);
    if(u.pathname==='/rest/v1/rpc/visit_lifecycle'){
     const b=JSON.parse(options.body);window.lifecycleActions.push(b.p_action);const v=override||knownVisits.find(v=>v.id===b.p_visit);
     override={...v,timing_mode:b.p_action==='scheduled'?'scheduled':'manual'};
     if(b.p_action==='start')override.started_at=new Date().toISOString();
     if(b.p_action==='finish'){override.ended_at=new Date().toISOString();override.status='concluded'}
     return json(override);
    }
    const result=await original(input,options);
    if(u.pathname==='/rest/v1/visits'&&(!options.method||options.method==='GET')){const rows=await result.json();knownVisits=rows;return json(rows.map(v=>override&&v.id===override.id?override:v))}
    return result;
   };
  })});
  const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.goto(base+'/visit/00000000-0000-4000-8000-000000000010');
  await page.getByRole('button',{name:'Manuale / arrivo',exact:true}).click();await page.getByText('IN ATTESA DEL VOSTRO ARRIVO',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Concludi incontro',exact:true}).count(),0);
  await page.getByRole('button',{name:'Sono arrivato/a',exact:true}).click();await page.getByText('Il vostro incontro è iniziato',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Sono arrivato/a',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Concludi incontro',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'Sono rientrato/a',exact:true}).click();await page.getByRole('button',{name:'Annulla',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.lifecycleActions),['manual','start'],'Cancelled confirmation makes no write');
  await page.getByRole('button',{name:'Concludi incontro',exact:true}).click();await page.getByRole('button',{name:'Concludi incontro',exact:true}).last().click();
  await page.getByText('INCONTRO CONCLUSO',{exact:true}).waitFor();await page.getByText('Fine confermata:',{exact:false}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.lifecycleActions),['manual','start','finish']);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  if(width===390)await page.screenshot({path:'.feature-build/visit-lifecycle-390.png',fullPage:true});
  console.log(`PASS visit lifecycle UI ${width}px: manual mode, arrival, return cancellation, confirmed end, no overflow or page errors`);await c.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
