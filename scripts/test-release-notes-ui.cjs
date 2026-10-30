const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {chromium,webkit}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function serve(){const file=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(file,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(path.resolve(process.env.PULSE_TEST_WEB_ROOT||'.feature-build/bugfix-20261030-web'))),file);await new Promise(r=>m.exports.listen(0,'127.0.0.1',r));return m.exports;}
(async()=>{const server=await serve(),base='http://127.0.0.1:'+server.address().port;try{for(const[engine,width,height]of [['chromium',320,568],['chromium',390,844],['webkit',390,844],['chromium',844,390]]){
 const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'}:{})});try{
  const c=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:true});await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await c.routeWebSocket('**/*',ws=>ws.close());await c.addInitScript(()=>localStorage.setItem('pulse-local-demo-login-v1','yes'));
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);await p.goto(base);
  const close=p.getByRole('button',{name:'Ho letto, continua',exact:true});await close.waitFor();
  const box=await close.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height,'Dismiss remains within viewport');
  const text=p.getByText('Punto di incontro: scegliendo Metro e Treno vengono considerate entrambe le famiglie ferroviarie.',{exact:false});await text.scrollIntoViewIfNeeded();assert.ok(await text.isVisible());
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await p.screenshot({animations:'disabled',path:`.feature-build/release-notes-${engine}-${width}x${height}.png`});await close.click();await close.waitFor({state:'hidden'});
  await p.goto(base+'/avvisi');await p.getByRole('button',{name:'Riepilogo degli aggiornamenti',exact:false}).click();await p.getByText('Più spazio ai vostri ricordi e ai vostri viaggi',{exact:true}).waitFor();await p.getByText('Ricordi degli incontri: fino a cinque foto per ricordo, anche selezionate insieme.',{exact:false}).waitFor();
  await p.reload();assert.equal(await close.count(),0);assert.deepEqual(errors,[]);console.log(`PASS update modal + inbox archive ${engine} ${width}x${height}: all changes scrollable, footer visible, dismiss persistent, no overflow/errors.`);
 }finally{await browser.close();}}
 }finally{await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

