// Render the actual editor with isolated picker/storage fixtures. No network.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:9,jsx:ts.JsxEmit.React}}).outputText,{module:m,exports:m.exports,require:name=>{assert.ok(Object.hasOwn(mocks,name),name);return mocks[name];}});return m.exports;}
const {MAX_MEMORY_PHOTOS}=load('src/services/storage.ts',{'../config/supabase':{},'./photoPreparation':{},'./memoryPhotoPaths':{},'./memoryPhotos':{}});
const {uncertainWrite}=load('src/services/saveState.ts',{});
assert.equal(MAX_MEMORY_PHOTOS,5);
function harness(initialPhotos){
 let cursor=0;const slots=[],pickers=[],uploads=[],writes=[],removed=[],errors=[],effects=[];let changed=0;
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn);}}};
 const visit={id:'v',memory_photos:initialPhotos};let loseResponse=false,readFails=false,delayed=false,pendingCommit;
 const {MemoryEditor}=load('src/components/MemoryCard.tsx',{
  react,'react-native':{View:'View',ScrollView:'Scroll',TouchableOpacity:'Touch',useWindowDimensions:()=>({width:390})},
  'expo-image-picker':{launchImageLibraryAsync:async options=>{pickers.push(options);return{canceled:false,assets:Array.from({length:8},(_,n)=>({uri:'asset-'+n}))};}},
  '../services/saveState':{trackResult:fn=>fn(),uncertainWrite},'../config/supabase':{supabase:{from:()=>({select:()=>({eq:()=>({single:async()=>({data:readFails?null:visit,error:readFails?{message:'Offline'}:null})})})}),rpc:async(name,args)=>{
   assert.equal(name,'save_visit_memory');
   const current={note:visit.memory_notes||'',photos:visit.memory_photos||[],settings:visit.memory_photo_settings||{}};
   if(JSON.stringify(current)!==JSON.stringify(args.p_expected))return{error:{message:'Il partner ha modificato questo ricordo'}};
   const values={memory_notes:args.p_note.trim()||null,memory_photos:args.p_photos,memory_photo_settings:args.p_settings};
   if(delayed){pendingCommit=()=>Object.assign(visit,values);return{error:{message:'Network timeout'}};}
   writes.push(values);Object.assign(visit,values);return{error:loseResponse?{message:'Network timeout'}:null};
  }}},
  '../utils/dates':{},'../services/storage':{MAX_MEMORY_PHOTOS,uploadMeetingPhoto:async(id,asset)=>{uploads.push(asset);return'uploaded-'+uploads.length;},removeMeetingPhoto:async uri=>removed.push(uri)},
  '../ui/primitives':Object.fromEntries(['Button','Card','EmptyState','Input','T'].map(k=>[k,k])), '../ui/Icon':{Icon:'Icon'},
  '../ui/Toast':{useToast:()=>({error:message=>errors.push(message),success(){}})},'../theme/ThemeProvider':{useTheme:()=>({c:{},r:{},s:{lg:16}})},
  './MemoryPhotoFrame':{MemoryPhotoFrame:'Photo'},'./MemoryPhotoEditor':{MemoryPhotoEditor:'PhotoEditor'},
 });
 const render=()=>{cursor=0;const root=MemoryEditor({visit,doneWishes:[],onChanged:()=>changed++});while(effects.length)effects.shift()();return root;};
 const walk=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children),...walk(n.props?.action)];
 const all=()=>walk(render());const button=label=>{const node=all().find(n=>n.type==='Button'&&n.props.label===label);assert.ok(node,label);return node.props;};
 return{visit,all,button,pickers,uploads,writes,removed,errors,changed:()=>changed,loseResponse:()=>loseResponse=true,readFails:value=>readFails=value,delayCommit:()=>delayed=true,commit:()=>pendingCommit()};
}
(async()=>{
 const h=harness(['one','two','three']);await h.button('Modifica ricordo').onPress();
 await h.button('Aggiungi foto (3/5)').onPress();assert.equal(h.pickers[0].selectionLimit,2);assert.equal(h.uploads.length,2,'Extra picker results are trimmed to the remaining two slots');
 assert.equal(h.button('Aggiungi foto (5/5)').disabled,true);assert.equal(h.writes.length,0,'Selection remains a draft');
 await h.button('Salva ricordo').onPress();assert.equal(h.writes[0].memory_photos.length,5);assert.deepEqual(Array.from(h.writes[0].memory_photos).slice(0,3),['one','two','three']);assert.equal(h.changed(),1);
 const legacy=harness(['one','two','three']);await legacy.button('Modifica ricordo').onPress();await legacy.button('Salva ricordo').onPress();assert.equal(legacy.writes[0].memory_photos.length,3,'Existing three-photo memories stay intact');
 const empty=harness([]);assert.ok(empty.all().some(n=>n.type==='EmptyState'&&n.props.hint.includes('5 foto')));await empty.button('Aggiungi ricordo').onPress();await empty.button('Aggiungi foto (0/5)').onPress();assert.equal(empty.pickers[0].selectionLimit,5);assert.equal(empty.uploads.length,5);
 const full=harness(['one','two','three','four','five']);await full.button('Modifica ricordo').onPress();assert.equal(full.button('Aggiungi foto (5/5)').disabled,true);
 await full.button('Aggiungi foto (5/5)').onPress();assert.equal(full.pickers.length,0);assert.match(full.errors[0],/massimo 5/);
 const conflict=harness(['original']);await conflict.button('Modifica ricordo').onPress();conflict.visit.memory_photos=['original','partner-added'];
 await conflict.button('Salva ricordo').onPress();assert.equal(conflict.writes.length,0);assert.equal(conflict.removed.length,0);assert.match(conflict.errors[0],/partner/);
 assert.ok(conflict.button('Salva ricordo'),'Draft stays open after conflict');
 await conflict.button('Annulla').onPress();assert.equal(conflict.removed.length,0,'Cancel never removes partner files');
 const cleanup=harness(['original']);await cleanup.button('Modifica ricordo').onPress();await cleanup.button('Aggiungi foto (1/5)').onPress();
 cleanup.all().find(n=>n.type==='Touch'&&n.props.accessibilityLabel==='Rimuovi foto'&&n.props.children[0]).props.onPress();
 await cleanup.button('Annulla').onPress();assert.equal(cleanup.removed.length,4,'All session uploads cleaned even if removed from draft');assert.ok(!cleanup.removed.includes('original'));
 const lost=harness(['original']);await lost.button('Modifica ricordo').onPress();await lost.button('Aggiungi foto (1/5)').onPress();lost.loseResponse();await lost.button('Salva ricordo').onPress();
 await lost.button('Annulla').onPress();assert.equal(lost.removed.length,0,'A committed save with lost response must never delete its uploads on Cancel');
 const offline=harness([]);await offline.button('Aggiungi ricordo').onPress();await offline.button('Aggiungi foto (0/5)').onPress();offline.readFails(true);await offline.button('Annulla').onPress();assert.equal(offline.removed.length,0);assert.ok(offline.button('Salva ricordo'),'Unverifiable uploads stay in the open draft');
 offline.readFails(false);await offline.button('Annulla').onPress();assert.equal(offline.removed.length,5);
 const late=harness([]);await late.button('Aggiungi ricordo').onPress();await late.button('Aggiungi foto (0/5)').onPress();late.delayCommit();await late.button('Salva ricordo').onPress();await late.button('Annulla').onPress();late.commit();assert.equal(late.removed.length,0,'Cancel quarantines ambiguous uploads even if the server commits AFTER it');assert.equal(late.visit.memory_photos.length,5);
 console.log('PASS five-photo editor: existing three retained, 3+2 and 0+5 selection, excess results trimmed, draft-vs-save, counter/disabled limit and sixth-photo guard.');
})().catch(error=>{console.error(error);process.exitCode=1;});
