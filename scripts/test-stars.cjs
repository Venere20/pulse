const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const mod={exports:{}};cache.set(file,mod.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod.exports,module:mod,require:name=>load(path.resolve(path.dirname(file),name+'.ts'))});return mod.exports;}
const {CONSTELLATIONS}=load('src/features/sologames/logic.ts');
const {drawingFingerprint,additionalConstellations}=load('src/features/sologames/starCatalog.ts');
const {newSky,validSky,migrateSky,touchStar,nextSky,retrySky}=load('src/features/sologames/stars.ts');
assert.equal(CONSTELLATIONS.length,206);
assert.equal(new Set(CONSTELLATIONS.map(s=>s.name)).size,206);
assert.equal(new Set(CONSTELLATIONS.map(s=>drawingFingerprint(s.points))).size,206,'No repeated shapes, reversed paths, mirrored or quarter-turned copies');
assert.equal(JSON.stringify(additionalConstellations(CONSTELLATIONS.slice(0,6))),JSON.stringify(CONSTELLATIONS.slice(6)),'Stable catalogue IDs');
const shape=CONSTELLATIONS[50].points;const signature=drawingFingerprint(shape);
assert.equal(signature,drawingFingerprint([...shape].reverse()));
assert.equal(signature,drawingFingerprint(shape.map(([x,y])=>[y*2+20,-x*2+40])));
for(const sky of CONSTELLATIONS){assert.ok(sky.name&&!sky.name.includes('undefined'));assert.ok(sky.points.length>=5);for(let i=0;i<sky.points.length;i++){const[x,y]=sky.points[i];assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=10&&x<=90&&y>=10&&y<=90);if(i)assert.notEqual(sky.points[i].join(','),sky.points[i-1].join(','));}}
let seed=7;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const orders=new Set();
for(let game=0;game<40;game++){
 let s=newSky(0,random);assert.ok(validSky(s));orders.add(s.order.join(','));const seen=new Set();
 for(let level=0;level<206;level++){
  const id=s.order[s.index],length=CONSTELLATIONS[id].points.length;assert.ok(!seen.has(id));seen.add(id);
  assert.strictEqual(nextSky(s),s,'Cannot skip an unfinished drawing');assert.strictEqual(touchStar(s,1),s,'Follow the numbered order');
  s=touchStar(s,0);s=retrySky(s);assert.equal(s.next,0);assert.equal(s.completed,level);
  for(let point=0;point<length;point++)s=touchStar(s,point);
  assert.equal(s.completed,level+1);assert.strictEqual(touchStar(s,length),s);assert.strictEqual(retrySky(s),s,'No repeated score from completed drawings');
  s=JSON.parse(JSON.stringify(s));assert.ok(validSky(s),'Resume includes the exact remaining order');
  const next=nextSky(s);if(level===205)assert.strictEqual(next,s,'Never wrap at the end of a game');else assert.equal(next.index,level+1);s=next;
 }
 assert.equal(seen.size,206);
}
assert.equal(orders.size,40);
for(const old of [{level:0,next:0,completed:0},{level:3,next:4,completed:3},{level:2,next:1,completed:30},{level:5,next:CONSTELLATIONS[5].points.length,completed:6}]){
 const migrated=migrateSky(old,random);assert.ok(validSky(migrated));assert.equal(migrated.order[migrated.index],old.level);assert.equal(migrated.next,old.next);assert.equal(migrated.completed,old.completed);assert.equal(new Set(migrated.order).size,206);
 if(old.completed>=6)assert.ok(migrated.order.slice(migrated.index+1).every(id=>id>=6),'Already played legacy drawings never reappear');
}
const fresh=newSky();
for(const bad of [null,{},[],{...fresh,order:[0,0]},{...fresh,next:9999},{...fresh,index:-1},{...fresh,order:Array(206).fill(0)},{level:6,next:0,completed:0},{...fresh,completed:NaN}]){assert.equal(validSky(bad),false);assert.equal(migrateSky(bad),null);}
const shorter={...fresh,order:fresh.order.slice(0,50)};const extended=migrateSky(shorter,random);assert.ok(validSky(extended));assert.equal(extended.order.slice(0,50).join(','),shorter.order.join(','));
console.log('PASS stars: 206 stable unique drawings, 40 complete long games without repeats, random orders, restart/score guards, save/resume, legacy migration and future catalogue extension.');
