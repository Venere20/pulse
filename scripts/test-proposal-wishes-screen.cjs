const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const w1='11111111-1111-4111-8111-111111111111',w2='22222222-2222-4222-8222-222222222222';
const bucket=[{id:w1,title:'Museo insieme',category:'experience',is_completed:false},{id:w2,title:'Una serata al cinema',category:'experience',is_completed:false}];
let drafts=new Map(),calls=[],routes=[],clears=[],proposals=[],links=[];
const react={createElement:(type,props,...children)=>({type,props:{...props,children}})};
const data={bucket,userId:'me',partnerId:'partner',today:'2026-10-19',visits:[],refresh:async()=>{}};
const imports={react:{...react,default:react},'react-native':{View:'View'},'expo-router':{router:{push:path=>routes.push(path),replace:path=>routes.push(path)}},
 '../drafts/useDraftField':{drafts:{clearIfUnchanged:(_owner,scope,values)=>clears.push({scope,values})},useDraftField:(scope,key,initial)=>{const name=scope+':'+key;if(!drafts.has(name))drafts.set(name,initial);return[drafts.get(name),value=>drafts.set(name,typeof value==='function'?value(drafts.get(name)):value)];}},
 '../../state/AppData':{useAppDataFields:()=>data},'../../components/MonthCalendar':{MonthCalendar:'Calendar'},'../../ui/primitives':{Button:'Button',Card:'Card',Chip:'Chip',Input:'Input',T:'T'},
 '../FeatureFrame':{FeatureFrame:'Frame',useFeatureAction:()=>({busy:false,run:async(action,after)=>{await action();await after?.();}})},
 '../useFeatureRows':{useFeatureRows:table=>({rows:table==='date_proposals'?proposals:table==='date_proposal_wishes'?links:[],loading:false,error:null,refresh:async()=>{}}),featureRpc:async(name,args)=>{calls.push({name,args});return'proposal-id';}},
 '../../utils/confirm':{confirmAction:async()=>true},'../../hooks/useProgressiveItems':{useProgressiveItems:items=>({visible:items,hasMore:false})},'./ProposalWishPicker':{ProposalWishPicker:'WishPicker'}};
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/proposals/ProposalsScreen.tsx','utf8'),{compilerOptions:{module:1,target:9,jsx:ts.JsxEmit.React}}).outputText,{exports:mod.exports,module:mod,require:name=>{assert.ok(imports[name],name);return imports[name];}});
function nodes(node,result=[]){if(Array.isArray(node))node.forEach(child=>nodes(child,result));else if(node&&typeof node==='object'){result.push(node);nodes(node.props?.children,result);}return result;}
let props={};const render=()=>nodes(mod.exports.ProposalsScreen(props));const get=(type,predicate)=>render().find(node=>node.type===type&&predicate(node.props));
(async()=>{
 get('Button',p=>p.label==='Proponi le date').props.onPress();get('WishPicker',()=>true).props.onChange([w1,w2]);assert.equal(get('Input',p=>p.label==='Titolo').props.value,bucket[0].title);
 get('Calendar',()=>true).props.onPickDay('2026-11-10');await get('Button',p=>p.label==='Invia proposta').props.onPress();
 assert.equal(calls[0].name,'create_date_proposal_with_wishes');assert.deepEqual(calls[0].args.p_wishes,[w1,w2]);assert.equal(routes[0],'/proposte/proposal-id');assert.equal(clears[0].values.wishIds.length,2);
 drafts=new Map();calls=[];props={wish:w1,initialTitle:'Museo'};assert.deepEqual(Array.from(get('WishPicker',()=>true).props.selected),[w1]);get('WishPicker',()=>true).props.onChange([w2]);get('Calendar',()=>true).props.onPickDay('2026-11-11');await get('Button',p=>p.label==='Invia proposta').props.onPress();assert.deepEqual(calls[0].args.p_wishes,[w2],'Legacy entry point respects changed selection');
 drafts=new Map();calls=[];props={id:'proposal-id'};proposals=[{id:'proposal-id',title:'Giornata',status:'open',created_by:'me',bucket_item_id:null}];links=[w1,w2].map(id=>({proposal_id:'proposal-id',bucket_item_id:id}));
 assert.ok(JSON.stringify(render()).includes(bucket[1].title));get('Button',p=>p.label==='Aggiungi o modifica desideri').props.onPress();assert.equal(get('WishPicker',()=>true).props.selected.length,2);get('WishPicker',()=>true).props.onChange([]);await get('Button',p=>p.label==='Salva desideri nella proposta').props.onPress();assert.equal(calls[0].name,'set_proposal_wishes');assert.equal(calls[0].args.p_wishes.length,0);
 proposals[0].status='confirmed';assert.ok(!get('Button',p=>p.label==='Aggiungi o modifica desideri'));
 assert.ok(fs.readFileSync('src/features/useFeatureRows.ts','utf8').includes("date_proposal_wishes: ['proposal_id', 'bucket_item_id']"),'Composite-key pagination supported');
 console.log('PASS proposal screen: multiple selection, title prefill, atomic create payload, draft clearing, legacy wish replacement, shared detail/edit/removal and confirmed-state guard.');
})().catch(error=>{console.error(error);process.exitCode=1;});
