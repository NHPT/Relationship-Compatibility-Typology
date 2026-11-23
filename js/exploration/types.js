/* 三个独立方向形成八种主型；动物仅用于识别。 */
const PERSONAL_TYPE_VERSION = 'rct-personal-types-v2';
const PERSONAL_AXES = {
  D: { name: '变化方向', neg: '巩固已有安排', pos: '尝试新的方向',
    discussion: '变化范围、推进节奏、试验成本与原有承诺' },
  W: { name: '参与方式', neg: '独立推进', pos: '协同推进',
    discussion: '各自负责的范围、共同参与的环节与信息接口' },
  V: { name: '价值取舍', neg: '现实可行优先', pos: '内在意义优先',
    discussion: '基本保障之后，实际回报与个人意义怎样取舍' }
};
const PERSONAL_TYPES = [
  ['筑基自航型', '河狸', '🦫'], ['守望自航型', '陆龟', '🐢'],
  ['筑基共建型', '大象', '🐘'], ['守望共建型', '企鹅', '🐧'],
  ['开路自航型', '赤狐', '🦊'], ['逐光自航型', '雄鹰', '🦅'],
  ['开路共创型', '海豚', '🐬'], ['逐光共创型', '天鹅', '🦢']
].map(([name, animal, emoji], index) => {
  const profile = { D: index & 4 ? 'pos' : 'neg', W: index & 2 ? 'pos' : 'neg', V: index & 1 ? 'pos' : 'neg' };
  const focus = Object.keys(PERSONAL_AXES).map(key => PERSONAL_AXES[key][profile[key]]).join(' · ');
  return {
    id: `P${String(index + 1).padStart(2, '0')}`, name, animal, emoji, profile, focus,
    description: `条件相近且基本保障满足时，你倾向${focus.replaceAll(' · ', '、')}。`,
    strength: '三个方向可以帮助说明自己怎样组织生活、参与行动和安排投入。',
    caution: '方向是本次偏好，不证明能力或品格；具体责任、边界与实际表现仍需分别确认。',
    discussion: Object.values(PERSONAL_AXES).map(axis => `确认${axis.discussion}`).join('；') + '。'
  };
});

function getPersonalType(typeId) {
  return PERSONAL_TYPES.find(type => type.id === typeId) || null;
}

function classifyPersonalTypes(evidence, groupId = null) {
  const axes = Object.entries(PERSONAL_AXES).map(([key, definition]) => {
    const probes = PERSONAL_PROBES.filter(probe => probe.axis === key);
    const answers = probes.map(probe => evidence.get(probe.questionId)).filter(Boolean);
    const neg = answers.filter(answer => [0, 1].some(index => answer.optionId === `${answer.questionId}:${index}`));
    const pos = answers.filter(answer => [2, 3].some(index => answer.optionId === `${answer.questionId}:${index}`));
    const covered = answers.length >= 3;
    const direction = !covered ? 'unknown' : neg.length >= 3 && neg.length > pos.length ? 'neg'
      : pos.length >= 3 && pos.length > neg.length ? 'pos' : 'mid';
    return {
      key, ...definition, observed: answers.length, total: 4, covered, direction,
      text: direction === 'unknown' ? '观察不足' : direction === 'mid' ? '情境取舍' : definition[direction],
      counts: { neg: neg.length, pos: pos.length }, answers,
      missingQuestionIds: probes.filter(probe => !evidence.has(probe.questionId)).map(probe => probe.questionId)
    };
  });
  const coverageReady = axes.every(axis => axis.covered);
  const directional = axes.every(axis => ['neg', 'pos'].includes(axis.direction));
  const rows = PERSONAL_TYPES.map(type => {
    const answers = axes.flatMap(axis => axis.answers);
    const supporting = answers.filter(answer => {
      const axis = PERSONAL_PROBES.find(probe => probe.questionId === answer.questionId).axis;
      const direction = [0, 1].some(index => answer.optionId === `${answer.questionId}:${index}`) ? 'neg' : 'pos';
      return type.profile[axis] === direction;
    });
    return {
      ...type, observed: answers.length, total: 12, supported: supporting.length,
      covered: coverageReady, eligible: directional && axes.every(axis => type.profile[axis.key] === axis.direction),
      supporting, otherChoices: answers.filter(answer => !supporting.includes(answer)),
      missingQuestionIds: axes.flatMap(axis => axis.missingQuestionIds)
    };
  });
  const primary = groupId || !directional ? [] : rows.filter(row => row.eligible);
  const candidates = groupId ? [] : rows.filter(row =>
    axes.every(axis => !['neg', 'pos'].includes(axis.direction) || row.profile[axis.key] === axis.direction));
  return {
    version: PERSONAL_TYPE_VERSION, scope: groupId ? 'group' : 'personal',
    status: groupId ? 'group_only' : !coverageReady ? 'incomplete' : directional ? 'classified' : 'mixed',
    coverageReady, axes, rows, primary, secondary: [], candidates,
    missingQuestionIds: axes.flatMap(axis => axis.missingQuestionIds),
    rule: '三个方向各观察四题；至少三题有效才达到最低覆盖。至少三题选择同侧且超过另一侧，才确定方向。三个方向均明确时形成唯一主型；不足或情境取舍只显示方向与可能组合，不作为已测出的主型或辅助型。分组报告不宣布全局主型。'
  };
}
