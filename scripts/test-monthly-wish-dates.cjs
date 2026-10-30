const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:name=>load(path.resolve(path.dirname(file),name+'.ts'))});return m.exports;}
const {monthlyRecap}=load('src/features/recap/logic.ts');
const wish={id:'sea',title:'Serata al mare',is_completed:true,completed_at:'2026-10-24T10:40:10Z'};
const outing={id:'september',start_date:'2026-09-10',end_date:'2026-09-10',status:'concluded',timing_mode:'scheduled'};
const links=[{visit_id:outing.id,bucket_item_id:wish.id}];
const recap=(month,visits=[outing],wishes=[wish],relation=links)=>monthlyRecap(month,'2026-10-25',visits,[],wishes,relation);
assert.equal(recap('2026-09').wishes.length,1);assert.equal(recap('2026-10').wishes.length,0);
assert.equal(wish.completed_at,'2026-10-24T10:40:10Z','Historic audit date is unchanged');
assert.equal(recap('2026-10',[],[wish],[]).wishes.length,1,'Independent wishes use completion date');
assert.equal(recap('2026-09',[outing],[{...wish,completed_at:null}]).wishes.length,1,'Old completion without stamp can use its linked outing');
assert.equal(recap('2026-09',[outing],[{...wish,is_completed:false}]).wishes.length,0);
const later={...outing,id:'later',start_date:'2026-10-02',end_date:'2026-10-02'};
const both=[...links,{visit_id:later.id,bucket_item_id:wish.id}];
assert.equal(recap('2026-09',[later,outing],[wish],both).wishes.length,1);
assert.equal(recap('2026-10',[later,outing],[wish],both).wishes.length,0,'Earliest linked concluded date wins independently of row order');
const manual={...outing,timing_mode:'manual',status:'planned',started_at:'2026-09-30T20:00:00Z',ended_at:'2026-09-30T22:30:00Z'};
assert.equal(recap('2026-10',[manual]).wishes.length,1,'Actual end uses Rome timezone (October 1)');
assert.equal(recap('2026-09',[manual]).wishes.length,0);
for(const v of [{...outing,timing_mode:'manual',status:'planned'}, {...outing,timing_mode:'manual',status:'planned',started_at:'2026-09-10T10:00:00Z'}, {...outing,start_date:'2026-10-29',end_date:'2026-10-29',status:'planned'}]){
 assert.equal(recap('2026-09',[v]).wishes.length,0);assert.equal(recap('2026-10',[v]).wishes.length,1,'An uncompleted/future link cannot shift completion');
}
assert.equal(recap('2026-10',[],[{...wish,completed_at:'not-a-date'}],[]).wishes.length,0);
const cross={...outing,start_date:'2026-09-30',end_date:'2026-10-01'};
assert.equal(recap('2026-10',[cross]).wishes.length,1);assert.equal(recap('2026-09',[cross]).wishes.length,0,'An outing across months attributes fulfillment to its last day');
console.log('PASS monthly wishes: historical linked outing, independent fallback, null/invalid dates, completion flag, multiple links, actual end/Rome timezone, ongoing/future links and cross-month outing.');
