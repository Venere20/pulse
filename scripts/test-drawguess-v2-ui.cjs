// Exported UI, local fixtures only; all external network and sockets are blocked.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict');
const { chromium, webkit } = require('C:/Users/39345/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002';
const v22 = process.argv.includes('--v22');
const toolsMode = process.argv.includes('--tools') || v22;
async function serve() {
  const file = path.resolve('scripts/serve-local-demo.cjs'), m = new Module(file, module); m.filename = file; m.paths = module.paths;
  m._compile(fs.readFileSync(file, 'utf8').replace("path.resolve(__dirname, '../.feature-build/design-system-2-web')", JSON.stringify(path.resolve(v22 ? '.feature-build/drawguess-v22-web' : toolsMode ? '.feature-build/drawguess-tools-web' : '.feature-build/drawguess-v2-web'))), file);
  await new Promise(resolve => m.exports.listen(0, '127.0.0.1', resolve)); return m.exports;
}
async function run(browser, base, engine, width) {
  const height = width === 320 ? 568 : 844;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  await context.routeWebSocket('**/*', ws => ws.close());
  await context.addInitScript(({ A, B }) => {
    localStorage.setItem('pulse-local-demo-login-v1', 'yes');
    localStorage.setItem('pulse-draft:release-notes:' + A, '2026-10-26-drawguess-v22-partial-eraser');
    document.addEventListener('DOMContentLoaded', () => {
      const original = window.fetch, json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
      window.__game = JSON.parse(localStorage.getItem('test-game') || 'null') || { id: '00000000-0000-4000-8000-000000000003', game: 'drawguess', player_a: A, player_b: B, turn: B, status: 'playing', winner: null, revision: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), state: { drawer: A, strokes: [], drawing_revision: 0, guesses: [], letters: 4 } };
      window.__calls = []; window.__fail = false;
      window.fetch = async (input, options = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.href), body = JSON.parse(options.body || '{}');
        if (url.pathname === '/rest/v1/partner_games') return json([window.__game]);
        if (url.pathname === '/rest/v1/rpc/partner_game_secret') return json(window.__game.state.drawer === A ? { word: 'luna' } : {});
        if (url.pathname === '/rest/v1/rpc/patch_partner_drawing_state') {
          window.__calls.push({ action: 'draw_patch', body }); if (window.__fail) return json({ message: 'Salvataggio di prova non riuscito' }, 503);
          const m = window.__game; m.state.strokes = m.state.strokes.slice(0, body.p_keep_count).concat(body.p_strokes); m.state.drawing_revision++; m.revision++;
          localStorage.setItem('test-game', JSON.stringify(m)); return json(m);
        }
        if (url.pathname === '/rest/v1/rpc/play_partner_game_state') {
          const m = window.__game; window.__calls.push({ action: body.p_action, body });
          if (body.p_action === 'guess') { m.state.guesses.push(body.p_data.guess); if (body.p_data.guess === 'luna') { m.status = 'won'; m.winner = A; m.state.answer = 'luna'; } }
          if (body.p_action === 'reveal') { m.status = 'draw'; m.state.answer = 'luna'; }
          if (body.p_action === 'cancel') m.status = 'cancelled';
          m.revision++; localStorage.setItem('test-game', JSON.stringify(m)); return json(m);
        }
        if (url.pathname === '/rest/v1/rpc/start_partner_game_state') {
          window.__calls.push({ action: 'start' }); const m = window.__game;
          m.id = '00000000-0000-4000-8000-000000000004'; m.status = 'playing'; m.winner = null;
          m.state = { drawer: B, strokes: [], drawing_revision: 0, guesses: [], letters: 4 }; m.revision = 0;
          localStorage.setItem('test-game', JSON.stringify(m)); return json(m);
        }
        return original(input, options);
      };
    });
  }, { A, B });
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(12000);
  const button = name => page.getByRole('button', { name, exact: true });
  const draw = async () => {
    const canvas = page.locator('canvas'); await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .2, box.y + box.height * .2); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .7, { steps: 5 }); await page.mouse.up();
  };
  try {
    if(process.argv.includes('--guess-only')) {
      await page.goto(base + '/play/drawguess'); await page.getByText('Disegna: luna',{exact:true}).waitFor();
      await page.evaluate(B=>{window.__game.state.drawer=B;localStorage.setItem('test-game',JSON.stringify(window.__game));},B); await page.reload();
      await page.getByText('Tocca a te: indovina',{exact:true}).waitFor(); await button('Altre azioni della partita').click(); await button('Annulla partita').click();
      await page.getByText('La partita finirà per entrambi.',{exact:true}).waitFor(); await button('Continua a giocare').click(); await button('Chiudi').click(); await page.waitForTimeout(400);
      await page.getByLabel('La tua risposta',{exact:true}).fill('sole');
      console.log('INPUT DIAGNOSTIC',await page.getByLabel('La tua risposta',{exact:true}).inputValue(),await button('Indovina').isEnabled());
      await button('Indovina').click(); await page.getByText('1/8 tentativi',{exact:true}).waitFor(); await button('Tentativi precedenti').click(); await page.getByText('1. sole',{exact:true}).waitFor();
      console.log('PASS focused guess input after fully closed modal',engine); return;
    }
    await page.goto(base + '/play/drawguess'); await page.getByText('Disegna: luna', { exact: true }).waitFor();
    assert.equal(await button('Salva i tratti').isDisabled(), true);
    for (const name of ['Salva i tratti', 'Annulla', 'Altre azioni']) {
      const box = await button(name).boundingBox(); assert.ok(box.y >= 0 && box.y + box.height <= height && box.x >= 0 && box.x + box.width <= width + 1, name + ' visible');
    }
    await button('Come si gioca').click(); await page.getByText(/Il partner (ha|dispone di) otto/).waitFor(); await button('Ho capito').click();
    const colors = toolsMode ? [...fs.readFileSync('src/features/canvas/protocol.ts', 'utf8').split('] as const;')[0].matchAll(/color: '(#[A-F0-9]{6})', label: '([^']+)'/g)].map(m => [m[2], m[1]]) : [['Rosa', '#FF4D85'], ['Giallo', '#FFCB47'], ['Verde', '#59CD90'], ['Blu', '#4DA3FF'], ['Viola', '#B07CFF'], ['Bianco', '#FFFFFF']];
    for (const [name] of colors) {
      if (toolsMode) await button(v22 ? 'Tutti' : 'Colore').click();
      await button(v22 ? name : 'Seleziona ' + name).click(); await draw();
      await page.waitForFunction(expected => window.__game.state.strokes.length === expected, colors.findIndex(x => x[0] === name) + 1);
      await button('Salva i tratti').waitFor({ state: 'visible' }); await page.waitForFunction(() => document.querySelector('[aria-label="Salva i tratti"]').getAttribute('aria-disabled') === 'true');
    }
    const palette = await page.evaluate(() => window.__game.state.strokes.map(s => s.color)); assert.deepEqual(palette, colors.map(item => item[1]));
    const calls = await page.evaluate(() => window.__calls); assert.ok(calls.every(c => c.action === 'draw_patch')); assert.ok(calls.every(c => c.body.p_strokes.length === 1));
    await button('Annulla').click(); await page.waitForFunction(count => window.__game.state.strokes.length === count, colors.length - 1);
    assert.equal(await page.evaluate(() => window.__calls.at(-1).body.p_strokes.length), 0);
    if (toolsMode) {
      const choose = async name => { if(v22) { if(name==='Mano libera') await button('Penna').click(); else if(name==='Gomma') await button('Gomma').click(); else { await button('Forme').click(); await button(name).click(); } } else { await button('Strumenti').click(); await button(name).click(); await button('Fatto').click(); } };
      if(!v22) await button('Strumenti').click(); assert.equal(await button('Neon').count(), 0); assert.equal(await page.getByText(/Scompare in 10s/).count(), 0); if(!v22) await button('Fatto').click();
      for (const [name, width] of [['Fine', 3], ['Medio', 6], ['Grande', 12]]) {
        await button(v22 ? 'Modifica spessore del tratto' : 'Spessore').click(); await button(name).click(); const count = await page.evaluate(() => window.__game.state.strokes.length); await draw();
        await page.waitForFunction(n => window.__game.state.strokes.length === n + 1, count); assert.equal(await page.evaluate(() => window.__game.state.strokes.at(-1).width), width);
      }
      for (const [name, points] of [['Linea', 4], ['Rettangolo', 18], ['Cerchio', 66]]) {
        await choose(name); const canvas = page.locator('canvas'); await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox(), count = await page.evaluate(() => window.__game.state.strokes.length);
        await page.mouse.move(box.x + box.width * .2, box.y + box.height * .2); await page.mouse.down(); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .7, { steps: 5 });
        assert.equal(await page.evaluate(() => window.__game.state.strokes.length), count, 'Shape preview remains local'); await page.mouse.up(); await page.waitForFunction(n => window.__game.state.strokes.length === n + 1, count); assert.equal(await page.evaluate(() => window.__game.state.strokes.at(-1).points.length), points);
      }
      await choose('Gomma'); const canvas = page.locator('canvas'); await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox(), count = await page.evaluate(() => window.__game.state.strokes.length);
      await page.mouse.click(box.x + box.width * .7, box.y + box.height * .45); if(v22) { await page.waitForFunction(()=>window.__game.state.strokes.some(s=>s.erasures?.length)); assert.equal(await page.evaluate(()=>window.__game.state.strokes.length),count); } else await page.waitForFunction(n => window.__game.state.strokes.length === n - 1, count);
      await button('Altre azioni').click(); await button('Pulisci disegno').click(); await page.getByText('Il disegno verrà cancellato per entrambi. La partita e i tentativi continueranno.', { exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.__game.state.strokes.length), v22 ? count : count - 1); await button('Continua a giocare').click();
      await button('Pulisci disegno').click(); await button('Pulisci').click(); await page.waitForFunction(() => window.__game.state.strokes.length === 0); assert.equal(await page.evaluate(() => window.__game.status), 'playing');
      await choose('Mano libera'); await draw(); await page.waitForFunction(() => window.__game.state.strokes.length === 1);
    }
    const beforeFailure = await page.evaluate(() => window.__game.state.strokes.length);
    await page.evaluate(() => { window.__fail = true; }); await draw(); await page.getByText('Da salvare', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__game.state.strokes.length), beforeFailure);
    await page.evaluate(() => { window.__fail = false; }); await button('Salva i tratti').click(); await page.waitForFunction(n => window.__game.state.strokes.length === n + 1, beforeFailure);
    await page.getByText(v22 ? 'Disegno salvato' : 'Tratti salvati', { exact: true }).waitFor();
    await button('Altre azioni').click(); await button('Svela la parola e termina').click(); await page.getByText('Il turno finirà senza vincitore.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__game.status), 'playing'); await button('Continua a giocare').click();
    await button('Annulla partita').click(); await page.getByText('La partita finirà per entrambi.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__game.status), 'playing'); await button('Continua a giocare').click();
    await button('Svela la parola e termina').click(); await button('Svela').click(); await page.getByText('La parola era: luna', { exact: true }).waitFor();
    await button('Nuovo turno: scambiate i ruoli').click(); await page.getByText(v22 ? 'Parola di 4 lettere' : 'Parola di 4 lettere · 0/8 tentativi', { exact: true }).waitFor(); if(v22) { await button('Altre azioni della partita').click(); await button('Annulla partita').click(); await page.getByText('La partita finirà per entrambi.',{exact:true}).waitFor(); await button('Continua a giocare').click(); await button('Chiudi').click(); await page.waitForTimeout(400); }
    assert.equal(await page.getByText('Disegna: luna', { exact: true }).count(), 0);
    await page.getByLabel('La tua risposta', { exact: true }).fill(''); await page.getByLabel('La tua risposta', { exact: true }).pressSequentially('sole', {delay:40}); await button(v22 ? 'Indovina' : 'Prova a indovinare').click(); await page.getByText(v22 ? '1/8 tentativi' : 'Parola di 4 lettere · 1/8 tentativi', { exact: true }).waitFor(); if(v22) { await button('Tentativi precedenti').click(); await page.getByText('1. sole',{exact:true}).waitFor(); await button('Tentativi precedenti').click(); await page.setViewportSize({width,height:Math.max(480,height-280)}); const box=await button('Indovina').boundingBox(); assert.ok(box.y+box.height<=Math.max(480,height-280)); await page.setViewportSize({width,height}); }
    await page.getByLabel('La tua risposta', { exact: true }).fill(''); await page.getByLabel('La tua risposta', { exact: true }).pressSequentially('luna', {delay:40}); await button(v22 ? 'Indovina' : 'Prova a indovinare').click(); await page.getByText('La parola era: luna', { exact: true }).waitFor();
    // Restore a drawer round and check saved strokes and the final toolbar after reload.
    await page.evaluate(A => { const m = window.__game; m.status = 'playing'; m.state.drawer = A; delete m.state.answer; localStorage.setItem('test-game', JSON.stringify(m)); }, A);
    await page.reload(); await page.getByText('Disegna: luna', { exact: true }).waitFor();
    await page.screenshot({ path: '.feature-build/drawguess-v2-' + engine + '-' + width + '.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('[role=button]')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent)); assert.deepEqual(clipped, []);
    await button('Altre azioni').click(); await button('Annulla partita').click(); await page.getByText('La partita finirà per entrambi.', { exact: true }).waitFor(); await button('Annulla partita').click();
    await page.getByText('Turno annullato', { exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.__game.status), 'cancelled'); assert.deepEqual(errors, []);
    console.log('PASS', engine, width, toolsMode ? '24 colors, widths, shapes, eraser and clear; no Neon/temporary controls;' : 'six colors;', 'drawer/guesser, incremental autosave/retry/undo, visible confirmations, cancel/reveal, role swap, secret visibility, help, fixed toolbar and no overflow/runtime errors.');
  } catch (e) { await page.screenshot({ path: '.feature-build/drawguess-v2-failure-' + engine + '-' + width + '.png' }); console.log(await page.locator('body').innerText()); throw e; }
  finally { await context.close(); }
}
(async () => {
  const server = await serve(), base = 'http://127.0.0.1:' + server.address().port;
  try { for (const [engine, launcher, options, widths] of [['chromium', chromium, { executablePath: 'C:/Users/39345/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' }, [320, 360, 390]], ['webkit', webkit, {}, [390]]]) {
    if(process.argv.includes('--webkit') && engine!=='webkit') continue;
    const browser = await launcher.launch({ headless: true, ...options }); try { for (const width of widths) await run(browser, base, engine, width); } finally { await browser.close(); }
  } } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
