/* 本版类型与特征分别解释，具体信念、意愿和情境回答保持独立。 */
const PERSONAL_EXPLANATION_VERSION = 'rct-personal-explanation-v4';
const PERSONAL_FEATURES = [
  {
    id: 'evidence', label: '先核对依据',
    items: [['ex-11-1', [0, 1]], ['ex-11-2', [0]], ['ex-11-4', [0, 1]], ['ex-38-4', [0, 1]]],
    summary: '面对观点、消息和权威意见，你多次选择先了解理由或核对证据。',
    benefit: '共同讨论时，可以把依据和分歧摆在明面上。',
    watch: '需要快速决定时，先约好必须核实的信息与决定期限。',
  },
  {
    id: 'autonomy', label: '保留自主边界',
    items: [['ex-3-2', [0, 1]], ['pc-autonomy-2', [0, 1]], ['ex-22-3', [0]], ['ex-22-5', [0]]],
    summary: '在方法、个人时间、家庭决定和帮助范围中，你多次选择保留当事人的决定空间。',
    benefit: '能把关心与代替别人决定分开讨论。',
    watch: '把可用时间和能提供的支持说明白，减少对方靠猜测理解距离。',
  },
  {
    id: 'understanding', label: '先理解对方',
    items: [['ex-12-1', [0]], ['ex-12-2', [0, 1]], ['ex-12-3', [0, 1]], ['ex-12-5', [0, 1]]],
    summary: '遇到不同选择、误解和痛苦时，你多次选择询问、倾听或保留来往。',
    benefit: '可以给彼此解释处境和需要的机会。',
    watch: '理解之后仍要说清自己的意见和可接受范围。',
  },
  {
    id: 'commitment', label: '主动守约与补救',
    items: [['ex-17-2', [0, 1]], ['ex-17-4', [0, 1]], ['ex-37-2', [0, 1]], ['ex-37-5', [0, 1]]],
    summary: '在承诺、顾虑和失误情境中，你多次选择说明情况、商量变更或主动补救。',
    benefit: '共同安排可以有明确的责任与后续处理。',
    watch: '答应之前核对能力，避免把过多责任留给自己。',
  },
  {
    id: 'cooperation', label: '先协商再合作',
    items: [['ex-3-3', [0]], ['ex-23-3', [0]], ['ex-46-2', [0, 1]], ['ex-46-4', [0, 1]]],
    summary: '在委托、损失和资源分配情境中，你多次选择约定接口或商量规则。',
    benefit: '有机会提前说清分工、利益和不同意见。',
    watch: '协商之后明确谁负责决定，避免所有小事都反复讨论。',
  },
  {
    id: 'pause', label: '冲动前留出暂停',
    items: [['ex-11-3', [0, 1]], ['ex-29-1', [0, 1]], ['ex-29-2', [0, 1, 3]], ['ex-34-4', [0, 1, 2]]],
    summary: '在生气、消费和冲动表达中，你多次选择等待、核对或设置限制。',
    benefit: '重要决定前可以留出重新考虑的机会。',
    watch: '暂停时也要给出下一步，避免事情长期悬而未决。',
  },
  {
    id: 'change', label: '愿意尝试调整',
    items: [['ex-47-1', [0, 1]], ['ex-47-2', [0, 1]], ['ex-47-3', [0, 1, 3]], ['ex-47-5', [0, 1]]],
    summary: '在环境和旧做法发生变化时，你多次选择了解要求或寻找调整办法。',
    benefit: '共同安排遇到问题时，可以尝试修改具体做法。',
    watch: '变更之前确认成本、退路和对方能接受的速度。',
  },
  {
    id: 'connection', label: '重视稳定联系',
    items: [['pc-connection-1', [0, 1]], ['pc-connection-2', [0, 1]], ['ex-45-2', [0, 2]], ['ex-45-5', [0, 1]]],
    summary: '在表达在乎、陪伴和社交需要中，你多次选择交流或稳定支持。',
    benefit: '可以主动维持联系，让对方知道关系对你的意义。',
    watch: '分别确认联系频率和回复时限，不把暂时没空直接理解为不在乎。',
  }
];

