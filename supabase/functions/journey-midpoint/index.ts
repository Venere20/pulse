import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const apiKey = Deno.env.get('GOOGLE_ROUTES_API_KEY') ?? '';
const fixed = [
  { id: 'beverello', name: 'Napoli Molo Beverello', lat: 40.837, lon: 14.253 },
  { id: 'centrale', name: 'Napoli Centrale', lat: 40.852, lon: 14.273 },
  { id: 'portici', name: 'Portici', lat: 40.816, lon: 14.337 },
];
async function geocode(query: string) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set(query.startsWith('latlng:') ? 'latlng' : 'address', query.replace(/^latlng:/, ''));
  url.searchParams.set('key', apiKey); url.searchParams.set('language', 'it'); url.searchParams.set('region', 'it');
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const body = await response.json(), result = body.results?.[0];
  if (!response.ok || !result) throw new Error('Luogo non disponibile');
  return { name: result.formatted_address as string, lat: Number(result.geometry.location.lat), lon: Number(result.geometry.location.lng) };
}
async function approach(city: string, modes: string[], target: typeof fixed[number], departure: Date) {
  let origin = city, extraM = 0, extraMin = 0;
  const island = /\bischia\b/i.test(city);
  if (modes.includes('Aereo') || modes.includes('Traghetto') || (modes.includes('Auto') && modes.some(m => ['Treno','Metro','Bus'].includes(m)))) throw new Error('Combinazione da specificare manualmente');
  if (island) {
    if (!modes.includes('Aliscafo')) throw new Error('Il collegamento marittimo non è specificato');
    origin = 'Napoli Molo Beverello'; extraM = 33000; extraMin = 45;
    if (target.id === 'beverello') return { meters: extraM, minutes: extraMin };
  } else if (modes.includes('Aliscafo')) throw new Error('Tratta marittima non configurata');
  const transit = modes.some(m => ['Treno','Metro','Bus'].includes(m));
  const travelMode = modes.includes('Auto') ? 'DRIVE' : transit ? 'TRANSIT' : modes.includes('Cammino') ? 'WALK' : null;
  if (!travelMode) throw new Error('Scegli i mezzi per il tratto terrestre');
  const body: Record<string, unknown> = { origin: { address: origin }, destination: { address: target.name }, travelMode, languageCode: 'it-IT', regionCode: 'IT' };
  if (transit && travelMode === 'TRANSIT') {
    body.departureTime = new Date(departure.getTime() + extraMin * 60000).toISOString();
    body.transitPreferences = { allowedTravelModes: modes.flatMap(m => m === 'Treno' ? ['TRAIN'] : m === 'Metro' ? ['SUBWAY'] : m === 'Bus' ? ['BUS'] : []) };
  }
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const data = await response.json(), r = data.routes?.[0], seconds = Number(String(r?.duration ?? '').replace(/s$/, ''));
  if (!response.ok || !Number.isSafeInteger(r?.distanceMeters) || r.distanceMeters < 0 || !Number.isFinite(seconds) || seconds < 0) throw new Error('Tratta non disponibile');
  return { meters: r.distanceMeters + extraM, minutes: Math.ceil(seconds / 60) + extraMin };
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Accesso richiesto' }, 401);
  const url=Deno.env.get('SUPABASE_URL')??'', anon=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??'';
  if(!url||!anon)return json({error:'Servizio non configurato'},503);
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
  if (authError || !auth.user) return json({ error: 'Sessione non valida' }, 401);
  let body: { visitId?: string };
  try { body = await req.json(); } catch { return json({ error: 'Richiesta non valida' }, 400); }
  if (!body || typeof body.visitId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.visitId)) return json({ error: 'Incontro non valido' }, 400);
  const {data:context,error:contextError}=await client.rpc('get_journey_context',{p_visit:body.visitId});
  if(contextError||!context?.me)return json({error:'Incontro o profilo non disponibile'},403);
  const mine=context.mine,partner=context.partner,ownModes=mine?.modes,partnerModes=partner?.modes;
  if (!mine?.city || !partner?.city || !Array.isArray(ownModes) || !ownModes.length || !Array.isArray(partnerModes) || !partnerModes.length) return json({ error: 'Indicate le partenze nelle impostazioni e salvate i mezzi di entrambi nell’incontro.' }, 400);
  if (!apiKey) return json({ error: 'Il servizio dei percorsi non è configurato. Nessun calcolo API è stato eseguito.' }, 503);
  try {
    let points = fixed;
    if (!/\bischia\b/i.test(`${mine.city} ${partner.city}`)) {
      const [a, b] = await Promise.all([geocode(mine.city), geocode(partner.city)]);
      const middle = await geocode(`latlng:${(a.lat+b.lat)/2},${(a.lon+b.lon)/2}`);
      points = [a,b,middle].map((p,i) => ({ ...p, id: `candidate-${i}` }));
    }
    const candidates = [], departure = new Date();
    // Three candidate places maximum, six route calls maximum. No cron/polling/cache of provider payloads.
    for (const point of points) {
      try { const [a,b] = await Promise.all([approach(mine.city,ownModes,point,departure),approach(partner.city,partnerModes,point,departure)]);
        candidates.push({ ...point, mine:a, partner:b, source: 'api' });
      } catch { /* Missing/unsupported routes do not become straight-line estimates. */ }
    }
    return json({ candidates, comparedAt: departure.toISOString(), boundedSearch: true });
  } catch { return json({ error: 'Confronto non disponibile. Controlla i luoghi e riprova.' }, 502); }
});
