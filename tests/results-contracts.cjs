const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const values = new Map();
  const context = vm.createContext({
    console, Date, setTimeout,
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key)
    }
  });
  const files = ['questionBank', 'banks/love', 'scoring', 'report', 'exploration/catalog',
    ...['needs', 'bonds', 'self', 'meaning', 'ethics', 'choices', 'society', 'growth', 'main'].map(id => `exploration/banks/${id}`),
    'exploration/types', 'exploration/profile', 'exploration/model'];
  files.forEach(file => vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), context));
  vm.runInContext(`
    function fill(index = 0) {
      const draft = emptyExplorationDraft();
      Object.values(EXPLORATION_BANK).flat().forEach(q => {
        draft.answers[q.id] = { optionId: q.options[index].id, skipped: false };
      });
      return draft;
    }
    function romance(profile = {R:'neg',S:'neg',C:'neg',J:'neg'}, extras = 0) {
      const counts = {R:0,S:0,C:0,J:0};
      const answers = SCENE_BANKS.love.map(q => {
        const value = profile[q.dimension];
        const score = q.kind !== 'mode' ? 0 : value === 'mid' ? (counts[q.dimension]++ === 0 ? -2 : 1) : value === 'pos' ? 2 : -2;
        const option = q.kind === 'mode' ? q.options.find(o => o.score === score) : q.options[extras];
        return { questionId: q.id, optionId: option.id };
      });
      return buildSingleResult(null,answers,'love');
    }
  `, context);
  return {
    context, values,
    run: expression => JSON.parse(JSON.stringify(vm.runInContext(expression, context)))
  };
}

test('八个主型名称、动物与组合唯一，全部可达；旧特征独立保留', () => {
  const env = load();
  const types = env.run('PERSONAL_TYPES');
  assert.deepEqual(types.map(row => row.name), ['筑基自航型','守望自航型','筑基共建型','守望共建型','开路自航型','逐光自航型','开路共创型','逐光共创型']);
  for (const key of ['id','name','animal']) assert.equal(new Set(types.map(row => row[key])).size, 8);
  for (const type of types) {
    const result = env.run(`(() => {
      const draft=fill(), type=getPersonalType('${type.id}');
      PERSONAL_PROBES.forEach(probe => draft.answers[probe.questionId]={optionId:probe.questionId+':'+(type.profile[probe.axis]==='neg'?0:3)});
      return buildExplorationReport(draft).personalProfile;
    })()`);
    assert.equal(result.classificationStatus, 'classified');
    assert.deepEqual(result.primaryTypes.map(row => row.id), [type.id]);
    assert.equal(result.secondaryTypes.length, 0);
    assert.equal(result.repeated.length, 8);
    assert.equal(result.references.length, 1);
    assert.ok(result.references[0].easier.basis && result.references[0].harder.action);
    assert.equal(result.references[0].easier.id, type.id);
    assert.equal(result.validated, false);
    assert.ok(result.taxonomy.axes.every(axis => axis.observed === 4 && axis.counts[type.profile[axis.key]] === 4));
  }
  const animals = env.run("[...PERSONAL_TYPES.map(row=>row.animal), ...getTypesForScene('love').map(row=>row.animal)]");
  assert.equal(new Set(animals).size, 24);
});

test('主型只依赖新增中性方向题，不由原来的道德、责任或共情选择决定', () => {
  const env = load();
  const results = env.run(`(() => {
    const a=fill(), b=fill(3);
    PERSONAL_PROBES.forEach(probe => b.answers[probe.questionId]=a.answers[probe.questionId]);
    return [buildExplorationReport(a).personalProfile,buildExplorationReport(b).personalProfile];
  })()`);
  assert.deepEqual(results[0].primaryTypes.map(row => row.id), results[1].primaryTypes.map(row => row.id));
  assert.equal(results[0].repeated.length, 8);
  assert.equal(results[1].repeated.length, 0);
  assert.equal(results[0].coexistence.length, 1);
});