const PERSONAL_SITUATIONS = [
  ['承诺与安排', 'ex-17-2', '核对自己的时间与能力，提前说明需要变更的安排。'],
  ['冲动与表达', 'ex-29-2', '回想最近一次类似经历，确认暂停或表达之后发生了什么。'],
  ['权威与判断', 'ex-38-4', '核对观点背后的依据，而不是只根据提出者的身份决定。'],
  ['责任与失误', 'ex-37-2', '确认何时说明、如何补救，以及对受影响的人有什么影响。'],
  ['共同分工', 'ex-46-2', '确认各自负责的范围、沟通方式与实际投入。'],
  ['个人时间与边界', 'pc-autonomy-2', '说明可用时间与帮助范围，商量可接受的安排。']
];

function personalEvidence(report) {
  const evidence = new Map();
  report.topics.forEach(topic => topic.facets.forEach(facet => {
    const question = getExplorationQuestion(facet.questionId);
    const option = question?.options.find(o => o.id === facet.optionId);
    // 未知选项、跳过与未答都不能当成支持证据。
    if (question?.topicId === topic.topicId && facet.status === 'answered' && option) {
      evidence.set(question.id, {
        questionId: question.id, topicId: topic.topicId, topicName: topic.name,
        questionText: question.text, optionId: option.id, text: option.text
      });
    }
  }));
  return evidence;
}

function buildPersonalProfile(report) {
  const evidence = personalEvidence(report);
  const features = PERSONAL_FEATURES.map(rule => {
    const observed = rule.items.map(([id]) => evidence.get(id)).filter(Boolean);
    const supporting = observed.filter(row => {
      const allowed = rule.items.find(([id]) => id === row.questionId)[1];
      const question = getExplorationQuestion(row.questionId);
      return allowed.some(index => question.options[index].id === row.optionId);
    });
    // 四个指定情境中的重复选择；不比较心理强度，不用缺失答案补分。
    const status = supporting.length >= 3 ? 'repeated'
      : observed.length === 4 && supporting.length === 2 ? 'mixed' : 'insufficient';
    return {
      id: rule.id, label: rule.label, summary: rule.summary,
      benefit: rule.benefit, watch: rule.watch,
      status, observed: observed.length, total: rule.items.length,
      supporting, otherChoices: observed.filter(row => !supporting.includes(row)),
      missingQuestionIds: rule.items.map(([id]) => id).filter(id => !evidence.has(id))
    };
  });
  const repeated = features.filter(row => row.status === 'repeated');
  const mixed = features.filter(row => row.status === 'mixed');
  const taxonomy = classifyPersonalTypes(evidence, report.groupId);
  const references = taxonomy.primary.flatMap(row => {
    const type = getPersonalType(row.id);
    const make = (target, easier) => {
      return {
        id: target.id, name: target.name, animal: target.animal, emoji: target.emoji,
        description: target.description,
        basis: taxonomy.axes.map(axis => `${axis.name}：你偏向${axis.text}（左侧 ${axis.counts.neg} 次、右侧 ${axis.counts.pos} 次），这一主型偏向${PERSONAL_AXES[axis.key][target.profile[axis.key]]}`).join('；') + '。'
          + (easier ? '三个明确方向同向，可能减少这些安排上的协调。' : '三个明确方向不同，需要逐项商量取舍。'),
        consideration: easier ? '偏好同向仍需确认实际行为与双方需要。'
          : '这表示需要讨论的优先级差异，不表示对方有缺陷或关系必然不合。',
        action: `${type.discussion}${target.discussion}`
      };
    };
    const opposite = PERSONAL_TYPES.find(target => Object.keys(PERSONAL_AXES).every(key => target.profile[key] !== type.profile[key]));
    return [{
      typeId: type.id, typeName: type.name, evidence: row.supporting,
      easier: make(type, true), harder: make(opposite, false)
    }];
  });
  const coexistence = repeated.some(row => row.id === 'autonomy') && repeated.some(row => row.id === 'connection')
    ? [{ title: '需要联系，也希望保留空间', text: '你在联系与自主两组情境里都有重复选择。这两种需要可以同时成立，可分别约定共同时间与个人决定范围。',
      evidence: repeated.filter(row => ['autonomy', 'connection'].includes(row.id)).flatMap(row => row.supporting) }]
    : [];
  const promise = evidence.get('ex-17-2');
  const temptation = evidence.get('ex-28-4');
  const differences = promise && temptation && ['ex-17-2:0', 'ex-17-2:1'].includes(promise.optionId)
      && ['ex-28-4:2', 'ex-28-4:3'].includes(temptation.optionId)
    ? [{ title: '承诺遇到更高收益时，选择发生变化', text: '你在一般活动与额外收入的情境中选了不同的处理方式。可以核对收益、关系和代价如何影响选择；这还不能证明你存在固定的内在矛盾。',
      evidence: [promise, temptation] }]
    : [];
  const situations = PERSONAL_SITUATIONS.map(([name, id, check]) => ({
    name, check, evidence: evidence.get(id) || null
  }));
  return {
    version: PERSONAL_EXPLANATION_VERSION, context: 'personal', source: 'self_report',
    classificationStatus: taxonomy.status, validated: false, taxonomy,
    primaryTypes: taxonomy.primary, secondaryTypes: taxonomy.secondary,
    title: taxonomy.primary.length ? taxonomy.primary.map(row => row.name).join(' · ')
      : report.groupId ? '本组选择与特征'
      : taxonomy.status === 'incomplete' ? '继续完善个人方向画像' : '情境取舍，保留方向画像',
    summary: taxonomy.primary.length
      ? `本次主型：${taxonomy.primary[0].name}。${taxonomy.axes.map(axis => `${axis.name}偏向${axis.text}`).join('；')}。`
      : repeated.length
      ? `本次回答中，${repeated.map(row => row.label).join('、')}在多个指定情境里重复出现。`
      : evidence.size
        ? '本次有效回答已保留。当前特征规则尚不能将这些选择归纳为重复特征，可从具体情境继续了解自己的取舍。'
        : '目前尚无有效回答。下方保留跳过和未答状态，完成相关主题后再生成解释。',
    features, repeated, mixed, coexistence, differences, situations, references,
    usage: {
      daily: '用于日常相处时，先讨论联系、支持、边界和分歧处理。',
      cooperation: '用于评估合作时，还要核验实际能力、投入、交付记录，并确认权限、分配与退出。'
    }
  };
}

