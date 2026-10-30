const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',AA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',BB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
(async()=>{const db=new PGlite();try{
 let setup=fs.readFileSync('scripts/test-feature-database.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1];for(const[k,v]of Object.entries({A,B,AA,BB}))setup=setup.replaceAll('${'+k+'}',v);await db.exec(setup);
 for(const file of fs.readdirSync('supabase/migrations').filter(f=>f.startsWith('20261010')||f.startsWith('20261011')).sort())await db.exec(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));
 const login=uid=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid}';`);
 const emotion=(mood,note='',minutes=120,notify=false)=>db.query('select public.set_my_emotion($1,$2,$3,$4)',[mood,note,minutes,notify]);
 await login(AA);await emotion('happy','Existing mood');
 await db.exec('reset role');await db.exec(fs.readFileSync('supabase/migrations/20261025172808_additional_emotions.sql','utf8'));
 assert.equal((await db.query('select mood from public.emotional_states where id=$1',[A])).rows[0].mood,'happy','Migration keeps existing rows');
 for(const mood of ['annoyed','angry','sorry']){
  await login(AA);await emotion(mood,'Nota facoltativa',30,true);
  await login(BB);const own=(await db.query('select * from public.emotional_states where id=$1',[A])).rows[0];assert.equal(own.mood,mood);assert.equal(own.note,'Nota facoltativa');assert.ok(new Date(own.expires_at)>new Date());
 }
 await db.exec('reset role');assert.equal((await db.query("select count(*)::int as n from public.feature_notifications where tag='emotion'")).rows[0].n,1,'Changing mood does not bypass notification cooldown');
 await login(BB);await emotion('calm','No notification',30,false);await db.exec('reset role');assert.equal((await db.query("select count(*)::int as n from public.feature_notifications where tag='emotion'")).rows[0].n,1);
 await login(AA);await assert.rejects(emotion('invalid'));await assert.rejects(emotion('angry','',1));await assert.rejects(emotion('sorry','x'.repeat(141)));await assert.rejects(db.query('update public.emotional_states set mood=$1 where id=$2',['angry',B]));
 await emotion(null);assert.equal((await db.query('select * from public.emotional_states where id=$1',[A])).rows.length,0,'Own mood can be hidden');
 await emotion('sorry');await db.exec("reset role;update public.emotional_states set expires_at=now()-interval '1 minute' where id='"+A+"'");await login(BB);assert.equal((await db.query('select * from public.emotional_states where id=$1',[A])).rows.length,0,'Expired mood is hidden');
 await login('cccccccc-cccc-4ccc-8ccc-cccccccccccc');assert.equal((await db.query('select * from public.emotional_states')).rows.length,0);await assert.rejects(emotion('annoyed'));
 await db.exec('reset role;set role anon');await assert.rejects(emotion('sorry'));
 console.log('PASS new emotions: accepted values, old row preservation, partner visibility, notes/duration, notification opt-in/cooldown, hide/expiry and outsider/anonymous denial.');
}finally{await db.close()}})().catch(error=>{console.error(error);process.exitCode=1});
