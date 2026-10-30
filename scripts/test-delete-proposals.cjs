const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const{PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',AA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',BB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
(async()=>{const db=new PGlite();try{
 let setup=fs.readFileSync('scripts/test-feature-database.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1];for(const[k,v]of Object.entries({A,B,AA,BB}))setup=setup.replaceAll('${'+k+'}',v);await db.exec(setup);await db.exec("set timezone='UTC'");
 for(const f of fs.readdirSync('supabase/migrations').filter(f=>f.startsWith('20261010')||f.startsWith('20261011')).sort())await db.exec(fs.readFileSync(path.join('supabase/migrations',f),'utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261017120000_delete_date_proposals.sql','utf8'));
 const login=uid=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid}';`);
 const remove=id=>db.query('select public.delete_date_proposal($1)',[id]);
 const create=async()=>(await db.query("select public.create_date_proposal('Date da scegliere','','',jsonb_build_array(jsonb_build_object('start_date',current_date+30,'end_date',current_date+31))) id")).rows[0].id;
 await login(AA);const id=await create();const option=(await db.query('select id from public.date_options where proposal_id=$1',[id])).rows[0].id;await db.query("select public.vote_date_option($1,'yes')",[option]);
 await login(BB);await db.query("select public.vote_date_option($1,'yes')",[option]);
 await login('cccccccc-cccc-4ccc-8ccc-cccccccccccc');await assert.rejects(remove(id));await db.exec('reset role;set role anon;');await assert.rejects(remove(id));
 await login(BB);await remove(id);assert.equal((await db.query('select id from public.date_proposals where id=$1',[id])).rows.length,0);assert.equal((await db.query('select id from public.date_options where proposal_id=$1',[id])).rows.length,0);assert.equal((await db.query('select option_id from public.date_votes where option_id=$1',[option])).rows.length,0);
 await remove(id);await assert.rejects(remove(null));
 await db.exec('reset role;');assert.equal((await db.query("select id from public.feature_notifications where url=$1 and delivered_at is null",['/proposte/'+id])).rows.length,0);
 for(const status of ['cancelled','expired','confirmed']){
  await login(AA);const pid=await create();await db.exec('reset role;');
  const visit=(await db.query("insert into public.visits(title,start_date,end_date,created_by,status)values('Incontro da conservare',current_date+30,current_date+31,$1,'planned')returning id",[A])).rows[0].id;
  const wish=(await db.query('insert into public.bucket_list(id,is_completed)values(gen_random_uuid(),false)returning id')).rows[0].id;
  await db.query('update public.date_proposals set status=$1,visit_id=$2,bucket_item_id=$3 where id=$4',[status,visit,wish,pid]);
  await login(AA);await remove(pid);assert.equal((await db.query('select id from public.visits where id=$1',[visit])).rows.length,1);assert.equal((await db.query('select id from public.bucket_list where id=$1',[wish])).rows.length,1);
  if(status==='confirmed')assert.equal((await db.query('select * from public.visit_bucket_items where visit_id=$1 and bucket_item_id=$2',[visit,wish])).rows.length,1,'Confirmed wish/visit link survives');
 }
 console.log('PASS proposal deletion: both partners, open/cancelled/expired/confirmed states, options/votes cascades, visit and wish preserved, pending alerts removed, repeated deletion, null/outsider/anonymous rejected.');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
