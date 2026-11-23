const explorationState = {
  draft: null, groupId: null, questions: [], current: 0, pending: null,
  storageOK: true, report: null
};

function initExploration() {
  explorationState.draft = readExplorationDraft();
  el('btn-exploration').addEventListener('click', openExploration);
  document.querySelectorAll('[data-ex-hub]').forEach(button => {
    button.addEventListener('click', openExploration);
  });
  el('ex-prev').addEventListener('click', explorationPrevious);
  el('ex-next').addEventListener('click', explorationNext);
  el('ex-skip').addEventListener('click', explorationSkip);
  el('ex-overview').addEventListener('click', () => finishExploration(null));
  el('ex-export-data').addEventListener('click', () => {
    const data = getExplorationData();
    exportJSON({ ...data, currentDraft: explorationState.draft }, 'rct-exploration-data.json');
  });
  el('ex-export-report').addEventListener('click', () => {
    if (explorationState.report) exportJSON(explorationState.report, 'rct-exploration-report.json');
  });
  el('ex-clear').addEventListener('click', () => {
    if (!confirm('清空个人测评的草稿和报告？建议先导出；婚恋测评记录会保留。')) return;
    if (!clearExplorationData()) {
      el('ex-hub-storage').textContent = '当前浏览器无法清除记录，请在浏览器设置中处理。';
      return;
    }
    explorationState.draft = emptyExplorationDraft();
    explorationState.storageOK = true;
    explorationState.report = null;
    renderExplorationHub();
  });
}

function openExploration() {
  renderExplorationHub();
  show('exploration');
}

function renderExplorationHub() {
  el('ex-type-library').innerHTML = renderPersonalTypeLibrary(PERSONAL_TYPES);
  const draft = explorationState.draft;
  const progress = EXPLORATION_GROUPS.map(group => explorationProgress(group.id, draft));
  const answered = progress.reduce((n, row) => n + row.answered, 0);
  const skipped = progress.reduce((n, row) => n + row.skipped, 0);
  el('ex-total').textContent = `48 项主题 · 255 题 · 已答 ${answered} 题${skipped ? ` · 跳过 ${skipped} 题` : ''}`;
  el('ex-hub-storage').textContent = draft.incompatible
    ? '检测到旧版探索草稿。请先导出再清空，之后才能开始新版题库。'
    : !explorationState.storageOK ? '当前浏览器无法保存记录。页面刷新会丢失未保存回答，请先导出。'
    : draft.migratedFrom
      ? `原有回答已保留。新增主型题已答 ${PERSONAL_PROBES.filter(probe => draft.answers[probe.questionId]?.optionId).length} / 12 题，可从各组继续完成。`
      : '选项点击后自动保存到当前浏览器，可随时回来续答。';
  el('ex-groups').innerHTML = EXPLORATION_GROUPS.map((group, index) => {
    const p = progress[index];
    return `<article class="ex-group" style="--scene-color:${group.color}">
      <div class="ex-group-head"><h3>${esc(group.name)}</h3><span>${p.total} 题</span></div>
      <p class="muted">${group.topics.map(id => esc(EXPLORATION_TOPICS.find(t => t.id === id).name)).join(' · ')}</p>
      <div class="ex-group-bottom"><span class="muted">已答 ${p.answered} / ${p.total}${p.skipped ? ` · 跳过 ${p.skipped}` : ''}</span>
        <button type="button" class="btn btn-ghost" data-ex-group="${group.id}" ${draft.incompatible ? 'disabled' : ''}>
          ${p.complete ? '回看与修改' : p.processed ? '继续答题' : '开始这组'}
        </button></div>
    </article>`;
  }).join('');
  el('ex-groups').querySelectorAll('[data-ex-group]').forEach(button => {
    button.addEventListener('click', () => startExploration(button.dataset.exGroup));
  });
  el('ex-overview').disabled = Boolean(draft.incompatible);
  const reports = getExplorationReports().slice().reverse();
  el('ex-snapshots').innerHTML = reports.length
    ? reports.map((report, index) => `<div class="history-item"><div>
        <span class="h-type">${esc(report.personalProfile?.title || report.title || '探索报告')}</span>
        <span class="h-time">${esc(new Date(report.timestamp).toLocaleString('zh-CN'))} · 已答 ${Number(report.answered) || 0} 题${report.version !== EXPLORATION_VERSION ? ' · 旧版' : ''}</span>
      </div><button type="button" class="btn btn-ghost" data-ex-snapshot="${index}">查看</button></div>`).join('')
    : '<p class="muted">完成一组后会保存报告，也可以随时查看并保存当前总览。</p>';
  el('ex-snapshots').querySelectorAll('[data-ex-snapshot]').forEach(button => {
    button.addEventListener('click', () => {
      renderExplorationReport(reports[Number(button.dataset.exSnapshot)], true, true);
      show('exploration-result');
    });
  });
}

