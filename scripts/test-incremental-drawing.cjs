const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
function load(path,mocks={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:name=>mocks[name]});return m.exports;}
(async()=>{const logic=load('src/features/partnergames/drawingPatch.ts',{'../../state/dataStore':load('src/state/dataStore.ts')});
 const stroke=i=>({id:'s'+i,author:A,color:'#FF4D85',width:6,brush:'ink',points:[10,20,30,40]});const before=Array.from({length:40},(_,i)=>stroke(i)),after=[...before,stroke(40)];
 const patch=logic.drawingPatch(before,after,7);assert.equal(patch.keep_count,40);assert.equal(patch.strokes.length,1);assert.equal(patch.drawing_revision,7);assert.equal(logic.drawingPatch(before,structuredClone(before),7),null);
 const undo=logic.drawingPatch(after,before,8);assert.equal(undo.keep_count,40);assert.equal(undo.strokes.length,0);patch.strokes[0].points.push(99,99);assert.equal(after[40].points.length,4);
 const metrics={fullBytes:Buffer.byteLength(JSON.stringify({strokes:after,drawing_revision:7})),patchBytes:Buffer.byteLength(JSON.stringify(logic.drawingPatch(before,after,7))),undoBytes:Buffer.byteLength(JSON.stringify(undo))};assert.ok(metrics.patchBytes<metrics.fullBytes/10);
 const db=new PGlite();try{
  const setup=fs.readFileSync('scripts/test-partner-games.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${A}',A).replaceAll('${B}',B);await db.exec(setup);
  for(const file of ['20261013100000_partner_games.sql','20261013110000_incremental_drawing.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
  const login=async id=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`);
  await login(A);const id=(await db.query("select public.start_partner_game('drawguess') as id")).rows[0].id;
  const row=async()=>(await db.query('select * from public.partner_games where id=$1',[id])).rows[0];
  const apply=async(user,revision,keep,strokes)=>{await login(user);return db.query('select public.patch_partner_drawing($1,$2,$3,$4)',[id,revision,keep,JSON.stringify(strokes)]);};
  await apply(A,0,0,[stroke(0)]);assert.equal((await row()).state.drawing_revision,1);
  await assert.rejects(apply(B,1,1,[{...stroke(1),author:B}]));await assert.rejects(apply(A,0,1,[stroke(1)]));
  await assert.rejects(apply(A,1,2,[stroke(1)]));await assert.rejects(apply(A,1,-1,[]));await assert.rejects(apply(A,1,1,[{...stroke(1),points:[10,1001]}]));
  await apply(A,1,1,[stroke(1)]);assert.deepEqual((await row()).state.strokes,[stroke(0),stroke(1)]);
  const revision=(await row()).state.drawing_revision;await login(B);await db.query("select public.play_partner_game($1,'guess',$2,$3)",[id,JSON.stringify({guess:'sbagliato'}),(await row()).revision]);
  await apply(A,revision,2,[stroke(2)]);let current=await row();assert.deepEqual(current.state.guesses,['sbagliato']);assert.equal(current.state.strokes.length,3);assert.equal(current.state.answer,undefined);
  await apply(A,current.state.drawing_revision,1,[]);current=await row();assert.deepEqual(current.state.strokes,[stroke(0)]);
  await assert.rejects(apply(A,current.state.drawing_revision,1,Array.from({length:60},(_,i)=>stroke(i+1))));
  await assert.rejects(apply(A,current.state.drawing_revision,1,[{...stroke(2),points:Array(6002).fill(0)}]));
  assert.deepEqual((await row()).state.strokes,[stroke(0)]);
  // Old clients remain compatible; next incremental request observes their revision.
  await login(A);await db.query("select public.play_partner_game($1,'draw',$2,$3)",[id,JSON.stringify({drawing_revision:current.state.drawing_revision,strokes:[stroke(0),stroke(3)]}),current.revision]);
  current=await row();await apply(A,current.state.drawing_revision,2,[stroke(4)]);assert.equal((await row()).state.strokes.length,3);
  await assert.rejects(apply('33333333-3333-4333-8333-333333333333',(await row()).state.drawing_revision,0,[]));
  await db.exec('reset role;set role anon;');await assert.rejects(db.query('select public.patch_partner_drawing($1,0,0,\'[]\')',[id]));
  await login(A);current=await row();await db.query("select public.play_partner_game($1,'reveal','{}',$2)",[id,current.revision]);await assert.rejects(apply(A,(await row()).state.drawing_revision,0,[]));
  fs.writeFileSync('.feature-build/drawing-patch-metrics.json',JSON.stringify(metrics,null,2));console.log('PASS drawing patch sizes, immutable snapshots, append/undo, stale/invalid requests, independent guesses, limits, legacy clients and access control:',metrics);
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
