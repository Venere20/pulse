const fs=require('node:fs'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const built=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{InteractiveMapPicker}from'./src/components/InteractiveMapPicker';createRoot(document.getElementById('root')).render(<InteractiveMapPicker myCity={'</script><script>window.injected=1</script>'} partnerCity="Roma" onClose={()=>{}} onSelectLocation={(name,lat,lon)=>window.chosen={name,lat,lon}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',define:{'process.env.NODE_ENV':'"production"','__DEV__':'false'},alias:{'react-native':'react-native-web'},plugins:[{name:'geo-fixture',setup(build){build.onResolve({filter:/utils\/geo$/},()=>({path:'geo',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const getCityCoordinates=async()=>({lat:41,lon:12});export const calculateMidpointCoords=()=>({lat:41,lon:12});export const reverseGeocode=async(lat,lon)=>({lat,lon});export const placeNameFromReverse=d=>'Luogo '+d.lat+','+d.lon;`}))}}]});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'});
 try{const page=await browser.newPage();
 await page.route('**/*',async route=>{const u=route.request().url();if(u==='http://127.0.0.1:4199/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/app.js"></script>'});if(u.endsWith('/app.js'))return route.fulfill({contentType:'application/javascript',body:built.outputFiles[0].text});if(u.includes('leaflet.js'))return route.fulfill({contentType:'application/javascript',body:`var chain=()=>({addTo(){return this},bindPopup(){return this},openPopup(){return this},on(){return this},setLatLng(){return this}});window.L={map:()=>({setView(){return this},fitBounds(){},on(){}}),tileLayer:chain,circleMarker:chain,marker:chain};`});return route.fulfill({body:''});});
 await page.goto('http://127.0.0.1:4199/');await page.locator('iframe').waitFor();const frame=page.frameLocator('iframe');await frame.locator('#map').waitFor();
 assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
 const iframe=page.frames().find(f=>f.parentFrame());assert.ok(iframe);
 assert.equal(await iframe.evaluate(()=>{try{parent.localStorage.getItem('x');return false}catch{return true}}),true,'Sandbox must isolate parent authentication storage');
 await page.evaluate(()=>window.postMessage({type:'POINT_SELECTED',lat:1,lon:2},'*'));await page.waitForTimeout(850);
 assert.ok(!(await page.locator('body').innerText()).includes('Luogo 1,2'),'Forged parent message changed selection');
 await iframe.evaluate(()=>parent.postMessage({type:'POINT_SELECTED',lat:999,lon:12},'*'));await page.waitForTimeout(850);
 assert.ok(!(await page.locator('body').innerText()).includes('Luogo 999,12'));
 await iframe.evaluate(()=>parent.postMessage({type:'POINT_SELECTED',lat:42,lon:13},'*'));await page.getByText('Luogo 42,13',{exact:false}).waitFor();
 await page.getByText('✨ Conferma Questo Punto').click();assert.deepEqual(await page.evaluate(()=>window.chosen),{name:'Luogo 42,13',lat:42,lon:13});assert.equal(await iframe.evaluate(()=>window.injected),undefined);
 const result={sandboxIsolatesParent:true,forgedSenderRejected:true,outOfRangeRejected:true,legitimatePointAccepted:true,scriptInCityNotExecuted:true};fs.writeFileSync('.feature-build/map-message-browser.json',JSON.stringify(result,null,2));console.log('PASS map browser',result);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
