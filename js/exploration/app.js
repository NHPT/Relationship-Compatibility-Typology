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
    if (!confirm('清空人生与人性探索的草稿和报告？建议先导出；关系测评记录会保留。')) return;
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
  const draft = explorationState.draft;
  const progress = EXPLORATION_GROUPS.map(group => explorationProgress(group.id, draft));
  const answered = progress.reduce((n, row) => n + row.answered, 0);
  const skipped = progress.reduce((n, row) => n + row.skipped, 0);
  el('ex-total').textContent = `48 项主题 · 243 题 · 已答 ${answered} 题${skipped ? ` · 跳过 ${skipped} 题` : ''}`;
  el('ex-hub-storage').textContent = draft.incompatible
    ? '检测到旧版探索草稿。请先导出再清空，之后才能开始新版题库。'
    : explorationState.storageOK
      ? '选项点击后自动保存到当前浏览器，可随时回来续答。'
      : '当前浏览器无法保存记录。页面刷新会丢失未保存回答，请先导出。';
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
        <span class="h-type">${esc(report.title || '探索报告')}</span>
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

document.addEventListener('DOMContentLoaded', initExploration);
