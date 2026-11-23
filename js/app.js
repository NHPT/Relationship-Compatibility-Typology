/* ============================================================
 * RCT 关系适配类型学 — 交互逻辑（答题流程 + 限时 + 渲染）
 * ============================================================ */

const TIME_PER_QUESTION = 60; // 阅读提示（秒）；结束后仍等待实际作答

const state = {
  questions: [],
  current: 0,
  answers: [],       // [{dimension, score}]
  timer: null,
  timeLeft: TIME_PER_QUESTION
};

let currentResult = null; // 当前结果，供结局反馈关联

/* ---------- 工具 ---------- */
function $(sel) { return document.querySelector(sel); }
function el(id) { return document.getElementById(id); }

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- 页面切换 ---------- */
function show(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  el('page-' + pageId).classList.add('active');
  window.scrollTo({ top: 0 });
}

/* ---------- 首页 ---------- */
function initHome() {
  el('btn-single').addEventListener('click', startTest);
  el('btn-history').addEventListener('click', showHistory);
  updateHistoryBadge();
  fillPartnerOptions();
  bindOutcomeAndExport();
}

/* ---------- 研究反馈：填充对方类型下拉 ---------- */
function fillPartnerOptions() {
  const sel = el('oc-partner');
  if (!sel || sel.options.length > 1) return;
  [...NORMAL_TYPES, 'SWING'].forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = `${c} ${TYPES[c].name}`;
    sel.appendChild(o);
  });
}

/* ---------- 研究反馈：保存结局 + 导出 ---------- */
function bindOutcomeAndExport() {
  el('btn-save-outcome').addEventListener('click', () => {
    if (!currentResult) return;
    if (!el('oc-relation').value || !el('oc-duration').value || !el('oc-status').value) {
      alert('请填写实际关系类型、时长和状态；不知道对方类型时可留空。');
      return;
    }
    saveOutcome({
      resultId: currentResult.resultId,
      assessmentVersion: currentResult.assessmentVersion,
      type: currentResult.type,
      name: currentResult.name,
      relation: el('oc-relation').value,
      duration: el('oc-duration').value,
      status: el('oc-status').value,
      partnerType: el('oc-partner').value || null
    });
    const s = el('oc-saved');
    s.classList.remove('hidden');
    setTimeout(() => s.classList.add('hidden'), 2000);
  });

  el('btn-export-json').addEventListener('click', () => {
    exportJSON({ history: getHistory(), outcomes: getOutcomes() }, 'rct-data.json');
  });
  el('btn-export-csv').addEventListener('click', () => {
    const outcomes = getOutcomes();
    if (!outcomes.length) { alert('还没有结局反馈数据'); return; }
    exportCSV(outcomes, 'rct-outcomes.csv');
  });
}

/* ---------- 开始测试 ---------- */
function startTest() {
  state.questions = generateTest();
  state.current = 0;
  state.answers = [];
  state.locked = false;
  renderQuestion();
  show('quiz');
}

/* ---------- 渲染题目 ---------- */
function renderQuestion() {
  const q = state.questions[state.current];
  const total = state.questions.length;

  el('quiz-progress').textContent = `第 ${state.current + 1} / ${total} 题`;
  el('quiz-progress-bar').style.width = ((state.current / total) * 100) + '%';
  el('quiz-text').textContent = q.text;
  el('quiz-sub').textContent = '选择自己通常会怎样处理';

  const optsBox = el('quiz-options');
  optsBox.innerHTML = '';
  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => selectOption(btn, opt));
    optsBox.appendChild(btn);
  });

  // 重置限时
  clearInterval(state.timer);
  state.timeLeft = TIME_PER_QUESTION;
  renderTimer();
  state.timer = setInterval(tick, 1000);
}

function tick() {
  state.timeLeft--;
  renderTimer();
  if (state.timeLeft <= 0) {
    clearInterval(state.timer);
    // 未答不是中性回答；保留本题直到使用者实际作答。
    el('quiz-sub').textContent = '阅读提示时间已到，请选择后继续';
  }
}

