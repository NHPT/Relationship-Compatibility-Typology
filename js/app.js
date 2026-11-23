/* ============================================================
 * RCT 关系适配类型学 — 交互逻辑（答题流程 + 限时 + 渲染）
 * ============================================================ */

const TIME_PER_QUESTION = 15; // 每题限时（秒）

const state = {
  mode: null,        // 'single' | 'pair'
  questions: [],
  current: 0,
  answers: [],       // [{dimension, score}]
  pairA: null,
  pairB: null,
  timer: null,
  timeLeft: TIME_PER_QUESTION,
  sceneId: '婚恋'
};

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
  el('btn-single').addEventListener('click', () => startTest('single'));
  el('btn-pair').addEventListener('click', () => startTest('pair'));
  el('btn-history').addEventListener('click', showHistory);
  updateHistoryBadge();
}

/* ---------- 开始测试 ---------- */
function startTest(mode) {
  state.mode = mode;
  state.questions = generateTest();
  state.current = 0;
  state.answers = [];
  state.pairA = null;
  state.pairB = null;
  renderQuizHeader();
  renderQuestion();
  show('quiz');
}

function renderQuizHeader() {
  const label = state.mode === 'pair' && state.pairA
    ? '请回答 B 方（第二个人）'
    : (state.mode === 'pair' ? '请回答 A 方（第一个人）' : '请凭直觉作答');
  el('quiz-sub').textContent = label;
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
    btn.className = 'option';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => selectOption(opt));
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
  el('quiz-timer').className = 'quiz-timer' + (t <= 5 ? ' danger' : '');
}

/* ---------- 选择选项 ---------- */
function selectOption(opt) {
  clearInterval(state.timer);
  state.answers.push({ dimension: state.questions[state.current].dimension, score: opt.score });
  // 高亮反馈
  document.querySelectorAll('.option').forEach(b => b.classList.add('disabled'));
  setTimeout(advance, 120);
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

  if (state.mode === 'pair') {
    if (!state.pairA) {
      // A 方测完，测 B 方
      state.pairA = result;
      state.questions = generateTest();
      state.current = 0;
      state.answers = [];
      renderQuizHeader();
      renderQuestion();
    } else {
      state.pairB = result;
      renderPairReport();
      show('pair');
    }
  } else {
    // 单人
    saveResult(result);
    renderSingleResult(result);
    show('result');
  }
}

/* ---------- 渲染单人结果 ---------- */
function renderSingleResult(result) {
  const history = getHistory();
  const agg = aggregate(history.filter(r => r.type === result.type || true));

  // 最近多次的类型序列（用于稳定性）
  const recent = history.slice(-5).map(r => r.type);

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

  // 稳定性
  const stabilityBox = el('result-stability');
  if (history.length >= 2) {
    const agg2 = aggregate(history);
    stabilityBox.innerHTML = `
      <p>已测 <strong>${agg2.times}</strong> 次 · 稳定类型 <strong>${TYPES[agg2.stableType]?.name || agg2.stableType}</strong>
      · 一致率 <strong>${agg2.consistency}%</strong> · <strong>${agg2.stability}</strong></p>
      ${agg2.stability === '低稳定' ? '<p class="muted">⚠ 多次结果跳变，可能行为不一致、在伪装，或处于人生转折期，建议拉长观察。</p>' : ''}
    `;
    stabilityBox.classList.remove('hidden');
  } else {
    stabilityBox.classList.add('hidden');
  }

  el('btn-again').onclick = () => startTest('single');
  el('btn-to-pair').onclick = () => startTest('pair');
}

/* ---------- 双人配型报告 ---------- */
function renderPairReport() {
  const a = state.pairA, b = state.pairB;
  el('pair-a-type').textContent = a.name + '（' + a.type + '）';
  el('pair-a-axes').textContent = a.axes;
  el('pair-b-type').textContent = b.name + '（' + b.type + '）';
  el('pair-b-axes').textContent = b.axes;

  // 场景选择
  const sceneBox = el('pair-scenes');
  sceneBox.innerHTML = SCENES.map(s => `
    <button class="scene-btn ${s.id === state.sceneId ? 'active' : ''}" data-scene="${s.id}">
      <span class="scene-name">${s.name}</span>
      <span class="scene-desc">${s.desc}</span>
    </button>
  `).join('');
  sceneBox.querySelectorAll('.scene-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.sceneId = btn.dataset.scene;
      renderPairConclusion();
    });
  });

  renderPairConclusion();
  el('btn-pair-restart').onclick = () => startTest('pair');
}

function renderPairConclusion() {
  const a = state.pairA, b = state.pairB;
  const rep = buildPairReport(a, b, state.sceneId);
  const c = rep.comp;

  const levelClass = { high: 'good', talk: 'talk', risk: 'risk', warn: 'warn' }[c.level] || '';

  el('pair-conclusion').innerHTML = `
    <div class="pair-level ${levelClass}">${c.levelText}</div>
    <p class="pair-reason">${esc(c.reason)}</p>
  `;

  // 标签对比
  const la = a.label, lb = b.label;
  el('pair-labels').innerHTML = ['生育意愿', '定居倾向'].map(k => `
    <div class="label-row">
      <span class="label-k">${k}</span>
      <span>${esc(la[k])}</span>
      <span class="vs">vs</span>
      <span>${esc(lb[k])}</span>
    </div>
  `).join('');
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
      ${history.slice().reverse().map((r, i) => `
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
