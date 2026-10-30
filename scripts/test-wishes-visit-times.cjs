// Offline regression coverage: no real account, database or notifications.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const now = Date.parse('2026-10-29T18:00:00Z');
class Clock extends Date { static now() { return now; } }
function load(file, mocks = {}, cache = {}) {
  file = path.resolve(file);
  if (cache[file]) return cache[file];
  const module = { exports: {} };
  const requireLocal = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith('.')) throw new Error('Missing mock: ' + name);
    const base = path.resolve(path.dirname(file), name);
    const next = [base + '.ts', base + '.tsx'].find(f => fs.existsSync(f));
    assert.ok(next, name);
    return load(next, mocks, cache);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 1, target: 9, jsx: ts.JsxEmit.React } }).outputText,
    { module, exports: module.exports, require: requireLocal, Date: Clock, Intl, console });
  return cache[file] = module.exports;
}
function reactHarness() {
  let cursor = 0; const state = [];
  const react = { memo: x => x, useMemo: fn => fn(), createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; } };
  return { react, reset: () => { cursor = 0; } };
}
const walk = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(walk)
  : [n, ...walk(n.props?.children), ...walk(n.props?.before), ...walk(n.props?.footer)];
const primitives = Object.fromEntries(['Button', 'Card', 'Chip', 'Input', 'T', 'Row', 'EmptyState', 'Skeleton'].map(k => [k, k]));

async function components() {
  const h = reactHarness(), changes = [], calls = [], errors = []; let confirm = true;
  const visit = { id: 'v', start_date: '2026-10-28', end_date: '2026-10-28', status: 'concluded', ended_at: '2026-10-28T20:00:00Z', started_at: '2026-10-28T17:00:00Z' };
  const mocks = { react: h.react, 'react-native': { View: 'View' }, '../../ui/layout': { BottomSheet: 'Sheet' },
    '../../ui/primitives': primitives, '../../ui/DateField': { DateField: 'Date' },
    '../../utils/confirm': { confirmAction: async () => confirm },
    '../FeatureFrame': { useFeatureAction: () => ({ busy: false, run: async fn => { try { await fn(); } catch (e) { errors.push(e.message); } } }) },
    '../useFeatureRows': { featureRpc: async (name, args) => calls.push({ name, args }) } };
  const { VisitActualTimesEditor } = load('src/features/visits/VisitActualTimesEditor.tsx', mocks);
  const render = () => { h.reset(); return VisitActualTimesEditor({ visit, now, onChanged: async () => changes.push('refresh') }); };
  const find = (type, label) => { const node = walk(render()).find(n => n.type === type && n.props.label === label); assert.ok(node, label); return node.props; };
  await find('Button', 'Modifica inizio e fine effettivi').onPress();
  assert.equal(find('Input', 'Ora di inizio effettivo (HH:MM)').value, '18:00');
  find('Date', 'Giorno di inizio effettivo').onChange('2026-10-27');
  find('Input', 'Ora di inizio effettivo (HH:MM)').onChangeText('21:30');
  find('Input', 'Ora di fine effettiva (HH:MM)').onChangeText('20:15');
  confirm = false; await find('Button', 'Salva orari').onPress(); assert.equal(calls.length, 0);
  confirm = true; await find('Button', 'Salva orari').onPress();
  assert.equal(calls[0].name, 'update_visit_actual_times');
  assert.equal(calls[0].args.p_start, '2026-10-27T20:30:00.000Z');
  assert.equal(calls[0].args.p_end, '2026-10-28T19:15:00.000Z');
  assert.equal(changes.length, 1);
  assert.ok(!walk(render()).some(n => n.type === 'Chip'), 'Concluded visit cannot remove its end');
  find('Date', 'Giorno di fine effettiva').onChange('2026-10-26');
  await find('Button', 'Salva orari').onPress(); assert.equal(calls.length, 1); assert.match(errors.at(-1), /precedere/);
  visit.status = 'planned'; visit.started_at = null; visit.ended_at = null; visit.end_date = '2026-10-30';
  await find('Button', 'Modifica inizio e fine effettivi').onPress();
  await find('Button', 'Salva orari').onPress(); assert.equal(calls.at(-1).args.p_end, null);

  const w = reactHarness(), data = { loaded: true, bucket: [
    { id: 'p', title: 'Roma', category: 'place', is_completed: false },
    { id: 'c', title: 'Cena', category: 'restaurant', is_completed: true },
  ], visitBucket: [], visits: [], userId: 'me', refresh: async () => {} };
  const scope = [];
  const { BucketScreen } = load('src/screens/BucketScreen.tsx', {
    react: w.react, 'expo-router': { router: {} }, 'react-native': { View: 'View', TouchableOpacity: 'Touch', Text: 'Text', Platform: { OS: 'web' } },
    '../services/saveState': { trackResult: fn => fn() },
    '../config/supabase': { supabase: { from: () => ({ update: values => ({ eq: async (_, id) => { data.bucket = data.bucket.map(x => x.id === id ? { ...x, ...values } : x); return { error: null }; } }) }) } },
    '../state/AppData': { useAppDataFields: () => data }, '../ui/layout': { Header: 'Header', BottomSheet: 'Sheet', IconButton: 'Icon', SegmentedTabs: 'Tabs' },
    '../ui/ListScreen': { ListScreen: 'List' }, '../ui/primitives': primitives, '../ui/Icon': { Icon: 'Icon' },
    '../ui/Toast': { useToast: () => ({ error: x => { throw new Error(x); } }) }, '../theme/ThemeProvider': { useTheme: () => ({ c: {}, s: {}, r: {} }) },
    '../utils/confirm': {}, '../features/drafts/useDraftField': { useDraftField: (_, key, value) => [value, () => {}] },
    '../hooks/useProgressiveItems': { useProgressiveItems: (items, key) => { scope.push(key); return { visible: items }; } },
  });
  const wishes = () => { w.reset(); return walk(BucketScreen({ onOpenVisit() {} })).find(n => n.type === 'List').props; };
  const tabs = () => walk(wishes().before).find(n => n.type === 'Tabs').props;
  assert.equal(wishes().items[0].id, 'p');
  tabs().onChange('completed'); assert.equal(wishes().items[0].id, 'c');
  const category = walk(wishes().before).filter(n => n.type === 'Chip' && n.props.label.includes('Luoghi')).at(-1);
  category.props.onPress(); assert.equal(wishes().items.length, 0);
  tabs().onChange('pending'); const row = wishes().renderItem({ item: data.bucket[0] });
  await walk(row).find(n => n.type === 'Touch' && n.props.accessibilityRole === 'checkbox').props.onPress();
  assert.equal(wishes().items.length, 0); tabs().onChange('completed'); assert.equal(wishes().items[0].id, 'p');
  assert.equal(scope.at(-1), 'completed:place');
  // A small label is imported only in meetings views, not Per noi/Home/diary.
  const badgeImports = [];
  function scan(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, entry.name); if (entry.isDirectory()) scan(f); else if (/\.tsx?$/.test(f) && fs.readFileSync(f, 'utf8').includes("import { VisitAdultBadge }")) badgeImports.push(f.replaceAll('\\', '/')); } }
  scan('src');
  assert.deepEqual(badgeImports.sort(), ['src/components/VisitCard.tsx', 'src/screens/MeetingsScreen.tsx', 'src/screens/VisitDetailScreen.tsx'].sort());
  console.log('PASS components: wish sections/category/toggle, editor confirmations/validation/refresh, concluded/ongoing visits, restricted +18 visibility.');
}

