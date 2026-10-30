import { supabase, SUPABASE_URL } from '../config/supabase';
import { meetingPhotoPath } from './memoryPhotoPaths';

export function memoryPhotoStoragePath(reference: string): string | null {
  return meetingPhotoPath(reference, SUPABASE_URL);
}

/** Temporary URL for explicit exports/restores; never persist this in visits. */
export async function memoryPhotoDownloadUrl(reference: string): Promise<string> {
  const path = memoryPhotoStoragePath(reference);
  if (!path) throw new Error('Riferimento alla fotografia non valido.');
  const { data, error } = await supabase.storage.from('meetings').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error('Foto non disponibile o accesso non autorizzato.');
  return data.signedUrl;
}
