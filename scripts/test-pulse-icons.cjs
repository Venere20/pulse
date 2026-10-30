const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const app=JSON.parse(fs.readFileSync('app.json')).expo,manifest=JSON.parse(fs.readFileSync('public/manifest.json'));
function png(file,w,h){const b=fs.readFileSync(file);assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),w,file);assert.equal(b.readUInt32BE(20),h,file);return b;}
png(app.icon,1024,1024);const adaptive=png(app.android.adaptiveIcon.foregroundImage,1080,1080);assert.equal(adaptive[25],6,'Adaptive foreground has an alpha channel');
assert.equal(app.android.adaptiveIcon.backgroundColor,'#FFFFFF');assert.equal(app.android.adaptiveIcon.backgroundImage,undefined,'Old Android background is not reused');assert.equal(app.android.adaptiveIcon.monochromeImage,app.android.adaptiveIcon.foregroundImage);
for(const icon of manifest.icons){const[w,h]=icon.sizes.split('x').map(Number);const file='public'+icon.src;png(file,w,h);assert.deepEqual(fs.readFileSync(file),fs.readFileSync('assets/pulse/web/'+path.basename(file)));}
assert.ok(manifest.icons.some(i=>i.purpose==='maskable'&&i.sizes==='512x512'));png('public/apple-touch-icon.png',180,180);png('public/favicon.png',48,48);
assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(app.android.package,'com.venere20.couplesapp');assert.equal(app.android.versionCode,7);
const html=fs.readFileSync('public/index.html','utf8');assert.ok(html.includes('href="/icons/pulse-180.png"'));assert.ok(html.includes('href="/icons/pulse-48.png"'));
console.log('PASS Pulse icons: original assets, PNG dimensions/alpha, Android adaptive/monochrome/background, PWA maskable, Apple touch, favicon, stable install identity and versionCode');
