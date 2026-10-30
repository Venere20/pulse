const fs = require('node:fs'), assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const migration = fs.readFileSync('supabase/migrations/20261029203310_drawguess_more_words.sql', 'utf8');
const words = [...migration.match(/words text\[\] := array\[([\s\S]*?)\];/)[1].matchAll(/'([a-z]+)'/g)].map(x => x[1]);
const original = [...fs.readFileSync('supabase/migrations/20261013100000_partner_games.sql', 'utf8').match(/word:=\(array\[([^\]]+)\]/)[1].matchAll(/'([a-z]+)'/g)].map(x => x[1]);
assert.equal(words.length, 220); assert.equal(new Set(words).size, 220);
assert.deepEqual(words.slice(0, 20), original);
assert.equal(words.filter(w => !original.includes(w)).length, 200);
assert.ok(words.every(w => /^[a-z]{2,20}$/.test(w)));
(async () => {
  const db = new PGlite();
  try {
    let setup = fs.readFileSync('scripts/test-partner-games.cjs', 'utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1];
    for (const [key, value] of Object.entries({ A, B })) setup = setup.replaceAll('${' + key + '}', value);
    await db.exec(setup);
    await db.exec(fs.readFileSync('supabase/migrations/20261013100000_partner_games.sql', 'utf8'));
    const before = (await db.query("select pg_get_functiondef(oid) as body, proacl::text as acl from pg_proc where oid='public.start_partner_game(text)'::regprocedure")).rows[0];
    await db.exec(migration);
    const after = (await db.query("select pg_get_functiondef(oid) as body, proacl::text as acl from pg_proc where oid='public.start_partner_game(text)'::regprocedure")).rows[0];
    assert.equal(after.acl, before.acl, 'Existing execution grants preserved');
    assert.equal(after.body.replace(/word:=.*?;/, 'WORD_SELECTION;'), before.body.replace(/word:=.*?;/, 'WORD_SELECTION;'), 'Only the word selection changed');
    await db.exec('select setseed(0.25)');
    const seen = new Set();
    for (let i = 0; i < 32; i++) {
      await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${A}';`);
      const id = (await db.query("select public.start_partner_game('drawguess') as id")).rows[0].id;
      const state = (await db.query('select state from public.partner_games where id=$1', [id])).rows[0].state;
      const drawer = state.drawer, guesser = drawer === A ? B : A;
      await db.exec(`set request.jwt.claim.sub='${drawer}'`);
      const word = (await db.query('select public.partner_game_secret($1) as secret', [id])).rows[0].secret.word;
      assert.ok(words.includes(word)); seen.add(word);
      assert.equal(state.letters, word.length); assert.equal(state.word, undefined); assert.equal(state.answer, undefined);
      await db.exec(`set request.jwt.claim.sub='${guesser}'`);
      assert.deepEqual((await db.query('select public.partner_game_secret($1) as secret', [id])).rows[0].secret, {});
      await db.exec('reset role'); await db.query("update public.partner_games set status='cancelled' where id=$1", [id]);
    }
    assert.ok([...seen].some(w => !original.includes(w)), 'New words are actually selected by new matches');
    console.log('PASS 200 new words / 220 unique total: real local SQL selection, valid letter counts, preserved function/grants, secret only visible to drawer. No online changes.');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
