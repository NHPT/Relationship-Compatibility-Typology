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

/* ============================================================
 * 效度验证：结局数据采集 + 统计 + 导出
 * ============================================================ */

const OUTCOME_KEY = 'rct_outcomes_v1';

/* ---------- 结局数据（localStorage） ---------- */
function getOutcomes() {
  try {
    return JSON.parse(localStorage.getItem(OUTCOME_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveOutcome(outcome) {
  const list = getOutcomes();
  outcome.timestamp = Date.now();
  list.push(outcome);
  localStorage.setItem(OUTCOME_KEY, JSON.stringify(list));
  return list;
}

function clearOutcomes() {
  localStorage.removeItem(OUTCOME_KEY);
}

/* ---------- 导出工具 ---------- */
function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(data, filename) {
  download(JSON.stringify(data, null, 2), filename, 'application/json');
}

function exportCSV(rows, filename) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = r[h] == null ? '' : String(r[h]);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(','))
  ].join('\n');
  download('\uFEFF' + csv, filename, 'text/csv;charset=utf-8');
}

/* ---------- 配型评级（仅凭两个类型代码，供效度统计） ---------- */
function pairLevelByType(a, b) {
  const ta = TYPES[a], tb = TYPES[b];
  if (!ta || !tb) return 'warn';
  if (ta.family === null || tb.family === null) return 'warn';

  const FA = FAMILIES[ta.family], FB = FAMILIES[tb.family];
  if (ta.family === tb.family) return 'high';              // 同家族
  if (FA.axis === FB.axis && FA.rel !== FB.rel) return 'high'; // 主轴一致、关系互补
  return 'talk';                                            // 主轴相反
}

/* ---------- 效标效度统计：配型评级 vs 真实结局 ---------- */
function validityStats(outcomes) {
  const paired = (outcomes || []).filter(o =>
    o.type && o.partnerType && o.status && TYPES[o.type] && TYPES[o.partnerType]
  );

  if (paired.length === 0) {
    return { count: 0, insufficient: true, groups: {} };
  }

  const groups = { high: [], talk: [], risk: [], warn: [] };
  for (const o of paired) {
    const level = pairLevelByType(o.type, o.partnerType);
    groups[level].push(o);
  }

  const goodRate = arr => {
    if (arr.length === 0) return null;
    const good = arr.filter(o => o.status === 'good' || o.status === 'ok').length;
    return Math.round(good / arr.length * 100);
  };

  return {
    count: paired.length,
    insufficient: paired.length < 10,
    groups: {
      high: { n: groups.high.length, goodRate: goodRate(groups.high) },
      talk: { n: groups.talk.length, goodRate: goodRate(groups.talk) },
      risk: { n: groups.risk.length, goodRate: goodRate(groups.risk) },
      warn: { n: groups.warn.length, goodRate: goodRate(groups.warn) }
    }
  };
}
