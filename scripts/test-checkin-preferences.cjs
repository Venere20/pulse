const fs=require('node:fs'),Module=require('node:module');const bootstrap=fs.readFileSync('scripts/test-feature-database.cjs','utf8').split(' const login=')[0];
const body=`
 await db.exec(fs.readFileSync('supabase/migrations/20261027110348_checkin_v2.sql','utf8'));
 await db.exec(\`insert into public.feature_preferences(user_id,checkin_grace_minutes)values('\${A}',2);insert into public.checkin_routes(user_id,name,destination,minutes,grace_minutes)values('\${A}','Casa','Casa',30,15);insert into public.safe_checkins(user_id,label,due_at,grace_minutes)values('\${A}','In corso',now()+interval'1 hour',2)\`);
 await db.exec(fs.readFileSync('supabase/migrations/20261027220504_checkin_grace_preferences.sql','utf8'));
 const scalar=async sql=>(await db.query(sql)).rows[0];
 assert.equal((await scalar(\`select checkin_grace_minutes g from public.feature_preferences where user_id='\${A}'\`)).g,5);
 assert.equal((await scalar('select grace_minutes g from public.checkin_routes')).g,15);
 assert.equal((await scalar('select grace_minutes g from public.safe_checkins')).g,2);
 await db.exec(\`set role authenticated;set request.jwt.claim.sub='\${BB}';insert into public.feature_preferences(user_id)values('\${B}')\`);
 assert.equal((await scalar('select checkin_grace_minutes g from public.feature_preferences')).g,10);
 await db.query(\`update public.feature_preferences set checkin_grace_minutes=30 where user_id='\${B}'\`);
 await assert.rejects(db.query(\`update public.feature_preferences set checkin_grace_minutes=31 where user_id='\${B}'\`));
 console.log('PASS grace preferences: 2→5 migration, default 10, 30 accepted, invalid rejected, active journeys and route margins preserved.');await db.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;});`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(bootstrap+body,__filename);
