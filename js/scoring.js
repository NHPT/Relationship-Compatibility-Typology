/* ============================================================
 * RCT 关系适配类型学 — 计分与类型判定
 * 8 型 = 三主轴（人生主轴 × 关系形态 × 金钱模式）+ 2 警示型
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

/* ---------- 置信度：离阈值越远越可信 ---------- */
function confidence(val, threshold = 2) {
  const dist = Math.abs(val) - threshold;
  if (dist >= 3) return '高';
  if (dist >= 1) return '中';
  return '低';
}

/* ---------- 类型判定（警示优先 → 三主轴 → 标签） ---------- */
function classify(totals) {
  // 1) 警示优先
  const warnings = [];
  if (totals.C >= 3) warnings.push('E');
  if (totals.B >= 3) warnings.push('F');

  if (warnings.length > 0) {
    return {
      type: warnings.join('/'),
      isWarning: true,
      warnings,
      totals,
      label: classifyLabels(totals)
    };
  }

  // 2) 三主轴
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
    isWarning: false,
    warnings: [],
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
 * 类型画像数据（8 型 + 2 警示 + 摇摆）
 * ============================================================ */
const TYPES = {
  A1: {
    code: 'A1', name: '安稳共栖·稳重型', family: 'A',
    axes: '安稳守成 × 深度共生 × 规划积累',
    core: '求稳恋家、重陪伴，金钱保守、精打细算',
    tags: '定居扎根 · 生育意愿较高',
    strength: '稳定顾家、经济稳妥，是长期关系的压舱石',
    risk: '生活偏平淡、过度依赖；过于节俭可能压抑共同体验'
  },
  A2: {
    code: 'A2', name: '安稳共栖·温情型', family: 'A',
    axes: '安稳守成 × 深度共生 × 即时体验',
    core: '求稳恋家、重陪伴，舍得为亲密和体验花钱',
    tags: '定居扎根 · 生育意愿较高',
    strength: '温暖体贴，会把日子过得有温度',
    risk: '体验型消费与稳定诉求可能冲突；依赖度高'
  },
  B1: {
    code: 'B1', name: '安稳自在·克制型', family: 'B',
    axes: '安稳守成 × 独立并置 × 规划积累',
    core: '求稳但重个人空间，金钱克制、边界清晰',
    tags: '定居扎根 · 冲突偏直面',
    strength: '情绪稳定、边界清楚、经济理性，最好相处',
    risk: '太独立导致亲密感不足；过于克制显得冷'
  },
  B2: {
    code: 'B2', name: '安稳自在·随性型', family: 'B',
    axes: '安稳守成 × 独立并置 × 即时体验',
    core: '求稳但重个人空间，花钱随性、重体验',
    tags: '定居扎根 · 冲突偏直面',
    strength: '自洽、会享受、不拖累人',
    risk: '独立 + 随性，亲密感不足且难以稳定绑定'
  },
  C1: {
    code: 'C1', name: '并肩进取·务实型', family: 'C',
    axes: '进取攀登 × 深度共生 × 规划积累',
    core: '上进且重关系，目标感强、金钱务实',
    tags: '定居半流动 · 节奏快',
    strength: '有冲劲、会规划，适合共同搞事业',
    risk: '事业与关系冲突；过于务实可能牺牲体验'
  },
  C2: {
    code: 'C2', name: '并肩进取·激情型', family: 'C',
    axes: '进取攀登 × 深度共生 × 即时体验',
    core: '上进且重关系，目标感强、舍得投入体验',
    tags: '定居半流动 · 节奏快',
    strength: '有冲劲、有热情，能带动关系往前',
    risk: '节奏快叠加高消费，内耗大'
  },
  D1: {
    code: 'D1', name: '自由追梦·理性型', family: 'D',
    axes: '进取攀登 × 独立并置 × 规划积累',
    core: '上进且爱自由，金钱理性、边界强',
    tags: '强流动 · 生育待定/偏低',
    strength: '单兵强、自驱、不拖累人',
    risk: '难长期绑定；定居/生育是硬分歧'
  },
  D2: {
    code: 'D2', name: '自由追梦·洒脱型', family: 'D',
    axes: '进取攀登 × 独立并置 × 即时体验',
    core: '上进且爱自由，重体验、活得通透',
    tags: '强流动 · 生育待定/偏低',
    strength: '创造力强、不内耗、敢于探索',
    risk: '不愿安顿、消费随性，难长期绑定'
  },
  E: {
    code: 'E', name: '回避压抑型', family: null,
    axes: '警示型（冲突回避主导）',
    core: '遇冲突冷处理、翻旧账、难修复',
    tags: '—',
    strength: '—',
    risk: '冷战死锁，问题永不解决，是长期关系头号杀手'
  },
  F: {
    code: 'F', name: '边界模糊型', family: null,
    axes: '警示型（边界模糊主导）',
    core: '忠诚/异性边界或原生家庭边界不清',
    tags: '—',
    strength: '—',
    risk: '信任危机；父母或外部力量过度介入关系'
  },
  SWING: {
    code: 'SWING', name: '摇摆型', family: null,
    axes: '主轴未定型',
    core: '某主轴倾向处于均衡/矛盾状态',
    tags: '—',
    strength: '—',
    risk: '行为不一致或处于人生转折期，需拉长观察'
  }
};

/* 家族定义：首字母 → 主轴坐标 */
const FAMILIES = {
  A: { axis: 'neg', rel: 'neg' }, // 安稳 × 共生
  B: { axis: 'neg', rel: 'pos' }, // 安稳 × 独立
  C: { axis: 'pos', rel: 'neg' }, // 进取 × 共生
  D: { axis: 'pos', rel: 'pos' }  // 进取 × 独立
};

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
  if ((la.生育意愿 === '想要孩子' && lb.生育意愿 === '不想要孩子') ||
      (la.生育意愿 === '不想要孩子' && lb.生育意愿 === '想要孩子')) {
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
