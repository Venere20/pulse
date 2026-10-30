// Exercises the actual Android render branch and callbacks, without a backend.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/features/checkin/CheckinScreen.tsx','utf8');
const before=fs.readFileSync('.private-backups/checkin-v22-20261027/CheckinScreen.tsx','utf8');
assert.equal(source.slice(source.indexOf('export function CheckinReminderSync')),before.slice(before.indexOf('export function CheckinReminderSync')),'Reminder synchronization unchanged');
assert.ok(source.includes('start_checkin_v2')); // Functional contracts are exercised below.
function load(text,stub){const m={exports:{}};vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{module:m,exports:m.exports,require:stub,Date,console,setInterval,clearInterval});return m.exports;}
const model=load(fs.readFileSync('src/features/checkin/model.ts','utf8'),()=>({}));
const A='user-a',B='user-b';
function harness(platform='android'){
 let index=0,slots=[],pending,confirmed=true,busy=false;const calls=[],errors=[],confirms=[];
 const data={rows:[],loading:false,error:null,refresh:async()=>{}},routes={rows:[],loading:false,error:null,refresh:async()=>{}},preferences={rows:[],loading:false,error:null,refresh:async()=>{}};
 const react={useState(initial){const n=index++;if(!(n in slots))slots[n]=typeof initial==='function'?initial():initial;return[slots[n],v=>{slots[n]=typeof v==='function'?v(slots[n]):v;}];},useEffect(){},createElement(type,props,...children){return{type,props:{...props,children}};},Fragment:'Fragment'};
 const rpc=async(name,args={})=>{calls.push({name,args});if(name==='checkin_partner_reachable')return harness.reachable;
 if(name==='save_checkin_route'){const row={...args.p_route,id:args.p_id||'route-1',user_id:A};routes.rows=routes.rows.filter(r=>r.id!==row.id).concat(row);return row.id;}
 if(name==='delete_checkin_route'){routes.rows=routes.rows.filter(r=>r.id!==args.p_id);return;}
 if(name==='start_checkin_v2'){data.rows=[{id:'trip-1',user_id:A,label:args.p_label,departed_at:args.p_departed_at,due_at:new Date(Date.parse(args.p_departed_at)+args.p_minutes*60000).toISOString(),grace_minutes:args.p_grace,status:'active',extensions:0,created_at:new Date().toISOString()}];return'trip-1';}
 if(name==='update_checkin_v2'){const row=data.rows.find(r=>r.id===args.p_id);if(args.p_action==='extend')row.extensions++;else row.status={arrived:'arrived',cancel:'cancelled',resolve:'resolved'}[args.p_action];}
 };
 const stub=name=>name==='react'?react:name==='react-native'?{Platform:{OS:platform},View:'View',ScrollView:'ScrollView'}:name==='expo-router'?{router:{canGoBack:()=>false,replace(){},back(){}}}:name.endsWith('/AppData')?{useAppDataFields:()=>({userId:A,names:{[B]:'Partner'}})}:name.endsWith('/primitives')?Object.fromEntries(['Button','Card','Chip','Input','T'].map(k=>[k,k])):name.endsWith('/layout')?{Screen:'Screen',Header:'Header'}:name.endsWith('/ThemeProvider')?{useTheme:()=>({c:{},r:{lg:22,md:14},s:{xs:4,sm:8,md:12,lg:16,xl:24}})}:name.endsWith('/safeArea')?{useInsets:()=>({top:24,bottom:32})}:name.endsWith('/DateField')?{DateField:'DateField'}:name.endsWith('/FeatureFrame')?{FeatureFrame:'FeatureFrame',useFeatureAction:()=>({busy,run(action,after){pending=(async()=>{try{await action();await after?.();}catch(e){errors.push(e.message);}})();return pending;}})}:name.endsWith('/useFeatureRows')?{useFeatureRows:table=>table==='safe_checkins'?data:table==='feature_preferences'?preferences:routes,featureRpc:rpc}:name.endsWith('/confirm')?{confirmAction:async(...args)=>{confirms.push(args);return confirmed;}}:name.endsWith('/useActivity')?{useScreenActive:()=>true}:name==='./model'?model:{syncCheckinReminder(){}};
 const screen=load(source,stub);
 const render=()=>{index=0;return screen.CheckinScreen();};
 const walk=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(walk):[node,...walk(node.props?.children)];
 const all=()=>walk(render());
 const find=(type,label)=>{const nodes=all().filter(n=>n.type===type&&n.props.label===label);assert.equal(nodes.length,1,`${type}: ${label}`);return nodes[0].props;};
 return{data,routes,preferences,calls,errors,confirms,render,all,find,setConfirm:v=>confirmed=v,setBusy:v=>busy=v,async click(label,type='Button'){const p=find(type,label);assert.ok(!p.disabled,label+' enabled');p.onPress();await pending;},input(label,value){find('Input',label).onChangeText(value);}};
}
harness.reachable=true;
(async()=>{
 const limit=harness();limit.data.rows=[{id:'limit',user_id:A,label:'Lungo',status:'active',extensions:0,departed_at:new Date().toISOString(),created_at:new Date().toISOString(),due_at:new Date(Date.now()+12*3600000).toISOString(),grace_minutes:10}];
 for(const label of ['+15 min','+30 min','+60 min'])assert.equal(limit.find('Button',label).disabled,true);
 const prefs=harness();prefs.preferences.rows=[{checkin_grace_minutes:15}];await prefs.click('Nuovo tragitto o viaggio singolo');assert.equal(prefs.all().filter(n=>n.type==='Chip'&&n.props.label==='15 min').at(-1).props.selected,true);await prefs.click('Chiudi preparazione');prefs.preferences.rows=[{checkin_grace_minutes:30}];await prefs.click('Nuovo tragitto o viaggio singolo');assert.equal(prefs.all().filter(n=>n.type==='Chip'&&n.props.label==='30 min').at(-1).props.selected,true);
 const unnamed=harness();await unnamed.click('Nuovo tragitto o viaggio singolo');unnamed.input('Destinazione','Casa');await unnamed.click('Salva o modifica le preferenze');await unnamed.click('Aggiungi ai preferiti','Chip');
 assert.equal(unnamed.find('Button','Salva tragitto').disabled,false,'Destination is sufficient to save a favorite route');
 await unnamed.click('Salva tragitto');assert.equal(unnamed.routes.rows[0].name,'Casa');assert.equal(unnamed.routes.rows[0].favorite,true);
 assert.ok(unnamed.all().some(n=>n.type==='Button'&&n.props.label==='Scegli questo tragitto'),'Saved route is immediately visible');
 const h=harness();assert.equal(h.render().type,'Screen');assert.equal(h.all().filter(n=>n.type==='Button'&&n.props.label==='Avvia questo viaggio').length,0);
 await h.click('Nuovo tragitto o viaggio singolo');h.input('Destinazione','Napoli Centrale');h.input('Oppure inserisci i minuti (5–720)','45');
 assert.equal(h.find('Button','Avvia questo viaggio').disabled,false);
 await h.click('Modifica');h.find('DateField','Giorno di partenza').onChange(new Date().toLocaleDateString('sv-SE'));h.input('Ora di partenza (HH:MM)',new Date(Date.now()-5*60000).toTimeString().slice(0,5));
 await h.click('Aggiungi una nota facoltativa');h.input('Nota sul viaggio','In treno');assert.equal(h.find('Input','Nota sul viaggio').maxLength,200);
 await h.click('Salva o modifica le preferenze');h.input('Nome del tragitto','Verso Napoli');h.input('Partenza facoltativa','Ischia');h.input('Ordine nell’elenco (0–9999)','3');await h.click('Preferito ★'.replace('Preferito ★','Aggiungi ai preferiti'),'Chip');await h.click('Avvio con riepilogo','Chip');await h.click('Salva tragitto');
 assert.equal(h.routes.rows[0].favorite,true);assert.equal(h.routes.rows[0].quick_start,true);assert.equal(h.routes.rows[0].position,3);
 await h.click('Modifica');await h.click('Modifica');h.input('Ora di partenza (HH:MM)',new Date(Date.now()-5*60000).toTimeString().slice(0,5));await h.click('Avvia questo viaggio');assert.equal(h.data.rows[0].status,'active');const start=h.calls.find(c=>c.name==='start_checkin_v2').args;assert.equal(start.p_note,'In treno');assert.ok(Date.parse(start.p_departed_at)<Date.now()-4*60000);
 const footer=h.all().find(n=>n.type==='Button'&&n.props.label==='Sono arrivato/a');assert.ok(footer);await h.click('+15 min');await h.click('+30 min');await h.click('+60 min');assert.equal(h.data.rows[0].extensions,3);
 h.data.rows[0].extensions=5;assert.equal(h.find('Button','+15 min').disabled,true);h.data.rows[0].status='alerted';h.data.rows[0].extensions=0;await h.click('+15 min');await h.click('Sono arrivato/a');assert.equal(h.data.rows[0].status,'arrived');
 await h.click('Parti ora');assert.equal(h.calls.filter(c=>c.name==='start_checkin_v2').at(-1).args.p_note,'In treno');
 h.setConfirm(false);await h.click('Annulla questo viaggio');assert.equal(h.data.rows[0].status,'active');h.setConfirm(true);await h.click('Annulla questo viaggio');assert.equal(h.data.rows[0].status,'cancelled');
 await h.click('I tuoi tragitti (1)').catch(()=>{}); // route section may already be open
 if(!h.all().some(n=>n.type==='Button'&&n.props.label==='Duplica'))await h.click('I tuoi tragitti (1)');
 await h.click('Duplica');await h.click('Salva o modifica le preferenze');assert.equal(h.find('Input','Nome del tragitto').value,'Verso Napoli · copia');await h.click('Chiudi preparazione');
 if(!h.all().some(n=>n.type==='Button'&&n.props.label==='Modifica'))await h.click('I tuoi tragitti (1)');
 await h.click('Modifica');h.input('Oppure inserisci i minuti (5–720)','60');await h.click('Avvia questo viaggio');assert.equal(h.routes.rows[0].minutes,45);
 await h.click('Sono arrivato/a');await h.click('Ultimi check-in (1)');
 h.data.rows=[{id:'same-1',label:'Casa',status:'arrived',created_at:new Date().toISOString()},{id:'same-2',label:'Casa',status:'cancelled',created_at:new Date().toISOString()}];assert.equal(h.all().filter(n=>n.type==='View'&&['same-1','same-2'].includes(n.props.key)).length,2);
 h.data.rows=[{id:'partner-trip',user_id:B,label:'Casa',status:'alerted',due_at:new Date().toISOString(),grace_minutes:10}];await h.click('Ho verificato: tutto bene');assert.equal(h.data.rows[0].status,'resolved');
 await h.click('Come funzionano gli avvisi');await h.click('Prova una notifica sul mio dispositivo');assert.ok(h.calls.some(c=>c.name==='test_checkin_notification'));
 const fresh=harness();await fresh.click('Nuovo tragitto o viaggio singolo');fresh.input('Destinazione','Casa');harness.reachable=false;fresh.setConfirm(false);await fresh.click('Avvia questo viaggio');assert.equal(fresh.calls.filter(c=>c.name==='start_checkin_v2').length,0);fresh.setConfirm(true);await fresh.click('Avvia questo viaggio');assert.equal(fresh.calls.at(-1).args.p_allow_unreachable,true);harness.reachable=true;
 const future=harness();await future.click('Nuovo tragitto o viaggio singolo');future.input('Destinazione','Casa');await future.click('Modifica');
 const plannedAt=new Date(Date.now()+17*60000);future.find('DateField','Giorno di partenza').onChange(plannedAt.toLocaleDateString('sv-SE'));future.input('Ora di partenza (HH:MM)',plannedAt.toTimeString().slice(0,5));
 await future.click('Avvia questo viaggio');assert.equal(future.errors.length,0);assert.ok(future.calls.some(c=>c.name==='start_checkin_v2'));assert.ok(future.all().some(n=>n.type==='T'&&n.props.children.includes('◷ PARTENZA PREVISTA')));
 const invalid=harness();await invalid.click('Nuovo tragitto o viaggio singolo');invalid.input('Destinazione','Casa');invalid.input('Oppure inserisci i minuti (5–720)','721');assert.equal(invalid.find('Button','Avvia questo viaggio').disabled,true);
 const web=harness('web');assert.equal(web.render().type,'Screen');h.data.error='offline';assert.equal(h.render().type,'FeatureFrame');
 assert.deepEqual(h.errors,[]);console.log('PASS Android V2.2 component: form, departure, note, preferences, quick start, duplication, immutable route, history, arrival, extensions/limit, cancellation/confirm, partner resolve, notification test, reachability and fallback. Reminder unchanged; favorite saving without a custom name and immediate visibility verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
