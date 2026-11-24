(function () {
  'use strict';
  const D = window.RCT_DEPTH_DATA, M = D.model, E = window.RCT_ENGINE;
  const P = window.RCT_PROFILE, V = window.RCT_VISUALS;
  const storage = D.store({
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value)
  });
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const missingNames = { skipped: '未回答', no_experience: '没有相关经历／不适用', uncertain: '不确定', declined: '不愿回答' };
  const modeNames = { personal: '个人深度测评', marriage: '婚恋深度测评' };
  const legacyKeys = ['rct_exploration_draft_v1', 'rct_exploration_reports_v1', 'rct_history_v1', 'rct_outcomes_v1'];
  const state = { draft: null, report: null, reasons: {}, raw: null, importRaw: null };
  const domainTasks = [
    '结婚或长期相处的时间预期；变化怎样告知；分开时怎样交接。',
    '彼此接受的忠实约定；哪些接触要告知；哪些隐私保留。',
    '家务与长期照料分别由谁做；无法完成时怎样调整。',
    '双方家人的支持范围；居住和重大决定怎样共同确认。',
    '资产债务怎样披露；共同资金怎样授权；重大支出怎样同意。',
    '消费预算、负债上限、投资风险与兜底责任。',
    '是否生育；有分歧时如何尊重自愿；育儿责任怎样安排。',
    '争执时如何暂停、何时回谈；失误怎样修复和跟进。',
    '失业或疾病时的预算与照料；资源不足时怎样协商支持和退出。',
    '拒绝权、隐私和离开权；任何威胁或控制怎样停止。',
    '亲密需要与频率差异；如何表达拒绝并协商，不要求私密细节。',
    '居住、职业与长期目标；对方的投入怎样被告知和安排。'
  ];
  function date(value) {
    const t = new Date(value);
    return Number.isNaN(t.getTime()) ? '日期未知' : t.toLocaleString('zh-CN', { hour12: false });
  }
  function show(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + id));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function download(value, filename) {
    const blob = new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function notices(id, extra = '') {
    const errors = [...storage.issues.entries()].map(([name, issue]) =>
      issue.kind === 'read'
        ? `${name} 无法读取：${issue.message}。原数据未清空，可在记录页导出并重试。`
        : `${name} 未能保存到浏览器。本次内容仍在内存，请立即导出；关闭页面可能丢失。`);
    $(id).textContent = [extra, ...errors].filter(Boolean).join(' ');
    $(id).classList.toggle('storage-error', errors.length > 0);
  }
  function readLegacy() {
    return legacyKeys.flatMap(key => {
      let raw;
      try { raw = window.localStorage.getItem(key); } catch (error) {
        return [{ title: `${key} 无法读取`, raw: error.message, key }];
      }
      if (raw === null) return [];
      try {
        const value = JSON.parse(raw);
        return (Array.isArray(value) ? value : [value]).map((record, index) => ({
          title: record?.personalProfile?.title || record?.name || record?.title || (key.includes('draft') ? '旧版个人草稿' : '旧版记录'),
          record, raw: JSON.stringify(record, null, 2), key, index
        }));
      } catch {
        return [{ title: '旧版记录无法解析 · 原数据保留', raw, key }];
      }
    });
  }
  function home() {
    show('home');
    notices('home-status', '模型规则版本：2026-11-24 · 待真人研究验证');
  }
  function start(scope, fresh = false) {
    let draft = fresh ? null : storage.draft(scope);
    if (!fresh && storage.issues.get('draft_' + scope)?.kind === 'read') {
      history(); notices('import-status', '该模式草稿无法继续。可先导出原数据，再重新读取。'); return;
    }
    if (fresh && storage.issues.get('draft_' + scope)?.kind === 'read') {
      history(); return;
    }
    draft ||= D.newDraft(scope);
    enter(draft, fresh);
  }
  function enter(draft, fresh = false) {
    state.draft = draft;
    storage.saveDraft(draft);
    if (!fresh && draft.order.every(id => Object.hasOwn(draft.answers, id))) return finish();
    draft.cursor = draft.order.findIndex(id => !Object.hasOwn(draft.answers, id));
    if (draft.cursor < 0) draft.cursor = 0;
    renderQuestion(); show('depth-quiz'); $('depth-text').focus({ preventScroll: true });
  }
  function renderQuestion() {
    const draft = state.draft, q = D.items.get(draft.order[draft.cursor]);
    $('depth-mode').textContent = modeNames[draft.mode];
    $('depth-instruction').textContent = q.mode === 'history'
      ? '回想最近 12 个月内，最近一次符合题意的事。没有相关经历时直接跳过，不需要猜测。'
      : '选择最接近你通常会做的行动。不同条件可以采用不同做法；不确定时可以跳过。';
    $('depth-kind').textContent = `${q.mode === 'history' ? '自述经历' : '情境意向'} · ${q.phase === 'core' ? '核心观察' : '补充观察'}`;
    $('depth-progress').textContent = `第 ${draft.cursor + 1} / ${draft.order.length} 题`;
    $('depth-progress-bar').style.width = `${draft.cursor / draft.order.length * 100}%`;
    $('depth-text').textContent = q.text;
    $('depth-text').dataset.questionId = q.id;
    $('depth-followup-reason').textContent = q.phase === 'followup'
      ? (state.reasons[q.id] || '按统一规则补充经历与情境，不因补问获得更高权重。') : '';
    const selection = draft.answers[q.id];
    $('depth-options').innerHTML = q.options.map(o => `<button type="button" class="option${selection === o.id ? ' selected' : ''}" data-option-id="${esc(o.id)}" aria-pressed="${selection === o.id}">
      <span class="option-label">${esc(o.text)}</span><span class="choice-marker" aria-hidden="true">${selection === o.id ? '✓' : ''}</span></button>`).join('');
    $('depth-options').querySelectorAll('button').forEach(b => b.onclick = () => select(b.dataset.optionId));
    const skipped = Object.hasOwn(missingNames, selection);
    $('depth-skip').classList.toggle('selected', skipped);
    $('depth-skip').setAttribute('aria-pressed', String(skipped));
    $('depth-prev').disabled = draft.cursor === 0;
    $('depth-next').disabled = selection === undefined;
    $('depth-next').textContent = draft.cursor === draft.order.length - 1 ? '查看报告' : '下一题';
    $('depth-stop-followup').classList.toggle('hidden', draft.stage === 'core');
    notices('depth-quiz-status', selection === undefined ? '选择后立即保存；点击下一题继续。' : '已记录本题选择，可修改或继续。');
  }
  function select(selection) {
    const draft = state.draft, id = draft.order[draft.cursor];
    D.choose(draft, id, selection); storage.saveDraft(draft);
    document.querySelectorAll('#depth-options button, #depth-skip').forEach(b => {
      const chosen = b.id === 'depth-skip' ? Object.hasOwn(missingNames, selection) : b.dataset.optionId === selection;
      b.classList.toggle('selected', chosen); b.setAttribute('aria-pressed', String(chosen));
      const marker = b.querySelector('.choice-marker'); if (marker) marker.textContent = chosen ? '✓' : '';
    });
    $('depth-next').disabled = false;
    notices('depth-quiz-status', '已记录本题选择，可修改或继续。');
  }
  function move(delta) {
    const draft = state.draft;
    if (delta > 0 && !Object.hasOwn(draft.answers, draft.order[draft.cursor])) return;
    if (delta > 0 && draft.cursor === draft.order.length - 1) return finish();
    draft.cursor = Math.max(0, Math.min(draft.order.length - 1, draft.cursor + delta));
    storage.saveDraft(draft); renderQuestion(); $('depth-text').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function finish() {
    try {
      const report = D.snapshot(state.draft);
      const existing = (storage.list('reports') || []).find(r => r.version === report.version && r.scope === report.scope &&
        JSON.stringify(r.answers) === JSON.stringify(report.answers) && JSON.stringify(r.order) === JSON.stringify(report.order) &&
        JSON.stringify(r.notes || {}) === JSON.stringify(report.notes || {}));
      if (existing) return reportView(existing);
      storage.append('reports', report); reportView(report);
    } catch (error) { notices('depth-quiz-status', error.message); }
  }
  function dimensions(profile) {
    return `<div class="profile-dimensions">${profile.axes.map(a =>
      `<details class="profile-dimension" id="profile-axis-${esc(a.id)}">
        <summary><span class="dimension-heading"><strong>${esc(a.name)}</strong><span class="dimension-level${a.value === null ? ' unknown' : ''}">${a.value === null ? '待观察' : a.value + '%'}</span></span>
          <span class="dimension-track${a.value === null ? ' unknown' : ''}" aria-hidden="true"><span style="width:${a.value ?? 0}%"></span></span>
        </summary><div class="dimension-detail"><h4>${esc(a.heading)}</h4><p>${esc(a.short)}</p>
          <p class="dimension-observe">${esc(a.task)}</p></div></details>`).join('')}</div>`;
  }
  function attentions(profile) {
    if (!profile.hasEvidence) return '';
    return `<section class="report-section profile-attentions"><div class="section-heading"><h3>需要留意</h3><span>${profile.risks.length ? profile.risks.length + ' 项提示' : '持续观察'}</span></div>${profile.risks.length
      ? `<div class="profile-cautions">${profile.risks.map(r => `<details class="profile-caution${r.priority ? ' priority' : ''}">
        <summary><span class="caution-heading"><strong>${esc(r.title)}</strong><span>${r.priority ? '优先留意' : r.repeated ? '重复出现' : '情境提示'}</span></span><span class="caution-short">${esc(r.short)}</span></summary>
        <div class="caution-detail"><p>${esc(r.description)}</p><p class="muted">${esc(r.recurrence)}</p>
          ${r.counter ? `<p class="muted">${esc(r.counter)}</p>` : ''}<p class="muted">${esc(r.limit)}</p></div></details>`).join('')}</div>`
      : '<p class="muted">目前没有明显风险提示，长期表现仍需观察。</p>'}</section>`;
  }
  function affinities(profile) {
    const a = profile.affinities;
    if (!a.available) return `<section class="report-section profile-affinities"><h3>相处契合参考</h3><p class="muted">主要取向还不明确，先看各维度的解析。</p></section>`;
    return `<section class="report-section profile-affinities"><div class="section-heading"><h3>相处契合参考</h3><span>从关注点理解差异</span></div>
      ${a.riskFirst ? '<p class="affinity-risk-note">先核对上方重复或边界风险，再参考类型共同点。</p>' : ''}
      <div class="affinity-tabs" role="tablist" aria-label="类型相处参考">${a.groups.map((g, i) =>
        `<button type="button" role="tab" id="affinity-tab-${g.id}" aria-controls="affinity-panel-${g.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-affinity-tab="${g.id}">${esc(g.label)}<span>${g.entries.length}</span></button>`).join('')}</div>
      ${a.groups.map((g, i) => `<div class="affinity-panel${i ? ' hidden' : ''}" role="tabpanel" id="affinity-panel-${g.id}" aria-labelledby="affinity-tab-${g.id}" tabindex="0">
        <div class="affinity-list">${g.entries.map(t => `<details class="affinity-entry" data-affinity-type="${esc(t.id)}">
          <summary><span class="affinity-symbol" aria-hidden="true">${V.animal(t.symbol, t.animal)}</span><span><strong>${esc(t.name)}型 <small>${esc(t.glyph)}</small></strong><span class="affinity-reason">${esc(t.reason)}</span></span><span class="affinity-expand" aria-hidden="true">+</span></summary>
          <p class="affinity-discussion">可以先谈：${esc(t.discussion)}</p></details>`).join('') || '<p class="muted">当前没有明确落入这一组的类型。</p>'}</div></div>`).join('')}
      <p class="affinity-note">${esc(a.note)}</p></section>`;
  }
  function domainDescription(topic) {
    if (!topic.covered) return '这一领域的信息还不充分，目前不判断相处方式是否一致或稳定。';
    const names = kind => [...new Set(topic.evidence.flatMap(r => r.tags)
      .filter(t => M.tags[t].kind === kind).map(t => M.tags[t].name))];
    const protect = names('protect'), risk = names('risk'), preference = names('preference');
    return [
      protect.length ? `呈现的做法包括${protect.join('、')}。` : '持续承担与知情协商的做法还不够突出。',
      preference.length ? `相处取舍中也呈现${preference.join('、')}的特点。` : '',
      risk.length ? `需要留意${risk.join('、')}的倾向及其对共同生活的影响。` : ''
    ].filter(Boolean).join(' ');
  }
  function marriageDomains(summary) {
    return `<details class="profile-more profile-domains"><summary>共同生活 · 12 个领域</summary><div>${summary.topics.map(t =>
      `<details class="topic-row"><summary><strong>${esc(t.name)}</strong></summary>
        <p>${esc(domainDescription(t))}</p><p class="muted">${esc(domainTasks[t.id - 1])}</p></details>`).join('')}</div></details>`;
  }
  function reportView(rawReport) {
    try { state.report = D.interpret(rawReport); } catch (error) {
      rawView({ title: error.message, record: rawReport, raw: JSON.stringify(rawReport, null, 2) }); return;
    }
    const report = state.report, summary = report.derived, profile = P.present(report), n = profile.narrative;
    $('report-mode').textContent = modeNames[report.scope];
    const highlights = profile.identity.selected.length ? profile.identity.selected :
      profile.axes.filter(a => a.value !== null).sort((a, b) => b.value - a.value).slice(0, 3);
    $('depth-report').innerHTML = `<header class="profile-hero">
      <div class="profile-intro"><p class="profile-eyebrow">${esc(n.eyebrow)}</p><h2>${esc(n.title)}</h2>
        <p class="profile-subtitle">${esc(n.subtitle)}</p></div>
      <figure class="profile-emblem${n.symbols.length > 1 ? ' paired' : ''}">
        <div class="profile-symbols">${n.symbols.length ? n.symbols.map(s => V.animal(s.symbol, s.animal)).join('') : V.pattern()}</div>
        <figcaption>${esc(n.symbols.map(s => s.animal).join(' · ') || '星图象征')}</figcaption>
      </figure><p class="profile-summary">${esc(n.description)}</p>
      ${highlights.length ? `<div class="profile-highlights">${highlights.map(t =>
        `<div class="profile-highlight"><span>${esc(t.glyph || '·')}</span><div><strong>${esc(t.name)}</strong><p>${t.value}% <small>采用比例</small></p></div></div>`).join('')}</div>` : ''}
      ${highlights.length ? '<p class="profile-ratio-note">相关题中体现该取向的比例；取向可重叠，不相加为 100%。</p>' : ''}
      </header>
      <section class="report-section profile-radar-section"><div class="section-heading"><h3>维度解析</h3><span>点击维度，展开解析</span></div>
        <div class="profile-outline"><figure class="profile-chart">${V.radar(profile.axes)}<figcaption>${esc(profile.radarNote)}</figcaption></figure>
          ${dimensions(profile)}</div></section>
      ${attentions(profile)}${affinities(profile)}
      ${n.tension || profile.preferences.length ? `<details class="profile-more"><summary>价值取舍与行动建议</summary>
        ${n.tension ? `<p class="profile-tension">${esc(n.tension)}</p>` : ''}
        <div class="profile-preferences">${profile.preferences.map(p => `<article><h4>${esc(p.name)}</h4>
          <p>${esc(p.description)}</p><p class="muted">${esc(p.note)}</p></article>`).join('')}</div></details>` : ''}
      ${report.scope === 'marriage' ? marriageDomains(summary) : ''}
      <p class="profile-footnote">画像来自当前自述，类型与动物仅帮助理解；真实相处仍需看长期行动。</p>`;
    const queue = E.followups(report.scope, report.answers, false);
    const expanded = E.followups(report.scope, report.answers, true);
    $('report-followup').disabled = !expanded.length;
    $('report-followup').textContent = queue.length ? `自动补充观察 · 最多 ${queue.length} 题` : expanded.length ? `继续扩展观察 · 最多 ${expanded.length} 题` : '已完成本题库观察';
    $('depth-report').querySelectorAll('[data-focus-axis]').forEach(label => {
      const focus = () => {
        const target = $('profile-axis-' + label.dataset.focusAxis);
        target.open = true;
        target.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        target.querySelector('summary').focus({ preventScroll: true });
      };
      label.onclick = focus;
      label.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focus(); }
      };
    });
    const tabs = [...$('depth-report').querySelectorAll('[data-affinity-tab]')];
    function activate(tab) {
      tabs.forEach(t => {
        const selected = t === tab;
        t.setAttribute('aria-selected', selected); t.tabIndex = selected ? 0 : -1;
        $('affinity-panel-' + t.dataset.affinityTab).classList.toggle('hidden', !selected);
      });
    }
    tabs.forEach((tab, i) => {
      tab.onclick = () => activate(tab);
      tab.onkeydown = event => {
        let next;
        if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); activate(tabs[next]); tabs[next].focus(); }
      };
    });
    notices('report-status');
    show('depth-report');
  }
  function reportDraft() {
    const r = state.report;
    return { ...D.newDraft(r.scope), answers: D.copy(r.answers), order: D.copy(r.order),
      ...(r.notes !== undefined ? { notes: D.copy(r.notes) } : {}),
      ...(r.consent !== undefined ? { consent: D.copy(r.consent) } : {}), cursor: 0,
      stage: r.order.length > D.coreCount(r.scope) ? 'automatic' : 'core' };
  }
  function edit(id) {
    const draft = reportDraft();
    draft.cursor = id && draft.order.includes(id) ? draft.order.indexOf(id) : 0;
    state.draft = draft; storage.saveDraft(draft);
    renderQuestion(); show('depth-quiz'); $('depth-text').focus({ preventScroll: true });
  }
  function supplement() {
    const draft = reportDraft(), unanswered = draft.order.filter(id => !Object.hasOwn(draft.answers, id));
    let queue = E.followups(draft.mode, draft.answers, false);
    let expanded = false;
    if (!queue.length) { expanded = true; queue = E.followups(draft.mode, draft.answers, true); }
    queue.forEach(entry => state.reasons[entry.id] = entry.reason);
    const newIds = queue.map(x => x.id).filter(id => !draft.order.includes(id));
    draft.order.push(...newIds);
    if (!unanswered.length && !newIds.length) return;
    draft.stage = expanded ? 'expanded' : 'automatic';
    draft.cursor = draft.order.indexOf(unanswered[0] || newIds[0]);
    state.draft = draft; storage.saveDraft(draft); renderQuestion(); show('depth-quiz'); $('depth-text').focus({ preventScroll: true });
  }
  function history() {
    const reports = storage.list('reports') || [], imports = storage.list('imports') || [];
    const legacy = readLegacy();
    $('depth-history').innerHTML = `
      <section class="report-section"><h3>当前版本报告 · ${reports.length} 份</h3>${reports.length ? [...reports].reverse().map((r, index) =>
        `<div class="history-item"><div><strong>${esc(modeNames[r.scope] || '报告')}</strong><p>${esc(date(r.createdAt))} · ${esc(r.version)}</p></div>
          <button type="button" class="btn btn-ghost" data-report-index="${reports.length - index - 1}">查看</button></div>`).join('') : '<p class="muted">尚无已保存的当前版本报告。</p>'}</section>
      <section class="report-section"><h3>可继续的草稿</h3>${['personal', 'marriage'].map(scope => {
        const draft = storage.draft(scope);
        return draft ? `<div class="history-item"><div><strong>${modeNames[scope]}</strong><p>已处理 ${Object.keys(draft.answers).length} / ${draft.order.length} 题</p></div>
          <button type="button" class="btn btn-ghost" data-resume="${scope}">继续</button></div>` : '';
      }).join('') || '<p class="muted">尚无可读取的草稿。</p>'}</section>
      <section class="report-section"><h3>旧版与不兼容记录 · ${legacy.length + imports.length} 份</h3>
        ${legacy.map((r, i) => `<div class="history-item"><div><strong>${esc(r.title)}</strong><p>${esc(r.record?.version || r.record?.assessmentVersion || '原版本')}</p></div>
          <button type="button" class="btn btn-ghost" data-legacy="${i}">按原文查看</button></div>`).join('')}
        ${imports.map((r, i) => `<div class="history-item"><div><strong>不兼容的导入记录</strong><p>${esc(r.original?.version || '未知版本')}</p></div>
          <button type="button" class="btn btn-ghost" data-import-raw="${i}">按原文查看</button></div>`).join('')}
      </section>`;
    $('depth-history').querySelectorAll('[data-report-index]').forEach(b => b.onclick = () => reportView(reports[Number(b.dataset.reportIndex)]));
    $('depth-history').querySelectorAll('[data-resume]').forEach(b => b.onclick = () => start(b.dataset.resume));
    $('depth-history').querySelectorAll('[data-legacy]').forEach(b => b.onclick = () => rawView(legacy[Number(b.dataset.legacy)]));
    $('depth-history').querySelectorAll('[data-import-raw]').forEach(b => b.onclick = () => {
      const r = imports[Number(b.dataset.importRaw)]; rawView({ title: '不兼容的导入报告', record: r.original, raw: JSON.stringify(r.original, null, 2) });
    });
    notices('import-status'); show('depth-history');
  }
  function rawView(record) {
    state.raw = record;
    $('raw-title').textContent = record.title || '原记录';
    $('raw-content').textContent = record.raw || JSON.stringify(record.record, null, 2);
    const r = record.record || {}, profile = r.personalProfile;
    const texts = [profile?.summary, r.core, r.strength, r.risk, r.explanation?.summary].filter(x => typeof x === 'string');
    const answers = (Array.isArray(r.topics) ? r.topics : []).flatMap(t => Array.isArray(t?.facets) ? t.facets : []).filter(a => a && (a.questionText || a.text))
      .map(a => ({ text: a.questionText, answer: a.text, id: a.questionId }))
      .concat(Array.isArray(r.answers) ? r.answers.map(a => ({ text: a.questionText, answer: a.optionText, id: a.questionId })) : []);
    $('raw-readable').innerHTML = `<div class="raw-summary">${texts.map(t => `<p>${esc(t)}</p>`).join('')}
      ${answers.length ? `<details class="report-evidence"><summary>原题目与回答 · ${answers.length} 项</summary>${answers.map(a =>
        `<p><span class="muted">${esc(a.id)}</span> ${esc(a.text)}<br>原选择：${esc(a.answer || '尚未回答')}</p>`).join('')}</details>` : ''}
      </div>`;
    show('depth-raw');
  }
  async function importReport(file) {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('文件超过 8 MB，请只导入单份报告');
      const text = await file.text(), original = JSON.parse(text);
      if (!original || typeof original !== 'object' || Array.isArray(original)) throw new Error('需要单份 JSON 报告对象');
      if (original.format !== 'rct-depth-report' || original.version !== M.version || !D.compatibleEngine(original.engineVersion)) {
        const r = { reportId: D.uid(), original, createdAt: new Date().toISOString() };
        state.importRaw = r;
        storage.append('imports', r); history();
        notices('import-status', '版本不兼容：已保留原文，不参与新算法计算。'); return;
      }
      const interpreted = D.interpret(original);
      const list = storage.list('reports');
      if (list === null) throw new Error('本地报告列表损坏，导入内容未覆盖原数据');
      const duplicate = list.find(r => r.reportId === interpreted.reportId);
      if (duplicate) {
        if (JSON.stringify(duplicate.answers) !== JSON.stringify(interpreted.answers) ||
            JSON.stringify(duplicate.notes) !== JSON.stringify(interpreted.notes) ||
            duplicate.scope !== interpreted.scope || JSON.stringify(duplicate.order) !== JSON.stringify(interpreted.order))
          throw new Error('已有相同标识但内容不同的报告，不能覆盖');
        notices('import-status', '该报告已经存在。'); return;
      }
      storage.append('reports', interpreted); history();
      notices('import-status', '已导入并由题库选项重新核对。导入的计数与说明未被当作计算输入。');
    } catch (error) { notices('import-status', `导入失败：${error.message}`); }
    finally { $('report-import').value = ''; }
  }
  function exportAll() {
    const raw = {};
    legacyKeys.forEach(key => {
      try { raw[key] = window.localStorage.getItem(key); } catch (error) { raw[key] = { readError: error.message }; }
    });
    ['draft_personal', 'draft_marriage', 'reports', 'imports', 'comparisons'].forEach(name => raw[D.PREFIX + name] = storage.raw(name));
    download({ format: 'rct-local-backup', version: M.version, exportedAt: new Date().toISOString(),
      rawRecords: raw, memory: { draft: state.draft, currentReport: state.report,
        reports: storage.list('reports'), imports: storage.list('imports'), comparisons: storage.list('comparisons'),
        pendingImport: state.importRaw } }, 'RCT-全部本地记录.json');
  }
  function init() {
    $('type-library').innerHTML = `<div class="type-library-list">${M.prototypes.map(t =>
      `<article><span class="library-glyph">${esc(window.RCT_IDENTITY.personal[t.id].glyph)}</span><div><strong>${esc(window.RCT_IDENTITY.personal[t.id].name)}型</strong><p>${esc(window.RCT_IDENTITY.personal[t.id].focus)}</p></div></article>`).join('')}</div>`;
    document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => start(b.dataset.start));
    document.querySelectorAll('[data-home]').forEach(b => b.onclick = home);
    $('btn-history').onclick = history;
    $('depth-prev').onclick = () => move(-1); $('depth-next').onclick = () => move(1);
    $('depth-skip').onclick = () => select('skipped');
    $('depth-pause').onclick = () => { storage.saveDraft(state.draft); home(); };
    $('depth-stop-followup').onclick = finish;
    $('report-followup').onclick = supplement; $('report-edit').onclick = () => edit();
    $('report-new').onclick = () => start(state.report.scope, true);
    $('report-export').onclick = () => download(state.report, `RCT-${modeNames[state.report.scope]}-${state.report.reportId}.json`);
    $('report-import').onchange = () => importReport($('report-import').files[0]);
    $('history-export').onclick = exportAll;
    $('history-retry').onclick = () => { storage.retry(); history(); };
    $('raw-back').onclick = history;
    $('raw-export').onclick = () => download(state.raw.raw || state.raw.record, 'RCT-原版本记录.json');
    ['personal', 'marriage'].forEach(scope => storage.draft(scope));
    storage.list('reports'); home();
  }
  // Expose observed state for automated regression; ordinary UI never displays score tags while answering.
  window.RCT_DEPTH = { state, storage, start, reportView, exportAll, importReport };
  document.addEventListener('DOMContentLoaded', init);
})();
