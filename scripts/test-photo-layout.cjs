const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/memories/photoLayout.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports});
const{photoLayout,frameRatio,cropForRatio,moveCrop,zoomCrop,photoGeometry,visibleCrop}=m.exports;
for(const ratio of [.5,1,1.5,2])for(const target of [undefined,1,4/3,16/9])for(const mode of ['adaptive','fixed']){
 let crop=cropForRatio(ratio,target);if(target)assert.ok(Math.abs(ratio*crop.width/crop.height-target)<1e-9);
 for(let i=0;i<25;i++){
  crop=moveCrop(zoomCrop(crop,i%2?1.05:.9),i%3*.1-.1,i%4*.1-.1);const setting={mode,crop};assert.equal(photoLayout(setting),setting);
  const width=350,height=width/frameRatio(ratio,setting),g=photoGeometry(width,ratio,setting);
  assert.ok(g.left<=1e-8&&g.top<=1e-8&&g.left+g.width>=width-1e-8&&g.top+g.height>=height-1e-8,'Frame cannot expose empty bands');
  assert.ok(Math.abs(g.width/g.height-ratio)<1e-9,'Original proportions never distorted');
  if(mode==='adaptive'){assert.ok(Math.abs(g.left+crop.x*g.width)<1e-8);assert.ok(Math.abs(g.top+crop.y*g.height)<1e-8);assert.ok(Math.abs(g.width*crop.width-width)<1e-8);assert.ok(Math.abs(g.height*crop.height-height)<1e-8)}
 }
 const visible=visibleCrop(ratio,{mode,crop});assert.equal(photoLayout({mode,crop:visible}).mode,mode);if(mode==='fixed')assert.ok(Math.abs(ratio*visible.width/visible.height-4/3)<1e-9);
}
for(const bad of [null,{}, {mode:'stretch',crop:{x:0,y:0,width:1,height:1}},{mode:'fixed',crop:{x:NaN,y:0,width:1,height:1}},{mode:'adaptive',crop:{x:.9,y:0,width:.3,height:1}}])assert.equal(photoLayout(bad).mode,'adaptive');
console.log('PASS photo layout: crop presets, bounded drag/zoom, fixed/adaptive geometry, no bands or distortion, full crop visibility and invalid data fallback');
