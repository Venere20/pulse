const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports});return m.exports;}
const {shapePoints,hasShapeSize,strokeAtPoint}=load('src/features/canvas/tools.ts'),{canvasPalette,canvasColors,validCanvasPacket,pathForStroke}=load('src/features/canvas/protocol.ts');
assert.equal(canvasColors.length,24);assert.equal(new Set(canvasColors).size,24);assert.ok(canvasPalette.every(c=>c.label&&/^#[0-9A-F]{6}$/.test(c.color)));
const stroke=(points,extra={})=>({id:'a:one',author:'a',points,color:canvasColors[23],width:6,brush:'ink',ephemeral:false,...extra});
for(const tool of ['line','rectangle','circle']){
 const points=shapePoints(tool,[800,900],[-100,100]);assert.ok(points.length%2===0);assert.ok(points.every(p=>Number.isFinite(p)&&p>=0&&p<=1000));assert.ok(hasShapeSize(points));
 const packet={v:1,author:'a',session:'session-1234',seq:1,kind:'stroke',...stroke(points),offset:0};assert.ok(validCanvasPacket(packet,['a','b']));assert.ok(pathForStroke(stroke(points)).startsWith('M'));
 assert.equal(hasShapeSize(shapePoints(tool,[100,100],[100,100])),false);
}
const circle=shapePoints('circle',[100,100],[500,700]);assert.equal(Math.max(...circle.filter((_,i)=>i%2===0))-Math.min(...circle.filter((_,i)=>i%2===0)),400);assert.equal(Math.max(...circle.filter((_,i)=>i%2===1))-Math.min(...circle.filter((_,i)=>i%2===1)),400);
const diagonal=stroke([0,0,1000,1000]);assert.equal(strokeAtPoint([diagonal],'a',500,500),diagonal);assert.equal(strokeAtPoint([diagonal],'a',0,1000),undefined);
assert.equal(strokeAtPoint([diagonal],'b',500,500),undefined,'Cannot erase a partner stroke');
const tap=stroke([100,100]);assert.equal(strokeAtPoint([tap],'a',110,110),tap);
const top=stroke([0,0,1000,1000],{id:'a:top'});assert.equal(strokeAtPoint([diagonal,top],'a',500,500),top,'Topmost own stroke wins');
const smooth=stroke([0,0,1000,0,1000,1000]);assert.equal(strokeAtPoint([smooth],'a',750,125),smooth,'Eraser follows the rendered quadratic curve');assert.equal(strokeAtPoint([smooth],'a',500,500),undefined);
assert.equal(validCanvasPacket({v:1,author:'a',session:'session-1234',seq:1,kind:'stroke',...tap,offset:0,color:'url(https://example.com)'},['a','b']),false);
console.log('PASS 24 named colors, bounded shape geometry, exact circle aspect, degenerate gesture handling, realtime protocol, own/topmost stroke erasing and rendered-path hit testing.');
