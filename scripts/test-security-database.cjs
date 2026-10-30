const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',AA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',BB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
(async()=>{const db=new PGlite();try{
 const source=fs.readFileSync('scripts/test-feature-database.cjs','utf8');
 let setup=source.match(/await db.exec\(`([\s\S]*?)`\);/)[1];
 for(const [key,value]of Object.entries({A,B,AA,BB}))setup=setup.replaceAll('${'+key+'}',value);
 await db.exec(setup);
 for(const name of fs.readdirSync('supabase/migrations').filter(f=>f.startsWith('20261010')||f.startsWith('20261011')).sort())await db.exec(fs.readFileSync(path.join('supabase/migrations',name),'utf8'));
 await db.exec(`create table public.events(id uuid primary key);grant all on public.events to anon,authenticated;insert into public.events values(gen_random_uuid());insert into storage.buckets values('meetings','meetings',true,null,null);`);
 await db.exec(`create policy meetings_read on storage.objects for select using(bucket_id='meetings');create policy meetings_insert on storage.objects for insert with check(bucket_id='meetings');create policy meetings_update on storage.objects for update using(bucket_id='meetings');create policy meetings_delete on storage.objects for delete using(bucket_id='meetings');insert into storage.objects(bucket_id,name) values('meetings','visit/existing.jpg');grant select,insert,update,delete on storage.objects to anon;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261014190000_private_memory_photos.sql','utf8'));
 const bucket=(await db.query("select * from storage.buckets where id='meetings'")).rows[0];assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),8388608);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${AA}';`);
 for(const payload of ["x'); DROP TABLE public.users; --","' OR 1=1 --",'<img src=x onerror=alert(1)>','${process.env.SECRET}']){
  const inserted=await db.query('select public.create_fridge_note($1,$2,$3,$4) as id',[payload,'note','pink',true]);
  const id=inserted.rows[0].id;
  assert.equal((await db.query('select body from public.fridge_notes where id=$1',[id])).rows[0].body,payload);
 }
 assert.equal((await db.query('select count(*)::int as n from public.users')).rows[0].n,2);
 assert.equal((await db.query('select count(*)::int as n from public.events')).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int as n from storage.objects where bucket_id='meetings'")).rows[0].n,1);
 await db.exec("insert into storage.objects(bucket_id,name)values('meetings','visit/member.jpg');update storage.objects set name='visit/renamed.jpg' where name='visit/member.jpg';delete from storage.objects where name='visit/renamed.jpg';");
 await db.exec("set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';");
 assert.equal((await db.query('select count(*)::int as n from public.events')).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int as n from storage.objects where bucket_id='meetings'")).rows[0].n,0);
 await assert.rejects(db.query("insert into storage.objects(bucket_id,name)values('meetings','visit/intruder.jpg')"));
 assert.equal((await db.query("update storage.objects set name='evil' where bucket_id='meetings' returning name")).rows.length,0);
 assert.equal((await db.query("delete from storage.objects where bucket_id='meetings' returning name")).rows.length,0);
 await assert.rejects(db.query('select public.create_fridge_note($1,$2,$3,$4)',["' OR 1=1 --",'note','pink',true]));
 await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from public.events'));
 assert.equal((await db.query("select count(*)::int as n from storage.objects where bucket_id='meetings'")).rows[0].n,0);
 await assert.rejects(db.query("insert into storage.objects(bucket_id,name)values('meetings','visit/anonymous.jpg')"));
 console.log('PASS SQL security: injection strings remain literal RPC parameters; users table survives; outsider writes denied; events RLS and private photo bucket migration enforced.');
}finally{await db.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