function isCurrentPersonalProfile(profile, allowSnapshot = false) {
  const textFields = (row, keys) => row && keys.every(key => typeof row[key] === 'string');
  const evidenceRows = rows => Array.isArray(rows) && rows.every(row =>
    textFields(row, ['questionId', 'questionText', 'optionId', 'text']));
  return (profile?.version === PERSONAL_EXPLANATION_VERSION
      || allowSnapshot && profile?.version === 'rct-personal-explanation-v3')
    && profile.taxonomy?.version === PERSONAL_TYPE_VERSION
    && Array.isArray(profile.taxonomy.axes) && profile.taxonomy.axes.length === 3
    && profile.taxonomy.axes.every(axis => textFields(axis, ['key', 'name', 'text', 'direction'])
      && evidenceRows(axis.answers) && Number.isInteger(axis.counts?.neg) && Number.isInteger(axis.counts?.pos))
    && Array.isArray(profile.taxonomy.rows) && profile.taxonomy.rows.length === PERSONAL_TYPES.length
    && profile.taxonomy.rows.every(row => textFields(row, ['id', 'name', 'animal', 'emoji', 'focus', 'description', 'strength', 'caution'])
      && Number.isInteger(row.observed) && Number.isInteger(row.supported)
      && evidenceRows(row.supporting) && evidenceRows(row.otherChoices))
    && ['primaryTypes', 'secondaryTypes'].every(key => Array.isArray(profile[key])
      && profile[key].every(row => profile.taxonomy.rows.some(type => type.id === row.id)
        && textFields(row, ['id', 'name', 'animal']) && evidenceRows(row.supporting)))
    && textFields(profile, ['title', 'summary'])
    && textFields(profile.usage, ['daily', 'cooperation'])
    && ['features', 'repeated', 'mixed'].every(key => Array.isArray(profile[key]) && profile[key].every(row =>
      textFields(row, ['id', 'label', 'summary', 'benefit', 'watch'])
      && Number.isInteger(row.total) && evidenceRows(row.supporting) && evidenceRows(row.otherChoices)))
    && ['coexistence', 'differences'].every(key => Array.isArray(profile[key]) && profile[key].every(row =>
      textFields(row, ['title', 'text']) && evidenceRows(row.evidence)))
    && Array.isArray(profile.situations) && profile.situations.every(row =>
      textFields(row, ['name', 'check']) && (row.evidence === null || evidenceRows([row.evidence])))
    && Array.isArray(profile.references) && profile.references.every(row =>
      textFields(row, ['typeId', 'typeName']) && evidenceRows(row.evidence)
      && ['easier', 'harder'].every(key => textFields(row[key], ['id', 'name', 'animal', 'emoji', 'description', 'basis', 'consideration', 'action'])));
}