function startExploration(groupId, questionId = null) {
  if (explorationState.draft.incompatible) return openExploration();
  const group = getExplorationGroup(groupId);
  explorationState.groupId = groupId;
  explorationState.questions = explorationQuestions(groupId).map(q => ({ ...q, options: shuffle(q.options) }));
  const requested = questionId ? explorationState.questions.findIndex(q => q.id === questionId) : -1;
  const nextUnanswered = explorationState.questions.findIndex(q => explorationAnswer(q, explorationState.draft).status === 'unanswered');
  explorationState.current = requested >= 0 ? requested : Math.max(0, nextUnanswered);
  el('ex-quiz-group').textContent = group.name;
  show('exploration-quiz');
  renderExplorationQuestion();
}

function renderExplorationQuestion() {
  const q = explorationState.questions[explorationState.current];
  const topic = EXPLORATION_TOPICS.find(t => t.id === q.topicId);
  const answer = explorationAnswer(q, explorationState.draft);
  explorationState.pending = answer.status === 'answered' ? answer.optionId : null;
  el('ex-topic').textContent = `${topic.id}. ${topic.name} · ${q.facet}`;
  el('ex-quiz-progress').textContent = `第 ${explorationState.current + 1} / ${explorationState.questions.length} 题`;
  el('ex-progress-bar').style.width = `${explorationState.current / explorationState.questions.length * 100}%`;
  el('ex-text').textContent = q.text;
  el('ex-quiz-hint').textContent = answer.status === 'skipped'
    ? '本题此前已跳过。可以重新选择，也可以再次跳过。'
    : q.mode === 'scenario'
      ? '选你最可能采用的做法。若没有类似经历，按现在的想法回答；没有合适选项可以跳过。'
      : '按你目前的想法回答；不适用或不想回答时可以跳过。';
  const box = el('ex-options');
  box.replaceChildren();
  q.options.forEach(option => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';
    button.dataset.optionId = option.id;
    button.setAttribute('aria-pressed', 'false');
    const label = document.createElement('span');
    label.className = 'option-label';
    label.textContent = option.text;
    const marker = document.createElement('span');
    marker.className = 'choice-marker';
    marker.setAttribute('aria-hidden', 'true');
    button.append(label, marker);
    button.addEventListener('click', () => {
      explorationState.pending = option.id;
      explorationState.storageOK = recordExplorationChoice(explorationState.draft, q.id, option.id);
      updateExplorationSelection();
    });
    box.append(button);
  });
  el('ex-prev').disabled = explorationState.current === 0;
  el('ex-next').textContent = explorationState.current === explorationState.questions.length - 1 ? '查看这组结果' : '下一题';
  updateExplorationSelection();
  el('ex-text').focus({ preventScroll: true });
}

function updateExplorationSelection() {
  el('ex-options').querySelectorAll('.option').forEach(button => {
    const selected = button.dataset.optionId === explorationState.pending;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('.choice-marker').textContent = selected ? '✓' : '';
  });
  el('ex-next').disabled = explorationState.pending === null;
  el('ex-quiz-storage').textContent = explorationState.storageOK
    ? '回答自动保存在当前浏览器'
    : '保存失败，回答暂留在本页。请返回主题页导出，刷新前务必保存。';
}

function explorationNext() {
  if (explorationState.pending === null) return;
  advanceExploration();
}

function explorationSkip() {
  const q = explorationState.questions[explorationState.current];
  explorationState.storageOK = recordExplorationChoice(explorationState.draft, q.id, null, true);
  advanceExploration();
}

function advanceExploration() {
  if (explorationState.current === explorationState.questions.length - 1) {
    finishExploration(explorationState.groupId);
  } else {
    explorationState.current++;
    renderExplorationQuestion();
    window.scrollTo({ top: 0 });
  }
}

function explorationPrevious() {
  if (explorationState.current === 0) return;
  explorationState.current--;
  renderExplorationQuestion();
  window.scrollTo({ top: 0 });
}

function finishExploration(groupId) {
  const report = buildExplorationReport(explorationState.draft, groupId);
  const saved = saveExplorationReport(report);
  renderExplorationReport(report, saved);
  show('exploration-result');
}

