import { supabase } from '../../config/supabase';
import { preparePhoto, PhotoAsset } from '../../services/photoPreparation';

export const STORY_PHOTO_LIMIT = 3;
export const STORY_PHOTO_BUCKET = 'story-photos';

export async function uploadStoryPhoto(owner: string, asset: PhotoAsset): Promise<string> {
  const photo = await preparePhoto(asset, 5 * 1024 * 1024);
  const path = `${owner}/${Date.now()}-${Math.random().toString(36).slice(2, 12)}.${photo.extension}`;
  const { error } = await supabase.storage.from(STORY_PHOTO_BUCKET).upload(path, photo.bytes, { contentType: photo.mime, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeStoryPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(STORY_PHOTO_BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}
