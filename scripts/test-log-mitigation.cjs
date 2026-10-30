const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const AA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', BB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
(async () => {
 const db = new PGlite();
 try {
  let setup = fs.readFileSync('scripts/test-feature-database.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1];
  for (const [k,v] of Object.entries({A,B,AA,BB})) setup=setup.replaceAll('${'+k+'}',v);
  await db.exec(setup);
  const security=fs.readFileSync('supabase/migrations/20261006120000_push_security_and_token_cleanup.sql','utf8');
  await db.exec(security.slice(security.indexOf('CREATE OR REPLACE FUNCTION public.verify_push_secret'),security.indexOf('--',security.indexOf('GRANT EXECUTE ON FUNCTION public.verify_push_secret'))));
  for(const f of fs.readdirSync('supabase/migrations').filter(f=>f.startsWith('20261010')||f.startsWith('20261011')).sort())
   await db.exec(fs.readFileSync(path.join('supabase/migrations',f),'utf8'));
  await db.exec(`
   create table cron.job_run_details(status text,end_time timestamptz);
   create table public.expo_push_outbox(status text,created_at timestamptz default now());
   create table public.worker_test_requests(id bigserial,timeout integer);
   drop function net.http_post(text,jsonb,jsonb);
   create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer default 5000) returns bigint
   language plpgsql as $$declare rid bigint;begin insert into public.worker_test_requests(timeout) values(timeout_milliseconds) returning id into rid;return rid;end $$;
   create function public.game_reminder_ready(uuid) returns boolean language sql as $$select true$$;
   alter table public.date_options add column if not exists withdrawn_at timestamptz;
   insert into vault.decrypted_secrets values('push_secret','test-only');
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20261019192034_worker_log_mitigation.sql','utf8'));
  const value = async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.v;
  const count = table => value(`select count(*)::int as v from ${table}`);
  // Drain real once-per-day feature events, then verify a genuinely idle tick.
  await db.query('select public.process_feature_jobs()');
  await db.exec('truncate public.feature_notifications,public.notification_inbox,public.capsule_cleanup;');
  assert.equal(await value('select public.dispatch_feature_worker() as v'),null);
  assert.equal(await count('public.worker_test_requests'),0);
  assert.equal(await value("select checked_at>now()-interval'1 minute' as v from public.feature_heartbeat"),true);
  for(const role of ['anon','authenticated','service_role']) {
   await db.exec(`set role ${role}`);
   for(const fn of ['dispatch_feature_worker()','prune_feature_technical_history()','feature_daily_maintenance()'])
    await assert.rejects(db.query(`select public.${fn}`));
   if(role!=='service_role') await assert.rejects(db.query("select public.feature_worker_batch('test-only')"));
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.deepEqual(await value("select public.feature_worker_batch('wrong') as v"),{authorized:false});
  const health = await value("select public.feature_worker_batch('test-only','health') as v");
  assert.equal(health.authorized,true); assert.ok(health.checked_at);
  await assert.rejects(db.query("select public.feature_worker_batch('test-only','bad')"));
  await db.exec('reset role');
  // A real due check-in generates its notification in the same tick.
  await db.exec(`insert into public.safe_checkins(user_id,label,due_at,grace_minutes)values('${A}','Casa',now()-interval'20 minutes',5);`);
  assert.ok(await value('select public.dispatch_feature_worker() as v'));
  assert.equal(await count('public.worker_test_requests'),1);
  assert.equal(await value('select timeout as v from public.worker_test_requests limit 1'),60000);
  assert.ok(await count('public.feature_notifications'));
  await db.exec('set role service_role');
  const batch = await value("select public.feature_worker_batch('test-only') as v");
  assert.equal(batch.authorized,true); assert.equal(batch.jobs.length,1);
  assert.equal(batch.jobs[0].tag,'checkin-alert');
  assert.equal((await value("select public.feature_worker_batch('test-only') as v")).jobs.length,0,'A claimed job is not claimed twice');
  await db.exec('reset role');
  assert.equal(await value('select public.dispatch_feature_worker() as v'),null,'Leased work does not wake the worker');
  await db.exec("update public.feature_notifications set attempts=5,leased_until=null;");
  assert.equal(await value('select public.dispatch_feature_worker() as v'),null,'Exhausted work does not loop');
  // Receipt age boundaries and batch size bounds.
  await db.exec(`insert into public.feature_push_receipts(ticket_id,user_id,token,created_at)
   values('young','${A}','token',now()-interval'14 minutes');`);
  assert.equal(await value('select public.dispatch_feature_worker() as v'),null);
  await db.exec(`insert into public.feature_push_receipts(ticket_id,user_id,token,created_at)
   select 'old-'||g,'${A}','token',now()-interval'16 minutes' from generate_series(1,105)g;
   insert into public.capsule_cleanup(path)select 'path-'||g from generate_series(1,55)g;`);
  assert.ok(await value('select public.dispatch_feature_worker() as v'));
  await db.exec('set role service_role');
  const bounded=await value("select public.feature_worker_batch('test-only') as v");
  assert.equal(bounded.receipts.length,100); assert.equal(bounded.cleanup.length,50);
  assert.ok(!bounded.receipts.some(r=>r.ticket_id==='young'));
  await db.exec('reset role');
  // Daily gate: an old successful cron row is removed on the next maintenance day only.
  await db.exec("insert into cron.job_run_details values('succeeded',now()-interval'2 days');");
  await db.query('select public.feature_daily_maintenance()');
  assert.equal(await count('cron.job_run_details'),1);
  await db.exec("delete from public.feature_job_runs where job='technical-maintenance';");
  await db.query('select public.feature_daily_maintenance()');
  assert.equal(await count('cron.job_run_details'),0);
  // Preserve recent successes, errors, running rows, pending deliveries and all user history.
  const before={ inbox:await count('public.notification_inbox'), thoughts:await count('public.pulse_logs') };
  await db.exec(`
   insert into cron.job_run_details values('succeeded',now()-interval'2 days'),('succeeded',now()),('failed',now()-interval'2 days'),('failed',now()-interval'31 days'),('running',null);
   insert into public.expo_push_outbox values('done',now()-interval'2 days'),('sent',now()-interval'2 days'),('done',now());
   insert into public.feature_push_receipts(ticket_id,user_id,token,created_at,checked_at,error)
   values('success-old','${A}','token',now()-interval'2 days',now()-interval'2 days',null),
   ('error-old','${A}','token',now()-interval'2 days',now()-interval'2 days','Useful diagnostic'),
   ('success-recent','${A}','token',now()-interval'2 days',now(),null);
   update public.feature_notifications set delivered_at=now()-interval'8 days' where tag='checkin-alert';
  `);
  const pruned=await value('select public.prune_feature_technical_history() as v');
  assert.equal(pruned.cron_success,1); assert.equal(pruned.cron_failure_expired,1);
  assert.equal(pruned.successful_receipts,1); assert.equal(pruned.finished_outbox,1);
  assert.equal(pruned.delivered_notifications,1);
  assert.equal(await count('cron.job_run_details'),3); assert.equal(await count('public.expo_push_outbox'),2);
  assert.equal(await count('public.notification_inbox'),before.inbox); assert.equal(await count('public.pulse_logs'),before.thoughts);
  assert.equal(await value("select count(*)::int as v from public.feature_push_receipts where ticket_id in('error-old','success-recent')"),2);
  console.log('PASS: real SQL deadlines, idle dispatch, bounded batches, leases/retry ceiling, authorization, daily maintenance and selective retention without deleting user history.');
 } finally { await db.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
