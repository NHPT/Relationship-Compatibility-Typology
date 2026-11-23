/* ============================================================
 * RCT 关系适配类型学 — 报告生成 + 多次测试聚合
 * ============================================================ */

const STORAGE_KEY = 'rct_history_v1';

/* ---------- 历史记录（localStorage） ---------- */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveResult(result) {
  const history = getHistory();
  result.timestamp = Date.now();
  history.push(result);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return history;
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ---------- 数值工具 ---------- */
function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function mode(arr) {
  const counts = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  let best = null, bestN = -1;
  for (const [k, n] of Object.entries(counts)) {
    if (n > bestN) { best = k; bestN = n; }
  }
  return { value: best, count: bestN };
}

/* ---------- 多次测试聚合 ---------- */
function aggregate(history) {
  if (!history || history.length === 0) return null;

  const m = mode(history.map(r => r.type));
  const consistency = m.count / history.length;

  const dims = ['X', 'Y', 'C', 'B', 'M', 'K', 'S'];
  const avgTotals = {};
  for (const d of dims) avgTotals[d] = mean(history.map(r => r.totals[d]));

  // 稳定性
  let stability;
  if (history.length >= 2 && consistency === 1) stability = '高稳定';
  else if (consistency >= 0.5) stability = '中稳定';
  else stability = '低稳定';

  // 用均值重新分类，得到"综合类型"
  const combined = classify(avgTotals);

  return {
    times: history.length,
    stableType: m.value,
    consistency: Math.round(consistency * 100),
    stability,
    avgTotals,
    combined,
    types: history.map(r => r.type)
  };
}

/* ---------- 单次结果结构 ---------- */
function buildSingleResult(totals) {
  const c = classify(totals);
  const t = TYPES[c.type] || TYPES.SWING;
  return {
    type: c.type,
    name: t.name,
    axes: t.axes,
    core: t.core,
    tags: t.tags,
    strength: t.strength,
    risk: t.risk,
    isWarning: c.isWarning,
    warnings: c.warnings,
    x: c.x,
    y: c.y,
    m: c.m,
    label: c.label,
    totals: c.totals,
    confidence: c.confidence,
    swing: c.swing,
    dims: DIMENSIONS
  };
}

/* ---------- 维度倾向 → 可读文本 ---------- */
function sideText(dim, val, threshold = 2) {
  const s = side(val, threshold);
  if (s === 'pos') return DIMENSIONS[dim].pos;
  if (s === 'neg') return DIMENSIONS[dim].neg;
  return '均衡';
}

/* ---------- 双方配型报告 ---------- */
function buildPairReport(resultA, resultB, sceneId) {
  const scene = SCENES.find(s => s.id === sceneId) || SCENES[0];
  const comp = compatibility(resultA, resultB, scene.id);

  const levelText = {
    high: '高兼容', talk: '需协议', risk: '高风险', warn: '警示'
  }[comp.level] || comp.level;

  return {
    a: resultA, b: resultB,
    scene: scene,
    comp: { level: comp.level, levelText, reason: comp.reason }
  };
}

/* ---------- 维度净分用于展示 ---------- */
function describeTotals(totals) {
  const rows = [];
  for (const d of ['X', 'Y', 'C', 'B', 'M', 'K', 'S']) {
    const dim = DIMENSIONS[d];
    rows.push({
      dim: d,
      name: dim.name,
      val: totals[d],
      text: sideText(d, totals[d])
    });
  }
  return rows;
}
