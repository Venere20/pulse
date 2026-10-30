const assert=require('node:assert/strict');const{chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||4195);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});try{
 for(const width of [320,390,1280]){
  const c=await browser.newContext({viewport:{width,height:950}});await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{localStorage.setItem('pulse-local-demo-login-v1','yes');document.addEventListener('DOMContentLoaded',()=>{
   const original=window.fetch,json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
   let rows=[['Aperta di prova','open'],['Da dettaglio','cancelled'],['Confermata di prova','confirmed']].map(([title,status],i)=>({id:'00000000-0000-4000-8000-00000000006'+i,title,status,place:'Roma',note:'',created_by:'00000000-0000-4000-8000-000000000002',visit_id:status==='confirmed'?'00000000-0000-4000-8000-000000000010':null}));
   window.proposalDeletes=[];window.failDelete=false;
   window.fetch=async(input,options={})=>{const u=new URL(typeof input==='string'?input:input.url,location.href);
    if(u.pathname==='/rest/v1/date_proposals')return json(rows);
    if(u.pathname==='/rest/v1/rpc/delete_date_proposal'){const b=JSON.parse(options.body);window.proposalDeletes.push(b.p_proposal);if(window.failDelete)return json({message:'Errore di prova'},400);rows=rows.filter(p=>p.id!==b.p_proposal);return json(null)}
    return original(input,options);
   };
  })});
  const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await page.goto(base+'/proposte');
  const card=title=>page.getByText(title,{exact:true}).filter({visible:true}).locator('..');
  await card('Aperta di prova').getByRole('button',{name:'Elimina proposta',exact:true}).click();await page.getByRole('button',{name:'Annulla',exact:true}).click();assert.equal(await page.evaluate(()=>window.proposalDeletes.length),0);
  await card('Aperta di prova').getByRole('button',{name:'Elimina proposta',exact:true}).click();await page.getByRole('button',{name:'Elimina proposta',exact:true}).last().click();await page.getByText('Aperta di prova',{exact:true}).waitFor({state:'hidden'});
  await card('Da dettaglio').getByRole('button',{name:'Apri',exact:true}).click();await page.getByRole('button',{name:'Elimina proposta',exact:true}).click();await page.getByRole('button',{name:'Elimina proposta',exact:true}).last().click();await page.waitForURL(u=>u.pathname.replace(/\/$/,'')==='/proposte');await page.getByText('Da dettaglio',{exact:true}).waitFor({state:'hidden'});
  await page.evaluate(()=>window.failDelete=true);await card('Confermata di prova').getByRole('button',{name:'Elimina proposta',exact:true}).click();await page.getByText('L’incontro già creato, i ricordi e le spese resteranno intatti.',{exact:false}).waitFor();await page.getByRole('button',{name:'Elimina proposta',exact:true}).last().click();await page.getByText('Errore di prova',{exact:false}).waitFor();await page.getByText('Confermata di prova',{exact:true}).filter({visible:true}).waitFor();
  await page.evaluate(()=>window.failDelete=false);await card('Confermata di prova').getByRole('button',{name:'Elimina proposta',exact:true}).click();await page.getByRole('button',{name:'Elimina proposta',exact:true}).last().click();await page.getByText('Confermata di prova',{exact:true}).filter({visible:true}).waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log(`PASS delete proposals UI ${width}px: list/detail, confirmation cancel, confirmed visit warning, failed deletion retains proposal, retry, return to list, no overflow`);await c.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
