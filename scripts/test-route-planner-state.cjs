const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
function load(file,mocks={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:9,jsx:ts.JsxEmit.React}}).outputText,{module:m,exports:m.exports,require:n=>{if(n==='./routeTime')return load('src/features/journeys/routeTime.ts');assert.ok(n in mocks,n);return mocks[n];},Date,Intl,Response,Error,setTimeout:fn=>{fn();return 0;}});return m.exports;}
function harness(userId=A,partnerId=B){
 let cursor=0;const slots=[],saved=[],errors=[],plans=[];let fail=false;
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];}};
 const visit={id:'v',journey_plan:{legs:[]}};
 const {RoutePlanner}=load('src/features/journeys/RoutePlanner.tsx',{
 react,'react-native':{View:'View',Linking:{}},'../../ui/primitives':Object.fromEntries(['Button','Card','Chip','Input','T'].map(n=>[n,n])),
 '../../ui/DateField':{DateField:'Date'},'../../config/supabase':{supabase:{functions:{invoke:async(name,{body})=>{
 if(body.action==='lookup')return{data:{places:[{name:'Beverello',lat:40.8388,lon:14.2548}]}};
 plans.push(body);if(fail)return{error:{message:'Provider offline'},data:{error:'Provider offline'}};
 const start=body.day+'T'+body.hour+':00+01:00';return{data:{options:[1000,9999].map((meters,i)=>({meters,seconds:600+i*600,start,end:new Date(Date.parse(start)+600000+i*600000).toISOString(),complete:true,uncertain:false,legs:[]}))}};
 }}}},'../FeatureFrame':{useFeatureAction:()=>({busy:false,run:async fn=>{try{await fn();}catch(e){errors.push(e.message);}}})},
 '../useFeatureRows':{featureRpc:async(name,args)=>{saved.push({name,...args});}},'../../utils/confirm':{confirmAction:async()=>true},
 });
 const walk=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)];
 const all=()=>{cursor=0;return walk(RoutePlanner({visit,userId,partnerId,myCity:'Napoli',onChanged:async()=>{}}));};
 const find=(type,label)=>{const n=all().find(n=>n.type===type&&n.props.label===label);assert.ok(n,type+' '+label);return n.props;};
 const press=label=>find('Button',label).onPress();
 const add=async()=>{find('Input','Aggiungi luogo, stazione o locale').onChangeText('Beverello');await press('Cerca luogo');await press('Beverello · Luogo trovato');};
 return{all,find,press,add,saved,plans,errors,visit,fail:value=>fail=value};
}
(async()=>{
 const ids=[];
 for(const[user,partner]of[[A,B],[B,A]]){const h=harness(user,partner);await h.press('Pianifica percorsi e tappe');h.find('Chip','Il mio percorso').onPress();await h.add();await h.press('Calcola tutte le tappe');await h.press('Conferma e salva queste tappe');assert.deepEqual(h.errors,[]);const l=h.saved[0].p_legs[0];assert.equal(l.participants[0],user);assert.ok(l.id.length<=60);ids.push(l.id);}
 assert.notEqual(ids[0],ids[1],'Personal IDs must identify the participant, not the viewer');
 const h=harness();await h.press('Pianifica percorsi e tappe');await h.add();await h.add();await h.press('Calcola tutte le tappe');
 assert.equal(h.plans.length,2);const alternate=h.all().find(n=>n.type==='Button'&&n.props.label.startsWith('9,999 km'));assert.ok(alternate);await alternate.props.onPress();
 await h.press('Calcola tutte le tappe');assert.equal(h.plans.length,3,'Only the invalidated suffix is fetched');assert.equal(h.plans[2].hour,'10:20','Next stage follows the selected alternative');
 await h.press('Conferma e salva queste tappe');assert.equal(h.saved[0].p_legs[0].distance_m,9999,'Chosen alternative survives recalculation and save');
 h.find('Input','Partenza · ora italiana (HH:MM)').onChangeText('11:00');await h.press('Calcola tutte le tappe');assert.equal(h.plans.length,5,'Changing departure invalidates all cached options');
 h.find('Input','Partenza · ora italiana (HH:MM)').onChangeText('12:00');h.fail(true);await h.press('Calcola tutte le tappe');assert.match(h.errors.at(-1),/Provider offline/);
 assert.ok(h.all().some(n=>n.type==='T'&&n.props.children.some(t=>typeof t==='string'&&t.startsWith('Calcolo interrotto.'))),'Failed request has a terminal message');
 assert.equal(h.find('Button','Conferma e salva queste tappe').disabled,true);h.fail(false);await h.press('Calcola tutte le tappe');assert.equal(h.find('Button','Conferma e salva queste tappe').disabled,false);
 console.log('PASS actual planner: participant IDs; chosen alternative preserved, dependent-only recalculation, changed inputs invalidate, failed API terminal message and retry.');
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={harness};
