const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const mod={exports:{}};vm.runInThisContext('(function(exports,module){'+ts.transpileModule(fs.readFileSync('src/features/canvas/protocol.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+'})')(mod.exports,mod);
const {pathForStroke,validCanvasPacket}=mod.exports;
const stroke={id:'a:test',author:'a',color:'#FF4D85',width:6,brush:'ink',points:[]};
assert.equal(pathForStroke(stroke),'');stroke.points=[0,0];assert.equal(pathForStroke(stroke),'M0 0 l0.1 0.1');stroke.points=[0,0,100,200];assert.equal(pathForStroke(stroke),'M0 0 L100 200');
stroke.points=[0,0,100,200,300,100,500,500];const before=[...stroke.points];const path=pathForStroke(stroke);assert.ok(path.includes('Q100 200 200 150'));assert.ok(path.endsWith('L500 500'));assert.deepEqual(stroke.points,before);
const packet={v:1,author:'a',session:'session-123',seq:0,kind:'stroke',id:'a:test',color:'#FF4D85',width:6,brush:'ink',offset:0,points:stroke.points,ephemeral:false};assert.ok(validCanvasPacket(packet,['a','b']));assert.ok(!validCanvasPacket({...packet,points:[Infinity,0]},['a','b']));
console.log('PASS: smooth paths, exact endpoints, taps, empty strokes, unchanged coordinates and existing live protocol.');
