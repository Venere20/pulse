const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const{PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',AA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',BB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
(async()=>{const db=new PGlite();try{
 let setup=fs.readFileSync('scripts/test-feature-database.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1];for(const[k,v]of Object.entries({A,B,AA,BB}))setup=setup.replaceAll('${'+k+'}',v);await db.exec(setup);
 for(const f of fs.readdirSync('supabase/migrations').filter(f=>f.startsWith('20261010')||f.startsWith('20261011')).sort())await db.exec(fs.readFileSync(path.join('supabase/migrations',f),'utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261017130000_persistent_canvas.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261025172805_canvas_expanded_palette.sql','utf8'));
 const login=uid=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid}';`);
 const stroke=(author,id,points=[10,20])=>({id:author+':'+id,author,color:'#FF4D85',width:6,brush:'ink',points,ephemeral:false});
 const apply=async(epoch,action,s=null,id=null)=>(await db.query('select (public.apply_canvas_board($1,$2,$3,$4)).*',[epoch,action,s,id])).rows[0];
 const read=async()=>(await db.query('select * from public.canvas_current')).rows[0];
 await login(AA);let s=stroke(A,'one');let b=await apply(1,'put',s);assert.equal(b.strokes.length,1);
 await login(BB);assert.deepEqual((await read()).strokes,[s],'Partner arriving later sees the saved board');assert.equal((await db.query('select * from public.canvas_drawings')).rows.length,0,'Autosave never adds gallery entries');
 b=await apply(1,'put',stroke(B,'two'));assert.equal(b.strokes.length,2);
 await assert.rejects(apply(1,'put',s));await assert.rejects(apply(1,'undo',null,s.id));await assert.rejects(db.query("update public.canvas_current set strokes='[]'"));
 await login(AA);const longer=stroke(A,'one',[10,20,30,40]);b=await apply(1,'put',longer);const rev=b.revision;b=await apply(1,'put',s);assert.equal(b.revision,rev);assert.deepEqual(b.strokes.find(v=>v.id===s.id).points,longer.points);
 await assert.rejects(apply(1,'put',stroke(A,'one',[10,21,30,40])));
 for(const bad of [{...stroke(A,'bad'),points:[-1,0]},{...stroke(A,'bad'),points:[1]},{...stroke(A,'bad'),author:B},{...stroke(A,'bad'),ephemeral:true},{...stroke(A,'bad'),color:'red'}])await assert.rejects(apply(1,'put',bad));
 b=await apply(1,'undo',null,s.id);assert.equal(b.strokes.length,1);b=await apply(1,'put',longer);assert.equal(b.strokes.length,1,'Late put cannot resurrect an undone stroke');
 b=await apply(1,'clear');assert.equal(b.epoch,2);assert.equal(b.strokes.length,0);b=await apply(1,'put',s);assert.equal(b.strokes.length,0,'Offline old epoch cannot resurrect cleared board');
 b=await apply(2,'put',s);assert.equal(b.strokes.length,1);await db.query('select public.save_canvas($1,$2)',[[s],'Manual gallery']);assert.equal((await db.query('select * from public.canvas_drawings')).rows.length,1);
 const colors=[...fs.readFileSync('src/features/canvas/protocol.ts','utf8').matchAll(/color: '(#[0-9A-F]{6})'/g)].map(m=>m[1]);assert.equal(colors.length,24);
 for(const [i,color]of colors.entries()){
  const colored={...stroke(A,'color'+i),color,brush:i%2?'neon':'ink'};
  assert.ok((await apply(2,'put',colored)).strokes.some(s=>s.color===color));
  await db.query('select public.save_canvas($1,$2)',[[colored],'Palette test']);
 }
 await assert.rejects(db.query('select public.save_canvas($1,$2)',[[{...s,color:'red'}],'Invalid color']));
 await apply(2,'clear');for(let i=0;i<60;i++)await apply(3,'put',stroke(A,'limit'+i));await assert.rejects(apply(3,'put',stroke(A,'overflow')));
 await apply(3,'clear');await apply(4,'put',stroke(A,'full',Array(6000).fill(1)));await assert.rejects(apply(4,'put',stroke(A,'overflow')));
 await login('cccccccc-cccc-4ccc-8ccc-cccccccccccc');assert.equal((await db.query('select * from public.canvas_current')).rows.length,0);await assert.rejects(apply(4,'clear'));await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.canvas_current'));await assert.rejects(apply(4,'clear'));
 console.log('PASS durable canvas database: absent partner, gallery separation, ownership/RLS, append-only retries, undo tombstones, clear epochs, malformed strokes, capacity and outsider/anonymous denial');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
