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
    R01: { glyph: '守', name: '守诺', axis: 'commitment', animal: '大象', symbol: 'elephant', lead: '重视长期约定，也关注变化时的交接。', focus: '持续承诺' },
    R02: { glyph: '诚', name: '坦诚', axis: 'transparency', animal: '海豚', symbol: 'dolphin', lead: '倾向说清重要事实，让彼此知情决定。', focus: '信息透明' },
    R03: { glyph: '担', name: '共担', axis: 'responsibility', animal: '河狸', symbol: 'beaver', lead: '愿意把共同生活的责任落实到行动。', focus: '家庭分担' },
    R04: { glyph: '界', name: '知界', axis: 'boundaries', animal: '雪豹', symbol: 'leopard', lead: '重视拒绝权、隐私与各自的自主空间。', focus: '尊重边界' },
    R05: { glyph: '财', name: '慎财', axis: 'fairness', animal: '陆龟', symbol: 'tortoise', lead: '倾向讲清预算、共同资金与风险责任。', focus: '共同财务' },
    R06: { glyph: '伴', name: '相伴', axis: 'care', animal: '企鹅', symbol: 'penguin', lead: '愿意在日常与困难中提供实际照料。', focus: '长期照料' },
    R07: { glyph: '和', name: '和解', axis: 'learning', animal: '鹿', symbol: 'deer', lead: '倾向回谈分歧、承认失误并跟进修复。', focus: '冲突修复' },
    R08: { glyph: '共', name: '共建', axis: 'creation', animal: '乌鸦', symbol: 'raven', lead: '愿意共同讨论未来，并持续推进计划。', focus: '未来投入' }
  };
  const VERSION = 'rct-identity-v1';
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
      // Naming uses core responses only; later risk observations stay visible separately.
      const definitions = {
        commitment: { tags: ['k'] }, transparency: { tags: ['h'] },
        responsibility: { tags: ['r'], topics: [3, 4, 9] }, boundaries: { tags: ['b'] },
        fairness: { tags: ['f', 'j'], topics: [5, 6] }, care: { tags: ['e'], topics: [3, 4, 9] },
        learning: { tags: ['r', 'l', 'b', 'T'], topics: [8] }, creation: { tags: ['h', 'j', 'k'], topics: [12] }
      };
      const d = definitions[type.axis];
      const counterCount = report.derived.rows.filter(r => r.phase === 'core' &&
        (!d.topics || d.topics.includes(r.topicId)) && has(r, d.tags)).length;
      return { id, ...type, value: a.value, count: a.supportCount, observed: a.observedCount, counterCount };
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
      symbols: selected.slice(0, 2).map(r => ({ animal: r.animal, symbol: r.symbol })),
      catalog: report.scope === 'personal' ? personal : marriage };
  }
  root.RCT_IDENTITY = { build, personal, marriage, VERSION };
  if (typeof module !== 'undefined') module.exports = root.RCT_IDENTITY;
})(typeof window !== 'undefined' ? window : globalThis);
