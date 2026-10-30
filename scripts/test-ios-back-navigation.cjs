const assert=require('node:assert/strict');const{chromium,webkit}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:'+(process.argv[2]||4198),visit='/visit/00000000-0000-4000-8000-000000000010';
(async()=>{for(const engine of ['webkit','chromium']){const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'}:{})});try{
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
 await c.routeWebSocket('**/*',socket=>socket.close());
 await c.route('**/*',async r=>{if(r.request().url()===base+'/__outside')return r.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Pagina precedente a Pulse</body></html>'});if(!r.request().url().startsWith(base+'/'))return r.abort();const response=await r.fetch();return r.fulfill({response,headers:{...response.headers(),'content-security-policy':"connect-src 'self' blob: data: wss:; worker-src 'none'; form-action 'self'"}})});
 await c.addInitScript(()=>{localStorage.setItem('pulse-local-demo-login-v1','yes');Object.defineProperty(navigator,'standalone',{value:true,configurable:true})});
 const errors=[],p=await c.newPage();p.on('pageerror',e=>{errors.push(e.message);console.error(engine,'PAGE ERROR',e.message)});p.setDefaultTimeout(15000);
 const path=async value=>{await p.waitForURL(u=>u.pathname===value);await p.getByRole('tablist').first().waitFor()};
 const tab=async(name,value)=>{await p.getByRole('tab',{name,exact:true}).click();await path(value)};
 await p.goto(base+'/__outside');await p.goto(base+'/');await tab('Incontri','/meetings');await p.goBack();await path('/');assert.equal(await p.getByRole('tab',{name:'Insieme',exact:true}).getAttribute('aria-selected'),'true');
 await p.goForward();await path('/meetings');assert.equal(await p.getByRole('tab',{name:'Incontri',exact:true}).getAttribute('aria-selected'),'true');
 const length=await p.evaluate(()=>history.length);await tab('Incontri','/meetings');assert.equal(await p.evaluate(()=>history.length),length,'Tapping selected tab must not add history');
 await p.getByRole('button',{name:/^Apri incontro Un weekend a Firenze/}).first().click();await p.waitForURL(u=>u.pathname===visit);await p.getByRole('button',{name:'Indietro',exact:true}).click();await path('/meetings');
 await p.getByRole('button',{name:/^Apri incontro Un weekend a Firenze/}).first().click();await p.waitForURL(u=>u.pathname===visit);await p.goBack();await path('/meetings');
 await tab('Per noi','/per-noi');await tab('Ricordi','/memories');await tab('Desideri','/bucket');await p.goBack();await path('/memories');await p.goBack();await path('/per-noi');await p.goBack();await path('/meetings');
 await p.reload();await path('/meetings');await p.goBack();await path('/');
 for(const [route,target]of [['/settings','/'],['/new-visit','/meetings'],[visit,'/meetings']]){const direct=await c.newPage();direct.on('pageerror',e=>errors.push(e.message));await direct.goto(base+route);if(route==='/new-visit')await direct.getByRole('button',{name:'Chiudi',exact:true}).click();else await direct.getByRole('button',{name:'Indietro',exact:true}).click();await direct.waitForURL(u=>u.pathname===target);await direct.getByRole('tablist').first().waitFor();await direct.close()}
 assert.deepEqual(errors,[]);await c.close();console.log(`PASS ${engine} iPhone: home/meetings browser Back/Forward, active-tab no-op, detail internal/browser Back, all tabs, reload/back and direct-link fallbacks`);
 }finally{await browser.close()}}})().catch(e=>{console.error(e);process.exitCode=1});

