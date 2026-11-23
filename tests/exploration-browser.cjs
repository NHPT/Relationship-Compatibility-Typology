const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require('../.git/rct-ui/node_modules/playwright'); }
const base = process.env.RCT_URL || 'http://localhost:8090/';
const output = path.resolve(process.env.RCT_ARTIFACT_DIR || path.join(__dirname, '../.git/rct-validation/exploration'));
fs.mkdirSync(output, { recursive: true });
const evidence = [];
function check(name, facts = {}) { evidence.push({ name, ...facts }); }
async function inspect(page) {
  return page.evaluate(() => ({
    text: document.querySelector('#ex-text').textContent,
    selected: document.querySelectorAll('#ex-options .selected').length,
    pressed: document.querySelectorAll('#ex-options [aria-pressed="true"]').length,
    nextDisabled: document.querySelector('#ex-next').disabled,
    focus: document.activeElement.id,
    overflow: document.documentElement.scrollWidth > innerWidth,
    background: [...document.querySelectorAll('#ex-options .option')].map(button => ({
      border: getComputedStyle(button).borderColor,
      bg: getComputedStyle(button).backgroundColor
    }))
  }));
}
async function choose(page, index, touch) {
  const button = page.locator('#ex-options .option').nth(index);
  if (touch) await button.tap(); else await button.click();
}
async function advance(page, touch) {
  const button = page.locator('#ex-next');
  if (touch) await button.tap(); else await button.click();
}
async function downloadJSON(page, button, name) {
  const pending = page.waitForEvent('download');
  await page.locator(button).click();
  const result = await pending;
  const destination = path.join(output, name);
  await result.saveAs(destination);
  return JSON.parse(fs.readFileSync(destination, 'utf8'));
}
async function completeGroup(page, groupId, touch, skipFirst = false) {
  await page.locator(`[data-ex-group="${groupId}"]`).click();
  const questions = await page.evaluate(() => explorationState.questions.length);
  const first = await inspect(page);
  assert.equal(first.selected, 0);
  assert.equal(first.nextDisabled, true);
  for (let i = 0; i < questions; i++) {
    assert.equal((await inspect(page)).overflow, false);
    if (skipFirst && i === 0) await page.locator('#ex-skip').click();
    else {
      await choose(page, i % 4, touch);
      assert.equal((await inspect(page)).selected, 1);
      await advance(page, touch);
    }
    if (i < questions - 1) {
      const clean = await inspect(page);
      assert.equal(clean.selected, 0);
      assert.equal(clean.pressed, 0);
      assert.equal(clean.focus, 'ex-text');
      assert.equal(clean.nextDisabled, true);
      assert.ok(clean.background.every(row => row.bg !== 'rgb(229, 246, 238)' && row.border !== 'rgb(10, 157, 92)'));
    }
  }
  assert.ok(await page.locator('#page-exploration-result').evaluate(element => element.classList.contains('active')));
  const report = await page.evaluate(() => explorationState.report);
  assert.equal(report.topicCount, 6);
  assert.equal(report.groupId, groupId);
  assert.equal(report.total, questions);
  assert.equal(report.answered, questions - Number(skipFirst));
  assert.equal(report.skipped, Number(skipFirst));
  assert.equal(await page.locator('.ex-topic-report').count(), 6);
  const expected = await page.evaluate(id => getExplorationGroup(id).topics, groupId);
  assert.deepEqual(report.topics.map(topic => topic.topicId), expected);
  await page.locator('.ex-topic-report > summary').first().click();
  assert.ok(await page.locator('.ex-topic-body').first().isVisible());
  assert.ok((await page.locator('.ex-topic-body').first().textContent()).includes(report.topics[0].facets[0].questionText));
  check(`${touch ? 'touch' : 'desktop'} ${groupId} complete`, {
    questions, answered: report.answered, skipped: report.skipped, topicIds: expected
  });
  await page.locator('#page-exploration-result [data-ex-hub]').first().click();
}

