const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load() {
  const values = new Map();
  const context = vm.createContext({
    console, localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key)
    }
  });
  const files = ['catalog', ...['needs','bonds','self','meaning','ethics','choices','society','growth','main'].map(group=>`banks/${group}`), 'core', 'types', 'profile', 'model'];
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/exploration', file + '.js'), 'utf8'), context);
  return {
    context, values,
    run: expression => {
      const value = vm.runInContext(expression, context);
      return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }
  };
}
test('48 项和 255 个细项逐一覆盖，八组无遗漏、无重复', () => {
  const env = load();
  const {topics, groups, banks} = env.run('({topics:EXPLORATION_TOPICS,groups:EXPLORATION_GROUPS,banks:EXPLORATION_BANK})');
  assert.equal(topics.length,48);
  assert.deepEqual(topics.map(topic=>topic.id),Array.from({length:48},(_,i)=>i+1));
  assert.equal(groups.length,8);
  assert.equal(new Set(groups.flatMap(group=>group.topics)).size,48);
  assert.equal(groups.flatMap(group=>group.topics).length,48);
  const ids = new Set();
  for (const topic of topics) {
    const questions = banks[topic.id];
    assert.deepEqual(questions.map(q=>q.facet),topic.facets);
    for (const q of questions) {
      assert.equal(q.topicId,topic.id);
      assert.ok(!ids.has(q.id)); ids.add(q.id);
      assert.equal(q.options.length,4);
      assert.equal(new Set(q.options.map(option=>option.id)).size,4);
      assert.equal(new Set(q.options.map(option=>option.text)).size,4);
      assert.ok(q.options.every(option=>option.score === undefined));
      assert.ok(q.text.length<=65,`${q.id}题干过长`);
      assert.ok(q.options.every(option=>option.text.length<=32),`${q.id}选项过长`);
    }
  }
  assert.equal(ids.size,255);
});
test('拒绝未知选项和把跳过冒充选项；跳过与未答分开且均不产生分数', () => {
  const env=load();
  env.run('globalThis.draft=emptyExplorationDraft()');
  assert.throws(()=>env.run("recordExplorationChoice(draft,'fake',null,true)"),/题库不一致/);
  assert.throws(()=>env.run("recordExplorationChoice(draft,'ex-1-1','fake')"),/题库不一致/);
  assert.throws(()=>env.run("recordExplorationChoice(draft,'ex-1-1','ex-1-1:0',true)"),/题库不一致/);
  env.run("recordExplorationChoice(draft,'ex-1-1','ex-1-1:2')");
  env.run("recordExplorationChoice(draft,'ex-1-2',null,true)");
  const report=env.run("buildExplorationReport(draft,'needs')");
  assert.equal(report.answered,1);
  assert.equal(report.skipped,1);
  assert.equal(report.topics[0].facets[2].status,'unanswered');
  assert.ok(report.topics[0].facets[0].text.length>0);
  assert.equal(report.topics[0].facets[1].status,'skipped');
  assert.equal(report.validated,false);
  assert.equal(report.score,undefined);
  assert.equal(report.topics[0].score,undefined);
});
test('中断可继续；改选替换原答案，不增加已答数量', () => {
  const env=load();
  env.run("recordExplorationChoice(globalThis.draft=emptyExplorationDraft(),'ex-1-1','ex-1-1:0')");
  env.run("globalThis.resumed=readExplorationDraft()");
  assert.equal(env.run("explorationProgress('needs',resumed)").answered,1);
  env.run("recordExplorationChoice(resumed,'ex-1-1','ex-1-1:3')");
  assert.equal(env.run("explorationProgress('needs',readExplorationDraft())").answered,1);
  assert.equal(env.run("readExplorationDraft().answers['ex-1-1'].optionId"),'ex-1-1:3');
});
test('默认报告只使用 44 题，旧主题回答保留但不混入当前报告；相同报告不重复保存', () => {
  const env=load();
  env.run(`globalThis.draft=emptyExplorationDraft();
    ALL_EXPLORATION_QUESTIONS.forEach(q=>recordExplorationChoice(draft,q.id,q.options[2].id));`);
  const report=env.run('globalThis.report=buildExplorationReport(draft)');
  assert.equal(report.total,44);
  assert.equal(report.answered,44);
  assert.equal(report.scope,'personal_core');
  assert.ok(!report.topics.some(topic=>[4,5,21].includes(topic.topicId)));
  assert.equal(env.run('Object.keys(draft.answers).length'),258);
  assert.equal(report.skipped,0);
  assert.ok(report.topics.every(topic=>topic.facets.every(facet=>facet.status==='answered')));
  env.run('saveExplorationReport(report)');
  env.run('saveExplorationReport(buildExplorationReport(draft))');
  assert.equal(env.run('getExplorationReports()').length,1);
  for (const group of env.run('EXPLORATION_GROUPS')) {
    const groupReport=env.run(`buildExplorationReport(draft,'${group.id}')`);
    assert.deepEqual(groupReport.topics.map(topic=>topic.topicId),group.topics);
    assert.equal(env.run(`explorationProgress('${group.id}',draft)`).complete,true);
  }
});
test('44 题完整覆盖 12 道生活方向与 32 道特征观察，没有性生活或伴侣专项', () => {
  const env=load();
  const data=env.run('({questions:PERSONAL_CORE_QUESTIONS,probes:PERSONAL_PROBES,features:PERSONAL_FEATURES})');
  const ids=new Set(data.questions.map(q=>q.id));
  assert.equal(data.questions.length,44);
  assert.equal(ids.size,44);
  assert.equal(data.probes.length,12);
  assert.equal(data.features.flatMap(rule=>rule.items).length,32);
  assert.ok(data.probes.every(probe=>ids.has(probe.questionId)));
  assert.ok(data.features.every(rule=>rule.items.every(([id])=>ids.has(id))));
  assert.ok(data.questions.every(q=>q.options.length===4));
  assert.doesNotMatch(JSON.stringify(data.questions),/性生活|伴侣|婚姻|性忠诚|生育|繁衍/);
});
test('存储失败仍保留内存回答；旧版本不混用或覆盖，清空不触及关系记录', () => {
  const env=load();
  env.values.set('rct_history_v1','[{"type":"L1"}]');
  env.values.set('rct_exploration_draft_v1',JSON.stringify({version:'old',answers:{'ex-1-1':{optionId:'ex-1-1:0'}}}));
  assert.equal(env.run('readExplorationDraft()').incompatible,true);
  assert.equal(env.run('saveExplorationDraft(readExplorationDraft())'),false);
  assert.ok(env.run('getExplorationData().draft').version==='old');
  env.run('clearExplorationData()');
  assert.equal(env.values.get('rct_history_v1'),'[{"type":"L1"}]');
  vm.runInContext("localStorage.setItem=()=>{throw new Error('quota')}",env.context);
  assert.equal(env.run("recordExplorationChoice(globalThis.draft=emptyExplorationDraft(),'ex-1-1','ex-1-1:0')"),false);
  assert.equal(env.run("buildExplorationReport(draft,'needs')").answered,1);
  assert.equal(env.run("saveExplorationReport(buildExplorationReport(draft,'needs'))"),false);
});
test('损坏的报告快照不进入展示列表，有效快照保留', () => {
  const env = load();
  env.run('saveExplorationReport(buildExplorationReport(emptyExplorationDraft()))');
  const valid = env.run('getExplorationReports()[0]');
  env.values.set('rct_exploration_reports_v1', JSON.stringify([
    valid, {}, { ...valid, topics: null },
    { ...valid, topics: [{ topicId: 999, name: 'bad', facets: [] }] }
  ]));
  assert.equal(env.run('getExplorationReports()').length, 1);
});
