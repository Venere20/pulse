const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const visit = '11111111-1111-4111-8111-111111111111';
const missing = '22222222-2222-4222-8222-222222222222';
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function main() {
 const db = new PGlite();
 try {
  // A disposable development database with the existing household/RLS prerequisites.
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth; create schema storage;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
   create table public.users(id uuid primary key, auth_user_id uuid);
   insert into public.users values(gen_random_uuid(),'${a}'),(gen_random_uuid(),'${b}');
   create function public.is_couple_member() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.users where auth_user_id=auth.uid())$$;
   create table public.visits(id uuid primary key, memory_photos text[]);
   insert into public.visits values('${visit}',array['legacy-photo.jpg']);
   alter table public.visits enable row level security;
   create policy household on public.visits for all to authenticated using(public.is_couple_member()) with check(public.is_couple_member());
   create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
   insert into storage.buckets(id,name,public) values('meetings','meetings',true),('visit-covers','visit-covers',true);
   create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
   alter table storage.objects enable row level security;
   grant usage on schema public,auth,storage to anon,authenticated;
   grant select,insert,update,delete on storage.objects to anon,authenticated;
   grant select,update on public.visits to authenticated;
  `);
  // Verify the fixture has no generic storage policies before applying this migration.
  assert.equal((await db.query("select count(*)::int as n from pg_policies where schemaname='storage' and tablename='objects'")).rows[0].n, 0);
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261012150000_visit_covers.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261012160000_visit_covers_limits.sql'), 'utf8'));
  const limits = (await db.query("select * from storage.buckets where id='visit-covers'")).rows[0];
  assert.equal(Number(limits.file_size_limit),8388608);
  assert.deepEqual(limits.allowed_mime_types,['image/jpeg','image/png','image/webp']);
  const row = (await db.query(`select * from public.visits where id='${visit}'`)).rows[0];
  assert.deepEqual(row.memory_photos, ['legacy-photo.jpg']);
  for (const field of ['cover_source','cover_storage_path','cover_remote_url','cover_attribution']) assert.equal(row[field], null);
  assert.equal((await db.query("select public from storage.buckets where id='meetings'")).rows[0].public, true);
  assert.equal((await db.query("select public from storage.buckets where id='visit-covers'")).rows[0].public, false);
  await assert.rejects(db.query(`update public.visits set cover_source='invalid' where id='${visit}'`));
  for (const source of ['personal','destination','default']) await db.query(`update public.visits set cover_source='${source}' where id='${visit}'`);
  const login = (uid, role = 'authenticated') => db.exec(`reset role;set role ${role};set request.jwt.claim.sub='${uid}';`);
  const insert = name => db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['visit-covers', name]);
  await login(a);
  for (const ext of ['jpg','png','webp']) await insert(`${visit}/sample-${ext}.${ext}`);
  for (const bad of [`${missing}/sample.jpg`, `${visit}/../sample.jpg`, `${visit}/sample.gif`, `${visit}/nested/sample.png`, 'sample.jpg']) await assert.rejects(insert(bad));
  await login(b);
  assert.equal((await db.query("select count(*)::int as n from storage.objects where bucket_id='visit-covers'")).rows[0].n, 3);
  const updated = await db.query("update storage.objects set name='renamed.jpg' where bucket_id='visit-covers' returning id");
  assert.equal(updated.rows.length, 0, 'No UPDATE policy: existing objects cannot be overwritten');
  const deleted = await db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id', ['visit-covers', `${visit}/sample-webp.webp`]);
  assert.equal(deleted.rows.length, 1);
  for (const [uid, role] of [[outsider,'authenticated'], ['', 'anon']]) {
   await login(uid, role);
   assert.equal((await db.query("select count(*)::int as n from storage.objects where bucket_id='visit-covers'")).rows[0].n, 0);
   await assert.rejects(insert(`${visit}/forbidden.jpg`));
   assert.equal((await db.query("delete from storage.objects where bucket_id='visit-covers' returning id")).rows.length, 0);
  }
  console.log('PASS: migration, private bucket, legacy photos, cover sources, couple access, path checks, outsider/anonymous rejection, no overwrites.');
 } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
