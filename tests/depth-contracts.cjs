const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../js/depth/model.json');
const E = require('../js/depth/engine.js');
const D = require('../js/depth/data.js');
const fixtures = require('./fixtures/depth-types.json');

function draft(scope, optionIndex = 0) {
  const d = D.newDraft(scope);
  if (scope === 'marriage') d.consent = { adult: true, voluntary: true };
  d.order.forEach(id => D.choose(d, id, D.items.get(id).options[optionIndex].id));
  return d;
}

test('production model has exact coverage and no intimate questions in personal flow', () => {
  assert.equal(M.items.length, 216); assert.equal(M.prototypes.length, 14);
  assert.equal(M.personalTopics.length, 48); assert.equal(M.marriageDomains.length, 12);
  assert.equal(new Set(M.items.map(q => q.id)).size, 216);
  for (const scope of ['personal', 'marriage']) {
    const order = D.coreOrder(scope);
    assert.equal(order.length, D.coreCount(scope)); assert.equal(new Set(order).size, order.length);
    order.forEach((id, i) => {
      const q = D.items.get(id);
      assert.equal(q.phase, 'core'); assert.equal(q.scope, scope);
      if (i) assert.notEqual(q.topicId, D.items.get(order[i - 1]).topicId);
    });
    const catalog = scope === 'personal' ? M.personalTopics : M.marriageDomains;
    catalog.forEach(t => {
      const items = M.items.filter(q => q.scope === scope && q.topicId === t.id);
      assert.equal(items.filter(q => q.phase === 'core').length, scope === 'personal' ? 2 : 4);
      assert.equal(items.filter(q => q.phase === 'followup').length, scope === 'personal' ? 1 : 2);
    });
  }
  M.items.forEach(q => {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => o.id)).size, 4);
    q.options.forEach(o => assert.ok(o.tags.every(t => M.tags[t])));
  });
  assert.ok(M.items.filter(q => q.scope === 'personal').every(q => !q.sensitive && !/性生活|伴侣|生育|结婚|配偶/.test(q.text)));
});

test('missing and foreign selections never become average scores or types', () => {
  const s = E.summarize('personal', { 'P17-01': 'declined', 'P17-02': 'uncertain', 'P28-01': 'no_experience' });
  assert.equal(s.rows.length, 0); assert.equal(s.indicators.length, 0);
  assert.equal(s.coveredTopics, 0); assert.equal(E.classify({}).status, 'incomplete');
  const bad = E.summarize('personal', { 'P17-01': 'P28-01:1', 'M01-01': 'M01-01:1' });
  assert.equal(bad.status, 'invalid_input'); assert.equal(bad.rows.length, 0);
  assert.throws(() => D.choose(D.newDraft('personal'), 'P17-01', 'M01-01:1'));
});

test('profit and responsible exit differ from deceit, counterevidence never cancels risk', () => {
  assert.ok(!E.summarize('personal', { 'P16-01': 'P16-01:1' }).indicators.some(i => i.risk.length));
  assert.ok(!E.summarize('personal', { 'P18-01': 'P18-01:2' }).indicators.some(i => i.risk.length));
  const s = E.summarize('personal', { 'P28-01': 'P28-01:4', 'P18-02': 'P18-02:4', 'P17-01': 'P17-01:1' });
  const i = s.indicators.find(i => i.name === '信息透明');
  assert.equal(i.risk.length, 2); assert.equal(i.protect.length, 1);
  assert.equal(i.status, 'repeated_answer_signal'); assert.equal(i.historyRisk, 1);
  assert.ok(i.risk.every(r => r.questionId && r.optionId && r.text && r.answer));
  const safety = E.summarize('marriage', { 'M08-02': 'M08-02:4' });
  assert.equal(safety.indicators.find(i => i.name === '自主与边界').status, 'boundary_safety_review');
});

test('followups use symmetric rules and respect caps, type uses core only', () => {
  for (const scope of ['personal', 'marriage']) {
    const d = draft(scope), cap = scope === 'personal' ? 24 : 12;
    const q = E.followups(scope, d.answers);
    assert.equal(q.length, cap); assert.equal(new Set(q.map(x => x.id)).size, cap);
    q.forEach(entry => { d.order.push(entry.id); D.choose(d, entry.id, 'no_experience'); });
    assert.equal(E.followups(scope, d.answers).length, 0);
    assert.equal(E.followups(scope, d.answers, true).length, cap);
    E.followups(scope, d.answers, true).forEach(entry => { d.order.push(entry.id); D.choose(d, entry.id, 'declined'); });
    assert.equal(d.order.length, D.maxCount(scope)); assert.equal(E.followups(scope, d.answers, true).length, 0);
    assert.doesNotThrow(() => D.snapshot(d));
  }
  const a = { 'P17-01': 'P17-01:1', 'P17-02': 'P17-02:1' };
  const b = { 'P17-01': 'P17-01:4', 'P17-02': 'P17-02:4' };
  assert.equal(E.followups('personal', a, true).find(q => q.id === 'P17-03').priority,
    E.followups('personal', b, true).find(q => q.id === 'P17-03').priority);
  const fixture = fixtures.samples.find(s => s.target === 'T13').answers;
  assert.equal(JSON.stringify(E.classify(fixture)), JSON.stringify(E.classify({ ...fixture, 'P17-03': 'P17-03:4' })));
});

