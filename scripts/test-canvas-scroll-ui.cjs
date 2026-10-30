const assert=require('node:assert/strict');const{chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||4196);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});try{
 for(const width of [320,390,1280]){
  const mobile=width<500,c=await browser.newContext({viewport:{width,height:950},hasTouch:mobile,isMobile:mobile});await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await c.addInitScript(()=>{localStorage.setItem('pulse-local-demo-login-v1','yes');document.addEventListener('DOMContentLoaded',()=>{const original=window.fetch;window.fetch=async(input,options={})=>{const u=new URL(typeof input==='string'?input:input.url,location.href);if(u.pathname==='/rest/v1/rpc/notify_canvas_started')return new Response('null',{headers:{'content-type':'application/json'}});return original(input,options)}})});
  const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await page.goto(base+'/canvas');const canvas=page.locator('canvas');await canvas.waitFor();
  const scroller=()=>canvas.evaluate(el=>{let p=el.parentElement;while(p){if(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight)return p.scrollTop;p=p.parentElement}return document.scrollingElement.scrollTop});
  const session=mobile?await c.newCDPSession(page):null;
  const swipe=async draw=>{await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),x=b.x+b.width*.5,y=Math.min(b.y+b.height*.7,800),endY=y-120;
   if(mobile){await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(draw?i*4:0),y:y+(endY-y)*i/8}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
   else if(draw){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80,endY,{steps:10});await page.mouse.up()}else{await page.mouse.move(x,y);await page.mouse.wheel(0,140)}
  };
  assert.equal(await canvas.evaluate(el=>getComputedStyle(el).touchAction),'pan-y');await canvas.scrollIntoViewIfNeeded();const before=await scroller();await swipe(false);
  await page.waitForFunction(before=>{const el=document.querySelector('canvas');let p=el.parentElement;while(p){if(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight)return p.scrollTop>before+20;p=p.parentElement}return false},before);
  await page.getByText('0/60 tratti · 0/3000 punti',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Attiva disegno',exact:true}).click();assert.equal(await canvas.evaluate(el=>getComputedStyle(el).touchAction),'none');await swipe(true);await page.getByText(/^1\/60 tratti/).waitFor();
  await page.waitForFunction(()=>{const canvas=document.querySelector('canvas'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;for(let i=3;i<data.length;i+=4)if(data[i])return true;return false});
  await page.getByRole('button',{name:'Scorri la pagina',exact:true}).click();await swipe(false);await page.getByText(/^1\/60 tratti/).waitFor();
  await page.getByRole('button',{name:'Annulla mio tratto',exact:true}).click();await page.getByText('0/60 tratti · 0/3000 punti',{exact:true}).waitFor();await page.getByRole('button',{name:'Indietro',exact:true}).click();await page.waitForURL(u=>u.pathname==='/');assert.equal(await page.getByText('Disegno non salvato',{exact:true}).count(),0);
  await page.goto(base+'/canvas');await page.getByRole('button',{name:'Attiva disegno',exact:true}).click();await swipe(true);await page.getByText(/^1\/60 tratti/).waitFor();await page.getByRole('button',{name:'Indietro',exact:true}).click();await page.waitForURL(u=>u.pathname==='/');assert.equal(await page.getByText('Disegno non salvato',{exact:true}).count(),0);await page.goto(base+'/canvas');await page.getByText(/^1\/60 tratti/).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log(`PASS canvas ${width}px: actual touch/wheel scroll over board, no phantom strokes, deliberate drawing pixels, header mode switch, undo, clean exit and real unsaved work retained`);await c.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
