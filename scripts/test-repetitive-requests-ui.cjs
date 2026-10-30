const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function serve(root){
 const filename=path.resolve('scripts/serve-local-demo.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
 const originalRequire=m.require.bind(m);
 m.require=name=>name==='./local-demo-browser.js'?vm.runInThisContext('('+require('./local-demo-browser.js').toString().replace("const method = (options.method || input.method || 'GET').toUpperCase();","const method = (options.method || input.method || 'GET').toUpperCase(); (window.__pulseRequests ||= []).push({path:url.pathname,method});")+')'):originalRequire(name);
 m._compile(fs.readFileSync(filename,'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')",JSON.stringify(path.resolve(root))),filename);
 const server=m.exports;await new Promise(r=>server.listen(0,'127.0.0.1',r));return server;
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'}),servers=[];
 try{
  const results=[];
  for(const root of ['.feature-build/release-notes-web','.feature-build/repetitive-web']){
   const server=await serve(root);servers.push(server);const base='http://127.0.0.1:'+server.address().port;
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
   await context.routeWebSocket('**/*',ws=>ws.close());
   await context.addInitScript(()=>{
    localStorage.setItem('pulse-local-demo-login-v1','yes');
    localStorage.setItem('pulse-draft:release-notes:00000000-0000-4000-8000-000000000001','2026-10-22-update-summary');
    let hidden=false;Object.defineProperty(document,'hidden',{get:()=>hidden});Object.defineProperty(document,'visibilityState',{get:()=>hidden?'hidden':'visible'});
    window.__foreground=value=>{hidden=!value;document.dispatchEvent(new Event('visibilitychange'));};
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base);await page.getByText('IL VOSTRO SPAZIO',{exact:true}).waitFor();await page.waitForTimeout(1800);
   const rounds=[];
   for(let i=0;i<2;i++){
    await page.evaluate(()=>window.__foreground(false));await page.waitForTimeout(150);
    await page.evaluate(()=>{window.__pulseRequests=[];window.__foreground(true);});await page.waitForTimeout(1200);
    rounds.push(await page.evaluate(()=>window.__pulseRequests.filter(r=>r.path==='/rest/v1/visits'&&r.method==='GET').length));
   }
   assert.deepEqual(errors,[]);results.push({root,resumeVisitReads:rounds});await context.close();
  }
  console.log(JSON.stringify(results));
  assert.deepEqual(results[0].resumeVisitReads,[2,2]);assert.deepEqual(results[1].resumeVisitReads,[1,1]);
  console.log('PASS foreground recovery: full visits reads reduced from two to one on each resume, with real bundled app and local fixtures; no runtime errors.');
 }finally{await browser.close();await Promise.all(servers.map(server=>new Promise(r=>server.close(r))));}
})().catch(error=>{console.error(error);process.exitCode=1});