function renderExplorationReport(report, saved, snapshot = false) {
  explorationState.report = report;
  el('ex-report-title').textContent = report.title;
  el('ex-report-meta').textContent = `${snapshot ? '历史报告 · ' : ''}${report.topicCount} 项主题 · 已答 ${report.answered} / ${report.total} 题 · 跳过 ${report.skipped} 题 · 未答 ${report.total - report.answered - report.skipped} 题`;
  el('ex-report-storage').textContent = saved && explorationState.storageOK
    ? (snapshot ? '正在查看当时保存的回答；修改会进入当前草稿。' : '报告已保存在当前浏览器，可导出后留存或比较。')
    : '部分记录未能保存。当前报告仍可导出；请在刷新或关闭前保存。';
  renderPersonalProfile(report);
  el('ex-report-topics').innerHTML = report.topics.map(topic => {
    const answered = topic.facets.filter(facet => facet.status === 'answered');
    const canEdit = report.version === EXPLORATION_VERSION && !explorationState.draft.incompatible;
    return `<details class="ex-topic-report">
      <summary><span><strong>${topic.topicId}. ${esc(topic.name)}</strong>
        <span class="ex-topic-preview">${answered.length ? esc(answered[0].facet + '：' + answered[0].text) : '尚无选择，展开查看内容'}</span></span>
        <span class="ex-topic-count">${answered.length} / ${topic.facets.length} 已答</span></summary>
      <div class="ex-topic-body">
        <p class="ex-reflection">${esc(topic.reflection)}</p>
        ${topic.facets.map(facet => `<div class="ex-facet">
          <span class="ex-facet-label">${esc(facet.facet)}</span>
          <p>${esc(facet.questionText)}</p>
          <strong class="${facet.status !== 'answered' ? 'muted' : ''}">${facet.status === 'answered' ? '你的选择：' : ''}${esc(facet.text)}</strong>
        </div>`).join('')}
        ${canEdit ? `<button type="button" class="text-btn" data-ex-edit="${topic.topicId}">回看并修改当前草稿 →</button>` : ''}
      </div>
    </details>`;
  }).join('');
  el('ex-report-topics').querySelectorAll('[data-ex-edit]').forEach(button => {
    button.addEventListener('click', () => {
      const topic = EXPLORATION_TOPICS.find(t => t.id === Number(button.dataset.exEdit));
      startExploration(topic.groupId, EXPLORATION_BANK[topic.id][0].id);
    });
  });
}

