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
    behavior: Object.fromEntries(BEHAVIOR_KEYS.map(key => [key, 0])),
    conditions: {},
    evidence: Object.fromEntries(AXIS_KEYS.map(key => [key, { pos: 0, neg: 0 }]))
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
      if (q.kind === 'style') {
        totals.evidence[q.dimension][option.score > 0 ? 'pos' : 'neg']++;
      }
    }
  }
  return totals;
}

function typeForProfile(sceneId, profile) {
  const scene = getScene(sceneId);
  const index = (profile.X === 'pos' ? 4 : 0)
    + (profile.Y === 'pos' ? 2 : 0) + (profile.M === 'pos' ? 1 : 0);
  const flexible = AXIS_KEYS.filter(key => profile[key] === 'mid');
  return {
    type: flexible.length
      ? `${scene.prefix}-${AXIS_KEYS.map(key => ({ neg: 'N', pos: 'P', mid: 'F' })[profile[key]]).join('')}`
      : `${scene.prefix}${index + 1}`,
    name: flexible.length
      ? flexible.length > 1 ? scene.flexibleName : `${scene.axes[flexible[0]].name}·情境弹性型`
      : scene.typeNames[index],
    color: flexible.length ? '#65648a' : TYPE_COLORS[index],
    symbol: flexible.length ? 'balance' : TYPE_SYMBOLS[index],
    flexible
  };
}

function classify(totals, sceneId) {
  const scene = getScene(sceneId);
  const profile = Object.fromEntries(AXIS_KEYS.map(key => [key, side(totals.style[key])]));
  const style = typeForProfile(sceneId, profile);
  const axes = AXIS_KEYS.map(key => {
    const val = totals.style[key];
    const direction = profile[key];
    const evidence = totals.evidence[key];
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
  return Array.from({ length: 8 }, (_, index) => {
    const profile = {
      X: index & 4 ? 'pos' : 'neg',
      Y: index & 2 ? 'pos' : 'neg',
      M: index & 1 ? 'pos' : 'neg'
    };
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
        : different.length === 3 ? 'different' : 'discuss'
    };
  });
  return { candidates, flexible, needs: scene.matchNeeds, calibrated: false };
}
