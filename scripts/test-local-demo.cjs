const assert = require('node:assert/strict');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const localDemo = require('./local-demo-browser.js');
const server = require('./serve-local-demo.cjs');

function browser(storage = new Map(), hostname = '127.0.0.1') {
  const elements = [];
  let ready, loaded = 0, reloads = 0, network = 0;
  const node = () => ({ appendChild() {}, querySelector(selector) { return selector === 'form' ? this.form : this.alert; }, form: {}, alert: {} });
  const document = {
    head: { appendChild() {} },
    body: { appendChild(element) { elements.push(element); if (element.src) loaded++; } },
    createElement: node,
    querySelectorAll: () => [{ dataset: { demoSrc: '/entry.js' } }],
    addEventListener: (_, callback) => { ready = callback; },
  };
  const context = vm.createContext({
    document, URL, Headers, Response, crypto: webcrypto,
    btoa: value => Buffer.from(value).toString('base64'),
    location: { hostname, origin: `http://${hostname}:4178`, reload: () => { reloads++; } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { fetch: async () => { network++; return new Response('local file'); }, setTimeout: callback => callback(), confirm: () => true },
  });
  vm.runInContext(`(${localDemo.toString()})();`, context);
  ready();
  return { context, storage, elements, loaded: () => loaded, reloads: () => reloads, network: () => network };
}

async function main() {
  const first = browser();
  assert.equal(first.loaded(), 0, 'App must wait for demo login');
  const login = first.elements.find(element => element.id === 'pulse-demo-login');
  const submit = (username, password) => login.form.onsubmit({ preventDefault() {}, currentTarget: { elements: { username: { value: username }, password: { value: password } } } });
  submit('admin', 'wrong');
  assert.equal(first.reloads(), 0);
  assert.equal(first.storage.has('pulse-local-demo-login-v1'), false);
  submit('admin', 'admin');
  assert.equal(first.reloads(), 1);
  const active = browser(first.storage);
  assert.equal(active.loaded(), 1);
  const storedSession = JSON.parse(active.storage.get('sb-xptsgwcywxphledcafvs-auth-token'));
  assert.equal(storedSession.user.email, 'admin@demo.local');
  const request = (path, options) => active.context.window.fetch(`https://xptsgwcywxphledcafvs.supabase.co${path}`, options);
  const profile = await (await request('/rest/v1/rpc/get_my_profile', { method: 'POST' })).json();
  assert.equal(profile[0].name, 'Admin');
  const visits = await (await request('/rest/v1/visits?select=*')).json();
  assert.equal(visits.length, 3);
  const created = await (await request('/rest/v1/bucket_list', { method: 'POST', body: JSON.stringify({ title: 'Solo locale' }) })).json();
  await request(`/rest/v1/bucket_list?id=eq.${created[0].id}`, { method: 'PATCH', body: JSON.stringify({ title: 'Modificato' }) });
  const changed = await (await request(`/rest/v1/bucket_list?id=eq.${created[0].id}`)).json();
  assert.equal(changed[0].title, 'Modificato');
  await request(`/rest/v1/bucket_list?id=eq.${created[0].id}`, { method: 'DELETE' });
  assert.equal((await (await request(`/rest/v1/bucket_list?id=eq.${created[0].id}`)).json()).length, 0);
  assert.equal((await request('/functions/v1/send-push', { method: 'POST' })).status, 501);
  assert.equal((await request('/rest/v1/rpc/create_fridge_note', { method: 'POST' })).status, 501);
  assert.equal((await active.context.window.fetch('https://external.example/')).status, 503);
  assert.equal(active.network(), 0, 'Demo operations must never reach network');
  assert.throws(() => browser(new Map(), 'pulse.example'), /solo in locale/);
  await request('/auth/v1/logout', { method: 'POST' });
  assert.equal(active.storage.has('pulse-local-demo-login-v1'), false);
  assert.equal(active.storage.has('sb-xptsgwcywxphledcafvs-auth-token'), false);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    const html = await response.text();
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.match(html, /<script src="\/__demo\/bridge.js"><\/script>/);
    assert.match(html, /data-demo-src="\/_expo/);
    assert.doesNotMatch(html, /<script src="\/_expo/);
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('Demo locale: login, sessione, dati, CRUD, logout e isolamento rete verificati.');
}
main().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
