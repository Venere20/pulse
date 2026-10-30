const fs = require('node:fs');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  fs.mkdirSync('.feature-build/pdf-review', { recursive: true });
  fs.mkdirSync('output/pdf', { recursive: true });
  await esbuild.build({ entryPoints: ['src/utils/report.ts'], bundle: true, platform: 'node', outfile: '.feature-build/pdf-review/report.cjs' });
  await esbuild.build({ entryPoints: ['src/utils/printWebReport.ts'], bundle: true, format: 'iife', globalName: 'ReportPrint', outfile: '.feature-build/pdf-review/print.js' });
  const { buildVisitReportHtml } = require('../.feature-build/pdf-review/report.cjs');
  const visit = { id: 'test', title: 'Un weekend insieme', start_date: '2026-10-10', end_date: '2026-10-12', location: 'Firenze', hotel: 'Un piccolo hotel in centro', created_by: 'a' };
  const names = { a: 'Giulia', b: 'Andrea' };
  const row = i => ({ id: String(i), title: i === 2 ? 'DescrizioneLunghissimaSenzaSpazi'.repeat(9) : `Spesa ${i + 1}: cena, trasporti e piccoli ricordi del viaggio`, amount: 25.50, category: i % 2 ? 'Cibo' : 'Trasporti', date: '2026-10-10', paid_by: i % 2 ? 'a' : 'b' });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' });
  try {
    const page = await browser.newPage();
    const cases = [['breve', 5], ['vuoto', 0], ['multipagina', 75]];
    const results = [];
    for (const [name, count] of cases) {
      const expenses = Array.from({ length: count }, (_, i) => count > 5 ? row(i) : { ...row(i), title: `Spesa ${i + 1}: cena e trasporti` });
      const settlements = count ? [{ id: 's', visit_id: 'test', from_user_id: 'a', to_user_id: 'b', amount: 10, created_at: '2026-10-11T12:00:00Z' }] : [];
      const html = buildVisitReportHtml(visit, expenses, settlements, 'a', 'b', names);
      await page.setContent(html);
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('table').evaluateAll(tables => tables.every(t => t.scrollWidth <= t.clientWidth + 1)), true);
      const result = await page.pdf({ path: `output/pdf/pulse-spese-${name}.pdf`, preferCSSPageSize: true, printBackground: true });
      assert.ok(result.length > 1000);
      results.push({ name, count, bytes: result.length });
    }
    // Use the real helper and assert that only the report window receives print().
    await page.setContent('<h1>SCHERMATA APP DA NON STAMPARE</h1>');
    await page.addScriptTag({ path: '.feature-build/pdf-review/print.js' });
    await page.evaluate(() => {
      window.appPrintCalls = 0; window.print = () => window.appPrintCalls++;
      const open = window.open.bind(window);
      window.open = (...args) => { const child = open(...args); child.printCalls = 0; child.print = () => child.printCalls++; return child; };
    });
    const popupReady = page.waitForEvent('popup');
    await page.evaluate(html => window.ReportPrint.printWebReport(html), buildVisitReportHtml(visit, [row(0)], [], 'a', 'b', names));
    const popup = await popupReady;
    await popup.waitForFunction(() => window.printCalls > 0);
    assert.equal(await page.evaluate(() => window.appPrintCalls), 0);
    assert.equal(await popup.locator('body').innerText().then(t => t.includes('SCHERMATA APP')), false);
    assert.equal(await popup.evaluate(() => window.opener), null);
    await popup.getByRole('button', { name: 'Stampa / Salva come PDF' }).click();
    assert.ok(await popup.evaluate(() => window.printCalls) >= 2);
    await popup.emulateMedia({ media: 'print' });
    assert.equal(await popup.locator('.print-controls').isVisible(), false);
    await page.evaluate(() => { window.open = () => null; });
    assert.match(await page.evaluate(() => { try { window.ReportPrint.printWebReport(''); } catch (e) { return e.message; } }), /Consenti/);
    const escaped = buildVisitReportHtml({ ...visit, title: '<script>alert(1)</script>' }, [{ ...row(0), title: '<img src=x onerror=alert(1)>' }], [], 'a', 'b', names);
    await page.setContent(escaped);
    assert.equal(await page.locator('script,img').count(), 0);
    fs.writeFileSync('.feature-build/pdf-review/results.json', JSON.stringify({ cases: results, isolatedPrinting: true, popupFallback: true, escapedUserText: true }, null, 2));
    console.log('PASS expense report: three PDFs, isolated printing, manual retry, popup error, escaped content.', results);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
