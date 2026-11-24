(function (root) {
  'use strict';
  const M = root.RCT_MODEL || require('./model.json');
  const VERSION = 'rct-affinity-rules-v1';
  const rule = (a, b, group, reason, discussion) => ({ a, b, group, reason, discussion });
  // These are transparent design comparisons, not validated relationship outcome predictions.
  const personalRules = [
    rule('T01', 'T08', 'aligned', '都重视约定落实与交付。', '把期限、质量和变化告知方式说清。'),
    rule('T02', 'T03', 'aligned', '都关注关系中的回应与实际投入。', '确认帮助范围和各自可持续的投入。'),
    rule('T03', 'T11', 'aligned', '关怀投入与陪伴需要有共同关注点。', '确认照料方式、联系节奏与独处空间。'),
    rule('T06', 'T07', 'aligned', '都愿意为探索和新办法留出空间。', '先约定试验预算、退出条件和完成目标。'),
    rule('T05', 'T04', 'aligned', '都关注资源限制、代价和责任范围。', '避免只讨论限制而没有明确下一步。'),
    rule('T07', 'T08', 'complement', '试新办法与分步推进可以形成分工。', '确认谁试验、谁落实，以及何时收敛方案。'),
    rule('T04', 'T03', 'complement', '清晰边界与实际关怀有互补空间。', '先谈双方能接受的帮助与拒绝方式。'),
    rule('T09', 'T02', 'complement', '组织方向与共同推进可以形成分工。', '保留共同决策权，避免把协作变成服从。'),
    rule('T12', 'T08', 'complement', '调整计划与持续推进有互补空间。', '确认哪些可变、哪些约定需要重新协商。'),
    rule('T13', 'T05', 'complement', '回报关注与风险评估可以相互补充。', '先谈收益目标、预算和谁承担损失。'),
    rule('T04', 'T11', 'friction', '自主空间与陪伴节奏可能侧重不同。', '先谈联系频率、独处时间与拒绝权。'),
    rule('T05', 'T06', 'friction', '审慎保障与探索自由可能节奏不同。', '用小步尝试约定预算和可承受的代价。'),
    rule('T05', 'T07', 'friction', '熟悉安排与试验新办法可能有分歧。', '区分必要保障和可以试验的部分。'),
    rule('T05', 'T12', 'friction', '稳定预期与灵活调整可能有分歧。', '确认调整频率与变化告知方式。'),
    rule('T01', 'T13', 'friction', '约定约束与收益期待需要先对齐。', '收益优先不等于违约，先谈不可单方变更的约定。'),
    rule('T09', 'T09', 'friction', '双方都想主导时，决策权需要分配。', '确认各自负责范围，以及意见不同时怎样决定。'),
    rule('T09', 'T14', 'friction', '推进决策与缓和争执可能节奏不同。', '先约定暂停多久、何时回谈、如何共同决定。')
  ];
  const marriageRules = [
    rule('R01', 'R02', 'aligned', '约定落实与重要信息透明相互支持。', '说清承诺期限、变化告知与退出善后。'),
    rule('R01', 'R03', 'aligned', '长期约定与日常承担有共同关注点。', '把愿望落实成分工，而不是只作保证。'),
    rule('R01', 'R08', 'aligned', '都关注长期安排如何持续落实。', '共同确认计划、各自投入和变化时的安排。'),
    rule('R02', 'R04', 'aligned', '知情决定与自主边界可以同时保留。', '区分相关事实与不必交出的私人信息。'),
    rule('R03', 'R06', 'aligned', '共同分担与实际照料有共同关注点。', '把日常照料、隐形劳动和困难支持说清。'),
    rule('R03', 'R05', 'complement', '生活分工与财务安排有互补空间。', '共同确认劳动投入、预算和资金授权。'),
    rule('R06', 'R07', 'complement', '实际陪伴与冲突修复可以相互支持。', '约定困难时的照料与争执后的回谈方式。'),
    rule('R05', 'R08', 'complement', '风险预算与未来推进有互补空间。', '确认计划投入、债务上限与调整条件。'),
    rule('R04', 'R06', 'friction', '自主空间与照料投入的侧重点不同。', '先谈可接受的帮助、独处时间与拒绝方式。'),
    rule('R05', 'R06', 'friction', '资源预算与即时支持需要协调。', '先谈可用资源、照料上限与备用安排。'),
    rule('R04', 'R08', 'friction', '独立安排与共同计划需要协调。', '先谈哪些共同决定、哪些保留自主。')
  ];
  function relationship(scope, a, b) {
    const rules = scope === 'personal' ? personalRules : marriageRules;
    const explicit = rules.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
    if (explicit) return explicit;
    if (a === b) return { group: 'aligned', reason: '主要关注点相近，沟通有共同起点。', discussion: '同类也要确认具体约定，不能省略分工与边界。' };
    if (scope === 'personal') {
      const x = M.prototypes.find(t => t.id === a), y = M.prototypes.find(t => t.id === b);
      if (x.supportTags.some(t => y.supportTags.includes(t)))
        return { group: 'aligned', reason: '部分行动关注点相近，有共同讨论基础。', discussion: '把相同倾向落实成双方都接受的具体安排。' };
    }
    return { group: 'complement', reason: '关注点不同，可以从各自更关注的部分开始讨论。', discussion: '先确认实际意愿和能力，差异本身不保证互补。' };
  }
  function compare(identity, risks) {
    if (!identity.enough || !identity.selected.length) return { version: VERSION, available: false, groups: [] };
    const selected = identity.selected, total = selected.reduce((n, t) => n + t.value, 0);
    const groups = [
      { id: 'aligned', label: '合拍倾向', entries: [] },
      { id: 'complement', label: '互补空间', entries: [] },
      { id: 'friction', label: '需要磨合', entries: [] }
    ];
    for (const [id, type] of Object.entries(identity.catalog)) {
      const relations = selected.map(source => ({ ...relationship(identity.scope, source.id, id), weight: source.value / total, source }));
      const weight = group => relations.filter(r => r.group === group).reduce((n, r) => n + r.weight, 0);
      const group = weight('friction') >= 0.3 ? 'friction' : weight('aligned') >= 0.3 ? 'aligned' : 'complement';
      const main = relations.filter(r => r.group === group).sort((a, b) => b.weight - a.weight)[0] ||
        relations.find(r => r.group === 'complement') || relations[0];
      groups.find(g => g.id === group).entries.push({ id, ...type, group, reason: main.reason,
        discussion: main.discussion, sourceName: main.source.name, rank: weight(group) });
    }
    groups.forEach(g => g.entries.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id)));
    const riskFirst = risks.some(r => r.priority || r.repeated);
    if (riskFirst) groups[0].label = '共同点参考';
    return { version: VERSION, available: true, riskFirst, groups,
      note: '比较的是类型关注点与取舍差异，不是实际两个人的适配结论。' };
  }
  root.RCT_AFFINITIES = { compare, relationship, personalRules, marriageRules, VERSION };
  if (typeof module !== 'undefined') module.exports = root.RCT_AFFINITIES;
})(typeof window !== 'undefined' ? window : globalThis);
