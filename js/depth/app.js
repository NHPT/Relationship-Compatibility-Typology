(function () {
  'use strict';
  const D = window.RCT_DEPTH_DATA, M = D.model, E = window.RCT_ENGINE;
  const storage = D.store({
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value)
  });
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const missingNames = { skipped: '未回答', no_experience: '没有相关经历／不适用', uncertain: '不确定', declined: '不愿回答' };
  const modeNames = { personal: '个人深度测评', marriage: '婚恋深度测评' };
  const typeStates = { incomplete: '观察不足', mixed: '混合模式', unclassified: '未归类', invalid_input: '输入无效' };
  const riskStates = { boundary_safety_review: '边界或安全行动待核对',
    repeated_answer_signal: '跨主题重复风险信号', single_or_same_topic_signal: '单项或同主题风险待核对',
    no_risk_answer_observed: '本次未观察到风险选项' };
  const pairStates = { risk_review: '边界风险待核对', unknown: '资料不足',
    difference: '可协商差异', confirmed_agreement: '明确一致' };
  const legacyKeys = ['rct_exploration_draft_v1', 'rct_exploration_reports_v1', 'rct_history_v1', 'rct_outcomes_v1'];
  const state = { draft: null, report: null, reasons: {}, pair: null, raw: null, importRaw: null };
  const consequences = {
    '信息透明': ['相关方可能基于不完整或错误信息作决定。', '核对利益变化、债务与承诺变化时，实际告知了谁、何时告知。'],
    '承诺履行': ['合作方或伴侣可能突然承担中断、等待和交接成本。', '核对一次真实履约、变更告知与退出善后记录。'],
    '责任与修复': ['受影响的人可能需要独自处理错误和后果。', '核对发生差错后是否承认责任、采取补救并跟进结果。'],
    '自主与边界': ['对方的拒绝权、隐私或安全可能受到限制。', '分别确认能否拒绝、离开、保留隐私，以及拒绝后会发生什么。'],
    '公平互惠': ['他人可能在不知情的情况下失去资源或承担额外成本。', '核对共同资源权限、分配规则及实际知情同意。'],
    '关怀与照料': ['处于脆弱或困难中的人可能受到羞辱，或无法获得已约定的支持。', '核对真实困难中的有限帮助、照料分工与是否借付出施压。'],
    '风险管理': ['自己或被要求兜底的人可能承担未经充分评估的损失。', '核对预算、备用安排、退出条件与谁同意承担后果。'],
    '学习与复盘': ['未核对的错误可能重复，影响共同判断和后续交付。', '核对反馈后的实际修正，以及新证据能否改变做法。'],
    '冲突与报复': ['对方可能因冲突承受威胁、关系破坏或资源损失。', '核对争执后的暂停、回谈与是否存在报复或破坏。']
  };
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
  const domainPaths = [
    '关系时间预期改变时，若双方及时告知并履行交接安排，可减少长期等待与突然中断；若继续作不真实保证，另一方可能基于错误预期投入。',
    '重要交往边界改变时，若忠实约定明确且变化及时披露，可按约定重新确认；若相关接触被隐瞒，信任冲突可能扩大。',
    '工作量或照料需求增加时，若双方持续核对任务并调整分工，可减少单方长期负担；若任务口头分配却无人跟进，负担可能集中到一人。',
    '双方家人需要支持或介入决定时，若支持范围与共同决策权明确，可协调有限帮助；若一方代替两人承诺，可能发生家庭边界冲突。',
    '收入、债务或共同支出变化时，若双方获得完整信息并分别同意，可共同调整预算；若资金信息被隐藏，另一方可能在不知情时承担损失。',
    '大额消费、借贷或投资出现时，若预算与兜底责任得到知情确认，可及时限制共同风险；若未经同意要求对方承担损失，财务冲突可能扩大。',
    '生育与育儿计划变化时，若双方尊重自愿、明确照料分工，可继续协商各自选择；若把不同意视为不负责任或施压，拒绝权可能受到损害。',
    '争执重复出现时，若暂停后按约回谈并跟进修复，可减少问题积累；若用失联、羞辱或报复代替讨论，冲突可能加深。',
    '失业或疾病持续时，若双方按备用预算、照料任务与资源上限调整，可维持有边界的互助；若突然失联或转嫁全部责任，另一方可能独自承受后果。',
    '一方拒绝、需要隐私或希望离开时，若拒绝权得到尊重，可以重新协商安排；若用威胁、限制或依赖关系施压，应先核对安全和自主。',
    '亲密需求存在差异时，若允许拒绝并表达各自需要，可协商双方接受的方式；若把亲密当作义务或交换条件，可能形成持续压力。',
    '搬家、职业或长期目标变化时，若及时告知并确认对方投入，可调整计划与分工；若单方决定后要求对方兜底，可能增加机会成本与关系冲突。'
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
  function evidence(rows, label, editable = true) {
    if (!rows.length) return '<p class="muted">尚无相关有效回答；不能当作中性或良好表现。</p>';
    return `<details class="report-evidence"><summary>${esc(label)} · ${rows.length} 题</summary>${rows.map(row => {
      const tags = row.matchingTags || row.tags;
      return `<article class="evidence-row" data-evidence-id="${esc(row.questionId)}">
        <p class="source">${esc(row.questionId)} · ${row.mode === 'history' ? '本人回忆 · 未核实' : '情境意向 · 未发生也可能改变'} · ${row.phase === 'core' ? '核心' : '补问'}</p>
        <p>${esc(row.text)}</p><p class="chosen">所选行动：${esc(row.answer)}</p>
        <p class="labels">${tags.map(t => `<span class="${M.tags[t].kind === 'risk' ? 'risk-text' : M.tags[t].kind === 'protect' ? 'protect-text' : ''}">${esc(M.tags[t].name)}</span>`).join('；')}</p>
        ${editable ? `<button type="button" class="question-edit" data-edit-question="${esc(row.questionId)}">回看与修改这道题</button>` : ''}
      </article>`;
    }).join('')}</details>`;
  }
  function prototype(type, heading) {
    return `<article class="prototype-row"><h4>${esc(heading)} ${esc(type.id)} · ${esc(type.name)}</h4>
      <p>相关主题覆盖 ${type.keyCoverage} / 8；支持 ${type.support.length} / ${type.observed} 个已答机会，描述匹配值 ${type.match === null ? '未知' : type.match.toFixed(2)}；经历支持 ${type.support.filter(r => r.mode === 'history').length} 题；反证 ${type.counter.length} 题。</p>
      ${evidence(type.support, '查看支持来源')}${type.counter.length ? evidence(type.counter, '查看反证') : ''}</article>`;
  }
  function typeSection(classification) {
    const primary = classification.primary;
    return `<section class="report-section"><h3>14 类描述摘要</h3>
      <p>${primary ? `本次主型为 ${esc(primary.id)} ${esc(primary.name)}。` :
        `${esc(typeStates[classification.status] || '未形成唯一主型')}：现有核心回答不满足唯一主型的显示条件。`}</p>
      <p class="muted">只使用核心回答归类。匹配值是支持机会比例，不是准确率或未来行为概率；反证不由其他长处抵消。</p>
      ${primary ? prototype(primary, '主型') : ''}
      ${classification.secondary ? prototype(classification.secondary, '辅助摘要') : ''}
      <details class="depth-library"><summary>查看全部 14 原型及未归类原因</summary>
        ${classification.rows.map(type => {
          const reason = !type.covered ? '相关或全局覆盖不足' : type.counter.length ? '存在指定反证'
            : type.support.length < 4 ? '支持题不足' : !type.support.some(r => r.mode === 'history') ? '缺少经历支持'
            : type.match < M.parameters.typeMinMatch ? '支持比例不足'
            : type.id !== primary?.id ? '与其他原型的领先差距或排序条件不足' : '达到主型显示条件';
          return prototype(type, reason + ' · ');
        }).join('')}
        <p>显示规则暂定：全局至少 36 主题、关联至少 6 主题达到核心覆盖；至少 4 题支持且含经历；匹配值至少 0.60，无指定反证；领先覆盖充分的次位原型至少 0.15。</p>
      </details></section>`;
  }
  function signal(indicator) {
    const risks = indicator.risk, consequence = consequences[indicator.name] || ['需要结合具体情境核对。', '核对一次实际行动及其后果。'];
    const note = indicator.status === 'repeated_answer_signal'
      ? (indicator.historyRisk ? '跨主题重复回答中包含自述经历，仍未核实。' : '这些重复风险回答全部是情境意向，不能称为已发生行为。')
      : indicator.status === 'boundary_safety_review' ? '单题已出现明确边界或安全行动，单列核对，不等待重复阈值。'
      : '尚不足以称为跨主题重复行为，保留题目条件核对。';
    return `<article class="signal"><h4>${esc(indicator.name)}<span class="signal-status">${esc(riskStates[indicator.status])}</span></h4>
      <div class="signal-numbers"><span class="risk-text">风险 ${risks.length} 题 / ${indicator.topicCount} 主题</span>
        <span class="protect-text">相反保护证据 ${indicator.protect.length} 题</span><span>风险中经历 ${indicator.historyRisk} 题</span></div>
      <p>${esc(note)}</p><p>触发条件与所选行动：</p>${evidence(risks, '查看完整风险题干、选择与出处')}
      <p>可能后果：${esc(consequence[0])}</p>
      ${evidence(indicator.protect, '同指标相反证据')}
      <p>未知：回答是否与真实反复表现一致、条件变化后怎样行动，当前均未确认。</p>
      <p>观察任务：${esc(consequence[1])}</p></article>`;
  }
  function judgmentSections(summary) {
    const groups = [
      ['可靠性与责任', ['信息透明', '承诺履行', '责任与修复', '公平互惠'], '核对实际履约、变更披露、责任补救与知情分配；实际能力和交付质量还需另行观察。'],
      ['忠诚、利益与边界', ['信息透明', '承诺履行', '自主与边界', '价值取舍'], '收益优先与侵占、隐瞒、违约分别记录。守约意向不能保证未来忠诚；不把合理拒绝与负责退出当作背叛。'],
      ['创造与做成事情', ['探索偏好', '执行方式', '学习与复盘', '风险管理'], '点子、试验、反馈和推进分别看。真实作品质量、专业能力、资源机会及未来成就仍未观察。']
    ];
    return groups.map(([title, names, boundary]) => `<section class="report-section"><h3>${title}</h3><p>${boundary}</p>
      ${names.map(name => {
        const i = summary.indicators.find(row => row.name === name);
        return `<article class="signal"><h4>${esc(name)}</h4><div class="signal-numbers">
          <span class="protect-text">保护 ${i?.protect.length || 0}</span><span class="risk-text">风险 ${i?.risk.length || 0}</span><span>偏好 ${i?.preference.length || 0}</span></div>
          ${i ? ['protect', 'risk', 'preference'].filter(kind => i[kind].length).map(kind =>
            evidence(i[kind], { protect: '保护行动', risk: '风险行动', preference: '价值取舍与做法偏好' }[kind])).join('')
            : '<p class="muted">尚无该指标的可解释证据。</p>'}</article>`;
      }).join('')}</section>`).join('');
  }
  function topicDisplayName(scope, topic) {
    if (scope === 'personal' && topic.id === 4) return '自愿与身体边界';
    if (scope === 'personal' && topic.id === 21) return '长期关系意愿与告知';
    return topic.name;
  }
  function topicsSection(summary) {
    const minimum = summary.scope === 'personal' ? 2 : 4;
    const catalog = summary.scope === 'personal' ? M.personalTopics : M.marriageDomains;
    return `<section class="report-section"><h3>${summary.scope === 'personal' ? '48 主题 · 完整证据' : '12 婚恋领域 · 完整证据'}</h3>
      <p>达到核心覆盖只表示题目有效，不表示每个子项均被充分测量。没有经历、不确定、不愿回答和未问分别保留。</p>
      ${summary.topics.map(topic => {
        const t = catalog.find(x => x.id === topic.id), risk = topic.evidence.filter(r => r.tags.some(tag => M.tags[tag].kind === 'risk'));
        const protect = topic.evidence.filter(r => r.tags.some(tag => M.tags[tag].kind === 'protect'));
        return `<details class="topic-row" data-topic="${topic.id}"><summary><strong>${String(topic.id).padStart(2, '0')} ${esc(topicDisplayName(summary.scope, topic))}</strong><span>${topic.core}/${minimum} 核心 · ${topic.history} 经历</span></summary>
          <p>支持保护行动 ${protect.length} 题；风险行动 ${risk.length} 题；${topic.covered ? '达到最低核心覆盖' : '核心覆盖不足'}。</p>
          ${summary.scope === 'personal' ? `<p class="muted">原主题：${esc(t.name)}。${esc(t.boundary)}
            ${[4, 21].includes(topic.id) ? '性忠实、生育、伴侣间照料等在婚恋模式观察，本报告不补填对应分数。' : ''}</p>`
            : `<p>下一步共同议题：${esc(domainTasks[topic.id - 1])}</p>`}
          ${evidence(topic.evidence, '展开实际选择、价值取舍与条件')}
          <div class="topic-gaps"><strong>尚未观察／需要补充</strong><ul>
            ${topic.missing.map(m => `<li>${esc(m.questionId)}：${esc(missingNames[m.reason])} <button type="button" class="question-edit" data-edit-question="${esc(m.questionId)}">回看该题</button></li>`).join('')}
            ${topic.unasked.map(id => `<li>${esc(id)}：${D.items.get(id).phase === 'core' ? '核心题尚未回答' : '补充题未问，不作不存在解释'}</li>`).join('')}
            ${!topic.history ? '<li>没有该主题的有效自述经历。</li>' : ''}
            <li>长期重复表现、实际后果及另一方是否知情均未核实。</li></ul></div>
        </details>`;
      }).join('')}</section>`;
  }
  function reportView(rawReport) {
    try { state.report = D.interpret(rawReport); } catch (error) {
      rawView({ title: error.message, record: rawReport, raw: JSON.stringify(rawReport, null, 2) }); return;
    }
    const report = state.report, summary = report.derived;
    const riskSignals = summary.indicators.filter(i => i.risk.length).sort((a, b) =>
      (a.status === 'boundary_safety_review' ? -1 : 0) - (b.status === 'boundary_safety_review' ? -1 : 0) || b.risk.length - a.risk.length);
    $('report-mode').textContent = `${modeNames[report.scope]} · 报告快照`;
    const title = !summary.rows.length ? '尚无可解释证据' : report.scope === 'personal'
      ? report.classification.primary?.name || typeStates[report.classification.status]
      : '婚恋中的承诺、共同生活与边界';
    $('depth-report').innerHTML = `<header class="report-intro"><h2>${esc(title)}</h2>
      <p>情境题记录意向，经历题记录本人回忆；均未核实。风险、相反证据和未知分开呈现，没有人格或婚姻总分。</p>
      <p class="report-version">${esc(report.version)} / ${esc(report.engineVersion)} · ${esc(date(report.createdAt))} · ${esc(report.reportId)}</p></header>
      <div class="coverage-line"><span><strong>${summary.rows.length}</strong>有效回答</span><span><strong>${summary.missing.length}</strong>跳过</span>
        <span><strong>${summary.coveredTopics}</strong>/${summary.topics.length} 主题核心覆盖</span></div>
      <section class="report-section"><h3>优先核对的行动证据</h3>
        ${riskSignals.length ? riskSignals.map(signal).join('') : '<p>本次未观察到风险选项。这只描述已有回答，不能据此确认长期可靠、忠诚或没有隐瞒。</p>'}</section>
      ${report.scope === 'personal' ? typeSection(report.classification) + judgmentSections(summary)
        : `<section class="report-section"><h3>婚恋判断的四个层次</h3>
          <p>长期意愿、忠实约定、实际执行、变化善后分别看；家庭观由持续照料、分工、共同决策与边界组成。生育愿望、牺牲多少或是否维持婚姻都不能替代责任证据。</p>
          <p>${summary.rows.some(r => r.mode === 'history') ? '已有本人回忆的相处经历，仍缺少另一方确认及长期核验。' : '缺少伴侣间的行为观察。现有情境意向不能证明已经履行。'}</p>
          <p>逆境中的资源限制与负责退出，需与突然失联、侵占资源、威胁控制分别核对。</p>
          <button type="button" class="btn btn-ghost" id="report-open-pair">与另一份婚恋报告逐项对照</button></section>`}
      ${topicsSection(summary)}`;
    const queue = E.followups(report.scope, report.answers, false);
    const expanded = E.followups(report.scope, report.answers, true);
    $('report-followup').disabled = !expanded.length;
    $('report-followup').textContent = queue.length ? `自动补充观察 · 最多 ${queue.length} 题` : expanded.length ? `继续扩展观察 · 最多 ${expanded.length} 题` : '已完成本题库观察';
    $('depth-report').querySelectorAll('[data-edit-question]').forEach(b => b.onclick = () => edit(b.dataset.editQuestion));
    if ($('report-open-pair')) $('report-open-pair').onclick = pairHub;
    notices('report-status', '报告只描述本次回答，阈值待真人研究验证。保存与导出独立，分享由本人决定。');
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
    const reports = storage.list('reports') || [], imports = storage.list('imports') || [], pairs = storage.list('comparisons') || [];
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
      <section class="report-section"><h3>已保存的双方对照 · ${pairs.length} 份</h3>${pairs.map((p, index) =>
        `<div class="history-item"><div><strong>双方对照快照</strong><p>${esc(date(p.createdAt))}</p></div>
          <button type="button" class="btn btn-ghost" data-pair-history="${index}">查看原快照</button></div>`).join('')}</section>
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
    $('depth-history').querySelectorAll('[data-pair-history]').forEach(b => b.onclick = () => {
      const r = pairs[Number(b.dataset.pairHistory)]; rawView({ title: '双方对照快照 · 原确认状态', record: r, raw: JSON.stringify(r, null, 2) });
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
      ${r.format === 'rct-depth-comparison' ? `<p>保存时的领域状态：</p>${(Array.isArray(r.derived?.domains) ? r.derived.domains : []).map(d =>
        `<p>${esc(d.name)}：${esc(pairStates[d.status])}；约定：${esc(d.agreement?.statement || '尚未双方确认')}</p>`).join('')}` : ''}</div>`;
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
        notices('import-status', '版本不兼容：已保留原文，不参与新算法和双方对照。'); return;
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
        currentComparison: state.pair, pendingImport: state.importRaw } }, 'RCT-全部本地记录.json');
  }
  function pairReports() {
    return (storage.list('reports') || []).filter(r => r.scope === 'marriage').flatMap(r => {
      try { return [D.interpret(r)]; } catch { return []; }
    });
  }
  function pairHub() {
    state.pair = null; $('pair-content').replaceChildren(); $('pair-actions').classList.add('hidden');
    const reports = pairReports();
    ['pair-a', 'pair-b'].forEach(id => $(id).innerHTML = '<option value="">请选择实际报告</option>' +
      reports.map((r, index) => `<option value="${esc(r.reportId)}">报告 ${index + 1} · ${esc(date(r.createdAt))} · ${Object.keys(r.answers).length} 题</option>`).join(''));
    if (state.report?.scope === 'marriage') $('pair-a').value = state.report.reportId;
    notices('pair-status', reports.length < 2 ? '资料不足：需要两份同版本婚恋报告。可先导入另一人主动提供的报告。' : '选择两份不同报告，A、B 的身份由提供者核对。');
    show('depth-pair');
  }
  function loadPair() {
    const reports = pairReports(), a = reports.find(r => r.reportId === $('pair-a').value), b = reports.find(r => r.reportId === $('pair-b').value);
    if (!a || !b || a.reportId === b.reportId) { notices('pair-status', '请选择两份不同的实际婚恋报告，不能用同一份报告充当双方。'); return; }
    state.pair = { a, b, agreements: M.marriageDomains.map(d => ({ domainId: d.id, statement: '',
      partyAResponse: 'pending', partyBResponse: 'pending', status: 'single_party_statement' })) };
    renderPair(); $('pair-actions').classList.remove('hidden');
    notices('pair-status', '两份报告已读取。约定由本人分别记录回应；当前没有远程身份核验，不能证明另一方真实同意。');
  }
  function pairDerived() {
    return E.compare(state.pair.a.derived, state.pair.b.derived, state.pair.agreements);
  }
  function renderPair() {
    const result = pairDerived(), rank = { risk_review: 0, unknown: 1, difference: 2, confirmed_agreement: 3 };
    $('pair-content').innerHTML = [...result.domains].sort((a, b) => rank[a.status] - rank[b.status]).map(d => {
      const p = state.pair, a = p.a.derived.topics.find(t => t.id === d.id), b = p.b.derived.topics.find(t => t.id === d.id);
      const agreement = p.agreements.find(g => g.domainId === d.id);
      const responseOptions = '<option value="pending">尚未由本人记录回应</option><option value="accept">本人接受此约定</option><option value="reject">本人不接受／需调整</option>';
      return `<article class="pair-domain" data-pair-domain="${d.id}"><h3>${String(d.id).padStart(2, '0')} ${esc(d.name)}</h3>
        <p class="muted">A 核心 ${d.coverageA}/4；B 核心 ${d.coverageB}/4。以下都是本人作答，尚未核实。</p>
        <p>已答同一题中选择不同的有 ${a.evidence.filter(x => b.evidence.some(y => y.questionId === x.questionId && y.optionId !== x.optionId)).length} 题。可逐题讨论条件，选择不同本身不等于冲突。</p>
        ${evidence(a.evidence, 'A 的实际选择', false)}${evidence(b.evidence, 'B 的实际选择', false)}
        <p>共同议题：${esc(domainTasks[d.id - 1])}</p>
        <label class="oc-field"><span>写下双方需要确认的具体约定</span><textarea rows="3" maxlength="2000" data-agreement="${d.id}" placeholder="说明做什么、由谁做、变化时怎样告知">${esc(agreement.statement)}</textarea></label>
        <div class="pair-confirm">
          <label class="oc-field"><span>A 本人对当前这条约定的回应</span><select data-confirm-a="${d.id}">${responseOptions}</select></label>
          <label class="oc-field"><span>B 本人对当前这条约定的回应</span><select data-confirm-b="${d.id}">${responseOptions}</select></label>
        </div>
        <div class="pair-result" id="pair-result-${d.id}"></div></article>`;
    }).join('');
    $('pair-content').querySelectorAll('[data-agreement]').forEach(input => input.oninput = () => {
      const id = Number(input.dataset.agreement), g = state.pair.agreements.find(a => a.domainId === id);
      g.statement = input.value;
      // Editing the wording creates a new proposal; old confirmations never transfer.
      g.partyAResponse = 'pending'; g.partyBResponse = 'pending';
      delete g.partyAAt; delete g.partyBAt;
      document.querySelector(`[data-confirm-a="${id}"]`).value = 'pending';
      document.querySelector(`[data-confirm-b="${id}"]`).value = 'pending';
      updatePair();
    });
    ['a', 'b'].forEach(party => $('pair-content').querySelectorAll(`[data-confirm-${party}]`).forEach(select => {
      select.onchange = () => {
        const g = state.pair.agreements.find(a => a.domainId === Number(select.dataset[party === 'a' ? 'confirmA' : 'confirmB']));
        g[party === 'a' ? 'partyAResponse' : 'partyBResponse'] = select.value;
        g[party === 'a' ? 'partyAAt' : 'partyBAt'] = new Date().toISOString();
        updatePair();
      };
    }));
    updatePair();
  }
  function updatePair() {
    const result = pairDerived();
    result.domains.forEach(d => {
      const g = state.pair.agreements.find(a => a.domainId === d.id);
      const both = g.statement.trim() && [g.partyAResponse, g.partyBResponse].every(r => ['accept', 'reject'].includes(r));
      g.status = both ? 'both_responses_recorded' : 'single_party_statement';
      const condition = d.status === 'risk_review'
        ? '若隐瞒、强迫或违约的回答在现实中出现，共同决策或安全可能受损。应先核对原题行动、拒绝权、资源权限及实际后果；其他长处不抵消这些风险。'
        : d.status === 'unknown'
          ? '缺少有效核心回答或双方回应时，不能判断一致，也无法推断关系走向。先补足经历与具体约定。'
          : d.status === 'difference'
            ? '若一方不接受当前约定，执行中可能反复产生分工或边界争议。先重新商量并各自确认；差异本身不证明不适合。'
            : '若双方确实接受并持续履行这条约定，条件变化时可按约定调整；当前一致只指这一条约定，未证明实际执行或未来婚姻成功。';
      $(`pair-result-${d.id}`).innerHTML = `<span class="pair-state ${d.status}">${pairStates[d.status]}</span>
        <p>约定状态：${both ? '双方分别录入了回应' : '单方陈述／尚未双方确认'}。A：${esc({ pending: '未确认', accept: '接受', reject: '不接受／需调整' }[g.partyAResponse])}；B：${esc({ pending: '未确认', accept: '接受', reject: '不接受／需调整' }[g.partyBResponse])}。</p>
        <p>${esc(condition)}</p><p>本领域可核对的条件路径：${esc(domainPaths[d.id - 1])} 这些路径尚未验证，不是本次关系结局预测。</p>`;
    });
  }
  function pairSnapshot() {
    if (!state.pair) return null;
    const p = state.pair;
    return { format: 'rct-depth-comparison', comparisonId: D.uid(), version: M.version, engineVersion: D.ENGINE_VERSION,
      createdAt: new Date().toISOString(), reportAId: p.a.reportId, reportBId: p.b.reportId,
      reports: { a: D.copy(p.a), b: D.copy(p.b) }, agreements: D.copy(p.agreements), derived: pairDerived(),
      confirmationSource: 'separate_local_self_recording_unverified' };
  }
  function init() {
    $('type-library').innerHTML = `<div class="type-library-list">${M.prototypes.map(t =>
      `<article><span>${esc(t.id)}</span>${esc(t.name)}</article>`).join('')}</div>`;
    document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => start(b.dataset.start));
    document.querySelectorAll('[data-home]').forEach(b => b.onclick = home);
    $('btn-history').onclick = history; $('btn-pair').onclick = pairHub;
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
    $('pair-import').onclick = history; $('pair-load').onclick = loadPair;
    ['pair-a', 'pair-b'].forEach(id => $(id).onchange = () => {
      state.pair = null; $('pair-content').replaceChildren(); $('pair-actions').classList.add('hidden');
      notices('pair-status', '报告选择已变化，请重新读取；旧约定未迁移到新的两份报告。');
    });
    $('pair-save').onclick = () => {
      const snapshot = pairSnapshot(); if (!snapshot) return;
      storage.append('comparisons', snapshot);
      notices('pair-status', '已生成本次对照快照。后续修订另存，原确认状态保留。');
    };
    $('pair-export').onclick = () => {
      const snapshot = pairSnapshot(); if (snapshot) download(snapshot, 'RCT-双方婚恋对照.json');
    };
    ['personal', 'marriage'].forEach(scope => storage.draft(scope));
    storage.list('reports'); home();
  }
  // Expose observed state for automated regression; ordinary UI never displays score tags while answering.
  window.RCT_DEPTH = { state, storage, start, reportView, pairHub, exportAll, importReport };
  document.addEventListener('DOMContentLoaded', init);
})();
