// Exercise the actual edge handler with mocked network/database boundaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('supabase/functions/feature-worker/index.ts', 'utf8')
  .replace(/^import .*;\r?\n/gm, '');
async function fixture(options = {}) {
  let handler;
  const writes = [], sends = [], webSends = [], removed = [], reads = [], rpcCalls = [];
  const admin = {
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      if (name === 'feature_worker_batch') return {
        error: options.processError ? { message: 'Cron failed' } : null,
        data: { authorized: options.verified !== false,
          checked_at: new Date(Date.now() - (options.stale ? 240000 : 1000)).toISOString(),
          jobs: options.jobs || [], receipts: options.receipts || [], cleanup: options.cleanup || [] },
      };
      if (name === 'game_reminder_ready') return { data: options.gameReady !== false, error: options.gameCheckError ? { message: 'Check failed' } : null };
      if (name === 'checkin_notification_ready') return { data: Array.isArray(options.checkinReady) ? options.checkinReady.shift() : options.checkinReady !== false, error: options.checkinCheckError ? { message: 'Check failed' } : null };
      throw new Error(name);
    },
    from: table => {
      let operation = 'select';
      const query = {
        select() { reads.push(table); return query; },
        update(value) { operation = 'update'; writes.push({ table, value }); return query; },
        insert(value) { operation = 'insert'; writes.push({ table, value }); return query; },
        upsert(value) { operation = 'upsert'; writes.push({ table, value }); return query; },
        delete() { operation = 'delete'; writes.push({ table, operation }); return query; },
        eq() { return query; }, is() { return query; }, lt() { return query; },
        in() { return query; }, limit() { return query; }, maybeSingle() { return query; },
        then(resolve, reject) {
          let data = null;
          if (operation === 'select') {
            if (table === 'feature_heartbeat') data = { checked_at: new Date(Date.now() - (options.stale ? 240000 : 1000)).toISOString() };
            if (table === 'feature_push_receipts') data = options.receipts || [];
            if (table === 'capsule_cleanup') data = options.cleanup || [];
          }
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    storage: { from: () => ({ remove: async paths => { removed.push(...paths); return { error: options.cleanupError ? {} : null }; } }) },
  };
  const env = { SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test', VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'private' };
  const context = {
    createClient: () => admin,
    webpush: { setVapidDetails() {}, sendNotification: async (_, body) => { webSends.push(JSON.parse(body)); if (options.webError) throw { statusCode: options.webError }; } },
    Deno: { env: { get: key => options.noConfig ? undefined : env[key] }, serve: fn => { handler = fn; } },
    Response, Request, Date, AbortSignal,
    fetch: async (url, init) => {
      sends.push({ url, body: JSON.parse(init.body) });
      if (url.endsWith('getReceipts')) return Response.json({ data: options.receiptResults || {} });
      if (options.httpError) return new Response('', { status: 500 });
      return Response.json({ data: options.nativeExpired ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'ticket-1' } });
    },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
  const request = async (method = 'POST', secret = 'test') => handler(new Request('https://test.invalid/worker', { method, headers: secret ? { 'x-push-secret': secret } : {} }));
  return { request, writes, sends, webSends, removed, reads, rpcCalls };
}
async function main() {
  assert.equal((await (await fixture({ noConfig: true })).request()).status, 503);
  assert.equal((await (await fixture()).request('POST', '')).status, 401);
  assert.equal((await (await fixture({ verified: false })).request()).status, 401);
  assert.equal((await (await fixture()).request('GET')).status, 200);
  assert.equal((await (await fixture({ stale: true })).request('GET')).status, 503);
  assert.equal((await (await fixture()).request('DELETE')).status, 405);
  assert.equal((await (await fixture({ processError: true })).request()).status, 500);
  const idle = await fixture(); await idle.request();
  assert.equal(idle.rpcCalls.length, 1, 'One batch RPC replaces five database requests');
  assert.equal(idle.rpcCalls[0].args.p_mode, 'dispatch');
  assert.equal(idle.reads.length, 0);
  assert.equal(idle.sends.length, 0);
  const health = await fixture(); await health.request('GET');
  assert.equal(health.rpcCalls[0].args.p_mode, 'health');
  assert.equal(health.rpcCalls.length, 1); assert.equal(health.writes.length, 0);
  const job = { id: '1', user_id: 'a', title: 'Arrivo', body: 'Conferma', tag: 'checkin-alert', url: '/checkin', expo_token: 'ExpoPushToken[test]', expo_done: false, web_done: false, attempts: 1 };
  const ok = await fixture({ jobs: [{ ...job, web_subscription: { endpoint: 'https://test.invalid/push' } }], cleanup: [{ path: 'capsule/photo.jpg' }] });
  assert.equal((await (await ok.request()).json()).delivered, 1);
  assert.equal(ok.sends[0].body.channelId, 'checkin_alerts');
  assert.equal(ok.sends[0].body.data.url, '/checkin');
  assert.equal(ok.webSends[0].requireInteraction, true);
  assert.equal(ok.removed[0], 'capsule/photo.jpg');
  assert.ok(ok.writes.some(w => w.table === 'feature_push_receipts' && w.value.ticket_id === 'ticket-1'));
  const failed = await fixture({ jobs: [job], httpError: true });
  const staleCheckin = await fixture({ jobs: [job], checkinReady: false });
  await staleCheckin.request(); assert.equal(staleCheckin.sends.length, 0); assert.ok(staleCheckin.writes.some(w => w.table === 'feature_notifications' && w.value.cancelled_at));
  const uncertainCheckin = await fixture({ jobs: [job], checkinCheckError: true });
  await uncertainCheckin.request(); assert.equal(uncertainCheckin.sends.length, 0); assert.ok(!uncertainCheckin.writes.some(w => w.value?.cancelled_at));
  const changedDuringSend = await fixture({ jobs: [{ ...job, web_subscription: { endpoint: 'https://test.invalid/push' } }], checkinReady: [true, false] });
  await changedDuringSend.request(); assert.equal(changedDuringSend.sends.length, 1); assert.equal(changedDuringSend.webSends.length, 0);
  const reminder = { ...job, tag: 'game-reminder', url: '/play/tris' };
  const expiredGame = await fixture({ jobs: [reminder], gameReady: false });
  await expiredGame.request(); assert.equal(expiredGame.sends.length, 0);
  assert.ok(expiredGame.writes.some(w => w.table === 'notification_inbox' && w.operation === 'delete'));
  const uncertainGame = await fixture({ jobs: [reminder], gameCheckError: true });
  await uncertainGame.request(); assert.equal(uncertainGame.sends.length, 0);
  assert.ok(!uncertainGame.writes.some(w => w.operation === 'delete'));
  const readyGame = await fixture({ jobs: [reminder] });
  await readyGame.request(); assert.equal(readyGame.sends.length, 1);
  assert.equal((await (await failed.request()).json()).delivered, 0);
  assert.equal(failed.writes.find(w => w.table === 'feature_notifications').value.delivered_at, null);
  const partial = await fixture({ jobs: [{ ...job, expo_done: true, web_subscription: { endpoint: 'https://test.invalid/push' } }], webError: 410 });
  await partial.request(); assert.equal(partial.sends.length, 0);
  assert.ok(partial.writes.some(w => w.table === 'users' && w.value.web_push_subscription === null));
  const unreachable = await fixture({ jobs: [{ ...job, expo_token: null, attempts: 2 }] });
  await unreachable.request(); assert.ok(!unreachable.writes.some(w => w.table === 'checkin_events'));
  const receipts = await fixture({ receipts: [{ ticket_id: 'expired-ticket', user_id: 'a', token: 'old' }], receiptResults: { 'expired-ticket': { status: 'error', details: { error: 'DeviceNotRegistered' } } }, cleanup: [{ path: 'keep' }], cleanupError: true });
  await receipts.request();
  assert.ok(receipts.writes.some(w => w.table === 'users' && w.value.expo_push_token === null));
  assert.ok(!receipts.writes.some(w => w.table === 'capsule_cleanup' && w.operation === 'delete'));
  const batchJob = JSON.parse(fs.readFileSync('.feature-build/notification-batch-worker-job.json', 'utf8'));
  const batch = await fixture({ jobs: [batchJob] });
  assert.equal((await (await batch.request()).json()).delivered, 1);
  assert.equal(batch.sends.length, 1);
  assert.equal(batch.sends[0].body.body, batchJob.body);
  assert.match(batch.sends[0].body.body, /6 mosse/);
  assert.equal(batch.sends[0].body.data.url, batchJob.url);
  console.log('PASS: worker authentication, heartbeat, failures/retries, partial delivery, expired subscriptions, receipts, photo cleanup and one native delivery for the actual six-event SQL batch.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
