const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/depth/model.json');
const E = require('../js/depth/engine.js');
const D = require('../js/depth/data.js');
const P = require('../js/depth/profile.js');
const V = require('../js/depth/visuals.js');
const fixtures = require('./fixtures/depth-types.json');
function report(scope, choices = null) {
  const d = D.newDraft(scope);
  if (choices) d.answers = choices;
  else d.order.forEach(id => D.choose(d, id, D.items.get(id).options[0].id));
  return D.snapshot(d);
}
test('mixed input becomes a coexistence description without claiming a unique type', () => {
  const r = report('personal'), before = JSON.stringify(r);
  assert.equal(r.classification.status, 'mixed');
  const p = P.present(r);
  assert.ok(p.narrative.title.includes('并重'));
  assert.equal(p.narrative.symbols.length, 2);
  assert.equal(JSON.stringify(r), before);
  assert.doesNotMatch(JSON.stringify(p), /混合模式|questionId|optionId|P01-01/);
});
test('14 reached primary types have distinct symbols and a description with limits', () => {
  const names = new Set(), symbols = new Set();
  fixtures.samples.forEach(s => {
    const p = P.present(report('personal', s.answers)), t = P.types[s.target];
    assert.equal(p.narrative.title, t.title);
    assert.ok(p.narrative.description && p.narrative.tension);
    names.add(t.animal); symbols.add(t.symbol);
    assert.ok(V.animal(t.symbol, t.animal).includes(t.animal));
  });
  assert.equal(names.size, 14); assert.equal(symbols.size, 14);
});
test('radar uses core supports and excludes missing responses, followups do not inflate it', () => {
  const r = report('personal'), p = P.present(r);
  p.axes.forEach(a => {
    assert.equal(a.value, Math.round(a.supportCount / a.observedCount * 100));
    assert.ok(a.value >= 0 && a.value <= 100);
  });
  const d = D.newDraft('personal'); d.answers = { ...r.answers };
  E.followups('personal', d.answers).forEach(entry => { d.order.push(entry.id); D.choose(d, entry.id, D.items.get(entry.id).options[3].id); });
  const supplemented = P.present(D.snapshot(d));
  assert.deepEqual(supplemented.axes.map(a => a.value), p.axes.map(a => a.value));
  assert.ok(supplemented.risks.length);
});
test('risk descriptions remain independent of positive radar values', () => {
  const d = D.newDraft('personal');
  d.order.forEach(id => D.choose(d, id, D.items.get(id).options[0].id));
  D.choose(d, 'P28-01', 'P28-01:4'); D.choose(d, 'P18-02', 'P18-02:4');
  const p = P.present(D.snapshot(d));
  const disclosure = p.risks.find(r => r.title === '重要信息的隐瞒');
  assert.ok(disclosure.description.includes('不完整的信息'));
  assert.ok(disclosure.recurrence.includes('不同情境'));
  assert.ok(disclosure.counter && disclosure.limit);
  assert.doesNotMatch(JSON.stringify(p), /P28-01|所选行动|questionId/);
});
test('no evidence has no invented animal type or zero filled polygon', () => {
  const d = D.newDraft('marriage');
  d.order.forEach(id => D.choose(d, id, 'skipped'));
  const p = P.present(D.snapshot(d)), svg = V.radar(p.axes);
  assert.equal(p.narrative.title, '尚无可解释证据');
  assert.equal(p.narrative.symbols.length, 0);
  assert.ok(p.axes.every(a => a.value === null));
  assert.doesNotMatch(svg, /profile-radar-area|NaN|Infinity/);
  assert.ok(svg.includes('待观察'));
});
test('marriage picture does not use personal prototypes and keeps financial and safety risks visible', () => {
  const d = D.newDraft('marriage');
  d.order.forEach(id => D.choose(d, id, D.items.get(id).options[0].id));
  D.choose(d, 'M05-02', 'M05-02:4'); D.choose(d, 'M08-02', 'M08-02:4');
  const p = P.present(D.snapshot(d));
  assert.equal(p.axes.length, 8); assert.equal(p.narrative.symbols.length, 0);
  assert.ok(p.risks.some(r => r.priority));
  assert.ok(p.risks.some(r => r.title.includes('信息') || r.title.includes('利益')));
});
