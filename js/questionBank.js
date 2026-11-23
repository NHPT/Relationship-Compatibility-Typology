/* 固定覆盖、稳定选项标识。四套题库各 32 题，条件题不参与分数。 */
const ASSESSMENT_VERSION = 'rct-scenes-2026-11-23-v3';
const SCENE_BANKS = {};
const AXIS_KEYS = ['X', 'Y', 'M'];
const BEHAVIOR_KEYS = ['D', 'U', 'C', 'B', 'R', 'I', 'J', 'P'];

const BEHAVIORS = {
  D: { name: '需求表达', short: '表达', action: '说清自己的需要、限制和可接受的替代做法' },
  U: { name: '支持回应', short: '支持', action: '先了解对方需要倾听、建议还是具体帮助，再确认自己能提供什么' },
  C: { name: '分歧修复', short: '修复', action: '描述具体分歧；需要暂停时约定重返沟通的时间' },
  B: { name: '约定与透明', short: '约定', action: '确认信息、权限和交往约定；变化前沟通，不以检查隐私代替协商' },
  R: { name: '承诺履行', short: '履约', action: '承诺前核对能力，变化时尽早告知，并给出新的安排' },
  I: { name: '互惠分担', short: '互惠', action: '看见双方投入，讨论持续可行的分担方式' },
  J: { name: '共同决策', short: '决策', action: '先确认各方目标、限制、决定权限和复查节点' },
  P: { name: '压力应对', short: '压力', action: '说明负荷，调整优先级，避免把压力转移给对方' }
};

const SCENARIOS = {
  love: {
    id: 'love', prefix: 'L', name: '婚恋伴侣', object: '伴侣', icon: 'heart',
    desc: '共同生活、亲密空间与家庭安排', accent: '#9d4764',
    instruction: '以同一位伴侣为对象；尚无伴侣时，按你在亲密交往中通常会采用的做法回答。',
    axes: {
      X: { name: '生活节奏', neg: '稳定经营', pos: '共同探索', topic: '生活目标与变化节奏' },
      Y: { name: '陪伴方式', neg: '密切陪伴', pos: '保留空间', topic: '共同时间与独处空间' },
      M: { name: '开支取向', neg: '预算规划', pos: '当前体验', topic: '日常开支与储蓄安排' }
    },
    typeNames: ['安居共筑·规划型', '安居共筑·体验型', '安居自在·规划型', '安居自在·体验型',
      '并肩探索·规划型', '并肩探索·体验型', '自在探索·规划型', '自在探索·体验型'],
    flexibleName: '共同生活·情境弹性型',
    focus: '先确认双方婚育、居住、财务与家庭决策安排，再讨论日常相处方式。',
    behaviorContext: '一起生活时',
    matchNeeds: ['愿意直接表达需要，也尊重拒绝与个人空间', '能兑现约定，分歧后愿意重新沟通', '愿意明确婚育、财务和家庭决定的实际安排']
  },
  friend: {
    id: 'friend', prefix: 'F', name: '朋友相处', object: '朋友', icon: 'circles',
    desc: '联系节奏、支持方式与交往边界', accent: '#357b6c',
    instruction: '以同一位常来往的朋友为对象，按近半年通常的相处方式回答。',
    axes: {
      X: { name: '活动取向', neg: '熟悉日常', pos: '尝试新鲜', topic: '相聚活动与新鲜感' },
      Y: { name: '联系节奏', neg: '频繁联系', pos: '低频自主', topic: '联系频率与回复期待' },
      M: { name: '聚会开支', neg: '控制花费', pos: '体验优先', topic: '聚会预算与费用分担' }
    },
    typeNames: ['日常常伴·节制型', '日常常伴·体验型', '日常自在·节制型', '日常自在·体验型',
      '探索常伴·节制型', '探索常伴·体验型', '探索自在·节制型', '探索自在·体验型'],
    flexibleName: '朋友相处·情境弹性型',
    focus: '确认彼此对联系、支持、借款与隐私的期待；交往频率相同也需要持续互惠。',
    behaviorContext: '朋友来往中',
    matchNeeds: ['尊重联系频率和回复边界，不把慢回复直接理解为疏远', '能先问需要，再提供支持，并承认双方的投入', '对借款、隐私和玩笑尺度愿意明确约定']
  },
  venture: {
    id: 'venture', prefix: 'V', name: '创业合伙', object: '合伙人', icon: 'compass',
    desc: '增长节奏、协作方式与合伙规则', accent: '#9a6826',
    instruction: '以同一位合伙人或拟合作对象为对象，按你通常参与创业合作的方式回答。',
    axes: {
      X: { name: '经营节奏', neg: '稳步经营', pos: '快速试拓', topic: '增长目标与试错节奏' },
      Y: { name: '协作方式', neg: '共同推进', pos: '分工自主', topic: '共同参与与分工接口' },
      M: { name: '资源投入', neg: '现金储备', pos: '增长投入', topic: '现金缓冲与增长投入' }
    },
    typeNames: ['稳营共推·储备型', '稳营共推·投入型', '稳营分工·储备型', '稳营分工·投入型',
      '试拓共推·储备型', '试拓共推·投入型', '试拓分工·储备型', '试拓分工·投入型'],
    flexibleName: '合伙经营·情境弹性型',
    focus: '先核验投入与交付，再书面确认出资、权限、分配、知识产权及退出安排。',
    behaviorContext: '合伙经营中',
    matchNeeds: ['能交付经实际验证的职责，清楚说明投入与限制', '愿意共享必要经营信息，提前报告延期和风险', '能把出资、决策、分配和退出写成可执行约定']
  },
  team: {
    id: 'team', prefix: 'T', name: '团队协作', object: '同事', icon: 'grid',
    desc: '工作节奏、协作接口与交付约定', accent: '#466da6',
    instruction: '以同一个团队或同事为对象，按你近半年通常的协作方式回答。',
    axes: {
      X: { name: '任务节奏', neg: '流程稳定', pos: '迭代尝试', topic: '流程要求与试验节奏' },
      Y: { name: '协作接口', neg: '密切同步', pos: '异步自主', topic: '同步频率与自主范围' },
      M: { name: '资源安排', neg: '预留缓冲', pos: '集中推进', topic: '资源缓冲与集中投入' }
    },
    typeNames: ['流程同步·缓冲型', '流程同步·推进型', '流程自主·缓冲型', '流程自主·推进型',
      '迭代同步·缓冲型', '迭代同步·推进型', '迭代自主·缓冲型', '迭代自主·推进型'],
    flexibleName: '团队协作·情境弹性型',
    focus: '结合岗位要求、实际能力与交付记录确认分工，再明确反馈、升级和工作时间约定。',
    behaviorContext: '团队协作中',
    matchNeeds: ['能确认任务接口、验收标准与决定权限', '出现风险会提前沟通，尊重反馈和工作时间边界', '具备任务所需的实际能力，并有可检查的交付记录']
  }
};

