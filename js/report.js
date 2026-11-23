/* 记录留在浏览器；历史旧版本保留原样，不用新题库重新解释。 */
const STORAGE_KEY = 'rct_history_v1';
const OUTCOME_KEY = 'rct_outcomes_v1';

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') : [];
  } catch {
    return [];
  }
}
function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
function getHistory() { return readList(STORAGE_KEY); }
function getOutcomes() { return readList(OUTCOME_KEY); }
function clearHistory() {
  try { localStorage.removeItem(STORAGE_KEY); return true; } catch { return false; }
}

function buildSingleResult(totals, answers, sceneId) {
  totals = scoreTest(answers, sceneId);
  answers = SCENE_BANKS[sceneId].map(q => {
    const answer = answers.find(row => row.questionId === q.id);
    const option = q.options.find(row => row.id === answer.optionId);
    return {
      questionId: q.id, questionText: q.text, kind: q.kind, dimension: q.dimension,
      optionId: option.id, optionText: option.text,
      ...(q.kind === 'condition' ? { value: option.value } : { score: option.score })
    };
  });
  const scene = getScene(sceneId);
  const c = classify(totals, sceneId);
  const behaviorRows = BEHAVIOR_KEYS.map(key => {
    const val = totals.behavior[key];
    return {
      key, ...BEHAVIORS[key], val, position: Math.round(val / 6 * 100),
      text: val >= 5 ? '选择中较明确' : val <= 1 ? '较少主动跟进' : '部分说明与跟进',
      answers: answers.filter(answer => answer.kind === 'behavior' && answer.dimension === key)
        .map(answer => ({ questionText: answer.questionText, optionText: answer.optionText }))
    };
  });
  const conditions = SCENE_BANKS[sceneId].filter(q => q.kind === 'condition').map(q => {
    const value = totals.conditions[q.dimension];
    const option = q.options.find(option => option.value === value);
    return { key: q.dimension, label: q.label, value, text: option.text, discussion: q.discussion };
  });
  const observationKeys = behaviorRows.filter(row => row.val <= 1).map(row => row.name);
  const directional = c.axes.filter(row => row.direction !== 'mid');
  const flexible = c.axes.filter(row => row.direction === 'mid');
  const core = [
    directional.length ? directional.map(row => `${row.name}偏向${row.text}`).join('，') : '',
    flexible.length ? `${flexible.map(row => row.name).join('、')}的回答采用了两侧做法，合计靠近中点` : ''
  ].filter(Boolean).join('；') + '。';
  const result = {
    assessmentVersion: ASSESSMENT_VERSION, measurementStatus: 'exploratory',
    sceneId, sceneName: scene.name,
    type: c.type, name: c.name, title: c.title, subtitle: c.subtitle, color: c.color, symbol: c.symbol, animal: c.animal, emoji: c.emoji,
    profile: c.profile, flexible: c.flexible,
    axes: c.axes.map(row => `${row.name}：${row.text}`).join(' · '),
    core,
    strength: behaviorRows.filter(row => row.val >= 5).length
      ? `较多选择主动说明和跟进的内容：${behaviorRows.filter(row => row.val >= 5).map(row => row.name).join('、')}。可用实际相处进一步核对。`
      : '可从下方逐题回答开始，了解哪些做法已采用、哪些需要具体约定。',
    risk: scene.focus,
    observation: observationKeys.length
      ? `${observationKeys.join('、')}的两题中较少选择主动说明或跟进。建议核对具体情况；这些观察不覆盖你的风格，也不代表人品或能力结论。`
      : '',
    axisRows: c.axes.map(row => ({ ...row, answers: answers.filter(answer => answer.kind === (sceneId === 'love' ? 'mode' : 'style') && answer.dimension === row.key) })),
    lifestyleRows: sceneId === 'love' ? AXIS_KEYS.map(key => ({
      key, ...scene.lifestyleAxes[key], val: totals.style[key], direction: side(totals.style[key]),
      text: side(totals.style[key]) === 'mid' ? '随情境取舍' : scene.lifestyleAxes[key][side(totals.style[key])],
      answers: answers.filter(answer => answer.kind === 'style' && answer.dimension === key)
    })) : [],
    personalFoundation: sceneId === 'love' && typeof currentPersonalFoundation === 'function'
      ? currentPersonalFoundation() : null,
    behaviorRows, conditions, totals,
    answers: answers.map(answer => ({ ...answer }))
  };
  const strong = behaviorRows.filter(row => row.val >= 5);
  const observe = behaviorRows.filter(row => row.val <= 1);
  const undecided = conditions.filter(row => ['undecided', 'conditional', 'explore'].includes(row.value));
  result.explanation = {
    version: 'rct-romance-explanation-v3', context: sceneId,
    summary: sceneId === 'love'
      ? '婚恋模式由回应起点、联系节奏、分歧节奏和共同安排四条专项方向生成。个人基础、生活方式、行动观察与具体条件分别保留。'
      : '风格方向、行为选择与具体条件分别保留。',
    points: [
      { label: '已有的行动线索', text: strong.length
        ? `在${strong.map(row => row.name).join('、')}中，你较多选择了主动说明和跟进。是否实际做到，可用最近的共同生活经历核对。`
        : '目前没有两题合计达到明确跟进范围的内容，可展开行为回答了解具体做法。' },
      { label: '值得继续核对', text: observe.length
        ? `${observe.map(row => row.name).join('、')}中较少选择主动说明和跟进；可先确认当时的限制和后续安排。`
        : '无论风格是否同向，都需要确认联系、承诺、分担和冲突后的实际做法。' },
      { label: '需要说清的期待', text: undecided.length
        ? `${undecided.map(row => `${row.label}：${row.text}`).join('；')}。保留这些条件与未决定状态，不能当作同意或拒绝。`
        : '本次七项条件已给出具体选择，需要确认对方是否知情、自愿接受，以及怎样落实。' }
    ],
    situations: [
      ['发生分歧', 'C', '暂停、道歉和重新讨论是否有具体时间与做法？'],
      ['承诺遇到困难', 'R', '什么时候说明变化，谁承担剩余工作？'],
      ['共同决定失效', 'J', '如何复查决定，并确认各自接下来做什么？'],
      ['负荷与压力', 'P', '如何说明负荷、安排休息，并避免把压力转给对方？']
    ].map(([name, key, check]) => ({
      name, check, answers: behaviorRows.find(row => row.key === key).answers,
      description: behaviorRows.find(row => row.key === key).answers.map(answer => `你选择“${answer.optionText}”`).join('；') + '。'
    }))
  };
  result.relationshipReferences = getMatchRecommendation(result);
  return result;
}

