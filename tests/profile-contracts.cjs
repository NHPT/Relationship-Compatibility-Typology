const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/depth/model.json');
const E = require('../js/depth/engine.js');
const D = require('../js/depth/data.js');
const P = require('../js/depth/profile.js');
const V = require('../js/depth/visuals.js');
const I = require('../js/depth/identity.js');
const A = require('../js/depth/affinities.js');
const fixtures = require('./fixtures/depth-types.json');
function report(scope, choices = null) {
  const d = D.newDraft(scope);
  if (choices) d.answers = choices;
  else d.order.forEach(id => D.choose(d, id, D.items.get(id).options[0].id));
  return D.snapshot(d);
}
test('mixed input becomes a compact dominant-feature combination without changing its classification', () => {
  const r = report('personal'), before = JSON.stringify(r);
  assert.equal(r.classification.status, 'mixed');
  const p = P.present(r);
  assert.equal(p.narrative.title, p.identity.selected.map(t => t.glyph).join(' · '));
  assert.ok(p.identity.selected.length >= 2 && p.identity.selected.length <= 3);
  assert.equal(p.narrative.symbols.length, 2);
  assert.equal(JSON.stringify(r), before);
  assert.doesNotMatch(JSON.stringify(p), /混合模式|questionId|optionId|P01-01/);
});
test('14 reached primary types have distinct symbols and a description with limits', () => {
  const names = new Set(), symbols = new Set();
  fixtures.samples.forEach(s => {
    const p = P.present(report('personal', s.answers)), t = I.personal[s.target];
    assert.equal(p.narrative.title, t.name + '型');
    assert.ok(p.narrative.description && p.narrative.tension);
    names.add(t.animal); symbols.add(t.symbol);
    assert.ok(V.animal(t.symbol, t.animal).includes(t.animal));
  });
  assert.equal(names.size, 14); assert.equal(symbols.size, 14);
});
test('short names differ with answers; naming ratios use observed core opportunities and not total shares', () => {
  const first = P.present(report('personal')), sample = fixtures.samples.find(s => s.target === 'T13');
  const income = P.present(report('personal', sample.answers));
  assert.notEqual(first.narrative.title, income.narrative.title);
  const M = require('../js/depth/model.json');
  const r = report('personal');
  first.identity.rows.forEach(row => {
    const def = M.prototypes.find(p => p.id === row.id);
    const opportunities = M.items.filter(q => q.phase === 'core' && q.scope === 'personal' &&
      def.topicIds.includes(q.topicId) && q.options.some(o => o.tags.some(t => def.supportTags.includes(t))));
    const actual = r.derived.rows.filter(x => opportunities.some(q => q.id === x.questionId));
    assert.equal(row.value, Math.round(actual.filter(x => x.tags.some(t => def.supportTags.includes(t))).length / actual.length * 100));
  });
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
  assert.deepEqual(supplemented.identity, p.identity);
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
  assert.equal(p.narrative.title, '待观察');
  assert.equal(p.narrative.symbols.length, 0);
  assert.ok(p.axes.every(a => a.value === null));
  assert.doesNotMatch(svg, /profile-radar-area|NaN|Infinity/);
  assert.ok(svg.includes('待观察'));
  assert.equal(p.affinities.available, false);
});
test('marriage picture does not use personal prototypes and keeps financial and safety risks visible', () => {
  const d = D.newDraft('marriage');
  d.order.forEach(id => D.choose(d, id, D.items.get(id).options[0].id));
  D.choose(d, 'M05-02', 'M05-02:4'); D.choose(d, 'M08-02', 'M08-02:4');
  const p = P.present(D.snapshot(d));
  assert.equal(p.axes.length, 8);
  assert.ok(p.identity.rows.every(r => r.id.startsWith('R')));
  assert.ok(p.risks.some(r => r.priority));
  assert.ok(p.risks.some(r => r.title.includes('信息') || r.title.includes('利益')));
});
test('marriage names vary by action and severe risk remains visible without a reassuring type list', () => {
  const names = [0, 1, 3].map(index => {
    const d = D.newDraft('marriage');
    d.order.forEach(id => D.choose(d, id, D.items.get(id).options[index].id));
    const p = P.present(D.snapshot(d));
    if (index === 3) {
      assert.ok(p.risks.some(r => r.priority));
      assert.equal(p.affinities.available, false);
    }
    return p.narrative.title;
  });
  assert.equal(new Set(names).size, 3);
});
test('affinity comparisons are symmetric references with no fabricated probability and prioritize risk', () => {
  for (const scope of ['personal', 'marriage']) {
    const rules = scope === 'personal' ? A.personalRules : A.marriageRules;
    rules.forEach(r => {
      assert.deepEqual(A.relationship(scope, r.a, r.b), A.relationship(scope, r.b, r.a));
    });
    const p = P.present(report(scope));
    const a = A.compare(p.identity, [{ repeated: true }]);
    assert.equal(a.riskFirst, true);
    assert.equal(a.groups[0].label, '共同点参考');
    const entries = a.groups.flatMap(g => g.entries);
    assert.equal(entries.length, scope === 'personal' ? 14 : 8);
    assert.equal(new Set(entries.map(t => t.id)).size, entries.length);
    assert.ok(entries.every(t => t.reason && t.discussion));
    assert.ok(entries.every(t => t.probability === undefined && t.compatibility === undefined));
  }
  assert.equal(A.relationship('personal', 'T05', 'T06').group, 'friction');
  assert.equal(A.relationship('personal', 'T07', 'T08').group, 'complement');
});
test('personal types and marriage directions have separate names, glyphs and fixed readable colors', () => {
  assert.equal(Object.keys(I.personal).length, 14);
  assert.equal(Object.keys(I.marriage).length, 8);
  const personalNames = new Set(Object.values(I.personal).map(t => t.name));
  const personalGlyphs = new Set(Object.values(I.personal).map(t => t.glyph));
  Object.values(I.marriage).forEach(t => {
    assert.ok(!personalNames.has(t.name));
    assert.ok(!personalGlyphs.has(t.glyph));
  });
  const catalog = Object.values({ ...I.personal, ...I.marriage });
  assert.equal(new Set(catalog.map(t => t.color)).size, 22);
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
      .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  catalog.forEach(t => {
    assert.match(t.color, /^#[a-f0-9]{6}$/);
    assert.ok((luminance(t.soft) + .05) / (luminance(t.color) + .05) >= 4.5, t.name);
  });
});
test('marriage has its own dimension copy and excludes unrelated situations from each opportunity set', () => {
  const personal = P.present(report('personal')), baseline = report('marriage');
  const original = P.present(baseline);
  const names = new Set(personal.axes.map(a => a.name));
  assert.ok(original.axes.every(a => !names.has(a.name)));
  assert.ok(original.axes.find(a => a.id === 'boundaries').task.includes('伴侣'));
  const offTopic = { ...baseline.answers, 'M01-02': 'M01-02:4' };
  const changed = P.present(report('marriage', offTopic));
  assert.equal(changed.axes.find(a => a.id === 'transparency').value,
    original.axes.find(a => a.id === 'transparency').value);
  assert.notEqual(changed.axes.find(a => a.id === 'commitment').value,
    original.axes.find(a => a.id === 'commitment').value);
  assert.ok(changed.risks.some(r => r.title === '重要信息的隐瞒'));
  original.identity.rows.forEach(row => {
    assert.equal(row.counterCount, original.axes.find(a => a.id === row.axis).coreRiskCount);
  });
  const d = D.newDraft('marriage'); d.answers = baseline.answers;
  E.followups('marriage', d.answers).forEach(q => {
    d.order.push(q.id); D.choose(d, q.id, D.items.get(q.id).options[3].id);
  });
  const later = P.present(D.snapshot(d));
  assert.deepEqual(later.identity, original.identity);
  assert.ok(later.risks.length > original.risks.length);
});
