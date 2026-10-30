const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
async function main() {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.users(id uuid primary key);
 insert into public.users values('${A}'),('${B}');
 create function public.my_profile_id() returns uuid language plpgsql stable security definer as $$begin if auth.uid() in ('${A}','${B}') then return auth.uid(); end if; raise exception 'Accesso non autorizzato'; end$$;
 create function public.is_couple_member() returns boolean language sql stable security definer as $$select auth.uid() in ('${A}','${B}')$$;
 create function public.queue_feature_notification(uuid,text,text,text,text) returns void language sql as $$select$$;
 grant usage on schema public,auth to authenticated,anon;
 create publication supabase_realtime;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261013100000_partner_games.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261029203310_drawguess_more_words.sql','utf8'));
 assert.match((await db.query("select pg_get_functiondef('public.start_partner_game(text)'::regprocedure) as definition")).rows[0].definition,/random\(\)\*220/);
 const login = async id => db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`);
 const row = async id => (await db.query('select * from public.partner_games where id=$1',[id])).rows[0];
 const start = async (game, user=A) => { await login(user); return (await db.query('select public.start_partner_game($1) as id',[game])).rows[0].id; };
 const act = async (id,user,action,data={}) => { await login(user); const m=await row(id); return db.query('select public.play_partner_game($1,$2,$3,$4)',[id,action,JSON.stringify(action==='draw'?{drawing_revision:m.state.drawing_revision,...data}:data),m.revision]); };
 const id=await start('connect4'); assert.equal(await start('connect4',B),id,'Concurrent start resumes existing match');
 await assert.rejects(act(id,B,'drop',{column:0}));
 await assert.rejects(act(id,A,'drop',{column:7}));
 await assert.rejects(db.query('update public.partner_games set winner=$1 where id=$2',[B,id]));
 await assert.rejects(db.query('select * from public.partner_game_secrets'));
 for(const [user,col] of [[A,0],[B,1],[A,0],[B,1],[A,0],[B,1],[A,0]]) await act(id,user,'drop',{column:col});
 assert.equal((await row(id)).winner,A); await assert.rejects(act(id,B,'drop',{column:2}));
 const next=await start('connect4'); assert.notEqual(next,id);
 const stale=(await row(next)).revision; await act(next,A,'drop',{column:0});
 await login(B); await assert.rejects(db.query('select public.play_partner_game($1,$2,$3,$4)',[next,'drop','{"column":1}',stale]));
 await act(next,B,'cancel');
 const horizontal=await start('connect4');
 for(const [user,col] of [[A,0],[B,6],[A,1],[B,6],[A,2],[B,5],[A,3]]) await act(horizontal,user,'drop',{column:col});
 assert.equal((await row(horizontal)).winner,A);
 for(const [tokens,column] of [[{A:[35,29,23],B:[36,37,38,30,31,24]},3],[{A:[38,30,22],B:[35,28,21,29,36,37]},0]]) {
  const diagonal=await start('connect4');const board=Array(42).fill('-');
  for(const [token,cells] of Object.entries(tokens)) for(const cell of cells) board[cell]=token;
  await db.exec('reset role');await db.query('update public.partner_games set state=$1 where id=$2',[JSON.stringify({board:board.join('')}),diagonal]);
  await act(diagonal,A,'drop',{column});assert.equal((await row(diagonal)).winner,A);
 }
 const drawBoard=await start('connect4');const full=['AABBAAB','BBAABBA','AABBAAB','BBAABBA','AABBAAB','BBAABBA'].join('');
 await db.exec('reset role');await db.query('update public.partner_games set state=$1 where id=$2',[JSON.stringify({board:'-'+full.slice(1)}),drawBoard]);
 await act(drawBoard,A,'drop',{column:0});assert.equal((await row(drawBoard)).status,'draw');
 console.log('PASS Forza 4: identity, turns, invalid/stale moves, vertical/horizontal/both diagonal wins, draw, rematch, client-write protection.');
 const naval=await start('battleship');
 await assert.rejects(act(naval,A,'shoot',{cell:0}));
 for(const ships of [[[0,1,6],[10,11],[20,21]],[[4,5,6],[10,11],[20,21]],[[0,1,2],[2,3],[20,21]],[[null,1,2],[10,11],[20,21]]])
  await assert.rejects(act(naval,A,'fleet',{ships}));
 const fleetA=[[24,25,26],[28,29],[34,35]],fleetB=[[0,1,2],[6,7],[12,13]];
 await act(naval,A,'fleet',{ships:fleetA});
 await login(B); assert.deepEqual((await db.query('select public.partner_game_secret($1) as secret',[naval])).rows[0].secret,{});
 await act(naval,B,'fleet',{ships:fleetB});
 await assert.rejects(act(naval,A,'fleet',{ships:fleetA}));
 assert.equal((await row(naval)).status,'playing');
 assert.ok(!JSON.stringify((await row(naval)).state).includes('ships'),'Fleet never appears in public state');
 for(const [i,cell] of fleetB.flat().entries()) {
  await act(naval,A,'shoot',{cell});
  if(i<6) await act(naval,B,'shoot',{cell:i});
  if(i===0) { await assert.rejects(act(naval,A,'shoot',{cell})); }
 }
 const end=await row(naval);assert.equal(end.winner,A);assert.equal(end.state.shots_a.filter(s=>s.sunk).length,3);
 await login(A);assert.deepEqual((await db.query('select public.partner_game_secret($1) as secret',[naval])).rows[0].secret.ships,fleetA);
 console.log('PASS Battaglia navale: setup, malformed/overlapping/wrapped fleets, hidden positions, immutable fleet, duplicate shots, sunk ships, win.');
 const draw=await start('drawguess');
 await login(A);const word=(await db.query('select public.partner_game_secret($1) as secret',[draw])).rows[0].secret.word;
 assert.ok(word);await login(B);assert.deepEqual((await db.query('select public.partner_game_secret($1) as secret',[draw])).rows[0].secret,{});
 assert.equal((await row(draw)).state.answer,undefined);
 const stroke={id:A+':test',author:A,color:'#FF4D85',width:6,brush:'ink',points:[0,0,1000,1000]};
 await assert.rejects(act(draw,B,'draw',{strokes:[stroke]}));
 await assert.rejects(act(draw,A,'draw',{strokes:[{...stroke,points:[0,0,1001,0]}]}));
 await assert.rejects(act(draw,A,'draw',{strokes:[{...stroke,points:[0]}]}));
 await act(draw,A,'draw',{strokes:[stroke]});assert.equal((await row(draw)).state.strokes.length,1);
 await assert.rejects(act(draw,A,'guess',{guess:word}));await assert.rejects(act(draw,B,'reveal'));
 await act(draw,B,'guess',{guess:'sbagliato'});assert.equal((await row(draw)).state.answer,undefined);
 await act(draw,B,'guess',{guess:word.toUpperCase()});assert.equal((await row(draw)).winner,B);assert.equal((await row(draw)).state.answer,word);
 const swapped=await start('drawguess',A);assert.equal((await row(swapped)).state.drawer,B);
 for(let i=0;i<8;i++) await act(swapped,A,'guess',{guess:'sbagliato'});
 assert.equal((await row(swapped)).status,'draw');assert.ok((await row(swapped)).state.answer);
 await db.exec(`reset role;set role anon;set request.jwt.claim.sub='';`);
 await assert.rejects(db.query("select public.start_partner_game('connect4')"));
 await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';`);
 await assert.rejects(db.query('select public.partner_game_secret($1)',[draw]));
 console.log('PASS Disegna e indovina: hidden word, validated drawings, roles, wrong/correct guesses, eight attempts, revealed result, alternating roles, outsider/anonymous protection.');
 await db.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;});
