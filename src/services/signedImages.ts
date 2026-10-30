import { supabase } from '../config/supabase';
import { createSignedUrlCache } from './signedUrlCache';
export const signedImages = createSignedUrlCache(async (bucket, path, seconds) => {
  const lifetime = bucket === 'meetings' || bucket === 'story-photos' ? 300 : seconds;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, lifetime);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Foto non disponibile');
  return { url: data.signedUrl, expiresAt: Date.now() + lifetime * 1000 };
});
