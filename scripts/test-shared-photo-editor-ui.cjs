const assert=require('node:assert/strict');
const {chromium,webkit}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||4204),origin='https://xptsgwcywxphledcafvs.supabase.co';
(async()=>{
 for(const[engine,width]of [['webkit',390],['chromium',320],['chromium',1280]]){
  const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'}:{})});
  try{
   const c=await browser.newContext({viewport:{width,height:1000},isMobile:width<500,hasTouch:width<500});await c.routeWebSocket('**/*',ws=>ws.close());
   await c.addInitScript(()=>{
    const me='00000000-0000-4000-8000-000000000001',partner='00000000-0000-4000-8000-000000000002',cid='00000000-0000-4000-8000-000000000021';
    localStorage.setItem('pulse-local-demo-login-v1','yes');
    if(!localStorage.getItem('pulse-local-demo-data-v1'))localStorage.setItem('pulse-local-demo-data-v1',JSON.stringify({users:[{id:me,name:'Admin'},{id:partner,name:'Partner'}],visits:[],trip_expenses:[],settlements:[],bucket_list:[],visit_bucket_items:[],daily_answers:[],pulse_logs:[],couple_settings:[],story_moments:[{id:'moment',author_id:me,title:'Momento esistente',day:'2026-01-01',body:'Un ricordo',photo_paths:[me+'/photo.jpg']}],time_capsules:[{id:cid,author_id:me,recipient_id:partner,label:'Capsula esistente',unlock_kind:'manual',manual_hint:'Quando vuoi',status:'sealed',created_at:'2026-10-18T08:00:00Z'}],capsule_contents:[{capsule_id:cid,body:'Un messaggio',photo_paths:[cid+'/photo.jpg']}]}));
    document.addEventListener('DOMContentLoaded',()=>{
     const original=window.fetch;
     window.fetch=async(input,options={})=>{
      const u=new URL(typeof input==='string'?input:input.url,location.href);
      const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
      if(u.pathname.startsWith('/storage/v1/object/sign/'))return json({signedURL:u.pathname.replace('/storage/v1','')+'?token=fixture'});
      if(u.pathname.startsWith('/rest/v1/rpc/')){
       const rpc=u.pathname.split('/').pop(),body=JSON.parse(options.body||'{}'),db=JSON.parse(localStorage.getItem('pulse-local-demo-data-v1'));
       if(rpc==='save_story_moment_v3'){
        Object.assign(db.story_moments[0],{title:body.p_title,body:body.p_body,photo_paths:body.p_photo_paths,photo_settings:body.p_photo_settings});
        localStorage.setItem('pulse-local-demo-data-v1',JSON.stringify(db));return json('moment');
       }
       if(rpc==='seal_capsule_v3'){
        Object.assign(db.capsule_contents[0],{photo_settings:body.p_photo_settings,body:body.p_body,photo_paths:body.p_paths});
        localStorage.setItem('pulse-local-demo-data-v1',JSON.stringify(db));return json(null);
       }
      }
      return original(input,options);
     };
    });
   });
   await c.route('**/*',async r=>{
    const url=r.request().url();
    if(url.startsWith(origin+'/storage/v1/object/sign/'))return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#777"/><rect x="20" y="20" width="200" height="200" fill="red"/><rect x="680" y="380" width="200" height="200" fill="lime"/></svg>'});
    if(!url.startsWith(base+'/'))return r.abort();
    const response=await r.fetch();return r.fulfill({response,headers:{...response.headers(),'content-security-policy':"connect-src 'self' blob: data: wss:; worker-src 'none'; form-action 'self'"}});
   });
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
   const button=name=>p.getByRole('button',{name,exact:true});
   const settings=table=>p.evaluate(t=>JSON.parse(localStorage.getItem('pulse-local-demo-data-v1'))[t][0].photo_settings,table);
   const change=async()=>{
    await button('Riquadro fisso').click();await button('Ruota a destra').click();await p.getByText('Rotazione: 90°',{exact:true}).waitFor();
    await button('Ingrandisci').click();await button('Sposta a destra').click();
    const view=p.locator('[aria-label="Anteprima modificabile della foto"]');await view.scrollIntoViewIfNeeded();const box=await view.boundingBox();
    assert.ok(Math.abs(box.width/box.height-4/3)<.02,'Fixed preview keeps 4:3');
    await view.screenshot({path:`.feature-build/shared-editor-${engine}-${width}.png`});
   };
   await p.goto(base+'/storia');await button('Modifica momento').click();await button('Inquadra foto 1').click();await change();
   await button('Annulla modifiche foto').click();assert.equal(await settings('story_moments'),undefined);
   await button('Inquadra foto 1').click();await p.getByText('Rotazione: 0°',{exact:true}).waitFor();await change();await button('Conferma foto').click();
   assert.equal(await settings('story_moments'),undefined,'Photo confirm is only a local draft');await button('Salva le modifiche').click();
   await p.waitForFunction(()=>!!JSON.parse(localStorage.getItem('pulse-local-demo-data-v1')).story_moments[0].photo_settings);
   let saved=await settings('story_moments');assert.equal(Object.values(saved)[0].rotation,90);assert.equal(Object.values(saved)[0].mode,'fixed');
   await p.reload();await button('Modifica momento').click();await button('Inquadra foto 1').click();await p.getByText('Rotazione: 90°',{exact:true}).waitFor();
   await button('Riquadro adattivo').click();await button('Ripristina foto intera').click();await button('Conferma foto').click();await button('Annulla modifiche').click();assert.deepEqual(await settings('story_moments'),saved,'Cancel moment preserves stored layout');
   await p.goto(base+'/capsule');await button('Le tue').click();await button('Modifica').click();await button('Rimuovi foto').click();await button('Chiudi').click();assert.equal((await p.evaluate(()=>JSON.parse(localStorage.getItem('pulse-local-demo-data-v1')).capsule_contents[0].photo_paths)).length,1,'Close without sealing preserves original photo');await button('Modifica').click();await button('Inquadra foto 1').click();await change();await button('Conferma foto').click();
   assert.equal(await settings('capsule_contents'),undefined);await button('Scegli l’apertura').click();await button('Rivedi').click();
   await p.locator('[aria-label="Foto privata della capsula"]').first().waitFor();await button('Sigilla capsula').click();
   await p.waitForFunction(()=>!!JSON.parse(localStorage.getItem('pulse-local-demo-data-v1')).capsule_contents[0].photo_settings);
   saved=await settings('capsule_contents');assert.equal(Object.values(saved)[0].rotation,90);assert.equal(Object.values(saved)[0].mode,'fixed');
   await p.reload();await button('Le tue').click();await button('Leggi il contenuto').click();await p.locator('[aria-label="Foto privata della capsula"]').waitFor();
   await button('Modifica').click();await button('Inquadra foto 1').click();await p.getByText('Rotazione: 90°',{exact:true}).waitFor();await button('Annulla modifiche foto').click();
   assert.deepEqual(await settings('capsule_contents'),saved);assert.deepEqual(errors,[]);
   console.log(`PASS ${engine} ${width}px: existing story/capsule photos, fixed/adaptive previews, crop/rotate, cancel, two-stage save and persistence after reload`);
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
