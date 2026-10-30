import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  '';
const unsplashKey = Deno.env.get('UNSPLASH_ACCESS_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

type UnsplashPhoto = {
  id: string;
  alt_description?: string | null;
  urls?: {
    regular?: string;
    small?: string;
  };
  links?: {
    html?: string;
    download_location?: string;
  };
  user?: {
    name?: string;
    links?: { html?: string };
  };
};

async function unsplashGet(path: string): Promise<Response> {
  return fetch(`https://api.unsplash.com${path}`, {
    headers: {
      Authorization: `Client-ID ${unsplashKey}`,
      'Accept-Version': 'v1',
    },
    signal: AbortSignal.timeout(10000),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo non consentito' }, 405);
  }

  if (!url || !anonKey || !unsplashKey) {
    return json({ error: 'Configurazione incompleta' }, 503);
  }

  const authorization = req.headers.get('Authorization') ?? '';

  if (!authorization.startsWith('Bearer ')) {
    return json({ error: 'Accesso richiesto' }, 401);
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const token = authorization.slice(7);
  const { data: auth, error: authError } =
    await client.auth.getUser(token);

  if (authError || !auth.user) {
    return json({ error: 'Sessione non valida' }, 401);
  }

  // La RPC esistente risolve il profilo Pulse dell'account.
  const { data: profileId, error: profileError } =
    await client.rpc('my_profile_id');

  if (profileError || !profileId) {
    return json({ error: 'Profilo non autorizzato' }, 403);
  }

  const { data: member, error: membershipError } = await client.rpc('is_couple_member');
  if (membershipError || member !== true) return json({ error: 'Profilo non autorizzato' }, 403);

  let body: {
    action?: string;
    visitId?: string;
    photoId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Richiesta JSON non valida' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Richiesta non valida' }, 400);
  const visitId = typeof body.visitId === 'string' ? body.visitId : '';

  if (!/^[0-9a-fA-F-]{36}$/.test(visitId)) {
    return json({ error: 'Incontro non valido' }, 400);
  }

  const { data: visit, error: visitError } = await client
    .from('visits')
    .select('id, location, meeting_point')
    .eq('id', visitId)
    .maybeSingle();

  if (visitError || !visit) {
    return json({ error: 'Incontro non disponibile' }, 404);
  }

  try {
    if (body.action === 'search') {
      // Il luogo proviene dall'incontro, non da una query
      // arbitraria del client.
      const place = (visit.location || visit.meeting_point || '')
        .trim()
        .slice(0, 100);

      if (place.length < 2) {
        return json({
          error: 'Aggiungi prima la città dell’incontro.',
        }, 400);
      }

      const params = new URLSearchParams({
        query: place,
        orientation: 'landscape',
        per_page: '16',
        content_filter: 'high',
      });

      const response = await unsplashGet(
        `/search/photos?${params.toString()}`,
      );

      if (!response.ok) {
        return json(
          { error: response.status === 401
              ? 'La chiave Unsplash non risulta valida. La configurazione del servizio va verificata.'
              : response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0'
                ? 'Limite di ricerche Unsplash raggiunto. Riprova piu tardi.'
                : 'Ricerca Unsplash non disponibile' },
          response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0' ? 429 : 502,
        );
      }

      let data = await response.json();
      if (!Array.isArray(data.results)) return json({ error: 'Risposta Unsplash non valida' }, 502);
      // Addresses may include a district/street. Try only the city if the full place has no match.
      const city = place.split(/[,;|]/)[0].trim();
      if (data.results.length === 0 && city.length >= 2 && city !== place) {
        params.set('query', city);
        const fallback = await unsplashGet(`/search/photos?${params.toString()}`);
        if (!fallback.ok) return json({ error: 'Ricerca Unsplash non disponibile' }, fallback.status === 429 ? 429 : 502);
        data = await fallback.json();
        if (!Array.isArray(data.results)) return json({ error: 'Risposta Unsplash non valida' }, 502);
      }

      const photos = (data.results as UnsplashPhoto[])
        .filter((photo) => photo.id && photo.urls?.regular)
        .map((photo) => ({
          id: photo.id,
          image_url: photo.urls!.regular,
          preview_url: photo.urls!.small ?? photo.urls!.regular,
          photographer: photo.user?.name ?? 'Fotografo Unsplash',
          photographer_url: photo.user?.links?.html ?? '',
          unsplash_url: photo.links?.html ?? '',
          description: photo.alt_description ?? null,
        }));

      return json({ photos, place });
    }

    if (body.action === 'select') {
      const photoId = typeof body.photoId === 'string' ? body.photoId : '';

      if (!/^[A-Za-z0-9_-]{4,40}$/.test(photoId)) {
        return json({ error: 'Fotografia non valida' }, 400);
      }

      // Recupera i dati dalla fonte originale:
      // non accettiamo URL inventati dal client.
      const response = await unsplashGet(
        `/photos/${encodeURIComponent(photoId)}`,
      );

      if (!response.ok) {
        return json(
          { error: 'Fotografia non disponibile' },
          response.status === 429 ? 429 : 502,
        );
      }

      const photo = (await response.json()) as UnsplashPhoto;
      const imageUrl = photo.urls?.regular;
      const downloadLocation = photo.links?.download_location;

      if (
        photo.id !== photoId ||
        !imageUrl ||
        !downloadLocation
      ) {
        return json({ error: 'Dati fotografici incompleti' }, 502);
      }

      // Registra la selezione attraverso l'endpoint Unsplash.
      // Non scarica né ripubblica il file.
      const downloadUrl = new URL(downloadLocation);

      if (
        downloadUrl.protocol !== 'https:' ||
        downloadUrl.hostname !== 'api.unsplash.com'
      ) {
        return json({ error: 'URL Unsplash non valido' }, 502);
      }

      const tracked = await unsplashGet(
        downloadUrl.pathname + downloadUrl.search,
      );

      if (!tracked.ok) {
        return json(
          { error: 'Impossibile registrare la selezione' },
          502,
        );
      }

      const attribution = JSON.stringify({
        photographer: photo.user?.name ?? 'Fotografo Unsplash',
        photographer_url: photo.user?.links?.html ?? '',
        unsplash_url: photo.links?.html ?? '',
        photo_id: photo.id,
      });

      const { data: savedVisit, error: saveError } = await client
        .from('visits')
        .update({
          cover_source: 'destination',
          cover_remote_url: imageUrl,
          cover_storage_path: null,
          cover_attribution: attribution,
        })
        .eq('id', visitId).select('id').maybeSingle();

      if (saveError || !savedVisit) {
        return json({ error: 'Impossibile salvare la copertina' }, 500);
      }

      return json({ saved: true });
    }

    return json({ error: 'Azione sconosciuta' }, 400);
  } catch {
    return json({ error: 'Servizio temporaneamente non disponibile' }, 502);
  }
});
