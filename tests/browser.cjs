/* npm install --no-save playwright；默认也可使用项目内已有的隔离依赖。 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require('../.git/rct-ui/node_modules/playwright'); }
const { chromium } = playwright;
const base = process.env.RCT_URL || 'http://localhost:8090/';
const output = path.resolve(__dirname, '../.git/rct-validation');
fs.mkdirSync(output, { recursive: true });
const evidence = [];
function check(name, facts) { evidence.push({ name, ...facts }); }

async function snapshot(page) {
  return page.evaluate(() => ({
    question: document.querySelector('#quiz-text').textContent,
    selected: document.querySelectorAll('#quiz-options .selected').length,
    pressed: document.querySelectorAll('#quiz-options [aria-pressed="true"]').length,
    nextDisabled: document.querySelector('#quiz-next').disabled,
    focused: document.activeElement.id,
    answers: state.answers.length,
    borders: [...document.querySelectorAll('#quiz-options .option')].map(button => ({
      hover: button.matches(':hover'), border: getComputedStyle(button).borderColor,
      background: getComputedStyle(button).backgroundColor
    }))
  }));
}
async function pick(page, optionIndex, touch = false) {
  const option = page.locator('#quiz-options .option').nth(optionIndex);
  if (touch) await option.tap(); else await option.click();
}
async function next(page, touch = false) {
  if (touch) await page.locator('#quiz-next').tap(); else await page.locator('#quiz-next').click();
}
async function complete(page, sceneId, flexible = false) {
  const seen = { X: 0, Y: 0, M: 0 };
  for (let i = 0; i < 32; i++) {
    const info = await page.evaluate(() => ({
      kind: state.questions[state.current].kind,
      dimension: state.questions[state.current].dimension,
      scores: state.questions[state.current].options.map(option => option.score)
    }));
    let target = 0;
    if (info.kind === 'style') {
      const score = flexible ? (seen[info.dimension]++ === 0 ? -2 : 1) : -2;
      target = info.scores.indexOf(score);
    } else if (info.kind === 'behavior') target = info.scores.indexOf(3);
    await pick(page, target);
    await next(page);
  }
  assert.ok(await page.locator('#page-result').evaluate(element => element.classList.contains('active')));
  const result = await page.evaluate(() => ({
    type: currentResult.type, sceneId: currentResult.sceneId,
    axes: currentResult.axisRows.length, behaviors: currentResult.behaviorRows.length,
    conditions: currentResult.conditions.length, answers: currentResult.answers.length,
    flexible: currentResult.flexible.length,
    candidates: [...document.querySelectorAll('.match-chip')].map(element => element.textContent),
    imageLabel: document.querySelector('#result-radar svg').getAttribute('aria-labelledby'),
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
  assert.equal(result.sceneId, sceneId);
  assert.equal(result.axes, 3);
  assert.equal(result.behaviors, 8);
  assert.equal(result.conditions, 7);
  assert.equal(result.answers, 32);
  assert.equal(result.candidates.length, 8);
  assert.equal(result.overflow, false);
  assert.ok(result.imageLabel.includes('radar'));
  assert.equal(result.flexible, flexible ? 3 : 0);
  check(`${sceneId} complete${flexible ? ' flexible' : ''}`, result);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const touch of [false, true]) {
      const context = await browser.newContext(touch
        ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
        : { viewport: { width: 1000, height: 850 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      assert.equal(await page.locator('[data-scene]').count(), 4);
      await page.waitForTimeout(220);
      await page.screenshot({ path: path.join(output, `${touch ? 'mobile' : 'desktop'}-home.png`), fullPage: true });
      await page.locator('[data-scene="love"]').click();
      const first = await snapshot(page);
      assert.equal(first.selected, 0);
      assert.equal(first.nextDisabled, true);
      await pick(page, 1, touch);
      const selected = await snapshot(page);
      assert.equal(selected.question, first.question);
      assert.equal(selected.selected, 1);
      assert.equal(selected.pressed, 1);
      assert.equal(selected.answers, 0); // 尚未确认，不能自动跳题或写入下一题。
      await next(page, touch);
      // 将指针/触点放回前一题同位置。等待实际 CSS 过渡结束，检查可见状态。
      const box = await page.locator('#quiz-options .option').nth(1).boundingBox();
      if (!touch) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(220);
      const fresh = await snapshot(page);
      assert.notEqual(fresh.question, first.question);
      assert.equal(fresh.selected, 0);
      assert.equal(fresh.pressed, 0);
      assert.equal(fresh.nextDisabled, true);
      assert.equal(fresh.focused, 'quiz-text');
      assert.ok(fresh.borders.every(row => row.border !== 'rgb(10, 157, 92)' && row.background !== 'rgb(229, 246, 238)'));
      await page.screenshot({ path: path.join(output, `${touch ? 'touch' : 'mouse'}-fresh-question.png`) });
      check(`${touch ? 'touch' : 'mouse'} next question clean`, fresh);
      await pick(page, 1, touch);
      await next(page, touch);
      assert.equal((await snapshot(page)).selected, 0);
      await page.locator('#quiz-prev').click();
      assert.equal((await snapshot(page)).selected, 1);
      const changedId = await page.locator('#quiz-options .option').nth(3).getAttribute('data-option-id');
      await pick(page, 3, touch);
      await next(page, touch);
      assert.equal(await page.evaluate(() => state.answers[1].optionId), changedId);
      assert.equal((await snapshot(page)).selected, 0);
      // 计时到期不能合成答案，也不能继续到下一题。
      await page.evaluate(() => { state.timeLeft = 1; tick(); });
      assert.equal(await page.locator('#quiz-timer').textContent(), '0s');
      assert.equal((await snapshot(page)).nextDisabled, true);
      assert.equal(await page.evaluate(() => state.current), 2);
      check(`${touch ? 'touch' : 'mouse'} back edit and timeout`, { passed: true });
      if (!touch) {
        // 原生按钮键盘流程：题干焦点 -> 第一项 -> Space 选择 -> 下一题 Enter。
        await page.keyboard.press('Tab');
        assert.ok(await page.locator('#quiz-options .option').first().evaluate(element => element === document.activeElement));
        await page.keyboard.press('Space');
        assert.equal((await snapshot(page)).selected, 1);
        await page.locator('#quiz-next').focus();
        await page.keyboard.press('Enter');
        assert.equal((await snapshot(page)).selected, 0);
        assert.equal((await snapshot(page)).focused, 'quiz-text');
        check('keyboard selection and confirm', { passed: true });
      }
      await page.locator('#page-quiz [data-home]').click();
      await page.locator('[data-scene="love"]').click();
      await complete(page, 'love', true);
      await page.waitForTimeout(220);
      await page.screenshot({ path: path.join(output, `${touch ? 'mobile' : 'desktop'}-flexible-result.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `${touch ? 'mobile' : 'desktop'}-result-top.png`) });
      await page.locator('#result-radar').screenshot({ path: path.join(output, `${touch ? 'mobile' : 'desktop'}-radar.png`) });
      await page.locator('#oc-duration').selectOption('long');
      await page.locator('#oc-status').selectOption('good');
      const requests = [];
      page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
      await page.locator('#btn-save-outcome').click();
      assert.equal(await page.evaluate(() => getOutcomes()[0].partnerType), null);
      assert.equal(await page.evaluate(() => getOutcomes()[0].sceneId), 'love');
      await page.locator('#oc-status').selectOption('ok');
      await page.locator('#btn-save-outcome').click();
      assert.equal(await page.evaluate(() => getOutcomes().length), 1);
      assert.equal(await page.evaluate(() => getOutcomes()[0].status), 'ok');
      assert.equal(requests.filter(r => r.method !== 'GET').length, 0);
      const downloadEvent = page.waitForEvent('download');
      await page.locator('#btn-export-result').click();
      const download = await downloadEvent;
      await download.saveAs(path.join(output, `${touch ? 'mobile' : 'desktop'}-profile.json`));
      const exported = JSON.parse(fs.readFileSync(path.join(output, `${touch ? 'mobile' : 'desktop'}-profile.json`), 'utf8'));
      assert.equal(exported.answers.length, 32);
      assert.equal(exported.sceneId, 'love');
      check(`${touch ? 'touch' : 'mouse'} local feedback and export`, { passed: true, submittedRequests: 0 });
      for (const scene of ['friend', 'venture', 'team']) {
        await page.locator('#page-result [data-home]').click();
        await page.locator(`[data-scene="${scene}"]`).click();
        await complete(page, scene);
        assert.ok((await page.locator('#oc-partner option').allTextContents()).every(text => !/\bL[1-8]\b/.test(text)));
      }
      // 同场景重测与历史结果重开。
      await page.locator('#btn-again').click();
      assert.equal(await page.evaluate(() => state.sceneId), 'team');
      assert.equal((await snapshot(page)).selected, 0);
      await page.locator('#page-quiz [data-home]').click();
      await page.locator('#btn-history').click();
      assert.equal(await page.locator('.history-item').count(), 4);
      const allDownloadEvent = page.waitForEvent('download');
      await page.locator('#btn-export-json').click();
      const allDownload = await allDownloadEvent;
      await allDownload.saveAs(path.join(output, `${touch ? 'mobile' : 'desktop'}-data.json`));
      const allData = JSON.parse(fs.readFileSync(path.join(output, `${touch ? 'mobile' : 'desktop'}-data.json`), 'utf8'));
      assert.equal(allData.history.length, 4);
      assert.equal(allData.outcomes.length, 1);
      const csvDownloadEvent = page.waitForEvent('download');
      await page.locator('#btn-export-csv').click();
      const csvDownload = await csvDownloadEvent;
      await csvDownload.saveAs(path.join(output, `${touch ? 'mobile' : 'desktop'}-outcomes.csv`));
      const csv = fs.readFileSync(path.join(output, `${touch ? 'mobile' : 'desktop'}-outcomes.csv`), 'utf8');
      assert.ok(csv.includes('"sceneId"') && csv.includes('"love"') && csv.includes('"ok"'));
      await page.locator('#history-scene').selectOption('friend');
      assert.equal(await page.locator('.history-item').count(), 1);
      await page.locator('[data-result-id]').click();
      assert.equal(await page.evaluate(() => currentResult.sceneId), 'friend');
      await page.reload();
      await page.locator('#btn-history').click();
      assert.equal(await page.locator('.history-item').count(), 4);
      assert.equal(await page.evaluate(() => aggregate(getHistory()).comparable), false);
      assert.deepEqual(errors, []);
      check(`${touch ? 'touch' : 'mouse'} history isolation, restart, reload`, { passed: true, pageErrors: errors });
      await context.close();
    }
    // 旧数据、存储不可用与默认反馈的独立页面。
    const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });
    await context.addInitScript(() => {
      localStorage.setItem('rct_history_v1', JSON.stringify([{ type: 'SWING', name: '旧记录', timestamp: 1 }]));
    });
    const page = await context.newPage();
    await page.goto(base);
    await page.locator('#btn-history').click();
    assert.ok((await page.locator('#history-list').textContent()).includes('保留旧版记录'));
    await page.locator('#page-history [data-home]').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('[data-scene="team"]').click();
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
    await complete(page, 'team');
    assert.ok((await page.locator('#result-storage').textContent()).includes('无法保存'));
    let dialogText = '';
    page.once('dialog', async dialog => { dialogText = dialog.message(); await dialog.accept(); });
    await page.locator('#btn-save-outcome').click();
    assert.ok(dialogText.includes('时长和状态'));
    assert.equal(await page.evaluate(() => getOutcomes().length), 0);
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(output, 'small-mobile-result.png'), fullPage: true });
    check('legacy, 320px, unavailable storage, no default feedback', { passed: true });
    await context.close();
    fs.writeFileSync(path.join(output, 'browser-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(`${evidence.length} browser regression groups passed at ${base}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  fs.writeFileSync(path.join(output, 'browser-evidence.json'), JSON.stringify(evidence, null, 2));
  console.error(error);
  process.exitCode = 1;
});
