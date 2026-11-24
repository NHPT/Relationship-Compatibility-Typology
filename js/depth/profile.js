(function (root) {
  'use strict';
  const M = root.RCT_MODEL || require('./model.json');
  const I = root.RCT_IDENTITY || require('./identity.js');
  const A = root.RCT_AFFINITIES || require('./affinities.js');
  const PRESENTATION_VERSION = 'rct-profile-v2';
  const types = {
    T01: { animal: '大象', symbol: 'elephant', theme: '守约', title: '原则守约型',
      description: '你更重视约定、真实信息与规则的一致性。面对取舍时，你倾向先确认哪些责任需要承担、哪些变化应当告知。',
      tension: '当现实收益与既定原则发生冲突时，需要留意能否把协商和善后落实，而不只停留在态度上。' },
    T02: { animal: '海豚', symbol: 'dolphin', theme: '协作', title: '互惠协作型',
      description: '你更重视共同推进、知情分配和彼此有回应的合作。你倾向把问题放到双方都能理解的规则中解决。',
      tension: '合作遇到利益分歧时，需要留意是否仍能公平分配，而不是依赖一方持续让步。' },
    T03: { animal: '企鹅', symbol: 'penguin', theme: '关怀', title: '关怀投入型',
      description: '你倾向把关心落实为能力范围内的帮助和关系投入，愿意关注他人的处境与持续需要。',
      tension: '照料压力上升时，需要同时表达自己的限度，避免把付出变成交换、控制或长期透支。' },
    T04: { animal: '雪豹', symbol: 'leopard', theme: '边界', title: '务实边界型',
      description: '你更重视自主、资源限制和责任范围，倾向先确认代价与边界，再决定如何投入。',
      tension: '需要区分合理拒绝与责任逃避：保留边界的同时，已经承诺的责任仍需告知、协商与交接。' },
    T05: { animal: '陆龟', symbol: 'tortoise', theme: '审慎', title: '审慎自保型',
      description: '你更关注安全、保障和备用安排，倾向先评估风险，再采取行动。',
      tension: '谨慎有助于避免损失；也需要留意是否因反复等待确定性而错过可控的小步尝试。' },
    T06: { animal: '狐狸', symbol: 'fox', theme: '探索', title: '自主探索型',
      description: '你重视自主决定和探索空间，倾向尝试新的方向，并保留调整路径的余地。',
      tension: '独立与探索需要和实际能力、资源及对他人的承诺一起核对，不能只凭意愿判断能否完成。' },
    T07: { animal: '乌鸦', symbol: 'raven', theme: '创意', title: '创意试验型',
      description: '你倾向通过新想法、小步试验和反馈寻找办法，比起只沿用熟悉安排，更愿意尝试不同路径。',
      tension: '点子与试验还需走到作品或成果；真实质量、专业技能和完成度需要另外观察。' },
    T08: { animal: '河狸', symbol: 'beaver', theme: '执行', title: '目标执行型',
      description: '你更重视把目标拆成步骤、持续推进和按约交付，倾向通过实际行动建立进展。',
      tension: '推进遇到资源或条件变化时，需要同时更新预期；做事意愿不能直接保证未来成就。' },
    T09: { animal: '狮子', symbol: 'lion', theme: '主导', title: '组织主导型',
      description: '你更愿意参与决策、协调资源并影响事情的方向，倾向在群体中承担组织角色。',
      tension: '主导意愿与权力使用需要分开看：能否听取不同意见、尊重拒绝和保留共同决策权尤其重要。' },
    T10: { animal: '孔雀', symbol: 'peacock', theme: '认可', title: '认可驱动型',
      description: '你较在意表现、外界评价和被看见的价值，倾向通过展示成果或维持形象获得回应。',
      tension: '受到批评或评价不如预期时，需要留意是否仍能承认事实与错误，而不把形象放在真实信息之前。' },
    T11: { animal: '狼', symbol: 'wolf', theme: '归属', title: '陪伴归属型',
      description: '你更重视陪伴、重要关系和群体归属，倾向通过持续联系与共同经历建立稳定感。',
      tension: '关系中的空间需求不一定代表疏远，需要留意能否允许不同节奏，而不以依赖或控制维持联系。' },
    T12: { animal: '章鱼', symbol: 'octopus', theme: '调整', title: '情境调整型',
      description: '你倾向根据新的条件、信息和反馈调整方向，愿意重新安排目标与做法。',
      tension: '灵活调整需要向受影响的人说明变化，协商更新与隐藏违约有不同的后果。' },
    T13: { animal: '鹰', symbol: 'eagle', theme: '收益', title: '收益优先型',
      description: '你在取舍中更重视收入、收益和可用资源，倾向把现实回报作为决定的重要依据。',
      tension: '收益优先与侵占、隐瞒、违约分别判断。利益增大时，是否仍尊重知情同意和原有约定是关键。' },
    T14: { animal: '鹿', symbol: 'deer', theme: '缓和', title: '冲突回避型',
      description: '你倾向减少直接冲突，先缓和情绪或留出空间，再面对分歧。',
      tension: '暂停有助于冷静，但需要约定何时回谈；持续拖延、惩罚性失联和负责任的暂停不能混为一谈。' }
  };
  const baseAxes = [
    { id: 'commitment', name: '守约可靠', positive: ['K'], negative: ['k'], indicator: '承诺履行',
      high: '你更倾向履行明确约定，条件变化时主动协商，而不是让对方突然承担中断与等待。',
      low: '守约和主动协商在目前的选择中不够突出，责任期限、变更告知与善后方式需要更明确。',
      risk: '面对收益或条件变化时，存在单方改变约定并让他人承担后果的倾向。',
      task: '留意承诺变化时，能否及时告知、完成交接，并持续跟进已经答应的责任。' },
    { id: 'transparency', name: '信息透明', positive: ['H'], negative: ['h'], indicator: '信息透明',
      high: '你更倾向及时说明相关事实、真实顾虑和变化，让受影响的人能够知情决定。',
      low: '主动披露在目前的选择中不够突出。少说、缓说或模糊表达可能让对方难以判断真实情况。',
      risk: '涉及利益、错误或关系变化时，存在隐瞒或误导相关方的倾向。',
      task: '留意重要信息的披露时间，以及对方是否在做决定前真正知道事实。' },
    { id: 'responsibility', name: '责任担当', positive: ['R'], negative: ['r'], indicator: '责任与修复',
      high: '你更倾向承认属于自己的责任，并采取补救和后续跟进，而不只解释原因。',
      low: '承担与补救在目前的选择中不够突出，需要把责任范围和后续行动落实得更具体。',
      risk: '压力或差错出现时，存在推责、回避补救或突然退出的倾向。',
      task: '留意出了问题以后，谁在实际处理后果，补救是否完成。' },
    { id: 'boundaries', name: '尊重边界', positive: ['B'], negative: ['b'], indicator: '自主与边界',
      high: '你更倾向尊重他人的拒绝、隐私与自主，愿意在不同需要之间重新协商。',
      low: '对拒绝权与隐私的尊重在目前选择中不够突出，需要进一步明确对方是否可以自由拒绝或离开。',
      risk: '受到拒绝、失去控制或面对依赖关系时，存在施压、威胁或限制自主的倾向。',
      task: '留意拒绝之后是否仍被尊重，以及关系中的隐私、决定权和离开权是否得到保留。' },
    { id: 'fairness', name: '公平互惠', positive: ['F'], negative: ['f'], indicator: '公平互惠',
      high: '你更倾向按知情规则分配资源和责任，重视双方都理解并接受的安排。',
      low: '公平分配在目前选择中不够突出，需要更明确地核对共同资源、收益和谁承担成本。',
      risk: '共同利益变化时，存在未经充分同意占用资源或转嫁成本的倾向。',
      task: '留意资源权限、成本承担和分配规则，是否得到相关方真实同意。' },
    { id: 'care', name: '关怀投入', positive: ['E'], negative: ['e'], indicator: '关怀与照料',
      high: '你更倾向提供能力范围内的具体帮助，愿意关注困难中的人及其持续需要。',
      low: '具体照料和支持在目前选择中不够突出，情感态度与持续行动之间仍需更多观察。',
      risk: '面对他人的脆弱或困难时，存在贬低、羞辱或利用其处境的倾向。',
      task: '留意困难持续时是否仍有实际支持，同时能否表达限度而不借付出施压。' },
    { id: 'learning', name: '学习调整', positive: ['L'], negative: ['l'], indicator: '学习与复盘',
      high: '你更倾向核对证据、接受反馈并调整做法，愿意从错误和变化中修正判断。',
      low: '依据反馈修正在目前选择中不够突出，需要更多观察新信息是否真正改变后续行动。',
      risk: '受到质疑或面对错误证据时，存在否认事实、拒绝核对的倾向。',
      task: '留意反馈后的具体修正，以及同一问题是否反复出现。' },
    { id: 'creation', name: '试验推进', positive: ['X', 'G'], negative: [], indicator: '执行方式',
      high: '你更倾向尝试办法、拆分目标并推进下一步，愿意把想法带入可观察的行动。',
      low: '试验与分步推进在目前选择中不够突出，可能更偏向熟悉安排或灵活调整，需要看实际成果。',
      risk: '', task: '点子、试验、完成度与作品质量分别看；这些选择不能保证未来能力或成就。' }
  ];
  const marriageAxes = [
    { ...baseAxes[0], name: '持续承诺' },
    baseAxes[1],
    { ...baseAxes[2], name: '家庭分担', topicIds: [3, 4, 9] },
    baseAxes[3],
    { ...baseAxes[4], name: '共同财务', positive: ['F', 'J'], negative: ['f', 'j'], topicIds: [5, 6],
      high: '你更倾向把共同资金、消费预算和风险责任讲清楚，重视双方知情同意。',
      low: '共同预算与风险责任在目前选择中不够明确，需要确认债务、消费和谁来兜底。',
      risk: '财务安排中存在未充分告知、未经同意占用资源或要求他人兜底的倾向。' },
    { ...baseAxes[5], name: '长期照料', topicIds: [3, 4, 9] },
    { ...baseAxes[6], name: '冲突修复', positive: ['R', 'L', 'B'], negative: ['r', 'l', 'b', 'T'], topicIds: [8],
      high: '你更倾向在冷静后继续讨论，承认失误并修复，而不是让争执持续累积。',
      low: '回谈和具体修复在目前选择中不够突出，需要明确暂停时间、后续行动和重复问题的处理。',
      risk: '分歧中存在失联、羞辱、报复或以压力迫使对方让步的倾向。' },
    { ...baseAxes[7], name: '未来投入', positive: ['G', 'H', 'J', 'K'], negative: ['h', 'j', 'k'], topicIds: [12],
      high: '你更倾向共同讨论未来计划，并说明变化如何影响对方的投入。',
      low: '共同计划的推进与变化告知在目前选择中不够明确，长期意愿还需落实成行动。',
      risk: '未来安排变化时，存在单方决定、隐瞒或转嫁投入成本的倾向。' }
  ];
  const riskCopy = {
    '信息透明': ['重要信息的隐瞒', '在利益、错误或关系变化中，存在没有充分告知相关方的倾向，可能让他人基于不完整的信息做决定。', '及时说明事实和真实顾虑'],
    '承诺履行': ['约定变化时的责任', '条件或收益发生变化时，存在单方改变约定的倾向，可能让合作方或伴侣承担突然中断、等待与交接成本。', '履约或知情协商变化'],
    '责任与修复': ['压力下的责任回避', '差错或压力出现时，存在回避补救、推责或退出的倾向，后果可能集中到其他人身上。', '承认责任并跟进补救'],
    '自主与边界': ['拒绝与自主边界', '关系中的拒绝、隐私或决定权受到挑战时，存在施压或限制自主的倾向，需要优先留意对方能否自由拒绝和离开。', '尊重拒绝与隐私'],
    '公平互惠': ['共同利益的分配', '共同资源与收益发生变化时，存在未充分同意就占用资源或转嫁成本的倾向，可能增加不公平负担。', '按知情规则分配'],
    '关怀与照料': ['困难中的对待方式', '面对他人的脆弱或困难时，存在贬低、羞辱或利用处境的倾向，可能让支持变成压力。', '提供能力内的实际帮助'],
    '风险管理': ['代价与兜底责任', '行动、消费或投资中，存在低估明显代价或要求他人承担未经同意损失的倾向，需要明确风险由谁承担。', '评估代价与退出条件'],
    '学习与复盘': ['面对错误与反馈', '受到质疑或遇到错误证据时，存在否认或拒绝核对的倾向，可能使相同问题重复出现。', '核对证据并修正'],
    '冲突与报复': ['冲突后的报复倾向', '面对争执或受损感时，存在用报复或破坏回应的倾向，可能加深关系与资源上的损失。', '暂无同指标的相反行动信息']
  };
  const riskShort = {
    '信息透明': '重要事实可能没有及时告知。',
    '承诺履行': '约定改变时可能缺少协商与交接。',
    '责任与修复': '压力下可能推责或回避补救。',
    '自主与边界': '拒绝、隐私或自主可能受到施压。',
    '公平互惠': '共同资源或成本可能未经同意分配。',
    '关怀与照料': '困难处境可能被贬低或利用。',
    '风险管理': '明显代价或兜底责任可能被忽略。',
    '学习与复盘': '错误与反馈可能没有得到核对。',
    '冲突与报复': '冲突后可能以报复或破坏回应。'
  };
  const hasTag = (row, tags) => row.tags.some(t => tags.includes(t));
  const axisCopy = {
    commitment: ['变化时倾向先协商，再调整约定。', '守约与调整会随条件取舍。', '需要说清期限、变更与交接。'],
    transparency: ['倾向在决定前说明重要事实。', '披露时机与范围会随条件取舍。', '需要更及时地说清相关事实。'],
    responsibility: ['倾向承担责任并跟进补救。', '承担方式会随资源与压力取舍。', '需要把分工与补救落实到行动。'],
    boundaries: ['倾向保留拒绝权、隐私与自主。', '自主与共同需要会随情境取舍。', '需要明确拒绝、隐私与决定权。'],
    fairness: ['倾向按知情规则分配资源。', '资源与成本分配会随情境取舍。', '需要核对授权、成本与分配规则。'],
    care: ['倾向提供具体、持续的帮助。', '支持投入会随资源与处境取舍。', '需要更多实际照料与支持。'],
    learning: ['倾向核对反馈并修正做法。', '调整与原有判断会随条件取舍。', '需要跟进反馈后的具体修正。'],
    creation: ['倾向试新办法并推进下一步。', '尝试与熟悉安排会随条件取舍。', '更偏向熟悉安排，成果仍需观察。']
  };
  function measure(summary, def) {
    const opportunities = M.items.filter(q => q.scope === summary.scope && q.phase === 'core' &&
      (!def.topicIds || def.topicIds.includes(q.topicId)) &&
      q.options.some(o => o.tags.some(t => [...def.positive, ...def.negative].includes(t))));
    const ids = new Set(opportunities.map(q => q.id));
    const observed = summary.rows.filter(r => ids.has(r.questionId));
    const allRelevant = summary.rows.filter(r => (!def.topicIds || def.topicIds.includes(r.topicId)));
    const supports = observed.filter(r => hasTag(r, def.positive));
    const risks = allRelevant.filter(r => hasTag(r, def.negative));
    const covered = observed.length >= Math.min(3, opportunities.length) && opportunities.length > 0 &&
      observed.length / opportunities.length >= 0.5;
    const value = covered ? Math.round(supports.length / observed.length * 100) : null;
    const heading = !covered ? '仍需观察' : value >= 70 ? '经常采用' : value >= 40 ? '因情境取舍' : '较少采用';
    let description = !covered ? '这一方面的信息还不充分，目前不判断表现高低。'
      : value >= 70 ? def.high : value >= 40
        ? `${def.high} 但这种做法并非在各种情境中都同样突出，取舍会受到条件影响。` : def.low;
    if (risks.length && def.risk) description += ` ${def.risk}`;
    const short = !covered ? '信息还不充分，暂不判断高低。'
      : axisCopy[def.id][value >= 70 ? 0 : value >= 40 ? 1 : 2];
    return { id: def.id, name: def.name, value, heading, description, task: def.task,
      short,
      supportCount: supports.length, observedCount: observed.length, opportunityCount: opportunities.length,
      riskCount: risks.length, historyCount: observed.filter(r => r.mode === 'history').length };
  }
  function narrative(identity) {
    return { title: identity.title, subtitle: identity.subtitle,
      eyebrow: identity.scope === 'personal' ? '个人 · 性格画像' : '婚恋 · 相处画像',
      description: identity.lead, symbols: identity.symbols,
      tension: identity.scope === 'personal' ? identity.selected.slice(0, 2).map(t => types[t.id].tension).join(' ') : '',
      symbolMeaning: '动物图案是取向的视觉象征' };
  }
  function risks(summary) {
    const rank = { boundary_safety_review: 0, repeated_answer_signal: 1, single_or_same_topic_signal: 2 };
    return summary.indicators.filter(i => i.risk.length).sort((a, b) =>
      (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || b.risk.length - a.risk.length).map(i => {
      const copy = riskCopy[i.name] || [i.name, '这一方面存在值得进一步观察的取舍。', '不同条件下的负责处理'];
      return { title: copy[0], description: copy[1], priority: i.status === 'boundary_safety_review',
        repeated: i.status === 'repeated_answer_signal',
        short: riskShort[i.name] || '这一方面需要进一步观察。',
        recurrence: i.status === 'repeated_answer_signal' ? i.historyRisk
          ? '这个倾向在不同情境中重复出现，并包含自述经历。'
          : '这个倾向在设想的不同情境中重复出现，现实表现仍需观察。'
          : '这属于特定情境下的提示，不能据此判断所有情况下都会如此。',
        counter: i.protect.length ? `同时也呈现${copy[2]}的做法，说明不同条件下的处理可能有所不同；这不会消除上述需要留意的部分。` : '',
        limit: '这描述的是当前倾向，不是对真实长期行为的定论。' };
    });
  }
  function preferences(summary) {
    if (summary.scope !== 'personal') return [];
    const pick = tags => summary.rows.filter(r => r.phase === 'core' && hasTag(r, tags)).length;
    const groups = [
      { name: '利益与意义', a: ['M'], b: ['V'], left: '取舍时更重视收入、收益与资源', right: '取舍时更重视个人意义与信念', both: '会同时权衡现实回报与个人意义', note: '收益偏好与隐瞒、侵占或违约分别判断。' },
      { name: '自主与协作', a: ['A'], b: ['C', 'D'], left: '更愿意保留自主决定和独立安排', right: '更愿意参与共同推进或组织决策', both: '会在自主安排与共同推进之间取舍', note: '主导意愿不等于组织能力，也不替代对他人自主的尊重。' },
      { name: '探索与稳定', a: ['X'], b: ['Z'], left: '更愿意尝试新的方向和办法', right: '更愿意维持熟悉而稳定的安排', both: '会兼顾新的尝试与熟悉的安排', note: '偏好本身没有统一优劣，需要结合资源、承诺和实际成果。' }
    ];
    return groups.map(g => {
      const a = pick(g.a), b = pick(g.b);
      return { name: g.name, description: !a && !b ? '目前的信息还不足以概括这一取舍。'
        : a >= b * 1.5 && a >= 3 ? g.left + '。'
        : b >= a * 1.5 && b >= 3 ? g.right + '。' : g.both + '。', note: g.note };
    });
  }
  function present(report) {
    const summary = report.derived;
    const axes = (summary.scope === 'marriage' ? marriageAxes : baseAxes).map(d => measure(summary, d));
    const identity = I.build(report, axes), cautions = risks(summary);
    return { version: PRESENTATION_VERSION, scope: summary.scope, axes,
      identity, affinities: A.compare(identity, cautions),
      narrative: narrative(identity), risks: cautions, preferences: preferences(summary),
      hasEvidence: summary.rows.length > 0, completeRadar: axes.every(a => a.value !== null),
      radarNote: '越外侧，越常采用该做法。比例来自相关核心题，灰点表示信息不足；不是能力或忠诚分数。' };
  }
  root.RCT_PROFILE = { present, types, PRESENTATION_VERSION };
  if (typeof module !== 'undefined') module.exports = root.RCT_PROFILE;
})(typeof window !== 'undefined' ? window : globalThis);
