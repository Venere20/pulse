// Executes the real CanvasScreen effects and event handlers with two hook runtimes.
// Transport and clock are controlled; no device or production backend is contacted.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,require,globals={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:m,exports:m.exports,require,console,AbortController,setTimeout,clearTimeout,...globals});return m.exports;}
const protocol=load('src/features/canvas/protocol.ts',()=>{}),tools=load('src/features/canvas/tools.ts',()=>{}),eraser=load('src/features/canvas/eraser.ts',name=>name==='./protocol'?protocol:tools),persistent=load('src/features/canvas/persistentBoard.ts',name=>name==='./eraser'?eraser:protocol),channels=[];
function session(owner,partner){
 const slots=[],effects=[],intervals=new Map(),rafs=new Map(),memory=new Map();let index=0,tree,reads=0,healthy=false,next=0;
 const board={rows:[{id:1,epoch:1,revision:0,strokes:[],deleted_ids:[]}],refresh(){reads++;},realtimeConnected:false,hasSnapshot:true,error:null};
 const empty={rows:[],refresh(){}};
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useRef(initial){const i=index++;return slots[i]??(slots[i]={current:initial});},useMemo(factory,deps){const i=index++,prior=slots[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))slots[i]={deps,value:factory()};return slots[i].value;},useEffect(fn,deps){const i=index++,prior=slots[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))effects.push(()=>{prior?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const ch={on(event,_filter,fn){ch[event]=fn;return ch;},subscribe(fn){ch.status=fn;return ch;},track(){return Promise.resolve();},presenceState(){return{};},send(message){for(const other of channels)if(other!==ch&&!other.removed)other.broadcast?.({payload:message.payload});return Promise.resolve();}};
 const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});
 const mocks={
  react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Platform:{OS:'web'},View:'View',TouchableOpacity:'TouchableOpacity',AppState:{addEventListener(){return{remove(){}};}}},
  '../../hooks/useActivity':{useScreenActive:()=>true},'../../services/saveState':{},'./Surface':{Surface:'Surface',Drawing:'Drawing'},'expo-haptics':{},
  '../../config/supabase':{supabase:{channel(){channels.push(ch);return ch;},removeChannel(c){c.removed=true;}}},
  '../../state/AppData':{useAppDataFields:()=>({userId:owner,partnerId:partner})},'../../ui/primitives':Object.fromEntries(['Button','Card','Chip','Input','T'].map(k=>[k,k])),
  '../FeatureFrame':{FeatureFrame:'FeatureFrame',useFeatureAction:()=>({busy:false,run:fn=>fn()})},
  '../useFeatureRows':{useFeatureRows:table=>table==='canvas_current'?board:empty,featureRpc:()=>Promise.resolve()},
  '../../utils/confirm':{},'expo-router':{router:{}},'../../ui/Toast':{useToast:()=>({error(message){throw Error(message);}})},'./protocol':protocol,
  '../updates/useUpdateProtection':{useUpdateProtection(){}},'../../ui/layout':{IconButton:'IconButton'},'./persistentBoard':persistent,
  '../../services/drafts/storage':{draftStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}},'../drafts/useDraftField':{useDraftField:()=>['',()=>{}]},
 };
