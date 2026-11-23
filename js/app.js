/* ============================================================
 * RCT 关系适配类型学 — 交互逻辑（答题流程 + 限时 + 渲染）
 * ============================================================ */

const TIME_PER_QUESTION = 60; // 每题限时（秒）

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
  ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'].forEach(c => {
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
    saveOutcome({
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
    // 超时未答 → 记 0 分，自动下一题
    state.answers.push({ dimension: state.questions[state.current].dimension, score: 0 });
    advance();
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

  state.answers.push({ dimension: state.questions[state.current].dimension, score: opt.score });

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
  const result = buildSingleResult(totals);
  saveResult(result);
  renderSingleResult(result);
  show('result');
}

/* ---------- 渲染单人结果 ---------- */
function renderSingleResult(result) {
  currentResult = result;
  el('oc-saved').classList.add('hidden');
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
    el('result-warn').textContent = '⚠ 警示型：' + result.warnings.map(w => TYPES[w].name).join('、') + '，建议先处理对应维度再谈匹配';
  } else {
    el('result-warn').classList.add('hidden');
  }

  // 维度倾向表
  const rows = describeTotals(result.totals);
  el('result-dims').innerHTML = rows.map(r => `
    <div class="dim-row">
      <span class="dim-name">${esc(r.name)}</span>
      <div class="dim-bar-wrap">
        <div class="dim-bar">
          <div class="dim-bar-fill ${r.val > 0 ? 'pos' : (r.val < 0 ? 'neg' : 'mid')}" style="left:${Math.min(50, 50 + r.val * 8)}%;width:${Math.abs(r.val) * 8}%"></div>
        </div>
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
      <p>已测 <strong>${agg.times}</strong> 次 · 稳定类型 <strong>${TYPES[agg.stableType]?.name || agg.stableType}</strong>
      · 一致率 <strong>${agg.consistency}%</strong> · <strong>${agg.stability}</strong></p>
      ${agg.stability === '低稳定' ? '<p class="muted">⚠ 多次结果跳变，可能行为不一致、在伪装，或处于人生转折期，建议拉长观察。</p>' : ''}
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
  const reco = getMatchRecommendation(result.type);

  if (!reco) {
    if (result.type === 'SWING') {
      box.innerHTML = '<h3 class="sec-title">适配推荐</h3><p class="muted">类型尚未定型（主轴摇摆），建议再测 1~2 次，待类型稳定后再看适配推荐。</p>';
      box.classList.remove('hidden');
    } else if (result.isWarning) {
      box.innerHTML = '<h3 class="sec-title">适配推荐</h3><p class="muted">警示型需先处理冲突/边界维度，暂不给出适配推荐。</p>';
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
    return;
  }

  const fmt = codes => codes.map(c => {
    const t = TYPES[c];
    return t ? `<span class="match-chip">${c} ${t.name.split('·').pop()}</span>` : '';
  }).join('');

  box.innerHTML = `
    <h3 class="sec-title">适配推荐</h3>
    <div class="match-group">
      <span class="match-label good">最合适</span>
      <div class="match-types">${fmt(reco.best)}</div>
    </div>
    <div class="match-group">
      <span class="match-label talk">可磨合</span>
      <div class="match-types">${fmt(reco.talk)}</div>
    </div>
    <div class="match-group">
      <span class="match-label risk">慎配</span>
      <div class="match-types">${fmt(reco.avoid)}</div>
    </div>
  `;
  box.classList.remove('hidden');
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
        <p>共测 <strong>${history.length}</strong> 次 · 稳定类型 <strong>${TYPES[agg.stableType]?.name || agg.stableType}</strong>
        · 一致率 <strong>${agg.consistency}%</strong> · <strong>${agg.stability}</strong></p>
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
