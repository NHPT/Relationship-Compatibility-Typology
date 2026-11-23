/* ============================================================
 * RCT 关系适配类型学 — 计分与类型判定
 * 8 型 = 三主轴（人生主轴 × 关系形态 × 金钱模式）
 * 冲突与边界是附加观察标记，不覆盖主轴类型
 * ============================================================ */

/* ---------- 计分：累加各维度净分 ---------- */
function scoreTest(answers) {
  const totals = { X: 0, Y: 0, C: 0, B: 0, M: 0, K: 0, S: 0 };
  for (const a of answers) {
    totals[a.dimension] += a.score;
  }
  return totals;
}

/* ---------- 主轴/标签倾向判定 ---------- */
/* 阈值：|净分| >= 2 判向；< 2 视为均衡/摇摆 */
function side(val, threshold = 2) {
  if (val >= threshold) return 'pos';
  if (val <= -threshold) return 'neg';
  return 'mid';
}

/* ---------- 阈值距离：仅反映分类边界，不是准确性置信度 ---------- */
function confidence(val, threshold = 2) {
  const dist = Math.abs(val) - threshold;
  if (dist >= 3) return '高';
  if (dist >= 1) return '中';
  return '低';
}

/* ---------- 类型判定（三主轴 + 独立观察标记 + 标签） ---------- */
function classify(totals) {
  const warnings = [];
  if (totals.C >= 3) warnings.push('E');
  if (totals.B >= 3) warnings.push('F');

  // 无论是否触发观察规则，都保留三主轴归纳。
  const x = side(totals.X); // pos=进取 neg=安稳
  const y = side(totals.Y); // pos=独立 neg=共生
  const m = side(totals.M); // pos=体验 neg=规划

  // 8 型映射：x(人生主轴) × y(关系形态) × m(金钱模式)
  const map = {
    'neg-neg-neg': 'A1', // 安稳 × 共生 × 规划
    'neg-neg-pos': 'A2', // 安稳 × 共生 × 体验
    'neg-pos-neg': 'B1', // 安稳 × 独立 × 规划
    'neg-pos-pos': 'B2', // 安稳 × 独立 × 体验
    'pos-neg-neg': 'C1', // 进取 × 共生 × 规划
    'pos-neg-pos': 'C2', // 进取 × 共生 × 体验
    'pos-pos-neg': 'D1', // 进取 × 独立 × 规划
    'pos-pos-pos': 'D2'  // 进取 × 独立 × 体验
  };
  const type = map[`${x}-${y}-${m}`] || 'SWING';

  return {
    type,
    isWarning: warnings.length > 0,
    warnings,
    x, y, m,
    xVal: totals.X,
    yVal: totals.Y,
    mVal: totals.M,
    totals,
    label: classifyLabels(totals),
    confidence: {
      x: confidence(totals.X),
      y: confidence(totals.Y),
      m: confidence(totals.M)
    },
    swing: (x === 'mid' || y === 'mid' || m === 'mid')
  };
}

/* ---------- 标签判定（生育/定居；金钱模式已升级为类型轴） ---------- */
function classifyLabels(totals) {
  let k;
  if (totals.K >= 3) k = '想要孩子';
  else if (totals.K <= -2) k = '不想要孩子';
  else k = '待定/不强求';

  let s;
  if (totals.S >= 2) s = '流动探索';
  else if (totals.S <= -2) s = '扎根安定';
  else s = '均衡';

  return { 生育意愿: k, 定居倾向: s };
}

/* ============================================================
 * 类型画像数据（8 型 + 未明确；E/F 兼容旧记录及观察标记）
 * ============================================================ */