function renderTimer() {
  const t = Math.max(0, state.timeLeft);
  el('quiz-timer').textContent = t + 's';
  el('quiz-timer').className = 'quiz-timer' + (t <= 10 ? ' danger' : '');
}

/* ---------- 选择选项 ---------- */
function selectOption(btn, opt) {
  if (state.locked) return; // 防重复点击
  state.locked = true;
  clearInterval(state.timer);

  const question = state.questions[state.current];
  state.answers.push({
    questionId: question.id,
    questionText: question.text,
    dimension: question.dimension,
    optionId: opt.idx,
    optionText: opt.text,
    score: opt.score
  });

  // 明确选中态：选中项高亮，其余禁用
  document.querySelectorAll('.option').forEach(b => b.classList.add('disabled'));
  btn.classList.add('selected');

  setTimeout(() => {
    state.locked = false;
    advance();
  }, 180);
}

/* ---------- 下一题 / 完成 ---------- */
function advance() {
  state.current++;
  if (state.current >= state.questions.length) {
    finishTest();
  } else {
    renderQuestion();
  }
}

/* ---------- 完成测试 ---------- */
function finishTest() {
  const totals = scoreTest(state.answers);
  const result = buildSingleResult(totals, state.answers);
  saveResult(result);
  renderSingleResult(result);
  show('result');
}

/* ---------- 渲染单人结果 ---------- */
function renderSingleResult(result) {
  currentResult = result;
  el('oc-saved').classList.add('hidden');
  ['oc-relation', 'oc-duration', 'oc-status', 'oc-partner'].forEach(id => {
    el(id).value = '';
  });
  updateHistoryBadge();
  const history = getHistory();

  el('result-type').textContent = result.name;
  el('result-code').textContent = result.type;
  el('result-axes').textContent = result.axes;

  el('result-core').textContent = result.core;
  el('result-tags').textContent = result.tags;
  el('result-strength').textContent = result.strength;
  el('result-risk').textContent = result.risk;

  if (result.isWarning) {
    el('result-warn').classList.remove('hidden');
    el('result-warn').textContent = '需要进一步了解：' + result.warnings.map(w => TYPES[w].name).join('、') + '。这些观察标记不覆盖个人类型，也不能单独判断关系结局。';
  } else {
    el('result-warn').classList.add('hidden');
  }

  // 维度倾向表
  const rows = describeTotals(result.totals);
  el('result-dims').innerHTML = rows.map(r => `
    <div class="dim-row">
      <span class="dim-name">${esc(r.name)}</span>
      <div class="dim-bar-wrap">
        <div class="dim-bar" role="img" aria-label="${esc(r.name)}：${esc(r.text)}，左端${esc(r.negative)}，右端${esc(r.positive)}">
          <div class="dim-bar-fill ${r.val > 0 ? 'pos' : (r.val < 0 ? 'neg' : 'mid')}" style="left:${Math.min(50, 50 + r.offset)}%;width:${Math.abs(r.offset)}%"></div>
        </div>
        <div class="dim-endpoints"><span>${esc(r.negative)}</span><span>${esc(r.positive)}</span></div>
      </div>
      <span class="dim-val">${esc(r.text)}</span>
    </div>
  `).join('');

  // 适配推荐
  renderMatchRecommendation(result);

  // 稳定性
  const stabilityBox = el('result-stability');
  if (history.length >= 2) {
    const agg = aggregate(history);
    stabilityBox.innerHTML = `
      <p>记录 <strong>${agg.times}</strong> 次 · 出现最多的分类 <strong>${esc(TYPES[agg.stableType]?.name || agg.stableType)}</strong>
      · 占记录比例 <strong>${agg.consistency}%</strong> · <strong>${agg.stability}</strong></p>
      <p class="muted">仅在同一人、相同规则版本和相近情境下可比较。分类重复不等于准确，分类变化不能用于判断隐瞒或说谎。</p>
    `;
    stabilityBox.classList.remove('hidden');
  } else {
    stabilityBox.classList.add('hidden');
  }

  el('btn-again').onclick = startTest;
}

