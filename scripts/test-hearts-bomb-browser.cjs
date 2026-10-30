const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const port = process.argv[2] || '4184', baseline = process.argv.includes('--baseline');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    await context.addInitScript(() => localStorage.setItem('pulse-local-demo-login-v1', 'yes'));
    const origin = `http://127.0.0.1:${port}`;
    await context.route('**/*', r => r.request().url().startsWith(origin + '/') ? r.continue() : r.abort());
    const page = await context.newPage(), errors = [], results = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install();
    await page.goto(origin + '/play/hearts');
    await page.getByRole('button', { name: 'Difficile', exact: true }).click();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
    await page.evaluate(() => { Math.random = () => 0.01; });
    const button = name => page.getByRole('button', { name, exact: true });
    for (const elapsed of baseline ? [1000] : [0, 1000, 3500, 5000]) {
      await button(elapsed === (baseline ? 1000 : 0) ? 'Inizia Acchiappa cuori' : 'Riprova Acchiappa cuori').click({ force: true });
      for (let i = 0; i < 4; i++) await button('Cuore bomba').first().click({ force: true });
      await page.getByText('0 punti · 4s', { exact: true }).waitFor();
      // Simulate a delayed timer tick: the target is still visibly on screen,
      // although its scheduled wave lifetime has elapsed.
      await page.clock.setFixedTime(new Date(await page.evaluate(() => Date.now()) + elapsed));
      await button('Cuore bomba').first().click({ force: true });
      const finished = await page.getByText('Partita finita! 0 punti', { exact: true }).count() > 0;
      assert.equal(finished, !baseline);
      if (!baseline) {
        await page.getByText('0 punti · 0s', { exact: true }).waitFor();
        assert.equal(await button('Cuore bomba').count(), 0);
      } else assert.equal(await button('Cuore bomba').count(), 5);
      results.push({ elapsedAfterFourSeconds: elapsed, finished });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(`.feature-build/hearts-bomb-${baseline ? 'before' : 'after'}.json`, JSON.stringify({ results, errors }, null, 2));
    console.log(baseline ? 'REPRODUCED: visible bomb discarded when wave lifetime expired.' : 'PASS: exact-zero, below-zero and expired-round taps finish without spawning more hearts.', results);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
