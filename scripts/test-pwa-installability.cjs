const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.argv[2]||'https://coppia-1-0.pages.dev';
(async()=>{const context=await chromium.launchPersistentContext(path.resolve('.feature-build/pwa-installability-profile'),{headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe',viewport:{width:390,height:844}});try{
 const page=await context.newPage();await page.addInitScript(()=>{window.pwaPromptSeen=false;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.pwaPromptSeen=true})});
 await page.goto(base,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Accedi',exact:true}).waitFor({timeout:20000});
 const manifestUrl=await page.locator('link[rel="manifest"]').getAttribute('href');assert.ok(manifestUrl);
 const response=await fetch(new URL(manifestUrl,base));assert.equal(response.status,200);const manifest=await response.json();assert.equal(manifest.display,'standalone');assert.equal(manifest.name,'Pulse');assert.equal(new URL(manifest.start_url,base).origin,new URL(base).origin);
 const icons=[];for(const size of [192,512]){const icon=manifest.icons.find(i=>i.sizes===`${size}x${size}`);assert.ok(icon);const r=await fetch(new URL(icon.src,base));assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/png/);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);icons.push(size)}
 const apple=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');const image=await fetch(new URL(apple,base));assert.equal(image.status,200);const bytes=Buffer.from(await image.arrayBuffer());assert.equal(bytes.readUInt32BE(16),180);assert.equal(bytes.readUInt32BE(20),180);
 assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'),'yes');assert.equal(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'),'Pulse');
 await page.evaluate(()=>navigator.serviceWorker.ready);assert.equal(await page.evaluate(()=>window.isSecureContext),true);
 const cdp=await context.newCDPSession(page);const app=await cdp.send('Page.getAppManifest');assert.equal(app.errors.length,0);const install=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(install.installabilityErrors,[]);
 await page.getByRole('button',{name:'Accedi',exact:true}).click();await page.waitForFunction(()=>window.pwaPromptSeen,{},{timeout:40000}).catch(()=>{});
 const result={url:base,secureContext:true,loginScreen:true,manifestParsed:true,standalone:true,icons,appleIcon:180,appleStandaloneMeta:true,serviceWorkerReady:true,chromiumInstallabilityErrors:install.installabilityErrors,beforeInstallPrompt:await page.evaluate(()=>window.pwaPromptSeen),physicalSafariTest:false};
 fs.writeFileSync('.feature-build/pwa-installability-'+(base.includes('127.0.0.1')?'local':'live')+'.json',JSON.stringify(result,null,2));console.log('PASS PWA prerequisites',result);
 }finally{await context.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
