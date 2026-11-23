const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = ['questionBank.js', 'banks/love.js', 'banks/friend.js', 'banks/venture.js',
  'banks/team.js', 'scoring.js', 'report.js'];
function environment() {
  const data = new Map();
  const context = vm.createContext({
    localStorage: {
      getItem: key => data.get(key) || null,
      setItem: (key, value) => data.set(key, value),
      removeItem: key => data.delete(key)
    }, setTimeout, Date, console
  });
  files.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file }));
  return {
    context,
    run: expression => JSON.parse(JSON.stringify(vm.runInContext(expression, context))),
    data
  };
}
const selectionHelper = `
function answersFor(sceneId, choose = q => q.options[0]) {
  return SCENE_BANKS[sceneId].map(q => {
    const option = choose(q);
    return {
      questionId:q.id, questionText:q.text, kind:q.kind, dimension:q.dimension,
      optionId:option.id, optionText:option.text, score:option.score, value:option.value
    };
  });
}`;
function withAnswers() {
  const env = environment();
  vm.runInContext(selectionHelper, env.context);
  return env;
}

test('婚恋 44 题与历史场景 32 题分别完整覆盖，模式标识不与行为冲突', () => {
  const env = environment();
  const banks = env.run('SCENE_BANKS');
  const globalIds = new Set();
  const sceneIds = Object.keys(banks);
  assert.deepEqual(sceneIds, ['love', 'friend', 'venture', 'team']);
  sceneIds.forEach(sceneId => {
    const bank = banks[sceneId];
    assert.equal(bank.length, sceneId === 'love' ? 44 : 32);
    for (const key of ['R', 'S', 'C', 'J']) {
      assert.equal(bank.filter(q => q.kind === 'mode' && q.dimension === key).length, sceneId === 'love' ? 3 : 0);
    }
    assert.equal(bank.filter(q => q.kind === 'condition').length, 7);
    for (const key of ['X', 'Y', 'M']) {
      assert.equal(bank.filter(q => q.kind === 'style' && q.dimension === key).length, 3);
    }
    for (const key of ['D', 'U', 'C', 'B', 'R', 'I', 'J', 'P']) {
      assert.equal(bank.filter(q => q.kind === 'behavior' && q.dimension === key).length, 2);
    }
    for (const q of bank) {
      assert.equal(q.sceneId, sceneId);
      assert.ok(!globalIds.has(q.id));
      globalIds.add(q.id);
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map(o => o.id)).size, 4);
      assert.equal(new Set(q.options.map(o => o.text)).size, 4);
      assert.ok(q.text.length > 8);
      assert.ok(q.text.length <= 45, `${q.id}题干应简短`);
      assert.ok(q.options.every(o => o.text.length <= 32), `${q.id}选项应简短`);
      if (q.kind === 'condition') {
        assert.ok(q.options.every(o => typeof o.value === 'string' && o.score === undefined));
        assert.equal(new Set(q.options.map(o => o.value)).size, 4);
        assert.ok(q.discussion);
      } else assert.deepEqual(q.options.map(o => o.score),
        ['style', 'mode'].includes(q.kind) ? [-2, -1, 1, 2] : [3, 2, 1, 0]);
    }
  });
  assert.equal(globalIds.size, 140);
  // 父母决策和婚育明确条件不能混入其他场景或社交行为分。
  for (const sceneId of ['friend', 'venture', 'team']) {
    assert.ok(banks[sceneId].every(q => !/生育|孩子|父母|伴侣/.test(q.text + q.options.map(o => o.text).join(''))));
  }
  assert.equal(banks.love.find(q => q.dimension === 'family').kind, 'condition');
});

test('随机位置不改变题目覆盖、选项标识或语义分值', () => {
  const env = environment();
  for (const sceneId of ['love', 'friend', 'venture', 'team']) {
    for (let i = 0; i < 25; i++) {
      const bank = env.run(`generateTest('${sceneId}')`);
      const original = env.run(`SCENE_BANKS.${sceneId}`);
      assert.deepEqual(bank.map(q => q.id), original.map(q => q.id));
      bank.forEach((q, index) => {
        assert.deepEqual(q.options.slice().sort((a, b) => a.id.localeCompare(b.id)),
          original[index].options.slice().sort((a, b) => a.id.localeCompare(b.id)));
      });
    }
  }
});

