(function (root) {
  'use strict';
  const model = root.RCT_MODEL || require('./model.json');
  const engine = root.RCT_ENGINE || require('./engine.js');
  const ENGINE_VERSION = 'rct-depth-engine-v2';
  const compatibleEngine = version => ['rct-depth-engine-v1', ENGINE_VERSION].includes(version);
  const PREFIX = 'rct_human_depth_v1_';
  const items = new Map(model.items.map(q => [q.id, q]));
  const copy = value => JSON.parse(JSON.stringify(value));
  const uid = () => root.crypto?.randomUUID?.() || `depth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const scopeOK = scope => ['personal', 'marriage'].includes(scope);
  const coreCount = scope => scope === 'personal' ? 96 : 48;
  const maxCount = scope => scope === 'personal' ? 144 : 72;
  function coreOrder(scope) {
    if (!scopeOK(scope)) throw new Error('未知测评模式');
    const catalog = scope === 'personal' ? model.personalTopics : model.marriageDomains;
    const topics = [...catalog].sort((a, b) => (a.id * 17 % 53) - (b.id * 17 % 53));
    const groups = topics.map(t => model.items.filter(q => q.scope === scope && q.topicId === t.id && q.phase === 'core'));
    return Array.from({ length: scope === 'personal' ? 2 : 4 }, (_, round) =>
      groups.flatMap(group => group[round]?.id || [])).flat();
  }
  function newDraft(scope) {
    return { mode: scope, bankVersion: model.version, engineVersion: ENGINE_VERSION,
      order: coreOrder(scope), answers: {}, cursor: 0, stage: 'core', updatedAt: new Date().toISOString() };
  }
  function validateDraft(draft) {
    if (!draft || !scopeOK(draft.mode) || draft.bankVersion !== model.version ||
        !compatibleEngine(draft.engineVersion)) throw new Error('草稿模式或版本不兼容；原记录已保留');
    const scope = draft.mode, expected = coreOrder(scope), order = draft.order;
    if (!Array.isArray(order) || order.length < expected.length || order.length > maxCount(scope) ||
        new Set(order).size !== order.length || expected.some((id, i) => order[i] !== id) ||
        order.slice(expected.length).some(id => items.get(id)?.scope !== scope || items.get(id)?.phase !== 'followup'))
      throw new Error('草稿题目顺序无效；不能继续计数');
    if (!draft.answers || typeof draft.answers !== 'object' || Array.isArray(draft.answers)) throw new Error('草稿回答格式无效');
    const collected = engine.collect(scope, draft.answers);
    const unasked = Object.keys(draft.answers).find(id => !order.includes(id));
    if (collected.errors.length || unasked) {
      const id = collected.errors[0]?.id || unasked;
      throw new Error(`回答无效：${id}。请导出原记录核对选项`);
    }
    if (!Number.isInteger(draft.cursor) || draft.cursor < 0 || draft.cursor >= order.length ||
        !['core', 'automatic', 'expanded'].includes(draft.stage)) throw new Error('草稿进度格式无效');
    if (draft.notes !== undefined && (!draft.notes || typeof draft.notes !== 'object' || Array.isArray(draft.notes)))
      throw new Error('补充注记格式无效');
    for (const [id, note] of Object.entries(draft.notes || {})) {
      if (!order.includes(id) || !note || typeof note !== 'object' ||
          ['eventDate', 'context', 'example'].some(k => note[k] !== undefined && (typeof note[k] !== 'string' || note[k].length > 2000)))
        throw new Error(`补充注记无效：${id}`);
    }
    return draft;
  }
  function choose(draft, id, selection) {
    if (!draft.order.includes(id) || !items.has(id)) throw new Error('题目不属于本次流程');
    const data = engine.collect(draft.mode, { [id]: selection });
    if (data.errors.length) throw new Error(`选项不属于该题：${id}`);
    draft.answers[id] = selection;
    draft.updatedAt = new Date().toISOString();
    return draft;
  }
  function snapshot(draft) {
    validateDraft(draft);
    const derived = engine.summarize(draft.mode, draft.answers);
    if (derived.status !== 'interpretable') throw new Error('计算失败，不能生成报告');
    return { format: 'rct-depth-report', reportId: uid(), version: model.version,
      engineVersion: ENGINE_VERSION, scope: draft.mode, source: 'self_report_unverified',
      createdAt: new Date().toISOString(), order: copy(draft.order), answers: copy(draft.answers),
      ...(draft.notes !== undefined ? { notes: copy(draft.notes) } : {}),
      ...(draft.consent !== undefined ? { consent: copy(draft.consent) } : {}),
      parameters: copy(model.parameters),
      derived, classification: draft.mode === 'personal' ? engine.classify(draft.answers) : null };
  }
  function interpret(report) {
    if (!report || report.format !== 'rct-depth-report' || report.version !== model.version ||
        !compatibleEngine(report.engineVersion) || !scopeOK(report.scope)) throw new Error('报告版本不兼容，保留原文查看');
    const draft = { ...newDraft(report.scope), order: report.order, answers: report.answers,
      notes: report.notes || {}, consent: report.consent, cursor: 0 };
    validateDraft(draft);
    if (typeof report.reportId !== 'string' || !report.reportId || typeof report.createdAt !== 'string' ||
        Number.isNaN(Date.parse(report.createdAt))) throw new Error('报告标识或创建时间无效');
    // Imported counts, prose and tags are never used as input to the calculation.
    return { ...copy(report), derived: engine.summarize(report.scope, report.answers),
      classification: report.scope === 'personal' ? engine.classify(report.answers) : null };
  }
  function store(storage) {
    const memory = new Map(), issues = new Map();
    function read(name, fallback, validate = v => v) {
      if (memory.has(name)) return copy(memory.get(name));
      let raw;
      try {
        raw = storage.getItem(PREFIX + name);
        const value = raw === null ? copy(fallback) : JSON.parse(raw);
        const valid = validate(value);
        issues.delete(name);
        return valid;
      } catch (error) {
        issues.set(name, { raw, message: error.message, kind: 'read' });
        return null;
      }
    }
    function write(name, value) {
      if (issues.get(name)?.kind === 'read') return false;
      try {
        storage.setItem(PREFIX + name, JSON.stringify(value));
        memory.delete(name); issues.delete(name); return true;
      } catch (error) {
        memory.set(name, copy(value));
        issues.set(name, { message: error.message, kind: 'write' });
        return false;
      }
    }
    function list(name) {
      return read(name, [], value => {
        if (!Array.isArray(value) || value.some(v => !v || typeof v !== 'object' || Array.isArray(v)))
          throw new Error('记录列表格式无效');
        return value;
      });
    }
    return {
      issues, read, write, list,
      draft(scope) {
        return read('draft_' + scope, null, value => value === null ? null : validateDraft(value));
      },
      saveDraft(draft) { validateDraft(draft); return write('draft_' + draft.mode, draft); },
      append(name, value) {
        const listValue = list(name);
        if (listValue === null) return false;
        const existing = listValue.find(v => value.reportId && v.reportId === value.reportId ||
          value.comparisonId && v.comparisonId === value.comparisonId);
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(value)) throw new Error('同一快照标识不能覆盖已有内容');
          return !issues.has(name);
        }
        return write(name, [...listValue, copy(value)]);
      },
      retry() {
        for (const [name, issue] of issues) if (issue.kind === 'read') issues.delete(name);
      },
      raw(name) {
        try { return storage.getItem(PREFIX + name); } catch { return issues.get(name)?.raw ?? null; }
      }
    };
  }
  root.RCT_DEPTH_DATA = { ENGINE_VERSION, compatibleEngine, PREFIX, model, items, copy, uid, coreOrder,
    coreCount, maxCount, newDraft, validateDraft, choose, snapshot, interpret, store };
  if (typeof module !== 'undefined') module.exports = root.RCT_DEPTH_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
