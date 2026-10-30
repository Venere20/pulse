const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const load=(file,mocks={})=>{const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{module:m,exports:m.exports,require:n=>mocks[n]});return m.exports;};
const notes=load('src/features/updates/releaseNotes.ts'),logic=load('src/features/updates/releaseNotesState.ts'),safety=load('src/features/updates/updateSafety.ts');
assert.ok(notes.RELEASE_NOTES.length);assert.equal(new Set(notes.RELEASE_NOTES.map(r=>r.id)).size,notes.RELEASE_NOTES.length);
for(const note of notes.RELEASE_NOTES){assert.match(note.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(note.title&&note.changes.length&&note.changes.every(c=>c.trim().length>10));}
const releases=[{id:'3'},{id:'2'},{id:'1'}];assert.equal(notes.unseenReleases('3',releases).length,0);assert.equal(notes.unseenReleases(null,releases).length,1);assert.equal(notes.unseenReleases('unknown',releases).length,1);assert.equal(notes.unseenReleases('1',releases).map(r=>r.id).join(','),'3,2');
const disk=new Map(),storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)};
let store=logic.createReleaseNotesState(storage);assert.equal(store.read('a'),null);assert.equal(store.acknowledge('a','first'),true);assert.equal(store.read('a'),'first');assert.equal(store.read('b'),null);
store=logic.createReleaseNotesState(storage);assert.equal(store.read('a'),'first','Persists after process restart');assert.equal(store.acknowledge('a','second'),true);assert.equal(store.read('a'),'second');assert.equal(store.acknowledge('','second'),false);
const fallback=logic.createReleaseNotesState({getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('full');}});assert.equal(fallback.read('a'),null);assert.equal(fallback.acknowledge('a','v1'),false);assert.equal(fallback.read('a'),'v1','Storage error does not trap the user');
let path='/',owner='a',active=true,loaded=true,blocked=false,cursor=0,current;const states=new Map(),errors=[];
const badges={enabled:true,unseen:[],loading:false};
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState:init=>{const index=cursor++,key=current;if(!states.has(key))states.set(key,[]);const state=states.get(key);if(!(index in state))state[index]=typeof init==='function'?init():init;return[state[index],v=>state[index]=v];},useSyncExternalStore:(_,read)=>read()};
const mocks={react:{...react,default:react},'react-native':{View:'View',Modal:'Modal',ScrollView:'ScrollView',useWindowDimensions:()=>({height:844})},'expo-router':{usePathname:()=>path},'../../hooks/useActivity':{useAppForeground:()=>active},'../../state/AppData':{useAppDataFields:()=>({userId:owner,loaded})},'../../services/drafts/storage':{draftStorage:storage},'../../ui/layout':{IconButton:'IconButton'},'../../ui/primitives':{Button:'Button',T:'T'},'../../ui/Toast':{useToast:()=>({error:m=>errors.push(m)})},'../../theme/ThemeProvider':{useTheme:()=>({c:{},r:{},s:{}})},'../../utils/dates':{formatDateIt:x=>x},'../badges/Badges':{useBadges:()=>badges},'./releaseNotes':notes,'./releaseNotesState':logic,'./updateSafety':safety,'./updateProtection':{updateProtection:{subscribe:()=>()=>{},blocked:()=>blocked}}};
mocks['./ReleaseNotesContent']={ReleaseNotesContent:'ReleaseNotesContent'};
const {ReleaseNotesNotice}=load('src/features/updates/ReleaseNotesNotice.tsx',mocks);
function render(){const root=ReleaseNotesNotice();current=owner;cursor=0;return root.type(root.props);}
let tree=render();assert.equal(tree.props.visible,true);assert.equal(tree.type,'Modal');
path='/play/tris';assert.equal(render().props.visible,false);path='/new-visit';assert.equal(render().props.visible,false);path='/';
loaded=false;assert.equal(render().props.visible,false);loaded=true;active=false;assert.equal(render().props.visible,false);active=true;
blocked=true;assert.equal(render().props.visible,false);blocked=false;badges.loading=true;assert.equal(render().props.visible,false);badges.loading=false;badges.unseen=[{}];assert.equal(render().props.visible,false);badges.unseen=[];
tree=render();tree.props.onRequestClose();assert.equal(render().props.visible,false,'Dismissed by continue');states.clear();assert.equal(render().props.visible,false,'No repeat after remount');
owner='b';tree=render();assert.equal(tree.props.visible,true,'Separate account sees its own first access');tree.props.onRequestClose();assert.equal(render().props.visible,false,'Backdrop/back/close acknowledges too');owner='a';assert.equal(render().props.visible,false);
console.log('PASS release notes: unique entries, first access, skipped releases, persistent per-account acknowledgement, storage failure fallback, safe routes, foreground/data readiness, protected work, badge coexistence and close/remount.');

