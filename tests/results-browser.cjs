/* 使用明确标记的程序测试输入，不作为真人研究样本。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../.git/rct-ui/node_modules/playwright');
const base = process.env.RCT_URL || 'http://localhost:8090/';
const output = path.resolve(process.env.RCT_ARTIFACT_DIR || '.git/rct-validation/results');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const facts = [];
  try {
    for (const width of [1000, 375, 320]) {
      const context = await browser.newContext({
        viewport: { width, height: 850 }, hasTouch: width < 500, isMobile: width < 500,
        reducedMotion: 'reduce'
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      assert.equal(await page.locator('#scene-entries .mode-card').count(), 2);
      assert.deepEqual(await page.locator('#scene-entries .mode-title').allTextContents(), ['个人测评', '婚恋测评']);
      await page.screenshot({ path: path.join(output, `${width}-home.png`), fullPage: true });
      await page.locator('#btn-exploration').click();
      await page.locator('#page-exploration .personal-library > summary').click();
      assert.equal(await page.locator('#ex-type-library .personal-type-item').count(), 8);
      assert.ok((await page.locator('#ex-type-library').textContent()).includes('逐光共创型'));
      await page.locator('#ex-overview').click();
      assert.ok((await page.locator('#ex-profile').textContent()).includes('尚无有效回答'));
      assert.equal(await page.locator('#ex-profile-references .relationship-reference').count(), 0);
      await page.locator('#page-exploration-result [data-home]').click();
      // 初始化固定的题库选项 ID；页面结果必须通过真实按钮生成。
      await page.evaluate(() => {
        const draft = emptyExplorationDraft();
        Object.values(EXPLORATION_BANK).flat().forEach(q => {
          draft.answers[q.id] = { optionId: q.options[0].id, skipped: false };
        });
        localStorage.setItem(EX_DRAFT_KEY, JSON.stringify(draft));
      });
      await page.reload();
      await page.locator('#btn-exploration').click();
      await page.locator('#ex-overview').click();
      const generated = await page.evaluate(() => ({
        answered: explorationState.report.answered,
        features: explorationState.report.personalProfile.repeated.length,
        references: explorationState.report.personalProfile.references.length,
        primary: explorationState.report.personalProfile.primaryTypes.map(row => ({ id: row.id, name: row.name })),
        evidence: explorationState.report.personalProfile.references[0].evidence,
        overflow: document.documentElement.scrollWidth > innerWidth
      }));
      assert.equal(generated.answered, 255);
      assert.equal(generated.features, 8);
      assert.equal(generated.references, generated.primary.length);
      assert.ok(generated.primary.some(row => row.name === '筑基自航型'));
      assert.equal(generated.overflow, false);
      assert.equal(await page.locator('#ex-profile-references .reference-heading').count(), 2);
      await page.locator('#ex-profile .personal-classified-type .explanation-evidence summary').first().click();
      assert.ok((await page.locator('#ex-profile .personal-classified-type').first().textContent()).includes(generated.evidence[0].questionText));
      await page.locator('#ex-profile-context').selectOption('cooperation');
      assert.ok((await page.locator('#ex-profile-usage').textContent()).includes('交付记录'));
      assert.ok((await page.locator('#ex-profile-references').textContent()).includes('不能由相处方式代替'));
      await page.locator('#ex-profile-context').selectOption('daily');
      assert.ok(!(await page.locator('#ex-profile-usage').textContent()).includes('交付记录'));
      const pending = page.waitForEvent('download');
      await page.locator('#ex-export-report').click();
      const download = await pending;
      const destination = path.join(output, `${width}-personal.json`);
      await download.saveAs(destination);
      const exported = JSON.parse(fs.readFileSync(destination, 'utf8'));
      assert.equal(exported.personalProfile.references.length, generated.references);
      assert.deepEqual(exported.personalProfile.primaryTypes.map(row => ({ id: row.id, name: row.name })), generated.primary);
      assert.equal(exported.personalProfile.taxonomy.rows.length, 8);
      await page.screenshot({ path: path.join(output, `${width}-personal-result.png`), fullPage: true });
      await page.locator('#ex-profile').screenshot({ path: path.join(output, `${width}-personal-summary.png`) });
      await page.locator('#page-exploration-result [data-ex-hub]').first().click();
      await page.locator('#ex-overview').click();
      assert.equal(await page.evaluate(() => getExplorationReports().length), 2);
      // 修改一个证据答案后，新解释改变，旧快照保留。
      await page.locator('.ex-topic-report').filter({ hasText: '11. 理性与判断' }).locator('summary').click();
      await page.locator('[data-ex-edit="11"]').click();
      await page.locator('#ex-options [data-option-id="ex-11-1:3"]').click();
      await page.locator('#page-exploration-quiz [data-ex-hub]').click();
      await page.locator('#ex-overview').click();
      assert.equal(await page.evaluate(() => explorationState.report.personalProfile.repeated.find(row => row.id === 'evidence').supporting.length), 3);
      assert.equal(await page.evaluate(() => getExplorationReports().find(report => report.answered === 255).personalProfile.repeated.find(row => row.id === 'evidence').supporting.length), 4);
      assert.deepEqual(errors, []);
      facts.push({ width, ...generated, changedEvidence: 3, snapshotEvidence: 4, pageErrors: errors });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify({ input: 'programmatic_fixture', facts }, null, 2));
    console.log('Personal result, evidence, context, export, immutable snapshots and 1000/375/320px layouts passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
