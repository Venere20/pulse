import { supabase } from '../config/supabase';
import { preparePhoto } from './photoPreparation';

const BUCKET = 'visit-covers';
const MAX_BYTES = 8 * 1024 * 1024;

type CoverAsset = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

export async function uploadVisitCover(
  visitId: string,
  asset: CoverAsset,
): Promise<string> {
  const { bytes, mime, extension } = await preparePhoto(asset, MAX_BYTES, 1600);

  const filename =
    `${Date.now()}-` +
    Math.random().toString(36).slice(2, 12);

  const path = `${visitId}/${filename}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: '3600',
    });

  if (error) throw error;

  // Restituiamo il percorso privato, non un URL pubblico.
  return path;
}

export async function removeVisitCover(
  path: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) throw error;
}
