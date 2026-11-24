const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../.git/rct-ui/node_modules/playwright');
const D = require('../js/depth/data.js');
const P = require('../js/depth/profile.js');
const fixtures = require('./fixtures/depth-types.json');
const base = process.env.RCT_URL || 'http://localhost:8090/';
const output = path.resolve(process.env.RCT_ARTIFACT_DIR || '.git/depth-validation');
fs.mkdirSync(output, { recursive: true });
function report(scope, choices) {
  const d = D.newDraft(scope);
  d.order.forEach(id => D.choose(d, id, choices?.[id] || D.items.get(id).options[0].id));
  return D.snapshot(d);
}
async function display(page, r) {
  await page.evaluate(r => RCT_DEPTH.reportView(r), r);
  assert.equal(await page.locator('#page-depth-report.active').count(), 1);
}
async function privacy(page, selector = '#depth-report') {
  const html = await page.locator(selector).innerHTML();
  assert.doesNotMatch(html, /[PM]\d{2}-\d{2}|data-evidence|data-edit-question|所选行动|匹配值|混合模式/);
  assert.equal(await page.locator(`${selector} .report-evidence, ${selector} .evidence-row`).count(), 0);
}
async function chartBounds(page) {
  const geometry = await page.locator('#profile-radar').evaluate(svg => {
    const box = svg.viewBox.baseVal;
    return [...svg.querySelectorAll('text')].map(t => {
      const b = t.getBBox();
      const screen = t.getBoundingClientRect();
      return { label: t.textContent, inside: b.x >= box.x && b.y >= box.y &&
        b.x + b.width <= box.x + box.width && b.y + b.height <= box.y + box.height &&
        screen.left >= 0 && screen.right <= innerWidth };
    });
  });
  assert.ok(geometry.every(g => g.inside), JSON.stringify(geometry));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const facts = [], mixed = report('personal');
  try {
    const context = await browser.newContext({ viewport: { width: 1050, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    for (const sample of fixtures.samples) {
      const r = report('personal', sample.answers), type = P.types[sample.target];
      await display(page, r); await privacy(page); await chartBounds(page);
      assert.equal(await page.locator('.profile-intro h2').textContent(), type.title);
      assert.equal(await page.locator('.profile-emblem svg').getAttribute('aria-label'), type.animal + '象征图案');
      assert.equal(await page.locator('.profile-dimension').count(), 8);
      await page.locator('.profile-hero').screenshot({ path: path.join(output, `symbol-${sample.target}.png`) });
    }
    facts.push('all 14 real classifier fixtures render distinct animal symbols and descriptions without question details');
    assert.equal(mixed.classification.status, 'mixed');
    // A saved v1 report is reinterpreted only for display; stored bytes stay intact.
    const old = { ...mixed, engineVersion: 'rct-depth-engine-v1',
      notes: { [mixed.order[0]]: { example: '历史注记不应该显示在画像里' } } };
    const savedBytes = JSON.stringify([old]);
    await page.evaluate(raw => localStorage.setItem('rct_human_depth_v1_reports', raw), savedBytes);
    await page.reload(); await page.locator('#btn-history').click();
    await page.locator('[data-report-index="0"]').click();
    assert.equal(await page.locator('.profile-intro h2').textContent(), P.present(mixed).narrative.title);
    assert.equal(await page.locator('.profile-emblem svg').count(), 2);
    await privacy(page); await chartBounds(page);
    assert.ok(!(await page.locator('#depth-report').textContent()).includes('历史注记'));
    assert.equal(await page.evaluate(() => localStorage.getItem('rct_human_depth_v1_reports')), savedBytes);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#report-export').click();
    const download = await downloadEvent, exported = path.join(output, 'profile-export-v1.json');
    await download.saveAs(exported);
    const raw = JSON.parse(fs.readFileSync(exported, 'utf8'));
    assert.deepEqual(raw.answers, mixed.answers); assert.deepEqual(raw.notes, old.notes);
    await page.locator('[data-focus-axis="transparency"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'profile-axis-transparency');
    await page.locator('[data-focus-axis="commitment"]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'profile-axis-commitment');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'profile-desktop-mixed.png') });
    await page.locator('#profile-radar').screenshot({ path: path.join(output, 'profile-desktop-radar.png') });
    await page.locator('#report-edit').click();
    assert.equal(await page.locator('#depth-text').getAttribute('data-question-id'), mixed.order[0]);
    assert.equal(await page.locator('#depth-options .selected').count(), 1);
    facts.push('saved v1 mixed report gets coexistence narrative, two symbols, accessible radar, edit and full export; original bytes unchanged');

    const riskChoices = { ...mixed.answers, 'P28-01': 'P28-01:4', 'P18-02': 'P18-02:4', 'P08-01': 'P08-01:4' };
    await display(page, report('personal', riskChoices)); await privacy(page);
    const disclosure = page.locator('.profile-caution').filter({ hasText: '重要信息的隐瞒' });
    assert.ok((await disclosure.textContent()).includes('同时也呈现'));
    assert.equal(await page.locator('.profile-caution.priority').count() > 0, true);
    facts.push('repeated and safety risks remain explicit alongside counterinformation');

    await display(page, report('marriage', { 'M05-02': 'M05-02:4', 'M08-02': 'M08-02:4' }));
    await privacy(page); await chartBounds(page);
    assert.equal(await page.locator('.profile-domains details').count(), 12);
    assert.ok((await page.locator('.profile-radar').textContent()).includes('共同财务'));
    const a = report('marriage'), b = report('marriage', { 'M05-02': 'M05-02:4' });
    await page.evaluate(rs => {
      rs.forEach(r => RCT_DEPTH.storage.append('reports', r)); RCT_DEPTH.pairHub();
    }, [a, b]);
    await page.locator('#pair-a').selectOption(a.reportId); await page.locator('#pair-b').selectOption(b.reportId);
    await page.locator('#pair-load').click(); await privacy(page, '#pair-content');
    assert.equal(await page.locator('.pair-profiles').count(), 12);
    assert.ok((await page.locator('#pair-result-5').textContent()).includes('边界风险待核对'));
    facts.push('marriage radar and 12 domain interpretations; pair report presents both narratives without answer lists');
    assert.deepEqual(errors, []);
    await context.close();
    for (const width of [375, 320]) {
      const phoneContext = await browser.newContext({ viewport: { width, height: 830 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const phone = await phoneContext.newPage(); await phone.goto(base);
      await display(phone, mixed); await privacy(phone); await chartBounds(phone);
      await phone.screenshot({ path: path.join(output, `profile-mobile-${width}.png`) });
      await phone.locator('.profile-radar-section').scrollIntoViewIfNeeded();
      await phone.screenshot({ path: path.join(output, `profile-mobile-${width}-radar.png`) });
      await phone.locator('[data-focus-axis="fairness"]').click();
      assert.equal(await phone.evaluate(() => document.activeElement.id), 'profile-axis-fairness');
      const blank = D.newDraft('marriage');
      blank.order.forEach(id => D.choose(blank, id, 'skipped'));
      await display(phone, D.snapshot(blank)); await chartBounds(phone);
      assert.equal(await phone.locator('.profile-radar-area').count(), 0);
      assert.equal(await phone.locator('.profile-radar-dot.unknown').count(), 8);
      assert.equal(await phone.locator('.dimension-level.unknown').count(), 8);
      assert.equal(await phone.locator('.profile-emblem .constellation-symbol').count(), 1);
      await phoneContext.close();
      facts.push(`${width}px: mixed and empty reports fit; all radar labels inside SVG; no fabricated scores for missing data`);
    }
    fs.writeFileSync(path.join(output, 'profile-browser-evidence.json'), JSON.stringify({ kind: 'synthetic_ui_regression', facts }, null, 2));
    console.log(JSON.stringify(facts, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
