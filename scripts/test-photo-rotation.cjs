const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/memories/photoLayout.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports});
const{rotatePhoto,photoLayout,orientedRatio,frameRatio,photoGeometry,photoImageGeometry,cropForRatio,moveCrop,zoomCrop}=m.exports;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const ratio of [.5,1,1.5,2])for(const mode of ['fixed','adaptive']){
 const original={mode,crop:{x:.15,y:.2,width:.6,height:.5}};let layout=original;
 for(let i=0;i<4;i++){
  layout=rotatePhoto(layout,true);assert.equal(layout.rotation,(i+1)*90%360);assert.equal(photoLayout(layout),layout);
  near(orientedRatio(ratio,layout),i%2===0?1/ratio:ratio);
  const expected=mode==='fixed'?4/3:(i%2===0?1/frameRatio(ratio,original):frameRatio(ratio,original));near(frameRatio(ratio,layout),expected);
  const box=photoGeometry(350,ratio,layout),image=photoImageGeometry(350,ratio,layout),swapped=layout.rotation%180!==0;
  near(image.width/image.height,ratio);near(image.left+(swapped?(image.width-image.height)/2:0),box.left);near(image.top+(swapped?(image.height-image.width)/2:0),box.top);
  const edited={...layout,crop:moveCrop(zoomCrop(layout.crop,.8),.03,-.04)};assert.equal(photoLayout(edited),edited);
  const preset=cropForRatio(orientedRatio(ratio,layout),1);near(orientedRatio(ratio,layout)*preset.width/preset.height,1);
 }
 for(const k of ['x','y','width','height'])near(layout.crop[k],original.crop[k]);
 const restored=rotatePhoto(rotatePhoto(original,true),false);assert.equal(restored.rotation,0);for(const k of ['x','y','width','height'])near(restored.crop[k],original.crop[k]);
}
assert.equal(photoLayout({mode:'fixed',rotation:45,crop:{x:0,y:0,width:1,height:1}}).mode,'adaptive');
console.log('PASS photo rotation: all orientations, fixed/adaptive frames, preserved crop on rotation, inverse/four-turn restoration, correct raw image geometry, rotated crop/zoom and invalid angle fallback');
