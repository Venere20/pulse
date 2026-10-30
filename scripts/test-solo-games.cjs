const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const moduleResult={exports:{}};
const catalog={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/sologames/starDrawings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:catalog.exports,module:catalog});
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/sologames/logic.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:moduleResult.exports,module:moduleResult,require:name=>{assert.equal(name,'./starDrawings');return catalog.exports;}});
const {newMemory,validMemory,flipMemory,resolveMemory,CONSTELLATIONS}=moduleResult.exports;
for(const pairs of [6,8,12]){
 let s=newMemory(pairs);assert.ok(validMemory(s,pairs));assert.equal(validMemory({...s,deck:Array(pairs*2).fill(0)},pairs),false);
 const indices=s.deck.map((v,i)=>i);const first=indices[0],second=indices.find(i=>s.deck[i]!==s.deck[first]);
 s=flipMemory(s,first);assert.equal(s.moves,0);assert.strictEqual(flipMemory(s,first),s);
 s=flipMemory(s,second);assert.equal(s.moves,1);assert.strictEqual(flipMemory(s,indices[2]),s);
 s=resolveMemory(s);assert.equal(s.matched.length,0);assert.equal(s.open.length,0);
 for(let symbol=0;symbol<pairs;symbol++){const [a,b]=indices.filter(i=>s.deck[i]===symbol);s=resolveMemory(flipMemory(flipMemory(s,a),b));assert.ok(validMemory(s,pairs));assert.strictEqual(flipMemory(s,a),s);}
 assert.equal(s.matched.length,pairs*2);assert.equal(s.moves,pairs+1);
}
assert.equal(CONSTELLATIONS.length,206);for(const sky of CONSTELLATIONS){assert.ok(sky.points.length>=5);assert.ok(sky.points.every(([x,y])=>x>=10&&x<=90&&y>=10&&y<=90));}
console.log('PASS solo games: shuffled pairs, invalid saved data, repeated/locked/matched cards, mismatches, wins, 206 valid constellations.');
