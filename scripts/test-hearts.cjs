const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/sologames/hearts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:mod.exports,module:mod});
const {HEART_DIFFICULTIES,heartKind,heartWave,heartEffect,waveLifetime}=mod.exports;
for(const key of ['easy','normal','hard']){
 const config=HEART_DIFFICULTIES[key];
 assert.equal(heartKind(key,0),'bomb');assert.equal(heartKind(key,config.bombChance),'gold');assert.equal(heartKind(key,0.99),'normal');
 const wave=heartWave(key,10);assert.equal(wave.length,config.targets);assert.equal(new Set(wave.map(t=>t.cell)).size,config.targets);assert.equal(new Set(wave.map(t=>t.id)).size,config.targets);assert.ok(wave.every(t=>t.cell>=0&&t.cell<16));
 const gold=heartEffect('gold',key,10000,0);assert.equal(gold.time,10000+config.bonus*1000);assert.equal(gold.points,3);
 const bomb=heartEffect('bomb',key,10000,0);assert.equal(bomb.time,10000-config.penalty*1000);assert.equal(bomb.points,0);
 assert.equal(heartEffect('bomb',key,500,0).time,0);
 assert.equal(heartEffect('bomb',key,config.penalty*1000,0).time,0);
 assert.equal(heartEffect('bomb',key,config.penalty*1000-1,0).time,0);
 assert.equal(heartEffect('bomb',key,config.penalty*1000+1,0).time,1);
 assert.equal(heartEffect('normal',key,10000,0).time,10000);
 assert.equal(heartEffect('gold',key,1000,config.maxSeconds*1000-1000).time,1000);
 assert.equal(waveLifetime(key,10000),config.minimumLifetime);
 const kinds=Array.from({length:1000},(_,i)=>heartKind(key,(i+0.5)/1000));assert.equal(kinds.filter(k=>k==='bomb').length,Math.round(config.bombChance*1000));assert.equal(kinds.filter(k=>k==='gold').length,Math.round(config.goldChance*1000));
}
assert.ok(HEART_DIFFICULTIES.easy.seconds>HEART_DIFFICULTIES.normal.seconds&&HEART_DIFFICULTIES.normal.seconds>HEART_DIFFICULTIES.hard.seconds);
console.log('PASS hearts: difficulty durations/frequencies, non-overlapping waves, unique targets, gold time/points, bomb penalty/zero clamp, bonus cap, speed limits.');