const TYPES = {
  A1: {
    code: 'A1', name: '安稳共栖·稳重型', family: 'A',
    axes: '安稳守成 × 深度共生 × 规划积累',
    core: '本次回答偏向稳定目标、共同参与和提前安排金钱',
    strength: '共同目标与预算安排可能比较明确',
    risk: '需协商各自空间及临时开支'
  },
  A2: {
    code: 'A2', name: '安稳共栖·温情型', family: 'A',
    axes: '安稳守成 × 深度共生 × 即时体验',
    core: '本次回答偏向稳定目标、共同参与和当前体验',
    strength: '可能重视共同活动与当下体验',
    risk: '需协商体验支出与长期预算'
  },
  B1: {
    code: 'B1', name: '安稳自在·克制型', family: 'B',
    axes: '安稳守成 × 独立并置 × 规划积累',
    core: '本次回答偏向稳定目标、个人空间和提前安排金钱',
    strength: '可能更愿意明确各自任务与预算',
    risk: '需协商共同参与程度和支出安排'
  },
  B2: {
    code: 'B2', name: '安稳自在·随性型', family: 'B',
    axes: '安稳守成 × 独立并置 × 即时体验',
    core: '本次回答偏向稳定目标、个人空间和当前体验',
    strength: '可能重视各自空间和自主活动',
    risk: '需协商共同时间与体验预算'
  },
  C1: {
    code: 'C1', name: '并肩进取·务实型', family: 'C',
    axes: '进取攀登 × 深度共生 × 规划积累',
    core: '本次回答偏向发展机会、共同参与和提前安排金钱',
    strength: '可能愿意共同讨论目标与资源计划',
    risk: '需协商目标变化、参与程度与资源投入'
  },
  C2: {
    code: 'C2', name: '并肩进取·激情型', family: 'C',
    axes: '进取攀登 × 深度共生 × 即时体验',
    core: '本次回答偏向发展机会、共同参与和当前体验',
    strength: '可能愿意共同尝试新活动或机会',
    risk: '需协商资源投入与可承受的变化'
  },
  D1: {
    code: 'D1', name: '自由追梦·理性型', family: 'D',
    axes: '进取攀登 × 独立并置 × 规划积累',
    core: '本次回答偏向发展机会、个人空间和提前安排金钱',
    strength: '可能更愿意自主推进并安排资源',
    risk: '需协商共同目标、任务接口与空间需求'
  },
  D2: {
    code: 'D2', name: '自由追梦·洒脱型', family: 'D',
    axes: '进取攀登 × 独立并置 × 即时体验',
    core: '本次回答偏向发展机会、个人空间和当前体验',
    strength: '可能更愿意自主尝试新机会',
    risk: '需协商资源投入、责任分工与参与程度'
  },
  E: {
    code: 'E', name: '冲突回避倾向', family: null,
    axes: '观察标记（冲突相关回答）',
    core: '部分回答偏向推迟或回避分歧',
    tags: '—',
    strength: '—',
    risk: '需了解暂停后是否重返沟通；此标记不能证明冲突无法修复'
  },
  F: {
    code: 'F', name: '边界待澄清', family: null,
    axes: '观察标记（交往与家庭边界回答）',
    core: '部分回答涉及不同的交往或家庭决策边界',
    tags: '—',
    strength: '—',
    risk: '当前把不同边界合并计分，不能据此判断不忠或不能独立'
  },
  'E/F': {
    code: 'E/F', name: '冲突与边界观察标记', family: null,
    axes: '冲突、边界相关回答均触发当前观察规则',
    core: '本次回答需要分别澄清冲突处理和交往或家庭边界',
    strength: '—',
    risk: '两个标记不代表同一种问题，也不能作为人品或关系结局判断'
  },
  SWING: {
    code: 'SWING', name: '倾向未明确', family: null,
    axes: '本次未满足类型阈值',
    core: '一条或多条主轴没有明确的分类方向',
    tags: '—',
    strength: '—',
    risk: '可能与题目、情境或居中选择有关，不能据此判断人格不稳定'
  }
};

/* 家族定义：首字母 → 主轴坐标 */
const FAMILIES = {
  A: { axis: 'neg', rel: 'neg' }, // 安稳 × 共生
  B: { axis: 'neg', rel: 'pos' }, // 安稳 × 独立
  C: { axis: 'pos', rel: 'neg' }, // 进取 × 共生
  D: { axis: 'pos', rel: 'pos' }  // 进取 × 独立
};

const NORMAL_TYPES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];
const MATCH_AXES = [
  { key: 'x', dimension: 'X', topic: '目标取向', agreement: '目标与发展节奏' },
  { key: 'y', dimension: 'Y', topic: '相处方式', agreement: '共同时间与各自空间' },
  { key: 'm', dimension: 'M', topic: '金钱偏好', agreement: '预算、储蓄与支出安排' }
];

function typeProfile(typeCode) {
  const type = TYPES[typeCode];
  const family = type && FAMILIES[type.family];
  if (!family) return null;
  return { x: family.axis, y: family.rel, m: typeCode.endsWith('1') ? 'neg' : 'pos' };
}

/* ============================================================
 * 配型判断
 * 返回 { level, reason }
 * level: high 高兼容 / talk 需协议 / risk 高风险 / warn 警示
 * ============================================================ */
