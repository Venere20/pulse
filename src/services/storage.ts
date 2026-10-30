import { supabase } from '../config/supabase';
import { prepareMemoryPhoto, PhotoAsset } from './photoPreparation';
import { memoryPreviewPath } from './memoryPhotoPaths';
import { memoryPhotoStoragePath } from './memoryPhotos';

const BUCKET = 'meetings';
export const MAX_MEMORY_PHOTOS = 5;

export async function uploadMeetingPhoto(
  visitId: string,
  asset: PhotoAsset,
  mayCommit: () => boolean = () => true
): Promise<string> {
  if (!mayCommit()) throw new Error('Caricamento annullato');
  const { photo, preview } = await prepareMemoryPhoto(asset);
  const name = `${visitId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = preview === photo ? `${name}.${photo.extension}` : `${name}.preview-${preview.extension}.full.${photo.extension}`;
  const previewPath = memoryPreviewPath(path);
  const bucket = supabase.storage.from(BUCKET);
  try {
    // Publish a URL only when both files exist. A failed/uncertain upload cleans
    // only the freshly allocated paths; saved photos are never touched here.
    const files = previewPath ? [[previewPath, preview], [path, photo]] as const : [[path, photo]] as const;
    for (const [file, value] of files) {
      if (!mayCommit()) throw new Error('Caricamento annullato');
      const { error } = await bucket.upload(file, value.bytes, { contentType: value.mime, upsert: false });
      if (error) throw error;
    }
    // Stable reference for existing records/clients, not a download URL.
    // Readers resolve it to a short-lived URL after checking Storage policies.
    return bucket.getPublicUrl(path).data.publicUrl;
  } catch (error) {
    try { await bucket.remove(previewPath ? [path, previewPath] : [path]); } catch { /* Preserve the upload error. */ }
    throw error;
  }
}

export async function removeMeetingPhoto(publicUrl: string) {
  const path = memoryPhotoStoragePath(publicUrl);
  if (!path) throw new Error('Riferimento alla fotografia non valido.');
  const preview = memoryPreviewPath(path);
  const { error } = await supabase.storage.from(BUCKET).remove(preview ? [path, preview] : [path]);
  if (error) throw error;
}
