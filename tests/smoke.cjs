const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { innerHTML: '', onclick: null });
  return elements.get(id);
}
const oldBackup = {
  version: 1, demo: false,
  players: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bia' }],
  matches: [{ id: 'm1', a: 'p1', b: 'p2', date: '2026-11-10', score: '6-4, 7-6', surface: 'Rápida' }],
  training: []
};
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.js'), 'utf8')
  .replace("render();if('serviceWorker'", "globalThis.test={parseScore,validateBackup,openMatch,setView:(c,m)=>{current=c;module=m;render()},select:(id)=>{state.selfId=id;render()},getState:()=>state};render();if('serviceWorker'");
const context = {
  document: { getElementById: element, querySelectorAll: () => [] },
  localStorage: { getItem: () => JSON.stringify(oldBackup), setItem: () => {} },
  navigator: {}, location: { protocol: 'http:' },
  Date, Math, JSON, Number, String, Object, Array, Set,
  FormData: function (form) { return { get: name => form.values[name] ?? '' }; },
  alert: () => { throw Error('Unexpected alert'); }, confirm: () => true
};
vm.createContext(context);
vm.runInContext(source, context);

assert.match(element('content').innerHTML, /Ana/);
assert.equal(context.test.getState().selfId, null); // Migration preserves old records.
assert.equal(context.test.parseScore('6-4, 7-6(7-5)'), 'a');
assert.equal(context.test.parseScore('4-6, 6-4, 7-5'), 'a');
for (const score of ['6-4, 6-4, 7-5', '7-6(5-7), 6-4', '6-4, 4-6', '6-6, 6-4']) {
  assert.throws(() => context.test.parseScore(score), score);
}
context.test.select('p2');
assert.match(element('content').innerHTML, /Bia/);
context.test.setView('estatisticas', 'overview');
assert.equal((element('content').innerHTML.match(/data-go=/g) || []).length, 5);
context.test.setView('estatisticas', 'scout');
assert.match(element('content').innerHTML, /Confrontos diretos/);
context.test.openMatch();
assert.match(element('modalRoot').innerHTML, /3º set/);
element('entryForm').values = {
  a: 'p1', b: 'p2', a0: '6', b0: '4', tie0: '',
  a1: '7', b1: '6', tie1: '7-5', a2: '', b2: '', tie2: '',
  date: '2026-11-11', surface: 'Saibro'
};
element('entryForm').onsubmit({ preventDefault() {} });
assert.equal(context.test.getState().matches.length, 2);
assert.equal(context.test.getState().matches[1].score, '6-4, 7-6(7-5)');
for (const change of [
  b => { b.players[0].id = '__proto__'; },
  b => { b.matches[0].score = '6-4'; },
  b => { b.matches[0].date = '2026-02-31'; },
  b => { b.matches[0].a = 'missing'; }
]) {
  const bad = structuredClone(oldBackup); change(bad);
  assert.throws(() => context.test.validateBackup(bad));
}
console.log('Sports Hub smoke checks passed');
