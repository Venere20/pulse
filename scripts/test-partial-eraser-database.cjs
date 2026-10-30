const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', AA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', BB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
(async () => {
 const db = new PGlite(); try {
  let setup = fs.readFileSync('scripts/test-feature-database.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1];
  for (const [k,v] of Object.entries({A,B,AA,BB})) setup = setup.replaceAll('${'+k+'}',v); await db.exec(setup);
  for (const name of fs.readdirSync('supabase/migrations').filter(f=>f.startsWith('20261010')||f.startsWith('20261011')).sort()) await db.exec(fs.readFileSync(path.join('supabase/migrations',name),'utf8'));
  for (const name of ['20261013100000_partner_games.sql','20261013110000_incremental_drawing.sql','20261013140000_partner_game_state.sql','20261017130000_persistent_canvas.sql','20261025172805_canvas_expanded_palette.sql','20261026131412_drawguess_canvas_tools.sql']) await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  const acl = async () => (await db.query("select proname,proacl::text,prosecdef,proconfig from pg_proc where proname in('apply_canvas_board','play_partner_game','save_canvas') order by proname")).rows;
  const before = await acl(); const migration = fs.readFileSync('supabase/migrations/20261026132245_partial_eraser.sql','utf8'); await db.exec(migration); await db.exec(migration); assert.deepEqual(await acl(),before);
  const login = uid => db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid}';`);
  const stroke = { id: A+':line',author:A,color:'#FF4D85',width:6,brush:'ink',points:[100,500,300,500,500,500,700,500,900,500],ephemeral:false };
  const cut = [900,500,900,500,20], erase = (cuts,id=stroke.id,epoch=1) => db.query('select (public.apply_canvas_board($1,$2,$3,$4)).*',[epoch,'erase',{erasures:cuts},id]);
  await login(AA); await db.query("select public.apply_canvas_board(1,'put',$1,null)",[stroke]); let board = (await erase(cut)).rows[0];
  assert.deepEqual(board.strokes[0].points,stroke.points); assert.deepEqual(board.strokes[0].erasures,cut); const rev=board.revision;
  assert.equal((await erase(cut)).rows[0].revision,rev,'Repeated erase is idempotent');
  await db.query("select public.apply_canvas_board(1,'put',$1,null)",[{...stroke,points:[...stroke.points,950,500]}]);
  assert.deepEqual((await db.query('select strokes from public.canvas_current')).rows[0].strokes[0].erasures,cut,'Late checkpoint cannot restore erased area');
  await login(BB); await assert.rejects(erase(cut)); assert.deepEqual((await db.query('select strokes from public.canvas_current')).rows[0].strokes[0].erasures,cut,'Late partner sees cuts');
  await login(AA); for (const invalid of [[1,2],[0,0,0,0,0],[0,0,0,0,41],[1001,0,0,0,20],[null,0,0,0,20],Array(645).fill(1)]) await assert.rejects(erase(invalid));
  await db.query('select public.save_canvas($1,$2)',[[{...stroke,erasures:cut}],'Partial erase']); assert.deepEqual((await db.query('select strokes from public.canvas_drawings')).rows[0].strokes[0].erasures,cut);
  await assert.rejects(db.query('select public.save_canvas($1,$2)',[[{...stroke,erasures:[0]}],'Invalid']));
  let match=(await db.query("select public.start_partner_game_state('drawguess') as m")).rows[0].m;
  match=(await db.query('select public.patch_partner_drawing_state($1,0,0,$2) as m',[match.id,[{...stroke,erasures:cut}]])).rows[0].m; assert.deepEqual(match.state.strokes[0].points,stroke.points); assert.deepEqual(match.state.strokes[0].erasures,cut);
  await assert.rejects(db.query('select public.patch_partner_drawing_state($1,$2,0,$3)',[match.id,match.state.drawing_revision,[{...stroke,erasures:[0]}]]));
  await login(BB); await assert.rejects(db.query('select public.patch_partner_drawing_state($1,$2,0,$3)',[match.id,match.state.drawing_revision,[stroke]]));
  await login(AA); await db.query("select public.apply_canvas_board(1,'clear',null,null)"); assert.equal((await erase(cut)).rows[0].strokes.length,0,'Old epoch cannot resurrect erased or cleared data');
  await login('cccccccc-cccc-4ccc-8ccc-cccccccccccc'); await assert.rejects(erase(cut,stroke.id,2)); await db.exec('reset role;set role anon'); await assert.rejects(erase(cut));
  console.log('PASS partial eraser DB: original points retained, cuts persist in board/gallery/game, late partner, checkpoint preservation, idempotent erase, bounds, ownership, epochs, anonymous/outsider rejection and unchanged ACL/security/search_path.');
 } finally { await db.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