function styleQuestion(sceneId, suffix, text, options) {
  return makeQuestion(sceneId, suffix, 'style', suffix[0], text,
    options.map((text, i) => ({ text, score: [-2, -1, 1, 2][i] })));
}
function behaviorQuestion(sceneId, suffix, text, options) {
  return makeQuestion(sceneId, suffix, 'behavior', suffix[0], text,
    options.map((text, i) => ({ text, score: [3, 2, 1, 0][i] })));
}
function conditionQuestion(sceneId, key, label, text, options, discussion) {
  return {
    ...makeQuestion(sceneId, key, 'condition', key, text,
      options.map(([value, text]) => ({ value, text }))),
    label, discussion
  };
}
function makeQuestion(sceneId, suffix, kind, dimension, text, options) {
  const id = `${sceneId}-${suffix}`;
  return {
    id, sceneId, kind, dimension, text,
    options: options.map((option, i) => ({ ...option, id: `${id}:${i}` }))
  };
}
function getScene(sceneId) {
  const scene = SCENARIOS[sceneId];
  if (!scene) throw new Error('请选择有效的测评场景');
  return scene;
}
function shuffle(items, random = Math.random) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function generateTest(sceneId, random = Math.random) {
  getScene(sceneId);
  const bank = SCENE_BANKS[sceneId];
  if (!bank || bank.length !== 32) throw new Error('场景题库未完整加载');
  // 固定题目覆盖，不把随机变体当等价试卷。仅选项位置随机。
  return bank.map(q => ({ ...q, options: shuffle(q.options, random) }));
}
