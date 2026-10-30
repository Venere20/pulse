/* global window, document, localStorage, location, fetch, URL, Headers, crypto, btoa */
// Injected only by serve-local-demo.cjs. Never imported into the application.
function localDemo() {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Demo disponibile solo in locale');
  const authKey = 'sb-xptsgwcywxphledcafvs-auth-token';
  const dataKey = 'pulse-local-demo-data-v1';
  const loginKey = 'pulse-local-demo-login-v1';
  const me = '00000000-0000-4000-8000-000000000001';
  const partner = '00000000-0000-4000-8000-000000000002';
  const now = new Date().toISOString();
  const day = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
  const fixtures = () => ({
    users: [{ id: me, name: 'Admin', current_status: 'home' }, { id: partner, name: 'Giulia (demo)', current_status: 'sleep' }],
    couple_settings: [{ user_id: me, city: 'Roma' }, { user_id: partner, city: 'Milano' }],
    visits: [
      { id: '00000000-0000-4000-8000-000000000010', title: 'Un weekend a Firenze', start_date: day(12), end_date: day(14), location: 'Firenze', meeting_point: 'Firenze', meeting_lat: 43.77, meeting_lon: 11.25, travel_km: 580, created_by: me, status: 'planned', hotel: 'Un piccolo hotel in centro', transport: 'Treno', notes: 'Passeggiata, cena e tramonto insieme.' },
      { id: '00000000-0000-4000-8000-000000000011', title: 'Il nostro primo viaggio', start_date: day(-40), end_date: day(-38), location: 'Positano', meeting_lat: 40.63, meeting_lon: 14.48, travel_km: 420, created_by: partner, status: 'concluded', memory_notes: 'Un tramonto da ricordare.', memory_photos: ['/__demo/photo.svg'] },
      { id: '00000000-0000-4000-8000-000000000012', title: 'Una cena sul mare', start_date: day(20), end_date: day(21), location: 'Napoli', meeting_lat: 40.85, meeting_lon: 14.27, travel_km: 380, created_by: me, status: 'planned' },
    ],
    bucket_list: [
      { id: '00000000-0000-4000-8000-000000000020', title: "Vedere l'aurora boreale", category: 'place', is_completed: false, created_by: me, created_at: now },
      { id: '00000000-0000-4000-8000-000000000021', title: 'Una cena sul mare', category: 'restaurant', is_completed: false, created_by: partner, created_at: now },
    ],
    pulse_logs: [{ id: '00000000-0000-4000-8000-000000000030', sender_id: partner, created_at: now, reply_to: null }],
    trip_expenses: [], settlements: [], visit_bucket_items: [], daily_answers: [], badge_defs: [], badge_awards: [],
  });
  let db;
  try { db = JSON.parse(localStorage.getItem(dataKey)) || fixtures(); } catch { db = fixtures(); }
  const persist = () => localStorage.setItem(dataKey, JSON.stringify(db));
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const session = () => {
    const user = { id: me, aud: 'authenticated', role: 'authenticated', email: 'admin@demo.local', app_metadata: {}, user_metadata: {}, created_at: now };
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expires = Math.floor(Date.now() / 1000) + 86400;
    return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: me, aud: 'authenticated', role: 'authenticated', exp: expires })}.demo`, refresh_token: 'local-demo-only', token_type: 'bearer', expires_in: 86400, expires_at: expires, user };
  };
  // The original client may keep its session under this key. This origin is dedicated to the demo.
  localStorage.removeItem(authKey);
  if (localStorage.getItem(loginKey) === 'yes') localStorage.setItem(authKey, JSON.stringify(session()));
  const originalFetch = window.fetch.bind(window);
  const matches = (row, params) => [...params].every(([key, expression]) => {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) return true;
    if (expression.startsWith('eq.')) return String(row[key]) === expression.slice(3);
    if (expression.startsWith('neq.')) return String(row[key]) !== expression.slice(4);
    if (expression.startsWith('in.(')) return expression.slice(4, -1).split(',').includes(String(row[key]));
    return true;
  });
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.origin);
    if (url.origin === location.origin) return originalFetch(input, options);
    if (url.hostname !== 'xptsgwcywxphledcafvs.supabase.co') return json({ message: 'Servizio esterno disattivato nella demo locale' }, 503);
    if (localStorage.getItem(loginKey) !== 'yes') return json({ message: 'Accedi alla demo locale' }, 401);
    const method = (options.method || input.method || 'GET').toUpperCase();
    let body = {}; try { body = JSON.parse(options.body || '{}'); } catch { /* Binary uploads are deliberately unsupported. */ }
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/logout')) { localStorage.removeItem(loginKey); localStorage.removeItem(authKey); window.setTimeout(() => location.reload(), 100); return json({}); }
      return json(url.pathname.endsWith('/user') ? session().user : session());
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = url.pathname.split('/').pop();
      if (rpc === 'get_my_profile') return json([{ id: me, name: 'Admin', partner_id: partner }]);
      if (rpc === 'deep_talk_snapshot') {
        const marks = (db.deep_talk_marks || []).filter(row => [me, partner].includes(row.user_id));
        const answers = (db.deep_talk_answers || []).filter(row => row.week_start === body.p_week && [me, partner].includes(row.user_id) && (row.user_id === me || marks.filter(mark => mark.week_start === row.week_start && mark.q_index === row.q_index && mark.status === 'answered').length === 2));
        return json({ week_start: body.p_week, revision: Number(db.deep_talk_versions?.[body.p_week] || 0), marks, answers });
      }
      if (rpc === 'badge_pulse_history') return json([]);
      return json({ message: 'Questa azione richiede il backend reale e non è simulata nella demo.', code: 'DEMO_UNSUPPORTED' }, 501);
    }
    if (url.pathname === '/functions/v1/visit-cover-search' && method === 'POST') {
      const visit = (db.visits || []).find(row => row.id === body.visitId);
      if (!visit) return json({ error: 'Incontro non disponibile' }, 404);
      const place = visit.location || visit.meeting_point;
      if (!place) return json({ error: 'Aggiungi prima la citt� dell�incontro.' }, 400);
      const photos = Array.from({ length: 16 }, (_, i) => i + 1).map(index => ({ id: `demo-photo-${index}`, image_url: '/__demo/photo.svg?cover=' + index, preview_url: '/__demo/photo.svg?cover=' + index, photographer: 'Autore demo ' + index, photographer_url: 'https://unsplash.com/@demo', unsplash_url: 'https://unsplash.com/photos/demo-photo-' + index, description: place + ' � fotografia simulata' }));
      if (body.action === 'search') return json({ photos, place });
      if (body.action === 'select') {
        const photo = photos.find(row => row.id === body.photoId);
        if (!photo) return json({ error: 'Fotografia non valida' }, 400);
        Object.assign(visit, { cover_source: 'destination', cover_remote_url: photo.image_url, cover_storage_path: null, cover_attribution: JSON.stringify({ photographer: photo.photographer, photographer_url: photo.photographer_url, unsplash_url: photo.unsplash_url, photo_id: photo.id }) });
        persist(); return json({ saved: true });
      }
      return json({ error: 'Azione sconosciuta' }, 400);
    }
    if (!url.pathname.startsWith('/rest/v1/')) return json({ message: 'Push, file remoti e funzioni server non disponibili nella demo.' }, 501);
    const table = url.pathname.split('/').pop();
    let rows = db[table] || [];
    const selected = rows.filter(row => matches(row, url.searchParams));
    let result = selected;
    if (method === 'POST') {
      result = (Array.isArray(body) ? body : [body]).map(row => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }));
      rows.push(...result); db[table] = rows; persist();
    } else if (method === 'PATCH') { result = selected.map(row => { Object.assign(row, body); return row; }); persist(); }
    else if (method === 'DELETE') { db[table] = rows.filter(row => !selected.includes(row)); persist(); }
    const order = url.searchParams.get('order');
    if (order) result = [...result].sort((a, b) => { for (const field of order.split(',')) { const [key, direction] = field.split('.'); const compared = String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (direction === 'desc' ? -1 : 1); if (compared) return compared; } return 0; });
    const offset = Number(url.searchParams.get('offset') || 0);
    result = result.slice(offset, url.searchParams.has('limit') ? offset + Number(url.searchParams.get('limit')) : undefined);
    const headers = new Headers(options.headers || input.headers);
    return json(headers.get('Accept')?.includes('vnd.pgrst.object') ? result[0] || null : result);
  };
  document.addEventListener('DOMContentLoaded', () => {
    // Application scripts are deferred by the local server until demo authentication.
    const loadApp = () => document.querySelectorAll('script[data-demo-src]').forEach(script => { const next = document.createElement('script'); next.src = script.dataset.demoSrc; next.defer = true; next.async = false; document.body.appendChild(next); });
    const style = document.createElement('style');
    style.textContent = '#pulse-demo-login{position:fixed;inset:0;z-index:999999;background:#141118;color:#F6EFF4;display:grid;place-items:center;font:16px system-ui}#pulse-demo-login form{width:min(340px,85vw);display:grid;gap:16px}#pulse-demo-login input,#pulse-demo-login button{font:inherit;padding:14px;border-radius:12px;border:1px solid #473948;background:#29222F;color:#F6EFF4}#pulse-demo-login button{background:#E99BB0;color:#281823;cursor:pointer}#pulse-demo-tools{position:fixed;top:0;right:0;z-index:99999;font:11px system-ui;background:#29222F;color:#F6EFF4;border-radius:0 0 0 8px;padding:5px}#pulse-demo-tools button{color:#E99BB0;background:none;border:0;cursor:pointer}';
    // Keep demo controls outside the app's header and its touch targets.
    style.textContent += '#root{box-sizing:border-box;padding-top:28px}#pulse-demo-tools{left:0;height:28px;box-sizing:border-box;border-radius:0;display:flex;justify-content:flex-end;align-items:center;gap:4px}';
    document.head.appendChild(style);
    const tools = document.createElement('div'); tools.id = 'pulse-demo-tools'; tools.textContent = 'DEMO LOCALE · ';
    const reset = document.createElement('button'); reset.textContent = 'Reset dati'; reset.onclick = () => { if (window.confirm('Ripristinare tutti i dati della demo?')) { localStorage.removeItem(dataKey); location.reload(); } }; tools.appendChild(reset);
    const logout = document.createElement('button'); logout.textContent = 'Esci'; logout.onclick = () => { localStorage.removeItem(loginKey); localStorage.removeItem(authKey); location.reload(); }; tools.appendChild(logout); document.body.appendChild(tools);
    if (localStorage.getItem(loginKey) === 'yes') return loadApp();
    const gate = document.createElement('div'); gate.id = 'pulse-demo-login';
    gate.innerHTML = '<form><h1>Pulse · Demo locale</h1><p>Dati di prova. Nessun collegamento al database online.</p><label>Nome utente<input name="username" autocomplete="username" required style="display:block;width:100%;box-sizing:border-box" /></label><label>Password<input name="password" type="password" autocomplete="current-password" required style="display:block;width:100%;box-sizing:border-box" /></label><button>Accedi</button><span role="alert"></span><small>Credenziali di prova: admin / admin</small></form>';
    gate.querySelector('form').onsubmit = event => { event.preventDefault(); const form = event.currentTarget; if (form.elements.username.value === 'admin' && form.elements.password.value === 'admin') { localStorage.setItem(loginKey, 'yes'); location.reload(); } else gate.querySelector('[role=alert]').textContent = 'Nome utente o password non corretti.'; };
    document.body.appendChild(gate);
  });
}
module.exports = localDemo;
