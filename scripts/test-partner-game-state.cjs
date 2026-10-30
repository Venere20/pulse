const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
(async()=>{const db=new PGlite();try{
 const setup=fs.readFileSync('scripts/test-partner-games.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${A}',A).replaceAll('${B}',B);
 await db.exec(setup);
 for(const file of ['20261013100000_partner_games.sql','20261013110000_incremental_drawing.sql','20261013140000_partner_game_state.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 const login=id=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`);
 const rpc=async(name,args)=>{const params=args.map((_,i)=>'$'+(i+1)).join(',');return(await db.query(`select public.${name}(${params}) as value`,args)).rows[0].value;};
 const check=async m=>{const stored=(await db.query('select to_jsonb(m) as value from public.partner_games m where id=$1',[m.id])).rows[0].value;assert.deepEqual(m,stored);assert.ok(!('ships' in m.state)&&!('word' in m.state)&&!('secret' in m));return m;};
 await login(A);let m=await check(await rpc('start_partner_game_state',['connect4']));const id=m.id;assert.equal(m.revision,0);
 await login(B);assert.equal((await rpc('start_partner_game_state',['connect4'])).id,id);await assert.rejects(rpc('play_partner_game_state',[id,'drop','{"column":0}',0]));
 for(const [user,col]of [[A,0],[B,1],[A,0],[B,1],[A,0],[B,1],[A,0]]){await login(user);const before=m.revision;m=await check(await rpc('play_partner_game_state',[id,'drop',JSON.stringify({column:col}),before]));assert.equal(m.revision,before+1);}
 assert.equal(m.winner,A);await assert.rejects(rpc('play_partner_game_state',[id,'drop','{"column":2}',m.revision]));
 await login(A);const legacyId=await rpc('start_partner_game',['connect4']);assert.notEqual(legacyId,id);await rpc('play_partner_game',[legacyId,'drop','{"column":0}',0]);await login(B);await assert.rejects(rpc('play_partner_game_state',[legacyId,'drop','{"column":1}',0]));m=await check(await rpc('play_partner_game_state',[legacyId,'cancel','{}',1]));assert.equal(m.status,'cancelled');
 await login(A);m=await rpc('start_partner_game_state',['battleship']);const naval=m.id;
 m=await check(await rpc('play_partner_game_state',[naval,'fleet',JSON.stringify({ships:[[0,1,2],[6,7],[12,13]]}),0]));assert.equal(m.state.ready_a,true);assert.equal(m.state.ready_b,false);
 await login(B);assert.deepEqual(await rpc('partner_game_secret',[naval]),{});m=await check(await rpc('play_partner_game_state',[naval,'fleet',JSON.stringify({ships:[[24,25,26],[28,29],[34,35]]}),0]));assert.equal(m.status,'playing');assert.equal(m.state.ready_a,true);assert.equal(m.state.ready_b,true);
 await login(A);m=await check(await rpc('play_partner_game_state',[naval,'shoot','{"cell":24}',m.revision]));assert.equal(m.state.shots_a[0].hit,true);
 await login(A);m=await rpc('start_partner_game_state',['drawguess']);const drawing=m.id;const word=(await rpc('partner_game_secret',[drawing])).word;assert.ok(word);assert.equal(m.state.answer,undefined);
 await login(B);assert.deepEqual(await rpc('partner_game_secret',[drawing]),{});m=await check(await rpc('play_partner_game_state',[drawing,'guess','{"guess":"impossibile"}',0]));
 await login(A);const stroke={id:'s1',author:A,color:'#FF4D85',width:6,brush:'ink',points:[10,20,30,40]};m=await check(await rpc('patch_partner_drawing_state',[drawing,0,0,JSON.stringify([stroke])]));assert.equal(m.state.drawing_revision,1);assert.deepEqual(m.state.guesses,['impossibile']);assert.equal(m.state.strokes.length,1);assert.equal(m.state.answer,undefined);
 await assert.rejects(rpc('patch_partner_drawing_state',[drawing,0,0,'[]']));m=await check(await rpc('patch_partner_drawing_state',[drawing,1,0,'[]']));assert.deepEqual(m.state.strokes,[]);
 await login(B);m=await check(await rpc('play_partner_game_state',[drawing,'guess',JSON.stringify({guess:word}),0]));assert.equal(m.state.answer,word);assert.equal(m.winner,B);
 await db.exec("reset role;set role authenticated;set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';");await assert.rejects(rpc('start_partner_game_state',['connect4']));await assert.rejects(rpc('play_partner_game_state',[id,'cancel','{}',0]));await assert.rejects(rpc('patch_partner_drawing_state',[drawing,2,0,'[]']));
 await db.exec('reset role;set role anon');for(const[name,args]of [['start_partner_game_state',['connect4']],['play_partner_game_state',[id,'cancel','{}',0]],['patch_partner_drawing_state',[drawing,2,0,'[]']]])await assert.rejects(rpc(name,args));
 console.log('PASS state-returning RPCs: exact authoritative rows, turns/revisions/cancel/win, independently merged fleets/guesses/drawing, private secrets, unauthorized/anonymous rejection and original clients preserved.');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1;});
