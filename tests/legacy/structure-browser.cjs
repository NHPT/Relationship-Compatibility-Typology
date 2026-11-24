/* 历史结构页面回归；仅配合旧版本页面使用。输入不是真人样本。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../.git/rct-ui/node_modules/playwright');
const base = process.env.RCT_URL || 'http://localhost:8090/';
const output = path.resolve(process.env.RCT_ARTIFACT_DIR || '.git/rct-validation/structure');
fs.mkdirSync(output, { recursive: true });

async function exportReport(page, selector, filename) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await pending;
  const destination = path.join(output, filename);
  await download.saveAs(destination);
  return JSON.parse(fs.readFileSync(destination, 'utf8'));
}

async function setPersonal(page, index) {
  await page.evaluate(index => {
    const type = PERSONAL_TYPES[index], draft = emptyExplorationDraft();
    PERSONAL_CORE_QUESTIONS.forEach(q => draft.answers[q.id]={optionId:q.options[0].id,skipped:false});
    PERSONAL_PROBES.forEach(probe => draft.answers[probe.questionId]={
      optionId:probe.questionId+':'+(type.profile[probe.axis]==='neg'?0:3),skipped:false
    });
    localStorage.setItem(EX_DRAFT_KEY,JSON.stringify(draft));
  }, index);
  await page.reload();
}

async function completeRomance(page, index, mixed = false) {
  await page.locator('[data-scene="love"]').click();
  const weights = {R:8,S:4,C:2,J:1}, seen = {};
  for (let step=0;step<44;step++) {
    const question = await page.evaluate(() => {
      const q=state.questions[state.current];
      return {id:q.id,kind:q.kind,axis:q.dimension};
    });
    let optionIndex = 0;
    if (question.kind === 'mode') {
      if (mixed && question.axis === 'C') {
        optionIndex = seen.C ? 2 : 0;
        seen.C = (seen.C || 0)+1;
      } else optionIndex = index & weights[question.axis] ? 3 : 0;
    }
    await page.locator(`#quiz-options [data-option-id="${question.id}:${optionIndex}"]`).click();
    await page.locator('#quiz-next').click();
  }
  assert.ok(await page.locator('#page-result').evaluate(node=>node.classList.contains('active')));
  return page.evaluate(()=>currentResult);
}

(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  const facts = [];
  try {
    const context = await browser.newContext({viewport:{width:1000,height:850},reducedMotion:'reduce'});
    const page = await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);
    // 原版本回答与原名称保留；新方向题缺失，不借旧题生成主型。
    await page.evaluate(()=>{
      const draft=emptyExplorationDraft();
      Object.values(EXPLORATION_BANK).flat().filter(q=>!PERSONAL_PROBES.some(probe=>probe.questionId===q.id))
        .forEach(q=>draft.answers[q.id]={optionId:q.options[0].id,skipped:false});
      const old=buildExplorationReport(draft);
      old.version='rct-exploration-2026-11-23-v1';
      old.topics=EXPLORATION_TOPICS.map(topic=>({
        topicId:topic.id,name:topic.name,reflection:topic.reflection,
        facets:EXPLORATION_BANK[topic.id].filter(q=>!PERSONAL_PROBES.some(probe=>probe.questionId===q.id))
          .map(q=>({questionId:q.id,facet:q.facet,questionText:q.text,mode:q.mode,...explorationAnswer(q,draft)}))
      }));
      old.topicCount=48;
      old.answered=243;
      old.total=243;
      old.personalProfile.version='rct-personal-explanation-v2';
      old.personalProfile.taxonomy.version='rct-personal-types-v1';
      old.personalProfile.title='理性求证型';
      old.personalProfile.summary='原规则保存的解释。';
      draft.version=old.version;
      localStorage.setItem(EX_DRAFT_KEY,JSON.stringify(draft));
      localStorage.setItem(EX_REPORT_KEY,JSON.stringify([old]));
    });
    await page.reload();
    await page.locator('#btn-exploration').click();
    assert.equal(await page.locator('[data-ex-group]').count(),0);
    await page.locator('#page-exploration-quiz [data-ex-hub]').click();
    assert.ok((await page.locator('#ex-hub-storage').textContent()).includes('旧版回答已保留'));
    await page.locator('[data-ex-snapshot]').click();
    assert.ok((await page.locator('#ex-profile').textContent()).includes('理性求证型'));
    await page.locator('#page-exploration-result [data-ex-hub]').first().click();
    await page.locator('#ex-overview').click();
    assert.equal(await page.evaluate(()=>explorationState.report.answered),29);
    assert.equal(await page.evaluate(()=>explorationState.report.personalProfile.primaryTypes.length),0);
    await page.locator('#page-exploration-result [data-ex-hub]').first().click();
    await page.locator('#ex-start').click();
    const firstProbe=await page.evaluate(()=>PERSONAL_PROBES[0].questionId);
    await page.locator(`#ex-options [data-option-id="${firstProbe}:0"]`).click();
    await page.reload();
    assert.equal(await page.evaluate(()=>Object.keys(readExplorationDraft().answers).length),244);
    assert.equal(await page.evaluate(()=>getExplorationReports()[0].personalProfile.title),'理性求证型');
    facts.push({migration:'243 originals preserved; new probe saved; old name retained'});

    // 八种组合各自进入页面结果，方向和实际名称一致。
    for (let index=0;index<8;index++) {
      await setPersonal(page,index);
      await page.locator('#btn-exploration').click();
      const expected=await page.evaluate(i=>PERSONAL_TYPES[i],index);
      assert.equal(await page.locator('#ex-profile .personal-summary h2').textContent(),expected.name);
      assert.equal(await page.locator('.personal-directions .feature-row').count(),3);
      assert.equal(await page.locator('.personal-classified-type').count(),1);
      assert.equal(await page.evaluate(()=>explorationState.report.personalProfile.secondaryTypes.length),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      facts.push({personal:expected.id,name:expected.name});
    }
    await setPersonal(page,0);
    // 十六模式完整作答，主副标题、完整导出名称与个人快照均一致。
    for (let index=0;index<16;index++) {
      if (index) await page.locator('#page-result [data-home]').click();
      const result=await completeRomance(page,index);
      assert.equal(result.type,`L${String(index+1).padStart(2,'0')}`);
      assert.equal(await page.locator('#result-type').textContent(),result.title);
      assert.equal(await page.locator('#result-subtype').textContent(),result.subtitle+'模式');
      assert.equal(await page.locator('#result-dims .axis-row').count(),4);
      assert.equal(await page.locator('#result-lifestyle .feature-row').count(),3);
      assert.equal(result.personalFoundation.profile.primaryTypes[0].id,'P01');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if (index===15) {
        await page.screenshot({path:path.join(output,'desktop-last-mode.png')});
        const exported=await exportReport(page,'#btn-export-result','full-romance-foundation.json');
        assert.equal(exported.name,result.name);
        assert.equal(exported.personalFoundation.profile.primaryTypes[0].id,'P01');
        assert.equal(exported.answers.length,44);
      }
      facts.push({romance:result.type,name:result.name});
    }
    await setPersonal(page,7);
    await page.locator('#btn-history').click();
    await page.locator('[data-result-id]').first().click();
    assert.ok((await page.locator('#result-foundation').textContent()).includes('筑基自航型'));
    assert.ok(!(await page.locator('#result-foundation').textContent()).includes('逐光共创型'));
    assert.equal(await page.evaluate(()=>currentResult.personalFoundation.profile.primaryTypes[0].id),'P01');
    assert.deepEqual(errors,[]);
    facts.push({foundation:'personal changes preserve saved romance foundation',pageErrors:errors});
    await context.close();

    for (const width of [375,320]) {
      const mobile=await browser.newContext({viewport:{width,height:820},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
      const phone=await mobile.newPage(), mobileErrors=[];
      phone.on('pageerror',error=>mobileErrors.push(error.message));
      await phone.goto(base);
      const fixed=await completeRomance(phone,15);
      assert.equal(fixed.personalFoundation.status,'incomplete');
      assert.ok((await phone.locator('#result-foundation').textContent()).includes('个人主型尚未确定'));
      assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await phone.screenshot({path:path.join(output,`${width}-fixed-mode.png`)});
      await phone.locator('#page-result [data-home]').click();
      const mixed=await completeRomance(phone,15,true);
      assert.deepEqual(mixed.flexible,['C']);
      assert.ok(mixed.name.includes('先处理安排') && mixed.name.includes('保留空间') && mixed.name.includes('分工自主'));
      assert.equal(mixed.animal,null);
      assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await phone.screenshot({path:path.join(output,`${width}-partial-mode.png`)});
      assert.deepEqual(mobileErrors,[]);
      facts.push({width,fixed:fixed.name,partial:mixed.name,pageErrors:mobileErrors});
      await mobile.close();
    }
    fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify({input:'programmatic_fixture',facts},null,2));
    console.log('8 personal types, 16 romance modes, migration, foundation snapshots and mobile partial results passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
