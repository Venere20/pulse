const fs=require('node:fs'),assert=require('node:assert/strict');const{PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',AA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',BB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
(async()=>{const db=new PGlite();try{
 const setup=fs.readFileSync('scripts/test-feature-database.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${A}',A).replaceAll('${B}',B).replaceAll('${AA}',AA).replaceAll('${BB}',BB);await db.exec(setup);
 await db.exec(fs.readFileSync('supabase/migrations/20261010100000_feature_foundations.sql','utf8'));await db.exec("create function public.queue_feature_notification(uuid,text,text,text,text)returns void language sql as $$select$$;");await db.exec(fs.readFileSync('supabase/migrations/20261010120000_deep_talk.sql','utf8'));
 // Exercise backfill for a legacy response before installing the new transport.
 const weeks=(await db.query("select date_trunc('week',now() at time zone 'Europe/Rome')::date::text as current,(date_trunc('week',now() at time zone 'Europe/Rome')::date-7)::text as previous")).rows[0];
 const decks=['valori-01','obiettivi-01','convivenza-01','soldi-01','famiglia-01','fiducia-01','gratitudine-01','limiti-01','affetto-01','distanza-01','sogni-01','ricordi-01'];const deck=week=>decks[((Math.round((Date.parse(week)-Date.parse('2026-01-05'))/604800000)%12)+12)%12];
 const login=(who,role='authenticated')=>db.exec(`reset role;set role ${role};set request.jwt.claim.sub='${who}';`);
 const rpc=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})as value`,args)).rows[0].value;
 const action=(week,q,kind,body=null)=>rpc('deep_talk_action_state',[week,q,deck(week),kind,body]);
 await login(AA);await rpc('deep_talk_action',[weeks.previous,0,deck(weeks.previous),'answer','legacy private']);
 await db.exec('reset role');await db.exec(fs.readFileSync('supabase/migrations/20261013150000_deep_talk_state.sql','utf8'));
 await login(BB);let s=await rpc('deep_talk_snapshot',[weeks.previous]);assert.equal(s.revision,0);assert.equal(s.marks.length,1);assert.deepEqual(s.answers,[],'Backfill cannot disclose the legacy private answer');
 await login(AA);s=await action(weeks.current,0,'answer','mine');assert.equal(s.answers.length,1);assert.equal(s.answers[0].body,'mine');assert.equal(s.revision,2);assert.equal(s.marks.length,2,'Metadata history retained');
 await login(BB);s=await rpc('deep_talk_snapshot',[weeks.current]);assert.deepEqual(s.answers,[]);await assert.rejects(action(weeks.current,0,'react','heart'));
 s=await action(weeks.current,0,'answer','partner');assert.equal(s.revision,4);assert.equal(s.answers.length,2);assert.deepEqual(s.answers.map(a=>a.body).sort(),['mine','partner']);
 s=await action(weeks.current,0,'react','heart');assert.equal(s.answers.find(a=>a.user_id===A).reaction,'heart');assert.equal(s.revision,5);s=await action(weeks.current,0,'discussed');assert.equal(s.revision,7);assert.ok(s.marks.filter(m=>m.week_start===weeks.current).every(m=>m.discussed_at));
 s=await action(weeks.current,0,'delete');assert.equal(s.revision,9);assert.deepEqual(s.answers,[],'Deleting my answer immediately revokes partner visibility in the returned snapshot');assert.equal(s.marks.filter(m=>m.week_start===weeks.current).length,1);
 await login(AA);s=await rpc('deep_talk_snapshot',[weeks.current]);assert.equal(s.answers.length,1);assert.equal(s.answers[0].body,'mine');await assert.rejects(action(weeks.current,0,'react','hug'));
 await login(BB);s=await action(weeks.current,1,'skip');assert.equal(s.revision,10);assert.deepEqual(s.answers,[]);await rpc('deep_talk_action',[weeks.current,1,deck(weeks.current),'delete',null]);s=await rpc('deep_talk_snapshot',[weeks.current]);assert.equal(s.revision,11,'Old clients also advance the transport version');
 await assert.rejects(db.query('update public.deep_talk_versions set revision=0'));await assert.rejects(db.query('insert into public.deep_talk_versions values(current_date,0)'));await assert.rejects(db.query('delete from public.deep_talk_versions'));
 await assert.rejects(rpc('deep_talk_snapshot',['2026-01-06']));await assert.rejects(action(weeks.current,0,'answer',''));
 await login('cccccccc-cccc-4ccc-8ccc-cccccccccccc');await assert.rejects(rpc('deep_talk_snapshot',[weeks.current]));await assert.rejects(action(weeks.current,0,'delete'));
 await login(AA,'anon');await assert.rejects(rpc('deep_talk_snapshot',[weeks.current]));await assert.rejects(action(weeks.current,0,'answer','anonymous'));
 await db.exec('reset role');const permissions=(await db.query("select proname,prosecdef from pg_proc where proname in ('deep_talk_snapshot','deep_talk_action_state') order by proname")).rows;assert.ok(permissions.every(p=>p.prosecdef===false));
 console.log('PASS Deep Talk state: invoker RLS, atomic unlock/reaction/discussion/delete, private answers revoked, historical metadata/backfill, rollback on errors, old clients, monotonic counters and no client counter writes.');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