test('覆盖不足、两侧各半、跳过和未知选项保留方向，不强选或宣布辅助型', () => {
  const env = load();
  const scenarios = env.run(`(() => {
    const two=fill(), three=fill(), mixed=fill(), skipped=fill(), unknown=fill();
    const probes=PERSONAL_PROBES.filter(probe=>probe.axis==='D');
    probes.slice(0,2).forEach(probe => delete two.answers[probe.questionId]);
    delete three.answers[probes[0].questionId];
    probes.slice(0,2).forEach(probe=>mixed.answers[probe.questionId]={optionId:probe.questionId+':3'});
    probes.slice(0,2).forEach(probe=>skipped.answers[probe.questionId]={optionId:null,skipped:true});
    probes.slice(0,2).forEach(probe=>unknown.answers[probe.questionId]={optionId:'unknown',skipped:false});
    return [two,three,mixed,skipped,unknown].map(draft=>buildExplorationReport(draft).personalProfile);
  })()`);
  assert.deepEqual(scenarios.map(row=>row.classificationStatus), ['incomplete','classified','mixed','incomplete','incomplete']);
  for (const index of [0,2,3,4]) {
    assert.equal(scenarios[index].primaryTypes.length, 0);
    assert.equal(scenarios[index].secondaryTypes.length, 0);
    assert.equal(scenarios[index].references.length, 0);
    assert.equal(scenarios[index].taxonomy.candidates.length, 2);
  }
  assert.equal(scenarios[2].taxonomy.axes[0].direction, 'mid');
  const group = env.run("buildExplorationReport(fill(),'meaning').personalProfile");
  assert.equal(group.classificationStatus, 'group_only');
  assert.equal(group.primaryTypes.length, 0);
  assert.equal(group.taxonomy.candidates.length, 0);
  assert.equal(env.run('buildExplorationReport(emptyExplorationDraft()).personalProfile.taxonomy.axes.every(axis=>axis.direction==="unknown")'), true);
});

test('已知 v1 草稿保留有效的 243 题回答与跳过，新题不补答；未知版本保护', () => {
  const env = load();
  env.run(`globalThis.old=fill();
    old.version='rct-exploration-2026-11-23-v1';
    PERSONAL_PROBES.forEach(probe=>delete old.answers[probe.questionId]);
    old.answers['ex-1-2']={optionId:null,skipped:true};
    old.answers.fake={optionId:'fake'};
    localStorage.setItem(EX_DRAFT_KEY,JSON.stringify(old));`);
  const original = env.values.get('rct_exploration_draft_v1');
  const report = env.run('buildExplorationReport(readExplorationDraft())');
  assert.equal(report.total, 255);
  assert.equal(report.answered, 242);
  assert.equal(report.skipped, 1);
  assert.equal(report.personalProfile.classificationStatus, 'incomplete');
  assert.equal(env.values.get('rct_exploration_draft_v1'), original);
  assert.equal(env.run('readExplorationDraft().version'), 'rct-exploration-2026-11-23-v2');
  env.run("recordExplorationChoice(globalThis.migrated=readExplorationDraft(),PERSONAL_PROBES[0].questionId,PERSONAL_PROBES[0].questionId+':0')");
  assert.equal(env.run('buildExplorationReport(readExplorationDraft()).answered'), 243);
  env.values.set('rct_exploration_draft_v1', JSON.stringify({version:'future',answers:{}}));
  assert.equal(env.run('readExplorationDraft().incompatible'), true);
  assert.equal(env.run('saveExplorationDraft(readExplorationDraft())'), false);
  assert.equal(env.run('getExplorationData().draft.version'), 'future');
});

test('十六婚恋模式与所有 81 方向组合可区分；参考逐轴一致', () => {
  const env = load();
  const rows = env.run(`['neg','mid','pos'].flatMap(R => ['neg','mid','pos'].flatMap(S =>
    ['neg','mid','pos'].flatMap(C => ['neg','mid','pos'].map(J => romance({R,S,C,J})))))`);
  assert.equal(new Set(rows.map(row=>row.name)).size, 81);
  const fixed = rows.filter(row => !row.flexible.length);
  assert.equal(fixed.length, 16);
  assert.equal(new Set(fixed.map(row=>row.type)).size, 16);
  assert.equal(new Set(fixed.map(row=>row.animal)).size, 16);
  assert.equal(fixed[0].name, '共感直谈·常伴共议模式');
  assert.equal(fixed.at(-1).name, '共策缓谈·自在分工模式');
  assert.ok(fixed.every(row=>row.title && row.subtitle && row.emoji));
  for (const row of rows) {
    assert.equal(row.explanation.version, 'rct-romance-explanation-v3');
    assert.equal(row.axisRows.length, 4);
    assert.ok(row.axisRows.every(axis => axis.answers.length === 3 && axis.answers.every(a=>a.kind==='mode')));
    assert.equal(row.lifestyleRows.length, 3);
    const count = row.axisRows.filter(axis => axis.direction !== 'mid').length;
    const refs = row.relationshipReferences;
    assert.equal(refs.basis, 'mode_answers_only');
    assert.equal(refs.easier.length, count ? 2 ** (4-count) : 0);
    assert.equal(refs.harder.length, count ? 2 ** (4-count) : 0);
    assert.ok(refs.easier.every(type=>type.same.length === count));
    assert.ok(refs.harder.every(type=>type.discuss.length === count));
    if (row.flexible.length) assert.equal(row.animal, null);
  }
});

