const fs=require('node:fs'),assert=require('node:assert/strict');
const{chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||4193);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});try{
 for(const width of [320,390,1280]){
  const c=await browser.newContext({viewport:{width,height:950}});await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{localStorage.setItem('pulse-local-demo-login-v1','yes');document.addEventListener('DOMContentLoaded',()=>{
   const original=window.fetch;window.sentPulses=[];window.failPulse=false;
   window.fetch=async(input,options={})=>{const u=new URL(typeof input==='string'?input:input.url,location.href);
    if(u.pathname==='/rest/v1/pulse_logs'&&options.method==='POST'){
     const body=JSON.parse(options.body);window.sentPulses.push(body[0]);await new Promise(resolve=>setTimeout(resolve,150));
     return new Response(JSON.stringify(window.failPulse?{message:'Errore di prova'}:null),{status:window.failPulse?400:201,headers:{'content-type':'application/json'}});
    }
    return original(input,options);
   };
  })});
  const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await page.goto(base+'/');
  const message=page.getByLabel('Aggiungi un messaggio (facoltativo)',{exact:true});
  for(const [id,label,emoji]of [['miss_you','Mi manchi','🫂'],['coffee','Caffè?','☕'],['urgent','Rispondimi','⚡'],['thinking','Ti penso',null]]){
   await message.fill('Messaggio '+id);
   await page.getByRole('button',{name:'Seleziona '+label,exact:true}).click();
   const central=page.getByRole('button',{name:'Invia Pulse: '+label,exact:true});await central.waitFor();
   if(emoji)assert.ok((await central.innerText()).includes(emoji));
   assert.equal(await page.getByRole('button',{name:'Seleziona '+label,exact:true}).count(),0,'Selected option moves into central button');
   assert.equal(await page.getByRole('button',{name:/^Seleziona /}).count(),3);
   assert.equal(await page.getByRole('button',{name:'Invia '+label,exact:true}).count(),0,'No separate send button');
   assert.equal(await message.inputValue(),'Messaggio '+id,'Selecting preserves the message');
   await central.dblclick();await page.waitForFunction(()=>document.querySelector('input[aria-label="Aggiungi un messaggio (facoltativo)"]')?.value==='');
   const rows=await page.evaluate(()=>window.sentPulses);assert.equal(rows.at(-1).type,id);assert.equal(rows.at(-1).message,'Messaggio '+id);
  }
  assert.equal(await page.evaluate(()=>window.sentPulses.length),4,'Double tap sends only one pulse per choice');
  await page.getByRole('button',{name:'Seleziona Rispondimi',exact:true}).click();await message.fill('Da conservare');await page.evaluate(()=>window.failPulse=true);
  await page.getByRole('button',{name:'Invia Pulse: Rispondimi',exact:true}).click();await page.getByText('Pulse non inviato: Errore di prova',{exact:false}).waitFor();assert.equal(await message.inputValue(),'Da conservare');
  await page.getByRole('button',{name:'Invia Pulse: Rispondimi',exact:true}).waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  if(width===390){await page.getByRole('button',{name:'Invia Pulse: Rispondimi',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'.feature-build/pulse-selector-390.png',fullPage:true});}
  console.log(`PASS pulse selector ${width}px: all four choices/icons, correct payload/message, no duplicate send button, double-tap protection, message retained on error, no overflow`);await c.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