function renderPersonalProfile(report) {
  const profile = report.personalProfile;
  const usable = isCurrentPersonalProfile(profile);
  if (!usable) {
    el('ex-profile').innerHTML = (typeof profile?.title === 'string'
      ? `<div class="personal-summary"><p class="entry-label">历史画像 · 原规则</p><h2>${esc(profile.title)}</h2>
          ${typeof profile.summary === 'string' ? `<p>${esc(profile.summary)}</p>` : ''}</div>` : '')
      + '<p class="profile-note">这份历史报告未保存当前特征解释，以下保留当时的具体回答。查看当前草稿的综合画像可生成新报告。</p>';
    return;
  }
  const feature = row => `<article class="feature-row">
    <div class="feature-heading"><h4>${esc(row.label)}</h4><span>${row.supporting.length} / ${row.total} 个情境支持</span></div>
    <p>${esc(row.summary)}</p>
    <p><span class="reference-label">可用之处</span>${esc(row.benefit)}</p>
    <p><span class="reference-label">留意</span>${esc(row.watch)}</p>
    ${renderAnswerEvidence(row.supporting, '查看支持这一解释的回答')}
    ${renderAnswerEvidence(row.otherChoices, '查看同组其他选择')}
  </article>`;
  el('ex-profile').innerHTML = `
    <div class="personal-summary">
      <p class="entry-label">${report.groupId ? '本组特征摘要' : '个人综合画像'}</p>
      <h2>${esc(profile.title)}</h2>
      <p>${esc(profile.summary)}</p>
      <p class="muted">主型只概括三个生活取向，不代表完整人格。特征来自多个指定情境的重复选择，反映本次自报做法。${report.groupId ? '本组未覆盖的主题不参与解释。' : '跳过和未答不补分。'}</p>
    </div>
    ${renderPersonalAxes(profile.taxonomy)}
    ${renderPersonalClassification(profile)}
    <details class="explanation-rules personal-library">
      <summary>查看本版 8 种生活取向主型与本次观察</summary>
      ${renderPersonalTypeLibrary(profile.taxonomy.rows)}
    </details>
    <h3 class="sec-title report-section-title">反复出现的特征</h3>
    ${profile.repeated.length ? profile.repeated.map(feature).join('') : `
      <p class="empty-explanation">目前没有特征达到三个指定情境的支持条件。这不代表你没有特点，可展开其他选择和逐题依据继续了解。</p>`}
    ${profile.mixed.length ? `<h3 class="sec-title report-section-title">需要结合情境看的特征</h3>
      ${profile.mixed.map(row => `<div class="feature-row"><h4>${esc(row.label)}</h4>
        <p>四个指定情境中，两题采用了这一做法，另两题采用其他做法，暂不作为主导特征。</p>
        ${renderAnswerEvidence([...row.supporting, ...row.otherChoices])}</div>`).join('')}` : ''}
    ${profile.features?.some(row => row.status === 'insufficient') ? `<details class="explanation-evidence">
      <summary>查看尚未归纳的观察内容</summary>
      ${profile.features.filter(row => row.status === 'insufficient').map(row => `<div class="feature-row">
        <h4>${esc(row.label)} · 观察内容</h4>
        <p class="muted">${row.observed} / ${row.total} 个情境已答，${row.supporting.length} 个采用相应做法。
          ${row.observed < row.total ? '尚未完整覆盖，不补造缺失答案。' : '其他选择仍保留，不统一归入相反特征。'}</p>
        ${renderAnswerEvidence([...row.supporting, ...row.otherChoices])}</div>`).join('')}
      </details>` : ''}
    <h3 class="sec-title report-section-title">不同需要怎样同时存在</h3>
    ${[...profile.coexistence, ...profile.differences].length
      ? [...profile.coexistence, ...profile.differences].map(row => `<div class="situation-row"><strong>${esc(row.title)}</strong><p>${esc(row.text)}</p>${renderAnswerEvidence(row.evidence)}</div>`).join('')
      : '<p class="empty-explanation">目前没有足够的成对回答需要单独解释。保留不同选择，不把它们自动称为内在矛盾。</p>'}
    <h3 class="sec-title report-section-title">具体情境中的选择</h3>
    <p class="muted">以下保留情境与本次选择，实际表现可用真实经历核对。</p>
    ${profile.situations.map(row => `<div class="situation-row"><strong>${esc(row.name)}</strong>
      <p>${row.evidence ? '你的选择：' + esc(row.evidence.text) : '这一情境尚无有效回答，暂不解释。'}</p>
      ${row.evidence ? `<p class="muted">${esc(row.check)}</p>${renderAnswerEvidence([row.evidence])}` : ''}
    </div>`).join('')}
    <h3 class="sec-title report-section-title">相处类型参考</h3>
    <p class="muted">参考按三个明确方向的同向或差异提出讨论事项。它是设计参考，不是关系成功率；对方应自行作答，不能替对方归类。</p>
    <label class="oc-field profile-context"><span>这次想怎样使用相处参考</span><select id="ex-profile-context">
      <option value="daily">日常相处</option><option value="cooperation">合作与合伙</option></select></label>
    <p id="ex-profile-usage" class="profile-note"></p>
    <div id="ex-profile-references"></div>
    <details class="explanation-rules"><summary>画像的解释规则</summary>
      <p>每条特征观察四个指定情境。至少三题采用相应做法，才归纳为重复特征；四题中两题采用时保留为情境差异。未答、跳过或未知选项不作支持证据。</p>
      <p>${esc(profile.taxonomy.rule)}</p>
      <p>主型与特征分别解释；具体信念、需要和婚育意愿单独保留。动物是识别符号，不参与计分，也不用于推断动物对应的人格。这里没有人群排名、忠诚度、心理诊断或未来行为概率。</p>
      <p>本版完成了类型命名与规则检查；人群效度及关系结果预测尚无统计验证。历史报告保留当时的解释版本，修改草稿后会生成新报告。</p>
    </details>`;
  const context = el('ex-profile-context');
  const update = () => renderPersonalReferences(profile, context.value);
  context.addEventListener('change', update);
  update();
}

function renderPersonalTypeLibrary(types) {
  return `<div class="personal-type-library">${types.map(type => `<article class="personal-type-item">
    <h4><span aria-hidden="true">${esc(type.emoji)}</span> ${esc(type.name)} <span class="reference-example">${esc(type.id)} · ${esc(type.animal)}</span></h4>
    <p>${esc(type.focus)}</p>
    ${Number.isInteger(type.observed) ? `<p class="muted">已答方向题 ${type.observed} / ${type.total} 题 · ${type.supported} 个选项与这一组合方向相符</p>
      ${renderAnswerEvidence(type.supporting, '查看支持这一类型的回答')}
      ${renderAnswerEvidence(type.otherChoices, '查看这些情境中的其他选择')}` : `<p class="muted">${esc(type.description)}</p>`}
  </article>`).join('')}</div>`;
}