(async () => {
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('#btn-exploration').click();
    assert.equal(await page.locator('[data-ex-group]').count(), 8);
    const requests = [];
    page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
    if (!process.env.RCT_EX_CONTINUE) {
    await page.screenshot({ path: path.join(output, 'desktop-hub.png'), fullPage: true, animations: 'disabled' });
    await page.locator('#ex-overview').click();
    assert.ok((await page.locator('#ex-report-meta').textContent()).includes('未答 255 题'));
    assert.equal(await page.locator('.ex-topic-report').count(), 48);
    await page.locator('#page-exploration-result [data-ex-hub]').first().click();
    await page.locator('[data-ex-group="needs"]').click();
    const first = await inspect(page);
    const chosen = await page.locator('#ex-options .option').nth(1).getAttribute('data-option-id');
    await choose(page, 1);
    assert.equal((await inspect(page)).text, first.text);
    await page.reload();
    await page.locator('#btn-exploration').click();
    requests.length = 0;
    assert.ok((await page.locator('[data-ex-group="needs"]').textContent()).includes('继续'));
    await page.locator('[data-ex-group="needs"]').click();
    assert.notEqual((await inspect(page)).text, first.text);
    assert.equal((await inspect(page)).selected, 0);
    await page.locator('#ex-prev').click();
    assert.equal((await inspect(page)).selected, 1);
    assert.equal(await page.locator('#ex-options .selected').getAttribute('data-option-id'), chosen);
    const replacement = await page.locator('#ex-options .option').nth(3).getAttribute('data-option-id');
    await choose(page, 3);
    await advance(page);
    const answers = await page.evaluate(() => Object.values(explorationState.draft.answers));
    assert.equal(answers.length, 1);
    assert.equal(answers[0].optionId, replacement);
    await page.locator('#ex-skip').click();
    await page.locator('#page-exploration-quiz [data-ex-hub]').click();
    const partial = await downloadJSON(page, '#ex-export-data', 'partial-data.json');
    assert.equal(Object.keys(partial.currentDraft.answers).length, 2);
    await page.locator('#ex-overview').click();
    const partialReport = await downloadJSON(page, '#ex-export-report', 'partial-report.json');
    assert.equal(partialReport.answered, 1);
    assert.equal(partialReport.skipped, 1);
    assert.equal(partialReport.total - partialReport.answered - partialReport.skipped, 253);
    check('draft reload, back edit, skip and partial export', { answered: 1, skipped: 1, pending: 253 });
    await page.locator('#page-exploration-result [data-ex-hub]').first().click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#ex-clear').click();
    const groups = await page.locator('[data-ex-group]').evaluateAll(buttons => buttons.map(button => button.dataset.exGroup));
    for (const group of groups) await completeGroup(page, group);
    await page.locator('#ex-overview').click();
    const full = await downloadJSON(page, '#ex-export-report', 'full-48-report.json');
    assert.equal(full.topicCount, 48);
    assert.equal(full.answered, 255);
    assert.ok(full.topics.every(topic => topic.facets.every(facet => facet.status === 'answered')));
    assert.equal(full.score, undefined);
    await page.locator('.ex-topic-report > summary').first().click();
    await page.screenshot({ path: path.join(output, 'desktop-overview.png'), fullPage: true, animations: 'disabled' });
    await page.locator('[data-ex-edit="1"]').click();
    assert.equal((await inspect(page)).selected, 1);
    await choose(page, 0);
    await page.locator('#page-exploration-quiz [data-ex-hub]').click();
    // 修改草稿不会改写已经保存的报告。
    const oldFull = await page.evaluate(() => getExplorationReports().find(report => !report.groupId && report.answered === 255));
    assert.deepEqual(oldFull.topics, full.topics);
    await page.locator('[data-ex-snapshot]').first().click();
    assert.ok((await page.locator('#ex-report-meta').textContent()).includes('历史报告'));
    await page.locator('#page-exploration-result [data-home]').click();
    await page.locator('#btn-history').click();
    assert.equal(await page.locator('#history-list .history-item').count(), 0);
    assert.equal(requests.length, 0);
    assert.deepEqual(errors, []);
    check('48 topic overview, immutable snapshots, separate histories, no upload', { answered: 255, submittedRequests: 0 });
    } else {
      evidence.push(...JSON.parse(fs.readFileSync(path.join(output, 'evidence.json'), 'utf8')));
      const full = JSON.parse(fs.readFileSync(path.join(output, 'full-48-report.json'), 'utf8'));
      await page.evaluate(report => {
        const draft = emptyExplorationDraft();
        report.topics.flatMap(topic => topic.facets).forEach(facet => {
          draft.answers[facet.questionId] = { optionId: facet.optionId, skipped: false, answeredAt: report.timestamp };
        });
        localStorage.setItem(EX_DRAFT_KEY, JSON.stringify(draft));
        localStorage.setItem(EX_REPORT_KEY, JSON.stringify([report]));
        explorationState.draft = readExplorationDraft();
      }, full);
      requests.length = 0;
      await page.locator('#page-exploration [data-home]').click();
      await page.locator('#btn-exploration').click();
      await page.locator('#ex-overview').click();
      assert.equal(await page.locator('.ex-topic-report').count(), 48);
      await page.locator('#page-exploration-result [data-home]').click();
      await page.locator('#btn-history').click();
      assert.equal(await page.locator('#history-list .history-item').count(), 0);
      assert.equal(requests.length, 0);
      check('48 topic overview, immutable snapshots, separate histories, no upload', { answered: 255, submittedRequests: 0 });
    }
    await context.close();

    const mobile = await browser.newContext({
      viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1
    });
    const phone = await mobile.newPage();
    await phone.goto(base);
    await phone.locator('#btn-exploration').tap();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await phone.screenshot({ path: path.join(output, 'mobile-hub.png'), fullPage: true, animations: 'disabled' });
    await completeGroup(phone, 'needs', true, true);
    await completeGroup(phone, 'meaning', true);
    await phone.locator('#ex-overview').tap();
    assert.ok((await phone.locator('#ex-report-meta').textContent()).includes('跳过 1 题'));
    await phone.locator('.ex-topic-report > summary').first().tap();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await phone.screenshot({ path: path.join(output, 'mobile-overview.png'), fullPage: true, animations: 'disabled' });
    await mobile.close();

    const restricted = await browser.newContext();
    const failure = await restricted.newPage();
    await failure.goto(base);
    await failure.evaluate(() => {
      localStorage.setItem('rct_history_v1', '[{"type":"L1","timestamp":1}]');
      localStorage.setItem('rct_exploration_draft_v1', '{"version":"old","answers":{}}');
    });
    await failure.reload();
    await failure.locator('#btn-exploration').click();
    assert.equal(await failure.locator('[data-ex-group]:disabled').count(), 8);
    const old = await downloadJSON(failure, '#ex-export-data', 'old-data.json');
    assert.equal(old.draft.version, 'old');
    failure.once('dialog', dialog => dialog.accept());
    await failure.locator('#ex-clear').click();
    assert.equal(await failure.evaluate(() => getHistory().length), 1);
    await failure.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
    await failure.locator('[data-ex-group="ethics"]').click();
    await choose(failure, 0);
    assert.ok((await failure.locator('#ex-quiz-storage').textContent()).includes('保存失败'));
    await failure.locator('#page-exploration-quiz [data-ex-hub]').click();
    const memory = await downloadJSON(failure, '#ex-export-data', 'unsaved-data.json');
    assert.equal(Object.keys(memory.currentDraft.answers).length, 1);
    await failure.locator('#ex-overview').click();
    assert.ok((await failure.locator('#ex-report-storage').textContent()).includes('未能保存'));
    const memoryReport = await downloadJSON(failure, '#ex-export-report', 'unsaved-report.json');
    assert.equal(memoryReport.answered, 1);
    check('old version protected, clear isolated, unavailable storage exports memory', { passed: true });
    await restricted.close();
    fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(`${evidence.length} exploration browser groups passed`);
  } finally { await browser.close(); }
})().catch(error => {
  fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.error(error);
  process.exitCode = 1;
});
