// Real exported UI with isolated local fixtures. No production backend calls.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {chromium,webkit}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A='00000000-0000-4000-8000-000000000001';
async function serve(){const filename=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(fs.readFileSync(filename,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(path.resolve('.feature-build/canvas-v2-web'))),filename);const server=m.exports;await new Promise(r=>server.listen(0,'127.0.0.1',r));return server;}
async function run(browser,base,engine,width,height){
 const context=await browser.newContext({viewport:{width,height},hasTouch:width<500,isMobile:width<500});await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await context.routeWebSocket('**/*',ws=>ws.close());
 await context.addInitScript(A=>{
  localStorage.setItem('pulse-local-demo-login-v1','yes');localStorage.setItem('pulse-draft:release-notes:'+A,'2026-10-25-canvas-moods-recap');
  document.addEventListener('DOMContentLoaded',()=>{
   const original=window.fetch;window.__board=JSON.parse(localStorage.getItem('test-v2-board')||'{"id":1,"epoch":1,"revision":0,"strokes":[],"deleted_ids":[]}');window.__gallery=[];window.__pulseWrites=0;window.__online=true;window.__putCalls=0;
   window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href),json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}}),body=JSON.parse(options.body||'{}');
    if(url.pathname==='/rest/v1/canvas_current')return json([window.__board]);
    if(url.pathname==='/rest/v1/canvas_drawings')return json(window.__gallery);
    if(url.pathname==='/rest/v1/pulse_logs'&&options.method==='POST'){window.__pulseWrites++;return json([{id:'pulse-test',...body}]);}
    if(url.pathname==='/rest/v1/rpc/notify_canvas_started')return json(null);
    if(url.pathname==='/rest/v1/rpc/save_canvas'){window.__gallery.push({id:'gallery-test',caption:body.p_caption,strokes:body.p_strokes,created_at:new Date().toISOString()});return json('gallery-test');}
    if(url.pathname==='/rest/v1/rpc/delete_canvas'){window.__gallery=window.__gallery.filter(item=>item.id!==body.p_id);return json(null);}
    if(url.pathname==='/rest/v1/rpc/apply_canvas_board'){
     if(!window.__online)return json({message:'Test offline'},503);
     const b=window.__board;if(body.p_epoch===b.epoch){
      if(body.p_action==='clear'){b.epoch++;b.strokes=[];b.deleted_ids=[];}
      if(body.p_action==='undo'){b.strokes=b.strokes.filter(s=>s.id!==body.p_id);b.deleted_ids.push(body.p_id);}
       if(body.p_action==='erase'){const stroke=b.strokes.find(s=>s.id===body.p_id);if(stroke)stroke.erasures=(stroke.erasures||[]).concat(body.p_stroke.erasures);}
      if(body.p_action==='put'&&!b.deleted_ids.includes(body.p_stroke.id)){window.__putCalls++;b.strokes=b.strokes.filter(s=>s.id!==body.p_stroke.id).concat(body.p_stroke);}
      b.revision++;localStorage.setItem('test-v2-board',JSON.stringify(b));
     }return json(b);
    }
    return original(input,options);
   };
  });
 },A);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(12000);
 try{
 await page.goto(base+'/canvas');await page.getByText('Lavagna salvata automaticamente',{exact:true}).waitFor();const canvas=page.locator('canvas');await canvas.waitFor();
 const geometry=await page.evaluate(()=>{const square=document.querySelector('[data-testid="canvas-square"]').getBoundingClientRect(),toolbar=document.querySelector('[data-testid="canvas-toolbar"]').getBoundingClientRect(),board=document.querySelector('canvas').getBoundingClientRect();return {square:{width:square.width,height:square.height,top:square.top,bottom:square.bottom},toolbar:{top:toolbar.top,bottom:toolbar.bottom},board:{width:board.width,height:board.height},overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};});
 assert.ok(Math.abs(geometry.square.width-geometry.square.height)<1);assert.ok(Math.abs(geometry.board.width-geometry.board.height)<1);assert.ok(geometry.square.bottom<=geometry.toolbar.top);assert.ok(geometry.toolbar.bottom<=height);assert.equal(geometry.overflow,false);
 for(const label of ['Colore','Pennello','Tratto','Annulla','Altro']){const box=await page.getByRole('button',{name:label,exact:true}).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y+box.height<=height&&box.width>=44&&box.height>=44,label+' remains visible/touchable');}
 await page.screenshot({path:'.feature-build/canvas-v2-'+engine+'-'+width+'.png'});
 // A normal draw gesture must not scroll the page or require a mode switch.
 const draw=async()=>{const b=await canvas.boundingBox();await page.mouse.move(b.x+b.width*.2,b.y+b.height*.2);await page.mouse.down();await page.mouse.move(b.x+b.width*.6,b.y+b.height*.6,{steps:8});await page.mouse.up();};
 await draw();await page.waitForFunction(()=>window.__board.strokes.length===1);assert.equal(await page.evaluate(()=>window.__gallery.length),0);
 await page.reload();await page.getByText('1/60 tratti',{exact:true}).waitFor();await page.waitForFunction(()=>{const el=document.querySelector('canvas');if(!el)return false;return el.getContext('2d').getImageData(0,0,el.width,el.height).data.some((v,i)=>i%4===3&&v>0);});
 await page.getByRole('button',{name:'Colore',exact:true}).click();await page.getByRole('button',{name:'Grigio chiaro',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Rosso',exact:true}).count(),1);await page.getByRole('button',{name:'Rosso',exact:true}).click();
 const tool=async label=>{await page.getByRole('button',{name:'Pennello',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:'Fatto',exact:true}).click();};
 await page.getByRole('button',{name:'Pennello',exact:true}).click();for(const label of ['Mano libera','Gomma','Linea','Rettangolo','Cerchio','Inchiostro','Neon'])await page.getByRole('button',{name:label,exact:true}).waitFor();await page.getByRole('button',{name:'Neon',exact:true}).click();await page.getByRole('button',{name:'Fatto',exact:true}).click();
 await page.getByRole('button',{name:'Tratto',exact:true}).click();await page.getByRole('button',{name:'Grande',exact:true}).click();
 await tool('Rettangolo');const before=await page.evaluate(()=>window.__putCalls);const b=await canvas.boundingBox();await page.mouse.move(b.x+b.width*.3,b.y+b.height*.3);await page.mouse.down();await page.mouse.move(b.x+b.width*.7,b.y+b.height*.7,{steps:4});await page.waitForTimeout(850);assert.equal(await page.evaluate(()=>window.__putCalls),before);await page.mouse.up();await page.waitForFunction(()=>window.__board.strokes.length===2);assert.deepEqual(await page.evaluate(()=>({color:window.__board.strokes.at(-1).color,brush:window.__board.strokes.at(-1).brush,width:window.__board.strokes.at(-1).width})),{color:'#F04452',brush:'neon',width:12});
 await tool('Gomma');await page.mouse.click(b.x+b.width*.7,b.y+b.height*.5);await page.waitForFunction(()=>window.__board.strokes.length===2&&window.__board.strokes.some(s=>s.erasures?.length));
 await page.getByRole('button',{name:'Annulla',exact:true}).click();await page.waitForFunction(()=>window.__board.strokes.length===1);
 await page.getByRole('button',{name:'Annulla',exact:true}).click();await page.waitForFunction(()=>window.__board.strokes.length===0);
 // Temporary strokes never enter autosave or the explicit gallery snapshot.
 await page.getByRole('button',{name:'Pennello',exact:true}).click();await page.getByRole('button',{name:'Mano libera',exact:true}).click();await page.getByRole('button',{name:'Scompare in 10s · Disattivo',exact:true}).click();await page.getByRole('button',{name:'Fatto',exact:true}).click();await draw();await page.getByText('1/60 tratti',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__board.strokes.length),0);
 await page.getByRole('button',{name:'Salva',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Salva nella galleria',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Chiudi',exact:true}).last().click();
 await page.waitForTimeout(10500);await page.getByText('0/60 tratti',{exact:true}).waitFor();await page.getByRole('button',{name:'Pennello',exact:true}).click();await page.getByRole('button',{name:'Scompare in 10s · Attivo',exact:true}).click();await page.getByRole('button',{name:'Fatto',exact:true}).click();await draw();await page.waitForFunction(()=>window.__board.strokes.length===1);
 // REST save remains possible even when the live channel is unavailable.
 await page.getByRole('button',{name:'Salva',exact:true}).click();await page.getByLabel('Didascalia facoltativa').fill('Il nostro disegno V2');await page.getByRole('button',{name:'Salva nella galleria',exact:true}).click();await page.waitForFunction(()=>window.__gallery.length===1);assert.equal(await page.evaluate(()=>window.__gallery[0].caption),'Il nostro disegno V2');
 await page.getByRole('button',{name:'Galleria condivisa',exact:true}).click();await page.getByText('Il nostro disegno V2',{exact:true}).waitFor();await page.getByRole('button',{name:'Elimina disegno',exact:true}).click();await page.getByRole('button',{name:'Elimina',exact:true}).click();await page.getByText('Ancora nessun disegno',{exact:true}).waitFor();await page.getByRole('button',{name:'Chiudi',exact:true}).last().click();
 await page.getByRole('button',{name:'Altro',exact:true}).click();await page.getByRole('button',{name:'Invia un Pulse',exact:true}).click();await page.waitForFunction(()=>window.__pulseWrites===1);
 await page.getByRole('button',{name:'Altro',exact:true}).click();await page.getByRole('button',{name:'Pulisci lavagna',exact:true}).click();await page.getByRole('button',{name:'Annulla',exact:true}).last().click();assert.equal(await page.evaluate(()=>window.__board.strokes.length),1);await page.getByRole('button',{name:'Pulisci lavagna',exact:true}).click();await page.getByRole('button',{name:'Pulisci',exact:true}).click();await page.waitForFunction(()=>window.__board.strokes.length===0);
 await page.getByRole('button',{name:'Stato della lavagna e sincronizzazione',exact:true}).click();await page.getByRole('button',{name:'Riprova sincronizzazione',exact:true}).waitFor();await page.getByRole('button',{name:'Ho capito',exact:true}).click();
 await page.setViewportSize({width:height,height:width});await page.waitForTimeout(250);const landscape=await page.getByTestId('canvas-square').boundingBox();assert.ok(Math.abs(landscape.width-landscape.height)<1);const bar=await page.getByTestId('canvas-toolbar').boundingBox();assert.ok(bar.y+bar.height<=width+1);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1),false);
 assert.deepEqual(errors,[]);console.log('PASS '+engine+' '+width+'x'+height+': square/toolbar/no root scroll, all panels/tools/colors, autosave/reload, shapes/eraser/undo, 10s expiry, Pulse, gallery save/delete, clear confirm/cancel, help and landscape.');
 }catch(error){await page.screenshot({path:'.feature-build/canvas-v2-failure-'+engine+'-'+width+'.png'});console.log('UI diagnostics',engine,width,await page.locator('body').innerText());throw error;}finally{await context.close();}
}
(async()=>{const server=await serve(),base='http://127.0.0.1:'+server.address().port;
 try{for(const [name,launcher,options,widths]of [['chromium',chromium,{executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'},[320,360,390]],['webkit',webkit,{},[390]]]){const browser=await launcher.launch({headless:true,...options});try{for(const width of widths)await run(browser,base,name,width,width===320?568:844);}finally{await browser.close();}}}finally{await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