test('all 14 primary descriptions are reachable with synthetic inputs; coverage and next-best denominator apply', () => {
  fixtures.samples.forEach(sample => {
    assert.equal(E.classify(sample.answers).primary?.id, sample.target);
    const r = E.classify(sample.answers);
    r.rows.forEach(t => {
      assert.equal(t.match, t.support.length / t.observed);
      assert.ok(t.observed <= t.totalOpportunities);
    });
    assert.ok(r.lead >= M.parameters.typeLeadMargin);
  });
  const allFirst = draft('personal');
  assert.equal(E.classify(allFirst.answers).status, 'mixed');
  const sparse = Object.fromEntries(Object.entries(allFirst.answers).slice(0, 24));
  assert.equal(E.classify(sparse).status, 'incomplete');
  const reordered = JSON.parse(JSON.stringify(M)); reordered.items.forEach(q => q.options.reverse());
  const box = { RCT_MODEL: reordered };
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/depth/engine.js'), 'utf8'), box);
  assert.equal(JSON.stringify(box.RCT_ENGINE.classify(allFirst.answers)), JSON.stringify(E.classify(allFirst.answers)));
});

test('snapshots are independent, imports recompute derived data, invalid orders and versions fail', () => {
  const d = draft('personal'), r = D.snapshot(d), before = JSON.stringify(r);
  D.choose(d, d.order[0], 'declined');
  assert.equal(JSON.stringify(r), before);
  const forged = { ...r, derived: { indicators: ['made_up'], coveredTopics: 48 }, classification: { primary: { name: 'made_up' } } };
  assert.deepEqual(D.interpret(forged).derived, r.derived);
  assert.deepEqual(D.interpret(forged).classification, r.classification);
  assert.throws(() => D.interpret({ ...r, version: 'old' }));
  assert.throws(() => D.interpret({ ...r, order: [...r.order].reverse() }));
  assert.throws(() => D.interpret({ ...r, answers: { ...r.answers, 'P17-01': 'foreign' } }));
  assert.throws(() => D.snapshot(D.newDraft('marriage')));
});

test('append keeps immutable snapshots and separates comparison identities', () => {
  const values = new Map();
  const s = D.store({ getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) });
  const r = D.snapshot(draft('personal')); s.append('reports', r);
  assert.throws(() => s.append('reports', { ...r, answers: {} }));
  assert.equal(s.list('reports').length, 1);
  s.append('comparisons', { comparisonId: 'a' }); s.append('comparisons', { comparisonId: 'b' });
  assert.equal(s.list('comparisons').length, 2);
});

test('corrupt storage stays intact and quota failures keep exportable in-memory records', () => {
  const values = new Map([[D.PREFIX + 'reports', '{bad']]);
  const s = D.store({ getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) });
  assert.equal(s.list('reports'), null);
  assert.equal(s.append('reports', D.snapshot(draft('personal'))), false);
  assert.equal(values.get(D.PREFIX + 'reports'), '{bad');
  const blocked = D.store({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
  const r = D.snapshot(draft('personal'));
  assert.equal(blocked.append('reports', r), false);
  assert.deepEqual(blocked.list('reports'), [r]); assert.equal(blocked.issues.get('reports').kind, 'write');
});

test('comparison uses actual compatible reports and independent confirmations; risk has priority', () => {
  const a = D.snapshot(draft('marriage')), b = D.snapshot(draft('marriage'));
  const agreement = { domainId: 5, statement: '共同预算、重大支出分别确认', partyAResponse: 'accept', partyBResponse: 'accept' };
  assert.equal(E.compare({ type: 'T01' }, { type: 'T13' }).status, 'insufficient');
  assert.equal(E.compare(a.derived, b.derived).domains[4].status, 'unknown');
  assert.equal(E.compare(a.derived, b.derived, [agreement]).domains[4].status, 'confirmed_agreement');
  assert.equal(E.compare(a.derived, b.derived, [{ ...agreement, partyBResponse: 'pending' }]).domains[4].status, 'unknown');
  assert.equal(E.compare(a.derived, b.derived, [{ ...agreement, partyBResponse: 'reject' }]).domains[4].status, 'difference');
  b.derived = E.summarize('marriage', { ...b.answers, 'M05-02': 'M05-02:4' });
  assert.equal(E.compare(a.derived, b.derived, [agreement]).domains[4].status, 'risk_review');
});
