const TIME_PER_QUESTION = 60;
const state = {
  sceneId: null, questions: [], current: 0, answers: [],
  pending: null, timer: null, timeLeft: TIME_PER_QUESTION
};
let currentResult = null;

function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
const ICON_PATHS = {
  heart: '<path d="M12 20S3 14.5 3 8.5a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1C21 14.5 12 20 12 20Z"/>',
  circles: '<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  rings: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8"/>',
  leaf: '<path d="M4 20C1 7 9 3 20 4c1 11-3 19-16 16Zm0 0L16 8"/>',
  mountain: '<path d="m2 20 8-15 5 9 3-5 5 11Z"/><path d="m7 11 3 2 3-2"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  diamond: '<path d="m12 2 10 10-10 10L2 12Z"/><path d="M12 7v10M7 12h10"/>',
  balance: '<path d="M12 3v17M5 20h14M4 7h16M6 7l-4 7h8ZM18 7l-4 7h8Z"/>'
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.balance}</svg>`;
}
function show(pageId) {
  if (pageId !== 'quiz') clearInterval(state.timer);
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  el('page-' + pageId).classList.add('active');
  window.scrollTo({ top: 0 });
}

function initHome() {
  el('scene-entries').innerHTML = Object.values(SCENARIOS).map(scene => `
    <button type="button" class="mode-card" data-scene="${scene.id}" style="--scene-color:${scene.accent}">
      <span class="mode-icon">${icon(scene.icon)}</span>
      <span class="mode-title">${scene.name}</span>
      <span class="mode-desc">${scene.desc}</span>
      <span class="mode-count">32 题 <span aria-hidden="true">↗</span></span>
    </button>
  `).join('');
  document.querySelectorAll('[data-scene]').forEach(button => {
    button.addEventListener('click', () => startTest(button.dataset.scene));
  });
  el('btn-history').addEventListener('click', showHistory);
  el('quiz-next').addEventListener('click', advance);
  el('quiz-prev').addEventListener('click', previousQuestion);
  document.querySelectorAll('[data-home]').forEach(button => {
    button.addEventListener('click', () => show('home'));
  });
  el('history-scene').addEventListener('change', renderHistory);
  bindOutcomeAndExport();
  updateHistoryBadge();
}

function startTest(sceneId) {
  const scene = getScene(sceneId);
  state.sceneId = sceneId;
  state.questions = generateTest(sceneId);
  state.current = 0;
  state.answers = [];
  state.pending = null;
  el('quiz-scene').textContent = scene.name;
  el('quiz-context').textContent = scene.instruction;
  show('quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.current];
  state.pending = state.answers[state.current]?.optionId ?? null;
  el('quiz-progress').textContent = `第 ${state.current + 1} / ${state.questions.length} 题`;
  el('quiz-progress-bar').style.width = `${state.current / state.questions.length * 100}%`;
  el('quiz-text').textContent = q.text;
  el('quiz-sub').textContent = q.kind === 'condition'
    ? '选择当前实际意愿或安排；这类条件不计分'
    : '选择自己通常采用的做法，再点击下一题';
  const box = el('quiz-options');
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
    button.addEventListener('click', () => selectOption(option.id));
    box.appendChild(button);
  });
  el('quiz-prev').disabled = state.current === 0;
  el('quiz-next').textContent = state.current === state.questions.length - 1 ? '查看结果' : '下一题';
  updateSelection();
  clearInterval(state.timer);
  state.timeLeft = TIME_PER_QUESTION;
  renderTimer();
  state.timer = setInterval(tick, 1000);
  // 新题焦点落在题干，避免前一项的焦点或键盘激活继续落在同位置。
  el('quiz-text').focus({ preventScroll: true });
}
function updateSelection() {
  el('quiz-options').querySelectorAll('.option').forEach(button => {
    const selected = button.dataset.optionId === state.pending;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('.choice-marker').textContent = selected ? '✓' : '';
  });
  el('quiz-next').disabled = state.pending === null;
}
function selectOption(optionId) {
  if (!state.questions[state.current].options.some(option => option.id === optionId)) return;
  state.pending = optionId;
  updateSelection();
  clearInterval(state.timer);
}
function persistAnswer() {
  const q = state.questions[state.current];
  const option = q.options.find(option => option.id === state.pending);
  if (!option) return false;
  state.answers[state.current] = {
    questionId: q.id, questionText: q.text, kind: q.kind, dimension: q.dimension,
    optionId: option.id, optionText: option.text,
    ...(q.kind === 'condition' ? { value: option.value } : { score: option.score })
  };
  return true;
}
function advance() {
  if (!persistAnswer()) return;
  if (state.current === state.questions.length - 1) finishTest();
  else {
    state.current++;
    renderQuestion();
    window.scrollTo({ top: 0 });
  }
}
function previousQuestion() {
  if (state.current === 0) return;
  persistAnswer();
  state.current--;
  renderQuestion();
  window.scrollTo({ top: 0 });
}
function tick() {
  state.timeLeft = Math.max(0, state.timeLeft - 1);
  renderTimer();
  if (state.timeLeft === 0) {
    clearInterval(state.timer);
    el('quiz-sub').textContent = '阅读提示时间已到，仍可选择；不会自动替你作答';
  }
}
function renderTimer() {
  el('quiz-timer').textContent = `${state.timeLeft}s`;
  el('quiz-timer').className = 'quiz-timer' + (state.timeLeft <= 10 ? ' danger' : '');
}

function finishTest() {
  clearInterval(state.timer);
  const totals = scoreTest(state.answers, state.sceneId);
  const result = buildSingleResult(totals, state.answers, state.sceneId);
  const saved = saveResult(result);
  renderSingleResult(result, saved);
  show('result');
}

function renderSingleResult(result, saved = true) {
  currentResult = result;
  const scene = getScene(result.sceneId);
  el('result-card').style.setProperty('--type-color', result.color);
  el('result-scene').textContent = `${scene.name} · 本次相处画像`;
  el('result-type').textContent = result.name;
  el('result-code').textContent = result.type;
  el('result-symbol').innerHTML = icon(result.symbol);
  el('result-axes').textContent = result.axes;
  el('result-core').textContent = result.core;
  el('result-strength').textContent = result.strength;
  el('result-risk').textContent = result.risk;
  el('result-flex').classList.toggle('hidden', !result.flexible.length);
  el('result-flex').textContent = result.flexible.length
    ? '情境弹性表示这些题里采用了两侧做法，合计靠近中点。下方保留具体方向与选择次数，不将它当成无结果，也不推断你有更强适应能力。' : '';
  el('result-warn').classList.toggle('hidden', !result.observation);
  el('result-warn').textContent = result.observation;
  el('result-storage').textContent = saved ? '已保存在当前浏览器' : '当前浏览器无法保存记录；本次结果仍可查看，请导出本次画像。';
  el('result-dims').innerHTML = result.axisRows.map(row => `
    <div class="axis-row">
      <div class="axis-caption"><strong>${esc(row.name)}</strong><span>${esc(row.text)}</span></div>
      <div class="axis-track" role="img" aria-label="${esc(row.name)}：${esc(row.text)}，${esc(row.explanation)}">
        <span class="axis-center"></span><span class="axis-point" style="left:${50 + row.position / 2}%"></span>
      </div>
      <div class="dim-endpoints"><span>${esc(row.neg)}</span><span>${esc(row.pos)}</span></div>
      <p class="axis-evidence muted">${esc(row.explanation)}</p>
    </div>
  `).join('');
  renderRadar(result.behaviorRows);
  el('result-behaviors').innerHTML = result.behaviorRows.map(row => `
    <details class="behavior-row">
      <summary><span>${esc(row.name)}</span><span class="behavior-level">${esc(row.text)} · ${row.val}/6</span></summary>
      <p class="muted">${esc(scene.behaviorContext)}，可核对是否做到：${esc(row.action)}。</p>
      ${row.answers.map(answer => `<p class="answer-evidence"><span>${esc(answer.questionText)}</span><strong>${esc(answer.optionText)}</strong></p>`).join('')}
    </details>
  `).join('');
  el('result-conditions').innerHTML = result.conditions.map(row => `
    <div class="condition-row"><div><strong>${esc(row.label)}</strong><span>${esc(row.text)}</span></div><p class="muted">${esc(row.discussion)}</p></div>
  `).join('');
  renderMatchRecommendation(result);
  const comparable = getHistory().filter(row => row.sceneId === result.sceneId && row.assessmentVersion === result.assessmentVersion);
  const agg = aggregate(comparable);
  el('result-stability').classList.toggle('hidden', !agg || agg.times < 2);
  el('result-stability').textContent = agg && agg.times >= 2
    ? `${scene.name}同规则记录 ${agg.times} 次 · ${agg.text}。重复性不能代表准确性，比较时仍需保持同一作答对象与相近情境。` : '';
  el('oc-relation').value = scene.name;
  el('oc-duration').value = '';
  el('oc-status').value = '';
  el('oc-saved').classList.add('hidden');
  el('oc-partner').innerHTML = '<option value="">不知道或尚未测试</option>'
    + getTypesForScene(result.sceneId).map(type => `<option value="${type.type}">${esc(type.type)} ${esc(type.name)}</option>`).join('')
    + `<option value="${scene.prefix}-flexible">情境弹性型（结合对方完整画像）</option>`;
  el('btn-again').onclick = () => startTest(result.sceneId);
  updateHistoryBadge();
}

function renderRadar(rows) {
  const point = (i, radius) => {
    const angle = -Math.PI / 2 + i * Math.PI / 4;
    return [200 + Math.cos(angle) * radius, 140 + Math.sin(angle) * radius];
  };
  const points = radius => rows.map((_, i) => point(i, radius).join(',')).join(' ');
  const polygon = rows.map((row, i) => point(i, row.position / 100 * 80).join(',')).join(' ');
  el('result-radar').innerHTML = `
    <svg viewBox="0 0 400 280" role="img" aria-labelledby="radar-title radar-desc">
      <title id="radar-title">八项行为回答分布</title>
      <desc id="radar-desc">${esc(rows.map(row => `${row.name} ${row.val}/6`).join('，'))}。每项两题，按设计规则归一化，不是能力、排名或适配概率。</desc>
      ${[20, 40, 60, 80].map(radius => `<polygon class="radar-ring" points="${points(radius)}"/>`).join('')}
      ${rows.map((_, i) => `<line class="radar-spoke" x1="200" y1="140" x2="${point(i, 80)[0]}" y2="${point(i, 80)[1]}"/>`).join('')}
      <polygon class="radar-data" points="${polygon}"/>
      ${rows.map((row, i) => {
        const [x, y] = point(i, 106);
        const [cx, cy] = point(i, row.position / 100 * 80);
        return `<circle class="radar-dot" cx="${cx}" cy="${cy}" r="3"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${esc(row.name)}</text>`;
      }).join('')}
    </svg>`;
}

function renderMatchRecommendation(result) {
  const reco = getMatchRecommendation(result);
  const groups = [
    ['same', '风格同向'], ['discuss', '差异协商'],
    ['different', '三轴差异'], ['open', '可讨论的风格']
  ];
  el('result-match').innerHTML = `
    <h3 class="sec-title">适配参考</h3>
    <p class="muted">可以优先了解具备下列实际做法的人，再核对双方的具体条件。单人画像无法确认对方是否具备这些做法。</p>
    <ul class="match-needs">${reco.needs.map(text => `<li>${esc(text)}</li>`).join('')}</ul>
    <details class="candidate-details"><summary>查看本场景的 8 种风格参考</summary>
      <p class="match-note muted">以下只比较三条风格轴。同向不保证适配，差异也不等于冲突；行为和明确条件需要分别核对。</p>
      ${reco.flexible.length ? `<p class="match-note muted">${esc(reco.flexible.map(row => row.name).join('、'))}在本次呈现情境取舍，不用单一方向排列这些候选。</p>` : ''}
      ${groups.map(([key, label]) => {
        const candidates = reco.candidates.filter(type => type.group === key);
        if (!candidates.length) return '';
        return `<div class="match-group"><span class="match-label ${key}">${label}</span><ul class="match-types">${candidates.map(type => {
          const reasons = [
            ...(type.same.length ? [`同向：${type.same.join('、')}`] : []),
            ...(type.discuss.length ? [`需协商：${type.discuss.join('、')}`] : []),
            ...(type.flexible.length ? [`按情境讨论：${type.flexible.join('、')}`] : [])
          ];
          return `<li class="match-candidate"><span class="match-chip" style="--chip-color:${type.color}">${esc(type.type)} ${esc(type.name)}</span><p class="muted">${esc(reasons.join('；'))}</p></li>`;
        }).join('')}</ul></div>`;
      }).join('')}
    </details>`;
}

function showHistory() {
  renderHistory();
  show('history');
}
function renderHistory() {
  const history = getHistory();
  const filter = el('history-scene').value;
  const filtered = history.filter(row => filter === 'all' || row.sceneId === filter || (filter === 'legacy' && !row.sceneId));
  const summaries = Object.values(SCENARIOS).map(scene => {
    const group = filtered.filter(row => row.sceneId === scene.id && row.assessmentVersion === ASSESSMENT_VERSION);
    const agg = aggregate(group);
    return agg ? `<p>${esc(scene.name)} ${agg.times} 次 · ${esc(agg.text)}</p>` : '';
  }).join('');
  el('history-list').innerHTML = `
    ${summaries ? `<div class="history-summary">${summaries}<p class="muted">不同场景与规则版本分开记录；分类重复不等于准确。</p></div>` : ''}
    ${filtered.length ? filtered.slice().reverse().map(row => {
      const current = row.assessmentVersion === ASSESSMENT_VERSION && SCENARIOS[row.sceneId]
        && row.axisRows?.length === 3 && row.behaviorRows?.length === 8 && row.conditions?.length === 7;
      const time = Number.isFinite(row.timestamp) ? new Date(row.timestamp).toLocaleString('zh-CN') : '时间未记录';
      return `<div class="history-item"><div><span class="h-scene">${esc(row.sceneName || '旧版通用测评')}</span><span class="h-type">${esc(row.name || row.type || '旧版记录')}（${esc(row.type || '—')}）</span><span class="h-time">${esc(time)}</span></div>
        ${current ? `<button type="button" class="btn btn-ghost" data-result-id="${esc(row.resultId)}">查看画像</button>` : '<span class="muted">保留旧版记录</span>'}</div>`;
    }).join('') : '<p class="muted">还没有此场景的记录。</p>'}
    ${history.length ? '<button type="button" id="btn-clear-history" class="btn btn-ghost">清空测试记录</button>' : ''}`;
  el('history-list').querySelectorAll('[data-result-id]').forEach(button => {
    button.addEventListener('click', () => {
      const result = history.find(row => row.resultId === button.dataset.resultId);
      if (result) { renderSingleResult(result); show('result'); }
    });
  });
  if (el('btn-clear-history')) el('btn-clear-history').onclick = () => {
    if (confirm('确定清空当前浏览器的测试记录？已保存的研究反馈仍保留。')) {
      if (!clearHistory()) alert('当前浏览器无法清空记录。');
      renderHistory();
      updateHistoryBadge();
    }
  };
}
function updateHistoryBadge() {
  const count = getHistory().length;
  el('history-count').textContent = count ? `（${count} 次）` : '';
}

function bindOutcomeAndExport() {
  el('btn-save-outcome').addEventListener('click', () => {
    if (!currentResult) return;
    if (!el('oc-duration').value || !el('oc-status').value) {
      alert('请选择实际相处时长和状态；不知道对方风格时可留空。');
      return;
    }
    const saved = saveOutcome({
      resultId: currentResult.resultId, assessmentVersion: currentResult.assessmentVersion,
      sceneId: currentResult.sceneId, relation: currentResult.sceneName,
      type: currentResult.type, name: currentResult.name,
      duration: el('oc-duration').value, status: el('oc-status').value,
      partnerType: el('oc-partner').value || null
    });
    el('oc-saved').textContent = saved ? '已保存到当前浏览器 ✓' : '当前浏览器无法保存反馈。';
    el('oc-saved').classList.remove('hidden');
  });
  el('btn-export-result').addEventListener('click', () => {
    if (currentResult) exportJSON(currentResult, `rct-${currentResult.sceneId}-profile.json`);
  });
  el('btn-export-json').addEventListener('click', () => {
    exportJSON({ assessmentVersion: ASSESSMENT_VERSION, history: getHistory(), outcomes: getOutcomes() }, 'rct-data.json');
  });
  el('btn-export-csv').addEventListener('click', () => {
    const rows = getOutcomes();
    if (!rows.length) { alert('还没有研究反馈数据。'); return; }
    exportCSV(rows, 'rct-outcomes.csv');
  });
}
document.addEventListener('DOMContentLoaded', initHome);