function renderPersonalClassification(profile) {
  const taxonomy = profile.taxonomy;
  if (!profile.primaryTypes.length) {
    const text = taxonomy.status === 'group_only'
      ? '本组用于观察局部选择。全局主型在个人综合画像中确定。'
      : taxonomy.status === 'incomplete'
        ? `三个方向中已有 ${taxonomy.axes.filter(axis => axis.covered).length} 个达到最低覆盖。每个方向至少三题有效、三题同侧，三个方向均明确后确定主型。`
        : '本次存在情境取舍，尚不能形成唯一主型。已明确的方向与两侧回答继续保留。';
    const known = taxonomy.axes.some(axis => ['neg', 'pos'].includes(axis.direction));
    return `<p class="profile-note type-status">${esc(text)}</p>`
      + (taxonomy.status !== 'group_only' && known ? `<p class="muted">待确定的可能组合：${taxonomy.candidates.map(row => esc(`${row.id} ${row.name}`)).join('、')}。这些是候选范围，并非本次主型或辅助型。</p>` : '');
  }
  const row = type => `<article class="personal-classified-type">
    <h4><span aria-hidden="true">${esc(type.emoji)}</span> ${esc(type.name)} <span class="reference-example">${esc(type.id)} · ${esc(type.animal)}</span></h4>
    <p>${esc(type.description)}</p>
    <p><span class="reference-label">归类依据</span>三个方向分别达到有效覆盖与同侧选择条件，形成这一唯一组合。</p>
    <p><span class="reference-label">可用之处</span>${esc(type.strength)}</p>
    <p><span class="reference-label">留意</span>${esc(type.caution)}</p>
    ${renderAnswerEvidence(type.supporting, '查看类型归类的具体回答')}
    ${renderAnswerEvidence(type.otherChoices, '查看其他选择')}
  </article>`;
  return `<div class="personal-classification">
    <h3 class="sec-title report-section-title">本次生活取向主型</h3>
    ${profile.primaryTypes.map(row).join('')}
  </div>`;
}

function renderPersonalReferences(profile, context) {
  el('ex-profile-usage').textContent = profile.usage[context];
  const makeReference = (row, key) => {
    const reference = row[key];
    return `<article class="relationship-reference">
      <h4><span aria-hidden="true">${esc(reference.emoji)}</span> ${esc(reference.name)} <span class="reference-example">${esc(reference.id)} · ${esc(reference.animal)}</span></h4>
      <p>${esc(reference.description)}</p>
      <p><span class="reference-label">与你的关联</span>对应你的“${esc(row.typeName)}”。${esc(reference.basis)}</p>
      <p><span class="reference-label">留意</span>${esc(reference.consideration)}${context === 'cooperation' ? '合作还需核验能力和交付，不能由相处方式代替。' : ''}</p>
      <p><span class="reference-label">可以先谈</span>${esc(reference.action)}</p>
      ${renderAnswerEvidence(row.evidence)}
    </article>`;
  };
  el('ex-profile-references').innerHTML = `
    <h4 class="reference-heading">更容易形成默契的类型</h4>
    ${profile.references.length ? referenceList('easier')
      : '<p class="empty-explanation">本次尚未确定个人主型。可先从已回答的具体情境谈需要与边界。</p>'}
    <h4 class="reference-heading">需要更多磨合的类型</h4>
    ${profile.references.length ? referenceList('harder')
      : '<p class="empty-explanation">暂不指定差异类型；完成更多相关回答后再生成参考。</p>'}`;
  function referenceList(key) {
    const rows = profile.references;
    return rows.slice(0, 3).map(row => makeReference(row, key)).join('')
      + (rows.length > 3 ? `<details class="explanation-evidence"><summary>展开其他类型参考 · ${rows.length - 3} 项</summary>
        ${rows.slice(3).map(row => makeReference(row, key)).join('')}</details>` : '');
  }
}

function renderPersonalAxes(taxonomy) {
  return `<div class="personal-directions">${taxonomy.axes.map(axis => `<article class="feature-row">
    <div class="feature-heading"><h4>${esc(axis.name)}</h4><span>${esc(axis.text)}</span></div>
    <p class="muted">已答 ${axis.observed} / ${axis.total} 题 · ${esc(axis.neg)} ${axis.counts.neg} 次 · ${esc(axis.pos)} ${axis.counts.pos} 次</p>
    ${renderAnswerEvidence(axis.answers, '查看这个方向的回答')}
  </article>`).join('')}</div>`;
}

document.addEventListener('DOMContentLoaded', initExploration);
