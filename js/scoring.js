/* 设计规则：风格轴、行为观察、明确条件分别计算。没有适配概率。 */
const TYPE_COLORS = ['#347363', '#9b6339', '#416f96', '#7a589d', '#8a6b26', '#a24b61', '#496a8c', '#875843'];
const TYPE_SYMBOLS = ['rings', 'sun', 'square', 'leaf', 'mountain', 'spark', 'compass', 'diamond'];

function side(value) {
  if (value >= 2) return 'pos';
  if (value <= -2) return 'neg';
  return 'mid';
}

function scoreTest(answers, sceneId) {
  getScene(sceneId);
  const bank = SCENE_BANKS[sceneId];
  if (!Array.isArray(answers) || answers.length !== bank.length) {
    throw new Error('请完成全部题目后查看结果');
  }
  const ids = new Set();
  const totals = {
    style: Object.fromEntries(AXIS_KEYS.map(key => [key, 0])),
    mode: Object.fromEntries(MODE_KEYS.map(key => [key, 0])),
    behavior: Object.fromEntries(BEHAVIOR_KEYS.map(key => [key, 0])),
    conditions: {},
    evidence: Object.fromEntries(AXIS_KEYS.map(key => [key, { pos: 0, neg: 0 }])),
    modeEvidence: Object.fromEntries(MODE_KEYS.map(key => [key, { pos: 0, neg: 0 }]))
  };
  for (const answer of answers) {
    const q = bank.find(q => q.id === answer?.questionId);
    const option = q?.options.find(option => option.id === answer.optionId);
    if (!q || !option || ids.has(q.id)) throw new Error('答案与当前场景题库不一致');
    ids.add(q.id);
    // 从题库重取分值，不能相信历史或客户端随答案带来的分数。
    if (q.kind === 'condition') totals.conditions[q.dimension] = option.value;
    else {
      totals[q.kind][q.dimension] += option.score;
      if (q.kind === 'style' || q.kind === 'mode') {
        totals[q.kind === 'mode' ? 'modeEvidence' : 'evidence'][q.dimension][option.score > 0 ? 'pos' : 'neg']++;
      }
    }
  }
  return totals;
}

function typeForProfile(sceneId, profile) {
  const scene = getScene(sceneId);
  const keys = axisKeysForScene(sceneId);
  if (keys.some(key => !['neg', 'pos', 'mid'].includes(profile[key]))) throw new Error('分类方向不完整');
  const index = keys.reduce((value, key, i) => value + (profile[key] === 'pos' ? 2 ** (keys.length - i - 1) : 0), 0);
  const flexible = keys.filter(key => profile[key] === 'mid');
  const flexibleName = flexible.length === keys.length ? scene.flexibleName
    : [
      ...keys.filter(key => profile[key] !== 'mid').map(key => scene.axes[key][profile[key]]),
      `${flexible.map(key => scene.axes[key].name).join('、')}随情境`
    ].join(' · ') + '（情境取舍）';
  const fullName = flexible.length ? flexibleName : scene.typeNames[index];
  const [title, subtitle] = sceneId === 'love' && !flexible.length
    ? fullName.replace(/模式$/, '').split('·') : [fullName, ''];
  return {
    type: flexible.length
      ? `${scene.prefix}-${keys.map(key => ({ neg: 'N', pos: 'P', mid: 'F' })[profile[key]]).join('')}`
      : `${scene.prefix}${sceneId === 'love' ? String(index + 1).padStart(2, '0') : index + 1}`,
    name: fullName, title, subtitle,
    color: flexible.length ? '#65648a' : TYPE_COLORS[index % TYPE_COLORS.length],
    symbol: flexible.length ? 'balance' : TYPE_SYMBOLS[index % TYPE_SYMBOLS.length],
    animal: !flexible.length && scene.animals ? scene.animals[index][0] : null,
    emoji: !flexible.length && scene.animals ? scene.animals[index][1] : null,
    flexible
  };
}

function classify(totals, sceneId) {
  const scene = getScene(sceneId);
  const keys = axisKeysForScene(sceneId);
  const mode = sceneId === 'love';
  const profile = Object.fromEntries(keys.map(key => [key, side(totals[mode ? 'mode' : 'style'][key])]));
  const style = typeForProfile(sceneId, profile);
  const axes = keys.map(key => {
    const val = totals[mode ? 'mode' : 'style'][key];
    const direction = profile[key];
    const evidence = totals[mode ? 'modeEvidence' : 'evidence'][key];
    return {
      key, ...scene.axes[key], val, direction,
      position: Math.round(val / 6 * 100),
      text: direction === 'mid' ? '随情境取舍' : scene.axes[key][direction],
      evidence: { ...evidence },
      explanation: direction === 'mid'
        ? `三题中分别选择了${scene.axes[key].neg} ${evidence.neg} 次、${scene.axes[key].pos} ${evidence.pos} 次，合计靠近中点。`
        : `本次整体偏向${scene.axes[key][direction]}；三题中左侧选择 ${evidence.neg} 次、右侧选择 ${evidence.pos} 次。`
    };
  });
  return { ...style, profile, axes };
}

function getTypesForScene(sceneId) {
  const keys = axisKeysForScene(sceneId);
  return Array.from({ length: 2 ** keys.length }, (_, index) => {
    const profile = Object.fromEntries(keys.map((key, i) => [key, index & 2 ** (keys.length - i - 1) ? 'pos' : 'neg']));
    return { ...typeForProfile(sceneId, profile), profile };
  });
}

function getMatchRecommendation(result) {
  const scene = getScene(result.sceneId);
  const directional = result.axisRows.filter(row => row.direction !== 'mid');
  const flexible = result.axisRows.filter(row => row.direction === 'mid');
  const candidates = getTypesForScene(result.sceneId).map(type => {
    const same = directional.filter(row => type.profile[row.key] === row.direction);
    const different = directional.filter(row => type.profile[row.key] !== row.direction);
    return {
      ...type,
      same: same.map(row => `${row.name}：${row.text}`),
      discuss: different.map(row => `${row.topic}（对方偏向${row[type.profile[row.key]]}）`),
      flexible: flexible.map(row => row.topic),
      group: !directional.length ? 'open'
        : !different.length ? 'same'
        : different.length === axisKeysForScene(result.sceneId).length ? 'different' : 'discuss',
      basis: !directional.length ? '目前没有固定方向，需要按具体情境确认生活安排。' : !different.length
        ? `本次明确的${same.map(row => `${row.name}（${row.text}）`).join('、')}与这种风格同向，可能减少这些安排上的协调。`
        : `本次明确的${different.map(row => `${row.name}：你偏向${row.text}，这种风格偏向${row[type.profile[row.key]]}`).join('；')}存在差异，可能需要更多讨论。`,
      consideration: [
        '风格不能证明对方是否兑现承诺、尊重边界或接受你的婚恋条件。',
        flexible.length ? `${flexible.map(row => row.name).join('、')}随情境取舍，不能假定固定偏好。` : ''
      ].filter(Boolean).join(''),
      action: (different.length ? different : same).map(row => `确认${row.topic}`).join('；') || '逐项确认共同生活安排'
    };
  });
  return {
    candidates, flexible, needs: scene.matchNeeds, calibrated: false,
    easier: directional.length ? candidates.filter(type => type.same.length === directional.length) : [],
    harder: directional.length ? candidates.filter(type => type.discuss.length === directional.length) : [],
    context: result.sceneId, basis: result.sceneId === 'love' ? 'mode_answers_only' : 'style_answers_only'
  };
}