mocks['../../ui/layout']={Screen:'Screen',Header:'Header',BottomSheet:'BottomSheet',IconButton:'IconButton'};
mocks['../../theme/ThemeProvider']={useTheme:()=>({c:{},r:{md:12,lg:20,pill:99},s:{xs:4,sm:8,md:12,lg:20,xl:24}})};mocks['../../ui/safeArea']={useInsets:()=>({bottom:0})};mocks['../../ui/Icon']={Icon:'Icon'};mocks['react-native'].useWindowDimensions=()=>({width:390,height:844});
mocks['./tools']=tools;mocks['./eraser']=eraser;
 const {CanvasScreen}=load('src/features/canvas/CanvasScreen.tsx',name=>{if(!(name in mocks))throw Error('Missing mock '+name);return mocks[name];},{setInterval(fn,ms){const id=++next;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id),setTimeout:()=>++next,clearTimeout(){},requestAnimationFrame(fn){const id=++next;rafs.set(id,fn);return id;},cancelAnimationFrame:id=>rafs.delete(id)});
 function render(){index=0;tree=CanvasScreen();while(effects.length)effects.shift()();return tree;}
 function frames(){for(const[id,fn]of [...rafs]){rafs.delete(id);fn();}render();}
 function nodes(value,result=[]){if(!value||typeof value!=='object')return result;if(value.type)result.push(value);for(const child of Object.values(value.props??{})){if(Array.isArray(child))child.forEach(v=>nodes(v,result));else nodes(child,result);}return result;}
 render();nodes(tree).find(n=>n.props.testID==='canvas-stage').props.onLayout({nativeEvent:{layout:{width:358,height:550}}});render();ch.status('SUBSCRIBED');frames();
 return{render,frames,ch,presence(value){ch.presenceState=()=>value?{[partner]:[{}]}:{};ch.presence();render();},text(){return nodes(tree).filter(n=>n.type==='T').map(n=>n.props.children).flat().join(' ');},get reads(){return reads;},tick(ms){for(const timer of intervals.values())if(timer.ms===ms)timer.fn();},snapshot(available,error=null){board.hasSnapshot=available;board.error=error;render();},health(value){healthy=value;board.realtimeConnected=healthy;render();},surface(){return nodes(tree).find(n=>n.type==='Surface').props;},choose(label){const match=()=>nodes(tree).find(n=>n.props.label===label||n.props.accessibilityLabel===label);if(!match()){nodes(tree).find(n=>n.props.accessibilityLabel==='Pennello').props.onPress();render();}match().props.onPress();render();const done=nodes(tree).find(n=>n.props.label==='Fatto');if(done){done.props.onPress();render();}},draw(){this.choose('Mano libera');this.surface().onBegin(100,100);this.surface().onPoint(200,200);frames();},close(){for(const slot of slots)slot?.cleanup?.();}};
}
const a=session('a','b'),b=session('b','a');a.presence(true);assert.ok(a.text().includes('Il partner è qui'));a.presence(false);assert.ok(a.text().includes('partner non presente'));
for(let i=0;i<6;i++)a.tick(10000);assert.equal(a.reads,6,'Disconnected transport keeps 10-second recovery reads');
a.health(true);b.health(true);for(let i=0;i<6;i++){a.tick(10000);b.tick(10000);}assert.equal(a.reads,6);assert.equal(b.reads,0,'Healthy realtime skips redundant polling');
// Drain hello packets, then deliver a live stroke before release/persistence.
for(let i=0;i<4;i++){a.tick(50);b.tick(50);}a.draw();for(let i=0;i<4;i++){a.tick(50);b.tick(50);}b.frames();assert.equal(b.surface().strokes.length,1,'Partner sees live stroke before durable save');
b.draw();for(let i=0;i<4;i++){a.tick(50);b.tick(50);}a.frames();assert.equal(a.surface().strokes.length,2,'Live drawing works in both directions');
// Shapes remain local previews, including across checkpoints/hello replays.
for(const label of ['Linea','Rettangolo','Cerchio']){
 const count=b.surface().strokes.length;a.choose(label);a.surface().onBegin(400,400);a.surface().onPoint(600,600);a.frames();
 assert.equal(a.surface().strokes.length,count+1);a.tick(750);a.tick(50);b.frames();assert.equal(b.surface().strokes.length,count,'Shape preview is not broadcast or persisted');
 a.surface().onEnd();for(let i=0;i<4;i++){a.tick(50);b.tick(50);}b.frames();assert.equal(b.surface().strokes.length,count+1,'Committed shape reaches partner once');
}
a.choose('Gomma');a.surface().onBegin(600,500);a.surface().onPoint(600,500);a.surface().onEnd();for(let i=0;i<4;i++){a.tick(50);b.tick(50);}a.frames();b.frames();assert.equal(a.surface().strokes.length,5);assert.equal(b.surface().strokes.length,5);assert.ok(a.surface().strokes.some(s=>s.erasures?.length));assert.deepEqual(JSON.parse(JSON.stringify(a.surface().strokes.filter(s=>s.author==='a').sort((x,y)=>x.id.localeCompare(y.id)))),JSON.parse(JSON.stringify(b.surface().strokes.filter(s=>s.author==='a').sort((x,y)=>x.id.localeCompare(y.id)))),'Partial erasing synchronizes while all original paths remain');
// Mask A's own line at the overlap; B's identical stroke remains unmasked.
a.surface().onBegin(150,150);a.surface().onEnd();a.frames();a.surface().onBegin(150,150);a.surface().onEnd();a.frames();assert.equal(a.surface().strokes.filter(s=>s.author==='b').length,1);assert.ok(!a.surface().strokes.find(s=>s.author==='b').erasures);assert.ok(a.surface().strokes.find(s=>s.author==='a').erasures?.length);
a.health(false);a.tick(10000);assert.equal(a.reads,7,'Recovery polling resumes immediately after disconnect');
a.health(true);a.tick(10000);assert.equal(a.reads,7);a.snapshot(false);a.tick(10000);assert.equal(a.reads,8,'Missing initial snapshot keeps recovery even when realtime is healthy');a.snapshot(true,'Temporary read failure');a.tick(10000);assert.equal(a.reads,9,'Read failures keep recovery');a.snapshot(true);a.tick(10000);assert.equal(a.reads,9);a.close();b.close();assert.ok(channels.every(ch=>ch.removed));
console.log('PASS actual CanvasScreen: live strokes in both directions, no healthy polling, disconnect fallback, recovery and cleanup.');