test('计分拒绝未答、重复、跨场景和未知选项，不接受客户端伪造分值', () => {
  const env = withAnswers();
  assert.throws(() => env.run("scoreTest([], 'love')"), /完成全部/);
  assert.throws(() => env.run("scoreTest(answersFor('love').map((a,i)=>i?a:answersFor('friend')[0]), 'love')"), /题库不一致/);
  assert.throws(() => env.run("scoreTest(answersFor('love').map((a,i,all)=>i===1?all[0]:a), 'love')"), /题库不一致/);
  assert.throws(() => env.run("scoreTest(answersFor('love').map((a,i)=>i? a:{...a,optionId:'fake'}), 'love')"), /题库不一致/);
  assert.deepEqual(env.run("scoreTest(answersFor('love').map(a=>({...a,score:999,value:'fake'})), 'love')"),
    env.run("scoreTest(answersFor('love'), 'love')"));
});

test('婚恋十六模式与历史场景八个原型全部可达，参考包含同型', () => {
  const env = withAnswers();
  for (const sceneId of ['love', 'friend', 'venture', 'team']) {
    const scene = env.run(`SCENARIOS.${sceneId}`);
    const count = sceneId === 'love' ? 16 : 8;
    for (let i = 0; i < count; i++) {
      const result = env.run(`(() => {
        const profile = {X:${i & 4 ? '2' : '-2'}, Y:${i & 2 ? '2' : '-2'}, M:${i & 1 ? '2' : '-2'},
          R:${i & 8 ? '2' : '-2'},S:${i & 4 ? '2' : '-2'},C:${i & 2 ? '2' : '-2'},J:${i & 1 ? '2' : '-2'}};
        const a = answersFor('${sceneId}', q => ['style','mode'].includes(q.kind)
          ? q.options.find(o=>o.score===profile[q.dimension]) : q.options[0]);
        const r = buildSingleResult(scoreTest(a,'${sceneId}'),a,'${sceneId}');
        return {r, reco:getMatchRecommendation(r)};
      })()`);
      assert.equal(result.r.type, `${scene.prefix}${sceneId === 'love' ? String(i + 1).padStart(2, '0') : i + 1}`);
      assert.equal(result.r.flexible.length, 0);
      assert.equal(result.r.behaviorRows.length, 8);
      assert.equal(result.r.conditions.length, 7);
      assert.equal(result.reco.candidates.length, count);
      assert.equal(result.reco.candidates.filter(c => c.group === 'same').length, 1);
      assert.equal(result.reco.candidates.find(c => c.group === 'same').type, result.r.type);
      assert.equal(result.reco.candidates.filter(c => c.group === 'different').length, 1);
      assert.ok(result.reco.candidates.every(c => c.type.startsWith(scene.prefix)));
    }
  }
});

test('净分中点保留四轴画像、双向证据、行为和条件，不退化为空报告', () => {
  const env = withAnswers();
  const result = env.run(`(() => {
    const counts={R:0,S:0,C:0,J:0};
    const a=answersFor('love',q=>q.kind==='mode'
      ? q.options.find(o=>o.score===(counts[q.dimension]++===0 ? -2 : 1))
      :q.options[0]);
    const r=buildSingleResult(scoreTest(a,'love'),a,'love');
    return {r,reco:getMatchRecommendation(r)};
  })()`);
  assert.equal(result.r.type, 'L-FFFF');
  assert.equal(result.r.axisRows.length, 4);
  result.r.axisRows.forEach(row => {
    assert.equal(row.position, 0);
    assert.equal(row.evidence.pos, 2);
    assert.equal(row.evidence.neg, 1);
    assert.equal(row.text, '随情境取舍');
  });
  assert.equal(result.r.conditions.length, 7);
  assert.equal(result.r.behaviorRows.length, 8);
  assert.ok(result.r.name.includes('情境取舍'));
  assert.equal(result.reco.candidates.filter(c => c.group === 'open').length, 16);
  assert.equal(result.reco.needs.length, 3);
  assert.doesNotMatch(JSON.stringify(result), /倾向不明确|倾向未明确|SWING|高兼容/);
  assert.deepEqual(env.run('[-2,-1,0,1,2].map(side)'), ['neg', 'mid', 'mid', 'mid', 'pos']);
});

