const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const mod={exports:{}};cache.set(file,mod.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:9}}).outputText,{exports:mod.exports,module:mod,require:name=>load(path.resolve(path.dirname(file),name+'.ts'))});return mod.exports;}
const logic=load('src/features/sologames/logic.ts'),stars=load('src/features/sologames/stars.ts');
let state=stars.newSky(),confirmed=false;const update=value=>{state=typeof value==='function'?value(state):value;};
const react={createElement:(type,props,...children)=>({type,props:{...props,children}})};
const imports={react:{...react,default:react},'react-native':{TouchableOpacity:'TouchableOpacity',View:'View'},'react-native-svg':{default:'Svg',Polyline:'Polyline'},
 '../../ui/primitives':{Button:'Button',Card:'Card',T:'T'},'../../theme/ThemeProvider':{useTheme:()=>({c:{primary:'pink',primarySoft:'purple',warning:'gold'}})},
 '../FeatureFrame':{FeatureFrame:'FeatureFrame'},'./logic':logic,'./stars':stars,'./localState':{useLocalGame:()=>({state,setState:update})},'../../utils/confirm':{confirmAction:async()=>confirmed}};
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/sologames/StarsScreen.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:ts.JsxEmit.React}}).outputText,{exports:mod.exports,module:mod,require:name=>{assert.ok(imports[name],name);return imports[name];}});
function nodes(node,result=[]){if(Array.isArray(node))node.forEach(child=>nodes(child,result));else if(node&&typeof node==='object'){result.push(node);nodes(node.props?.children,result);}return result;}
function render(){return nodes(mod.exports.StarsScreen());}
(async()=>{
 for(let level=0;level<206;level++){
  const count=logic.CONSTELLATIONS[state.order[state.index]].points.length;
  for(let i=0;i<count;i++){
   const targets=render().filter(node=>node.type==='TouchableOpacity'&&!node.props.disabled);assert.equal(targets.length,1,'Exactly one reachable current star');
   const target=targets[0];assert.equal(target.props.accessibilityLabel,'Stella '+(i+1));assert.equal(target.props.style.zIndex,2,'Current star above overlapping touch targets');
   target.props.onPress();const after=state;target.props.onPress();assert.strictEqual(state,after,'Rapid double taps do not advance another star');
  }
  const buttons=render().filter(node=>node.type==='Button');
  if(level<205)buttons.find(button=>button.props.label==='Prossima costellazione').props.onPress();
  else {assert.ok(!buttons.some(button=>button.props.label==='Prossima costellazione'));const restart=buttons.find(button=>button.props.label==='Inizia una nuova partita');const old=state;await restart.props.onPress();assert.strictEqual(state,old,'Cancelled restart preserves completed game');confirmed=true;await restart.props.onPress();assert.equal(state.index,0);assert.equal(state.next,0);assert.equal(state.completed,206);}
 }
 console.log('PASS stars screen: all 206 drawings playable, repeated coordinates and rapid taps safe, active target on top, explicit confirmed new game only.');
})().catch(error=>{console.error(error);process.exitCode=1;});