async function databaseAndStats() {
  const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
  const AA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', BB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const db = new PGlite();
  try {
    let setup = fs.readFileSync('scripts/test-feature-database.cjs', 'utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1];
    for (const [k, v] of Object.entries({ A, B, AA, BB })) setup = setup.replaceAll('${' + k + '}', v);
    await db.exec(setup);
    for (const f of fs.readdirSync('supabase/migrations').filter(f => f.startsWith('20261010') || f.startsWith('20261011')).sort()) await db.exec(fs.readFileSync(path.join('supabase/migrations', f), 'utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261017010000_visit_lifecycle.sql', 'utf8'));
    await db.exec("set timezone='UTC';");
    assert.equal((await db.query("select count(*)::int as n from pg_policies where schemaname='public' and tablename='visits' and policyname='household'")).rows[0].n, 1);
    const id = (await db.query("insert into public.visits(title,start_date,end_date,created_by,status) values('Date previste','2025-01-01','2025-01-01',$1,'concluded') returning id", [A])).rows[0].id;
    await db.exec(fs.readFileSync('supabase/migrations/20261029202512_visit_manual_times_and_label.sql', 'utf8'));
    assert.equal((await db.query('select is_adult from public.visits where id=$1', [id])).rows[0].is_adult, false);
    const login = uid => db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${uid}';`);
    const edit = (s, e, vid = id) => db.query('select * from public.update_visit_actual_times($1,$2,$3)', [vid, s, e]);
    await login(AA);
    await db.query('update public.visits set is_adult=true where id=$1', [id]);
    const wish = (await db.query('insert into public.bucket_list(id,is_completed)values(gen_random_uuid(),false)returning id')).rows[0].id;
    await db.query('insert into public.visit_bucket_items values($1,$2)', [id, wish]);
    const row = (await edit('2025-12-31T23:30Z', '2026-01-01T02:00Z')).rows[0];
    assert.equal(row.start_date.toISOString().slice(0, 10), '2025-01-01', 'Plan unchanged');
    assert.equal(row.started_by, A); assert.equal(row.timing_mode, 'manual'); assert.equal(row.status, 'concluded'); assert.equal(row.is_adult, true);
    assert.equal((await db.query('select is_completed from public.bucket_list where id=$1', [wish])).rows[0].is_completed, true);
    await assert.rejects(edit('2026-01-01', null), /anche la fine/);
    await assert.rejects(edit('2100-01-01', '2100-01-02'), /non futura/);
    await assert.rejects(edit('2026-01-01', '2025-01-01'), /fine/);
    await assert.rejects(edit('2026-01-01', 'infinity'), /fine/);
    await assert.rejects(edit(null, null), /inizio/);
    await login(BB); assert.equal((await edit('2025-12-31T23:30Z', '2026-01-01T03:00Z')).rows[0].ended_by, B);
    await assert.rejects(edit('2026-01-01', null, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), /non trovato/);
    const active = (await db.query("insert into public.visits(title,start_date,end_date,created_by,status) values('Attivo',current_date,current_date,$1,'planned')returning id", [A])).rows[0].id;
    const from = new Date(Date.now() - 3600000).toISOString();
    assert.equal((await edit(from, null, active)).rows[0].status, 'planned');
    await login('cccccccc-cccc-4ccc-8ccc-cccccccccccc'); await assert.rejects(edit('2026-01-01', '2026-01-02'), /Accesso/);
    await db.exec('reset role; set role anon'); await assert.rejects(edit('2026-01-01', '2026-01-02'), /permission denied/);
    await db.exec('reset role;');
    assert.equal((await db.query("select prosecdef from pg_proc where oid='public.update_visit_actual_times(uuid,timestamptz,timestamptz)'::regprocedure")).rows[0].prosecdef, false);
    const { computeStats } = load('src/utils/statistics.ts');
    const { monthlyRecap } = load('src/features/recap/logic.ts');
    const original = { ...row, start_date: '2025-01-01', end_date: '2025-01-01', started_at: row.started_at.toISOString(), ended_at: row.ended_at.toISOString() };
    const stats = computeStats([original], [], '2026-10-29', 2026);
    assert.equal(stats.visits, 1); assert.equal(stats.days, 1); assert.equal(stats.togetherMinutes, 150);
    assert.equal(computeStats([original], [], '2026-10-29', 2025).visits, 0);
    assert.equal(monthlyRecap('2026-01', '2026-10-29', [original], [], [], [], [], []).meetings.length, 1);
    const corrected = { ...original, ended_at: '2026-01-02T02:00:00Z' };
    assert.equal(computeStats([corrected], [], '2026-10-29').days, 2);
    assert.equal(computeStats([corrected], [], '2026-10-29').togetherMinutes, 1590);
    assert.equal(computeStats([original, { ...original, id: 'overlap' }], [], '2026-10-29').togetherMinutes, 150);
    assert.equal(computeStats([{ ...original, started_at: null, ended_at: null }], [], '2026-10-29').timedVisits, 0);
    console.log('PASS local SQL/statistics: migration/default, both partners, RLS/anonymous rejection, validation, no reopening, original dates preserved, linked wishes, corrected year/days/minutes and overlap.');
  } finally { await db.close(); }
}

(async () => {
  const { visitActualTimes, visitTimeFields } = load('src/features/visits/actualTimes.ts');
  assert.equal(visitTimeFields('2026-10-28T23:30:00Z', '').day, '2026-10-29');
  assert.equal(visitActualTimes('2026-10-28', '23:30', '2026-10-29', '01:00', true, now).p_end, '2026-10-29T00:00:00.000Z');
  assert.throws(() => visitActualTimes('2026-03-29', '02:30', '', '', false, now), /valide/, 'Missing DST hour rejected');
  assert.throws(() => visitActualTimes('2026-02-30', '12:00', '', '', false, now), /valide/);
  assert.throws(() => visitActualTimes('2026-10-29', '23:00', '', '', false, now), /futuro/);
  await components(); await databaseAndStats();
})().catch(error => { console.error(error); process.exitCode = 1; });
