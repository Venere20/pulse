const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/journeys/routeTime.ts','utf8'),{compilerOptions:{module:1,target:9}}).outputText,{module:m,exports:m.exports,Date,Intl});
const at=m.exports.italianDeparture;
assert.equal(new Date(at('2026-10-29','07:10')).toISOString(),'2026-10-29T06:10:00.000Z');
assert.equal(new Date(at('2026-07-29','07:10')).toISOString(),'2026-07-29T05:10:00.000Z');
assert.equal(new Date(at('2026-10-29','07:10')+120*60000).toISOString(),'2026-10-29T08:10:00.000Z');
for(const hour of ['7:10','0:00','9:59','24:00','7:60','007:10','7:1','7','-1:10',''])assert.throws(()=>at('2026-10-29',hour),/due cifre/);
assert.throws(()=>at('2026-02-30','07:10'));assert.throws(()=>at('2026-03-29','02:30'));
console.log('PASS strict HH:MM preserved, explicit leading-zero guidance, Italian winter/summer offsets, first stop wait and invalid date/DST rejection.');