function compatibility(a, b, scene) {
  // 警示型优先
  if (a.isWarning || b.isWarning) {
    return { level: 'warn', reason: '存在警示型（回避冲突/边界模糊），需先处理该维度再谈匹配' };
  }
  if (a.type === 'SWING' || b.type === 'SWING') {
    return { level: 'risk', reason: '一方类型未定型（摇摆），结果不可靠，建议多次测试或拉长观察' };
  }

  const ta = TYPES[a.type];
  const tb = TYPES[b.type];
  if (!ta || !tb) return { level: 'risk', reason: '类型未知' };

  // 生育硬冲突（标签层）
  const la = a.label, lb = b.label;
  if (scene === '婚恋' &&
      ((la.生育意愿 === '想要孩子' && lb.生育意愿 === '不想要孩子') ||
       (la.生育意愿 === '不想要孩子' && lb.生育意愿 === '想要孩子'))) {
    return { level: 'risk', reason: '生育意愿硬冲突（一个要、一个不要），无中间解' };
  }

  // 家族与金钱风格
  const fa = ta.family, fb = tb.family;
  const FA = FAMILIES[fa], FB = FAMILIES[fb];
  const sameFamily = fa === fb;
  const sameAxis = FA.axis === FB.axis;      // 人生主轴同向
  const sameRel = FA.rel === FB.rel;          // 关系形态同向
  const sameMoney = a.m === b.m;              // 金钱模式同向

  let level, reason;

  if (sameFamily) {
    if (sameMoney) {
      level = 'high';
      reason = '同家族、金钱风格一致，相处自然、摩擦最小';
    } else {
      level = 'high';
      reason = '同家族、金钱风格互补（规划 × 体验），一个管钱一个享受，是理想搭配';
    }
  } else if (sameAxis && !sameRel) {
    level = 'high';
    reason = '人生主轴一致、关系形态互补，是稳定的高兼容组合' + (sameMoney ? '' : '；金钱风格也互补，更佳');
  } else {
    level = 'talk';
    reason = '人生主轴相反（安稳 × 进取），节奏错位，可互补但需明确协议';
    if (!sameMoney) reason += '；金钱风格也相反，需明确金钱分工与预算';
  }

  // 定居冲突（标签层，婚恋/伙伴场景更敏感）
  if ((la.定居倾向 === '流动探索' && lb.定居倾向 === '扎根安定') ||
      (la.定居倾向 === '扎根安定' && lb.定居倾向 === '流动探索')) {
    if (level === 'high') level = 'talk';
    reason = '定居倾向相反（流动 × 扎根），需谈清谁跟随、多久' + (reason ? '；' + reason : '');
  }

  // 场景调节
  if (scene === '创业') {
    if (FA.axis === 'neg' && FB.axis === 'neg') {
      return { level: 'risk', reason: '创业场景下双方都求稳、缺乏冲劲，难突破' };
    }
  }

  return { level, reason };
}

/* 场景定义（四场景通用） */
const SCENES = [
  { id: '婚恋', name: '婚恋伴侣', desc: '长期共同生活、组建家庭' },
  { id: '创业', name: '搭伙创业', desc: '共同承担风险、一起搞事业' },
  { id: '伙伴', name: '长期伙伴', desc: '长期朋友、事业伙伴、合伙人' },
  { id: '团队', name: '团队协作', desc: '上下级、同事、项目搭档' }
];

/* ============================================================
 * 类型适配参考（单人结果页用）
 * 分组只描述三个设计主轴上的共同点与差异，不预测关系结局。
 * 输入完整结果可保留未明确主轴及旧 E/F 记录中已有的倾向。
 * best：已明确主轴均同向；talk：部分差异；different：三轴均不同。
 * 没有任何明确主轴时仍返回待确认信息，不生成候选排名。
 * ============================================================ */
function getMatchRecommendation(resultOrCode) {
  const totals = typeof resultOrCode === 'object' && resultOrCode?.totals;
  const profile = totals
    ? { x: side(totals.X), y: side(totals.Y), m: side(totals.M) }
    : typeProfile(typeof resultOrCode === 'string' ? resultOrCode : resultOrCode?.type);
  const knownAxes = MATCH_AXES.filter(axis =>
    profile && (profile[axis.key] === 'pos' || profile[axis.key] === 'neg'));
  const unknownAxes = MATCH_AXES.filter(axis => !knownAxes.includes(axis));
  const best = [], talk = [], different = [];
  const details = {};

  if (knownAxes.length) {
    for (const code of NORMAL_TYPES) {
      const other = typeProfile(code);
      const same = knownAxes.filter(axis => profile[axis.key] === other[axis.key]);
      const differences = knownAxes.filter(axis => profile[axis.key] !== other[axis.key]);
      details[code] = {
        same: same.map(axis => `${axis.topic}（${DIMENSIONS[axis.dimension][other[axis.key]]}）`),
        differences: differences.map(axis => axis.agreement),
        unconfirmed: unknownAxes.map(axis => axis.topic)
      };
      if (!differences.length) best.push(code);
      else if (knownAxes.length === 3 && differences.length === 3) different.push(code);
      else talk.push(code);
    }
  }

  return { best, talk, different, details, knownAxes, unknownAxes, calibrated: false };
}
