// Local bundle integration only: all remote services replaced with test fixtures.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
async function serve(){const filename=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(fs.readFileSync(filename,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(path.resolve('.feature-build/canvas-moods-recap-web'))),filename);const server=m.exports;await new Promise(r=>server.listen(0,'127.0.0.1',r));return server;}
(async()=>{const server=await serve(),base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});
try{for(const width of [320,390,1280]){
 const context=await browser.newContext({viewport:{width,height:950},hasTouch:width<500,isMobile:width<500});await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await context.routeWebSocket('**/*',ws=>ws.close());
 await context.addInitScript(({A,B})=>{
  localStorage.setItem('pulse-local-demo-login-v1','yes');localStorage.setItem('pulse-draft:release-notes:'+A,'2026-10-25-canvas-moods-recap');
  localStorage.setItem('pulse-local-demo-data-v1',JSON.stringify({users:[{id:A,name:'Admin',current_status:'home'},{id:B,name:'Partner',current_status:'home'}],couple_settings:[],visits:[{id:'00000000-0000-4000-8000-000000000010',title:'Uscita di settembre',start_date:'2026-09-10',end_date:'2026-09-10',status:'concluded',created_by:A}],bucket_list:[{id:'00000000-0000-4000-8000-000000000020',title:'Serata al mare',is_completed:true,completed_at:'2026-10-24T10:40:10Z',created_by:A}],visit_bucket_items:[{visit_id:'00000000-0000-4000-8000-000000000010',bucket_item_id:'00000000-0000-4000-8000-000000000020'}]}));
  document.addEventListener('DOMContentLoaded',()=>{
   const original=window.fetch;window.__testBoard=JSON.parse(localStorage.getItem('test-board')||'{"id":1,"epoch":1,"revision":0,"strokes":[],"deleted_ids":[]}');window.__testMoods=[];window.__galleryWrites=0;
   window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href),json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}}),body=JSON.parse(options.body||'{}');
    if(url.pathname==='/rest/v1/canvas_current')return json([window.__testBoard]);
    if(url.pathname==='/rest/v1/emotional_states')return json(window.__testMoods);
    if(url.pathname==='/rest/v1/rpc/set_my_emotion'){window.__testMoods=body.p_mood?[{id:A,mood:body.p_mood,note:body.p_note,expires_at:new Date(Date.now()+body.p_minutes*60000).toISOString()}]:[];return json(null);}
    if(url.pathname==='/rest/v1/rpc/notify_canvas_started')return json(null);
    if(url.pathname==='/rest/v1/rpc/save_canvas'){window.__galleryWrites++;return json('00000000-0000-4000-8000-000000000080');}
    if(url.pathname==='/rest/v1/rpc/apply_canvas_board'){
     const b=window.__testBoard;if(body.p_epoch===b.epoch){
      if(body.p_action==='clear'){b.epoch++;b.strokes=[];b.deleted_ids=[];}
      if(body.p_action==='undo'){b.strokes=b.strokes.filter(s=>s.id!==body.p_id);b.deleted_ids.push(body.p_id);}
      if(body.p_action==='put'&&!b.deleted_ids.includes(body.p_stroke.id)){b.strokes=b.strokes.filter(s=>s.id!==body.p_stroke.id).concat(body.p_stroke);}
      b.revision++;localStorage.setItem('test-board',JSON.stringify(b));
     }return json(b);
    }
    return original(input,options);
   };
  });
 },{A,B});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(12000);await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'));
 await page.goto(base+'/riepilogo');await page.getByText('ottobre 2026',{exact:true}).waitFor();assert.equal(await page.getByText('Serata al mare',{exact:false}).count(),0);
 await page.getByRole('button',{name:'Mese precedente',exact:true}).click();await page.getByText('settembre 2026',{exact:true}).waitFor();await page.getByText('✨ Serata al mare',{exact:true}).waitFor();
 await page.goto(base+'/umore');for(const [label,id]of [['😒 Infastidito/a','annoyed'],['😠 Arrabbiato/a','angry'],['😞 Dispiaciuto/a','sorry']]){
  await page.getByRole('button',{name:label,exact:true}).click();await page.getByLabel('Una frase per spiegarti (facoltativa)').fill('Nota di prova');await page.getByRole('button',{name:'Condividi come ti senti',exact:true}).click();await page.waitForFunction(id=>window.__testMoods[0]?.mood===id,id);await page.getByText('Tu · '+label,{exact:true}).waitFor();
 }
 await page.goto(base+'/canvas');await page.getByText(/Lavagna salvata automaticamente/).waitFor();const canvas=page.locator('canvas');assert.equal(await page.getByRole('button',{name:'Grigio chiaro',exact:true}).count(),1);
 await page.getByRole('button',{name:'Rosso',exact:true}).click();
 for(const [i,label]of ['Linea','Rettangolo','Cerchio'].entries()){
  await page.getByRole('button',{name:label,exact:true}).click();await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.2,box.y+box.height*.2);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.65,{steps:5});await page.waitForTimeout(800);
  assert.equal(await page.evaluate(()=>window.__testBoard.strokes.length),i,'Dragging shape is only a preview');await page.mouse.up();await page.waitForFunction(count=>window.__testBoard.strokes.length===count,i+1);assert.equal(await page.evaluate(()=>window.__testBoard.strokes.at(-1).color),'#F04452');
 }
 assert.equal(await page.evaluate(()=>window.__galleryWrites),0);await page.reload();await page.getByText(/^3\/60 tratti/).waitFor();
 await page.getByRole('button',{name:'Gomma',exact:true}).click();await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();await page.mouse.click(box.x+box.width*.65,box.y+box.height*.425);await page.waitForFunction(()=>window.__testBoard.strokes.length===2);
 await page.getByRole('button',{name:'Salva nella galleria',exact:true}).click();await page.waitForFunction(()=>window.__galleryWrites===1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.screenshot({path:'.feature-build/canvas-moods-recap-'+width+'.png',fullPage:true});await context.close();
 console.log('PASS '+width+'px: historical wish month, three moods saved/rendered, 24-color tools, previews, committed shapes, reload, eraser, explicit gallery and no overflow/runtime errors.');
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});


