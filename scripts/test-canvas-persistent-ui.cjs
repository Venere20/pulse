const assert=require('node:assert/strict');const{chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||4197),A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});try{
 for(const width of [320,390,1280]){
  let board={id:1,epoch:1,revision:0,strokes:[],deleted_ids:[]},online=true,galleryWrites=0;
  const create=async actor=>{const c=await browser.newContext({viewport:{width,height:950},hasTouch:width<500,isMobile:width<500});await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
   await c.exposeBinding('canvasTestRpc',async(_source,{action,args})=>{
    if(action==='read')return structuredClone(board);
    if(!online)throw Error('offline test');
    if(action==='gallery'){galleryWrites++;return null}
    assert.equal(args.p_stroke?.author??actor,actor);if(args.p_epoch!==board.epoch)return structuredClone(board);
    if(args.p_action==='clear'){board={...board,epoch:board.epoch+1,revision:board.revision+1,strokes:[],deleted_ids:[]}}
    else if(args.p_action==='undo'){board.strokes=board.strokes.filter(s=>s.id!==args.p_id);board.deleted_ids.push(args.p_id);board.revision++}
    else if(!board.deleted_ids.includes(args.p_stroke.id)){const old=board.strokes.find(s=>s.id===args.p_stroke.id);if(!old||old.points.length<=args.p_stroke.points.length){board.strokes=board.strokes.filter(s=>s.id!==args.p_stroke.id).concat(args.p_stroke);board.revision++}}
    return structuredClone(board);
   });
   await c.addInitScript(({actor,A,B})=>{localStorage.setItem('pulse-local-demo-login-v1','yes');document.addEventListener('DOMContentLoaded',()=>{const original=window.fetch;window.fetch=async(input,options={})=>{const u=new URL(typeof input==='string'?input:input.url,location.href),json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
    if(u.pathname==='/rest/v1/rpc/get_my_profile')return json([{id:actor,name:actor===A?'Admin':'Partner',partner_id:actor===A?B:A}]);
    if(u.pathname==='/rest/v1/canvas_current')return json([await window.canvasTestRpc({action:'read'})]);
    if(u.pathname==='/rest/v1/rpc/apply_canvas_board'){try{return json(await window.canvasTestRpc({action:'apply',args:JSON.parse(options.body)}))}catch{return new Response(JSON.stringify({message:'offline test'}),{status:503,headers:{'content-type':'application/json'}})}}
    if(u.pathname==='/rest/v1/rpc/save_canvas'){await window.canvasTestRpc({action:'gallery'});return json(null)}
    if(u.pathname==='/rest/v1/rpc/notify_canvas_started')return json(null);
    return original(input,options)
   }})},{actor,A,B});return c;
  };
  const c=await create(A),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);await p.goto(base+'/canvas');await p.getByText(/Lavagna salvata automaticamente/).waitFor();
  const canvas=p.locator('canvas');await canvas.scrollIntoViewIfNeeded();assert.equal(await canvas.evaluate(el=>getComputedStyle(el).touchAction),'pan-y');
  const draw=async()=>{await p.getByRole('button',{name:'Attiva disegno',exact:true}).click();await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();await p.mouse.move(b.x+b.width*.3,b.y+b.height*.3);await p.mouse.down();await p.mouse.move(b.x+b.width*.5,b.y+b.height*.4,{steps:6});await p.waitForTimeout(900);await p.mouse.move(b.x+b.width*.7,b.y+b.height*.6,{steps:6});await p.mouse.up();await p.getByText(/^1\/60 tratti/).waitFor();await p.getByText(/^1\/60 tratti · (1[0-9]|[2-9][0-9])\/3000 punti/).waitFor();};
  await draw();await p.getByText(/Lavagna salvata automaticamente/).waitFor();assert.equal(board.strokes.length,1);assert.equal(galleryWrites,0);
  await p.reload();await p.getByText(/^1\/60 tratti/).waitFor();await p.waitForFunction(()=>{const el=document.querySelector('canvas'),data=el.getContext('2d').getImageData(0,0,el.width,el.height).data;return data.some((v,i)=>i%4===3&&v>0)});
  const partner=await create(B),q=await partner.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto(base+'/canvas');await q.getByText(/^1\/60 tratti/).waitFor();assert.equal(galleryWrites,0,'Late partner sees board without gallery entry');await partner.close();
  await p.getByRole('button',{name:'Annulla mio tratto',exact:true}).click();await p.getByText('0/60 tratti · 0/3000 punti',{exact:true}).waitFor();await p.getByText(/Lavagna salvata automaticamente/).waitFor();
  online=false;await draw();await p.getByText(/Lavagna conservata sul dispositivo/).waitFor();await p.reload();await p.getByText(/^1\/60 tratti/).waitFor();online=true;await p.getByRole('button',{name:'Riprova sincronizzazione',exact:true}).click();await p.getByText(/Lavagna salvata automaticamente/).waitFor();assert.equal(board.strokes.length,1);
  await p.getByRole('button',{name:'Pulisci',exact:true}).click();await p.getByRole('button',{name:'Pulisci',exact:true}).last().click();await p.getByText('0/60 tratti · 0/3000 punti',{exact:true}).waitFor();await p.getByText(/Lavagna salvata automaticamente/).waitFor();await p.reload();await p.getByText('0/60 tratti · 0/3000 punti',{exact:true}).waitFor();assert.equal(board.strokes.length,0);assert.equal(galleryWrites,0);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await c.close();console.log(`PASS ${width}px real canvas: drawing, reload pixels, late partner, no gallery entry, undo, offline reload/retry and shared clear`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
