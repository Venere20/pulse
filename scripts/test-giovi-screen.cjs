// Exercise the actual screen handlers and lifecycle without a native device.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let slots=[],cursor=0,effects=[],dirty=true,tree,active=true,pending=null;
const calls=[],timers=new Set();
const hooks={
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;if(!Object.is(next,slots[i])){slots[i]=next;dirty=true;}}];},
 useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},
 useCallback(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j])))slots[i]={fn,deps};return slots[i].fn;},
 useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j])))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
 createElement(type,props,...children){return{type,props:{...props,children}};}
};
const rpc=async(name,args)=>{calls.push(args);if(pending&&args.p_action==='open')return pending;
 if(args.p_action==='status')return{data:{ok:true,configured:true}};
 if(args.p_password!=='shared-secret')return{data:{ok:false,code:'password',error:'Password non corretta'}};
 return{data:{ok:true,entries:[{id:'test-entry',title:'Titolo protetto',body:'Corpo protetto',version:1}]}};};
const imports={react:{...hooks,default:hooks},'react-native':{View:'View'},'expo-router':{router:{canGoBack:()=>false,replace:()=>{},back:()=>{}}},
 '../../config/supabase':{supabase:{rpc}},'../../state/Auth':{useAuth:()=>({profile:{id:'account-1'}})},
 '../../hooks/useActivity':{useScreenActive:()=>active},'../../theme/ThemeProvider':{useTheme:()=>({s:{sm:8,md:16}})},
 '../../ui/layout':{Screen:'Screen',Header:'Header'},'../../ui/primitives':{Button:'Button',Card:'Card',Input:'Input',T:'T'},
 '../../utils/confirm':{confirmAction:async()=>true}};
const moduleObject={exports:{}};
const compiled=ts.transpileModule(fs.readFileSync('src/features/giovi/GioviScreen.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(compiled,{exports:moduleObject.exports,require:name=>{assert.ok(imports[name],name);return imports[name];},setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn)});
const Screen=moduleObject.exports.GioviScreen;
function render(){cursor=0;dirty=false;tree=Screen();const queued=effects;effects=[];queued.forEach(effect=>effect());}
async function settle(){for(let i=0;i<12;i++){if(dirty)render();await Promise.resolve();}}
function nodes(node=tree,result=[]){if(Array.isArray(node))node.forEach(n=>nodes(n,result));else if(node&&typeof node==='object'){result.push(node);nodes(node.props?.children,result);}return result;}
const input=label=>nodes().find(n=>n.type==='Input'&&n.props.label===label);
const button=label=>nodes().find(n=>n.type==='Button'&&n.props.label===label);
async function open(){input('Password condivisa').props.onChangeText('shared-secret');await settle();await button('Apri le perle').props.onPress();await settle();assert.ok(button('Blocca lo spazio'));}
(async()=>{
 await settle();assert.ok(button('Apri le perle'));assert.equal(input('Password condivisa').props.secureTextEntry,true);
 await open();await button('Ricarica le perle').props.onPress();await settle();
 input('Titolo').props.onChangeText('Nuova perla');await settle();await button('Salva perla').props.onPress();await settle();
 assert.equal(calls.at(-1).p_action,'save');assert.equal(calls.at(-1).p_password,'shared-secret');
 active=false;dirty=true;await settle();assert.ok(!button('Blocca lo spazio'));assert.ok(!JSON.stringify(tree).includes('Corpo protetto'));
 active=true;dirty=true;await settle();assert.equal(input('Password condivisa').props.value,'');await open();
 [...timers].forEach(fn=>fn());await settle();assert.ok(button('Apri le perle'));assert.ok(!JSON.stringify(tree).includes('Corpo protetto'));
 let resolve;pending=new Promise(r=>{resolve=r;});input('Password condivisa').props.onChangeText('shared-secret');await settle();button('Apri le perle').props.onPress();await settle();
 active=false;dirty=true;await settle();resolve({data:{ok:true,entries:[{id:'late',title:'RISPOSTA TARDIVA',body:'segreto',version:1}]}});await settle();
 active=true;dirty=true;await settle();assert.ok(button('Apri le perle'));assert.ok(!JSON.stringify(tree).includes('RISPOSTA TARDIVA'));
 console.log('PASS Giovi screen: hidden password, open, refresh retains secret for save, background lock, timeout lock and late-response isolation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