function saveResult(result) {
  result.timestamp = Date.now();
  result.resultId = globalThis.crypto?.randomUUID?.()
    || `rct-${result.timestamp}-${Math.random().toString(36).slice(2)}`;
  const history = getHistory();
  history.push(result);
  return writeList(STORAGE_KEY, history);
}

function aggregate(history) {
  if (!history?.length) return null;
  const scenes = new Set(history.map(r => r.sceneId || 'legacy'));
  const versions = new Set(history.map(r => r.assessmentVersion || 'legacy'));
  if (scenes.size !== 1 || versions.size !== 1 || !history[0].sceneId
      || history[0].assessmentVersion !== ASSESSMENT_VERSION) {
    return { times: history.length, comparable: false, text: '不同场景或旧规则记录分别保留，不合并比较。' };
  }
  const counts = new Map();
  history.forEach(r => counts.set(r.type, (counts.get(r.type) || 0) + 1));
  const maximum = Math.max(...counts.values());
  const modes = [...counts].filter(([, count]) => count === maximum).map(([type]) => type);
  const modeNames = modes.map(type => history.find(r => r.type === type).name);
  return {
    times: history.length, comparable: true,
    names: modeNames, proportion: Math.round(maximum / history.length * 100),
    text: history.length < 2 ? '只有一次记录，尚不能比较重复性。'
      : counts.size === 1 ? '本场景分类重复' : '本场景分类存在变化'
  };
}

function saveOutcome(outcome) {
  const list = getOutcomes();
  const existing = list.findIndex(row => row.resultId === outcome.resultId);
  const row = { ...outcome, timestamp: Date.now(), source: 'self_report', verified: false };
  if (existing >= 0) list[existing] = row;
  else list.push(row);
  return writeList(OUTCOME_KEY, list);
}

function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON(data, filename) {
  download(JSON.stringify(data, null, 2), filename, 'application/json');
}
function csvCell(value) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function exportCSV(rows, filename) {
  if (!rows?.length) return;
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const csv = [headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(key => csvCell(row[key])).join(','))].join('\r\n');
  download('\uFEFF' + csv, filename, 'text/csv;charset=utf-8');
}