test('生活方式、行为与条件不改变婚恋模式；原始内容仍进入报告', () => {
  const env = load();
  const rows = env.run('[romance(undefined,0),romance(undefined,3)]');
  assert.equal(rows[0].type, rows[1].type);
  assert.deepEqual(rows[0].profile, rows[1].profile);
  assert.notDeepEqual(rows[0].lifestyleRows, rows[1].lifestyleRows);
  assert.notDeepEqual(rows[0].behaviorRows, rows[1].behaviorRows);
  assert.notDeepEqual(rows[0].conditions, rows[1].conditions);
  assert.equal(rows[1].behaviorRows[0].val, 0);
  assert.equal(rows[1].conditions[0].value, 'undecided');
});

test('婚恋独立生成，个人基础来自当前草稿并随报告保存，后续修改不改快照', () => {
  const env = load();
  const empty = env.run('romance()');
  assert.equal(empty.type, 'L01');
  assert.equal(empty.personalFoundation.available, false);
  env.run('saveExplorationDraft(fill()); globalThis.saved=romance(); saveResult(saved); saveExplorationDraft(fill(3));');
  const current = env.run('romance()');
  const saved = env.run('getHistory()[0]');
  assert.equal(saved.personalFoundation.profile.primaryTypes[0].id, 'P01');
  assert.equal(current.personalFoundation.profile.primaryTypes[0].id, 'P08');
  assert.equal(saved.type, current.type);
  assert.equal(saved.personalFoundation.source, 'current_personal_draft');
  assert.equal(saved.personalFoundation.explanationVersion, 'rct-personal-explanation-v3');
  assert.equal(saved.personalFoundation.profile.taxonomy.axes[0].answers[0].text,
    env.run('buildExplorationReport(fill()).personalProfile.taxonomy.axes[0].answers[0].text'));
});

test('题面、选项和分数均由题库重取，旧解释与旧类型快照不改写', () => {
  const env = load();
  const profile = env.run(`(() => {
    const report=buildExplorationReport(fill());
    report.topics.forEach(topic=>topic.facets.forEach(facet=>{facet.text='伪造';facet.questionText='伪造';}));
    return buildPersonalProfile(report);
  })()`);
  assert.doesNotMatch(JSON.stringify(profile), /伪造/);
  assert.equal(env.run('isCurrentPersonalProfile(buildExplorationReport(fill()).personalProfile)'), true);
  assert.equal(env.run('isCurrentPersonalProfile({version:PERSONAL_EXPLANATION_VERSION,taxonomy:{}})'), false);
  env.run(`globalThis.old=buildExplorationReport(fill());
    old.personalProfile.version='rct-personal-explanation-v2';
    old.personalProfile.taxonomy.version='rct-personal-types-v1';
    old.personalProfile.title='理性求证型';
    saveExplorationReport(old); saveExplorationReport(buildExplorationReport(fill())); saveExplorationReport(buildExplorationReport(fill()));`);
  const reports = env.run('getExplorationReports()');
  assert.equal(reports.length, 2);
  assert.equal(reports[0].personalProfile.title, '理性求证型');
  assert.equal(reports[0].personalProfile.version, 'rct-personal-explanation-v2');
  assert.equal(reports[1].personalProfile.version, 'rct-personal-explanation-v3');
  assert.equal(env.run('isCurrentPersonalProfile(old.personalProfile)'), false);
  const romance = env.run(`(() => {
    const answers=SCENE_BANKS.love.map(q=>({questionId:q.id,optionId:q.options[0].id,questionText:'伪造',optionText:'伪造',score:999}));
    return buildSingleResult({mode:{R:999}},answers,'love');
  })()`);
  assert.equal(romance.type, 'L01');
  assert.doesNotMatch(JSON.stringify(romance), /伪造|999/);
});
