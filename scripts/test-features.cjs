const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');const assert=require('node:assert/strict');
const cache=new Map();
function load(rel){const file=path.resolve(__dirname,'..',rel);if(cache.has(file))return cache.get(file);const module={exports:{}};cache.set(file,module.exports);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext('(function(require,module,exports){'+js+'\n})',{filename:file})((name)=>name.startsWith('.')?load(path.relative(path.join(__dirname,'..'),path.resolve(path.dirname(file),name))+'.ts'):require(name),module,module.exports);cache.set(file,module.exports);return module.exports;}
const {romeMoment,togetherState}=load('src/utils/together.ts');
const {computeStats}=load('src/utils/statistics.ts');
const {badgeMetrics}=load('src/features/badges/metrics.ts');
const {packingSuggestions}=load('src/features/packing/rules.ts');
const {validCanvasPacket,pathForStroke}=load('src/features/canvas/protocol.ts');
const {deckForWeek,mondayOf}=load('src/utils/deepTalk.ts');
const {monthlyRecap,shiftMonth}=load('src/features/recap/logic.ts');
const {searchIndex,searchEntries,searchExcerpt}=load('src/features/search/logic.ts');
const searchData=searchIndex([{id:'v',title:'Caffè a Milano',start_date:'2026-10-01',memory_notes:'Una sera felice'}],[{id:'n',body:'Cinema insieme',created_at:'2026-10-01',removed_at:null},{id:'deleted',body:'Segreto eliminato',created_at:'2026-10-02',removed_at:'2026-10-02'}],[{id:'w',title:'Cinema insieme',created_at:'2026-10-01'}],[{id:'s',title:'Primo messaggio',day:'2026-09-01',body:'Ci siamo conosciuti a Milano'}]);
assert.equal(searchEntries(searchData,'CAFFE milano').length,1);assert.equal(searchEntries(searchData,'cinema').length,2);assert.equal(searchEntries(searchData,'cinema','bucket').length,1);assert.equal(searchEntries(searchData,'segreto').length,0);assert.equal(searchEntries(searchData,'m').length,0);assert.equal(searchEntries(searchData,'milano','story')[0].id,'s');assert.ok(searchExcerpt('x'.repeat(200)+' ricordo speciale','ricordo').includes('ricordo'));assert.ok(searchData.every(r=>!r.path.startsWith('http')));
const {notificationPath}=load('src/navigation/notificationPath.ts');assert.equal(notificationPath('/#/home'),'/');assert.equal(notificationPath('/avvisi'),'/avvisi');assert.equal(notificationPath('/ricerca'),'/ricerca');for(const game of ['connect4','battleship','drawguess','hearts','stars','memory'])assert.equal(notificationPath('/play/'+game),'/play/'+game);for(const path of ['https://example.com','javascript:alert(1)','//example.com','/../settings','/storia?url=https://example.com'])assert.equal(notificationPath(path),null);
assert.equal(shiftMonth('2026-01',-1),'2025-12');
const summary=monthlyRecap('2026-02','2026-02-03',[
 {id:'a',start_date:'2026-01-31',end_date:'2026-02-02'},
 {id:'b',start_date:'2026-02-02',end_date:'2026-02-10'},
 {id:'future',start_date:'2026-02-20',end_date:'2026-02-21'}
],[{visit_id:'a',date:'2026-02-01',amount:10},{date:'2026-02-01',amount:999}],[]);
assert.equal(summary.days,3);assert.equal(summary.meetings.length,2);assert.equal(summary.spent,10);
const {chooseCandidates,pickCandidate}=load('src/features/choose/logic.ts');
const wish={id:'a',title:'Cena',category:'restaurant',is_completed:false};
assert.equal(chooseCandidates([wish],[],[],['a','b'],'all',30,null).length,0);
assert.equal(chooseCandidates([wish],[{bucket_item_id:'a',user_id:'b',vote:'no'}],[],['a','b'],'all',null,null).length,0);
assert.equal(pickCandidate(chooseCandidates([wish],[],[{id:'a',estimated_budget:20,estimated_minutes:60}],['a','b'],'all',30,60),()=>0).id,'a');
assert.equal(pickCandidate([]),null);
const {anniversaryDay,isAnniversaryToday,nextAnniversary}=load('src/features/anniversaries/logic.ts');
const anniversary={first_day:'2024-02-29',annual:true};
assert.equal(anniversaryDay('2024-02-29',2027),'2027-02-28');
assert.equal(anniversaryDay('2024-02-29',2028),'2028-02-29');
assert.equal(isAnniversaryToday(anniversary,'2027-02-28'),true);
assert.equal(nextAnniversary(anniversary,'2027-03-01'),'2028-02-29');
assert.equal(isAnniversaryToday({first_day:'2027-10-11',annual:true},'2026-10-11'),false);
assert.equal(nextAnniversary({first_day:'2026-01-01',annual:false},'2026-10-11'),null);
assert.equal(monthlyRecap('2026-11','2026-11-01',[],[],[{is_completed:true,completed_at:'2026-10-31T23:30:00Z'}]).wishes.length,1);
const visit=(id,start,end,extra={})=>({id,title:id,start_date:start,end_date:end,created_by:'a',...extra});
const dates=[visit('a','2026-01-01','2026-01-03',{travel_km:100}),visit('b','2026-01-03','2026-01-05',{travel_km:50}),visit('c','2026-02-10','2026-02-14')];
const expenses=[{id:'1',visit_id:'a',amount:20,category:'Cibo',paid_by:'a',date:'2026-01-01'},{id:'2',amount:10,category:'Cibo',paid_by:'b',date:'2026-01-03'},{id:'3',amount:40,paid_by:'a',date:'2026-03-01'}];
const stats=computeStats(dates,expenses,'2026-10-10');assert.equal(stats.days,10);assert.equal(stats.spent,30);assert.equal(stats.travelKm,300);assert.equal(stats.missingKm,1);assert.equal(stats.longestWait,35);assert.equal(stats.months.length,12);
assert.equal(computeStats(dates,expenses,'2026-10-10',2025).visits,0);
const summer=visit('s','2026-07-10','2026-07-12',{arrival_time:'18:30'});
assert.equal(romeMoment('2026-07-10','18:30'),Date.parse('2026-07-10T16:30:00Z'));
assert.equal(romeMoment('2026-01-10','18:30'),Date.parse('2026-01-10T17:30:00Z'));
assert.equal(togetherState([summer],null,Date.parse('2026-07-10T08:00:00Z')).active,false);
assert.equal(togetherState([summer],null,Date.parse('2026-07-10T16:30:00Z')).dayIndex,1);
assert.equal(togetherState([summer],null,Date.parse('2026-07-12T22:00:00Z')).active,false);
assert.equal(togetherState([], 'together',Date.parse('2026-01-01')).active,true);
assert.equal(romeMoment('2026-03-30')-romeMoment('2026-03-29'),23*3600000);
assert.ok(Number.isNaN(romeMoment('2026-02-30','12:00')));
assert.ok(Number.isNaN(romeMoment('2026-03-29','02:30')));
assert.ok(Number.isNaN(romeMoment('2026-10-10','24:00')));
const metrics=badgeMetrics(dates,[],[],[],[{day:'2026-01-01',count:100}],'2026-10-10');assert.equal(metrics.earned('days',7),'2026-02-11');assert.equal(metrics.earned('visits',2),'2026-01-05');assert.equal(metrics.earned('wait',30),'2026-02-10');assert.equal(metrics.secrets.length,2);
const streak=badgeMetrics([],[],['01','02','04'].flatMap(day=>['a','b'].map(user_id=>({day:'2026-01-'+day,user_id}))),[],[],'2026-10-10');assert.equal(streak.totals.streak,2);
const long=visit('p','2026-10-10','2026-10-20',{transport:'Aereo'});const suggestions=packingSuggestions(long,null,'hot',['Andiamo in spiaggia']);assert.equal(suggestions.find(s=>s.source_key==='underwear').quantity,7);assert.ok(suggestions.some(s=>s.source_key==='laundryplan'));assert.ok(suggestions.some(s=>s.source_key==='swim'));assert.ok(!suggestions.some(s=>s.source_key==='raincoat'));
assert.ok(packingSuggestions(long,{avgTemp:4,rainChance:80,code:61},'hot',[]).some(s=>s.source_key==='raincoat'));
assert.equal(mondayOf('2026-10-10'),'2026-10-05');assert.equal(deckForWeek('2026-01-05').id,'valori-01');assert.equal(deckForWeek('2026-03-30').id,'valori-01');
const packet={v:1,author:'a',session:'abc12345',seq:1,kind:'stroke',id:'a:1',color:'#FF4D85',width:6,brush:'ink',offset:0,points:[1,2,3,4],ephemeral:false};
assert.equal(validCanvasPacket(packet,['a','b']),true);for(const bad of [{...packet,v:2},{...packet,points:[NaN,1]},{...packet,points:[1001,1]},{...packet,points:[1]},{...packet,author:'intruder'},{...packet,id:'b:1'},{...packet,points:Array(202).fill(1)},{...packet,session:''}])assert.equal(validCanvasPacket(bad,['a','b']),false);
assert.equal(validCanvasPacket({...packet,offset:1},['a','b']),false);
assert.equal(pathForStroke({points:[10,20]}),'M10 20 l0.1 0.1');
console.log('PASS: overlap statistics, expenses, Rome timezone/DST, together mode, historic badges, streak gaps, packing rules, stable decks, hostile canvas packets.');
async function testConfirmations() {
 const {requestConfirmation,registerConfirmationHandler}=load('src/utils/confirmationBroker.ts');
 assert.equal(await requestConfirmation('title','body','delete'),false);
 const requests=[]; const unregister=registerConfirmationHandler(request=>requests.push(request));
 const first=requestConfirmation('first','body','delete'); const second=requestConfirmation('second','body','delete');
 assert.equal(requests.length,2); assert.notEqual(requests[0].id,requests[1].id);
 requests[0].resolve(true); requests[1].resolve(false);
 assert.equal(await first,true); assert.equal(await second,false);
 const abandoned=requestConfirmation('pending','body','delete'); unregister();
 assert.equal(await abandoned,false);
 assert.equal(await requestConfirmation('no host','body','delete'),false);
 console.log('PASS: confirmation accept, cancel, independent queued requests and unmounted host.');
}
testConfirmations().catch(error=>{console.error(error);process.exitCode=1;});
