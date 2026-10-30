const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||4191);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});try{
 for(const width of [320,390,1280]){
  const c=await browser.newContext({viewport:{width,height:950}});await c.route('**/*',r=>r.request().url().endsWith('/storage/v1/object/public/mock.png')?r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e99bb0"/><circle cx="300" cy="200" r="90" fill="#473044"/></svg>'}):r.request().url().startsWith(base+'/')||r.request().url().startsWith('data:')?r.continue():r.abort());
  await c.addInitScript(()=>{localStorage.setItem('pulse-local-demo-login-v1','yes');document.addEventListener('DOMContentLoaded',()=>{
   const original=window.fetch,json=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});let rows=[];window.photoUploads=[];window.photoRemovals=[];
   window.fetch=async(input,options={})=>{const u=new URL(typeof input==='string'?input:input.url,location.href),p=u.pathname;
    if(p==='/rest/v1/story_moments')return json(rows);
    if(p==='/rest/v1/rpc/save_story_moment_v2'){const b=JSON.parse(options.body),id=b.p_id||crypto.randomUUID();rows=[{id,author_id:'00000000-0000-4000-8000-000000000001',title:b.p_title,body:b.p_body,day:b.p_day,photo_paths:b.p_photo_paths}];return json(id)}
    if(p.startsWith('/storage/v1/object/sign/story-photos/'))return json({signedURL:'/object/public/mock.png'});
    if(p.startsWith('/storage/v1/object/story-photos/')){window.photoUploads.push(p);return json({Key:p})}
    if(p==='/storage/v1/object/story-photos'){window.photoRemovals.push(JSON.parse(options.body));return json([])}
    return original(input,options);
   };
  })});
  const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.goto(base+'/storia');await page.getByRole('button',{name:'Aggiungi un momento',exact:true}).click();
  await page.getByLabel('Titolo del momento',{exact:true}).fill('Una foto insieme');
  assert.equal(await page.getByRole('button',{name:'Scatta foto',exact:true}).isEnabled(),true);
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Galleria',exact:true}).click();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA7cAAAAASUVORK5CYII=','base64');
  await (await chooser).setFiles([1,2,3].map(n=>({name:`foto${n}.png`,mimeType:'image/png',buffer:png})));
  await page.getByText('Foto del momento · 3/3',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Galleria',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Rimuovi foto 2',exact:true}).click();await page.getByText('Foto del momento · 2/3',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Conserva il momento',exact:true}).click();await page.getByText('Una foto insieme',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Modifica momento',exact:true}).click();await page.getByText('Foto del momento · 2/3',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Rimuovi foto 1',exact:true}).click();await page.getByRole('button',{name:'Annulla modifica',exact:true}).click();
  await page.getByRole('button',{name:'Modifica momento',exact:true}).click();await page.getByText('Foto del momento · 2/3',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.photoUploads.length),3);assert.equal(await page.evaluate(()=>window.photoRemovals.length),1,'Cancelling an edit preserves saved photos');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'Galleria',exact:true}).scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('img')].some(i=>i.src.includes('/mock.png')&&i.naturalWidth>0));
  if(width===390)await page.screenshot({path:'.feature-build/story-photos-390.png',fullPage:true});
  console.log(`PASS story photos UI ${width}px: gallery multi-select, camera action, limit, remove, save, edit, cancel, no overflow`);await c.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
