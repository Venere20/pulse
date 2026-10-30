const fs=require('node:fs'),Module=require('node:module');const bootstrap=fs.readFileSync('scripts/test-feature-database.cjs','utf8').split(' const login=')[0];
const body=`
 await db.exec(fs.readFileSync('supabase/migrations/20261027110348_checkin_v2.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261027213851_checkin_future_departures.sql','utf8'));
 await db.exec('create function public.game_reminder_ready(uuid) returns boolean language sql as $$select true$$');
 const snapshot=JSON.parse(fs.readFileSync('.private-backups/checkin-four-fixes-20261027/database-before.json','utf8'));
 for(const name of ['claim_feature_notifications','dispatch_feature_worker'])await db.exec(snapshot.find(f=>f.proname===name).definition);
 await db.exec(fs.readFileSync('supabase/migrations/20261027220121_checkin_notification_validity.sql','utf8'));
 const login=async()=>db.exec(\`reset role;set role authenticated;set request.jwt.claim.sub='\${AA}'\`);
 const start=async()=>{await login();return(await db.query(\`select public.start_checkin_v2('Casa','',30,now(),10,'',true) id\`)).rows[0].id;};
 const due=async(id,minutes)=>{await db.exec(\`reset role;update public.safe_checkins set due_at=now()-interval'\${minutes} minutes'where id='\${id}'\`);await db.query('select public.process_checkin_jobs_v2()');};
 const scalar=async sql=>(await db.query(sql)).rows[0];
 const claim=async()=>{await db.exec('reset role');return(await db.query('select id,title,tag from public.claim_feature_notifications()')).rows;};
 let id=await start();await due(id,1);
 const prompt=(await scalar(\`select id from public.feature_notifications where checkin_id='\${id}'and checkin_phase='prompt'\`)).id;
 assert.equal((await scalar(\`select public.checkin_notification_ready('\${prompt}') b\`)).b,true);
 await login();await db.query(\`select public.update_checkin_v2('\${id}','arrived')\`);
 assert.ok(!(await claim()).some(r=>r.id===prompt));
 assert.ok((await scalar(\`select cancelled_at from public.feature_notifications where id='\${prompt}'\`)).cancelled_at);
 assert.ok((await scalar(\`select read_at from public.notification_inbox where id='\${prompt}'\`)).read_at);
 // Already-claimed jobs are invalidated too; readiness must reject them.
 id=await start();await due(id,1);let jobs=await claim();const claimed=jobs.find(r=>r.title.includes('Sei arrivato'));assert.ok(claimed);
 await login();await db.query(\`select public.update_checkin_v2('\${id}','extend',15)\`);
 await db.exec('reset role');assert.equal((await scalar(\`select public.checkin_notification_ready('\${claimed.id}') b\`)).b,false);
 await login();await db.query(\`select public.update_checkin_v2('\${id}','cancel')\`);
 id=await start();await due(id,11);jobs=await claim();const alerts=jobs.filter(r=>r.tag==='checkin-alert');assert.equal(alerts.length,2);
 await login();await db.query(\`select public.update_checkin_v2('\${id}','cancel')\`);await db.exec('reset role');
 for(const alert of alerts)assert.equal((await scalar(\`select public.checkin_notification_ready('\${alert.id}') b\`)).b,false);
 assert.equal((await scalar(\`select count(*)::int n from public.notification_inbox where id in('\${alerts[0].id}','\${alerts[1].id}')\`)).n,2,'History retained');
 // Current notifications and unrelated categories remain deliverable.
 await db.query(\`insert into public.feature_notifications(user_id,title,body,tag,url)values('\${A}','Altro','','other','/')\`);
 jobs=await claim();assert.ok(jobs.some(r=>r.tag==='other'));assert.ok(jobs.some(r=>r.title.includes('annullato')));
 await login();await assert.rejects(db.query(\`select public.checkin_notification_ready('\${prompt}')\`));
 await assert.rejects(db.query(\`select public.queue_checkin_notification('\${id}','\${A}','prompt','x','x','checkin','/checkin')\`));
 await db.exec('reset role;set role anon');await assert.rejects(db.query(\`select public.checkin_notification_ready('\${prompt}')\`));
 console.log('PASS notification validity: prompt after arrival/extension suppressed, claimed alerts after cancellation suppressed, history retained/read, current and unrelated messages preserved, helper ACL closed.');await db.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;});
`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(bootstrap+body,__filename);