test('条件选择彼此独立，改生育或家庭安排不改变风格、行为或其他条件', () => {
  const env = withAnswers();
  const result = env.run(`(() => {
    const a=answersFor('love'), b=answersFor('love',q=>q.dimension==='children'||q.dimension==='family'?q.options[1]:q.options[0]);
    return [scoreTest(a,'love'),scoreTest(b,'love')];
  })()`);
  assert.deepEqual(result[0].style, result[1].style);
  assert.deepEqual(result[0].mode, result[1].mode);
  assert.deepEqual(result[0].behavior, result[1].behavior);
  assert.equal(result[0].conditions.children, 'yes');
  assert.equal(result[1].conditions.children, 'no');
  assert.equal(result[0].conditions.home, result[1].conditions.home);
});

test('低行为观察不覆盖风格，安全暂停且约定重谈不被计成回避', () => {
  const env = withAnswers();
  const result = env.run(`(() => {
    const a=answersFor('team',q=>q.kind==='behavior'?q.options[3]:q.options[0]);
    return buildSingleResult(scoreTest(a,'team'),a,'team');
  })()`);
  assert.equal(result.type, 'T1');
  assert.ok(result.observation.includes('分歧修复'));
  assert.ok(result.behaviorRows.every(row => row.val === 0 && row.position === 0));
  const q = env.run("SCENE_BANKS.team.find(q=>q.id==='team-C1')");
  assert.equal(q.options[0].score, 3);
  assert.match(q.options[0].text, /暂停.*何时继续谈/);
});

test('旧记录保留，历史不跨场景或规则合并，反馈更新且不虚构对方', () => {
  const env = withAnswers();
  env.data.set('rct_history_v1', JSON.stringify([{ type: 'SWING', name: '旧记录', timestamp: 1 }]));
  env.run("saveResult(buildSingleResult(scoreTest(answersFor('love'),'love'),answersFor('love'),'love'))");
  assert.equal(env.run('getHistory()').length, 2);
  assert.deepEqual(env.run('getHistory()[0]'), { type: 'SWING', name: '旧记录', timestamp: 1 });
  assert.equal(env.run('aggregate(getHistory())').comparable, false);
  env.run("saveResult(buildSingleResult(scoreTest(answersFor('friend'),'friend'),answersFor('friend'),'friend'))");
  assert.equal(env.run('aggregate(getHistory().slice(1))').comparable, false);
  assert.equal(env.run("aggregate(getHistory().filter(r=>r.sceneId==='love'))").comparable, true);
  env.run("saveOutcome({resultId:'one',sceneId:'love',partnerType:null,status:'good'})");
  env.run("saveOutcome({resultId:'one',sceneId:'love',partnerType:null,status:'ok'})");
  const feedback = env.run('getOutcomes()');
  assert.equal(feedback.length, 1);
  assert.equal(feedback[0].status, 'ok');
  assert.equal(feedback[0].partnerType, null);
  assert.equal(feedback[0].verified, false);
});

test('损坏本地数据与存储不可用时仍可生成报告，明确反馈保存失败', () => {
  const env = withAnswers();
  env.data.set('rct_history_v1', '{"not":"an array"}');
  assert.deepEqual(env.run('getHistory()'), []);
  env.data.set('rct_outcomes_v1', 'broken');
  assert.deepEqual(env.run('getOutcomes()'), []);
  vm.runInContext("localStorage.setItem=()=>{throw new Error('quota')}", env.context);
  assert.equal(env.run("saveResult(buildSingleResult(scoreTest(answersFor('team'),'team'),answersFor('team'),'team'))"), false);
  assert.equal(env.run("saveOutcome({resultId:'x'})"), false);
  assert.equal(env.run('csvCell("=formula")'), '"\'=formula"');
});
