/* 历史个人页面回归；仅配合旧版本页面使用。输入不是真人样本。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../.git/rct-ui/node_modules/playwright');
const base = process.env.RCT_URL || 'http://localhost:8090/';
const output = path.resolve(process.env.RCT_ARTIFACT_DIR || '.git/rct-validation/legacy-personal');
fs.mkdirSync(output, { recursive: true });
const evidence = [];

async function inspect(page) {
  return page.evaluate(() => ({
    id: explorationState.questions[explorationState.current].id,
    text: document.querySelector('#ex-text').textContent,
    selected: document.querySelectorAll('#ex-options .selected').length,
    pressed: document.querySelectorAll('#ex-options [aria-pressed="true"]').length,
    nextDisabled: document.querySelector('#ex-next').disabled,
    focus: document.activeElement.id,
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
}
async function click(page, selector, touch = false) {
  const button = page.locator(selector);
  if (touch) await button.tap(); else await button.click();
}
async function downloadJSON(page, selector, filename) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await pending;
  const destination = path.join(output, filename);
  await download.saveAs(destination);
  return JSON.parse(fs.readFileSync(destination, 'utf8'));
}
async function complete(page, touch = false, skipFirst = false) {
  assert.equal(await page.evaluate(() => explorationState.questions.length), 44);
  for (let i = 0; i < 44; i++) {
    const before = await inspect(page);
    assert.equal(before.overflow, false);
    assert.equal(before.selected, 0);
    assert.equal(before.nextDisabled, true);
    assert.doesNotMatch(before.text, /性生活|伴侣|婚姻|生育/);
    if (skipFirst && i === 0) await click(page, '#ex-skip', touch);
    else {
      await click(page, `#ex-options .option:nth-child(${i % 4 + 1})`, touch);
      assert.equal((await inspect(page)).selected, 1);
      await click(page, '#ex-next', touch);
    }
    if (i < 43) {
      const after = await inspect(page);
      assert.equal(after.pressed, 0);
      assert.equal(after.focus, 'ex-text');
    }
  }
  assert.ok(await page.locator('#page-exploration-result').evaluate(node => node.classList.contains('active')));
  const report = await page.evaluate(() => explorationState.report);
  assert.equal(report.total, 44);
  assert.equal(report.groupId, null);
  assert.equal(report.answered, 44 - Number(skipFirst));
  assert.equal(report.skipped, Number(skipFirst));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  return report;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('#btn-exploration').click();
    assert.ok(await page.locator('#page-exploration-quiz').evaluate(node => node.classList.contains('active')));
    assert.equal(await page.locator('[data-ex-group]').count(), 0);
    await page.screenshot({ path: path.join(output, 'desktop-direct-start.png'), animations: 'disabled' });
    const first = await inspect(page);
    await page.locator('#ex-options .option').nth(1).click();
    const chosen = await page.locator('#ex-options .selected').getAttribute('data-option-id');
    assert.equal((await inspect(page)).text, first.text);
    await page.reload();
    await page.locator('#btn-exploration').click();
    assert.notEqual((await inspect(page)).id, first.id);
    await page.locator('#ex-prev').click();
    assert.equal(await page.locator('#ex-options .selected').getAttribute('data-option-id'), chosen);
    await page.locator('#ex-options .option').nth(3).click();
    await page.locator('#ex-next').click();
    await page.locator('#ex-skip').click();
    await page.locator('#page-exploration-quiz [data-ex-hub]').click();
    const data = await downloadJSON(page, '#ex-export-data', 'partial-data.json');
    assert.equal(Object.keys(data.currentDraft.answers).length, 2);
    await page.locator('#ex-overview').click();
    const partial = await downloadJSON(page, '#ex-export-report', 'partial-report.json');
    assert.equal(partial.answered, 1);
    assert.equal(partial.skipped, 1);
    assert.equal(partial.total, 44);
    evidence.push({ name: 'direct start, reload resume, back edit, skip and export', answered: 1, skipped: 1 });
    await page.locator('#page-exploration-result [data-ex-hub]').first().click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#ex-clear').click();
    page.on('request', request => requests.push(request.method()));
    await page.locator('#ex-start').click();
    const full = await complete(page);
    await page.locator('.ex-topic-report > summary').first().click();
    await page.screenshot({ path: path.join(output, 'desktop-result.png'), animations: 'disabled' });
    await page.locator('[data-ex-edit]').first().click();
    await page.locator('#ex-options .option').first().click();
    await page.locator('#page-exploration-quiz [data-ex-hub]').click();
    assert.deepEqual(await page.evaluate(() => getExplorationReports()[0].topics), full.topics);
    await page.locator('[data-ex-snapshot]').first().click();
    assert.ok((await page.locator('#ex-report-meta').textContent()).includes('历史报告'));
    await page.locator('#page-exploration-result [data-home]').click();
    await page.locator('#btn-history').click();
    assert.equal(await page.locator('#history-list .history-item').count(), 0);
    assert.deepEqual(errors, []);
    assert.equal(requests.length, 0);
    evidence.push({ name: '44 answers, immutable snapshot, isolated history and no upload', answered: 44, pageErrors: errors });
    await context.close();

    const mobile = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await phone.goto(base);
    await phone.locator('#btn-exploration').tap();
    await phone.screenshot({ path: path.join(output, 'mobile-direct-start.png'), animations: 'disabled' });
    await complete(phone, true, true);
    await phone.screenshot({ path: path.join(output, 'mobile-result.png'), animations: 'disabled' });
    evidence.push({ name: 'mobile 44-question flow and skip', width: 320, answered: 43, skipped: 1 });
    await mobile.close();

    const migration = await browser.newContext();
    const previous = await migration.newPage();
    await previous.goto(base);
    await previous.evaluate(() => {
      const draft = emptyExplorationDraft();
      draft.version = 'rct-exploration-2026-11-23-v2';
      Object.values(EXPLORATION_BANK).flat().forEach(q => draft.answers[q.id] = { optionId: q.options[0].id, skipped: false });
      localStorage.setItem(EX_DRAFT_KEY, JSON.stringify(draft));
    });
    await previous.reload();
    await previous.locator('#btn-exploration').click();
    const resumed = [];
    for (let i = 0; i < 3; i++) {
      const question = await inspect(previous);
      assert.ok(question.id.startsWith('pc-'));
      resumed.push(question.id);
      await previous.locator('#ex-options .option').first().click();
      await previous.locator('#ex-next').click();
    }
    assert.equal(await previous.evaluate(() => explorationState.report.answered), 44);
    assert.equal(await previous.evaluate(() => Object.keys(readExplorationDraft().answers).length), 258);
    assert.equal(new Set(resumed).size, 3);
    evidence.push({ name: 'v2 migration resumes only three new daily questions', resumed, originalAnswersPreserved: 255 });
    await migration.close();

    const restricted = await browser.newContext();
    const failure = await restricted.newPage();
    await failure.goto(base);
    await failure.evaluate(() => {
      localStorage.setItem('rct_history_v1', '[{"type":"L1","timestamp":1}]');
      localStorage.setItem(EX_DRAFT_KEY, '{"version":"unknown","answers":{}}');
    });
    await failure.reload();
    await failure.locator('#btn-exploration').click();
    assert.equal(await failure.locator('#ex-start').isDisabled(), true);
    assert.equal((await downloadJSON(failure, '#ex-export-data', 'unknown-data.json')).draft.version, 'unknown');
    failure.once('dialog', dialog => dialog.accept());
    await failure.locator('#ex-clear').click();
    assert.equal(await failure.evaluate(() => getHistory().length), 1);
    await failure.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
    await failure.locator('#ex-start').click();
    await failure.locator('#ex-options .option').first().click();
    assert.ok((await failure.locator('#ex-quiz-storage').textContent()).includes('保存失败'));
    await failure.locator('#page-exploration-quiz [data-ex-hub]').click();
    assert.equal(Object.keys((await downloadJSON(failure, '#ex-export-data', 'unsaved-data.json')).currentDraft.answers).length, 1);
    await failure.locator('#ex-overview').click();
    assert.ok((await failure.locator('#ex-report-storage').textContent()).includes('未能保存'));
    assert.equal((await downloadJSON(failure, '#ex-export-report', 'unsaved-report.json')).answered, 1);
    evidence.push({ name: 'unknown version protected and storage failure remains exportable', passed: true });
    await restricted.close();
    fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify({ input: 'programmatic_fixture', evidence }, null, 2));
    console.log(`${evidence.length} personal flow browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
