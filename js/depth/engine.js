(function (root) {
  'use strict';
  const model = root.RCT_MODEL || (typeof module !== 'undefined' ? require('./model.json') : null);
  const p = model.parameters;
  const lookup = new Map(model.items.map(item => [item.id, item]));
  const kinds = ['protect', 'risk', 'preference'];
  function collect(scope, answers = {}) {
    if (!['personal', 'marriage'].includes(scope)) throw new Error('未知测评模式');
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('回答格式无效');
    const errors = [], rows = [], missing = [];
    Object.entries(answers).forEach(([id, selection]) => {
      const item = lookup.get(id);
      if (!item || item.scope !== scope) { errors.push({ id, reason: '题目或模式不符' }); return; }
      if (typeof selection === 'string' &&
          (item.missingOptions.includes(selection) || model.missingReasons?.includes(selection))) {
        missing.push({ questionId: id, reason: selection }); return;
      }
      const option = item.options.find(o => o.id === selection);
      if (!option) { errors.push({ id, reason: '选项不属于该题' }); return; }
      rows.push({ questionId: id, topicId: item.topicId, phase: item.phase,
        mode: item.mode, text: item.text, optionId: option.id, answer: option.text,
        tags: option.tags, explanation: option.explanation, reviewPriority: option.reviewPriority });
    });
    return { scope, rows, missing, errors };
  }
  function summarize(scope, answers = {}) {
    const data = collect(scope, answers);
    const catalog = scope === 'personal' ? model.personalTopics : model.marriageDomains;
    const topics = catalog.map(topic => {
      const rows = data.rows.filter(r => r.topicId === topic.id);
      const core = rows.filter(r => r.phase === 'core').length;
      return { id: topic.id, name: topic.name, core, history: rows.filter(r => r.mode === 'history').length,
        covered: core >= (scope === 'personal' ? p.topicMinimumCore : p.marriageMinimumCore),
        evidence: rows, missing: data.missing.filter(m => lookup.get(m.questionId).topicId === topic.id),
        unasked: model.items.filter(i => i.scope === scope && i.topicId === topic.id &&
          !Object.prototype.hasOwnProperty.call(answers, i.id)).map(i => i.id) };
    });
    const indicators = [...new Set(Object.values(model.tags).map(t => t.indicator))].map(name => {
      const result = { name, protect: [], risk: [], preference: [] };
      data.rows.forEach(row => kinds.forEach(kind => {
        const tags = row.tags.filter(t => model.tags[t].kind === kind && model.tags[t].indicator === name);
        if (tags.length) result[kind].push({ ...row, matchingTags: tags });
      }));
      const r = result.risk, topicCount = new Set(r.map(x => x.topicId)).size;
      result.status = !r.length ? 'no_risk_answer_observed'
        : r.some(x => x.reviewPriority === 'explicit_boundary_or_safety') ? 'boundary_safety_review'
        : r.length >= p.riskRepeatMinItems && topicCount >= p.riskRepeatMinTopics
          ? 'repeated_answer_signal' : 'single_or_same_topic_signal';
      result.historyRisk = r.filter(x => x.mode === 'history').length;
      result.topicCount = topicCount;
      return result;
    }).filter(i => kinds.some(kind => i[kind].length));
    return { version: model.version, status: data.errors.length ? 'invalid_input' : 'interpretable',
      ...data, topics, coveredTopics: topics.filter(t => t.covered).length, indicators,
      evidenceBoundary: '情境为意向，经历为本人回忆；未核实，不代表未来确定行为。' };
  }
  function classify(answers = {}) {
    const summary = summarize('personal', answers);
    const rows = model.prototypes.map(type => {
      const keyCoverage = summary.topics.filter(t => type.topicIds.includes(t.id) && t.covered).length;
      const opportunities = model.items.filter(i => i.scope === 'personal' && i.phase === 'core' &&
        type.topicIds.includes(i.topicId) && i.options.some(o => o.tags.some(t => type.supportTags.includes(t))));
      const observed = summary.rows.filter(r => opportunities.some(i => i.id === r.questionId));
      const support = observed.filter(r => r.tags.some(t => type.supportTags.includes(t)));
      const counter = summary.rows.filter(r => r.phase === 'core' && type.topicIds.includes(r.topicId) &&
        r.tags.some(t => type.counterTags.includes(t)));
      const match = observed.length ? support.length / observed.length : null;
      const covered = keyCoverage >= p.typeMinTopics && summary.coveredTopics >= p.globalMinCoveredTopics;
      const eligible = covered && support.length >= p.typeMinSupport &&
        support.some(r => r.mode === 'history') && match >= p.typeMinMatch && counter.length <= p.typeMaxCounter;
      return { ...type, keyCoverage, observed: observed.length, totalOpportunities: opportunities.length,
        support, counter, match, covered, eligible };
    }).sort((a, b) => (b.match ?? -1) - (a.match ?? -1) || a.id.localeCompare(b.id));
    if (summary.status === 'invalid_input') return { status: 'invalid_input', rows, primary: null, secondary: null };
    const pool = rows.filter(r => r.covered);
    if (!pool.length || summary.coveredTopics < p.globalMinCoveredTopics)
      return { status: 'incomplete', rows, primary: null, secondary: null };
    const candidates = pool.filter(r => r.eligible);
    if (!candidates.length) return { status: 'unclassified', rows, primary: null, secondary: null };
    const first = pool[0], second = pool[1];
    const lead = second ? first.match - second.match : 1;
    if (!first.eligible || lead < p.typeLeadMargin)
      return { status: 'mixed', rows, primary: null, secondary: null, candidates, lead };
    return { status: 'classified', rows, primary: first, secondary: candidates.find(r => r.id !== first.id) || null,
      candidates, lead };
  }
  function followups(scope, answers, expanded = false) {
    const summary = summarize(scope, answers);
    if (summary.status === 'invalid_input') return [];
    const entries = [];
    summary.topics.forEach(topic => {
      const danger = topic.evidence.some(r => r.reviewPriority === 'explicit_boundary_or_safety');
      const hasOpposite = summary.indicators.some(i => i.protect.some(r => r.topicId === topic.id) &&
        i.risk.some(r => r.topicId === topic.id));
      const noHistory = !topic.evidence.some(r => r.mode === 'history');
      const reason = danger ? '明确边界或安全行动待核对' : hasOpposite ? '同主题存在相反回答'
        : noHistory ? '缺少经历观察' : '按统一规则补充经历与情境';
      const priority = danger ? 0 : hasOpposite ? 1 : noHistory ? 2 : 3;
      model.items.filter(i => i.scope === scope && i.topicId === topic.id && i.phase === 'followup' &&
        !Object.prototype.hasOwnProperty.call(answers, i.id)).forEach(item => entries.push({ id: item.id, reason, priority }));
    });
    // Stable interleaving is independent of whether the answers are flattering.
    entries.sort((a, b) => a.priority - b.priority ||
      (lookup.get(a.id).topicId * 17 % 53) - (lookup.get(b.id).topicId * 17 % 53) || a.id.localeCompare(b.id));
    const cap = expanded ? model.items.filter(i => i.scope === scope && i.phase === 'followup').length
      : scope === 'personal' ? p.automaticFollowup.personalCap : p.automaticFollowup.marriageCap;
    const asked = Object.keys(answers).filter(id => lookup.get(id)?.scope === scope && lookup.get(id).phase === 'followup').length;
    return entries.slice(0, Math.max(0, cap - asked));
  }
  function compare(a, b, agreements = []) {
    if (!a || !b || a.version !== model.version || b.version !== model.version ||
        a.scope !== 'marriage' || b.scope !== 'marriage' || a.status !== 'interpretable' || b.status !== 'interpretable')
      return { status: 'insufficient', reason: '需要两份同版本的婚恋报告，类型名称不能替代实际资料。', domains: [] };
    const domains = model.marriageDomains.map(d => {
      const x = a.topics.find(t => t.id === d.id), y = b.topics.find(t => t.id === d.id);
      const risksA = a.rows.filter(r => r.topicId === d.id && r.tags.some(t => model.tags[t].kind === 'risk'));
      const risksB = b.rows.filter(r => r.topicId === d.id && r.tags.some(t => model.tags[t].kind === 'risk'));
      const agreement = agreements.find(g => g.domainId === d.id);
      const confirmed = agreement && typeof agreement.statement === 'string' && agreement.statement.trim() &&
        ['accept', 'reject'].includes(agreement.partyAResponse) && ['accept', 'reject'].includes(agreement.partyBResponse);
      const status = risksA.length || risksB.length ? 'risk_review'
        : !x?.covered || !y?.covered || !confirmed ? 'unknown'
        : agreement.partyAResponse === 'accept' && agreement.partyBResponse === 'accept' ? 'confirmed_agreement'
        : 'difference';
      return { id: d.id, name: d.name, status, risksA, risksB, agreement: confirmed ? agreement : null,
        coverageA: x?.core ?? 0, coverageB: y?.core ?? 0,
        boundary: '明确一致指双方对这条约定均表示接受；不证明实际执行或未来关系成功。' };
    });
    return { status: 'compared', domains };
  }
  root.RCT_ENGINE = { collect, summarize, classify, followups, compare };
  if (typeof module !== 'undefined') module.exports = root.RCT_ENGINE;
})(typeof window !== 'undefined' ? window : globalThis);
