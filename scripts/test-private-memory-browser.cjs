const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||'4186');
const origin=fs.readFileSync('src/config/supabase.ts','utf8').match(/const SUPABASE_URL = '([^']+)'/)[1];
const visit='00000000-0000-4000-8000-000000000011';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});try{
 const results=[];
 for(const width of [320,1280]){
  const c=await browser.newContext({viewport:{width,height:950}});
  await c.addInitScript(({origin,visit})=>{
   localStorage.setItem('pulse-local-demo-login-v1','yes');
   const me='00000000-0000-4000-8000-000000000001',partner='00000000-0000-4000-8000-000000000002';
   localStorage.setItem('pulse-local-demo-data-v1',JSON.stringify({users:[{id:me,name:'Admin'},{id:partner,name:'Partner'}],visits:[{id:visit,title:'Ricordo privato TEST',start_date:'2010-01-01',end_date:'2010-01-02',created_by:me,status:'concluded',cover_source:'default',memory_photos:[origin+'/storage/v1/object/public/meetings/'+visit+'/old.preview-jpg.full.jpg']}],trip_expenses:[],settlements:[],bucket_list:[],visit_bucket_items:[],daily_answers:[],pulse_logs:[],couple_settings:[]}));
   document.addEventListener('DOMContentLoaded',()=>{
    const original=window.fetch;window.privateSigns=[];window.memoryUploads=[];
    window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);
     if(url.pathname.startsWith('/storage/v1/object/sign/meetings/')){window.privateSigns.push({path:url.pathname,ttl:JSON.parse(options.body).expiresIn});return new Response(JSON.stringify({signedURL:url.pathname.replace('/storage/v1','')+'?token=fixture'}),{headers:{'content-type':'application/json'}});}
     if(url.pathname.startsWith('/storage/v1/object/meetings/')&&options.method==='POST'){window.memoryUploads.push(url.pathname);return new Response(JSON.stringify({Key:url.pathname.split('/object/')[1],Id:'test'}),{headers:{'content-type':'application/json'}});}
     return original(input,options);
    };
   });
  },{origin,visit});
  const imageRequests=[],publicReads=[];
  await c.route('**/*',r=>{const url=r.request().url();if(url.startsWith(base+'/'))return r.continue();if(url.startsWith(origin+'/storage/v1/object/sign/meetings/')&&r.request().method()==='GET'){imageRequests.push(url);return r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#e99bb0"/></svg>'});}if(url.includes('/object/public/meetings/'))publicReads.push(url);return r.abort();});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/memories');await p.getByRole('button',{name:'Apri ricordo Ricordo privato TEST',exact:true}).waitFor();
  await p.waitForFunction(()=>window.privateSigns.length>0);assert.ok(imageRequests.some(u=>u.includes('old.thumb.jpg')));
  await p.getByRole('button',{name:'Apri ricordo Ricordo privato TEST',exact:true}).click();await p.getByRole('tab',{name:'Ricordi',exact:true}).click();
  await p.waitForFunction(()=>window.privateSigns.some(x=>x.path.endsWith('old.preview-jpg.full.jpg')));
  await p.getByRole('button',{name:'Modifica ricordo',exact:true}).click();
  const fixture=Buffer.from(await p.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=600;const g=c.getContext('2d');g.fillStyle='#e99bb0';g.fillRect(0,0,900,600);return c.toDataURL('image/jpeg').split(',')[1];}),'base64');
  const chooser=p.waitForEvent('filechooser');await p.getByRole('button',{name:'Aggiungi foto (1/3)',exact:true}).click();await(await chooser).setFiles([{name:'one.jpg',mimeType:'image/jpeg',buffer:fixture},{name:'two.jpg',mimeType:'image/jpeg',buffer:fixture}]);
  await p.getByRole('button',{name:'Aggiungi foto (3/3)',exact:true}).waitFor();
  await p.getByRole('button',{name:'Salva ricordo',exact:true}).click();
  await p.waitForFunction(visit=>JSON.parse(localStorage.getItem('pulse-local-demo-data-v1')).visits.find(v=>v.id===visit).memory_photos.length===3,visit);
  const stored=await p.evaluate(visit=>JSON.parse(localStorage.getItem('pulse-local-demo-data-v1')).visits.find(v=>v.id===visit).memory_photos,visit);
  assert.equal(new Set(stored).size,3);assert.ok(stored.every(u=>!u.includes('token=')));
  await p.getByRole('button',{name:'Modifica ricordo',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Rimuovi foto',exact:true}).count(),3);
  const signCount=await p.evaluate(()=>window.privateSigns.length);
  assert.ok((await p.evaluate(()=>window.privateSigns)).every(s=>s.ttl===300));
  assert.equal(publicReads.length,0);assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  results.push({width,photosAfterBatch:3,temporaryURLsPersisted:false,publicReads:0,signCount,allTTLs:300});await c.close();
 }
 fs.writeFileSync('.feature-build/private-memory-browser.json',JSON.stringify(results,null,2));console.log('PASS private memory UI:',results);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
