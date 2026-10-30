import { supabase } from '../config/supabase';

export interface UnsplashCover {
  id: string;
  image_url: string;
  preview_url: string;
  photographer: string;
  photographer_url: string;
  unsplash_url: string;
  description: string | null;
}


async function coverServiceError(data: { error?: string } | null, error: unknown, fallback: string): Promise<Error> {
  if (typeof data?.error === 'string') return new Error(data.error);
  // FunctionsHttpError keeps the JSON body in context, not in the returned data.
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === 'string') return new Error(body.error);
      if (context.status === 401) return new Error('Sessione non valida. Accedi di nuovo e riprova.');
    } catch { /* Keep the transport error when no JSON body is available. */ }
  }
  return new Error(error instanceof Error ? error.message : fallback);
}

export async function searchVisitCovers(
  visitId: string,
  signal?: AbortSignal,
): Promise<UnsplashCover[]> {
  const { data, error } = await supabase.functions.invoke(
    'visit-cover-search',
    {
      signal,
      body: {
        action: 'search',
        visitId,
      },
    },
  );

  if (error || data?.error) {
    throw await coverServiceError(data, error, 'Ricerca fotografica non disponibile');
  }

  if (!Array.isArray(data?.photos)) throw new Error('Risposta della ricerca non valida. Riprova.');
  return data.photos;
}

export async function selectVisitCover(
  visitId: string,
  photoId: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    'visit-cover-search',
    {
      body: {
        action: 'select',
        visitId,
        photoId,
      },
    },
  );

  if (error || data?.error || data?.saved !== true) {
    throw await coverServiceError(data, error, 'Impossibile salvare la copertina');
  }
}
