const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,require){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require});return m.exports}
const protocol=load('src/features/canvas/protocol.ts',()=>{}),{createPersistentBoard}=load('src/features/canvas/persistentBoard.ts',()=>protocol);
const clone=x=>JSON.parse(JSON.stringify(x)),stroke=(author,id,points=[1,2])=>({id:author+':'+id,author,points,color:'#FF4D85',width:6,brush:'ink',ephemeral:false});
(async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 let server={id:1,epoch:1,revision:0,strokes:[],deleted_ids:[]},online=true,hold=null,gate=null;
 const apply=async op=>{if(!online)throw Error('offline');if(gate){const p=gate;gate=null;await p}if(op.epoch!==server.epoch)return clone(server);if(op.action==='clear'){server={...server,epoch:server.epoch+1,revision:server.revision+1,strokes:[],deleted_ids:[]}}else if(op.action==='undo'){server.strokes=server.strokes.filter(s=>s.id!==op.id);server.deleted_ids.push(op.id);server.revision++}else if(!server.deleted_ids.includes(op.stroke.id)){const old=server.strokes.find(s=>s.id===op.stroke.id);if(!old||old.points.length<=op.stroke.points.length){server.strokes=server.strokes.filter(s=>s.id!==op.stroke.id).concat(clone(op.stroke));server.revision++}}return clone(server)};
 let board=createPersistentBoard('a','b',storage,apply);board.receive(clone(server));online=false;board.put(stroke('a','one'));await board.flush();assert.equal(board.view().pending,true);assert.equal(board.view().localSaved,true);
 board=createPersistentBoard('a','b',storage,apply);assert.equal(board.view().strokes.length,1,'Offline reload restores queued drawing');online=true;await board.flush();assert.equal(server.strokes.length,1);assert.equal(board.view().pending,false);
 const partner=createPersistentBoard('b','a',storage,apply);partner.receive(clone(server));assert.equal(partner.view().strokes.length,1,'Partner can arrive after author left');
 gate=new Promise(r=>hold=r);board.put(stroke('a','one',[1,2,3,4]));board.put(stroke('a','one',[1,2,3,4,5,6]));hold();await board.flush();assert.equal(server.strokes[0].points.length,6,'In-flight ack does not discard newer points');
 board.undo('a:one');await board.flush();board.put(stroke('a','one'));await board.flush();assert.equal(server.strokes.length,0);
 online=false;board.clear();board.put(stroke('a','new'));await board.flush();board=createPersistentBoard('a','b',storage,apply);online=true;await board.flush();assert.equal(server.epoch,2);assert.equal(server.strokes[0].id,'a:new');
 online=false;board.put(stroke('a','stale'));await board.flush();server={...server,epoch:3,revision:server.revision+1,strokes:[],deleted_ids:[]};board.receive(clone(server));online=true;await board.flush();assert.equal(board.view().strokes.length,0,'Remote clear drops offline old operations');
 assert.equal(createPersistentBoard('other','b',storage,apply).view().ready,false,'Account cache isolated');
 const broken=createPersistentBoard('a','b',{getItem:()=>null,setItem:()=>{throw Error('full')},removeItem(){}},apply);broken.put(stroke('a','unsaved'));assert.equal(broken.view().localSaved,false);assert.equal(broken.view().pending,true);
 const fresh=createPersistentBoard('c','d',storage,apply);fresh.put(stroke('c','before-load'));assert.equal(fresh.view().ready,false);fresh.receive(clone(server));await fresh.flush();assert.equal(server.strokes[0].author,'c');
 console.log('PASS durable canvas outbox: offline reload/retry, late partner, concurrent checkpoints, undo, offline clear and new strokes, remote clear, owner isolation and storage failure');
})().catch(e=>{console.error(e);process.exitCode=1});
