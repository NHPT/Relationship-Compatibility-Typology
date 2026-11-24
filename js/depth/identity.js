(function (root) {
  'use strict';
  const M = root.RCT_MODEL || require('./model.json');
  const personal = {
    T01: { glyph: '信', name: '守信', animal: '大象', symbol: 'elephant', lead: '重约定，也重视变化时的告知与善后。', focus: '约定与透明' },
    T02: { glyph: '协', name: '共进', animal: '海豚', symbol: 'dolphin', lead: '习惯共同推进，讲清分配与彼此的责任。', focus: '协作与互惠' },
    T03: { glyph: '暖', name: '关怀', animal: '企鹅', symbol: 'penguin', lead: '愿意把关心落实为实际帮助与持续投入。', focus: '关怀与投入' },
    T04: { glyph: '界', name: '知界', animal: '雪豹', symbol: 'leopard', lead: '先看自主空间、责任范围与可承受的代价。', focus: '自主与边界' },
    T05: { glyph: '稳', name: '谨行', animal: '陆龟', symbol: 'tortoise', lead: '重视保障与备用安排，倾向评估后行动。', focus: '保障与审慎' },
    T06: { glyph: '探', name: '探新', animal: '狐狸', symbol: 'fox', lead: '喜欢自主探索，为新的方向留出空间。', focus: '自主与探索' },
    T07: { glyph: '创', name: '创思', animal: '乌鸦', symbol: 'raven', lead: '愿意试新办法，再根据反馈修正想法。', focus: '试验与学习' },
    T08: { glyph: '行', name: '笃行', animal: '河狸', symbol: 'beaver', lead: '习惯拆解目标、推进步骤并关注交付。', focus: '推进与交付' },
    T09: { glyph: '领', name: '主导', animal: '狮子', symbol: 'lion', lead: '愿意参与决策，协调资源并推动方向。', focus: '组织与决策' },
    T10: { glyph: '誉', name: '求誉', animal: '孔雀', symbol: 'peacock', lead: '在意成果被看见，也关注外界的评价。', focus: '认可与形象' },
    T11: { glyph: '情', name: '重情', animal: '狼', symbol: 'wolf', lead: '重视陪伴、联系与重要关系中的归属感。', focus: '陪伴与归属' },
    T12: { glyph: '变', name: '应变', animal: '章鱼', symbol: 'octopus', lead: '愿意根据新条件调整计划与做法。', focus: '调整与复盘' },
    T13: { glyph: '利', name: '重利', animal: '鹰', symbol: 'eagle', lead: '取舍时更关注收入、收益与可用资源。', focus: '回报与资源' },
    T14: { glyph: '缓', name: '缓争', animal: '鹿', symbol: 'deer', lead: '倾向先缓和冲突，再面对分歧。', focus: '缓和与节奏' }
  };
  const marriage = {
    R01: { glyph: '守', name: '守诺', axis: 'commitment', animal: '大象', symbol: 'elephant', lead: '重视关系中的长期约定与变化告知。', focus: '长期约定' },
    R02: { glyph: '诚', name: '坦诚', axis: 'transparency', animal: '海豚', symbol: 'dolphin', lead: '倾向讲清忠实约定和影响关系的重要事实。', focus: '忠实坦诚' },
    R03: { glyph: '担', name: '共担', axis: 'responsibility', animal: '河狸', symbol: 'beaver', lead: '重视家务、照料与育儿中的知情分工。', focus: '生活分工' },
    R04: { glyph: '敬', name: '相敬', axis: 'boundaries', animal: '雪豹', symbol: 'leopard', lead: '重视伴侣的隐私、拒绝权与自主选择。', focus: '关系自主' },
    R05: { glyph: '财', name: '慎财', axis: 'fairness', animal: '陆龟', symbol: 'tortoise', lead: '倾向讲清预算、共同资金与风险责任。', focus: '财务协商' },
    R06: { glyph: '济', name: '共济', axis: 'care', animal: '企鹅', symbol: 'penguin', lead: '愿意在日常照料与困境中分担实际压力。', focus: '照料互助' },
    R07: { glyph: '和', name: '和解', axis: 'learning', animal: '鹿', symbol: 'deer', lead: '倾向回谈分歧、承认失误并跟进修复。', focus: '分歧修复' },
    R08: { glyph: '共', name: '共建', axis: 'creation', animal: '乌鸦', symbol: 'raven', lead: '愿意共同商量生育、居住与长期计划。', focus: '未来共识' }
  };
  const palettes = {
    personal: {
      T01: ['#2e7152', '#e8f0e8'], T02: ['#126e77', '#e3f1f1'],
      T03: ['#aa434c', '#fae9e8'], T04: ['#3c6496', '#e8eef7'],
      T05: ['#78601a', '#f3efd9'], T06: ['#9e541f', '#f8eddf'],
      T07: ['#7953a8', '#eee8f6'], T08: ['#806047', '#f0e9e1'],
      T09: ['#934066', '#f5e6ed'], T10: ['#a13b8c', '#f5e6f2'],
      T11: ['#4d58a5', '#e9eaf7'], T12: ['#176f64', '#e1f0ea'],
      T13: ['#8a5814', '#f4ebdb'], T14: ['#566d31', '#edf0e1']
    },
    marriage: {
      R01: ['#873654', '#f2e5ec'], R02: ['#327384', '#e5eff2'],
      R03: ['#964930', '#f5e8e0'], R04: ['#5c64ab', '#e9eaf5'],
      R05: ['#76611d', '#f2eedc'], R06: ['#a54865', '#f6e7ed'],
      R07: ['#286f5e', '#e5f0ea'], R08: ['#7059a2', '#eee9f5']
    }
  };
  for (const [scope, catalog] of Object.entries({ personal, marriage })) {
    Object.entries(catalog).forEach(([id, type]) => {
      [type.color, type.soft] = palettes[scope][id];
    });
  }
  const VERSION = 'rct-identity-v2';
  const has = (row, tags) => row.tags.some(t => tags.includes(t));
  function personalRows(report) {
    const core = report.derived.rows.filter(r => r.phase === 'core');
    return M.prototypes.map(p => {
      const opportunityIds = new Set(M.items.filter(q => q.scope === 'personal' && q.phase === 'core' &&
        p.topicIds.includes(q.topicId) && q.options.some(o => o.tags.some(t => p.supportTags.includes(t)))).map(q => q.id));
      const observed = core.filter(r => opportunityIds.has(r.questionId));
      const count = observed.filter(r => has(r, p.supportTags)).length;
      const counterCount = core.filter(r => p.topicIds.includes(r.topicId) && has(r, p.counterTags)).length;
      const covered = observed.length >= 4 && observed.length / opportunityIds.size >= 0.5;
      return { id: p.id, ...personal[p.id], value: covered ? Math.round(count / observed.length * 100) : null,
        count, observed: observed.length, counterCount };
    });
  }
  function marriageRows(report, axes) {
    return Object.entries(marriage).map(([id, type]) => {
      const a = axes.find(x => x.id === type.axis);
      // The axis is the single source for marriage opportunities and core counterinformation.
      return { id, ...type, value: a.value, count: a.supportCount,
        observed: a.observedCount, counterCount: a.coreRiskCount };
    });
  }
  function build(report, axes) {
    const rows = report.scope === 'personal' ? personalRows(report) : marriageRows(report, axes);
    const ranked = rows.filter(r => r.value !== null).sort((a, b) => b.value - a.value || b.observed - a.observed || a.id.localeCompare(b.id));
    const qualified = ranked.filter(r => r.value >= 55 && r.count >= 3 && r.counterCount === 0);
    const primary = report.scope === 'personal' && report.classification?.primary?.id;
    if (primary) {
      const index = qualified.findIndex(r => r.id === primary);
      if (index > 0) qualified.unshift(...qualified.splice(index, 1));
    }
    const selected = qualified.filter(r => r.value >= qualified[0].value - 12).slice(0, 3);
    const enough = report.derived.rows.filter(r => r.phase === 'core').length >= (report.scope === 'personal' ? 48 : 24);
    const title = selected.length > 1 ? selected.map(r => r.glyph).join(' · ')
      : selected.length === 1 ? selected[0].name + '型'
        : !report.derived.rows.length ? '待观察' : enough ? '多向取舍' : '观察中';
    const lead = selected.length ? selected.slice(0, 2).map(r => r.lead).join(' ')
      : !report.derived.rows.length ? '还没有足够信息，继续作答后再看你的特点。'
        : enough ? '目前的取舍较分散，按下方维度理解更清楚。' : '已有一些观察，更多回答能帮助看清你的主要取向。';
    return { version: VERSION, scope: report.scope, title, lead, rows, selected, enough,
      subtitle: selected.length ? selected.map(r => r.name).join(' / ') : '倾向随情境变化',
      color: selected[0]?.color || '#52665a', soft: selected[0]?.soft || '#e8ece5',
      symbols: selected.slice(0, 2).map(r => ({ animal: r.animal, symbol: r.symbol, color: r.color })),
      catalog: report.scope === 'personal' ? personal : marriage };
  }
  root.RCT_IDENTITY = { build, personal, marriage, VERSION };
  if (typeof module !== 'undefined') module.exports = root.RCT_IDENTITY;
})(typeof window !== 'undefined' ? window : globalThis);
