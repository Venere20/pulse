const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function moduleAt(path,require,extra={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require,...extra});return m.exports;}
const protocol=moduleAt('src/features/canvas/protocol.ts',()=>{});
const tools=moduleAt('src/features/canvas/tools.ts',()=>{}),eraser=moduleAt('src/features/canvas/eraser.ts',name=>name==='./protocol'?protocol:tools);
let cursor=0,clock=10000;const slots=[],effects=[],timers=[],frames=[],sent=[],handlers={};
const react={createElement:(type,props,...children)=>typeof type==='function'?type({...props,children}):({type,props:{...props,children}}),useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},useEffect(callback,deps){const i=cursor++;if(!(i in slots)){slots[i]=deps;effects.push(callback);}}};react.default=react;
const ch={on(kind,_filter,callback){handlers[kind]=callback;return ch;},subscribe(callback){callback('SUBSCRIBED');return ch;},track:async()=>{},presenceState:()=>({}),send:async packet=>sent.push(JSON.parse(JSON.stringify(packet.payload)))};
const mocks={'react':react,'react-native':{View:'View',TouchableOpacity:'Touch',Platform:{OS:'web'},AppState:{addEventListener:()=>({remove(){}})}},'./Surface':{Surface:'Surface',Drawing:'Drawing'},'expo-haptics':{},'../../config/supabase':{supabase:{channel:()=>ch,removeChannel:async()=>{}}},'../../state/AppData':{useAppData:()=>({userId:'a',partnerId:'b'})},'../../hooks/useActivity':{useScreenActive:()=>true},'../../services/saveState':{trackResult:fn=>fn()},'../../ui/primitives':Object.fromEntries(['Button','Card','Chip','Input','T'].map(x=>[x,x])),'../FeatureFrame':{FeatureFrame:'Frame',useFeatureAction:()=>({busy:false,run:async fn=>fn()})},'../useFeatureRows':{featureRpc:async()=>{},useFeatureRows:()=>({rows:[],refresh:async()=>{}})},'../../utils/confirm':{confirmAction:async()=>true},'expo-router':{router:{}},'../../ui/Toast':{useToast:()=>({error:message=>{throw new Error(message);},success(){}})},'./protocol':protocol};
mocks['./eraser']=eraser;
mocks['../updates/useUpdateProtection']={useUpdateProtection(){}};mocks['../../ui/layout']={IconButton:'IconButton'};mocks['../../state/AppData']={useAppDataFields:()=>({userId:'a',partnerId:'b'})};
react.useMemo=callback=>{const i=cursor++;return slots[i]??(slots[i]=callback())};
mocks['./persistentBoard']={createPersistentBoard:()=>({view:()=>({epoch:1,strokes:[],deleted_ids:[],pending:false,ready:true,localSaved:true,error:''}),subscribe:()=>()=>{},receive(){},put(){},undo(){},clear(){},flush:async()=>{}})};
mocks['../../services/drafts/storage']={draftStorage:{}};
mocks['../drafts/useDraftField']={useDraftField:(_scope,_field,value)=>react.useState(value)};
mocks['../../ui/layout']={Screen:'Screen',Header:'Header',BottomSheet:'BottomSheet',IconButton:'IconButton'};
mocks['../../theme/ThemeProvider']={useTheme:()=>({c:{},r:{md:12,lg:20,pill:99},s:{xs:4,sm:8,md:12,lg:20,xl:24}})};mocks['../../ui/safeArea']={useInsets:()=>({bottom:0})};mocks['../../ui/Icon']={Icon:'Icon'};mocks['react-native'].useWindowDimensions=()=>({width:390,height:844});
mocks['./tools']=moduleAt('src/features/canvas/tools.ts',()=>{});
const {CanvasScreen}=moduleAt('src/features/canvas/CanvasScreen.tsx',name=>{if(!(name in mocks))throw new Error('Unexpected import '+name);return mocks[name];},{Date:class extends Date{static now(){return clock;}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},setTimeout:fn=>{frames.push(fn);return 1},clearTimeout(){},setInterval:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearInterval(){}});
function render(){cursor=0;const tree=CanvasScreen();while(effects.length)effects.shift()();return tree;}
function find(tree,type,label){if(!tree)return; if(Array.isArray(tree)){for(const child of tree){const found=find(child,type,label);if(found)return found;}}else if(tree.type===type&&(!label||tree.props.label===label||tree.props.accessibilityLabel===label))return tree;else return find(tree.props?.children,type,label);}
const drain=()=>{while(frames.length)frames.shift()();for(let i=0;i<20;i++)timers.find(t=>t.delay===50).fn();};
(async()=>{
 let tree=render();const stage=tree.props.children.flatMap(n=>n?.props?.children??[]).find(n=>n?.props?.testID==='canvas-stage');stage.props.onLayout({nativeEvent:{layout:{width:358,height:550}}});tree=render();drain();sent.length=0;const surface=find(tree,'Surface').props;assert.equal(surface.enabled,true,'V2 canvas is immediately ready to draw');
 surface.onBegin(10,20);drain();clock+=60;surface.onPoint(30,40);drain();clock+=60;surface.onPoint(50,60);surface.onEnd();drain();
 const first=sent.filter(p=>p.kind==='stroke');assert.deepEqual(first.map(p=>p.offset),[0,2,4]);assert.deepEqual(first.flatMap(p=>p.points),[10,20,30,40,50,60]);assert.ok(first.every(p=>protocol.validCanvasPacket(p,['a','b'])));
 sent.length=0;clock+=60;surface.onBegin(70,80);clock+=60;surface.onPoint(90,100);surface.onEnd();drain();
 const second=sent.filter(p=>p.kind==='stroke');assert.deepEqual(second.flatMap(p=>p.points),[70,80,90,100]);assert.ok(second.every(p=>p.id!==first[0].id));
 // Remote receiver builds one stroke from two incremental packets, ignores a replayed sequence.
 handlers.broadcast({payload:{v:1,author:'b',session:'abcdefgh',seq:1,kind:'stroke',id:'b:1',color:'#FF4D85',width:6,brush:'ink',ephemeral:false,offset:0,points:[11,22]}});
 handlers.broadcast({payload:{v:1,author:'b',session:'abcdefgh',seq:2,kind:'stroke',id:'b:1',color:'#FF4D85',width:6,brush:'ink',ephemeral:false,offset:2,points:[33,44]}});
 handlers.broadcast({payload:{v:1,author:'b',session:'abcdefgh',seq:2,kind:'stroke',id:'b:1',color:'#FF4D85',width:6,brush:'ink',ephemeral:false,offset:2,points:[33,44]}});drain();tree=render();
 assert.deepEqual(JSON.parse(JSON.stringify(find(tree,'Surface').props.strokes.find(s=>s.id==='b:1').points)),[11,22,33,44]);
 sent.length=0;find(tree,'Touch','Annulla').props.onPress();drain();assert.equal(sent[0].kind,'undo');assert.equal(sent[0].id,second[0].id);assert.equal(sent[0].points,undefined);
 tree=render();find(tree,'Touch','Altro').props.onPress();tree=render();find(tree,'Touch','Pulisci lavagna').props.onPress();tree=render();find(tree,'Button','Pulisci').props.onPress();await new Promise(resolve=>setImmediate(resolve));drain();assert.equal(sent.at(-1).kind,'clear');assert.ok(sent.at(-1).ids.includes('b:1'));assert.equal(sent.at(-1).points,undefined);
 console.log('PASS actual CanvasScreen transport: only new point offsets, no previous strokes resent while drawing, remote reconstruction/duplicate rejection, undo and clear without point payloads.');
})().catch(e=>{console.error(e);process.exitCode=1;});


