// Real PostgreSQL function, isolated rows; no network or production content.
const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;
 create function public.my_profile_id()returns uuid language sql as $$select nullif(current_setting('test.profile',true),'')::uuid$$;
 create function public.is_couple_member()returns boolean language sql as $$select public.my_profile_id()is not null$$;
 create table public.visits(id uuid primary key,memory_notes text,memory_photos text[],memory_photo_settings jsonb);
 alter table public.visits enable row level security;
 create policy member on public.visits to authenticated using(public.is_couple_member())with check(public.is_couple_member());
 grant select,update on public.visits to authenticated;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261030191649_memory_concurrent_save.sql','utf8'));
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',a='11111111-1111-4111-8111-111111111111';
 await db.query('insert into visits(id,memory_photos)values($1,$2)',[id,['original']]);
 await db.exec(`set role authenticated;set test.profile='${a}'`);
 const base={note:'',photos:['original'],settings:{}};
 const save=(expected,note,photos,settings={})=>db.query('select save_visit_memory($1,$2,$3,$4,$5)',[id,expected,note,photos,settings]);
 await save(base,'partner note',['original','new-partner']);
 await assert.rejects(save(base,'stale note',['original']),/partner ha modificato/);
 const row=(await db.query('select * from visits')).rows[0];assert.deepEqual(row.memory_photos,['original','new-partner']);assert.equal(row.memory_notes,'partner note');
 const latest={note:row.memory_notes,photos:row.memory_photos,settings:row.memory_photo_settings};
 await save(latest,' intended removal ',['new-partner']);
 assert.equal((await db.query('select * from visits')).rows[0].memory_notes,'intended removal');
 await assert.rejects(save(latest,'another stale',['original']),/partner ha modificato/);
 await assert.rejects(db.query('select save_visit_memory($1,$2,$3,$4,$5)',['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',base,'',[],{}]),/non disponibile/);
 await db.exec("set test.profile=''");await assert.rejects(save(base,'',[]),/Accesso non consentito/);
 await db.exec('reset role;set role anon');await assert.rejects(save(base,'',[]),/permission denied/);
 console.log('PASS memory atomic save: stale photos/notes rejected, null defaults, intentional removal, unavailable visit, unlinked account and anonymous denied.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
