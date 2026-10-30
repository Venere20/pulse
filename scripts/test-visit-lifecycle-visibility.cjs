const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 1, target: 9, jsx: ts.JsxEmit.React } }).outputText,
    { module, exports: module.exports, require: key => { assert.ok(imports[key], key); return imports[key]; } });
  return module.exports;
}
const imports = {
  react: { ...react, default: react }, 'react-native': { View: 'View' },
  '../../ui/primitives': { Button: 'Button', Card: 'Card', Chip: 'Chip', T: 'T' },
  '../../utils/confirm': { confirmAction: async () => true },
  '../../utils/visitLifecycle': load('src/utils/visitLifecycle.ts'),
  '../../utils/together': load('src/utils/together.ts'),
  '../FeatureFrame': { useFeatureAction: () => ({ busy: false, run: async fn => fn() }) },
  '../useFeatureRows': { featureRpc: async () => {} },
};
const { VisitLifecycleCard } = load('src/features/visits/VisitLifecycleCard.tsx', imports);
const visit = { id: 'v', start_date: '2026-10-20', end_date: '2026-10-22', timing_mode: 'manual', status: 'planned' };
const render = (time, values = {}) => VisitLifecycleCard({ visit: { ...visit, ...values }, today: time.slice(0, 10), now: Date.parse(time), onChanged: async () => {} });
assert.equal(render('2026-10-19T12:00:00Z'), null, 'Hidden before the visit');
assert.equal(render('2026-10-19T21:59:59Z'), null, 'Hidden until midnight in Rome');
assert.ok(render('2026-10-19T22:00:00Z'), 'Visible at local start-day midnight');
assert.ok(render('2026-10-21T12:00:00Z'), 'Visible during a multi-day visit');
assert.ok(render('2026-10-22T21:59:59Z'), 'Visible through the last day');
assert.equal(render('2026-10-22T22:00:00Z'), null, 'Hidden after the last local day');
assert.equal(render('2026-10-19T12:00:00Z', { timing_mode: 'scheduled' }), null);
assert.equal(render('2026-10-23T12:00:00Z', { started_at: '2026-10-20T12:00:00Z' }), null);
const history = render('2026-10-23T12:00:00Z', { status: 'concluded', started_at: '2026-10-20T12:00:00Z', ended_at: '2026-10-22T12:00:00Z' });
assert.ok(history, 'Historical confirmations retained');
assert.ok(!JSON.stringify(history).includes('Inizia incontro'), 'No controls for concluded visits');
console.log('PASS lifecycle visibility: future/past, Rome midnight boundaries, multi-day visits, scheduled/manual and historical confirmations.');
