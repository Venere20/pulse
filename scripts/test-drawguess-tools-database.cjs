const fs = require('node:fs'), assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
(async () => {
  const db = new PGlite();
  try {
    const setup = fs.readFileSync('scripts/test-partner-games.cjs', 'utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${A}', A).replaceAll('${B}', B); await db.exec(setup);
    for (const name of ['20261013100000_partner_games.sql', '20261013110000_incremental_drawing.sql', '20261013140000_partner_game_state.sql']) await db.exec(fs.readFileSync('supabase/migrations/' + name, 'utf8'));
    const migration = fs.readFileSync('supabase/migrations/20261026131412_drawguess_canvas_tools.sql', 'utf8');
    const grants = async () => (await db.query("select proacl::text,prosecdef,proconfig from pg_proc where oid='public.play_partner_game(uuid,text,jsonb,integer)'::regprocedure")).rows;
    const before = await grants(); await db.exec(migration); await db.exec(migration); assert.deepEqual(await grants(), before);
    const login = id => db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`);
    await login(A); let match = (await db.query("select public.start_partner_game_state('drawguess') as m")).rows[0].m;
    const palette = fs.readFileSync('src/features/canvas/protocol.ts', 'utf8').split('] as const;')[0].match(/#[A-F0-9]{6}/g);
    const stroke = (i, color, width = 6, brush = 'ink') => ({ id: 's' + i, author: A, color, width, brush, points: [10, 20, 30, 40] });
    const apply = async (keep, strokes) => { match = (await db.query('select public.patch_partner_drawing_state($1,$2,$3,$4) as m', [match.id, match.state.drawing_revision, keep, JSON.stringify(strokes)])).rows[0].m; };
    for (let i = 0; i < palette.length; i++) await apply(i, [stroke(i, palette[i], [3, 6, 12][i % 3])]);
    assert.equal(match.state.strokes.length, 24); assert.equal(match.state.answer, undefined);
    await assert.rejects(apply(24, [stroke(24, '#123456')])); await assert.rejects(apply(24, [stroke(24, palette[0], 6, 'neon')])); await assert.rejects(apply(24, [stroke(24, palette[0], 7)]));
    await assert.rejects(apply(24, [{ ...stroke(24, palette[0]), author: B }])); await assert.rejects(apply(24, [{ ...stroke(24, palette[0]), points: [0, 1001] }]));
    await login(B); await assert.rejects(apply(24, [stroke(24, palette[0])])); await db.query("select public.play_partner_game_state($1,'guess','{\"guess\":\"tentativo\"}',$2)", [match.id, match.revision]);
    await login(A); await apply(0, []); assert.equal(match.state.strokes.length, 0); assert.deepEqual(match.state.guesses, ['tentativo']); assert.equal(match.status, 'playing');
    await apply(0, Array.from({ length: 60 }, (_, i) => stroke(i, palette[i % 24]))); await assert.rejects(apply(60, [stroke(61, palette[0])])); await assert.rejects(apply(0, [{ ...stroke(1, palette[0]), points: Array(6002).fill(0) }]));
    await login('33333333-3333-4333-8333-333333333333'); await assert.rejects(apply(0, [])); await db.exec('reset role;set role anon;'); await assert.rejects(apply(0, []));
    console.log('PASS 24 colors, three widths, ink only (Neon rejected), incremental edit/erase/clear, guesses preserved, point/stroke limits, private answer, outsider/anonymous denial, unchanged ACL/security/search_path and idempotent migration.');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
