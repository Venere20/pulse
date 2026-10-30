const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
let mode = 'couple';
const opened = [];
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  memo: component => component,
  useState: () => [mode, value => { mode = value; }],
};
const imports = {
  react: { ...react, default: react },
  'react-native': { TouchableOpacity: 'TouchableOpacity', View: 'View' },
  '../state/AppData': { useAppDataFields: () => ({ answers: [], today: '2026-10-19', userId: 'me', partnerId: 'partner' }) },
  '../state/Games': { useGames: () => ({ available: true, wyrAnswers: [], trisMatches: [] }) },
  '../theme/ThemeProvider': { useTheme: () => ({ c: {}, s: {}, r: {} }) },
  '../features/deeptalk/useDeepTalkSummary': { useDeepTalkSummary: () => ({ answered: 0 }) },
  '../ui/layout': { Screen: 'Screen', Header: 'Header' },
  '../ui/primitives': { Card: 'Card', T: 'T', Row: 'Row' },
  '../ui/Icon': { Icon: 'Icon' },
};
function load(source) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: 1, target: 9, jsx: ts.JsxEmit.React } }).outputText,
    { module, exports: module.exports, require: name => { assert.ok(imports[name], name); return imports[name]; } });
  return module.exports.GamesHubScreen;
}
function nodes(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => nodes(child, result));
  else if (node && typeof node === 'object') { result.push(node); nodes(node.props?.children, result); }
  return result;
}
const source = fs.readFileSync('src/screens/GamesHubScreen.tsx', 'utf8');
const Hub = load(source);
for (const [selected, expected] of [['couple', 7], ['solo', 8]]) {
  mode = selected;
  const tree = nodes(Hub({ onOpen: key => opened.push(key) }));
  const rows = tree.filter(node => typeof node.type === 'function');
  assert.equal(rows.length, expected);
  const counters = tree.filter(node => node.type === 'T' && node.props.children[1] === ' giochi');
  assert.deepEqual(counters.map(node => node.props.children[0]), [7, 8]);
  rows.forEach(row => row.props.onPress());
}
const types = fs.readFileSync('src/types/games.ts', 'utf8');
const keys = [...types.match(/PLAY_KEYS[^=]*=\s*\[([^\]]+)/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
assert.deepEqual(opened.sort(), keys.sort(), 'Every available game appears once and opens its correct route');
// Removing a rendered game must also reduce the counter, without editing a second list.
const reduced = load(source.replace(/\s*<GameRow key="sliding"[^\n]+\/>[,]/, ''));
mode = 'solo';
const reducedTree = nodes(reduced({ onOpen() {} }));
assert.equal(reducedTree.filter(node => typeof node.type === 'function').length, 7);
assert.deepEqual(reducedTree.filter(node => node.type === 'T' && node.props.children[1] === ' giochi').map(node => node.props.children[0]), [7, 7]);
console.log('PASS: dynamic counts match both rendered lists, all game routes appear once, removing a row automatically updates its counter.');