/* ---------- 适配推荐 ---------- */
function renderMatchRecommendation(result) {
  const box = el('result-match');
  const reco = getMatchRecommendation(result);
  box.classList.remove('hidden');

  if (!reco.knownAxes.length) {
    box.innerHTML = `
      <h3 class="sec-title">类型适配参考</h3>
      <p class="muted">本次三条主轴均未明确，尚缺少列出类型候选的依据。可以先与对方讨论目标与发展节奏、共同时间与各自空间，以及预算、储蓄和支出安排。</p>
      <p class="match-note muted">是否适合相处还需要了解双方实际行为、冲突处理和边界约定；单人结果不能确定对方的倾向。</p>
    `;
    return;
  }

  const fmt = codes => codes.map(code => {
    const detail = reco.details[code];
    const reasons = [];
    if (detail.same.length) reasons.push(`同向：${detail.same.join('、')}`);
    if (detail.differences.length) reasons.push(`需协商：${detail.differences.join('、')}`);
    if (detail.unconfirmed.length) reasons.push(`待确认：${detail.unconfirmed.join('、')}`);
    return `<li class="match-candidate">
      <span class="match-chip">${esc(code)} ${esc(TYPES[code].name)}</span>
      <p class="muted">${esc(reasons.join('；'))}</p>
    </li>`;
  }).join('');
  const group = (codes, label, cls) => codes.length ? `
    <div class="match-group">
      <span class="match-label ${cls}">${label}</span>
      <ul class="match-types">${fmt(codes)}</ul>
    </div>
  ` : '';
  const partial = reco.unknownAxes.length
    ? `<p class="match-note muted">本次${esc(reco.unknownAxes.map(axis => axis.topic).join('、'))}未明确。候选只比较已明确的 ${reco.knownAxes.length} 条主轴，其余仍待确认。</p>`
    : '';
  const observations = result.warnings?.length
    ? '<p class="match-note muted">另需分别了解分歧是否会重新沟通，以及交往和家庭决策有哪些具体约定。观察标记不能判定一个人不适合所有类型。</p>'
    : '';

  box.innerHTML = `
    <h3 class="sec-title">类型适配参考（待验证）</h3>
    <p class="muted">根据目标取向、相处方式和金钱偏好列出候选与协商重点。偏好同向不保证适配，差异也不必然冲突；实际相处取决于双方意愿、约定与行为。</p>
    ${partial}
    ${group(reco.best, reco.unknownAxes.length ? '已知同向' : '三轴同向', 'good')}
    ${group(reco.talk, '差异协商', 'talk')}
    ${group(reco.different, '三轴差异', 'different')}
    ${observations}
  `;
}

/* ---------- 历史记录 ---------- */
function showHistory() {
  const history = getHistory();
  const box = el('history-list');
  if (history.length === 0) {
    box.innerHTML = '<p class="muted">还没有测试记录。</p>';
  } else {
    const agg = aggregate(history);
    box.innerHTML = `
      <div class="history-summary">
        <p>记录 <strong>${history.length}</strong> 次 · 出现最多的分类 <strong>${esc(TYPES[agg.stableType]?.name || agg.stableType)}</strong>
        · 占记录比例 <strong>${agg.consistency}%</strong> · <strong>${agg.stability}</strong></p>
        <p class="muted">这是当前浏览器的记录汇总，不是群体信度或效度结果；不同规则版本不能用于比较稳定性。</p>
      </div>
      ${history.slice().reverse().map(r => `
        <div class="history-item">
          <span class="h-type">${esc(r.name)}（${esc(r.type)}）</span>
          <span class="h-time">${new Date(r.timestamp).toLocaleString('zh-CN')}</span>
        </div>
      `).join('')}
      <button id="btn-clear-history" class="btn btn-ghost">清空记录</button>
    `;
    el('btn-clear-history').addEventListener('click', () => {
      if (confirm('确定清空所有测试记录？')) {
        clearHistory();
        showHistory();
        updateHistoryBadge();
      }
    });
  }
  show('history');
}

function updateHistoryBadge() {
  const n = getHistory().length;
  el('history-count').textContent = n ? `（${n} 次）` : '';
}

/* ---------- 初始化 ---------- */
document.addEventListener('DOMContentLoaded', initHome);
