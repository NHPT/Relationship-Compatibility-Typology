// Full browser flows use synthetic choices, not psychometric study participants.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../.git/rct-ui/node_modules/playwright');
const M = require('../js/depth/model.json');
const types = require('./fixtures/depth-types.json');
const base = process.env.RCT_URL || 'http://localhost:8090/';
const output = path.resolve(process.env.RCT_ARTIFACT_DIR || '.git/depth-validation');
fs.mkdirSync(output, { recursive: true });
const facts = [];
async function exportJSON(page, selector, file) {
  const pending = page.waitForEvent('download'); await page.locator(selector).click();
  const download = await pending, target = path.join(output, file);
  await download.saveAs(target);
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}
async function complete(page, choices = {}) {
  while (await page.locator('#page-depth-quiz').evaluate(e => e.classList.contains('active'))) {
    const id = await page.locator('#depth-text').getAttribute('data-question-id');
    const chosen = choices[id] || M.items.find(q => q.id === id).options[0].id;
    if (['skipped', 'no_experience', 'uncertain', 'declined'].includes(chosen)) await page.locator('#depth-skip').click();
    else await page.locator(`#depth-options [data-option-id="${chosen}"]`).click();
    await page.locator('#depth-next').click();
  }
  assert.equal(await page.locator('#page-depth-report').evaluate(e => e.classList.contains('active')), true);
  return page.evaluate(() => RCT_DEPTH.state.report);
}
async function directMarriage(page) {
  assert.equal(await page.locator('#page-depth-quiz').evaluate(e => e.classList.contains('active')), true);
  assert.equal(await page.locator('#page-consent, #consent-start, #consent-adult').count(), 0);
  assert.equal(await page.locator('#depth-progress').textContent(), '第 1 / 48 题');
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1050, height: 850 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    assert.ok((await page.title()).includes('深度测评'));
    // Preserve exact raw bytes, old names and scripts without ever migrating them.
    const legacy = JSON.stringify([{ version: 'rct-exploration-old', personalProfile: { title: '理性求证型', summary: '原解释保持不变。' },
      topics: [{ facets: [{ questionId: 'old', questionText: '原来的问题', text: '原来的回答' }] }] }]);
    await page.evaluate(raw => {
      localStorage.setItem('rct_exploration_reports_v1', raw);
      localStorage.setItem('rct_exploration_draft_v1', '{"version":"old","answers":{"original":"untouched"}}');
    }, legacy);
    await page.locator('#btn-history').click();
    await page.locator('[data-legacy="0"]').click();
    assert.ok((await page.locator('#raw-title').textContent()).includes('草稿'));
    await page.locator('#raw-back').click();
    await page.locator('[data-legacy="1"]').click();
    assert.equal(await page.locator('#raw-title').textContent(), '理性求证型');
    assert.ok((await page.locator('#raw-readable').textContent()).includes('原解释保持不变'));
    await page.locator('#raw-back').click(); await page.locator('#page-depth-history [data-home]').click();

    await page.locator('#btn-exploration').click();
    assert.equal(await page.locator('#depth-progress').textContent(), '第 1 / 96 题');
    assert.equal(await page.locator('#depth-next').isEnabled(), false);
    assert.equal(await page.locator('#page-depth-quiz input, #page-depth-quiz textarea, .depth-note, [data-missing]').count(), 0);
    assert.equal(await page.locator('#depth-skip').count(), 1);
    const firstId = await page.locator('#depth-text').getAttribute('data-question-id');
    await page.locator('#depth-skip').click();
    assert.equal(await page.evaluate(id => RCT_DEPTH.state.draft.answers[id], firstId), 'skipped');
    await page.reload(); await page.locator('#btn-exploration').click();
    assert.notEqual(await page.locator('#depth-text').getAttribute('data-question-id'), firstId);
    await page.locator('#depth-prev').click();
    assert.equal(await page.locator('#depth-skip').getAttribute('aria-pressed'), 'true');
    const personal = await complete(page, types.samples.find(s => s.target === 'T13').answers);
    assert.equal(personal.classification.primary.id, 'T13');
    assert.equal(personal.derived.coveredTopics, 48);
    assert.equal(Object.hasOwn(personal, 'notes'), false);
    assert.equal(Object.hasOwn(personal, 'consent'), false);
    assert.equal(await page.locator('.profile-intro h2').textContent(), '重利型');
    assert.ok((await page.locator('#depth-report').textContent()).includes('收益优先与侵占'));
    assert.ok((await page.locator('#depth-report').textContent()).includes('维度解析'));
    assert.equal(await page.locator('#profile-radar').count(), 1);
    assert.equal(await page.locator('.profile-emblem svg').getAttribute('aria-label'), '鹰象征图案');
    await page.screenshot({ path: path.join(output, 'desktop-personal.png'), fullPage: false });
    const exportedPersonal = await exportJSON(page, '#report-export', 'personal-core.json');
    assert.equal(Object.keys(exportedPersonal.answers).length, 96);
    await page.locator('#report-followup').click();
    assert.equal(await page.locator('#depth-progress').textContent(), '第 97 / 120 题');
    await page.locator('#depth-skip').click();
    await page.locator('#depth-next').click(); await page.locator('#depth-stop-followup').click();
    const partial = await page.evaluate(() => RCT_DEPTH.state.report);
    assert.equal(partial.classification.primary.id, 'T13'); assert.equal(Object.keys(partial.answers).length, 97);
    await page.locator('#report-followup').click(); const auto = await complete(page);
    assert.equal(Object.keys(auto.answers).length, 120); assert.equal(auto.classification.primary.id, 'T13');
    await page.locator('#report-followup').click(); const full = await complete(page);
    assert.equal(Object.keys(full.answers).length, 144);
    assert.equal(await page.locator('#report-followup').isEnabled(), false);
    assert.equal(full.classification.primary.id, 'T13');
    assert.equal(await page.evaluate(id => {
      const original = RCT_DEPTH.storage.list('reports').find(r => r.reportId === id);
      return Object.keys(original.answers).length;
    }, personal.reportId), 96);
    facts.push({ personal: '96 core, paused at 97, resumed 120, expanded 144; type stable and first snapshot intact',
      simplifiedControls: 'four choices and one skip, no note fields; skipped remains missing after reload' });

    await page.locator('#page-depth-report [data-home]').click();
    await page.locator('[data-start="marriage"]').click(); await directMarriage(page);
    const a = await complete(page);
    assert.equal(Object.keys(a.answers).length, 48); assert.equal(a.derived.coveredTopics, 12);
    assert.equal(Object.hasOwn(a, 'consent'), false);
    await page.locator('#report-new').click(); await directMarriage(page);
    const b = await complete(page, { 'M05-02': 'M05-02:4' });
    facts.push({ marriageEntry: 'direct first question and retake; no age or consent confirmation' });
    assert.equal(await page.locator('#btn-pair, #report-open-pair, #page-depth-pair').count(), 0);
    assert.equal(await page.locator('.affinity-entry').count(), 8);
    await page.locator('#affinity-tab-friction').click();
    assert.equal(await page.locator('#affinity-panel-friction').isVisible(), true);
    const archived = JSON.stringify([{ format: 'rct-depth-comparison', comparisonId: 'old-archive', agreements: [{ statement: '保持原记录' }] }]);
    await page.evaluate(raw => localStorage.setItem('rct_human_depth_v1_comparisons', raw), archived);
    await page.locator('#page-depth-report [data-home]').click();
    await page.locator('#btn-history').click();
    assert.doesNotMatch(await page.locator('#depth-history').innerText(), /双方对照/);
    facts.push({ affinities: 'type references included in marriage; pair controls removed, archived snapshots remain only in backups' });
    const forged = { ...a, reportId: 'imported-synthetic', derived: { coveredTopics: 0, indicators: ['fake'] } };
    await page.locator('#report-import').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(forged)) });
    await page.waitForFunction(() => document.querySelector('#import-status').textContent.includes('已导入'));
    assert.equal(await page.evaluate(() => RCT_DEPTH.storage.list('reports').find(r => r.reportId === 'imported-synthetic').derived.coveredTopics), 12);
    await page.locator('#report-import').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from('{"version":"future","type":"T01"}') });
    await page.waitForFunction(() => document.querySelector('#import-status').textContent.includes('版本不兼容'));
    await page.locator('#report-import').setInputFiles({ name: 'invalid.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ ...a, reportId: 'bad', answers: { 'M01-01': 'P01-01:1' } })) });
    await page.waitForFunction(() => document.querySelector('#import-status').textContent.includes('导入失败'));
    const backup = await exportJSON(page, '#history-export', 'backup.json');
    assert.equal(backup.rawRecords.rct_human_depth_v1_comparisons, archived);
    assert.equal(await page.evaluate(() => localStorage.getItem('rct_human_depth_v1_comparisons')), archived);
    assert.equal(backup.rawRecords.rct_exploration_reports_v1, legacy);
    assert.equal(await page.evaluate(() => localStorage.getItem('rct_exploration_reports_v1')), legacy);
    assert.deepEqual(errors, []); facts.push({ import: 'forged derived ignored, incompatible kept raw, foreign option refused, old raw unchanged', errors });
    await context.close();

    for (const width of [375, 320]) {
      const mobile = await browser.newContext({ viewport: { width, height: 830 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const phone = await mobile.newPage(), phoneErrors = [];
      phone.on('pageerror', e => phoneErrors.push(e.message));
      await phone.goto(base);
      assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await phone.locator('[data-start="marriage"]').click(); await directMarriage(phone);
      assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await phone.screenshot({ path: path.join(output, `mobile-${width}-quiz.png`), fullPage: false });
      const choices = Object.fromEntries(M.items.filter(q => q.scope === 'marriage').map(q => [q.id, 'skipped']));
      await complete(phone, choices);
      assert.equal(await phone.locator('#depth-report h2').first().textContent(), '待观察');
      assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await phone.screenshot({ path: path.join(output, `mobile-${width}-unknown.png`), fullPage: false });
      assert.deepEqual(phoneErrors, []); facts.push({ width, overflow: false, allMissing: 'no invented score or type', errors: phoneErrors });
      await mobile.close();
    }

    const failure = await browser.newContext();
    await failure.addInitScript(() => {
      localStorage.setItem('rct_human_depth_v1_draft_personal', '{broken');
      localStorage.setItem('rct_human_depth_v1_reports', '{also_broken');
    });
    const broken = await failure.newPage(); await broken.goto(base);
    assert.ok((await broken.locator('#home-status').textContent()).includes('无法读取'));
    await broken.locator('#btn-exploration').click();
    assert.equal(await broken.evaluate(() => localStorage.getItem('rct_human_depth_v1_draft_personal')), '{broken');
    await broken.locator('#history-export').click();
    await failure.close();

    const quota = await browser.newContext();
    await quota.addInitScript(() => Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); });
    const qpage = await quota.newPage(); await qpage.goto(base); await qpage.locator('#btn-exploration').click();
    await qpage.locator('#depth-skip').click();
    assert.ok((await qpage.locator('#depth-quiz-status').textContent()).includes('内存'));
    await qpage.locator('#depth-pause').click(); await qpage.locator('#btn-history').click();
    const memory = await exportJSON(qpage, '#history-export', 'quota-memory.json');
    assert.equal(Object.keys(memory.memory.draft.answers).length, 1);
    await quota.close(); facts.push({ storage: 'corrupt record never reset; quota retains exportable memory' });
    fs.writeFileSync(path.join(output, 'browser-evidence.json'), JSON.stringify({ kind: 'synthetic_browser_regression', base, facts }, null, 2));
    console.log(JSON.stringify(facts, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
